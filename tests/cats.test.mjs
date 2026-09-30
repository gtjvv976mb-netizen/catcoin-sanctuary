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
   - character shows: a sleepy cat sleeps far more than a lively one, a lazy cat never runs, a
     gentle (memorial) cat never rolls about or races.
   The two big garden runs go in worker threads (this file again, below), side by side. Scenes of
   two or three cats check the bodies directly: a walker never goes through a sitting cat, big or
   small, and a big cat's body is as big as it is drawn.
   Big cats (a lion 2.56x, a tiger 2.3x: traits.js SPECIES): a third run, the real garden with its
   real residents, watches them: their whole bodies clear of the props, none of the house cats'
   places used, company kept only with cats of a size, never stuck for long; and scenes check that
   a lion walks, turns and sits down as a big animal does (catmotion gaitScale) and goes round a
   house cat sitting in its way. */

import { isMainThread, parentPort, workerData, Worker } from "node:worker_threads";
import { readFileSync } from "node:fs";
import { createSanctuary, POSES, UNWIND, BODY, BIG_SIZE, HALF_LEN, bodyGap, sizeOf, alike } from "../assets/world/cats.js";
import { createMeadow } from "../assets/world/meadow.js";
import { ACTIONS, GAIT_BANDS, MIN_SHOW, TRANS_DUR, gaitFor, gaitScale } from "../assets/world/catmotion.js";
import { distToObstacle } from "../assets/world/nav.js";
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
  const obs = L.obstacles(), dt = 1 / 30, big = sim.cats.filter((c) => c.size >= BIG_SIZE);
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

if (!isMainThread) {
  parentPort.postMessage(workerData.big ? await bigRun(workerData) : await gardenRun(workerData));
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
