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
   - no cat walks into another's body (bodies as big as the cats are drawn), and cats don't stay
     in each other long;
   - character shows: a sleepy cat sleeps far more than a lively one, a lazy cat never runs, a
     gentle (memorial) cat never rolls about or races.
   The two big garden runs go in worker threads (this file again, below), side by side. Scenes of
   two or three cats check the bodies directly: a walker never goes through a sitting cat, big or
   small, and a big cat's body is as big as it is drawn. */

import { isMainThread, parentPort, workerData, Worker } from "node:worker_threads";
import { readFileSync } from "node:fs";
import { createSanctuary, POSES, UNWIND, bodyGap, sizeOf } from "../assets/world/cats.js";
import { createMeadow } from "../assets/world/meadow.js";
import { ACTIONS, MIN_SHOW } from "../assets/world/catmotion.js";
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
  const out = { cats: cats.length, changes: 0, changesNoTrans: 0, short: 0, skips: 0, unsettled: 0, fastGaits: 0, restMoving: 0, invalid: 0, jumps: 0, rollSkips: 0, creeps: 0, creepMax: 0, spins: 0, walkInto: 0, longOverlaps: 0, examples: [] };
  const note = (kind, c, what) => { if (out.examples.length < 12) out.examples.push(`${kind} ${c.id}: ${what}`); };
  const overlap = new Map();
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
        if (pen <= 0.12) { overlap.delete(key); continue; }
        const am = ACTIONS[a.motion.action].kind === "gait", bm = ACTIONS[b.motion.action].kind === "gait";
        const rest = (c) => ["sit", "lie", "sleep"].includes(c.motion.posture);
        if (pen > 0.2 && ((am && rest(b)) || (bm && rest(a)))) { out.walkInto += dt; if (out.walkInto <= dt * 1.01) note("walked into", am ? a : b, `${(am ? b : a).id} (${(am ? b : a).motion.action}) by ${pen.toFixed(2)}`); }
        const t0 = overlap.get(key) ?? now;
        overlap.set(key, t0);
        if (now - t0 >= 1 && now - t0 < 1 + dt * 0.99) { out.longOverlaps++; note("in each other", a, `and ${b.id} for a second (${a.motion.action}/${b.motion.action}, ${pen.toFixed(2)})`); }
      }
    }
  }
  return { S, out, tick };
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

if (!isMainThread) {
  parentPort.postMessage(await gardenRun(workerData));
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
  // Both big runs start now and run side by side.
  const plain = inWorker({ traits: false, seconds: SECONDS });
  const characters = inWorker({ traits: true, seconds: SECONDS });

  const report = (t, o) => t.diagnostic(`${o.cats} cats, ${o.minutes} min: ${(o.changes / o.cats / o.minutes).toFixed(2)} changes/cat/min (${(o.changesNoTrans / o.cats / o.minutes).toFixed(2)} without posture changes), ${o.msPerTick?.toFixed(2) ?? "-"} ms/tick; longest creep ${o.creepMax.toFixed(2)} s, walked into resting cats ${o.walkInto.toFixed(2)} s, ${o.longOverlaps} pairs in each other for a second`);
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
  /** Bodies: nobody walks into a resting cat; cats in each other for a second or more are rare. */
  function assertBodies(o, { longOverlaps = 6 } = {}) {
    const why = o.examples.join("\n  ");
    assert.ok(o.walkInto < 0.5, `cats on the move deep in a resting cat's body for ${o.walkInto.toFixed(2)} s:\n  ${why}`);
    assert.ok(o.longOverlaps <= longOverlaps, `${o.longOverlaps} pairs of cats in each other for a second or more (at most ${longOverlaps}):\n  ${why}`);
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
      const o = { ...w.out, minutes: SECONDS / 60 };
      assertMoveLikeCats(o);
      assertBodies(o, { longOverlaps: 0 });
      // The legs step by the distance walked (the old plaza cats stepped 5.2 times too slowly).
      for (const c of m.cats) assert.ok(Math.abs(c.stride - c.motion.odometer * 5.2) < 1e-6, `${label}: ${c.id}'s stride follows its odometer`);
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
    const o = { ...w.out, minutes: 10 };
    t.diagnostic(`${seen.flop} times over on its side, ${seen.roll} onto its back; longest creep ${o.creepMax.toFixed(2)} s`);
    assert.ok(seen.roll > 0 && seen.flop > 0, "the Hall of Fame cats do sprawl and roll in the sun now and then");
    assertMoveLikeCats(o);
    assertBodies(o, { longOverlaps: 0 });
  });

  /** A garden with only the given cats, each placed and given one plain activity (steps), nothing else going on. */
  function scene(defs) {
    const sim = createSanctuary({ residents: defs.map((d) => ({ id: d.id, name: d.id, style: d.style })), reduced: false, critters: null });
    for (const c of sim.cats) { c.act = null; c.perch = null; }
    sim.cats.forEach((c, i) => {
      const d = defs[i];
      Object.assign(c, { x: d.x, z: d.z, y: 0, yaw: d.yaw ?? 0, speed: 0, dest: null, route: null, needs: { sleep: 0, hunger: 0, thirst: 0, play: 0, groom: 0, social: 0, explore: 0 } });
      c.growth = c.growth.map(() => 0);
      c.posture = ACTIONS[d.pose].posture === "lie" ? "lie" : ACTIONS[d.pose].posture;
      Object.assign(c.motion, { action: d.pose, posture: ACTIONS[d.pose].posture, gait: null, u: null, since: -10 });
      c.pose = { sit: "sit", loaf: "loaf", stand: "walk" }[d.pose];
      c.act = { kind: "rest", steps: d.steps, i: 0, t: 0, started: false, reason: "", ignore: new Set() };
    });
    return sim;
  }
  /** A straight stretch of open lawn, clear of props by `room` either side: its two ends. */
  function openLawn(nav, len, room) {
    for (let z = -12; z <= 12; z += 0.5) for (let x = -12; x <= 12 - len; x += 0.5) {
      let ok = true;
      for (let k = -room; k <= room + 1e-9 && ok; k += room / 2) ok = nav.segmentClear(x, z + k, x + len, z + k, null, 0.45) && nav.pointFree(x, z + k, 0.5) && nav.pointFree(x + len, z + k, 0.5);
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
