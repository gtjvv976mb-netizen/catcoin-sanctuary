/* The skin's measures in a pose, shared by tests/catrig-herd.test.mjs (every model, every clip) and
   scripts/fit-clips.mjs (how far each model's skin lets a mannerism go). Pure functions over typed
   arrays; `THREE` (the vendored three.module) is passed in, since the callers resolve it each in
   their own way.

   readGlbMesh(file, THREE): a model's first mesh as the page's flatMesh gives it (model space), its
   positions (Float32Array) and triangles (Uint32Array).

   skinGauge(pos, index, w, rig, THREE) -> gauge(SM): the measures for the skinning matrices SM (16
   numbers a bone, bone.matrixWorld x boneInverse, in the skeleton's bone order):
   - sheet: the largest connected patch of triangles stretched past 2.5 (the largest principal stretch
     of each triangle's posed-against-rest map), by the skin area it gained, in 1e-4 units^2 (a model
     is 1 unit tall): a flap or a plank of skin;
   - spike: the most length any edge stretched past 1.8x gained (a feather or a claw drawn out);
   - crush: the head's points (the rig's head sphere) fitted rigidly (Horn) back onto their rest shape:
     how far they are squeezed along any axis (1 - the smallest extent ratio);
   - under: the share of points more than 0.02 below the ground.
   The thresholds that go with them (set against rendered frames) are TH in the herd test. */

export function readGlbMesh(file, THREE, fs) {
  const b = fs.readFileSync(file);
  const jl = b.readUInt32LE(12), js = JSON.parse(b.subarray(20, 20 + jl).toString()), bin = b.subarray(20 + jl + 8);
  const nodeMat = (n) => (n.matrix ? new THREE.Matrix4().fromArray(n.matrix) : new THREE.Matrix4().compose(new THREE.Vector3(...(n.translation || [0, 0, 0])), new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])), new THREE.Vector3(...(n.scale || [1, 1, 1]))));
  const parent = new Map(); js.nodes.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
  const mi = js.nodes.findIndex((n) => n.mesh !== undefined), world = new THREE.Matrix4();
  for (let i = mi; i !== undefined; i = parent.get(i)) world.premultiply(nodeMat(js.nodes[i]));
  const prim = js.meshes[js.nodes[mi].mesh].primitives[0];
  const read = (ai) => {
    const a = js.accessors[ai], bv = js.bufferViews[a.bufferView], comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const get = { 5120: "getInt8", 5121: "getUint8", 5122: "getInt16", 5123: "getUint16", 5125: "getUint32", 5126: "getFloat32" }[a.componentType];
    const bs = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType], norm = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[a.componentType];
    const stride = bv.byteStride || comps * bs, dv = new DataView(bin.buffer, bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0)), o = new Float64Array(a.count * comps);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < comps; c++) { const v = dv[get](i * stride + c * bs, true); o[i * comps + c] = a.normalized ? Math.max(v / norm, -1) : v; }
    return o;
  };
  const P = read(prim.attributes.POSITION), pos = new Float32Array(P.length), v = new THREE.Vector3();
  for (let i = 0; i < P.length / 3; i++) { v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(world); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; }
  return { pos, index: prim.indices !== undefined ? Uint32Array.from(read(prim.indices)) : Uint32Array.from({ length: P.length / 3 }, (_, i) => i) };
}

export function skinGauge(pos, index, w, rig, THREE) {
  const n = pos.length / 3, I = w.index.array, Wt = w.weight.array;
  const kmap = new Map(), uid = new Int32Array(n); let U = 0;
  for (let i = 0; i < n; i++) { const k = `${Math.round(pos[i * 3] * 2e4)},${Math.round(pos[i * 3 + 1] * 2e4)},${Math.round(pos[i * 3 + 2] * 2e4)}`; let u = kmap.get(k); if (u === undefined) kmap.set(k, (u = U++)); uid[i] = u; }
  const ta = [], tinv = [], tar = [], firstT = new Map(), adj = [], seen = new Set(), ea = [], er = [];
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const A2 = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      let x = uid[p], y = uid[q]; if (x === y) continue; if (x > y) [x, y] = [y, x];
      const k = x * U + y;
      if (!seen.has(k)) { seen.add(k); const r = Math.hypot(pos[p * 3] - pos[q * 3], pos[p * 3 + 1] - pos[q * 3 + 1], pos[p * 3 + 2] - pos[q * 3 + 2]); if (r > 1e-7) { ea.push(p, q); er.push(r); } }
      if (A2 < 1e-10) continue;
      const f = firstT.get(k); if (f === undefined) firstT.set(k, ta.length / 3); else adj.push(f, ta.length / 3);
    }
    if (A2 < 1e-10) continue;
    const lu = Math.hypot(ux, uy, uz), e12 = (vx * ux + vy * uy + vz * uz) / lu, e22 = A2 / lu;
    ta.push(a, b, c); tinv.push(1 / lu, -e12 / (lu * e22), 1 / e22); tar.push(A2 / 2);
  }
  const NT = tar.length, UF = new Int32Array(NT), SIG = new Float64Array(NT), PA = new Float64Array(NT), CA = new Float64Array(NT), S = new Float64Array(n * 3);
  const find = (x) => { while (UF[x] !== x) { UF[x] = UF[UF[x]]; x = UF[x]; } return x; };
  const head = []; for (let i = 0; i < n; i++) if (Math.hypot(pos[i * 3] - rig.headC.x, pos[i * 3 + 1] - rig.headC.y, pos[i * 3 + 2] - rig.headC.z) < rig.headR) head.push(i);
  const hc = [0, 1, 2].map((k) => head.reduce((s, i) => s + pos[i * 3 + k], 0) / Math.max(1, head.length));
  const ext = (vals) => { const a = Float64Array.from(vals).sort(); return a[Math.round(0.98 * (a.length - 1))] - a[Math.round(0.02 * (a.length - 1))]; };
  const hExt = [0, 1, 2].map((k) => ext(head.map((i) => pos[i * 3 + k])));
  return (SM) => {
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; let ox = 0, oy = 0, oz = 0;
      for (let k = 0; k < 4; k++) { const wt = Wt[i * 4 + k]; if (!wt) continue; const o = I[i * 4 + k] * 16; ox += wt * (SM[o] * x + SM[o + 4] * y + SM[o + 8] * z + SM[o + 12]); oy += wt * (SM[o + 1] * x + SM[o + 5] * y + SM[o + 9] * z + SM[o + 13]); oz += wt * (SM[o + 2] * x + SM[o + 6] * y + SM[o + 10] * z + SM[o + 14]); }
      S[i * 3] = ox; S[i * 3 + 1] = oy; S[i * 3 + 2] = oz;
    }
    let spike = 0;
    for (let e = 0; e < er.length; e++) { const a = ea[e * 2] * 3, b = ea[e * 2 + 1] * 3, r = er[e], l = Math.hypot(S[a] - S[b], S[a + 1] - S[b + 1], S[a + 2] - S[b + 2]); if (l > 1.8 * Math.max(r, 0.01) && l - r > spike) spike = l - r; }
    for (let t = 0; t < NT; t++) {
      const a = ta[t * 3] * 3, b = ta[t * 3 + 1] * 3, c = ta[t * 3 + 2] * 3;
      const ux = S[b] - S[a], uy = S[b + 1] - S[a + 1], uz = S[b + 2] - S[a + 2], vx = S[c] - S[a], vy = S[c + 1] - S[a + 1], vz = S[c + 2] - S[a + 2];
      const i11 = tinv[t * 3], i12 = tinv[t * 3 + 1], i22 = tinv[t * 3 + 2];
      const F1x = ux * i11, F1y = uy * i11, F1z = uz * i11, F2x = ux * i12 + vx * i22, F2y = uy * i12 + vy * i22, F2z = uz * i12 + vz * i22;
      const p = F1x * F1x + F1y * F1y + F1z * F1z, r = F2x * F2x + F2y * F2y + F2z * F2z, q = F1x * F2x + F1y * F2y + F1z * F2z;
      SIG[t] = Math.sqrt(Math.max(0, (p + r) / 2 + Math.sqrt(((p - r) / 2) ** 2 + q * q)));
      PA[t] = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      UF[t] = t;
    }
    for (let e = 0; e < adj.length; e += 2) { const a = adj[e], b = adj[e + 1]; if (SIG[a] > 2.5 && SIG[b] > 2.5) { const ra = find(a), rb = find(b); if (ra !== rb) UF[ra] = rb; } }
    CA.fill(0); let sheet = 0;
    for (let t = 0; t < NT; t++) if (SIG[t] > 2.5) { const r = find(t); CA[r] += Math.max(0, PA[t] - tar[t]); if (CA[r] > sheet) sheet = CA[r]; }
    // The head, fitted rigidly (Horn) back onto its rest shape: how far it is squeezed along any axis.
    let crush = 0;
    if (head.length >= 20) {
      const qc = [0, 0, 0]; for (const i of head) for (let k = 0; k < 3; k++) qc[k] += S[i * 3 + k] / head.length;
      const Sm = new Float64Array(9);
      for (const i of head) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) Sm[a * 3 + b] += (pos[i * 3 + a] - hc[a]) * (S[i * 3 + b] - qc[b]);
      const [xx, xy, xz, yx, yy, yz, zx, zy, zz] = Sm, N = [xx + yy + zz, yz - zy, zx - xz, xy - yx, yz - zy, xx - yy - zz, xy + yx, zx + xz, zx - xz, xy + yx, -xx + yy - zz, yz + zy, xy - yx, zx + xz, yz + zy, -xx - yy + zz];
      const sh = Math.sqrt(N.reduce((s, x) => s + x * x, 0)) + 1e-12; for (let i = 0; i < 4; i++) N[i * 5] += sh;
      let v = [1, 0, 0, 0];
      for (let it = 0; it < 60; it++) { const o = [0, 0, 0, 0]; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[r] += N[r * 4 + c] * v[c]; const l = Math.hypot(...o) || 1; v = o.map((x) => x / l); }
      const qi = new THREE.Quaternion(v[1], v[2], v[3], v[0]).invert(), tv = new THREE.Vector3(), cols = [[], [], []];
      for (const i of head) { tv.set(S[i * 3] - qc[0], S[i * 3 + 1] - qc[1], S[i * 3 + 2] - qc[2]).applyQuaternion(qi); cols[0].push(tv.x); cols[1].push(tv.y); cols[2].push(tv.z); }
      for (let k = 0; k < 3; k++) crush = Math.max(crush, 1 - ext(cols[k]) / Math.max(1e-6, hExt[k]));
    }
    let under = 0; for (let i = 0; i < n; i++) if (S[i * 3 + 1] < -0.02) under++;
    return { sheet: sheet * 1e4, spike, crush, under: under / n };
  };
}

/** The skinning matrices for a posed skeleton (its bones' world matrices, times the bind inverses),
    16 numbers a bone, into SM (Float64Array of bones.length x 16). */
export function skinMatrices(sk, SM, THREE, m4 = new THREE.Matrix4()) {
  const bones = sk.skeleton.bones, inv = sk.skeleton.boneInverses;
  sk.root.updateMatrixWorld(true);
  for (let j = 0; j < bones.length; j++) SM.set(m4.multiplyMatrices(bones[j].matrixWorld, inv[j]).elements, j * 16);
  return SM;
}
