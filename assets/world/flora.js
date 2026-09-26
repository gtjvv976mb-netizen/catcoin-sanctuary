/* The trees: oaks, birches, cherries in blossom, apple trees in fruit and pines, in the garden,
   through the meadow rings and as a forest edge on the hills all round. Each species is modelled in
   code in a few variants, each variant twice: a near model (a tapered, ridged trunk that forks into
   branches, a canopy of many soft leaf clusters shaded darker inside and underneath) and a far one
   (a few clusters). Every tree is one instance of its variant's mesh, so the whole wood is a couple
   of dozen draw calls; which trees use the near model is re-sorted as the camera moves (LOD), and
   only the near ones cast shadows. Canopies sway in the wind (ambient.js windify). */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as L from "./layout.js";
import { makeRandom } from "./rng.js";
import { windify } from "./ambient.js";

const _c = new THREE.Color(), _c2 = new THREE.Color();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

/** Colours a geometry per vertex with f(x, y, z, nx, ny, nz) → Color, and marks how much it sways. */
function finish(g, colorAt, wind = [0, 0]) {
  if (g.index) g = g.toNonIndexed();
  if (g.attributes.uv) g.deleteAttribute("uv");
  const p = g.attributes.position, n = g.attributes.normal, cnt = p.count;
  const col = new Float32Array(cnt * 3), w = new Float32Array(cnt);
  for (let i = 0; i < cnt; i++) {
    const c = colorAt(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i), i);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    w[i] = Math.max(0, p.getY(i) - wind[0]) * wind[1];
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aWind", new THREE.BufferAttribute(w, 1));
  return g;
}

/** A trunk (or a branch) from a to b, tapering from r0 to r1, with bark ridges in its colour. */
function limb(a, b, r0, r1, radial, hex, rnd, birch = false) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, Math.max(1, Math.round(len / 0.7)), false);
  // A little knobbly.
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = 1 + Math.sin(y * 5.3 + p.getX(i) * 9) * 0.05;
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  g.translate(0, len / 2, 0);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_y, dir));
  g.translate(a.x, a.y, a.z);
  const base = new THREE.Color(hex);
  const marks = birch ? Array.from({ length: 14 }, () => [rnd.range(0, len), rnd.range(0, 6.28), rnd.range(0.05, 0.14)]) : null;
  return finish(g, (x, y, z, nx, ny, nz) => {
    const ang = Math.atan2(nz, nx);
    _c.copy(base);
    if (birch) {
      const h = y - a.y;
      for (const [my, ma, ml] of marks) if (Math.abs(h - my) < ml && Math.abs(Math.atan2(Math.sin(ang - ma), Math.cos(ang - ma))) < 1.1) _c.setHex(0x3a3532);
    } else {
      _c.multiplyScalar(0.82 + 0.28 * (0.5 + 0.5 * Math.sin(ang * 7 + y * 0.6)));
    }
    return _c;
  });
}

/**
 * A leafy canopy: soft clusters round a centre. Normals point out from the canopy's centre (so it
 * shades as one soft mass), and its colour darkens inside and underneath.
 */
function canopy(blobs, centre, colors, rnd, detail, y0, windK, extra = null) {
  const parts = [];
  const c0 = new THREE.Color(colors[0]), c1 = new THREE.Color(colors[1]), dark = new THREE.Color(colors[2] ?? colors[0]).multiplyScalar(0.55);
  let top = -Infinity, bot = Infinity;
  for (const [x, y, z] of blobs) { top = Math.max(top, y); bot = Math.min(bot, y); }
  for (const [x, y, z, r] of blobs) {
    const g = new THREE.IcosahedronGeometry(r, detail);
    const p = g.attributes.position, ph = rnd.range(0, 6.28);
    for (let i = 0; i < p.count; i++) {
      // Lumpy, not spiky: a smooth ripple over each cluster (the same at shared corners, so no cracks).
      const px = p.getX(i) / r, py = p.getY(i) / r, pz = p.getZ(i) / r;
      const k = 1 + Math.sin(px * 3.1 + py * 2.3 + ph) * Math.sin(pz * 2.7 - py * 1.9 + ph) * (detail > 1 ? 0.13 : 0.1);
      p.setXYZ(i, p.getX(i) * k + x, p.getY(i) * k * 0.9 + y, p.getZ(i) * k + z);
    }
    parts.push(g);
  }
  const g = mergeGeometries(parts.map((q) => (q.index ? q.toNonIndexed() : q)));
  const p = g.attributes.position, nrm = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    _v.set(p.getX(i) - centre.x, (p.getY(i) - centre.y) * 1.3, p.getZ(i) - centre.z).normalize();
    nrm[i * 3] = _v.x; nrm[i * 3 + 1] = _v.y; nrm[i * 3 + 2] = _v.z;
  }
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  const tone = rnd.range(0, 1);
  const out = finish(g, (x, y, z, nx, ny) => {
    const h = (y - bot) / Math.max(0.01, top - bot);
    const outer = Math.hypot(x - centre.x, (y - centre.y) * 1.2, z - centre.z);
    _c.copy(c0).lerp(c1, Math.min(1, Math.max(0, 0.25 + h * 0.5 + ny * 0.25 + tone * 0.2)));
    _c.lerp(dark, Math.max(0, 0.35 - ny * 0.35) * 0.7);
    _c.offsetHSL((rnd.next() - 0.5) * 0.012, 0, (rnd.next() - 0.5) * 0.03);
    if (extra) extra(_c, x, y, z, outer);
    return _c;
  }, [y0, windK]);
  return out;
}

const SPECIES = {
  oak: { leaves: [[0x4f9a3e, 0x8fcf5a, 0x3f8a34], [0x5aa644, 0x9ad663, 0x468f3a], [0x62a947, 0xa6d86a, 0x4d9538]], trunk: 0x7a5a40 },
  birch: { leaves: [[0x7fbf4a, 0xc2e07a, 0x6aae42], [0x8cc652, 0xcfe688, 0x76b448]], trunk: 0xf1ede4 },
  cherry: { leaves: [[0xef8fb0, 0xfdd2e0, 0xd97398], [0xf4a2c0, 0xfde2ec, 0xe082a4]], trunk: 0x6e4a3a },
  apple: { leaves: [[0x55a241, 0x98d05e, 0x438a36], [0x5fa946, 0xa3d466, 0x4b9239]], trunk: 0x7d5b3e },
  pine: { leaves: [[0x2f7a4c, 0x5ea86a, 0x245f3c], [0x357f4e, 0x68b070, 0x2a6640], [0x3b8a55, 0x70b878, 0x2f6a45]], trunk: 0x6f4f3a },
};

/** Builds one variant of a species at unit scale (about 5.5 tall for broadleaves), near or far. */
function buildTree(kind, variant, near, fine = false) {
  const rnd = makeRandom(`tree-${kind}-${variant}-${near ? "n" : "f"}`);
  const S = SPECIES[kind];
  const leaves = S.leaves[variant % S.leaves.length];
  const parts = [];
  const detail = near ? (fine ? 2 : 1) : 0;
  const radial = near ? 8 : 5;
  if (kind === "pine") {
    const h = rnd.range(5.2, 6.6);
    parts.push(limb(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, h * 0.5, 0), 0.26, 0.16, radial, S.trunk, rnd));
    const layers = near ? 6 : 3;
    const cl = [], c0 = new THREE.Color(leaves[0]), c1 = new THREE.Color(leaves[1]);
    for (let k = 0; k < layers; k++) {
      const t = k / layers, r = (1 - t) * 1.9 + 0.35, y = 1.2 + t * (h - 1.6);
      const g = new THREE.ConeGeometry(r, (h - 1.2) / layers * 1.9, near ? 11 : 7, 1, true);
      // Droop the rim and ruffle it.
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, p.getY(i) - 0.12 + Math.sin(a * 5 + k) * 0.08); }
      g.computeVertexNormals();
      g.translate(0, y + (h - 1.2) / layers * 0.95, 0);
      g.rotateY(rnd.range(0, 6.28));
      cl.push(finish(g, (x, yy, z, nx, ny) => { _c.copy(c0).lerp(c1, Math.min(1, 0.2 + t * 0.5 + ny * 0.3)); _c.offsetHSL(0, 0, (rnd.next() - 0.5) * 0.04); return _c; }, [0.8, 0.018]));
    }
    parts.push(...cl);
  } else {
    const birch = kind === "birch";
    const h = birch ? rnd.range(3.4, 4.2) : rnd.range(2.3, 2.9);
    const lean = new THREE.Vector3(rnd.range(-0.2, 0.2), 0, rnd.range(-0.2, 0.2));
    const top = new THREE.Vector3(0, h, 0).add(lean);
    parts.push(limb(new THREE.Vector3(0, -0.25, 0), top, birch ? 0.2 : 0.34, birch ? 0.12 : 0.2, radial, S.trunk, rnd, birch));
    // Root flare.
    if (near && !birch) for (let k = 0; k < 4; k++) {
      const a = k * 1.57 + rnd.range(-0.3, 0.3);
      parts.push(limb(new THREE.Vector3(0, 0.45, 0), new THREE.Vector3(Math.cos(a) * 0.55, -0.1, Math.sin(a) * 0.55), 0.16, 0.05, 5, S.trunk, rnd));
    }
    // Branches fork from the top of the trunk into the canopy.
    const nb = near ? (birch ? 3 : 4) : 0;
    const tips = [];
    for (let k = 0; k < nb; k++) {
      const a = (k / nb) * Math.PI * 2 + rnd.range(-0.4, 0.4), out = birch ? rnd.range(0.7, 1.1) : rnd.range(1.1, 1.6);
      const from = new THREE.Vector3().lerpVectors(new THREE.Vector3(), top, rnd.range(0.7, 0.9));
      const to = new THREE.Vector3(Math.cos(a) * out, h + rnd.range(0.6, 1.2), Math.sin(a) * out).add(lean);
      parts.push(limb(from, to, birch ? 0.09 : 0.15, 0.06, 6, S.trunk, rnd, birch));
      tips.push(to);
    }
    // The canopy: a mass of clusters, wider for oaks, taller and airier for birches.
    const blobs = [];
    const cy = h + (birch ? 1.5 : 1.25), rw = birch ? 1.25 : 1.8, rh = birch ? 1.8 : 1.2;
    const n = near ? (birch ? 16 : 20) : 4;
    for (let k = 0; k < n; k++) {
      const u = rnd.range(0, Math.PI * 2), v = Math.acos(rnd.range(-0.55, 1)), d = near ? rnd.range(0.55, 1) : 0.45;
      const x = Math.cos(u) * Math.sin(v) * rw * d + lean.x, y = cy + Math.cos(v) * rh * d, z = Math.sin(u) * Math.sin(v) * rw * d + lean.z;
      blobs.push([x, y, z, near ? rnd.range(0.62, 0.98) * (birch ? 0.8 : 1) : (birch ? 1.1 : 1.45)]);
    }
    if (!near) blobs.push([lean.x, cy + 0.2, lean.z, birch ? 1.3 : 1.8]);
    for (const t of tips) if (near) blobs.push([t.x, t.y + 0.2, t.z, birch ? 0.7 : 0.85]);
    const fruit = kind === "apple";
    parts.push(canopy(blobs, new THREE.Vector3(lean.x, cy, lean.z), leaves, rnd, detail, h * 0.6, 0.03));
    if (fruit && near) {
      for (let k = 0; k < 26; k++) {
        const u = rnd.range(0, 6.28), v = Math.acos(rnd.range(-0.4, 0.9));
        const g = new THREE.IcosahedronGeometry(0.11, 1);
        g.translate(Math.cos(u) * Math.sin(v) * rw * 1.02 + lean.x, cy + Math.cos(v) * rh * 0.95, Math.sin(u) * Math.sin(v) * rw * 1.02 + lean.z);
        const red = rnd.chance(0.75);
        parts.push(finish(g, (x, y, z, nx, ny) => _c.setHex(red ? 0xd8352e : 0xf2c14e).offsetHSL(0, 0, ny * 0.08), [h * 0.6, 0.03]));
      }
    }
    if (kind === "cherry" && near) {
      // A few green leaves among the blossom.
      const gb = [];
      for (let k = 0; k < 5; k++) { const u = rnd.range(0, 6.28); gb.push([Math.cos(u) * rw * 0.7 + lean.x, cy - 0.5, Math.sin(u) * rw * 0.7 + lean.z, 0.5]); }
      parts.push(canopy(gb, new THREE.Vector3(lean.x, cy, lean.z), [0x6fb04e, 0x9cd26a, 0x5a9a44], rnd, 0, h * 0.6, 0.03));
    }
  }
  const g = mergeGeometries(parts);
  g.computeBoundingSphere();
  return g;
}

/** Where the forest stands: a wood all round on the hills, thickest in groves, thinning up the far slopes. */
export function forestSpots(count, sunDir = null) {
  const sunA = sunDir ? Math.atan2(sunDir.z, sunDir.x) : null;
  const rnd = makeRandom("forest-v1");
  const out = [];
  const grid = new Map();
  const tooClose = (x, z, d) => {
    const gx = Math.floor(x / 8), gz = Math.floor(z / 8);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of grid.get(`${gx + a},${gz + b}`) || []) if (Math.hypot(o.x - x, o.z - z) < d) return true;
    return false;
  };
  for (let t = 0; t < count * 12 && out.length < count; t++) {
    const u = rnd.next();
    const r = u < 0.78 ? 116 + Math.pow(rnd.next(), 1.3) * 125 : 238 + rnd.next() * 200;
    const a = rnd.range(0, Math.PI * 2);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    // Groves: dense where a broad noise is high, clearings where it is low.
    const g = Math.sin(x * 0.045 + 1.7) * Math.cos(z * 0.052 - 0.6) + 0.6 * Math.sin((x + z) * 0.023);
    if (g < -0.35 && rnd.chance(0.85)) continue;
    // A view corridor in front (the front meadow's far hills keep a clearing), and room for the stream and paths.
    if (z > 0 && Math.abs(x) < 26 && r < 190) continue;
    if (L.inWater(x, z, 4)) continue;
    if (L.nearPath(x, z, 3.5)) continue;
    // A gap in the wood where the sun hangs, so it shines over the hills rather than through trees.
    if (sunA !== null && r < 270 && Math.abs(Math.atan2(Math.sin(a - sunA), Math.cos(a - sunA))) < 0.2 + 12 / r) continue;
    const d = r < 240 ? rnd.range(4.2, 6.5) : rnd.range(6, 10);
    if (tooClose(x, z, d)) continue;
    const roll = rnd.next(), hgt = L.groundHeight(x, z);
    const kind = hgt > 18 || r > 250 ? (roll < 0.75 ? "pine" : roll < 0.9 ? "birch" : "oak") : roll < 0.4 ? "pine" : roll < 0.72 ? "oak" : roll < 0.9 ? "birch" : roll < 0.96 ? "cherry" : "apple";
    const s = rnd.range(1.3, 2.2) * (r > 240 ? 1.35 : 1);
    const spot = { x, z, s, kind, ry: rnd.range(0, 6.28), variant: rnd.int(0, 2) };
    out.push(spot);
    const k = `${Math.floor(x / 8)},${Math.floor(z / 8)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(spot);
  }
  return out;
}

/** Garden trees' species. */
const GARDEN_KINDS = { "gtree-1": "cherry", "gtree-2": "apple", "gtree-3": "cherry", "gtree-4": "birch", "gtree-5": "apple", "gtree-6": "oak", "gtree-7": "birch", "gtree-8": "oak", "gtree-9": "oak", "gtree-10": "apple", "gtree-11": "cherry" };

/** Every tree in the world, for the ground's contact shadows and for building. */
export function allTrees(q, sunDir = null) {
  const trees = [];
  const rnd = makeRandom("tree-variants");
  for (const t of L.GARDEN_TREES) trees.push({ x: t.x, z: t.z, s: t.s * 0.85, kind: GARDEN_KINDS[t.id] || "oak", variant: rnd.int(0, 2), ry: rnd.range(0, 6.28), garden: true });
  for (const t of L.MEADOW_TREES) trees.push({ x: t.x, z: t.z, s: t.s, kind: t.kind, variant: rnd.int(0, 2), ry: rnd.range(0, 6.28) });
  trees.push(...forestSpots(q.forest, sunDir));
  for (const t of trees) t.y = L.groundHeight(t.x, t.z) - 0.05;
  return trees;
}

/**
 * @param {THREE.Scene} scene
 * @param {object} o
 * @param {object} o.q        the quality tier
 * @param {Array} o.trees     allTrees(q)
 */
export function buildFlora(scene, { q, trees }) {
  const group = new THREE.Group();
  group.name = "trees";
  scene.add(group);
  const mat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.7 }), "attr");
  mat.shadowSide = THREE.BackSide; // closed shapes: casting from the back faces keeps the lit side free of acne
  const kinds = Object.keys(SPECIES);
  const VARIANTS = 3;
  // One mesh per species, variant and level of detail.
  const sets = new Map();
  for (const kind of kinds) for (let v = 0; v < VARIANTS; v++) {
    const list = trees.filter((t) => t.kind === kind && t.variant === v);
    if (!list.length) continue;
    const make = (near) => {
      const m = new THREE.InstancedMesh(buildTree(kind, v, near, q.tier === "high"), mat, list.length);
      m.count = 0;
      m.castShadow = near;
      m.receiveShadow = true;
      m.name = `trees ${kind} ${v} ${near ? "near" : "far"}`;
      group.add(m);
      return m;
    };
    sets.set(`${kind}-${v}`, { list, near: make(true), far: make(false) });
  }
  // A little colour per tree.
  const rnd = makeRandom("tree-tints");
  for (const t of trees) t.tint = new THREE.Color().setHSL(0, 0, 1).offsetHSL(rnd.range(-0.015, 0.015), rnd.range(-0.06, 0.04), rnd.range(-0.05, 0.04));

  /* Occluders (so the camera can avoid looking at a chosen cat through a tree) and blossom crowns (for the petals). */
  const occluders = [], blossoms = [];
  for (const t of trees) {
    if (Math.hypot(t.x, t.z) > 110) continue;
    const s = t.s;
    if (t.kind === "pine") occluders.push({ x: t.x, y: t.y + 3.4 * s, z: t.z, r: 1.6 * s });
    else occluders.push({ x: t.x, y: t.y + 3.9 * s, z: t.z, r: 2.0 * s }, { x: t.x, y: t.y + 1.2 * s, z: t.z, r: 0.45 * s });
    if (t.kind === "cherry" && Math.hypot(t.x, t.z) < 80) blossoms.push({ x: t.x, y: t.y + 3.8 * s, z: t.z, r: 1.8 * s, ground: t.y });
  }

  let last = new THREE.Vector3(1e9, 0, 0);
  function relod(eye, force = false) {
    if (!force && eye.distanceToSquared(last) < 9) return;
    last.copy(eye);
    for (const set of sets.values()) {
      let nn = 0, nf = 0;
      for (const t of set.list) {
        const d = Math.hypot(t.x - eye.x, t.z - eye.z);
        _m.compose(_v.set(t.x, t.y, t.z), _q.setFromAxisAngle(_y, t.ry), _s.setScalar(t.s));
        if (d < q.treeNear) { set.near.setMatrixAt(nn, _m); set.near.setColorAt(nn, t.tint); nn++; }
        else { set.far.setMatrixAt(nf, _m); set.far.setColorAt(nf, t.tint); nf++; }
      }
      for (const [m, n] of [[set.near, nn], [set.far, nf]]) {
        m.count = n;
        m.visible = n > 0;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.computeBoundingSphere();
      }
    }
  }

  return {
    group, occluders, blossoms,
    /** Re-sorts near and far trees when the camera has moved a few steps. */
    update(camera) { relod(camera.position); },
    relod: (p) => relod(p, true),
    count: trees.length,
  };
}

/** The soft contact shadow each tree throws on the ground (baked into the terrain). */
export function treeShade(trees) {
  return trees.map((t) => ({ x: t.x + 0.4 * t.s, z: t.z + 0.2 * t.s, r: (t.kind === "pine" ? 2.2 : 2.9) * t.s, k: 0.32 }));
}
