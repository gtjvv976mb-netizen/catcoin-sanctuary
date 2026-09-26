/* The world in 3D: renderer, sunlight, sky, the cottage, the garden and its meadow rings, the
   cats, the birds and butterflies, the camera and its controls, picking, and easing the camera
   to a chosen cat. main.js loads this only when WebGL is available; the page's overlay lives in
   assets/ui/.

   The world is built to a quality tier chosen from the device (tierFor: conservative — phones low or medium,
   desktops medium unless the GPU is clearly strong; ?q=low|medium|high overrides), which sets the grass density and reach, the
   shadow map, the reflections and the finishing pass (post.js). The first view comes up with the
   ground, the garden, the trees and the cottage; the grass then grows in round the view a few
   chunks a frame, and the finishing pass arrives a moment later.

   Two kinds of cat life share one herd: the main garden's adoptable cats (cats.js, every cat
   simulated in full) and the Hall of Fame cats on their plaza in the first meadow ring (meadow.js,
   streamed by distance). The meadow rings are kept free for adoptable cats still to come. */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildGarden } from "./garden.js";
import { buildSky, SKY, skyEnvironment } from "./sky.js";
import { allTrees, buildFlora, treeShade } from "./flora.js";
import { buildGrass } from "./grass.js";
import { buildWater } from "./water.js";
import { buildCritters } from "./critters.js";
import { buildAmbient } from "./ambient.js";
import { buildSign, buildHallSign } from "./sign.js";
import { buildEasel } from "./easel.js";
import { buildResearch } from "./research.js";
import { createSanctuary } from "./cats.js";
import { createMeadow } from "./meadow.js";
import { loadCatModels, CatHerd, coatFor, OWN } from "./catviews.js";
import { HOUSE, GARDEN, MEADOW, HALL_OF_FAME, BRIDGES, EASEL, groundHeight } from "./layout.js";
import { modelIdFor } from "../ui/models.js";

/** Where a resident lives: the Hall of Fame coins (famous cat coins that already exist) on the Hall
    of Fame plaza, the adoptable cats in the garden. */
export const livesInHall = (r) => r.kind === "famous";

/** Where the sun sits in the sky (seen from the usual view: up and to the left, behind the cottage)… */
const SUN_DISC = new THREE.Vector3(-0.6, 0.18, -0.79).normalize();
/** …and where its light comes from: the same side, higher, so the garden is bright and shadows are short. */
const SUN_LIGHT = new THREE.Vector3(-0.62, 0.72, -0.3).normalize();
/** The vertical field of view on a phone held upright. */
const PORTRAIT_FOV = 64;

/** The quality tiers. */
export const TIERS = {
  low: { tier: "low", dpr: 1.25, terrain: 0.5, texSize: 256, grassLawn: 9, grassMeadow: 4, grassFade: 34, grassR: 90, grassShadows: false, flowers: 0.45, forest: 700, treeNear: 30, shadow: 1024, post: false, ao: false, msaa: 0, mirror: false, rays: false, hiTex: 512, hiMax: 8 },
  medium: { tier: "medium", dpr: 1.5, terrain: 0.6, texSize: 256, grassLawn: 16, grassMeadow: 7, grassFade: 42, grassR: 110, grassShadows: false, flowers: 0.7, forest: 1100, treeNear: 36, shadow: 2048, post: true, ao: false, msaa: 0, mirror: false, rays: true, hiTex: 1024, hiMax: 16 },
  high: { tier: "high", dpr: 2, terrain: 1, texSize: 512, grassLawn: 34, grassMeadow: 15, grassFade: 64, grassR: 130, grassShadows: true, flowers: 1, forest: 1800, treeNear: 60, shadow: 4096, post: true, ao: true, msaa: 4, mirror: true, rays: true, hiTex: 2048, hiMax: 32 },
};
const ORDER = ["low", "medium", "high"];
const CAP_KEY = "cs-quality-cap";
/** The highest tier this tab may use (lowered after a lost GPU context or slow frames; kept for the session). */
export function tierCap() { try { return ORDER.includes(sessionStorage.getItem(CAP_KEY)) ? sessionStorage.getItem(CAP_KEY) : "high"; } catch { return "high"; } }
/** Lowers the session's tier cap one step below `from`; returns the new cap. */
export function dropTier(from) {
  const next = ORDER[Math.max(0, ORDER.indexOf(from) - 1)];
  try { sessionStorage.setItem(CAP_KEY, next); } catch {}
  return next;
}
/** The GPU's name, when the browser tells it. */
function gpuName() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return String(name || "");
  } catch { return ""; }
}
/** The tier for this device, conservatively: phones low or medium; desktops medium unless the
    GPU is clearly a strong discrete one; software renderers low. ?q=low|medium|high overrides
    (and ignores the session cap). */
export function tierFor({ mobile, override }) {
  if (override && TIERS[override]) return { ...TIERS[override] };
  const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 4;
  const gpu = gpuName().toLowerCase();
  let t;
  if (/swiftshader|llvmpipe|software|basic render|mali-4|adreno \(tm\) [34]/.test(gpu)) t = "low";
  else if (mobile) t = mem <= 3 || cores <= 4 ? "low" : "medium";
  else {
    const strong = /(rtx|rx [67]\d{3}|rx [5-9]\d{3}m?|radeon pro|apple m\d (pro|max|ultra)|arc a[57])/.test(gpu) && mem >= 8 && cores >= 8;
    const weak = mem <= 4 || cores <= 4 || /intel.*(hd|uhd) graphics|mali|adreno|powervr/.test(gpu);
    t = strong ? "high" : weak ? "low" : "medium";
  }
  const cap = tierCap();
  if (ORDER.indexOf(t) > ORDER.indexOf(cap)) t = cap;
  return { ...TIERS[t] };
}

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {Array} o.residents        normalized residents (assets/ui/data.js)
 * @param {MediaQueryList} o.reduce  prefers-reduced-motion
 * @param {(id: string|null) => void} o.onPick   a cat was clicked (or the empty garden: null)
 * @param {(resident: object|null, x?: number, y?: number) => void} [o.onHover]  the cat under the mouse, and where its head is on screen
 * @param {(resident: object, x: number, y: number, visible: boolean, doing: string) => void} [o.onTrack]  the chosen cat, each frame
 * @param {boolean} [o.debug]
 * @param {boolean} [o.adaptive]   lower the resolution when frames run slow (on by default)
 */
export async function startWorld({ canvas, residents, reduce, onPick, onHover, onTrack, onTeaser, debug = false, adaptive = true, quality = null }) {
  const small = matchMedia("(max-width: 720px), (max-height: 520px)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const mobile = small || coarse;
  const q = tierFor({ mobile, override: quality });
  // How long each part of the world takes to build (read with ?debug as __world.timings).
  const timings = {}, t00 = performance.now();
  let tLast = t00;
  const mark = (k) => { const t = performance.now(); timings[k] = +(t - tLast).toFixed(1); tLast = t; };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !q.post && devicePixelRatio < 2, powerPreference: "high-performance" });
  let dprCap = q.dpr;
  renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // ACES filmic, pushed bright: sunny and warm, never moody.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = q.tier === "low" ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const haze = new THREE.Color(SKY.horizon).lerp(new THREE.Color(0xcfe3ee), 0.35);
  // Aerial perspective: the far meadows, woods and hills fade into the sky's horizon haze.
  scene.fog = new THREE.Fog(haze, 140, 780);
  scene.background = haze;
  // Image-based light from the sky itself (and a green bounce from below).
  scene.environment = skyEnvironment(renderer, SUN_DISC);
  scene.environmentIntensity = 0.6;

  /* Daylight: a warm sun with soft shadows, a bright sky fill, and a gentle bounce from the front. */
  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x9bbf6a, 1.3));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.7);
  sun.position.copy(SUN_LIGHT).multiplyScalar(80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(q.shadow, q.shadow);
  // The sun's shadows cover what the camera looks at, tighter (so crisper) the closer it is.
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 5, far: 190 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = q.tier === "high" ? 4 : 3;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xffe7c8, 0.55);
  fill.position.set(10, 8, 22);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3200);
  camera.layers.enable(1); // grass and water live on layer 1 (the pond mirror leaves them out)
  mark("renderer");
  const sky = buildSky(scene, { sunDir: SUN_DISC, mobile });
  mark("sky");
  const trees = allTrees(q, SUN_DISC);
  mark("tree spots");
  const garden = buildGarden(scene, { mobile, q, renderer, treeShade: treeShade(trees) });
  mark("garden");
  timings["garden: ground"] = +garden.terrain.ms.toFixed(1);
  const flora = buildFlora(scene, { q, trees });
  mark("trees");
  const water = buildWater(scene, { sunDir: SUN_DISC, q });
  mark("water");
  const grass = buildGrass(scene, { q, blocked: (x, z) => garden.blocked(x, z, 0.06) });
  mark("grass");
  grass.group.traverse((o) => o.layers.set(1));
  const occluders = flora.occluders;
  // Petals, motes, chimney smoke, the vignette, and the clock for the wind and the water.
  // (The chimney's top, measured on sanctuary.glb at HOUSE.height.)
  const ambient = buildAmbient(scene, { mobile, blossoms: flora.blossoms, chimney: { x: 2.25, y: HOUSE.height + 0.1, z: -0.05 } });
  let ambientTime = 14; // frozen here with reduced motion: petals and motes hang mid-air

  /* The cottage and the cats (these load in parallel). */
  const loader = new GLTFLoader();
  const [houseGltf, models, sign] = await Promise.all([loader.loadAsync("assets/models/sanctuary.glb"), loadCatModels(loader, "assets/models/", { cell: mobile ? 0.07 : 0.045 }), buildSign(scene, { roof: HOUSE.height - 0.75, yaw: 0.3, width: 5.4 }).catch(() => null), buildHallSign(scene, HALL_OF_FAME.sign, groundHeight(HALL_OF_FAME.sign.x, HALL_OF_FAME.sign.z)).catch(() => null)]);
  const house = houseGltf.scene;
  {
    house.rotation.y = -Math.PI / 2; // the mesh's door faces +x in model space; turn it to face the porch side (+z)
    const b = new THREE.Box3().setFromObject(house);
    house.scale.setScalar(HOUSE.height / (b.max.y - b.min.y));
    const b2 = new THREE.Box3().setFromObject(house), c = b2.getCenter(new THREE.Vector3());
    house.position.set(-c.x, -b2.min.y, -c.z);
    house.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const m = o.material;
      if (m && m.isMeshStandardMaterial) m.envMapIntensity = 0.7;
      if (m && m.map) { m.emissiveMap = m.map; m.emissive = new THREE.Color(0xffb070); m.emissiveIntensity = 0.1; m.needsUpdate = true; }
    });
    scene.add(house);
  }
  /* Research HQ: the cottage is where the Research Team works (research.js). */
  const research = buildResearch(scene, { house, requestRender: () => requestRender() });
  const easel = buildEasel(scene, { ...EASEL, y: groundHeight(EASEL.x, EASEL.z) });

  /* ── The finishing pass (post.js): loaded once the first view is up ── */
  let post = null;

  let still = reduce.matches;
  let needsRender = true, running = false, frameMs = 0, lastFrameAt = 0;
  let queued = false;
  let chosenId = null, focus = null;
  let saved = null; // the view before the first cat was chosen, to go back to
  let hovered = null, hoverQueued = null;
  const coats = new Map(residents.map((r, i) => [r.id, coatFor(r, i)]));
  const simOf = (r) => ({ id: r.id, name: r.name, tier: r.tier, model: coats.get(r.id).ginger ? "ginger" : "cat" });
  const mainResidents = residents.filter((r) => !livesInHall(r)).map(simOf);
  // The Hall of Fame cats, biggest first, so the biggest sit nearest the fountain.
  const meadowResidents = residents.filter(livesInHall).sort((a, b) => (b.market?.marketCapUsd || 0) - (a.market?.marketCapUsd || 0)).map(simOf);
  let sim = null;
  const critters = buildCritters(scene, {
    mobile,
    fencePosts: garden.fencePosts,
    flowerFields: garden.flowerFields,
    lawnFree: (x, z) => !sim || sim.nav.pointFree(x, z, 0.35),
    catsNear: (x, z, r) => !!sim && sim.cats.some((c) => Math.abs(c.x - x) < r && Math.abs(c.z - z) < r && Math.hypot(c.x - x, c.z - z) < r),
  });
  const garden0 = createSanctuary({ residents: mainResidents, reduced: still, critters });
  const meadow = createMeadow({ residents: meadowResidents, startIndex: garden0.cats.length, reduced: still });
  /* One view of every cat for the herd, picking and the camera: the garden's and the meadows'. */
  sim = {
    garden: garden0, meadow,
    cats: [...garden0.cats, ...meadow.cats],
    yarns: garden0.yarns, nav: garden0.nav,
    byId: (id) => garden0.byId(id) || meadow.byId(id),
    update(dt) { garden0.update(dt); meadow.update(dt); },
    setViewer(x, z) { garden0.setViewer(x, z); },
    setReduced(on) { garden0.setReduced(on); meadow.setReduced(on); },
    get time() { return garden0.time; },
    census() { return { ...garden0.census(), ...meadow.census() }; },
    force: (...a) => garden0.force(...a),
  };
  // On phones the cats don't cast into the shadow map (the most costly pass there); each gets a soft blob shadow instead.
  const herd = new CatHerd(scene, models, sim, coats, { blobShadows: q.tier === "low", contact: true });
  herd.still = still;
  herd.camera = camera;
  const byId = new Map(residents.map((r) => [r.id, r]));

  /* Launched cats wear a little gold coin that turns above their heads (one instanced mesh). */
  const launched = sim.cats.filter((c) => byId.get(c.id)?.token?.status === "launched");
  const coinMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.05, 20).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.55, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.4 }),
    Math.max(1, launched.length),
  );
  coinMesh.count = launched.length;
  coinMesh.frustumCulled = false;
  coinMesh.name = "launched coins";
  scene.add(coinMesh);

  /* The chosen cat: a soft ring on the grass round it. */
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9, depthWrite: false, fog: false, toneMapped: false }));
  ring.visible = false;
  ring.renderOrder = 2;
  scene.add(ring);

  /* ── The camera and its controls ── */
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !still;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.minDistance = 4.5;
  controls.maxDistance = 220;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = 1.47;
  controls.autoRotateSpeed = 0.28;
  controls.zoomSpeed = 0.9;
  controls.rotateSpeed = 0.7;
  controls.panSpeed = 0.8;
  canvas.style.touchAction = "none";

  const home = { target: new THREE.Vector3(), dist: 0, polar: 0, az: 0.38, fov: 42 };
  /** The field of view for a screen shape: portrait screens need a taller one to show the same width of garden. */
  const fovFor = (aspect) => (aspect >= 1.25 ? 48 : aspect >= 0.85 ? 52 : PORTRAIT_FOV);
  function homeView() {
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600, aspect = w / h;
    if (aspect >= 1.25) Object.assign(home, { dist: 31, polar: 1.37, az: 0.38 });
    else if (aspect >= 0.85) Object.assign(home, { dist: 36, polar: 1.33, az: 0.38 });
    // A phone held upright sees a narrow slice: come in closer, and turn a little towards the
    // sun so it is in the picture (at the old angle it sat just off the left edge).
    else Object.assign(home, { dist: 23, polar: 1.24, az: 0.56 });
    home.fov = fovFor(aspect);
    if (aspect < 0.85) home.target.set(0.4, 2.0, 2.2);
    else home.target.set(0.3, 2.4, 1.2);
  }
  function applyHome() {
    homeView();
    controls.target.copy(home.target);
    camera.position.setFromSpherical(new THREE.Spherical(home.dist, home.polar, home.az)).add(home.target);
    camera.fov = home.fov;
    camera.lookAt(controls.target);
    controls.update();
  }

  /* Insets: the card covers part of the view, so the picture is drawn off-centre to keep the chosen cat in the clear part. */
  const inset = { right: 0, bottom: 0, x: 0, y: 0 };
  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    post?.setSize(w, h);
    water.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    camera.aspect = w / h;
    camera.fov = fovFor(camera.aspect);
    applyOffset();
    requestRender();
  }
  function applyOffset() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    if (Math.abs(inset.x) > 0.5 || Math.abs(inset.y) > 0.5) camera.setViewOffset(w, h, inset.x, inset.y, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  applyHome();
  new ResizeObserver(resize).observe(canvas);
  resize();

  /* ── Idle auto-orbit: gentle; stops at a touch and comes back after a long quiet spell ── */
  let lastInput = performance.now();
  const touched = () => { lastInput = performance.now(); controls.autoRotate = false; };
  controls.addEventListener("start", touched);
  canvas.addEventListener("wheel", touched, { passive: true });

  /* Keyboard: arrows turn the view, + and - zoom. (Escape and "find a cat" are the page's.) */
  canvas.addEventListener("keydown", (e) => {
    const off = new THREE.Vector3().subVectors(camera.position, controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    let used = true;
    if (e.key === "ArrowLeft") sph.theta -= 0.15;
    else if (e.key === "ArrowRight") sph.theta += 0.15;
    else if (e.key === "ArrowUp") sph.phi = Math.max(controls.minPolarAngle, sph.phi - 0.08);
    else if (e.key === "ArrowDown") sph.phi = Math.min(controls.maxPolarAngle, sph.phi + 0.08);
    else if (e.key === "+" || e.key === "=") sph.radius = Math.max(controls.minDistance, sph.radius * 0.85);
    else if (e.key === "-" || e.key === "_") sph.radius = Math.min(controls.maxDistance, sph.radius * 1.15);
    else if (e.key === "Home") { focus = null; applyHome(); requestRender(); e.preventDefault(); return; }
    else used = false;
    if (!used) return;
    e.preventDefault();
    touched();
    camera.position.copy(controls.target).add(off.setFromSpherical(sph));
    controls.update();
    requestRender();
  });

  /* ── Picking: a tap on a cat (or close to one) chooses it; hovering shows its name ── */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  function catAt(clientX, clientY, reach) {
    const rc = canvas.getBoundingClientRect();
    const px = clientX - rc.left, py = clientY - rc.top;
    ndc.set((px / rc.width) * 2 - 1, -(py / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let cat = herd.pick(ray);
    if (!cat && reach) {
      let best = reach;
      for (const c of sim.cats) {
        if (c.hidden) continue;
        herd.midPoint(c, tmp).project(camera);
        if (tmp.z > 1) continue;
        const d = Math.hypot((tmp.x * 0.5 + 0.5) * rc.width - px, (-tmp.y * 0.5 + 0.5) * rc.height - py);
        if (d < best) { best = d; cat = c; }
      }
    }
    return cat;
  }
  let down = null;
  canvas.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 7 || performance.now() - down[2] > 600) { down = null; return; }
    down = null;
    const cat = catAt(e.clientX, e.clientY, e.pointerType === "touch" ? 36 : 20);
    // No cat there, but the cottage (Research HQ): open its panel.
    if (!cat && easel.hit(ray)) { onTeaser?.(); return; }
    if (!cat && Number.isFinite(research.hit(ray))) { research.open(); return; }
    onPick?.(cat ? cat.id : null);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || e.buttons) return;
    hoverQueued = [e.clientX, e.clientY];
  });
  canvas.addEventListener("pointerleave", () => { hoverQueued = null; setHover(null); });
  function setHover(cat) {
    if (hovered === cat) return;
    if (hovered && hovered.id !== chosenId) herd.highlight.delete(hovered.id);
    hovered = cat;
    if (cat && cat.id !== chosenId) herd.highlight.set(cat.id, 0.55);
    canvas.style.cursor = cat ? "pointer" : "";
    if (!cat) onHover?.(null);
    requestRender();
  }

  /* ── Choosing a cat: the camera eases over to it and keeps it in view ── */
  function choose(id, { ease = true } = {}) {
    const cat = id ? sim.byId(id) : null;
    if (chosenId && chosenId !== id) herd.highlight.delete(chosenId);
    chosenId = cat ? cat.id : null;
    ring.visible = !!cat;
    if (!cat) {
      focus = null;
      if (saved && ease) {
        focus = { back: true, t: 0, start: performance.now(), fromT: controls.target.clone(), fromP: camera.position.clone(), toT: saved.target, toP: saved.position };
        saved = null;
      }
      requestRender();
      return;
    }
    herd.highlight.set(cat.id, 1);
    setHover(null);
    touched();
    if (!saved) saved = { target: controls.target.clone(), position: camera.position.clone() };
    const mid = herd.midPoint(cat, new THREE.Vector3());
    // Keep the direction we look from, unless the cottage or a tree stands in the way: then come round.
    const off = new THREE.Vector3().subVectors(camera.position, controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.radius = mobile ? 10.5 : 9.5;
    sph.phi = Math.min(Math.max(sph.phi, 1.0), 1.28);
    const toP = new THREE.Vector3().setFromSpherical(sph).add(mid);
    const theta0 = sph.theta, phi0 = sph.phi;
    search: for (const phi of [phi0, 0.9]) {
      for (const d of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.0, -2.0, 2.6, -2.6, Math.PI]) {
        sph.theta = theta0 + d; sph.phi = phi;
        toP.setFromSpherical(sph).add(mid);
        if (!blocked(toP, mid)) break search;
      }
      sph.theta = theta0; sph.phi = phi0; toP.setFromSpherical(sph).add(mid);
    }
    focus = { t: still || !ease ? 1 : 0, start: performance.now(), fromT: controls.target.clone(), fromP: camera.position.clone(), toT: mid, toP, offset: toP.clone().sub(mid), follow: cat };
    if (focus.t >= 1) { controls.target.copy(mid); camera.position.copy(toP); controls.update(); }
    requestRender();
  }
  const houseBox = new THREE.Box3(new THREE.Vector3(HOUSE.minX, 0, HOUSE.minZ), new THREE.Vector3(HOUSE.maxX, HOUSE.height * 0.85, HOUSE.maxZ));
  const _sphere = new THREE.Sphere();
  /** Where the line from `from` to `to` (on the ground plane) first crosses the circle of radius r, as a fraction of the way, or null. */
  function crossing(from, to, r) {
    const dx = to.x - from.x, dz = to.z - from.z;
    const a = dx * dx + dz * dz, b = 2 * (from.x * dx + from.z * dz), c = from.x * from.x + from.z * from.z - r * r;
    const disc = b * b - 4 * a * c;
    if (a < 1e-9 || disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : null;
  }
  /** Would the cottage, a tree, or the fence and hedge round the garden hide `to` (the cat) from `from` (the camera)? */
  function blocked(from, to) {
    // A camera outside the garden has to look well over the picket fence (1.1 high) and the hedge
    // just beyond it, or the pickets fill the foreground and cut through the cat.
    for (const [r, h] of [[GARDEN.fenceR, 1.9], [GARDEN.fenceR + 2.2, 2.1]]) {
      const t = Math.hypot(from.x, from.z) > r ? crossing(from, to, r) : null;
      if (t !== null && from.y + (to.y - from.y) * t < h) return true;
    }
    ray.ray.origin.copy(from);
    ray.ray.direction.subVectors(to, from);
    const d = ray.ray.direction.length();
    ray.ray.direction.normalize();
    const hit = ray.ray.intersectBox(houseBox, tmp2);
    if (hit && hit.distanceTo(from) < d - 0.4) return true;
    for (const o of occluders) {
      _sphere.center.set(o.x, o.y, o.z); _sphere.radius = o.r;
      const h = ray.ray.intersectSphere(_sphere, tmp2);
      if (h && h.distanceTo(from) < d - 0.6) return true;
    }
    return from.y < groundHeight(from.x, from.z) + 0.6;
  }
  function advanceFocus(dt) {
    if (!focus) return;
    if (focus.t < 1) {
      // Timed by the clock, not by frames, so a slow device still gets there on time.
      focus.t = Math.min(1, (performance.now() - focus.start) / (focus.back ? 1100 : 1300));
      const e = focus.t < 0.5 ? 4 * focus.t ** 3 : 1 - (-2 * focus.t + 2) ** 3 / 2;
      if (focus.follow) { herd.midPoint(focus.follow, focus.toT); focus.toP.copy(focus.toT).add(focus.offset); }
      controls.target.lerpVectors(focus.fromT, focus.toT, e);
      camera.position.lerpVectors(focus.fromP, focus.toP, e);
      if (focus.t >= 1 && focus.back) focus = null;
    } else if (focus.follow) {
      // Follow the cat as it wanders: move target and camera together, so the user's angle and zoom stay theirs.
      const mid = herd.midPoint(focus.follow, tmp);
      tmp2.subVectors(mid, controls.target).multiplyScalar(Math.min(1, dt * 3));
      controls.target.add(tmp2);
      camera.position.add(tmp2);
      // If it wanders behind the cottage or a tree (and nobody is steering), come round to see it again.
      const now = performance.now();
      if (now - (focus.checked || 0) > 1000) {
        focus.checked = now;
        const hidden = blocked(camera.position, herd.midPoint(focus.follow, new THREE.Vector3()));
        focus.hiddenSince = hidden ? focus.hiddenSince || now : 0;
        if (hidden && now - focus.hiddenSince > 1500 && now - lastInput > 3000) { const id = chosenId; chosenId = null; choose(id); }
      }
    }
  }
  function setInset(right = 0, bottom = 0) { inset.right = right; inset.bottom = bottom; }
  function easeInset(dt) {
    const tx = inset.right / 2, ty = inset.bottom / 2;
    const k = still ? 1 : Math.min(1, dt * 5);
    const nx = inset.x + (tx - inset.x) * k, ny = inset.y + (ty - inset.y) * k;
    if (Math.abs(nx - inset.x) > 0.05 || Math.abs(ny - inset.y) > 0.05 || (tx === 0 && ty === 0 && (inset.x || inset.y))) {
      inset.x = Math.abs(nx - tx) < 0.5 ? tx : nx; inset.y = Math.abs(ny - ty) < 0.5 ? ty : ny;
      applyOffset();
    }
  }

  /* ── Reduced motion: cats settle, no auto-orbit, birds and clouds still; draw only when the view changes ── */
  reduce.addEventListener?.("change", () => {
    still = reduce.matches;
    sim.setReduced(still);
    herd.still = still;
    controls.enableDamping = !still;
    if (still) controls.autoRotate = false;
    startLoop();
    requestRender();
  });
  controls.addEventListener("change", () => requestRender());

  /* ── Adapting to the device: fewer pixels when frames run slow ── */
  const perf = { samples: [], level: 0, since: performance.now() };
  function adapt(ms) {
    if (still || !adaptive) return;
    perf.samples.push(ms);
    if (perf.samples.length < 90) return;
    const sorted = perf.samples.slice().sort((a, b) => a - b), median = sorted[sorted.length >> 1];
    perf.samples.length = 0;
    if (median > 34 && post?.gtao && post.gtao.enabled) { post.gtao.enabled = false; return; } // first, drop the occlusion pass
    if (median > 34 && perf.level < 3) {
      perf.level++;
      dprCap = [2, 1.5, 1.1, 0.85][perf.level];
      renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
      if (perf.level >= 3) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; }
      resize();
    }
  }

  /* ── Guards against a black screen ──
     - the finishing pass: if its first frame reads back black (float buffers that can't be drawn
       to on this GPU, or NaNs), it is dropped and the plain render is used;
     - the watchdog: under 15 frames a second for 5 s drops the finishing pass, then the
       resolution, and lowers this session's tier for the next visit. */
  let postChecked = false;
  function checkPost() {
    postChecked = true;
    const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4);
    let lit = 0;
    for (const [fx, fy] of [[0.5, 0.9], [0.2, 0.7], [0.8, 0.5], [0.5, 0.3], [0.3, 0.15]]) {
      gl.readPixels(Math.floor(w * fx), Math.floor(h * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      if (px[0] + px[1] + px[2] > 12) lit++;
    }
    if (!lit) { console.warn("post: first frame was black; drawing without it"); post.dispose(); post = null; renderer.render(scene, camera); }
  }
  const dog = { slowSince: 0, stage: 0 };
  function watchdog(ms) {
    if (still || !adaptive || document.hidden) { dog.slowSince = 0; return; }
    const now = performance.now();
    if (ms < 66) { dog.slowSince = 0; return; }
    if (!dog.slowSince) { dog.slowSince = now; return; }
    if (now - dog.slowSince < 5000) return;
    dog.slowSince = 0; dog.stage++;
    console.warn("watchdog: frames under 15 fps for 5 s; lowering quality", dog.stage);
    if (post) { post.dispose(); post = null; }
    else if (dprCap > 0.85) { dprCap = Math.max(0.85, dprCap * 0.7); renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap)); resize(); }
    if (dog.stage === 2 && !quality) dropTier(q.tier);
  }

  /* ── Staying in the world: the view's centre stays over the meadows, the camera above the ground ── */
  const LIMIT_R = MEADOW.ring2.outer + 6;
  function keepInWorld() {
    const t = controls.target, r = Math.hypot(t.x, t.z);
    if (r > LIMIT_R) { const k = LIMIT_R / r; const dx = t.x * k - t.x, dz = t.z * k - t.z; t.x += dx; t.z += dz; camera.position.x += dx; camera.position.z += dz; }
    const floor = groundHeight(camera.position.x, camera.position.z) + 1.2;
    if (camera.position.y < floor) camera.position.y = floor;
  }
  /** The sun's shadow box follows what the camera looks at (in steps, so shadows don't shimmer),
      and is sized to the view: tight and crisp close up, wide from far off. */
  const sunAt = new THREE.Vector3(1e9, 0, 0);
  let shadowHalf = 0;
  function followSun() {
    const t = controls.target;
    const dist = camera.position.distanceTo(t);
    const half = Math.min(90, Math.max(22, Math.round((dist * 0.95 + 8) / 4) * 4));
    // Centre the box a little towards the camera: that side of the view is what fills the screen.
    const cx = t.x + (camera.position.x - t.x) * 0.25, cz = t.z + (camera.position.z - t.z) * 0.25;
    const step = half / 6;
    const x = Math.round(cx / step) * step, z = Math.round(cz / step) * step;
    if (sunAt.x === x && sunAt.z === z && half === shadowHalf) return;
    sunAt.set(x, groundHeight(x, z), z);
    if (half !== shadowHalf) {
      shadowHalf = half;
      Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, far: 120 + half * 1.2 });
      sun.shadow.camera.updateProjectionMatrix();
    }
    sun.target.position.copy(sunAt);
    sun.position.copy(SUN_LIGHT).multiplyScalar(80 + half * 0.4).add(sunAt);
    sun.target.updateMatrixWorld();
  }

  /* ── The loop ── */
  const clock = new THREE.Clock();
  function requestRender() { needsRender = true; if (!running) renderSoon(); }
  function renderSoon() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; if (needsRender && !running) frame(); }); }

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0);
  let grassPending = 1;
  function frame() {
    const t0 = performance.now();
    // Slow devices still get the whole of the garden's time (in steps of at most 1/20 s), so cats
    // keep their pace instead of creeping about like statues when frames take long.
    const real = Math.min(clock.getDelta(), 0.25);
    const steps = Math.max(1, Math.ceil(real / 0.05)), dt = real / steps;
    if (!still && !controls.autoRotate && !chosenId && performance.now() - lastInput > 20000) controls.autoRotate = true;
    if (!still) ambientTime += real;
    ambient.update(ambientTime, canvas.clientHeight, camera.aspect, renderer.getPixelRatio());
    sim.setViewer(camera.position.x, camera.position.z);
    meadow.setFocus(controls.target.x, controls.target.z, camera.position.x, camera.position.z);
    for (let k = 0; k < steps; k++) { critters.update(dt, still); if (!still) sim.update(dt); }
    if (still) meadow.update(0); // still: nothing moves, but the cats near the view still appear
    herd.update();
    garden.syncYarn(sim.yarns);
    advanceFocus(real);
    easeInset(dt);
    controls.update(still ? undefined : real);
    keepInWorld();
    followSun();
    sky.update(real, camera, still);
    flora.update(camera);
    grassPending = grass.update(camera, grassPending > 8 ? 3 : 2);
    sign?.update(still);
    research.update(still);
    // Launched cats' coins, and the ring under the chosen cat.
    const tt = clock.elapsedTime;
    launched.forEach((c, i) => {
      herd.headPoint(c, tmp);
      _q.setFromAxisAngle(_y, still ? 0.6 : tt * 1.6 + i);
      _m.compose(tmp.setY(tmp.y + 0.2 + (still ? 0 : Math.sin(tt * 2 + i) * 0.05)), _q, _s);
      coinMesh.setMatrixAt(i, _m);
    });
    if (launched.length) coinMesh.instanceMatrix.needsUpdate = true;
    const cc = chosenId ? sim.byId(chosenId) : null;
    if (cc) {
      ring.position.set(cc.x, cc.y + 0.04, cc.z);
      const k = still ? 1 : 1 + Math.sin(tt * 3) * 0.06;
      ring.scale.set(k, 1, k);
    }
    // No hover labels while the camera glides to a chosen cat (the pointer is still where the click was).
    if (hoverQueued && !(focus && focus.t < 1)) { const [x, y] = hoverQueued; hoverQueued = null; setHover(catAt(x, y, 0)); }
    water.update(renderer, scene, camera);
    if (post) { post.render(); if (!postChecked) checkPost(); } else renderer.render(scene, camera);
    if (grassPending > 0 && !running) requestRender();
    if (cc && onTrack) {
      herd.headPoint(cc, tmp).project(camera);
      onTrack(byId.get(cc.id), (tmp.x * 0.5 + 0.5) * canvas.clientWidth, (-tmp.y * 0.5 + 0.5) * canvas.clientHeight, tmp.z < 1, cc.doing);
    }
    if (hovered && onHover) {
      if (hovered.id === chosenId) onHover(null);
      else {
        herd.headPoint(hovered, tmp).project(camera);
        onHover(byId.get(hovered.id), (tmp.x * 0.5 + 0.5) * canvas.clientWidth, (-tmp.y * 0.5 + 0.5) * canvas.clientHeight);
      }
    }
    needsRender = false;
    frameMs = performance.now() - t0;
    if (running && lastFrameAt) { adapt(t0 - lastFrameAt); watchdog(t0 - lastFrameAt); }
    lastFrameAt = t0;
  }
  function startLoop() {
    const want = !still && !document.hidden;
    if (want && !running) { clock.getDelta(); lastFrameAt = 0; renderer.setAnimationLoop(frame); running = true; }
    else if (!want && running) { renderer.setAnimationLoop(null); running = false; }
    if (still) requestRender();
  }
  document.addEventListener("visibilitychange", startLoop);
  // In reduced-motion mode the damping is off, but a camera ease still needs frames: step them by hand.
  const easing = () => (focus && focus.t < 1) || Math.abs(inset.x - inset.right / 2) > 0.5 || Math.abs(inset.y - inset.bottom / 2) > 0.5;
  const tick = () => { if (!running) { frame(); if (easing()) requestAnimationFrame(tick); } };

  /* A lost GPU context (most often: out of GPU memory): the tier drops one step for this session,
     and the page rebuilds at it once the context is back (or after a few seconds if it never comes). */
  let lostTimer = 0;
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    renderer.setAnimationLoop(null); running = false;
    let losses = 0;
    try { losses = +(sessionStorage.getItem("cs-gl-losses") || 0) + 1; sessionStorage.setItem("cs-gl-losses", String(losses)); } catch {}
    const next = dropTier(q.tier);
    canvas.dispatchEvent(new CustomEvent("world:lost", { bubbles: true, detail: { losses, tier: next } }));
    clearTimeout(lostTimer);
    lostTimer = setTimeout(() => canvas.dispatchEvent(new CustomEvent("world:rebuild", { bubbles: true, detail: { losses, tier: next } })), 5000);
  });
  canvas.addEventListener("webglcontextrestored", () => {
    clearTimeout(lostTimer);
    canvas.dispatchEvent(new CustomEvent("world:rebuild", { bubbles: true, detail: { tier: tierCap() } }));
  });

  mark("cats and first frame");
  timings.total = +(performance.now() - t00).toFixed(1);
  frame();
  startLoop();

  // The finishing pass, once the first view is up (medium and high tiers).
  const postLoad = q.post ? (async () => {
    await new Promise((r) => setTimeout(r, 0));
    try {
      if (!renderer.extensions.has("EXT_color_buffer_float") && !renderer.extensions.has("EXT_color_buffer_half_float")) throw new Error("no float render targets");
      const { createPost } = await import("./post.js");
      const aoSkip = [grass.group, sky.group, water.group, ambient.group, garden.group.getObjectByName("glass"), ...scene.children.filter((o) => o.isInstancedMesh && /^(cat|ginger)-/.test(o.name)), herd.blobs].filter(Boolean);
      post = await createPost(renderer, scene, camera, { q, aoSkip, sunDir: SUN_DISC });
      resize();
      requestRender();
    } catch (e) { console.warn("post", e); post = null; }
  })() : Promise.resolve();

  /* ── Each cat's own model, streamed: the ones near the view first, a few at a time ──
     assets/models/cats/index.json lists every model; a key is a cat's id (a stock cat's ticker),
     or a famous coin's contract, symbol or id (ui/models.js matches them). Models are fetched
     only for cats within OWN.loadDist of the camera; the rest keep the shared, tinted model. */
  const ownState = { index: null, queue: [], loading: 0, done: new Set(), hi: [] };
  const ownLoad = (async () => {
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    let index;
    try { const res = await fetch(OWN.index); if (!res.ok) return; index = await res.json(); } catch { return; }
    ownState.index = index;
    for (const [key, dims] of Object.entries(index?.cats || {})) {
      const id = modelIdFor(key, residents);
      if (id && sim.byId(id)) ownState.queue.push({ id, file: typeof dims.file === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(dims.file) ? dims.file : key, dims, stage: 0 });
    }
    await pumpOwn(true);
  })();
  const LOAD_DIST = 70;
  const ownFrustum = new THREE.Frustum(), ownPv = new THREE.Matrix4(), ownP = new THREE.Vector3();
  const loadGlb = (f) => loader.loadAsync(`assets/models/cats/${encodeURIComponent(f)}.glb`).then((g) => g.scene).catch(() => null);
  /* A budget for the full models' GPU memory: at most tier.hiMax of them are kept (the farthest
     is freed, and queued again, to make room), and their textures are shrunk to tier.hiTex. */
  const tierQ = q;
  function makeRoomForHi(want) {
    if (ownState.hi.length < tierQ.hiMax) return true;
    const d = (e) => { if (e.id === chosenId) return -1; herd.midPoint(sim.byId(e.id), ownP); return ownP.distanceTo(camera.position); };
    ownState.hi.sort((x, y) => d(y) - d(x));
    const far = ownState.hi[0];
    if (!far || d(far) <= d(want) + 4) return false;
    ownState.hi.shift();
    if (herd.dropOwnHi(far.id)) ownState.queue.push(far);
    return true;
  }
  function shrinkTextures(root, max) {
    const seen = new Set();
    root.traverse((o) => {
      for (const m of [].concat(o.material || [])) for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"]) {
        const t = m[k], img = t?.image;
        if (!t || seen.has(t) || !img || !(img.width > max)) continue;
        seen.add(t);
        try {
          const c = document.createElement("canvas");
          const k2 = max / Math.max(img.width, img.height);
          c.width = Math.round(img.width * k2); c.height = Math.round(img.height * k2);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          img.close?.();
          t.image = c; t.needsUpdate = true;
        } catch {}
      }
    });
  }
  /** Loads the nearest wanted models (the far copy first, then the full one), up to three at once. */
  async function pumpOwn(first = false) {
    if (!ownState.queue.length) return;
    ownFrustum.setFromProjectionMatrix(ownPv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const score = (q) => { const c = sim.byId(q.id); herd.midPoint(c, ownP); return ownP.distanceTo(camera.position) + (ownFrustum.containsPoint(ownP) ? 0 : 30) + q.stage * 40; };
    const jobs = [];
    while (ownState.loading < 3) {
      const now = performance.now(), cand = ownState.queue.filter((q) => !q.busy && !(q.wait > now)).map((q) => [score(q), q]).filter(([d, q]) => d - q.stage * 40 < LOAD_DIST || q.id === chosenId).sort((a, b) => a[0] - b[0]);
      if (!cand.length) break;
      const q = cand[0][1];
      if (q.stage === 1 && q.id !== chosenId && !makeRoomForHi(q)) { q.wait = now + 3000; continue; }
      q.busy = true; ownState.loading++;
      jobs.push((async () => {
        const root = await loadGlb(q.file + (q.stage === 0 ? "-lo" : ""));
        if (root && q.stage === 1) shrinkTextures(root, tierQ.hiTex);
        if (root) { herd.attachOwn(q.id, q.stage === 0 ? { lo: root, dims: q.dims } : { hi: root, dims: q.dims }); requestRender(); }
        ownState.loading--; q.busy = false;
        if (q.stage === 0) q.stage = 1; else { ownState.queue.splice(ownState.queue.indexOf(q), 1); if (root) ownState.hi.push(q); }
      })());
    }
    await Promise.all(jobs);
    if (first && jobs.length) return pumpOwn(true);
  }
  function trimHi() {
    const d = (e) => { if (e.id === chosenId) return -1; herd.midPoint(sim.byId(e.id), ownP); return ownP.distanceTo(camera.position); };
    while (ownState.hi.length > tierQ.hiMax) {
      ownState.hi.sort((x, y) => d(y) - d(x));
      const far = ownState.hi.shift();
      if (herd.dropOwnHi(far.id)) ownState.queue.push(far);
    }
  }
  setInterval(() => { if (ownState.index && !document.hidden) { trimHi(); pumpOwn(); } }, 700);

  const api = {
    choose(id, opts) { choose(id, opts); if (!running) { requestAnimationFrame(tick); } },
    setInset(right, bottom) { setInset(right, bottom); requestRender(); if (!running) requestAnimationFrame(tick); },
    get chosen() { return chosenId; },
    home() { focus = null; saved = null; applyHome(); requestRender(); },
    /** The screen position of a cat's head, for anything that labels it. */
    screenOf(id) {
      const c = sim.byId(id);
      if (!c) return null;
      herd.headPoint(c, tmp).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * canvas.clientWidth, y: (-tmp.y * 0.5 + 0.5) * canvas.clientHeight, visible: tmp.z < 1 };
    },
    doing: (id) => sim.byId(id)?.doing || "",
    get frameMs() { return frameMs; },
    /** The "Who's that cat?" easel's silhouette (data/next-cat.json). */
    setTeaser(src) { easel.set(src, () => requestRender()); },
  };
  if (debug) {
    // For screenshots and checks: step the garden forward without waiting, and read the draw stats.
    Object.assign(api, {
      research, sim, meadow, renderer, scene, camera, controls, critters, herd, ownLoad, q, postLoad, grass, flora, water, timings,
      /** Views for screenshots: the first footbridge over the stream, and the Hall of Fame plaza. */
      debugViews: (() => {
        const b = BRIDGES[0], H = HALL_OF_FAME, a = Math.atan2(H.z, H.x);
        return {
          stream: { t: [b.x, b.water + 0.5, b.z], p: [b.x - 9, b.water + 5.5, b.z + 12] },
          hall: { t: [H.x, 1, H.z], p: [H.x - Math.cos(a + 0.5) * 17, 8.5, H.z - Math.sin(a + 0.5) * 17] },
        };
      })(),
      /** Stops the animation loop (a frame is then drawn only by advance or settle), for screenshots on slow software GL. */
      pause() { renderer.setAnimationLoop(null); running = false; },
      /** Grows every grass chunk near the view now (for screenshots). */
      settle() { for (let i = 0; i < 400 && grass.update(camera, 6) > 0; i++); flora.relod(camera.position); frame(); },
      advance(seconds, dt = 1 / 30) { meadow.setFocus(controls.target.x, controls.target.z, camera.position.x, camera.position.z); for (let t = 0; t < seconds; t += dt) { critters.update(dt, still); sim.update(dt); } sky.update(seconds, camera, still); ambientTime += seconds; frame(); },
      stats() {
        // Every draw call of one whole frame (shadow pass, pond mirror, occlusion, bloom and all)…
        renderer.info.autoReset = false; renderer.info.reset();
        const t0 = performance.now();
        frame();
        const ms = performance.now() - t0;
        const all = { ...renderer.info.render };
        // …and the main view's own pass on its own.
        renderer.info.reset();
        renderer.render(scene, camera);
        const i = { ...renderer.info.render };
        renderer.info.autoReset = true;
        frame();
        return { tier: q.tier, grassBlades: grass.blades, post: !!post, ao: !!post?.gtao?.enabled, mirror: water.mirrored, calls: i.calls, triangles: i.triangles, callsWholeFrame: all.calls, trianglesWholeFrame: all.triangles, cats: sim.cats.length, gardenCats: garden0.cats.length, meadow: meadow.counts(), catsDrawn: herd.drawn, catTriangles: herd.triangles(), frameCpuMs: +ms.toFixed(2), programs: renderer.info.programs?.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, pixelRatio: renderer.getPixelRatio(), level: perf.level, census: sim.census(), ownModels: herd.ownCounts() };
      },
      catsOnScreen() {
        return sim.cats.map((c) => { herd.midPoint(c, tmp).project(camera); return { id: c.id, x: (tmp.x * 0.5 + 0.5) * canvas.clientWidth, y: (-tmp.y * 0.5 + 0.5) * canvas.clientHeight, z: tmp.z, doing: c.doing, pose: c.pose }; });
      },
    });
  }
  return api;
}
