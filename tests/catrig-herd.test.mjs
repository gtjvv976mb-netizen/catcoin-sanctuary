/* The cat rig (assets/world/catrig.js) over the whole herd: every model's far copy (the copy the page
   rigs every cat from, assets/models/cats/<KEY>-lo.glb), rigged, skinned and given its clips exactly as
   CatHerd.attachOwn does (findRig with the mesh index, skinWeights, makeClips in the cat's own style from
   data/traits.json), then posed in the clips and blends that went wrong on at least a tenth of the herd in
   the herd survey (survey.mjs and its baseline.md, kept outside the repo: every clip and blend of every
   model, both copies, each threshold set by rendering the frames it flags), and in the everyday ones:
   washing, sitting, loafing, curling up and sleeping.

   What no cat may do, in the survey's own measures (a model is 1 unit tall):
   - sheet: a connected patch of skin stretched past 2.5 times its rest size (the largest principal
     stretch of each triangle) that has gained more than TH.sheet of area (units of 1e-4, a square 1% of
     the cat's height on a side): a flap or a flat plank of skin (a hood over the head, a cape, a
     smeared flank in the sleeping "log");
   - spike: one edge of the skin drawn out by more than TH.spike (a feather or a claw pulled into a
     spike);
   - crush: the head (the points in the rig's head sphere, fitted rigidly back onto their rest shape)
     squeezed by more than TH.crush along any axis;
   - under: more than TH.under of the skin's points more than 0.02 below the ground;
   - swing: in the controller's blend from one clip to the next (catviews.animateOwn, the loop entered
     at several phases), a paw more than TH.swing of the leg's length away from where a straight morph
     between the two clips' own poses would put it: the paw flung out sideways as a cat starts or stops
     washing;
   - pop: in a blend, any leg bone turning faster than TH.pop rad/s against its girdle (a limb flipping
     over in a frame).
   A failure names the cat, the clip or blend, the measure and where it was worst, so a fix can be
   checked one cat at a time: CATRIG_HERD=KEY1,KEY2 node --test tests/catrig-herd.test.mjs
   (CATRIG_HERD_MS=1 prints each cat's time spent rigging, posing clips and running blends).
   Each cat's clips are made with its fit (assets/models/cats/fit.json: how far its own skin lets each
   mannerism go, measured by scripts/fit-clips.mjs; re-run that after changing catrig.js or a model), and
   the actions its model can't show at all (traits.js MODEL_LIMITS) are left out, as the sims leave them out. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { register } from "node:module";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Thresholds (see the header; set in the survey against rendered frames). */
export const TH = { sheet: 700, spike: 0.2, crush: 0.3, under: 0.05, swing: 0.3, pop: 40 };
/** Clips posed on their own (u at four points): the everyday ones (sit, groom, loaf, curlUp, sleep) and
    those the survey found broken on at least a tenth of the herd's far copies. */
export const CLIPS = ["sit", "groom", "loaf", "curlUp", "sleep", "wake", "legLick", "earScratch", "roll", "hindStand", "stalk", "pounce", "sitToLie", "lieToSit",
  // (and those the final survey round found broken on a tenth of the herd or more: claws on the trunk, a hop
  // (the head folded into the shoulders at take-off), sitting and lying down (the hocks and elbows sunk in
  // the lawn), and the gaits of the models that can do little else)
  "scratch", "hop", "sitDown", "lieDown", "getUp", "walk", "trot"];
/** Sequences the controller is run through (as the sims play them; posture changes as their clips). */
export const SEQS = [
  ["sit", "groom", "sit"], ["sit", "legLick", "sit"], ["sit", "earScratch", "sit"], ["sit", "beckon", "sit"],
  ["loaf", "flop", "roll", "flop", "loaf"], ["flop", "getUp", "stand"], ["loaf", "roll", "loaf"], ["loaf", "dab", "loaf"],
  ["stand", "hindStand", "stand"], ["loaf", "curlUp", "sleep", "wake", "loaf"], ["stand", "scratch", "stand"],
];

if (isMainThread) {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/cats/index.json"), "utf8")).cats;
  const only = process.env.CATRIG_HERD ? process.env.CATRIG_HERD.split(",") : null;
  const keys = Object.keys(index).filter((k) => !only || only.includes(k));
  // A few worker threads, each rigging an interleaved share of the herd (about 0.2-0.5 s a cat).
  const W = Math.max(1, Math.min(keys.length, 3, (os.availableParallelism?.() || 2) - 1));
  const results = (await Promise.all(Array.from({ length: W }, (_, w) => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { keys: keys.filter((_, i) => i % W === w) } });
    worker.once("message", resolve);
    worker.once("error", reject);
  })))).flat();
  const byKey = new Map(results.map((r) => [r.key, r]));
  if (process.env.CATRIG_HERD_MS) for (const r of results) console.log(r.key, JSON.stringify(r.ms));

  test("every model rigs, skins and gets its clips", () => {
    const missing = keys.filter((k) => !byKey.has(k) || byKey.get(k).error);
    assert.deepEqual(missing.map((k) => `${k}: ${byKey.get(k)?.error || "no result"}`), []);
  });

  const report = (what, pick) => () => {
    const bad = [];
    for (const k of keys) for (const f of byKey.get(k)?.fails || []) if (pick(f)) bad.push(`${k} ${f.name}: ${f.metric} ${f.value} (limit ${TH[f.metric]}) at ${f.at}`);
    bad.sort();
    assert.deepEqual(bad, [], `${bad.length} ${what} over the limit:\n  ${bad.join("\n  ")}`);
  };
  test("no pose tears the skin into a sheet or a spike", report("sheets/spikes", (f) => f.metric === "sheet" || f.metric === "spike"));
  test("no pose crushes the head", report("crushed heads", (f) => f.metric === "crush"));
  test("no pose sinks the body into the ground", report("poses under the ground", (f) => f.metric === "under"));
  test("no blend flings a paw out or flips a limb over", report("flung or popped limbs", (f) => f.metric === "swing" || f.metric === "pop"));
} else {
  const THREE_URL = pathToFileURL(path.join(ROOT, "assets/vendor/three/three.module.min.js")).href, ADDONS = pathToFileURL(path.join(ROOT, "assets/vendor/three/addons/")).href;
  register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, next) {
  if (s === "three") return { url: ${JSON.stringify(THREE_URL)}, shortCircuit: true };
  if (s.startsWith("three/addons/")) return { url: ${JSON.stringify(ADDONS)} + s.slice(13), shortCircuit: true };
  return next(s, c);
}`));
  const THREE = await import(THREE_URL);
  const R = await import(pathToFileURL(path.join(ROOT, "assets/world/catrig.js")).href);
  const V = await import(pathToFileURL(path.join(ROOT, "assets/world/catviews.js")).href);
  const M = await import(pathToFileURL(path.join(ROOT, "assets/world/catmotion.js")).href);
  const T = await import(pathToFileURL(path.join(ROOT, "assets/world/traits.js")).href);
  const INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/cats/index.json"), "utf8")).cats;
  const TABLE = JSON.parse(fs.readFileSync(path.join(ROOT, "data/traits.json"), "utf8")).cats;
  // (the cats with leg labels made offline, assets/models/cats/<KEY>.legs.json, skinned with them as the page does)
  const LEGS = new Set((() => { try { const j = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/cats/legs-index.json"), "utf8")); return j.v === 1 ? j.cats : []; } catch { return []; } })());
  const legsOf = (key) => { if (!LEGS.has(key)) return null; const j = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/cats", `${key}.legs.json`), "utf8")); return j.v === 1 && j.far ? R.decodeLegs(j.far, j.nlo) : null; };
  // (and how far each model's skin lets a mannerism go, assets/models/cats/fit.json by scripts/fit-clips.mjs, as the page reads it)
  const FIT = (() => { try { const j = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/cats/fit.json"), "utf8")); return j.v === 1 ? j.cats || {} : {}; } catch { return {}; } })();
  const out = [];
  for (const key of workerData.keys) {
    try { out.push(checkCat(key)); } catch (e) { out.push({ key, error: String(e && e.stack || e).split("\n").slice(0, 3).join(" | ") }); }
  }
  parentPort.postMessage(out);

  /** A model's first mesh as the page's flatMesh gives it (model space) and its triangles. */
  function readModel(file) {
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

  /** The skin's measures in a pose (bone skinning matrices SM, 16 per bone): sheet, spike, crush, under. */
  function skinGauge(pos, index, w, names, rig) {
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

  function checkCat(key) {
    const t0 = performance.now(), ms = {};
    const lo = readModel(path.join(ROOT, "assets/models/cats", `${key}-lo.glb`));
    const rig = R.findRig(lo.pos, lo.index), sk = R.buildSkeleton(rig), w = R.skinWeights(lo.pos, rig, sk, lo.index, legsOf(key));
    const traits = T.traitsOf({ id: key }, TABLE), style = T.styleOf(traits), clips = R.makeClips(rig, style || {}, FIT[key] || null);
    // (what this model can't show, traits.js MODEL_LIMITS, the sims never give it and the view never shows: not measured)
    const avoid = new Set(traits.avoid || []);
    const bones = sk.skeleton.bones, inv = sk.skeleton.boneInverses, SM = new Float64Array(bones.length * 16), m4 = new THREE.Matrix4();
    const gauge = skinGauge(lo.pos, lo.index, w, bones.map((b) => b.name), rig);
    ms.setup = performance.now() - t0;
    const rest = bones.map((b) => [b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
    const reset = () => bones.forEach((b, i) => { b.position.copy(rest[i][0]); b.quaternion.copy(rest[i][1]); b.scale.copy(rest[i][2]); });
    const fails = [], worst = new Map();
    const note = (name, metric, value, at) => { const k = `${name}|${metric}`; const cur = worst.get(k); if (!cur || value > cur.value) worst.set(k, { name, metric, value: +value.toFixed(3), at }); };
    // Clips on their own.
    const mixer = new THREE.AnimationMixer(sk.root);
    for (const name of CLIPS) {
      if (!clips[name] || avoid.has(name)) continue;
      const loop = clips[name].userData?.loop !== false;
      for (const u of loop ? [0.1, 0.35, 0.6, 0.85] : [0.15, 0.5, 0.85, 1]) {
        mixer.stopAllAction(); reset();
        const a = mixer.clipAction(clips[name]); a.play(); a.time = Math.min(u, 0.9999) * clips[name].duration; mixer.update(0);
        sk.root.updateMatrixWorld(true);
        for (let j = 0; j < bones.length; j++) SM.set(m4.multiplyMatrices(bones[j].matrixWorld, inv[j]).elements, j * 16);
        const g = gauge(SM);
        for (const k of ["sheet", "spike", "crush", "under"]) note(name, k, g[k], `u ${u}`);
      }
    }
    mixer.stopAllAction(); mixer.uncacheRoot(sk.root);
    ms.clips = performance.now() - t0 - ms.setup;
    // Blends, through the page's own controller (the loop entered at two phases).
    const s = V.ownScale(INDEX[key]) * Math.min(2, Math.max(0.5, style?.scale || 1)), perUnit = R.cyclesPerUnit(rig, s, style || undefined, FIT[key] || null);
    const LEGS = [["thigh.L", "shin.L", "foot.L", "pelvis", "hL"], ["thigh.R", "shin.R", "foot.R", "pelvis", "hR"], ["arm.L", "forearm.L", "paw.L", "chest", "fL"], ["arm.R", "forearm.R", "paw.R", "chest", "fR"]];
    const interp = new Map(), q3 = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], tv = new THREE.Vector3(), ideal = new THREE.Vector3();
    const tipOf = (L, qa, qb, qc, outV) => { const [a, b, c] = L.map((nm) => sk.bones[nm]); return outV.copy(rig.legs[L[4]].toe).sub(c.userData.at).applyQuaternion(qc).add(c.position).applyQuaternion(qb).add(b.position).applyQuaternion(qa).add(a.position); };
    const INVA = 4276115653; // 1664525^-1 mod 2^32: steers the controller's rnd() so a loop starts at a chosen phase
    const PHASES = [0.3, 0.8], DT = 1 / 60, prevQ = LEGS.map(() => [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()]), curQ = LEGS.map(() => [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()]);
    for (const seq of SEQS) {
      if (!seq.every((a) => clips[a] && !avoid.has(a))) continue;
      for (const phase of PHASES) {
        reset();
        const o = { rig, sk, s, style, mixer: new THREE.AnimationMixer(sk.root), clips, actions: {}, perUnit };
        const cat = { id: key, x: 0, y: 0, z: 0, yaw: 0, speed: 0, traits, motion: { action: seq[0], posture: M.ACTIONS[seq[0]].posture, gait: null, u: null, odometer: 0, yawRate: 0, look: null, since: 0 } };
        o.anim = V.animState(o, cat);
        let now = 0, frame = 0, blendN = 0;
        for (let si = 0; si < seq.length; si++) {
          const act = seq[si], kind = M.ACTIONS[act].kind, moves = kind === "trans" || kind === "once";
          const secs = moves ? clips[act].duration : si === 0 ? 0.3 : si === seq.length - 1 ? 0.8 : 1.0, label = si ? `${seq[si - 1]}>${act}` : act, nf = Math.round(secs / DT);
          for (let f = 0; f < nf; f++, frame++) {
            if (f === 0 && si && !moves) o.anim.r = (Math.imul((Math.floor(phase * 4294967296) - 1013904223) >>> 0, INVA) >>> 0) || 1;
            Object.assign(cat.motion, { action: act, posture: M.ACTIONS[act].posture, u: moves ? (f + 1) / nf : null });
            now += DT;
            V.animateOwn(o, cat, now, 0, false, null);
            const live = Object.values(o.actions).filter((a) => a.isScheduled() && a.weight > 1e-3);
            LEGS.forEach((L, k) => { const [a, b, c] = L.map((nm) => sk.bones[nm]); curQ[k][0].copy(a.quaternion); curQ[k][1].copy(curQ[k][0]).multiply(b.quaternion); curQ[k][2].copy(curQ[k][1]).multiply(c.quaternion); });
            if (live.length > 1 && frame > 0) {
              // The skin mid-blend (every 6th frame of a blend, first phase only): a blend can sink the
              // body or stretch skin that neither clip does (loaf>flop rolls the body through the lawn).
              if (phase === PHASES[0] && (blendN++ % 6) === 3) {
                sk.root.updateMatrixWorld(true);
                for (let j = 0; j < bones.length; j++) SM.set(m4.multiplyMatrices(bones[j].matrixWorld, inv[j]).elements, j * 16);
                const g = gauge(SM);
                for (const k of ["sheet", "spike", "crush", "under"]) note(label, k, g[k], `phase ${phase} +${f}f`);
              }
              let Wsum = 0;
              for (let k = 0; k < 4; k++) {
                for (let j = 0; j < 3; j++) note(label, "pop", 2 * Math.acos(Math.min(1, Math.abs(curQ[k][j].dot(prevQ[k][j])))) / DT, `phase ${phase} +${f}f ${LEGS[k][j]}`);
                ideal.set(0, 0, 0); Wsum = 0;
                for (const a of live) {
                  let ip = interp.get(a.getClip()); if (!ip) interp.set(a.getClip(), (ip = LEGS.map((L) => L.slice(0, 3).map((nm) => a.getClip().tracks.find((t) => t.name === `${nm}.quaternion`)?.createInterpolant() || null))));
                  for (let j = 0; j < 3; j++) { if (ip[k][j]) q3[j].fromArray(ip[k][j].evaluate(a.time)); else q3[j].set(0, 0, 0, 1); }
                  ideal.addScaledVector(tipOf(LEGS[k], q3[0], q3[1], q3[2], tv), a.weight); Wsum += a.weight;
                }
                const [a0, b0, c0] = LEGS[k].slice(0, 3).map((nm) => sk.bones[nm]);
                note(label, "swing", tipOf(LEGS[k], a0.quaternion, b0.quaternion, c0.quaternion, tv).distanceTo(ideal.divideScalar(Wsum)) / rig.legTop, `phase ${phase} +${f}f ${LEGS[k][4]}`);
              }
            }
            for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) prevQ[k][j].copy(curQ[k][j]);
          }
        }
        o.mixer.stopAllAction(); o.mixer.uncacheRoot(sk.root);
      }
    }
    for (const f of worst.values()) if (f.value > TH[f.metric]) fails.push(f);
    ms.blends = performance.now() - t0 - ms.setup - ms.clips;
    return { key, fails, ms };
  }
}
