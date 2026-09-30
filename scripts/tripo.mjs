#!/usr/bin/env node
/**
 * MAKE AND RIG CATS WITH TRIPO (the official `tripo` CLI, tripo-cli 0.5.1: the Models workflow installs it from
 * tools/tripo-cli, npm ci --ignore-scripts --prefix tools/tripo-cli, every package locked by its hash, and puts its
 * node_modules/.bin on PATH; key in TRIPO_API_KEY or `tripo login`; the CLI reads it, this runner never does and
 * never prints it).
 *
 * MAKE: a queued rebuild's 3D model (scripts/meshy.queue.json, the same entries and words as
 * scripts/meshy.mjs), in two Tripo tasks: a standing reference picture, then image-to-model.
 *   1. image-to-image (banana2, 4:3, ~10 credits) redraws the entry's picture (its styleImage: an
 *      https URL as it is, or a PNG/JPEG/WebP in the repository, which the CLI uploads) standing on all
 *      four legs (tripoPrompt: TRIPO_REPOSE, the entry's referencePrompt, TRIPO_STANDING, the words of
 *      meshy.mjs's reference said shorter, the whole at most PROMPT_MAX = 1024 characters, the look cut to
 *      fit: Tripo refuses a longer image prompt); an entry with no picture ("generate") gets text-to-image
 *      (seedream_v4, ~5 credits) from the words alone. A raw photo's own pose would stay (a sitting cat
 *      fails the garden's rig check).
 *   2. image-to-model from that task (tripo-v3.1 = v3.1-20260211, face_limit 12000, texture on, PBR off:
 *      30 credits). The model is always named: with a face budget ≤ 20000 and no --model the CLI picks
 *      P1 (50 credits). Never compress=geometry (the packer cannot read meshopt) or quad (forces FBX).
 * About 40 credits a cat (35 without a picture). Before anything is spent the balance is read, and the
 * run stops (nothing recorded) when balance − cost would drop under --reserve (default 0: spend what is
 * there), or when Tripo refuses the first task for want of credits. The record (scripts/tripo.state.json,
 * MODELKEY.make: status "started", "done" or "failed", task ids, credits, error) is saved before the first
 * paid task and after each task id is known; a picture that cannot be used is recorded failed before
 * anything is spent. Any other failure is recorded with what it spent. Each CLI call is killed at its own bound
 * (MAKE.callSeconds for the balance and each submission, TRIPO_TIMEOUT_MS for each wait), so one cat's make takes at
 * most MAKE_CAT_MS. The GLB is downloaded at once (Tripo's result URLs
 * expire) to where scripts/make-cat-models.py reads it: scripts/.cat-models-cache/MODELKEY.raw.glb, with
 * the stamp MODELKEY.raw.job (the model task id); the job entry goes to scripts/cat-models.jobs.json
 * (recordModel: the old entry kept under "previous"; no lo_url, since Tripo's UV atlas simplifies
 * cleanly into the far copy).
 *
 * RIG: Tripo's rigger builds a four-legged skeleton and skin weights for a model we already have
 * (rig_type quadruped, rig model v2.5). Our own rig (assets/world/catrig.js) struggles on models
 * whose legs the 3D generator fused together; Tripo's skeleton and weights are the fix. Tripo's
 * animation library for quadrupeds is thin (one walk), so the garden's cat behaviours (sit, lie,
 * sleep, groom, transitions, mannerisms) are still our clips, driven on the rigged skeleton.
 *
 *   node scripts/tripo.mjs balance
 *   node scripts/tripo.mjs make KEY [--reserve 0]    a queued rebuild's model, as above (KEY: its queue key;
 *                                                   recorded under its model key)
 *   node scripts/tripo.mjs plain KEY ...            decode assets/models/cats/KEY.glb into a plain GLB
 *                                                   (float attributes, transforms and the texture
 *                                                   transform baked in, no extensions) for upload
 *   node scripts/tripo.mjs rig KEY ... [--check-only] [--rig-type quadruped] [--reserve 100]
 *                                                   upload, rig-check (free), rig (~25 credits), download
 *   node scripts/tripo.mjs retarget KEY --animation preset:quadruped:walk [preset:... ≤5] [--in-place]
 *   node scripts/tripo.mjs inspect FILE.glb         skeleton, skin, meshes and animations of a GLB
 *   node scripts/tripo.mjs status
 *
 * Files go to scripts/.cat-models-cache/tripo/ (git-ignored; `make` runs the CLI there, so the CLI's
 * .tripo/context.json stays out of the checkout): KEY-model/ (the make's download), KEY.plain.glb, KEY.rigged.glb,
 * KEY.<animation>.glb. Every task is recorded in scripts/tripo.state.json (task ids, rig-check
 * verdict, credits). `plain` needs @gltf-transform: tools/tripo-rig, npm ci --ignore-scripts --prefix
 * tools/tripo-rig, then ln -s tools/tripo-rig/node_modules node_modules (as the rig job does). Avoid `tripo make <glb>` and
 * `tripo batch run` for existing models: they add an import step with no published price; this
 * runner uploads the file and passes its file token straight to rig-check and rig.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { recordModel } from "./meshy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "scripts/.cat-models-cache/tripo");
const STATE = path.join(ROOT, "scripts/tripo.state.json");
const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);
const writeJson = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 1)}\n`);

/** The longest one tripo CLI call may take (a rig task is minutes): a hung call is killed, never left to hold a run. */
export const TRIPO_TIMEOUT_MS = 30 * 60_000;
/** Runs the tripo CLI with --json and returns its final JSON line (throws with the CLI's message). `cwd`: where it runs (its .tripo/context.json goes there). */
export function tripo(args, { run = execFileSync, timeoutMs = TRIPO_TIMEOUT_MS, cwd = undefined } = {}) {
  let out;
  try { out = run("tripo", [...args, "--json", "--yes", "--quiet", "--no-open"], { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"], timeout: timeoutMs, killSignal: "SIGKILL", ...(cwd ? { cwd } : {}) }); }
  catch (e) {
    const txt = String(e.stdout || "") + String(e.stderr || ""), j = lastJson(txt);
    // The CLI's exit code rides along (4: not enough credits, 5: content policy, 6: the task failed, 7: network).
    throw Object.assign(new Error(`tripo ${args[0]} ${args[1] || ""}: ${j?.error || txt.trim().split("\n").pop()}`), { exitCode: Number.isInteger(j?.exit_code) ? j.exit_code : e.status ?? null });
  }
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

/** A rig check's verdict: from the task's detail (`tripo task get`; the `anim check` result itself has no output), else unknown. */
export function checkVerdict(check, detail) {
  return { task: check?.task_id, riggable: detail?.output?.riggable ?? check?.output?.riggable ?? check?.riggable, rig_type: detail?.output?.rig_type ?? check?.output?.rig_type ?? check?.rig_type };
}

/* ── make: a queued rebuild's model ─────────────────────────────────────────────────────── */

/**
 * How `make` builds a model, and what each task costs (developers.tripo3d.ai/en/pricing, 1 credit =
 * US$0.01; what each task really consumed is what is recorded).
 */
export const MAKE = Object.freeze({
  imageModel: "banana2", imageParams: Object.freeze(["aspect_ratio=4:3"]),
  textModel: "seedream_v4",
  model: "tripo-v3.1", modelVersion: "v3.1-20260211", faces: 12000,
  modelParams: Object.freeze(["face_limit=12000", "texture=true", "pbr=false"]),
  cost: Object.freeze({ "image-to-image": 10, "text-to-image": 5, "image-to-model": 30 }),
  /**
   * Each wait, in seconds: the CLI's own --timeout, before tripo()'s kill (TRIPO_TIMEOUT_MS). The CLI checks it only
   * between polls, and a --download after it has none, so the kill is what bounds a wait.
   */
  watchSeconds: 1500,
  /** The kill for each call that only reads or submits (the balance, each generate --no-wait); the CLI retries a request 3 times, 60 s each. */
  callSeconds: 300,
});
/**
 * The longest one cat's make can take: its five CLI calls (the balance, two submissions, two waits), each killed at
 * its bound. The Models workflow starts a cat only when this still fits inside its make step's time limit.
 */
export const MAKE_CAT_MS = 3 * MAKE.callSeconds * 1000 + 2 * TRIPO_TIMEOUT_MS;
/**
 * The longest prompt Tripo takes for a picture: tripo-cli 0.5.1's reference (skill/commands/generate.md, "Image
 * parameters") gives prompt ≤ 1024 characters for text-to-image and image-to-image. The CLI checks it only for 3D
 * tasks, so a longer one reaches the server, which refuses it: a try used for nothing, every time.
 */
export const PROMPT_MAX = 1024;
/** Tripo's pose words: meshy.mjs's REPOSE and STANDING said shorter, so that the queue's look has room in PROMPT_MAX. */
export const TRIPO_REPOSE = "Redraw this same character in a NEW POSE: walking on all four legs, body horizontal. Keep its exact colours, markings, face and outfit.";
export const TRIPO_STANDING = "Full body, alone, standing on all four legs like a real cat: back horizontal, all four paws flat on the ground, legs apart, head up, tail out behind; never upright. Side view at a slight 3/4 angle, head to the right. Plain light grey background, no props, no text.";
/**
 * A queue entry's look in at most `room` characters: whole; else cut after its last sentence that fits, when that
 * keeps most of the room; else after its last clause (a comma or semicolon) or word that fits, ended with a full stop.
 */
export function fitLook(text, room) {
  const t = String(text ?? "").trim().replace(/\s+/g, " ");
  if (t.length <= room) return t;
  if (room < 2) return "";
  const head = t.slice(0, room + 1);
  const end = Math.max(...[". ", "! ", "? "].map((m) => head.lastIndexOf(m)));
  if (end + 1 >= room * 0.8) return t.slice(0, end + 1);
  const cut = t.slice(0, room - 1);
  const clause = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf("; "));
  const at = clause >= room * 0.8 ? clause : cut.lastIndexOf(" ");
  return `${(at >= room / 2 ? cut.slice(0, at) : cut).replace(/[\s,;:.-]+$/, "")}.`;
}
/**
 * The reference picture's prompt for Tripo: [TRIPO_REPOSE, when drawn from a picture] the entry's look, TRIPO_STANDING;
 * never over PROMPT_MAX (the pose words are whole, the look is what is cut). { prompt, cut: characters of the look left out }.
 */
export function tripoPrompt(q, { fromPicture = false } = {}) {
  const look = String(q?.referencePrompt || q?.retexturePrompt || "").trim().replace(/\s+/g, " ");
  const before = fromPicture ? `${TRIPO_REPOSE} ` : "";
  const fit = fitLook(look, PROMPT_MAX - before.length - TRIPO_STANDING.length - 1);
  return { prompt: `${before}${fit ? `${fit} ` : ""}${TRIPO_STANDING}`, cut: look.length - fit.length };
}
/** The `model` a Tripo-made job entry carries (make-cat-models.py writes it in PROVENANCE.md). */
export const MAKE_MODEL_NAME = `tripo ${MAKE.modelVersion} image-to-model`;
/** An id the CLI takes as a task reference (else it would read it as a prompt). */
const CLI_TASK_ID = /^(task_[A-Za-z0-9_-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * The reference step for one queue entry, and what the whole make costs (pure: no CLI, no network).
 * { kind: "image-to-image" | "text-to-image", args, cost, cut }. The picture: an https URL as it is, a
 * PNG/JPEG/WebP in the repository by its full path (the CLI uploads it), "generate" or none: words only.
 * The prompt is tripoPrompt's (at most PROMPT_MAX characters; `cut`: how much of the look it left out).
 */
export function makePlan(key, q, { root = ROOT } = {}) {
  const ref = String(q?.styleImage ?? "").trim();
  let input = null;
  if (/^https:\/\/\S+$/.test(ref)) input = ref;
  else if (ref && ref !== "generate") {
    const file = path.resolve(root, ref);
    if (!file.startsWith(path.resolve(root) + path.sep) || !/\.(png|jpe?g|webp)$/i.test(file) || !fs.existsSync(file)) throw new Error(`${key}: its picture ${ref.slice(0, 120)} is neither an https URL nor a PNG, JPEG or WebP file in the repository`);
    input = file;
  }
  const kind = input ? "image-to-image" : "text-to-image";
  const { prompt, cut } = tripoPrompt(q, { fromPicture: !!input });
  if (prompt.length > PROMPT_MAX) throw new Error(`${key}: its prompt is ${prompt.length} characters, over Tripo's ${PROMPT_MAX}`);
  const args = input
    ? ["generate", "image-to-image", input, "--model", MAKE.imageModel, "--prompt", prompt, ...MAKE.imageParams.flatMap((p) => ["-p", p]), "--no-wait", "--name", `${key}-ref`]
    : ["generate", "text-to-image", prompt, "--model", MAKE.textModel, "--no-wait", "--name", `${key}-ref`];
  return { kind, args, cost: MAKE.cost[kind] + MAKE.cost["image-to-model"], cut };
}
/** The CLI call that makes the model from the reference (a task id, or its picture's URL). */
export const modelArgs = (input, key) => ["generate", "image-to-model", input, "--model", MAKE.model, ...MAKE.modelParams.flatMap((p) => ["-p", p]), "--no-wait", "--name", `${key}-model`];

const taskIdOf = (r, what) => {
  const id = r?.task_id;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{6,80}$/.test(id)) throw new Error(`the ${what} gave no task id`);
  return id;
};
const creditsOf = (r, fallback) => { const n = Number(r?.credits_consumed ?? NaN); return Number.isFinite(n) ? n : fallback; };
/** The model's result URL (v3 merges v2's pbr_model, model and base_model into model_url), for the record. */
export function modelUrlOf(output) {
  for (const k of ["model_url", "pbr_model", "model", "base_model"]) {
    const v = output?.[k], u = typeof v === "string" ? v : v?.url;
    if (typeof u === "string" && /^https:\/\/\S+$/.test(u)) return u.slice(0, 2000);
  }
  return null;
}
/** The downloaded GLB of a finished model task (`task watch --download -o dir`): a file inside `dir` that is a GLB, or throws. */
export function modelFileOf(result, dir) {
  const inside = path.resolve(dir) + path.sep;
  const candidates = [result?.model_file, ...(Array.isArray(result?.files) ? result.files : [])]
    .filter((f) => typeof f === "string").map((f) => path.resolve(dir, f)).filter((f) => f.startsWith(inside) && fs.existsSync(f) && fs.statSync(f).isFile());
  for (const f of candidates) {
    const fd = fs.openSync(f, "r"), head = Buffer.alloc(4);
    try { fs.readSync(fd, head, 0, 4, 0); } finally { fs.closeSync(fd); }
    if (head.readUInt32LE(0) === 0x46546c67 && fs.statSync(f).size <= 200 * 1024 * 1024) return f;
  }
  throw new Error("the model task's download has no GLB");
}

/**
 * Makes one queued rebuild's model with Tripo (see the header). Everything outside is injectable: the
 * repository folder, how the CLI is run (`run`, as execFileSync), the log and the clock. Returns
 * { stopped } (the reserve: nothing spent, nothing recorded), { made, credits } or { failed, error }
 * (recorded; a picture that cannot be used is one too, before anything is spent, so it never holds the queue).
 * Throws, recording nothing, when the balance cannot be read (no key, the network): nothing was spent.
 */
export function makeModel(key, { root = ROOT, run = execFileSync, reserve = 0, log = console.log, now = () => new Date().toISOString() } = {}) {
  if (!Number.isFinite(reserve)) throw new Error("--reserve must be a number");
  const q = readJson(path.join(root, "scripts/meshy.queue.json"), { cats: {} }).cats?.[key];
  if (q?.action !== "rebuild") throw new Error(`${key}: not a queued rebuild`);
  const mk = q.modelKey ?? key;
  const statePath = path.join(root, "scripts/tripo.state.json");
  const state = readJson(statePath, {});
  const prior = state[mk] === undefined ? undefined : structuredClone(state[mk]);
  const save = () => writeJson(statePath, state);
  const fail = (rec, e) => {
    Object.assign(rec, { status: "failed", error: String(e.message).slice(0, 400), at: now() });
    state[mk] = { ...(state[mk] ?? {}), make: rec };
    save();
    log(`  failed: ${e.message}`);
    return { failed: true, error: rec.error };
  };
  let plan;
  try { plan = makePlan(key, q, { root }); } catch (e) { log(`${key}: its picture cannot be used`); return fail({ tasks: [], credits: 0 }, e); }
  const cache = path.join(root, "scripts/.cat-models-cache"), out = path.join(cache, "tripo");
  fs.mkdirSync(out, { recursive: true });
  // Each call killed at its bound (a submission or a read: MAKE.callSeconds; a wait: TRIPO_TIMEOUT_MS): MAKE_CAT_MS in all.
  const cli = (args, timeoutMs = MAKE.callSeconds * 1000) => tripo(args, { run, cwd: out, timeoutMs });
  const balance = Number(cli(["balance"]).balance);
  if (!Number.isFinite(balance)) throw new Error("the Tripo balance could not be read");
  if (balance - plan.cost < reserve) { log(`${key}: stop: balance ${balance}, its model needs about ${plan.cost}, reserve ${reserve}`); return { stopped: true }; }
  log(`${key}: ${plan.kind} then image-to-model (about ${plan.cost} credits; balance ${balance})${plan.cut ? `; its look cut by ${plan.cut} characters to fit Tripo's ${PROMPT_MAX}` : ""}`);
  const rec = { status: "started", at: now(), tasks: [], credits: 0 };
  state[mk] = { ...(state[mk] ?? {}), make: rec };
  save(); // on disk before the first task that costs credits
  try {
    rec.ref_task = taskIdOf(cli(plan.args), plan.kind);
    rec.tasks.push(rec.ref_task); save();
    log(`  ${plan.kind} task ${rec.ref_task}`);
    const ref = cli(["task", "watch", rec.ref_task, "--timeout", String(MAKE.watchSeconds)], TRIPO_TIMEOUT_MS);
    if (ref.status !== "success") throw new Error(`${plan.kind} ${rec.ref_task} ended ${ref.status ?? "without a status"}`);
    rec.credits += creditsOf(ref, MAKE.cost[plan.kind]); save();
    const picture = ref.output?.generated_image_url ?? ref.output?.image_url;
    const input = CLI_TASK_ID.test(rec.ref_task) ? rec.ref_task : typeof picture === "string" && /^https:\/\/\S+$/.test(picture) ? picture : null;
    if (!input) throw new Error(`${plan.kind} ${rec.ref_task} has no picture to model from`);
    rec.model_task = taskIdOf(cli(modelArgs(input, key)), "image-to-model");
    rec.tasks.push(rec.model_task); save();
    log(`  image-to-model task ${rec.model_task}`);
    const dir = path.join(out, `${mk}-model`);
    fs.rmSync(dir, { recursive: true, force: true });
    const done = cli(["task", "watch", rec.model_task, "--download", "-o", dir, "--timeout", String(MAKE.watchSeconds)], TRIPO_TIMEOUT_MS);
    if (done.status !== "success") throw new Error(`image-to-model ${rec.model_task} ended ${done.status ?? "without a status"}`);
    rec.credits += creditsOf(done, MAKE.cost["image-to-model"]); save();
    // Where make-cat-models.py reads it: the raw GLB and its stamp (the job it came from), so it is never fetched again.
    fs.copyFileSync(modelFileOf(done, dir), path.join(cache, `${mk}.raw.glb`));
    fs.writeFileSync(path.join(cache, `${mk}.raw.job`), rec.model_task);
    const jobsPath = path.join(root, "scripts/cat-models.jobs.json");
    const jobs = readJson(jobsPath, {});
    recordModel(jobs, mk, { image_job: rec.ref_task, clean_job: rec.ref_task, model_job: rec.model_task, model: MAKE_MODEL_NAME, faces: MAKE.faces,
      url: modelUrlOf(done.output) ?? `tripo:task/${rec.model_task}`, pose: "standing on all fours", status: "done" });
    writeJson(jobsPath, jobs);
    Object.assign(rec, { status: "done", file: `${mk}.raw.glb`, at: now() });
    save();
    log(`  made: ${rec.credits} credits, scripts/.cat-models-cache/${mk}.raw.glb`);
    return { made: true, credits: rec.credits };
  } catch (e) {
    // Tripo refused the first task for want of credits (the price or the frozen credits differ from the balance
    // read): nothing was created, so nothing was spent. As the reserve: the record as it was, and a stop.
    if (e.exitCode === 4 && !rec.tasks.length) {
      if (prior === undefined) delete state[mk]; else state[mk] = prior;
      save();
      log(`${key}: stop: Tripo refused the task for want of credits (balance ${balance}); nothing was spent`);
      return { stopped: true };
    }
    return fail(rec, e);
  }
}

async function plain(key) {
  const src = path.join(ROOT, "assets/models/cats", `${key}.glb`), dst = path.join(OUT, `${key}.plain.glb`);
  if (!fs.existsSync(src)) throw new Error(`${key}: no ${src}`);
  let gt;
  try {
    gt = { core: await import("@gltf-transform/core"), ext: await import("@gltf-transform/extensions"), fn: await import("@gltf-transform/functions") };
  } catch { throw new Error("plain needs @gltf-transform: npm ci --ignore-scripts --prefix tools/tripo-rig && ln -s tools/tripo-rig/node_modules node_modules"); }
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
  if (cmd === "status") { for (const [k, v] of Object.entries(state)) console.log(k, v.make ? `make=${v.make.status} ${v.make.model_task ?? ""}` : "", v.status ?? "", v.check ? `riggable=${v.check.riggable} ${v.check.rig_type}` : "", v.rig_task || "", v.credits ?? ""); return; }
  if (cmd === "inspect") { console.log(JSON.stringify(inspect(glbJson(fs.readFileSync(keys[0]))), null, 1)); return; }
  if (cmd === "plain") { for (const k of keys) console.log(k, "->", path.relative(ROOT, await plain(k))); return; }
  if (cmd === "make") {
    const reserve = Number(flag("--reserve", 0));
    for (const key of keys) if (makeModel(key, { reserve }).stopped) break;
    return;
  }
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
        // The step's own result carries no `output`: the verdict is in the task's detail.
        let detail = null;
        try { detail = tripo(["task", "get", check.task_id]); } catch { /* the verdict stays unknown: the rig runs */ }
        s.check = checkVerdict(check, detail);
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
