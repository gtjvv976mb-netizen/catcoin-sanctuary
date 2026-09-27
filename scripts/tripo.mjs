#!/usr/bin/env node
/**
 * RIG CATS WITH TRIPO (the official `tripo` CLI, npm i -g tripo-cli; key in TRIPO_API_KEY or `tripo login`).
 *
 * Tripo's rigger builds a four-legged skeleton and skin weights for a model we already have
 * (rig_type quadruped, rig model v2.5). Our own rig (assets/world/catrig.js) struggles on models
 * whose legs the 3D generator fused together; Tripo's skeleton and weights are the fix. Tripo's
 * animation library for quadrupeds is thin (one walk), so the garden's cat behaviours (sit, lie,
 * sleep, groom, transitions, mannerisms) are still our clips, driven on the rigged skeleton.
 *
 *   node scripts/tripo.mjs balance
 *   node scripts/tripo.mjs plain KEY ...            decode assets/models/cats/KEY.glb into a plain GLB
 *                                                   (float attributes, transforms and the texture
 *                                                   transform baked in, no extensions) for upload
 *   node scripts/tripo.mjs rig KEY ... [--check-only] [--rig-type quadruped] [--reserve 100]
 *                                                   upload, rig-check (free), rig (~25 credits), download
 *   node scripts/tripo.mjs retarget KEY --animation preset:quadruped:walk [preset:... ≤5] [--in-place]
 *   node scripts/tripo.mjs inspect FILE.glb         skeleton, skin, meshes and animations of a GLB
 *   node scripts/tripo.mjs status
 *
 * Files go to scripts/.cat-models-cache/tripo/ (git-ignored): KEY.plain.glb, KEY.rigged.glb,
 * KEY.<animation>.glb. Every task is recorded in scripts/tripo.state.json (task ids, rig-check
 * verdict, credits). `plain` needs @gltf-transform: npm i --no-save @gltf-transform/core
 * @gltf-transform/extensions @gltf-transform/functions meshoptimizer. Avoid `tripo make <glb>` and
 * `tripo batch run` for existing models: they add an import step with no published price; this
 * runner uploads the file and passes its file token straight to rig-check and rig.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "scripts/.cat-models-cache/tripo");
const STATE = path.join(ROOT, "scripts/tripo.state.json");
const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);
const writeJson = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 1)}\n`);

/** Runs the tripo CLI with --json and returns its final JSON line (throws with the CLI's message). */
export function tripo(args, { run = execFileSync } = {}) {
  let out;
  try { out = run("tripo", [...args, "--json", "--yes", "--quiet", "--no-open"], { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { const txt = String(e.stdout || "") + String(e.stderr || ""); throw new Error(`tripo ${args[0]} ${args[1] || ""}: ${lastJson(txt)?.error || txt.trim().split("\n").pop()}`); }
  const j = lastJson(out);
  if (!j) throw new Error(`tripo ${args.join(" ")}: no JSON in output`);
  if (j.error) throw new Error(`tripo ${args[0]}: ${j.error}`);
  return j;
}
export const lastJson = (txt) => { for (const line of String(txt).trim().split("\n").reverse()) { try { return JSON.parse(line); } catch { /* not JSON */ } } return null; };

/** The JSON chunk of a GLB (no dependencies). */
export function glbJson(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  let off = 12;
  while (off < buf.length) { const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4); if (type === 0x4e4f534a) return JSON.parse(buf.subarray(off + 8, off + 8 + len).toString("utf8")); off += 8 + len; }
  throw new Error("GLB has no JSON chunk");
}

/** A readable summary of a GLB: skins (joint names as a tree), meshes, animations. */
export function inspect(json) {
  const nodes = json.nodes || [];
  const parent = new Map(); nodes.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
  const skins = (json.skins || []).map((s) => {
    const set = new Set(s.joints);
    const depth = (j) => { let d = 0; for (let p = parent.get(j); p !== undefined && set.has(p); p = parent.get(p)) d++; return d; };
    return { joints: s.joints.length, tree: s.joints.map((j) => `${"  ".repeat(depth(j))}${nodes[j]?.name ?? j}`) };
  });
  const meshes = (json.meshes || []).map((m) => ({ name: m.name, primitives: m.primitives.map((p) => ({ attributes: Object.keys(p.attributes), vertices: json.accessors?.[p.attributes.POSITION]?.count })) }));
  const animations = (json.animations || []).map((a) => ({ name: a.name, channels: a.channels.length }));
  return { extensionsUsed: json.extensionsUsed || [], skins, meshes, animations };
}

async function plain(key) {
  const src = path.join(ROOT, "assets/models/cats", `${key}.glb`), dst = path.join(OUT, `${key}.plain.glb`);
  if (!fs.existsSync(src)) throw new Error(`${key}: no ${src}`);
  let gt;
  try {
    gt = { core: await import("@gltf-transform/core"), ext: await import("@gltf-transform/extensions"), fn: await import("@gltf-transform/functions") };
  } catch { throw new Error("plain needs @gltf-transform: npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer"); }
  const io = new gt.core.NodeIO().registerExtensions(gt.ext.ALL_EXTENSIONS);
  try { const { MeshoptDecoder } = await import("meshoptimizer"); await MeshoptDecoder.ready; io.registerDependencies({ "meshopt.decoder": MeshoptDecoder }); } catch { /* the packed models are not meshopt-compressed */ }
  const doc = await io.read(src), root = doc.getRoot();
  await doc.transform(gt.fn.dequantize(), gt.fn.flatten());
  for (const n of root.listNodes()) if (n.getMesh()) gt.fn.clearNodeTransform(n);
  // Bake KHR_texture_transform into the UVs (the packer squeezes UVs into a corner and scales them back).
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const info = prim.getMaterial()?.getBaseColorTextureInfo(), tr = info?.getExtension("KHR_texture_transform");
    if (!tr) continue;
    const set = tr.getTexCoord() ?? info.getTexCoord(), uv = prim.getAttribute(`TEXCOORD_${set}`).clone();
    prim.setAttribute(`TEXCOORD_${set}`, uv);
    const [ox, oy] = tr.getOffset(), [sx, sy] = tr.getScale(), r = tr.getRotation(), c = Math.cos(r), s = Math.sin(r), a = uv.getArray();
    for (let i = 0; i < a.length; i += 2) { const u = a[i] * sx, v = a[i + 1] * sy; a[i] = ox + c * u + s * v; a[i + 1] = oy - s * u + c * v; }
    info.setExtension("KHR_texture_transform", null);
  }
  for (const e of root.listExtensionsUsed()) e.dispose();
  await doc.transform(gt.fn.prune());
  fs.mkdirSync(OUT, { recursive: true });
  await io.write(dst, doc);
  return dst;
}

async function main(argv) {
  const [cmd = "status", ...rest] = argv;
  const flag = (n, d = null) => { const i = rest.indexOf(n); return i < 0 ? d : rest[i + 1]; };
  const keys = rest.filter((a, i) => !a.startsWith("--") && !(rest[i - 1] || "").match(/^--(rig-type|reserve|animation)$/) && !(rest.indexOf("--animation") >= 0 && i > rest.indexOf("--animation") && a.startsWith("preset:")));
  const state = readJson(STATE, {});
  const save = () => writeJson(STATE, state);
  if (cmd === "balance") { console.log(tripo(["balance"])); return; }
  if (cmd === "status") { for (const [k, v] of Object.entries(state)) console.log(k, v.status, v.check ? `riggable=${v.check.riggable} ${v.check.rig_type}` : "", v.rig_task || "", v.credits ?? ""); return; }
  if (cmd === "inspect") { console.log(JSON.stringify(inspect(glbJson(fs.readFileSync(keys[0]))), null, 1)); return; }
  if (cmd === "plain") { for (const k of keys) console.log(k, "->", path.relative(ROOT, await plain(k))); return; }
  if (cmd === "rig") {
    const reserve = Number(flag("--reserve", 100)), rigType = flag("--rig-type", "quadruped");
    for (const key of keys) {
      const s = (state[key] ||= { status: "new" });
      try {
        const file = path.join(OUT, `${key}.plain.glb`);
        if (!fs.existsSync(file)) await plain(key);
        const { balance } = tripo(["balance"]);
        console.log(`${key}: balance ${balance}`);
        const up = tripo(["files", "upload", file]);
        s.file_token = up.file_token;
        const check = tripo(["anim", "check", up.file_token, "--name", `${key}-check`]);
        s.check = { task: check.task_id, riggable: check.output?.riggable ?? check.riggable, rig_type: check.output?.rig_type ?? check.rig_type };
        s.status = "checked"; s.at = new Date().toISOString(); save();
        console.log(`  rig-check: riggable=${s.check.riggable} rig_type=${s.check.rig_type}`);
        if (rest.includes("--check-only") || s.check.riggable === false) continue;
        if (balance - 30 < reserve) { console.log(`  stop: balance ${balance}, reserve ${reserve}`); break; }
        const rig = tripo(["anim", "rig", up.file_token, "--rig-type", rigType, "--spec", "tripo", "--out-format", "glb", "--name", `${key}-rig`, "-o", path.join(OUT, `${key}-rig`)]);
        s.rig_task = rig.task_id; s.credits = rig.credits_consumed; s.status = "rigged"; s.at = new Date().toISOString();
        const model = rig.model_file || (rig.files || []).find((f) => /\.glb$/i.test(f));
        if (model) { fs.copyFileSync(path.isAbsolute(model) ? model : path.join(rig.output_dir || OUT, model), path.join(OUT, `${key}.rigged.glb`)); s.file = `${key}.rigged.glb`; }
        save();
        console.log(`  rigged: task ${rig.task_id}, ${rig.credits_consumed} credits${model ? `, saved ${key}.rigged.glb` : " (no model file in the result: see tripo task get)"}`);
      } catch (e) { s.status = "failed"; s.error = e.message.slice(0, 400); save(); console.log(`  failed: ${e.message}`); }
    }
    return;
  }
  if (cmd === "retarget") {
    const key = keys[0], s = state[key];
    if (!s?.rig_task) throw new Error(`${key}: rig it first`);
    const ai = rest.indexOf("--animation"), anims = ai < 0 ? ["preset:quadruped:walk"] : rest.slice(ai + 1).filter((a) => a.startsWith("preset:"));
    const r = tripo(["anim", "retarget", s.rig_task, "--animation", ...anims, "--out-format", "glb", ...(rest.includes("--in-place") ? ["--animate-in-place"] : []), "-o", path.join(OUT, `${key}-anim`)]);
    (s.retargets ||= []).push({ task: r.task_id, animations: anims, credits: r.credits_consumed, at: new Date().toISOString() });
    save();
    console.log(`${key}: retarget ${anims.join(" ")} -> task ${r.task_id}, ${r.credits_consumed} credits, ${r.output_dir}`);
    return;
  }
  throw new Error(`unknown command ${cmd}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
