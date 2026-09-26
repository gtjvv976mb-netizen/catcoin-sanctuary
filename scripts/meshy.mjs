#!/usr/bin/env node
/**
 * FIX CAT MODELS WITH MESHY (api.meshy.ai), from the queue in scripts/meshy.queue.json.
 *
 * The lore audit (data/research/exact-looks.json) found most cats' 3D models off their real cat:
 * wrong fur colours or markings (fixed by a RETEXTURE: Meshy repaints the model's own geometry,
 * 10 credits) or a wrong shape or style (fixed by a REBUILD: image-to-image makes four-legged
 * reference views from the cat's best reference picture, then multi-image-to-3D builds a new
 * textured model, about 36 credits). Owner rules: every cat exactly like its lore; every resident
 * stands on four legs.
 *
 *   node scripts/meshy.mjs balance
 *   node scripts/meshy.mjs run [KEY ...] [--limit N] [--priority P] [--only retexture|rebuild]
 *                              [--image] [--reserve CREDITS] [--dry]
 *   node scripts/meshy.mjs status
 *
 * run takes queued cats in priority order (1 first), skipping ones already done in
 * scripts/meshy.state.json, and stops before the balance would drop under --reserve (default 100).
 * A retexture styles from the queue's retexturePrompt; --image styles from the queue's reference
 * picture instead. Each finished model is recorded in scripts/cat-models.jobs.json (new model_job
 * and url; the old entry kept under "previous"), so then:
 *
 *   python3 scripts/make-cat-models.py --gltfpack node_modules/.bin/gltfpack KEY ...
 *   node scripts/capture-ingame.mjs KEY ...
 *
 * packs the new model into assets/models/cats/ and shoots its in-game picture to check by eye.
 * Meshy's result URLs expire, so pack a batch soon after it finishes. Needs MESHY_API_KEY.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.meshy.ai/openapi/v1";
const FILES = {
  queue: path.join(ROOT, "scripts/meshy.queue.json"),
  state: path.join(ROOT, "scripts/meshy.state.json"),
  jobs: path.join(ROOT, "scripts/cat-models.jobs.json"),
};
const REFS = path.join(ROOT, "scripts/.cat-models-cache/meshy");
export const COST = { retexture: 10, rebuild: 36 };
export const STANDING = "Shown alone, full body, standing naturally on all four legs like a real cat: a real quadruped stance with a horizontal back, all four paws flat on the ground, legs clearly separated, head up, tail out behind. Never upright or human-like. Seen from the side at a slight 3/4 angle with the head to the right. Plain flat light grey background, no props, no ground, no text.";

const readJson = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : fallback);
const writeJson = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 1)}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The queue in the order run takes it: priority 1 first, then retextures before rebuilds, then key. */
export function ordered(queue, { keys = [], priority = null, only = null, state = {} } = {}) {
  return Object.entries(queue.cats ?? {})
    .map(([key, q]) => ({ key, ...q }))
    .filter((q) => q.action === "retexture" || q.action === "rebuild")
    .filter((q) => !keys.length || keys.includes(q.key))
    .filter((q) => priority === null || q.priority <= priority)
    .filter((q) => !only || q.action === only)
    .filter((q) => state[q.key]?.status !== "done")
    .sort((a, b) => a.priority - b.priority || (a.action === b.action ? 0 : a.action === "retexture" ? -1 : 1) || a.key.localeCompare(b.key));
}

/** A reference picture as Meshy takes it: an https URL as is; a repo JPG/PNG as a data URI; a
 *  repo WebP converted to PNG (python3 + Pillow); anything else null. */
export function imageRef(ref, root = ROOT) {
  if (!ref || ref === "generate") return null;
  if (/^https:\/\//.test(ref)) return ref;
  const file = path.join(root, ref);
  if (!fs.existsSync(file)) return null;
  const ext = path.extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return `data:image/jpeg;base64,${fs.readFileSync(file).toString("base64")}`;
  if (ext === ".png") return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
  if (ext === ".webp") {
    const png = execFileSync("python3", ["-c", "import sys,io;from PIL import Image;b=io.BytesIO();Image.open(sys.argv[1]).convert('RGBA').save(b,'PNG');sys.stdout.buffer.write(b.getvalue())", file]);
    return `data:image/png;base64,${png.toString("base64")}`;
  }
  return null;
}

/** The request bodies for one queued cat (pure, so tests can check them without the network). */
export function retextureBody(q, job, { useImage = false, root = ROOT } = {}) {
  const model_url = job?.url || `https://catcoinsanctuary.com/assets/models/cats/${q.key}.glb`;
  const img = useImage ? imageRef(q.styleImage, root) : null;
  const style = img ? { image_style_url: img } : { text_style_prompt: String(q.retexturePrompt || "").slice(0, 800) };
  if (!img && !style.text_style_prompt) throw new Error(`${q.key}: no retexturePrompt and no usable style image`);
  return { model_url, ...style, ai_model: "meshy-6", enable_original_uv: true, texture_resolution: "2k", target_formats: ["glb"] };
}

export function referenceBody(q, { root = ROOT } = {}) {
  const img = imageRef(q.styleImage, root);
  const prompt = `${String(q.referencePrompt || q.retexturePrompt || "").trim()} ${STANDING}`.trim();
  return img
    ? { kind: "image-to-image", body: { ai_model: "nano-banana-2", prompt, reference_image_urls: [img], generate_multi_view: true, aspect_ratio: "1:1" } }
    : { kind: "text-to-image", body: { ai_model: "nano-banana-2", prompt, generate_multi_view: true, aspect_ratio: "1:1" } };
}

export function modelBody(imageUrls) {
  return { image_urls: imageUrls.slice(0, 4), ai_model: "meshy-7.1", should_texture: true, texture_image_url: imageUrls[0], should_remesh: true, target_polycount: 30000, target_formats: ["glb"] };
}

async function api(method, route, body) {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new Error("MESHY_API_KEY is not set");
  const r = await fetch(`${API}/${route}`, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${route}: ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

async function task(kind, body, log) {
  const { result: id } = await api("POST", kind, body);
  log(`  ${kind} task ${id}`);
  const t0 = Date.now();
  for (;;) {
    await sleep(10_000);
    const t = await api("GET", `${kind}/${id}`);
    if (t.status === "SUCCEEDED") return t;
    if (t.status === "FAILED" || t.status === "CANCELED") throw new Error(`${kind} ${id} ${t.status}: ${JSON.stringify(t.task_error ?? t).slice(0, 300)}`);
    if (Date.now() - t0 > 30 * 60_000) throw new Error(`${kind} ${id} still ${t.status} after 30 minutes`);
  }
}

async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${url.slice(0, 80)}: ${r.status}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

/** Record a finished model where make-cat-models.py reads it, keeping the old entry. */
export function recordModel(jobs, key, entry) {
  const { previous, ...old } = jobs[key] ?? {};
  jobs[key] = { ...entry, previous: Object.keys(old).length ? old : previous ?? null };
  return jobs;
}

async function fix(q, { useImage, log }) {
  const jobs = readJson(FILES.jobs, {});
  const job = jobs[q.key];
  if (q.action === "retexture") {
    const t = await task("retexture", retextureBody(q, job, { useImage }), log);
    const keep = Object.fromEntries(Object.entries(job ?? {}).filter(([k]) => ["hd", "si", "si_lo", "sa", "sa_lo", "tex", "tex_lo", "q", "yaw", "pose", "image_job", "clean_job"].includes(k)));
    recordModel(jobs, q.key, { ...keep, image_job: job?.image_job ?? "-", model_job: t.id, model: `meshy retexture (${job?.model ?? "site model"})`, url: t.model_urls.glb, status: "done" });
    writeJson(FILES.jobs, jobs);
    return { tasks: [t.id], credits: t.consumed_credits ?? COST.retexture };
  }
  const ref = referenceBody(q);
  const views = await task(ref.kind, ref.body, log);
  const urls = views.image_urls ?? [];
  if (!urls.length) throw new Error(`${ref.kind} ${views.id} returned no images`);
  for (const [i, u] of urls.entries()) await download(u, path.join(REFS, `${q.key}-ref-${i}.png`));
  const m = await task("multi-image-to-3d", modelBody(urls), log);
  recordModel(jobs, q.key, { image_job: views.id, clean_job: views.id, model_job: m.id, model: "meshy-7.1 multi-image-to-3d", faces: 30000, url: m.model_urls.glb, pose: "standing on all fours", status: "done" });
  writeJson(FILES.jobs, jobs);
  return { tasks: [views.id, m.id], credits: (views.consumed_credits ?? 6) + (m.consumed_credits ?? 30) };
}

async function main(argv) {
  const [cmd = "status", ...rest] = argv;
  const flag = (n, d = null) => { const i = rest.indexOf(n); return i < 0 ? d : rest[i + 1]; };
  const log = (s) => console.log(s);
  if (cmd === "balance") { console.log(await api("GET", "balance")); return; }
  const queue = readJson(FILES.queue, { cats: {} });
  const state = readJson(FILES.state, {});
  if (cmd === "status") {
    const all = Object.values(queue.cats);
    const done = Object.values(state).filter((s) => s.status === "done").length;
    console.log(`queue: ${all.filter((q) => q.action === "retexture").length} retexture, ${all.filter((q) => q.action === "rebuild").length} rebuild, ${all.filter((q) => q.action === "ok").length} ok; done ${done}; failed ${Object.values(state).filter((s) => s.status === "failed").length}`);
    return;
  }
  if (cmd !== "run") throw new Error(`unknown command ${cmd}`);
  const keys = rest.filter((a, i) => !a.startsWith("--") && !rest[i - 1]?.startsWith("--"));
  const todo = ordered(queue, { keys, priority: flag("--priority") ? Number(flag("--priority")) : null, only: flag("--only"), state }).slice(0, Number(flag("--limit", 1e9)));
  const reserve = Number(flag("--reserve", 100));
  console.log(`${todo.length} cats to fix (${todo.map((q) => `${q.key}:${q.action}`).join(" ")})`);
  if (rest.includes("--dry")) { for (const q of todo) console.log(q.key, JSON.stringify(q.action === "retexture" ? retextureBody(q, readJson(FILES.jobs, {})[q.key], { useImage: rest.includes("--image") }) : referenceBody(q)).slice(0, 300)); return; }
  for (const q of todo) {
    const { balance } = await api("GET", "balance");
    if (balance - COST[q.action] < reserve) { console.log(`stop: balance ${balance}, ${q.key} needs ${COST[q.action]}, reserve ${reserve}`); break; }
    console.log(`${q.key}: ${q.action} (priority ${q.priority}; balance ${balance})`);
    try {
      const r = await fix(q, { useImage: rest.includes("--image"), log });
      state[q.key] = { status: "done", action: q.action, tasks: r.tasks, credits: r.credits, at: new Date().toISOString() };
    } catch (e) {
      console.log(`  failed: ${e.message}`);
      state[q.key] = { status: "failed", action: q.action, error: e.message.slice(0, 400), at: new Date().toISOString() };
    }
    writeJson(FILES.state, state);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
