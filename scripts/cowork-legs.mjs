#!/usr/bin/env node
/* Per-vertex leg labels for the cats whose legs the mesh fuses (paws touching, webbed legs), taken from
   the scripted quadruped rigs Cowork made for them (<KEY>.rigged.glb: the same mesh as
   assets/models/cats/<KEY>.glb, vertex for vertex, plus a 19-bone skin). The page keeps its own skeleton,
   skin blending and clips (assets/world/catrig.js); what it takes from Cowork's rig is WHICH LEG each
   vertex belongs to, where our own split of the mesh into legs (grown from the paws over the surface)
   is confused by the fused legs. The labels are written as assets/models/cats/<KEY>.legs.json:

     { "v": 1, "n": <full copy's vertex count>, "full": "<runs>", "nlo": <far copy's>, "far": "<runs>" }

   "runs" is a run-length string over the copy's vertices in file order: tokens separated by commas, each a
   label ("0" hL, "1" hR, "2" fL, "3" fR in catrig's leg order, "b" body: not a leg) followed by the run
   length when over 1, e.g. "b120,03,b5,1". decodeLegs turns it back into a Uint8Array (0-3, 255 = body),
   which skinWeights(pos, rig, sk, index, legs) honours. The far copy (<KEY>-lo.glb, a decimation of the
   same mesh) gets each vertex's label from the nearest vertex of the full copy.

   The leg order is matched to our rig by where each of Cowork's legs stands (its paw's centroid against
   findRig's paws), not by name, so a mirrored axis in either rig cannot swap legs. PAPRIKA's fifth leg
   (Cowork's leg_extra_*, walking with its front left) goes with that front leg.

   assets/models/cats/legs-index.json lists the cats that have a file ({ "v": 1, "cats": [...] }), so the page
   fetches labels only for them (one small fetch, no 404s) and index.json stays as make-cat-models.py writes it.

   Usage (from the repo root; needs the rigged GLBs, which are not checked in):
     node scripts/cowork-legs.mjs --rigged DIR [--only KEY,KEY] [--out assets/models/cats] [--dry] [--sizes]
   Exports coworkLegs, transferLabels, encodeLegs, decodeLegs for the evaluation harness. */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// catrig.js imports "three": point it at the vendored copy (as tests/catrig.test.mjs and the survey do).
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, next) {
  if (s === "three") return { url: ${JSON.stringify(pathToFileURL(path.join(ROOT, "assets/vendor/three/three.module.min.js")).href)}, shortCircuit: true };
  return next(s, c);
}`));

export const LK = ["hL", "hR", "fL", "fR"];
export const BODY = 255;
// @gltf-transform (npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions)
// is loaded only when a model is read, so the label codec (decodeLegs, encodeLegs) needs no extra packages.
let gt = null;
async function gltf() {
  if (!gt) {
    const [{ NodeIO }, { ALL_EXTENSIONS }, { dequantize, flatten }] = await Promise.all([import("@gltf-transform/core"), import("@gltf-transform/extensions"), import("@gltf-transform/functions")]);
    gt = { io: new NodeIO().registerExtensions(ALL_EXTENSIONS), dequantize, flatten };
  }
  return gt;
}

/** A GLB's first mesh in model space: positions (Float32Array), indices, and (if skinned) its joints,
    weights (4 per vertex, denormalised) and joint names. Quantized files are decoded. */
export async function readMesh(file) {
  const { io, dequantize, flatten } = await gltf();
  const doc = await io.read(file);
  await doc.transform(dequantize(), flatten());
  const node = doc.getRoot().listNodes().find((nd) => nd.getMesh());
  if (!node) throw new Error(`no mesh in ${file}`);
  const m = node.getWorldMatrix(), prim = node.getMesh().listPrimitives()[0];
  const P = prim.getAttribute("POSITION"), n = P.getCount(), pos = new Float32Array(n * 3), e = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    P.getElement(i, e);
    const [x, y, z] = e;
    pos[i * 3] = m[0] * x + m[4] * y + m[8] * z + m[12]; pos[i * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; pos[i * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
  const out = { pos, n, index: prim.getIndices() ? Uint32Array.from(prim.getIndices().getArray()) : null };
  const J = prim.getAttribute("JOINTS_0"), W = prim.getAttribute("WEIGHTS_0"), skin = node.getSkin();
  if (J && W && skin) {
    out.joints = new Uint16Array(n * 4); out.weights = new Float32Array(n * 4);
    const j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) { J.getElement(i, j4); W.getElement(i, w4); for (let k = 0; k < 4; k++) { out.joints[i * 4 + k] = j4[k]; out.weights[i * 4 + k] = w4[k]; } }
    out.jointNames = skin.listJoints().map((j) => j.getName());
  }
  return out;
}

/**
 * Cowork's leg of each vertex (0-3 in our hL, hR, fL, fR order, BODY otherwise), for a rigged mesh
 * (readMesh of <KEY>.rigged.glb) against our rig (findRig of the far copy, for its paws). A vertex is a
 * leg's when that leg's three bones (plus leg_extra's for PAPRIKA, with the front left) carry over half
 * its weight. Returns { legs, tail (Uint8Array, 1 where Cowork's tail bones carry over half), map (Cowork
 * leg -> our leg), pawDist (how far each matched paw centroid was from ours), counts }.
 */
export function coworkLegs(rigged, rig) {
  const { pos, n, joints: J, weights: W, jointNames: names } = rigged;
  if (!J) throw new Error("not a skinned mesh");
  const cwNames = ["leg_back_L", "leg_back_R", "leg_front_L", "leg_front_R"];
  const legOfJoint = names.map((nm) => (nm.startsWith("leg_extra") ? 2 : cwNames.findIndex((l) => nm.startsWith(l))));
  const tailJoint = names.map((nm) => /^tail/.test(nm));
  const cw = new Int8Array(n).fill(-1), tail = new Uint8Array(n), acc = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    acc.fill(0); let tw = 0;
    for (let k = 0; k < 4; k++) { const j = J[i * 4 + k], w = W[i * 4 + k], l = legOfJoint[j]; if (l >= 0) acc[l] += w; if (tailJoint[j]) tw += w; }
    let best = -1, bw = 0.5;
    for (let l = 0; l < 4; l++) if (acc[l] > bw) { bw = acc[l]; best = l; }
    cw[i] = best; tail[i] = tw > 0.5 ? 1 : 0;
  }
  // Which of our legs each of Cowork's is: by where the leg's skin sits, behind or before the body's
  // middle and on which side of the rig's centre line (our "L" is the z >= zc side, whatever the model
  // calls it); the whole leg's centroid, not its paw's, since a long-haired cat's fur on the floor can
  // outweigh the paw. If that leaves two of Cowork's legs in one slot, the paws' centroids decide.
  const midX = rig ? (rig.pelvis.x + rig.chest.x) / 2 : 0, zc = rig?.zc ?? 0, yMax = 0.05 * (rig?.H || 1);
  const all = [0, 1, 2, 3].map(() => [0, 0, 0]), ground = [0, 1, 2, 3].map(() => [0, 0, 0]);
  for (let i = 0; i < n; i++) {
    const l = cw[i]; if (l < 0) continue;
    all[l][0] += pos[i * 3]; all[l][1] += pos[i * 3 + 2]; all[l][2]++;
    if (pos[i * 3 + 1] < yMax) { ground[l][0] += pos[i * 3]; ground[l][1] += pos[i * 3 + 2]; ground[l][2]++; }
  }
  let map = Int8Array.from(all.map(([sx, sz, c]) => (c ? LK.indexOf((sx / c < midX ? "h" : "f") + (sz / c >= zc ? "L" : "R")) : -1)));
  const pawDist = [0, 1, 2, 3].map((l) => { const [sx, sz, c] = ground[l]; if (!c || map[l] < 0) return NaN; const q = rig.paws[LK[map[l]]]; return Math.hypot(q.x - sx / c, q.z - sz / c); });
  if (new Set(map).size < 4 || map.includes(-1)) {
    map = new Int8Array(4).fill(-1);
    const used = new Set(), pairs = [];
    ground.forEach(([sx, sz, c], l) => { if (!c) return; LK.forEach((k, j) => { const q = rig.paws[k]; pairs.push([Math.hypot(q.x - sx / c, q.z - sz / c), l, j]); }); });
    pairs.sort((a, b) => a[0] - b[0]);
    for (const [d, l, j] of pairs) { if (map[l] >= 0 || used.has(j)) continue; map[l] = j; used.add(j); pawDist[l] = d; }
    for (let l = 0; l < 4; l++) if (map[l] < 0) { const want = l < 2 ? "h" : "f"; const j = LK.findIndex((k, jj) => !used.has(jj) && k[0] === want); if (j >= 0) { map[l] = j; used.add(j); pawDist[l] = NaN; } }
  }
  const legs = new Uint8Array(n).fill(BODY), counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) { if (cw[i] >= 0 && map[cw[i]] >= 0) { legs[i] = map[cw[i]]; counts[legs[i]]++; } else counts[4]++; }
  return { legs, tail, map: Array.from(map), pawDist, counts };
}

/** Labels for another copy of the mesh (dstPos): each vertex takes the label of the nearest source vertex. */
export function transferLabels(srcPos, srcLab, dstPos) {
  const ns = srcPos.length / 3, nd = dstPos.length / 3, out = new Uint8Array(nd);
  // A uniform grid over the source points (cell ~ 2% of the model's height).
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < ns; i++) for (let k = 0; k < 3; k++) { const v = srcPos[i * 3 + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
  const cell = Math.max(1e-3, 0.02 * Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]));
  const dim = [0, 1, 2].map((k) => Math.floor((hi[k] - lo[k]) / cell) + 1);
  const cellOf = (x, y, z) => (Math.floor((x - lo[0]) / cell) * dim[1] + Math.floor((y - lo[1]) / cell)) * dim[2] + Math.floor((z - lo[2]) / cell);
  const grid = new Map();
  for (let i = 0; i < ns; i++) { const c = cellOf(srcPos[i * 3], srcPos[i * 3 + 1], srcPos[i * 3 + 2]); let L = grid.get(c); if (!L) grid.set(c, (L = [])); L.push(i); }
  for (let i = 0; i < nd; i++) {
    const x = dstPos[i * 3], y = dstPos[i * 3 + 1], z = dstPos[i * 3 + 2];
    const cx = Math.floor((x - lo[0]) / cell), cy = Math.floor((y - lo[1]) / cell), cz = Math.floor((z - lo[2]) / cell);
    let best = -1, bd = Infinity;
    // (cubes of cells of growing radius; the nearest point found is surely the nearest once it lies
    // within the radius searched, since every point nearer would be inside the cube)
    for (let r = 1; r <= 8; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        if (r > 1 && Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) < r) continue; // (only the new shell)
        const gx = cx + dx, gy = cy + dy, gz = cz + dz;
        if (gx < 0 || gy < 0 || gz < 0 || gx >= dim[0] || gy >= dim[1] || gz >= dim[2]) continue;
        const L = grid.get((gx * dim[1] + gy) * dim[2] + gz); if (!L) continue;
        for (const j of L) { const d = (srcPos[j * 3] - x) ** 2 + (srcPos[j * 3 + 1] - y) ** 2 + (srcPos[j * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = j; } }
      }
      if (best >= 0 && Math.sqrt(bd) <= r * cell) break;
    }
    if (best < 0 || Math.sqrt(bd) > 8 * cell) { for (let j = 0; j < ns; j++) { const d = (srcPos[j * 3] - x) ** 2 + (srcPos[j * 3 + 1] - y) ** 2 + (srcPos[j * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = j; } } }
    out[i] = srcLab[best];
  }
  return out;
}

/** Run-length string of labels (0-3 legs, anything else body). */
export function encodeLegs(lab) {
  const parts = [];
  for (let i = 0; i < lab.length;) { const l = lab[i] < 4 ? lab[i] : "b"; let j = i + 1; while (j < lab.length && (lab[j] < 4 ? lab[j] : "b") === l) j++; parts.push(j - i > 1 ? `${l}${j - i}` : `${l}`); i = j; }
  return parts.join(",");
}
/** The labels back (Uint8Array, 255 = body); null if the string does not cover n vertices. */
export function decodeLegs(str, n) {
  const out = new Uint8Array(n).fill(BODY);
  let i = 0;
  for (const tok of str.split(",")) {
    const m = /^([0-3b])(\d*)$/.exec(tok); if (!m) return null;
    const c = m[2] ? +m[2] : 1, l = m[1] === "b" ? BODY : +m[1];
    if (i + c > n) return null;
    if (l !== BODY) out.fill(l, i, i + c);
    i += c;
  }
  return i === n ? out : null;
}

/** Everything for one cat: full and far labels and their file. */
export async function buildLegs(key, riggedDir, modelsDir = path.join(ROOT, "assets/models/cats")) {
  const R = await import(pathToFileURL(path.join(ROOT, "assets/world/catrig.js")).href);
  const rigged = await readMesh(path.join(riggedDir, `${key}.rigged.glb`));
  const full = await readMesh(path.join(modelsDir, `${key}.glb`)), far = await readMesh(path.join(modelsDir, `${key}-lo.glb`));
  if (full.n !== rigged.n) throw new Error(`${key}: rigged mesh has ${rigged.n} vertices, the model ${full.n}`);
  let dmax = 0;
  for (let i = 0; i < full.n * 3; i++) dmax = Math.max(dmax, Math.abs(full.pos[i] - rigged.pos[i]));
  if (dmax > 1e-3) throw new Error(`${key}: rigged mesh's vertices differ from the model's by up to ${dmax}`);
  const rig = R.findRig(far.pos, far.index);
  const cw = coworkLegs(rigged, rig);
  const farLegs = transferLabels(full.pos, cw.legs, far.pos);
  const json = { v: 1, n: full.n, full: encodeLegs(cw.legs), nlo: far.n, far: encodeLegs(farLegs) };
  return { key, rig, full, far, rigged, cw, farLegs, json };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1] === undefined || argv[i + 1].startsWith("--") ? true : argv[i + 1]; };
  const riggedDir = opt("rigged", null), outDir = path.resolve(String(opt("out", path.join(ROOT, "assets/models/cats")))), dry = !!opt("dry");
  if (!riggedDir) { console.error("usage: node scripts/cowork-legs.mjs --rigged DIR [--only KEY,KEY] [--out DIR] [--dry]"); process.exit(2); }
  const keys = opt("only") ? String(opt("only")).split(",") : fs.readdirSync(String(riggedDir)).filter((f) => f.endsWith(".rigged.glb")).map((f) => f.replace(".rigged.glb", "")).sort();
  let total = 0;
  for (const key of keys) {
    try {
      const b = await buildLegs(key, String(riggedDir));
      const text = JSON.stringify(b.json), bytes = Buffer.byteLength(text);
      total += bytes;
      console.log(`${key.padEnd(20)} verts ${String(b.full.n).padStart(6)} far ${String(b.far.n).padStart(5)}  legs ${b.cw.counts.slice(0, 4).join("/")} body ${b.cw.counts[4]}  map ${b.cw.map.join("")} pawDist ${b.cw.pawDist.map((d) => d.toFixed(3)).join(" ")}  ${(bytes / 1024).toFixed(1)} KB`);
      if (!dry) fs.writeFileSync(path.join(outDir, `${key}.legs.json`), text);
    } catch (e) { console.error(`${key}: ${e.message}`); process.exitCode = 1; }
  }
  if (!dry) {
    const cats = fs.readdirSync(outDir).filter((f) => f.endsWith(".legs.json")).map((f) => f.replace(".legs.json", "")).sort();
    fs.writeFileSync(path.join(outDir, "legs-index.json"), JSON.stringify({ v: 1, cats }) + "\n");
  }
  console.log(`${keys.length} cats, ${(total / 1024).toFixed(0)} KB of labels${dry ? " (dry run, nothing written)" : ` -> ${outDir} (legs-index.json lists them all)`}`);
}
