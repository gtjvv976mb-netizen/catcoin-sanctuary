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
   little mannerisms while it holds a pose. Each cat carries the same fields the garden cats do
   (cat.motion, and pose, position, heading, stride, speed, anim, doing for the shared models), so
   catviews.js draws them the same way.

   Streaming. Only cats near what the camera looks at are simulated at full rate; further out a cat
   that is simply holding a pose is stepped a few times a second, and beyond that it holds it (a
   cat that is walking, turning, getting up or lying down always finishes that at full rate first,
   so nothing jumps). A cat far from the camera is `hidden` (not drawn at all); when the camera
   comes near, it appears, growing in over half a second. */

import { makeRandom } from "./rng.js";
import * as L from "./layout.js";
import { ACTIONS, FIDGETS, SIGNATURES, pickFidget, transDur, transitionPath } from "./catmotion.js";
import { UNWIND, animateShared, publishMotion, snapMotion, traitsFrom, unwindFor } from "./cats.js";

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
  residents.forEach((r, k) => {
    const rnd = makeRandom(`hall:${r.id}`);
    // Spread the cats over the slots evenly, so a small Hall of Fame still rings the fountain.
    const home = slots.length ? slots[Math.floor((k * slots.length) / Math.max(residents.length, 1)) % slots.length] : { x: H.x + H.fountain.r + 1.2, z: H.z };
    cats.push(makeCat(r, { ...home }, rnd));
  });
  cats.forEach((c, i) => { c.index = startIndex + i; });
  const byIdMap = new Map(cats.map((c) => [c.id, c]));

  function makeCat(r, home, rnd) {
    const t = traitsFrom(r.traits), style = { tempo: 1, ...(r.style && typeof r.style === "object" ? r.style : {}) };
    const old = t.age === "senior", kit = t.age === "kitten", sig = t.signature;
    const j = () => rnd.range(0.93, 1.07);
    const c = {
      id: r.id, name: r.name, model: r.model === "ginger" ? "ginger" : "cat", index: 0, tier: r.tier, meadow: true, hall: true,
      rnd, home, traits: t, style, gentle: t.flags.includes("gentle"),
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
      posture: "sit",
      motion: { action: "sit", posture: "sit", gait: null, u: null, odometer: 0, yawRate: 0, look: null, since: 0 },
      pose: "sit", poseSince: 0, prevPose: "sit",
      anim: { bob: 0, pitch: 0, pivot: 0, roll: 0, rollY: 0, sx: 1, sy: 1, sz: 1 }, rollS: 0,
      plan: [], si: 0, st: 0, started: false, kind: "rest", clip: null, dest: null,
      phase: rnd.range(0, 100), stride: 0, doing: SAY.look, moving: false,
      acc: 0, hidden: true, appear: 0, state: "frozen",
      px: home.x, pz: home.z, pyaw: 0, wa: "sit", wu: null, stalk: false, runIntent: false, pivoting: false, brakeT: Infinity,
      gaitSince: 0, moveSince: 0, slowFor: 0, stopUntil: 0, lookAt: { x: 0, y: 0, z: 0 }, lookOn: false, hopPitch: 0,
    };
    return c;
  }

  /* ── What a cat does next ─────────────────────────────────────────── */

  const dur = (c, a, b) => c.rnd.range(a, b) * c.tune.rhythm;
  const tempo = (c) => clamp(c.style.tempo ?? 1, 0.6, 1.5);
  const hold = (action, d, doing, o) => ({ type: "hold", action, dur: d, doing, ...o });
  const once = (c, action, doing) => hold(action, action === "shake" ? 0.8 : (action === "yawn" ? 2 : 2.2) * tempo(c), doing, { fidget: false });

  /** A free spot near home: on the plaza, clear of the other cats and where they are heading. */
  function spotNear(c, min, max) {
    const rnd = c.rnd;
    for (let t = 0; t < 8; t++) {
      const a = rnd.range(0, 6.28), d = rnd.range(min, max);
      const x = c.home.x + Math.cos(a) * d, z = c.home.z + Math.sin(a) * d;
      if (!L.hallFree(x, z, 0.4) || !L.hallFree((x + c.x) / 2, (z + c.z) / 2, 0.3)) continue;
      if (cats.some((o) => o !== c && (Math.hypot(o.x - x, o.z - z) < 0.95 || (o.dest && Math.hypot(o.dest.x - x, o.dest.z - z) < 0.95)))) continue;
      return { x, z };
    }
    return null;
  }

  /** Picks what a cat does next near its home, by its character. */
  function choose(c) {
    const rnd = c.rnd, t = c.traits, steps = [];
    c.dest = null;
    const lying = c.posture === "lie" || c.posture === "sleep", sitting = c.posture === "sit";
    const w = {
      stroll: 0.3 * (0.5 + t.energy) * (0.6 + 0.8 * t.curious) * (Math.hypot(c.x - c.home.x, c.z - c.home.z) > ROAM ? 3 : 1),
      look: 0.26 * (0.6 + 0.5 * t.curious + 0.3 * t.proud) + (sitting ? 0.15 : 0),
      groom: 0.14 * (0.6 + 0.8 * t.proud),
      loaf: 0.16 * (0.6 + 0.8 * t.sleepy) + (lying ? 0.15 : 0),
      nap: 0.16 * (0.4 + 1.2 * t.sleepy) * (c.kind === "nap" ? 0.2 : 1),
      sun: c.gentle ? 0 : 0.05 * (0.4 + t.sleepy + t.playful * 0.5),
    };
    if (c.kind && w[c.kind]) w[c.kind] *= 0.5; // not the same again, as a rule
    let r = rnd.next() * Object.values(w).reduce((s, v) => s + v, 0), kind = "look";
    for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) { kind = k; break; } }
    if (kind === "stroll") {
      const far = Math.hypot(c.x - c.home.x, c.z - c.home.z) > ROAM;
      const s = far ? { x: c.home.x, z: c.home.z } : spotNear(c, 0.8, ROAM);
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
    else if (kind === "sun") steps.push(hold("flop", dur(c, 15, 35), SAY.flop)); // down, and over on its side in the warmth
    else if (kind === "nap") {
      if (c.posture === "stand" || c.posture === "sit") steps.push({ type: "circle", turns: rnd.range(0.8, 1.4), doing: SAY.settle });
      steps.push(hold("loaf", dur(c, 2.5, 5), SAY.settle, { fidget: false, look: true }));
      steps.push(hold("sleep", dur(c, 45, 110) * lerp(0.8, 1.3, t.sleepy), SAY.sleep, { fidget: false }));
      steps.push(hold("loaf", dur(c, 1.5, 3), SAY.wake, { fidget: false, look: true }));
      if (rnd.chance(0.15 + 0.3 * t.sleepy)) steps.push(once(c, "yawn", SAY.yawn));
      steps.push(once(c, "stretch", SAY.stretch));
    }
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
    c.moving = false; c.pivoting = false; c.brakeT = Infinity;
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
      const uw = unwindFor(c, s, time);
      if (uw > 0) { c.plan.splice(c.si, 0, hold(POSTURE_LOOP[c.posture], uw, s.doing || c.doing, { fidget: false })); return true; }
      const want = postureFor(c, s);
      if (want && want !== c.posture) {
        const path = transitionPath(c.posture, want);
        if (path.length) { c.plan.splice(c.si, 0, ...path.map((name) => ({ type: "trans", name, dur: transDur(name, tempo(c)), doing: s.doing }))); return true; }
      }
      c.started = true; c.st = 0; c.fid = null; c.fidAt = null; c.lookNext = 0;
    }
    c.st += dt;
    if (s.doing) c.doing = s.doing;
    switch (s.type) {
      case "trans":
        c.speed = 0; c.lookOn = false;
        c.wa = s.name; c.wu = Math.min(1, c.st / s.dur);
        if (c.st >= s.dur) { c.posture = ACTIONS[s.name].to; return next(); }
        return false;
      case "go": {
        // Straight across the plaza at a stroll, slowing into turns (stepping round on the spot for
        // a sharp one) and braking to a stop where it is going.
        const dx = s.x - c.x, dz = s.z - c.z, d = Math.hypot(dx, dz);
        const shown = c.motion.gait ? time - c.moveSince : 0;
        if (d < 0.1 && (!c.motion.gait || shown >= 0.3)) { c.dest = null; return next(); }
        if (c.st > 40) { c.dest = null; return next(); }
        c.wa = "move"; c.lookOn = false;
        const left = wrap(yawTo(dx, dz) - c.yaw), turn = clamp(left, -TURN * dt, TURN * dt);
        c.yaw = wrap(c.yaw + turn);
        const rest = left - turn;
        let v = Math.min(WALK_MAX, WALK * c.tune.pace) * Math.max(0, Math.cos(Math.min(Math.abs(rest), Math.PI / 2)));
        const vb = Math.sqrt(2 * BRAKE * Math.max(0, d - 0.1));
        if (vb < v) { v = vb; c.brakeT = c.speed / BRAKE; }
        if (shown < MIN_MOVE) v = Math.min(v, Math.max(0.12, (d - 0.1) / (MIN_MOVE - shown)));
        ease(c, v, dt);
        c.speed = Math.min(c.speed, d / Math.max(dt, 1e-3)); // never past the spot
        advance(c, dt);
        if (c.speed < 0.25 && Math.abs(rest) > PIVOT_MIN) c.pivoting = true;
        return false;
      }
      case "circle": {
        if (s.turned == null) { s.turned = 0; s.dir = c.rnd.chance(0.5) ? 1 : -1; }
        const total = s.turns * Math.PI * 2, left = total - s.turned, R = 0.2;
        if (left <= 1e-4) { c.speed = 0; return next(); }
        c.wa = "move"; c.lookOn = false;
        ease(c, 0.4 * Math.min(1, Math.max(0.2, left / 0.9)) * Math.min(1, c.tune.pace + 0.1), dt);
        const turn = Math.min(left, (Math.max(c.speed, 0.08) / R) * dt);
        c.yaw = wrap(c.yaw + s.dir * turn); s.turned += turn;
        advance(c, dt);
        return false;
      }
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
      else { const a = c.yaw + rnd.range(-1.1, 1.1), d = rnd.range(2, 6); L0.x = c.x + Math.cos(a) * d; L0.z = c.z - Math.sin(a) * d; L0.y = rnd.range(0, 0.7); c.lookOn = true; }
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
    const posture = ACTIONS[s.action].posture, name = pickFidget(c.traits, posture, rnd.next);
    if (!name || name === s.action || ACTIONS[name]?.posture !== posture || (c.gentle && COMEDY.has(name))) return s.action;
    if (ACTIONS[name].kind === "once" && UNWIND[s.action]) return s.action; // no yawn with a paw still at its face
    const isOnce = ACTIONS[name].kind === "once", range = FIDGETS[name]?.dur || [2, 4];
    const d = isOnce ? (name === "shake" ? 0.8 : name === "yawn" ? 2 * tempo(c) : 2.2 * tempo(c)) : rnd.range(range[0], range[1]) * c.tune.rhythm;
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
      const pose = c.rnd.pick(["sit", "loaf", "sleep", "loaf"]);
      snapMotion(c, pose, time);
      c.doing = pose === "sleep" ? SAY.sleep : pose === "sit" ? SAY.look : SAY.loaf;
      c.plan = [hold(pose, Infinity, c.doing, { fidget: false })]; c.si = 0; c.started = true; c.st = 0; c.fid = null;
      c.clip = null; c.speed = 0; c.moving = false; c.kind = "rest";
      c.y = L.groundHeight(c.x, c.z);
      const a = c.anim; a.bob = 0; a.pitch = 0; a.pivot = 0; a.roll = 0; a.rollY = 0; a.sx = a.sy = a.sz = 1; c.rollS = 0;
    }
  }

  // Start mid-afternoon: everyone somewhere near home, doing something.
  for (const c of cats) warm(c);
  if (isReduced) settleAll();

  function update(dt) {
    time += dt;
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
