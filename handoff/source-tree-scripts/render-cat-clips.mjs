/* Renders one rigged cat in every clip (assets/world/catrig.js), to check the rig by eye:
   node scripts/render-cat-clips.mjs OUT.png TICKER [PHASE]
   PHASE (0..1, default 0.3) is how far into each clip. Side view, head to the right. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [outFile = "clips.png", ticker = "PATCHPAW", phase = "0.3"] = process.argv.slice(2);
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require(path.join(process.execPath, "../../lib/node_modules/playwright")); }
const TYPES = { ".js": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json" };
const PAGE = `<!doctype html><html><body style="margin:0;background:#e9e4da">
<script type="importmap">{ "imports": { "three": "/assets/vendor/three/three.module.min.js", "three/addons/": "/assets/vendor/three/addons/" } }</script>
<canvas id="c" width="1536" height="1024"></canvas>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { findRig, buildSkeleton, skinWeights, makeClips } from "/assets/world/catrig.js";
import { flatMesh } from "/assets/world/catviews.js";
window.draw = async (t, phase) => {
  const r = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), antialias: true, preserveDrawingBuffer: true });
  r.outputColorSpace = THREE.SRGBColorSpace; r.setScissorTest(true);
  const g = await new GLTFLoader().loadAsync("/assets/models/cats/" + t + ".glb");
  const f = flatMesh(g.scene), rig = findRig(f.pos), sk = buildSkeleton(rig), w = skinWeights(f.pos, rig, sk);
  f.geometry.setAttribute("skinIndex", w.index); f.geometry.setAttribute("skinWeight", w.weight);
  const m = new THREE.SkinnedMesh(f.geometry, f.material); m.frustumCulled = false;
  const grp = new THREE.Group(); grp.add(sk.root); grp.add(m); m.bind(sk.skeleton, new THREE.Matrix4());
  const s = new THREE.Scene(); s.add(grp, new THREE.HemisphereLight(0xffffff, 0x886644, 1.6));
  const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(1, 3, 3); s.add(d);
  s.add(new THREE.GridHelper(3, 6, 0x999999, 0xcccccc));
  const clips = makeClips(rig), names = Object.keys(clips), mixer = new THREE.AnimationMixer(sk.root);
  const cam = new THREE.PerspectiveCamera(32, 256 / 256, 0.01, 50); cam.position.set(0.1, 0.7, 3.0); cam.lookAt(0.05, 0.4, 0);
  const lbl = document.createElement("canvas"); lbl.width = 1536; lbl.height = 1024;
  names.forEach((n, i) => {
    mixer.stopAllAction(); const a = mixer.clipAction(clips[n]); a.reset().play(); a.time = phase * clips[n].duration; mixer.update(0);
    const x = (i % 6) * 256, y = 1024 - (Math.floor(i / 6) + 1) * 256;
    r.setViewport(x, y, 256, 256); r.setScissor(x, y, 256, 256); r.setClearColor(0xe9e4da); r.clear(); r.render(s, cam);
  });
  return names;
};
</script></body></html>`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/__clips.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, r));
const browser = await playwright.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
page.on("pageerror", (e) => console.error(e.message));
page.on("console", (m) => m.type() === "error" && console.error(m.text()));
await page.goto(`http://127.0.0.1:${server.address().port}/__clips.html`);
const names = await page.evaluate(([t, p]) => window.draw(t, +p), [ticker, phase]);
await page.locator("#c").screenshot({ path: outFile });
console.log(names.join(" "));
await browser.close(); server.close();
