/* Renders each per-cat model (assets/models/cats/<TICKER>.glb) to a PNG next to its picture, to
   check by eye that the model matches (colours, outfit, anatomy) and faces +X.

   node scripts/render-cat-thumbs.mjs OUTDIR [--pictures DIR] [TICKER ...]

   Each OUTDIR/<TICKER>.png shows: the picture (if DIR/<TICKER>-512.jpg or .png exists), the model
   seen from a 3/4 front view, from its side (+Z; the head should point right, towards +X), and the far copy.
   Uses the global Playwright (npm i -g playwright) and the vendored three.js; a tiny static
   server serves the repository. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const out = path.resolve(args.shift() || "cat-thumbs");
let pics = null;
const pi = args.indexOf("--pictures");
if (pi >= 0) { pics = path.resolve(args[pi + 1]); args.splice(pi, 2); }
const index = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/cats/index.json"), "utf8"));
const tickers = args.length ? args : Object.keys(index.cats);
fs.mkdirSync(out, { recursive: true });

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require(path.join(process.execPath, "../../lib/node_modules/playwright")); }

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png" };
const PAGE = `<!doctype html><html><body style="margin:0;background:#e9e4da">
<script type="importmap">{ "imports": { "three": "/assets/vendor/three/three.module.min.js", "three/addons/": "/assets/vendor/three/addons/" } }</script>
<canvas id="c" width="1024" height="320"></canvas>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
window.draw = async (t, pic) => {
  const r = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), antialias: true, preserveDrawingBuffer: true });
  r.outputColorSpace = THREE.SRGBColorSpace; r.setScissorTest(true);
  r.setClearColor(0xe9e4da); r.clear();
  const L = new GLTFLoader();
  const load = async (f) => { const g = await L.loadAsync(f); return g.scene; };
  const views = [[await load("/assets/models/cats/" + t + ".glb"), [2.2, 1.0, 1.4]], [null, [0, 0.7, 2.6]], [await load("/assets/models/cats/" + t + "-lo.glb"), [2.2, 1.0, 1.4]]];
  views[1][0] = views[0][0].clone();
  if (pic) { const img = new Image(); img.src = pic; await img.decode(); const g2 = document.createElement("canvas"); }
  let x = 256;
  for (const [obj, eye] of views) {
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight(0xffffff, 0x886644, 1.6));
    const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(2, 3, 2); s.add(d);
    s.add(obj);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50); cam.position.set(...eye); cam.lookAt(0, 0.5, 0);
    // the ground line and a +X arrow
    s.add(new THREE.GridHelper(2, 4, 0x999999, 0xcccccc));
    s.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0.01, 0), 0.8, 0xd03030));
    r.setViewport(x, 0, 256, 320 * 256 / 256); r.setScissor(x, 0, 256, 320);
    cam.aspect = 256 / 320; cam.updateProjectionMatrix();
    r.render(s, cam); x += 256;
  }
  return true;
};
</script></body></html>`;

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/__thumb.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  if (u.startsWith("/__pic/") && pics) { const f = path.join(pics, path.basename(u)); if (fs.existsSync(f)) { res.writeHead(200, { "content-type": TYPES[path.extname(f)] }); return res.end(fs.readFileSync(f)); } }
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await playwright.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1024, height: 320 } });
page.on("pageerror", (e) => console.error(e.message));
for (const t of tickers) {
  await page.goto(`${base}/__thumb.html`);
  await page.evaluate((t) => window.draw(t), t);
  const buf = await page.locator("#c").screenshot();
  let picPath = pics && [`${t}-512.jpg`, `${t}.png`].map((f) => path.join(pics, f)).find((f) => fs.existsSync(f));
  if (picPath) {
    // Put the picture in the first 256 px: a second small page composes them.
    await page.setContent(`<body style="margin:0;display:flex;background:#e9e4da"><img src="data:image/${picPath.endsWith("png") ? "png" : "jpeg"};base64,${fs.readFileSync(picPath).toString("base64")}" style="width:256px;height:256px;object-fit:cover;margin-top:32px"><img src="data:image/png;base64,${buf.toString("base64")}" style="margin-left:-256px;clip-path:inset(0 0 0 256px)"></body>`);
    await page.setViewportSize({ width: 1024, height: 320 });
    await page.screenshot({ path: path.join(out, `${t}.png`) });
  } else fs.writeFileSync(path.join(out, `${t}.png`), buf);
  console.log(t);
}
await browser.close();
server.close();
