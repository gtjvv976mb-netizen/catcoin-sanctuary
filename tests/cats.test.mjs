/* The cats move like cats. Runs the garden (assets/world/cats.js, 247 cats) and the Hall of Fame
   (assets/world/meadow.js) as a 60 fps page would, for two minutes, and watches every cat's
   cat.motion tick by tick:
   - what it shows changes rarely (a cat is not a flickering thing): at most 8 changes a minute;
   - no action is seen for less than a quarter of a second, except one-offs and posture changes
     (which last their own length);
   - no posture change skips catmotion's transitions (no sitting cat pops up to walking);
   - a cat in a mannerism far from its posture's own pose (a paw at its face, over on its side, up
     on its hind legs) settles back into that pose before it changes posture, moves off or yawns;
   - onto its back (roll) only from lying on its side (flop) held a moment, and off its back only
     onto its side again; onto its side only from a loaf (never straight out of lying down);
   - gaits change at most once in half a second;
   - nothing sits, lies or sleeps while it is moving, and no body turns while it sits, lies or
     changes posture (a turn on the spot ends before the sitting down that follows starts);
   - no creeping: a gait is never shown while the cat moves slower than a real step (0.15 units/s
     over the ground, not turning on the spot) for longer than a gait's shortest showing;
   - no cat walks into another's body (bodies as big as the cats are drawn), and no two cats are in
     each other (more than 0.12 into both bodies side by side) for half a second or more, however
     it came about: one waking, getting up or stretching out into another, one landing, settling or
     turning into another, a visitor staying in its friend (the verifier's "cats inside cats");
   - a pounce never carries a cat into another's body nor lands it on one (one trotting up, one crossing), nobody walks
     into a cat mid-pounce, and a cat running from its chaser runs away and turns wide, never rings round it;
   - no cat's body goes into a thin tall post (a rose arch's, a lantern's), nose and all, and a big cat by the pond but
     not there to drink or watch it keeps its whole body out of the water;
   - character shows: a sleepy cat sleeps far more than a lively one, a lazy cat never runs, a
     gentle (memorial) cat never rolls about or races.
   The two big garden runs go in worker threads (this file again, below), side by side. Scenes of
   two or three cats check the bodies directly: a walker never goes through a sitting cat, big or
   small, and a big cat's body is as big as it is drawn.
   Big cats (a lion 2.56x, a tiger 2.3x: traits.js SPECIES): a third run, the real garden with its
   real residents, watches them: their whole bodies clear of the props, none of the house cats'
   places used, company kept only with cats of a size, never stuck for long; and scenes check that
   a lion walks, turns and sits down as a big animal does (catmotion gaitScale) and goes round a
   house cat sitting in its way.
   Every cat, with the birds and butterflies about: its leaps land on dry, clear ground (never in the
   pond or a prop, the verifier's house cats sitting 40 s in the water), none stays in the water or a
   solid prop, and a hop up a cat tree goes neither through its foot nor its platform; scenes check a
   hunt across a corner of the pond, cats found in the pond, the cottage or a vegetable bed walking
   out, and cats of every size hopping up a cat tree. */

import { isMainThread, parentPort, workerData, Worker } from "node:worker_threads";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createSanctuary, POSES, UNWIND, BODY, BIG_SIZE, LONG, HALF_LEN, bodyGap, sizeOf, alike } from "../assets/world/cats.js";
import { createMeadow } from "../assets/world/meadow.js";
import { ACTIONS, GAIT_BANDS, MIN_SHOW, TRANS_DUR, gaitFor, gaitScale, legStep, newLegs } from "../assets/world/catmotion.js";
import { distToObstacle, yawTo } from "../assets/world/nav.js";
import * as L from "../assets/world/layout.js";

const DT = 1 / 60;
const SECONDS = 120;
const base = (p) => (p === "move" || p === "air" ? "stand" : p);
const RESTING = new Set(["sit", "lie", "sleep"]);

/** Cats meant to be touching: a cheek rub with a friend visited, a nap pile (not a chase's pair: they never sit down in each other). */
const together = (a, b) => (a.act && (a.act.nuzzle === b || a.act.kind === "pile")) || (b.act && (b.act.nuzzle === a || b.act.kind === "pile"));
/** The longest a gait may be seen while the cat creeps: a cat stopped dead (held by another's body, or
    waiting with nowhere to go) is shown moving at most a real step's worth (0.25 s, publishMotion) and a
    few frames, never a gait's whole shortest showing frozen mid-stride. */
const CREEP_MAX = 0.32;

/** Watches cats' motion tick by tick; returns plain numbers and the first few examples of anything wrong.
    With `bodies`, it also watches the cats' bodies (drawn size) against each other. */
function watcher(cats, { bodies = false } = {}) {
  const S = cats.map((c) => ({ action: c.motion.action, since: -Infinity, gait: c.motion.gait, gaitAt: -Infinity, odo: c.motion.odometer, x: c.x, z: c.z, yaw: c.yaw, sleep: 0, fast: 0, creep: 0 }));
  const out = { cats: cats.length, changes: 0, changesNoTrans: 0, short: 0, skips: 0, unsettled: 0, fastGaits: 0, restMoving: 0, invalid: 0, jumps: 0, rollSkips: 0, creeps: 0, creepMax: 0, spins: 0, walkInto: 0, longOverlaps: 0, spells: 0, spellMax: 0, spellExamples: [], examples: [] };
  const note = (kind, c, what) => { if (out.examples.length < 12) out.examples.push(`${kind} ${c.id}: ${what}`); };
  const overlap = new Map(), spell = new Map();
  function tick(now, dt) {
    for (let i = 0; i < cats.length; i++) {
      const c = cats[i], m = c.motion, s = S[i], A = ACTIONS[m.action];
      // A motion the view can play: a known action, its own posture, progress only where it means something.
      const uOk = A && (A.kind === "once" || A.kind === "trans" ? m.u >= 0 && m.u <= 1 : m.u == null);
      if (!A || m.posture !== A.posture || !uOk || !(m.odometer >= s.odo) || !POSES.includes(c.pose)) { out.invalid++; note("invalid", c, `${m.action} ${m.posture} u=${m.u} pose=${c.pose}`); }
      if (Math.hypot(c.x - s.x, c.z - s.z) > 0.12) { out.jumps++; note("jump", c, `${Math.hypot(c.x - s.x, c.z - s.z).toFixed(2)} in one tick`); }
      // Creeping: a gait shown while it covers less than a real step's worth of ground and is not
      // turning on the spot (where the view steps the pivot clip).
      const sp = Math.hypot(c.x - s.x, c.z - s.z) / dt, yr = Math.abs(Math.atan2(Math.sin(c.yaw - s.yaw), Math.cos(c.yaw - s.yaw))) / dt;
      if (!c.hidden && A && A.kind === "gait" && sp < 0.15 && yr < 0.4) s.creep += dt;
      else {
        if (s.creep > 0.2) { out.creepMax = Math.max(out.creepMax, s.creep); if (s.creep > CREEP_MAX) { out.creeps++; note("creeping", c, `${m.action === s.action ? "" : s.action + " "}shown at under 0.15 units/s for ${s.creep.toFixed(2)} s`); } }
        s.creep = 0;
      }
      // Spinning: a body turning while it sits, lies or changes posture (a turn's last tick must not
      // share a tick with the sitting down that follows it).
      if (!c.hidden && A && (RESTING.has(m.posture) || A.kind === "trans") && yr > 0.5) { out.spins++; note("turning while down", c, `${m.action} at ${yr.toFixed(1)} rad/s`); }
      s.x = c.x; s.z = c.z; s.yaw = c.yaw;
      if (m.odometer - s.odo > 1e-6 && RESTING.has(m.posture)) { out.restMoving++; note("resting while moving", c, m.action); }
      s.odo = m.odometer;
      if (m.posture === "sleep") s.sleep += dt;
      if (m.gait === "run" || m.gait === "trot") s.fast += dt;
      if (m.gait !== s.gait) {
        if (m.gait && s.gait) { if (now - s.gaitAt < 0.5 - 1e-9) { out.fastGaits++; note("gait flicker", c, `${s.gait}>${m.gait} after ${(now - s.gaitAt).toFixed(2)} s`); } s.gaitAt = now; }
        else if (m.gait) s.gaitAt = now;
        s.gait = m.gait;
      }
      if (m.action === s.action) continue;
      out.changes++;
      if (A.kind !== "trans") out.changesNoTrans++;
      const P = ACTIONS[s.action];
      if (now - s.since < 0.25 - 1e-9 && P.kind !== "once" && P.kind !== "trans") { out.short++; note("short", c, `${s.action} for ${Math.round((now - s.since) / dt)} ticks, then ${m.action}`); }
      if (base(P.posture) !== base(A.posture) && !(A.kind === "trans" && A.from === base(P.posture))) { out.skips++; note("posture skip", c, `${s.action} > ${m.action}`); }
      if (P.kind === "loop" && UNWIND[s.action] && A.kind !== "loop") { out.unsettled++; note("straight out of a mannerism", c, `${s.action} > ${m.action}`); }
      // Onto its back only from its side, held a moment; off its back only onto its side; onto its side only from a loaf.
      if ((m.action === "roll" && (s.action !== "flop" || now - s.since < MIN_SHOW.lie - 1e-9)) || (s.action === "roll" && m.action !== "flop") || (m.action === "flop" && s.action !== "loaf" && s.action !== "roll")) { out.rollSkips++; note("rolled over without its lead-in", c, `${s.action} (${(now - s.since).toFixed(2)} s) > ${m.action}`); }
      s.action = m.action; s.since = now;
    }
    if (bodies) watchBodies(now, dt);
  }
  /** Bodies (capsules as big as the cats are drawn): a cat on the move never deep in a resting cat's
      body, and no two cats in each other (more than touching) for a second or more. */
  function watchBodies(now, dt) {
    for (let i = 0; i < cats.length; i++) {
      const a = cats[i];
      if (a.y > 0.3 || a.perch || a.hidden) continue;
      for (let j = i + 1; j < cats.length; j++) {
        const b = cats[j];
        if (Math.abs(a.x - b.x) > 2.2 || Math.abs(a.z - b.z) > 2.2 || b.y > 0.3 || b.perch || b.hidden || together(a, b)) continue;
        const pen = -bodyGap(a, a.x, a.z, a.yaw, a.pose, b), key = i * 4096 + j;
        if (pen <= 0.12) { overlap.delete(key); endSpell(key, now, dt); continue; }
        // (a spell: the two in each other without a break, as the verifier times them)
        const sp = spell.get(key) || { t0: now, max: 0, what: `${a.id} and ${b.id} (${a.motion.action}/${b.motion.action})` };
        sp.t1 = now; sp.max = Math.max(sp.max, pen); spell.set(key, sp);
        const am = ACTIONS[a.motion.action].kind === "gait", bm = ACTIONS[b.motion.action].kind === "gait";
        const rest = (c) => ["sit", "lie", "sleep"].includes(c.motion.posture);
        if (pen > 0.2 && ((am && rest(b)) || (bm && rest(a)))) { out.walkInto += dt; if (out.walkInto <= dt * 1.01) note("walked into", am ? a : b, `${(am ? b : a).id} (${(am ? b : a).motion.action}) by ${pen.toFixed(2)}`); }
        const t0 = overlap.get(key) ?? now;
        overlap.set(key, t0);
        if (now - t0 >= 1 && now - t0 < 1 + dt * 0.99) { out.longOverlaps++; note("in each other", a, `and ${b.id} for a second (${a.motion.action}/${b.motion.action}, ${pen.toFixed(2)})`); }
      }
    }
    for (const [key, sp] of spell) if (sp.t1 < now) endSpell(key, now, dt);
  }
  /** A spell of two cats in each other ended: counted if it lasted half a second or more. */
  function endSpell(key, now, dt) {
    const sp = spell.get(key);
    if (!sp) return;
    spell.delete(key);
    const len = sp.t1 - sp.t0 + dt;
    if (len < 0.5 - 1e-9) return;
    out.spells++; out.spellMax = Math.max(out.spellMax, len);
    if (out.spellExamples.length < 8) out.spellExamples.push(`${sp.what} for ${len.toFixed(2)} s from ${sp.t0.toFixed(1)} s, up to ${sp.max.toFixed(2)} into each other`);
  }
  /** Ends every spell still going (at the end of a run). */
  function flush(now, dt) { for (const key of [...spell.keys()]) { const sp = spell.get(key); sp.t1 = now; endSpell(key, now + dt, dt); } }
  return { S, out, tick, flush };
}

/** Synthetic characters for the garden run with traits: sleepy, lively, gentle, and real ones from data/traits.json. */
const SLEEPY = { energy: 0.15, sleepy: 0.9, playful: 0.3 };
const LIVELY = { energy: 0.9, sleepy: 0.1, playful: 0.85, curious: 0.8 };
const GENTLE = { flags: ["memorial", "gentle"] };
const group = (i) => (i % 5 === 0 ? "sleepy" : i % 5 === 1 ? "lively" : i % 5 === 2 ? "gentle" : "real");

async function gardenRun({ traits, seconds }) {
  let rows = [], styleOf = null;
  if (traits) {
    try { rows = Object.values(JSON.parse(readFileSync(new URL("../data/traits.json", import.meta.url), "utf8")).cats || {}); } catch { rows = []; }
    try { ({ styleOf } = await import("../assets/world/traits.js")); } catch { styleOf = null; }
  }
  const residents = Array.from({ length: 247 }, (_, i) => {
    const r = { id: `CAT${i}`, name: `Cat ${i}`, model: i % 3 ? "cat" : "ginger" };
    if (traits) {
      const g = group(i);
      r.traits = g === "sleepy" ? SLEEPY : g === "lively" ? LIVELY : g === "gentle" ? GENTLE : rows.length ? rows[i % rows.length] : { energy: (i % 7) / 6, sleepy: ((i * 3) % 7) / 6 };
      try { if (styleOf) r.style = styleOf(r.traits); } catch { /* no style: an ordinary tempo */ }
    }
    return r;
  });
  const sim = createSanctuary({ residents, reduced: false, critters: null });
  sim.setViewer(0, 18);
  const w = watcher(sim.cats, { bodies: true });
  const seen = sim.cats.map(() => new Set());
  const t0 = performance.now();
  for (let f = 1; f <= Math.round(seconds / DT); f++) {
    sim.update(DT);
    w.tick(f * DT, DT);
    if (traits) sim.cats.forEach((c, i) => { if (group(i) === "gentle") seen[i].add(c.motion.action); });
  }
  w.flush(seconds, DT);
  const out = w.out;
  out.msPerTick = (performance.now() - t0) / Math.round(seconds / DT);
  out.minutes = seconds / 60;
  const sum = (g, f) => { let n = 0, v = 0; sim.cats.forEach((c, i) => { if (group(i) === g) { n++; v += f(c, w.S[i]); } }); return v / Math.max(1, n); };
  if (traits) {
    out.groups = {};
    for (const g of ["sleepy", "lively", "gentle", "real"]) out.groups[g] = { sleepShare: sum(g, (c, s) => s.sleep) / seconds, distance: sum(g, (c) => c.motion.odometer), fastSeconds: sum(g, (c, s) => s.fast) };
    out.gentleActions = [...new Set(seen.flatMap((s) => [...s]))];
    out.sleepyMaxFast = Math.max(...sim.cats.filter((c, i) => group(i) === "sleepy").map((c) => w.S[sim.cats.indexOf(c)].fast));
  }
  return out;
}

/** The real garden (its residents with their real traits and sizes, data/traits.json) for `seconds` at
    30 Hz, watching the big cats: how deep each one's body (its capsule, drawn size) gets into a prop,
    which places it holds, who it keeps company with, how long it stands waiting, what it does. */
async function bigRun({ seconds }) {
  const { styleOf } = await import("../assets/world/traits.js");
  const rows = JSON.parse(readFileSync(new URL("../data/traits.json", import.meta.url), "utf8")).cats;
  const residents = Object.entries(rows).map(([id, t]) => ({ id, name: id, traits: t, style: styleOf(t) }));
  const sim = createSanctuary({ residents, reduced: false, critters: null });
  sim.setViewer(0, 18);
  const obs = L.obstacles(), dt = 1 / 30, big = sim.cats.filter((c) => c.big);
  const S = new Map(big.map((c) => [c, { props: 0, propWhat: "", holds: new Set(), company: new Set(), waiting: 0, kinds: new Set(), walkV: [], gaits: new Set() }]));
  for (let f = 1; f <= seconds / dt; f++) {
    const at = new Map(big.map((c) => [c, [c.x, c.z]]));
    sim.update(dt);
    for (const c of big) {
      const s = S.get(c), k = c.act?.kind;
      s.kinds.add(k);
      for (const h of c.holds) s.holds.add(h);
      for (const o of [c.act?.mate, c.act?.lead, c.act?.nuzzle]) if (o) s.company.add(`${k}:${o.id}:${o.size}`);
      if (c.waitUntil > sim.time) s.waiting += dt;
      if (c.motion.gait) { s.gaits.add(c.motion.gait); if (c.motion.gait === "walk") s.walkV.push(Math.hypot(c.x - at.get(c)[0], c.z - at.get(c)[1]) / dt); }
      if (c.y > 0.3) continue;
      // (on the pond's bank, where it watches and drinks, its head may reach out over the water)
      const h = (HALF_LEN[c.pose] || 0.3) * c.size, r = BODY * c.size, fx = Math.cos(c.yaw) * h, fz = -Math.sin(c.yaw) * h;
      const bank = Math.hypot(c.x - L.POND.x, c.z - L.POND.z) < Math.hypot(sim.bigPlaces.pond[0].x - L.POND.x, sim.bigPlaces.pond[0].z - L.POND.z) + 0.5;
      for (const o of obs) {
        if (bank && o.id === L.POND.id) continue;
        let d = Infinity;
        for (let u = -1; u <= 1.0001; u += 0.25) d = Math.min(d, distToObstacle(o, c.x + fx * u, c.z + fz * u));
        if (r - d > s.props) { s.props = r - d; s.propWhat = `${o.id} (${c.motion.action}, ${k})`; }
      }
    }
  }
  // (its cruising speed: the 90th percentile of its walking, past the speeding up, slowing down and short steps)
  const p90 = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length * 0.9)] : 0; };
  return big.map((c) => { const s = S.get(c); return { id: c.id, size: c.size, fr: c.fr, props: s.props, propWhat: s.propWhat, holds: [...s.holds], company: [...s.company], waiting: s.waiting, kinds: [...s.kinds], walkV: p90(s.walkV), walked: s.walkV.length * (1 / 30), gaits: [...s.gaits] }; });
}

/** How deep a cat's body (its capsule, drawn size) is in the water or a solid prop, and which: [depth, id]. The water is
    the pond itself (not its rim), as the verifier measures it; watching or drinking at the pond (`pondOk`) it may be at
    it, and a long cat on its bank may reach its head 0.2 × its size out over it. Solid: every prop but a cat bed, a bowl
    or dish and a cat tree's foot (with `trees`, only the cat trees' feet). */
function solidDepth(c, obs, { pondOk = false, trees = false } = {}) {
  const h = (HALF_LEN[c.pose] || 0.3) * c.size, r = BODY * c.size, fx = Math.cos(c.yaw) * h, fz = -Math.sin(c.yaw) * h;
  const bank = c.size >= LONG && Math.hypot(c.x - L.POND.x, c.z - L.POND.z) < L.POND.r + 1.2 * c.size;
  let w = [0, "-"];
  for (const o0 of obs) {
    if (trees ? !/^tree-/.test(o0.id) : /^(bed|bowl|water|tree)-/.test(o0.id)) continue;
    let o = o0;
    if (o0.id === L.POND.id) { if (pondOk) continue; o = { id: "the water", type: "circle", x: L.POND.x, z: L.POND.z, r: L.POND.r - (bank ? 0.2 * c.size : 0) }; }
    if (o.type === "circle" ? Math.abs(o.x - c.x) > o.r + h + r || Math.abs(o.z - c.z) > o.r + h + r : c.x < o.minX - h - r || c.x > o.maxX + h + r || c.z < o.minZ - h - r || c.z > o.maxZ + h + r) continue;
    let d = Infinity;
    for (let u = -1; u <= 1.0001; u += 0.25) d = Math.min(d, distToObstacle(o, c.x + fx * u, c.z + fz * u));
    if (r - d > w[0]) w = [r - d, o.id];
  }
  return w;
}

/** How much further a cat's middle is in the water (the pond with its rim) or a solid prop than its walk keeps it (its
    bodyR off them): [depth, id]. */
function middleIn(c, obs, pondOk = false) {
  let w = [0, "-"];
  for (const o of obs) {
    if (/^(bed|bowl|water|tree)-/.test(o.id) || (pondOk && o.id === L.POND.id)) continue;
    const d = c.bodyR - distToObstacle(o, c.x, c.z);
    if (d > w[0]) w = [d, o.id === L.POND.id ? "the water" : o.id];
  }
  return w;
}

/** critters.js (the birds and butterflies) as the page loads it, its "three" imports pointed at the vendored copy,
    and its random stream seeded by `seed` (where and when the birds land and the butterflies go). */
async function loadCritters(seed) {
  const v = (p) => new URL(`../${p}`, import.meta.url).href, dir = mkdtempSync(join(tmpdir(), "critters-"));
  const THREE_URL = v("assets/vendor/three/three.module.min.js"), utils = join(dir, "utils.mjs"), file = join(dir, "critters.mjs");
  writeFileSync(utils, readFileSync(new URL("../assets/vendor/three/addons/utils/BufferGeometryUtils.js", import.meta.url), "utf8").replace(/from 'three'/, `from "${THREE_URL}"`));
  writeFileSync(file, readFileSync(new URL("../assets/world/critters.js", import.meta.url), "utf8")
    .replace('from "three";', `from "${THREE_URL}";`).replace('from "three/addons/utils/BufferGeometryUtils.js"', `from "${pathToFileURL(utils).href}"`)
    .replace('from "./layout.js"', `from "${v("assets/world/layout.js")}"`).replace('from "./rng.js"', `from "${v("assets/world/rng.js")}"`)
    .replace('makeRandom("critters")', `makeRandom("critters${seed}")`));
  // Loaded, the copies are not read again: removed (this runs in workers too, where no test hook would).
  try { return { THREE: await import(THREE_URL), ...(await import(pathToFileURL(file).href)) }; } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** The real garden with its birds and butterflies (critters.js, built as the page builds them; `seed` varies them)
    for `seconds` at 30 Hz, watching every cat tick by tick:
    - pops: moved further in a tick than its own step asked by more than 0.1 (out of a prop, off another cat), on the ground;
    - slides: ground covered in a tick beyond what the legs the view shows step (catmotion legStep, blended as catviews
      blends them) by more than 0.01: paws skating;
    and every long cat (drawn LONG × or more: the big cats, the bobcat, the Savannah):
    - its whole body (its capsule, drawn size) in a prop: deepest, and spells over 0.05 lasting a second (the bed it went
      to nap in, the bowls and dishes a house-sized one eats at, a hop up its cat tree aside; on the pond's bank its head may reach
      0.2 × its size out over the water);
    - pacing on its errands: 3 s windows in which it walked more than 1.2 √size yet ended less than a quarter of that
      from where it was (the verifier's measure; turning round before lying down aside). */
async function huntRun({ seconds, seed }) {
  const [{ styleOf }, C] = await Promise.all([import("../assets/world/traits.js"), loadCritters(seed)]);
  const rows = JSON.parse(readFileSync(new URL("../data/traits.json", import.meta.url), "utf8")).cats;
  const residents = Object.entries(rows).map(([id, t]) => ({ id, name: id, traits: t, style: styleOf(t) }));
  const fencePosts = [];
  for (let a = 0, step = 1.35 / L.GARDEN.fenceR; a < Math.PI * 2 - 1e-6; a += step) if (!L.inGate((a * 180) / Math.PI)) fencePosts.push({ x: Math.cos(a) * L.GARDEN.fenceR, y: 1.02, z: Math.sin(a) * L.GARDEN.fenceR });
  let sim = null;
  const critters = C.buildCritters(new C.THREE.Scene(), {
    mobile: false, fencePosts, flowerFields: L.FLOWER_FIELDS.map((f) => ({ x: f.x, z: f.z, r: Math.min(f.rx, f.rz), y: 0 })),
    lawnFree: (x, z) => !sim || sim.nav.pointFree(x, z, 0.35),
    catsNear: (x, z, r) => !!sim && sim.cats.some((c) => { const R = r * (c.size > 1 ? c.size : 1); return Math.abs(c.x - x) < R && Math.abs(c.z - z) < R && Math.hypot(c.x - x, c.z - z) < R; }),
  });
  sim = createSanctuary({ residents, reduced: false, critters });
  sim.setViewer(0, 18);
  const dt = 1 / 30, obs = L.obstacles(), cats = sim.cats, long = cats.filter((c) => c.size >= LONG);
  const S = new Map(cats.map((c) => [c, { x: c.x, z: c.z, v: c.speed, legs: newLegs() }]));
  const P = new Map(long.map((c) => [c, { deep: 0, deepWhat: "", spell: new Map(), hist: [] }]));
  const out = { cats: cats.length, long: long.length, hunts: 0, pops: 0, popMax: 0, slides: 0, slideMax: 0, deepest: 0, spells: 0, paces: 0, examples: [],
    leaps: 0, landWorst: 0, landWhat: "", wetOrIn: 0, wetOrInWhat: [], treeHop: 0, treeHopWhat: "" };
  const note = (what) => { if (out.examples.length < 12) out.examples.push(what); };
  const hunting = new Set(), wasAir = new Map(), stay = new Map();
  for (let f = 1; f <= seconds / dt; f++) {
    critters.update(dt, false);
    sim.update(dt);
    const t = f * dt;
    // Every cat, a kitten to a lion: where each leap lands (its whole body in the water or a solid prop), a cat sitting,
    // lying or standing still in one, and a hop up a cat tree through its foot.
    for (const c of cats) {
      const a = c.motion.action, air = a === "pounce" || a === "hop", landed = wasAir.get(c) && !air;
      wasAir.set(c, air);
      if (c.perch || c.hidden) { stay.delete(c); continue; }
      if (air && c.act?.kind === "climb" && c.y < 0.3) { const d = solidDepth(c, obs, { trees: true }); if (d[0] > out.treeHop) { out.treeHop = d[0]; out.treeHopWhat = `${c.id} (${c.size}x) ${d[0].toFixed(2)} into ${d[1]} at ${t.toFixed(1)} s`; } }
      if (c.y > 0.05 || air) continue;
      const d = solidDepth(c, obs, { pondOk: c.act && (c.act.kind === "drink" || c.act.kind === "pond") });
      if (landed) { out.leaps++; if (d[0] > out.landWorst) { out.landWorst = d[0]; out.landWhat = `${c.id} (${c.size}x) landed ${d[0].toFixed(2)} into ${d[1]} at ${t.toFixed(1)} s, "${c.doing}"`; } }
      // (in it a second or more: its middle further in than its walk keeps it (a nose against a bush aside), or sitting,
      // lying or loafing with its body in it)
      const m = middleIn(c, obs, c.act && (c.act.kind === "drink" || c.act.kind === "pond"));
      const deep = m[0] > 0.15 ? m : ["sit", "lie", "sleep"].includes(c.motion.posture) && d[0] > 0.25 ? d : null;
      const s = stay.get(c);
      if (deep) { if (!s) stay.set(c, { t0: t, max: deep[0], what: deep[1], doing: c.doing }); else s.max = Math.max(s.max, deep[0]); }
      else if (s) { stay.delete(c); if (t - s.t0 >= 1) { out.wetOrIn++; if (out.wetOrInWhat.length < 6) out.wetOrInWhat.push(`${c.id} (${c.size}x) ${s.max.toFixed(2)} into ${s.what} for ${(t - s.t0).toFixed(1)} s from ${s.t0.toFixed(1)} s, "${s.doing}"`); } }
    }
    for (const c of cats) {
      // (its own step: at its speed going into the tick or coming out of it, whichever is more)
      const s = S.get(c), m = c.motion, A = ACTIONS[m.action], mv = Math.hypot(c.x - s.x, c.z - s.z), v = Math.max(s.v, c.speed);
      s.x = c.x; s.z = c.z; s.v = c.speed;
      if (c.act && (c.act.kind === "butterfly" || c.act.kind === "bird")) hunting.add(c.id);
      const cap = legStep(s.legs, A.kind === "gait" ? m.action : null, dt) * gaitScale(c.size);
      if (c.y > 0.05 || c.perch) continue;
      if (A.kind !== "gait" && A.posture === "air") continue;
      const pop = mv - Math.max(0, v) * dt;
      if (pop > 0.1) { out.pops++; out.popMax = Math.max(out.popMax, pop); note(`pop ${c.id} (${c.size}x) ${mv.toFixed(2)} in a tick at ${t.toFixed(2)} s, ${m.action}, "${c.doing}"`); }
      if (cap > 0 && mv - cap * dt > 0.01) { out.slides++; out.slideMax = Math.max(out.slideMax, mv - cap * dt); note(`slide ${c.id} (${c.size}x) ${(mv / dt).toFixed(2)} u/s in a ${m.action} stepping ${cap.toFixed(2)} at ${t.toFixed(2)} s, "${c.doing}"`); }
    }
    for (const c of long) {
      const p = P.get(c), kind = c.act?.kind;
      // (pacing: the last 3 s of its walking)
      p.hist.push([c.x, c.z]); if (p.hist.length > 90) p.hist.shift();
      if (p.hist.length === 90 && f % 15 === 0 && !/Turning round/.test(c.doing) && m0(c)) {
        let path = 0; for (let i = 1; i < 90; i++) path += Math.hypot(p.hist[i][0] - p.hist[i - 1][0], p.hist[i][1] - p.hist[i - 1][1]);
        const net = Math.hypot(c.x - p.hist[0][0], c.z - p.hist[0][1]);
        if (path > 1.2 * c.fr && net < 0.25 * path) { out.paces++; note(`pacing ${c.id} (${c.size}x): ${path.toFixed(2)} walked in 3 s, ${net.toFixed(2)} from where it was, at ${t.toFixed(1)} s, "${c.doing}"`); }
      }
      if (c.y > 0.3 || c.perch || (m0(c) === false && c.motion.action === "hop" && kind === "climb")) continue;
      const h = (HALF_LEN[c.pose] || 0.3) * c.size, r = BODY * c.size, fx = Math.cos(c.yaw) * h, fz = -Math.sin(c.yaw) * h, own = c.act?.ignoreNow;
      const bank = Math.hypot(c.x - L.POND.x, c.z - L.POND.z) < L.POND.r + 1.2 * c.size;
      for (const o0 of obs) {
        // (a bowl or a water dish is low: a cat that eats and drinks at them (not a big cat) stands over one as it gets up)
        if ((own && own.has(o0.id)) || (!c.big && /^(bowl|water)-/.test(o0.id))) continue;
        const o = bank && o0.id === L.POND.id ? { type: "circle", x: o0.x, z: o0.z, r: L.POND.r - 0.2 * c.size } : o0;
        let d = Infinity;
        for (let u = -1; u <= 1.0001; u += 0.25) d = Math.min(d, distToObstacle(o, c.x + fx * u, c.z + fz * u));
        const pen = r - d;
        if (pen > p.deep) { p.deep = pen; p.deepWhat = `${o0.id} (${c.motion.action}, ${kind}, "${c.doing}")`; }
        const sp = p.spell.get(o0.id);
        if (pen > 0.05) { if (sp) sp.t1 = t; else p.spell.set(o0.id, { t0: t, t1: t, what: `${c.id} (${c.size}x) in ${o0.id} from ${t.toFixed(1)} s, "${c.doing}"` }); }
        else if (sp && t - sp.t1 > dt * 1.5) { p.spell.delete(o0.id); if (sp.t1 - sp.t0 >= 1) { out.spells++; note(`in a prop a second: ${sp.what} for ${(sp.t1 - sp.t0).toFixed(1)} s`); } }
      }
    }
  }
  for (const [c, s] of stay) if (seconds - s.t0 >= 1) { out.wetOrIn++; if (out.wetOrInWhat.length < 6) out.wetOrInWhat.push(`${c.id} (${c.size}x) ${s.max.toFixed(2)} into ${s.what} for ${(seconds - s.t0).toFixed(1)} s from ${s.t0.toFixed(1)} s (to the end), "${s.doing}"`); }
  for (const c of long) { const p = P.get(c); if (p.deep > out.deepest) { out.deepest = p.deep; out.deepWhat = `${c.id} (${c.size}x) ${p.deep.toFixed(2)} into ${p.deepWhat}`; } }
  out.hunts = hunting.size;
  return out;
}
/** On the move (in a gait): walking on an errand, not sitting still. */
const m0 = (c) => ACTIONS[c.motion.action].kind === "gait";

if (!isMainThread) {
  parentPort.postMessage(workerData.hunt ? await huntRun(workerData) : workerData.big ? await bigRun(workerData) : await gardenRun(workerData));
} else {
  const { test } = await import("node:test");
  const assert = (await import("node:assert/strict")).default;

  const inWorker = (cfg) => {
    const p = new Promise((resolve, reject) => {
      const w = new Worker(new URL(import.meta.url), { workerData: cfg });
      w.once("message", resolve);
      w.once("error", reject);
      w.once("exit", (code) => { if (code) reject(new Error(`worker exited ${code}`)); });
    });
    p.catch(() => {}); // awaited in its test
    return p;
  };
  // The big runs start now and run side by side.
  const plain = inWorker({ traits: false, seconds: SECONDS });
  const characters = inWorker({ traits: true, seconds: SECONDS });
  const bigCats = inWorker({ big: true, seconds: 180 });
  const hunts = [inWorker({ hunt: true, seconds: 180, seed: "" }), inWorker({ hunt: true, seconds: 180, seed: "2" })];

  const report = (t, o) => t.diagnostic(`${o.cats} cats, ${o.minutes} min: ${(o.changes / o.cats / o.minutes).toFixed(2)} changes/cat/min (${(o.changesNoTrans / o.cats / o.minutes).toFixed(2)} without posture changes), ${o.msPerTick?.toFixed(2) ?? "-"} ms/tick; longest creep ${o.creepMax.toFixed(2)} s, walked into resting cats ${o.walkInto.toFixed(2)} s, ${o.longOverlaps} pairs in each other for a second, ${o.spells} for half a second`);
  function assertMoveLikeCats(o) {
    const why = o.examples.join("\n  ");
    assert.equal(o.invalid, 0, `motion the view cannot play:\n  ${why}`);
    assert.equal(o.short, 0, `actions seen for less than 0.25 s:\n  ${why}`);
    assert.equal(o.skips, 0, `posture changes without their transition:\n  ${why}`);
    assert.equal(o.unsettled, 0, `straight out of a paw wash, a sprawl or a stretch up a trunk into something else:\n  ${why}`);
    assert.equal(o.fastGaits, 0, `gait changes less than 0.5 s apart:\n  ${why}`);
    assert.equal(o.restMoving, 0, `sitting, lying or asleep while moving:\n  ${why}`);
    assert.equal(o.jumps, 0, `cats jumping across the ground:\n  ${why}`);
    assert.equal(o.rollSkips, 0, `over onto its back or side without the pose that leads there:\n  ${why}`);
    assert.equal(o.creeps, 0, `a gait shown while creeping (the longest ${o.creepMax.toFixed(2)} s):\n  ${why}`);
    assert.equal(o.spins, 0, `a body turning while it sits, lies or changes posture:\n  ${why}`);
    const perMin = o.changes / o.cats / o.minutes;
    assert.ok(perMin <= 8, `${perMin.toFixed(2)} changes per cat per minute (at most 8)`);
  }
  /** Bodies: nobody walks into a resting cat; no two cats in each other (more than 0.12) for half a second or more. */
  function assertBodies(o, { longOverlaps = 6 } = {}) {
    const why = o.examples.join("\n  ");
    assert.ok(o.walkInto < 0.5, `cats on the move deep in a resting cat's body for ${o.walkInto.toFixed(2)} s:\n  ${why}`);
    assert.ok(o.longOverlaps <= longOverlaps, `${o.longOverlaps} pairs of cats in each other for a second or more (at most ${longOverlaps}):\n  ${why}`);
    assert.equal(o.spells, 0, `${o.spells} times two cats were in each other for half a second or more (the longest ${o.spellMax.toFixed(2)} s):\n  ${o.spellExamples.join("\n  ")}`);
  }

  test("garden cats with no character of their own move like cats", async (t) => {
    const o = await plain;
    report(t, o);
    assertMoveLikeCats(o);
    assertBodies(o);
  });

  test("garden cats with characters move like cats, and their characters show", async (t) => {
    const o = await characters;
    report(t, o);
    for (const [g, v] of Object.entries(o.groups)) t.diagnostic(`${g}: asleep ${(v.sleepShare * 100).toFixed(0)}% of the time, walked ${v.distance.toFixed(1)}, trotting or running ${v.fastSeconds.toFixed(1)} s`);
    assertMoveLikeCats(o);
    assertBodies(o);
    const { sleepy, lively } = o.groups;
    assert.ok(sleepy.sleepShare > 2 * lively.sleepShare + 0.05, `a sleepy cat sleeps far more than a lively one (${sleepy.sleepShare.toFixed(2)} vs ${lively.sleepShare.toFixed(2)})`);
    assert.ok(lively.distance > 1.5 * sleepy.distance, `a lively cat gets about more (${lively.distance.toFixed(1)} vs ${sleepy.distance.toFixed(1)})`);
    assert.equal(o.sleepyMaxFast, 0, "a lazy cat never trots or runs");
    for (const a of ["roll", "flop", "run"]) assert.ok(!o.gentleActions.includes(a), `a gentle (memorial) cat never does "${a}"`);
  });

  const traitRows = () => { try { return Object.values(JSON.parse(readFileSync(new URL("../data/traits.json", import.meta.url), "utf8")).cats || {}); } catch { return []; } };
  const styleOfP = import("../assets/world/traits.js").then((m) => m.styleOf).catch(() => null);
  /** 21 Hall of Fame cats, half with characters from data/traits.json, every other one a big cat (drawn half as big again). */
  async function hallResidents() {
    const rows = traitRows(), styleOf = await styleOfP;
    return Array.from({ length: 21 }, (_, i) => {
      const traits = i % 2 && rows.length ? rows[(i * 7) % rows.length] : undefined;
      let style; try { style = styleOf && traits ? styleOf(traits) : undefined; } catch { style = undefined; }
      if (i % 4 === 3) style = { ...(style || {}), scale: 1.5 };
      return { id: `hall-${i}`, name: `Hall ${i}`, traits, style };
    });
  }

  test("Hall of Fame cats move like cats, near the camera and far from it", async () => {
    const H = L.HALL_OF_FAME, residents = await hallResidents();
    for (const [label, focus, eye] of [["near", [H.x, H.z], [H.x, H.z + 20]], ["far off, stepped lazily", [H.x + 45, H.z], [H.x, H.z + 40]], ["further off", [H.x + 80, H.z], [H.x, H.z + 60]]]) {
      const m = createMeadow({ residents, startIndex: 247 });
      m.setFocus(focus[0], focus[1], eye[0], eye[1]);
      const w = watcher(m.cats, { bodies: true });
      for (let f = 1; f <= SECONDS / DT; f++) { m.update(DT); w.tick(f * DT, DT); }
      w.flush(SECONDS, DT);
      const o = { ...w.out, minutes: SECONDS / 60 };
      assertMoveLikeCats(o);
      assertBodies(o, { longOverlaps: 0 });
      // The legs step by the distance walked (the old plaza cats stepped 5.2 times too slowly).
      // (a big cat's shared-model strides as much longer as it is drawn: its phase steps that much slower)
      for (const c of m.cats) assert.ok(Math.abs(c.stride - (c.motion.odometer * 5.2) / c.size) < 1e-6, `${label}: ${c.id}'s stride follows its odometer`);
      assert.ok(m.cats.some((c) => c.motion.odometer > 0.5) || label !== "near", `${label}: some cats stroll about`);
    }
  });

  test("Hall of Fame: over on its side from a loaf, onto its back only from there, and back the same way (10 minutes)", async (t) => {
    const H = L.HALL_OF_FAME, m = createMeadow({ residents: await hallResidents(), startIndex: 247 });
    m.setFocus(H.x, H.z, H.x, H.z + 20);
    const w = watcher(m.cats, { bodies: true }), dt = 1 / 30, seen = { roll: 0, flop: 0 };
    let prev = m.cats.map((c) => c.motion.action);
    for (let f = 1; f <= 600 / dt; f++) {
      m.update(dt); w.tick(f * dt, dt);
      m.cats.forEach((c, i) => { if (c.motion.action !== prev[i] && seen[c.motion.action] !== undefined) seen[c.motion.action]++; prev[i] = c.motion.action; });
    }
    w.flush(600, dt);
    const o = { ...w.out, minutes: 10 };
    t.diagnostic(`${seen.flop} times over on its side, ${seen.roll} onto its back; longest creep ${o.creepMax.toFixed(2)} s`);
    assert.ok(seen.roll > 0 && seen.flop > 0, "the Hall of Fame cats do sprawl and roll in the sun now and then");
    assertMoveLikeCats(o);
    assertBodies(o, { longOverlaps: 0 });
  });

  /** A garden with only the given cats, each placed and given one plain activity (steps), nothing else going on. */
  function scene(defs) {
    const sim = createSanctuary({ residents: defs.map((d) => ({ id: d.id, name: d.id, style: d.style, traits: d.traits })), reduced: false, critters: null });
    for (const c of sim.cats) { c.act = null; c.perch = null; }
    sim.cats.forEach((c, i) => {
      const d = defs[i];
      Object.assign(c, { x: d.x, z: d.z, y: 0, yaw: d.yaw ?? 0, speed: 0, dest: null, route: null, needs: { sleep: 0, hunger: 0, thirst: 0, play: 0, groom: 0, social: 0, explore: 0 } });
      c.growth = c.growth.map(() => 0);
      c.posture = ACTIONS[d.pose].posture === "lie" ? "lie" : ACTIONS[d.pose].posture;
      Object.assign(c.motion, { action: d.pose, posture: ACTIONS[d.pose].posture, gait: null, u: null, since: -10 });
      c.pose = { sit: "sit", loaf: "loaf", stand: "walk", sleep: "sleep" }[d.pose];
      c.act = { kind: "rest", steps: d.steps, i: 0, t: 0, started: false, reason: "", ignore: new Set() };
    });
    return sim;
  }
  /** A straight stretch of open lawn, clear of props by `room` either side: its two ends. */
  function openLawn(nav, len, room, pad = 0.45, reach = 12) {
    for (let z = -reach; z <= reach; z += 0.5) for (let x = -reach; x <= reach - len; x += 0.5) {
      let ok = true;
      for (let k = -room; k <= room + 1e-9 && ok; k += room / 2) ok = nav.segmentClear(x, z + k, x + len, z + k, null, pad) && nav.pointFree(x, z + k, pad + 0.05) && nav.pointFree(x + len, z + k, pad + 0.05);
      if (ok) return { x0: x, x1: x + len, z };
    }
    throw new Error("no open lawn");
  }

  test("a cat never walks through another, big or small, sitting or lying across its way: it goes round", () => {
    const probe = createSanctuary({ residents: [], reduced: false, critters: null });
    const lane = openLawn(probe.nav, 7, 1.8);
    for (const [label, style, pose, yaw] of [["an ordinary cat sitting", undefined, "sit", 0], ["a big cat sitting", { scale: 1.5 }, "sit", 0], ["a big cat loafing across the way", { scale: 1.5 }, "loaf", Math.PI / 2], ["a kitten loafing across the way", { scale: 0.75 }, "loaf", Math.PI / 2]]) {
      const mid = (lane.x0 + lane.x1) / 2;
      const sim = scene([
        { id: "RESTING", style, x: mid, z: lane.z, yaw, pose, steps: [{ type: "hold", action: pose, dur: 1e6, doing: "" }] },
        { id: "WALKER", x: lane.x0, z: lane.z + 0.05, yaw: 0, pose: "stand", steps: [{ type: "go", x: lane.x1, z: lane.z, mode: "stroll", arrive: 0.25, doing: "" }, { type: "hold", action: "stand", dur: 1e6, doing: "" }] },
      ]);
      const [rest, walker] = sim.cats;
      assert.equal(rest.size, sizeOf(rest), "the sim's body size is the drawn size");
      let worst = Infinity;
      for (let f = 0; f < 20 / DT; f++) { sim.update(DT); worst = Math.min(worst, bodyGap(walker, walker.x, walker.z, walker.yaw, walker.pose, rest)); }
      assert.ok(worst > -0.06, `${label}: the walker went ${(-worst).toFixed(2)} into its body`);
      assert.ok(Math.hypot(walker.x - lane.x1, walker.z - lane.z) < 0.6, `${label}: the walker got round to the far side (${walker.x.toFixed(2)}, ${walker.z.toFixed(2)})`);
      assert.ok(Math.hypot(rest.x - mid, rest.z - lane.z) < 1e-9, `${label}: the resting cat was not pushed about`);
    }
  });

  test("a visitor rubs cheeks with its friend touching, not in its body, and settles beside it clear of it", () => {
    const probe = createSanctuary({ residents: [], reduced: false, critters: null });
    const lane = openLawn(probe.nav, 6, 2.2);
    const mid = (lane.x0 + lane.x1) / 2;
    // (the friend facing its visitor, side on to it, or facing away; an ordinary cat and a big one)
    for (const [label, yaw, style] of [["facing it", Math.PI, undefined], ["side on", Math.PI / 2, undefined], ["facing away", 0, undefined], ["a big cat facing it", Math.PI, { scale: 1.5 }]]) {
      const sim = scene([
        { id: "FRIEND", style, x: mid, z: lane.z, yaw, pose: "sit", steps: [{ type: "hold", action: "sit", dur: 1e6, doing: "" }] },
        { id: "VISITOR", traits: { social: 0.9, grumpy: 0.1 }, x: lane.x0 - 0.5, z: lane.z, yaw: 0, pose: "stand", steps: [{ type: "hold", action: "stand", dur: 1e6, doing: "" }] },
      ]);
      const [f, v] = sim.cats;
      for (let k = 0; k < 2.5 / DT; k++) sim.update(DT);
      assert.ok(sim.force("VISITOR", "visit"), `${label}: the visit starts`);
      let bunt = false, deepest = 0, settled = null;
      for (let k = 0; k < 40 / DT && v.act && v.act.kind === "visit"; k++) {
        sim.update(DT);
        const pen = -bodyGap(v, v.x, v.z, v.yaw, v.pose, f);
        deepest = Math.max(deepest, pen);
        if (v.motion.action === "headBunt") bunt = true;
        if (bunt && ["sit", "loaf"].includes(v.motion.action)) settled = Math.max(settled ?? -1, pen);
      }
      assert.ok(bunt, `${label}: it rubbed cheeks`);
      assert.ok(deepest <= 0.16, `${label}: the visitor went ${deepest.toFixed(2)} into its friend's body (cheek to cheek is 0.1)`);
      assert.ok(settled !== null && settled <= 0.02, `${label}: it settled beside its friend ${settled?.toFixed(2)} into its body`);
    }
  });

  test("no creeping: a short way is stepped at a walk, and turning round before lying down keeps its pace", () => {
    const probe = createSanctuary({ residents: [], reduced: false, critters: null });
    const lane = openLawn(probe.nav, 3, 1);
    for (const [label, steps] of [
      ["a few steps", [{ type: "go", x: lane.x0 + 0.3, z: lane.z, mode: "stroll", arrive: 0.1, doing: "" }]],
      ["a short hop across", [{ type: "go", x: lane.x0 + 0.6, z: lane.z + 0.3, mode: "stroll", arrive: 0.1, doing: "" }]],
      ["turning round before lying down", [{ type: "circle", turns: 1.2, doing: "" }]],
    ]) {
      const sim = scene([{ id: "CAT", x: lane.x0, z: lane.z, yaw: 0, pose: "stand", steps: [...steps, { type: "hold", action: "loaf", dur: 1e6, doing: "" }] }]);
      const w = watcher(sim.cats), c = sim.cats[0];
      let slow = 0, slowest = 0, moved = 0;
      for (let f = 1; f <= 8 / DT; f++) {
        const x = c.x, z = c.z;
        sim.update(DT); w.tick(f * DT, DT);
        const sp = Math.hypot(c.x - x, c.z - z) / DT;
        moved += sp * DT;
        // (Speeding up from a stand and braking to one take a few frames under a walk's pace.)
        if (ACTIONS[c.motion.action].kind === "gait" && sp < 0.15) { slow += DT; slowest = Math.max(slowest, slow); } else slow = 0;
      }
      assert.ok(moved > 0.1, `${label}: it went somewhere (${moved.toFixed(2)})`);
      assert.ok(slowest <= 0.1, `${label}: a gait shown under 0.15 units/s for ${slowest.toFixed(2)} s at a time`);
      assert.equal(w.out.creeps, 0, w.out.examples.join("\n"));
      assert.equal(c.motion.action, "loaf", `${label}: it lay down at the end (${c.motion.action})`);
    }
  });

  test("a cat behaves the same way on every visit", () => {
    const residents = Array.from({ length: 40 }, (_, i) => ({ id: `CAT${i}`, name: `Cat ${i}`, traits: i % 2 ? SLEEPY : undefined }));
    const trace = () => {
      const sim = createSanctuary({ residents, reduced: false, critters: null });
      const out = [];
      for (let f = 0; f < 600; f++) { sim.update(DT); if (f % 30 === 0) out.push(sim.cats.map((c) => `${c.motion.action}@${c.x.toFixed(3)},${c.z.toFixed(3)}`).join(" ")); }
      return out;
    };
    assert.deepEqual(trace(), trace());
  });

  test("a cat whose own model can't show an action (traits.avoid, traits.js MODEL_LIMITS) never shows it, in the garden or the Hall", async () => {
    const { MODEL_LIMITS } = await import("../assets/world/traits.js");
    const limits = Object.values(MODEL_LIMITS).map((m) => m.avoid);
    assert.ok(limits.length >= 4 && limits.every((a) => a.length && a.every((x) => ACTIONS[x])), "MODEL_LIMITS names real actions");
    // (every other cat one with a limit, in turn: standing only, or Pusheen's no-paw-to-the-face)
    const residents = Array.from({ length: 40 }, (_, i) => ({ id: `CAT${i}`, name: `Cat ${i}`, traits: { sleepy: 0.8, playful: 0.8, hunter: 0.8, avoid: i % 2 ? limits[(i >> 1) % limits.length] : [] } }));
    const check = (cats, label) => { for (const c of cats) for (const x of c.traits.avoid || []) assert.notEqual(c.motion.action, x, `${label} ${c.id} shows ${x}, which its model can't`); };
    const sim = createSanctuary({ residents, reduced: false, critters: null });
    const seen = new Set();
    for (let f = 0; f < 180 / DT; f++) { sim.update(DT); if (f % 3 === 0) { check(sim.cats, "garden"); for (const c of sim.cats) if (c.traits.avoid?.length) seen.add(c.motion.action); } }
    assert.ok(seen.has("stand") && [...seen].some((a) => ACTIONS[a].kind === "gait"), "they still stand about and walk");
    const m = createMeadow({ residents: residents.slice(0, 16), startIndex: 247 });
    const H = L.HALL_OF_FAME; m.setFocus(H.x, H.z, H.x, H.z + 20);
    for (let f = 0; f < 180 / DT; f++) { m.update(DT); if (f % 3 === 0) check(m.cats, "Hall"); }
  });

  test("big cats in the real garden: bodies clear of the props, the house cats' places left alone, company kept with cats of a size, never stuck", async (t) => {
    const list = await bigCats;
    assert.ok(list.length >= 13, `the garden's big cats are big (${list.map((c) => `${c.id} ${c.size}`).join(", ")})`);
    const HOUSE_PLACES = /^(bed|tree|step|blanket|cushion|mat|bowl|water)/;
    for (const c of list) {
      t.diagnostic(`${c.id} ${c.size}x: ${c.kinds.join(", ")}; walked ${c.walked.toFixed(0)} s, cruising at ${c.walkV.toFixed(2)} u/s (${c.gaits.join("/")}); waited ${c.waiting.toFixed(1)} s; deepest into a prop ${c.props.toFixed(2)} ${c.propWhat}`);
      assert.ok(c.props < 0.15, `${c.id}'s body went ${c.props.toFixed(2)} into ${c.propWhat}`);
      assert.deepEqual(c.holds.filter((h) => HOUSE_PLACES.test(h)), [], `${c.id} took a house cat's place`);
      for (const m of c.company) { const size = +m.split(":")[2]; assert.ok(Math.max(size, c.size) <= 1.5 * Math.min(size, c.size), `${c.id} (${c.size}) kept company with a cat not its size: ${m}`); }
      assert.ok(!c.kinds.some((k) => ["climb", "porch", "pile", "eat", "play", "chase", "chased", "zoomies"].includes(k)), `${c.id} did a house cat's thing: ${c.kinds}`);
      assert.ok(c.waiting < 0.2 * 180, `${c.id} stood waiting ${c.waiting.toFixed(1)} s of 180`);
      assert.ok(!c.gaits.includes("trot") && !c.gaits.includes("run") || c.kinds.includes("butterfly") || c.kinds.includes("bird"), `${c.id} strolls at a walk (${c.gaits})`);
    }
    // Strolling at a big animal's pace: about √size times a house cat's (0.7 u/s at an ordinary pace, a walk at most 1.1).
    // (the ones that went for a wander: short steps aside and up to a spot are stepped more slowly)
    for (const c of list.filter((x) => x.walked > 5 && x.kinds.includes("wander"))) assert.ok(c.walkV > 0.6 * c.fr && c.walkV <= 1.1 * c.fr + 0.05, `${c.id} (${c.size}x) cruises at ${c.walkV.toFixed(2)} u/s`);
  });

  test("the real garden with its birds and butterflies: nobody pops out of a prop or skates, and no long cat's body goes into a prop on a hunt or paces on its errands", async (t) => {
    for (const o of await Promise.all(hunts)) {
      t.diagnostic(`${o.cats} cats (${o.long} long), ${o.hunts} went hunting: ${o.pops} pops (the biggest ${o.popMax.toFixed(2)}), ${o.slides} skating ticks (${o.slideMax.toFixed(3)}), deepest into a prop ${o.deepest.toFixed(2)} ${o.deepWhat || ""}, ${o.spells} spells in a prop, ${o.paces} pacing windows`);
      const why = o.examples.join("\n  ");
      assert.ok(o.hunts >= 10, `the birds and butterflies were hunted (${o.hunts} cats)`);
      assert.equal(o.pops, 0, `cats popped across the ground:\n  ${why}`);
      assert.equal(o.slides, 0, `paws skating (ground covered faster than the legs shown step):\n  ${why}`);
      assert.ok(o.deepest < 0.15, `a long cat's body went ${o.deepWhat}`);
      assert.equal(o.spells, 0, `long cats in a prop for a second or more:\n  ${why}`);
      assert.ok(o.paces <= 3, `${o.paces} windows of a long cat pacing on its errands:\n  ${why}`);
    }
  });

  test("the real garden with its birds and butterflies: every cat's leap lands on dry, clear ground, no cat stays in the water or a solid prop (nor sits, lies or loafs with its body in one), and no hop up a cat tree goes through its foot", async (t) => {
    for (const o of await Promise.all(hunts)) {
      t.diagnostic(`${o.leaps} leaps landed, the worst ${o.landWorst.toFixed(2)} into the water or a prop${o.landWhat ? ": " + o.landWhat : ""}; ${o.wetOrIn} cats in one a second or more; up a cat tree, ${o.treeHop.toFixed(2)} into its foot ${o.treeHopWhat}`);
      assert.ok(o.leaps >= 40, `the cats leapt at their prey (${o.leaps} leaps)`);
      // (a house cat leapt at a butterfly over the pond and sat 43 s in the water; one at the cottage wall sat washing inside it)
      assert.ok(o.landWorst <= 0.1, `a leap landed in the water or a prop: ${o.landWhat}`);
      assert.equal(o.wetOrIn, 0, `cats stayed in the water or a solid prop, sitting, lying or standing there:\n  ${o.wetOrInWhat.join("\n  ")}`);
      // (the bobcat's chest went through the tree's foot as it gathered and took off)
      assert.ok(o.treeHop <= 0.05, `a hop up a cat tree went through its foot: ${o.treeHopWhat}`);
    }
  });

  test("a long cat hunting beside a prop keeps its whole body out of it, and never pops out: the Savannah after a butterfly at the easel", () => {
    const E = L.obstacles().find((o) => o.id === "easel");
    for (const [scale, ox, oz] of [[1.31, -0.7, -0.5], [1.31, 0.75, 0.45], [2.56, -0.7, -0.5]]) {
      // (a butterfly hovering just by the easel, low enough to hunt: stalked, pounced at and missed, again and again)
      const bf = { x: E.x + ox, y: 0.6, z: E.z + oz, state: "fly" }, critters = { butterflies: [bf], birds: [], startle() {} };
      const sim = createSanctuary({ residents: [{ id: "SAV", name: "Sav", style: { scale }, traits: { playful: 0.95, hunter: 0.95, energy: 0.8, sleepy: 0.05, curious: 0.3 } }], reduced: false, critters });
      const c = sim.cats[0], dt = 1 / 30;
      // (a lion hunts only a butterfly its route-finder reaches: the nearest such spot to the easel)
      const Nb = sim.navOf(scale), pad = scale >= BIG_SIZE ? Nb.clearR * 0.7 : 0.3;
      for (let k = 0; k < 400 && !Nb.pointFree(bf.x, bf.z, pad); k++) { bf.x = E.x + ox + Math.cos(k * 2.4) * (0.1 + k * 0.02); bf.z = E.z + oz + Math.sin(k * 2.4) * (0.1 + k * 0.02); }
      // (where the verifier saw the Savannah stand 14 s and then sit in the easel, or the nearest spot there a bigger cat's
      // whole body fits whichever way it turns; the easel's corner: the cottage, a cat tree, a flower bed and a cat bed)
      const N = sim.navOf(scale), reach = (HALF_LEN.walk + BODY) * scale + 0.05;
      let st = { x: 4.15, z: 3.12 };
      for (let k = 0; k < 400 && !N.pointFree(st.x, st.z, reach); k++) st = { x: 4.15 + Math.cos(k * 2.4) * (0.1 + k * 0.02), z: 3.12 + Math.sin(k * 2.4) * (0.1 + k * 0.02) };
      c.x = st.x; c.z = st.z; c.yaw = yawTo(E.x - c.x, E.z - c.z);
      let deep = 0, what = "", pops = 0, hunts = 0, px = c.x, pz = c.z, pv = 0, was = null;
      for (let f = 1; f <= 150 / dt; f++) {
        c.needs.play = 1; c.needs.sleep = 0;
        sim.update(dt);
        if (c.act?.kind === "butterfly" && was !== c.act) hunts++;
        was = c.act;
        const mv = Math.hypot(c.x - px, c.z - pz), v = Math.max(pv, c.speed); px = c.x; pz = c.z; pv = c.speed;
        if (c.y > 0.05) continue;
        if (ACTIONS[c.motion.action].posture !== "air" && mv - v * dt > 0.1) pops++;
        if (c.motion.action === "hop" && c.act?.kind === "climb") continue; // (up its cat tree)
        const h = (HALF_LEN[c.pose] || 0.3) * c.size, r = BODY * c.size, fx = Math.cos(c.yaw) * h, fz = -Math.sin(c.yaw) * h;
        const own = c.act?.ignoreNow, bank = Math.hypot(c.x - L.POND.x, c.z - L.POND.z) < L.POND.r + 1.2 * c.size;
        for (const o0 of L.obstacles()) {
          // (as the garden run counts it: its own bowl or bed, the bowls a house-sized cat eats at, its head over the pond)
          if ((own && own.has(o0.id)) || (!c.big && /^(bowl|water)-/.test(o0.id))) continue;
          const o = bank && o0.id === L.POND.id ? { type: "circle", x: o0.x, z: o0.z, r: L.POND.r - 0.2 * c.size } : o0;
          let d = Infinity;
          for (let u = -1; u <= 1.0001; u += 0.25) d = Math.min(d, distToObstacle(o, c.x + fx * u, c.z + fz * u));
          if (r - d > deep) { deep = r - d; what = `${o.id} (${c.motion.action}, "${c.doing}") at ${(f * dt).toFixed(1)} s`; }
        }
      }
      assert.ok(hunts >= (scale >= BIG_SIZE ? 1 : 3), `a ${scale}x cat went after the butterfly by the easel (${hunts} hunts)`);
      assert.equal(pops, 0, `a ${scale}x cat popped across the ground by the easel`);
      assert.ok(deep < 0.1, `a ${scale}x cat's body went ${deep.toFixed(2)} into ${what}`);
    }
  });

  test("a cat hunting a butterfly across a corner of the pond goes round the water, and its leaps land on dry ground: a kitten, a house cat, a bobcat", () => {
    // (it starts on the pond's rim, well within its berth (where the verifier's cats were when they went in); the
    // butterfly hovers over the grass across a corner of the water, 80 degrees round the bank)
    const obs = L.obstacles(), probe = createSanctuary({ residents: [], reduced: false, critters: null });
    const at = (a, d) => ({ x: L.POND.x + Math.cos(a) * d, z: L.POND.z + Math.sin(a) * d }), notPond = new Set([L.POND.id]);
    let A = null, B = null;
    for (let a = 0; a < Math.PI * 2 && !A; a += 0.05) {
      const p = at(a, L.POND.r + 0.6), q = at(a + 1.4, L.POND.r + 0.85);
      if (probe.nav.pointFree(p.x, p.z, 0.9, notPond) && probe.nav.pointFree(q.x, q.z, 0.9, notPond)) { A = p; B = q; }
    }
    for (const scale of [0.75, 1, 1.42]) {
      const bf = { x: B.x, y: 0.6, z: B.z, state: "fly" }, critters = { butterflies: [bf], birds: [], startle() {} };
      const sim = createSanctuary({ residents: [{ id: "HUNTER", name: "Hunter", style: { scale }, traits: { playful: 0.95, hunter: 0.95, energy: 0.8, sleepy: 0.05, curious: 0.3 } }], reduced: false, critters });
      const c = sim.cats[0], dt = 1 / 30;
      Object.assign(c, { x: A.x, z: A.z, yaw: yawTo(B.x - A.x, B.z - A.z) });
      let hunts = 0, was = null, air = false, land = [0, "-"], rest = [0, "-"], wet = 0;
      for (let f = 1; f <= 40 / dt; f++) {
        c.needs.play = 1; c.needs.sleep = 0;
        if (c.act?.kind !== "butterfly") sim.force("HUNTER", "butterfly");
        sim.update(dt);
        if (c.act?.kind === "butterfly" && was !== c.act) hunts++;
        was = c.act;
        const a = c.motion.action, nowAir = a === "pounce" || a === "hop", landed = air && !nowAir;
        air = nowAir;
        if (c.y > 0.05 || nowAir) continue;
        // (its middle never over the water: it doesn't wade across)
        wet = Math.max(wet, L.POND.r - Math.hypot(c.x - L.POND.x, c.z - L.POND.z));
        const d = solidDepth(c, obs);
        if (landed && d[0] > land[0]) land = [d[0], d[1]];
        if (["sit", "lie", "sleep"].includes(c.motion.posture) && d[0] > rest[0]) rest = [d[0], d[1]];
      }
      assert.ok(hunts >= 2, `a ${scale}x cat went after the butterfly (${hunts} hunts)`);
      assert.ok(wet <= 0, `a ${scale}x cat walked ${wet.toFixed(2)} into the water after it`);
      assert.ok(land[0] <= 0.1, `a ${scale}x cat's leap landed ${land[0].toFixed(2)} into ${land[1]}`);
      assert.ok(rest[0] <= 0.1, `a ${scale}x cat sat ${rest[0].toFixed(2)} into ${rest[1]}`);
    }
  });

  test("a cat found in the pond, the cottage or a vegetable bed walks straight out, at a walk, and never sits there: a kitten, a house cat, a bobcat, a lion", () => {
    const obs = L.obstacles(), house = obs.find((o) => o.id === "house"), veg = obs.find((o) => o.id.startsWith("veg-"));
    const spots = [["the pond", { x: L.POND.x + Math.cos(1) * (L.POND.r - 0.8), z: L.POND.z + Math.sin(1) * (L.POND.r - 0.8) }], ["the cottage", { x: house.maxX - 0.25, z: (house.minZ + house.maxZ) / 2 + 0.5 }], ["a vegetable bed", { x: (veg.minX + veg.maxX) / 2, z: (veg.minZ + veg.maxZ) / 2 }]];
    for (const scale of [0.75, 1, 1.42, 2.56]) for (const [label, p] of spots) {
      // (sitting there, as the verifier's cats sat after a leap, with nothing else to do)
      const sim = scene([{ id: "IN", style: { scale }, x: p.x, z: p.z, yaw: 0.3, pose: "sit", steps: [{ type: "hold", action: "sit", dur: 1e6, doing: "" }] }]);
      const c = sim.cats[0], w = watcher(sim.cats);
      let outAt = null, satIn = 0, fast = 0, px = c.x, pz = c.z;
      for (let f = 1; f <= 20 / DT; f++) {
        sim.update(DT); w.tick(f * DT, DT);
        fast = Math.max(fast, Math.hypot(c.x - px, c.z - pz) / DT); px = c.x; pz = c.z;
        const d = solidDepth(c, obs)[0];
        if (outAt == null && d <= 0.05) outAt = f * DT;
        // (once it has had a moment to get up: never sitting, lying or loafing in it)
        if (f * DT > 1.5 && d > 0.1 && ["sit", "lie", "sleep"].includes(c.motion.posture) && ACTIONS[c.motion.action].kind !== "trans") satIn += DT;
      }
      const what = `a ${scale}x cat in ${label}`;
      assert.ok(outAt != null && outAt < 3 + 2 * scale, `${what} got out (${outAt?.toFixed(2)} s; ${solidDepth(c, obs)[0].toFixed(2)} in it at the end, ${c.motion.action})`);
      assert.equal(satIn, 0, `${what} sat or lay in it ${satIn.toFixed(2)} s`);
      assert.ok(fast <= 1.6 * gaitScale(c.size) + 0.05, `${what} left it at a walk, not a slide (${fast.toFixed(2)} u/s)`);
      for (const k of ["jumps", "skips", "short", "invalid"]) assert.equal(w.out[k], 0, `${what}: ${w.out.examples.join("; ")}`);
    }
  });

  test("a cat hops up onto its cat tree without going through the tree's foot or its platform, whatever its size", () => {
    for (const scale of [0.75, 1, 1.42]) {
      const sim = createSanctuary({ residents: [{ id: "CLIMBER", name: "Climber", style: { scale }, traits: { climber: 1 } }], reduced: false, critters: null });
      const c = sim.cats[0], T = L.TREES[4], base = { type: "rect", ...T.base };
      for (const x of sim.cats) { x.act = null; x.perch = null; }
      Object.assign(c, { x: T.ground.x + 2.5, z: T.ground.z, y: 0, yaw: Math.PI });
      assert.equal(sim.force("CLIMBER", "climb"), true);
      let foot = 0, under = 0, perched = false;
      for (let f = 1; f <= 40 / DT && !perched; f++) {
        sim.update(DT);
        perched = !!c.perch;
        if (c.act?.kind !== "climb" || c.perch) continue;
        const h = (HALF_LEN[c.pose] || 0.3) * c.size, r = BODY * c.size, fx = Math.cos(c.yaw) * h, fz = -Math.sin(c.yaw) * h;
        let dF = Infinity, dP = Infinity;
        for (let u = -1; u <= 1.0001; u += 0.25) { dF = Math.min(dF, distToObstacle(base, c.x + fx * u, c.z + fz * u)); dP = Math.min(dP, Math.hypot(c.x + fx * u - T.low.x, c.z + fz * u - T.low.z) - T.low.r); }
        // (low down, its body clear of the tree's foot; below the platform, clear of it)
        if (c.y < 0.3) foot = Math.max(foot, r - dF);
        if (c.y < T.low.y - 0.3) under = Math.max(under, r - dP);
      }
      assert.ok(perched, `a ${scale}x cat got up onto the platform`);
      assert.ok(foot <= 0.05, `a ${scale}x cat went ${foot.toFixed(2)} into the tree's foot`);
      assert.ok(under <= 0.1, `a ${scale}x cat went ${under.toFixed(2)} up through the platform`);
    }
  });

  test("a big cat moves as a big animal: gait bands, speeds, turns and posture changes by the square root of its size", () => {
    assert.equal(gaitScale(1), 1); assert.equal(gaitScale(0.75), 1, "a kitten keeps its own pace"); assert.ok(Math.abs(gaitScale(2.56) - 1.6) < 1e-9);
    // The same speed is a house cat's trot and a lion's walk; the lion trots and runs at √2.56 = 1.6 times the speeds.
    assert.equal(gaitFor(null, 1.8), "trot"); assert.equal(gaitFor(null, 1.8, Infinity, { scale: 1.6 }), "walk");
    assert.equal(gaitFor(null, 2.6), "run"); assert.equal(gaitFor(null, 2.6, Infinity, { scale: 1.6 }), "trot");
    assert.equal(gaitFor(null, GAIT_BANDS.runUp * 1.6 + 0.05, Infinity, { scale: 1.6 }), "run");
    const probe = createSanctuary({ residents: [{ id: "L", name: "L", style: { scale: 2.56 } }], reduced: false, critters: null });
    const lane = openLawn(probe.navOf(2.56), 12, 1.5, probe.navOf(2.56).clearR + 0.1, 30);
    const run = (style) => {
      const sim = scene([{ id: "CAT", style, x: lane.x0, z: lane.z, yaw: 0, pose: "stand", steps: [{ type: "go", x: lane.x1, z: lane.z, mode: "stroll", arrive: 0.1, doing: "" }, { type: "hold", action: "sit", dur: 1e6, doing: "" }] }]);
      const c = sim.cats[0], w = watcher(sim.cats), vs = [];
      let turn = 0, sitFrom = null, sitFor = 0, strideOk = true, x = c.x, z = c.z, yaw = c.yaw, s0 = c.stride, o0 = c.motion.odometer;
      for (let f = 1; f <= 30 / DT; f++) {
        sim.update(DT); w.tick(f * DT, DT);
        if (c.motion.gait) vs.push(Math.hypot(c.x - x, c.z - z) / DT);
        turn = Math.max(turn, Math.abs(Math.atan2(Math.sin(c.yaw - yaw), Math.cos(c.yaw - yaw))) / DT);
        if (c.motion.action === "sitDown") { sitFrom ??= f * DT; sitFor = f * DT - sitFrom + DT; }
        x = c.x; z = c.z; yaw = c.yaw;
      }
      strideOk = Math.abs((c.stride - s0) - ((c.motion.odometer - o0) * 5.2) / c.size) < 1e-6;
      vs.sort((a, b) => a - b);
      return { c, v: vs[Math.floor(vs.length * 0.75)] || 0, turn, sitFor, strideOk, w: w.out, gaits: new Set(vs.length ? ["walk"] : []) };
    };
    const house = run(undefined), lion = run({ scale: 2.56, tempo: 1 });
    assert.equal(lion.c.size, 2.56); assert.equal(lion.c.big, true);
    assert.ok(Math.abs(lion.v / house.v - 1.6) < 0.12, `a lion strolls 1.6x as fast (${lion.v.toFixed(2)} against ${house.v.toFixed(2)} u/s)`);
    assert.ok(lion.v < GAIT_BANDS.trotUp * 1.6 && lion.c.motion.gait === null && lion.w.fastGaits === 0, "at a walk, in its own bands");
    assert.ok(lion.turn <= (3.4 + 1.5) / 1.6 + 0.05, `and turns at most 1/1.6 as quickly (${lion.turn.toFixed(2)} rad/s)`);
    assert.ok(Math.abs(lion.sitFor - TRANS_DUR.sitDown * 1.6) < 0.05 && Math.abs(house.sitFor - TRANS_DUR.sitDown) < 0.05, `sits down in 1.6x the time (${lion.sitFor.toFixed(2)} s, a house cat ${house.sitFor.toFixed(2)} s)`);
    assert.ok(lion.strideOk && house.strideOk, "its shared-model strides follow its odometer, as long as it is big");
    for (const o of [house, lion]) { assert.equal(o.w.creeps, 0, o.w.examples.join("\n")); assert.equal(o.w.skips, 0, o.w.examples.join("\n")); assert.equal(o.w.short, 0, o.w.examples.join("\n")); }
    assert.ok(Math.hypot(lion.c.x - lane.x1, lion.c.z - lane.z) < 0.6, "and gets there");
  });

  test("a lion never walks through a house cat or a kitten in its way: it goes round, as far off as its body needs", () => {
    const probe = createSanctuary({ residents: [{ id: "L", name: "L", style: { scale: 2.56 } }], reduced: false, critters: null });
    const lane = openLawn(probe.navOf(2.56), 12, 3, probe.navOf(2.56).clearR + 0.1, 30);
    for (const [label, pose, yaw, scale] of [["a house cat sitting", "sit", 0, 1], ["a kitten loafing across the way", "loaf", Math.PI / 2, 0.75], ["a house cat loafing across the way", "loaf", Math.PI / 2, 1]]) {
      const mid = (lane.x0 + lane.x1) / 2;
      const sim = scene([
        { id: "RESTING", style: { scale }, x: mid, z: lane.z, yaw, pose, steps: [{ type: "hold", action: pose, dur: 1e6, doing: "" }] },
        { id: "LION", style: { scale: 2.56 }, x: lane.x0, z: lane.z + 0.05, yaw: 0, pose: "stand", steps: [{ type: "go", x: lane.x1, z: lane.z, mode: "stroll", arrive: 0.25, doing: "" }, { type: "hold", action: "stand", dur: 1e6, doing: "" }] },
      ]);
      const [rest, lion] = sim.cats;
      let worst = Infinity;
      for (let f = 0; f < 25 / DT; f++) { sim.update(DT); worst = Math.min(worst, bodyGap(lion, lion.x, lion.z, lion.yaw, lion.pose, rest)); }
      assert.ok(worst > -0.06, `${label}: the lion went ${(-worst).toFixed(2)} into its body`);
      assert.ok(Math.hypot(lion.x - lane.x1, lion.z - lane.z) < 0.25 * 2.56 + 0.4, `${label}: the lion got round to the far side (${lion.x.toFixed(2)}, ${lion.z.toFixed(2)})`);
      assert.ok(Math.hypot(rest.x - mid, rest.z - lane.z) < 1e-9, `${label}: the resting cat was not pushed about`);
    }
  });

  test("a pounce never carries a cat into another's body or lands it on one, and nobody walks into a cat mid-pounce: one trotting up head-on, one crossing its way", () => {
    const probe = createSanctuary({ residents: [], reduced: false, critters: null });
    const lane = openLawn(probe.nav, 8, 2.5);
    const px = lane.x0 + 1, z = lane.z;
    // (the verifier's two: one pounced at its yarn as another trotted up to its own, and landed 0.32 into it; every moment
    // the pounce might go, from long before the other comes by to after it has passed)
    for (const [label, wx, wz, gx, gz] of [["trotting up head-on", px + 6, z + 0.1, px - 3, z], ["crossing its way", px + 1.4, z + 4, px + 1.4, z - 4]]) {
      let leaps = 0;
      for (let wait = 0.3; wait <= 3.01; wait += 0.1) {
        const sim = scene([
          { id: "POUNCER", x: px, z, yaw: 0, pose: "stand", steps: [{ type: "hold", action: "crouch", dur: wait, doing: "" }, { type: "hop", pounce: true, to: () => ({ x: px + 1.8, z }), short: 0.42, y: 0, air: 0.32, apex: 0.2, doing: "" }, { type: "hold", action: "stand", dur: 1e6, doing: "" }] },
          { id: "WALKER", x: wx, z: wz, yaw: yawTo(gx - wx, gz - wz), pose: "stand", steps: [{ type: "go", x: gx, z: gz, mode: "hurry", arrive: 0.25, doing: "" }, { type: "hold", action: "stand", dur: 1e6, doing: "" }] },
        ]);
        const [p, w] = sim.cats;
        let deepest = 0, leapt = false;
        for (let f = 0; f < 8 / DT; f++) {
          sim.update(DT);
          if (p.motion.action === "pounce") leapt = true;
          deepest = Math.max(deepest, -bodyGap(p, p.x, p.z, p.yaw, p.pose, w));
        }
        if (leapt) leaps++;
        assert.ok(deepest <= 0.12, `${label}, the pounce after ${wait.toFixed(1)} s: the two were ${deepest.toFixed(2)} into each other`);
      }
      assert.ok(leaps >= 14, `${label}: it pounced when the way was clear (${leaps} of 28)`);
    }
  });

  test("a cat running from its chaser runs away along open lawn and turns wide: it never runs tight circles or doubles back at the one chasing it", () => {
    const PLAY = { playful: 0.9, energy: 0.9, sleepy: 0.1, grumpy: 0.1, social: 0.8 }, dt = 1 / 30;
    let runs = 0;
    const loops = [];
    // (where the verifier's Savannah ran rings round its chaser, and about the garden; house cats and Savannahs, the chaser on every side)
    for (const [x, z] of [[-6.1, 34.2], [0, 6], [8, -4], [-12, -10], [14, 12], [3, -20]]) for (let k = 0; k < 8; k++) {
      const a = k * 0.9, style = k % 2 ? { scale: 1.31 } : undefined;
      const sim = scene([
        { id: `RUN${k}`, traits: PLAY, style, x, z, yaw: a, pose: "sit", steps: [{ type: "hold", action: "sit", dur: 1e6, doing: "" }] },
        { id: `CHASER${k}`, traits: PLAY, style, x: x + Math.cos(a) * 2.2, z: z - Math.sin(a) * 2.2, yaw: a + Math.PI, pose: "sit", steps: [{ type: "hold", action: "sit", dur: 1e6, doing: "" }] },
      ]);
      const r = sim.cats[0];
      for (let f = 0; f < 3 / dt; f++) sim.update(dt);
      if (!sim.force(r.id, "chase") || r.act?.kind !== "chase") continue;
      runs++;
      // (the garden run's measure of pacing: 3 s of it on the move, more than 1.2 √size walked, less than a quarter of that from where it was)
      const hist = [];
      for (let f = 1; f <= 20 / dt && r.act?.kind === "chase"; f++) {
        sim.update(dt);
        hist.push([r.x, r.z]); if (hist.length > 90) hist.shift();
        if (hist.length < 90 || f % 15 || ACTIONS[r.motion.action].kind !== "gait") continue;
        let path = 0; for (let i = 1; i < 90; i++) path += Math.hypot(hist[i][0] - hist[i - 1][0], hist[i][1] - hist[i - 1][1]);
        const net = Math.hypot(r.x - hist[0][0], r.z - hist[0][1]);
        if (path > 1.2 * r.fr && net < 0.25 * path) { loops.push(`${r.id} (${r.size}x) at (${x}, ${z}): ${path.toFixed(2)} run in 3 s, ${net.toFixed(2)} from where it was, "${r.doing}"`); break; }
      }
    }
    assert.ok(runs >= 36, `the chases got going (${runs} of 48)`);
    assert.deepEqual(loops, [], `runners that ran rings:\n  ${loops.join("\n  ")}`);
  });

  test("a big cat leaves the house cats' things alone, naps on a whole sunny patch, and watches the pond from further back", () => {
    const sim = createSanctuary({ residents: [{ id: "LION", name: "Lion", style: { scale: 2.56 } }, { id: "HOUSE", name: "House", style: { scale: 1 } }], reduced: false, critters: null });
    const lion = sim.byId("LION"), house = sim.byId("HOUSE");
    assert.ok(lion.big && !house.big && !alike(lion, house));
    // Its body (the capsule every "no overlapping" check uses) is as big as it is drawn: 2.56 times as long and wide.
    const was = { x: house.x, z: house.z, yaw: house.yaw, pose: house.pose };
    Object.assign(house, { x: 5, z: 0, yaw: 0, pose: "walk" });
    assert.ok(Math.abs(bodyGap(lion, 0, 0, 0, "walk", house) - (5 - HALF_LEN.walk * (2.56 + 1) - BODY * (2.56 + 1))) < 1e-9, "a lion's capsule is 2.56x a house cat's");
    Object.assign(house, was);
    assert.equal(lion.nav, sim.navOf(2.56)); assert.notEqual(lion.nav, sim.nav, "its own route-finder");
    assert.ok(lion.nav.clearR >= BODY * 2.56 + 0.1 && lion.bodyR >= BODY * 2.56 - 1e-9, "routes and push-out as wide as its body");
    for (const kind of ["climb", "porch", "eat", "play", "pile"]) assert.equal(sim.force("LION", kind), false, `a lion doesn't ${kind}`);
    assert.equal(sim.force("HOUSE", "climb"), true, "a house cat still climbs");
    for (let k = 0; k < 6; k++) {
      assert.equal(sim.force("LION", "nap"), true);
      const held = [...sim.reservations()].filter(([, id]) => id === "LION").map(([p]) => p);
      assert.ok(held.every((p) => p.startsWith("sun-")) && (held.length === 0 || held.length === 2 && held[0].split("#")[0] === held[1].split("#")[0]), `a lion naps across a whole sunny patch or on the grass, never in a bed: ${held}`);
      sim.force("LION", "rest");
    }
    const water = L.POND.r + 0.25;
    for (const p of sim.bigPlaces.pond) assert.ok(Math.hypot(p.x - L.POND.x, p.z - L.POND.z) - water >= lion.nav.clearR, `${p.id}: its body clear of the water's edge`);
    assert.ok(sim.bigPlaces.pond.length >= 3 && sim.bigPlaces.sun.length >= 10, "and has places enough");
    assert.equal(sim.force("LION", "pond"), true); assert.equal(sim.force("LION", "drink"), true);
  });

  test("a big cat by the pond but not there to drink or watch it keeps its whole body out of the water: turning round to walk off, its hindquarters don't swing out over it", () => {
    // (the verifier's tiger, moved over from the bank on its way to drink, turned round to go with its hindquarters 0.2 over the water)
    const P = L.POND, water = L.obstacles().find((o) => o.id === P.id), bad = [];
    let tries = 0;
    for (const d of [4.2, 4.6, 5.0]) for (let k = 0; k < 16; k += 2) for (const side of [1, -1]) {
      const a = (k * Math.PI) / 8, x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
      const sim = scene([{ id: "TIGER", style: { scale: 2.3 }, x, z, yaw: yawTo(P.x - x, P.z - z) + side * 1.2, pose: "stand",
        steps: [{ type: "go", x: P.x + Math.cos(a) * (d + 4), z: P.z + Math.sin(a) * (d + 4), mode: "stroll", arrive: 0.3, doing: "" }, { type: "hold", action: "stand", dur: 1e6, doing: "" }] }]);
      const c = sim.cats[0];
      if (!c.nav.pointFree(x, z, c.bodyR)) continue;
      tries++;
      const wet = () => { const h = (HALF_LEN[c.pose] || 0.3) * c.size, fx = Math.cos(c.yaw) * h, fz = -Math.sin(c.yaw) * h; let dd = Infinity; for (let u = -1; u <= 1.0001; u += 0.25) dd = Math.min(dd, distToObstacle(water, c.x + fx * u, c.z + fz * u)); return BODY * c.size - dd; };
      const start = wet();
      let worst = start;
      for (let f = 0; f < 10 / (1 / 30); f++) { sim.update(1 / 30); worst = Math.max(worst, wet()); }
      if (worst > Math.max(0.03, start) + 0.05) bad.push(`${d} from the middle, ${a.toFixed(2)} round, turning ${side > 0 ? "left" : "right"}: ${worst.toFixed(2)} into the water (from ${start.toFixed(2)})`);
    }
    assert.ok(tries >= 20, `spots on the bank (${tries})`);
    assert.deepEqual(bad, [], `a tiger walking off from the bank went into the water:\n  ${bad.join("\n  ")}`);
  });

  test("a cat by a thin tall post (a rose arch's, a lantern's) keeps its whole body out of it, nose and all: walking up to it, turning beside it, stretching or loafing there", () => {
    // (the verifier's cat stood ten minutes with a rose arch's post through its head: its middle its walk's berth off the
    // post, its nose 0.12 inside it; a low planter or a bush's edge a nose may lean in over, a post not)
    const posts = L.obstacles().filter((o) => /^(arch-2--1|arch-3-1|lantern-3|lantern-6)$/.test(o.id)), bad = [];
    let runs = 0;
    for (const o of posts) for (const [scale, end] of [[1, "stand"], [1, "stretch"], [1, "loaf"], [0.75, "stand"], [1.12, "sit"]]) for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, probe = createSanctuary({ residents: [], reduced: false, critters: null });
      // (from 2.5 off, up to a spot just its walk's berth off the post, facing it)
      const sx = o.x + Math.cos(a) * 2.5, sz = o.z - Math.sin(a) * 2.5, gx = o.x + Math.cos(a) * (o.r + 0.33), gz = o.z - Math.sin(a) * (o.r + 0.33);
      if (!probe.nav.pointFree(sx, sz, 0.45) || !probe.nav.segmentClear(sx, sz, gx, gz, null, 0.3)) continue;
      const sim = scene([{ id: "CAT", style: { scale }, x: sx, z: sz, yaw: yawTo(gx - sx, gz - sz), pose: "stand",
        steps: [{ type: "go", x: gx, z: gz, mode: "stroll", arrive: 0.05, doing: "" }, { type: "turn", yaw: a + Math.PI + 1.2, doing: "" }, { type: "turn", yaw: a + Math.PI, doing: "" }, { type: "hold", action: end, dur: 1e6, doing: "" }] }]);
      const c = sim.cats[0];
      runs++;
      let deep = 0, when = "";
      for (let f = 0; f < 10 / DT; f++) {
        sim.update(DT);
        const h = (HALF_LEN[c.pose] || 0.3) * c.size, fx = Math.cos(c.yaw) * h, fz = -Math.sin(c.yaw) * h;
        let d = Infinity;
        for (let u = -1; u <= 1.0001; u += 0.125) d = Math.min(d, distToObstacle(o, c.x + fx * u, c.z + fz * u));
        if (BODY * c.size - d > deep) { deep = BODY * c.size - d; when = `${c.motion.action} at ${(f * DT).toFixed(1)} s`; }
      }
      if (deep > 0.05) bad.push(`${o.id}, a ${scale}x cat from ${a.toFixed(2)}, ending in ${end}: ${deep.toFixed(2)} into it (${when})`);
    }
    assert.ok(runs >= 60, `ways up to the posts (${runs})`);
    assert.deepEqual(bad, [], `bodies in a post:\n  ${bad.slice(0, 12).join("\n  ")}`);
  });

  test("a big Hall of Fame cat gets a home with room for its body, and nobody sits in it", () => {
    const H = L.HALL_OF_FAME, residents = Array.from({ length: 21 }, (_, i) => ({ id: `h${i}`, name: `h${i}`, style: i === 2 ? { scale: 2.56 } : undefined }));
    const m = createMeadow({ residents, startIndex: 247 });
    const lion = m.cats[2];
    for (const o of m.cats) if (o !== lion) assert.ok(Math.hypot(o.home.x - lion.home.x, o.home.z - lion.home.z) >= 1.4 * (lion.size + o.size) / 2 - 1e-9, `${o.id}'s home is clear of the lion's`);
    assert.ok(Math.hypot(lion.home.x - H.x, lion.home.z - H.z) >= H.fountain.r + (HALF_LEN.walk + BODY) * lion.size, "and of the fountain");
    m.setFocus(H.x, H.z, H.x, H.z + 20);
    const w = watcher(m.cats, { bodies: true });
    for (let f = 1; f <= 90 / DT; f++) { m.update(DT); w.tick(f * DT, DT); }
    assertMoveLikeCats({ ...w.out, minutes: 1.5 });
    assertBodies(w.out, { longOverlaps: 0 });
  });

  test("with reduced motion every cat settles still, and later gets up properly", () => {
    const residents = Array.from({ length: 30 }, (_, i) => ({ id: `CAT${i}`, name: `Cat ${i}` }));
    const sim = createSanctuary({ residents, reduced: true, critters: null });
    for (const c of sim.cats) {
      assert.ok(RESTING.has(c.motion.posture) && c.motion.gait === null, `${c.id} settled (${c.motion.action})`);
      assert.equal(ACTIONS[c.motion.action].kind, "loop");
    }
    const before = sim.cats.map((c) => c.motion.action);
    for (let f = 0; f < 60; f++) sim.update(DT);
    assert.deepEqual(sim.cats.map((c) => c.motion.action), before, "nothing moves while reduced");
    sim.setReduced(false);
    const w = watcher(sim.cats);
    for (let f = 1; f <= 20 / DT; f++) { sim.update(DT); w.tick(f * DT, DT); }
    assert.equal(w.out.skips, 0, w.out.examples.join("\n"));
    assert.equal(w.out.short, 0, w.out.examples.join("\n"));
  });
}
