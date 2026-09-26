/* The garden round the cottage, built in code in the same low-poly style as the models, bright
   and warm by day: a wide lawn inside a cream picket fence and a clipped hedge, gravel paths with
   brick edging, then two meadow rings (with ring paths, benches, trees, flower fields, stone walls,
   a stream with footbridges and two more ponds) rolling away to wooded hills, a pond with lily
   pads, a kitchen garden with a glasshouse, a potting shed, rose arches, a bird bath, and the cats'
   own things (beds, bowls, water dishes, five cat trees, picnic blankets, big cushions, balls of yarn).

   The ground is terrain.js, the trees flora.js, the grass grass.js, the water water.js, the bigger
   structures scenery.js. Draw calls stay low on purpose: every static prop is merged (by sector,
   so the shadow pass and the camera can skip what is out of reach) into a few meshes with vertex
   colours, flowers are instanced by kind, the yarn is one instanced mesh. */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as L from "./layout.js";
import { makeRandom } from "./rng.js";
import { windify, shimmer } from "./ambient.js";
import { buildTerrain } from "./terrain.js";
import { addScenery } from "./scenery.js";

const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

/** Keeps just position + colour, flat per triangle, with a little colour jitter per face. */
function paint(geo, hex, rnd = null, jitter = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== "position") g.deleteAttribute(k);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const base = new THREE.Color(hex);
  for (let i = 0; i < n; i += 3) {
    _c.copy(base);
    if (rnd && jitter) _c.offsetHSL(rnd.range(-0.012, 0.012), rnd.range(-jitter, jitter) * 0.5, rnd.range(-jitter, jitter));
    for (let k = 0; k < 3 && i + k < n; k++) { col[(i + k) * 3] = _c.r; col[(i + k) * 3 + 1] = _c.g; col[(i + k) * 3 + 2] = _c.b; }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** Marks a geometry to sway in the wind: the push grows by k per unit of height above y0. */
function sway(g, y0, k) { g.userData.wind = [y0, k]; return g; }

/** Places a geometry: position, rotation (Euler, radians), scale. */
function place(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  return geo.applyMatrix4(_m);
}

const COLORS = {
  lawn: [0x86cc5c, 0x93d467, 0x7fc456, 0xa2da73],
  meadow: [0xa6d266, 0xb6d970, 0xc4dc78, 0x9ccb60],
  hill: [0x7cbf5f, 0x6db45b, 0x8cc567],
  far: [0x94bf96, 0x8ab79a, 0xa4c8a8],
  dirt: 0xc49a6c, stone: [0xdcd3c6, 0xcfc4b3, 0xe6ded2], rock: 0xb9ae9f,
  picket: 0xf8f1e4, rail: 0xeadcc4, wood: 0xb67d50, woodDark: 0x8d5d3a, soil: 0x7b5436,
  ceramic: 0xf3ece2, kibble: 0xa0663a, water: 0x6fc4e4, sisal: 0xe0c38f, carpet: 0x9d7fb5, board: 0xc99b6a,
  bush: [0x5eae4f, 0x6cba5a, 0x52a049], leaves: [0x68bd52, 0x7ac95c, 0x5caf4b, 0x86cf66], blossom: [0xf49ab8, 0xf7b2c8, 0xef8fb0],
  trunk: 0x8f6442, pine: [0x4f9a58, 0x5aa662, 0x468d50], cushion: 0xfff3e2, iron: 0x5b4a4f,
};

/** The ground's height at (x, z) (layout.js keeps it, so the meadow cats can stand on it too). */
const groundHeight = L.groundHeight;
export { groundHeight };

export function buildGarden(scene, { mobile = false, q, renderer, treeShade = [] } = {}) {
  const rnd = makeRandom("garden-layout-v2");
  const statics = [], glass = [], glows = [];
  const group = new THREE.Group();
  group.name = "garden";
  scene.add(group);
  const stones = L.pathStones();

  /* ── Stepping stones along every path ── */
  // (Inside the fence the main paths are gravel: stones only on the little side paths.)
  for (const s of stones) {
    if (Math.hypot(s.x, s.z) < L.GARDEN.fenceR + 0.8 && s.path !== 1 && s.path !== 2) continue;
    if (rectDist(s.x, s.z, L.HOUSE, 0) < 0.2) continue;
    const r = rnd.range(0.3, 0.4);
    const g = new THREE.CylinderGeometry(r * 0.92, r, 0.07, rnd.int(7, 9));
    place(g, s.x + rnd.range(-0.07, 0.07), 0.03 + groundHeight(s.x, s.z), s.z + rnd.range(-0.07, 0.07), 0, rnd.range(0, 3), 0, 1, 1, rnd.range(0.8, 0.95));
    statics.push(paint(g, rnd.pick(COLORS.stone), rnd, 0.04));
  }

  /* ── A cream picket fence all the way round, with gaps where the paths go out ── */
  const fencePosts = [];
  {
    const R = L.GARDEN.fenceR;
    const step = 1.35 / R;
    const pts = [];
    for (let a = 0; a < Math.PI * 2 - 1e-6; a += step) pts.push(a);
    const deg = (a) => (a * 180) / Math.PI;
    const P = (a) => [Math.cos(a) * R, Math.sin(a) * R];
    for (let i = 0; i < pts.length; i++) {
      const a0 = pts[i], a1 = pts[(i + 1) % pts.length] + (i === pts.length - 1 ? Math.PI * 2 : 0);
      const mid = (a0 + a1) / 2;
      const [x0, z0] = P(a0), [x1, z1] = P(a1);
      if (!L.inGate(deg(a0))) {
        statics.push(paint(place(new THREE.BoxGeometry(0.13, 0.9, 0.13), x0, 0.45, z0, 0, -a0, 0), COLORS.picket, rnd, 0.02));
        statics.push(paint(place(new THREE.ConeGeometry(0.11, 0.14, 4), x0, 0.97, z0, 0, Math.PI / 4 - a0, 0), COLORS.picket));
        fencePosts.push({ x: x0, y: 1.02, z: z0 });
      }
      if (L.inGate(deg(a0)) || L.inGate(deg(a1)) || L.inGate(deg(mid))) continue;
      const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(-(z1 - z0), x1 - x0);
      for (const y of [0.3, 0.62]) statics.push(paint(place(new THREE.BoxGeometry(len, 0.07, 0.045), (x0 + x1) / 2, y, (z0 + z1) / 2, 0, ang, 0), COLORS.rail));
      // Pickets between the posts, slightly outside the rails.
      const n = mobile ? 3 : 4;
      for (let k = 1; k <= n; k++) {
        const t = k / (n + 1), x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        const ox = Math.cos(mid) * 0.04, oz = Math.sin(mid) * 0.04;
        const h = 0.72;
        statics.push(paint(place(new THREE.BoxGeometry(0.1, h, 0.03), x + ox, h / 2, z + oz, 0, ang, 0), COLORS.picket));
        statics.push(paint(place(new THREE.ConeGeometry(0.072, 0.1, 4, 1), x + ox, h + 0.05, z + oz, 0, ang + Math.PI / 4, 0, 1, 1, 0.42), COLORS.picket));
      }
    }
    // A little arch over the front gate, with climbing roses.
    const gA = (L.GARDEN.gates[0][0] * Math.PI) / 180, gB = (L.GARDEN.gates[0][1] * Math.PI) / 180;
    const [ax, az] = P(gA), [bx, bz] = P(gB);
    for (const [x, z] of [[ax, az], [bx, bz]]) statics.push(paint(place(new THREE.BoxGeometry(0.16, 2.3, 0.16), x, 1.15, z), COLORS.picket));
    const archLen = Math.hypot(bx - ax, bz - az);
    const arch = new THREE.TorusGeometry(archLen / 2, 0.08, 4, 10, Math.PI);
    statics.push(paint(place(arch, (ax + bx) / 2, 2.3, (az + bz) / 2, 0, Math.atan2(-(bz - az), bx - ax), 0), COLORS.picket));
    for (let k = 0; k < 16; k++) {
      const t = rnd.range(0, Math.PI), x = (ax + bx) / 2 + Math.cos(t) * archLen / 2 * Math.sign(bx - ax), y = 2.3 + Math.sin(t) * archLen / 2;
      const z = (az + bz) / 2 + rnd.range(-0.12, 0.12);
      statics.push(paint(place(new THREE.IcosahedronGeometry(0.16, 0), x, y, z, rnd.range(0, 3), rnd.range(0, 3), 0), rnd.chance(0.45) ? 0xf07a8e : rnd.pick(COLORS.leaves), rnd, 0.04));
    }
  }

  /* ── Lantern posts by the stairs (unlit by day) ── */
  for (const l of L.LANTERNS) {
    statics.push(paint(place(new THREE.BoxGeometry(0.26, 0.12, 0.26), l.x, 0.06, l.z), COLORS.iron));
    statics.push(paint(place(new THREE.BoxGeometry(0.09, 1.52, 0.09), l.x, 0.76, l.z), COLORS.iron));
    statics.push(paint(place(new THREE.BoxGeometry(0.3, 0.04, 0.3), l.x, 1.6, l.z), COLORS.iron));
    statics.push(paint(place(new THREE.ConeGeometry(0.24, 0.18, 4), l.x, 2.04, l.z, 0, Math.PI / 4, 0), COLORS.iron));

  }

  /* ── Flower beds round the cottage, and the vegetable patch: timber boxes of soil ── */
  const box = (f, h = 0.22, wood = COLORS.wood) => {
    const w = f.maxX - f.minX, d = f.maxZ - f.minZ, cx = (f.minX + f.maxX) / 2, cz = (f.minZ + f.maxZ) / 2, t = 0.08;
    statics.push(paint(place(new THREE.BoxGeometry(w, h, t), cx, h / 2, f.minZ + t / 2), wood, rnd, 0.04));
    statics.push(paint(place(new THREE.BoxGeometry(w, h, t), cx, h / 2, f.maxZ - t / 2), wood, rnd, 0.04));
    statics.push(paint(place(new THREE.BoxGeometry(t, h, d - 2 * t), f.minX + t / 2, h / 2, cz), wood, rnd, 0.04));
    statics.push(paint(place(new THREE.BoxGeometry(t, h, d - 2 * t), f.maxX - t / 2, h / 2, cz), wood, rnd, 0.04));
    statics.push(paint(place(new THREE.BoxGeometry(w - 2 * t, h - 0.05, d - 2 * t), cx, (h - 0.05) / 2, cz), COLORS.soil, rnd, 0.04));
  };
  for (const f of L.FLOWER_BEDS) box(f);
  for (const f of L.VEG_BEDS) {
    box(f, 0.34, COLORS.woodDark);
    const top = 0.3, cz = (f.minZ + f.maxZ) / 2;
    for (let x = f.minX + 0.4; x < f.maxX - 0.3; x += f.crop === "cabbage" ? 0.62 : 0.34) {
      if (f.crop === "cabbage") {
        statics.push(paint(place(new THREE.IcosahedronGeometry(0.26, 1), x, top + 0.14, cz, rnd.range(0, 3), rnd.range(0, 3), 0, 1, 0.78, 1), 0x9fd07a, rnd, 0.05));
        for (let k = 0; k < 4; k++) statics.push(paint(place(new THREE.CircleGeometry(0.2, 5), x + Math.cos(k * 1.6) * 0.2, top + 0.06, cz + Math.sin(k * 1.6) * 0.2, -1.2, k * 1.6, 0), 0x6fb35a, rnd, 0.05));
      } else if (f.crop === "carrot") {
        for (const dz of [-0.22, 0.22]) {
          statics.push(paint(place(new THREE.ConeGeometry(0.05, 0.1, 5), x, top + 0.02, cz + dz, Math.PI), 0xf08a3a));
          for (let k = 0; k < 3; k++) statics.push(paint(place(new THREE.ConeGeometry(0.035, 0.34, 3), x + Math.cos(k * 2.1) * 0.05, top + 0.2, cz + dz + Math.sin(k * 2.1) * 0.05, Math.cos(k * 2.1) * 0.35, 0, Math.sin(k * 2.1) * 0.35), 0x5fb248, rnd, 0.05));
        }
      } else {
        const lavender = x < (f.minX + f.maxX) / 2;
        for (let k = 0; k < 5; k++) {
          const ox = rnd.range(-0.12, 0.12), oz = rnd.range(-0.3, 0.3), h = rnd.range(0.3, 0.46);
          statics.push(paint(place(new THREE.ConeGeometry(0.03, h, 3), x + ox, top + h / 2, cz + oz, rnd.range(-0.2, 0.2), 0, rnd.range(-0.2, 0.2)), lavender ? 0x6aa55a : 0x4f9460));
          if (lavender) statics.push(paint(place(new THREE.ConeGeometry(0.045, 0.14, 4), x + ox, top + h + 0.03, cz + oz), rnd.pick([0x9a7fd6, 0xb096e0, 0x8a6cc8])));
        }
      }
    }
  }
  // Sunflowers along the back of the patch, and a watering can.
  for (let k = 0; k < 6; k++) {
    const x = 5.6 + k * 0.95, z = -13.1 + rnd.range(-0.1, 0.1), h = rnd.range(1.9, 2.5);
    statics.push(sway(paint(place(new THREE.CylinderGeometry(0.04, 0.05, h, 5), x, h / 2, z), 0x5d9e45), 0, 0.03));
    for (const s of [-1, 1]) statics.push(sway(paint(place(new THREE.CircleGeometry(0.2, 5), x + s * 0.14, h * 0.55, z, 0, 0, s * 0.8), 0x6aa84f), 0, 0.03));
    statics.push(sway(paint(place(new THREE.CircleGeometry(0.36, 12), x, h, z + 0.04, -0.25, 0, 0), 0xf6c33a), 0, 0.03));
    statics.push(sway(paint(place(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), x, h, z + 0.07, Math.PI / 2 - 0.25, 0, 0), 0x7a4a24), 0, 0.03));
  }
  {
    const x = 11.4, z = -8.6;
    statics.push(paint(place(new THREE.CylinderGeometry(0.18, 0.2, 0.34, 10), x, 0.17, z), 0x6fb0d8));
    statics.push(paint(place(new THREE.CylinderGeometry(0.03, 0.045, 0.42, 6), x + 0.26, 0.28, z, 0, 0, -0.9), 0x6fb0d8));
    statics.push(paint(place(new THREE.TorusGeometry(0.12, 0.025, 4, 10, Math.PI), x - 0.02, 0.36, z, 0, Math.PI / 2, 0), 0x5a9cc4));
  }

  /* ── Cat beds: a round rim, a base and a cushion ── */
  for (const b of L.BEDS) {
    statics.push(paint(place(new THREE.CylinderGeometry(b.r - 0.02, b.r, 0.08, 16), b.x, 0.04, b.z), shade(b.color, -0.1), rnd, 0.03));
    statics.push(paint(place(new THREE.TorusGeometry(b.r - 0.14, 0.14, 6, 18), b.x, 0.16, b.z, Math.PI / 2, 0, 0, 1, 1, 0.85), b.color, rnd, 0.04));
    statics.push(paint(place(new THREE.CylinderGeometry(b.r - 0.2, b.r - 0.18, 0.1, 14), b.x, 0.07, b.z), COLORS.cushion, rnd, 0.03));
  }

  /* ── Nap piles: a checked picnic blanket (with a basket), a big cushion, a striped mat ── */
  for (const p of L.NAP_PILES) {
    if (p.kind === "cushion") {
      statics.push(paint(place(new THREE.CylinderGeometry(p.r, p.r * 1.02, 0.18, 20), p.x, 0.09, p.z), 0xf3c677, rnd, 0.03));
      statics.push(paint(place(new THREE.TorusGeometry(p.r - 0.06, 0.1, 5, 22), p.x, 0.16, p.z, Math.PI / 2, 0, 0, 1, 1, 0.7), 0xe9a94f, rnd, 0.03));
      continue;
    }
    const nx = p.kind === "blanket" ? 6 : 1, nz = p.kind === "blanket" ? 5 : 6;
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const w = p.w / nx, d = p.d / nz;
      const lx = -p.w / 2 + w * (i + 0.5), lz = -p.d / 2 + d * (k + 0.5);
      const c = Math.cos(p.rot), s = Math.sin(p.rot);
      const x = p.x + lx * c + lz * s, z = p.z - lx * s + lz * c;
      const col = p.kind === "blanket" ? ((i + k) % 2 ? 0xfff4e6 : 0xe8604c) : (k % 2 ? 0x7fb3d5 : 0xf6e7cf);
      statics.push(paint(place(new THREE.PlaneGeometry(w, d), x, p.y, z, -Math.PI / 2, 0, p.rot), col));
    }
    if (p.kind === "blanket") {
      const c = Math.cos(p.rot), s = Math.sin(p.rot), lx = p.w / 2 + 0.45, lz = -0.3;
      const x = p.x + lx * c + lz * s, z = p.z - lx * s + lz * c;
      statics.push(paint(place(new THREE.BoxGeometry(0.6, 0.34, 0.42), x, 0.17, z, 0, p.rot, 0), 0xc99a5b, rnd, 0.05));
      statics.push(paint(place(new THREE.TorusGeometry(0.22, 0.03, 4, 10, Math.PI), x, 0.34, z, 0, p.rot, 0), 0x9c7240));
      statics.push(paint(place(new THREE.IcosahedronGeometry(0.09, 0), x - 0.12, 0.38, z, 0, 0, 0), 0xe0443a));
      statics.push(paint(place(new THREE.IcosahedronGeometry(0.08, 0), x + 0.1, 0.37, z + 0.05, 0, 0, 0), 0x8bc34a));
    }
  }

  /* ── Food bowls and water dishes ── */
  const bowlShape = (r, h) => new THREE.LatheGeometry([new THREE.Vector2(r * 0.62, 0), new THREE.Vector2(r * 0.8, 0.01), new THREE.Vector2(r, h), new THREE.Vector2(r * 0.86, h), new THREE.Vector2(r * 0.7, 0.03), new THREE.Vector2(0.001, 0.03)], 12);
  L.BOWLS.forEach((b, i) => {
    statics.push(paint(place(bowlShape(b.r * 0.9, 0.11), b.x, 0, b.z), COLORS.ceramic, rnd, 0.02));
    statics.push(paint(place(new THREE.TorusGeometry(b.r * 0.9, 0.015, 4, 14), b.x, 0.09, b.z, Math.PI / 2), [0xe4574a, 0x4f86d9, 0xf3b73b][i % 3]));
    for (let k = 0; k < 7; k++) {
      const a = rnd.range(0, 6.28), rr = rnd.range(0, b.r * 0.45);
      statics.push(paint(place(new THREE.IcosahedronGeometry(0.045, 0), b.x + Math.cos(a) * rr, 0.07, b.z + Math.sin(a) * rr, rnd.range(0, 3), rnd.range(0, 3), 0), COLORS.kibble, rnd, 0.06));
    }
  });
  const waterDiscs = [];
  for (const w of L.WATERS) {
    statics.push(paint(place(bowlShape(w.r * 0.95, 0.09), w.x, 0, w.z), 0xd6e6ee, rnd, 0.02));
    waterDiscs.push(place(new THREE.CircleGeometry(w.r * 0.78, 14), w.x, 0.072, w.z, -Math.PI / 2));
  }

  /* ── Cat trees: base board, two sisal posts, two carpeted platforms ── */
  for (const T of L.TREES) {
    const b = T.base, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    statics.push(paint(place(new THREE.BoxGeometry(b.maxX - b.minX, 0.12, b.maxZ - b.minZ), cx, 0.06, cz), COLORS.carpet, rnd, 0.03));
    for (const p of [T.low, T.high]) {
      const h = p.y - 0.1 - 0.12;
      statics.push(paint(place(new THREE.CylinderGeometry(0.11, 0.11, h, 8), p.x, 0.12 + h / 2, p.z), COLORS.sisal, rnd, 0.05));
      for (let y = 0.2; y < 0.12 + h - 0.05; y += 0.16) statics.push(paint(place(new THREE.TorusGeometry(0.115, 0.012, 3, 8), p.x, y, p.z, Math.PI / 2), shade(COLORS.sisal, -0.07)));
      statics.push(paint(place(new THREE.CylinderGeometry(p.r, p.r, 0.1, 14), p.x, p.y - 0.05, p.z), COLORS.carpet, rnd, 0.03));
    }
    statics.push(paint(place(new THREE.BoxGeometry(0.012, 0.42, 0.012), T.high.x + 0.36, T.high.y - 0.31, T.high.z - 0.2), 0xe6d7bf));
    statics.push(paint(place(new THREE.IcosahedronGeometry(0.07, 0), T.high.x + 0.36, T.high.y - 0.55, T.high.z - 0.2), 0xe07a5f));
  }

  /* ── The bird bath ── */
  {
    const B = L.BIRD_BATH;
    statics.push(paint(place(new THREE.LatheGeometry([new THREE.Vector2(0.3, 0), new THREE.Vector2(0.24, 0.08), new THREE.Vector2(0.1, 0.2), new THREE.Vector2(0.08, 0.75), new THREE.Vector2(0.14, 0.85), new THREE.Vector2(0.001, 0.85)], 10), B.x, 0, B.z), 0xe2dbd0, rnd, 0.02));
    statics.push(paint(place(new THREE.LatheGeometry([new THREE.Vector2(0.001, 0.82), new THREE.Vector2(0.3, 0.86), new THREE.Vector2(0.44, 0.98), new THREE.Vector2(0.4, 0.99), new THREE.Vector2(0.26, 0.9), new THREE.Vector2(0.001, 0.9)], 14), B.x, 0, B.z), 0xe8e1d6, rnd, 0.02));
    waterDiscs.push(place(new THREE.CircleGeometry(0.37, 14), B.x, 0.95, B.z, -Math.PI / 2));
  }

  /* ── The pond: stones round the edge, lily pads and flowers, reeds, a bench ── */
  {
    const P = L.POND;
    const n = 30;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd.range(-0.05, 0.05), d = P.r + rnd.range(0.05, 0.2);
      const s = rnd.range(0.2, 0.34);
      statics.push(paint(place(new THREE.DodecahedronGeometry(s, 0), P.x + Math.cos(a) * d, s * 0.25, P.z + Math.sin(a) * d, rnd.range(0, 3), rnd.range(0, 3), 0, 1, 0.55, 1), rnd.pick(COLORS.stone), rnd, 0.05));
    }
    for (let k = 0; k < 11; k++) {
      const a = rnd.range(0, Math.PI * 2), d = Math.sqrt(rnd.next()) * (P.r - 0.6);
      const r = rnd.range(0.26, 0.42), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
      const pad = new THREE.CircleGeometry(r, 9, 0.35, Math.PI * 2 - 0.5);
      statics.push(paint(place(pad, x, -0.02, z, -Math.PI / 2, 0, rnd.range(0, 6.28)), rnd.pick([0x5fae4f, 0x6fbf5a, 0x58a54a]), rnd, 0.04));
      if (k % 3 === 0) {
        for (let p = 0; p < 6; p++) statics.push(paint(place(new THREE.ConeGeometry(0.06, 0.16, 3), x + Math.cos(p) * 0.06, 0.05, z + Math.sin(p) * 0.06, Math.cos(p) * 0.6, 0, -Math.sin(p) * 0.6), p % 2 ? 0xf7b8cf : 0xfde6ef));
        statics.push(paint(place(new THREE.IcosahedronGeometry(0.04, 0), x, 0.07, z), 0xf6d04d));
      }
    }
    for (let k = 0; k < 16; k++) {
      const a = rnd.range(2.3, 3.9), d = P.r + rnd.range(0.1, 0.5);
      const x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d, h = rnd.range(0.7, 1.3);
      statics.push(paint(place(new THREE.BoxGeometry(0.035, h, 0.035), x, h / 2, z, rnd.range(-0.1, 0.1), 0, rnd.range(-0.1, 0.1)), 0x6a9e48));
      if (k % 2 === 0) statics.push(paint(place(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 5), x, h - 0.05, z), 0x8a5a34));
    }
    // A bench looking over the water.
    const bx = -14.9, bz = 10.2, ry = 0.95;
    statics.push(paint(place(new THREE.BoxGeometry(1.8, 0.08, 0.5), bx, 0.5, bz, 0, ry, 0), COLORS.wood, rnd, 0.04));
    statics.push(paint(place(new THREE.BoxGeometry(1.8, 0.4, 0.07), bx - Math.sin(ry) * 0.24, 0.78, bz - Math.cos(ry) * 0.24, -0.15, ry, 0), COLORS.wood, rnd, 0.04));
    for (const s of [-0.75, 0.75]) statics.push(paint(place(new THREE.BoxGeometry(0.08, 0.5, 0.46), bx + Math.cos(ry) * s, 0.25, bz - Math.sin(ry) * s, 0, ry, 0), COLORS.woodDark));
  }

  /* ── The second pond, out in the first meadow ring: stones, lily pads, reeds, a little jetty ── */
  {
    const P = L.POND2;
    const n = 38;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd.range(-0.05, 0.05), d = P.r + rnd.range(0.05, 0.25);
      const s2 = rnd.range(0.22, 0.38);
      statics.push(paint(place(new THREE.DodecahedronGeometry(s2, 0), P.x + Math.cos(a) * d, s2 * 0.25, P.z + Math.sin(a) * d, rnd.range(0, 3), rnd.range(0, 3), 0, 1, 0.55, 1), rnd.pick(COLORS.stone), rnd, 0.05));
    }
    for (let k = 0; k < 14; k++) {
      const a = rnd.range(0, Math.PI * 2), d = Math.sqrt(rnd.next()) * (P.r - 0.7);
      const r = rnd.range(0.28, 0.46), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
      statics.push(paint(place(new THREE.CircleGeometry(r, 9, 0.35, Math.PI * 2 - 0.5), x, -0.02, z, -Math.PI / 2, 0, rnd.range(0, 6.28)), rnd.pick([0x5fae4f, 0x6fbf5a, 0x58a54a]), rnd, 0.04));
      if (k % 3 === 1) {
        for (let q = 0; q < 6; q++) statics.push(paint(place(new THREE.ConeGeometry(0.06, 0.16, 3), x + Math.cos(q) * 0.06, 0.05, z + Math.sin(q) * 0.06, Math.cos(q) * 0.6, 0, -Math.sin(q) * 0.6), q % 2 ? 0xfff4dc : 0xf7b8cf));
        statics.push(paint(place(new THREE.IcosahedronGeometry(0.04, 0), x, 0.07, z), 0xf6d04d));
      }
    }
    for (let k = 0; k < 22; k++) {
      const a = rnd.range(-0.9, 1.3), d = P.r + rnd.range(0.1, 0.55);
      const x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d, h = rnd.range(0.7, 1.4);
      statics.push(sway(paint(place(new THREE.BoxGeometry(0.035, h, 0.035), x, h / 2, z, rnd.range(-0.1, 0.1), 0, rnd.range(-0.1, 0.1)), 0x6a9e48), 0, 0.04));
      if (k % 2 === 0) statics.push(sway(paint(place(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 5), x, h - 0.05, z), 0x8a5a34), 0, 0.04));
    }
    // A little wooden jetty out over the water from the path's end.
    const jx = P.x - P.r - 0.2, jz = P.z + 0.4;
    for (let k = 0; k < 6; k++) statics.push(paint(place(new THREE.BoxGeometry(0.34, 0.06, 1.2), jx + 0.1 + k * 0.36, 0.2, jz), COLORS.wood, rnd, 0.06));
    for (const [dx, dz] of [[0, -0.55], [0, 0.55], [1.8, -0.55], [1.8, 0.55]]) statics.push(paint(place(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 5), jx + dx + 0.1, 0.1, jz + dz), COLORS.woodDark));
  }

  /* ── The Hall of Fame plaza: paving, a fountain with a gold coin on a pedestal, lamps, low hedges ── */
  {
    const H = L.HALL_OF_FAME, F = H.fountain;
    // Paving: rings of warm stone slabs round the fountain, and a gold-edged border.
    for (let rr = F.r + 0.2; rr < H.r; rr += 0.62) {
      const n = Math.max(8, Math.round((2 * Math.PI * rr) / 0.72));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rr;
        statics.push(paint(place(new THREE.BoxGeometry(0.66, 0.08, 0.56), H.x + Math.cos(a) * rr, 0.04, H.z + Math.sin(a) * rr, 0, -a, 0), rnd.pick([0xeadfcb, 0xe2d4bb, 0xf1e7d6]), rnd, 0.03));
      }
    }
    statics.push(paint(place(new THREE.CylinderGeometry(H.r + 0.05, H.r + 0.15, 0.06, 64), H.x, 0.02, H.z), 0xd8c9ae));
    statics.push(paint(place(new THREE.TorusGeometry(H.r, 0.09, 4, 72), H.x, 0.09, H.z, Math.PI / 2), 0xd9a832));
    // The fountain: a round basin, its rim, a pedestal and a big gold coin with a cat's face on top.
    statics.push(paint(place(new THREE.CylinderGeometry(F.r, F.r + 0.1, 0.55, 32, 1, true), F.x, 0.28, F.z), 0xcfc3ae));
    statics.push(paint(place(new THREE.TorusGeometry(F.r, 0.14, 6, 40), F.x, 0.56, F.z, Math.PI / 2), 0xe8ddc9));
    statics.push(paint(place(new THREE.CylinderGeometry(0.36, 0.5, 1.5, 12), F.x, 0.75, F.z), 0xe6dccb));
    statics.push(paint(place(new THREE.CylinderGeometry(0.62, 0.45, 0.22, 16), F.x, 1.55, F.z), 0xd9cbb2));
    const coinY = 2.45;
    const faceYaw = Math.atan2(-F.x, -F.z); // the coin faces the cottage
    {
      // A coin standing on edge: build it at the origin, turn it, then move it.
      const parts = [
        paint(new THREE.CylinderGeometry(0.75, 0.75, 0.16, 32).rotateX(Math.PI / 2), 0xf5c542),
        paint(new THREE.TorusGeometry(0.66, 0.05, 4, 32).translate(0, 0, 0.09), 0xd49b1f),
        paint(new THREE.TorusGeometry(0.66, 0.05, 4, 32).translate(0, 0, -0.09), 0xd49b1f),
        // Two ears and a nose, embossed on both faces.
        ...[1, -1].flatMap((sd) => [
          paint(new THREE.ConeGeometry(0.14, 0.24, 3).translate(-0.25, 0.32, 0.1 * sd), 0xe3ad2a),
          paint(new THREE.ConeGeometry(0.14, 0.24, 3).translate(0.25, 0.32, 0.1 * sd), 0xe3ad2a),
          paint(new THREE.SphereGeometry(0.07, 8, 6).translate(0, -0.05, 0.1 * sd), 0xe3ad2a),
          paint(new THREE.SphereGeometry(0.06, 8, 6).translate(-0.2, 0.08, 0.1 * sd), 0x6a4a00),
          paint(new THREE.SphereGeometry(0.06, 8, 6).translate(0.2, 0.08, 0.1 * sd), 0x6a4a00),
        ]),
      ];
      for (const q of parts) statics.push(q.rotateY(faceYaw).translate(F.x, coinY, F.z));
    }
    // Lamp posts round the edge, and low flowering hedges between them (open towards the cottage).
    const toGarden = Math.atan2(-H.z, -H.x);
    for (let k = 0; k < 8; k++) {
      const a = toGarden + Math.PI / 8 + (k * Math.PI) / 4;
      const lx = H.x + Math.cos(a) * (H.r + 0.35), lz = H.z + Math.sin(a) * (H.r + 0.35), y0 = groundHeight(lx, lz);
      statics.push(paint(place(new THREE.BoxGeometry(0.1, 2.0, 0.1), lx, y0 + 1.0, lz), COLORS.iron));
      glows.push(place(new THREE.BoxGeometry(0.24, 0.3, 0.24), lx, y0 + 2.1, lz));
      statics.push(paint(place(new THREE.ConeGeometry(0.24, 0.18, 4), lx, y0 + 2.33, lz, 0, Math.PI / 4, 0), COLORS.iron));
    }
    for (let k = 0; k < 64; k++) {
      const a = toGarden + (k / 64) * Math.PI * 2;
      const off = Math.abs(Math.atan2(Math.sin(a - toGarden), Math.cos(a - toGarden)));
      if (off < 0.5 || Math.abs(off - Math.PI) < 0.25) continue; // the entrance by the sign, and one at the back
      if (k % 8 === 4) continue; // room for the lamps
      const hx = H.x + Math.cos(a) * (H.r + 0.9), hz = H.z + Math.sin(a) * (H.r + 0.9), y0 = groundHeight(hx, hz);
      statics.push(sway(paint(place(new THREE.IcosahedronGeometry(0.44, 1), hx, y0 + 0.34, hz, rnd.range(0, 3), rnd.range(0, 3), 0, 1, 0.82, 1), rnd.pick([0x62ad4c, 0x6bb553, 0x5aa447]), rnd, 0.04), y0, 0.03));
      if (k % 3 === 0) statics.push(paint(place(new THREE.IcosahedronGeometry(0.08, 0), hx, y0 + 0.66, hz), rnd.pick([0xf29bb2, 0xf6d04d, 0xfff4dc])));
    }
  }

  /* ── Benches along the ring paths ── */
  for (const b of L.BENCHES) {
    const y0 = groundHeight(b.x, b.z), ry = b.yaw;
    statics.push(paint(place(new THREE.BoxGeometry(1.8, 0.08, 0.5), b.x, y0 + 0.5, b.z, 0, ry, 0), COLORS.wood, rnd, 0.04));
    statics.push(paint(place(new THREE.BoxGeometry(1.8, 0.4, 0.07), b.x - b.faceX * 0.24, y0 + 0.78, b.z - b.faceZ * 0.24, 0, ry, 0), COLORS.wood, rnd, 0.04));
    for (const s2 of [-0.75, 0.75]) statics.push(paint(place(new THREE.BoxGeometry(0.08, 0.5, 0.46), b.x + Math.cos(ry) * s2, y0 + 0.25, b.z - Math.sin(ry) * s2, 0, ry, 0), COLORS.woodDark));
    // A lamp post beside each bench, and a pot of flowers.
    const lx = b.x + Math.cos(ry) * 1.35, lz = b.z - Math.sin(ry) * 1.35;
    statics.push(paint(place(new THREE.BoxGeometry(0.08, 1.8, 0.08), lx, y0 + 0.9, lz), COLORS.iron));
    glows.push(place(new THREE.BoxGeometry(0.2, 0.26, 0.2), lx, y0 + 1.9, lz));
    statics.push(paint(place(new THREE.ConeGeometry(0.2, 0.16, 4), lx, y0 + 2.1, lz, 0, Math.PI / 4, 0), COLORS.iron));
    const px = b.x - Math.cos(ry) * 1.3, pz = b.z + Math.sin(ry) * 1.3;
    statics.push(paint(place(new THREE.CylinderGeometry(0.26, 0.2, 0.36, 8), px, y0 + 0.18, pz), 0xc9704a, rnd, 0.04));
    for (let k = 0; k < 7; k++) statics.push(paint(place(new THREE.IcosahedronGeometry(0.09, 0), px + rnd.range(-0.16, 0.16), y0 + 0.42 + rnd.range(0, 0.12), pz + rnd.range(-0.16, 0.16)), rnd.pick([0xf07aa0, 0xfff4dc, 0xf8cf4a, 0xc9a6f0])));
  }

  {
    const cols = [];
    for (const d of waterDiscs) {
      d.deleteAttribute("uv");
      const n = d.attributes.position.count;
      const col = new Float32Array(n * 3);
      _c.setHex(COLORS.water);
      for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3);
      d.setAttribute("color", new THREE.BufferAttribute(col, 3));
      cols.push(d);
    }
    const water = new THREE.Mesh(mergeGeometries(cols), shimmer(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.0, envMapIntensity: 1.2 })));
    water.name = "water dishes";
    water.receiveShadow = true;
    group.add(water);
  }

  /* ── Bushes, trees, groves and far woods ── */
  const bushAt = (x, z, r, flowers = false) => {
    const n = rnd.int(3, 5), y0 = groundHeight(x, z);
    for (let k = 0; k < n; k++) {
      const a = rnd.range(0, 6.28), d = rnd.range(0, r * 0.45), s = r * rnd.range(0.5, 0.75);
      const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
      statics.push(sway(paint(place(new THREE.IcosahedronGeometry(1, 0), bx, y0 + s * 0.7, bz, rnd.range(0, 3), rnd.range(0, 3), 0, s, s * 0.85, s), rnd.pick(COLORS.bush), rnd, 0.05), y0, 0.05));
      if (flowers) for (let f = 0; f < 4; f++) {
        const fa = rnd.range(0, 6.28), fy = rnd.range(0.2, 1);
        statics.push(sway(paint(place(new THREE.IcosahedronGeometry(0.08, 0), bx + Math.cos(fa) * s * 0.85, y0 + s * 0.7 + fy * s * 0.6, bz + Math.sin(fa) * s * 0.85), flowers, rnd, 0.03), y0, 0.05));
      }
    }
  };
  for (const b of L.BUSHES) bushAt(b.x, b.z, b.r, rnd.chance(0.6) ? rnd.pick([0xf29bb2, 0xfbe3ea, 0xf6d04d]) : false);
  // Rocks in the grass just outside the fence.
  for (let k = 0; k < 16; k++) {
    const a = rnd.range(0, Math.PI * 2), r = rnd.range(L.GARDEN.fenceR + 3, 44);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (L.nearPath(x, z, 1.5)) continue;
    statics.push(paint(place(new THREE.DodecahedronGeometry(rnd.range(0.2, 0.5), 0), x, 0.08 + groundHeight(x, z), z, rnd.range(0, 3), rnd.range(0, 3), 0, 1, 0.6, 1), COLORS.rock, rnd, 0.05));
  }
  for (const b of L.MEADOW_BUSHES) bushAt(b.x, b.z, b.r, b.flowers ?? false);

  /* ── The bigger pieces: glasshouse, shed, rose arches, benches, hedge, edging, walls, bridges, the third pond ── */
  const scenery = addScenery({ statics, glass, glows, paint, place, sway, group, q });

  /* ── One mesh for everything above ── */
  // Near the garden, cut into sectors so the sun's shadow pass (which follows the view) and the
  // camera can skip what is out of reach; everything further out is one mesh with no shadow.
  const SECTORS = 12;
  const near = [], mid = Array.from({ length: SECTORS }, () => []), far = [];
  const shadeBlobs = [...treeShade]; // soft contact shadows baked into the ground under the props
  for (const g of statics) {
    const p = g.attributes.position, w = new Float32Array(p.count);
    if (g.userData.wind) { const [y0, k] = g.userData.wind; for (let i = 0; i < p.count; i++) w[i] = Math.max(0, p.getY(i) - y0) * k; }
    g.setAttribute("aWind", new THREE.BufferAttribute(w, 1));
    g.computeBoundingSphere();
    const c = g.boundingSphere.center, rs = g.boundingSphere.radius;
    const rc = Math.hypot(c.x, c.z);
    if (rc < L.GARDEN.fenceR + 3) near.push(g);
    else if (rc < 118) mid[Math.floor(((Math.atan2(c.z, c.x) + Math.PI) / (Math.PI * 2)) * SECTORS) % SECTORS].push(g);
    else far.push(g);
    // Anything standing up (not flat on the ground) shades the grass round its foot a little.
    if (rs > 0.25 && rs < 4 && c.y - groundHeight(c.x, c.z) < 2.5) shadeBlobs.push({ x: c.x, z: c.z, r: rs * 1.25 + 0.2, k: 0.12 });
  }
  const propsMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.78, metalness: 0, envMapIntensity: 0.6 }), "attr");
  const propsMesh = new THREE.Mesh(mergeGeometries(near), propsMat);
  propsMesh.castShadow = true;
  propsMesh.receiveShadow = true;
  propsMesh.name = "props";
  group.add(propsMesh);
  mid.forEach((list, i) => {
    if (!list.length) return;
    const m = new THREE.Mesh(mergeGeometries(list), propsMat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = `meadow props ${i + 1}`;
    group.add(m);
  });
  if (far.length) {
    const farMesh = new THREE.Mesh(mergeGeometries(far), propsMat);
    farMesh.name = "far props";
    group.add(farMesh);
  }
  statics.forEach((g) => g.dispose());
  // Glass (the glasshouse, the shed's window) and the lamps' glowing glass.
  const posOnly = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== "position") n.deleteAttribute(k); return n; };
  {
    const m = new THREE.Mesh(mergeGeometries(glass.map(posOnly)), new THREE.MeshStandardMaterial({ color: 0xe6f4f6, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.32, flatShading: true, side: THREE.DoubleSide, envMapIntensity: 1.6, depthWrite: false }));
    m.name = "glass";
    m.renderOrder = 2;
    group.add(m);
    const lit = new THREE.Mesh(mergeGeometries(glows.map(posOnly)), new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffc070, emissiveIntensity: 1.6, flatShading: true, roughness: 0.4 }));
    lit.name = "lamp glass";
    group.add(lit);
  }
  // More contact shade: the cottage, the glasshouse and shed, the hedge and the walls.
  shadeBlobs.push({ rect: L.HOUSE, x: 0, z: 0, r: 1.8, k: 0.35 }, { rect: L.SHED, x: (L.SHED.minX + L.SHED.maxX) / 2, z: (L.SHED.minZ + L.SHED.maxZ) / 2, r: 1.2, k: 0.3 }, { rect: L.GREENHOUSE, x: (L.GREENHOUSE.minX + L.GREENHOUSE.maxX) / 2, z: (L.GREENHOUSE.minZ + L.GREENHOUSE.maxZ) / 2, r: 0.8, k: 0.15 });
  for (let a = 0; a < 360; a += 3) { const r = L.GARDEN.fenceR + 1.5, t = (a * Math.PI) / 180; if (!L.inGate(a)) shadeBlobs.push({ x: Math.cos(t) * r, z: Math.sin(t) * r, r: 1.5, k: 0.25 }); }
  for (const w of L.WALLS) for (let i = 0; i < w.length - 1; i++) {
    const [ax, az] = w[i], [bx, bz] = w[i + 1], len = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t < len; t += 1.2) shadeBlobs.push({ x: ax + ((bx - ax) * t) / len, z: az + ((bz - az) * t) / len, r: 1.3, k: 0.22 });
  }

  /* ── The ground (terrain.js), with those contact shadows baked in ── */
  const tT = performance.now();
  const terrain = buildTerrain(group, { renderer, q, shade: shadeBlobs });
  terrain.ms = performance.now() - tT;

  /** True where something stands on the lawn (no grass or flowers there). */
  const blocked = (x, z, pad = 0.12) => {
    const r = Math.hypot(x, z);
    if (Math.abs(r - L.GARDEN.fenceR) < 0.25) return true;
    if (Math.abs(r - L.GARDEN.fenceR - 1.5) < 0.6 && !L.inGate((Math.atan2(z, x) * 180) / Math.PI)) return true; // the hedge
    if (rectDist(x, z, L.HOUSE, 0) < pad + 0.15) return true;
    if (L.inWater(x, z, 0.35) || L.inHall(x, z, 1.4)) return true;
    if (r > L.GARDEN.fenceR + 1) {
      if (onStone(x, z, pad)) return true;
      return false;
    }
    for (const o of obstacleGrid.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`) || []) if (o.type === "rect" ? rectDist(x, z, o, 0) < pad : Math.hypot(x - o.x, z - o.z) < o.r + pad) return true;
    for (const p of L.NAP_PILES) if (Math.hypot(x - p.x, z - p.z) < (p.r || Math.max(p.w, p.d) / 2) + pad) return true;
    if (onStone(x, z, pad)) return true;
    return false;
  };
  // The stepping stones by 2-unit cell.
  const stoneGrid = new Map();
  for (const st of stones) { const k = `${Math.floor(st.x / 2)},${Math.floor(st.z / 2)}`; if (!stoneGrid.has(k)) stoneGrid.set(k, []); stoneGrid.get(k).push(st); }
  const onStone = (x, z, pad) => {
    const gx = Math.floor(x / 2), gz = Math.floor(z / 2);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const st of stoneGrid.get(`${gx + a},${gz + b}`) || []) if (Math.hypot(x - st.x, z - st.z) < 0.44 + pad) return true;
    return false;
  };
  // The garden's obstacles filed by 4-unit cell (each under every cell it reaches, with room for the pad).
  const obstacleGrid = new Map();
  for (const o of L.obstacles()) {
    if (o.id === "house") continue;
    const [x0, x1, z0, z1] = o.type === "rect" ? [o.minX, o.maxX, o.minZ, o.maxZ] : [o.x - o.r, o.x + o.r, o.z - o.r, o.z + o.r];
    for (let gx = Math.floor((x0 - 0.5) / 4); gx <= Math.floor((x1 + 0.5) / 4); gx++) for (let gz = Math.floor((z0 - 0.5) / 4); gz <= Math.floor((z1 + 0.5) / 4); gz++) {
      const k = `${gx},${gz}`;
      if (!obstacleGrid.has(k)) obstacleGrid.set(k, []);
      obstacleGrid.get(k).push(o);
    }
  }
  const occupied = (x, z) => L.nearPath(x, z, 1.2) || L.nearWall(x, z, 1.2);

  /* ── Flowers: many kinds, in the beds round the cottage, dotted over the lawn and in whole fields outside the fence ──
     Each kind of flower head is one instanced mesh; the stems are one more. */
  const flowerSpots = [];
  {
    const HEADS = flowerHeads();
    const mixed = [0xf07aa0, 0xc9a6f0, 0xfff4dc, 0xf8cf4a, 0xf2865e, 0xa9cdf5, 0xf7b3c9];
    const spots = [];
    const add = (x, z, y, h, col, sc, kind) => spots.push([x, z, y, h, col, sc, kind]);
    const bedKinds = ["star", "cup", "cup", "spike", "daisy", "star"];
    for (const f of L.FLOWER_BEDS) {
      const area = (f.maxX - f.minX) * (f.maxZ - f.minZ);
      for (let k = 0; k < Math.round(area * 34 * q.flowers); k++) {
        const kind = rnd.pick(bedKinds);
        add(rnd.range(f.minX + 0.12, f.maxX - 0.12), rnd.range(f.minZ + 0.12, f.maxZ - 0.12), 0.18, rnd.range(0.2, 0.4), kind === "cup" ? rnd.pick([0xe8384a, 0xf6c33a, 0xf07aa0, 0xfff4dc]) : kind === "spike" ? rnd.pick([0x9a7fd6, 0xf29bb2]) : rnd.pick(mixed), 1, kind);
      }
    }
    // Wildflower clumps on the lawn, away from where cats walk most.
    for (let k = 0; k < Math.round(260 * q.flowers); k++) {
      const r = Math.sqrt(rnd.next()) * (L.GARDEN.fenceR - 1) + 1, a = rnd.range(0, Math.PI * 2);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (blocked(x, z, 0.3) || L.nearPath(x, z, 0.9)) continue;
      const kind = rnd.pick(["star", "daisy", "daisy", "star", "cup"]), col = kind === "daisy" ? rnd.pick([0xffffff, 0xfff4f0, 0xfbd3e0]) : rnd.pick(mixed);
      for (let c = 0; c < rnd.int(2, 6); c++) add(x + rnd.range(-0.3, 0.3), z + rnd.range(-0.3, 0.3), 0, rnd.range(0.12, 0.24), col, 0.85, kind);
    }
    // Wildflowers dotted through the meadow rings.
    for (let k = 0; k < Math.round(620 * q.flowers); k++) {
      const r = rnd.range(L.MEADOW.ring1.inner - 3, L.MEADOW.ring2.outer + 6), a = rnd.range(0, Math.PI * 2);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (blocked(x, z, 0.3) || occupied(x, z)) continue;
      const kind = rnd.pick(["star", "daisy", "cup", "spike", "star", "daisy"]);
      const col = kind === "daisy" ? 0xffffff : kind === "spike" ? rnd.pick([0x9a7fd6, 0x7c8fe0, 0xf29bb2]) : rnd.pick(mixed);
      for (let c = 0; c < rnd.int(3, 7); c++) { const fx = x + rnd.range(-0.5, 0.5), fz = z + rnd.range(-0.5, 0.5); add(fx, fz, groundHeight(fx, fz), rnd.range(0.2, 0.38), col, 1, kind); }
    }
    // Flower fields: lavender, poppies, buttercups, cornflowers, daisies, pinks and mixed ones.
    const FIELDS = {
      lavender: [["spike", [0x9a7fd6, 0xb096e0, 0x8a6cc8]]],
      poppy: [["cup", [0xe8503f, 0xf06a4d, 0xd94436]], ["daisy", [0xffffff]]],
      buttercup: [["star", [0xf8d34a, 0xfbe07a, 0xffe680]]],
      cornflower: [["star", [0x5a7fe0, 0x6f8ff0, 0x4a6fd0]], ["daisy", [0xffffff]]],
      daisy: [["daisy", [0xffffff, 0xfff6f0]], ["star", [0xf8d34a]]],
      pink: [["star", [0xf7b3c9, 0xfff4dc]], ["cup", [0xf07aa0, 0xf8cf4a]], ["spike", [0xc9a6f0]]],
      mixed: [["star", mixed], ["cup", [0xe8503f, 0xf6c33a]], ["spike", [0x9a7fd6]], ["daisy", [0xffffff]]],
    };
    for (const f of L.FLOWER_FIELDS) {
      const kinds = FIELDS[f.cols] || FIELDS.mixed;
      const n = Math.round(f.n * q.flowers);
      for (let k = 0; k < n; k++) {
        const a = rnd.range(0, Math.PI * 2), d = Math.sqrt(rnd.next());
        const x = f.x + Math.cos(a) * d * f.rx, z = f.z + Math.sin(a) * d * f.rz;
        if (Math.hypot(x, z) < L.GARDEN.fenceR + 2.5 || occupied(x, z) || blocked(x, z, 0.1)) continue;
        const [kind, cols] = kinds[k % kinds.length === 0 ? 0 : rnd.int(0, kinds.length - 1)];
        add(x, z, groundHeight(x, z), rnd.range(0.3, 0.58), rnd.pick(cols), 1.2, kind);
      }
      flowerSpots.push({ x: f.x, z: f.z, r: Math.min(f.rx, f.rz), y: groundHeight(f.x, f.z) });
    }
    const stem = new THREE.BufferGeometry();
    stem.setAttribute("position", new THREE.Float32BufferAttribute([-0.014, 0, 0, 0.014, 0, 0, 0, 1, 0, 0, 0, -0.014, 0, 0, 0.014, 0, 1, 0], 3));
    stem.computeVertexNormals();
    const stems = new THREE.InstancedMesh(stem, windify(new THREE.MeshStandardMaterial({ color: 0x5fa844, side: THREE.DoubleSide, roughness: 0.8 }), "instance", 0.32), spots.length);
    const headMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x2a1a20, roughness: 0.7, envMapIntensity: 0.5 }), "head", 0.32);
    const byKind = new Map(Object.keys(HEADS).map((k) => [k, []]));
    spots.forEach((sp, i) => byKind.get(sp[6]).push([sp, i]));
    spots.forEach(([x, z, y, h], i) => {
      _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, rnd.range(0, 6.28), 0)), _s.set(1, h, 1));
      stems.setMatrixAt(i, _m);
    });
    stems.name = "flower stems";
    group.add(stems);
    for (const [kind, list] of byKind) {
      if (!list.length) continue;
      const geo = HEADS[kind].clone();
      geo.setAttribute("aH", new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1));
      const heads = new THREE.InstancedMesh(geo, headMat, list.length);
      list.forEach(([[x, z, y, h, col, sc]], k) => {
        const tilt = kind === "spike" ? 0.12 : 0.35;
        _m.compose(_v.set(x, y + h, z), _q.setFromEuler(_e.set(rnd.range(-tilt, tilt), rnd.range(0, 6.28), rnd.range(-tilt, tilt))), _s.setScalar(rnd.range(0.85, 1.3) * sc));
        heads.setMatrixAt(k, _m);
        heads.setColorAt(k, _c.setHex(col));
        geo.attributes.aH.setX(k, h);
      });
      heads.name = `flowers ${kind}`;
      group.add(heads);
    }
  }

  /* ── Yarn balls: one instanced mesh, moved by the cats ── */
  const yarnGeo = (() => {
    const r = L.YARNS[0].r;
    const parts = [paint(new THREE.IcosahedronGeometry(r, 1), 0xffffff, rnd, 0.03)];
    for (let k = 0; k < 3; k++) parts.push(paint(place(new THREE.TorusGeometry(r * 0.99, 0.014, 3, 16), 0, 0, 0, rnd.range(0, 3), rnd.range(0, 3), rnd.range(0, 3)), 0xd9d9d9));
    return mergeGeometries(parts);
  })();
  const yarn = new THREE.InstancedMesh(yarnGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), L.YARNS.length);
  L.YARNS.forEach((y, i) => { yarn.setColorAt(i, _c.setHex(y.color)); _m.makeTranslation(y.x, y.r, y.z); yarn.setMatrixAt(i, _m); });
  yarn.castShadow = true;
  yarn.name = "yarn";
  yarn.frustumCulled = false;
  group.add(yarn);

  return {
    group,
    fencePosts,
    terrain,
    scenery,
    blocked,
    flowerFields: flowerSpots,
    /** Moves the balls of yarn to where the simulation has them. */
    syncYarn(yarns) {
      yarns.forEach((y, i) => {
        _m.compose(_v.set(y.x, y.r, y.z), _q.set(y.q[0], y.q[1], y.q[2], y.q[3]), _s.set(1, 1, 1));
        yarn.setMatrixAt(i, _m);
      });
      yarn.instanceMatrix.needsUpdate = true;
    },
  };
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** The flower heads, each a small geometry with vertex colours (white where the flower's own colour goes). */
function flowerHeads() {
  const colorize = (g, f) => {
    g = g.index ? g.toNonIndexed() : g;
    if (g.attributes.uv) g.deleteAttribute("uv");
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const c = f(p.getX(i), p.getY(i), p.getZ(i)); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  };
  const white = new THREE.Color(1, 1, 1), yellow = new THREE.Color(0xf6c21a), dark = new THREE.Color(0x3a2a24);
  // Five rounded petals, flat and open (buttercups, cornflowers, wildflowers).
  const star = new THREE.BufferGeometry();
  {
    const hp = [];
    for (let k = 0; k < 5; k++) {
      const a0 = (k / 5) * Math.PI * 2, a1 = a0 + 0.55, a2 = a0 - 0.55;
      hp.push(0, 0.01, 0, Math.cos(a1) * 0.06, 0.012, Math.sin(a1) * 0.06, Math.cos(a0) * 0.11, 0.025, Math.sin(a0) * 0.11);
      hp.push(0, 0.01, 0, Math.cos(a0) * 0.11, 0.025, Math.sin(a0) * 0.11, Math.cos(a2) * 0.06, 0.012, Math.sin(a2) * 0.06);
    }
    star.setAttribute("position", new THREE.Float32BufferAttribute(hp, 3));
  }
  // A cup of six petals (tulips, poppies), dark in the middle.
  const cup = new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.07, 0.03), new THREE.Vector2(0.09, 0.12), new THREE.Vector2(0.07, 0.16)], 6);
  // A spike of little florets (lavender, lupins, foxgloves).
  const spikeParts = [];
  for (let k = 0; k < 4; k++) spikeParts.push(new THREE.ConeGeometry(0.048 - k * 0.007, 0.09, 4, 1, true).translate(0, k * 0.06, 0).rotateY(k));
  const spike = mergeGeometries(spikeParts.map((g) => (g.index ? g.toNonIndexed() : g)));
  // A daisy: a ring of slim white petals round a yellow middle.
  const daisy = new THREE.BufferGeometry();
  {
    const hp = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, b = a + 0.12, c = a - 0.12;
      hp.push(Math.cos(b) * 0.03, 0.012, Math.sin(b) * 0.03, Math.cos(a) * 0.12, 0.02, Math.sin(a) * 0.12, Math.cos(c) * 0.03, 0.012, Math.sin(c) * 0.03);
    }
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, b = ((k + 1) / 6) * Math.PI * 2; hp.push(0, 0.03, 0, Math.cos(b) * 0.035, 0.02, Math.sin(b) * 0.035, Math.cos(a) * 0.035, 0.02, Math.sin(a) * 0.035); }
    daisy.setAttribute("position", new THREE.Float32BufferAttribute(hp, 3));
  }
  return {
    star: colorize(star, (x, y, z) => (Math.hypot(x, z) < 0.025 ? yellow : white)),
    cup: colorize(cup, (x, y) => (y < 0.03 ? dark : white)),
    spike: colorize(spike, () => white),
    daisy: colorize(daisy, (x, y, z) => (Math.hypot(x, z) < 0.036 ? yellow : white)),
  };
}

const smooth = L.smooth;
function rectDist(x, z, r, pad) {
  const dx = Math.max(r.minX - pad - x, 0, x - r.maxX - pad), dz = Math.max(r.minZ - pad - z, 0, z - r.maxZ - pad);
  return Math.hypot(dx, dz);
}
function shade(hex, dl) { return new THREE.Color(hex).offsetHSL(0, 0, dl).getHex(); }
