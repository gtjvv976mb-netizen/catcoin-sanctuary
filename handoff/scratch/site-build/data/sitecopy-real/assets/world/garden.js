/* The garden round the cottage, built in code in the same flat-shaded low-poly style as the
   models: a meadow, grass and flowers, a stepping-stone path, a low fence, lanterns, flower
   beds, and the cats' own things (beds, bowls, a water dish, a cat tree, yarn, sunny patches).

   Draw calls stay low on purpose: every static prop is merged into one mesh with vertex
   colours, grass and flowers are instanced, and the glowing bits share one material. */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as L from "./layout.js";
import { makeRandom } from "./rng.js";

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
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = _c.r; col[(i + k) * 3 + 1] = _c.g; col[(i + k) * 3 + 2] = _c.b; }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** Places a geometry: position, rotation (Euler, radians), scale. */
function place(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  return geo.applyMatrix4(_m);
}

/** A soft round glow, drawn once into a small canvas (no image files needed). */
function glowTexture(inner = "rgba(255,255,255,1)", size = 128) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d");
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.45, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const COLORS = {
  grass: [0x4f6a45, 0x55724a, 0x5d7a50, 0x68864f],
  dirt: 0x6a5444, stone: 0x9a9088, wood: 0x7a5238, woodDark: 0x5c3e2b, iron: 0x3a2f36,
  soil: 0x4a3a30, ceramic: 0xe4dccf, kibble: 0x8a5a34, water: 0x78a9cf, sisal: 0xcdb07e,
  carpet: 0x8f7196, board: 0xa88862, bush: [0x3e5c3b, 0x486a42, 0x547748], trunk: 0x5a4030,
  leaves: [0x45663f, 0x4f7045, 0x5a7a4b], cushion: 0xeadfce, rock: 0x7f7671,
};

export function buildGarden(scene, { mobile = false } = {}) {
  const rnd = makeRandom("garden-layout");
  const statics = [];
  const glows = [];
  const group = new THREE.Group();
  group.name = "garden";
  scene.add(group);

  /* ── The meadow: flat where the cats live, rolling away into the haze ── */
  {
    const size = 96, seg = mobile ? 64 : 88;
    const g = new THREE.PlaneGeometry(size, size, seg, seg).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
      const hill = smooth(10.5, 30, r) * (1.1 + 1.3 * Math.sin(x * 0.19 + 1.3) * Math.cos(z * 0.16 - 0.4) + 0.6 * Math.sin(x * 0.07 - z * 0.09));
      p.setY(i, Math.max(0, hill) + (r > 10.5 ? Math.sin(x * 1.3) * Math.cos(z * 1.1) * 0.06 * smooth(10.5, 14, r) : 0));
    }
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i += 3) {
      const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      const n = 0.5 + 0.25 * Math.sin(cx * 0.55 + Math.cos(cz * 0.4) * 1.7) + 0.25 * Math.sin(cz * 0.47 - cx * 0.21 + 2.1);
      _c.setHex(COLORS.grass[0]).lerp(_c2.setHex(COLORS.grass[3]), n).offsetHSL(rnd.range(-0.004, 0.004), 0, rnd.range(-0.007, 0.007));
      // A trodden, earthy apron round the cottage and at the foot of the stairs.
      const worn = Math.max(
        1 - smooth(0.1, 1.2 + 0.5 * Math.sin(cx * 1.7 + cz * 0.9) * Math.cos(cz * 1.3), rectDist(cx, cz, L.HOUSE, 0)),
        1 - smooth(0.2, 1.3, Math.hypot(cx - L.STEP.ground.x, cz - L.STEP.ground.z)),
        1 - smooth(0.2, 1.1, Math.hypot(cx + 4.2, cz - 3.2)) * 1,
      ) * (0.75 + rnd.next() * 0.25);
      if (worn > 0) _c.lerp(new THREE.Color(COLORS.dirt).offsetHSL(0, 0, rnd.range(-0.02, 0.02)), Math.min(1, worn));
      for (let k = 0; k < 3; k++) { col[(i + k) * 3] = _c.r; col[(i + k) * 3 + 1] = _c.g; col[(i + k) * 3 + 2] = _c.b; }
    }
    g.deleteAttribute("normal"); g.deleteAttribute("uv");
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }));
    ground.receiveShadow = true;
    ground.name = "meadow";
    group.add(ground);
  }

  /* ── Stepping stones from the stairs out through the gate ── */
  const stones = L.pathPoints();
  stones.forEach((s, i) => {
    const r = rnd.range(0.34, 0.43);
    const g = new THREE.CylinderGeometry(r * 0.92, r, 0.07, rnd.int(7, 9));
    place(g, s.x + rnd.range(-0.06, 0.06), 0.03, s.z, 0, rnd.range(0, 3), 0, 1, 1, rnd.range(0.8, 0.95));
    statics.push(paint(g, COLORS.stone, rnd, 0.05));
  });

  /* ── A low wooden fence round the front, with a gate gap on the path ── */
  {
    const R = L.GARDEN.fenceR, a0 = L.GARDEN.fenceFrom, a1 = L.GARDEN.fenceTo;
    const posts = [];
    const stepDeg = (0.95 / R) * (180 / Math.PI);
    for (let a = a0; a <= a1 + 1e-6; a += stepDeg) {
      const gap = a > L.GARDEN.gateFrom && a < L.GARDEN.gateTo;
      if (gap) continue;
      posts.push(a);
    }
    posts.push(L.GARDEN.gateFrom, L.GARDEN.gateTo);
    posts.sort((p, q) => p - q);
    const pos = (a) => [Math.cos((a * Math.PI) / 180) * R, Math.sin((a * Math.PI) / 180) * R];
    for (const a of posts) {
      const [x, z] = pos(a);
      const gate = a === L.GARDEN.gateFrom || a === L.GARDEN.gateTo;
      const h = gate ? 0.95 : 0.72;
      statics.push(paint(place(new THREE.BoxGeometry(0.12, h, 0.12), x, h / 2, z, 0, -(a * Math.PI) / 180, 0), COLORS.woodDark, rnd, 0.05));
      statics.push(paint(place(new THREE.ConeGeometry(0.1, 0.12, 4), x, h + 0.06, z, 0, Math.PI / 4 - (a * Math.PI) / 180, 0), COLORS.woodDark));
    }
    for (let i = 0; i < posts.length - 1; i++) {
      const pa = posts[i], pb = posts[i + 1];
      if (pa === L.GARDEN.gateFrom && pb === L.GARDEN.gateTo) continue;
      const [x0, z0] = pos(pa), [x1, z1] = pos(pb);
      const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(-(z1 - z0), x1 - x0);
      for (const y of [0.3, 0.56]) statics.push(paint(place(new THREE.BoxGeometry(len + 0.06, 0.07, 0.05), (x0 + x1) / 2, y, (z0 + z1) / 2, 0, ang, 0), COLORS.wood, rnd, 0.06));
    }
  }

  /* ── Lantern posts, each with a warm light ── */
  const lights = [];
  const haloPts = [];
  for (const l of L.LANTERNS) {
    statics.push(paint(place(new THREE.BoxGeometry(0.26, 0.12, 0.26), l.x, 0.06, l.z), COLORS.iron));
    statics.push(paint(place(new THREE.BoxGeometry(0.09, 1.52, 0.09), l.x, 0.76, l.z), COLORS.iron));
    const y = 1.78;
    statics.push(paint(place(new THREE.BoxGeometry(0.3, 0.04, 0.3), l.x, y - 0.18, l.z), COLORS.iron));
    statics.push(paint(place(new THREE.ConeGeometry(0.24, 0.18, 4), l.x, y + 0.26, l.z, 0, Math.PI / 4, 0), COLORS.iron));
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) statics.push(paint(place(new THREE.BoxGeometry(0.035, 0.36, 0.035), l.x + dx * 0.125, y, l.z + dz * 0.125), COLORS.iron));
    glows.push(paint(place(new THREE.BoxGeometry(0.2, 0.3, 0.2), l.x, y, l.z), 0xffd08a));
    const light = new THREE.PointLight(0xffa857, 5.5, 7.5, 1.6);
    light.position.set(l.x, y, l.z);
    group.add(light);
    lights.push(light);
    haloPts.push(l.x, y, l.z);
  }

  /* ── Flower beds: timber boxes of soil ── */
  for (const f of L.FLOWER_BEDS) {
    const w = f.maxX - f.minX, d = f.maxZ - f.minZ, cx = (f.minX + f.maxX) / 2, cz = (f.minZ + f.maxZ) / 2, h = 0.22, t = 0.07;
    statics.push(paint(place(new THREE.BoxGeometry(w, h, t), cx, h / 2, f.minZ + t / 2), COLORS.wood, rnd, 0.05));
    statics.push(paint(place(new THREE.BoxGeometry(w, h, t), cx, h / 2, f.maxZ - t / 2), COLORS.wood, rnd, 0.05));
    statics.push(paint(place(new THREE.BoxGeometry(t, h, d - 2 * t), f.minX + t / 2, h / 2, cz), COLORS.wood, rnd, 0.05));
    statics.push(paint(place(new THREE.BoxGeometry(t, h, d - 2 * t), f.maxX - t / 2, h / 2, cz), COLORS.wood, rnd, 0.05));
    statics.push(paint(place(new THREE.BoxGeometry(w - 2 * t, 0.16, d - 2 * t), cx, 0.08, cz), COLORS.soil, rnd, 0.04));
  }

  /* ── Cat beds: a round rim, a base and a cushion ── */
  for (const b of L.BEDS) {
    statics.push(paint(place(new THREE.CylinderGeometry(b.r - 0.02, b.r, 0.08, 16), b.x, 0.04, b.z), shade(b.color, -0.08), rnd, 0.03));
    statics.push(paint(place(new THREE.TorusGeometry(b.r - 0.14, 0.14, 6, 18), b.x, 0.16, b.z, Math.PI / 2, 0, 0, 1, 1, 0.85), b.color, rnd, 0.04));
    statics.push(paint(place(new THREE.CylinderGeometry(b.r - 0.2, b.r - 0.18, 0.1, 14), b.x, 0.07, b.z), COLORS.cushion, rnd, 0.03));
  }

  /* ── Food bowls and the water dish ── */
  const bowlShape = (r, h) => new THREE.LatheGeometry([new THREE.Vector2(r * 0.62, 0), new THREE.Vector2(r * 0.8, 0.01), new THREE.Vector2(r, h), new THREE.Vector2(r * 0.86, h), new THREE.Vector2(r * 0.7, 0.03), new THREE.Vector2(0.001, 0.03)], 12);
  for (const b of L.BOWLS) {
    statics.push(paint(place(bowlShape(b.r * 0.9, 0.11), b.x, 0, b.z), COLORS.ceramic, rnd, 0.02));
    statics.push(paint(place(new THREE.TorusGeometry(b.r * 0.9, 0.015, 4, 14), b.x, 0.09, b.z, Math.PI / 2), 0xb4574b));
    for (let k = 0; k < 7; k++) {
      const a = rnd.range(0, 6.28), rr = rnd.range(0, b.r * 0.45);
      statics.push(paint(place(new THREE.IcosahedronGeometry(0.045, 0), b.x + Math.cos(a) * rr, 0.07, b.z + Math.sin(a) * rr, rnd.range(0, 3), rnd.range(0, 3), 0), COLORS.kibble, rnd, 0.06));
    }
  }
  {
    const w = L.WATER;
    statics.push(paint(place(bowlShape(w.r * 0.95, 0.09), w.x, 0, w.z), 0xcfd9e0, rnd, 0.02));
    statics.push(paint(place(new THREE.CircleGeometry(w.r * 0.78, 14), w.x, 0.072, w.z, -Math.PI / 2), COLORS.water));
  }

  /* ── The cat tree: base board, two sisal posts, two carpeted platforms ── */
  {
    const T = L.TREE, b = T.base;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    statics.push(paint(place(new THREE.BoxGeometry(b.maxX - b.minX, 0.12, b.maxZ - b.minZ), cx, 0.06, cz), COLORS.carpet, rnd, 0.03));
    for (const p of [T.low, T.high]) {
      const h = p.y - 0.1 - 0.12;
      statics.push(paint(place(new THREE.CylinderGeometry(0.11, 0.11, h, 8), p.x, 0.12 + h / 2, p.z), COLORS.sisal, rnd, 0.06));
      // Sisal rings, for texture.
      for (let y = 0.2; y < 0.12 + h - 0.05; y += 0.16) statics.push(paint(place(new THREE.TorusGeometry(0.115, 0.012, 3, 8), p.x, y, p.z, Math.PI / 2), shade(COLORS.sisal, -0.07)));
      statics.push(paint(place(new THREE.CylinderGeometry(p.r, p.r, 0.1, 14), p.x, p.y - 0.05, p.z), COLORS.carpet, rnd, 0.03));
    }
    // A pom-pom on a string under the top platform.
    statics.push(paint(place(new THREE.BoxGeometry(0.012, 0.42, 0.012), T.high.x + 0.36, T.high.y - 0.31, T.high.z - 0.2), 0xe6d7bf));
    statics.push(paint(place(new THREE.IcosahedronGeometry(0.07, 0), T.high.x + 0.36, T.high.y - 0.55, T.high.z - 0.2), 0xe07a5f));
  }

  /* ── Bushes in the garden and a hedge beyond it; trees on the rise ── */
  const bushAt = (x, z, r) => {
    const n = rnd.int(3, 5);
    for (let k = 0; k < n; k++) {
      const a = rnd.range(0, 6.28), d = rnd.range(0, r * 0.45), s = r * rnd.range(0.5, 0.75);
      statics.push(paint(place(new THREE.IcosahedronGeometry(1, 0), x + Math.cos(a) * d, s * 0.7, z + Math.sin(a) * d, rnd.range(0, 3), rnd.range(0, 3), 0, s, s * 0.85, s), rnd.pick(COLORS.bush), rnd, 0.05));
    }
  };
  for (const b of L.BUSHES) bushAt(b.x, b.z, b.r);
  for (let a = 200; a < 340; a += 11) {
    const r = rnd.range(9.6, 10.6), rad = (a * Math.PI) / 180;
    bushAt(Math.cos(rad) * r, Math.sin(rad) * r, rnd.range(0.7, 1.1));
  }
  const treeAt = (x, z, s) => {
    const y0 = groundHeight(x, z) - 0.1;
    statics.push(paint(place(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.6 * s, 6), x, y0 + 0.8 * s, z), COLORS.trunk, rnd, 0.05));
    const tone = rnd.pick(COLORS.leaves);
    for (let k = 0; k < 3; k++) statics.push(paint(place(new THREE.IcosahedronGeometry((1.1 - k * 0.22) * s, 0), x + rnd.range(-0.2, 0.2) * s, y0 + (1.9 + k * 0.75) * s, z + rnd.range(-0.2, 0.2) * s, rnd.range(0, 3), rnd.range(0, 3), 0), tone, rnd, 0.05));
  };
  for (const [a, r, s] of [[-40, 13.5, 1.3], [-8, 15, 1.1], [30, 16.5, 1.4], [62, 14.5, 1.0], [118, 15.5, 1.25], [150, 13.8, 1.35], [178, 16, 1.1], [205, 12.8, 1.5], [232, 14.2, 1.2], [262, 13, 1.6], [290, 14.8, 1.3], [318, 12.6, 1.45]]) {
    const rad = (a * Math.PI) / 180;
    treeAt(Math.cos(rad) * r, Math.sin(rad) * r, s);
  }
  for (let k = 0; k < 9; k++) {
    const a = rnd.range(-0.4, Math.PI + 0.4), r = rnd.range(9.6, 11.5);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    statics.push(paint(place(new THREE.DodecahedronGeometry(rnd.range(0.14, 0.3), 0), x, 0.06 + groundHeight(x, z), z, rnd.range(0, 3), rnd.range(0, 3), 0, 1, 0.6, 1), COLORS.rock, rnd, 0.05));
  }

  /* ── One mesh for everything above, one for everything that glows ── */
  const propsMesh = new THREE.Mesh(mergeGeometries(statics), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 }));
  propsMesh.castShadow = true;
  propsMesh.receiveShadow = true;
  propsMesh.name = "props";
  group.add(propsMesh);
  statics.forEach((g) => g.dispose());
  const glowMesh = new THREE.Mesh(mergeGeometries(glows), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  glowMesh.name = "lantern glass";
  group.add(glowMesh);

  /* ── Grass tufts (instanced) ── */
  const blocked = (x, z, pad) => {
    if (rectDist(x, z, L.HOUSE, 0) < pad + 0.15) return true;
    if (rectDist(x, z, L.TREE.base, 0) < pad) return true;
    for (const f of L.FLOWER_BEDS) if (rectDist(x, z, f, 0) < pad) return true;
    for (const b of L.BEDS) if (Math.hypot(x - b.x, z - b.z) < b.r + pad) return true;
    for (const b of [...L.BOWLS, L.WATER]) if (Math.hypot(x - b.x, z - b.z) < b.r + pad + 0.1) return true;
    for (const b of L.BUSHES) if (Math.hypot(x - b.x, z - b.z) < b.r * 0.8) return true;
    for (const s of stones) if (Math.hypot(x - s.x, z - s.z) < 0.46 + pad) return true;
    for (const l of L.LANTERNS) if (Math.hypot(x - l.x, z - l.z) < 0.25) return true;
    if (Math.hypot(x - L.STEP.ground.x, z - L.STEP.ground.z) < 0.7) return true;
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
      g.setAttribute("color", new THREE.Float32BufferAttribute([...new THREE.Color(0x4d6e42).toArray(), ...new THREE.Color(0x4d6e42).toArray(), ...new THREE.Color(0x9dbd72).toArray()], 3));
      blades.push(g);
    }
    const tuft = mergeGeometries(blades);
    const N = mobile ? 1700 : 2800;
    const grass = new THREE.InstancedMesh(tuft, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1, flatShading: true }), N);
    let n = 0;
    for (let t = 0; t < N * 6 && n < N; t++) {
      const r = Math.sqrt(rnd.next()) * 21, a = rnd.range(0, Math.PI * 2);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (blocked(x, z, 0.12)) continue;
      const inGarden = r < L.GARDEN.walkR + 0.4;
      if (inGarden && rnd.next() < 0.3) continue;
      const h = inGarden ? rnd.range(0.14, 0.3) : rnd.range(0.28, 0.6);
      _m.compose(_v.set(x, groundHeight(x, z), z), _q.setFromEuler(_e.set(0, rnd.range(0, 6.28), 0)), _s.set(h * 1.1, h, h * 1.1));
      grass.setMatrixAt(n, _m);
      grass.setColorAt(n, _c.setHSL(0.24 + rnd.range(-0.04, 0.03), 0.35 + rnd.range(-0.1, 0.1), 0.8 + rnd.range(-0.1, 0.1)));
      n++;
    }
    grass.count = n;
    grass.name = "grass";
    grass.receiveShadow = !mobile;
    group.add(grass);
  }

  /* ── Flowers: a stem and a five-petal head each (two instanced meshes) ── */
  {
    const head = new THREE.BufferGeometry();
    const hp = [];
    for (let k = 0; k < 5; k++) {
      const a0 = (k / 5) * Math.PI * 2, a1 = a0 + 0.55, a2 = a0 - 0.55;
      hp.push(0, 0, 0, Math.cos(a1) * 0.06, 0.012, Math.sin(a1) * 0.06, Math.cos(a0) * 0.1, 0.02, Math.sin(a0) * 0.1);
      hp.push(0, 0, 0, Math.cos(a0) * 0.1, 0.02, Math.sin(a0) * 0.1, Math.cos(a2) * 0.06, 0.012, Math.sin(a2) * 0.06);
    }
    head.setAttribute("position", new THREE.Float32BufferAttribute(hp, 3));
    const stem = new THREE.BufferGeometry();
    stem.setAttribute("position", new THREE.Float32BufferAttribute([-0.012, 0, 0, 0.012, 0, 0, 0, 1, 0, 0, 0, -0.012, 0, 0, 0.012, 0, 1, 0], 3));
    const petals = [0xf0a3c2, 0xcdb0ea, 0xfff1d8, 0xf6cd62, 0xf08e6c, 0xb9d3f2];
    const spots = [];
    for (const f of L.FLOWER_BEDS) {
      const area = (f.maxX - f.minX) * (f.maxZ - f.minZ);
      for (let k = 0; k < Math.round(area * 26); k++) spots.push([rnd.range(f.minX + 0.12, f.maxX - 0.12), rnd.range(f.minZ + 0.12, f.maxZ - 0.12), 0.16, rnd.range(0.2, 0.36)]);
    }
    for (let k = 0; k < (mobile ? 180 : 300); k++) {
      const r = Math.sqrt(rnd.next()) * 18 + 2.5, a = rnd.range(0, Math.PI * 2);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (blocked(x, z, 0.2)) continue;
      // Flowers mostly away from where cats walk most, in little clumps.
      const clump = rnd.int(1, 4);
      for (let c = 0; c < clump; c++) spots.push([x + rnd.range(-0.25, 0.25), z + rnd.range(-0.25, 0.25), groundHeight(x, z), rnd.range(0.16, 0.3)]);
    }
    const heads = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8, emissive: 0x2a1a20, flatShading: true }), spots.length);
    const stems = new THREE.InstancedMesh(stem, new THREE.MeshStandardMaterial({ color: 0x4f7a45, side: THREE.DoubleSide, roughness: 1 }), spots.length);
    spots.forEach(([x, z, y, h], i) => {
      const ry = rnd.range(0, 6.28);
      _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, h, 1));
      stems.setMatrixAt(i, _m);
      _m.compose(_v.set(x, y + h, z), _q.setFromEuler(_e.set(rnd.range(-0.35, 0.35), ry, rnd.range(-0.35, 0.35))), _s.setScalar(rnd.range(0.8, 1.25)));
      heads.setMatrixAt(i, _m);
      heads.setColorAt(i, _c.setHex(rnd.pick(petals)));
    });
    heads.name = "flower heads"; stems.name = "flower stems";
    group.add(stems, heads);
  }

  /* ── Sunny patches: soft warm pools on the grass ── */
  const glowTex = glowTexture();
  {
    const quads = L.SUN_PATCHES.map((s) => place(new THREE.PlaneGeometry(s.r * 2.5, s.r * 2.1), s.x, 0.02, s.z, -Math.PI / 2, 0, 0.5));
    const sun = new THREE.Mesh(mergeGeometries(quads), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffc070, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    sun.renderOrder = 1;
    sun.name = "sunny patches";
    group.add(sun);
    // The light itself: a soft-edged beam from the low sun onto each patch (and whoever naps there).
    const toSun = new THREE.Vector3(-10, 12, 9).normalize();
    for (const s of L.SUN_PATCHES) {
      const spot = new THREE.SpotLight(0xffc27a, 20, 16, 0.21, 0.85, 1.1);
      spot.position.set(s.x, 0, s.z).addScaledVector(toSun, 8);
      spot.target.position.set(s.x, 0, s.z);
      group.add(spot, spot.target);
      lights.push(spot);
    }
  }

  /* ── Halos round the lanterns, and a few fireflies ── */
  const halos = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(haloPts, 3)),
    new THREE.PointsMaterial({ map: glowTex, color: 0xffb25e, size: 1.5, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  halos.name = "lantern halos";
  group.add(halos);

  const FLIES = mobile ? 18 : 30;
  const flyBase = [];
  const flyPos = new Float32Array(FLIES * 3);
  for (let i = 0; i < FLIES; i++) {
    const a = rnd.range(-0.6, Math.PI + 0.6), r = rnd.range(3.2, 10.5);
    flyBase.push({ x: Math.cos(a) * r, y: rnd.range(0.5, 2.2), z: Math.sin(a) * r, p: rnd.range(0, 100), s: rnd.range(0.2, 0.5) });
  }
  const flyGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(flyPos, 3));
  const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ map: glowTex, color: 0xfff0a0, size: 0.22, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  flies.name = "fireflies";
  group.add(flies);
  const moveFlies = (t) => {
    flyBase.forEach((f, i) => {
      flyPos[i * 3] = f.x + Math.sin(t * f.s + f.p) * 0.9;
      flyPos[i * 3 + 1] = f.y + Math.sin(t * f.s * 1.7 + f.p * 2) * 0.35;
      flyPos[i * 3 + 2] = f.z + Math.cos(t * f.s * 0.8 + f.p) * 0.9;
    });
    flyGeo.attributes.position.needsUpdate = true;
  };
  moveFlies(0);

  /* ── Yarn balls: moved by the cats ── */
  const yarnMeshes = L.YARNS.map((y) => {
    const parts = [paint(new THREE.IcosahedronGeometry(y.r, 1), y.color, rnd, 0.04)];
    for (let k = 0; k < 3; k++) parts.push(paint(place(new THREE.TorusGeometry(y.r * 0.99, 0.014, 3, 16), 0, 0, 0, rnd.range(0, 3), rnd.range(0, 3), rnd.range(0, 3)), shade(y.color, 0.08)));
    const m = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
    m.castShadow = true;
    m.position.set(y.x, y.r, y.z);
    m.name = y.id;
    group.add(m);
    return m;
  });

  return {
    group,
    lights,
    yarnMeshes,
    /** Per frame: fireflies drift (not with reduced motion). */
    update(t, still) { if (!still) moveFlies(t); },
  };
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function rectDist(x, z, r, pad) {
  const dx = Math.max(r.minX - pad - x, 0, x - r.maxX - pad), dz = Math.max(r.minZ - pad - z, 0, z - r.maxZ - pad);
  return Math.hypot(dx, dz);
}
function shade(hex, dl) { return new THREE.Color(hex).offsetHSL(0, 0, dl).getHex(); }
/** The meadow's height at (x, z): flat in the garden, rising gently beyond (matches the ground mesh). */
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const hill = smooth(10.5, 30, r) * (1.1 + 1.3 * Math.sin(x * 0.19 + 1.3) * Math.cos(z * 0.16 - 0.4) + 0.6 * Math.sin(x * 0.07 - z * 0.09));
  return Math.max(0, hill) + (r > 10.5 ? Math.sin(x * 1.3) * Math.cos(z * 1.1) * 0.06 * smooth(10.5, 14, r) : 0);
}
