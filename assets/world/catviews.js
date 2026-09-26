/* Drawing the cats. Every pose of every model is one InstancedMesh, so all ninety-odd cats cost
   five draw calls (ten with the ginger tabby set): each frame, every cat writes its matrix and
   its coat into the mesh for the pose it is in.

   Coats are painted in the shader (onBeforeCompile on the models' own material). Each instance
   carries its coat: a base colour, a second colour, a pattern and an eye colour. The pattern is
   worked out from the model-space position of each point on the cat (every pose is fitted to one
   cat size, x forward and y up), so the same markings read on a sitting, walking or sleeping cat:

     0 solid   1 tabby stripes (mackerel; bold for a tiger)   2 tuxedo   3 calico patches
     4 point (darker ears, face, paws, tail)   5 spotted   6 bicolor   7 tortie
     8 classic tabby (swirls on the flank)   9 ticked   10 van (white, coloured cap, ears, tail)
     11 patch (white, one patch over an ear)

   On top of the pattern, from the cat's look (looks.js): white chest, paws, muzzle, belly or a
   nose blaze; a white or dark tail tip, a ringed or bobbed tail; a lion's mane; a jacket. Big
   cats are drawn bigger. What a cat wears (hats, collars, bows, glasses, ...) is drawn as small
   low-poly meshes that follow its head (buildWear, below), one InstancedMesh per kind and pose.

   The cream model's own texture is kept for its shading, eyes and nose; its darker "points" say
   where the ears, muzzle, paws and tail are. The ginger model is an orange tabby as modelled and
   is only lightly tinted towards the cat's base colour.

   Each pose is drawn from a lighter copy of its model (decimate(), below): at the size a cat
   appears on screen the two look the same, and it halves the triangles for ninety-odd cats. */

import * as THREE from "three";
import { POSES } from "./cats.js";
import { CAT } from "./layout.js";
import { AMBIENT } from "./ambient.js";
import { findRig, buildSkeleton, skinWeights, makeClips, cyclesPerUnit } from "./catrig.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { lookOf } from "./looks.js";

/** Pose ids for the shader's procedural animation. */
const POSE_ID = { walk: 0, sit: 1, loaf: 2, stretch: 3, sleep: 4 };
/** Per pose: where the tail starts (x, in fitted units, and which heights belong to it), and how the head is found. */
const TAIL = { walk: [-0.36, 0.3, 9], sit: [-0.2, -1, 0.36], loaf: [-0.42, -1, 0.34], stretch: [-0.46, 0.5, 9], sleep: [9, 0, 0] };
const HEAD = { walk: (x, y, L, H) => x > 0.3 && y > 0.55, sit: (x, y, L, H) => y > 0.8 * H, loaf: (x, y, L, H) => x > 0.15 && y > 0.6 * H, stretch: () => false, sleep: () => false };

/** Each pose's scale to one cat size (the prototype's FIT table): a sitting cat is CAT.size tall. */
const FIT = {
  sit: (b) => CAT.size / b.y,
  walk: (b) => (CAT.size * 0.95) / b.y,
  loaf: (b) => (CAT.size * 1.05) / b.x,
  stretch: (b) => (CAT.size * 1.2) / b.x,
  sleep: (b) => (CAT.size * 0.8) / Math.max(b.x, b.z),
};
/** Small heading corrections, measured: the cream walking cat was modelled turned about 40° off +x. */
const YAW_FIX = { "cat-walk": -0.66 };

export const PATTERNS = ["solid", "tabby", "tuxedo", "calico", "point", "spotted", "bicolor", "tortie", "classic", "ticked", "van", "patch"];

/** Reads a texture's pixels (for the eyes and the reference colours). Null if the browser can't. */
function pixels(image) {
  try {
    const w = image.width, h = image.height;
    const cv = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const g = cv.getContext("2d", { willReadFrequently: true });
    g.drawImage(image, 0, 0);
    return { w, h, data: g.getImageData(0, 0, w, h).data };
  } catch { return null; }
}
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };

/**
 * A lighter copy of a cat for small screens and far away: vertices closer than `cell` (and on
 * the same part of the texture) are merged into one, and triangles that collapse are dropped.
 * Positions and normals are averaged; each merged vertex keeps the texture coordinate of the
 * vertex nearest the average, so the eyes and markings stay where they were.
 */
export function decimate(geometry, cell, uvMatrix = null) {
  const P = geometry.attributes.position, N = geometry.attributes.normal, UV = geometry.attributes.uv;
  const idx = geometry.index ? geometry.index.array : Array.from({ length: P.count }, (_, i) => i);
  const t = new THREE.Vector2();
  // 1. Merge positions by grid cell (so neighbouring triangles stay joined: no cracks).
  const cellOf = new Map(), pc = new Int32Array(P.count), cells = [];
  for (let i = 0; i < P.count; i++) {
    const k = `${Math.floor(P.getX(i) / cell)},${Math.floor(P.getY(i) / cell)},${Math.floor(P.getZ(i) / cell)}`;
    let c = cellOf.get(k);
    if (c === undefined) { c = cells.length; cellOf.set(k, c); cells.push({ x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, n: 0 }); }
    const a = cells[c];
    a.x += P.getX(i); a.y += P.getY(i); a.z += P.getZ(i); a.nx += N.getX(i); a.ny += N.getY(i); a.nz += N.getZ(i); a.n++;
    pc[i] = c;
  }
  for (const a of cells) { a.x /= a.n; a.y /= a.n; a.z /= a.n; const l = Math.hypot(a.nx, a.ny, a.nz) || 1; a.nx /= l; a.ny /= l; a.nz /= l; }
  // 2. One output vertex per cell and part of the texture, so texture seams keep their own coordinates.
  const vOf = new Map(), vtx = new Int32Array(P.count), verts = [];
  for (let i = 0; i < P.count; i++) {
    t.fromBufferAttribute(UV, i);
    if (uvMatrix) t.applyMatrix3(uvMatrix);
    const k = `${pc[i]}|${Math.floor(t.x * 12)},${Math.floor(t.y * 12)}`;
    let v = vOf.get(k);
    const a = cells[pc[i]];
    const d = (P.getX(i) - a.x) ** 2 + (P.getY(i) - a.y) ** 2 + (P.getZ(i) - a.z) ** 2;
    if (v === undefined) { v = verts.length; vOf.set(k, v); verts.push({ c: pc[i], src: i, d }); }
    else if (d < verts[v].d) { verts[v].src = i; verts[v].d = d; }
    vtx[i] = v;
  }
  const pos = new Float32Array(verts.length * 3), nrm = new Float32Array(verts.length * 3), uv = new Float32Array(verts.length * 2);
  verts.forEach((v, j) => {
    const a = cells[v.c];
    pos.set([a.x, a.y, a.z], j * 3);
    nrm.set([a.nx, a.ny, a.nz], j * 3);
    uv.set([UV.getX(v.src), UV.getY(v.src)], j * 2);
  });
  // 3. Keep the triangles whose corners landed in three different cells.
  const out = [], seen = new Set();
  for (let f = 0; f < idx.length; f += 3) {
    const i0 = idx[f], i1 = idx[f + 1], i2 = idx[f + 2];
    if (pc[i0] === pc[i1] || pc[i1] === pc[i2] || pc[i0] === pc[i2]) continue;
    const k = [pc[i0], pc[i1], pc[i2]].sort((p, q) => p - q).join(",");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(vtx[i0], vtx[i1], vtx[i2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(out);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/**
 * The head's frame on a posed model, for what a cat wears: its centre, radius, forward (towards
 * the eyes), up and side, the top of the skull, and the neck (a ring's centre, axis and radius).
 */
export function headFrame(pos, eye, head, size, pose = "sit") {
  const n = pos.length / 3, V = (i) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  let maxX = -Infinity, H = 0;
  for (let i = 0; i < n; i++) { maxX = Math.max(maxX, pos[i * 3]); H = Math.max(H, pos[i * 3 + 1]); }
  // The head's points: the top of a sitting cat, the front of the others (every pose faces +x).
  const inHead = {
    sit: (p) => p.y > 0.78 * H,
    walk: (p) => p.x > maxX - 0.34 && p.y > 0.5 * H,
    loaf: (p) => p.x > maxX - 0.4 && p.y > 0.45 * H,
    stretch: (p) => p.x > maxX - 0.34 && p.y > 0.2 * H,
    sleep: (p) => p.x > maxX - 0.38 && p.y > 0.35 * H,
  }[pose] || ((p) => p.y > 0.78 * H);
  const pts = [];
  for (let i = 0; i < n; i++) { const p = V(i); if (inHead(p)) pts.push(p); }
  if (pts.length < 12) return null;
  // Leave the ears out of the centre: the highest tenth of the head's points.
  const ys = pts.map((p) => p.y).sort((a, b) => a - b), earY = ys[Math.floor(ys.length * 0.88)];
  const skull = pts.filter((p) => p.y <= earY);
  const C = skull.reduce((m, p) => m.add(p), new THREE.Vector3()).divideScalar(skull.length);
  const ds = skull.map((p) => p.distanceTo(C)).sort((a, b) => a - b);
  const r = Math.max(0.08, Math.min(0.2, ds[Math.floor(ds.length * 0.5)]));
  // Forward: towards the nose (the front-most point near the head's middle height).
  let nose = C.clone().add(new THREE.Vector3(r, 0, 0));
  for (const p of skull) if (Math.abs(p.z - C.z) < r * 0.3 && Math.abs(p.y - C.y) < r * 0.7 && p.x > nose.x) nose = p.clone();
  const f = nose.clone().sub(C); f.z = 0; f.y *= 0.5; f.normalize();
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(f, -f.y).normalize();
  const side = new THREE.Vector3().crossVectors(f, up).normalize();
  // The top of the skull: the highest point on the head's middle line, between the ears.
  let top = C.y + r * 0.6;
  for (const p of pts) if (Math.abs(p.z - C.z) < r * 0.22 && Math.abs(p.x - C.x) < r * 0.5) top = Math.max(top, p.y);
  top = Math.min(Math.max(top, earY - r * 0.1), C.y + r * 1.3);
  // The neck: below and behind the head's centre.
  const axis = pose === "sit" ? new THREE.Vector3(0.25, 1, 0).normalize() : pose === "sleep" ? new THREE.Vector3(1, 0.15, 0).normalize() : new THREE.Vector3(1, 0.9, 0).normalize();
  const N = C.clone().addScaledVector(axis, -r * 0.95);
  const radii = [];
  for (let i = 0; i < n; i++) {
    const d = V(i).sub(N), along = d.dot(axis);
    if (Math.abs(along) < 0.025) { const rr = d.addScaledVector(axis, -along).length(); if (rr < r * 1.8) radii.push(rr); }
  }
  radii.sort((a, b) => a - b);
  const rn = radii.length > 8 ? radii[Math.floor(radii.length * 0.85)] : r * 0.85;
  return { C, r, f, up, side, top, neck: { N, axis, r: Math.max(r * 0.55, Math.min(rn * 0.7, r * 0.75)) } };
}

/** Loads the ten cat models; bakes each pose's fit into its geometry; finds its eyes. */
export async function loadCatModels(loader, base = "assets/models/", { cell = 0.06 } = {}) {
  const out = { cat: {}, ginger: {} };
  await Promise.all(["cat", "ginger"].flatMap((coat) => POSES.map(async (pose) => {
    const gltf = await loader.loadAsync(`${base}${coat}-${pose}.glb`);
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    let mesh = null;
    root.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh) throw new Error(`no mesh in ${coat}-${pose}.glb`);
    const fix = new THREE.Matrix4().makeRotationY(YAW_FIX[`${coat}-${pose}`] || 0);
    const toModel = new THREE.Matrix4().multiplyMatrices(fix, mesh.matrixWorld);
    // Measure the posed model exactly (vertex by vertex; quantized attributes read fine).
    const src = mesh.geometry, P = src.attributes.position, N = src.attributes.normal;
    const box = new THREE.Box3(), v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) box.expandByPoint(v.fromBufferAttribute(P, i).applyMatrix4(toModel));
    const size = box.getSize(new THREE.Vector3());
    const s = FIT[pose](size);
    const fit = new THREE.Matrix4().makeScale(s, s, s)
      .multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2))
      .multiply(toModel);
    // Bake the fit into plain float attributes (so the shader sees one cat size, x forward, y up).
    const pos = new Float32Array(P.count * 3), nrm = new Float32Array(P.count * 3);
    const nm = new THREE.Matrix3().getNormalMatrix(fit);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(fit); pos.set([v.x, v.y, v.z], i * 3);
      if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nrm.set([v.x, v.y, v.z], i * 3); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    if (N) geometry.setAttribute("normal", new THREE.BufferAttribute(nrm, 3)); else geometry.computeVertexNormals();
    geometry.setAttribute("uv", src.attributes.uv);
    if (src.index) geometry.setIndex(src.index);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const material = mesh.material;
    material.color?.set(0xffffff);
    const map = material.map;
    // Reference colours from the texture, and where the eyes are (the darkest texels).
    const ref = { lum: 0.62, color: new THREE.Color(0.9, 0.5, 0.2) };
    const eye = new THREE.Vector3(size.x * s * 0.35, size.y * s * 0.75, 0);
    const px = map?.image ? pixels(map.image) : null;
    if (px) {
      const lums = [];
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < px.data.length; i += 4 * 7) {
        const R = lin(px.data[i]), G = lin(px.data[i + 1]), B = lin(px.data[i + 2]);
        lums.push(0.2126 * R + 0.7152 * G + 0.0722 * B);
        r += R; g += G; b += B; n++;
      }
      lums.sort((a, c) => a - c);
      ref.lum = lums[Math.floor(lums.length * 0.7)];
      ref.color.setRGB(r / n, g / n, b / n);
      map.updateMatrix();
      const uv = src.attributes.uv, t = new THREE.Vector2(), sum = new THREE.Vector3();
      let k = 0;
      for (let i = 0; i < uv.count; i++) {
        t.fromBufferAttribute(uv, i).applyMatrix3(map.matrix);
        const x = Math.floor((t.x - Math.floor(t.x)) * px.w), y = Math.floor((t.y - Math.floor(t.y)) * px.h);
        const o = (Math.min(px.h - 1, y) * px.w + Math.min(px.w - 1, x)) * 4;
        const l = 0.2126 * lin(px.data[o]) + 0.7152 * lin(px.data[o + 1]) + 0.0722 * lin(px.data[o + 2]);
        if (l < 0.03) { sum.add(v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])); k++; }
      }
      if (k >= 3) eye.copy(sum.divideScalar(k));
    }
    geometry.boundingBox.getSize(v);
    // The head: the middle of the points the pose's rule picks out (for looking about and the bigger, cuter head).
    const head = new THREE.Vector3(); let nh = 0;
    for (let i = 0; i < P.count; i++) if (HEAD[pose](pos[i * 3], pos[i * 3 + 1], v.x, v.y)) { head.x += pos[i * 3]; head.y += pos[i * 3 + 1]; head.z += pos[i * 3 + 2]; nh++; }
    if (nh > 20) head.divideScalar(nh); else head.set(0, -9, 0);
    if (map) map.updateMatrix();
    // The cats are drawn from a lighter copy (about half the triangles; a little fewer again on phones).
    const lite = cell > 0 ? decimate(geometry, cell, map ? map.matrix : null) : geometry;
    // …and a much lighter one again for cats far across the meadows (a few hundred triangles).
    const far = decimate(geometry, Math.max(cell, 0.045) * 2.6, map ? map.matrix : null);
    // How long the tail is (for its tip), and the head's frame and the neck (for what the cat wears).
    const [tx, ty0, ty1] = TAIL[pose];
    let tailLen = 0;
    for (let i = 0; i < P.count; i++) { const x = pos[i * 3], y = pos[i * 3 + 1]; if (x < tx && y > ty0 && y < ty1) tailLen = Math.max(tailLen, tx - x); }
    const frame = headFrame(pos, eye, head, v, pose);
    out[coat][pose] = { geometry, lite, far, material, len: v.x, height: v.y, width: v.z, eye, head, pose, ref, ginger: coat === "ginger", tailLen: Math.max(tailLen, 0.05), frame };
  })));
  return out;
}

/* ── The coat shader ─────────────────────────────────────────────────── */

const VERT_HEAD = /* glsl */`
attribute vec4 aCoatA; // base colour (linear rgb), pattern id
attribute vec4 aCoatB; // second colour, seed
attribute vec4 aCoatC; // eye colour, highlight
attribute vec4 aCoatD; // white-mark flags, tail (1 white tip, 2 dark tip, 3 bob, 4 ringed), mane, stripe strength
attribute vec4 aCoatE; // garment colour, garment (1 jacket)
attribute vec4 aAnim;  // stride, walking (0..1), phase, awake (0 asleep)
uniform float uTime;
uniform int uPose;
uniform vec3 uHead;
uniform vec3 uTail;
uniform vec3 uHeadF;
varying vec4 vAnim;
varying vec3 vCatPos;
varying vec3 vCatNrm;
varying vec4 vCoatA;
varying vec4 vCoatB;
varying vec4 vCoatC;
varying vec4 vCoatD;
varying vec4 vCoatE;
varying float vTailD;
varying vec3 vHeadV;
`;

const FRAG_HEAD = /* glsl */`
uniform float uRefLum;
uniform vec3 uRefColor;
uniform vec3 uEye;
uniform float uHeight;
uniform float uGinger;
uniform float uTime;
uniform vec3 uHeadF;
uniform float uTailLen;
varying vec4 vAnim;
varying vec3 vCatPos;
varying vec3 vCatNrm;
varying vec4 vCoatA;
varying vec4 vCoatB;
varying vec4 vCoatC;
varying vec4 vCoatD;
varying vec4 vCoatE;
varying float vTailD;
varying vec3 vHeadV;

float cHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float cNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cHash(i), cHash(i + vec3(1,0,0)), f.x), mix(cHash(i + vec3(0,1,0)), cHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(cHash(i + vec3(0,0,1)), cHash(i + vec3(1,0,1)), f.x), mix(cHash(i + vec3(0,1,1)), cHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float cFbm(vec3 p) { return (cNoise(p) * 0.57 + cNoise(p * 2.03 + 7.1) * 0.29 + cNoise(p * 4.07 + 3.3) * 0.14); }
float cCells(vec3 p) {
  vec3 i = floor(p), f = fract(p); float d = 9.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(float(x), float(y), float(z));
    vec3 q = o + vec3(cHash(i + o), cHash(i + o + 17.0), cHash(i + o + 41.0)) * 0.8 + 0.1 - f;
    d = min(d, dot(q, q));
  }
  return sqrt(d);
}

/* The coat's colour at a point, before shading. pm: how much the texture says "point" here. */
vec3 coatColor(vec3 base, vec3 second, float pattern, float seed, vec3 p, vec3 n, float pm) {
  vec3 s = p + seed * 13.7;
  float h = max(uHeight, 0.3);
  float edge = (cFbm(s * 5.0) - 0.5) * 0.14;
  float belly = 1.0 - smoothstep(-0.55 + edge, -0.15 + edge, n.y);
  float paws = 1.0 - smoothstep(0.07, 0.15 + edge * 0.6, p.y);
  float chest = smoothstep(0.25, 0.7, n.x) * (1.0 - smoothstep(0.35, 0.65, (p.y + edge) / h)) * smoothstep(0.0, 0.12, p.x + 0.15);
  float muzzle = 1.0 - smoothstep(0.1, 0.16, length((p - (uEye + vec3(0.05, -0.08, 0.0))) * vec3(1.0, 1.3, 0.9)) + edge * 0.3);
  float white = clamp(max(max(belly, paws), max(chest, muzzle)), 0.0, 1.0);
  int pat = int(pattern + 0.5);
  float legs = 1.0 - smoothstep(0.2, 0.34, p.y / h);
  float legRings = smoothstep(0.3, 0.7, sin(6.2832 * (p.y * 9.0 + cFbm(s * 3.0) * 0.5)));
  float stripeK = vCoatD.w;
  if (pat == 1) {            // mackerel tabby: narrow stripes down the sides, rings round the legs, a darker back
    float band = sin(6.2832 * (p.x * 5.4 + p.y * 0.8 + cFbm(s * 2.4) * 0.9));
    float bold = step(0.97, stripeK);
    float stripe = mix(smoothstep(0.3, 0.7, band), smoothstep(-0.05, 0.3, band), bold);
    stripe = mix(stripe, legRings, legs);
    vec3 c = mix(base, second, stripe * stripeK);
    c = mix(c, second, smoothstep(0.6, 0.95, n.y) * smoothstep(0.35, 0.8, p.y / h) * 0.4 * stripeK);
    return mix(c, mix(base, vec3(1.0, 0.96, 0.9), 0.45), belly * 0.7);
  }
  if (pat == 8) {            // classic tabby: a bullseye swirl on each flank, lines along the spine
    vec2 q = vec2(p.x + 0.04, (p.y - 0.45 * h) * 1.3);
    float band = sin(6.2832 * (length(q) * 5.5 + cFbm(s * 2.0) * 0.7));
    float spine = smoothstep(0.55, 0.9, n.y) * smoothstep(0.2, 0.7, abs(sin(p.z * 26.0)));
    float stripe = max(smoothstep(0.2, 0.6, band), spine);
    stripe = mix(stripe, legRings, legs);
    vec3 c = mix(base, second, stripe * stripeK);
    return mix(c, mix(base, vec3(1.0, 0.96, 0.9), 0.45), belly * 0.7);
  }
  if (pat == 9) {            // ticked: every hair banded, so a fine grain; faint bars on the legs, a darker back
    float g = cNoise(s * 70.0) * 0.6 + cNoise(s * 23.0) * 0.4;
    vec3 c = mix(base, second, smoothstep(0.35, 0.8, g) * 0.45);
    c = mix(c, second, legs * legRings * 0.35 + smoothstep(0.6, 0.95, n.y) * 0.25);
    return mix(c, mix(base, vec3(1.0, 0.96, 0.9), 0.45), belly * 0.6);
  }
  if (pat == 10) {           // van: white, with colour on the cap and ears, the tail and a patch or two
    float cap = (vHeadV.x < 8.0) ? (1.0 - smoothstep(0.2, 0.24, length(vHeadV))) * smoothstep(-0.02, 0.05, vHeadV.y + (cFbm(s * 6.0) - 0.5) * 0.06) : 0.0;
    float tail = step(0.0, vTailD);
    float spots = smoothstep(0.63, 0.67, cFbm(s * 2.2)) * smoothstep(0.2, 0.6, n.y);
    return mix(base, second, clamp(max(max(cap, tail), spots), 0.0, 1.0));
  }
  if (pat == 11) {           // patch: white with one patch over an ear and eye
    float pa = (vHeadV.x < 8.0) ? 1.0 - smoothstep(0.1, 0.13, length(vHeadV - vec3(0.0, 0.07, 0.07)) + (cFbm(s * 7.0) - 0.5) * 0.04) : 0.0;
    return mix(base, second, pa);
  }
  if (pat == 2) return mix(base, second, white);                                  // tuxedo: white bib, belly, socks and muzzle
  if (pat == 3) {            // calico: white with patches of the second colour and near-black
    float a = cFbm(s * 2.3), b = cFbm(s * 2.9 + 11.0);
    vec3 dark = vec3(0.045, 0.038, 0.034);
    vec3 c = mix(base, second, smoothstep(0.5, 0.56, a));
    c = mix(c, dark, smoothstep(0.54, 0.6, b) * (1.0 - smoothstep(0.5, 0.56, a) * 0.6));
    return mix(c, base, white * 0.85);
  }
  if (pat == 4) {            // point: a paler body with darker ears, face, paws and tail
    float pts = clamp(max(pm * 1.25, max(paws * 0.8, muzzle * 0.9)), 0.0, 1.0);
    return mix(base, second, pts);
  }
  if (pat == 5) {            // spotted
    float d = cCells(s * vec3(6.5, 7.5, 6.5));
    return mix(mix(base, second, 1.0 - smoothstep(0.2, 0.3, d)), mix(base, vec3(1.0, 0.97, 0.92), 0.5), belly * 0.8);
  }
  if (pat == 6) {            // bicolor: colour on top, white below a wavy line
    float low = 1.0 - smoothstep(0.3, 0.38, (p.y + edge * 1.6) / h + n.y * 0.12);
    return mix(base, second, clamp(max(white, low), 0.0, 1.0));
  }
  if (pat == 7) {            // tortie: two colours mottled together
    float m = cFbm(s * 4.2) + (cNoise(s * 13.0) - 0.5) * 0.18;
    return mix(base, second, smoothstep(0.46, 0.56, m));
  }
  return base;               // solid
}

/* What the cat's look adds on top of its pattern: white marks, a tail tip, a mane, a jacket. */
vec3 coatMarks(vec3 c, vec3 base, vec3 second, vec3 p, vec3 n, float pm) {
  float h = max(uHeight, 0.3);
  vec3 s = p + vCoatB.a * 13.7;
  float edge = (cFbm(s * 5.0) - 0.5) * 0.14;
  int f = int(vCoatD.x + 0.5);
  vec3 W = vec3(0.96, 0.94, 0.9);
  bool hasHead = vHeadV.x < 8.0;
  vec3 hv = vHeadV;
  float fwd = hasHead ? dot(normalize(hv + 1e-5), uHeadF) : -1.0;
  float w = 0.0;
  if ((f & 1) != 0) w = max(w, smoothstep(0.2, 0.6, n.x) * (1.0 - smoothstep(0.3, 0.62, (p.y + edge) / h)) * smoothstep(0.12, 0.3, p.y / h) * smoothstep(-0.05, 0.1, p.x + 0.12));
  if ((f & 2) != 0) w = max(w, 1.0 - smoothstep(0.08, 0.16 + edge * 0.6, p.y));
  if ((f & 4) != 0 && hasHead) w = max(w, smoothstep(0.55, 0.8, fwd) * (1.0 - smoothstep(-0.03, 0.02, hv.y + edge * 0.2)));
  if ((f & 8) != 0) w = max(w, (1.0 - smoothstep(-0.5 + edge, -0.1 + edge, n.y)) * (1.0 - smoothstep(0.35, 0.6, p.y / h)));
  if ((f & 16) != 0 && hasHead) w = max(w, smoothstep(0.7, 0.85, fwd) * (1.0 - smoothstep(0.012, 0.03, abs(dot(hv, cross(uHeadF, vec3(0.0, 1.0, 0.0)))))) * step(-0.04, hv.y));
  c = mix(c, W, clamp(w, 0.0, 1.0));
  int tl = int(vCoatD.y + 0.5);
  if (vTailD >= 0.0) {
    float t = vTailD / max(uTailLen, 0.05);
    if (tl == 1) c = mix(c, W, smoothstep(0.78, 0.84, t));
    if (tl == 2) c = mix(c, mix(second, vec3(0.05, 0.04, 0.035), 0.55), smoothstep(0.76, 0.84, t));
    if (tl == 4) c = mix(c, mix(second, vec3(0.03), 0.4), smoothstep(0.2, 0.6, sin(t * 34.0)) * step(0.15, t));
  }
  // A lion's mane: round the head and down the neck, not over the face.
  if (vCoatD.z > 0.5 && hasHead) {
    float m = smoothstep(0.1, 0.16, length(hv)) * (1.0 - smoothstep(0.3, 0.38, length(hv))) * (1.0 - smoothstep(0.1, 0.45, fwd));
    c = mix(c, second * (0.85 + 0.3 * cFbm(s * 18.0)), clamp(m * 1.2, 0.0, 1.0));
  }
  // A jacket: the torso, not the head, legs or tail.
  if (vCoatE.w > 0.5) {
    float torso = smoothstep(0.26, 0.34, p.y / h) * (hasHead ? smoothstep(0.22, 0.28, length(hv)) : 1.0) * (1.0 - step(0.0, vTailD));
    c = mix(c, vCoatE.rgb * (0.9 + 0.2 * cNoise(s * 30.0)), torso);
  }
  return c;
}
`;

/** The head's procedural life (look about, nod, tilt, a touch bigger, ear flicks), shared by the
    coat and by what the cat wears, so a hat stays on the head. Needs T, p0 and transformed. */
const HEAD_GLSL = /* glsl */`
        // Head: a little bigger, turning to look about when still, nodding with each step when walking.
        if (uHead.y > -1.0) {
          float hw = 1.0 - smoothstep(0.14, 0.34, distance(p0, uHead));
          float look = (sin(T * 0.37) * 0.32 + sin(T * 0.93 + 1.7) * 0.12) * (1.0 - aAnim.y) * aAnim.w;
          float nod = sin(aAnim.x * 2.0 + 0.6) * 0.016 * aAnim.y + sin(T * 0.8) * 0.006;
          vec3 q = transformed - uHead;
          q *= 1.0 + 0.1 * hw;
          float c = cos(look * hw), s = sin(look * hw);
          q = vec3(c * q.x + s * q.z, q.y, -s * q.x + c * q.z);
          // A tilt of curiosity now and then.
          float tilt = sin(T * 0.23 + 2.0) ; tilt = smoothstep(0.7, 1.0, tilt) * 0.22 * hw * aAnim.w;
          q = vec3(q.x, cos(tilt) * q.y - sin(tilt) * q.z, sin(tilt) * q.y + cos(tilt) * q.z);
          transformed = uHead + q + vec3(0.0, nod * hw, 0.0);
          // Ears: the top of the head flicks back for an instant every few seconds.
          float ear = step(uHead.y + 0.1, p0.y) * hw * pow(max(0.0, sin(T * 0.61 + aAnim.z)), 60.0) * aAnim.w;
          transformed.x -= ear * 0.05; transformed.z += sign(p0.z - uHead.z) * ear * 0.03;
        }
`;

function coatShader(material, md) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uRefLum: { value: md.ref.lum },
      uRefColor: { value: md.ref.color },
      uEye: { value: md.eye },
      uHeight: { value: md.height / CAT.size },
      uGinger: { value: md.ginger ? 1 : 0 },
      uTime: AMBIENT.uTime,
      uPose: { value: POSE_ID[md.pose] },
      uHead: { value: md.head },
      uTail: { value: new THREE.Vector3(...TAIL[md.pose]) },
      uHeadF: { value: md.frame ? md.frame.f : new THREE.Vector3(1, 0, 0) },
      uTailLen: { value: md.tailLen },
    });
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vCatPos = position / ${CAT.size.toFixed(3)};
      vCatNrm = normal;
      vCoatA = aCoatA; vCoatB = aCoatB; vCoatC = aCoatC; vCoatD = aCoatD; vCoatE = aCoatE; vAnim = aAnim;
      vHeadV = uHead.y > -1.0 ? position - uHead : vec3(9.0);
      vTailD = (position.x < uTail.x && position.y > uTail.y && position.y < uTail.z) ? uTail.x - position.x : -1.0;
      {
        // Procedural life on top of the posed model: legs that swing, a tail that sways, a head
        // that bobs, looks about and is drawn a touch bigger (cuter), ears that twitch now and then.
        float T = uTime + aAnim.z;
        vec3 p0 = position;
        // A bobcat's short tail: the tail beyond a stub is drawn up into it.
        if (aCoatD.y > 2.5 && aCoatD.y < 3.5 && vTailD > 0.09) { transformed.x += vTailD - 0.09; transformed.z *= 0.6; transformed.y = mix(transformed.y, max(transformed.y, uTail.y + 0.12), 0.5); }
        // A lion's mane stands out a little round the head.
        if (aCoatD.z > 0.5 && uHead.y > -1.0) {
          vec3 hv = position - uHead; float hl = length(hv);
          float m = smoothstep(0.1, 0.16, hl) * (1.0 - smoothstep(0.3, 0.38, hl)) * (1.0 - smoothstep(0.1, 0.45, dot(hv / max(hl, 1e-4), uHeadF)));
          transformed += hv / max(hl, 1e-4) * 0.045 * m;
        }
        ${HEAD_GLSL}
        // Legs (walking): diagonal pairs swing fore and aft, the paws lifting on the way forward.
        if (uPose == 0) {
          float w = (1.0 - smoothstep(0.04, 0.34, p0.y)) * aAnim.y;
          float ph = aAnim.x + (p0.x > 0.0 ? 0.0 : 3.1416) + (p0.z > 0.0 ? 3.1416 : 0.0);
          transformed.x += sin(ph) * 0.13 * w;
          transformed.y += max(0.0, cos(ph)) * 0.07 * w;
        }
        // Tail: a wave travelling from the root to the tip; a lazy swish when still, a jaunty flick when walking.
        if (p0.x < uTail.x && p0.y > uTail.y && p0.y < uTail.z) {
          float d = uTail.x - p0.x;
          float sp = mix(1.6, 3.2, aAnim.y), amp = mix(0.55, 0.35, aAnim.y) * (0.35 + 0.65 * aAnim.w);
          float a = (sin(T * sp - d * 5.0) + 0.35 * sin(T * sp * 2.3 - d * 9.0)) * amp;
          transformed.z += sin(a) * d;
          transformed.x += (cos(a) - 1.0) * d * 0.5;
          if (uPose == 0 || uPose == 3) transformed.y += sin(T * 1.3) * 0.05 * d;
        }
      }`);
    shader.fragmentShader = FRAG_HEAD + shader.fragmentShader
      .replace("#include <map_fragment>", `#include <map_fragment>
      float catEye = 0.0;
      {
        vec3 tex = diffuseColor.rgb;
        float lum = dot(tex, vec3(0.2126, 0.7152, 0.0722));
        float eye = 1.0 - smoothstep(0.018, 0.06, lum);
        vec3 coat;
        if (uGinger > 0.5) {
          // The ginger tabby as modelled, nudged towards this cat's base colour.
          vec3 k = clamp(vCoatA.rgb / max(uRefColor, vec3(0.02)), vec3(0.55), vec3(1.5));
          coat = tex * k;
          coat = coatMarks(coat, vCoatA.rgb, vCoatB.rgb, vCatPos, normalize(vCatNrm), 0.0);
        } else {
          float rel = lum / max(uRefLum, 0.05);
          float pm = (1.0 - smoothstep(0.45, 0.8, rel)) * (1.0 - eye);
          vec3 c = coatColor(vCoatA.rgb, vCoatB.rgb, vCoatA.a, vCoatB.a, vCatPos, normalize(vCatNrm), pm);
          c = coatMarks(c, vCoatA.rgb, vCoatB.rgb, vCatPos, normalize(vCatNrm), pm);
          // Keep the model's own light and shade, without its darker points.
          float shade = clamp(rel / mix(1.0, 0.5, pm), 0.62, 1.18);
          coat = c * mix(1.0, shade, 0.75);
        }
        // Richer fur: a little more saturation, a darker back and paler underside, fine fur grain.
        vec3 n = normalize(vCatNrm);
        float cl = dot(coat, vec3(0.2126, 0.7152, 0.0722));
        coat = max(mix(vec3(cl), coat, 1.18), 0.0);
        coat *= mix(1.1, 0.88, smoothstep(-0.2, 0.9, n.y) * smoothstep(0.3, 0.9, vCatPos.y / max(uHeight, 0.3)));
        coat *= 0.94 + 0.12 * cNoise(vCatPos * vec3(14.0, 60.0, 60.0) + vCoatB.a);
        // Eyes: the model's own, made glossy below, and a blink every few seconds (asleep: shut).
        float blinkT = fract(uTime * 0.23 + vAnim.z * 0.37);
        float shut = max(step(blinkT, 0.03), 1.0 - vAnim.w);
        vec3 eyeCol = vCoatC.rgb * 0.5 * (0.35 + lum * 6.0);
        eyeCol = mix(eyeCol, coat * 0.72, shut);
        catEye = eye * (1.0 - shut);
        diffuseColor.rgb = mix(coat, eyeCol, eye);
      }`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      {
        // The chosen cat glows warmly at its silhouette only, so its own coat still reads true
        // (a wide glow washed dark coats to tan). The ring on the grass and its tag mark it too.
        float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 4.0);
        totalEmissiveRadiance += vCoatC.a * rim * 0.55 * vec3(1.0, 0.72, 0.38);
        // A soft warm rim for every cat, so each one stands out against the grass.
        float rim2 = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.5);
        // A catchlight: a bright glint where the eye faces up towards the light.
        totalEmissiveRadiance += catEye * vec3(1.0) * 1.6 * pow(max(0.0, dot(normalize(normal), normalize(vec3(-0.25, 0.7, 0.65)))), 18.0);
        totalEmissiveRadiance += rim2 * 0.32 * (diffuseColor.rgb * 0.6 + vec3(0.35, 0.3, 0.22));
      }`);
  };
  material.customProgramCacheKey = () => `cat-coat-${md.ginger ? "g" : "c"}`;
  material.needsUpdate = true;
}

/* ── Cats with their own model ────────────────────────────────────────────
   A cat whose picture was made into its own model (assets/models/cats/<TICKER>.glb, listed in
   assets/models/cats/index.json) is drawn from that model, in its own colours, instead of the
   tinted shared ones. Every such model is a cat standing on all fours; catrig.js rigs it at load
   (a quadruped skeleton found from its shape, skin weights) and gives it a set of clips (walk,
   trot, run, stalk, sit, loaf, sleep, groom, stretch, wiggle, pounce, eat, knead, scratch, ...)
   that an AnimationMixer crossfades between as the cat's activity changes (clipFor, below).
   Walking clips are stepped by the distance walked, so paws don't slide. Near the camera a cat is
   drawn from the full model, far away from a lighter copy (<TICKER>-lo.glb) on the same
   skeleton; only the nearest OWN.maxHi at a time get the full one, and far cats' animation is
   updated less often. */

export const OWN = { maxHi: 10, hiDist: 16, index: "assets/models/cats/index.json", fade: 0.3, drawDist: 58 };

/** Level of detail for the shared, tinted cats: beyond `far` units from the camera a cat is drawn
    from the lightest copy; beyond `cullNear` a cat outside the view is not drawn at all. */
export const LOD = { far: 26, cullNear: 14 };
/** How tall a cat stands in each pose, as a share of its standing height (for its tag and the camera). */
const OWN_HEIGHT = { walk: 1, sit: 1.05, stretch: 0.8, loaf: 0.62, sleep: 0.45 };

/** The scale from a normalized model (1 unit tall, standing) to the garden's cat size. */
export function ownScale(dims) {
  return (CAT.size * 0.95) / (dims.height || 1);
}

/** Which clip a cat plays now, from its pose and what it is doing (cats.js leaves both on it). */
export function clipFor(cat) {
  const act = cat.act, step = act && act.steps ? act.steps[act.i] : null;
  const anim = cat.clip || (step && step.type === "hold" ? step.anim : null);
  if (cat.pose === "walk") {
    const v = cat.speed || 0;
    if (v > 2.2) return "run";
    if (v > 1.4) return "trot";
    if (v > 0.02 && v < 0.55 && step && step.type === "chase") return "stalk";
    return v > 0.02 ? "walk" : anim === "sniff" ? "sniff" : anim === "greet" ? "greet" : "stand";
  }
  if (cat.pose === "sleep") return "sleep";
  if (cat.pose === "stretch") {
    if (step && step.type === "hop") return "pounce";
    if (anim === "wiggle") return "wiggle";
    if (anim === "scratch") return "scratch";
    return "stretch";
  }
  const map = { eat: "eat", drink: "eat", groom: "groom", pant: "pant", look: "look", watch: "look", watchUp: "look", knead: "knead", crouch: "crouch", sniff: "sniff", greet: "greet", scratch: "scratch", dab: "loaf", roll: "loaf" };
  if (anim && map[anim]) return map[anim];
  return cat.pose === "loaf" ? "loaf" : "sit";
}

function ownMaterial(material, u) {
  material.metalness = 0; material.roughness = Math.max(0.75, material.roughness ?? 0.85);
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uHl: u.hl });
    shader.fragmentShader = "uniform float uHl;\n" + shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      {
        // The chosen cat's warm rim, and a soft rim for every cat so it stands out on the grass.
        float nv = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += uHl * pow(nv, 4.0) * 0.55 * vec3(1.0, 0.72, 0.38);
        totalEmissiveRadiance += pow(nv, 2.5) * 0.3 * (diffuseColor.rgb * 0.6 + vec3(0.35, 0.3, 0.22));
      }`);
  };
  material.customProgramCacheKey = () => "cat-own";
  material.needsUpdate = true;
}

/** The first mesh under a loaded model as plain float attributes in the model's own space. */
export function flatMesh(root) {
  root.updateMatrixWorld(true);
  let mesh = null;
  root.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  if (!mesh) return null;
  const src = mesh.geometry, P = src.attributes.position, N = src.attributes.normal, v = new THREE.Vector3();
  const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const pos = new Float32Array(P.count * 3), nrm = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i).applyMatrix4(mesh.matrixWorld); pos.set([v.x, v.y, v.z], i * 3);
    if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nrm.set([v.x, v.y, v.z], i * 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  if (N) g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3)); else g.computeVertexNormals();
  if (src.attributes.uv) g.setAttribute("uv", src.attributes.uv);
  if (src.index) g.setIndex(src.index);
  return { geometry: g, material: mesh.material, pos };
}

/* ── The herd ─────────────────────────────────────────────────────────── */

const _m = new THREE.Matrix4(), _t = new THREE.Matrix4(), _r = new THREE.Matrix4(), _c = new THREE.Color();
const _pv = new THREE.Matrix4(), _fr = new THREE.Frustum(), _sp = new THREE.Sphere();

const NAMED = {
  black: "#1d1a1c", white: "#f7f3ec", cream: "#f1dcc0", ginger: "#e0823a", orange: "#e0823a", red: "#c8642c", grey: "#9a9aa2", gray: "#9a9aa2",
  silver: "#c9cbd0", blue: "#7f8aa0", brown: "#6b4a33", chocolate: "#5a3a28", lilac: "#b8aab4", fawn: "#d6b995", cinnamon: "#b9764a",
  golden: "#d9a64e", tan: "#c49a6c", smoke: "#6f6c77", tabby: "#a47a52", seal: "#4a3527", caramel: "#c48a4f", amber: "#e0a030",
  green: "#7fb069", yellow: "#e8c547", copper: "#c77b30", hazel: "#9b8a4a", gold: "#d9a64e", odd: "#7fb2e0",
  olive: "#9a9a3a", lime: "#9ccc3c", lemon: "#f2d64b", honey: "#d99a3e", brass: "#c9a23a", sky: "#8cc4ec", ice: "#a8d8ef",
  leaf: "#6aa84f", sage: "#a3b08f", rust: "#b5532a", charcoal: "#3a3638", taupe: "#8b7b6b", pink: "#f29ab2", purple: "#7b4bb0",
  violet: "#8a5ac8", teal: "#2f9c95", aqua: "#7fd6d0", navy: "#1f2a52", magenta: "#d0268a", salmon: "#f29a8e", dark: "#2a1d16",
  terracotta: "#c0643a", umber: "#4a3222", graphite: "#55565c", ash: "#b9b7b2", sand: "#d8bf92", tawny: "#c08a4a",
};
/** A coat colour from "#rrggbb", "#rgb" or a plain colour name; null if it can't tell. */
export function colorOf(v) {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s) || /^#[0-9a-f]{3}$/.test(s)) return new THREE.Color(s);
  for (const w of s.split(/[\s,/-]+/).reverse()) if (NAMED[w]) return new THREE.Color(NAMED[w]);
  return null;
}
/** A pattern id from its name (or a close word for it). */
export function patternOf(v) {
  const s = String(v || "").toLowerCase();
  if (/classic|marble|swirl/.test(s)) return 8;
  if (/ticked|agouti/.test(s)) return 9;
  if (/\bvan\b/.test(s)) return 10;
  if (/\bpatch\b/.test(s)) return 11;
  if (/tux|bib|mask/.test(s)) return 2;
  if (/calico/.test(s)) return 3;
  if (/tort|brindle/.test(s)) return 7;
  if (/point|siamese|himalayan|ragdoll|colou?rpoint/.test(s)) return 4;
  if (/spot|leopard|bengal|rosette/.test(s)) return 5;
  if (/bi-?colou?r|van|harlequin|two/.test(s)) return 6;
  if (/tabby|stripe|mackerel|marble|tiger/.test(s)) return 1;
  return 0;
}

/** White-mark flags for the shader. */
const MARK = { chest: 1, paws: 2, muzzle: 4, belly: 8, blaze: 16 };
const TAIL_CODE = { white: 1, dark: 2, bob: 3, ringed: 4 };

/** The coat a resident is drawn in: its sheet's coat when there is one, otherwise a plain one
    from its id; then what its look adds (looks.js): marks, tail, mane, jacket, size, what it wears. */
export function coatFor(r, index = 0) {
  const c = r.coat || {};
  const look = lookOf(r);
  let base = colorOf(look.base) || colorOf(c.base), second = colorOf(c.second) || colorOf(look.second), eyes = colorOf(c.eyes) || colorOf(look.eyes);
  let pattern = patternOf(look.pattern || c.pattern);
  // A bicolour or tuxedo sheet whose look is a tabby with white (or the other way) keeps the sheet's pattern.
  if (look.pattern === "mackerel" && pattern !== 1) pattern = 1;
  if (!base) {
    const fallback = ["#f1dcc0", "#9a9aa2", "#1d1a1c", "#e0823a", "#f7f3ec", "#b9764a", "#6f6c77", "#d6b995"];
    base = new THREE.Color(fallback[hash(r.id || String(index)) % fallback.length]);
  }
  if (look.mane) second = colorOf(look.mane) || second;
  if (!second) second = pattern === 2 || pattern === 6 || pattern === 3 ? new THREE.Color("#f7f3ec") : pattern === 10 || pattern === 11 ? new THREE.Color("#4a4448") : base.clone().multiplyScalar(0.45);
  if (!eyes) eyes = new THREE.Color("#8fb04a");
  // Calico's "base" is its white; a calico sheet usually names the colours, so put white first.
  if (pattern === 3 && base.getHSL({ h: 0, s: 0, l: 0 }).l < 0.7) { const w = new THREE.Color("#f7f3ec"); second = base; base = w; }
  const hsl = base.getHSL({ h: 0, s: 0, l: 0 });
  const ginger = pattern === 1 && hsl.h > 0.03 && hsl.h < 0.12 && hsl.s > 0.45 && look.stripe < 0.97 && look.scale === 1;
  let marks = 0;
  for (const [k, bit] of Object.entries(MARK)) if (look.white?.[k]) marks |= bit;
  const garment = look.garment ? colorOf(look.garment.color) : null;
  const wears = (look.wears || []).map((w) => ({ type: w.type, color: colorOf(w.color) || new THREE.Color("#c0392b") }));
  return {
    base, second, eyes, pattern, ginger, seed: (hash(r.id || String(index)) % 997) / 97,
    marks, tail: TAIL_CODE[look.tail] || 0, mane: look.mane ? 1 : 0, stripe: look.stripe ?? 0.9,
    garment, scale: look.scale || 1, wears,
  };
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export class CatHerd {
  /**
   * @param {THREE.Scene} scene
   * @param {object} models   from loadCatModels
   * @param {object} sim      from createSanctuary
   * @param {Map} coats       cat id → coatFor(resident)
   */
  constructor(scene, models, sim, coats, { blobShadows = false } = {}) {
    this.models = models;
    this.sim = sim;
    this.meshes = [];
    this.lookup = new Map(); // InstancedMesh → [cat per instance]
    this.coats = coats;
    this.highlight = new Map(); // cat id → 0..1
    this.scene = scene;
    this.blobShadows = blobShadows;
    this.own = new Map(); // cat id → { group, hi, lo, dims, s, u }
    this.ownMeshes = []; // [mesh, cat] for picking
    this.camera = null; // set by the world, for the near/far choice
    this.wear = new Map(); // "type-model-pose" → InstancedMesh of that accessory
    this.wearCount = {}; // type → how many cats wear it
    for (const c of sim.cats) for (const w of coats.get(c.id)?.wears || []) this.wearCount[w.type] = (this.wearCount[w.type] || 0) + 1;
    const perModel = { cat: 0, ginger: 0 };
    for (const c of sim.cats) perModel[c.model]++;
    this.byKey = {};
    for (const model of ["cat", "ginger"]) {
      if (!perModel[model]) continue;
      for (const pose of POSES) for (const lod of ["", "-far"]) {
        const md = models[model][pose];
        const n = perModel[model];
        const geo = (lod ? md.far || md.lite || md.geometry : md.lite || md.geometry).clone();
        geo.setAttribute("aCoatA", new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute("aCoatB", new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute("aCoatC", new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute("aCoatD", new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute("aCoatE", new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute("aAnim", new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
        coatShader(md.material, md);
        const im = new THREE.InstancedMesh(geo, md.material, n);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.name = `${model}-${pose}${lod}`;
        im.castShadow = !blobShadows;
        im.receiveShadow = true;
        im.frustumCulled = false; // the cats move about the whole garden
        im.count = 0;
        im.userData.owner = new Array(n).fill(null);
        scene.add(im);
        this.meshes.push(im);
        this.byKey[`${model}-${pose}${lod}`] = im;
        this.lookup.set(im, []);
      }
    }
    this.blobs = null;
    if (blobShadows) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 64;
      const g = cv.getContext("2d"), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, "rgba(0,0,0,1)"); grd.addColorStop(0.55, "rgba(0,0,0,0.55)"); grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(cv);
      this.blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, color: 0x2a3a1a, transparent: true, opacity: 0.32, depthWrite: false }), sim.cats.length);
      this.blobs.renderOrder = 1;
      this.blobs.frustumCulled = false;
      this.blobs.name = "cat shadows";
      scene.add(this.blobs);
    }
  }

  /**
   * Gives a cat its own model. `lo` (the far copy) may come first and `hi` later, or both at once;
   * either may be null. `dims` is the model's { len, height, width } from index.json.
   */
  attachOwn(catId, { hi = null, lo = null, dims }) {
    const cat = this.sim.byId(catId);
    if (!cat) return false;
    let o = this.own.get(catId);
    const add = (root, tag) => {
      const f = flatMesh(root);
      if (!f) return null;
      if (!o) {
        const rig = findRig(f.pos), sk = buildSkeleton(rig);
        const group = new THREE.Group();
        group.name = `cat ${catId}`;
        group.matrixAutoUpdate = false;
        group.add(sk.root);
        this.scene.add(group);
        const mixer = new THREE.AnimationMixer(sk.root);
        o = { group, hi: null, lo: null, dims, s: ownScale(dims), rig, sk, mixer, clips: makeClips(rig), actions: {}, clip: null, u: { hl: { value: 0 } }, lastT: 0 };
        o.perUnit = cyclesPerUnit(rig, o.s);
        this.own.set(catId, o);
      }
      const { index, weight } = skinWeights(f.pos, o.rig, o.sk);
      f.geometry.setAttribute("skinIndex", index);
      f.geometry.setAttribute("skinWeight", weight);
      f.geometry.computeBoundingSphere();
      const m = new THREE.SkinnedMesh(f.geometry, f.material);
      m.bind(o.sk.skeleton, new THREE.Matrix4());
      m.name = tag;
      m.castShadow = !this.blobShadows; m.receiveShadow = true;
      m.frustumCulled = false; // bones move it about; the group is culled by distance instead
      if (m.material.map) m.material.map.anisotropy = 4;
      ownMaterial(m.material, o.u);
      m.visible = false;
      o.group.add(m);
      this.ownMeshes.push([m, cat]);
      return m;
    };
    if (lo && !o?.lo) { const m = add(lo, "far"); if (m) o.lo = m; }
    if (hi && !o?.hi) { const m = add(hi, "full"); if (m) o.hi = m; }
    return !!o;
  }

  /** Plays `name` on a cat's mixer, crossfading from what it was doing. */
  playClip(o, name, fade = OWN.fade) {
    if (o.clip === name) return o.actions[name];
    const clip = o.clips[name] || o.clips.stand;
    let a = o.actions[name];
    if (!a) {
      a = o.actions[name] = o.mixer.clipAction(clip);
      if (clip.userData?.loop === false) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    }
    a.reset().setEffectiveWeight(1).play();
    const prev = o.clip && o.actions[o.clip];
    if (prev && fade > 0) prev.crossFadeTo(a, fade, false); else if (prev) prev.stop();
    if (prev) a.time = ["walk", "trot", "run", "stalk"].includes(name) && ["walk", "trot", "run", "stalk"].includes(o.clip) ? prev.time : a.time;
    o.clip = name;
    return a;
  }

  /** The size a cat is drawn at, for its tag and the camera: its own model's when it has one. */
  dimsOf(cat) {
    const o = this.own.get(cat.id);
    if (o) return { len: (o.dims.len || 1.2) * o.s, height: o.s * (o.dims.height || 1) * (OWN_HEIGHT[cat.pose] || 1), width: (o.dims.width || 0.5) * o.s };
    return this.models[cat.model][cat.pose];
  }

  /** Writes every cat's matrix (and, when a slot changes hands, its coat) into the mesh for its pose. */
  update() {
    for (const im of this.meshes) { im.count = 0; this.lookup.get(im).length = 0; im.userData.coatDirty = false; }
    for (const wm of this.wear.values()) wm.count = 0;
    // What the camera can see: cats outside it (and not close by) are skipped, far ones drawn light.
    const cam = this.camera;
    if (cam) { cam.updateMatrixWorld(); _pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _fr.setFromProjectionMatrix(_pv); }
    const cx = cam ? cam.position.x : 0, cz = cam ? cam.position.z : 0;
    let drawn = 0;
    // Which own-model cats get the full model: the nearest few within reach of the camera.
    let near = null;
    if (this.own.size) {
      const cam = this.camera?.position;
      const list = [];
      for (const [id, o] of this.own) { const c = this.sim.byId ? this.sim.byId(id) : null; if (c) list.push([cam ? Math.hypot(c.x - cam.x, c.z - cam.z) : 0, id]); }
      list.sort((a, b) => a[0] - b[0]);
      near = new Set(list.filter(([d], i) => i < OWN.maxHi && d < OWN.hiDist).map(([, id]) => id));
    }
    const T = AMBIENT.uTime.value;
    for (const cat of this.sim.cats) {
      const o = this.own.get(cat.id);
      const hl0 = this.highlight.get(cat.id) || 0;
      const dist = Math.hypot(cat.x - cx, cat.z - cz);
      let skip = !!cat.hidden && !hl0;
      if (!skip && cam && dist > LOD.cullNear && !hl0) { _sp.center.set(cat.x, cat.y + 0.5, cat.z); _sp.radius = 1.3; skip = !_fr.intersectsSphere(_sp); }
      if (skip) {
        if (o) o.group.visible = false;
        if (this.blobs) { _t.makeScale(0, 0, 0); this.blobs.setMatrixAt(cat.index, _t); }
        continue;
      }
      drawn++;
      const ownNear = o && (o.hi || o.lo) && (dist < OWN.drawDist || hl0);
      if (o && !ownNear) o.group.visible = false;
      if (ownNear) {
        o.group.visible = true;
        const md = this.dimsOf(cat);
        // Place it: position and heading, the hop's pitch, the sun-roll's roll. The clips do the rest.
        const a = cat.anim;
        _m.makeRotationY(cat.yaw).setPosition(cat.x, cat.y, cat.z);
        const hop = cat.pose === "stretch" && a.pitch && !a.pivot;
        if (hop) _m.multiply(_r.makeRotationZ(a.pitch));
        if (a.roll && a.rollY) _m.multiply(_t.makeTranslation(0, a.rollY * md.height, 0)).multiply(_r.makeRotationX(a.roll)).multiply(_t.makeTranslation(0, -a.rollY * md.height, 0));
        _m.multiply(_t.makeScale(o.s, o.s, o.s));
        o.group.matrix.copy(_m);
        o.group.matrixWorldNeedsUpdate = true;
        const useHi = o.hi && (!o.lo || near.has(cat.id));
        if (o.hi) o.hi.visible = !!useHi;
        if (o.lo) o.lo.visible = !useHi;
        // Animate: the clip for what it is doing; walking clips follow the ground covered.
        const name = this.still ? (cat.pose === "sleep" ? "sleep" : cat.pose === "loaf" ? "loaf" : cat.pose === "walk" ? "stand" : "sit") : clipFor(cat);
        const act = this.playClip(o, name, this.still ? 0 : OWN.fade);
        const gaitClip = name === "walk" || name === "trot" || name === "run" || name === "stalk";
        const dist = (cat.stride || 0) / 5.2;
        if (gaitClip) { act.timeScale = 0; act.time = ((dist * o.perUnit * (name === "run" ? 0.55 : name === "trot" ? 0.8 : name === "stalk" ? 1.3 : 1)) % 1) * act.getClip().duration; }
        else act.timeScale = 1;
        // Far cats step their animation less often (every third frame).
        const now = T;
        const every = useHi ? 0 : 0.05;
        const dt = Math.min(0.1, Math.max(0, now - o.lastT));
        if (this.still) { o.mixer.update(0); o.lastT = now; }
        else if (dt >= every) { o.mixer.update(dt); o.lastT = now; }
        o.u.hl.value = this.highlight.get(cat.id) || 0;
        if (this.blobs) {
          const k = [md.len * 0.8, md.width * 1.1];
          _t.makeRotationY(cat.yaw).setPosition(cat.x, cat.y + 0.02, cat.z).multiply(_r.makeScale(k[0], 1, k[1]));
          this.blobs.setMatrixAt(cat.index, _t);
        }
        continue;
      }
      const im = this.byKey[`${cat.model}-${cat.pose}${dist > LOD.far && !hl0 ? "-far" : ""}`];
      const md = this.models[cat.model][cat.pose];
      this.matrixFor(cat, md, _m);
      const i = im.count++;
      im.setMatrixAt(i, _m);
      const hl = this.highlight.get(cat.id) || 0;
      const owner = im.userData.owner;
      if (owner[i] !== cat || im.userData.hl?.[i] !== hl) {
        owner[i] = cat;
        (im.userData.hl ||= [])[i] = hl;
        const c = this.coats.get(cat.id);
        const A = im.geometry.attributes.aCoatA, B = im.geometry.attributes.aCoatB, C = im.geometry.attributes.aCoatC;
        A.setXYZW(i, c.base.r, c.base.g, c.base.b, c.pattern);
        B.setXYZW(i, c.second.r, c.second.g, c.second.b, c.seed);
        C.setXYZW(i, c.eyes.r, c.eyes.g, c.eyes.b, hl);
        im.geometry.attributes.aCoatD.setXYZW(i, c.marks, c.tail, c.mane, c.stripe);
        const g = c.garment;
        im.geometry.attributes.aCoatE.setXYZW(i, g ? g.r : 0, g ? g.g : 0, g ? g.b : 0, g ? 1 : 0);
        im.userData.coatDirty = true;
      }
      this.lookup.get(im)[i] = cat;
      const anim = [cat.stride || 0, cat.pose === "walk" && !this.still ? Math.min(1, (cat.speed || 0) / 1.2) : 0, (cat.phase || 0) % 50, cat.pose === "sleep" ? 0 : 1];
      im.geometry.attributes.aAnim.setXYZW(i, ...anim);
      const coat = this.coats.get(cat.id);
      if (coat?.wears.length) for (const w of coat.wears) {
        const wm = this.wearMesh(w.type, cat.model, cat.pose);
        if (!wm) continue;
        const j = wm.count++;
        wm.setMatrixAt(j, _m);
        wm.setColorAt(j, w.color);
        wm.geometry.attributes.aAnim.setXYZW(j, ...anim);
      }
      if (this.blobs) {
        const k = cat.pose === "sit" ? [0.62, 0.5] : cat.pose === "sleep" ? [0.85, 0.8] : [md.len * 0.95, md.width * 0.8];
        _t.makeRotationY(cat.yaw).setPosition(cat.x, cat.y + 0.02, cat.z).multiply(_r.makeScale(k[0], 1, k[1]));
        this.blobs.setMatrixAt(cat.index, _t);
      }
    }
    this.drawn = drawn;
    if (this.blobs) this.blobs.instanceMatrix.needsUpdate = true;
    for (const wm of this.wear.values()) {
      wm.visible = wm.count > 0;
      wm.instanceMatrix.needsUpdate = true;
      if (wm.instanceColor) wm.instanceColor.needsUpdate = true;
      wm.geometry.attributes.aAnim.needsUpdate = true;
    }
    for (const im of this.meshes) {
      im.visible = im.count > 0;
      im.instanceMatrix.needsUpdate = true;
      im.geometry.attributes.aAnim.needsUpdate = true;
      if (im.userData.coatDirty) for (const k of ["aCoatA", "aCoatB", "aCoatC", "aCoatD", "aCoatE"]) im.geometry.attributes[k].needsUpdate = true;
      im.boundingSphere = null; // recomputed on demand when picking
    }
  }

  /** The InstancedMesh for one accessory on one model and pose, made the first time it is needed. */
  wearMesh(type, model, pose) {
    const key = `${type}-${model}-${pose}`;
    let wm = this.wear.get(key);
    if (wm !== undefined) return wm;
    const md = this.models[model][pose];
    const geo = buildWear(type, md.frame);
    if (!geo) { this.wear.set(key, null); return null; }
    const n = this.wearCount[type] || 1;
    geo.setAttribute("aAnim", new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
    wm = new THREE.InstancedMesh(geo, wearMaterial(md), n);
    wm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    wm.setColorAt(0, new THREE.Color(1, 1, 1));
    wm.name = `wear ${key}`;
    wm.castShadow = !this.blobShadows;
    wm.frustumCulled = false;
    wm.count = 0;
    this.scene.add(wm);
    this.wear.set(key, wm);
    return wm;
  }

  /** world = T(position + bob) · Ry(yaw) · [tilt about a pivot along the body] · [roll about the body's middle] · S(breath) */
  matrixFor(cat, md, out) {
    const a = cat.anim;
    out.makeRotationY(cat.yaw).setPosition(cat.x, cat.y + a.bob, cat.z);
    if (a.pitch || a.pivot) {
      const px = a.pivot * md.len * 0.5;
      out.multiply(_t.makeTranslation(px, 0, 0));
      if (a.pitch) out.multiply(_r.makeRotationZ(a.pitch));
      out.multiply(_t.makeTranslation(-px, 0, 0));
    }
    if (a.roll) {
      const py = (a.rollY || 0) * md.height;
      if (py) out.multiply(_t.makeTranslation(0, py, 0));
      out.multiply(_r.makeRotationX(a.roll));
      if (py) out.multiply(_t.makeTranslation(0, -py, 0));
    }
    const k = this.coats.get(cat.id)?.scale || 1;
    if (a.sx !== 1 || a.sy !== 1 || a.sz !== 1 || k !== 1) out.multiply(_t.makeScale(a.sx * k, a.sy * k, a.sz * k));
    return out;
  }

  /** The cat under a ray, if any. */
  pick(raycaster) {
    const own = this.ownMeshes.filter(([m]) => m.visible && m.parent?.visible !== false).map(([m]) => m);
    const hits = raycaster.intersectObjects([...this.meshes.filter((m) => m.visible), ...own], false);
    for (const h of hits) {
      const cat = h.instanceId !== undefined ? this.lookup.get(h.object)?.[h.instanceId] : this.ownMeshes.find(([m]) => m === h.object)?.[1];
      if (cat) return cat;
    }
    return null;
  }

  /** A point just above the cat's head, for the tag that follows it. */
  headPoint(cat, out) {
    const md = this.dimsOf(cat), k = this.own.has(cat.id) ? 1 : this.coats.get(cat.id)?.scale || 1;
    return out.set(cat.x, cat.y + md.height * k + 0.2, cat.z);
  }

  /** The middle of the cat, for "nearest cat to a tap" picking and for the camera to look at. */
  midPoint(cat, out) {
    const md = this.dimsOf(cat), k = this.own.has(cat.id) ? 1 : this.coats.get(cat.id)?.scale || 1;
    return out.set(cat.x, cat.y + md.height * 0.5 * k, cat.z);
  }

  /** Triangles drawn for cats this frame (for the stats line). */
  triangles() {
    let n = 0;
    for (const im of this.meshes) if (im.visible) n += (im.geometry.index ? im.geometry.index.count / 3 : im.geometry.attributes.position.count / 3) * im.count;
    for (const o of this.own.values()) for (const m of [o.hi, o.lo]) if (m?.visible) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
    return n;
  }

  /** How many cats are drawn from their own model, and how many of those at full detail. */
  ownCounts() {
    let full = 0;
    let shown = 0;
    for (const o of this.own.values()) { if (o.group.visible) shown++; if (o.group.visible && o.hi?.visible) full++; }
    return { own: this.own.size, shown, full };
  }
}

/* ── What a cat wears ──────────────────────────────────────────────────────
   Small low-poly meshes built in the head's frame (headFrame: centre C, radius r, forward f, up,
   side, skull top, neck ring) of each posed model, so they sit where the real cat wears them.
   White parts take the cat's accessory colour (instance colour); other parts keep their own. */

const WHITE = 0xffffff;
function part(geo, color = WHITE) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
  const n = g.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color(color);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** A matrix from the head frame: local x forward, y up, z side, in units of the head's radius, at `at`. */
function frameMatrix(F, at, scale = F.r, axes = [F.f, F.up, F.side]) {
  const m = new THREE.Matrix4().makeBasis(axes[0], axes[1], axes[2]);
  m.scale(new THREE.Vector3(scale, scale, scale));
  m.setPosition(at);
  return m;
}

/** One accessory's geometry on a posed model, or null for an unknown kind. */
export function buildWear(type, F) {
  if (!F) return null;
  const { C, r, f, up, side, neck } = F;
  const top = new THREE.Vector3(C.x, F.top, C.z).addScaledVector(f, -r * 0.08);
  const parts = [];
  const add = (g, color, m) => parts.push(part(g, color).applyMatrix4(m));
  const onTop = (dy = 0) => frameMatrix(F, top.clone().addScaledVector(up, dy * r));
  // The neck ring's own frame: axis along the neck, "front" towards the face.
  const nAxis = neck.axis.clone(), nFront = f.clone().addScaledVector(nAxis, -f.dot(nAxis)).normalize(), nSide = new THREE.Vector3().crossVectors(nFront, nAxis).normalize();
  const neckM = (dy = 0, s = 1) => frameMatrix(F, neck.N.clone().addScaledVector(nAxis, dy * r), neck.r * s, [nFront, nAxis, nSide]);
  const front = (k = 1.02) => neck.N.clone().addScaledVector(nFront, neck.r * k);
  switch (type) {
    case "beanie":
      add(new THREE.SphereGeometry(0.95, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.05, 0.95, 1.05), WHITE, onTop(-0.45));
      add(new THREE.TorusGeometry(0.98, 0.14, 5, 14).rotateX(Math.PI / 2), WHITE, onTop(-0.42));
      add(new THREE.IcosahedronGeometry(0.24, 0), WHITE, onTop(0.5));
      break;
    case "cap":
      add(new THREE.SphereGeometry(0.9, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.05, 0.75, 1.0), WHITE, onTop(-0.35));
      add(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 12, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 1.1).translate(0.55, 0, 0), WHITE, onTop(-0.33));
      break;
    case "tweed":
      add(new THREE.SphereGeometry(0.98, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.1, 0.42, 1.0).translate(-0.05, 0, 0), WHITE, onTop(-0.22));
      add(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 10, 1, false, -Math.PI / 2, Math.PI).translate(0.62, 0, 0).rotateZ(-0.15), WHITE, onTop(-0.2));
      break;
    case "hood": // a Robin Hood cap with a red feather
      add(new THREE.ConeGeometry(0.85, 1.5, 8).rotateZ(Math.PI / 2 + 0.35).scale(1, 0.55, 1), WHITE, onTop(0));
      add(new THREE.BoxGeometry(1.1, 0.05, 0.14).rotateZ(0.7).translate(-0.2, 0.45, 0.4), 0xd8262e, onTop(0));
      break;
    case "witch":
      add(new THREE.CylinderGeometry(1.45, 1.45, 0.08, 16), WHITE, onTop(-0.3));
      add(new THREE.ConeGeometry(0.72, 2.0, 12).rotateZ(0.25).translate(-0.15, 1.0, 0), WHITE, onTop(-0.3));
      add(new THREE.TorusGeometry(0.66, 0.08, 4, 14).rotateX(Math.PI / 2), 0xf5c542, onTop(-0.2));
      break;
    case "crown":
      add(new THREE.CylinderGeometry(0.62, 0.62, 0.35, 10, 1, true), 0xf5c542, onTop(-0.08));
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; add(new THREE.ConeGeometry(0.14, 0.34, 4).translate(Math.cos(a) * 0.6, 0.32, Math.sin(a) * 0.6), 0xf5c542, onTop(-0.08)); }
      add(new THREE.IcosahedronGeometry(0.1, 0).translate(0.64, 0.02, 0), 0xd8262e, onTop(-0.08));
      break;
    case "headband": {
      const at = C.clone().addScaledVector(up, r * 0.3);
      const ax = up.clone().addScaledVector(f, 0.45).normalize(), fr = f.clone().addScaledVector(ax, -f.dot(ax)).normalize(), sd = new THREE.Vector3().crossVectors(fr, ax);
      const m = frameMatrix(F, at, r, [fr, ax, sd]);
      add(new THREE.TorusGeometry(0.93, 0.13, 4, 18).rotateX(Math.PI / 2).scale(1.02, 1.3, 1.02), WHITE, m);
      add(new THREE.BoxGeometry(0.1, 0.55, 0.16).rotateZ(0.5).translate(-1.12, -0.25, 0.12), WHITE, m);
      add(new THREE.BoxGeometry(0.1, 0.5, 0.16).rotateZ(0.8).translate(-1.12, -0.3, -0.12), WHITE, m);
      break;
    }
    case "bow": {
      const at = C.clone().addScaledVector(up, r * 0.72).addScaledVector(side, r * 0.55).addScaledVector(f, r * 0.05);
      const m = frameMatrix(F, at);
      add(new THREE.ConeGeometry(0.32, 0.55, 5).rotateX(Math.PI / 2).translate(0, 0, 0.3), WHITE, m);
      add(new THREE.ConeGeometry(0.32, 0.55, 5).rotateX(-Math.PI / 2).translate(0, 0, -0.3), WHITE, m);
      add(new THREE.IcosahedronGeometry(0.16, 0), WHITE, m);
      break;
    }
    case "collar":
      add(new THREE.TorusGeometry(1.04, 0.1, 4, 18).rotateX(Math.PI / 2).scale(1, 1.6, 1), WHITE, neckM());
      break;
    case "bell":
      add(new THREE.SphereGeometry(0.13, 8, 6), WHITE, frameMatrix(F, front(1.12).addScaledVector(nAxis, -r * 0.12), r));
      break;
    case "tag":
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 10).rotateZ(Math.PI / 2), WHITE, frameMatrix(F, front(1.1).addScaledVector(nAxis, -r * 0.14), r, [nFront, nAxis, nSide]));
      break;
    case "tie":
      add(new THREE.ConeGeometry(0.17, 0.75, 4).rotateZ(Math.PI).translate(0, -0.42, 0), WHITE, frameMatrix(F, front(1.06), r, [nFront, nAxis, nSide]));
      add(new THREE.BoxGeometry(0.12, 0.14, 0.2), WHITE, frameMatrix(F, front(1.08), r, [nFront, nAxis, nSide]));
      break;
    case "scarf":
      add(new THREE.TorusGeometry(1.06, 0.2, 5, 18).rotateX(Math.PI / 2).scale(1, 1.3, 1), WHITE, neckM(-0.05));
      add(new THREE.BoxGeometry(0.1, 0.7, 0.3).translate(0, -0.4, 0.25).rotateX(0.2), WHITE, frameMatrix(F, front(1.08), r, [nFront, nAxis, nSide]));
      break;
    case "sunglasses": {
      const eyeC = C.clone().addScaledVector(f, r * 0.92).addScaledVector(up, r * 0.1);
      const m = frameMatrix(F, eyeC);
      for (const z of [-0.36, 0.36]) {
        add(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 10).rotateZ(Math.PI / 2).translate(0.02, 0, z), 0x1a1a22, m);
        add(new THREE.TorusGeometry(0.28, 0.05, 4, 12).rotateY(Math.PI / 2).translate(0.03, 0, z), WHITE, m);
      }
      add(new THREE.BoxGeometry(0.06, 0.06, 0.2), WHITE, m);
      add(new THREE.BoxGeometry(0.7, 0.05, 0.05).translate(-0.35, 0.05, 0.62), WHITE, m);
      add(new THREE.BoxGeometry(0.7, 0.05, 0.05).translate(-0.35, 0.05, -0.62), WHITE, m);
      break;
    }
    case "bag": { // a paper bag over the head, with eye holes
      const m = frameMatrix(F, C.clone().addScaledVector(up, r * 0.15));
      add(new THREE.BoxGeometry(2.3, 2.5, 2.3), WHITE, m);
      for (const z of [-0.42, 0.42]) add(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 10).rotateZ(Math.PI / 2).translate(1.16, 0.2, z), 0x1a1410, m);
      add(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8).rotateZ(Math.PI / 2).translate(1.16, -0.3, 0), 0x1a1410, m);
      add(new THREE.BoxGeometry(2.36, 0.12, 2.36).translate(0, 1.2, 0), 0xa87a44, m);
      break;
    }
    case "crescent": {
      const at = C.clone().addScaledVector(f, r * 0.85).addScaledVector(up, r * 0.5);
      add(new THREE.TorusGeometry(0.28, 0.07, 4, 10, Math.PI * 1.2).rotateY(Math.PI / 2).rotateX(-0.6), WHITE, frameMatrix(F, at));
      break;
    }
    default:
      return null;
  }
  const g = mergeGeometries(parts);
  g.computeBoundingSphere();
  return g;
}

/** The accessories' material: flat, lit, coloured per vertex times per cat, moving with the head. */
function wearMaterial(md) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uTime: AMBIENT.uTime, uHead: { value: md.head } });
    shader.vertexShader = "attribute vec4 aAnim;\nuniform float uTime;\nuniform vec3 uHead;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      {
        float T = uTime + aAnim.z;
        vec3 p0 = position;
        ${HEAD_GLSL.replace("distance(p0, uHead)", "min(distance(p0, uHead), 0.18)")}
      }`);
  };
  mat.customProgramCacheKey = () => "cat-wear";
  return mat;
}
