/* The garden round the cottage, built in code in the same flat-shaded low-poly style as the
   models, bright and warm by day: a wide lawn inside a cream picket fence, then two meadow rings
   (with ring paths, benches, trees, flower fields and a second pond) rolling away to hazy hills,
   winding stepping-stone paths, a pond with lily pads, a vegetable and herb patch, a bird bath,
   and the cats' own things (beds, bowls, water dishes, five cat trees, picnic blankets, big
   cushions, balls of yarn).

   Draw calls stay low on purpose: the ground is one mesh, every static prop is merged into one
   mesh with vertex colours, grass and flowers are instanced, the yarn is one instanced mesh. */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as L from "./layout.js";
import { makeRandom } from "./rng.js";
import { windify, shimmer } from "./ambient.js";

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

export function buildGarden(scene, { mobile = false, sunDir = new THREE.Vector3(-0.6, 0.7, -0.3) } = {}) {
  const rnd = makeRandom("garden-layout-v2");
  const statics = [];
  const group = new THREE.Group();
  group.name = "garden";
  scene.add(group);
  const stones = L.pathStones();

  /* ── The ground: a round world of lawn, meadow, hills and a far ridge, one mesh ── */
  {
    const rings = [];
    for (let r = 0; r <= 460;) { rings.push(r); r += r < 32 ? 1.6 : r < 90 ? 2.6 : r < 180 ? 8 : 18; }
    const seg = mobile ? 112 : 160;
    const pos = [], col = [];
    const vert = (r, k) => {
      // The jitter repeats with k, so the last column (k = seg) meets the first with no crack.
      const a = (k / seg) * Math.PI * 2 + (r > 0 ? Math.sin(r * 0.37 + (k % seg)) * 0.012 : 0);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      return [x, groundHeight(x, z), z];
    };
    const faceColor = (cx, cz, cy) => {
      const r = Math.hypot(cx, cz);
      const n = 0.5 + 0.25 * Math.sin(cx * 0.35 + Math.cos(cz * 0.3) * 1.7) + 0.25 * Math.sin(cz * 0.31 - cx * 0.17 + 2.1);
      if (r < L.GARDEN.fenceR + 0.5) {
        _c.setHex(COLORS.lawn[0]).lerp(_c2.setHex(COLORS.lawn[3]), n);
        // A trodden, earthy apron at the foot of the stairs and round the feeding corners.
        const worn = Math.max(
          1 - smooth(0.2, 1.4, Math.hypot(cx - L.STEP.ground.x, cz - L.STEP.ground.z)),
          ...L.FEEDING_CORNERS.map(([fx, fz]) => 1 - smooth(0.4, 1.9, Math.hypot(cx - fx, cz - fz))),
          1 - smooth(0.2, 1.1, rectDist(cx, cz, L.HOUSE, 0)),
        );
        if (worn > 0) _c.lerp(_c2.setHex(COLORS.dirt), Math.min(0.8, worn * 0.8));
      } else if (r < 100) {
        _c.setHex(COLORS.meadow[0]).lerp(_c2.setHex(COLORS.meadow[2]), n);
        _c.lerp(_c2.setHex(COLORS.lawn[1]), 1 - smooth(L.GARDEN.fenceR, L.GARDEN.fenceR + 8, r));
        // The two rings read as mown meadow, a touch greener, either side of their paths.
        const ring = Math.max(1 - smooth(4, 9, Math.abs(r - L.MEADOW.ring1.path)), 1 - smooth(5, 11, Math.abs(r - L.MEADOW.ring2.path)));
        if (ring > 0) _c.lerp(_c2.setHex(COLORS.lawn[2]), ring * 0.35);
      } else if (r < 220) {
        _c.setHex(COLORS.hill[0]).lerp(_c2.setHex(COLORS.hill[2]), n);
        _c.lerp(_c2.setHex(COLORS.meadow[1]), 1 - smooth(100, 140, r));
      } else {
        _c.setHex(COLORS.far[0]).lerp(_c2.setHex(COLORS.far[2]), n);
        _c.lerp(_c2.setHex(COLORS.hill[1]), 1 - smooth(220, 280, r));
        if (cy > 22) _c.lerp(_c2.setHex(0xdfe9e4), smooth(22, 30, cy) * 0.5); // pale tops on the far ridge
      }
      _c.offsetHSL(rnd.range(-0.005, 0.005), 0, rnd.range(-0.012, 0.012));
      return _c;
    };
    const tri = (a, b, c) => {
      pos.push(...a, ...b, ...c);
      const col3 = faceColor((a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3, (a[1] + b[1] + c[1]) / 3);
      for (let k = 0; k < 3; k++) col.push(col3.r, col3.g, col3.b);
    };
    for (let i = 0; i < rings.length - 1; i++) {
      for (let k = 0; k < seg; k++) {
        const a = vert(rings[i], k), b = vert(rings[i], k + 1), c = vert(rings[i + 1], k), d = vert(rings[i + 1], k + 1);
        if (i > 0) tri(a, b, c);
        tri(b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    ground.receiveShadow = true;
    ground.name = "ground";
    group.add(ground);
  }

  /* ── Stepping stones along every path ── */
  for (const s of stones) {
    if (Math.hypot(s.x - L.POND2.x, s.z - L.POND2.z) < L.POND2.r + 0.3) continue;
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
    statics.push(paint(place(new THREE.BoxGeometry(0.2, 0.3, 0.2), l.x, 1.78, l.z), 0xfff1cf));
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
  const pondGroup = [];
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
      statics.push(paint(place(pad, x, 0.05, z, -Math.PI / 2, 0, rnd.range(0, 6.28)), rnd.pick([0x5fae4f, 0x6fbf5a, 0x58a54a]), rnd, 0.04));
      if (k % 3 === 0) {
        for (let p = 0; p < 6; p++) statics.push(paint(place(new THREE.ConeGeometry(0.06, 0.16, 3), x + Math.cos(p) * 0.06, 0.12, z + Math.sin(p) * 0.06, Math.cos(p) * 0.6, 0, -Math.sin(p) * 0.6), p % 2 ? 0xf7b8cf : 0xfde6ef));
        statics.push(paint(place(new THREE.IcosahedronGeometry(0.04, 0), x, 0.14, z), 0xf6d04d));
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
    // The water: one disc, deeper blue in the middle.
    const g = new THREE.RingGeometry(0.001, P.r, 40, 4);
    g.rotateX(-Math.PI / 2);
    const cols = [], p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const d = Math.hypot(p.getX(i), p.getZ(i)) / P.r;
      _c.setHex(0x3c9bd0).lerp(_c2.setHex(0x8fd8ea), smooth(0.35, 1, d));
      cols.push(_c.r, _c.g, _c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    g.deleteAttribute("uv");
    g.translate(P.x, 0.035, P.z);
    pondGroup.push(g);
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
      statics.push(paint(place(new THREE.CircleGeometry(r, 9, 0.35, Math.PI * 2 - 0.5), x, 0.05, z, -Math.PI / 2, 0, rnd.range(0, 6.28)), rnd.pick([0x5fae4f, 0x6fbf5a, 0x58a54a]), rnd, 0.04));
      if (k % 3 === 1) {
        for (let q = 0; q < 6; q++) statics.push(paint(place(new THREE.ConeGeometry(0.06, 0.16, 3), x + Math.cos(q) * 0.06, 0.12, z + Math.sin(q) * 0.06, Math.cos(q) * 0.6, 0, -Math.sin(q) * 0.6), q % 2 ? 0xfff4dc : 0xf7b8cf));
        statics.push(paint(place(new THREE.IcosahedronGeometry(0.04, 0), x, 0.14, z), 0xf6d04d));
      }
    }
    for (let k = 0; k < 22; k++) {
      const a = rnd.range(-0.9, 1.3), d = P.r + rnd.range(0.1, 0.55);
      const x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d, h = rnd.range(0.7, 1.4);
      statics.push(sway(paint(place(new THREE.BoxGeometry(0.035, h, 0.035), x, h / 2, z, rnd.range(-0.1, 0.1), 0, rnd.range(-0.1, 0.1)), 0x6a9e48), 0, 0.04));
      if (k % 2 === 0) statics.push(sway(paint(place(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 5), x, h - 0.05, z), 0x8a5a34), 0, 0.04));
    }
    // A little wooden jetty out over the water from the path's end.
    const jx = P.x - P.r - 0.2, jz = P.z - 0.5;
    for (let k = 0; k < 6; k++) statics.push(paint(place(new THREE.BoxGeometry(0.34, 0.06, 1.2), jx + 0.1 + k * 0.36, 0.2, jz), COLORS.wood, rnd, 0.06));
    for (const [dx, dz] of [[0, -0.55], [0, 0.55], [1.8, -0.55], [1.8, 0.55]]) statics.push(paint(place(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 5), jx + dx + 0.1, 0.1, jz + dz), COLORS.woodDark));
    const g = new THREE.RingGeometry(0.001, P.r, 44, 4);
    g.rotateX(-Math.PI / 2);
    const cols = [], pp = g.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const d = Math.hypot(pp.getX(i), pp.getZ(i)) / P.r;
      _c.setHex(0x3c9bd0).lerp(_c2.setHex(0x8fd8ea), smooth(0.35, 1, d));
      cols.push(_c.r, _c.g, _c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    g.deleteAttribute("uv");
    g.translate(P.x, 0.035, P.z);
    pondGroup.push(g);
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
    statics.push(paint(place(new THREE.BoxGeometry(0.2, 0.26, 0.2), lx, y0 + 1.9, lz), 0xfff1cf));
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
    const water = new THREE.Mesh(mergeGeometries([...pondGroup, ...cols]), shimmer(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.0 })));
    water.name = "water";
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
  // Hedges hugging the fence outside, broken at the gates.
  for (let a = 0; a < 360; a += 7.5) {
    if (L.inGate(a) || L.inGate(a - 4) || L.inGate(a + 4)) continue;
    if (rnd.chance(0.35)) continue;
    const rad = (a * Math.PI) / 180, r = L.GARDEN.fenceR + rnd.range(1.2, 2.2);
    bushAt(Math.cos(rad) * r, Math.sin(rad) * r, rnd.range(0.7, 1.15), rnd.chance(0.3) ? rnd.pick([0xf29bb2, 0xfbe3ea]) : false);
  }
  const blossoms = []; // pink crowns near the garden, for the falling petals
  const occluders = []; // rough spheres round the trees near the garden, so the camera can avoid looking through one
  const roundTree = (x, z, s, blossom = false) => {
    const y0 = groundHeight(x, z) - 0.1;
    if (Math.hypot(x, z) < 95) occluders.push({ x, y: y0 + 3.2 * s, z, r: 1.6 * s }, { x, y: y0 + 1.0 * s, z, r: 0.5 * s });
    statics.push(sway(paint(place(new THREE.CylinderGeometry(0.14 * s, 0.22 * s, 2.0 * s, 6), x, y0 + 1.0 * s, z), COLORS.trunk, rnd, 0.05), y0, 0.02 / s));
    if (blossom && Math.hypot(x, z) < 70) blossoms.push({ x, y: y0 + 3.0 * s, z, r: 1.3 * s, ground: groundHeight(x, z) });
    const tone = blossom ? rnd.pick(COLORS.blossom) : rnd.pick(COLORS.leaves);
    for (let k = 0; k < 4; k++) {
      const r = (1.25 - k * 0.18) * s;
      statics.push(sway(paint(place(new THREE.IcosahedronGeometry(r, 0), x + rnd.range(-0.45, 0.45) * s, y0 + (2.4 + k * 0.62) * s, z + rnd.range(-0.45, 0.45) * s, rnd.range(0, 3), rnd.range(0, 3), 0), tone, rnd, 0.05), y0, 0.02 / s));
    }
  };
  const pineTree = (x, z, s) => {
    const y0 = groundHeight(x, z) - 0.1;
    if (Math.hypot(x, z) < 95) occluders.push({ x, y: y0 + 2.2 * s, z, r: 1.1 * s });
    statics.push(paint(place(new THREE.CylinderGeometry(0.1 * s, 0.16 * s, 1.0 * s, 5), x, y0 + 0.5 * s, z), COLORS.trunk));
    const tone = rnd.pick(COLORS.pine);
    for (let k = 0; k < 3; k++) statics.push(sway(paint(place(new THREE.ConeGeometry((1.1 - k * 0.28) * s, 1.5 * s, 7), x, y0 + (1.4 + k * 0.85) * s, z, 0, rnd.range(0, 3), 0), tone, rnd, 0.04), y0, 0.012 / s));
  };
  for (const t of L.GARDEN_TREES) roundTree(t.x, t.z, t.s, t.id === "gtree-3" || t.id === "gtree-1");
  // Out in the meadow: groves and single trees, thinning with distance; pines on the hills.
  const occupied = (x, z) => {
    for (const s of stones) if (Math.hypot(x - s.x, z - s.z) < 2.2) return true;
    return false;
  };
  // The meadow rings' own trees (layout.js places them clear of paths, benches and the pond; the meadow cats walk round them).
  for (const t of L.MEADOW_TREES) roundTree(t.x, t.z, t.s, t.blossom);
  for (const b of L.MEADOW_BUSHES) bushAt(b.x, b.z, b.r, b.flowers ?? false);
  const treeCount = mobile ? 60 : 95;
  for (let k = 0, made = 0; k < treeCount * 4 && made < treeCount; k++) {
    const r = 90 + Math.pow(rnd.next(), 1.4) * 110, a = rnd.range(0, Math.PI * 2);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (occupied(x, z)) continue;
    // Keep a clear view over the front meadow towards the gate.
    if (rnd.chance(0.55)) pineTree(x, z, rnd.range(1.8, 3.2));
    else roundTree(x, z, rnd.range(1.1, 1.9) * (r > 90 ? 1.5 : 1), rnd.chance(0.12));
    made++;
  }
  for (let k = 0; k < 12; k++) {
    const a = rnd.range(0, Math.PI * 2), r = rnd.range(L.GARDEN.fenceR + 3, 34);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    statics.push(paint(place(new THREE.DodecahedronGeometry(rnd.range(0.2, 0.5), 0), x, 0.08 + groundHeight(x, z), z, rnd.range(0, 3), rnd.range(0, 3), 0, 1, 0.6, 1), COLORS.rock, rnd, 0.05));
  }

  /* ── One mesh for everything above ── */
  // Near the garden, cut into sectors so the sun's shadow pass (which follows the view) and the
  // camera can skip what is out of reach; everything further out is one mesh with no shadow.
  const SECTORS = 12;
  const near = [], mid = Array.from({ length: SECTORS }, () => []), far = [];
  for (const g of statics) {
    const p = g.attributes.position, w = new Float32Array(p.count);
    if (g.userData.wind) { const [y0, k] = g.userData.wind; for (let i = 0; i < p.count; i++) w[i] = Math.max(0, p.getY(i) - y0) * k; }
    g.setAttribute("aWind", new THREE.BufferAttribute(w, 1));
    g.computeBoundingSphere();
    const c = g.boundingSphere.center;
    const rc = Math.hypot(c.x, c.z);
    if (rc < L.GARDEN.fenceR + 3) near.push(g);
    else if (rc < 92) mid[Math.floor(((Math.atan2(c.z, c.x) + Math.PI) / (Math.PI * 2)) * SECTORS) % SECTORS].push(g);
    else far.push(g);
  }
  const propsMat = windify(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), "attr");
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

  /* ── Grass tufts (instanced) ── */
  const blocked = (x, z, pad) => {
    const r = Math.hypot(x, z);
    if (Math.abs(r - L.GARDEN.fenceR) < 0.25) return true;
    if (rectDist(x, z, L.HOUSE, 0) < pad + 0.15) return true;
    if (Math.hypot(x - L.POND2.x, z - L.POND2.z) < L.POND2.r + 0.35) return true;
    if (r > L.GARDEN.fenceR + 1) {
      for (const s of stones) if (Math.abs(x - s.x) < 0.6 && Math.abs(z - s.z) < 0.6 && Math.hypot(x - s.x, z - s.z) < 0.44 + pad) return true;
      return false;
    }
    for (const T of L.TREES) if (rectDist(x, z, T.base, 0) < pad) return true;
    for (const f of [...L.FLOWER_BEDS, ...L.VEG_BEDS]) if (rectDist(x, z, f, 0) < pad) return true;
    for (const b of L.BEDS) if (Math.hypot(x - b.x, z - b.z) < b.r + pad) return true;
    for (const b of [...L.BOWLS, ...L.WATERS]) if (Math.hypot(x - b.x, z - b.z) < b.r + pad + 0.1) return true;
    for (const p of L.NAP_PILES) if (Math.hypot(x - p.x, z - p.z) < (p.r || Math.max(p.w, p.d) / 2) + pad) return true;
    if (Math.hypot(x - L.POND.x, z - L.POND.z) < L.POND.r + 0.35) return true;
    for (const s of stones) if (Math.abs(x - s.x) < 0.6 && Math.abs(z - s.z) < 0.6 && Math.hypot(x - s.x, z - s.z) < 0.44 + pad) return true;
    return false;
  };
  {
    const blades = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + rnd.range(-0.3, 0.3), lean = rnd.range(0.12, 0.3), w = 0.11;
      const g = new THREE.BufferGeometry();
      const ox = Math.cos(a) * 0.03, oz = Math.sin(a) * 0.03;
      const tx = Math.cos(a) * lean, tz = Math.sin(a) * lean;
      const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
      g.setAttribute("position", new THREE.Float32BufferAttribute([ox - px, 0, oz - pz, ox + px, 0, oz + pz, ox + tx, rnd.range(0.8, 1.05), oz + tz], 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute([...new THREE.Color(0x5fa844).toArray(), ...new THREE.Color(0x5fa844).toArray(), ...new THREE.Color(0xc4e88a).toArray()], 3));
      blades.push(g);
    }
    const tuft = mergeGeometries(blades);
    tuft.computeVertexNormals();
    const N = mobile ? 4200 : 11000;
    const grass = new THREE.InstancedMesh(tuft, windify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), "instance", 0.32), N);
    let n = 0;
    for (let t = 0; t < N * 6 && n < N; t++) {
      const r = Math.pow(rnd.next(), 0.75) * 88, a = rnd.range(0, Math.PI * 2);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (blocked(x, z, 0.12)) continue;
      const inGarden = r < L.GARDEN.walkR + 0.4;
      if (inGarden && rnd.next() < 0.35) continue;
      const h = inGarden ? rnd.range(0.16, 0.3) : rnd.range(0.3, 0.62);
      _m.compose(_v.set(x, groundHeight(x, z), z), _q.setFromEuler(_e.set(0, rnd.range(0, 6.28), 0)), _s.set(h * 1.1, h, h * 1.1));
      grass.setMatrixAt(n, _m);
      grass.setColorAt(n, _c.setHSL(0.25 + rnd.range(-0.04, 0.03), 0.45 + rnd.range(-0.1, 0.1), 0.62 + rnd.range(-0.08, 0.08)));
      n++;
    }
    grass.count = n;
    grass.name = "grass";
    grass.receiveShadow = !mobile;
    group.add(grass);
  }

  /* ── Flowers: flower beds, wildflowers on the lawn, and whole fields of them outside the fence ── */
  const flowerSpots = [];
  {
    const head = new THREE.BufferGeometry();
    const hp = [];
    for (let k = 0; k < 5; k++) {
      const a0 = (k / 5) * Math.PI * 2, a1 = a0 + 0.55, a2 = a0 - 0.55;
      hp.push(0, 0.01, 0, Math.cos(a1) * 0.06, 0.012, Math.sin(a1) * 0.06, Math.cos(a0) * 0.11, 0.025, Math.sin(a0) * 0.11);
      hp.push(0, 0.01, 0, Math.cos(a0) * 0.11, 0.025, Math.sin(a0) * 0.11, Math.cos(a2) * 0.06, 0.012, Math.sin(a2) * 0.06);
    }
    head.setAttribute("position", new THREE.Float32BufferAttribute(hp, 3));
    head.computeVertexNormals();
    const stem = new THREE.BufferGeometry();
    stem.setAttribute("position", new THREE.Float32BufferAttribute([-0.014, 0, 0, 0.014, 0, 0, 0, 1, 0, 0, 0, -0.014, 0, 0, 0.014, 0, 1, 0], 3));
    stem.computeVertexNormals();
    const mixed = [0xf07aa0, 0xc9a6f0, 0xfff4dc, 0xf8cf4a, 0xf2865e, 0xa9cdf5, 0xf7b3c9];
    const spots = [];
    for (const f of L.FLOWER_BEDS) {
      const area = (f.maxX - f.minX) * (f.maxZ - f.minZ);
      for (let k = 0; k < Math.round(area * 30); k++) spots.push([rnd.range(f.minX + 0.12, f.maxX - 0.12), rnd.range(f.minZ + 0.12, f.maxZ - 0.12), 0.18, rnd.range(0.2, 0.36), rnd.pick(mixed), 1]);
    }
    // Wildflower clumps on the lawn, away from where cats walk most.
    for (let k = 0; k < (mobile ? 90 : 170); k++) {
      const r = Math.sqrt(rnd.next()) * (L.GARDEN.fenceR - 1) + 1, a = rnd.range(0, Math.PI * 2);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (blocked(x, z, 0.3)) continue;
      const col = rnd.pick(mixed);
      for (let c = 0; c < rnd.int(2, 5); c++) spots.push([x + rnd.range(-0.3, 0.3), z + rnd.range(-0.3, 0.3), 0, rnd.range(0.14, 0.26), col, 0.85]);
    }
    // Wildflowers dotted through the meadow rings.
    for (let k = 0; k < (mobile ? 160 : 360); k++) {
      const r = rnd.range(L.MEADOW.ring1.inner - 2, L.MEADOW.ring2.outer + 3), a = rnd.range(0, Math.PI * 2);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (blocked(x, z, 0.3) || occupied(x, z)) continue;
      const col = rnd.pick(mixed), y = groundHeight(x, z);
      for (let c = 0; c < rnd.int(3, 6); c++) { const fx = x + rnd.range(-0.4, 0.4), fz = z + rnd.range(-0.4, 0.4); spots.push([fx, fz, groundHeight(fx, fz), rnd.range(0.2, 0.34), col, 1]); }
    }
    // Flower fields in the meadow rings: lavender, poppies, buttercups, pinks and mixed ones.
    const PALETTES = {
      lavender: [0x9a7fd6, 0xb096e0, 0x8a6cc8], poppy: [0xe8503f, 0xf06a4d, 0xd94436, 0xfff0d8],
      buttercup: [0xf8d34a, 0xfbe07a, 0xfff4dc], pink: [0xf7b3c9, 0xfff4dc, 0xf8cf4a, 0xc9a6f0], mixed,
    };
    const fields = L.FLOWER_FIELDS.map((f) => ({ ...f, cols: PALETTES[f.cols] || mixed }));
    for (const f of fields) {
      const n = Math.round(f.n * (mobile ? 0.4 : 1));
      for (let k = 0; k < n; k++) {
        const a = rnd.range(0, Math.PI * 2), d = Math.sqrt(rnd.next());
        const x = f.x + Math.cos(a) * d * f.rx, z = f.z + Math.sin(a) * d * f.rz;
        if (Math.hypot(x, z) < L.GARDEN.fenceR + 2.5 || occupied(x, z) || blocked(x, z, 0.1)) continue;
        spots.push([x, z, groundHeight(x, z), rnd.range(0.3, 0.55), rnd.pick(f.cols), 1.25]);
      }
      flowerSpots.push({ x: f.x, z: f.z, r: Math.min(f.rx, f.rz), y: groundHeight(f.x, f.z) });
    }
    head.setAttribute("aH", new THREE.InstancedBufferAttribute(new Float32Array(spots.length), 1));
    const heads = new THREE.InstancedMesh(head, windify(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, emissive: 0x2a1a20 }), "head", 0.32), spots.length);
    const stems = new THREE.InstancedMesh(stem, windify(new THREE.MeshLambertMaterial({ color: 0x5fa844, side: THREE.DoubleSide }), "instance", 0.32), spots.length);
    spots.forEach(([x, z, y, h, col, sc], i) => {
      const ry = rnd.range(0, 6.28);
      _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, h, 1));
      stems.setMatrixAt(i, _m);
      _m.compose(_v.set(x, y + h, z), _q.setFromEuler(_e.set(rnd.range(-0.35, 0.35), ry, rnd.range(-0.35, 0.35))), _s.setScalar(rnd.range(0.85, 1.3) * sc));
      heads.setMatrixAt(i, _m);
      heads.setColorAt(i, _c.setHex(col));
      head.attributes.aH.setX(i, h);
    });
    heads.name = "flower heads"; stems.name = "flower stems";
    group.add(stems, heads);
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
    occluders,
    blossoms,
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

const smooth = L.smooth;
function rectDist(x, z, r, pad) {
  const dx = Math.max(r.minX - pad - x, 0, x - r.maxX - pad), dz = Math.max(r.minZ - pad - z, 0, z - r.maxZ - pad);
  return Math.hypot(dx, dz);
}
function shade(hex, dl) { return new THREE.Color(hex).offsetHSL(0, 0, dl).getHex(); }
