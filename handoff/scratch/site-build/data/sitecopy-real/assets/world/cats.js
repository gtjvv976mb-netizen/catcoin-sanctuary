/* The cats: what each one wants, where it goes, and how it looks while it does it.

   No three.js here. The simulation works on plain numbers and, every frame, leaves on each
   cat a pose ("sit", "walk", "loaf", "stretch", "sleep"), a position, a heading, and a few
   small animation values (a bob, a tilt, a breath). catviews.js turns those into matrices.

   How a cat spends its time
   ─────────────────────────
   Each cat carries needs that grow at its own pace: sleep, hunger, thirst, play, grooming,
   company and curiosity. When it finishes one thing it scores every activity it could do
   now (a need, a little whim, and a nudge away from repeating itself) and picks the best:

     nap      walk to a free bed or a patch of sun, turn round, loaf, then sleep, breathing slowly;
              wake with a stretch. With every bed and patch taken, it curls up on the grass.
     eat      walk to a free bowl, face it and eat, head bobbing (the loaf pose, tilted forward).
     drink    the same at the water dish, lapping quickly.
     climb    walk to the cat tree, crouch, hop up to the low platform in a short arc, sit and
              look about; sometimes hop on up to the top; hop down later.
     play     stalk up to a ball of yarn, wiggle, then pounce a few times; the yarn rolls away.
     porch    hop onto the bottom porch step, turn round and sit a while, watching the garden.
     groom    sit and wash, with a small rhythmic tilt.
     follow   tag along behind another cat for a while, then sit near it.
     zoomies  rarely, a short burst of running flat out, then a sit to catch its breath.
     wander   stroll somewhere, then sit and look about or rest.

   Two cats never share a bed, a bowl or a perch (a place is reserved when a cat heads for
   it). Cats keep a little personal space, steer round the cottage and props on routes from
   nav.js, and are pushed back out of anything they would otherwise walk into.
   Each cat's rhythm (its pace, how sleepy, playful or sociable it is, how long it naps) is
   seeded from its id, so a cat behaves the same way on every visit.
   With reduced motion, every cat settles in one spot and stays there, still. */

import { makeRandom } from "./rng.js";
import { NavWorld, yawTo, wrapAngle } from "./nav.js";
import * as L from "./layout.js";

export const POSES = ["sit", "walk", "loaf", "stretch", "sleep"];

const NEEDS = ["sleep", "hunger", "thirst", "play", "groom", "social", "explore"];
/** How fast each need grows per second at an average pace (1 = urgent). */
const GROWTH = { sleep: 1 / 150, hunger: 1 / 230, thirst: 1 / 180, play: 1 / 115, groom: 1 / 140, social: 1 / 130, explore: 1 / 70 };

const SPEED = { stroll: 0.72, purpose: 1.02, follow: 1.25, stalk: 0.55, pounce: 3.0, zoom: 3.7 };
const TURN = { walk: 3.4, zoom: 7.5, still: 2.4 };

/** Plain words for the tag that follows a chosen cat. */
const SAY = {
  bed: "Heading for a nap", napBed: "Napping in a cat bed", napSun: "Napping in a patch of sun", napGrass: "Napping on the grass",
  settle: "Settling in", wake: "Waking up with a stretch", eatGo: "Off to the food bowl", eat: "Eating", lick: "Licking its whiskers",
  drinkGo: "Off for a drink", drink: "Having a drink", climbGo: "Off to the cat tree", climb: "Climbing the cat tree",
  perch: "Watching from the cat tree", top: "On top of the cat tree", porchGo: "Off to the porch", porch: "Sitting on the porch step",
  play: "Playing with the yarn", stalk: "Stalking the yarn", wiggle: "Getting ready to pounce", pounce: "Pounce!",
  groom: "Having a wash", wander: "Having a look around", look: "Looking around", rest: "Resting a moment",
  zoom: "Zoomies!", pant: "Catching its breath", hopDown: "Hopping down",
};

/**
 * Builds the garden's cat simulation.
 * @param {object} o
 * @param {Array} o.residents  [{id, name, look:{model}}]
 * @param {boolean} [o.reduced] reduced motion: every cat settles in one spot
 */
export function createSanctuary({ residents, reduced = false }) {
  const nav = new NavWorld({ obstacles: L.obstacles(), walkR: L.GARDEN.walkR, clearR: L.CAT.clearR, bodyR: L.CAT.bodyR });
  const world = makeRandom("the-garden");
  const reserved = new Map(); // place id → cat id
  const cats = [];
  const yarns = L.YARNS.map((y) => ({ ...y, vx: 0, vz: 0, q: [0, 0, 0, 1], player: null }));
  let time = 0;
  let isReduced = reduced;

  /* ── Places ────────────────────────────────────────────────────────── */

  const reserve = (id, cat) => { if (reserved.has(id) && reserved.get(id) !== cat.id) return false; reserved.set(id, cat.id); cat.holds.add(id); return true; };
  const release = (cat, id) => { if (id == null) { for (const h of cat.holds) if (reserved.get(h) === cat.id) reserved.delete(h); cat.holds.clear(); return; } if (reserved.get(id) === cat.id) reserved.delete(id); cat.holds.delete(id); };
  const free = (id) => !reserved.has(id);

  /** Is (x, z) a reasonable place for a cat to stop: clear of props, other cats and their destinations. */
  function spotOk(x, z, self, space = L.CAT.personal * 1.15) {
    if (!nav.pointFree(x, z, L.CAT.clearR + 0.05)) return false;
    for (const c of cats) {
      if (c === self) continue;
      if (Math.hypot(c.x - x, c.z - z) < space) return false;
      if (c.dest && Math.hypot(c.dest.x - x, c.dest.z - z) < space) return false;
    }
    for (const b of L.BEDS) if (Math.hypot(b.x - x, b.z - z) < b.r + 0.5) return false;
    for (const s of L.SUN_PATCHES) if (Math.hypot(s.x - x, s.z - z) < s.r) return false;
    if (Math.hypot(L.STEP.ground.x - x, L.STEP.ground.z - z) < 0.9) return false;
    if (Math.hypot(L.TREE.ground.x - x, L.TREE.ground.z - z) < 0.9 || Math.hypot(L.TREE.landing.x - x, L.TREE.landing.z - z) < 0.9) return false;
    for (const b of [...L.BOWLS, L.WATER]) if (Math.hypot(b.stand.x - x, b.stand.z - z) < 0.8) return false;
    return true;
  }

  /** Spots other cats need to reach: the bowl and dish stands, the foot of the stairs, the tree. */
  const STANDS = [...L.BOWLS.map((b) => b.stand), L.WATER.stand, L.STEP.ground, L.TREE.ground, L.TREE.landing];

  /** True when no other cat is sitting (or lying) on this spot. */
  function clearOfCats(p, self, room = 0.7) {
    return cats.every((c) => c === self || c.moving || Math.hypot(c.x - p.x, c.z - p.z) > room);
  }

  /** Before resting or washing where it stands: a cat in someone's way moves aside first,
      and a cat still in the bed or sunny spot it woke in keeps it while it stays. */
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
    return [];
  }

  /** A random open spot, preferring the side of the garden people usually look at (the front). */
  function randomSpot(rnd, self, { near = null, min = 0, max = 99, front = 0.7 } = {}) {
    for (let t = 0; t < 60; t++) {
      let x, z;
      if (near) {
        const a = rnd.range(0, Math.PI * 2), d = rnd.range(min, max);
        x = near.x + Math.cos(a) * d; z = near.z + Math.sin(a) * d;
      } else {
        const a = rnd.chance(front) ? rnd.range(-0.45, Math.PI + 0.45) : rnd.range(0, Math.PI * 2);
        const d = rnd.range(3.4, L.GARDEN.walkR - 0.6);
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
      sleepy: rnd.range(0.75, 1.35),   // how quickly it tires, how long it naps
      playful: rnd.range(0.6, 1.4),
      social: rnd.range(0.5, 1.3),
      climber: rnd.range(0.6, 1.4),
      tidy: rnd.range(0.7, 1.3),
      hungry: rnd.range(0.8, 1.2),
      rhythm: rnd.range(0.85, 1.2),    // stretches or shortens every timing
      breath: rnd.range(0.85, 1.15),   // its breathing rate
    };
    const cat = {
      id: r.id, name: r.name, model: r.look?.model === "ginger" ? "ginger" : "cat", index: i,
      rnd, traits,
      needs: Object.fromEntries(NEEDS.map((n) => [n, rnd.range(0.05, 0.85)])),
      x: 0, y: 0, z: 0, yaw: rnd.range(-Math.PI, Math.PI), speed: 0,
      pose: "sit", poseSince: 0, prevPose: "sit",
      anim: { bob: 0, pitch: 0, pivot: 0, roll: 0, sx: 1, sy: 1, sz: 1 },
      act: null, last: null, lastZoom: -999, holds: new Set(), dest: null, perch: null, cool: {},
      phase: rnd.range(0, 100), stride: 0, lookYaw: 0, doing: SAY.look, groundY: 0, moving: false,
    };
    return cat;
  }

  residents.forEach((r, i) => cats.push(makeCat(r, i)));

  /* ── Choosing what to do ───────────────────────────────────────────── */

  function freeSleepPlaces(cat) {
    const out = [];
    for (const b of L.BEDS) if (free(b.id)) out.push({ id: b.id, x: b.x, z: b.z, y: b.y, kind: "bed", ignore: b.id });
    for (const s of L.SUN_PATCHES) s.slots.forEach(([dx, dz], k) => { const id = `${s.id}#${k}`; if (free(id)) out.push({ id, x: s.x + dx, z: s.z + dz, y: 0, kind: "sun" }); });
    return out.filter((p) => p.kind === "bed" || cats.every((c) => c === cat || Math.hypot(c.x - p.x, c.z - p.z) > 0.9));
  }

  function leaders(cat) {
    return cats.filter((c) => c !== cat && c.moving && c.y < 0.05 && c.act && c.act.kind !== "follow" && c.act.kind !== "zoomies"
      && Math.hypot(c.x - cat.x, c.z - cat.z) < 7);
  }

  function choose(cat) {
    const n = cat.needs, t = cat.traits, rnd = cat.rnd;
    const opts = [];
    const add = (kind, score) => {
      if (score > 0 && !(cat.cool[kind] > time)) opts.push([kind, score + rnd.range(0, 0.28) - (cat.last === kind ? 0.35 : 0)]);
    };
    add("nap", n.sleep * 1.3 * t.sleepy);
    if (L.BOWLS.some((b) => free(b.id) && clearOfCats(b.stand, cat))) add("eat", n.hunger * 1.15 * t.hungry);
    if (free(L.WATER.id) && clearOfCats(L.WATER.stand, cat)) add("drink", n.thirst * 1.05);
    if (yarns.some((y) => !y.player)) add("play", n.play * 1.05 * t.playful);
    if (free(L.TREE.low.id) && clearOfCats(L.TREE.ground, cat)) add("climb", n.explore * 0.72 * t.climber);
    if (free(L.STEP.id) && clearOfCats(L.STEP.ground, cat)) add("porch", n.explore * 0.6);
    add("groom", n.groom * 0.95 * t.tidy);
    if (leaders(cat).length) add("follow", n.social * 0.95 * t.social);
    add("wander", 0.3 + n.explore * 0.45);
    add("rest", 0.18 + n.sleep * 0.35);
    if (t.playful > 1.05 && time - cat.lastZoom > 150 && n.sleep < 0.5 && rnd.chance(0.035)) opts.push(["zoomies", 3]);
    opts.sort((a, b) => b[1] - a[1]);
    for (const [kind] of opts) { const act = build(cat, kind); if (act) return act; }
    return build(cat, "rest");
  }

  /* ── Building an activity: a list of small steps ───────────────────── */

  const dur = (cat, a, b) => cat.rnd.range(a, b) * cat.traits.rhythm;

  /** Before anything else, a cat on a perch hops down first. */
  function leavePerch(cat) {
    if (!cat.perch) return [];
    const p = cat.perch;
    return [{ type: "hop", x: p.ground.x, z: p.ground.z, y: 0, dur: 0.5 + p.y * 0.1, apex: 0.25, doing: SAY.hopDown, then: () => { release(cat, p.id); cat.perch = null; } }];
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
          const scored = places.map((pl) => [pl, Math.hypot(pl.x - cat.x, pl.z - cat.z) * rnd.range(0.7, 1.3) - (pl.kind === "sun" ? cat.traits.sleepy * 0.8 : 0)]);
          scored.sort((a, b) => a[1] - b[1]);
          p = scored[0][0];
        }
        let say = SAY.napGrass;
        if (p) {
          if (!reserve(p.id, cat)) return null;
          if (p.ignore) act.ignore.add(p.ignore);
          say = p.kind === "bed" ? SAY.napBed : SAY.napSun;
        } else {
          const s = randomSpot(rnd, cat, { front: 0.5 });
          if (!s) return null;
          p = { x: s.x, z: s.z, y: 0 };
        }
        act.reason = SAY.bed;
        cat.dest = { x: p.x, z: p.z };
        const sleepFor = dur(cat, 26, 58) * cat.traits.sleepy;
        steps.push(
          { type: "go", x: p.x, z: p.z, speed: SPEED.purpose, arrive: 0.12, doing: SAY.bed },
          { type: "circle", turns: rnd.range(0.9, 1.5), doing: SAY.settle },
          { type: "hold", pose: "loaf", anim: "breathe", dur: dur(cat, 2.5, 5.5), doing: SAY.settle },
          { type: "hold", pose: "sleep", anim: "sleep", dur: sleepFor, doing: say, restore: { sleep: 1.4 / sleepFor } },
          { type: "hold", pose: "stretch", anim: "stretch", dur: 1.9, doing: SAY.wake, then: () => { cat.needs.sleep = Math.min(cat.needs.sleep, 0.08); } },
        );
        break;
      }
      case "eat":
      case "drink": {
        const list = (kind === "eat" ? L.BOWLS : [L.WATER]).filter((b) => free(b.id) && clearOfCats(b.stand, cat));
        if (!list.length) return null;
        const b = list.sort((p, q) => Math.hypot(p.stand.x - cat.x, p.stand.z - cat.z) - Math.hypot(q.stand.x - cat.x, q.stand.z - cat.z))[0];
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
        const T = L.TREE;
        if (!reserve(T.low.id, cat)) return null;
        cat.dest = { ...T.ground };
        act.reason = SAY.climbGo;
        steps.push(
          { type: "go", x: T.ground.x, z: T.ground.z, speed: SPEED.purpose, arrive: 0.12, doing: SAY.climbGo },
          { type: "turn", yaw: yawTo(T.low.x - T.ground.x, T.low.z - T.ground.z), doing: SAY.climb },
          { type: "hold", pose: "loaf", anim: "crouch", dur: 0.55, doing: SAY.climb },
          { type: "hop", x: T.low.x, z: T.low.z, y: T.low.y, dur: 0.62, apex: 0.45, doing: SAY.climb, then: () => { cat.perch = { id: T.low.id, ground: T.ground, y: T.low.y }; } },
          { type: "hold", pose: "sit", anim: "look", dur: dur(cat, 7, 15), doing: SAY.perch, restore: { explore: 0.05 } },
        );
        if (rnd.chance(0.45 * cat.traits.climber)) {
          steps.push({ type: "upTop" });
        }
        steps.push({ type: "call", fn: () => { cat.needs.explore = 0.1; } });
        break;
      }
      case "porch": {
        const S = L.STEP;
        if (!reserve(S.id, cat)) return null;
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
      case "play": {
        const y = yarns.filter((v) => !v.player).sort((a, b) => Math.hypot(a.x - cat.x, a.z - cat.z) - Math.hypot(b.x - cat.x, b.z - cat.z))[0];
        if (!y) return null;
        y.player = cat.id;
        act.yarn = y;
        act.reason = SAY.play;
        const pounces = rnd.int(2, 4);
        steps.push({ type: "chase", target: () => y, stopAt: 1.15, speed: SPEED.purpose, until: 12, doing: SAY.stalk });
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
        const lead = ls.sort((a, b) => Math.hypot(a.x - cat.x, a.z - cat.z) - Math.hypot(b.x - cat.x, b.z - cat.z))[0];
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
        const s = randomSpot(rnd, cat, rnd.chance(0.6) ? { near: cat, min: 2.2, max: 6.5 } : {}) || randomSpot(rnd, cat);
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
        // The target is tucked against something (a ball of yarn by the fence, say): aim just clear of it.
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
    const dist = Math.hypot(tx - cat.x, tz - cat.z);
    if (dist < arrive) return "arrived";

    // Progress check: a cat that makes no headway for a while gives up on this route.
    if (dist < R.best - 0.15) { R.best = dist; R.bestAt = time; }
    else if (time - R.bestAt > 3.2) {
      if (R.replans >= 2) return "stuck";
      R.stale = true; R.replans++; R.bestAt = time;
    }

    let dx = wp.x - cat.x, dz = wp.z - cat.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    // Personal space: ease away from other cats nearby, more from ones lying still.
    for (const o of cats) {
      if (o === cat || o.y > 0.3) continue;
      const ox = cat.x - o.x, oz = cat.z - o.z, d = Math.hypot(ox, oz);
      const room = L.CAT.personal;
      if (d > room || d < 1e-4) continue;
      if (act && act.lead === o && d > 0.9) continue;
      const w = (room - d) / room * (o.moving ? 1.1 : 1.8);
      dx += (ox / d) * w; dz += (oz / d) * w;
    }
    const want = yawTo(dx, dz);
    const left = turnToward(cat, want, step.turn || TURN.walk, dt);
    // Slow down for sharp turns and on the last stretch, so cats arrive rather than orbit.
    let v = speed * cat.traits.pace * Math.max(0.12, Math.cos(Math.min(Math.abs(left), Math.PI / 2)));
    if (R.i === last) v *= Math.max(0.28, Math.min(1, dist / 0.9));
    if (Math.abs(left) > 1.9 && dist < 0.6) v = 0.05;
    cat.speed += (v - cat.speed) * Math.min(1, dt * (speed > 2 ? 6 : 4));
    cat.x += Math.cos(cat.yaw) * cat.speed * dt;
    cat.z -= Math.sin(cat.yaw) * cat.speed * dt;
    cat.moving = true;
    return "moving";
  }

  const withContaining = (ignore, cat) => {
    const s = new Set(ignore || []);
    for (const id of nav.containing(cat.x, cat.z)) s.add(id);
    return s;
  };

  function run(cat, dt) {
    const act = cat.act;
    const step = act.steps[act.i];
    if (!step) { finish(cat, true); return; }
    if (!act.started) { act.started = true; act.t = 0; act.ignoreNow = withContaining(act.ignore, cat); cat.route = null; }
    act.t += dt;
    cat.doing = step.doing || act.reason;
    const next = () => { if (step.then) step.then(); act.i++; act.started = false; };
    const abort = () => { finish(cat, false); };

    switch (step.type) {
      case "go": {
        setPose(cat, "walk");
        const r = walk(cat, step, step.x, step.z, dt, step.speed, step.arrive, act.ignoreNow);
        if (r === "arrived") { next(); cat.route = null; }
        else if (r === "stuck") abort();
        break;
      }
      case "chase": {
        const tg = step.target();
        const d = Math.hypot(tg.x - cat.x, tg.z - cat.z);
        if (step.skipIfNear && d < step.skipIfNear && act.t < dt * 1.5) { next(); break; }
        // Aim at a point short of the target, on the cat's side of it.
        const k = d > 1e-3 ? Math.max(0, d - step.stopAt) / d : 0;
        const tx = cat.x + (tg.x - cat.x) * k, tz = cat.z + (tg.z - cat.z) * k;
        if (d <= step.stopAt + 0.1) { cat.speed *= 0.5; next(); cat.route = null; break; }
        if (act.t > step.until) { abort(); break; }
        setPose(cat, "walk");
        const r = walk(cat, step, tx, tz, dt, step.speed, 0.15, act.ignoreNow);
        if (r === "stuck") abort();
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
          setPose(cat, "walk");
          const r = walk(cat, step, bx, bz, dt, Math.min(SPEED.follow, Math.max(0.6, lead.speed * 1.15 + 0.1)), 0.25, act.ignoreNow);
          if (r === "stuck") { next(); }
        } else {
          // The leader has stopped: sit down near it and watch it.
          if (d > 1.9) {
            setPose(cat, "walk");
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
        const left = turnToward(cat, yawTo(tg.x - cat.x, tg.z - cat.z), TURN.still, dt);
        if (Math.abs(left) < 0.08 || act.t > 1.5) next();
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
        if (step.restore) for (const [k, v] of Object.entries(step.restore)) cat.needs[k] = Math.max(0, cat.needs[k] - v * dt * 1.0);
        if (step.anim === "look") lookAbout(cat, dt, act);
        if (act.t >= step.dur) next();
        break;
      }
      case "hop": {
        if (act.t <= dt) { step.from = { x: cat.x, y: cat.y, z: cat.z }; }
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
        cat.hopPitch = Math.atan2(quadSlope(f.y, top, step.y, u), Math.max(0.3, hd)) * 0.7;
        if (u >= 1) { cat.y = step.y; cat.hopPitch = 0; next(); }
        break;
      }
      case "upTop": {
        // From the low platform, sometimes on up to the top.
        const T = L.TREE;
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

  function settleNear(cat, lead, dt) {
    setPose(cat, "sit");
    cat.speed = 0; cat.moving = false;
    turnToward(cat, yawTo(lead.x - cat.x, lead.z - cat.z), TURN.still, dt);
  }

  /** A sitting cat looks about now and then, turning a little. */
  function lookAbout(cat, dt, act) {
    if (act.lookAt == null || time > act.lookNext) {
      act.lookAt = wrapAngle(cat.yaw + cat.rnd.range(-0.9, 0.9));
      act.lookNext = time + cat.rnd.range(2.2, 5.5);
    }
    turnToward(cat, act.lookAt, 0.7, dt);
  }

  /* ── Animation values for the pose ─────────────────────────────────── */

  function animate(cat, dt) {
    const a = cat.anim, t = time + cat.phase, act = cat.act, step = act && act.steps[act.i];
    a.bob = 0; a.pitch = 0; a.pivot = 0; a.roll = 0; a.sx = 1; a.sy = 1; a.sz = 1;
    if (isReduced) return;
    const breath = cat.traits.breath;
    const kind = step && step.type === "hold" ? step.anim : null;
    if (cat.pose === "walk") {
      cat.stride += cat.speed * dt * 5.2;
      const k = Math.min(1, cat.speed / 1.2);
      a.bob = Math.abs(Math.sin(cat.stride)) * (0.035 + 0.03 * k);
      a.pitch = Math.sin(cat.stride * 2) * 0.018 * k;
      a.roll = Math.sin(cat.stride) * 0.025 * k;
    } else if (cat.pose === "sleep") {
      const s = Math.sin(t * Math.PI * 2 * 0.2 * breath);
      a.sy = 1 + s * 0.028; a.sx = a.sz = 1 + s * 0.012;
    } else if (kind === "eat") {
      // Head down in the bowl, chewing in little bursts, looking up now and then.
      const cycle = (t * 0.42) % 1, up = cycle > 0.8 ? Math.sin((cycle - 0.8) / 0.2 * Math.PI) : 0;
      a.pivot = 1; a.pitch = -(0.21 + Math.max(0, Math.sin(t * Math.PI * 2 * 1.7)) * 0.06) * (1 - up) - 0.03 * up;
    } else if (kind === "drink") {
      a.pivot = 1; a.pitch = -(0.25 + Math.sin(t * Math.PI * 2 * 4.2) * 0.018);
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
    } else if (cat.pose === "stretch" && step && step.type === "hop") {
      a.pitch = cat.hopPitch || 0;
    } else {
      const s = Math.sin(t * Math.PI * 2 * 0.3 * breath); a.sy = 1 + s * 0.012; a.sx = a.sz = 1 + s * 0.004;
    }
    // A small give as a cat lands in a new resting pose.
    const since = time - cat.poseSince;
    if (since < 0.3 && cat.prevPose === "walk" && cat.pose !== "walk" && cat.pose !== "stretch") a.sy *= 1 - 0.05 * (1 - since / 0.3);
  }

  /* ── Yarn ──────────────────────────────────────────────────────────── */

  function stepYarn(y, dt) {
    // A walking cat nudges a ball it runs into; a resting one is simply in the way.
    for (const c of cats) {
      if (c.y > 0.3 || c.perch) continue;
      const dx = y.x - c.x, dz = y.z - c.z, d = Math.hypot(dx, dz);
      if (d > 0.56 || d < 1e-4) continue;
      if (c.moving) { const push = Math.max(0, c.speed * 0.9 - Math.hypot(y.vx, y.vz)); y.vx += (dx / d) * push; y.vz += (dz / d) * push; }
      else if (d < 0.56) { y.x = c.x + (dx / d) * 0.56; y.z = c.z + (dz / d) * 0.56; }
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

  function resolveCats() {
    const min = 0.62;
    for (let i = 0; i < cats.length; i++) {
      const a = cats[i];
      if (a.y > 0.3 || a.perch) continue;
      for (let j = i + 1; j < cats.length; j++) {
        const b = cats[j];
        if (b.y > 0.3 || b.perch) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d >= min || d < 1e-5) continue;
        const push = min - d, nx = dx / d, nz = dz / d;
        if (a.moving && b.moving) { a.x -= nx * push / 2; a.z -= nz * push / 2; b.x += nx * push / 2; b.z += nz * push / 2; }
        else if (a.moving) { a.x -= nx * push; a.z -= nz * push; }
        else if (b.moving) { b.x += nx * push; b.z += nz * push; }
      }
    }
  }

  function update(dt) {
    if (isReduced) return;
    time += dt;
    for (const cat of cats) {
      for (const n of NEEDS) cat.needs[n] = Math.min(1.2, cat.needs[n] + GROWTH[n] * dt * needRate(cat, n));
      cat.moving = false;
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
        // Step up onto a bed's cushion, down onto the grass.
        let gy = 0;
        for (const b of L.BEDS) if (Math.hypot(cat.x - b.x, cat.z - b.z) < b.r - 0.12) gy = b.y;
        cat.y += (gy - cat.y) * Math.min(1, dt * 10);
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

  /** Starts the garden mid-evening: some cats already asleep, eating or perched, others about. */
  function warmStart() {
    for (const cat of cats) {
      const s = randomSpot(cat.rnd, cat, { front: 0.75 }) || { x: 6, z: 6 };
      cat.x = s.x; cat.z = s.z;
    }
    for (const cat of cats) {
      const act = choose(cat);
      begin(cat, act);
      if (cat.rnd.chance(0.7)) fastForward(cat);
    }
  }

  /** Skips an activity's walk (and hop) so the cat is already there, partway through. */
  function fastForward(cat) {
    const act = cat.act;
    for (let st = act.steps[act.i]; st; st = act.steps[act.i]) {
      if (st.type === "go") { cat.x = st.x; cat.z = st.z; }
      else if (st.type === "hop") { cat.x = st.x; cat.z = st.z; cat.y = st.y; }
      else if (st.type === "turn") { cat.yaw = st.yaw; }
      else if (st.type === "call") { st.fn(); }
      else if (st.type === "hold") {
        if (st.dur < 3 || st.doing === SAY.settle) { act.i++; continue; }
        act.started = true; act.t = cat.rnd.range(0, st.dur * 0.7); act.ignoreNow = withContaining(act.ignore, cat); setPose(cat, st.pose);
        break;
      }
      else if (st.type !== "circle" && st.type !== "upTop") break; // chase, follow, pounce: just start walking
      if (st.then) st.then();
      act.i++;
    }
    for (const b of L.BEDS) if (Math.hypot(cat.x - b.x, cat.z - b.z) < b.r - 0.12) cat.y = b.y;
    cat.dest = { x: cat.x, z: cat.z };
  }

  /* ── Reduced motion: everyone settles ──────────────────────────────── */

  function settleAll() {
    for (const cat of cats) { finish(cat, false); release(cat); cat.perch = null; cat.y = 0; cat.dest = null; }
    for (const y of yarns) { y.vx = y.vz = 0; y.player = null; }
    const spots = [
      ...L.BEDS.map((b) => ({ id: b.id, x: b.x, z: b.z, y: b.y, pose: "sleep" })),
      ...L.SUN_PATCHES.flatMap((s) => s.slots.map(([dx, dz], k) => ({ id: `${s.id}#${k}`, x: s.x + dx, z: s.z + dz, y: 0, pose: "sleep" }))),
      { id: L.STEP.id, x: L.STEP.x, z: L.STEP.z, y: L.STEP.y, pose: "sit", yaw: L.STEP.sitYaw, perch: { id: L.STEP.id, ground: L.STEP.ground, y: L.STEP.y } },
      { id: L.TREE.low.id, x: L.TREE.low.x, z: L.TREE.low.z, y: L.TREE.low.y, pose: "sit", yaw: -Math.PI / 2, perch: { id: L.TREE.low.id, ground: L.TREE.ground, y: L.TREE.low.y } },
      { id: L.TREE.high.id, x: L.TREE.high.x, z: L.TREE.high.z, y: L.TREE.high.y, pose: "loaf", yaw: -Math.PI / 2 + 0.6, perch: { id: L.TREE.high.id, ground: L.TREE.landing, y: L.TREE.high.y } },
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
        const p = randomSpot(cat.rnd, cat, { front: 0.8 }) || { x: cat.x, z: cat.z };
        cat.x = p.x; cat.z = p.z; cat.y = 0;
        setPose(cat, cat.rnd.pick(["loaf", "sit", "sleep"]));
      }
      cat.dest = { x: cat.x, z: cat.z };
      cat.moving = false; cat.speed = 0;
      cat.doing = cat.pose === "sleep" ? SAY.napBed : cat.pose === "sit" ? SAY.look : SAY.rest;
      if (cat.perch) cat.doing = cat.perch.id === L.STEP.id ? SAY.porch : SAY.perch;
      else if (cat.pose === "sleep") cat.doing = L.BEDS.some((b) => Math.hypot(b.x - cat.x, b.z - cat.z) < 0.3) ? SAY.napBed : L.SUN_PATCHES.some((sp) => Math.hypot(sp.x - cat.x, sp.z - cat.z) < sp.r) ? SAY.napSun : SAY.napGrass;
      const a = cat.anim; a.bob = 0; a.pitch = 0; a.pivot = 0; a.roll = 0; a.sx = a.sy = a.sz = 1;
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
    get reduced() { return isReduced; },
    get time() { return time; },
    byId: (id) => cats.find((c) => c.id === id) || null,
    /** For tests and debugging: start an activity now ("nap", "eat", "climb", …). Returns false if it can't. */
    force(id, kind, { skipWalk = false } = {}) {
      const cat = cats.find((c) => c.id === id);
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
  };
}

/* ── Small maths ─────────────────────────────────────────────────────────── */

const easeInOut = (u) => u * u * (3 - 2 * u);
/** The quadratic through (0, a), (0.5, m) and (1, b), where m is chosen so the peak is `top`. */
function quadThrough(a, top, b, u) {
  // y(u) = a + (b - a) u + h * 4u(1-u), with h lifting the middle to about `top`.
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
