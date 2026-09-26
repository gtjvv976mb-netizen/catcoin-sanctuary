import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import fs from "node:fs";
import { T } from "./lib.mjs";
const FPS = 12;
const which = process.argv[2];
const b = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => {
  const real = performance.now.bind(performance); let frozen = null;
  window.__vt = { freeze() { frozen = real(); }, add(ms) { frozen += ms; } };
  performance.now = () => (frozen ?? real());
});
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));
await T("open", async () => {
  await p.goto("http://127.0.0.1:8768/?v=3&q=" + (which === "orbit" ? "medium" : "low") + "&debug&noadapt");
  await p.waitForFunction(() => document.body.classList.contains("ready"), null, { timeout: 600000 });
});
await p.evaluate(() => { window.__world.pause(); window.__vt.freeze(); window.__world.advance(0); });
const cdp = await ctx.newCDPSession(p);
const dir = `frames/${which}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
let n = 0;
const frame = async () => {
  await p.evaluate((ms) => { window.__vt.add(ms); window.__world.pause(); window.__world.advance(0); }, 1000 / FPS);
  const r = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92 });
  fs.writeFileSync(`${dir}/${String(n++).padStart(4, "0")}.jpg`, Buffer.from(r.data, "base64"));
  if (n % 15 === 0) console.log(which, "frame", n);
};
const frames = async (k, each) => { for (let i = 0; i < k; i++) { if (each) await each(i); await frame(); } };
const settle = async (k) => { for (let i = 0; i < k; i++) await p.evaluate(() => { window.__vt.add(250); window.__world.advance(0); }); };
const nearest = (x, y, skip = 0) => p.evaluate(([x, y, skip]) => {
  const cs = window.__world.catsOnScreen().filter((c) => c.z < 1).map((c) => ({ ...c, d: Math.hypot(c.x - x, c.y - y) })).sort((a, b) => a.d - b.d);
  return cs[skip];
}, [x, y, skip]);
const key = (k, n = 1) => p.evaluate(([k, n]) => { const c = document.getElementById("world"); for (let i = 0; i < n; i++) c.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); }, [k, n]);
const reset = async () => { await p.keyboard.press("Escape"); await p.evaluate(() => { window.__world.choose(null); window.__world.home(); window.__world.pause(); }); await settle(2); };
// Drag horizontally by dx px per frame: a slow hand-held orbit.
const drag = async (k, dx, x0 = 640, y0 = 420) => {
  await p.mouse.move(x0, y0); await p.mouse.down(); let x = x0;
  await frames(k, async () => { x += dx; await p.mouse.move(x, y0); });
  await p.mouse.up();
};
await settle(4);

if (which === "orbit") {
  await key("+", 1); await settle(2);
  await drag(Math.round(FPS * 9), 2.6, 300);
}
if (which === "cats") {
  const c = await nearest(760, 600);
  await p.evaluate((id) => { window.__world.choose(id); window.__world.pause(); }, c.id);
  await settle(6);
  await drag(Math.round(FPS * 7), -1.6, 700, 300);
}
if (which === "research") {
  const c = await nearest(660, 520 * 720 / 900);
  await p.evaluate((id) => { window.__world.choose(id); window.__world.pause(); }, c.id);
  await settle(6);
  await drag(Math.round(FPS * 6), 2.0, 300, 250);
}
if (which === "adopt") {
  // find an adoptable cat near the middle first (not recorded)
  let id = null;
  for (let k = 0; k < 15 && !id; k++) {
    const c = await nearest(640, 500, k);
    await p.mouse.click(c.x, c.y); await p.evaluate(() => window.__world.pause()); await settle(1);
    if (await p.evaluate(() => { const card = document.getElementById("card"); return card && !card.hidden && !!card.querySelector(".btn-adopt"); })) id = c.id;
    await reset();
  }
  console.log("adopt cat", id);
  await settle(3);
  await frames(Math.round(FPS * 1));
  const s = await p.evaluate((id) => window.__world.screenOf(id), id);
  await p.mouse.move(s.x - 60, s.y - 40);
  await frames(4, async (i) => p.mouse.move(s.x - 60 + i * 15, s.y - 40 + i * 10 + 12));
  const s2 = await p.evaluate((id) => window.__world.screenOf(id), id);
  await p.mouse.click(s2.x, s2.y + 12); await p.evaluate(() => window.__world.pause());
  await frames(Math.round(FPS * 2.5));
  await p.evaluate(() => document.querySelector("#card .btn-adopt").click());
  await frames(Math.round(FPS * 2.5));
  await frames(Math.round(FPS * 1.5), async () => p.evaluate(() => { const s = document.querySelector("#card .adopt-panel, #card .card-body, #card"); const sc = [...document.querySelectorAll("#card *")].find((e) => e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== "visible"); if (sc) sc.scrollTop += 18; }));
  await frames(Math.round(FPS * 0.5));
}
await b.close();
console.log(which, "frames", n);
