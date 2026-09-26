/**
 * CAPTURE EACH CAT'S IN-GAME LOOK: assets/ingame/<KEY>.jpg (1600x900, about 150 KB), the second
 * image on its X post (scripts/announce.mjs). The page itself never loads these files.
 *
 *   node scripts/capture-ingame.mjs            every cat that can still be posted (backlog, queued,
 *                                              unrecorded, failed, held, and the release queue) with no shot yet
 *   node scripts/capture-ingame.mjs KEY…       just these cats (retakes them)
 *   node scripts/capture-ingame.mjs --all      retake every postable cat
 *
 * A "studio" shot of that one cat only: its own full model (assets/models/cats/<KEY>.glb, the
 * standing pose it was made in) alone in a small three.js scene, seen from a 3/4 front view,
 * filling about 55% of the frame height, over a soft, blurred garden backdrop (sky, a far line of
 * trees and a sunny lawn, painted in 2D). No other cats, critters or name tags, no grass or post
 * effects, one page for every cat: a few seconds a cat even under software GL.
 * The studio page is served from memory (Playwright routing); the site's files are read from disk.
 * Needs Playwright (PLAYWRIGHT_MODULE, default /opt/node22/lib/node_modules/playwright/index.mjs)
 * and its Chromium (PLAYWRIGHT_BROWSERS_PATH, default /opt/pw-browsers).
 */
import fs from "node:fs";
import path from "node:path";
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

const W = 1600, H = 900;
/** Share of the frame height the cat fills, and the view: degrees round from its nose, and down. */
const FILL = 0.56, AZIMUTH = 32, ELEVATION = 11;
const HOST = "http://studio.local";
const TYPES = { ".js": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg" };

const STUDIO = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{ "imports": { "three": "/assets/vendor/three/three.module.min.js", "three/addons/": "/assets/vendor/three/addons/" } }</script>
<style>html,body{margin:0;background:#000}canvas{display:block}</style></head><body>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const W = ${W}, H = ${H};
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a7a, 1.3));
const sun = new THREE.DirectionalLight(0xfff6ea, 2.3);
sun.position.set(2.2, 3.2, 2.6); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 6;
Object.assign(sun.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5, near: 0.1, far: 10 });
scene.add(sun);
const fill = new THREE.DirectionalLight(0xcfe0ff, 0.6); fill.position.set(-2, 1.5, -1.5); scene.add(fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.28 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 50);
const loader = new GLTFLoader();

// The backdrop: a blurred garden, painted once.
const back = document.createElement("canvas"); back.width = W; back.height = H;
{
  const g = back.getContext("2d");
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const sky = g.createLinearGradient(0, 0, 0, H * 0.55);
  sky.addColorStop(0, "#a9cfe8"); sky.addColorStop(1, "#f3e6c8");
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.filter = "blur(28px)";
  for (let i = 0; i < 26; i++) {           // the far line of trees and shrubs
    const x = r() * W, y = H * (0.3 + r() * 0.16), rad = 90 + r() * 170;
    g.fillStyle = ["#5f7f45", "#6d8d4c", "#4d6e3c", "#7c9a57", "#86a063"][i % 5];
    g.beginPath(); g.ellipse(x, y, rad * 1.2, rad, 0, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 10; i++) {           // blossom
    g.fillStyle = ["#f2c6d2", "#f7dbe3", "#fbe9c4"][i % 3];
    g.beginPath(); g.arc(r() * W, H * (0.22 + r() * 0.2), 40 + r() * 60, 0, Math.PI * 2); g.fill();
  }
  const lawn = g.createLinearGradient(0, H * 0.5, 0, H);
  lawn.addColorStop(0, "#9dba6a"); lawn.addColorStop(0.35, "#86a95a"); lawn.addColorStop(1, "#5f8a43");
  g.fillStyle = lawn; g.fillRect(-60, H * 0.52, W + 120, H * 0.6);
  for (let i = 0; i < 40; i++) {           // flowers out of focus in the lawn
    g.fillStyle = ["#fff4d6", "#f6d36b", "#f4b8c8", "#ffffff"][i % 4]; g.globalAlpha = 0.55;
    const y = H * (0.58 + r() * 0.42); g.beginPath(); g.arc(r() * W, y, 6 + (y / H) * 22, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1; g.filter = "blur(60px)";
  const glow = g.createRadialGradient(W * 0.78, H * 0.12, 0, W * 0.78, H * 0.12, W * 0.5);
  glow.addColorStop(0, "rgba(255,240,200,0.75)"); glow.addColorStop(1, "rgba(255,240,200,0)");
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.filter = "none";
  const vig = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(30,25,10,0.28)");
  g.fillStyle = vig; g.fillRect(0, 0, W, H);
}
const out = document.createElement("canvas"); out.width = W; out.height = H;
let current = null;

window.shoot = async (key, { fill, az, el, target = 150000 }) => {
  if (current) { scene.remove(current); current.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); }
  const gltf = await loader.loadAsync("/assets/models/cats/" + key + ".glb");
  const model = gltf.scene;
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; const m = o.material; m.metalness = 0; m.roughness = Math.max(0.7, m.roughness ?? 0.85); } });
  const box = new THREE.Box3().setFromObject(model), c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x, -box.min.y, -c.z);
  current = model; scene.add(model);
  const b = new THREE.Box3().setFromObject(model), hgt = b.max.y - b.min.y;
  // Looking at its face from the front and a little to the side (it faces +X).
  const a = az * Math.PI / 180, e = el * Math.PI / 180, dir = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
  const look = new THREE.Vector3(0, hgt * 0.5, 0);
  let dist = 3;
  const corners = []; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) corners.push(new THREE.Vector3(x, y, z));
  let span = null;
  for (let i = 0; i < 6; i++) {
    camera.position.copy(look).addScaledVector(dir, dist); camera.lookAt(look); camera.updateMatrixWorld();
    let y0 = 1, y1 = -1, x0 = 1, x1 = -1;
    for (const p of corners) { const q = p.clone().project(camera); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); }
    // Box corners overstate the height a little; aim the box at a bit more than the fill.
    const hs = (y1 - y0) / 2, ws = (x1 - x0) / 2;
    const k = Math.max(hs / (fill * 1.08), ws / 0.8);
    dist *= k;
    // Centre the box on screen.
    const cy = (y0 + y1) / 2, cx = (x0 + x1) / 2;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const halfH = Math.tan(camera.fov * Math.PI / 360) * dist;
    look.addScaledVector(up, cy * halfH).addScaledVector(right, cx * halfH * camera.aspect);
    span = { hs, ws, cx, cy };
  }
  camera.position.copy(look).addScaledVector(dir, dist); camera.lookAt(look); camera.updateMatrixWorld();
  renderer.render(scene, camera);
  const g = out.getContext("2d"); g.drawImage(back, 0, 0); g.drawImage(renderer.domElement, 0, 0);
  // JPEG quality for about the target size.
  let lo = 0.5, hi = 0.99, best = null;
  for (let i = 0; i < 6; i++) {
    const q = (lo + hi) / 2, u = out.toDataURL("image/jpeg", q), n = Math.round((u.length - 23) * 0.75);
    if (!best || Math.abs(n - target) < Math.abs(best.n - target)) best = { u, n, q };
    if (n > target) hi = q; else lo = q;
  }
  return { url: best.u, bytes: best.n, q: best.q, span };
};
window.ready = true;
</script></body></html>`;

export async function capture(keys, { root = ROOT, log = console.log, fill = FILL, az = AZIMUTH, el = ELEVATION } = {}) {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= "/opt/pw-browsers";
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.mjs").href);
  const out = { ok: [], failed: [] };
  let browser;
  try {
    browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.route(`${HOST}/**`, (route) => {
      const p = decodeURIComponent(new URL(route.request().url()).pathname);
      if (p === "/studio.html") return route.fulfill({ contentType: "text/html", body: STUDIO });
      const file = path.join(root, p);
      if (!file.startsWith(root) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
    });
    page.on("pageerror", (e) => log(`page error: ${e.message}`));
    await page.goto(`${HOST}/studio.html`);
    await page.waitForFunction(() => window.ready, null, { timeout: 60_000 });
    fs.mkdirSync(path.join(root, INGAME_DIR), { recursive: true });
    for (const key of keys) {
      const t0 = Date.now();
      try {
        if (!fs.existsSync(path.join(root, `assets/models/cats/${key}.glb`))) throw new Error("no model");
        const r = await page.evaluate(([k, o]) => window.shoot(k, o), [key, { fill, az, el }]);
        const buf = Buffer.from(r.url.split(",")[1], "base64");
        if (buf.length < 30_000) throw new Error(`blank frame (${buf.length} bytes)`);
        fs.writeFileSync(path.join(root, ingamePath(key)), buf);
        out.ok.push(key);
        log(`${key}: ${ingamePath(key)} (${Math.round(buf.length / 1024)} KB, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      } catch (e) {
        out.failed.push({ key, error: e.message });
        log(`${key}: FAILED (${e.message})`);
      }
    }
  } finally {
    await browser?.close();
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
