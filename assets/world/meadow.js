/* The Hall of Fame cats: the legendary cat coins that already exist (data/famous.json), living
   together on the Hall of Fame plaza in the first meadow ring (layout.js HALL_OF_FAME), apart from
   the adoptable cats in the garden. The meadow rings themselves are kept free for adoptable cats
   still to come.

   No three.js here (it runs under plain Node too). Each cat has a home spot on the plaza, round
   the fountain (the biggest coins nearest it), and a simple life round it, chosen by its
   character (traits, as in cats.js): stroll a few steps and sniff about, sit and look about (at
   you, now and then), have a wash, loaf, sprawl in the sun, turn round and curl up for a nap. It
   moves by the same rules as the garden cats (cats.js): posture changes through catmotion's
   transitions, gaits with hysteresis, speeds that pick up and fall off, turns made in small steps,
   little mannerisms while it holds a pose, and a big cat moves and takes up room as a big one does
   (its speeds, turns and moves by catmotion gaitScale; a home slot with room for its body; every
   body check by both cats' sizes). Each cat carries the same fields the garden cats do
   (cat.motion, and pose, position, heading, stride, speed, anim, doing for the shared models), so
   catviews.js draws them the same way.

   Streaming. Only cats near what the camera looks at are simulated at full rate; further out a cat
   that is simply holding a pose is stepped a few times a second, and beyond that it holds it (a
   cat that is walking, turning, getting up or lying down always finishes that at full rate first,
   so nothing jumps). A cat far from the camera is `hidden` (not drawn at all); when the camera
   comes near, it appears, growing in over half a second. */

import { makeRandom } from "./rng.js";
import * as L from "./layout.js";
import { ACTIONS, FIDGETS, SIGNATURES, allowedAction, canDo, gaitScale, pickFidget, transDur, transitionPath } from "./catmotion.js";
import { BIG_SIZE, BODY, HALF_LEN, SHUFFLE, UNWIND, V_MIN, animateShared, bodyGap, circleStep, leadFidget, pathGap, publishMotion, sizeOf, snapMotion, traitsFrom, unwindFor } from "./cats.js";

/** Distances (from the point the camera looks at, and from the camera itself). */
export const STREAM = { active: 30, lazy: 62, lazyStep: 0.3, draw: 115, appear: 0.5 };

const SAY = {
  look: "Watching the fountain", sit: "Sitting on the plaza", loaf: "Loafing on the warm stones", sleep: "Napping in the Hall of Fame",
  groom: "Having a wash", walk: "Strolling round the plaza", sun: "Basking in the sun", flop: "Sprawled out in the sun",
  sniff: "Sniffing about", settle: "Turning round before lying down", wake: "Waking up", yawn: "A big yawn", stretch: "A long stretch",
  home: "Heading back to its spot", atYou: "Looking at you", knead: "Kneading", earScratch: "Scratching an ear", legLick: "Washing a hind leg",
  shake: "A good shake", roll: "Rolling in the sun", beckon: "Waving a paw", hindStand: "Up on its hind legs for a better look",
};
const ROAM = 2.6; // how far a Hall of Fame cat strolls from home
const WALK = 0.62, WALK_MAX = 1.1; // strolling speed (an ordinary cat, before its pace), well inside the walk band
const ACCEL = 2.5, BRAKE = 4, TURN = 3.4;
const HEAD_MAX = 1.2, PIVOT_MIN = 0.2, MIN_MOVE = 0.45;
const POSTURE_LOOP = { stand: "stand", sit: "sit", lie: "loaf", sleep: "sleep" };
/** The shared pose (its body's length, cats.js HALF_LEN) of each posture. */
const POSTURE_POSE = { stand: "walk", sit: "sit", lie: "loaf", sleep: "sleep" };
const COMEDY = new Set(["roll", "flop"]);
const baseOf = (p) => (p === "move" || p === "air" ? "stand" : p);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const yawTo = (dx, dz) => Math.atan2(-dz, dx);

/**
 * @param {object} o
 * @param {Array} o.residents  [{ id, name, model?: "cat" | "ginger", traits?, style? }], biggest first
 * @param {number} [o.startIndex]  the first cat's index (after the main garden's cats)
 * @param {boolean} [o.reduced]
 */
export function createMeadow({ residents, startIndex = 0, reduced = false }) {
  const cats = [];
  let isReduced = reduced;
  let focus = { x: 0, z: 0 }, eye = { x: 0, z: 30 };
  let time = 0;

  // Homes: rings round the fountain, filled from the inside out, spaced about 1.5 apart.
  const H = L.HALL_OF_FAME;
  const radii = [];
  for (let rr = H.fountain.r + 1.1; rr < H.r - 0.7; rr += 1.45) radii.push(rr);
  const slots = [];
  radii.forEach((rr, i) => {
    const n = Math.floor((2 * Math.PI * rr) / 1.5);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + i * 0.37;
      const x = H.x + Math.cos(a) * rr, z = H.z + Math.sin(a) * rr;
      if (L.hallFree(x, z, 0.5)) slots.push({ x, z });
    }
  });
  // (A big cat's body needs its neighbours' slots too, and one next to it would sit in its body: a
  // slot too near a big cat's home, for the two of them, is no one's; the rest go as they always have.)
  const homes = [];
  // (and never a slot that is someone's home already: a search round past the big cats' neighbours wrapped
  // round onto the first cat's slot, and the two sat in each other for good)
  const roomy = (s, size) => homes.every((h) => (h.x !== s.x || h.z !== s.z) && (Math.max(size, h.size) < BIG_SIZE || Math.hypot(h.x - s.x, h.z - s.z) >= 1.4 * (size + h.size) * 0.5)) && (size < BIG_SIZE || Math.hypot(s.x - H.x, s.z - H.z) >= H.fountain.r + (HALF_LEN.walk + BODY) * size);
  residents.forEach((r, k) => {
    const rnd = makeRandom(`hall:${r.id}`), size = sizeOf({ style: r.style });
    // Spread the cats over the slots evenly, so a small Hall of Fame still rings the fountain.
    const i0 = slots.length ? Math.floor((k * slots.length) / Math.max(residents.length, 1)) % slots.length : 0;
    let home = null;
    for (let j = 0; j < slots.length && !home; j++) { const s = slots[(i0 + j) % slots.length]; if (roomy(s, size)) home = s; }
    for (let j = 0; j < slots.length && !home; j++) { const s = slots[(i0 + j) % slots.length]; if (homes.every((h) => h.x !== s.x || h.z !== s.z)) home = s; }
    home ||= slots.length ? slots[i0] : { x: H.x + H.fountain.r + 1.2, z: H.z };
    homes.push({ x: home.x, z: home.z, size });
    cats.push(makeCat(r, { ...home }, rnd));
  });
  cats.forEach((c, i) => { c.index = startIndex + i; });
  const byIdMap = new Map(cats.map((c) => [c.id, c]));

  function makeCat(r, home, rnd) {
    const t = traitsFrom(r.traits), style = { tempo: 1, ...(r.style && typeof r.style === "object" ? r.style : {}) };
    const old = t.age === "senior", kit = t.age === "kitten", sig = t.signature;
    const j = () => rnd.range(0.93, 1.07), start = allowedAction(t, "sit"); // (sitting, or standing if its own model can't sit)
    const c = {
      id: r.id, name: r.name, model: r.model === "ginger" ? "ginger" : "cat", index: 0, tier: r.tier, meadow: true, hall: true,
      rnd, home, traits: t, style, gentle: t.flags.includes("gentle"), size: sizeOf({ style }), fr: gaitScale(sizeOf({ style })),
      tune: {
        pace: clamp((0.86 + 0.24 * t.energy + (kit ? 0.04 : 0) - (old ? 0.1 : 0) - (t.build === "chunky" ? 0.05 : 0) - (t.flags.includes("blind") ? 0.14 : 0)) * j(), 0.7, 1.15),
        rhythm: clamp(lerp(1.4, 1.0, t.energy) * (old ? 1.1 : 1) * j(), 0.9, 1.55),
        breath: rnd.range(0.85, 1.15) * (kit ? 1.12 : 1),
      },
      p: {
        viewer: clamp(0.1 + 0.3 * t.social + 0.12 * t.curious + 0.08 * t.bold - 0.1 * t.grumpy + (sig === "slowBlink" || sig === "stareDown" || sig === "headTilt" ? 0.2 : 0), 0.05, 0.6),
        sniff: clamp(0.25 + 0.6 * t.curious, 0.1, 0.9),
        loaf: clamp(0.3 + 0.35 * t.sleepy - 0.15 * t.proud + (sig === "loaf" || sig === "sphinxWatch" ? 0.3 : 0) - (sig === "boxSit" ? 0.2 : 0), 0.1, 0.9),
        fidget: clamp(0.25 + 0.25 * t.energy + 0.15 * t.curious - 0.15 * t.sleepy, 0.12, 0.6),
      },
      x: home.x, y: 0, z: home.z, yaw: rnd.range(-Math.PI, Math.PI), speed: 0,
      posture: start,
      motion: { action: start, posture: start, gait: null, u: null, odometer: 0, yawRate: 0, look: null, since: 0 },
      pose: POSTURE_POSE[start] || "sit", poseSince: 0, prevPose: POSTURE_POSE[start] || "sit",
      anim: { bob: 0, pitch: 0, pivot: 0, roll: 0, rollY: 0, sx: 1, sy: 1, sz: 1 }, rollS: 0,
      plan: [], si: 0, st: 0, started: false, kind: "rest", clip: null, dest: null,
      phase: rnd.range(0, 100), stride: 0, doing: SAY.look, moving: false,
      acc: 0, hidden: true, appear: 0, state: "frozen",
      px: home.x, pz: home.z, pyaw: 0, wa: start, wu: null, stalk: false, runIntent: false, pivoting: false, brakeT: Infinity,
      gaitSince: 0, moveSince: 0, slowFor: 0, stopUntil: 0, lookAt: { x: 0, y: 0, z: 0 }, lookOn: false, hopPitch: 0, wantV: 0, lastWa: start, crowdT: 0,
    };
    return c;
  }

  /* ── What a cat does next ─────────────────────────────────────────── */

  const dur = (c, a, b) => c.rnd.range(a, b) * c.tune.rhythm;
  const tempo = (c) => clamp(c.style.tempo ?? 1, 0.6, 1.5);
  const hold = (action, d, doing, o) => ({ type: "hold", action, dur: d, doing, ...o });
  // (a big cat's one-off moves and posture changes take gaitScale times as long)
  const once = (c, action, doing) => hold(action, (action === "shake" ? 0.8 : (action === "yawn" ? 2 : 2.2) * tempo(c)) * c.fr, doing, { fidget: false });
  /** How far apart two cats may be with their bodies still touching: the window a body check looks in. */
  const reach = (a, b) => Math.max(2.5, 0.8 * (a.size + b.size) + 0.3);

  /** A free spot near home: on the plaza, clear of the other cats (by their size) and where they are
      heading, with a clear straight way there (it never walks through a cat lying in the way). */
  function spotNear(c, min, max) {
    const rnd = c.rnd;
    const g = Math.max(1, c.size);
    for (let t = 0; t < 8; t++) {
      const a = rnd.range(0, 6.28), d = rnd.range(min, max);
      const x = c.home.x + Math.cos(a) * d, z = c.home.z + Math.sin(a) * d;
      if (!L.hallFree(x, z, 0.4 * g) || !L.hallFree((x + c.x) / 2, (z + c.z) / 2, 0.3 * g)) continue;
      // (Room to lie down there whichever way it and its neighbours face: both bodies, lying, end to end.)
      if (cats.some((o) => { if (o === c) return false; const r = (HALF_LEN.loaf + BODY) * (c.size + o.size) + 0.05; return Math.hypot(o.x - x, o.z - z) < r || (o.dest && Math.hypot(o.dest.x - x, o.dest.z - z) < r) || pathGap(c, c.x, c.z, x, z, o) < 0.1; })) continue;
      return { x, z };
    }
    return null;
  }
  /** Room to turn round on the spot (a circle of CIRCLE_R, its body swinging round) clear of every other cat. */
  function roomToTurn(c) {
    for (const o of cats) {
      const w = 3 * Math.max(1, (c.size + o.size) * 0.5);
      if (o === c || Math.abs(o.x - c.x) > w || Math.abs(o.z - c.z) > w) continue;
      if (Math.hypot(o.x - c.x, o.z - c.z) < (HALF_LEN.walk + BODY) * c.size + 0.25 + ((HALF_LEN[o.pose] || 0.3) + BODY) * o.size) return false;
    }
    return true;
  }
  /** The cat whose body `c` would be in, standing at (x, z) facing yaw in `pose` (closer than `room`);
      null if none. Every other cat counts at least at its walking length: one sitting or curled up
      there will stand up there, and needs the room. */
  function crowdedBy(c, x, z, yaw, pose, room = 0) {
    for (const o of cats) {
      if (o === c || Math.abs(o.x - x) > reach(c, o) || Math.abs(o.z - z) > reach(c, o)) continue;
      if (bodyGap(c, x, z, yaw, pose, o, HALF_LEN[o.pose] > HALF_LEN.walk ? o.pose : "walk") < room) return o;
    }
    return null;
  }
  /** A spot a short way off where `c` can settle in `pose`, clear of every cat, with a clear way there. */
  function clearNear(c, pose) {
    const rnd = c.rnd;
    for (let t = 0; t < 14; t++) {
      const a = rnd.range(0, 6.28), d = rnd.range(0.5, 1.5) * c.size;
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, yaw = Math.atan2(-(z - c.z), x - c.x);
      if (!L.hallFree(x, z, 0.4 * Math.max(1, c.size)) || crowdedBy(c, x, z, yaw, pose, 0.08)) continue;
      if (cats.some((o) => o !== c && (pathGap(c, c.x, c.z, x, z, o) < 0.03 || (o.dest && Math.hypot(o.dest.x - x, o.dest.z - z) < 1.3 * (c.size + o.size) * 0.5)))) continue;
      return { x, z };
    }
    return null;
  }
  /** A cat (not itself) whose body `c` would walk into with its next step or so towards (dx, dz). */
  function inTheWay(c, dx, dz) {
    const l = Math.hypot(dx, dz) || 1, x = c.x + (dx / l) * 0.15, z = c.z + (dz / l) * 0.15;
    for (const o of cats) {
      if (o === c || o.hidden || Math.abs(o.x - c.x) > reach(c, o) || Math.abs(o.z - c.z) > reach(c, o)) continue;
      const g = bodyGap(c, x, z, c.yaw, "walk", o);
      if (g < 0.03 && g < bodyGap(c, c.x, c.z, c.yaw, "walk", o) - 1e-4) return o;
    }
    return null;
  }

  /** Picks what a cat does next near its home, by its character. */
  function choose(c) {
    const rnd = c.rnd, t = c.traits, steps = [];
    c.dest = null;
    const lying = c.posture === "lie" || c.posture === "sleep", sitting = c.posture === "sit";
    const w = {
      stroll: 0.3 * (0.5 + t.energy) * (0.6 + 0.8 * t.curious) * (Math.hypot(c.x - c.home.x, c.z - c.home.z) > ROAM * c.fr ? 3 : 1),
      look: 0.26 * (0.6 + 0.5 * t.curious + 0.3 * t.proud) + (sitting ? 0.15 : 0),
      groom: 0.14 * (0.6 + 0.8 * t.proud),
      loaf: 0.16 * (0.6 + 0.8 * t.sleepy) + (lying ? 0.15 : 0),
      nap: 0.16 * (0.4 + 1.2 * t.sleepy) * (c.kind === "nap" ? 0.2 : 1),
      sun: c.gentle ? 0 : 0.06 * (0.4 + t.sleepy + t.playful * 0.5),
    };
    if (c.kind && w[c.kind]) w[c.kind] *= 0.5; // not the same again, as a rule
    // (what its own model can't show (traits.avoid) it doesn't set out to do: it would only stand there)
    if (!canDo(t, "groom")) w.groom = 0;
    if (!canDo(t, "loaf")) w.loaf = 0;
    if (!canDo(t, "sleep") && !canDo(t, "loaf")) w.nap = 0;
    if (!canDo(t, "flop")) w.sun = 0;
    let r = rnd.next() * Object.values(w).reduce((s, v) => s + v, 0), kind = "look";
    for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) { kind = k; break; } }
    if (kind === "stroll") {
      const far = Math.hypot(c.x - c.home.x, c.z - c.home.z) > ROAM * c.fr;
      const s = far ? { x: c.home.x, z: c.home.z } : spotNear(c, 0.8 * Math.max(1, c.size), ROAM * c.fr);
      if (!s) kind = "look";
      else {
        c.dest = s;
        steps.push({ type: "go", x: s.x, z: s.z, doing: far ? SAY.home : SAY.walk });
        if (rnd.chance(c.p.sniff * 0.7)) steps.push(hold("sniff", dur(c, 1.5, 3.2), SAY.sniff, { fidget: false }));
        if (t.signature === "hindStand" && rnd.chance(0.5)) steps.push(hold("hindStand", dur(c, 2, 3.5), SAY.hindStand, { look: true, fidget: false }));
        steps.push(rnd.chance(c.p.loaf) ? hold("loaf", dur(c, 20, 45), SAY.loaf, { look: true }) : hold("sit", dur(c, 15, 40), SAY.look, { look: true }));
      }
    }
    if (kind === "look") {
      // A cat known for a seated move (the maneki-neko's beckoning paw, a famous head tilt) does
      // it often, sitting there, not only when a rare fidget happens to pick it.
      const sig = t.signature && SIGNATURES[t.signature];
      if (sig && sig !== "sit" && ACTIONS[sig]?.posture === "sit" && rnd.chance(0.5)) steps.push(hold("sit", dur(c, 2, 5), SAY.look, { look: true, fidget: false }), hold(sig, dur(c, 4, 9), SAY[sig] || SAY.look, { fidget: false }));
      steps.push(hold("sit", dur(c, 15, 40), SAY.look, { look: true }));
    }
    else if (kind === "groom") steps.push(hold("groom", dur(c, 12, 28), SAY.groom));
    else if (kind === "loaf") steps.push(hold("loaf", dur(c, 20, 45), rnd.chance(0.5) ? SAY.loaf : SAY.sun, { look: true }));
    else if (kind === "sun") {
      // Down (it settles in a loaf first: unwindFor), over on its side in the warmth, now and then a
      // wriggle on its back and over on its side again, then a long bask (as the garden cats do).
      steps.push(hold("flop", dur(c, 4, 8), SAY.flop, { fidget: false }));
      if (rnd.chance(0.3 + 0.5 * t.playful)) steps.push(hold("roll", dur(c, 3, 5), SAY.roll, { fidget: false }));
      steps.push(hold("flop", dur(c, 10, 24), SAY.sun));
    }
    else if (kind === "nap") {
      // (Turning round first only with room to: not with its body sweeping through a neighbour.)
      if ((c.posture === "stand" || c.posture === "sit") && roomToTurn(c)) steps.push({ type: "circle", turns: rnd.range(0.8, 1.4), doing: SAY.settle });
      steps.push(hold("loaf", dur(c, 2.5, 5), SAY.settle, { fidget: false, look: true }));
      steps.push(hold("sleep", dur(c, 45, 110) * lerp(0.8, 1.3, t.sleepy), SAY.sleep, { fidget: false }));
      steps.push(hold("loaf", dur(c, 1.5, 3), SAY.wake, { fidget: false, look: true }));
      if (rnd.chance(0.15 + 0.3 * t.sleepy)) steps.push(once(c, "yawn", SAY.yawn));
      steps.push(once(c, "stretch", SAY.stretch));
    }
    // (What its own model can't show (traits.avoid) it doesn't do: the nearest plain pose instead, as long.)
    for (const s of steps) if (s.type === "hold") { const a = allowedAction(c.traits, s.action); if (a !== s.action) { s.action = a; s.fidget = false; } }
    c.kind = kind; c.plan = steps; c.si = 0; c.started = false;
  }

  /* ── Running a cat's plan ─────────────────────────────────────────── */

  function postureFor(c, s) {
    if (s.type === "go" || s.type === "circle") return "stand";
    if (s.type === "hold") return baseOf(ACTIONS[s.action].posture);
    return null;
  }

  function ease(c, v, dt) {
    const a = v > c.speed ? ACCEL : BRAKE;
    c.speed += clamp(v - c.speed, -a * dt, a * dt);
    if (c.speed < 1e-3) c.speed = 0;
  }
  function advance(c, dt) {
    if (c.speed <= 0) return;
    c.x += Math.cos(c.yaw) * c.speed * dt; c.z -= Math.sin(c.yaw) * c.speed * dt;
    c.moving = c.speed > 0.02;
  }

  /** Steps the cat's plan by dt; the next step (and the next plan) start in the same tick. */
  function step(c, dt) {
    c.moving = false; c.pivoting = false; c.brakeT = Infinity; c.wantV = 0;
    c.px = c.x; c.pz = c.z; c.pyaw = c.yaw;
    c.wa = null; c.wu = null;
    for (let k = 0; k < 12; k++) {
      if (c.si >= c.plan.length) choose(c);
      if (!stepOnce(c, k ? 0 : dt)) break;
    }
    if (!c.wa) c.wa = POSTURE_LOOP[c.posture];
    c.y = L.groundHeight(c.x, c.z);
    publishMotion(c, dt, time);
    animateShared(c, dt, time);
    c.clip = ACTIONS[c.motion.action].posture === "sit" && c.motion.action !== "sit" ? c.motion.action : null;
  }

  function stepOnce(c, dt) {
    const s = c.plan[c.si];
    const next = () => { c.si++; c.started = false; return true; };
    if (!c.started) {
      // Pulling up first, or seeing out a gait or a stop only just begun.
      if (s.type !== "go" && s.type !== "circle" && (c.speed > 0.3 || (c.motion.gait && time - c.gaitSince < 0.35) || time < c.stopUntil)) {
        c.wa = "move"; ease(c, 0, dt); c.brakeT = c.speed / BRAKE; advance(c, dt); return false;
      }
      // Out of a paw wash or a sprawl in the sun: back into the plain pose first.
      // (and over onto its side, or its back, only from the pose that leads there: never straight from a loaf onto its back)
      const uw = unwindFor(c, s, time);
      if (uw) { c.plan.splice(c.si, 0, hold(uw.action, uw.dur, s.doing || c.doing, { fidget: false })); return true; }
      const want = postureFor(c, s);
      if (want && want !== c.posture) {
        // (Sitting or lying down where it stands, but in another cat's body there, or where its body
        // standing up again would be in one: it steps clear first.)
        if (c.posture === "stand" && s.type === "hold" && !s.roomed) {
          s.roomed = true;
          const q = (crowdedBy(c, c.x, c.z, c.yaw, POSTURE_POSE[want], -0.02) || crowdedBy(c, c.x, c.z, c.yaw, "walk", -0.02)) && clearNear(c, POSTURE_POSE[want]);
          if (q) { c.dest = q; c.plan.splice(c.si, 0, { type: "go", x: q.x, z: q.z, doing: s.doing || c.doing }); return true; }
        }
        const path = transitionPath(c.posture, want);
        if (path.length) { c.plan.splice(c.si, 0, ...path.map((name) => ({ type: "trans", name, dur: transDur(name, tempo(c)) * c.fr, doing: s.doing }))); return true; }
      }
      c.started = true; c.st = 0; c.fid = null; c.fidAt = null; c.lookNext = 0;
    }
    c.st += dt;
    if (s.doing) c.doing = s.doing;
    switch (s.type) {
      case "trans":
        c.speed = 0; c.lookOn = false;
        c.wa = s.name; c.wu = Math.min(1, c.st / s.dur);
        // (its last frame shown for a tick before what follows: never cut off short of its end)
        if (c.st >= s.dur) { if (!s.ended) { s.ended = true; return false; } c.posture = ACTIONS[s.name].to; return next(); }
        return false;
      case "go": {
        // Straight across the plaza at a stroll, slowing into turns (stepping round on the spot for
        // a sharp one) and braking to a stop where it is going.
        // (A big cat at its own pace, turning and stepping more slowly: gaitScale.)
        const dx = s.x - c.x, dz = s.z - c.z, d = Math.hypot(dx, dz), f = c.fr;
        const going = !!c.motion.gait, shown = going ? time - c.moveSince : 0;
        if (d < 0.1 + (going ? 0.01 : SHUFFLE * Math.max(1, c.size)) && (!going || shown >= 0.3 * f)) { c.dest = null; return next(); }
        if (c.st > 40) { c.dest = null; return next(); }
        // Another cat come into the way (it never walks into one): it stops short, here (once its
        // first steps are seen), and does what it came to do where it is.
        if (inTheWay(c, dx, dz) && (!going || shown >= MIN_MOVE * f)) { c.dest = null; c.plan.splice(c.si + 1, 0, { type: "stop", doing: s.doing }); return next(); }
        c.wa = "move"; c.lookOn = false;
        const left = wrap(yawTo(dx, dz) - c.yaw), turn = clamp(left, -TURN * dt / f, TURN * dt / f);
        c.yaw = wrap(c.yaw + turn);
        const rest = left - turn;
        let v = Math.min(WALK_MAX, WALK * c.tune.pace) * f * Math.max(0, Math.cos(Math.min(Math.abs(rest), Math.PI / 2)));
        const vb = Math.sqrt(2 * BRAKE * Math.max(0, d - 0.1));
        if (vb < v) { v = vb; c.brakeT = c.speed / BRAKE; }
        // Never a creep: a short way is stepped at a walk, and it walks at least V_MIN to its last step
        // (slower only stepping round a sharp turn on the spot).
        const vmin = V_MIN * f, minMove = MIN_MOVE * f;
        if (shown < minMove) v = Math.min(v, Math.max(vmin, (d - 0.1) / (minMove - shown)));
        if (v < vmin && Math.abs(rest) < 0.35 && d > 0.1) v = vmin;
        ease(c, v, dt);
        c.wantV = v;
        c.speed = Math.min(c.speed, d / Math.max(dt, 1e-3)); // never past the spot
        advance(c, dt);
        if (c.speed < 0.25 * f && Math.abs(rest) > PIVOT_MIN) c.pivoting = true;
        return false;
      }
      case "stop":
        // Pulling up short (another cat in the way): a stride or two to a stop.
        c.wa = "move"; ease(c, 0, dt); c.brakeT = c.speed / BRAKE; advance(c, dt);
        if (c.speed <= 0) return next();
        return false;
      case "circle":
        // Round before lying down: an even slow walk round a tight circle, braking in its last step (as in
        // the garden); a cat that has only just stopped stands its moment first.
        if (time < c.stopUntil) return false;
        if (circleStep(c, s, dt)) return next();
        return false;
      case "hold": {
        c.speed = 0; c.posture = baseOf(ACTIONS[s.action].posture);
        const a = fidget(c, s);
        if (a === s.action) {
          c.wa = a; c.wu = ACTIONS[a].kind === "once" ? Math.min(1, c.st / s.dur) : null;
          if (s.look) lookAbout(c, s); else c.lookOn = false;
        }
        if (c.st >= s.dur) return next();
        return false;
      }
      default: return next();
    }
  }

  /** Now and then a quick turn of the head to look about, or at you. */
  function lookAbout(c, s) {
    if (time >= c.lookNext) {
      const rnd = c.rnd, t = c.traits;
      c.lookNext = time + rnd.range(2.2, 6) * (1.35 - 0.7 * t.curious) * (c.posture === "lie" ? 1.4 : 1);
      c.atYou = false;
      const r = rnd.next(), L0 = c.lookAt;
      const toV = wrap(yawTo(eye.x - c.x, eye.z - c.z) - c.yaw);
      if (r < c.p.viewer && Math.abs(toV) <= HEAD_MAX && !(t.grumpy > 0.62 && rnd.chance(0.6))) { L0.x = eye.x; L0.z = eye.z; L0.y = 1.6; c.lookOn = true; c.atYou = true; }
      else if (r < c.p.viewer + 0.25) c.lookOn = false;
      else { const g = Math.max(1, c.size), a = c.yaw + rnd.range(-1.1, 1.1), d = rnd.range(2, 6) * g; L0.x = c.x + Math.cos(a) * d; L0.z = c.z - Math.sin(a) * d; L0.y = rnd.range(0, 0.7) * g; c.lookOn = true; }
    }
    if (c.atYou) c.doing = SAY.atYou;
  }

  /** A mannerism of its own now and then while it holds a pose (as the garden cats do). */
  function fidget(c, s) {
    const f = c.fid;
    if (f) {
      if (c.st < f.end) { c.wa = f.action; c.wu = f.once ? Math.min(1, (c.st - f.t0) / (f.end - f.t0)) : null; c.lookOn = false; if (SAY[f.action]) c.doing = SAY[f.action]; return f.action; }
      c.fid = null;
    }
    if (s.fidget === false || s.dur < 6 || ACTIONS[s.action].kind !== "loop") return s.action;
    const rnd = c.rnd;
    if (c.fidAt == null) c.fidAt = c.st + rnd.range(5, 16) * c.tune.rhythm;
    if (c.st < c.fidAt) return s.action;
    c.fidAt = c.st + rnd.range(12, 28) * c.tune.rhythm;
    if (!rnd.chance(c.p.fidget)) return s.action;
    // (Onto its back only from its side: from a loaf a cat first flops over; the roll can come later, from there.)
    const posture = ACTIONS[s.action].posture, name = leadFidget(pickFidget(c.traits, posture, rnd.next), s.action);
    if (!name || name === s.action || ACTIONS[name]?.posture !== posture || (c.gentle && COMEDY.has(name))) return s.action;
    if (ACTIONS[name].kind === "once" && UNWIND[s.action]) return s.action; // no yawn with a paw still at its face
    const isOnce = ACTIONS[name].kind === "once", range = FIDGETS[name]?.dur || [2, 4];
    const d = isOnce ? (name === "shake" ? 0.8 : name === "yawn" ? 2 * tempo(c) : 2.2 * tempo(c)) * c.fr : rnd.range(range[0], range[1]) * c.tune.rhythm;
    if (s.dur - c.st < d + 1) return s.action;
    c.fid = { action: name, t0: c.st, end: c.st + d, once: isOnce };
    return fidget(c, s);
  }

  /** Quiet: holding a pose (no mannerism under way), so it can be stepped a few times a second. */
  const quiet = (c) => { const s = c.plan[c.si]; return !!s && s.type === "hold" && c.started && !c.fid && ACTIONS[s.action].kind === "loop" && !c.moving && c.speed === 0; };

  /** Starts a cat already partway through what it is doing (at home, holding a pose). */
  function warm(c) {
    choose(c);
    for (let s = c.plan[c.si]; s; s = c.plan[c.si]) {
      if (s.type === "go") { c.x = s.x; c.z = s.z; c.dest = null; }
      else if (s.type === "hold" && ACTIONS[s.action].kind === "loop" && s.dur >= 6 && s.doing !== SAY.settle && s.doing !== SAY.wake) {
        c.started = true; c.st = c.rnd.range(0, s.dur * 0.7); c.fid = null; c.fidAt = null; c.lookNext = 0;
        // (Lying the way it has room to, clear of its neighbours.)
        const pose = POSTURE_POSE[ACTIONS[s.action].posture === "move" ? "stand" : ACTIONS[s.action].posture] || "sit";
        for (let k = 0; k < 12 && crowdedBy(c, c.x, c.z, c.yaw, pose, 0.03); k++) c.yaw += Math.PI / 6;
        snapMotion(c, s.action, time);
        break;
      }
      c.si++;
    }
    c.y = L.groundHeight(c.x, c.z);
    c.px = c.x; c.pz = c.z; c.pyaw = c.yaw;
  }

  function settleAll() {
    for (const c of cats) {
      c.x = c.home.x; c.z = c.home.z; c.dest = null;
      const pose = allowedAction(c.traits, c.rnd.pick(["sit", "loaf", "sleep", "loaf"])); // (one whose model can't sit or lie stands)
      snapMotion(c, pose, time);
      c.doing = pose === "sleep" ? SAY.sleep : pose === "loaf" ? SAY.loaf : SAY.look;
      c.plan = [hold(pose, Infinity, c.doing, { fidget: false })]; c.si = 0; c.started = true; c.st = 0; c.fid = null;
      c.clip = null; c.speed = 0; c.moving = false; c.kind = "rest";
      c.y = L.groundHeight(c.x, c.z);
      const a = c.anim; a.bob = 0; a.pitch = 0; a.pivot = 0; a.roll = 0; a.rollY = 0; a.sx = a.sy = a.sz = 1; c.rollS = 0;
    }
  }

  // Start mid-afternoon: everyone somewhere near home, doing something.
  for (const c of cats) warm(c);
  if (isReduced) settleAll();

  /** Two resting cats in each other (settled or landed too close): the one that settled last gets up
      after a moment and moves over (checked a few times a second; the Hall has few cats). */
  let crowdCheck = 0;
  function makeRoom(dt) {
    if ((crowdCheck += dt) < 0.25) return;
    const span = crowdCheck; crowdCheck = 0;
    for (const c of cats) {
      if (c.hidden || c.moving || !quiet(c) || c.posture === "stand") { c.crowdT = 0; continue; }
      let o = null;
      for (const q of cats) if (q !== c && !q.hidden && Math.abs(q.x - c.x) < reach(c, q) && Math.abs(q.z - c.z) < reach(c, q) && q.motion.since <= c.motion.since && bodyGap(c, c.x, c.z, c.yaw, c.pose, q) < -0.1) { o = q; break; }
      c.crowdT = o ? (c.crowdT || 0) + span : 0;
      if (c.crowdT > 0.6) {
        const q = clearNear(c, POSTURE_POSE[c.posture]);
        if (!q) continue;
        c.crowdT = 0; c.dest = q;
        c.plan = [{ type: "go", x: q.x, z: q.z, doing: SAY.walk }, hold(POSTURE_LOOP[c.posture], dur(c, 15, 40), c.doing, { look: true })]; c.si = 0; c.started = false;
      }
    }
  }

  function update(dt) {
    time += dt;
    if (!isReduced) makeRoom(dt);
    for (const c of cats) {
      const dCam = Math.hypot(c.x - eye.x, c.z - eye.z);
      const show = dCam < STREAM.draw;
      if (show && c.hidden) { c.hidden = false; c.appear = isReduced ? 1 : 0; }
      else if (!show && !c.hidden) { c.hidden = true; }
      if (!isReduced && !c.hidden) {
        const d = Math.hypot(c.x - focus.x, c.z - focus.z);
        // Near the camera's focus, busy (walking, turning, changing posture, a mannerism under way)
        // or growing in: stepped every frame. Otherwise holding a pose: a few times a second, or
        // not at all far off (it simply holds it).
        if (d < STREAM.active || !quiet(c) || c.appear < 1) { c.state = d < STREAM.active ? "active" : "busy"; if (c.acc) { step(c, Math.min(c.acc, 1)); c.acc = 0; } step(c, dt); }
        else if (d < STREAM.lazy) { c.state = "lazy"; c.acc += dt; if (c.acc >= STREAM.lazyStep) { step(c, c.acc); c.acc = 0; } }
        else { c.state = "frozen"; c.acc = 0; }
      }
      if (c.appear < 1) {
        // Growing in over half a second (the animation values were just worked out afresh).
        c.appear = Math.min(1, c.appear + dt / STREAM.appear);
        const k = Math.max(0.01, 1 - (1 - c.appear) ** 3), a = c.anim;
        if (isReduced) { a.sx = a.sy = a.sz = k; } else { a.sx *= k; a.sy *= k; a.sz *= k; }
      }
    }
  }

  return {
    cats,
    update,
    byId: (id) => byIdMap.get(id) || null,
    /** Where the camera looks (the point it orbits) and where it is, on the ground plane. */
    setFocus(fx, fz, ex, ez) { focus.x = fx; focus.z = fz; eye.x = ex; eye.z = ez; },
    setReduced(on) {
      if (on === isReduced) return;
      isReduced = on;
      if (on) settleAll();
      else for (const c of cats) { c.plan = []; c.si = 0; c.started = false; } // each gets up in its own time
    },
    /** How many meadow cats are drawn, and of those how many are simulated at full rate, stepped lazily, or resting unsimulated. */
    counts() {
      let shown = 0, active = 0, lazy = 0;
      for (const c of cats) { if (c.hidden) continue; shown++; if (c.state === "active" || c.state === "busy") active++; else if (c.state === "lazy") lazy++; }
      return { total: cats.length, shown, active, lazy, resting: shown - active - lazy };
    },
    census() { const m = {}; for (const c of cats) { const k = `meadow-${c.kind}`; m[k] = (m[k] || 0) + 1; } return m; },
  };
}
