/**
 * CAPTURE EACH CAT'S IN-GAME LOOK: assets/ingame/<KEY>.jpg (1600x900), the second image on its X post
 * (scripts/announce.mjs). The page itself never loads these files.
 *
 *   node scripts/capture-ingame.mjs            every cat that can still be posted (backlog, queued,
 *                                              unrecorded, failed, held, and the release queue) with no shot yet
 *   node scripts/capture-ingame.mjs KEY…       just these cats (retakes them)
 *   node scripts/capture-ingame.mjs --all      retake every postable cat
 *
 * How: serves the site on a free local port (python3 -m http.server), opens ?q=high&debug in headless
 * Chromium (Playwright), hides the HUD with an injected stylesheet, then for each cat chooses it
 * (the camera flies to it, no card, no inset), waits for its full HD model and shoots the canvas.
 * Needs Playwright (PLAYWRIGHT_MODULE, default /opt/node22/lib/node_modules/playwright/index.mjs)
 * and its Chromium (PLAYWRIGHT_BROWSERS_PATH, default /opt/pw-browsers).
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { listCats, readJson } from "./announce.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const INGAME_DIR = "assets/ingame";
export const ingamePath = (key) => `${INGAME_DIR}/${key}.jpg`;

/** Every cat that can still be posted: anything not already posted, plus the unreleased release queue. */
export function postableKeys(root = ROOT) {
  const d = (f, fb) => readJson(path.join(root, "data", f), fb);
  const cats = listCats(d("planned.json", { stocks: [], cats: [] }), d("collection.json", { cats: [] }), d("adoptables.json", { cats: [] }));
  const state = d("announced.json", { cats: {} }).cats || {};
  const queue = (d("release-queue.json", { cats: [] }).cats || []).filter((q) => q.status !== "released").map((q) => q.key);
  const keys = cats.filter((c) => !["posted", "posting"].includes(state[c.key]?.status)).map((c) => c.key);
  // Backlog first, in announced.json order, so the next posts are shot first.
  const order = Object.keys(state);
  keys.sort((a, b) => (state[a]?.status === "backlog" ? 0 : 1) - (state[b]?.status === "backlog" ? 0 : 1) || order.indexOf(a) - order.indexOf(b));
  return [...new Set([...keys, ...queue])];
}

const freePort = (start) => new Promise((resolve) => {
  const s = net.createServer();
  s.once("error", () => resolve(freePort(start + 1)));
  s.listen(start, "127.0.0.1", () => s.close(() => resolve(start)));
});

/** How much tighter than the card view the shot is. */
const ZOOM = 1.8;
const HIDE_UI = `body > *:not(canvas#world) { visibility: hidden !important; } canvas#world { visibility: visible !important; }`;

export async function capture(keys, { root = ROOT, log = console.log } = {}) {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= "/opt/pw-browsers";
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.mjs").href);
  const port = await freePort(8769);
  const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  const out = { ok: [], failed: [] };
  let browser;
  try {
    await new Promise((r) => setTimeout(r, 800));
    browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, bypassCSP: true });
    await page.goto(`http://127.0.0.1:${port}/?q=high&debug&noadapt`, { waitUntil: "load" });
    await page.addStyleTag({ content: HIDE_UI });
    await page.waitForFunction(() => window.__world, null, { timeout: 300_000 });
    await page.evaluate(() => window.__world.pause());   // frames are drawn only for the shots
    fs.mkdirSync(path.join(root, INGAME_DIR), { recursive: true });
    for (const key of keys) {
      try {
        const has = await page.evaluate((id) => !!window.__world.sim.byId(id), key);
        if (!has) throw new Error("not in the garden");
        await page.evaluate((id) => { const w = window.__world; w.setInset(0, 0); w.choose(id, { ease: false }); w.pause(); }, key);
        // The full model: wait for it (a cat with no own model keeps the shared one).
        const hd = await page.waitForFunction((id) => !!window.__world.herd.own.get(id)?.hi, key, { timeout: 150_000, polling: 500 }).then(() => true, () => false);
        // No flight (ease: false) and the loop paused while the model streams in: the software GL
        // renderer would otherwise starve the loader.
        await page.evaluate(() => { window.__world.camera.updateMatrixWorld(); });
        const pos = await page.evaluate((id) => window.__world.screenOf(id), key);
        if (!pos?.visible || Math.abs(pos.x - 800) > 330 || Math.abs(pos.y - 450) > 190) throw new Error(`cat off-centre (${JSON.stringify(pos)})`);
        // Draw one frame with the loop paused and read the canvas straight away (a page screenshot
        // waits on the busy animation loop under software GL). Only the canvas: no HUD, no card.
        const url = await page.evaluate((ZOOM) => {
          const w = window.__world, c = document.getElementById("world");
          // Closer than the card's view: a tighter lens on the chosen cat .
          w.camera.zoom = ZOOM; w.camera.updateProjectionMatrix();
          w.settle(); w.advance(1 / 30);
          const u = c.toDataURL("image/jpeg", 0.62);
          w.camera.zoom = 1; w.camera.updateProjectionMatrix();
          return u;
        }, ZOOM);
        const buf = Buffer.from(url.split(",")[1], "base64");
        if (buf.length < 20_000) throw new Error(`blank frame (${buf.length} bytes)`);
        const file = path.join(root, ingamePath(key));
        fs.writeFileSync(file, buf);
        out.ok.push(key);
        log(`${key}: ${ingamePath(key)} (${Math.round(fs.statSync(file).size / 1024)} KB${hd ? "" : ", shared model"})`);
      } catch (e) {
        out.failed.push({ key, error: e.message });
        log(`${key}: FAILED (${e.message})`);
      }
    }
  } finally {
    await browser?.close();
    server.kill();
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const named = args.filter((a) => !a.startsWith("--"));
  const keys = named.length ? named : postableKeys().filter((k) => args.includes("--all") || !fs.existsSync(path.join(ROOT, ingamePath(k))));
  console.log(`Capturing ${keys.length} cats…`);
  const r = await capture(keys);
  console.log(`Captured ${r.ok.length}, failed ${r.failed.length}.${r.failed.length ? " " + r.failed.map((f) => f.key).join(" ") : ""}`);
  if (r.failed.length) process.exitCode = 1;
}
