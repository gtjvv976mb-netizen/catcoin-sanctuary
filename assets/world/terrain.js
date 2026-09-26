/* The ground: one smooth heightmapped mesh from the cottage out to the far ridge (layout.js
   groundHeight), in round bands that get coarser with distance (each band's first ring is the last
   one of the band inside it, so they meet with no cracks). Each vertex carries how much of four surfaces it shows (lawn, earth, gravel, stone), a
   tint (lush lawn in the garden, sunnier meadow grass, deep hill greens, a blue haze far off) and
   how much it is shaded by what stands on it (a soft contact shadow under trees, walls and props).
   The fragment shader blends the four small tiling textures (textures.js) by those weights,
   breaking their repeats with a second scale, and fades them to their average colour far away. */

import * as THREE from "three";
import * as L from "./layout.js";
import { groundTextures } from "./textures.js";

const smooth = L.smooth;
const _c = new THREE.Color(), _c2 = new THREE.Color();

/** Cheap 2D value noise (not tiled), 0..1. */
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x, z) {
  const x0 = Math.floor(x), z0 = Math.floor(z), fx = x - x0, fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(x0, z0), b = hash2(x0 + 1, z0), c = hash2(x0, z0 + 1), d = hash2(x0 + 1, z0 + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

/* ── What the ground is made of at a point ── */

let gravelGrid = null;
function gravelDist(x, z) {
  if (!gravelGrid) {
    gravelGrid = new Map();
    for (const s of L.gravelPoints()) {
      const k = `${Math.floor(s.x / 4)},${Math.floor(s.z / 4)}`;
      if (!gravelGrid.has(k)) gravelGrid.set(k, []);
      gravelGrid.get(k).push(s);
    }
  }
  let best = 9;
  const gx = Math.floor(x / 4), gz = Math.floor(z / 4);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const list = gravelGrid.get(`${gx + a},${gz + b}`);
    if (list) for (const s of list) { const d = Math.hypot(s.x - x, s.z - z); if (d < best) best = d; }
  }
  return best;
}
let stoneGrid = null;
function stoneDist(x, z) {
  if (!stoneGrid) {
    stoneGrid = new Map();
    for (const s of L.pathStones()) {
      if (Math.hypot(s.x, s.z) < L.GARDEN.fenceR + 0.8 && s.path !== 5 && s.path !== 6) continue;
      const k = `${Math.floor(s.x / 4)},${Math.floor(s.z / 4)}`;
      if (!stoneGrid.has(k)) stoneGrid.set(k, []);
      stoneGrid.get(k).push(s);
    }
  }
  let best = 9;
  const gx = Math.floor(x / 4), gz = Math.floor(z / 4);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const list = stoneGrid.get(`${gx + a},${gz + b}`);
    if (list) for (const s of list) { const d = Math.hypot(s.x - x, s.z - z); if (d < best) best = d; }
  }
  return best;
}
function rectDist(x, z, r) {
  const dx = Math.max(r.minX - x, 0, x - r.maxX), dz = Math.max(r.minZ - z, 0, z - r.maxZ);
  return Math.hypot(dx, dz);
}

/**
 * The surface at (x, z): weights for lawn/meadow grass, earth, gravel and stone (they sum to 1),
 * and `grass` (0..1), how much grass grows there (for the blades).
 */
export function surfaceAt(x, z, slope = 0) {
  const r = Math.hypot(x, z);
  let earth = 0, gravel = 0, stone = 0;
  const n = vnoise(x * 0.9, z * 0.9);
  // Gravel paths inside the fence, with a crisp edge.
  if (r < L.GARDEN.fenceR + 1.5) {
    const g = gravelDist(x, z);
    gravel = Math.max(gravel, 1 - smooth(L.GRAVEL.width * 0.5 - 0.1, L.GRAVEL.width * 0.5 + 0.12, g));
    // Worn earth: the foot of the stairs, the feeding corners, round the cottage, round the beds of the kitchen garden.
    earth = Math.max(earth,
      1 - smooth(0.3, 1.6, Math.hypot(x - L.STEP.ground.x, z - L.STEP.ground.z)),
      (1 - smooth(0.1, 1.0, rectDist(x, z, L.HOUSE))) * 0.9,
      (1 - smooth(0.2, 1.4, rectDist(x, z, L.GREENHOUSE))) * 0.7, (1 - smooth(0.2, 1.4, rectDist(x, z, L.SHED))) * 0.8,
    );
    for (const [fx, fz] of L.FEEDING_CORNERS) if (Math.abs(x - fx) < 2 && Math.abs(z - fz) < 2) earth = Math.max(earth, (1 - smooth(0.4, 2.0, Math.hypot(x - fx, z - fz))) * 0.8);
    for (const v of L.VEG_BEDS) if (x > v.minX - 0.7 && x < v.maxX + 0.7 && z > v.minZ - 0.7 && z < v.maxZ + 0.7) earth = Math.max(earth, (1 - smooth(0.05, 0.7, rectDist(x, z, v))) * 0.85);
    earth *= 0.75 + n * 0.5;
  } else {
    // Stepping-stone strips out in the meadows: trodden, a little earthy.
    const sd = stoneDist(x, z);
    earth = Math.max(earth, (1 - smooth(0.35, 1.1, sd)) * (0.45 + n * 0.35));
  }
  // Shores: a band of gravel and pebbles round each pond, stones and gravel in the stream.
  for (const P of [L.POND, L.POND2, L.POND3]) {
    const d = Math.hypot(x - P.x, z - P.z) - P.r;
    if (d < 2.2) { gravel = Math.max(gravel, 1 - smooth(0.2, 1.1 + n * 0.8, d)); stone = Math.max(stone, (1 - smooth(-0.6, 0.4, d)) * 0.6); }
  }
  if (r > 44) {
    const s = L.streamNear(x, z);
    const half = L.STREAM.w * 0.5;
    if (s.d < half + 3) {
      gravel = Math.max(gravel, 1 - smooth(half + 0.6, half + 1.8 + n, s.d));
      stone = Math.max(stone, (1 - smooth(half - 0.2, half + 0.9, s.d)) * (0.5 + n * 0.5));
    }
  }
  // The plaza's surroundings: a ring of gravel round the paving.
  const dh = Math.hypot(x - L.HALL_OF_FAME.x, z - L.HALL_OF_FAME.z) - L.HALL_OF_FAME.r;
  if (dh < 1.6) gravel = Math.max(gravel, 1 - smooth(0.6, 1.5, dh));
  // Steep hillsides and the far ridge show rock.
  stone = Math.max(stone, smooth(0.42, 0.7, slope + (n - 0.5) * 0.2));
  if (r > 300) stone = Math.max(stone, smooth(34, 58, L.groundHeight(x, z)) * 0.7);
  // Normalise: the textured surfaces take their share, grass the rest.
  const hard = Math.min(1, gravel + earth + stone);
  const k = hard > 0 ? hard / (gravel + earth + stone) : 0;
  gravel *= k; earth *= k; stone *= k;
  const grassW = 1 - hard;
  return { grassW, earth, gravel, stone, grass: grassW * (r < 3.5 ? 0 : 1) };
}

/** The ground's tint at (x, z): lawn, meadow, hills and far haze, with broad patches of colour. */
export function tintAt(x, z, h, out = new THREE.Color()) {
  const r = Math.hypot(x, z);
  const n1 = vnoise(x * 0.045, z * 0.045), n2 = vnoise(x * 0.16 + 7, z * 0.16 - 3), n = n1 * 0.65 + n2 * 0.35;
  if (r < L.GARDEN.fenceR + 1) {
    out.setHex(0x74c24e).lerp(_c2.setHex(0x9ad466), n);
    // Mown stripes on the lawn: alternate bands a shade lighter.
    const stripe = Math.sin((x * 0.7 + z * 0.7) * 0.9) > 0 ? 1 : 0;
    out.lerp(_c2.setHex(0xb3e07a), stripe * 0.14 * smooth(3, 8, r));
  } else {
    out.setHex(0x9ccf5c).lerp(_c2.setHex(0xc4d86c), n);
    out.lerp(_c2.setHex(0x86c858), 1 - smooth(L.GARDEN.fenceR, L.GARDEN.fenceR + 10, r));
    // Mown rings either side of the ring paths, a little greener.
    const ring = Math.max(1 - smooth(4, 9, Math.abs(r - L.MEADOW.ring1.path)), 1 - smooth(5, 11, Math.abs(r - L.MEADOW.ring2.path)));
    if (ring > 0) out.lerp(_c2.setHex(0x8ccd5a), ring * 0.3);
    // Wildflower-rich patches read warmer; damp hollows greener.
    out.lerp(_c2.setHex(0xd8d27a), smooth(0.62, 0.85, n2) * 0.25 * smooth(40, 70, r));
    // The hills: deeper, bluer greens, lighter on top.
    const hill = smooth(100, 170, r);
    if (hill > 0) { _c.setHex(0x6fb45a).lerp(_c2.setHex(0x93c46a), n); out.lerp(_c, hill); }
    const far = smooth(240, 420, r);
    if (far > 0) { _c.setHex(0x8fbf8a).lerp(_c2.setHex(0xa5cba0), n); out.lerp(_c, far); }
    if (h > 40) out.lerp(_c2.setHex(0xe4ece8), smooth(46, 64, h) * 0.6);
  }
  return out;
}

/**
 * Builds the ground mesh.
 * @param {THREE.Scene} scene
 * @param {object} o
 * @param {THREE.WebGLRenderer} o.renderer
 * @param {object} o.q        the quality tier (world.js)
 * @param {Array<{x:number,z:number,r:number,k:number}>} o.shade  soft contact shadows to bake in (trees, props)
 */
export function buildTerrain(scene, { renderer, q, shade }) {
  // Shade blobs in a coarse grid, for quick lookups.
  const SG = 8, sgrid = new Map();
  for (const b of shade) {
    const x0 = Math.floor((b.x - b.r) / SG), x1 = Math.floor((b.x + b.r) / SG), z0 = Math.floor((b.z - b.r) / SG), z1 = Math.floor((b.z + b.r) / SG);
    for (let i = x0; i <= x1; i++) for (let k = z0; k <= z1; k++) { const key = `${i},${k}`; if (!sgrid.has(key)) sgrid.set(key, []); sgrid.get(key).push(b); }
  }
  const aoAt = (x, z) => {
    const list = sgrid.get(`${Math.floor(x / SG)},${Math.floor(z / SG)}`);
    let ao = 1;
    if (list) for (const b of list) {
      const d = b.rect ? rectDist(x, z, b.rect) : Math.hypot(x - b.x, z - b.z);
      if (d < b.r) ao *= 1 - b.k * (1 - smooth(0, b.r, d)) ** 1.6;
    }
    return Math.max(0.35, ao);
  };

  // Bands: [inner radius, outer radius, radial step, segments round].
  const f = q.terrain; // 1 on desktops, 0.5 on phones
  const bands = [
    [0, 10, 0.8, Math.round(96 * f) * 2],
    [10, 46, 0.75 / Math.sqrt(f), Math.round(384 * f) * 2],
    [46, 124, 1.35 / Math.sqrt(f), Math.round(384 * f) * 2],
    [124, 300, 3.6 / Math.sqrt(f), Math.round(192 * f) * 2],
    [300, 760, 11, Math.round(96 * f) * 2],
  ];
  const pos = [], nor = [], col = [], spl = [], idx = [];
  const H = L.groundHeight;
  const e = 0.6;
  // The garden is flat, bar the pond's basin: no need to sample its slope.
  const flatAt = (x, z) => Math.hypot(x, z) < 39.5 && Math.hypot(x - L.POND.x, z - L.POND.z) > L.POND.r + 1;
  function vertex(x, z) {
    const y = H(x, z);
    const flat = flatAt(x, z);
    const dx = flat ? 0 : H(x + e, z) - H(x - e, z), dz = flat ? 0 : H(x, z + e) - H(x, z - e);
    const nx = -dx, ny = 2 * e, nz = -dz, nl = Math.hypot(nx, ny, nz);
    const slope = 1 - ny / nl;
    const s = surfaceAt(x, z, slope * 2.2);
    tintAt(x, z, y, _c);
    const ao = aoAt(x, z);
    pos.push(x, y, z); nor.push(nx / nl, ny / nl, nz / nl);
    col.push(_c.r * ao, _c.g * ao, _c.b * ao);
    spl.push(s.earth, s.gravel, s.stone, ao);
    return pos.length / 3 - 1;
  }
  let prevRing = null; // [indices], and its segment count
  bands.forEach(([r0, r1, step, seg]) => {
    const radii = [];
    for (let r = r0; r < r1 - step * 0.5; r += step) radii.push(r);
    radii.push(r1);
    radii.forEach((r, ri) => {
      if (ri === 0 && prevRing) return; // shares the previous band's last ring
      const ring = [];
      if (r === 0) { ring.push(vertex(0, 0)); }
      else {
        for (let k = 0; k < seg; k++) {
          const a = (k / seg) * Math.PI * 2;
          ring.push(vertex(Math.cos(a) * r, Math.sin(a) * r));
        }
      }
      if (prevRing) stitch(prevRing, ring);
      prevRing = ring;
    });
  });
  function stitch(inner, outer) {
    const ni = inner.length, no = outer.length;
    if (ni === 1) { for (let k = 0; k < no; k++) idx.push(inner[0], outer[(k + 1) % no], outer[k]); return; }
    // Walk both rings together (they may have different counts).
    let i = 0, o = 0;
    while (i < ni || o < no) {
      const ti = (i + 1) / ni, to = (o + 1) / no;
      if (o < no && (i >= ni || to <= ti)) { idx.push(inner[i % ni], outer[(o + 1) % no], outer[o % no]); o++; }
      else { idx.push(inner[i % ni], inner[(i + 1) % ni], outer[o % no]); i++; }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("aSplat", new THREE.Float32BufferAttribute(spl, 4));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingSphere();

  const T = groundTextures(renderer, q.texSize);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, envMapIntensity: 0.55 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { tLawn: { value: T.lawn }, tEarth: { value: T.earth }, tGravel: { value: T.gravel }, tStone: { value: T.stone } });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aSplat;\nvarying vec4 vSplat;\nvarying vec3 vWorldP;")
      .replace("#include <fog_vertex>", "#include <fog_vertex>\nvSplat = aSplat;\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", /* glsl */`#include <common>
        uniform sampler2D tLawn, tEarth, tGravel, tStone;
        varying vec4 vSplat;
        varying vec3 vWorldP;
        vec3 tri(sampler2D t, vec2 p, float s) { return mix(texture2D(t, p * s).rgb, texture2D(t, p * s * 0.27 + 0.37).rgb, 0.35); }`)
      .replace("#include <color_fragment>", /* glsl */`
        vec2 wp = vWorldP.xz;
        float dist = length(vWorldP - cameraPosition);
        float detail = 1.0 - smoothstep(60.0, 260.0, dist);
        vec3 lawn = tri(tLawn, wp, 0.42);
        vec3 earth = tri(tEarth, wp, 0.38);
        vec3 grav = tri(tGravel, wp, 0.62);
        vec3 stone = tri(tStone, wp, 0.16);
        // Each texture's own brightness sharpens the blend, so pebbles poke out of the grass rather than fading into it.
        float ge = vSplat.x, gg = vSplat.y, gs = vSplat.z;
        float gw = max(0.0, 1.0 - ge - gg - gs);
        vec4 w = vec4(gw * (0.6 + lawn.g * 0.6), ge * (0.6 + earth.r * 0.6), gg * (0.4 + grav.r * 1.0), gs * (0.6 + stone.r * 0.6));
        w = pow(w, vec4(1.6));
        w /= max(1e-4, w.x + w.y + w.z + w.w);
        vec3 lawnC = lawn * vColor.rgb * 1.32;
        float ao = vSplat.w;
        vec3 ground = lawnC * w.x + earth * w.y * ao + grav * w.z * ao + stone * w.w * ao;
        vec3 flatC = vColor.rgb * 1.08 * w.x + vec3(0.62, 0.48, 0.34) * w.y * ao + vec3(0.76, 0.71, 0.63) * w.z * ao + vec3(0.72, 0.7, 0.66) * w.w * ao;
        diffuseColor.rgb *= mix(flatC, ground, detail);`);
  };
  mat.customProgramCacheKey = () => "terrain-v1";
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = "ground";
  scene.add(mesh);
  return { mesh, triangles: idx.length / 3 };
}
