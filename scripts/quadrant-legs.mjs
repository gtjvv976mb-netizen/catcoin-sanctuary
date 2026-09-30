#!/usr/bin/env node
/* Leg labels for a model whose legs its fur joins (the webbing a detailed Tripo mesh often grows between
   the hind legs, or between a leg and the belly), made from the model's own shape instead of a Cowork rig.
   findRig finds the four paws and the belly line; each vertex below the belly, on its leg's line, is
   given the leg of its quadrant: fore or hind by the body's midpoint between the paws, left or right by
   the midline. Fur joining two legs is so cut down the middle, where findRig's growth from the paws
   would carry one leg's skin over into the other's. Everything else is body. Writes
   assets/models/cats/<KEY>.legs.json in scripts/cowork-legs.mjs's format (both copies) and
   legs-index.json.

     node scripts/quadrant-legs.mjs KEY [KEY ...] [--cut 1.45] [--dry]

   --cut: how far above the leg's top (as a multiple of its height) the labels reach; the herd test
   (CATRIG_HERD=KEY) picks it per model. */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { ROOT, encodeLegs, BODY } from "./cowork-legs.mjs";

register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, next) {
  if (s === "three") return { url: ${JSON.stringify(pathToFileURL(path.join(ROOT, "assets/vendor/three/three.module.min.js")).href)}, shortCircuit: true };
  return next(s, c);
}`));
const THREE = await import(pathToFileURL(path.join(ROOT, "assets/vendor/three/three.module.min.js")).href);
const R = await import(pathToFileURL(path.join(ROOT, "assets/world/catrig.js")).href);
const DIR = path.join(ROOT, "assets/models/cats");
const LK = ["hL", "hR", "fL", "fR"];

/** A GLB's first mesh's positions in world space, and its index. */
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
  return { pos, index: prim.indices !== undefined ? Uint32Array.from(read(prim.indices)) : null };
}

/** Each vertex's leg (0-3 in LK order) or BODY, by quadrant under the belly line. */
export function quadrantLegs(pos, rig, cut = 1.45) {
  const n = pos.length / 3, lab = new Uint8Array(n).fill(BODY), midX = (rig.frontX + rig.hindX) / 2;
  const sideOf = (end) => Math.sign(rig.paws[end + "L"].z - rig.zc) || 1;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], end = x < midX ? "h" : "f";
    const s = Math.sign(z - rig.zc) === sideOf(end) ? "L" : "R", k = end + s, g = rig.legs[k];
    // Up to `cut` times where the leg meets the body (its top, never above the belly line), and near its line:
    // a little above it takes in the fur the mesh grows from the thigh to the tail's root.
    if (y > cut * Math.min(g.top.y, rig.yb)) continue;
    const t = Math.max(0, Math.min(1, y / Math.max(1e-6, g.top.y))), lx = g.toe.x + (g.top.x - g.toe.x) * t;
    if (Math.abs(x - lx) > Math.max(0.12, 0.35 * rig.d)) continue;
    lab[i] = LK.indexOf(k);
  }
  return lab;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), dry = args.includes("--dry"), ci = args.indexOf("--cut"), cut = ci >= 0 ? Number(args[ci + 1]) : 1.45;
  const keys = args.filter((a, i) => !a.startsWith("--") && i !== ci + 1);
  const index = JSON.parse(fs.readFileSync(path.join(DIR, "index.json"), "utf8")).cats;
  for (const key of keys) {
    const file = index[key]?.file || key;
    const lo = readModel(path.join(DIR, `${file}-lo.glb`)), full = readModel(path.join(DIR, `${file}.glb`));
    const rig = R.findRig(lo.pos, lo.index);
    const far = quadrantLegs(lo.pos, rig, cut), fullLab = quadrantLegs(full.pos, rig, cut);
    const count = (l) => [0, 1, 2, 3, BODY].map((k) => l.filter((x) => x === k).length).join("/");
    const j = { v: 1, n: full.pos.length / 3, full: encodeLegs(fullLab), nlo: lo.pos.length / 3, far: encodeLegs(far) };
    const out = JSON.stringify(j);
    console.log(`${key}: far ${count(far)}, full ${count(fullLab)} (hL/hR/fL/fR/body), ${(out.length / 1024).toFixed(1)} KB`);
    if (!dry) fs.writeFileSync(path.join(DIR, `${key}.legs.json`), out);
  }
  if (!dry) {
    const cats = fs.readdirSync(DIR).filter((f) => f.endsWith(".legs.json")).map((f) => f.replace(".legs.json", "")).sort();
    fs.writeFileSync(path.join(DIR, "legs-index.json"), JSON.stringify({ v: 1, cats }));
  }
}
