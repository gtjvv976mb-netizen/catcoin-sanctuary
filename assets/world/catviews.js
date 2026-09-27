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
import { findRig, buildSkeleton, skinWeights, makeClips, cyclesPerUnit, GAIT_RATE, PIVOT_TURN, STOPS } from "./catrig.js";
import { ACTIONS, NEUTRAL_TRAITS } from "./catmotion.js";
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
  let maxX = -Infinity, H = 0, hiX = -Infinity;
  for (let i = 0; i < n; i++) { maxX = Math.max(maxX, pos[i * 3]); H = Math.max(H, pos[i * 3 + 1]); }
  // (A stretching cat's front paws reach past its head: its head is the front of what is up high.)
  for (let i = 0; i < n; i++) if (pos[i * 3 + 1] > 0.4 * H) hiX = Math.max(hiX, pos[i * 3]);
  // The head's points: the top of a sitting cat, the front of the others (every pose faces +x).
  const inHead = {
    sit: (p) => p.y > 0.78 * H,
    walk: (p) => p.x > maxX - 0.34 && p.y > 0.5 * H,
    loaf: (p) => p.x > maxX - 0.4 && p.y > 0.45 * H,
    stretch: (p) => p.x > hiX - 0.34 && p.y > 0.4 * H,
    sleep: (p) => p.x > maxX - 0.38 && p.y > 0.35 * H,
  }[pose] || ((p) => p.y > 0.78 * H);
  const pts = [];
  for (let i = 0; i < n; i++) { const p = V(i); if (inHead(p)) pts.push(p); }
  if (pts.length < 12) return null;
  // Leave the ears out of the centre: the highest tenth of the head's points.
  const ys = pts.map((p) => p.y).sort((a, b) => a - b), earY = ys[Math.floor(ys.length * 0.88)];
  const skull = pts.filter((p) => p.y <= earY);
  const C = skull.reduce((m, p) => m.add(p), new THREE.Vector3()).divideScalar(skull.length);
  // A sitting cat's head points reach down its tall ears less than its face: its eyes sit about a
  // ninth of a unit below the middle of those points (measured on both models).
  if (pose === "sit") { C.y -= 0.11; C.x += 0.03; }
  const ds = skull.map((p) => p.distanceTo(C)).sort((a, b) => a - b);
  const r0 = Math.max(0.08, Math.min(0.2, ds[Math.floor(ds.length * 0.5)]));
  const f = new THREE.Vector3(1, 0, 0);
  let nose = null;
  for (const p of skull) if (Math.abs(p.z - C.z) < r0 * 0.3 && Math.abs(p.y - C.y) < r0 * 0.7 && (!nose || p.x > nose.x)) nose = p.clone();
  if (nose) { f.copy(nose).sub(C); f.z = 0; f.y *= 0.5; f.normalize(); }
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(f, -f.y).normalize();
  const side = new THREE.Vector3().crossVectors(f, up).normalize();
  // The top of the skull: the highest point on the head's middle line, between the ears.
  let top = C.y + r0 * 0.5;
  for (const p of pts) if (Math.abs(p.z - C.z) < r0 * 0.22 && Math.abs(p.x - C.x) < r0 * 0.5) top = Math.max(top, p.y);
  top = Math.min(Math.max(top, earY - r0 * 0.1), C.y + r0 * 1.2);
  // The head's radius: from its centre up to the skull (the points round it reach into the cheeks and neck).
  const r = Math.max(0.1, Math.min(0.18, (top - C.y) * 0.56 + (nose ? nose.distanceTo(C) : r0) * 0.38));
  // The neck: below and behind the head's centre.
  const axis = pose === "sit" ? new THREE.Vector3(0.25, 1, 0).normalize() : pose === "sleep" ? new THREE.Vector3(1, 0.15, 0).normalize() : new THREE.Vector3(1, 0.9, 0).normalize();
  const N = C.clone().addScaledVector(axis, -r * (pose === "sit" ? 1.05 : 0.9));
  const radii = [];
  for (let i = 0; i < n; i++) {
    const d = V(i).sub(N), along = d.dot(axis);
    if (Math.abs(along) < 0.025) { const rr = d.addScaledVector(axis, -along).length(); if (rr < r * 2) radii.push(rr); }
  }
  radii.sort((a, b) => a - b);
  const rn = radii.length > 8 ? radii[Math.floor(radii.length * 0.95)] : r * 0.85;
  return { C, r, f, up, side, top, nose: nose ? nose.distanceTo(C) : r, neck: { N, axis, r: Math.max(r * 0.7, Math.min(rn * 1.02, r * 1.05)), raw: rn } };
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
attribute float aFade; // cross-fading into another pose: > 0 shown on that share of pixels, < 0 on the rest
uniform float uTime;
uniform int uPose;
varying float vFade;
uniform vec3 uHead;
uniform vec3 uTail;
uniform vec3 uHeadF;
uniform vec4 uHeadC;
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
varying vec3 vHeadC;
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
uniform vec4 uHeadC;
varying vec3 vHeadC;
varying float vFade;
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
  // A jacket: the torso, not the head, legs or tail. The head is kept clear by its own measured
  // centre and radius (a good way past it: cheeks, ears and the back of the head stay fur), with
  // the collar a little below the jaw.
  if (vCoatE.w > 0.5) {
    float hr = max(uHeadC.w * 1.6, 0.3);
    float headOff = uHeadC.w > 0.0 ? smoothstep(hr, hr + 0.07, length(vHeadC)) : (hasHead ? smoothstep(0.3, 0.38, length(hv)) : 1.0);
    // …and nothing level with the head nearby: a loafing or sleeping cat's head sits low, close to its back.
    if (uHeadC.w > 0.0) headOff *= 1.0 - smoothstep(-0.1, -0.04, vHeadC.y) * (1.0 - smoothstep(0.36, 0.44, length(vHeadC.xz)));
    float torso = smoothstep(0.26, 0.34, p.y / h) * headOff * (1.0 - step(0.0, vTailD));
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
      // The head's own centre and radius (headFrame), for keeping a jacket off the head and neck.
      uHeadC: { value: md.frame ? new THREE.Vector4(md.frame.C.x, md.frame.C.y, md.frame.C.z, md.frame.r) : new THREE.Vector4(0, -9, 0, 0) },
      uTailLen: { value: md.tailLen },
    });
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vCatPos = position / ${CAT.size.toFixed(3)};
      vCatNrm = normal;
      vCoatA = aCoatA; vCoatB = aCoatB; vCoatC = aCoatC; vCoatD = aCoatD; vCoatE = aCoatE; vAnim = aAnim; vFade = aFade;
      vHeadV = uHead.y > -1.0 ? position - uHead : vec3(9.0);
      vHeadC = uHeadC.w > 0.0 ? position - uHeadC.xyz : vec3(9.0);
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
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
      // A posture change drawn from two shared poses at once: each pixel from one or the other, in a
      // fine dither whose share moves from the first pose to the second (no pop halfway).
      if (vFade != 0.0) {
        float dz = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (vFade > 0.0 ? dz >= vFade : dz < 1.0 + vFade) discard;
      }`)
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
   (a quadruped skeleton found from its shape, skin weights blended along the surface) and gives
   it a clip for every action in catmotion.js, posed by inverse kinematics in the cat's own style
   (traits.js styleOf: a kitten's bounce, an old cat's short steps, a heavy cat's waddle). Near the
   camera a cat is drawn from the full model, further off from a lighter copy (<TICKER>-lo.glb) on
   the same skeleton: the nearest OWN.maxHi within OWN.hiDist get the full one and keep it until
   they are past OWN.maxHiOut or OWN.hiOut, so two cats passing each other at the edge don't swap
   back and forth; the same holds for OWN.drawDist and OWN.drawOut, beyond which a cat is drawn
   from the shared models.

   How a cat's own model moves (animateOwn): every frame, what the sim says the cat is doing
   (cat.motion: its action, gait, progress, the distance it really walked, how fast it turns, what
   it looks at) sets the weights and times of its clips by hand, and then a few procedural layers
   go on the bones.
   - The action shown goes to full weight over its clip's fade (0.15 s; 0.25 s between two loops of
     one posture), everything else to none, each from wherever it is (never a restart at full
     weight, as three's crossFadeTo does), and clips on their way out keep moving.
   - The four gaits share one phase, stepped by the distance covered, the cat's cycles per unit and
     the blended GAIT_RATE, and blend into one another over 0.3 s: paws stay planted through a
     change of gait.
   - Posture changes and once-through moves (sitting down, a hop) play at the sim's progress
     (u × their length); idle loops start at a phase of the cat's own.
   - The head turns to what the cat looks at in quick glances, then holds there while the body
     moves (up to 70° aside, 35° up or down); a curious cat tilts its head now and then; a friendly
     one gives you a slow blink (a slow dip of the head); the ears it hasn't got flick as a tiny
     twitch of the head. The back bends into a turn. The tail is a damped spring: it lags a turn
     and swings back, sways slowly when the cat is content, lashes (or thumps, lying down) when it
     is cross, twitches at the tip when it hunts, quivers in a greeting. The flanks breathe, slower
     and deeper asleep. All of it fades out while a posture change or a once-through move plays,
     so it never fights the clip, and with distance.
   - A cat that was out of sight for more than half a second comes back already in its current
     action; beyond ANIM.throttle a cat is posed 20 times a second.
   Without cat.motion (an older sim), clipFor picks the clip from the pose. */

export const OWN = { maxHi: 10, maxHiOut: 12, hiDist: 14, hiOut: 18, index: "assets/models/cats/index.json", drawDist: 55, drawOut: 62 };

/** Level of detail for the shared, tinted cats: beyond `far` units from the camera a cat is drawn
    from the lightest copy; beyond `cullNear` a cat outside the view is not drawn at all. */
export const LOD = { far: 26, cullNear: 14 };
/** How tall a cat stands in each pose, as a share of its standing height (for its tag and the camera). */
const OWN_HEIGHT = { walk: 1, sit: 1.05, stretch: 0.8, loaf: 0.62, sleep: 0.45 };
const POSTURE_H = { move: 1, stand: 1, sit: 1.05, lie: 0.62, sleep: 0.45, air: 0.9 };
/** The shared pose of each posture (cats.js poseOf), for cross-fading a posture change. */
const TRANS_POSE = { stand: "walk", sit: "sit", lie: "loaf", sleep: "sleep" };

/** The scale from a normalized model (1 unit tall, standing) to the garden's cat size. */
export function ownScale(dims) {
  return (CAT.size * 0.95) / (dims.height || 1);
}

/** Which clip a cat plays now, from its pose and what it is doing (for a sim without cat.motion). */
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

/** The controller's timings (s) and reach: blends, when a returning cat snaps, where far cats are
    posed less often and where the procedural layers fade out (units from the camera), and how far
    the head turns (rad). */
export const ANIM = { fade: 0.15, loopFade: 0.25, moveFade: 0.2, changeFade: 0.3, gaitBlend: 0.3, snapAfter: 0.5, throttle: 30, layerNear: 24, layerFar: 32, lookYaw: 1.22, lookPitch: 0.61 };

/** How much each action leaves to the procedural layers: [head turns to look, tail spring, back
    bends into a turn, breathing]. Posture changes and once-through moves: nothing (the clip does it). */
const LAYERS = {
  walk: [0.55, 0.7, 1, 0], trot: [0.35, 0.6, 1, 0], run: [0.15, 0.5, 0.8, 0], stalk: [0.9, 0.9, 0.7, 0],
  stand: [1, 1, 0.5, 1], sniff: [0.25, 1, 0.3, 0.7], greet: [0.8, 1, 0.3, 1], eat: [0, 0.8, 0, 0.5],
  crouch: [1, 1, 0.2, 0.6], wiggle: [0.9, 0.7, 0, 0.4], scratch: [0.15, 0.6, 0, 0], headBunt: [0, 1, 0, 0.7], hindStand: [0.8, 0.7, 0, 0.5],
  sit: [1, 1, 0.2, 1], look: [0.6, 1, 0.2, 1], pant: [0.6, 1, 0.2, 0], groom: [0, 0.8, 0, 0.4], legLick: [0, 0.6, 0, 0.3], earScratch: [0, 0.8, 0, 0.3],
  knead: [0.5, 1, 0, 0.8], beckon: [0.6, 1, 0, 0.8], chatter: [0.7, 1, 0.1, 0.4],
  loaf: [1, 1, 0, 1], dab: [0.4, 1, 0, 0.6], flop: [0.4, 0.8, 0, 1.2], roll: [0, 0.3, 0, 0.5], sleep: [0, 0.35, 0, 1.4],
  hop: [0, 0.25, 0, 0], pounce: [0, 0.25, 0, 0],
};
const NO_LAYERS = [0, 0, 0, 0];
/** What the tail says in each action: hunting (tip twitches), greeting (up, quivering), at rest
    (sways; lashes if cross), lying (a cross cat thumps it), asleep. */
const HUNT = 1, GREET = 2, REST = 4, LIE = 8, SLEEP = 16;
const MOOD = { stalk: HUNT, crouch: HUNT | REST, wiggle: HUNT, chatter: HUNT | REST, greet: GREET, headBunt: GREET, stand: REST, sit: REST, look: REST, pant: REST, knead: REST, beckon: REST, sniff: REST, loaf: REST | LIE, flop: REST | LIE, dab: LIE, roll: LIE, sleep: SLEEP };
const GAITS = ["walk", "trot", "run", "stalk"];
const GAIT_I = { walk: 0, trot: 1, run: 2, stalk: 3 };
/** Where each gait's cycle starts on the shared phase (of a cycle): chosen so each paw's stance is
    centred as near as can be on its stance in the gait next to it (catrig's footfalls: walk and
    stalk lateral sequence, trot diagonal pairs, run a rotary gallop), so a paw that is planted in one
    is planted, near the same spot, in the other while they blend. */
const GAIT_AT = [0, -0.21, -0.18, 0];
/** The fastest each gait's legs are stepped (units per second of ground): ground counted faster than
    that (a quick turn on the spot counted as steps, a shove) is not stepped out in a flurry of legs. */
const GAIT_VMAX = [1.6, 2.6, 4.5, 0.7];
/** The clip standing in for a posture (reduced motion, or an action a clip set lacks). */
const BASE = { move: "stand", stand: "stand", sit: "sit", lie: "loaf", sleep: "sleep", air: "stand" };
const STILL_CLIP = { walk: "stand", sit: "sit", loaf: "loaf", stretch: "stand", sleep: "sleep" };
/** The bones the layers turn (their clip pose is put back before each mixer update). */
const LAYER_BONES = ["spine", "chest", "neck", "head", "tail1", "tail2", "tail3", "tail4"];
/** The tail's segments, root to tip: stiffness (rad/s), how far a turn swings each, and each one's share of a sway. */
const TAIL_W = [15, 13, 11, 9.5], TAIL_TURN = [0.6, 0.7, 0.8, 0.9], TAIL_SWAY = [0.3, 0.27, 0.23, 0.2];

const TAU = Math.PI * 2;
const smooth01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const wrapA = (a) => a - Math.round(a / TAU) * TAU;
const clampA = (a, m) => (a > m ? m : a < -m ? -m : a);
/** 0 before `a`, easing up over `fin` s, held, easing down over `fout` s to 0 at `b`. */
const env = (now, a, b, fin, fout) => (now <= a || now >= b ? 0 : smooth01((now - a) / fin) * smooth01((b - now) / fout));
/** A per-cat random number in [0, 1). */
const rnd = (A) => (A.r = (Math.imul(A.r, 1664525) + 1013904223) >>> 0) / 4294967296;
/** Moves s[k] (with velocity s[v]) towards `to`, critically damped, arriving in about `time` s; stable at any step. */
function damp(s, k, v, to, time, dt) {
  const w = 2 / Math.max(1e-3, time), x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const ch = s[k] - to, tmp = (s[v] + w * ch) * dt;
  s[v] = (s[v] - w * tmp) * e;
  s[k] = to + (ch + tmp) * e;
}
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qd = new THREE.Quaternion(), _qe = new THREE.Quaternion();
const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _vc = new THREE.Vector3(), _vd = new THREE.Vector3();
const _AX = new THREE.Vector3(1, 0, 0), _AY = new THREE.Vector3(0, 1, 0), _AZ = new THREE.Vector3(0, 0, 1);

/** A cat's animation state for its own model: clip weights, the gait phase, and its layers, tuned
    by its character (cat.traits, 0..1 each; see traits.js). */
export function animState(o, cat) {
  const t = { ...NEUTRAL_TRAITS, ...(cat.traits || {}) }, rig = o.rig, bones = o.sk.bones;
  const kit = t.age === "kitten", old = t.age === "senior", flags = Array.isArray(t.flags) ? t.flags : [];
  let seed = 2166136261;
  for (let i = 0; i < cat.id.length; i++) seed = Math.imul(seed ^ cat.id.charCodeAt(i), 16777619);
  const tdir = new Float32Array(12);
  for (let k = 0; k < 4; k++) {
    const d = new THREE.Vector3().subVectors(rig.tail[k + 1], rig.tail[k]).normalize();
    tdir[k * 3] = d.x; tdir[k * 3 + 1] = d.y; tdir[k * 3 + 2] = d.z;
  }
  const A = {
    e: Object.create(null), live: [], target: null, fade: ANIM.fade, u: 0, t: -1, r: (seed >>> 0) || 1,
    gs: new Float64Array(4), gp: new Float64Array(4), gd0: new Float64Array(4), gcur: -1, phi: 0, odo: null, gaitA: [null, null, null, null], lg: new Float64Array(4),
    pv: 0, pph: 0, pivA: null, // turning on the spot: the pivot clip's share of the walk, its phase
    stop: null, // pulling up out of a gait: { key: the stop clip, then: the loop it leads into }
    bones: LAYER_BONES.map((n) => bones[n]), saved: new Float32Array(LAYER_BONES.length * 4), hasSaved: false,
    eye: new THREE.Vector3().subVectors(rig.headC, rig.headJoint), tdir, hk: 1,
    // What the controller shares with the layers this frame: how much of each mood is showing.
    wMove: 0, wHunt: 0, wGreet: 0, wRest: 0, wLie: 0, wSleep: 0,
    yaw: 0, yr: 0, ya: 0, spd: 0, spdV: 0, bend: 0, bendV: 0,
    oy: 0, oyv: 0, op: 0, opv: 0, goalY: 0, goalP: 0, sacc: -9, hold: 1, aimed: false, atYou: false,
    tiltAt: 0, tiltEnd: 0, tiltNext: 0, tiltSide: 1, tiltAmp: 0.3, blinkAt: 0, blinkEnd: 0, blinkNext: 0, flickAt: 0, flickNext: 0, flickSide: 1,
    ts: new Float32Array(16), lashAt: 0, lashEnd: 0, lashNext: 0, twAt: -9, twN: 0, twAmp: 1, twNext: 0, bp: 0, bp0: 0,
    // Character.
    tail: !rig.tailStub && !flags.includes("tailless"),
    thr: 0.17 - 0.07 * t.curious, // how far off (rad) a new target must be before the head glances to it
    saccT: kit ? 0.055 : 0.08 - 0.025 * t.energy + (old ? 0.03 : 0), // how quick a glance is (s)
    tiltRate: Math.max(0, t.curious - 0.45) * 3.2, // head tilts a minute, looking at something
    blinkRate: Math.max(0, t.social - 0.35) * 4, // slow blinks a minute, looking at you
    lashRate: Math.max(0, t.grumpy - 0.55) * 7, // tail lashes a minute, at rest
    huntK: 0.4 + t.hunter, // how keen the tip twitches are
    swayAmp: Math.max(0.06, 0.15 + 0.16 * t.playful + 0.08 * t.social - 0.08 * t.sleepy - 0.2 * Math.max(0, 0.5 - t.bold)),
    swayHz: 0.3 + 0.28 * t.energy + (kit ? 0.1 : 0),
    breathK: 1 + 0.2 * (t.energy - 0.5) + (kit ? 0.15 : 0) - (t.build === "chunky" ? 0.06 : 0),
    stiff: old ? 1.15 : kit ? 0.85 : 1,
    gentle: flags.includes("gentle"),
  };
  A.bp = rnd(A) * TAU; A.bp0 = rnd(A) * TAU;
  return A;
}

/** The mixer action for one of a cat's clips; its time is always set by hand (timeScale 0). */
function actionOf(o, name) {
  let a = o.actions[name];
  if (!a) {
    const clip = o.clips[name];
    a = o.actions[name] = o.mixer.clipAction(clip);
    if (clip.userData?.loop === false) a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true; a.timeScale = 0; a.weight = 0;
  }
  return a;
}

function entryOf(o, A, key) {
  let E = A.e[key];
  if (!E) {
    const gait = key === "gait", a = gait ? null : actionOf(o, key), clip = a ? a.getClip() : null, def = ACTIONS[key];
    E = A.e[key] = {
      key, a, kind: gait ? "gait" : def ? def.kind : clip.userData?.loop === false ? "once" : "loop", post: gait ? "move" : def ? def.posture : "stand",
      dur: clip ? clip.duration : 1, fade: clip?.userData?.fade ?? ANIM.fade, s: 0, d0: 0, p: 0, t: 0, L: LAYERS[key] || (key.startsWith("stop:") ? LAYERS.stand : NO_LAYERS), mood: MOOD[key] || (key.startsWith("stop:") ? REST : 0),
    };
  }
  return E;
}

function stopEntry(A, X) {
  if (X.kind === "gait") { for (const a of A.gaitA) if (a && a.isScheduled()) a.stop(); if (A.pivA && A.pivA.isScheduled()) A.pivA.stop(); }
  else if (X.a.isScheduled()) X.a.stop();
}

/** How long the blend from P (what was shown) into E takes. */
function fadeFor(P, E) {
  if (!P) return E.fade;
  // Posture changes and once-through moves begin and end on the postures' own poses; out of a
  // mannerism far from that pose (the sim settles first, but an older one may not) it takes the
  // mannerism's own fade, and a gait's legs square up over a step's worth rather than snapping.
  if (E.kind === "once" || E.kind === "trans") return P.kind === "loop" && !PLAIN.has(P.key) ? Math.max(E.fade, P.fade) : P.kind === "gait" ? Math.max(E.fade, ANIM.moveFade) : E.fade;
  if (P.kind === "once" || P.kind === "trans") return E.fade;
  const a = P.post === "move" ? "stand" : P.post, b = E.post === "move" ? "stand" : E.post;
  if (a !== b) return ANIM.changeFade; // a posture change with no clip for it (an old sim)
  // Setting off (the head comes up from the bowl as it goes), pulling up (and lowering it).
  if (P.kind === "gait" || E.kind === "gait") return Math.max(ANIM.moveFade, Math.min(0.4, P.kind === "loop" ? P.fade : E.kind === "loop" ? E.fade : 0));
  return Math.max(E.fade, P.fade, ANIM.loopFade); // one loop to another in the same posture: the slower of the two (off its side takes 0.7 s)
}
/** The plain loops of each posture: every posture change starts and ends on their first frame. */
const PLAIN = new Set(["stand", "sit", "loaf", "sleep"]);

/**
 * Poses a cat's own model for this frame. `now` is the page's animation time (s), `dist` how far
 * the cat is from the camera, `cam` the camera's position (a cat looking at you looks into it).
 * Returns false when a far cat was not due an update.
 */
export function animateOwn(o, cat, now, dist = 0, still = false, cam = null) {
  const A = o.anim;
  let dt = A.t < 0 ? Infinity : now - A.t;
  const snap = still || !(dt <= ANIM.snapAfter);
  if (!snap && dist > ANIM.throttle && dt < 0.045) return false;
  dt = snap ? 0 : Math.max(0, Math.min(dt, 0.1));
  A.t = now;
  // What to show: the sim's action (or, from an older sim, clipFor), its progress, the distance walked.
  const m = cat.motion;
  let action, u = null, odo, look = null;
  if (m && m.action) { action = m.action; u = typeof m.u === "number" ? m.u : null; odo = m.odometer || 0; look = m.look || null; }
  else { action = clipFor(cat); odo = (cat.stride || 0) / 5.2; }
  if (still) { action = m && m.posture ? BASE[m.posture] : STILL_CLIP[cat.pose] || "sit"; look = null; }
  if (!o.clips[action]) action = BASE[ACTIONS[action]?.posture] || "stand";
  const def = ACTIONS[action], kind = def ? def.kind : "loop", key = kind === "gait" ? "gait" : action;
  // The gaits' own weights: the gait the cat is in takes whatever the others leave, and they ease
  // out over ANIM.gaitBlend from where each one was (so even a gait that flickers can't pop).
  const G = A.e.gait;
  if (kind === "gait") {
    const gi = GAIT_I[action];
    if (snap || !G || G.s <= 0 || A.gcur < 0) { A.gs.fill(0); A.gp.fill(0); A.gs[gi] = 1; }
    else {
      if (gi !== A.gcur) { A.gd0[A.gcur] = A.gs[A.gcur]; A.gp[A.gcur] = 1; A.gp[gi] = 0; }
      let rest = 1;
      for (let i = 0; i < 4; i++) if (i !== gi) { A.gp[i] = Math.max(0, A.gp[i] - dt / ANIM.gaitBlend); A.gs[i] = A.gd0[i] * smooth01(A.gp[i]); rest -= A.gs[i]; }
      A.gs[gi] = Math.max(0, rest);
    }
    A.gcur = gi;
  }
  // Pulling up out of a gait into a standing loop: first the last step or two to stand square
  // (catrig's stop:<gait>:<k>, from the phase it pulled up at, on its own clock), then the loop.
  let tkey = key, pulling = false;
  if (A.stop) {
    const X = A.e[A.stop.key];
    if (snap || key !== A.stop.then || !X || X.t >= X.dur - 1e-6) A.stop = null;
    else tkey = A.stop.key;
  } else if (!snap && key !== A.target && A.target === "gait" && A.gcur >= 0 && A.wMove > 0.6 && def && def.kind === "loop" && def.posture === "stand") {
    const ph = A.phi + GAIT_AT[A.gcur], sk = `stop:${GAITS[A.gcur]}:${Math.round((ph - Math.floor(ph)) * STOPS) % STOPS}`;
    if (o.clips[sk]) { A.stop = { key: sk, then: key }; tkey = sk; pulling = true; }
  }
  // A new action: its blend time; what was shown starts to ease out from where it is; a loop starts
  // at a phase of its own, a move at its start.
  const E = entryOf(o, A, tkey);
  if (tkey !== A.target) {
    const P = A.target ? A.e[A.target] : null;
    A.fade = pulling ? E.fade : fadeFor(P, E);
    if (P) { P.d0 = P.s; P.p = 1; }
    if (E.s <= 0) E.t = E.kind === "loop" ? rnd(A) * E.dur : 0;
    else if (E.kind !== "loop" && E.kind !== "gait" && E.t >= E.dur) E.t = 0;
    E.p = 0;
    A.target = tkey;
    if (!A.live.includes(E)) A.live.push(E);
  } else if (u !== null && u < A.u - 0.5) E.t = 0; // the same move again, straight after the last
  A.u = u ?? 0;
  if (snap) {
    for (let i = 0; i < A.live.length; i++) { const X = A.live[i]; if (X !== E) { X.s = 0; X.p = 0; stopEntry(A, X); } }
    A.live.length = 0; A.live.push(E); E.s = 1;
    A.odo = odo;
  }
  // Weights: everything else eases out from where it was, and the action shown takes what they
  // leave; so the weights always add up to one and none can jump, however often the action changes.
  const step = dt / Math.max(0.02, A.fade);
  let rest = 1;
  for (let i = A.live.length - 1; i >= 0; i--) {
    const X = A.live[i];
    if (X === E) continue;
    X.p = Math.max(0, X.p - step);
    X.s = X.d0 * smooth01(X.p);
    if (X.s <= 1e-5) { X.s = 0; stopEntry(A, X); A.live[i] = A.live[A.live.length - 1]; A.live.pop(); continue; }
    rest -= X.s;
  }
  E.s = Math.max(0, rest);
  const sum = rest < 0 ? 1 - rest : 1;
  // The gait phase, from the distance the cat really covered.
  let dOdo = A.odo === null ? 0 : odo - A.odo;
  if (!(dOdo >= 0 && dOdo < 2)) dOdo = 0;
  A.odo = odo;
  // (Blended so the paws the blend plants move back exactly as fast as the ground goes by.)
  let inv = 0, vmax = 0;
  for (let i = 0; i < 4; i++) { inv += A.gs[i] / GAIT_RATE[GAITS[i]]; vmax += A.gs[i] * GAIT_VMAX[i]; }
  const ground = Math.min(dOdo, vmax * dt);
  A.phi = (A.phi + (inv > 0 ? ground * o.perUnit / inv : 0)) % 1;
  if (dt > 0) damp(A, "spd", "spdV", dOdo / dt, 0.25, dt);
  // Turning on the spot: the walk's steps give way to the pivot clip's, whose paws stay planted as the
  // body turns over them, stepped by the angle turned (backwards for a turn to the right).
  const turnYaw = A.t0yaw === undefined || snap ? 0 : wrapA(cat.yaw - A.t0yaw);
  A.t0yaw = cat.yaw;
  if (o.clips.pivot) {
    const yr = m && Number.isFinite(m.yawRate) ? Math.abs(m.yawRate) : 0, want = A.gcur === 0 ? smooth01((yr - 0.4) / 0.8) * (1 - smooth01(((cat.speed || 0) - 0.1) / 0.3)) : 0;
    A.pv = snap ? want : A.pv + (want - A.pv) * (1 - Math.exp(-dt / 0.1));
    A.pph = (A.pph + turnYaw / PIVOT_TURN) % 1;
  }
  // Every live clip's weight and time, and what the layers may do.
  let gH = 0, gT = 0, gS = 0, gB = 0;
  A.wMove = 0; A.wHunt = 0; A.wGreet = 0; A.wRest = 0; A.wLie = 0; A.wSleep = 0;
  for (let i = 0; i < A.live.length; i++) {
    const X = A.live[i], d = X.s / sum;
    if (X.kind === "gait") {
      A.wMove += d;
      for (let g = 0; g < 4; g++) {
        let w = d * A.gs[g];
        if (g === 0) {
          const wp = w * A.pv;
          if (wp > 1e-4) {
            const pa = A.pivA || (A.pivA = actionOf(o, "pivot"));
            if (!pa.isScheduled()) pa.play();
            pa.weight = wp; pa.time = (A.pph - Math.floor(A.pph)) * pa.getClip().duration;
            w -= wp; gH += wp * LAYERS.walk[0]; gT += wp * LAYERS.walk[1]; gS += wp * LAYERS.walk[2];
          } else if (A.pivA && A.pivA.isScheduled()) A.pivA.stop();
        }
        let a = A.gaitA[g];
        if (w > 1e-4 && o.clips[GAITS[g]]) {
          if (!a) a = A.gaitA[g] = actionOf(o, GAITS[g]);
          if (!a.isScheduled()) a.play();
          const ph = A.phi + GAIT_AT[g];
          a.weight = w; a.time = (ph - Math.floor(ph)) * a.getClip().duration;
          const L = LAYERS[GAITS[g]];
          gH += w * L[0]; gT += w * L[1]; gS += w * L[2]; gB += w * L[3];
          if (g === 3) A.wHunt += w;
        } else if (a && a.isScheduled()) a.stop();
      }
      continue;
    }
    const a = X.a;
    if (!a.isScheduled()) a.play();
    a.weight = d;
    if (X.kind === "loop") { X.t += dt; if (X.t >= X.dur) X.t %= X.dur; }
    else if (X === E) X.t = u !== null ? Math.min(1, Math.max(0, u)) * X.dur : Math.min(X.dur, X.t + dt);
    a.time = X.t;
    const L = X.L, md = X.mood;
    gH += d * L[0]; gT += d * L[1]; gS += d * L[2]; gB += d * L[3];
    if (md & HUNT) A.wHunt += d;
    if (md & GREET) A.wGreet += d;
    if (md & REST) A.wRest += d;
    if (md & LIE) A.wLie += d;
    if (md & SLEEP) A.wSleep += d;
  }
  // The clips' pose (the layers' bones put back first: the mixer only writes what changed).
  const bones = A.bones, Q = A.saved;
  if (A.hasSaved) for (let i = 0; i < bones.length; i++) bones[i].quaternion.fromArray(Q, i * 4);
  o.mixer.update(dt);
  for (let i = 0; i < bones.length; i++) bones[i].quaternion.toArray(Q, i * 4);
  A.hasSaved = true;
  // How tall it stands (for its tag and the camera), eased as the posture changes.
  const hk = m && m.posture ? POSTURE_H[m.posture] ?? 1 : OWN_HEIGHT[cat.pose] || 1;
  A.hk = snap ? hk : A.hk + (hk - A.hk) * Math.min(1, dt * 4);
  // How fast the body turns, and how fast that changes.
  const yawR = m && Number.isFinite(m.yawRate) ? m.yawRate : dt > 0 ? wrapA(cat.yaw - A.yaw) / dt : 0;
  A.yaw = cat.yaw;
  if (snap) { A.yr = 0; A.ya = 0; }
  else if (dt > 0) { const y0 = A.yr; A.yr += (clampA(yawR, 8) - A.yr) * Math.min(1, dt * 10); A.ya += (clampA((A.yr - y0) / dt, 30) - A.ya) * Math.min(1, dt * 8); }
  // How much each layer may do, eased (over about a third of a second, whatever the clips' own
  // blend): a posture change that starts with a quick fade must not let a swung tail or a turned
  // head spring back to the clip's in two frames.
  const LG = A.lg, kf = snap ? 1 : 1 - Math.exp(-dt / 0.12);
  LG[0] += (gH - LG[0]) * kf; LG[1] += (gT - LG[1]) * kf; LG[2] += (gS - LG[2]) * kf; LG[3] += (gB - LG[3]) * kf;
  // The layers, fading out with distance.
  const b = o.sk.bones, gD = still ? 0 : 1 - smooth01((dist - ANIM.layerNear) / (ANIM.layerFar - ANIM.layerNear));
  breathe(A, b, dt, LG[3] * gD);
  if (gD <= 0) return true;
  bendLayer(o, A, b, dt, LG[2] * gD, snap);
  lookLayer(o, cat, A, b, dt, now, look, LG[0] * gD, snap, cam);
  if (A.tail) tailLayer(A, dt, now, LG[1] * gD, snap);
  return true;
}

/** Breathing: the belly and flanks (the spine bone) rise and fall across the body; the chest is
    scaled back so nothing past it grows. ~24 a minute awake, ~18 asleep and deeper. */
function breathe(A, b, dt, g) {
  A.bp = (A.bp + dt * TAU * A.breathK * (0.4 - 0.1 * Math.min(1, A.wSleep))) % TAU;
  const k = 1 + g * 0.014 * (0.5 - 0.5 * Math.cos(A.bp));
  b.spine.scale.set(1, k, k); b.chest.scale.set(1, 1 / k, 1 / k);
}

/** The back bends into a turn: as much as the body's length along the curve it walks (so a tight
    turn bends it more), mostly in front, eased in and out. */
function bendLayer(o, A, b, dt, g, snap) {
  const want = g > 0 ? clampA((A.yr / Math.max(A.spd, 0.35)) * o.rig.d * o.s * 0.8, 0.32) * g : 0;
  if (snap) { A.bend = want; A.bendV = 0; } else damp(A, "bend", "bendV", want, 0.16, dt);
  if (Math.abs(A.bend) < 1e-4) return;
  b.spine.quaternion.multiply(_qa.setFromAxisAngle(_AY, A.bend * 0.45));
  b.chest.quaternion.multiply(_qa.setFromAxisAngle(_AY, A.bend * 0.55));
}

/** The head: to what the cat looks at in quick glances, then held there (the offset from the clip
    follows the body's turns, so the gaze stays put) until the target moves off; with no target it
    leads a turn a little. A curious cat tilts its head, a friendly one slow-blinks at you, and the
    ears flick (a tiny twitch). The neck takes a little under half of it. */
function lookLayer(o, cat, A, b, dt, now, look, g, snap, cam) {
  // The head as the clip (and the bend) posed it, in the model's frame: the chest turned by _qa,
  // the eyes at _vc, facing _vd.
  _qa.copy(b.pelvis.quaternion);
  _va.copy(b.pelvis.position).add(b.root.position);
  _vb.copy(b.spine.position).applyQuaternion(_qa).add(_va); _qa.multiply(b.spine.quaternion);
  _va.copy(b.chest.position).applyQuaternion(_qa).add(_vb); _qa.multiply(b.chest.quaternion);
  _vb.copy(b.neck.position).applyQuaternion(_qa).add(_va); _qb.copy(_qa).multiply(b.neck.quaternion);
  _va.copy(b.head.position).applyQuaternion(_qb).add(_vb); _qb.multiply(b.head.quaternion);
  _vc.copy(A.eye).applyQuaternion(_qb).add(_va);
  _vd.copy(_AX).applyQuaternion(_qb);
  const clipY = cat.yaw + Math.atan2(-_vd.z, _vd.x), clipP = Math.asin(clampA(_vd.y, 1));
  // Where the target is from the eyes (world heading, pitch). look.y is a height above the cat's
  // ground; a look at the person watching goes to the camera itself.
  let want = false, tY = 0, tP = 0;
  const wasYou = A.atYou;
  A.atYou = false;
  if (look && g > 0.01) {
    let ty = cat.y + (Number.isFinite(look.y) ? look.y : 0.3);
    if (cam && Math.abs(look.x - cam.x) < 0.75 && Math.abs(look.z - cam.z) < 0.75) { ty = cam.y; A.atYou = true; }
    const c = Math.cos(cat.yaw), s = Math.sin(cat.yaw), lx = look.x - cat.x, lz = look.z - cat.z;
    const mx = (c * lx - s * lz) / o.s - _vc.x, my = (ty - cat.y) / o.s - _vc.y, mz = (s * lx + c * lz) / o.s - _vc.z, h = Math.hypot(mx, mz);
    if (h + Math.abs(my) > 0.05) { tY = cat.yaw + Math.atan2(-mz, mx); tP = Math.atan2(my, h); want = true; }
  }
  let wantY, wantP;
  if (want) {
    const dY = clipY + clampA(wrapA(tY - clipY), ANIM.lookYaw), dP = clipP + clampA(tP - clipP, ANIM.lookPitch);
    const eY = wrapA(dY - A.goalY), eP = dP - A.goalP;
    // A glance: to a new target, one that has moved well off, or (after a hold) to where the eyes
    // have drifted off it.
    if (snap || !A.aimed || Math.abs(eY) > A.thr || Math.abs(eP) > A.thr * 0.8 || (now - A.sacc > A.hold && (Math.abs(eY) > 0.035 || Math.abs(eP) > 0.035))) {
      A.goalY = dY; A.goalP = dP; A.sacc = now; A.hold = 0.6 + rnd(A) * 1.8;
    }
    A.aimed = true;
    wantY = clampA(wrapA(A.goalY - clipY), ANIM.lookYaw); wantP = clampA(A.goalP - clipP, ANIM.lookPitch);
  } else { A.aimed = false; wantY = clampA(A.yr * 0.3, 0.5); wantP = 0; }
  if (snap) { A.oy = wantY; A.op = wantP; A.oyv = A.opv = 0; }
  else { const ts = want ? A.saccT : 0.3; damp(A, "oy", "oyv", wantY, ts, dt); damp(A, "op", "opv", wantP, ts, dt); }
  // Mannerisms, now and then: a curious head tilt at what it watches, a slow blink at you, an ear flick.
  if (!A.tiltNext) { A.tiltNext = now + 2 + rnd(A) * 12; A.flickNext = now + 4 + rnd(A) * 30; }
  const settled = A.wMove < 0.2 && g > 0.5;
  if (now >= A.tiltNext) {
    if (A.aimed && A.tiltRate > 0 && settled) {
      A.tiltAt = now; A.tiltEnd = now + 0.9 + rnd(A) * 1.4; A.tiltSide = rnd(A) < 0.5 ? -1 : 1; A.tiltAmp = 0.2 + 0.16 * rnd(A);
    }
    A.tiltNext = now + (60 / Math.max(0.25, A.tiltRate)) * (0.4 + rnd(A) * 1.2);
  }
  if (A.atYou && !wasYou) A.blinkNext = now + 0.6 + rnd(A) * (40 / Math.max(0.2, A.blinkRate));
  if (A.atYou && now >= A.blinkNext && A.blinkRate > 0 && settled && A.wRest + A.wLie > 0.4) {
    A.blinkAt = now; A.blinkEnd = now + 1.1 + rnd(A) * 0.9;
    A.blinkNext = now + 3 + rnd(A) * (60 / A.blinkRate);
  }
  if (now >= A.flickNext) { A.flickAt = now; A.flickSide = rnd(A) < 0.5 ? -1 : 1; A.flickNext = now + 12 + rnd(A) * 50; }
  const tilt = A.tiltSide * A.tiltAmp * env(now, A.tiltAt, A.tiltEnd, 0.3, 0.4);
  const dip = 0.14 * env(now, A.blinkAt, A.blinkEnd, 0.5, 0.5);
  const flick = A.flickSide * 0.05 * env(now, A.flickAt, A.flickAt + 0.14, 0.04, 0.09) * (1 - A.wSleep);
  const oy = A.oy * g, op = A.op * g;
  if (Math.abs(oy) + Math.abs(op) + Math.abs(tilt) + dip + Math.abs(flick) < 1e-4 || g <= 0) return;
  // The neck: 45% of the turn about the upright (taken into the chest's frame), 40% of the nod.
  _qd.setFromAxisAngle(_AY, oy * 0.45);
  _qe.copy(_qa).invert().multiply(_qd).multiply(_qa);
  b.neck.quaternion.premultiply(_qe).multiply(_qd.setFromAxisAngle(_AZ, (op * 0.4 - dip * 0.3 * g)));
  // The head: the rest of the turn, the nod, the blink's dip, the tilt and the flick.
  _qb.copy(_qa).multiply(b.neck.quaternion);
  _qd.setFromAxisAngle(_AY, oy * 0.55 + flick * 0.5 * g);
  _qe.copy(_qb).invert().multiply(_qd).multiply(_qb);
  b.head.quaternion.premultiply(_qe).multiply(_qd.setFromAxisAngle(_AZ, op * 0.6 - dip * 0.7 * g)).multiply(_qe.setFromAxisAngle(_AX, (tilt + flick) * g));
}

/** The tail: each of its four segments a damped spring (swinging sideways, and up and down),
    driven by the body's turns (it lags and swings back), a slow sway when content, a lash (a thump,
    lying down) when cross; the tip twitches when hunting (and in dreams), and it quivers held up in
    a greeting. Its carriage (low, relaxed, up) is the clip's, from the cat's style. */
function tailLayer(A, dt, now, g, snap) {
  const S = A.ts, rest = A.wRest, hunt = A.wHunt;
  if (snap) S.fill(0);
  if (!A.lashNext) { A.lashNext = now + 4 + rnd(A) * 20; A.twNext = now + 1 + rnd(A) * 8; }
  if (now >= A.lashNext) {
    if (A.lashRate > 0 && rest > 0.5) { A.lashAt = now; A.lashEnd = now + 1.2 + rnd(A) * 2; }
    A.lashNext = now + (A.lashRate > 0 ? 60 / A.lashRate : 30) * (0.5 + rnd(A));
  }
  if (now >= A.twNext) {
    const asleep = A.wSleep > 0.5;
    if (hunt > 0.3 || rest > 0.5 || asleep) { A.twAt = now; A.twN = 1 + Math.floor(rnd(A) * (asleep ? 1 : 3)); A.twAmp = hunt > 0.3 ? 1 : asleep ? 0.35 : 0.55; }
    const perMin = hunt > 0.3 ? 14 * A.huntK : asleep ? 2 : 1.5 * A.huntK;
    A.twNext = now + (60 / perMin) * (0.4 + rnd(A) * 1.2);
  }
  const lash = env(now, A.lashAt, A.lashEnd, 0.35, 0.5) * (A.gentle ? 0.6 : 1), lie = A.wLie;
  const twT = now - A.twAt, tw = twT >= 0 && twT < A.twN / 3.5 ? A.twAmp * Math.sin(TAU * 3.5 * twT) : 0;
  const sway = A.swayAmp * rest * (0.55 + 0.45 * Math.sin(now * 0.23 + A.bp0)) * (1 - lash);
  const ph = TAU * A.swayHz * now, lph = TAU * 1.5 * (now - A.lashAt), turn = clampA(-A.ya, 25);
  const n = snap ? 0 : Math.ceil(dt / 0.011), h = n ? dt / n : 0;
  for (let k = 0; k < 4; k++) {
    const side = sway * TAIL_SWAY[k] * 1.5 * Math.sin(ph - k * 0.9) + lash * (1 - 0.5 * lie) * 1.3 * TAIL_SWAY[k] * Math.sin(lph - k * 0.7) - A.yr * 0.035 * A.wMove;
    const pitch = k ? -0.3 * lie * lash * Math.max(0, Math.sin(lph * 0.8)) : 0;
    const w = TAIL_W[k] / A.stiff, z = 0.42, drive = turn * TAIL_TURN[k], i = k * 4;
    for (let j = 0; j < n; j++) {
      S[i + 1] += (w * w * (side - S[i]) - 2 * z * w * S[i + 1] + drive) * h; S[i] += S[i + 1] * h;
      S[i + 3] += (w * w * (pitch - S[i + 2]) - 2 * z * w * S[i + 3]) * h; S[i + 2] += S[i + 3] * h;
    }
  }
  if (g <= 1e-3) return;
  for (let k = 0; k < 4; k++) {
    const bone = A.bones[4 + k];
    // Fast flicks go straight on (a spring would swallow them): the tip's twitch, a greeting's quiver.
    const direct = (k === 3 ? 0.32 : k === 2 ? 0.14 : 0) * tw + (k ? A.wGreet * 0.03 * Math.sin(TAU * 9 * now + k) : 0);
    const side = (S[k * 4] + direct) * g, pitch = S[k * 4 + 2] * g;
    if (Math.abs(side) + Math.abs(pitch) < 1e-4) continue;
    // The segment as the clip holds it (in its parent's frame), and the axis that swings it sideways
    // whether it points back, down or straight up.
    _va.set(A.tdir[k * 3], A.tdir[k * 3 + 1], A.tdir[k * 3 + 2]).applyQuaternion(bone.quaternion);
    _vb.crossVectors(_va, _AZ);
    const l = _vb.length();
    if (l < 1e-3) _vb.copy(_AY); else _vb.divideScalar(l);
    _qa.setFromAxisAngle(_vb, side);
    if (pitch) _qa.multiply(_qd.setFromAxisAngle(_AZ, pitch));
    bone.quaternion.premultiply(_qa);
  }
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
  // Ginger (the orange model) is judged on the colour as seen (sRGB): in linear terms a brown tabby's
  // coat (Red Kitten Crew's #a5845f) reads as saturated orange, and a near-white one as saturated too.
  const hsl = base.getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
  const ginger = pattern === 1 && hsl.h > 0.03 && hsl.h < 0.12 && hsl.s > 0.45 && hsl.l < 0.8 && look.stripe < 0.97 && look.scale === 1;
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
   * @param {object} [opts]   blobShadows, contact; character: Map cat id → { traits, style } (else the sim's cat.traits and cat.style)
   */
  constructor(scene, models, sim, coats, { blobShadows = false, contact = false, character = null } = {}) {
    this.models = models;
    this.sim = sim;
    this.meshes = [];
    this.lookup = new Map(); // InstancedMesh → [cat per instance]
    this.coats = coats;
    this.highlight = new Map(); // cat id → 0..1
    this.scene = scene;
    this.blobShadows = blobShadows;
    this.own = new Map(); // cat id → { group, hi, lo, dims, s, u, anim, ... }
    this.ownRank = []; // the own-model cats, nearest the camera first (kept sorted frame to frame)
    this.character = character;
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
        geo.setAttribute("aFade", new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
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
    // A soft blob under each cat: its only shadow on phones (no shadow-map pass for cats there),
    // and on the other tiers a contact shadow that grounds it where the sun's shadow is too soft.
    if (blobShadows || contact) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 64;
      const g = cv.getContext("2d"), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, "rgba(0,0,0,1)"); grd.addColorStop(0.55, "rgba(0,0,0,0.55)"); grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(cv);
      this.blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, color: 0x2a3a1a, transparent: true, opacity: blobShadows ? 0.32 : 0.24, depthWrite: false }), sim.cats.length);
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
        const rig = findRig(f.pos, f.geometry.index ? f.geometry.index.array : null), sk = buildSkeleton(rig);
        const group = new THREE.Group();
        group.name = `cat ${catId}`;
        group.matrixAutoUpdate = false;
        group.add(sk.root);
        this.scene.add(group);
        const mixer = new THREE.AnimationMixer(sk.root);
        // Its character: how it moves (the clips in its style) and how big it is drawn.
        const style = this.styleOf(cat), k = Math.min(2, Math.max(0.5, style?.scale || 1));
        o = { cat, group, hi: null, lo: null, dims, s: ownScale(dims) * k, style, rig, sk, mixer, clips: null, anim: null, actions: {}, u: { hl: { value: 0 } }, near: false, drawOwn: false, dc: 0, size: { len: 0, height: 0, width: 0 } };
        o.perUnit = cyclesPerUnit(rig, o.s, style || undefined);
        this.own.set(catId, o);
        this.ownRank.push(o);
        // Its clips a moment later, in a task of their own (so a model arriving doesn't hold up one
        // frame for its rig, skin and clips all at once); until then it is drawn from the shared models.
        setTimeout(() => this.readyOwn(o), 0);
      }
      const { index, weight } = skinWeights(f.pos, o.rig, o.sk, f.geometry.index ? f.geometry.index.array : null);
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

  /** Makes a cat's clips and its animation state (see attachOwn). */
  readyOwn(o) {
    if (o.anim) return;
    o.clips = makeClips(o.rig, o.style || {});
    o.anim = animState(o, { id: o.cat.id, traits: this.character?.get(o.cat.id)?.traits || o.cat.traits });
  }

  /** Frees a cat's full model (its GPU geometry and textures); the far copy stays. Returns whether it had one. */
  dropOwnHi(catId) {
    const o = this.own.get(catId);
    if (!o?.hi) return false;
    const m = o.hi;
    o.group.remove(m);
    m.geometry.dispose();
    for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"]) m.material[k]?.dispose();
    m.material.dispose();
    const i = this.ownMeshes.findIndex(([mm]) => mm === m);
    if (i >= 0) this.ownMeshes.splice(i, 1);
    o.hi = null;
    return true;
  }

  /** A cat's motion style (traits.js styleOf): from the world's character table, else the sim's. */
  styleOf(cat) {
    return this.character?.get(cat.id)?.style || cat.style || null;
  }

  /** How much bigger (or smaller) than the shared models' cat size a cat is drawn: its style's scale
      (a kitten small, a big cat big), else its look's. */
  scaleOf(cat) {
    const s = this.styleOf(cat)?.scale;
    return s > 0 ? Math.min(2, Math.max(0.5, s)) : this.coats.get(cat.id)?.scale || 1;
  }

  /** The size a cat is drawn at, for its tag and the camera: its own model's when it has one (its
      height eased as it sits, lies or gets up). The object is reused: read it at once. */
  dimsOf(cat) {
    const o = this.own.get(cat.id);
    if (o) {
      const z = o.size, hk = o.anim && o.anim.t >= 0 ? o.anim.hk : OWN_HEIGHT[cat.pose] || 1;
      z.len = (o.dims.len || 1.2) * o.s; z.height = o.s * (o.dims.height || 1) * hk; z.width = (o.dims.width || 0.5) * o.s;
      return z;
    }
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
    // Which own-model cats get the full model: the nearest few within reach of the camera, kept
    // until they are clearly out of it (so the 10th and 11th nearest don't swap back and forth).
    const R = this.ownRank;
    for (let i = 0; i < R.length; i++) { const c = R[i].cat; R[i].dc = Math.hypot(c.x - cx, c.z - cz); }
    for (let i = 1; i < R.length; i++) { const o = R[i]; let j = i - 1; while (j >= 0 && R[j].dc > o.dc) { R[j + 1] = R[j]; j--; } R[j + 1] = o; } // (nearly sorted already)
    for (let i = 0; i < R.length; i++) { const o = R[i]; o.near = o.near ? i < OWN.maxHiOut && o.dc <= OWN.hiOut : i < OWN.maxHi && o.dc < OWN.hiDist; }
    const T = AMBIENT.uTime.value, camP = cam ? cam.position : null;
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
      // Drawn from its own model inside OWN.drawDist, and kept on it out to OWN.drawOut.
      const ownNear = !!o && !!o.anim && !!(o.hi || o.lo) && (o.drawOwn = hl0 > 0 || (o.drawOwn ? dist <= OWN.drawOut : dist < OWN.drawDist));
      if (o && !ownNear) o.group.visible = false;
      if (ownNear) {
        o.group.visible = true;
        // Place it: position and heading. The clips do the rest (hops and rolls included); only a
        // sim without cat.motion still tips the whole body for a hop or a sun-roll.
        _m.makeRotationY(cat.yaw).setPosition(cat.x, cat.y, cat.z);
        if (!cat.motion) {
          const a = cat.anim, h = this.dimsOf(cat).height;
          if (cat.pose === "stretch" && a.pitch && !a.pivot) _m.multiply(_r.makeRotationZ(a.pitch));
          if (a.roll && a.rollY) _m.multiply(_t.makeTranslation(0, a.rollY * h, 0)).multiply(_r.makeRotationX(a.roll)).multiply(_t.makeTranslation(0, -a.rollY * h, 0));
        }
        _m.multiply(_t.makeScale(o.s, o.s, o.s));
        o.group.matrix.copy(_m);
        o.group.matrixWorldNeedsUpdate = true;
        const useHi = !!o.hi && (!o.lo || o.near || hl0 > 0);
        if (o.hi) o.hi.visible = useHi;
        if (o.lo) o.lo.visible = !useHi;
        // Animate: what the sim says it does, blended by hand, then the head, back, tail and breath.
        animateOwn(o, cat, T, dist, !!this.still, camP);
        o.u.hl.value = hl0;
        if (this.blobs) {
          const md = this.dimsOf(cat);
          _t.makeRotationY(cat.yaw).setPosition(cat.x, cat.y + 0.02, cat.z).multiply(_r.makeScale(md.len * 0.8, 1, md.width * 1.1));
          this.blobs.setMatrixAt(cat.index, _t);
        }
        continue;
      }
      // A posture change (sitting down, lying down, getting up) is drawn from both its postures'
      // shared poses at once through its middle, dithered from the first into the second.
      const m = cat.motion, A = m && !this.still ? ACTIONS[m.action] : null;
      let pose2 = null, fade = 0;
      if (A && A.kind === "trans" && typeof m.u === "number") {
        const w = smooth01((m.u - 0.3) / 0.4), pa = TRANS_POSE[A.from], pb = TRANS_POSE[A.to];
        if (w > 0 && w < 1 && pa !== pb && (cat.pose === pa || cat.pose === pb)) { pose2 = cat.pose === pa ? pb : pa; fade = cat.pose === pa ? 1 - w : -w; }
      }
      const aStride = cat.stride || 0, aWalk = cat.pose === "walk" && !this.still ? Math.min(1, (cat.speed || 0) / 1.2) : 0, aPhase = (cat.phase || 0) % 50, aAwake = cat.pose === "sleep" ? 0 : 1;
      const far = dist > LOD.far && !hl0 ? "-far" : "";
      this.putShared(cat, cat.pose, far, pose2 ? fade : 0, aStride, aWalk, aPhase, aAwake);
      if (pose2) this.putShared(cat, pose2, far, fade > 0 ? fade - 1 : 1 + fade, aStride, pose2 === "walk" ? aWalk : 0, aPhase, pose2 === "sleep" ? 0 : 1);
      const md = this.models[cat.model][cat.pose];
      this.matrixFor(cat, md, _m);
      const coat = this.coats.get(cat.id);
      if (coat?.wears.length) for (const w of coat.wears) {
        const wm = this.wearMesh(w.type, cat.model, cat.pose);
        if (!wm) continue;
        const j = wm.count++;
        wm.setMatrixAt(j, _m);
        wm.setColorAt(j, w.color);
        wm.geometry.attributes.aAnim.setXYZW(j, aStride, aWalk, aPhase, aAwake);
      }
      if (this.blobs) {
        const kx = cat.pose === "sit" ? 0.62 : cat.pose === "sleep" ? 0.85 : md.len * 0.95, kz = cat.pose === "sit" ? 0.5 : cat.pose === "sleep" ? 0.8 : md.width * 0.8;
        _t.makeRotationY(cat.yaw).setPosition(cat.x, cat.y + 0.02, cat.z).multiply(_r.makeScale(kx, 1, kz));
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
      if (im.userData.fadeDirty) { im.geometry.attributes.aFade.needsUpdate = true; im.userData.fadeDirty = false; }
      im.boundingSphere = null; // recomputed on demand when picking
    }
  }

  /** One cat into the shared mesh of one pose: its matrix, coat (when the slot changes hands),
      animation values and cross-fade share (aFade; 0 when it is all in this pose). */
  putShared(cat, pose, far, fade, aStride, aWalk, aPhase, aAwake) {
    const im = this.byKey[`${cat.model}-${pose}${far}`];
    const md = this.models[cat.model][pose];
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
    im.geometry.attributes.aAnim.setXYZW(i, aStride, aWalk, aPhase, aAwake);
    const F = im.geometry.attributes.aFade;
    if (F.array[i] !== fade) { F.array[i] = fade; im.userData.fadeDirty = true; }
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
    const k = this.scaleOf(cat);
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
    const md = this.dimsOf(cat), k = this.own.has(cat.id) ? 1 : this.scaleOf(cat);
    return out.set(cat.x, cat.y + md.height * k + 0.2, cat.z);
  }

  /** The middle of the cat, for "nearest cat to a tap" picking and for the camera to look at. */
  midPoint(cat, out) {
    const md = this.dimsOf(cat), k = this.own.has(cat.id) ? 1 : this.scaleOf(cat);
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
  const rf = Math.max(r, F.nose || r); // how far the face reaches forward
  const top = new THREE.Vector3(C.x, F.top, C.z).addScaledVector(f, -r * 0.08);
  const parts = [];
  const add = (g, color, m) => parts.push(part(g, color).applyMatrix4(m));
  const onTop = (dy = 0) => frameMatrix(F, top.clone().addScaledVector(up, dy * r));
  // The neck ring's own frame: axis along the neck, "front" towards the face.
  const nAxis = neck.axis.clone(), nFront = f.clone().addScaledVector(nAxis, -f.dot(nAxis)).normalize(), nSide = new THREE.Vector3().crossVectors(nFront, nAxis).normalize();
  const neckM = (dy = 0, s = 1) => frameMatrix(F, neck.N.clone().addScaledVector(nAxis, dy * r), neck.r * s, [nFront, nAxis, nSide]);
  const front = (k = 1.02) => neck.N.clone().addScaledVector(nFront, neck.r * (k * 1.18 + 0.12));
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
      const at = C.clone().addScaledVector(up, r * 0.5);
      const ax = up.clone().addScaledVector(f, -0.3).normalize(), fr = f.clone().addScaledVector(ax, -f.dot(ax)).normalize(), sd = new THREE.Vector3().crossVectors(fr, ax);
      const m = frameMatrix(F, at, r, [fr, ax, sd]);
      add(new THREE.TorusGeometry(1.0, 0.13, 4, 18).rotateX(Math.PI / 2).scale(1.08, 1.3, 1.02), WHITE, m);
      add(new THREE.BoxGeometry(0.1, 0.55, 0.16).rotateZ(0.5).translate(-1.12, -0.25, 0.12), WHITE, m);
      add(new THREE.BoxGeometry(0.1, 0.5, 0.16).rotateZ(0.8).translate(-1.12, -0.3, -0.12), WHITE, m);
      break;
    }
    case "bow": {
      const at = C.clone().addScaledVector(up, r * 0.85).addScaledVector(side, r * 0.62).addScaledVector(f, r * 0.1);
      const m = frameMatrix(F, at, r * 2.1);
      add(new THREE.ConeGeometry(0.32, 0.55, 5).rotateX(Math.PI / 2).translate(0, 0, 0.3), WHITE, m);
      add(new THREE.ConeGeometry(0.32, 0.55, 5).rotateX(-Math.PI / 2).translate(0, 0, -0.3), WHITE, m);
      add(new THREE.IcosahedronGeometry(0.16, 0), WHITE, m);
      break;
    }
    case "collar":
      add(new THREE.TorusGeometry(1.04, 0.1, 4, 18).rotateX(Math.PI / 2).scale(1.18, 1.6, 1).translate(0.12, 0, 0), WHITE, neckM());
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
      add(new THREE.TorusGeometry(1.08, 0.2, 5, 18).rotateX(Math.PI / 2).scale(1.18, 1.3, 1).translate(0.12, 0, 0), WHITE, neckM(-0.05));
      add(new THREE.BoxGeometry(0.1, 0.7, 0.3).translate(0, -0.4, 0.25).rotateX(0.2), WHITE, frameMatrix(F, front(1.08), r, [nFront, nAxis, nSide]));
      break;
    case "sunglasses": {
      const eyeC = C.clone().addScaledVector(f, rf * 0.86).addScaledVector(up, r * 0.18);
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
      const m = frameMatrix(F, C.clone().addScaledVector(up, r * 0.15).addScaledVector(f, (rf - r) * 0.5), (rf + r) / 2);
      add(new THREE.BoxGeometry(2.3, 2.5, 2.3), WHITE, m);
      for (const z of [-0.42, 0.42]) add(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 10).rotateZ(Math.PI / 2).translate(1.16, 0.2, z), 0x1a1410, m);
      add(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8).rotateZ(Math.PI / 2).translate(1.16, -0.3, 0), 0x1a1410, m);
      add(new THREE.BoxGeometry(2.36, 0.12, 2.36).translate(0, 1.2, 0), 0xa87a44, m);
      break;
    }
    case "crescent": {
      const at = C.clone().addScaledVector(f, rf * 0.8).addScaledVector(up, r * 0.55);
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
