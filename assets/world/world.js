/* The world in 3D: renderer, sunlight, sky, the cottage, the garden, the cats, the birds and
   butterflies, the camera and its controls, picking, and easing the camera to a chosen cat.
   main.js loads this only when WebGL is available; the page's overlay lives in assets/ui/. */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildGarden } from "./garden.js";
import { buildSky, SKY } from "./sky.js";
import { buildCritters } from "./critters.js";
import { buildAmbient } from "./ambient.js";
import { buildSign } from "./sign.js";
import { createSanctuary } from "./cats.js";
import { loadCatModels, CatHerd, coatFor, OWN } from "./catviews.js";
import { HOUSE, GARDEN } from "./layout.js";

/** Where the sun sits in the sky (seen from the usual view: up and to the left, behind the cottage)… */
const SUN_DISC = new THREE.Vector3(-0.6, 0.13, -0.79).normalize();
/** …and where its light comes from: the same side, higher, so the garden is bright and shadows are short. */
const SUN_LIGHT = new THREE.Vector3(-0.62, 0.72, -0.3).normalize();
/** The vertical field of view on a phone held upright. */
const PORTRAIT_FOV = 64;

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
export async function startWorld({ canvas, residents, reduce, onPick, onHover, onTrack, debug = false, adaptive = true }) {
  const small = matchMedia("(max-width: 720px), (max-height: 520px)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const mobile = small || coarse;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile || devicePixelRatio < 2, powerPreference: "high-performance" });
  let dprCap = mobile ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = mobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const haze = new THREE.Color(SKY.horizon).lerp(new THREE.Color(0xcfe3ee), 0.35);
  scene.fog = new THREE.Fog(haze, 70, 480);
  scene.background = haze;

  /* Daylight: a warm sun with soft shadows, a bright sky fill, and a gentle bounce from the front. */
  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x9bbf6a, 1.55));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.7);
  sun.position.copy(SUN_LIGHT).multiplyScalar(40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 5, far: 90 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xffe7c8, 0.75);
  fill.position.set(10, 8, 22);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
  const sky = buildSky(scene, { sunDir: SUN_DISC, mobile });
  const garden = buildGarden(scene, { mobile, sunDir: SUN_LIGHT });
  // Petals, motes, chimney smoke, the vignette, and the clock for the wind and the water.
  // (The chimney's top, measured on sanctuary.glb at HOUSE.height.)
  const ambient = buildAmbient(scene, { mobile, blossoms: garden.blossoms, chimney: { x: 2.25, y: HOUSE.height + 0.1, z: -0.05 } });
  let ambientTime = 14; // frozen here with reduced motion: petals and motes hang mid-air

  /* The cottage and the cats (these load in parallel). */
  const loader = new GLTFLoader();
  const [houseGltf, models, sign] = await Promise.all([loader.loadAsync("assets/models/sanctuary.glb"), loadCatModels(loader, "assets/models/", { cell: mobile ? 0.07 : 0.045 }), buildSign(scene, { roof: HOUSE.height - 0.75, yaw: 0.3, width: 5.4 }).catch(() => null)]);
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
      if (m && m.map) { m.emissiveMap = m.map; m.emissive = new THREE.Color(0xffb070); m.emissiveIntensity = 0.1; m.needsUpdate = true; }
    });
    scene.add(house);
  }

  let still = reduce.matches;
  let needsRender = true, running = false, frameMs = 0, lastFrameAt = 0;
  let queued = false;
  let chosenId = null, focus = null;
  let saved = null; // the view before the first cat was chosen, to go back to
  let hovered = null, hoverQueued = null;
  const coats = new Map(residents.map((r, i) => [r.id, coatFor(r, i)]));
  const simResidents = residents.map((r) => ({ id: r.id, name: r.name, model: coats.get(r.id).ginger ? "ginger" : "cat" }));
  let sim = null;
  const critters = buildCritters(scene, {
    mobile,
    fencePosts: garden.fencePosts,
    flowerFields: garden.flowerFields,
    lawnFree: (x, z) => !sim || sim.nav.pointFree(x, z, 0.35),
    catsNear: (x, z, r) => !!sim && sim.cats.some((c) => Math.abs(c.x - x) < r && Math.abs(c.z - z) < r && Math.hypot(c.x - x, c.z - z) < r),
  });
  sim = createSanctuary({ residents: simResidents, reduced: still, critters });
  // On phones the cats don't cast into the shadow map (the most costly pass there); each gets a soft blob shadow instead.
  const herd = new CatHerd(scene, models, sim, coats, { blobShadows: mobile });
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
  controls.maxDistance = 75;
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
    for (const o of garden.occluders) {
      _sphere.center.set(o.x, o.y, o.z); _sphere.radius = o.r;
      const h = ray.ray.intersectSphere(_sphere, tmp2);
      if (h && h.distanceTo(from) < d - 0.6) return true;
    }
    return from.y < 0.6;
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
    if (median > 34 && perf.level < 3) {
      perf.level++;
      dprCap = [2, 1.5, 1.1, 0.85][perf.level];
      renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
      if (perf.level >= 3) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; }
      resize();
    }
  }

  /* ── The loop ── */
  const clock = new THREE.Clock();
  function requestRender() { needsRender = true; if (!running) renderSoon(); }
  function renderSoon() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; if (needsRender && !running) frame(); }); }

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0);
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
    for (let k = 0; k < steps; k++) { critters.update(dt, still); if (!still) sim.update(dt); }
    herd.update();
    garden.syncYarn(sim.yarns);
    advanceFocus(real);
    easeInset(dt);
    controls.update(still ? undefined : real);
    sky.update(real, camera, still);
    sign?.update(still);
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
    renderer.render(scene, camera);
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
    if (running && lastFrameAt) adapt(t0 - lastFrameAt);
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

  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); renderer.setAnimationLoop(null); running = false; canvas.dispatchEvent(new CustomEvent("world:lost", { bubbles: true })); });
  canvas.addEventListener("webglcontextrestored", () => { startLoop(); canvas.dispatchEvent(new CustomEvent("world:restored", { bubbles: true })); });

  frame();
  startLoop();

  /* ── Each cat's own model, after the first picture is up: nearest (and in view) first ── */
  const ownLoad = (async () => {
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    let index;
    try { const res = await fetch(OWN.index); if (!res.ok) return; index = await res.json(); } catch { return; }
    const want = Object.entries(index?.cats || {}).filter(([id]) => sim.byId(id));
    const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), p = new THREE.Vector3();
    const view = () => frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const score = (id) => { const c = sim.byId(id); herd.midPoint(c, p); return p.distanceTo(camera.position) + (frustum.containsPoint(p) ? 0 : 60); };
    const load = (f) => loader.loadAsync(`assets/models/cats/${f}.glb`).then((g) => g.scene).catch(() => null);
    // The far copies first (small), a few at a time, then the full models, re-sorted as the view moves.
    for (const tag of ["-lo", ""]) {
      const queue = want.slice();
      const worker = async () => {
        while (queue.length) {
          view(); queue.sort(([a], [b]) => score(a) - score(b));
          const [id, dims] = queue.shift();
          const root = await load(id + tag);
          if (root) { herd.attachOwn(id, tag ? { lo: root, dims } : { hi: root, dims }); requestRender(); }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
    }
  })();

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
  };
  if (debug) {
    // For screenshots and checks: step the garden forward without waiting, and read the draw stats.
    Object.assign(api, {
      sim, renderer, scene, camera, controls, critters, herd, ownLoad,
      advance(seconds, dt = 1 / 30) { for (let t = 0; t < seconds; t += dt) { critters.update(dt, still); sim.update(dt); } sky.update(seconds, camera, still); ambientTime += seconds; frame(); },
      stats() {
        // three counts only the main pass unless the counters are reset by hand before the shadow pass.
        renderer.info.autoReset = false; renderer.info.reset();
        const t0 = performance.now();
        frame();
        const ms = performance.now() - t0;
        const all = { ...renderer.info.render };
        renderer.info.autoReset = true;
        frame();
        const i = renderer.info.render;
        return { calls: i.calls, triangles: i.triangles, callsWithShadowPass: all.calls, trianglesWithShadowPass: all.triangles, cats: sim.cats.length, catTriangles: herd.triangles(), frameCpuMs: +ms.toFixed(2), programs: renderer.info.programs?.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, pixelRatio: renderer.getPixelRatio(), level: perf.level, census: sim.census(), ownModels: herd.ownCounts() };
      },
      catsOnScreen() {
        return sim.cats.map((c) => { herd.midPoint(c, tmp).project(camera); return { id: c.id, x: (tmp.x * 0.5 + 0.5) * canvas.clientWidth, y: (-tmp.y * 0.5 + 0.5) * canvas.clientHeight, z: tmp.z, doing: c.doing, pose: c.pose }; });
      },
    });
  }
  return api;
}
