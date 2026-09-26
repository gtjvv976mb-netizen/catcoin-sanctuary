/* The garden in 3D: renderer, light, camera, the cottage, the garden and its cats, picking,
   and the tag that follows a chosen cat. main.js loads this only when WebGL is available. */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildGarden } from "./garden.js";
import { createSanctuary } from "./cats.js";
import { loadCatModels, CatHerd } from "./catviews.js";
import { HOUSE } from "./layout.js";

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {HTMLElement} o.stage      the box the canvas fills (the tag is positioned in it)
 * @param {Array} o.residents
 * @param {MediaQueryList} o.reduce  prefers-reduced-motion
 * @param {(cat|null) => void} o.onChoose  called when a cat is tapped (or tapped away)
 * @param {HTMLElement} o.tag
 */
export async function startWorld({ canvas, stage, residents, reduce, onChoose, tag, debug = false }) {
  const mobile = matchMedia("(max-width: 700px), (pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile || devicePixelRatio < 2, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2b2134, 20, 44);

  /* Evening light: a low amber sun, a mauve sky, the lanterns and the cottage's windows. */
  scene.add(new THREE.HemisphereLight(0xffe2c6, 0x413446, 1.25));
  const sun = new THREE.DirectionalLight(0xffc68c, 2.1);
  sun.position.set(-10, 12, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 45 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const porch = new THREE.PointLight(0xffa24d, 4, 6.5, 1.8);
  porch.position.set(-0.5, 1.9, 2.1);
  scene.add(porch);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 140);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0.4, 1.25, 2.1);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 7;
  controls.maxDistance = 24;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = 1.36;
  controls.autoRotateSpeed = 0.35;
  controls.zoomToCursor = false;
  const setView = (distance, pol = 1.2) => {
    const az = 0.36;
    camera.position.set(
      controls.target.x + distance * Math.sin(pol) * Math.sin(az),
      controls.target.y + distance * Math.cos(pol),
      controls.target.z + distance * Math.sin(pol) * Math.cos(az),
    );
    camera.lookAt(controls.target);
  };

  /* The garden, then the cottage and the cats (these load in parallel). */
  const garden = buildGarden(scene, { mobile });
  const loader = new GLTFLoader();
  const [houseGltf, models] = await Promise.all([loader.loadAsync("assets/models/sanctuary.glb"), loadCatModels(loader)]);
  const house = houseGltf.scene;
  {
    const b = new THREE.Box3().setFromObject(house);
    house.scale.setScalar(HOUSE.height / (b.max.y - b.min.y));
    const b2 = new THREE.Box3().setFromObject(house), c = b2.getCenter(new THREE.Vector3());
    house.position.set(-c.x, -b2.min.y, -c.z);
    house.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      // Let the windows (the texture's warm, bright parts) glow a little into the dusk.
      const m = o.material;
      if (m && m.map) { m.emissiveMap = m.map; m.emissive = new THREE.Color(0xffa860); m.emissiveIntensity = 0.16; m.needsUpdate = true; }
    });
    scene.add(house);
  }

  let still = reduce.matches;
  const clock = new THREE.Clock();
  let needsRender = true;
  let running = false;
  let onScreen = true;
  const sim = createSanctuary({ residents, reduced: still });
  const herd = new CatHerd(scene, models, sim, new Map(residents.map((r) => [r.id, r.look?.tint])));
  const byId = new Map(residents.map((r) => [r.id, r]));

  /* ── Sizing ── */
  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 560 ? 44 : 36;
    // On wide screens the words sit in the sky at the upper left, so draw the garden a little right of and below centre.
    if (w >= 900) camera.setViewOffset(w, h, -w * 0.12, -h * 0.035, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    requestRender();
  }
  // Frame the garden: pull back on narrow screens so the cats either side still show.
  {
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
    const aspect = w / h;
    // Narrow screens: further back and a little more from above, so the cats either side still show.
    if (aspect < 0.9) setView(18.5, 1.08); else if (aspect < 1.3) setView(16, 1.14); else setView(14);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  /* ── Auto-orbit: gentle, and it stops for good once someone takes the controls ── */
  let userMoved = false;
  const stopOrbit = () => { userMoved = true; controls.autoRotate = false; };
  controls.autoRotate = !still;
  canvas.addEventListener("pointerdown", stopOrbit);
  canvas.addEventListener("wheel", stopOrbit, { passive: true });

  /* Keyboard: arrows turn the view, + and - zoom, Escape lets go of the chosen cat. */
  canvas.addEventListener("keydown", (e) => {
    const off = new THREE.Vector3().subVectors(camera.position, controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    let used = true;
    if (e.key === "ArrowLeft") sph.theta -= 0.18;
    else if (e.key === "ArrowRight") sph.theta += 0.18;
    else if (e.key === "ArrowUp") sph.phi = Math.max(controls.minPolarAngle, sph.phi - 0.1);
    else if (e.key === "ArrowDown") sph.phi = Math.min(controls.maxPolarAngle, sph.phi + 0.1);
    else if (e.key === "+" || e.key === "=") sph.radius = Math.max(controls.minDistance, sph.radius * 0.88);
    else if (e.key === "-" || e.key === "_") sph.radius = Math.min(controls.maxDistance, sph.radius * 1.12);
    else if (e.key === "Escape") { choose(null); }
    else used = false;
    if (!used) return;
    e.preventDefault();
    stopOrbit();
    camera.position.copy(controls.target).add(off.setFromSpherical(sph));
    controls.update();
    requestRender();
  });

  /* ── Picking: a tap on a cat (or close to one, on touch screens) chooses it ── */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  let down = null;
  let chosen = null;
  canvas.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const rc = canvas.getBoundingClientRect();
    const px = e.clientX - rc.left, py = e.clientY - rc.top;
    ndc.set((px / rc.width) * 2 - 1, -(py / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let cat = herd.pick(ray);
    if (!cat) {
      // Nearest cat on screen, within a fingertip.
      const reach = e.pointerType === "touch" ? 40 : 24;
      let best = reach;
      for (const c of sim.cats) {
        herd.midPoint(c, tmp).project(camera);
        if (tmp.z > 1) continue;
        const d = Math.hypot((tmp.x * 0.5 + 0.5) * rc.width - px, (-tmp.y * 0.5 + 0.5) * rc.height - py);
        if (d < best) { best = d; cat = c; }
      }
    }
    choose(cat ? cat.id : null);
    onChoose?.(cat ? byId.get(cat.id) : null);
  });

  let lastDoing = "";
  function choose(id, { reveal = false } = {}) {
    chosen = id ? sim.byId(id) : null;
    lastDoing = "";
    if (!chosen) { tag.hidden = true; requestRender(); return; }
    const r = byId.get(chosen.id);
    tag.replaceChildren();
    const b = document.createElement("b"); b.textContent = r.name;
    const s = document.createElement("span"); s.className = "tag-token";
    s.textContent = r.example ? "Example cat · not a token" : `${r.ticker} · paired with ${r.pair}`;
    const d = document.createElement("span"); d.className = "tag-doing";
    tag.append(b, s, d);
    tag.hidden = false;
    if (reveal) turnTowards(chosen);
    requestRender();
  }

  /** Turns the view round so a cat chosen from its card is on the near side of the cottage. */
  let turning = null;
  function turnTowards(cat) {
    stopOrbit();
    const off = new THREE.Vector3().subVectors(camera.position, controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    const want = Math.atan2(cat.x - controls.target.x, cat.z - controls.target.z);
    let d = want - sph.theta;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) < 0.5) return;
    const to = sph.theta + d - Math.sign(d) * 0.35;
    if (still) { sph.theta = to; camera.position.copy(controls.target).add(off.setFromSpherical(sph)); controls.update(); return; }
    turning = { from: sph.theta, to, t: 0, sph };
  }

  /* ── Reduced motion: cats settle, no auto-orbit, draw only when the view changes ── */
  reduce.addEventListener?.("change", () => {
    still = reduce.matches;
    sim.setReduced(still);
    controls.autoRotate = !still && !userMoved;
    controls.enableDamping = !still;
    startLoop();
    requestRender();
  });
  controls.enableDamping = !still;
  controls.addEventListener("change", () => requestRender());

  /* ── The loop: runs while the garden is on screen ── */
  function requestRender() { needsRender = true; if (still && onScreen && !running) renderOnce(); }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!still) sim.update(dt);
    advanceTurn(dt);
    herd.update();
    syncYarn();
    garden.update(clock.elapsedTime, still);
    controls.update();
    renderer.render(scene, camera);
    placeTag();
    needsRender = false;
  }
  function renderOnce() { requestAnimationFrame(() => { if (needsRender) frame(); }); }
  function advanceTurn(dt) {
    if (!turning) return;
    turning.t = Math.min(1, turning.t + dt / 0.9);
    const e = turning.t * turning.t * (3 - 2 * turning.t);
    const off = new THREE.Vector3().subVectors(camera.position, controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta = turning.from + (turning.to - turning.from) * e;
    camera.position.copy(controls.target).add(off.setFromSpherical(sph));
    if (turning.t >= 1) turning = null;
  }
  function syncYarn() {
    sim.yarns.forEach((y, i) => {
      const m = garden.yarnMeshes[i];
      m.position.set(y.x, y.r, y.z);
      m.quaternion.set(y.q[0], y.q[1], y.q[2], y.q[3]);
    });
  }
  function placeTag() {
    if (!chosen || tag.hidden) return;
    herd.headPoint(chosen, tmp).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const behind = tmp.z > 1;
    const x = Math.max(70, Math.min(w - 70, (tmp.x * 0.5 + 0.5) * w));
    const y = Math.max(64, Math.min(h - 8, (-tmp.y * 0.5 + 0.5) * h));
    tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, calc(-100% - 10px))`;
    tag.style.visibility = behind ? "hidden" : "visible";
    if (chosen.doing !== lastDoing) { lastDoing = chosen.doing; const d = tag.querySelector(".tag-doing"); if (d) d.textContent = chosen.doing; }
  }
  function startLoop() {
    const want = onScreen && !still && !document.hidden;
    if (want && !running) { clock.getDelta(); renderer.setAnimationLoop(frame); running = true; }
    else if (!want && running) { renderer.setAnimationLoop(null); running = false; }
    if (still && onScreen) requestRender();
  }
  new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; startLoop(); }, { threshold: 0.01 }).observe(stage);
  document.addEventListener("visibilitychange", startLoop);

  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); renderer.setAnimationLoop(null); running = false; stage.dataset.ready = "lost"; });
  canvas.addEventListener("webglcontextrestored", () => { stage.dataset.ready = "true"; startLoop(); });

  frame();
  startLoop();

  const api = {
    choose: (id, opts) => choose(id, opts),
    get chosen() { return chosen ? chosen.id : null; },
  };
  if (debug) {
    // For screenshots and checks: step the garden forward without waiting, and read the draw stats.
    Object.assign(api, {
      sim, renderer, scene, camera, controls,
      advance(seconds, dt = 1 / 30) { for (let t = 0; t < seconds; t += dt) sim.update(dt); frame(); },
      stats() {
        frame();
        const i = renderer.info.render;
        return { calls: i.calls, triangles: i.triangles, points: i.points, catTriangles: herd.triangles(), cats: sim.cats.length, programs: renderer.info.programs?.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
      },
      doing: () => sim.cats.map((c) => ({ id: c.id, pose: c.pose, doing: c.doing, x: +c.x.toFixed(2), z: +c.z.toFixed(2), y: +c.y.toFixed(2) })),
    });
  }
  return api;
}
