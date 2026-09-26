// Screenshots of the bigger garden: node shots.mjs OUTDIR [--only name,name]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const playwright = require(path.join(process.execPath, "../../lib/node_modules/playwright"));
const ROOT = "/home/user/cat-sanctuary";
const OUT = path.resolve(process.argv[2] || "shots");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  let f = path.join(ROOT, decodeURIComponent(u.pathname));
  if (f.endsWith("/")) f += "index.html";
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await playwright.chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://localhost:${port}/?debug&noadapt`, { waitUntil: "load" });
await page.waitForFunction(() => window.__world && document.body.classList.contains("ready"), null, { timeout: 180000 });
const setView = async (tx, ty, tz, px, py, pz) => page.evaluate(([tx, ty, tz, px, py, pz]) => {
  const w = window.__world; w.controls.autoRotate = false; w.controls.target.set(tx, ty, tz); w.camera.position.set(px, py, pz); w.controls.update(); w.advance(1.5);
}, [tx, ty, tz, px, py, pz]);
const stats = async () => page.evaluate(() => window.__world.stats());
const report = {};
// 1. The whole garden from above.
await setView(0, 0, 6, 0, 118, 62);
await page.waitForTimeout(1500);
await page.evaluate(() => window.__world.advance(2));
await page.screenshot({ path: `${OUT}/1-garden-above.png` });
report.above = await stats();
// 2. A meadow ring: ring 1, near the second pond.
await setView(33, 0, -22, 50, 15, -2);
await page.evaluate(() => window.__world.advance(3));
await page.waitForTimeout(1200);
await page.evaluate(() => window.__world.advance(1));
await page.screenshot({ path: `${OUT}/2-meadow-ring.png` });
report.ring = await stats();
// 2b. Ring 2, further out.
await setView(-10, 0, 62, -14, 14, 80);
await page.evaluate(() => window.__world.advance(3));
await page.screenshot({ path: `${OUT}/2b-meadow-ring2.png` });
report.ring2 = await stats();
// 3. POPCAT's card.
await setView(0, 2, 1, 0, 14, 34);
const popcat = await page.evaluate(() => [...document.querySelectorAll("#finder button.find-item")].map((b) => b.dataset.id).find((id) => id === "popcat"));
await page.evaluate((id) => { location.hash = ""; }, popcat);
await page.click("#find");
await page.fill("#finder-q", "popcat");
await page.waitForTimeout(300);
await page.click('#finder button.find-item[data-id="popcat"]');
await page.waitForTimeout(2200);
await page.evaluate(() => window.__world.advance(0.5));
await page.screenshot({ path: `${OUT}/3-card-popcat.png` });
// Card scrolled to the coin section too.
await page.evaluate(() => document.querySelector("#card .card-body").scrollTo(0, 420));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/3b-card-popcat-coin.png` });
await page.click("#card .card-close");
// 3c. A ring coin whose lore is not researched yet.
const ringId = await page.evaluate(() => fetch("data/famous.json").then((r) => r.json()).then((d) => d.coins.find((c) => c.tier === "ring1" && c.loreSource.kind === "coin").id));
await page.click("#find");
await page.fill("#finder-q", "");
await page.click(`#finder button.find-item[data-id="${ringId}"]`);
await page.waitForTimeout(2500);
await page.evaluate(() => window.__world.advance(0.5));
await page.screenshot({ path: `${OUT}/3c-card-ring-coin.png` });
await page.click("#card .card-close");
// 4. The finder, famous coins on one chain.
await page.click("#find");
await page.fill("#finder-q", "");
await page.click('#finder button.chip:has-text("Famous coins")');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/4-finder.png` });
await page.fill("#finder-q", "kitty");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/4b-finder-search.png` });
await page.keyboard.press("Escape");
// Performance: frame CPU time at the home view.
await page.evaluate(() => window.__world.home());
await page.waitForTimeout(1000);
report.home = await stats();
report.frameMs = await page.evaluate(async () => { const t = []; for (let i = 0; i < 30; i++) { const a = performance.now(); window.__world.advance(1 / 30); t.push(performance.now() - a); } t.sort((a, b) => a - b); return { median: t[15], p90: t[27] }; });
report.logs = logs.slice(0, 40);
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1).slice(0, 4000));
await browser.close();
server.close();
