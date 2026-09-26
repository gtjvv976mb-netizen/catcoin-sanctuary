import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const ROOT = "/home/user/cat-sanctuary", OUT = process.argv[2], Q = process.argv[3] || "debug&noadapt";
const require = createRequire(import.meta.url); const playwright = require("/opt/node22/lib/node_modules/playwright");
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".glb": "model/gltf-binary", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u.endsWith("/")) u += "index.html"; const f = path.join(ROOT, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": T[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, r));
const b = await playwright.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1400, height: 820 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
const t0 = Date.now();
await p.goto(`http://127.0.0.1:${srv.address().port}/?${Q}`);
await p.waitForFunction(() => window.__world, null, { timeout: 90000 });
const firstPaint = Date.now() - t0;
await p.evaluate(() => window.__world.ownLoad);
const loaded = Date.now() - t0;
fs.writeFileSync(OUT + "/probe.json", "");
const r = await p.evaluate(async () => { const w = window.__world; w.advance(6); return { stats: w.stats() }; });
await p.screenshot({ path: OUT + "/garden.png" });
console.log(JSON.stringify({ firstPaint, loaded, errs: errs.slice(0, 5), ...r }));
// Close-ups
const ids = JSON.parse(process.argv[4] || '["PATCHPAW","LEOTHELION","MOMOTHECAT","PEWTER"]');
for (const id of ids) {
  const info = await p.evaluate((id) => {
    const w = window.__world, c = w.sim.byId(id), h = w.herd;
    w.home();
    const mid = h.midPoint(c, new w.camera.position.constructor());
    const fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw), a = 0.6;
    const dx = fx * Math.cos(a) - fz * Math.sin(a), dz = fx * Math.sin(a) + fz * Math.cos(a);
    w.controls.target.copy(mid);
    w.camera.position.set(mid.x + dx * 2.6, mid.y + 0.9, mid.z + dz * 2.6);
    w.controls.update(); w.advance(0.05);
    return { doing: w.doing(id), pose: c.pose, own: h.ownCounts() };
  }, id);
  await p.screenshot({ path: `${OUT}/close-${id}.png` });
  console.log(id, JSON.stringify(info));
}
await b.close(); srv.close();
