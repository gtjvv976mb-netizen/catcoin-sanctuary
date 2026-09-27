/* The cats move like cats. Runs the garden (assets/world/cats.js, 247 cats) and the Hall of Fame
   (assets/world/meadow.js) as a 60 fps page would, for two minutes, and watches every cat's
   cat.motion tick by tick:
   - what it shows changes rarely (a cat is not a flickering thing): at most 8 changes a minute;
   - no action is seen for less than a quarter of a second, except one-offs and posture changes
     (which last their own length);
   - no posture change skips catmotion's transitions (no sitting cat pops up to walking);
   - a cat in a mannerism far from its posture's own pose (a paw at its face, over on its side, up
     on its hind legs) settles back into that pose before it changes posture, moves off or yawns;
   - gaits change at most once in half a second;
   - nothing sits, lies or sleeps while it is moving;
   - character shows: a sleepy cat sleeps far more than a lively one, a lazy cat never runs, a
     gentle (memorial) cat never rolls about or races.
   The two big garden runs go in worker threads (this file again, below), side by side. */

import { isMainThread, parentPort, workerData, Worker } from "node:worker_threads";
import { readFileSync } from "node:fs";
import { createSanctuary, POSES, UNWIND } from "../assets/world/cats.js";
import { createMeadow } from "../assets/world/meadow.js";
import { ACTIONS } from "../assets/world/catmotion.js";
import * as L from "../assets/world/layout.js";

const DT = 1 / 60;
const SECONDS = 120;
const base = (p) => (p === "move" || p === "air" ? "stand" : p);
const RESTING = new Set(["sit", "lie", "sleep"]);

/** Watches cats' motion tick by tick; returns plain numbers and the first few examples of anything wrong. */
function watcher(cats) {
  const S = cats.map((c) => ({ action: c.motion.action, since: -Infinity, gait: c.motion.gait, gaitAt: -Infinity, odo: c.motion.odometer, x: c.x, z: c.z, sleep: 0, fast: 0 }));
  const out = { cats: cats.length, changes: 0, changesNoTrans: 0, short: 0, skips: 0, unsettled: 0, fastGaits: 0, restMoving: 0, invalid: 0, jumps: 0, examples: [] };
  const note = (kind, c, what) => { if (out.examples.length < 12) out.examples.push(`${kind} ${c.id}: ${what}`); };
  function tick(now, dt) {
    for (let i = 0; i < cats.length; i++) {
      const c = cats[i], m = c.motion, s = S[i], A = ACTIONS[m.action];
      // A motion the view can play: a known action, its own posture, progress only where it means something.
      const uOk = A && (A.kind === "once" || A.kind === "trans" ? m.u >= 0 && m.u <= 1 : m.u == null);
      if (!A || m.posture !== A.posture || !uOk || !(m.odometer >= s.odo) || !POSES.includes(c.pose)) { out.invalid++; note("invalid", c, `${m.action} ${m.posture} u=${m.u} pose=${c.pose}`); }
      if (Math.hypot(c.x - s.x, c.z - s.z) > 0.12) { out.jumps++; note("jump", c, `${Math.hypot(c.x - s.x, c.z - s.z).toFixed(2)} in one tick`); }
      s.x = c.x; s.z = c.z;
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
      s.action = m.action; s.since = now;
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
  const w = watcher(sim.cats);
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

  const report = (t, o) => t.diagnostic(`${o.cats} cats, ${o.minutes} min: ${(o.changes / o.cats / o.minutes).toFixed(2)} changes/cat/min (${(o.changesNoTrans / o.cats / o.minutes).toFixed(2)} without posture changes), ${o.msPerTick?.toFixed(2) ?? "-"} ms/tick`);
  function assertMoveLikeCats(o) {
    const why = o.examples.join("\n  ");
    assert.equal(o.invalid, 0, `motion the view cannot play:\n  ${why}`);
    assert.equal(o.short, 0, `actions seen for less than 0.25 s:\n  ${why}`);
    assert.equal(o.skips, 0, `posture changes without their transition:\n  ${why}`);
    assert.equal(o.unsettled, 0, `straight out of a paw wash, a sprawl or a stretch up a trunk into something else:\n  ${why}`);
    assert.equal(o.fastGaits, 0, `gait changes less than 0.5 s apart:\n  ${why}`);
    assert.equal(o.restMoving, 0, `sitting, lying or asleep while moving:\n  ${why}`);
    assert.equal(o.jumps, 0, `cats jumping across the ground:\n  ${why}`);
    const perMin = o.changes / o.cats / o.minutes;
    assert.ok(perMin <= 8, `${perMin.toFixed(2)} changes per cat per minute (at most 8)`);
  }

  test("garden cats with no character of their own move like cats", async (t) => {
    const o = await plain;
    report(t, o);
    assertMoveLikeCats(o);
  });

  test("garden cats with characters move like cats, and their characters show", async (t) => {
    const o = await characters;
    report(t, o);
    for (const [g, v] of Object.entries(o.groups)) t.diagnostic(`${g}: asleep ${(v.sleepShare * 100).toFixed(0)}% of the time, walked ${v.distance.toFixed(1)}, trotting or running ${v.fastSeconds.toFixed(1)} s`);
    assertMoveLikeCats(o);
    const { sleepy, lively } = o.groups;
    assert.ok(sleepy.sleepShare > 2 * lively.sleepShare + 0.05, `a sleepy cat sleeps far more than a lively one (${sleepy.sleepShare.toFixed(2)} vs ${lively.sleepShare.toFixed(2)})`);
    assert.ok(lively.distance > 1.5 * sleepy.distance, `a lively cat gets about more (${lively.distance.toFixed(1)} vs ${sleepy.distance.toFixed(1)})`);
    assert.equal(o.sleepyMaxFast, 0, "a lazy cat never trots or runs");
    for (const a of ["roll", "flop", "run"]) assert.ok(!o.gentleActions.includes(a), `a gentle (memorial) cat never does "${a}"`);
  });

  test("Hall of Fame cats move like cats, near the camera and far from it", () => {
    const rows = (() => { try { return Object.values(JSON.parse(readFileSync(new URL("../data/traits.json", import.meta.url), "utf8")).cats || {}); } catch { return []; } })();
    const H = L.HALL_OF_FAME;
    for (const [label, focus, eye] of [["near", [H.x, H.z], [H.x, H.z + 20]], ["far off, stepped lazily", [H.x + 45, H.z], [H.x, H.z + 40]], ["further off", [H.x + 80, H.z], [H.x, H.z + 60]]]) {
      const residents = Array.from({ length: 21 }, (_, i) => ({ id: `hall-${i}`, name: `Hall ${i}`, traits: i % 2 && rows.length ? rows[(i * 7) % rows.length] : undefined }));
      const m = createMeadow({ residents, startIndex: 247 });
      m.setFocus(focus[0], focus[1], eye[0], eye[1]);
      const w = watcher(m.cats);
      for (let f = 1; f <= SECONDS / DT; f++) { m.update(DT); w.tick(f * DT, DT); }
      const o = { ...w.out, minutes: SECONDS / 60 };
      assertMoveLikeCats(o);
      // The legs step by the distance walked (the old plaza cats stepped 5.2 times too slowly).
      for (const c of m.cats) assert.ok(Math.abs(c.stride - c.motion.odometer * 5.2) < 1e-6, `${label}: ${c.id}'s stride follows its odometer`);
      assert.ok(m.cats.some((c) => c.motion.odometer > 0.5) || label !== "near", `${label}: some cats stroll about`);
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
