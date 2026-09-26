/* The cats: what each one wants, where it goes, and how it looks while it does it.

   No three.js here. The simulation works on plain numbers and, every frame, leaves on each
   cat a pose ("sit", "walk", "loaf", "stretch", "sleep"), a position, a heading, and a few
   small animation values (a bob, a tilt, a roll, a breath). catviews.js turns those into
   matrices for the instanced cats.

   How a cat spends its time
   ─────────────────────────
   Each cat carries needs that grow at its own pace: sleep, hunger, thirst, play, grooming,
   company and curiosity. When it finishes one thing it scores every activity it could do
   now (a need, a little whim, and a nudge away from repeating itself) and picks the best:

     nap        walk to a free bed or a patch of sun, turn round, loaf, then sleep; wake with a stretch.
     pile       curl up with friends on the picnic blanket, the big cushion or the mat.
     sunroll    flop down on a sunny lawn and roll from side to side, then bask.
     eat, drink walk to a free bowl or water dish, face it, eat or lap.
     climb      hop up a cat tree to the low platform, sometimes on to the top; hop down later.
     porch      hop onto the bottom porch step and watch the garden.
     play       stalk a ball of yarn, wiggle, pounce; the yarn rolls away.
     chase      invite another cat to a chase: one runs, the other gives chase, then both pant.
     butterfly  stalk a low butterfly and leap at it. The butterfly always gets away.
     bird       creep up on a bird that has landed nearby and swat. The bird always flies off first.
     pond       sit at the pond's edge and watch the water.
     groom      sit and wash, with a small rhythmic tilt.
     follow     tag along behind another cat for a while, then sit near it.
     zoomies    rarely, a short burst of running flat out, then a sit to catch its breath.
     wander     stroll somewhere, then sit and look about or rest.

   Two cats never share a bed, a bowl, a slot or a perch (a place is reserved when a cat heads
   for it). Cats keep a little personal space, steer round the cottage and props on routes from
   nav.js, and are pushed back out of anything they would otherwise walk into.
   Each cat's rhythm (its pace, how sleepy, playful or sociable it is) is seeded from its id,
   so a cat behaves the same way on every visit.
   With reduced motion, every cat settles in one spot and stays there, still.

   The birds and butterflies live in critters.js. The simulation only reads where they are and
   asks them to fly off (`critters.startle`), so it still runs without them (under Node). */

import { makeRandom } from "./rng.js";
import { NavWorld, yawTo, wrapAngle } from "./nav.js";
import * as L from "./layout.js";

export const POSES = ["sit", "walk", "loaf", "stretch", "sleep"];

const NEEDS = ["sleep", "hunger", "thirst", "play", "groom", "social", "explore"];
/** How fast each need grows per second at an average pace (1 = urgent). */
const GROWTH = { sleep: 1 / 160, hunger: 1 / 260, thirst: 1 / 210, play: 1 / 70, groom: 1 / 150, social: 1 / 110, explore: 1 / 70 };

const SPEED = { stroll: 0.72, purpose: 1.02, follow: 1.25, stalk: 0.5, creep: 0.36, pounce: 3.0, zoom: 3.5, flee: 2.35, pursue: 2.5 };
const TURN = { walk: 3.4, zoom: 7.5, still: 2.4 };
/** A cat trying to walk that gets slower than STALL_SPEED (units/s, after being pushed back by
    other cats and props) for STALL_WAIT seconds sits and waits for WAIT_FOR seconds, then tries again. */
const STALL_SPEED = 0.08, STALL_WAIT = 0.45, WAIT_FOR = 1.4;
const WALKING_STEPS = new Set(["go", "chase", "pursue", "follow"]);

/** Plain words for the tag that follows a chosen cat. */
const SAY = {
  bed: "Heading for a nap", napBed: "Napping in a cat bed", napSun: "Napping in the sun", napGrass: "Napping on the grass",
  pileGo: "Off to nap with friends", pile: "Napping in a pile with friends", blanket: "Napping on the picnic blanket",
  settle: "Settling in", wake: "Waking up with a stretch", eatGo: "Off to the food bowl", eat: "Eating", lick: "Licking its whiskers",
  drinkGo: "Off for a drink", drink: "Having a drink", climbGo: "Off to a cat tree", climb: "Climbing the cat tree",
  perch: "Watching from the cat tree", top: "On top of the cat tree", porchGo: "Off to the porch", porch: "Sitting on the porch step",
  play: "Playing with the yarn", stalk: "Stalking the yarn", wiggle: "Getting ready to pounce", pounce: "Pounce!",
  groom: "Having a wash", wander: "Having a look around", look: "Looking around", rest: "Resting a moment",
  zoom: "Zoomies!", pant: "Catching its breath", atYou: "Looking at you", hopDown: "Hopping down", sunLoaf: "Basking in the sun",
  sunGo: "Off to a sunny spot", roll: "Rolling in the sun", bask: "Basking in the sun",
  butterfly: "Stalking a butterfly", leap: "Leaping at a butterfly", missed: "Watching the butterfly get away",
  birdGo: "Creeping up on a bird", swat: "Swat!", birdGone: "Watching the bird fly off",
  pondGo: "Off to the pond", pond: "Watching the pond", dab: "Dabbing at the water",
  invite: "Inviting a friend to play", wait: "Waiting its turn",
};

/**
 * Builds the garden's cat simulation.
 * @param {object} o
 * @param {Array} o.residents  [{id, name, model?: "cat" | "ginger"}]
 * @param {boolean} [o.reduced] reduced motion: every cat settles in one spot
 * @param {object} [o.critters] birds and butterflies: { butterflies: [], birds: [], startle(thing) }
 */
export function createSanctuary({ residents, reduced = false, critters = null }) {
  const nav = new NavWorld({ obstacles: L.obstacles(), walkR: L.GARDEN.walkR, clearR: L.CAT.clearR, bodyR: L.CAT.bodyR });
  const reserved = new Map(); // place id → cat id
  const cats = [];
  const yarns = L.YARNS.map((y) => ({ ...y, vx: 0, vz: 0, q: [0, 0, 0, 1], player: null }));
  const targeted = new Map(); // butterfly or bird → cat id
  let time = 0;
  let isReduced = reduced;
  let viewer = null; // where the person looking is standing (the camera), on the ground plane

  /* ── Places ────────────────────────────────────────────────────────── */

  const reserve = (id, cat) => { if (reserved.has(id) && reserved.get(id) !== cat.id) return false; reserved.set(id, cat.id); cat.holds.add(id); return true; };
  const release = (cat, id) => { if (id == null) { for (const h of cat.holds) if (reserved.get(h) === cat.id) reserved.delete(h); cat.holds.clear(); return; } if (reserved.get(id) === cat.id) reserved.delete(id); cat.holds.delete(id); };
  const free = (id) => !reserved.has(id);

  const WATERS = L.WATERS;
  /** Spots other cats need to reach: the bowl and dish stands, the foot of the stairs and the trees, the pond edge. */
  const STANDS = [...L.BOWLS.map((b) => b.stand), ...WATERS.map((w) => w.stand), L.STEP.ground, ...L.TREES.flatMap((t) => [t.ground, t.landing]), ...L.POND_SPOTS];
  const PILE_SLOTS = L.NAP_PILES.flatMap((p) => p.slots.map((_, k) => ({ id: `${p.id}#${k}`, pile: p, k, ...L.slotAt(p, k) })));
  const inPile = (x, z, pad = 0) => L.NAP_PILES.some((p) => p.r ? Math.hypot(p.x - x, p.z - z) < p.r + pad : Math.hypot(p.x - x, p.z - z) < Math.max(p.w, p.d) / 2 + pad);

  /** Is (x, z) a reasonable place for a cat to stop: clear of props, other cats and their destinations. */
  function spotOk(x, z, self, space = L.CAT.personal * 1.12) {
    if (!nav.pointFree(x, z, L.CAT.clearR + 0.05)) return false;
    for (const c of cats) {
      if (c === self) continue;
      if (Math.abs(c.x - x) < space && Math.abs(c.z - z) < space && Math.hypot(c.x - x, c.z - z) < space) return false;
      if (c.dest && Math.hypot(c.dest.x - x, c.dest.z - z) < space) return false;
    }
    for (const b of L.BEDS) if (Math.hypot(b.x - x, b.z - z) < b.r + 0.5) return false;
    for (const s of L.SUN_PATCHES) if (Math.hypot(s.x - x, s.z - z) < s.r) return false;
    if (inPile(x, z, 0.4)) return false;
    for (const p of STANDS) if (Math.hypot(p.x - x, p.z - z) < 0.85) return false;
    return true;
  }

  /** True when no other cat is sitting (or lying) on this spot. */
  function clearOfCats(p, self, room = 0.7) {
    for (const c of cats) if (c !== self && !c.moving && Math.abs(c.x - p.x) < room && Math.abs(c.z - p.z) < room && Math.hypot(c.x - p.x, c.z - p.z) < room) return false;
    return true;
  }

  /** Before resting or washing where it stands: a cat in someone's way moves aside first,
      and a cat still in the bed, slot or sunny spot it woke in keeps it while it stays. */
  function settleHere(cat, act) {
    if (cat.perch) return [];
    if (STANDS.some((p) => Math.hypot(p.x - cat.x, p.z - cat.z) < 0.85)) {
      const s = randomSpot(cat.rnd, cat, { near: cat, min: 1.4, max: 3.2 }) || randomSpot(cat.rnd, cat);
      if (!s) return null;
      cat.dest = s;
      return [{ type: "go", x: s.x, z: s.z, speed: SPEED.stroll, arrive: 0.25, doing: SAY.wander }];
    }
    for (const b of L.BEDS) {
      if (Math.hypot(b.x - cat.x, b.z - cat.z) > 0.35) continue;
      if (!reserve(b.id, cat)) return null;
      act.ignore.add(b.id);
      return [];
    }
    for (const sp of L.SUN_PATCHES) sp.slots.forEach(([dx, dz], k) => {
      if (Math.hypot(sp.x + dx - cat.x, sp.z + dz - cat.z) < 0.35) reserve(`${sp.id}#${k}`, cat);
    });
    for (const s of PILE_SLOTS) if (Math.hypot(s.x - cat.x, s.z - cat.z) < 0.35) reserve(s.id, cat);
    return [];
  }

  /** A random open spot, preferring the side of the garden people usually look at (the front). */
  function randomSpot(rnd, self, { near = null, min = 0, max = 99, front = 0.62 } = {}) {
    for (let t = 0; t < 60; t++) {
      let x, z;
      if (near) {
        const a = rnd.range(0, Math.PI * 2), d = rnd.range(min, max);
        x = near.x + Math.cos(a) * d; z = near.z + Math.sin(a) * d;
      } else {
        const a = rnd.chance(front) ? rnd.range(-0.5, Math.PI + 0.5) : rnd.range(0, Math.PI * 2);
        const d = Math.sqrt(rnd.range(0.04, 1)) * (L.GARDEN.walkR - 0.8) + 0.6;
        x = Math.cos(a) * d; z = Math.sin(a) * d;
      }
      if (spotOk(x, z, self)) return { x, z };
    }
    return null;
  }

  /* ── The cats ──────────────────────────────────────────────────────── */

  function makeCat(r, i) {
    const rnd = makeRandom(`cat:${r.id}`);
    const traits = {
      pace: rnd.range(0.85, 1.18),     // walking speed
      sleepy: rnd.range(0.7, 1.3),     // how quickly it tires, how long it naps
      playful: rnd.range(0.7, 1.5),
      social: rnd.range(0.5, 1.3),
      climber: rnd.range(0.6, 1.4),
      tidy: rnd.range(0.7, 1.3),
      hungry: rnd.range(0.8, 1.2),
      hunter: rnd.range(0.6, 1.5),     // how keen on butterflies and birds
      rhythm: rnd.range(0.85, 1.2),    // stretches or shortens every timing
      breath: rnd.range(0.85, 1.15),   // its breathing rate
    };
    return {
      id: r.id, name: r.name, model: r.model === "ginger" ? "ginger" : "cat", index: i,
      rnd, traits,
      needs: Object.fromEntries(NEEDS.map((n) => [n, rnd.range(0.05, 0.85)])),
      x: 0, y: 0, z: 0, yaw: rnd.range(-Math.PI, Math.PI), speed: 0,
      pose: "sit", poseSince: 0, prevPose: "sit",
      anim: { bob: 0, pitch: 0, pivot: 0, roll: 0, rollY: 0, sx: 1, sy: 1, sz: 1 },
      act: null, last: null, lastZoom: -999, holds: new Set(), dest: null, perch: null, cool: {},
      phase: rnd.range(0, 100), stride: 0, doing: SAY.look, moving: false, route: null, stall: 0, waitUntil: 0, px: 0, pz: 0,
    };
  }

  residents.forEach((r, i) => cats.push(makeCat(r, i)));
  const byIdMap = new Map(cats.map((c) => [c.id, c]));

  /* ── Choosing what to do ───────────────────────────────────────────── */

  function freeSleepPlaces(cat) {
    const out = [];
    for (const b of L.BEDS) if (free(b.id)) out.push({ id: b.id, x: b.x, z: b.z, y: b.y, kind: "bed", ignore: b.id });
    for (const s of L.SUN_PATCHES) s.slots.forEach(([dx, dz], k) => { const id = `${s.id}#${k}`; if (free(id)) out.push({ id, x: s.x + dx, z: s.z + dz, y: 0, kind: "sun" }); });
    return out.filter((p) => p.kind === "bed" || clearOfCats(p, cat, 0.9));
  }
  const near = (cat, list, max) => list.filter((p) => Math.abs(p.x - cat.x) < max && Math.abs(p.z - cat.z) < max && Math.hypot(p.x - cat.x, p.z - cat.z) < max);

  function leaders(cat) {
    return cats.filter((c) => c !== cat && c.moving && c.y < 0.05 && c.act && !["follow", "zoomies", "chase", "chased"].includes(c.act.kind)
      && Math.abs(c.x - cat.x) < 7 && Math.abs(c.z - cat.z) < 7);
  }

  /** Cats that would happily drop what they are doing for a chase. */
  function playmates(cat) {
    return cats.filter((c) => c !== cat && !c.perch && c.y < 0.05 && c.act && ["rest", "wander", "groom"].includes(c.act.kind)
      && c.needs.sleep < 0.8 && Math.abs(c.x - cat.x) < 6 && Math.abs(c.z - cat.z) < 6 && Math.hypot(c.x - cat.x, c.z - cat.z) < 6);
  }

  function lowButterflies(cat) {
    if (!critters?.butterflies) return [];
    return critters.butterflies.filter((b) => b.y < 1.5 && !targeted.has(b) && Math.hypot(b.x, b.z) < L.GARDEN.walkR - 0.5
      && Math.abs(b.x - cat.x) < 7 && Math.abs(b.z - cat.z) < 7 && nav.pointFree(b.x, b.z, 0.3));
  }

  function landedBirds(cat) {
    if (!critters?.birds) return [];
    return critters.birds.filter((b) => b.state === "perched" && b.reachable && !targeted.has(b)
      && Math.abs(b.x - cat.x) < 9 && Math.abs(b.z - cat.z) < 9);
  }

  function choose(cat) {
    const n = cat.needs, t = cat.traits, rnd = cat.rnd;
    const opts = [];
    const add = (kind, score) => {
      if (score > 0 && !(cat.cool[kind] > time)) opts.push([kind, score + rnd.range(0, 0.28) - (cat.last === kind ? 0.35 : 0)]);
    };
    add("nap", n.sleep * 1.0 * t.sleepy);
    if (PILE_SLOTS.some((s) => free(s.id))) add("pile", n.sleep * (0.6 + t.social * 0.4) * t.sleepy);
    if (L.SUN_PATCHES.some((s) => s.slots.some((_, k) => free(`${s.id}#${k}`)))) add("sunroll", 0.12 + (n.play * 0.45 + n.sleep * 0.4) * t.playful);
    if (L.BOWLS.some((b) => free(b.id) && clearOfCats(b.stand, cat))) add("eat", n.hunger * 1.15 * t.hungry);
    if (WATERS.some((w) => free(w.id) && clearOfCats(w.stand, cat))) add("drink", n.thirst * 1.05);
    if (yarns.some((y) => !y.player)) add("play", n.play * 1.15 * t.playful);
    if (n.play > 0.3 && playmates(cat).length) add("chase", n.play * 1.45 * t.playful * (0.6 + t.social * 0.5));
    if (n.sleep < 0.75 && lowButterflies(cat).length) add("butterfly", 0.15 + n.play * 1.1 * t.hunter);
    if (n.sleep < 0.85 && landedBirds(cat).length) add("bird", 0.45 + n.play * 0.9 * t.hunter);
    if (L.POND_SPOTS.some((p) => free(p.id))) add("pond", n.explore * 0.62);
    if (L.TREES.some((T) => free(T.low.id) && clearOfCats(T.ground, cat))) add("climb", n.explore * 0.72 * t.climber);
    if (free(L.STEP.id) && clearOfCats(L.STEP.ground, cat)) add("porch", n.explore * 0.5);
    add("groom", n.groom * 0.95 * t.tidy);
    if (leaders(cat).length) add("follow", n.social * 0.9 * t.social);
    add("wander", 0.42 + n.explore * 0.5);
    add("rest", 0.16 + n.sleep * 0.35);
    if (t.playful > 1.0 && time - cat.lastZoom > 120 && n.sleep < 0.5 && rnd.chance(0.04)) opts.push(["zoomies", 3]);
    opts.sort((a, b) => b[1] - a[1]);
    for (const [kind] of opts) { const act = build(cat, kind); if (act) return act; }
    return build(cat, "rest");
  }

  /* ── Building an activity: a list of small steps ───────────────────── */

  const dur = (cat, a, b) => cat.rnd.range(a, b) * cat.traits.rhythm;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const nearest = (cat, list, key = (p) => p) => list.slice().sort((p, q) => dist(key(p), cat) - dist(key(q), cat))[0];

  /** Before anything else, a cat on a perch hops down first. */
  function leavePerch(cat) {
    if (!cat.perch) return [];
    const p = cat.perch;
    return [{ type: "hop", x: p.ground.x, z: p.ground.z, y: 0, dur: 0.5 + p.y * 0.1, apex: 0.25, doing: SAY.hopDown, then: () => { release(cat, p.id); cat.perch = null; } }];
  }

  /** Lie down and sleep where it arrives: circle, loaf, sleep, wake with a stretch. */
  function sleepSteps(cat, say, sleepFor) {
    return [
      { type: "circle", turns: cat.rnd.range(0.9, 1.5), doing: SAY.settle },
      { type: "hold", pose: "loaf", anim: "breathe", dur: dur(cat, 2.5, 5.5), doing: SAY.settle },
      { type: "hold", pose: "sleep", anim: "sleep", dur: sleepFor, doing: say, restore: { sleep: 1.4 / sleepFor } },
      { type: "hold", pose: "stretch", anim: "stretch", dur: 1.9, doing: SAY.wake, then: () => { cat.needs.sleep = Math.min(cat.needs.sleep, 0.08); } },
    ];
  }

  function build(cat, kind) {
    const rnd = cat.rnd, steps = [...leavePerch(cat)];
    const act = { kind, steps, i: 0, t: 0, reason: SAY.look, ignore: new Set() };
    switch (kind) {
      case "nap": {
        const places = freeSleepPlaces(cat);
        let p = null;
        if (places.length) {
          // Nearest-ish, with a little whim; sleepier cats love the sun.
          const scored = places.map((pl) => [pl, dist(pl, cat) * rnd.range(0.7, 1.3) - (pl.kind === "sun" ? cat.traits.sleepy * 0.8 : 0)]);
          scored.sort((a, b) => a[1] - b[1]);
          p = scored[0][0];
          if (dist(p, cat) > 12) p = null; // too far: the grass will do
        }
        let say = SAY.napGrass;
        if (p) {
          if (!reserve(p.id, cat)) return null;
          if (p.ignore) act.ignore.add(p.ignore);
          say = p.kind === "bed" ? SAY.napBed : SAY.napSun;
        } else {
          const s = randomSpot(rnd, cat, { near: cat, min: 0.5, max: 5 }) || randomSpot(rnd, cat, { front: 0.5 });
          if (!s) return null;
          p = { x: s.x, z: s.z, y: 0 };
        }
        act.reason = SAY.bed;
        cat.dest = { x: p.x, z: p.z };
        steps.push({ type: "go", x: p.x, z: p.z, speed: SPEED.purpose, arrive: 0.12, doing: SAY.bed }, ...sleepSteps(cat, say, dur(cat, 16, 38) * cat.traits.sleepy));
        break;
      }
      case "pile": {
        // Prefer a pile that already has a cat or two in it: they nap together.
        const slots = PILE_SLOTS.filter((s) => free(s.id) && clearOfCats(s, cat, 0.6));
        if (!slots.length) return null;
        const score = (s) => dist(s, cat) * rnd.range(0.8, 1.2) - PILE_SLOTS.filter((o) => o.pile === s.pile && reserved.has(o.id)).length * 3;
        const s = slots.sort((a, b) => score(a) - score(b))[0];
        if (dist(s, cat) > 16 || !reserve(s.id, cat)) return null;
        cat.dest = { x: s.x, z: s.z };
        act.reason = SAY.pileGo;
        const say = s.pile.kind === "blanket" ? SAY.blanket : SAY.pile;
        steps.push({ type: "go", x: s.x, z: s.z, speed: SPEED.purpose, arrive: 0.12, doing: SAY.pileGo }, ...sleepSteps(cat, say, dur(cat, 20, 45) * cat.traits.sleepy));
        break;
      }
      case "sunroll": {
        const slots = [];
        for (const sp of L.SUN_PATCHES) sp.slots.forEach(([dx, dz], k) => { const id = `${sp.id}#${k}`; if (free(id)) slots.push({ id, x: sp.x + dx, z: sp.z + dz }); });
        const open = slots.filter((s) => clearOfCats(s, cat, 0.9) && dist(s, cat) < 12);
        if (!open.length) return null;
        const s = nearest(cat, open);
        if (!reserve(s.id, cat)) return null;
        cat.dest = { x: s.x, z: s.z };
        act.reason = SAY.sunGo;
        steps.push(
          { type: "go", x: s.x, z: s.z, speed: SPEED.purpose, arrive: 0.15, doing: SAY.sunGo },
          { type: "turn", yaw: -Math.PI / 2 + rnd.range(-0.6, 0.6), pose: "walk", doing: SAY.sunGo },
          { type: "hold", pose: "loaf", anim: "breathe", dur: dur(cat, 0.8, 1.6), doing: SAY.bask },
          { type: "hold", pose: "loaf", anim: "roll", dur: dur(cat, 4, 7), doing: SAY.roll, restore: { play: 0.08 } },
          { type: "hold", pose: rnd.chance(0.5) ? "sleep" : "loaf", anim: "breathe", dur: dur(cat, 10, 24), doing: SAY.bask, restore: { sleep: 0.02 } },
          { type: "call", fn: () => { cat.needs.play = Math.min(cat.needs.play, 0.3); } },
        );
        break;
      }
      case "eat":
      case "drink": {
        const list = (kind === "eat" ? L.BOWLS : WATERS).filter((b) => free(b.id) && clearOfCats(b.stand, cat));
        if (!list.length) return null;
        const b = nearest(cat, list, (p) => p.stand);
        if (!reserve(b.id, cat)) return null;
        act.ignore.add(b.id); // it may come right up to its own bowl
        cat.dest = { ...b.stand };
        const d = kind === "eat" ? dur(cat, 6, 11) : dur(cat, 4, 7);
        act.reason = kind === "eat" ? SAY.eatGo : SAY.drinkGo;
        steps.push(
          { type: "go", x: b.stand.x, z: b.stand.z, speed: SPEED.purpose, arrive: 0.1, doing: act.reason },
          { type: "turn", yaw: b.yaw, doing: act.reason },
          { type: "hold", pose: "loaf", anim: kind, dur: d, doing: kind === "eat" ? SAY.eat : SAY.drink, restore: kind === "eat" ? { hunger: 1.2 / d } : { thirst: 1.2 / d } },
        );
        if (kind === "eat" && rnd.chance(0.55)) steps.push({ type: "hold", pose: "sit", anim: "groom", dur: dur(cat, 2.5, 4.5), doing: SAY.lick });
        steps.push({ type: "call", fn: () => release(cat, b.id) });
        break;
      }
      case "climb": {
        const trees = L.TREES.filter((T) => free(T.low.id) && clearOfCats(T.ground, cat));
        if (!trees.length) return null;
        const T = nearest(cat, trees, (x) => x.ground);
        if (dist(T.ground, cat) > 14 || !reserve(T.low.id, cat)) return null;
        cat.dest = { ...T.ground };
        act.reason = SAY.climbGo;
        steps.push(
          { type: "go", x: T.ground.x, z: T.ground.z, speed: SPEED.purpose, arrive: 0.12, doing: SAY.climbGo },
          { type: "turn", yaw: yawTo(T.low.x - T.ground.x, T.low.z - T.ground.z), doing: SAY.climb },
          { type: "hold", pose: "loaf", anim: "crouch", dur: 0.55, doing: SAY.climb },
          { type: "hop", x: T.low.x, z: T.low.z, y: T.low.y, dur: 0.62, apex: 0.45, doing: SAY.climb, then: () => { cat.perch = { id: T.low.id, ground: T.ground, y: T.low.y }; } },
          { type: "hold", pose: "sit", anim: "look", dur: dur(cat, 7, 15), doing: SAY.perch, restore: { explore: 0.05 } },
        );
        if (rnd.chance(0.45 * cat.traits.climber)) steps.push({ type: "upTop", tree: T });
        steps.push({ type: "call", fn: () => { cat.needs.explore = 0.1; } });
        break;
      }
      case "porch": {
        const S = L.STEP;
        if (dist(S.ground, cat) > 14 || !reserve(S.id, cat)) return null;
        cat.dest = { ...S.ground };
        act.reason = SAY.porchGo;
        steps.push(
          { type: "go", x: S.ground.x, z: S.ground.z, speed: SPEED.stroll, arrive: 0.1, doing: SAY.porchGo },
          { type: "turn", yaw: yawTo(S.x - S.ground.x, S.z - S.ground.z), doing: SAY.porchGo },
          { type: "hop", x: S.x, z: S.z, y: S.y, dur: 0.42, apex: 0.22, doing: SAY.porchGo, then: () => { cat.perch = { id: S.id, ground: S.ground, y: S.y }; } },
          { type: "turn", yaw: S.sitYaw, pose: "walk", doing: SAY.porch },
          { type: "hold", pose: "sit", anim: "look", dur: dur(cat, 10, 22), doing: SAY.porch, restore: { explore: 0.04 } },
        );
        if (rnd.chance(0.45)) steps.push({ type: "hold", pose: "loaf", anim: "breathe", dur: dur(cat, 8, 16), doing: SAY.porch, restore: { sleep: 0.01 } });
        steps.push({ type: "call", fn: () => { cat.needs.explore = 0.12; } });
        break;
      }
      case "pond": {
        const spots = L.POND_SPOTS.filter((p) => free(p.id) && clearOfCats(p, cat));
        if (!spots.length) return null;
        const p = nearest(cat, spots);
        if (dist(p, cat) > 15 || !reserve(p.id, cat)) return null;
        cat.dest = { x: p.x, z: p.z };
        act.reason = SAY.pondGo;
        steps.push(
          { type: "go", x: p.x, z: p.z, speed: SPEED.stroll, arrive: 0.15, doing: SAY.pondGo },
          { type: "turn", yaw: p.yaw, pose: "walk", doing: SAY.pond },
          { type: "hold", pose: "sit", anim: "watch", dur: dur(cat, 6, 12), doing: SAY.pond, restore: { explore: 0.05 } },
        );
        if (rnd.chance(0.6)) steps.push({ type: "hold", pose: "loaf", anim: "dab", dur: dur(cat, 1.6, 2.6), doing: SAY.dab, restore: { play: 0.05 } });
        steps.push({ type: "hold", pose: rnd.chance(0.5) ? "loaf" : "sit", anim: "watch", dur: dur(cat, 5, 12), doing: SAY.pond, restore: { explore: 0.05 } });
        steps.push({ type: "call", fn: () => { cat.needs.explore = 0.1; } });
        break;
      }
      case "play": {
        const y = nearest(cat, yarns.filter((v) => !v.player));
        if (!y || dist(y, cat) > 13) return null;
        y.player = cat.id;
        act.yarn = y;
        act.reason = SAY.play;
        const pounces = rnd.int(2, 4);
        steps.push({ type: "chase", target: () => y, stopAt: 1.15, speed: SPEED.purpose, until: 14, doing: SAY.stalk });
        for (let k = 0; k < pounces; k++) {
          steps.push(
            { type: "chase", target: () => y, stopAt: 1.2, speed: SPEED.stalk, until: 4, doing: SAY.stalk, skipIfNear: 1.5 },
            { type: "face", target: () => y, doing: SAY.wiggle },
            { type: "hold", pose: "stretch", anim: "wiggle", dur: rnd.range(0.7, 1.4), doing: SAY.wiggle },
            { type: "pounce", yarn: y, doing: SAY.pounce },
            { type: "hold", pose: "sit", anim: "look", dur: rnd.range(0.7, 1.6), doing: SAY.play, restore: { play: 0.12 } },
          );
        }
        steps.push({ type: "call", fn: () => { y.player = null; cat.needs.play = 0.05; } });
        break;
      }
      case "chase": {
        const mates = playmates(cat);
        if (!mates.length) return null;
        const mate = nearest(cat, mates);
        return startChase(cat, mate);
      }
      case "butterfly": {
        const bs = lowButterflies(cat);
        if (!bs.length) return null;
        const b = nearest(cat, bs);
        targeted.set(b, cat.id);
        act.prey = b;
        act.reason = SAY.butterfly;
        const tries = rnd.int(1, 2);
        for (let k = 0; k < tries; k++) {
          steps.push(
            { type: "chase", target: () => b, stopAt: 1.25, speed: k ? SPEED.purpose : SPEED.stalk * 1.3, until: 7, doing: SAY.butterfly, endOk: true, giveUpIf: () => b.y > 2.4 },
            { type: "face", target: () => b, doing: SAY.wiggle },
            { type: "hold", pose: "stretch", anim: "wiggle", dur: rnd.range(0.5, 0.9), doing: SAY.wiggle },
            { type: "hop", to: () => ({ x: b.x, z: b.z }), short: 0.35, y: 0, dur: 0.55, apex: 0.62, reach: true, start: () => critters?.startle?.(b, cat), doing: SAY.leap },
            { type: "hold", pose: "sit", anim: "watchUp", target: () => b, dur: rnd.range(1.4, 2.4), doing: SAY.missed, restore: { play: 0.1 }, tag: "after" },
          );
        }
        steps.push({ type: "call", fn: () => { targeted.delete(b); cat.needs.play = Math.max(0, cat.needs.play - 0.2); } });
        break;
      }
      case "bird": {
        const bs = landedBirds(cat);
        if (!bs.length) return null;
        const b = nearest(cat, bs);
        targeted.set(b, cat.id);
        act.prey = b;
        act.reason = SAY.birdGo;
        const high = b.y > 0.4;
        steps.push(
          { type: "chase", target: () => b, stopAt: high ? 1.0 : 1.5, speed: SPEED.creep * 1.3, until: 10, doing: SAY.birdGo, endOk: true, giveUpIf: () => b.state !== "perched", scareAt: 0.9 },
          { type: "face", target: () => b, doing: SAY.wiggle },
          { type: "hold", pose: "stretch", anim: "wiggle", dur: rnd.range(0.4, 0.8), doing: SAY.wiggle, abortIf: () => b.state !== "perched" },
          { type: "hop", to: () => ({ x: b.x, z: b.z }), short: high ? 0.55 : 0.5, y: 0, dur: 0.5, apex: high ? 0.7 : 0.38, reach: true, start: () => critters?.startle?.(b, cat), doing: SAY.swat },
          { type: "hold", pose: "sit", anim: "watchUp", target: () => b, dur: rnd.range(2, 3.5), doing: SAY.birdGone, restore: { play: 0.15 }, tag: "after" },
          { type: "call", fn: () => { targeted.delete(b); cat.needs.play = Math.max(0, cat.needs.play - 0.3); } },
        );
        break;
      }
      case "groom": {
        act.reason = SAY.groom;
        const pre = settleHere(cat, act);
        if (!pre) return null;
        steps.push(...pre);
        steps.push({ type: "hold", pose: "sit", anim: "groom", dur: dur(cat, 6, 12), doing: SAY.groom, restore: { groom: 0.14 } });
        steps.push({ type: "call", fn: () => { cat.needs.groom = 0.05; } });
        break;
      }
      case "follow": {
        const ls = leaders(cat);
        if (!ls.length) return null;
        const lead = nearest(cat, ls);
        act.lead = lead;
        act.reason = `Following ${lead.name}`;
        steps.push({ type: "follow", lead, until: dur(cat, 9, 17), doing: act.reason });
        steps.push({ type: "call", fn: () => { cat.needs.social = 0.08; } });
        break;
      }
      case "zoomies": {
        cat.lastZoom = time;
        act.reason = SAY.zoom;
        steps.push({ type: "hold", pose: "stretch", anim: "wiggle", dur: 0.5, doing: SAY.zoom });
        let from = { x: cat.x, z: cat.z };
        for (let k = 0; k < rnd.int(3, 4); k++) {
          const s = randomSpot(rnd, cat, { near: from, min: 2.5, max: 5 }) || randomSpot(rnd, cat);
          if (!s) break;
          steps.push({ type: "go", x: s.x, z: s.z, speed: SPEED.zoom, arrive: 0.5, turn: TURN.zoom, doing: SAY.zoom });
          from = s;
        }
        cat.dest = from;
        steps.push({ type: "hold", pose: "sit", anim: "pant", dur: dur(cat, 2.5, 4.5), doing: SAY.pant, restore: { play: 0.1 } });
        break;
      }
      case "wander": {
        const s = randomSpot(rnd, cat, rnd.chance(0.7) ? { near: cat, min: 2.2, max: 6.5 } : {}) || randomSpot(rnd, cat);
        if (!s) return null;
        cat.dest = s;
        act.reason = SAY.wander;
        steps.push({ type: "go", x: s.x, z: s.z, speed: SPEED.stroll, arrive: 0.25, doing: SAY.wander });
        if (rnd.chance(0.6)) steps.push({ type: "hold", pose: "sit", anim: "look", dur: dur(cat, 3, 8), doing: SAY.look, restore: { explore: 0.06 } });
        else steps.push({ type: "hold", pose: "loaf", anim: "breathe", dur: dur(cat, 5, 11), doing: SAY.rest, restore: { explore: 0.04, sleep: 0.004 } });
        break;
      }
      case "rest":
      default: {
        act.kind = "rest";
        act.reason = SAY.rest;
        cat.dest = { x: cat.x, z: cat.z };
        const pre = settleHere(cat, act);
        if (pre) steps.push(...pre);
        steps.push({ type: "hold", pose: rnd.chance(0.5) ? "loaf" : "sit", anim: "breathe", dur: dur(cat, 5, 12), doing: SAY.rest, restore: { sleep: 0.006 } });
      }
    }
    return act;
  }

  /** A chase for two: `runner` dashes about the lawn, `chaser` gives chase, then both sit and pant.
      Returns the runner's activity; the chaser's starts at once. */
  function startChase(runner, chaser) {
    const rnd = runner.rnd;
    const legs = [];
    let from = { x: runner.x, z: runner.z };
    for (let k = 0; k < rnd.int(3, 4); k++) {
      // Away from the chaser at first, then about the lawn.
      const s = randomSpot(rnd, runner, { near: from, min: 2.6, max: 5.2 });
      if (!s) break;
      legs.push(s);
      from = s;
    }
    if (legs.length < 2) return null;
    const run = { kind: "chase", steps: [], i: 0, t: 0, reason: `Playing chase with ${chaser.name}`, ignore: new Set(), mate: chaser };
    run.steps.push(
      { type: "face", target: () => chaser, doing: SAY.invite },
      { type: "hold", pose: "stretch", anim: "wiggle", dur: 0.6, doing: SAY.invite },
      ...legs.map((s) => ({ type: "go", x: s.x, z: s.z, speed: SPEED.flee, arrive: 0.5, turn: TURN.zoom, doing: `Running from ${chaser.name}` })),
      { type: "face", target: () => chaser, doing: SAY.pant },
      { type: "hold", pose: "sit", anim: "pant", dur: dur(runner, 2.2, 3.6), doing: SAY.pant, restore: { play: 0.15 } },
      { type: "call", fn: () => { runner.needs.play = 0.1; } },
    );
    runner.dest = from;
    const give = { kind: "chased", steps: [], i: 0, t: 0, reason: `Chasing ${runner.name}`, ignore: new Set(), lead: runner };
    give.steps.push(
      { type: "face", target: () => runner, doing: `Chasing ${runner.name}` },
      { type: "hold", pose: "loaf", anim: "crouch", dur: 0.7, doing: SAY.wiggle },
      { type: "pursue", target: runner, stopAt: 1.05, speed: SPEED.pursue, until: 16, doing: `Chasing ${runner.name}`, whileTrue: () => runner.act === run && run.i < run.steps.length - 3 },
      { type: "face", target: () => runner, doing: SAY.pant },
      { type: "hold", pose: "sit", anim: "pant", dur: dur(chaser, 2, 3.4), doing: SAY.pant, restore: { play: 0.15 } },
      { type: "call", fn: () => { chaser.needs.play = 0.12; } },
    );
    begin(chaser, give);
    chaser.dest = null;
    return run;
  }

  /** Swap in a new activity, releasing what the old one held. */
  function begin(cat, act) {
    if (cat.act) finish(cat, false);
    cat.act = act; act.i = 0; act.t = 0; act.started = false;
  }
  function finish(cat, completed) {
    const a = cat.act;
    if (!a) return;
    if (!completed) cat.cool[a.kind] = time + 6; // gave up: try something else for a while
    if (a.yarn && a.yarn.player === cat.id) a.yarn.player = null;
    if (a.prey && targeted.get(a.prey) === cat.id) targeted.delete(a.prey);
    // Places held for the activity are let go, except the perch the cat still sits on.
    for (const h of [...cat.holds]) if (!cat.perch || h !== cat.perch.id) release(cat, h);
    cat.last = a.kind;
    cat.act = null;
    cat.dest = null;
    if (!completed) cat.route = null;
  }

  /* ── Running a step ────────────────────────────────────────────────── */

  function setPose(cat, pose) {
    if (cat.pose !== pose) { cat.prevPose = cat.pose; cat.pose = pose; cat.poseSince = time; }
  }

  /** Turns the cat's heading towards `want` at most `rate` rad/s. Returns the remaining difference. */
  function turnToward(cat, want, rate, dt) {
    const d = wrapAngle(want - cat.yaw);
    const s = Math.max(-rate * dt, Math.min(rate * dt, d));
    cat.yaw = wrapAngle(cat.yaw + s);
    return d - s;
  }

  /** Walk towards (tx, tz) along the cat's current route. Returns "moving", "arrived" or "stuck". */
  function walk(cat, step, tx, tz, dt, speed, arrive, ignore) {
    const act = cat.act;
    // (Re)plan when the target has moved away from the route's end, or on request.
    if (!cat.route || Math.hypot(cat.route.goal.x - tx, cat.route.goal.z - tz) > 0.6 || cat.route.stale) {
      let pts = nav.route(cat.x, cat.z, tx, tz, ignore);
      if (!pts) {
        // The target is tucked against something (a ball of yarn by a bush, say): aim just clear of it.
        const q = { x: tx, z: tz };
        nav.project(q, ignore, nav.clearR + 0.04);
        pts = nav.route(cat.x, cat.z, q.x, q.z, ignore);
      }
      if (!pts) return "stuck";
      cat.route = { pts, i: 0, goal: { x: tx, z: tz }, check: 0, best: Infinity, bestAt: time, replans: (cat.route?.replans || 0) };
    }
    const R = cat.route;
    { const q = { x: tx, z: tz }; nav.project(q, ignore, nav.bodyR + 0.02); tx = q.x; tz = q.z; }
    R.pts[R.pts.length - 1] = { x: tx, z: tz };
    const last = R.pts.length - 1;
    let wp = R.pts[R.i];
    if (R.i < last && Math.hypot(wp.x - cat.x, wp.z - cat.z) < 0.35) { R.i++; wp = R.pts[R.i]; }
    if ((R.check -= dt) <= 0) {
      R.check = 0.3;
      // String-pulling: skip a waypoint once the next one is in plain view.
      while (R.i < last && nav.segmentClear(cat.x, cat.z, R.pts[R.i + 1].x, R.pts[R.i + 1].z, withContaining(ignore, cat))) { R.i++; }
      wp = R.pts[R.i];
    }
    const d0 = Math.hypot(tx - cat.x, tz - cat.z);
    if (d0 < arrive) return "arrived";

    // Progress check: a cat that makes no headway for a while gives up on this route. On the last
    // stretch (a bowl, a stand, a spot beside another cat) it gives up sooner: waiting there looks stuck.
    const near = d0 < 1.6;
    if (d0 < R.best - 0.15) { R.best = d0; R.bestAt = time; }
    else if (time - R.bestAt > (near ? 1.5 : 3.2)) {
      if (R.replans >= (near ? 1 : 2)) return "stuck";
      R.stale = true; R.replans++; R.bestAt = time;
    }

    let dx = wp.x - cat.x, dz = wp.z - cat.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    // Personal space: ease away from other cats nearby, more from ones lying still.
    const room = L.CAT.personal;
    for (const o of cats) {
      if (o === cat || o.y > 0.3) continue;
      const ox = cat.x - o.x, oz = cat.z - o.z;
      if (ox > room || ox < -room || oz > room || oz < -room) continue;
      const d = Math.hypot(ox, oz);
      if (d > room || d < 1e-4) continue;
      if (act && (act.lead === o || act.mate === o) && d > 0.8) continue;
      const w = (room - d) / room * (o.moving ? 1.1 : 1.8);
      dx += (ox / d) * w; dz += (oz / d) * w;
    }
    const want = yawTo(dx, dz);
    const left = turnToward(cat, want, step.turn || TURN.walk, dt);
    // Slow down for sharp turns and on the last stretch, so cats arrive rather than orbit.
    let v = speed * cat.traits.pace * Math.max(0.12, Math.cos(Math.min(Math.abs(left), Math.PI / 2)));
    if (R.i === last) v *= Math.max(0.28, Math.min(1, d0 / 0.9));
    if (Math.abs(left) > 1.9 && d0 < 0.6) v = 0.05;
    cat.speed += (v - cat.speed) * Math.min(1, dt * (speed > 2 ? 6 : 4));
    // Hemmed in (update() noticed it has been getting nowhere): it sits and waits its turn for a
    // moment instead of treading on the spot, then tries again. The progress check above still
    // gives up on the route if the way never opens.
    if (cat.waitUntil > time) { cat.speed = 0; cat.moving = false; cat.doing = SAY.wait; return "moving"; }
    cat.x += Math.cos(cat.yaw) * cat.speed * dt;
    cat.z -= Math.sin(cat.yaw) * cat.speed * dt;
    cat.moving = true;
    return "moving";
  }

  /** The pose for a cat on its way somewhere: walking, or sitting while it waits for room. */
  const walkPose = (cat) => (cat.waitUntil > time ? "sit" : "walk");

  const withContaining = (ignore, cat) => {
    const s = new Set(ignore || []);
    for (const id of nav.containing(cat.x, cat.z)) s.add(id);
    return s;
  };

  function run(cat, dt) {
    const act = cat.act;
    const step = act.steps[act.i];
    if (!step) { finish(cat, true); return; }
    if (!act.started) { act.started = true; act.t = 0; act.ignoreNow = withContaining(act.ignore, cat); cat.route = null; cat.stall = 0; cat.waitUntil = 0; }
    act.t += dt;
    cat.doing = step.doing || act.reason;
    const next = () => { if (step.then) step.then(); act.i++; act.started = false; };
    const abort = () => { finish(cat, false); };

    switch (step.type) {
      case "go": {
        setPose(cat, walkPose(cat));
        const r = walk(cat, step, step.x, step.z, dt, step.speed, step.arrive, act.ignoreNow);
        if (r === "arrived") { next(); cat.route = null; }
        else if (r === "stuck") abort();
        break;
      }
      case "chase": {
        const tg = step.target();
        if (step.giveUpIf && step.giveUpIf()) { cat.speed = 0; skipTo(act, cat); break; }
        const d = Math.hypot(tg.x - cat.x, tg.z - cat.z);
        if (step.skipIfNear && d < step.skipIfNear && act.t < dt * 1.5) { next(); break; }
        if (step.scareAt && d < step.stopAt + step.scareAt && critters?.startle && tg.state === "perched" && cat.rnd.chance(dt * 0.6)) critters.startle(tg, cat);
        // Aim at a point short of the target, on the cat's side of it.
        const k = d > 1e-3 ? Math.max(0, d - step.stopAt) / d : 0;
        const tx = cat.x + (tg.x - cat.x) * k, tz = cat.z + (tg.z - cat.z) * k;
        if (d <= step.stopAt + 0.1) { cat.speed *= 0.5; next(); cat.route = null; break; }
        if (act.t > step.until) { if (step.endOk) { cat.speed = 0; skipTo(act, cat); } else abort(); break; }
        setPose(cat, walkPose(cat));
        const r = walk(cat, step, tx, tz, dt, step.speed, 0.15, act.ignoreNow);
        // Close enough to the point short of its target (a ball of yarn does not move): on to the next step.
        if (r === "arrived") { cat.speed *= 0.5; next(); cat.route = null; }
        else if (r === "stuck") abort();
        break;
      }
      case "pursue": {
        const tg = step.target;
        const d = Math.hypot(tg.x - cat.x, tg.z - cat.z);
        if (!step.whileTrue() || act.t > step.until) { cat.speed *= 0.4; next(); cat.route = null; break; }
        if (d < step.stopAt) { setPose(cat, "sit"); cat.speed = 0; turnToward(cat, yawTo(tg.x - cat.x, tg.z - cat.z), TURN.zoom, dt); break; }
        setPose(cat, walkPose(cat));
        const r = walk(cat, step, tg.x, tg.z, dt, step.speed, step.stopAt * 0.8, act.ignoreNow);
        if (r === "stuck") { next(); cat.route = null; }
        break;
      }
      case "follow": {
        const lead = step.lead;
        if (act.t > step.until || !cats.includes(lead)) { next(); break; }
        const d = Math.hypot(lead.x - cat.x, lead.z - cat.z);
        if (lead.moving && lead.y < 0.05) {
          // Walk a little behind the leader, matching its pace.
          const bx = lead.x - Math.cos(lead.yaw) * 1.3, bz = lead.z + Math.sin(lead.yaw) * 1.3;
          if (Math.hypot(bx - cat.x, bz - cat.z) < 0.3 || d < 1.1) { settleNear(cat, lead, dt); break; }
          setPose(cat, walkPose(cat));
          const r = walk(cat, step, bx, bz, dt, Math.min(SPEED.follow, Math.max(0.6, lead.speed * 1.15 + 0.1)), 0.25, act.ignoreNow);
          if (r === "stuck") { next(); }
        } else {
          // The leader has stopped: sit down near it and watch it.
          if (d > 1.9) {
            setPose(cat, walkPose(cat));
            const a = Math.atan2(cat.z - lead.z, cat.x - lead.x);
            const r = walk(cat, step, lead.x + Math.cos(a) * 1.4, lead.z + Math.sin(a) * 1.4, dt, SPEED.stroll, 0.3, act.ignoreNow);
            if (r === "stuck") next();
          } else settleNear(cat, lead, dt);
        }
        break;
      }
      case "turn": {
        const pose = step.pose || (cat.pose === "walk" ? "walk" : cat.pose);
        setPose(cat, pose);
        cat.speed = 0; cat.moving = false;
        const left = turnToward(cat, step.yaw, TURN.still, dt);
        if (Math.abs(left) < 0.04 || act.t > 3) next();
        break;
      }
      case "face": {
        const tg = step.target();
        cat.speed = 0;
        const left = turnToward(cat, yawTo(tg.x - cat.x, tg.z - cat.z), TURN.still * 1.5, dt);
        if (Math.abs(left) < 0.08 || act.t > 1.2) next();
        break;
      }
      case "circle": {
        // Round and round before lying down, as cats do.
        setPose(cat, "walk");
        cat.moving = false;
        const rate = 2.6;
        cat.yaw = wrapAngle(cat.yaw + rate * dt);
        cat.speed = 0.18;
        cat.x += Math.cos(cat.yaw) * cat.speed * dt;
        cat.z -= Math.sin(cat.yaw) * cat.speed * dt;
        if (act.t * rate >= step.turns * Math.PI * 2) { cat.speed = 0; next(); }
        break;
      }
      case "hold": {
        setPose(cat, step.pose);
        cat.speed = 0; cat.moving = false;
        if (step.abortIf && step.abortIf()) { skipTo(act, cat); break; }
        if (step.restore) for (const [k, v] of Object.entries(step.restore)) cat.needs[k] = Math.max(0, cat.needs[k] - v * dt);
        if (step.anim === "look") lookAbout(cat, dt, act);
        else if (step.anim === "watchUp" && step.target) { const tg = step.target(); turnToward(cat, yawTo(tg.x - cat.x, tg.z - cat.z), 1.6, dt); }
        if (act.t >= step.dur) next();
        break;
      }
      case "hop": {
        if (act.t <= dt) {
          step.from = { x: cat.x, y: cat.y, z: cat.z };
          if (step.to) {
            // A leap at something: land a little short of it (the cat never gets it).
            const tg = step.to(), dx = tg.x - cat.x, dz = tg.z - cat.z, d = Math.hypot(dx, dz) || 1;
            const len = Math.max(0.25, Math.min(1.8, d - step.short));
            const p = { x: cat.x + (dx / d) * len, z: cat.z + (dz / d) * len };
            nav.project(p, act.ignoreNow);
            step.x = p.x; step.z = p.z;
          }
          if (step.start) step.start();
        }
        const f = step.from, u = Math.min(1, act.t / step.dur);
        setPose(cat, "stretch");
        cat.moving = false;
        const top = Math.max(f.y, step.y) + step.apex;
        // A parabola through from.y, top and to.y.
        const e = easeInOut(u);
        cat.x = f.x + (step.x - f.x) * e;
        cat.z = f.z + (step.z - f.z) * e;
        cat.y = quadThrough(f.y, top, step.y, u);
        const hd = Math.hypot(step.x - f.x, step.z - f.z);
        if (hd > 0.05) turnToward(cat, yawTo(step.x - f.x, step.z - f.z), 9, dt);
        cat.hopPitch = Math.atan2(quadSlope(f.y, top, step.y, u), Math.max(0.3, hd)) * 0.7 + (step.reach ? Math.sin(u * Math.PI) * 0.5 : 0);
        if (u >= 1) { cat.y = step.y; cat.hopPitch = 0; next(); }
        break;
      }
      case "upTop": {
        // From the low platform, sometimes on up to the top.
        const T = step.tree;
        if (free(T.high.id) && reserve(T.high.id, cat)) {
          const low = T.low.id;
          act.steps.splice(act.i + 1, 0,
            { type: "turn", yaw: yawTo(T.high.x - T.low.x, T.high.z - T.low.z), pose: "sit", doing: SAY.climb },
            { type: "hop", x: T.high.x, z: T.high.z, y: T.high.y, dur: 0.6, apex: 0.4, doing: SAY.climb, then: () => { release(cat, low); cat.perch = { id: T.high.id, ground: T.landing, y: T.high.y }; } },
            { type: "hold", pose: cat.rnd.chance(0.5) ? "sit" : "loaf", anim: "look", dur: dur(cat, 9, 18), doing: SAY.top, restore: { explore: 0.05 } },
          );
        }
        next();
        break;
      }
      case "pounce": {
        const y = step.yarn;
        if (act.t <= dt) { step.from = { x: cat.x, z: cat.z }; step.len = Math.max(0.4, Math.hypot(y.x - cat.x, y.z - cat.z) - 0.45); }
        setPose(cat, "walk");
        const u = Math.min(1, act.t / 0.42);
        const want = yawTo(y.x - cat.x, y.z - cat.z);
        turnToward(cat, want, 6, dt);
        const v = step.len / 0.42;
        const nx = cat.x + Math.cos(cat.yaw) * v * dt, nz = cat.z - Math.sin(cat.yaw) * v * dt;
        const p = { x: nx, z: nz };
        nav.project(p, act.ignoreNow);
        cat.x = p.x; cat.z = p.z;
        cat.y = Math.sin(u * Math.PI) * 0.28;
        cat.moving = true;
        if (u >= 1 || Math.hypot(y.x - cat.x, y.z - cat.z) < 0.5) {
          cat.y = 0;
          const a = cat.yaw + cat.rnd.range(-0.5, 0.5), s = cat.rnd.range(1.2, 2.3);
          y.vx += Math.cos(a) * s; y.vz -= Math.sin(a) * s;
          cat.moving = false; cat.speed = 0;
          next();
        }
        break;
      }
      case "call": step.fn(); next(); break;
      default: next();
    }
  }

  /** Jumps ahead to the next step tagged "after" (the "watch it get away" at the end of a hunt). */
  function skipTo(act, cat) {
    let j = act.i + 1;
    while (j < act.steps.length && act.steps[j].tag !== "after") j++;
    // Run any "call" steps skipped on the way (they let go of what the cat was after).
    for (let k = act.i + 1; k < j; k++) if (act.steps[k].type === "call") act.steps[k].fn();
    act.i = Math.min(j, act.steps.length);
    act.started = false;
    cat.route = null;
  }

  function settleNear(cat, lead, dt) {
    setPose(cat, "sit");
    cat.speed = 0; cat.moving = false;
    turnToward(cat, yawTo(lead.x - cat.x, lead.z - cat.z), TURN.still, dt);
  }

  /** A sitting cat looks about now and then, turning a little, and sometimes looks at you. */
  function lookAbout(cat, dt, act) {
    if (act.lookAt == null || time > act.lookNext) {
      const atYou = viewer && cat.rnd.chance(0.3);
      act.lookAt = atYou ? yawTo(viewer.x - cat.x, viewer.z - cat.z) : wrapAngle(cat.yaw + cat.rnd.range(-0.9, 0.9));
      // Only a small turn of the body: a cat facing away just glances over.
      const d = wrapAngle(act.lookAt - cat.yaw);
      if (Math.abs(d) > 1.2) act.lookAt = wrapAngle(cat.yaw + Math.sign(d) * 1.2);
      act.lookingAtYou = atYou && Math.abs(d) <= 1.2;
      act.lookNext = time + cat.rnd.range(2.2, 5.5);
    }
    turnToward(cat, act.lookAt, 0.7, dt);
    if (act.lookingAtYou) cat.doing = SAY.atYou;
  }

  /* ── Animation values for the pose ─────────────────────────────────── */

  function animate(cat, dt) {
    const a = cat.anim, t = time + cat.phase, act = cat.act, step = act && act.steps[act.i];
    a.bob = 0; a.pitch = 0; a.pivot = 0; a.roll = 0; a.rollY = 0; a.sx = 1; a.sy = 1; a.sz = 1;
    if (isReduced) return;
    const breath = cat.traits.breath;
    const kind = step && step.type === "hold" ? step.anim : null;
    if (cat.pose === "walk") {
      cat.stride += cat.speed * dt * 5.2;
      const k = Math.min(1, cat.speed / 1.2);
      a.bob = Math.abs(Math.sin(cat.stride)) * (0.035 + 0.03 * k);
      a.pitch = Math.sin(cat.stride * 2) * 0.018 * k;
      a.roll = Math.sin(cat.stride) * 0.025 * k;
      // A springy gait: a little squash as the paws land, a stretch at the top of each step.
      a.sy = 1 + (Math.abs(Math.sin(cat.stride)) - 0.5) * 0.035 * k; a.sx = 1 - (a.sy - 1) * 0.5;
    } else if (cat.pose === "sleep") {
      const s = Math.sin(t * Math.PI * 2 * 0.2 * breath);
      a.sy = 1 + s * 0.028; a.sx = a.sz = 1 + s * 0.012;
    } else if (kind === "roll") {
      // Flopped over, rolling from one side to the other, belly to the sun.
      const u = act.t * 1.1 * breath;
      a.roll = Math.sin(u) * 1.25 + Math.sin(u * 2.3) * 0.12;
      a.rollY = 0.42;
      a.sx = 1.04;
    } else if (kind === "eat") {
      // Head down in the bowl, chewing in little bursts, looking up now and then.
      const cycle = (t * 0.42) % 1, up = cycle > 0.8 ? Math.sin((cycle - 0.8) / 0.2 * Math.PI) : 0;
      a.pivot = 1; a.pitch = -(0.21 + Math.max(0, Math.sin(t * Math.PI * 2 * 1.7)) * 0.06) * (1 - up) - 0.03 * up;
    } else if (kind === "drink") {
      a.pivot = 1; a.pitch = -(0.25 + Math.sin(t * Math.PI * 2 * 4.2) * 0.018);
    } else if (kind === "dab") {
      // Leaning out over the water, dipping a paw.
      a.pivot = 1; a.pitch = -0.16 - Math.max(0, Math.sin(act.t * Math.PI * 2 * 1.3)) * 0.12;
    } else if (kind === "groom") {
      // Licks in bursts, a tilt one way then the other, pauses between.
      const burst = Math.max(0, Math.sin(t * Math.PI * 2 * 0.23));
      const lick = Math.sin(t * Math.PI * 2 * 2.1);
      a.roll = lick * 0.075 * burst + Math.sign(Math.sin(t * 0.37)) * 0.05 * burst;
      a.pitch = -(0.05 + Math.abs(lick) * 0.05) * burst;
    } else if (kind === "stretch") {
      const u = act.t / Math.max(0.1, step.dur), k = Math.sin(Math.min(1, u) * Math.PI);
      a.sx = 1 + k * 0.09; a.sy = 1 - k * 0.05; a.pivot = -1;
    } else if (kind === "wiggle") {
      a.pivot = 1; a.roll = Math.sin(t * Math.PI * 2 * 4.5) * 0.06; a.sy = 0.96;
    } else if (kind === "crouch") {
      a.sy = 0.93; a.sx = 1.03;
    } else if (kind === "pant") {
      const s = Math.sin(t * Math.PI * 2 * 1.6); a.sy = 1 + s * 0.022;
    } else if (kind === "watchUp") {
      // Head up, following what got away.
      a.pivot = 1; a.pitch = 0.16 + Math.sin(t * 1.3) * 0.03;
    } else if (kind === "watch") {
      a.pivot = 1; a.pitch = -0.05 + Math.sin(t * 0.9) * 0.03; a.roll = Math.sin(t * 0.55) * 0.04;
    } else if (cat.pose === "stretch" && step && step.type === "hop") {
      a.pitch = cat.hopPitch || 0; a.pivot = step.reach ? -0.6 : 0;
    } else {
      const s = Math.sin(t * Math.PI * 2 * 0.3 * breath); a.sy = 1 + s * 0.012; a.sx = a.sz = 1 + s * 0.004;
    }
    // A small give as a cat lands in a new resting pose.
    const since = time - cat.poseSince;
    if (since < 0.3 && cat.prevPose === "walk" && cat.pose !== "walk" && cat.pose !== "stretch") a.sy *= 1 - 0.05 * (1 - since / 0.3);
    // Squash and stretch through every change of pose, so one pose melts into the next instead of popping:
    // a quick squash, a small springy overshoot, settled within half a second.
    if (since < 0.5 && cat.prevPose && cat.prevPose !== cat.pose) {
      const u = since / 0.5, w = Math.sin(u * Math.PI * 2.2) * (1 - u) * (1 - u);
      a.sy *= 1 - 0.09 * w; a.sx *= 1 + 0.045 * w; a.sz *= 1 + 0.045 * w;
    }
  }

  /* ── Yarn ──────────────────────────────────────────────────────────── */

  function stepYarn(y, dt) {
    // A walking cat nudges a ball it runs into; a resting one is simply in the way.
    for (const c of cats) {
      if (c.y > 0.3 || c.perch) continue;
      const dx = y.x - c.x, dz = y.z - c.z;
      if (dx > 0.56 || dx < -0.56 || dz > 0.56 || dz < -0.56) continue;
      const d = Math.hypot(dx, dz);
      if (d > 0.56 || d < 1e-4) continue;
      if (c.moving) { const push = Math.max(0, c.speed * 0.9 - Math.hypot(y.vx, y.vz)); y.vx += (dx / d) * push; y.vz += (dz / d) * push; }
      else { y.x = c.x + (dx / d) * 0.56; y.z = c.z + (dz / d) * 0.56; }
    }
    const sp = Math.hypot(y.vx, y.vz);
    if (sp < 1e-3) { y.vx = y.vz = 0; return; }
    const ox = y.x, oz = y.z;
    y.x += y.vx * dt; y.z += y.vz * dt;
    const p = { x: y.x, z: y.z };
    if (nav.project(p, null, y.r)) {
      // Bounce off whatever it hit, losing most of its speed.
      const nx = p.x - y.x, nz = p.z - y.z, nl = Math.hypot(nx, nz) || 1;
      const dot = (y.vx * nx + y.vz * nz) / nl;
      if (dot < 0) { y.vx -= 1.6 * dot * nx / nl; y.vz -= 1.6 * dot * nz / nl; }
      y.vx *= 0.5; y.vz *= 0.5;
      y.x = p.x; y.z = p.z;
    }
    const r = Math.hypot(y.x, y.z), max = L.GARDEN.walkR - 0.4;
    if (r > max) { y.x *= max / r; y.z *= max / r; y.vx *= -0.3; y.vz *= -0.3; }
    const f = Math.exp(-1.7 * dt);
    y.vx *= f; y.vz *= f;
    // Roll: turn about the axis across the direction of travel by distance / radius.
    const mx = y.x - ox, mz = y.z - oz, m = Math.hypot(mx, mz);
    if (m > 1e-5) y.q = quatMul(quatAxisAngle(mz / m, 0, -mx / m, m / y.r), y.q);
  }

  /* ── The tick ──────────────────────────────────────────────────────── */

  /* Cats are long, not round: for the hard "no overlapping" check each one is a capsule along its
     heading, as long as its pose. */
  const HALF_LEN = { walk: 0.42, loaf: 0.38, stretch: 0.5, sit: 0.17, sleep: 0.12 };
  const BODY = 0.26;
  let seg = new Float64Array(0);
  function resolveCats() {
    const n = cats.length;
    if (seg.length < n * 4) seg = new Float64Array(n * 4);
    for (let i = 0; i < n; i++) {
      const c = cats[i], h = HALF_LEN[c.pose] || 0.3, fx = Math.cos(c.yaw) * h, fz = -Math.sin(c.yaw) * h;
      seg[i * 4] = c.x - fx; seg[i * 4 + 1] = c.z - fz; seg[i * 4 + 2] = c.x + fx; seg[i * 4 + 3] = c.z + fz;
    }
    for (let i = 0; i < n; i++) {
      const a = cats[i];
      if (a.y > 0.3 || a.perch) continue;
      for (let j = i + 1; j < n; j++) {
        const b = cats[j];
        if (Math.abs(b.x - a.x) > 1.6 || Math.abs(b.z - a.z) > 1.6) continue;
        if (b.y > 0.3 || b.perch || (!a.moving && !b.moving)) continue;
        const cp = closestPoints(seg[i * 4], seg[i * 4 + 1], seg[i * 4 + 2], seg[i * 4 + 3], seg[j * 4], seg[j * 4 + 1], seg[j * 4 + 2], seg[j * 4 + 3]);
        let dx = cp[2] - cp[0], dz = cp[3] - cp[1], d = Math.hypot(dx, dz);
        if (d >= BODY * 2) continue;
        if (d < 1e-5) { dx = b.x - a.x; dz = b.z - a.z; d = Math.hypot(dx, dz) || 1; if (d < 1e-5) { dx = 1; dz = 0; } }
        const push = BODY * 2 - d, nx = dx / d, nz = dz / d;
        if (a.moving && b.moving) { a.x -= nx * push / 2; a.z -= nz * push / 2; b.x += nx * push / 2; b.z += nz * push / 2; }
        else if (a.moving) { a.x -= nx * push; a.z -= nz * push; }
        else { b.x += nx * push; b.z += nz * push; }
      }
    }
  }

  function groundY(cat) {
    for (const b of L.BEDS) if (Math.abs(cat.x - b.x) < b.r && Math.hypot(cat.x - b.x, cat.z - b.z) < b.r - 0.12) return b.y;
    for (const p of L.NAP_PILES) if (p.kind === "cushion" && Math.hypot(cat.x - p.x, cat.z - p.z) < p.r - 0.1) return p.y;
    return 0;
  }

  function update(dt) {
    if (isReduced) return;
    time += dt;
    for (const cat of cats) {
      for (const n of NEEDS) cat.needs[n] = Math.min(1.2, cat.needs[n] + GROWTH[n] * dt * needRate(cat, n));
      cat.moving = false;
      cat.px = cat.x; cat.pz = cat.z;
      if (!cat.act) begin(cat, choose(cat));
      run(cat, dt);
    }
    resolveCats();
    for (const cat of cats) {
      const st = cat.act && cat.act.steps[cat.act.i];
      const airborne = st && (st.type === "hop" || st.type === "pounce");
      if (!airborne && !cat.perch) {
        // Nothing is walked through: the hard check after steering and personal space.
        const p = { x: cat.x, z: cat.z };
        nav.project(p, cat.act ? cat.act.ignoreNow : withContaining(null, cat));
        cat.x = p.x; cat.z = p.z;
        // Step up onto a bed's cushion (or the big cushion), down onto the grass.
        cat.y += (groundY(cat) - cat.y) * Math.min(1, dt * 10);
      }
      // A cat that tries to walk but is pushed back as far as it steps (another cat, a bowl, a
      // post in the way) is getting nowhere: after a moment it sits and waits its turn.
      if (cat.moving && cat.pose === "walk" && st && WALKING_STEPS.has(st.type)) {
        const v = Math.hypot(cat.x - cat.px, cat.z - cat.pz) / dt;
        if (v < STALL_SPEED) { if ((cat.stall += dt) > STALL_WAIT) { cat.waitUntil = time + WAIT_FOR; cat.stall = 0; } }
        else if (v > STALL_SPEED * 2) cat.stall = 0;
      }
      animate(cat, dt);
    }
    for (const y of yarns) stepYarn(y, dt);
  }

  function needRate(cat, n) {
    const t = cat.traits;
    return n === "sleep" ? t.sleepy : n === "play" ? t.playful : n === "social" ? t.social : n === "hunger" ? t.hungry : n === "groom" ? t.tidy : 1;
  }

  /* ── Starting positions ────────────────────────────────────────────── */

  /** Starts the garden mid-afternoon: some cats already asleep, eating or perched, others about. */
  function warmStart() {
    for (const cat of cats) {
      const s = randomSpot(cat.rnd, cat, { front: 0.6 }) || { x: 6, z: 6 };
      cat.x = s.x; cat.z = s.z;
    }
    for (const cat of cats) {
      if (cat.act) continue; // drawn into a chase already
      const act = choose(cat);
      begin(cat, act);
      if (cat.rnd.chance(0.7) && act.kind !== "chase") fastForward(cat);
    }
  }

  /** Skips an activity's walk (and hop) so the cat is already there, partway through. */
  function fastForward(cat) {
    const act = cat.act;
    for (let st = act.steps[act.i]; st; st = act.steps[act.i]) {
      if (st.type === "go") { cat.x = st.x; cat.z = st.z; }
      else if (st.type === "hop" && !st.to) { cat.x = st.x; cat.z = st.z; cat.y = st.y; }
      else if (st.type === "turn") { cat.yaw = st.yaw; }
      else if (st.type === "call") { st.fn(); }
      else if (st.type === "hold") {
        if (st.dur < 3 || st.doing === SAY.settle || st.anim === "roll") { act.i++; continue; }
        act.started = true; act.t = cat.rnd.range(0, st.dur * 0.7); act.ignoreNow = withContaining(act.ignore, cat); setPose(cat, st.pose);
        break;
      }
      else if (st.type !== "circle" && st.type !== "upTop") break; // chase, follow, pounce: just start walking
      if (st.then) st.then();
      act.i++;
    }
    cat.y = groundY(cat) || cat.y;
    cat.dest = { x: cat.x, z: cat.z };
  }

  /* ── Reduced motion: everyone settles ──────────────────────────────── */

  function settleAll() {
    for (const cat of cats) { finish(cat, false); release(cat); cat.perch = null; cat.y = 0; cat.dest = null; }
    for (const y of yarns) { y.vx = y.vz = 0; y.player = null; }
    targeted.clear();
    // A mix of cosy places and poses, the most visible first.
    const bed = (b) => ({ id: b.id, x: b.x, z: b.z, y: b.y, pose: "sleep", say: SAY.napBed });
    const sun = (s, k, pose) => ({ id: `${s.id}#${k}`, x: s.x + s.slots[k][0], z: s.z + s.slots[k][1], y: 0, pose, yaw: -Math.PI / 2 + 0.5, say: pose === "sleep" ? SAY.napSun : SAY.sunLoaf });
    const tree = (T, high) => ({ id: high ? T.high.id : T.low.id, x: high ? T.high.x : T.low.x, z: high ? T.high.z : T.low.z, y: high ? T.high.y : T.low.y, pose: high ? "loaf" : "sit", yaw: -Math.PI / 2 + 0.3, perch: { id: high ? T.high.id : T.low.id, ground: high ? T.landing : T.ground, y: high ? T.high.y : T.low.y }, say: high ? SAY.top : SAY.perch });
    const spots = [
      { id: L.STEP.id, x: L.STEP.x, z: L.STEP.z, y: L.STEP.y, pose: "sit", yaw: L.STEP.sitYaw, perch: { id: L.STEP.id, ground: L.STEP.ground, y: L.STEP.y }, say: SAY.porch },
      ...L.TREES.flatMap((T) => [tree(T, false), tree(T, true)]),
      ...L.BEDS.map(bed),
      ...PILE_SLOTS.map((s) => ({ id: s.id, x: s.x, z: s.z, y: s.pile.y, pose: "sleep", say: s.pile.kind === "blanket" ? SAY.blanket : SAY.pile })),
      ...L.SUN_PATCHES.flatMap((s, i) => [sun(s, 0, i % 2 ? "sleep" : "loaf"), sun(s, 1, i % 2 ? "loaf" : "sleep")]),
      ...L.POND_SPOTS.slice(0, 5).map((p) => ({ id: p.id, x: p.x, z: p.z, y: 0, pose: "sit", yaw: p.yaw, say: SAY.pond })),
    ];
    const order = [...cats].sort((a, b) => a.index - b.index);
    for (const cat of order) {
      const s = spots.shift();
      if (s) {
        reserve(s.id, cat);
        cat.x = s.x; cat.z = s.z; cat.y = s.y; cat.perch = s.perch || null;
        if (s.yaw != null) cat.yaw = s.yaw;
        setPose(cat, s.pose);
      } else {
        const p = randomSpot(cat.rnd, cat, { front: 0.7 }) || { x: cat.x, z: cat.z };
        cat.x = p.x; cat.z = p.z; cat.y = 0;
        setPose(cat, cat.rnd.pick(["loaf", "sit", "sleep", "sit"]));
      }
      cat.dest = { x: cat.x, z: cat.z };
      cat.moving = false; cat.speed = 0;
      cat.doing = s ? s.say : cat.pose === "sleep" ? SAY.napGrass : cat.pose === "sit" ? SAY.look : SAY.rest;
      const a = cat.anim; a.bob = 0; a.pitch = 0; a.pivot = 0; a.roll = 0; a.rollY = 0; a.sx = a.sy = a.sz = 1;
    }
  }

  function setReduced(on) {
    if (on === isReduced) return;
    isReduced = on;
    if (on) settleAll();
    else for (const cat of cats) {
      // Wake up where they settled; a cat on a perch hops down as its first move.
      for (const h of [...cat.holds]) if (!cat.perch || h !== cat.perch.id) release(cat, h);
      cat.act = null; cat.dest = null;
    }
  }

  if (isReduced) { for (const cat of cats) { const s = randomSpot(cat.rnd, cat) || { x: 6, z: 6 }; cat.x = s.x; cat.z = s.z; } settleAll(); }
  else warmStart();

  return {
    cats, yarns, nav,
    update,
    setReduced,
    /** Where the camera is, so a sitting cat can look at the person watching. */
    setViewer(x, z) { viewer = { x, z }; },
    get reduced() { return isReduced; },
    get time() { return time; },
    byId: (id) => byIdMap.get(id) || null,
    /** For tests and debugging: start an activity now ("nap", "eat", "climb", "chase", …). Returns false if it can't. */
    force(id, kind, { skipWalk = false } = {}) {
      const cat = byIdMap.get(id);
      if (!cat || isReduced) return false;
      finish(cat, false);
      const act = build(cat, kind);
      if (!act) return false;
      begin(cat, act);
      if (skipWalk) fastForward(cat);
      return true;
    },
    /** For tests: who holds which place. */
    reservations: () => new Map(reserved),
    /** What each cat is up to, counted by activity (for the debug line and tests). */
    census() { const m = {}; for (const c of cats) { const k = c.act ? c.act.kind : "none"; m[k] = (m[k] || 0) + 1; } return m; },
  };
}

/* ── Small maths ─────────────────────────────────────────────────────────── */

/** Closest points between segments p1→p2 and q1→q2 in the plane: [px, pz, qx, qz]. */
function closestPoints(p1x, p1z, p2x, p2z, q1x, q1z, q2x, q2z) {
  const d1x = p2x - p1x, d1z = p2z - p1z, d2x = q2x - q1x, d2z = q2z - q1z, rx = p1x - q1x, rz = p1z - q1z;
  const a = d1x * d1x + d1z * d1z, e = d2x * d2x + d2z * d2z, f = d2x * rx + d2z * rz;
  let s = 0, t = 0;
  if (a < 1e-9 && e < 1e-9) return [p1x, p1z, q1x, q1z];
  if (a < 1e-9) t = clamp01(f / e);
  else {
    const c = d1x * rx + d1z * rz;
    if (e < 1e-9) s = clamp01(-c / a);
    else {
      const b = d1x * d2x + d1z * d2z, den = a * e - b * b;
      s = den > 1e-9 ? clamp01((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); } else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  return [p1x + d1x * s, p1z + d1z * s, q1x + d2x * t, q1z + d2z * t];
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

const easeInOut = (u) => u * u * (3 - 2 * u);
/** The quadratic through (0, a), (0.5, m) and (1, b), where m is chosen so the peak is about `top`. */
function quadThrough(a, top, b, u) {
  const h = top - (a + b) / 2;
  return a + (b - a) * u + h * 4 * u * (1 - u);
}
function quadSlope(a, top, b, u) { const h = top - (a + b) / 2; return (b - a) + h * 4 * (1 - 2 * u); }

function quatAxisAngle(x, y, z, angle) { const s = Math.sin(angle / 2); return [x * s, y * s, z * s, Math.cos(angle / 2)]; }
function quatMul(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  const q = [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
  const l = Math.hypot(...q) || 1;
  return q.map((v) => v / l);
}
