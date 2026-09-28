#!/usr/bin/env node
/**
 * AUTOMATIC 3D MODELS FOR LAUNCHED CATS: the Models workflow's steps (.github/workflows/models.yml),
 * around the repository's own tools, each used as it is designed:
 *
 *   node scripts/models.mjs pick        (no secret) choose at most MODELS_PER_RUN (1, at most 2) queued
 *                                       REBUILD entries of scripts/meshy.queue.json: the cats the sanctuary
 *                                       launched that have no model yet first; the rest of the queue only
 *                                       when MODELS_BACKLOG is "on". Never one whose post's photo the owner
 *                                       hides (data/photo-hide.json), one already made, one with views
 *                                       waiting for a person (meshy.state "views"), or one that failed
 *                                       MAX_TRIES times.
 *   node scripts/models.mjs meshy       (MESHY_API_KEY) scripts/meshy.mjs run KEY --reserve R for each:
 *                                       four-legged reference views from the entry's reference picture,
 *                                       Meshy multi-image-to-3D and its remesh far copy, recorded in
 *                                       scripts/cat-models.jobs.json. meshy.mjs stops before its balance
 *                                       would drop under the reserve (MODELS_MESHY_RESERVE, default 100).
 *   node scripts/models.mjs pack        (no secret) scripts/make-cat-models.py packs each new model into
 *                                       assets/models/cats/ (index.json, PROVENANCE.md), then the checks:
 *                                       the size budgets, a valid textured GLB, the garden's own rig
 *                                       (assets/world/catrig.js) on the model, and the repository's model
 *                                       tests (tests/catmodels, catrig, meshy). A model that fails is
 *                                       discarded (its files, its index row, its job entry put back), the
 *                                       failure recorded (retried at most MAX_TRIES times in all), and the
 *                                       cat keeps its portrait and the shared model.
 *   node scripts/models.mjs tripo       (TRIPO_API_KEY) scripts/tripo.mjs rig KEY --reserve R for each
 *                                       model that went live (Tripo's quadruped rig of the packed model,
 *                                       MODELS_TRIPO_RESERVE, default 100); skipped, with a log line, when
 *                                       the secret is missing. The site rigs its cats itself (catrig.js):
 *                                       Tripo's verdict and task are recorded, its rigged GLB is not used.
 *   node scripts/models.mjs preview     (no secret) scripts/render-cat-thumbs.mjs: a PNG of each new model
 *                                       in scripts/model-previews/ (headless Chromium; skipped if missing).
 *   node scripts/models.mjs summary     (no secret) the run in the job summary ($GITHUB_STEP_SUMMARY).
 *
 * The keys go from step to step in KEYS (the step outputs `keys`, `made`, `live`); every key is checked
 * against the queue again. State: scripts/models.state.json { note, cats: { KEY: { attempts, status,
 * error?, at, tasks?, tripo? } } } (status "live", "failed" or "gave-up"). No step here holds a wallet key.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ordered } from "./meshy.mjs";
import { photoHideOf, HIDDEN_NOTE } from "./lib/launcher.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FILES = Object.freeze({
  queue: "scripts/meshy.queue.json",
  meshyState: "scripts/meshy.state.json",
  tripoState: "scripts/tripo.state.json",
  jobs: "scripts/cat-models.jobs.json",
  state: "scripts/models.state.json",
  adoptables: "data/adoptables.json",
  photos: "data/real-photos.json",
  index: "assets/models/cats/index.json",
  provenance: "assets/models/PROVENANCE.md",
  previews: "scripts/model-previews",
});
export const STATE_NOTE = "The Models workflow's record (scripts/models.mjs, .github/workflows/models.yml): per queued cat, how many automatic tries it has had (at most MAX_TRIES), and whether its model went live, failed (tried again) or gave up (a person looks). Delete a cat's row to let it be tried again.";
/** Automatic tries a cat gets in all (a Meshy failure or a model that fails the checks is one). */
export const MAX_TRIES = 2;
/** The credit reserves' defaults: the ones scripts/meshy.mjs run and scripts/tripo.mjs rig use when none is given. */
export const DEFAULT_RESERVE = Object.freeze({ meshy: 100, tripo: 100 });
export const RESERVE_RANGE = Object.freeze([0, 1_000_000]);
/** The size budgets tests/catmodels.test.mjs and scripts/make-cat-models.py keep (bytes): full and far copy, and for HD models. */
export const BUDGET = Object.freeze({ full: 600_000, far: 150_000, hdFull: 800_000, hdFar: 300_000 });
/** The tests that validate assets/models/cats, run once a new model is packed. */
export const MODEL_TESTS = Object.freeze(["tests/catmodels.test.mjs", "tests/catrig.test.mjs", "tests/meshy.test.mjs"]);
const KEY = /^[A-Za-z0-9][A-Za-z0-9-]{1,39}$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const nowIso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

/* ── configuration ─────────────────────────────────────────────────────────────────────── */

/** A credit reserve from a repository variable: its default when unset or not a number, clamped to RESERVE_RANGE. { value, note }. */
export function reserveOf(env, name, def) {
  const raw = String(env?.[name] ?? "").trim();
  if (!raw) return { value: def, note: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { value: def, note: `${name} is not a number; the default ${def} is used` };
  const v = Math.min(RESERVE_RANGE[1], Math.max(RESERVE_RANGE[0], Math.floor(n)));
  return { value: v, note: v !== n ? `${name} ${raw} is used as ${v}` : null };
}
/** How many cats one run makes: MODELS_PER_RUN, 1 by default, at most 2. */
export function perRun(env) {
  const n = Math.floor(Number(String(env?.MODELS_PER_RUN ?? "").trim() || 1));
  return Number.isFinite(n) ? Math.min(2, Math.max(1, n)) : 1;
}
/** Whether the rest of the queue (cats that have a model already) may be rebuilt too: MODELS_BACKLOG "on". */
export const backlogOn = (env) => String(env?.MODELS_BACKLOG ?? "").trim().toLowerCase() === "on";

/* ── choosing ──────────────────────────────────────────────────────────────────────────── */

/** The tickers of the cats the sanctuary launched (data/adoptables.json rows with a `launch`), with their post ids. */
export function launchedCats(adoptables) {
  const out = new Map();
  for (const c of Array.isArray(adoptables?.cats) ? adoptables.cats : []) {
    if (isObj(c?.launch) && typeof c.ticker === "string") out.set(c.ticker, /\/status\/(\d{5,25})/.exec(c.proof?.url ?? "")?.[1] ?? null);
  }
  return out;
}

/**
 * The queue's rebuild entries this run takes: { picked: [{ key, modelKey, launched }], skipped: [{ key, why }] }.
 * Launched cats with no model first (queue order), then, with `backlog`, the rest (meshy.mjs order).
 */
export function selectEntries({ queue, meshyState = {}, state = { cats: {} }, adoptables = null, photos = null, hidden = new Set(), index = { cats: {} }, backlog = false, limit = 1 }) {
  const launched = launchedCats(adoptables);
  const skipped = [], first = [], rest = [];
  for (const q of ordered(queue ?? { cats: {} }, { only: "rebuild", state: meshyState })) {
    const s = state?.cats?.[q.key];
    const modelKey = q.modelKey ?? q.key;
    const isLaunched = launched.has(q.key);
    if (!KEY.test(q.key) || !KEY.test(modelKey)) { skipped.push({ key: q.key, why: "not a key a file may be named by" }); continue; }
    if (s?.status === "live") { skipped.push({ key: q.key, why: "made already" }); continue; }
    if ((s?.attempts ?? 0) >= MAX_TRIES || s?.status === "gave-up") { skipped.push({ key: q.key, why: `failed ${s.attempts} times: a person looks (delete its scripts/models.state.json row to try again)` }); continue; }
    if (meshyState[q.key]?.status === "views") { skipped.push({ key: q.key, why: "its reference views wait for a person (meshy.state \"views\")" }); continue; }
    const post = launched.get(q.key);
    const none = photos?.none?.[q.key];
    if ((post && hidden.has(post)) || (typeof none === "string" && none.startsWith(HIDDEN_NOTE))) { skipped.push({ key: q.key, why: "its post's photo is hidden (data/photo-hide.json)" }); continue; }
    if (isLaunched && !(modelKey in (index?.cats ?? {}))) first.push({ key: q.key, modelKey, launched: true });
    else if (isLaunched) skipped.push({ key: q.key, why: "has a model already" });
    else rest.push({ key: q.key, modelKey, launched: false });
  }
  const picked = [...first, ...(backlog ? rest : [])].slice(0, limit);
  return { picked, skipped };
}

/* ── bookkeeping ───────────────────────────────────────────────────────────────────────── */

/** The state file, as read: { note, cats }. A missing or unreadable one is empty. */
export function stateOf(data) {
  return { note: STATE_NOTE, cats: isObj(data?.cats) ? structuredClone(data.cats) : {} };
}
/** One try's outcome for `key`: live (ok) or failed (attempts + 1; "gave-up" once MAX_TRIES are used). Returns the new row. */
export function recordTry(state, key, { ok, error = null, at, tasks = null }) {
  const prev = state.cats[key] ?? {};
  const attempts = (prev.attempts ?? 0) + 1;
  const row = { attempts, status: ok ? "live" : attempts >= MAX_TRIES ? "gave-up" : "failed", at, ...(error ? { error: String(error).slice(0, 400) } : {}), ...(tasks ? { tasks } : {}) };
  if (prev.tripo) row.tripo = prev.tripo;
  state.cats[key] = row;
  return row;
}
/**
 * What a meshy.mjs run did for `key`, from its state before and after: "made" (done, a new entry),
 * "failed" (a new failed entry: its error), or "stopped" (nothing new: the reserve, or it never ran).
 */
export function meshyOutcome(before, after) {
  if (!after || JSON.stringify(after) === JSON.stringify(before ?? null)) return { outcome: "stopped" };
  if (after.status === "done") return { outcome: "made", tasks: after.tasks ?? [], credits: after.credits ?? null };
  if (after.status === "failed") return { outcome: "failed", error: after.error ?? "Meshy failed" };
  return { outcome: "stopped" };
}
/** A job entry put back as it was before meshy.mjs recorded a model (recordModel keeps the old one under `previous`). */
export function restoreJob(jobs, key) {
  const j = jobs[key];
  if (!j) return jobs;
  if (isObj(j.previous) && Object.keys(j.previous).length) jobs[key] = { ...j.previous };
  else delete jobs[key];
  return jobs;
}

/* ── the checks ────────────────────────────────────────────────────────────────────────── */

/** A GLB's JSON and binary chunks, or throws. */
export function readGlb(buf) {
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  if (buf.readUInt32LE(4) !== 2) throw new Error("not glTF 2");
  if (buf.readUInt32LE(8) !== buf.length) throw new Error("its declared length is wrong");
  let off = 12, json = null, bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString("utf8")); else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  if (!json || !bin) throw new Error("it has no JSON or no binary chunk");
  return { json, bin };
}

const COMPONENTS = { 5120: [Int8Array, 127], 5121: [Uint8Array, 255], 5122: [Int16Array, 32767], 5123: [Uint16Array, 65535], 5125: [Uint32Array, 0], 5126: [Float32Array, 0] };
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function nodeMatrix(n) {
  if (Array.isArray(n.matrix)) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1], [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };

/** Every vertex of a GLB's scene in world space (quantized positions dequantized, node transforms applied), as a flat Float32Array. */
export function glbPositions({ json, bin }) {
  const out = [];
  const walk = (ni, parent, depth) => {
    const n = json.nodes?.[ni];
    if (!n || depth > 64) return;
    const m = mul(parent, nodeMatrix(n));
    if (n.mesh !== undefined) for (const p of json.meshes[n.mesh].primitives) {
      const a = json.accessors[p.attributes.POSITION], bv = json.bufferViews[a.bufferView], [T, norm] = COMPONENTS[a.componentType];
      const stride = bv.byteStride || T.BYTES_PER_ELEMENT * 3;
      const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
      const get = { 5120: "getInt8", 5121: "getUint8", 5122: "getInt16", 5123: "getUint16", 5125: "getUint32", 5126: "getFloat32" }[a.componentType];
      for (let i = 0; i < a.count; i++) {
        const o = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * stride;
        const [x, y, z] = [0, 1, 2].map((k) => { const q = view[get](o + k * T.BYTES_PER_ELEMENT, true); return a.normalized && norm ? Math.max(q / norm, -1) : q; });
        out.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
      }
    }
    for (const c of n.children ?? []) walk(c, m, depth + 1);
  };
  for (const r of json.scenes?.[json.scene ?? 0]?.nodes ?? []) walk(r, IDENTITY, 0);
  return new Float32Array(out);
}

/** The garden's rig (assets/world/catrig.js, which imports "three" as the page's import map names it), loaded in node. */
export async function loadRig(root = ROOT) {
  const threeUrl = pathToFileURL(path.join(root, "assets/vendor/three/three.module.min.js")).href;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "models-rig-"));
  fs.writeFileSync(path.join(tmp, "catrig.mjs"), fs.readFileSync(path.join(root, "assets/world/catrig.js"), "utf8").replace(/from "three"/, `from "${threeUrl}"`));
  return import(pathToFileURL(path.join(tmp, "catrig.mjs")).href);
}

const OK_EXT = new Set(["KHR_mesh_quantization", "KHR_texture_transform"]);
/** What is wrong with one packed GLB as the page loads it (tests/catmodels.test.mjs's rules), or []. */
export function glbProblems(buf, budget) {
  const out = [];
  if (buf.length > budget) out.push(`${buf.length} bytes, over the ${budget}-byte budget`);
  let g;
  try { g = readGlb(buf); } catch (e) { return [...out, e.message]; }
  const { json, bin } = g;
  for (const e of json.extensionsRequired ?? []) if (!OK_EXT.has(e)) out.push(`needs the extension ${e}`);
  const prims = (json.meshes ?? []).flatMap((m) => m.primitives ?? []);
  if (!prims.length) out.push("no mesh");
  if (prims.some((p) => !("POSITION" in (p.attributes ?? {})) || !("TEXCOORD_0" in (p.attributes ?? {})))) out.push("a mesh without positions or texture coordinates");
  if (!(json.images?.length >= 1) || !json.images.every((i) => i.mimeType === "image/jpeg")) out.push("no JPEG texture");
  if (prims.length && !json.materials?.[prims[0].material]?.pbrMetallicRoughness?.baseColorTexture) out.push("no colour texture");
  if ((json.bufferViews ?? []).some((bv) => (bv.byteOffset ?? 0) + bv.byteLength > bin.length)) out.push("a buffer view past the binary chunk");
  return out;
}

/**
 * What the garden's rig makes of a model's points: four legs with their joints in order and skin weights
 * that add up; and 1 unit tall on the ground. [] when fine. (Which way it faces is the packer's heading
 * guess: the preview and a person's look check it.)
 */
export function rigProblems(pos, R) {
  const out = [];
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 1; i < pos.length; i += 3) { y0 = Math.min(y0, pos[i]); y1 = Math.max(y1, pos[i]); }
  if (!(pos.length >= 30)) return ["too few points"];
  if (Math.abs(y0) > 0.03 || Math.abs(y1 - 1) > 0.05) out.push(`not 1 unit tall on the ground (y ${y0.toFixed(3)}..${y1.toFixed(3)})`);
  try {
    const rig = R.findRig(pos), sk = R.buildSkeleton(rig), w = R.skinWeights(pos, rig, sk);
    for (const k of ["fL", "fR", "hL", "hR"]) { const g = rig.legs[k]; if (!(g.top.y > g.knee.y && g.knee.y > g.low.y && g.low.y > 0)) out.push(`the ${k} leg's joints are out of order`); }
    let bad = 0;
    for (let i = 0; i < pos.length / 3; i++) { let s = 0; for (let k = 0; k < 4; k++) s += w.weight.array[i * 4 + k]; if (Math.abs(s - 1) > 1e-3) bad++; }
    if (bad) out.push(`${bad} points' skin weights do not add up`);
  } catch (e) { out.push(`the rig failed: ${e.message}`); }
  return out;
}

/** Every check a packed model must pass before it goes live (budgets, GLB, rig), for `modelKey` in `root`. [] when fine. */
export async function modelProblems(root, modelKey, { R = null } = {}) {
  const index = readJsonFile(path.join(root, FILES.index), { cats: {} });
  const row = index.cats?.[modelKey];
  if (!row) return ["not in assets/models/cats/index.json"];
  const out = [];
  const dir = path.join(root, "assets/models/cats");
  for (const [tag, budget] of [["", row.hd ? BUDGET.hdFull : BUDGET.full], ["-lo", row.hd ? BUDGET.hdFar : BUDGET.far]]) {
    const f = path.join(dir, `${modelKey}${tag}.glb`);
    if (!fs.existsSync(f)) { out.push(`${modelKey}${tag}.glb is missing`); continue; }
    const buf = fs.readFileSync(f);
    out.push(...glbProblems(buf, budget).map((p) => `${modelKey}${tag}.glb: ${p}`));
    if (!tag && !out.length) out.push(...rigProblems(glbPositions(readGlb(buf)), R ?? await loadRig(root)).map((p) => `${modelKey}.glb: ${p}`));
  }
  if (row.height !== 1 || !(row.len > row.width && row.len < 2.5)) out.push(`index.json: ${modelKey} is not 1 unit tall and lengthwise along +X`);
  return out;
}

/* ── files ─────────────────────────────────────────────────────────────────────────────── */

function readJsonFile(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
const writeJson = (file, v, indent = 1) => fs.writeFileSync(file, `${JSON.stringify(v, null, indent)}\n`);
/** The bytes of these files as they are now (null: missing), to put back if a model is discarded. */
function snapshot(root, rels) { return new Map(rels.map((r) => [r, fs.existsSync(path.join(root, r)) ? fs.readFileSync(path.join(root, r)) : null])); }
function restore(root, snap) {
  for (const [rel, bytes] of snap) {
    const f = path.join(root, rel);
    if (bytes === null) fs.rmSync(f, { force: true }); else fs.writeFileSync(f, bytes);
  }
}
/** The KEYS a step was given: those that are queue keys, in order, without repeats. */
export function keysOf(env, queue) {
  return [...new Set(String(env?.KEYS ?? "").split(/[\s,]+/).filter(Boolean))].filter((k) => KEY.test(k) && queue?.cats?.[k]?.action === "rebuild");
}

/* ── the steps ─────────────────────────────────────────────────────────────────────────── */

const run = (cmd, args, { root, env }) => spawnSync(cmd, args, { cwd: root, env, stdio: "inherit" });

/**
 * One step. Everything outside is injectable: the environment, the repository folder, the clock, how a
 * command is run (`exec(cmd, args)` → { status }), and the output. Returns { code, outputs }.
 */
export async function main(argv = process.argv.slice(2), { env = process.env, root = ROOT, now = Date.now, exec = null, log = console.log, R = null } = {}) {
  const x = exec ?? ((cmd, args) => run(cmd, args, { root, env }));
  const at = nowIso(now());
  const file = (rel) => path.join(root, rel);
  const queue = readJsonFile(file(FILES.queue), { cats: {} });
  const state = stateOf(readJsonFile(file(FILES.state), null));
  const saveState = () => writeJson(file(FILES.state), state);
  const outputs = {};
  const cmd = argv[0];

  if (cmd === "pick") {
    const hidden = photoHideOf({ readText: (rel) => (fs.existsSync(file(rel)) ? fs.readFileSync(file(rel), "utf8") : null) }, log);
    const { picked, skipped } = selectEntries({ queue, meshyState: readJsonFile(file(FILES.meshyState), {}), state, adoptables: readJsonFile(file(FILES.adoptables), null),
      photos: readJsonFile(file(FILES.photos), null), hidden, index: readJsonFile(file(FILES.index), { cats: {} }), backlog: backlogOn(env), limit: perRun(env) });
    for (const s of skipped.filter((s) => !/made already|has a model already/.test(s.why))) log(`Models: ${s.key} skipped: ${s.why}.`);
    log(picked.length ? `Models: this run makes ${picked.map((p) => `${p.key}${p.launched ? " (launched)" : ""}`).join(", ")}.` : `Models: nothing to make${backlogOn(env) ? "" : " (launched cats only; MODELS_BACKLOG is not on)"}.`);
    outputs.keys = picked.map((p) => p.key).join(" ");
    return { code: 0, outputs };
  }

  const keys = keysOf(env, queue);
  const mk = (key) => queue.cats[key].modelKey ?? key;

  if (cmd === "meshy") {
    if (!String(env.MESHY_API_KEY ?? "").trim()) { log("::warning title=Models::MESHY_API_KEY is not set: no model is made."); outputs.made = ""; return { code: 0, outputs }; }
    const reserve = reserveOf(env, "MODELS_MESHY_RESERVE", DEFAULT_RESERVE.meshy);
    if (reserve.note) log(`::warning title=Models::${reserve.note}`);
    const made = [];
    for (const key of keys) {
      const before = readJsonFile(file(FILES.meshyState), {})[key] ?? null;
      const r = x("node", ["scripts/meshy.mjs", "run", key, "--limit", "1", "--only", "rebuild", "--reserve", String(reserve.value)]);
      const o = meshyOutcome(before, readJsonFile(file(FILES.meshyState), {})[key] ?? null);
      if (o.outcome === "made") { made.push(key); log(`Models: ${key}: Meshy made its model (${o.credits ?? "?"} credits).`); }
      else if (o.outcome === "failed") { const row = recordTry(state, key, { ok: false, error: `Meshy: ${o.error}`, at }); log(`::warning title=Models::${key}: Meshy failed (${String(o.error).slice(0, 200)}); try ${row.attempts} of ${MAX_TRIES}.`); }
      else { log(`Models: ${key}: nothing made (the Meshy balance is at its reserve of ${reserve.value} credits, or the run stopped${r?.status ? `: exit ${r.status}` : ""}); no try is used.`); break; }
    }
    saveState();
    outputs.made = made.join(" ");
    return { code: 0, outputs };
  }

  if (cmd === "pack") {
    const live = [];
    for (const key of keys) {
      const m = mk(key);
      const snap = snapshot(root, [`assets/models/cats/${m}.glb`, `assets/models/cats/${m}-lo.glb`, FILES.index, FILES.provenance]);
      let problems = [];
      try {
        const p = x("python3", ["scripts/make-cat-models.py", "--gltfpack", env.GLTFPACK || "node_modules/.bin/gltfpack", m]);
        if (p?.status !== 0) problems.push(`the packer failed (exit ${p?.status})`);
        else {
          problems = await modelProblems(root, m, { R });
          if (!problems.length) {
            const t = x("node", ["--test", ...MODEL_TESTS]);
            if (t?.status !== 0) problems.push(`the model tests failed (${MODEL_TESTS.join(", ")})`);
          }
        }
      } catch (e) { problems.push(`packing stopped: ${e.message}`); }
      const tasks = readJsonFile(file(FILES.meshyState), {})[key]?.tasks ?? null;
      if (!problems.length) {
        recordTry(state, key, { ok: true, at, tasks });
        live.push(key);
        log(`Models: ${key}: its model passed every check and goes live.`);
        continue;
      }
      // Discarded: its files and index row as they were, its job entry as before Meshy, Meshy's state "failed" (so it is tried again, bounded).
      restore(root, snap);
      const jobs = readJsonFile(file(FILES.jobs), {});
      writeJson(file(FILES.jobs), restoreJob(jobs, m));
      const ms = readJsonFile(file(FILES.meshyState), {});
      ms[key] = { ...(ms[key] ?? {}), status: "failed", error: `the model did not pass the checks: ${problems.join("; ")}`.slice(0, 400), at };
      writeJson(file(FILES.meshyState), ms);
      const row = recordTry(state, key, { ok: false, error: problems.join("; "), at, tasks });
      log(`::warning title=Models::${key}: its model is discarded (${problems.join("; ").slice(0, 300)}); try ${row.attempts} of ${MAX_TRIES}. The cat keeps its portrait.`);
    }
    saveState();
    outputs.live = live.join(" ");
    return { code: 0, outputs };
  }

  if (cmd === "tripo") {
    if (!String(env.TRIPO_API_KEY ?? "").trim()) { log("Models: TRIPO_API_KEY is not set: the Tripo rig is skipped."); return { code: 0, outputs }; }
    const reserve = reserveOf(env, "MODELS_TRIPO_RESERVE", DEFAULT_RESERVE.tripo);
    if (reserve.note) log(`::warning title=Models::${reserve.note}`);
    for (const key of keys.filter((k) => state.cats[k]?.status === "live")) {
      x("node", ["scripts/tripo.mjs", "rig", mk(key), "--rig-type", "quadruped", "--reserve", String(reserve.value)]);
      const t = readJsonFile(file(FILES.tripoState), {})[mk(key)] ?? {};
      state.cats[key].tripo = { status: t.status ?? "not run", ...(t.check ? { riggable: t.check.riggable ?? null } : {}), ...(t.rig_task ? { task: t.rig_task } : {}), ...(t.error ? { error: String(t.error).slice(0, 200) } : {}) };
      log(`Models: ${key}: Tripo ${state.cats[key].tripo.status}${t.check ? `, riggable ${t.check.riggable}` : ""}.`);
      if (t.check?.riggable === false) log(`::warning title=Models::${key}: Tripo's rig check says the model is not riggable: look at it (node scripts/render-cat-clips.mjs OUT.png ${mk(key)}).`);
    }
    saveState();
    return { code: 0, outputs };
  }

  if (cmd === "preview") {
    const live = keys.filter((k) => state.cats[k]?.status === "live");
    if (!live.length) return { code: 0, outputs };
    const r = x("node", ["scripts/render-cat-thumbs.mjs", FILES.previews, ...live.map(mk)]);
    if (r?.status !== 0) log("::warning title=Models::the preview could not be rendered (no headless browser?); the models are live all the same.");
    return { code: 0, outputs };
  }

  if (cmd === "summary") {
    const repo = env.GITHUB_REPOSITORY, lines = ["## Models", ""];
    const jobs = readJsonFile(file(FILES.jobs), {}), index = readJsonFile(file(FILES.index), { cats: {} });
    if (!keys.length) lines.push("No queued cat to make this run.");
    for (const key of keys) {
      const s = state.cats[key], m = mk(key), j = jobs[m] ?? {};
      if (s?.status === "live" && index.cats?.[m]) {
        const preview = fs.existsSync(file(`${FILES.previews}/${m}.png`)) ? (repo ? ` · [preview](https://github.com/${repo}/blob/main/${FILES.previews}/${m}.png)` : ` · preview ${FILES.previews}/${m}.png`) : "";
        lines.push(`- **${key}**: live. ${j.model ?? "model"}, ${Math.round((j.sizes?.hi ?? 0) / 1024)} KB full, ${Math.round((j.sizes?.lo ?? 0) / 1024)} KB far; Meshy tasks ${(s.tasks ?? []).join(", ") || "-"}; Tripo ${s.tripo ? `${s.tripo.status}${s.tripo.riggable === undefined ? "" : `, riggable ${s.tripo.riggable}`}` : "skipped"}${preview}.`);
      } else if (s && s.status !== "live") lines.push(`- **${key}**: ${s.status} (try ${s.attempts} of ${MAX_TRIES}): ${s.error ?? ""}`);
      else lines.push(`- **${key}**: nothing made this run (the credit reserve, or a missing key).`);
    }
    lines.push("", "A quick look at each new model is still wise: `node scripts/render-cat-thumbs.mjs OUT KEY` and `node scripts/render-cat-clips.mjs OUT.png KEY` (see scripts/CAT-MODELS.md).");
    const text = `${lines.join("\n")}\n`;
    if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, text); else log(text);
    return { code: 0, outputs };
  }

  log("Usage: node scripts/models.mjs pick | meshy | pack | tripo | preview | summary");
  return { code: 2, outputs };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { code, outputs } = await main();
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(outputs).map(([k, v]) => `${k}=${v}\n`).join(""));
  process.exitCode = code;
}
