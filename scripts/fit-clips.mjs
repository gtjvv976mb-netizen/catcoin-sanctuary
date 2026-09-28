/* How far each cat's own model lets a mannerism go: assets/models/cats/fit.json.

   The clips (assets/world/catrig.js makeClips) pose every cat by the same targets, and most models take
   them; some can't. A round cat's forepaw dragged to its mouth pulls its chest after it, a low-poly
   forearm folded double tears at the elbow, a maned lion curled up to sleep smears its mane, a chibi's
   head bowed to its leg pulls its nape into a hood. So each of makeClips' FIT_KNOBS (groom, legLick,
   earScratch, beckon, hindStand, scratch, flop, roll, sleep, stretch, leap, stalk, dab) is tried here on the
   model's own far copy, skinned as the page skins it, at full and then at 0.8, 0.62, 0.45 and 0.3 of the move,
   and the first that keeps the skin whole is written down. The measures and their limits are the herd
   test's (tests/catrig-herd.test.mjs, scripts/lib/skingauge.mjs), with a margin: no sheet of skin
   stretched past 2.5x larger than 600 (1e-4 units^2), no edge drawn out by more than 0.18, the head
   squeezed by no more than 0.27, no more than 4.5% of the skin under the ground, at nine moments of each
   clip the knob governs. A knob that fails even at 0.3 is reported: that cat's model can't show the
   action, and traits.js MODEL_LIMITS should say so (the sims then never give it).

   The page reads fit.json with each cat's far copy (world.js) and passes the cat's row to makeClips; the
   herd test and the survey do the same, so what is measured is what is shown. Re-run after changing
   catrig.js or repacking a model:

     node scripts/fit-clips.mjs [--only KEY,KEY] [--workers 3] [--dry]      (about a minute, 3 workers) */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { register } from "node:module";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/models/cats/fit.json");
/** The limits, with a margin under the herd test's (sheet 700, spike 0.2, crush 0.3, under 0.05). */
export const FIT_TH = { sheet: 600, spike: 0.18, crush: 0.27, under: 0.045 };
/** How much of a move is tried, in turn. */
export const LEVELS = [1, 0.8, 0.62, 0.45, 0.3];
/** Where along a clip the skin is gauged (loops; once-through moves and posture changes). */
const U_LOOP = [0.05, 0.1, 0.2, 0.35, 0.5, 0.6, 0.75, 0.85, 0.95], U_ONCE = [0.15, 0.3, 0.5, 0.7, 0.85, 1];

if (isMainThread) {
  const argv = process.argv.slice(2), opt = (k) => { const i = argv.indexOf(`--${k}`); return i < 0 ? null : argv[i + 1] ?? true; };
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/cats/index.json"), "utf8")).cats;
  const only = opt("only") ? String(opt("only")).split(",") : null;
  const keys = Object.keys(index).filter((k) => !only || only.includes(k));
  const W = Math.max(1, Math.min(keys.length, Number(opt("workers")) || Math.max(1, (os.availableParallelism?.() || 2) - 1)));
  const t0 = Date.now();
  const results = (await Promise.all(Array.from({ length: W }, (_, w) => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { keys: keys.filter((_, i) => i % W === w) } });
    worker.once("message", resolve);
    worker.once("error", reject);
  })))).flat().sort((a, b) => (a.key < b.key ? -1 : 1));
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")).cats || {} : {};
  const cats = only ? { ...prev } : {};
  let turned = 0, weak = 0;
  for (const r of results) {
    if (r.error) { console.error(`${r.key}: ${r.error}`); continue; }
    const row = Object.fromEntries(Object.entries(r.fit).filter(([, v]) => v < 1));
    if (Object.keys(row).length) { cats[r.key] = row; turned++; } else delete cats[r.key];
    const parts = Object.entries(row).map(([k, v]) => `${k} ${v}${r.weak[k] ? ` (still ${r.weak[k]})` : ""}`);
    if (Object.keys(r.weak).length) weak++;
    if (parts.length) console.log(`${r.key}: ${parts.join(", ")}`);
  }
  const sorted = Object.fromEntries(Object.keys(cats).sort().map((k) => [k, cats[k]]));
  const text = JSON.stringify({ v: 1, note: "How far each model's own skin lets a mannerism go (0..1 of the full move; a knob left out is 1). Measured by scripts/fit-clips.mjs on the far copy; do not edit by hand.", cats: sorted }, null, 0).replace(/"cats":\{/, '\n"cats":{\n').replace(/\},"/g, '},\n"').replace(/\}\}$/, "}\n}") + "\n";
  if (opt("dry")) console.log(text); else fs.writeFileSync(OUT, text);
  console.log(`${results.length} models in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${turned} turned down somewhere, ${weak} with a move their skin can't take even at ${LEVELS[LEVELS.length - 1]} (see MODEL_LIMITS)${opt("dry") ? " (dry run)" : ` -> ${path.relative(ROOT, OUT)}`}`);
} else {
  const THREE_URL = pathToFileURL(path.join(ROOT, "assets/vendor/three/three.module.min.js")).href, ADDONS = pathToFileURL(path.join(ROOT, "assets/vendor/three/addons/")).href;
  register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, next) {
  if (s === "three") return { url: ${JSON.stringify(THREE_URL)}, shortCircuit: true };
  if (s.startsWith("three/addons/")) return { url: ${JSON.stringify(ADDONS)} + s.slice(13), shortCircuit: true };
  return next(s, c);
}`));
  const THREE = await import(THREE_URL);
  const R = await import(pathToFileURL(path.join(ROOT, "assets/world/catrig.js")).href);
  const T = await import(pathToFileURL(path.join(ROOT, "assets/world/traits.js")).href);
  const { readGlbMesh, skinGauge, skinMatrices } = await import(pathToFileURL(path.join(ROOT, "scripts/lib/skingauge.mjs")).href);
  const TABLE = JSON.parse(fs.readFileSync(path.join(ROOT, "data/traits.json"), "utf8")).cats;
  const LEGS = new Set((() => { try { const j = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/cats/legs-index.json"), "utf8")); return j.v === 1 ? j.cats : []; } catch { return []; } })());
  const legsOf = (key) => { if (!LEGS.has(key)) return null; const j = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/cats", `${key}.legs.json`), "utf8")); return j.v === 1 && j.far ? R.decodeLegs(j.far, j.nlo) : null; };
  const out = [];
  for (const key of workerData.keys) {
    try { out.push(fitCat(key)); } catch (e) { out.push({ key, error: String(e && e.stack || e).split("\n").slice(0, 3).join(" | ") }); }
  }
  parentPort.postMessage(out);

  function fitCat(key) {
    const lo = readGlbMesh(path.join(ROOT, "assets/models/cats", `${key}-lo.glb`), THREE, fs);
    const rig = R.findRig(lo.pos, lo.index), sk = R.buildSkeleton(rig), w = R.skinWeights(lo.pos, rig, sk, lo.index, legsOf(key));
    const traits = T.traitsOf({ id: key }, TABLE), style = T.styleOf(traits), avoid = new Set(traits.avoid || []);
    const gauge = skinGauge(lo.pos, lo.index, w, rig, THREE);
    const bones = sk.skeleton.bones, SM = new Float64Array(bones.length * 16);
    const rest = bones.map((b) => [b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
    const reset = () => bones.forEach((b, i) => { b.position.copy(rest[i][0]); b.quaternion.copy(rest[i][1]); b.scale.copy(rest[i][2]); });
    const mixer = new THREE.AnimationMixer(sk.root);
    // The worst the knob's clips do at this fit: the first measure over its limit, as "clip u measure value".
    const worstOf = (clips, knob) => {
      for (const name of R.FIT_KNOBS[knob]) {
        const clip = clips[name];
        if (!clip || avoid.has(name)) continue;
        const loop = clip.userData?.loop !== false;
        for (const u of loop ? U_LOOP : U_ONCE) {
          mixer.stopAllAction(); reset();
          const a = mixer.clipAction(clip); a.play(); a.time = Math.min(u, 0.9999) * clip.duration; mixer.update(0);
          const g = gauge(skinMatrices(sk, SM, THREE));
          for (const m of ["sheet", "spike", "crush", "under"]) if (g[m] > FIT_TH[m]) return `${name} u${u} ${m} ${+g[m].toFixed(3)}`;
        }
      }
      return null;
    };
    const fit = {}, weak = {};
    let pending = Object.keys(R.FIT_KNOBS).filter((k) => R.FIT_KNOBS[k].some((c) => !avoid.has(c)));
    for (let level = 0; level < LEVELS.length && pending.length; level++) {
      const clips = R.makeClips(rig, style || {}, fit);
      const failing = [];
      for (const k of pending) { const bad = worstOf(clips, k); if (bad) failing.push([k, bad]); }
      pending = [];
      for (const [k, bad] of failing) {
        if (level + 1 < LEVELS.length) { fit[k] = LEVELS[level + 1]; pending.push(k); }
        else weak[k] = bad;
      }
      mixer.stopAllAction();
    }
    mixer.uncacheRoot(sk.root);
    return { key, fit, weak };
  }
}
