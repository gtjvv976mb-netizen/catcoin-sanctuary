/* The garden's bigger pieces and the meadows' man-made things, added to garden.js's merged props:
   the glasshouse and the potting shed, rose arches over the front path, benches and planters,
   a clipped hedge round the fence, brick edging along the gravel paths, dry-stone walls across the
   meadows (instanced: one draw call for thousands of stones), wooden footbridges where paths cross
   the stream, and the third pond's shore (stones, lily pads, reeds and bulrushes), with reeds along
   the stream's banks. Glass goes to its own see-through material; lamp glass to a softly glowing one. */

import * as THREE from "three";
import * as L from "./layout.js";
import { makeRandom } from "./rng.js";

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

/**
 * @param {object} o
 * @param {Array} o.statics   geometries merged into the props (garden.js)
 * @param {Array} o.glass     geometries for the glass material
 * @param {Array} o.glows     geometries for the glowing lamp glass
 * @param {Function} o.paint  paint(geo, hex, rnd?, jitter?)
 * @param {Function} o.place  place(geo, x, y, z, rx, ry, rz, sx, sy, sz)
 * @param {Function} o.sway   sway(geo, y0, k)
 * @param {THREE.Group} o.group
 * @param {object} o.q        the quality tier
 */
export function addScenery({ statics, glass, glows, paint, place, sway, group, q }) {
  const rnd = makeRandom("scenery-v1");
  const H = L.groundHeight;
  const box = (w, h, d, x, y, z, ry, hex, j = 0.03) => statics.push(paint(place(new THREE.BoxGeometry(w, h, d), x, y, z, 0, ry), hex, rnd, j));
  const out = { meshes: [] };

  /* ── The glasshouse: a white frame, glass walls and a pitched glass roof, shelves of pots inside ── */
  {
    const G = L.GREENHOUSE, cx = (G.minX + G.maxX) / 2, cz = (G.minZ + G.maxZ) / 2, w = G.maxX - G.minX, d = G.maxZ - G.minZ, h = G.h, ridge = h + 1.2;
    const white = 0xf6f3ec;
    // A low brick plinth.
    for (const [x, z, ww, dd] of [[cx, G.minZ + 0.1, w, 0.2], [cx, G.maxZ - 0.1, w, 0.2], [G.minX + 0.1, cz, 0.2, d], [G.maxX - 0.1, cz, 0.2, d]]) {
      if (x === G.maxX - 0.1) { box(0.2, 0.45, d / 2 - 0.55, x, 0.225, G.minZ + (d / 2 - 0.55) / 2, 0, 0xc0694a, 0.06); box(0.2, 0.45, d / 2 - 0.55, x, 0.225, G.maxZ - (d / 2 - 0.55) / 2, 0, 0xc0694a, 0.06); continue; }
      box(ww, 0.45, dd, x, 0.225, z, 0, 0xc0694a, 0.06);
    }
    // Uprights and rails.
    const nx = 6, nz = 4;
    for (let i = 0; i <= nx; i++) for (const z of [G.minZ, G.maxZ]) box(0.08, h, 0.08, G.minX + (w * i) / nx, h / 2, z, 0, white);
    for (let k = 1; k < nz; k++) for (const x of [G.minX, G.maxX]) box(0.08, h, 0.08, x, h / 2, G.minZ + (d * k) / nz, 0, white);
    for (const x of [G.minX, G.maxX]) for (const z of [G.minZ, G.maxZ]) box(0.1, h, 0.1, x, h / 2, z, 0, white);
    for (const y of [0.45, h]) { box(w, 0.08, 0.08, cx, y, G.minZ, 0, white); box(w, 0.08, 0.08, cx, y, G.maxZ, 0, white); box(0.08, 0.08, d, G.minX, y, cz, 0, white); box(0.08, 0.08, d, G.maxX, y, cz, 0, white); }
    box(w + 0.1, 0.1, 0.1, cx, ridge, cz, 0, white);
    // Roof rafters (the ridge runs along x).
    const pitch = Math.atan2(ridge - h, d / 2), rl = Math.hypot(ridge - h, d / 2);
    for (let i = 0; i <= nx; i++) for (const s of [-1, 1]) statics.push(paint(place(new THREE.BoxGeometry(0.07, 0.07, rl), G.minX + (w * i) / nx, (h + ridge) / 2, cz + s * d / 4, s * pitch, 0, 0), white));
    // Gable ends.
    for (const x of [G.minX, G.maxX]) {
      const tri = new THREE.BufferGeometry();
      tri.setAttribute("position", new THREE.Float32BufferAttribute([x, h, G.minZ, x, h, G.maxZ, x, ridge, cz], 3));
      glass.push(tri);
    }
    // Glass: walls and roof.
    glass.push(place(new THREE.PlaneGeometry(w, h - 0.45), cx, 0.45 + (h - 0.45) / 2, G.minZ));
    glass.push(place(new THREE.PlaneGeometry(w, h - 0.45), cx, 0.45 + (h - 0.45) / 2, G.maxZ, 0, Math.PI));
    glass.push(place(new THREE.PlaneGeometry(d, h - 0.45), G.minX, 0.45 + (h - 0.45) / 2, cz, 0, Math.PI / 2));
    glass.push(place(new THREE.PlaneGeometry(d / 2 - 0.55, h - 0.45), G.maxX, 0.45 + (h - 0.45) / 2, G.minZ + (d / 2 - 0.55) / 2, 0, -Math.PI / 2));
    glass.push(place(new THREE.PlaneGeometry(d / 2 - 0.55, h - 0.45), G.maxX, 0.45 + (h - 0.45) / 2, G.maxZ - (d / 2 - 0.55) / 2, 0, -Math.PI / 2));
    for (const s of [-1, 1]) glass.push(place(new THREE.PlaneGeometry(w, rl), cx, (h + ridge) / 2, cz + s * d / 4, -s * (Math.PI / 2 - pitch), 0, 0));
    // An open door (a frame on the +x side).
    box(0.08, h - 0.2, 0.08, G.maxX, (h - 0.2) / 2, cz - 0.55, 0, white); box(0.08, h - 0.2, 0.08, G.maxX, (h - 0.2) / 2, cz + 0.55, 0, white);
    // Shelves of pots and seedlings, tomato plants on canes.
    for (const z of [G.minZ + 0.55, G.maxZ - 0.55]) {
      box(w - 0.6, 0.06, 0.7, cx, 0.85, z, 0, 0xb98a5c);
      for (const x of [G.minX + 0.4, cx, G.maxX - 0.4]) box(0.06, 0.85, 0.06, x, 0.42, z, 0, 0x8d5d3a);
      for (let x = G.minX + 0.55; x < G.maxX - 0.4; x += 0.42) {
        statics.push(paint(place(new THREE.CylinderGeometry(0.13, 0.1, 0.2, 8), x, 0.98, z + rnd.range(-0.12, 0.12)), 0xc9704a, rnd, 0.05));
        statics.push(paint(place(new THREE.IcosahedronGeometry(0.16, 0), x, 1.17, z, rnd.range(0, 3), rnd.range(0, 3), 0, 1, 0.8, 1), rnd.pick([0x5fae4f, 0x6cba5a, 0x7ac95c]), rnd, 0.06));
        if (rnd.chance(0.35)) statics.push(paint(place(new THREE.IcosahedronGeometry(0.05, 0), x + 0.05, 1.3, z), rnd.pick([0xe4574a, 0xf6d04d, 0xf29bb2])));
      }
    }
    for (let x = G.minX + 0.8; x < G.maxX - 0.6; x += 0.9) {
      box(0.03, 1.8, 0.03, x, 0.9, cz, 0, 0xc4a070);
      for (let k = 0; k < 4; k++) statics.push(paint(place(new THREE.IcosahedronGeometry(0.2, 0), x + rnd.range(-0.12, 0.12), 0.5 + k * 0.38, cz + rnd.range(-0.12, 0.12), rnd.range(0, 3), rnd.range(0, 3)), rnd.pick([0x4f9a3e, 0x5aa644]), rnd, 0.05));
      for (let k = 0; k < 3; k++) statics.push(paint(place(new THREE.IcosahedronGeometry(0.08, 1), x + rnd.range(-0.18, 0.18), rnd.range(0.6, 1.5), cz + rnd.range(-0.18, 0.18)), rnd.chance(0.7) ? 0xe0443a : 0xf2a33a));
    }
  }

  /* ── The potting shed: plank walls, a shingled roof, a door, a window, a water butt ── */
  {
    const S = L.SHED, cx = (S.minX + S.maxX) / 2, cz = (S.minZ + S.maxZ) / 2, w = S.maxX - S.minX, d = S.maxZ - S.minZ, h = S.h;
    const woods = [0x9fc4b8, 0x94bbaf, 0xa8ccc0]; // painted sage-green planks
    for (let x = S.minX + 0.1; x < S.maxX; x += 0.2) for (const z of [S.minZ, S.maxZ]) box(0.19, h, 0.08, x, h / 2, z, 0, rnd.pick(woods), 0.04);
    for (let z = S.minZ + 0.1; z < S.maxZ; z += 0.2) for (const x of [S.minX, S.maxX]) {
      if (x === S.maxX && Math.abs(z - cz) < 0.55) continue; // the doorway
      box(0.08, h, 0.19, x, h / 2, z, 0, rnd.pick(woods), 0.04);
    }
    box(0.06, h - 0.25, 1.0, S.maxX + 0.1, (h - 0.25) / 2, cz - 0.02, 0, 0x6f9c8e, 0.03);
    statics.push(paint(place(new THREE.SphereGeometry(0.05, 6, 4), S.maxX + 0.16, 1.0, cz + 0.35), 0xd9a832));
    // Gables and roof (ridge along z, eaves overhanging).
    const ridge = h + 1.1;
    for (const z of [S.minZ, S.maxZ]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute([S.minX, h, z, S.maxX, h, z, cx, ridge, z, S.maxX, h, z, S.minX, h, z, cx, ridge, z], 3));
      statics.push(paint(g, 0x9fc4b8));
    }
    const pitch = Math.atan2(ridge - h, w / 2), rl = Math.hypot(ridge - h, w / 2) + 0.35;
    for (const s of [-1, 1]) {
      for (let row = 0; row < 6; row++) {
        const t = (row + 0.5) / 6, x = cx + s * (w / 2 + 0.3) * (1 - t) , y = ridge - (ridge - h + 0.2) * (1 - t);
        statics.push(paint(place(new THREE.BoxGeometry(rl / 6 + 0.04, 0.06, d + 0.6), x, y, cz, 0, 0, -s * pitch), row % 2 ? 0xb5553f : 0xc4644a, rnd, 0.05));
      }
    }
    box(0.14, 0.14, d + 0.7, cx, ridge + 0.02, cz, 0, 0x8e3f30);
    // A window on the front (+z side), with a flower box.
    box(0.9, 0.7, 0.05, cx, 1.35, S.maxZ + 0.05, 0, 0xf6f3ec);
    glass.push(place(new THREE.PlaneGeometry(0.78, 0.58), cx, 1.35, S.maxZ + 0.08));
    box(1.0, 0.18, 0.22, cx, 0.92, S.maxZ + 0.15, 0, 0xb67d50);
    for (let k = 0; k < 7; k++) statics.push(paint(place(new THREE.IcosahedronGeometry(0.08, 0), cx - 0.4 + k * 0.13, 1.06, S.maxZ + 0.16), rnd.pick([0xf07aa0, 0xfff4dc, 0xf8cf4a, 0xe4574a])));
    // A water butt, a leaning spade and a stack of pots.
    statics.push(paint(place(new THREE.CylinderGeometry(0.32, 0.3, 0.8, 12), S.maxX + 0.5, 0.4, S.minZ + 0.45), 0x5b7f66, rnd, 0.03));
    statics.push(paint(place(new THREE.BoxGeometry(0.04, 1.1, 0.04), S.maxX + 0.2, 0.55, S.maxZ - 0.4, 0, 0, 0.18), 0x8d5d3a));
    statics.push(paint(place(new THREE.BoxGeometry(0.2, 0.26, 0.03), S.maxX + 0.3, 0.12, S.maxZ - 0.4, 0, 0, 0.18), 0x9aa3a8));
    for (let k = 0; k < 4; k++) statics.push(paint(place(new THREE.CylinderGeometry(0.16, 0.12, 0.22, 8, 1, true), S.minX - 0.4, 0.11 + k * 0.1, S.maxZ + 0.2), 0xc9704a, rnd, 0.04));
  }

  /* ── Rose arches over the front path ── */
  for (const a of L.ROSE_ARCHES) {
    const white = 0xf8f4ea;
    for (const s of [-1, 1]) statics.push(paint(place(new THREE.CylinderGeometry(0.06, 0.07, 2.3, 6), a.x + s * a.half, 1.15, a.z), white));
    statics.push(paint(place(new THREE.TorusGeometry(a.half, 0.05, 5, 16, Math.PI), a.x, 2.3, a.z), white));
    for (let k = 0; k < 34; k++) {
      const t = rnd.range(-0.25, Math.PI + 0.25);
      const onPost = t < 0 || t > Math.PI;
      const x = onPost ? a.x + (t < 0 ? a.half : -a.half) : a.x + Math.cos(t) * a.half;
      const y = onPost ? rnd.range(0.4, 2.3) : 2.3 + Math.sin(t) * a.half;
      const z = a.z + rnd.range(-0.14, 0.14);
      statics.push(sway(paint(place(new THREE.IcosahedronGeometry(rnd.range(0.14, 0.22), 0), x + rnd.range(-0.08, 0.08), y, z, rnd.range(0, 3), rnd.range(0, 3)), rnd.pick([0x4f9a3e, 0x5aa644, 0x62a947]), rnd, 0.05), 0, 0.008));
      if (rnd.chance(0.55)) statics.push(sway(paint(place(new THREE.DodecahedronGeometry(0.075, 0), x + rnd.range(-0.1, 0.1), y + rnd.range(-0.05, 0.1), z + rnd.range(-0.12, 0.12)), rnd.pick([0xe8506a, 0xf07a8e, 0xfbd3dc, 0xfff4e6])), 0, 0.008));
    }
  }

  /* ── Benches in the garden, with a terracotta planter of flowers at each end ── */
  for (const b of L.GARDEN_BENCHES) {
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw), fx = -s, fz = -c; // the seat's back is towards -forward
    for (let k = 0; k < 4; k++) statics.push(paint(place(new THREE.BoxGeometry(1.8, 0.05, 0.11), b.x + fx * (-0.18 + k * 0.12), 0.48, b.z + fz * (-0.18 + k * 0.12), 0, b.yaw), 0xc08a58, rnd, 0.05));
    for (let k = 0; k < 3; k++) statics.push(paint(place(new THREE.BoxGeometry(1.8, 0.1, 0.04), b.x - fx * 0.26, 0.66 + k * 0.14, b.z - fz * 0.26, -0.18, b.yaw), 0xc08a58, rnd, 0.05));
    for (const e of [-0.8, 0.8]) {
      statics.push(paint(place(new THREE.BoxGeometry(0.07, 0.5, 0.5), b.x + c * e, 0.25, b.z - s * e, 0, b.yaw), 0x4a3f44));
      statics.push(paint(place(new THREE.BoxGeometry(0.07, 0.07, 0.5), b.x + c * e, 0.72, b.z - s * e, 0, b.yaw), 0x4a3f44));
    }
  }
  for (const p of L.PLANTERS) {
    statics.push(paint(place(new THREE.CylinderGeometry(0.34, 0.25, 0.52, 12), p.x, 0.26, p.z), 0xc9704a, rnd, 0.03));
    statics.push(paint(place(new THREE.TorusGeometry(0.33, 0.04, 4, 14), p.x, 0.51, p.z, Math.PI / 2), 0xb65f3e));
    statics.push(paint(place(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12), p.x, 0.49, p.z), 0x6b4a33));
    const col = rnd.pick([[0xf07aa0, 0xfff4dc], [0xf8cf4a, 0xe4574a], [0xc9a6f0, 0xffffff], [0xe8506a, 0xfbd3dc]]);
    for (let k = 0; k < 9; k++) statics.push(sway(paint(place(new THREE.IcosahedronGeometry(0.13, 0), p.x + rnd.range(-0.2, 0.2), 0.62 + rnd.range(0, 0.15), p.z + rnd.range(-0.2, 0.2), rnd.range(0, 3), rnd.range(0, 3)), rnd.pick([0x5aa644, 0x6cba5a]), rnd, 0.05), 0.5, 0.05));
    for (let k = 0; k < 10; k++) statics.push(sway(paint(place(new THREE.DodecahedronGeometry(0.06, 0), p.x + rnd.range(-0.25, 0.25), 0.7 + rnd.range(0, 0.18), p.z + rnd.range(-0.25, 0.25)), col[k % 2]), 0.5, 0.05));
  }

  /* ── Lamp glass glows softly (the bloom picks it up) ── */
  for (const l of L.LANTERNS) glows.push(place(new THREE.BoxGeometry(0.17, 0.26, 0.17), l.x, 1.78, l.z));

  /* ── A clipped hedge round the outside of the fence, broken at the gates ── */
  {
    const R = L.GARDEN.fenceR + 1.5, seg = 1.4 / R;
    for (let a = 0; a < Math.PI * 2; a += seg) {
      const deg = (a * 180) / Math.PI;
      if (L.inGate(deg) || L.inGate(deg - 2.5) || L.inGate(deg + 2.5)) continue;
      const g = new THREE.BoxGeometry(1.5, 1.15, 0.95, 3, 3, 2);
      // Soft, leafy: round the edges and push each vertex a little.
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const k = 1 + (rnd.next() - 0.5) * 0.12;
        p.setXYZ(i, x * k, (y + 0.575) * (1 - 0.08 * Math.abs(z) / 0.475) - 0.575 + (y > 0 ? rnd.range(-0.04, 0.05) : 0), z * k * (y > 0.3 ? 0.9 : 1));
      }
      statics.push(sway(paint(place(g, Math.cos(a) * R, 0.575, Math.sin(a) * R, 0, -a + Math.PI / 2), rnd.pick([0x62ad4c, 0x6bb553, 0x5aa447]), rnd, 0.07), 0.3, 0.012));
    }
  }

  /* ── Brick edging along the gravel paths (instanced) ── */
  {
    const pts = [];
    for (const i of [0, 3, 4, 7]) {
      const s = L.pathSamples(L.PATHS[i], 0.3);
      for (let k = 1; k < s.length - 1; k++) {
        const p = s[k], r = Math.hypot(p.x, p.z);
        if (r > L.GARDEN.fenceR - 0.2 || (i === 0 && p.z < 3.9) || (i === 3 && p.z > -4.2) || (i === 4 && Math.hypot(p.x + 4, p.z - 5.2) < 1.2)) continue;
        const tx = s[k + 1].x - s[k - 1].x, tz = s[k + 1].z - s[k - 1].z, tl = Math.hypot(tx, tz);
        const nx = -tz / tl, nz = tx / tl;
        for (const side of [-1, 1]) pts.push([p.x + nx * side * (L.GRAVEL.width / 2 + 0.06), p.z + nz * side * (L.GRAVEL.width / 2 + 0.06), Math.atan2(-tz, tx)]);
      }
    }
    // Where two paths meet, bricks of one fall on the other's gravel: drop those.
    const g = L.gravelPoints();
    const keep = pts.filter(([x, z]) => !g.some((q) => Math.abs(q.x - x) < 0.6 && Math.abs(q.z - z) < 0.6 && Math.hypot(q.x - x, q.z - z) < L.GRAVEL.width / 2 - 0.05));
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), keep.length);
    keep.forEach(([x, z, a], i) => {
      m.setMatrixAt(i, _m.compose(_v.set(x, 0.03, z), _q.setFromEuler(_e.set(0, a + rnd.range(-0.06, 0.06), rnd.range(-0.04, 0.04))), _s.set(1, 1, 1)));
      m.setColorAt(i, _c.setHex(rnd.pick([0xc0694a, 0xb35e42, 0xcc7a58, 0xa9573e])));
    });
    m.name = "path edging";
    m.receiveShadow = true;
    group.add(m);
    out.meshes.push(m);
  }

  /* ── Dry-stone walls across the meadows: instanced stones, one mesh per wall (so each is culled on its own) ── */
  {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    geo.scale(1.25, 0.62, 0.95);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const rows = q.tier === "high" ? 3 : 2, step = q.tier === "high" ? 0.42 : 0.55;
    out.wallStones = 0;
    for (const w of L.WALLS) {
      const stones = [];
      for (let i = 0; i < w.length - 1; i++) {
        const [ax, az] = w[i], [bx, bz] = w[i + 1];
        const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
        for (let t = 0; t < len; t += step) {
          const x = ax + ((bx - ax) * t) / len, z = az + ((bz - az) * t) / len;
          if (L.nearPath(x, z, 1.3) || L.inWater(x, z, 1.2) || L.inHall(x, z, 1)) continue;
          const y0 = H(x, z);
          for (let row = 0; row < rows; row++) {
            const s = rnd.range(0.22, 0.3) * (rows === 2 ? 1.2 : 1) * (row === rows - 1 ? 0.9 : 1);
            stones.push([x + rnd.range(-0.06, 0.06) + (row % 2) * 0.1, y0 + 0.13 + row * (rows === 2 ? 0.34 : 0.25), z + rnd.range(-0.08, 0.08), ang + rnd.range(-0.3, 0.3), s, row === rows - 1]);
          }
        }
      }
      if (!stones.length) continue;
      const m = new THREE.InstancedMesh(geo, mat, stones.length);
      stones.forEach(([x, y, z, a, s, cap], i) => {
        m.setMatrixAt(i, _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rnd.range(-0.2, 0.2), a, rnd.range(-0.2, 0.2))), _s.set(s, s * (cap ? 1.1 : 1), s)));
        m.setColorAt(i, _c.setHex(rnd.pick([0xcdc3b2, 0xbdb3a4, 0xd8d0c0, 0xb2a998, 0xc6c9b8])).offsetHSL(0, 0, rnd.range(-0.04, 0.04)));
      });
      m.computeBoundingSphere();
      m.castShadow = true; m.receiveShadow = true;
      m.name = "stone wall";
      group.add(m);
      out.meshes.push(m);
      out.wallStones += stones.length;
    }
  }

  /* ── Footbridges over the stream: a gently arched deck of planks, posts and rails ── */
  for (const b of L.BRIDGES) {
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    const endY = (u) => H(b.x + c * u, b.z - s * u);
    const y0 = endY(-b.len / 2), y1 = endY(b.len / 2);
    const deckAt = (u) => { const t = u / b.len + 0.5; return y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * Math.max(0.5, b.water + 0.75 - (y0 + y1) / 2) + 0.12; };
    const plank = 0.26;
    for (let u = -b.len / 2; u <= b.len / 2; u += plank + 0.03) {
      const y = deckAt(u), dy = (deckAt(u + 0.05) - deckAt(u - 0.05)) / 0.1;
      statics.push(paint(place(new THREE.BoxGeometry(plank, 0.07, b.w), b.x + c * u, y, b.z - s * u, 0, b.yaw, Math.atan(dy)), rnd.pick([0xb67d50, 0xa9744a, 0xc08a58]), rnd, 0.05));
    }
    for (const side of [-1, 1]) {
      const ox = s * side * (b.w / 2), oz = c * side * (b.w / 2);
      // Two beams under the deck.
      for (let u = -b.len / 2; u < b.len / 2; u += 0.6) {
        const y = deckAt(u + 0.3) - 0.12, dy = (deckAt(u + 0.6) - deckAt(u)) / 0.6;
        statics.push(paint(place(new THREE.BoxGeometry(0.62, 0.14, 0.12), b.x + c * (u + 0.3) + ox * 0.85, y, b.z - s * (u + 0.3) + oz * 0.85, 0, b.yaw, Math.atan(dy)), 0x8d5d3a));
      }
      // Posts and a rail.
      const posts = Math.max(3, Math.round(b.len / 1.6));
      for (let k = 0; k <= posts; k++) {
        const u = -b.len / 2 + 0.15 + ((b.len - 0.3) * k) / posts, y = deckAt(u);
        statics.push(paint(place(new THREE.BoxGeometry(0.1, 0.95, 0.1), b.x + c * u + ox, y + 0.45, b.z - s * u + oz), 0x9a6a44, rnd, 0.04));
      }
      for (let u = -b.len / 2 + 0.15; u < b.len / 2 - 0.2; u += 0.5) {
        const y = deckAt(u + 0.25) + 0.9, dy = (deckAt(u + 0.5) - deckAt(u)) / 0.5;
        statics.push(paint(place(new THREE.BoxGeometry(0.52, 0.08, 0.08), b.x + c * (u + 0.25) + ox, y, b.z - s * (u + 0.25) + oz, 0, b.yaw, Math.atan(dy)), 0xb67d50));
      }
    }
  }

  /* ── The third pond's shore, and reeds along the stream ── */
  {
    const P = L.POND3;
    for (let k = 0; k < 44; k++) {
      const a = (k / 44) * Math.PI * 2 + rnd.range(-0.05, 0.05), d = P.r + rnd.range(-0.1, 0.35);
      if (L.streamNear(P.x + Math.cos(a) * d, P.z + Math.sin(a) * d).d < L.STREAM.w + 0.8) continue; // where the stream flows in and out
      const s = rnd.range(0.22, 0.42);
      statics.push(paint(place(new THREE.DodecahedronGeometry(s, 0), P.x + Math.cos(a) * d, s * 0.1, P.z + Math.sin(a) * d, rnd.range(0, 3), rnd.range(0, 3), 0, 1, 0.55, 1), rnd.pick([0xdcd3c6, 0xcfc4b3, 0xe6ded2]), rnd, 0.05));
    }
    for (let k = 0; k < 18; k++) {
      const a = rnd.range(0, Math.PI * 2), d = Math.sqrt(rnd.next()) * (P.r - 0.8);
      const r = rnd.range(0.28, 0.48), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
      statics.push(paint(place(new THREE.CircleGeometry(r, 10, 0.35, Math.PI * 2 - 0.5), x, -0.02, z, -Math.PI / 2, 0, rnd.range(0, 6.28)), rnd.pick([0x5fae4f, 0x6fbf5a, 0x58a54a]), rnd, 0.04));
      if (k % 3 === 0) {
        for (let p = 0; p < 8; p++) statics.push(paint(place(new THREE.ConeGeometry(0.06, 0.17, 3), x + Math.cos(p * 0.8) * 0.07, 0.05, z + Math.sin(p * 0.8) * 0.07, Math.cos(p * 0.8) * 0.6, 0, -Math.sin(p * 0.8) * 0.6), p % 2 ? 0xfff4dc : 0xf7b8cf));
        statics.push(paint(place(new THREE.IcosahedronGeometry(0.045, 0), x, 0.08, z), 0xf6d04d));
      }
    }
    const reedsAt = (x, z, n, spread) => {
      for (let k = 0; k < n; k++) {
        const rx = x + rnd.range(-spread, spread), rz = z + rnd.range(-spread, spread), y0 = H(rx, rz), h = rnd.range(0.8, 1.5);
        statics.push(sway(paint(place(new THREE.ConeGeometry(0.03, h, 3), rx, y0 + h / 2 - 0.05, rz, rnd.range(-0.12, 0.12), 0, rnd.range(-0.12, 0.12)), rnd.pick([0x6a9e48, 0x78aa52, 0x5d9442])), y0, 0.05));
        if (k % 3 === 0) statics.push(sway(paint(place(new THREE.CylinderGeometry(0.05, 0.05, 0.24, 6), rx, y0 + h - 0.1, rz), 0x7a4e2c), y0, 0.05));
      }
    };
    for (let k = 0; k < 7; k++) { const a = rnd.range(3.4, 5.6); reedsAt(P.x + Math.cos(a) * (P.r + 0.2), P.z + Math.sin(a) * (P.r + 0.2), 6, 0.45); }
    // Clumps along the stream's banks, near enough to be seen.
    const S = L.streamSamples();
    for (let i = 0; i < S.length; i += 5) {
      const p = S[i], r = Math.hypot(p.x, p.z);
      if (r < 48 || r > (q.tier === "low" ? 110 : 150) || Math.hypot(p.x - P.x, p.z - P.z) < P.r + 2 || L.onBridge(p.x, p.z, 2.5)) continue;
      if (!rnd.chance(0.55)) continue;
      const q2 = S[Math.min(S.length - 1, i + 1)], tx = q2.x - p.x, tz = q2.z - p.z, tl = Math.hypot(tx, tz) || 1, side = rnd.chance(0.5) ? 1 : -1;
      reedsAt(p.x - (tz / tl) * side * (L.STREAM.w / 2 + 1.1), p.z + (tx / tl) * side * (L.STREAM.w / 2 + 1.1), 5, 0.4);
      if (rnd.chance(0.35)) {
        const a = rnd.range(0, 6.28), s = rnd.range(0.25, 0.5), bx = p.x - (tz / tl) * -side * (L.STREAM.w / 2 + 0.7), bz = p.z + (tx / tl) * -side * (L.STREAM.w / 2 + 0.7);
        statics.push(paint(place(new THREE.DodecahedronGeometry(s, 0), bx, H(bx, bz) + s * 0.2, bz, a, a * 2, 0, 1, 0.6, 1), rnd.pick([0xcfc4b3, 0xbdb3a4, 0xd8d0c0]), rnd, 0.05));
      }
    }
  }
  return out;
}
