/* The meadow cats: the famous cat coins that live in the two meadow rings round the fence.

   No three.js here (it runs under plain Node too). Each meadow cat has a home spot in its ring,
   spread evenly by area (the biggest coins of a ring nearest its inner edge), and a simple life
   round it: stroll a few steps, sit and look about, loaf, have a wash, nap. A few live at the
   second pond's edge and watch the water. They leave on each cat the same fields cats.js does
   (pose, position, heading, stride, speed, anim, doing), so catviews.js draws them the same way.

   Streaming. There are hundreds of them, so only the ones near what the camera looks at are
   simulated at full rate; further out they are stepped a few times a second, and beyond that they
   rest where they are (a cat mid-stroll finishes its walk first). A cat far from the camera is
   `hidden` (not drawn at all); when the camera comes near, it appears, growing in over half a
   second, so the rings fill in as you explore. */

import { makeRandom } from "./rng.js";
import * as L from "./layout.js";

/** Distances (from the point the camera looks at, and from the camera itself). */
export const STREAM = { active: 30, lazy: 62, lazyStep: 0.3, draw: 115, appear: 0.5 };

const SAY = {
  look: "Watching the meadow", sit: "Sitting in the long grass", loaf: "Loafing in the grass", sleep: "Napping in the meadow",
  groom: "Having a wash", walk: "Strolling through the meadow", pond: "Watching the pond", sun: "Basking in the sun",
};
const ROAM = 3.6; // how far a meadow cat strolls from home

/**
 * @param {object} o
 * @param {Array} o.residents  [{ id, name, model?: "cat" | "ginger", tier: "ring1" | "ring2" }], biggest first
 * @param {number} [o.startIndex]  the first cat's index (after the main garden's cats)
 * @param {boolean} [o.reduced]
 */
export function createMeadow({ residents, startIndex = 0, reduced = false }) {
  const cats = [];
  let isReduced = reduced;
  let focus = { x: 0, z: 0 }, eye = { x: 0, z: 30 };
  let time = 0;

  // Homes: per ring, evenly by area along a golden-angle spiral, nudged clear of trees, benches and the pond.
  const rings = { ring1: [], ring2: [] };
  for (const r of residents) (rings[r.tier] || rings.ring2).push(r);
  const taken = [];
  const clearOfHomes = (x, z) => taken.every((h) => Math.abs(h.x - x) > 1.4 || Math.abs(h.z - z) > 1.4 || Math.hypot(h.x - x, h.z - z) > 1.4);
  for (const [tier, list] of Object.entries(rings)) {
    const R = L.MEADOW[tier];
    const n = list.length;
    list.forEach((r, k) => {
      const rnd = makeRandom(`meadow:${r.id}`);
      let home = null;
      for (let t = 0; t < 40 && !home; t++) {
        const f = (k + 0.5 + (t ? rnd.range(-0.45, 0.45) : 0)) / Math.max(1, n);
        const rr = Math.sqrt(R.inner ** 2 + f * (R.outer ** 2 - R.inner ** 2)) + (t ? rnd.range(-1.5, 1.5) : 0);
        const a = k * 2.399963 + (tier === "ring2" ? 1.1 : 0.3) + (t ? rnd.range(-0.08, 0.08) : 0);
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        if (L.meadowFree(x, z, 0.8) && clearOfHomes(x, z)) home = { x, z };
      }
      if (!home) { const a = rnd.range(0, 6.28), rr = (R.inner + R.outer) / 2; home = { x: Math.cos(a) * rr, z: Math.sin(a) * rr }; }
      taken.push(home);
      cats.push(makeCat(r, home, rnd));
    });
  }
  // The ring-1 cats nearest the second pond live at its edge.
  for (const spot of L.POND2_SPOTS) {
    let best = null, bd = 14;
    for (const c of cats) {
      if (c.tier !== "ring1" || c.pond) continue;
      const d = Math.hypot(c.home.x - spot.x, c.home.z - spot.z);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) { best.pond = spot; best.home = { x: spot.x, z: spot.z }; }
  }
  cats.forEach((c, i) => { c.index = startIndex + i; });
  const byIdMap = new Map(cats.map((c) => [c.id, c]));

  function makeCat(r, home, rnd) {
    return {
      id: r.id, name: r.name, model: r.model === "ginger" ? "ginger" : "cat", index: 0, tier: r.tier, meadow: true,
      rnd, home, pond: null, pace: rnd.range(0.8, 1.15),
      x: home.x, y: 0, z: home.z, yaw: rnd.range(-Math.PI, Math.PI), speed: 0,
      pose: "sit", poseSince: 0, prevPose: "sit",
      anim: { bob: 0, pitch: 0, pivot: 0, roll: 0, rollY: 0, sx: 1, sy: 1, sz: 1 },
      act: null, clip: null, mode: "rest", until: 0, target: null,
      phase: rnd.range(0, 100), stride: 0, doing: SAY.look, moving: false,
      acc: 0, hidden: true, appear: 0, state: "frozen",
    };
  }

  const setPose = (c, pose) => { if (c.pose !== pose) { c.prevPose = c.pose; c.pose = pose; c.poseSince = time; } };

  /** Picks what a cat does next, at its home. */
  function next(c) {
    const rnd = c.rnd;
    c.clip = null; c.moving = false; c.speed = 0;
    if (c.pond) {
      // Back to its spot at the water, then watch.
      if (Math.hypot(c.x - c.pond.x, c.z - c.pond.z) > 0.3 && rnd.chance(0.8)) return walkTo(c, c.pond.x, c.pond.z);
      if (Math.hypot(c.x - c.pond.x, c.z - c.pond.z) <= 0.3) {
        c.mode = "rest"; c.yaw = c.pond.yaw; setPose(c, rnd.chance(0.75) ? "sit" : "loaf"); c.clip = c.pose === "sit" ? "look" : null;
        c.doing = SAY.pond; c.until = time + rnd.range(10, 30); return;
      }
    }
    const roll = rnd.next();
    if (roll < 0.34) {
      for (let t = 0; t < 8; t++) {
        const a = rnd.range(0, 6.28), d = rnd.range(0.8, ROAM);
        const x = c.home.x + Math.cos(a) * d, z = c.home.z + Math.sin(a) * d;
        if (L.meadowFree(x, z, 0.6)) return walkTo(c, x, z);
      }
    }
    c.mode = "rest";
    if (roll < 0.52) { setPose(c, "sit"); c.clip = "look"; c.doing = SAY.look; c.until = time + rnd.range(6, 16); }
    else if (roll < 0.66) { setPose(c, "sit"); c.clip = "groom"; c.doing = SAY.groom; c.until = time + rnd.range(6, 12); }
    else if (roll < 0.82) { setPose(c, "loaf"); c.doing = rnd.chance(0.5) ? SAY.loaf : SAY.sun; c.until = time + rnd.range(10, 26); }
    else { setPose(c, "sleep"); c.doing = SAY.sleep; c.until = time + rnd.range(18, 45); }
  }

  function walkTo(c, x, z) {
    c.mode = "walk"; c.target = { x, z }; setPose(c, "walk"); c.doing = SAY.walk; c.until = time + 40;
  }

  /** Moves one cat on by dt seconds. */
  function step(c, dt) {
    if (c.mode === "walk" && c.target) {
      const dx = c.target.x - c.x, dz = c.target.z - c.z, d = Math.hypot(dx, dz);
      if (d < 0.08 || time > c.until) { c.target = null; next(c); return; }
      const want = Math.atan2(-dz, dx);
      let turn = want - c.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      c.yaw += Math.max(-3 * dt, Math.min(3 * dt, turn));
      const v = 0.62 * c.pace * (Math.abs(turn) > 1.2 ? 0.35 : 1);
      const s = Math.min(d, v * dt);
      c.x += Math.cos(c.yaw) * s; c.z -= Math.sin(c.yaw) * s;
      c.stride += s; c.speed = v; c.moving = true;
    } else if (time > c.until) next(c);
    c.y = L.groundHeight(c.x, c.z);
  }

  /** A cat about to stop being simulated finishes its walk, so it never freezes mid-stride. */
  function settle(c) {
    if (c.mode === "walk" && c.target) { c.x = c.target.x; c.z = c.target.z; c.target = null; }
    if (c.pose === "walk") { c.mode = "rest"; setPose(c, "loaf"); c.doing = SAY.loaf; c.until = time + c.rnd.range(4, 20); }
    c.speed = 0; c.moving = false;
    c.y = L.groundHeight(c.x, c.z);
  }

  function settleAll() {
    for (const c of cats) {
      c.target = null;
      if (c.pond) { c.x = c.pond.x; c.z = c.pond.z; c.yaw = c.pond.yaw; setPose(c, "sit"); c.doing = SAY.pond; }
      else { c.x = c.home.x; c.z = c.home.z; setPose(c, c.rnd.pick(["sit", "loaf", "sleep", "loaf"])); c.doing = c.pose === "sleep" ? SAY.sleep : c.pose === "sit" ? SAY.look : SAY.loaf; }
      c.mode = "rest"; c.clip = null; c.until = Infinity; c.speed = 0; c.moving = false;
      c.y = L.groundHeight(c.x, c.z);
    }
  }

  // Start mid-afternoon: everyone somewhere near home, doing something.
  for (const c of cats) { next(c); if (c.mode === "walk") settle(c); c.y = L.groundHeight(c.x, c.z); }
  if (isReduced) settleAll();

  function update(dt) {
    time += dt;
    for (const c of cats) {
      const dCam = Math.hypot(c.x - eye.x, c.z - eye.z);
      const show = dCam < STREAM.draw;
      if (show && c.hidden) { c.hidden = false; c.appear = isReduced ? 1 : 0; }
      else if (!show && !c.hidden) { c.hidden = true; }
      if (c.appear < 1) {
        c.appear = Math.min(1, c.appear + dt / STREAM.appear);
        const k = 1 - (1 - c.appear) ** 3;
        c.anim.sx = c.anim.sy = c.anim.sz = Math.max(0.01, k);
      }
      if (isReduced || c.hidden) continue;
      const d = Math.hypot(c.x - focus.x, c.z - focus.z);
      if (d < STREAM.active) { c.state = "active"; if (c.acc) { step(c, Math.min(c.acc, 1)); c.acc = 0; } step(c, dt); }
      else if (d < STREAM.lazy) {
        c.state = "lazy";
        c.acc += dt;
        if (c.acc >= STREAM.lazyStep) { step(c, c.acc); c.acc = 0; }
      } else if (c.state !== "frozen") { settle(c); c.state = "frozen"; c.acc = 0; }
    }
  }

  return {
    cats,
    update,
    byId: (id) => byIdMap.get(id) || null,
    /** Where the camera looks (the point it orbits) and where it is, on the ground plane. */
    setFocus(fx, fz, ex, ez) { focus = { x: fx, z: fz }; eye = { x: ex, z: ez }; },
    setReduced(on) { if (on === isReduced) return; isReduced = on; if (on) settleAll(); else for (const c of cats) { c.until = time + c.rnd.range(1, 8); } },
    /** How many meadow cats are drawn, and of those how many are simulated at full rate, stepped lazily, or resting unsimulated. */
    counts() {
      let shown = 0, active = 0, lazy = 0;
      for (const c of cats) { if (c.hidden) continue; shown++; if (c.state === "active") active++; else if (c.state === "lazy") lazy++; }
      return { total: cats.length, shown, active, lazy, resting: shown - active - lazy };
    },
    census() { const m = {}; for (const c of cats) { const k = `meadow-${c.mode}`; m[k] = (m[k] || 0) + 1; } return m; },
  };
}
