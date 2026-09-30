/* The photoreal garden (medium and high tiers; the low tier keeps the painted look and its cost).
   Loaded once the first view is up, so the first view's weight and time are unchanged; each piece
   swaps in as it arrives, and the procedural version shows until then:
     - photographed, tiling ground textures (assets/world/tex/: 1024 px on the high tier, 512 on
       medium) for the terrain's grass, earth, gravel and stone, and bark for the procedural trunks;
     - models made with Tripo H3.1 (assets/models/world/, index.json gives each one's size; see its
       README.md): the garden's and the meadows' trees near the view (flora.js useModel), the
       cottage (fitted to the old one's footprint and height, the chimney smoke, the Research HQ
       antenna and plaque moved to match), and the props garden.js keeps apart for this: lamp posts,
       benches, cat beds, cat trees and the plaza's fountain, each kind one instanced mesh per part. */

import * as THREE from "three";
import { windify } from "./ambient.js";

const TEX = "assets/world/tex/", DIR = "assets/models/world/";
const TREES = ["oak", "birch", "cherry", "pine", "apple"];
/* Heights in the models (units of their index size), measured on them: the cat tree's first platform
   and its top bed, the cat bed's cushion, the fountain's water line and basin. */
const CAT_TREE = { first: 0.7, top: 1.93 }, BED = { cushion: 0.21 }, FOUNTAIN = { water: 0.98, basin: 1.25 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

/** The mean colour (linear) of a texture's picture, from a small copy of it. */
function meanOf(img) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data, m = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) m[k] += d[i + k] / 255 / 256;
  return new THREE.Color().setRGB(m[0], m[1], m[2], THREE.SRGBColorSpace);
}

/**
 * @param {object} o
 * @param {THREE.WebGLRenderer} o.renderer
 * @param {object} o.q            the quality tier
 * @param {THREE.GLTFLoader} o.loader
 * @param {object} [o.post]       the finishing pass (post.js), if it is up
 * @param {object} o.garden       garden.js (terrain uniforms, swaps)
 * @param {object} o.flora, o.grass, o.water, o.ambient, o.research
 * @param {THREE.Object3D} o.house  the cottage shown now
 * @param {{x:number,y:number,z:number}} o.chimney  where its smoke rises
 * @param {() => void} o.requestRender
 */
export async function loadPhotoreal({ renderer, q, loader, post, garden, flora, grass, water, ambient, research, house, chimney, requestRender }) {
  const aniso = Math.min(q.tier === "high" ? 16 : 8, renderer.capabilities.getMaxAnisotropy());
  const texture = async (name) => {
    const t = await new THREE.TextureLoader().loadAsync(`${TEX}${name}${q.tier === "high" ? "" : "-512"}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    return t;
  };

  /* ── The ground and the bark ── */
  const ground = (async () => {
    const [lawn, earth, gravel, stone, bark] = await Promise.all(["grass", "earth", "gravel", "stone", "bark"].map(texture));
    const U = garden.terrain.uniforms;
    U.tLawn.value = lawn; U.tEarth.value = earth; U.tGravel.value = gravel; U.tStone.value = stone;
    // Repeats a unit: a tile of lawn or gravel is about 1.6 wide, earth 2, the flagstones 3.5.
    U.uScale.value.set(0.62, 0.5, 0.62, 0.28);
    U.uFlatL.value.copy(meanOf(lawn.image)); U.uFlatE.value.copy(meanOf(earth.image)); U.uFlatG.value.copy(meanOf(gravel.image)); U.uFlatS.value.copy(meanOf(stone.image));
    U.uTint.value.setHex(0x86ca5a); // the lawn's usual tint (terrain.js tintAt): greener or sunnier than it tints the photo
    U.uPhoto.value = 1;
    if (post) post.grade.uniforms.uSat.value = 1.16;
    // The blades take the photo lawn's colour.
    const L = U.uFlatL.value, T = U.uTint.value;
    grass.uniforms.uGain.value.setRGB(L.r / T.r, L.g / T.g, L.b / T.b).multiplyScalar(1.25);
    const b = meanOf(bark.image);
    flora.useBark(bark, b.r * 0.3 + b.g * 0.59 + b.b * 0.11);
    requestRender();
  })().catch((e) => console.warn("photoreal: ground", e));

  /* ── The models ── */
  let index = null;
  try { const r = await fetch(`${DIR}index.json`); if (r.ok) index = (await r.json()).models; } catch {}
  if (!index) return ground;
  /** A model's meshes: geometry and material, and the matrix that places each in the model. */
  const load = (name) => loader.loadAsync(`${DIR}${name}.glb`).then((g) => {
    const parts = [];
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => { if (o.isMesh) parts.push({ geometry: o.geometry, material: o.material, matrix: o.matrixWorld.clone() }); });
    for (const p of parts) Object.assign(p.material, { metalness: 0, roughness: 0.88, envMapIntensity: 0.8 });
    return { parts, root: g.scene, size: index[name] };
  });
  /** One instanced mesh per part, at `mats` (each spot's placing); the procedural props of that kind go. */
  const instance = (kind, { parts }, mats, colors = null, material = null) => {
    for (const p of parts) {
      const m = new THREE.InstancedMesh(p.geometry, material || p.material, mats.length);
      mats.forEach((M, i) => { m.setMatrixAt(i, _m.multiplyMatrices(M, p.matrix)); if (colors) m.setColorAt(i, colors[i]); });
      Object.assign(m, { castShadow: true, receiveShadow: true, name: `${kind} model` });
      m.computeBoundingSphere();
      garden.group.add(m);
    }
    for (const m of garden.swaps[kind]?.meshes || []) m.visible = false;
    requestRender();
  };
  const at = (s, k, ky = k, kz = k) => new THREE.Matrix4().compose(_v.set(s.x, s.y, s.z), _q.setFromAxisAngle(_y, s.yaw), _s.set(k, ky, kz));
  const spots = (kind) => garden.swaps[kind]?.spots || [];
  const jobs = {
    // The cottage: fitted to the old one's box, so the paths, beds and porch step still meet it.
    cottage: (M) => {
      const box = new THREE.Box3().setFromObject(house), [x0, y0, z0, x1, y1, z1] = M.size.box, nh = M.root;
      nh.scale.set((box.max.x - box.min.x) / (x1 - x0), (box.max.y - box.min.y) / (y1 - y0), (box.max.z - box.min.z) / (z1 - z0));
      nh.position.set((box.min.x + box.max.x) / 2 - ((x0 + x1) / 2) * nh.scale.x, box.min.y, (box.min.z + box.max.z) / 2 - ((z0 + z1) / 2) * nh.scale.z);
      nh.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = true;
        // The windows glow a little (brighter while the Research Team works: research.js).
        if (o.material.map) Object.assign(o.material, { emissiveMap: o.material.map, emissive: new THREE.Color(0x6a4a2a), emissiveIntensity: 0.1 });
      });
      house.parent.add(nh);
      house.removeFromParent();
      nh.updateMatrixWorld(true);
      research.setHouse(nh);
      const top = nh.localToWorld(new THREE.Vector3(...M.size.top));
      ambient.group.getObjectByName("chimney smoke")?.position.set(top.x - chimney.x, top.y + 0.1 - chimney.y, top.z - chimney.z);
      requestRender();
    },
    lamp: (M) => instance("lamp", M, spots("lamp").map((s) => at(s, s.h / M.size.h))),
    bench: (M) => instance("bench", M, spots("bench").map((s) => at(s, 1.8 / M.size.w))),
    bed: (M) => {
      // The bed's colour tints the model a little, so the beds still differ.
      const k = (s) => (2 * s.r) / Math.max(M.size.w, M.size.d);
      instance("bed", M, spots("bed").map((s) => at(s, k(s), 0.14 / BED.cushion, k(s))), spots("bed").map((s) => new THREE.Color(s.color).lerp(new THREE.Color(1, 1, 1), 0.55)));
    },
    cattower: (M) => {
      // The top platform: the whole tree, its top bed at the platform. The low one: the tree up to
      // its first platform (cut off above it), bigger, the platform at the low platform's height.
      const hi = spots("cattower").filter((s) => !s.low), lo = spots("cattower").filter((s) => s.low);
      instance("cattower", M, hi.map((s) => at(s, (s.top - s.y) / CAT_TREE.top)));
      if (!lo.length) return;
      const k = (lo[0].top - lo[0].y) / CAT_TREE.first;
      renderer.localClippingEnabled = true;
      const cut = M.parts[0].material.clone();
      Object.assign(cut, { clippingPlanes: [new THREE.Plane(new THREE.Vector3(0, -1, 0), lo[0].y + (CAT_TREE.first + 0.03) * k)], clipShadows: true });
      instance("cattower", M, lo.map((s) => at(s, k)), null, cut);
    },
    fountain: (M) => {
      const s = spots("fountain")[0];
      if (!s) return;
      const k = s.r / (M.size.w / 2);
      instance("fountain", M, [at(s, k)]);
      // The basin's water, raised and fitted into the new basin.
      const w = water.group.getObjectByName("fountain water");
      if (w) { const sc = (FOUNTAIN.basin * k + 0.2) / (s.r - 0.05); w.scale.set(sc, 1, sc); w.position.set(s.x * (1 - sc), s.y + FOUNTAIN.water * k - 0.45, s.z * (1 - sc)); }
    },
  };
  // A tree: its model near the view, its far copy (<name>-lo.glb) beyond; the leaves are thin, so both sides show.
  for (const n of TREES) jobs[n] = async (M) => {
    const F = M.size.lo ? await load(`${n}-lo`) : M;
    for (const p of [...M.parts, ...F.parts]) { p.material.side = THREE.DoubleSide; windify(p.material, "instance", 0.006); }
    flora.useModel(n, M.parts, F.parts);
    requestRender();
  };
  // The cottage first, then the trees, then the props; three at a time.
  const names = ["cottage", ...TREES, "fountain", "bench", "lamp", "bed", "cattower"].filter((n) => index[n]);
  const worker = async () => {
    for (let n; (n = names.shift());) {
      try { await jobs[n](await load(n)); } catch (e) { console.warn("photoreal", n, e); }
    }
  };
  await Promise.all([ground, worker(), worker(), worker()]);
}
