/* "Who's that cat?" silhouettes: every upcoming cat (the announce order: the backlog, then the
   release queue; scripts/lib/next-cat.mjs) rendered from its own model (assets/models/cats/<KEY>.glb)
   as a pure black figure on a transparent background, side on, in its natural pose, to
   assets/teaser/<opaque id>.png (about 600 px). The file name is a hash, never the cat's name.
   Then data/next-cat.json is refreshed.

   node scripts/build-teasers.mjs            every upcoming cat that has no silhouette yet
   node scripts/build-teasers.mjs --all      redo them all
   node scripts/build-teasers.mjs KEY ...    just these

   Uses Playwright (global, or /opt/node22's) and the vendored three.js; a tiny server serves the repo. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { upcoming, silhouettePath, writeNextCat } from "./lib/next-cat.mjs";
import { listCats, readJson, DEFAULT_CONFIG } from "./announce.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIZE = 600;
const args = process.argv.slice(2);
const all = args.includes("--all");
const data = (f) => path.join(ROOT, "data", f);
const cats = listCats(readJson(data("planned.json"), { cats: [] }), readJson(data("collection.json"), { cats: [] }), readJson(data("adoptables.json"), { cats: [] }));
const order = upcoming(cats, readJson(data("announced.json"), { cats: {} }), readJson(data("release-queue.json"), { cats: [] }), { ...DEFAULT_CONFIG, ...readJson(data("announce-config.json"), {}) });
const keys = (args.filter((a) => !a.startsWith("--")).length ? args.filter((a) => !a.startsWith("--")) : order.map((c) => c.key))
  .filter((k) => fs.existsSync(path.join(ROOT, `assets/models/cats/${k}.glb`)) || (console.warn(`${k}: no model, skipped`), false))
  .filter((k) => all || args.includes(k) || !fs.existsSync(path.join(ROOT, silhouettePath(k))));

const require = createRequire(import.meta.url);
let playwright;
for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright/index.js", path.join(process.execPath, "../../lib/node_modules/playwright")]) { try { playwright = require(p); break; } catch { /* next */ } }

const PAGE = `<!doctype html><html><body style="margin:0;background:transparent">
<script type="importmap">{ "imports": { "three": "/assets/vendor/three/three.module.min.js", "three/addons/": "/assets/vendor/three/addons/" } }</script>
<canvas id="c" width="${SIZE}" height="${SIZE}"></canvas>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const r = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), antialias: true, alpha: true, preserveDrawingBuffer: true });
r.setClearColor(0x000000, 0);
const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
window.draw = async (key) => {
  const g = await new GLTFLoader().loadAsync("/assets/models/cats/" + key + ".glb");
  const s = new THREE.Scene();
  s.add(g.scene);
  g.scene.traverse((o) => { if (o.isMesh) o.material = black; });
  g.scene.updateMatrixWorld(true);
  // Side on (+Z; the head points +X), turned a touch so the far legs and ears show as separate shapes.
  g.scene.rotation.y = -0.32;
  g.scene.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g.scene), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
  const half = Math.max(sz.x, sz.y) * 0.54;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 100);
  cam.position.set(c.x, c.y + sz.y * 0.04, c.z + 10); cam.lookAt(c.x, c.y + sz.y * 0.04, c.z);
  r.render(s, cam);
  return document.getElementById("c").toDataURL("image/png");
};
window.ready = true;
</script></body></html>`;

const TYPES = { ".js": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/__teaser.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  res.end(fs.readFileSync(f));
});

if (keys.length) {
  if (!playwright) throw new Error("Playwright is needed: npm i -g playwright");
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await playwright.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
  page.on("pageerror", (e) => console.error(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/__teaser.html`);
  await page.waitForFunction(() => window.ready);
  fs.mkdirSync(path.join(ROOT, "assets/teaser"), { recursive: true });
  for (const k of keys) {
    const url = await page.evaluate((k) => window.draw(k), k);
    const png = Buffer.from(url.split(",")[1], "base64");
    fs.writeFileSync(path.join(ROOT, silhouettePath(k)), png);
    console.log(`${k} -> ${silhouettePath(k)} (${(png.length / 1024).toFixed(1)} KB)`);
  }
  await browser.close();
  server.close();
}
const next = writeNextCat(ROOT);
console.log(`data/next-cat.json: ${next.id ?? "nobody waiting"}`);
