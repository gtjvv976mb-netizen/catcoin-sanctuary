/* Drawing the cats. Every pose of every model is one InstancedMesh, so all ninety-odd cats cost
   five draw calls (ten with the ginger tabby set): each frame, every cat writes its matrix and
   its coat into the mesh for the pose it is in.

   Coats are painted in the shader (onBeforeCompile on the models' own material). Each instance
   carries its coat: a base colour, a second colour, a pattern and an eye colour. The pattern is
   worked out from the model-space position of each point on the cat (every pose is fitted to one
   cat size, x forward and y up), so the same markings read on a sitting, walking or sleeping cat:

     0 solid   1 tabby stripes   2 tuxedo   3 calico patches   4 point (darker ears, face, paws,
     tail)    5 spotted          6 bicolor  7 tortie

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

export const PATTERNS = ["solid", "tabby", "tuxedo", "calico", "point", "spotted", "bicolor", "tortie"];

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
    out[coat][pose] = { geometry, lite, far, material, len: v.x, height: v.y, width: v.z, eye, head, pose, ref, ginger: coat === "ginger" };
  })));
  return out;
}

/* ── The coat shader ─────────────────────────────────────────────────── */

const VERT_HEAD = /* glsl */`
attribute vec4 aCoatA; // base colour (linear rgb), pattern id
attribute vec4 aCoatB; // second colour, seed
attribute vec4 aCoatC; // eye colour, highlight
attribute vec4 aAnim;  // stride, walking (0..1), phase, awake (0 asleep)
uniform float uTime;
uniform int uPose;
uniform vec3 uHead;
uniform vec3 uTail;
varying vec4 vAnim;
varying vec3 vCatPos;
varying vec3 vCatNrm;
varying vec4 vCoatA;
varying vec4 vCoatB;
varying vec4 vCoatC;
`;

const FRAG_HEAD = /* glsl */`
uniform float uRefLum;
uniform vec3 uRefColor;
uniform vec3 uEye;
uniform float uHeight;
uniform float uGinger;
uniform float uTime;
varying vec4 vAnim;
varying vec3 vCatPos;
varying vec3 vCatNrm;
varying vec4 vCoatA;
varying vec4 vCoatB;
varying vec4 vCoatC;

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
  if (pat == 1) {            // tabby: soft bands round the body and legs, a darker back, a paler belly
    float band = sin(6.2832 * (p.x * 3.6 + p.y * 2.7 + cFbm(s * 2.6) * 1.1));
    float stripe = smoothstep(0.25, 0.65, band);
    vec3 c = mix(base, second, stripe * 0.9);
    c = mix(c, second, smoothstep(0.55, 0.95, n.y) * smoothstep(0.35, 0.8, p.y / h) * 0.35);
    return mix(c, mix(base, vec3(1.0, 0.96, 0.9), 0.45), belly * 0.7);
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
    });
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vCatPos = position / ${CAT.size.toFixed(3)};
      vCatNrm = normal;
      vCoatA = aCoatA; vCoatB = aCoatB; vCoatC = aCoatC; vAnim = aAnim;
      {
        // Procedural life on top of the posed model: legs that swing, a tail that sways, a head
        // that bobs, looks about and is drawn a touch bigger (cuter), ears that twitch now and then.
        float T = uTime + aAnim.z;
        vec3 p0 = position;
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
        } else {
          float rel = lum / max(uRefLum, 0.05);
          float pm = (1.0 - smoothstep(0.45, 0.8, rel)) * (1.0 - eye);
          vec3 c = coatColor(vCoatA.rgb, vCoatB.rgb, vCoatA.a, vCoatB.a, vCatPos, normalize(vCatNrm), pm);
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
  if (/tux|bib|mask/.test(s)) return 2;
  if (/calico/.test(s)) return 3;
  if (/tort|brindle/.test(s)) return 7;
  if (/point|siamese|himalayan|ragdoll|colou?rpoint/.test(s)) return 4;
  if (/spot|leopard|bengal|rosette/.test(s)) return 5;
  if (/bi-?colou?r|van|harlequin|two/.test(s)) return 6;
  if (/tabby|stripe|mackerel|marble|tiger/.test(s)) return 1;
  return 0;
}

/** The coat a resident is drawn in: its sheet's coat when there is one, otherwise a plain one from its id. */
export function coatFor(r, index = 0) {
  const c = r.coat || {};
  let base = colorOf(c.base), second = colorOf(c.second), eyes = colorOf(c.eyes);
  const pattern = patternOf(c.pattern);
  if (!base) {
    const fallback = ["#f1dcc0", "#9a9aa2", "#1d1a1c", "#e0823a", "#f7f3ec", "#b9764a", "#6f6c77", "#d6b995"];
    base = new THREE.Color(fallback[hash(r.id || String(index)) % fallback.length]);
  }
  if (!second) second = pattern === 2 || pattern === 6 || pattern === 3 ? new THREE.Color("#f7f3ec") : base.clone().multiplyScalar(0.45);
  if (!eyes) eyes = new THREE.Color("#8fb04a");
  // Calico's "base" is its white; a calico sheet usually names the colours, so put white first.
  if (pattern === 3 && base.getHSL({ h: 0, s: 0, l: 0 }).l < 0.7) { const w = new THREE.Color("#f7f3ec"); second = base; base = w; }
  const hsl = base.getHSL({ h: 0, s: 0, l: 0 });
  const ginger = pattern === 1 && hsl.h > 0.03 && hsl.h < 0.12 && hsl.s > 0.45;
  return { base, second, eyes, pattern, ginger, seed: (hash(r.id || String(index)) % 997) / 97 };
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
        im.userData.coatDirty = true;
      }
      this.lookup.get(im)[i] = cat;
      im.geometry.attributes.aAnim.setXYZW(i, cat.stride || 0, cat.pose === "walk" && !this.still ? Math.min(1, (cat.speed || 0) / 1.2) : 0, (cat.phase || 0) % 50, cat.pose === "sleep" ? 0 : 1);
      if (this.blobs) {
        const k = cat.pose === "sit" ? [0.62, 0.5] : cat.pose === "sleep" ? [0.85, 0.8] : [md.len * 0.95, md.width * 0.8];
        _t.makeRotationY(cat.yaw).setPosition(cat.x, cat.y + 0.02, cat.z).multiply(_r.makeScale(k[0], 1, k[1]));
        this.blobs.setMatrixAt(cat.index, _t);
      }
    }
    this.drawn = drawn;
    if (this.blobs) this.blobs.instanceMatrix.needsUpdate = true;
    for (const im of this.meshes) {
      im.visible = im.count > 0;
      im.instanceMatrix.needsUpdate = true;
      im.geometry.attributes.aAnim.needsUpdate = true;
      if (im.userData.coatDirty) for (const k of ["aCoatA", "aCoatB", "aCoatC"]) im.geometry.attributes[k].needsUpdate = true;
      im.boundingSphere = null; // recomputed on demand when picking
    }
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
    if (a.sx !== 1 || a.sy !== 1 || a.sz !== 1) out.multiply(_t.makeScale(a.sx, a.sy, a.sz));
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
    const md = this.dimsOf(cat);
    return out.set(cat.x, cat.y + md.height + 0.2, cat.z);
  }

  /** The middle of the cat, for "nearest cat to a tap" picking and for the camera to look at. */
  midPoint(cat, out) {
    const md = this.dimsOf(cat);
    return out.set(cat.x, cat.y + md.height * 0.5, cat.z);
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
