import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import fs from "node:fs";
const out = process.argv[2], port = process.argv[3];
const say = (m) => fs.appendFileSync(`${out}/shot.log`, m + "\n");
const cats = [["famous","hosico-cat"],["stock","MIGGLES"],["adoptable","TAMAEKI"]];
const b = await chromium.launch({ args: ["--disable-dev-shm-usage", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
say("launched");
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
let p;
const hook = (p) => { p.on("crash", () => say("CRASH")); p.on("requestfailed", (r) => { if (r.url().includes("twimg")) say("FAILED " + r.url() + " " + r.failure()?.errorText); });
p.on("response", (r) => { if (r.url().includes("twimg")) say(r.status() + " " + r.url()); }); };
for (const [k, id] of cats) {
  p = await ctx.newPage(); hook(p);
  await p.goto(`http://127.0.0.1:${port}/#cat=${id}`, { waitUntil: "commit", timeout: 20000 }).catch((e) => say("goto " + e.message));
  say("went " + id);
  await p.waitForSelector("#card:not([hidden]) .card-body", { timeout: 25000 }).catch(() => say("no card " + id));
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => ({ cap: document.querySelector(".card-real-photo-caption")?.textContent, ing: document.querySelector(".card-ingame-caption")?.textContent, first: document.querySelector(".card-body")?.firstElementChild?.className, loaded: document.querySelector(".card-real-photo-img")?.naturalWidth })).catch((e) => e.message);
  say(k + " " + id + " " + JSON.stringify(info));
  const box = await p.evaluate(() => { const c = document.getElementById("world"); if (c) { c.style.display = "none"; c.width = 1; c.height = 1; } const r = document.getElementById("card").getBoundingClientRect(); return { x: r.x, y: r.y, width: Math.max(1, r.width), height: Math.max(1, r.height) }; }).catch((e) => { say("box " + e.message); return null; });
  say("box " + JSON.stringify(box));
  await p.screenshot({ clip: box || undefined, path: `${out}/card-${k}-${id}.png`, timeout: 30000, animations: "disabled", caret: "initial" }).catch((e) => say("shot " + e.message));
  if (false) await p.screenshot({ path: `${out}/card-${k}-${id}.png`, timeout: 15000, animations: "disabled" }).catch((e) => say("shot " + e.message));
  await p.close().catch(() => {});
}
await b.close();
say("done");
