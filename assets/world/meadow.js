/* The Hall of Fame cats: the legendary cat coins that already exist (data/famous.json), living
   together on the Hall of Fame plaza in the first meadow ring (layout.js HALL_OF_FAME), apart from
   the adoptable cats in the garden. The meadow rings themselves are kept free for adoptable cats
   still to come.

   No three.js here (it runs under plain Node too). Each cat has a home spot on the plaza, round
   the fountain (the biggest coins nearest it), and a simple life round it: stroll a few steps,
   sit and look about, loaf, have a wash, nap. They leave on each cat the same fields cats.js does
   (pose, position, heading, stride, speed, anim, doing), so catviews.js draws them the same way.

   Streaming. Only cats near what the camera looks at are simulated at full rate; further out they
   are stepped a few times a second, and beyond that they rest where they are (a cat mid-stroll
   finishes its walk first). A cat far from the camera is `hidden` (not drawn at all); when the
   camera comes near, it appears, growing in over half a second. */

import { makeRandom } from "./rng.js";
import * as L from "./layout.js";

/** Distances (from the point the camera looks at, and from the camera itself). */
export const STREAM = { active: 30, lazy: 62, lazyStep: 0.3, draw: 115, appear: 0.5 };

const SAY = {
  look: "Watching the fountain", sit: "Sitting on the plaza", loaf: "Loafing on the warm stones", sleep: "Napping in the Hall of Fame",
  groom: "Having a wash", walk: "Strolling round the plaza", pond: "Watching the pond", sun: "Basking in the sun",
};
const ROAM = 2.6; // how far a Hall of Fame cat strolls from home

/**
 * @param {object} o
 * @param {Array} o.residents  [{ id, name, model?: "cat" | "ginger" }], biggest first
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
    return {
      id: r.id, name: r.name, model: r.model === "ginger" ? "ginger" : "cat", index: 0, tier: r.tier, meadow: true, hall: true,
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
        if (L.hallFree(x, z, 0.4) && L.hallFree((x + c.x) / 2, (z + c.z) / 2, 0.3)) return walkTo(c, x, z);
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
