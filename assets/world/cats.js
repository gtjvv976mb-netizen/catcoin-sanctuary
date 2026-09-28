/* The cats: what each one wants, where it goes, and how it moves while it does it.

   No three.js here. The simulation works on plain numbers and, every tick, leaves on each cat its
   position and heading and `cat.motion` (the vocabulary is catmotion.js): the action to show
   (walk, sit, groom, sitDown, ...), its posture and gait, how far through a one-off action it is,
   the distance it has actually walked (which steps the legs), how fast it is turning and what it
   is looking at. catviews.js animates the cats with their own rigged model from that; the cats
   drawn with the shared instanced models get `cat.pose` (one of POSES, the nearest to the action)
   and a few small animation values (a bob, a tilt, a roll, a breath), as before.

   How a cat spends its time
   ─────────────────────────
   Each cat carries needs that grow at its own pace: sleep, hunger, thirst, play, grooming,
   company and curiosity. When it finishes one thing it scores every activity it could do
   now (a need, its character, a little whim, and a nudge away from repeating itself) and
   picks the best:

     nap        walk to a free bed or a patch of sun, sniff, turn round, knead, lie down, curl up
                and sleep; wake, lie a moment, yawn perhaps, get up for a long stretch.
     pile       curl up with friends on the picnic blanket, the big cushion or the mat.
     sunroll    lie down on a sunny lawn, flop on its side, roll on its back, bask, maybe doze.
     eat, drink walk to a free bowl or water dish, face it, eat or lap; often a wash after.
     climb      size up a cat tree, hop up to the low platform, sometimes on to the top; hop down later.
     porch      hop onto the bottom porch step and watch the garden.
     play       stalk a ball of yarn, crouch, wiggle, pounce; the yarn rolls away.
     chase      invite a settled cat to a chase: one runs, the other gives chase, then both pant.
                A grumpy cat declines, and turns its head away.
     butterfly  stalk a low butterfly and leap at it. The butterfly always gets away.
     bird       creep up on a bird that has landed nearby and swat. The bird always flies off
                first; a keen hunter sits chattering at it.
     pond       sit at the pond's edge and watch the water, dab at it.
     groom      sit and wash.
     follow     say hello, tail up, then tag along behind another cat for a while.
     visit      walk up to a friend who is resting, tail up, and rub cheeks with it.
     zoomies    now and then, a burst of running flat out, then a sit to catch its breath.
     wander     stroll somewhere, sniff about, then sit and look about or rest.

   How a cat moves (the rules that keep it looking like a cat)
   ───────────────────────────────────────────────────────────
   - It never jumps between postures (standing, sitting, lying, asleep): before any step that
     needs another posture the transition steps from catmotion's transitionPath are put in
     (sitting down, getting up, lying down, curling up, waking), each lasting transDur for the
     cat's tempo, and the cat stays where it is meanwhile.
   - What it shows changes only when what it does changes, never for a single tick: the next
     step is applied in the tick the last one ends, the next activity chosen in the tick the
     last one finishes, and a clip that has just started is not swapped for another in the same
     posture before MIN_SHOW (catmotion).
   - Speeds pick up and fall off at a cat's rate (ACCEL, BRAKE) and every kind of travel sits
     inside one gait band (SPEED), so the gait (gaitFor, with hysteresis and a dwell) changes only
     when the cat really speeds up or slows down. The legs step by the distance actually covered.
   - A cat stopped on its way (following, chasing, waiting for room) stands; only after standing
     still for SIT_AFTER seconds does it sit, and it gets up again only when it has somewhere to go.
   - Turning on the spot is done in small steps (the odometer counts the forepaws' arc), and a
     sitting or lying cat turns only its head for anything near where it faces; for anything
     further round it gets up, turns and settles again.
   - Hops and pounces gather, fly and land (the clip shows it); the cat is off the ground only for
     the middle half.

   Character. Each cat's traits (traits.js: energy, sleepiness, playfulness, boldness, ...) come
   in with its resident (r.traits; a cat without any is an ordinary adult, NEUTRAL_TRAITS) and its
   motion style (r.style: its tempo). They set its pace and rhythm, how it scores activities,
   how long it holds a pose, the little things it does while it holds one (pickFidget: a yawn, a
   paw wash, an ear scratch, its own signature move), how often it looks at you, whether it will
   play chase. The rest is seeded from its id, so a cat behaves the same way on every visit.

   Two cats never share a bed, a bowl, a slot or a perch (a place is reserved when a cat heads
   for it). Cats keep a little personal space, steer round the cottage and props on routes from
   nav.js, and are pushed back out of anything they would otherwise walk into.
   With reduced motion, every cat settles in one spot and stays there, still.

   The birds and butterflies live in critters.js. The simulation only reads where they are and
   asks them to fly off (`critters.startle`), so it still runs without them (under Node). */

import { makeRandom } from "./rng.js";
import { NavWorld, yawTo, wrapAngle } from "./nav.js";
import * as L from "./layout.js";
import { ACTIONS, FIDGETS, GAIT_BANDS, GAIT_DWELL, MIN_SHOW, NEUTRAL_TRAITS, allowedAction, canDo, gaitFor, pickFidget, transDur, transitionPath } from "./catmotion.js";

export const POSES = ["sit", "walk", "loaf", "stretch", "sleep"];

/** The shared (instanced) models have only POSES: the nearest one for each action. */
export const POSE_OF = {
  walk: "walk", trot: "walk", run: "walk", stalk: "walk", stand: "walk", sniff: "walk", greet: "walk", headBunt: "walk", hindStand: "walk", shake: "walk",
  eat: "loaf", crouch: "stretch", wiggle: "stretch", scratch: "stretch", stretch: "stretch", hop: "stretch", pounce: "stretch",
  sit: "sit", look: "sit", pant: "sit", groom: "sit", legLick: "sit", earScratch: "sit", knead: "sit", beckon: "sit", chatter: "sit", yawn: "sit",
  loaf: "loaf", dab: "loaf", flop: "loaf", roll: "loaf", sleep: "sleep",
};
const POSTURE_POSE = { stand: "walk", sit: "sit", lie: "loaf", sleep: "sleep" };
/** The instanced pose for an action; a posture change shows its first pose, then its last. */
export function poseOf(action, u = 0) {
  const a = ACTIONS[action];
  if (a && a.kind === "trans") return POSTURE_POSE[u < 0.5 ? a.from : a.to];
  return POSE_OF[action] || "sit";
}
/** The loop a cat shows when it simply holds a posture. */
const POSTURE_LOOP = { stand: "stand", sit: "sit", lie: "loaf", sleep: "sleep" };
const baseOf = (p) => (p === "move" || p === "air" ? "stand" : p);

/** Mannerisms held well away from their posture's own pose (a paw at the face, a hind leg in the
    air, over on its side, up on its hind legs), and how long (s) a cat takes to settle back into
    the plain pose before it does anything else: every posture change, once-through move and hop
    starts from that pose, so it never springs straight out of a paw wash into standing up. (Nearer
    ones, head down in the bowl or sniffing, the view blends out over their own fade.) */
export const UNWIND = { flop: 0.8, roll: 0.8, hindStand: 0.55, scratch: 0.55, legLick: 0.55, earScratch: 0.45, beckon: 0.4, groom: 0.4, dab: 0.4 };
/** The pose it settles into first, where that is not its posture's plain pose: off its back a cat
    comes over onto its side before it rolls up into a loaf. */
export const UNWIND_TO = { roll: "flop" };
/** Mannerisms a cat goes into only from certain poses of the same posture, held a moment first (the
    first is the one it takes on the way): onto its back only from lying on its side, never straight
    over from a loaf or up from lying down; over onto its side only from a loaf (or back off its back),
    never straight out of lying down. So a cat lying down settles in a loaf, flops over on its side,
    and only then rolls on its back; and back the same way. */
export const LEAD_IN = { roll: ["flop"], flop: ["loaf", "roll"] };
/** Standing loops a cat walks (or springs) straight off from, head coming up as it goes. */
const LAUNCH = new Set(["sniff", "eat", "greet", "headBunt", "crouch", "wiggle"]);
/** What a cat holds before `step`, and for how long, when what it shows now can't lead straight into
    it: a mannerism far from its plain pose (a paw at its face, over on its side, up on its hind legs)
    settles back into the plain pose first, and a mannerism entered only from certain poses (LEAD_IN)
    gets the pose it needs first. { action, dur }, or null to go straight on. The duration counts the
    rest of the shown loop's MIN_SHOW, which publishMotion keeps. */
export function unwindFor(cat, step, time) {
  const m = cat.motion, shown = m.action, A = ACTIONS[shown];
  if (m.gait || !A || baseOf(A.posture) !== cat.posture || step.type === "call" || step.type === "upTop" || step.type === "trans") return null;
  const B = step.type === "hold" ? ACTIONS[step.action] : null, left = Math.max(0, (MIN_SHOW[A.posture] || 0) - (time - m.since));
  // Into a mannerism with a lead-in: the pose it needs first, held a moment (MIN_SHOW and a little more).
  const lead = B && B.posture === A.posture && step.action !== shown ? LEAD_IN[step.action] : null;
  if (lead && !lead.includes(shown)) return { action: lead[0], dur: (MIN_SHOW[B.posture] || 1) + 0.3 };
  const d = UNWIND[shown];
  if (!d) return null;
  const to = UNWIND_TO[shown] || POSTURE_LOOP[cat.posture];
  if (B) { if (B.kind === "loop" && B.posture === A.posture && (!UNWIND_TO[shown] || step.action === to || lead)) return null; }
  else if (step.type === "hop") { if (shown === "crouch" || shown === "wiggle") return null; } // a pounce springs from the crouch
  else if (cat.posture === "stand" && LAUNCH.has(shown)) return null;
  return { action: to, dur: d + left };
}
/** A fidget picked while holding `held`, made one that can follow it (LEAD_IN): a roll picked in a
    loaf becomes a flop over onto its side (the roll can come another time, from there); null if none. */
export function leadFidget(name, held) {
  const lead = name && LEAD_IN[name];
  if (!lead || lead.includes(held)) return name;
  return LEAD_IN[lead[0]] && LEAD_IN[lead[0]].includes(held) ? lead[0] : null;
}
const RANK = { stalk: 0, walk: 1, trot: 2, run: 3 };

const NEEDS = ["sleep", "hunger", "thirst", "play", "groom", "social", "explore"];
/** How fast each need grows per second at an average pace (1 = urgent). */
const GROWTH = { sleep: 1 / 160, hunger: 1 / 260, thirst: 1 / 210, play: 1 / 70, groom: 1 / 150, social: 1 / 110, explore: 1 / 70 };

/** Travel speeds (world units/s for an ordinary cat, before its own pace). Each kind of travel
    sits well inside one gait band (catmotion GAIT_BANDS), so a cat never hovers on a boundary:
    strolls, errands and following at most WALK_MAX (a walk), the purposeful trot between
    TROT_MIN and TROT_MAX, runs (zoomies, a chase) at RUN_MIN or more. Stalking and creeping are
    stalks by intent, whatever the speed. */
const SPEED = { stroll: 0.7, purpose: 0.96, follow: 1.02, hurry: 1.8, stalk: 0.42, creep: 0.3, zoom: 3.6, flee: 3.05, pursue: 3.15 };
const WALK_MAX = 1.1, TROT_MIN = 1.62, TROT_MAX = 2.0, RUN_MIN = 2.7;
/** How quickly speed changes (units/s²): a walk picks up gently, a sprint launches hard. */
const ACCEL = 2.5, ACCEL_RUN = 5.5, BRAKE = 4, BRAKE_RUN = 6;
/** A sprinting cat banks round a turn rather than stopping: it keeps at least this speed. */
const RUN_FLOOR = 2.1;
const TURN = { walk: 3.4, zoom: 7.5, still: 2.4 };
/** A cat trying to walk that makes less headway than STALL_SPEED (units/s, or a third of its
    speed; it is pushed back by other cats and props) over STALL_WAIT seconds walks round the cat
    in its way, or stands and waits for WAIT_FOR seconds, then tries again. */
const STALL_SPEED = 0.15, STALL_WAIT = 0.45, WAIT_FOR = 1.4;
/** A cat held back by another cat's body or a prop (most of its step taken back) for this long (s)
    is stuck there: it doesn't wait out the headway check, it goes round, waits or finds another way. */
const HELD_WAIT = 0.1;
/** How long (s) a standing cat whose way is still blocked by another cat's body waits on each time. */
const WAIT_ON = 0.5;
/** A cat hemmed in on the last stretch of its way, this close to where it was going (beyond the
    arrival radius), takes it as arrived rather than treading on the spot. */
const CLOSE_ENOUGH = 0.45;
const WALKING_STEPS = new Set(["go", "chase", "pursue", "follow"]);
const TRAVEL = new Set(["go", "chase", "pursue", "follow", "circle", "call", "upTop"]);
/** Seconds a cat stopped on its way stands still before it sits down to wait. */
const SIT_AFTER = 1.5;
/** A sitting or lying cat turns only its head for anything within HEAD_TURN (rad) of where it
    faces; HEAD_MAX is as far round as its head goes (the view clamps at about 70°). */
const HEAD_TURN = 0.9, HEAD_MAX = 1.2;
/** The part of a hop or pounce (its u) spent in the air; the clip gathers before it and lands after. */
const AIR0 = 0.25, AIR1 = 0.75;
/** How far the forepaws step per radian while a cat turns on the spot (the odometer counts it). */
const PIVOT_ARC = 0.3;
/** The shortest walk: a cat going only a little way takes its steps over this long rather than a blip. */
const MIN_MOVE = 0.45;
/** The slowest a cat walks (units/s; a stalk, being slow by nature, V_MIN_STALK). Slower than that its
    legs all but stop mid-stride, a creep no real cat does: a cat going a short way steps it at this
    pace, one that would go slower stops and stands, and it only brakes below it in its last step. */
export const V_MIN = 0.26, V_MIN_STALK = 0.2;
/** A cat already this close to where it is going (beyond the step's arrival radius) does not set off
    at all: it is there. */
export const SHUFFLE = 0.08;
/** Idle moves a gentle cat (a memorial, a disabled cat) is never given: no slapstick. */
const COMEDY = new Set(["roll", "flop"]);
/** How big a cat is drawn (traits.js styleOf scale: a kitten small, a lion big), 1 for an ordinary cat;
    its body, its personal space and the room it leaves others grow with it. */
export const sizeOf = (cat) => { const s = cat.style && cat.style.scale; return s > 0 ? clamp(s, 0.5, 2) : 1; };
/* Cats are long, not round: for the "no overlapping" checks each one is a capsule along its heading,
   as long as its (shared) pose, and as big as it is drawn (sizeOf: a lion's is half as big again):
   half its length HALF_LEN[pose] x size, its radius BODY x size. */
export const HALF_LEN = { walk: 0.42, loaf: 0.38, stretch: 0.5, sit: 0.17, sleep: 0.12 };
export const BODY = 0.26;
/** How far a cat walking straight from (ax, az) to (bx, bz) passes from `o`'s body (units; below 0 it
    would walk into it): the walker's capsule swept along the way, its nose past the end. */
export function pathGap(a, ax, az, bx, bz, o) {
  const l = Math.hypot(bx - ax, bz - az) || 1, h = HALF_LEN.walk * a.size, ex = bx + ((bx - ax) / l) * h, ez = bz + ((bz - az) / l) * h;
  const oh = (HALF_LEN[o.pose] || 0.3) * o.size, ox = Math.cos(o.yaw) * oh, oz = -Math.sin(o.yaw) * oh;
  const cp = closestPoints(ax, az, ex, ez, o.x - ox, o.z - oz, o.x + ox, o.z + oz);
  return Math.hypot(cp[2] - cp[0], cp[3] - cp[1]) - BODY * (a.size + o.size);
}
/** How far apart two cats' bodies are (units; below 0 they overlap by that much): `a` as if at (x, z)
    facing yaw in pose, `b` where it is (in its pose, or `bpose`: at its walking length, say, so a
    cat settling beside it leaves it room to get up). */
export function bodyGap(a, x, z, yaw, pose, b, bpose = b.pose) {
  const h = (HALF_LEN[pose] || 0.3) * a.size, fx = Math.cos(yaw) * h, fz = -Math.sin(yaw) * h;
  const bh = (HALF_LEN[bpose] || 0.3) * b.size, bx = Math.cos(b.yaw) * bh, bz = -Math.sin(b.yaw) * bh;
  const cp = closestPoints(x - fx, z - fz, x + fx, z + fz, b.x - bx, b.z - bz, b.x + bx, b.z + bz);
  return Math.hypot(cp[2] - cp[0], cp[3] - cp[1]) - BODY * (a.size + b.size);
}

/** Plain words for the tag that follows a chosen cat. */
const SAY = {
  bed: "Heading for a nap", napBed: "Napping in a cat bed", napSun: "Napping in the sun", napGrass: "Napping on the grass",
  pileGo: "Off to nap with friends", pile: "Napping in a pile with friends", blanket: "Napping on the picnic blanket",
  settle: "Settling in", circle: "Turning round before lying down", sniffSpot: "Sniffing the spot",
  wake: "Waking up", yawn: "A big yawn", stretch: "A long stretch", shake: "A good shake",
  eatGo: "Off to the food bowl", eat: "Eating", lick: "Licking its whiskers",
  drinkGo: "Off for a drink", drink: "Having a drink", climbGo: "Off to a cat tree", climb: "Climbing the cat tree", sizeUp: "Sizing up the jump",
  perch: "Watching from the cat tree", top: "On top of the cat tree", porchGo: "Off to the porch", porch: "Sitting on the porch step",
  play: "Playing with the yarn", stalk: "Stalking the yarn", crouch: "Crouched, eyes on the target", wiggle: "Getting ready to pounce", pounce: "Pounce!",
  groom: "Having a wash", legLick: "Washing a hind leg", earScratch: "Scratching an ear", wander: "Having a look around", look: "Looking around", rest: "Resting a moment",
  zoom: "Zoomies!", pant: "Catching its breath", atYou: "Looking at you", turnToYou: "Turning round to look at you", turnAway: "Pointedly not looking at you",
  hopDown: "Hopping down", sunLoaf: "Basking in the sun",
  sunGo: "Off to a sunny spot", roll: "Rolling in the sun", bask: "Basking in the sun", flop: "Sprawled out in the sun",
  butterfly: "Stalking a butterfly", leap: "Leaping at a butterfly", missed: "Watching the butterfly get away",
  birdGo: "Creeping up on a bird", swat: "Swat!", birdGone: "Watching the bird fly off", chatter: "Chattering at a bird",
  pondGo: "Off to the pond", pond: "Watching the pond", dab: "Dabbing at the water",
  invite: "Inviting a friend to play", declined: "Its friend is not in the mood", notNow: "Not in the mood to play", wait: "Waiting its turn",
  sniff: "Sniffing about", knead: "Kneading", greet: "Saying hello, tail up", headBunt: "Rubbing cheeks", scratch: "Sharpening its claws",
  hindStand: "Up on its hind legs for a better look", beckon: "Waving a paw", spin: "Turning slow circles",
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

/** Traits made whole: every number 0..1 (0.5 when missing), words and flags as given. */
export function traitsFrom(x) {
  const t = { ...NEUTRAL_TRAITS };
  if (x && typeof x === "object") {
    for (const k of Object.keys(NEUTRAL_TRAITS)) {
      const v = x[k], n = NEUTRAL_TRAITS[k];
      if (typeof n === "number") { if (Number.isFinite(v)) t[k] = clamp(v, 0, 1); }
      else if (Array.isArray(n)) { if (Array.isArray(v)) t[k] = v.slice(); }
      else if (v != null) t[k] = v;
    }
  }
  return t;
}

/**
 * Builds the garden's cat simulation.
 * @param {object} o
 * @param {Array} o.residents  [{id, name, model?: "cat" | "ginger", traits?, style?}]
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

  /** Spots other cats need to reach: the bowl and dish stands, the foot of the stairs and the trees, the pond edge. */
  const STANDS = [...L.BOWLS.map((b) => b.stand), ...L.WATERS.map((w) => w.stand), L.STEP.ground, ...L.TREES.flatMap((t) => [t.ground, t.landing]), ...L.POND_SPOTS];
  // Only the bowls, dishes and pond spots a cat can actually stand at (a prop set down over one,
  // like the research desk by the first bowls, puts it out of reach: a cat would get up, find no
  // way there and give up, again and again).
  const standable = (p, id) => nav.pointFree(p.x, p.z, nav.clearR - 0.02, id ? new Set([id]) : null);
  const BOWLS = L.BOWLS.filter((b) => standable(b.stand, b.id));
  /** Every bowl and dish in the garden, by id. */
  const RIM_OF = new Map([...L.BOWLS, ...L.WATERS].map((b) => [b.id, b]));
  const WATERS = L.WATERS.filter((w) => standable(w.stand, w.id));
  const POND_SPOTS = L.POND_SPOTS.filter((p) => standable(p));
  const PILE_SLOTS = L.NAP_PILES.flatMap((p) => p.slots.map((_, k) => ({ id: `${p.id}#${k}`, pile: p, k, ...L.slotAt(p, k) })));
  const inPile = (x, z, pad = 0) => L.NAP_PILES.some((p) => p.r ? Math.hypot(p.x - x, p.z - z) < p.r + pad : Math.hypot(p.x - x, p.z - z) < Math.max(p.w, p.d) / 2 + pad);

  /** Is (x, z) a reasonable place for a cat to stop: clear of props, other cats and their destinations. */
  function spotOk(x, z, self, space = L.CAT.personal * 1.12) {
    if (!nav.pointFree(x, z, L.CAT.clearR + 0.05)) return false;
    const k = (self ? self.size : 1) * 0.5;
    for (const c of cats) {
      if (c === self) continue;
      // (room for both: a big cat takes more of it)
      const sp = space * (k + c.size * 0.5);
      if (Math.abs(c.x - x) < sp && Math.abs(c.z - z) < sp && Math.hypot(c.x - x, c.z - z) < sp) return false;
      if (c.dest && Math.hypot(c.dest.x - x, c.dest.z - z) < sp) return false;
    }
    for (const b of L.BEDS) if (Math.hypot(b.x - x, b.z - z) < b.r + 0.5) return false;
    for (const s of L.SUN_PATCHES) if (Math.hypot(s.x - x, s.z - z) < s.r) return false;
    if (inPile(x, z, 0.4)) return false;
    for (const p of STANDS) if (Math.hypot(p.x - x, p.z - z) < 0.85) return false;
    return true;
  }

  /** True when no other cat is sitting (or lying) on this spot. */
  function clearOfCats(p, self, room = 0.7) {
    const k = (self ? self.size : 1) * 0.5;
    for (const c of cats) {
      if (c === self || c.moving) continue;
      const r = room * (k + c.size * 0.5);
      if (Math.abs(c.x - p.x) < r && Math.abs(c.z - p.z) < r && Math.hypot(c.x - p.x, c.z - p.z) < r) return false;
    }
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
      return [go(s, "stroll", 0.25, SAY.wander)];
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
    const t = traitsFrom(r.traits), style = { tempo: 1, ...(r.style && typeof r.style === "object" ? r.style : {}) };
    const kit = t.age === "kitten", old = t.age === "senior", fat = t.build === "chunky", short = t.legs === "short";
    const blind = t.flags.includes("blind"), gentle = t.flags.includes("gentle"), sig = t.signature;
    // Its own rhythm, centred on its character; the seed only nudges it (±7%), the same every visit.
    const j = () => rnd.range(0.93, 1.07);
    const tune = {
      pace: clamp((0.88 + 0.24 * t.energy + (kit ? 0.04 : 0) - (old ? 0.1 : 0) - (fat ? 0.05 : 0) - (short ? 0.05 : 0) - (blind ? 0.14 : 0)) * j(), 0.7, 1.15), // walking speed
      sleepy: lerp(0.7, 1.3, t.sleepy) * (sig === "ringCurl" ? 1.15 : 1) * j(), // how quickly it tires, how long it naps
      playful: clamp(lerp(0.6, 1.4, t.playful) + (kit ? 0.3 : 0) - (old ? 0.3 : 0), 0.35, 1.8) * j(),
      social: lerp(0.5, 1.3, t.social) * j(),
      climber: blind ? 0 : Math.max(0.15, lerp(0.6, 1.4, t.grace) - (fat ? 0.25 : 0) - (short ? 0.3 : 0) - (old ? 0.3 : 0)) * j(),
      tidy: lerp(0.7, 1.3, t.proud) * (sig === "wash" ? 1.3 : 1) * j(),
      hungry: lerp(0.8, 1.25, t.foodie) * j(),
      hunter: (blind ? 0.3 : lerp(0.6, 1.5, t.hunter)) * j(), // how keen on butterflies and birds
      rhythm: clamp(lerp(1.4, 1.0, t.energy) * (old ? 1.1 : 1) * j(), 0.9, 1.55), // stretches or shortens every hold
      breath: rnd.range(0.85, 1.15) * (kit ? 1.12 : 1) * (fat || t.size === "bigcat" ? 0.9 : 1), // its breathing rate
    };
    const watcher = sig === "slowBlink" || sig === "stareDown" || sig === "headTilt";
    const p = {
      viewer: clamp(0.1 + 0.3 * t.social + 0.12 * t.curious + 0.08 * t.bold - 0.1 * t.grumpy + (watcher ? 0.2 : 0), 0.05, 0.6), // looks at you
      sniff: clamp(0.25 + 0.6 * t.curious, 0.1, 0.9), // stops to sniff
      loaf: clamp(0.3 + 0.35 * t.sleepy - 0.15 * t.proud + (sig === "loaf" || sig === "sphinxWatch" ? 0.3 : 0) - (sig === "boxSit" ? 0.2 : 0), 0.1, 0.9), // rests lying, not sitting
      knead: clamp(0.15 + 0.35 * t.social + 0.25 * t.sleepy + (sig === "lapClaim" ? 0.5 : 0), 0.05, 0.95),
      fidget: clamp(0.25 + 0.25 * t.energy + 0.15 * t.curious - 0.15 * t.sleepy, 0.12, 0.6),
    };
    const need = (bias = 0) => clamp(rnd.range(0.05, 0.85) + bias, 0.02, 0.95), start = allowedAction(t, "sit");
    const needs = { sleep: need((t.sleepy - 0.5) * 0.4), hunger: need((t.foodie - 0.5) * 0.2), thirst: need(), play: need((t.playful - 0.5) * 0.3), groom: need(), social: need((t.social - 0.5) * 0.2), explore: need((t.curious - 0.5) * 0.2) };
    return {
      id: r.id, name: r.name, model: r.model === "ginger" ? "ginger" : "cat", index: i,
      rnd, traits: t, style, tune, p, needs, size: sizeOf({ style }),
      kitten: kit, gentle, blind, lazy: t.energy < 0.3 || (old && t.energy < 0.45),
      x: 0, y: 0, z: 0, yaw: rnd.range(-Math.PI, Math.PI), speed: 0,
      // (it starts sitting, or standing if its own model can't sit: traits.avoid)
      posture: start,
      motion: { action: start, posture: start, gait: null, u: null, odometer: 0, yawRate: 0, look: null, since: 0 },
      pose: POSTURE_POSE[start] || "sit", poseSince: 0, prevPose: POSTURE_POSE[start] || "sit",
      anim: { bob: 0, pitch: 0, pivot: 0, roll: 0, rollY: 0, sx: 1, sy: 1, sz: 1 }, rollS: 0,
      act: null, last: null, lastZoom: -999, chaseCool: 0, holds: new Set(), dest: null, perch: null, cool: {},
      phase: rnd.range(0, 100), stride: 0, doing: SAY.look, moving: false, route: null, stall: 0, waitUntil: 0, stopUntil: 0, px: 0, pz: 0, pyaw: 0,
      // What this tick's step wants shown ("move" for travel: the gait picks the clip), and how far through it is.
      detour: null, stallX: 0, stallZ: 0, wa: start, wu: null, stalk: false, runIntent: false, pivoting: false, gaitSince: 0, moveSince: 0, slowFor: 0, brakeT: Infinity,
      lookAt: { x: 0, y: 0, z: 0 }, lookOn: false, greetedBy: null, greetUntil: 0, snubFrom: null, snubUntil: 0, hopPitch: 0,
      // (the speed its step asks for, how much of its step another cat's body or a prop took back and for how long)
      wantV: 0, lastWa: start, held: 0, heldProp: 0, heldT: 0, crowdBy: null, crowdT: 0, ySettle: false, hardSum: 0, squeezeT: 0,
    };
  }

  residents.forEach((r, i) => cats.push(makeCat(r, i)));
  for (const c of cats) c.growth = NEEDS.map((n) => GROWTH[n] * needRate(c, n));
  const byIdMap = new Map(cats.map((c) => [c.id, c]));

  /* ── Choosing what to do ───────────────────────────────────────────── */

  function freeSleepPlaces(cat) {
    const out = [];
    for (const b of L.BEDS) if (free(b.id)) out.push({ id: b.id, x: b.x, z: b.z, y: b.y, kind: "bed", ignore: b.id });
    for (const s of L.SUN_PATCHES) s.slots.forEach(([dx, dz], k) => { const id = `${s.id}#${k}`; if (free(id)) out.push({ id, x: s.x + dx, z: s.z + dz, y: 0, kind: "sun" }); });
    return out.filter((p) => p.kind === "bed" || clearOfCats(p, cat, 0.9));
  }

  function leaders(cat) {
    return cats.filter((c) => c !== cat && c.moving && c.y < 0.05 && c.act && !["follow", "zoomies", "chase", "chased", "visit"].includes(c.act.kind)
      && Math.abs(c.x - cat.x) < 7 && Math.abs(c.z - cat.z) < 7);
  }

  /** Settled: holding a pose (not asleep, not in the middle of a yawn or a posture change) for a while. */
  function settled(c, since = 2) {
    const a = c.act, s = a && a.steps[a.i];
    if (!s || s.type !== "hold" || !a.started || a.t < since || a.fid || time - c.motion.since < 1) return false;
    const p = ACTIONS[s.action].posture;
    return p === "sit" || p === "lie" || p === "stand";
  }

  /** Cats that might drop what they are doing for a chase: settled, awake, up for it (a grumpy
      one may be asked, and will say no), and not right up against this one (both get up to face
      each other, and two standing cats need the room). */
  function playmates(cat) {
    return cats.filter((c) => c !== cat && !c.perch && c.y < 0.05 && c.act && ["rest", "wander", "groom"].includes(c.act.kind) && settled(c)
      && c.needs.sleep < 0.75 && !c.gentle && !c.lazy && time > c.chaseCool
      && Math.abs(c.x - cat.x) < 6 && Math.abs(c.z - cat.z) < 6 && Math.hypot(c.x - cat.x, c.z - cat.z) < 6 && Math.hypot(c.x - cat.x, c.z - cat.z) > 0.7 * (cat.size + c.size));
  }

  /** Friends resting nearby that a sociable cat might go and greet. */
  function friends(cat) {
    return cats.filter((c) => c !== cat && !c.perch && c.y < 0.05 && settled(c, 1.5) && !c.greetedBy && c.traits.grumpy < 0.7
      && Math.abs(c.x - cat.x) < 7 && Math.abs(c.z - cat.z) < 7 && Math.hypot(c.x - cat.x, c.z - cat.z) > 1.4);
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

  const canChase = (cat) => !cat.gentle && !cat.lazy && time > cat.chaseCool && cat.traits.grumpy < 0.75;

  function choose(cat) {
    const n = cat.needs, k = cat.tune, t = cat.traits, rnd = cat.rnd;
    const opts = [];
    const add = (kind, score) => {
      if (score > 0 && !(cat.cool[kind] > time)) opts.push([kind, score + rnd.range(0, 0.28) - (cat.last === kind ? 0.35 : 0)]);
    };
    add("nap", n.sleep * 1.0 * k.sleepy);
    if (PILE_SLOTS.some((s) => free(s.id))) add("pile", n.sleep * (0.6 + k.social * 0.4) * k.sleepy);
    if (L.SUN_PATCHES.some((s) => s.slots.some((_, j) => free(`${s.id}#${j}`)))) add("sunroll", 0.08 + (n.play * 0.35 + n.sleep * 0.4) * (cat.gentle ? 0.7 : k.playful));
    if (BOWLS.some((b) => free(b.id) && clearOfCats(b.stand, cat))) add("eat", n.hunger * 1.15 * k.hungry);
    if (WATERS.some((w) => free(w.id) && clearOfCats(w.stand, cat))) add("drink", n.thirst * 1.05);
    if (yarns.some((y) => !y.player)) add("play", n.play * 0.7 * k.playful * (cat.lazy ? 0.5 : 1));
    if (canChase(cat) && n.play > 0.35 && playmates(cat).length) add("chase", n.play * 0.6 * k.playful * (0.5 + k.social * 0.5));
    if (!cat.blind && n.sleep < 0.75 && lowButterflies(cat).length) add("butterfly", 0.12 + n.play * 1.0 * k.hunter);
    if (!cat.blind && n.sleep < 0.85 && landedBirds(cat).length) add("bird", 0.4 + n.play * 0.9 * k.hunter);
    if (POND_SPOTS.some((p) => free(p.id))) add("pond", n.explore * (0.45 + 0.35 * t.curious));
    if (k.climber > 0 && L.TREES.some((T) => free(T.low.id) && clearOfCats(T.ground, cat))) add("climb", n.explore * 0.72 * k.climber);
    if (!cat.blind && free(L.STEP.id) && clearOfCats(L.STEP.ground, cat)) add("porch", n.explore * 0.5);
    add("groom", n.groom * 0.95 * k.tidy);
    if (leaders(cat).length) add("follow", n.social * 0.6 * k.social * (cat.kitten ? 1.3 : 1));
    if (t.social > 0.45 && friends(cat).length) add("visit", n.social * 0.7 * k.social);
    add("wander", 0.26 + n.explore * 0.42 * (0.7 + 0.6 * t.curious));
    // Cats are thrifty with effort: one already sitting or lying is happy to stay put a while longer.
    const down = cat.posture === "sit" || cat.posture === "lie";
    add("rest", 0.16 + n.sleep * 0.35 + (1 - t.energy) * 0.15 + (down ? 0.3 : 0));
    // Zoomies: kittens and lively, playful cats; never a lazy or a gentle one.
    if (!cat.gentle && !cat.lazy && time - cat.lastZoom > (cat.kitten ? 60 : 120) && n.sleep < 0.5
      && rnd.chance(0.01 + 0.06 * t.playful * t.energy + (cat.kitten ? 0.06 : 0))) opts.push(["zoomies", 3]);
    opts.sort((a, b) => b[1] - a[1]);
    for (const [kind] of opts) { const act = build(cat, kind); if (act) return act; }
    return build(cat, "rest");
  }

  /* ── Building an activity: a list of small steps ───────────────────── */

  const dur = (cat, a, b) => cat.rnd.range(a, b) * cat.tune.rhythm;
  const tempoOf = (cat) => clamp(cat.style.tempo ?? 1, 0.6, 1.5);
  /** One-off actions last as long as their clip (catrig: yawn 2 s, stretch 2.2 s at tempo 1, shake 0.8 s). */
  const onceDur = (cat, action) => (action === "shake" ? 0.8 : action === "yawn" ? 2 * tempoOf(cat) : action === "stretch" ? 2.2 * tempoOf(cat) : 1);
  const hold = (action, d, doing, o) => ({ type: "hold", action, dur: d, doing, ...o });
  const once = (cat, action, doing, o) => hold(action, onceDur(cat, action), doing, { fidget: false, ...o });
  const go = (p, mode, arrive, doing, o) => ({ type: "go", x: p.x, z: p.z, mode, arrive, doing, ...o });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const nearest = (cat, list, key = (p) => p) => list.slice().sort((p, q) => dist(key(p), cat) - dist(key(q), cat))[0];

  /** Travel speed for a kind of travel, at this cat's pace, kept inside its gait band. */
  function speedOf(cat, mode) {
    const v = SPEED[mode] * cat.tune.pace;
    if (mode === "zoom" || mode === "flee" || mode === "pursue") return Math.max(RUN_MIN, v);
    if (mode === "hurry") return cat.lazy ? Math.min(WALK_MAX, SPEED.purpose * cat.tune.pace) : clamp(v, TROT_MIN, TROT_MAX);
    if (mode === "stalk" || mode === "creep") return v;
    return Math.min(WALK_MAX, v);
  }

  /** Before anything else, a cat on a perch turns to the ground and hops down (beside the spot below,
      if another cat is sitting on it: it never lands on a cat). */
  function leavePerch(cat) {
    if (!cat.perch) return [];
    const p = cat.perch;
    let g = p.ground;
    const clear = (q) => !crowding(cat, q.x, q.z, yawTo(q.x - cat.x, q.z - cat.z), "walk", 0.05);
    if (!clear(g)) {
      for (let k = 0; k < 10; k++) {
        const a = cat.rnd.range(0, Math.PI * 2), d = cat.rnd.range(0.45, 0.9), q = { x: p.ground.x + Math.cos(a) * d, z: p.ground.z + Math.sin(a) * d };
        if (nav.pointFree(q.x, q.z, L.CAT.clearR) && nav.segmentClear(p.ground.x, p.ground.z, q.x, q.z, null, nav.bodyR) && clear(q)) { g = q; break; }
      }
    }
    return [
      { type: "turn", yaw: yawTo(g.x - cat.x, g.z - cat.z), doing: SAY.hopDown },
      { type: "hop", x: g.x, z: g.z, y: 0, air: 0.36 + p.y * 0.1, apex: 0.16, doing: SAY.hopDown, down: p, then: () => { release(cat, p.id); cat.perch = null; } },
    ];
  }

  /** Waking: it lifts its head and lies a moment, maybe sits up to yawn, then gets up for a long stretch. */
  function wakeSteps(cat) {
    const rnd = cat.rnd, t = cat.traits;
    const s = [hold("loaf", dur(cat, 1.5, 3.5), SAY.wake, { fidget: false, look: "about", then: () => { cat.needs.sleep = Math.min(cat.needs.sleep, 0.08); } })];
    if (rnd.chance(0.15 + 0.3 * t.sleepy)) s.push(once(cat, "yawn", SAY.yawn));
    s.push(once(cat, "stretch", SAY.stretch));
    if (rnd.chance(0.06 + 0.12 * t.energy)) s.push(once(cat, "shake", SAY.shake));
    return s;
  }

  /** Lie down and sleep where it arrives: a sniff, a turn round, kneading, lying down, curling up. */
  function sleepSteps(cat, say, sleepFor) {
    const rnd = cat.rnd, s = [];
    if (rnd.chance(cat.p.sniff * 0.35)) s.push(hold("sniff", dur(cat, 1.2, 2.4), SAY.sniffSpot, { fidget: false }));
    s.push({ type: "circle", turns: rnd.range(0.8, 1.5), doing: SAY.circle });
    if (rnd.chance(cat.p.knead * 0.7)) s.push(hold("knead", dur(cat, 3, 6), SAY.knead, { fidget: false }));
    s.push(hold("loaf", dur(cat, 2.5, 6), SAY.settle, { fidget: false, look: "about" }));
    s.push(hold("sleep", sleepFor, say, { restore: { sleep: 1.4 / sleepFor }, fidget: false }));
    s.push(...wakeSteps(cat));
    return s;
  }

  function build(cat, kind) {
    // (A cat whose own model can't lie down or wash (traits.avoid) doesn't go off to nap or to wash: it
    // would only stand there.)
    if (((kind === "nap" || kind === "pile") && !canDo(cat.traits, "sleep") && !canDo(cat.traits, "loaf")) || (kind === "groom" && !canDo(cat.traits, "groom"))) return null;
    const rnd = cat.rnd, t = cat.traits, steps = [...leavePerch(cat)];
    const act = { kind, steps, i: 0, t: 0, reason: SAY.look, ignore: new Set() };
    switch (kind) {
      case "nap": {
        const places = freeSleepPlaces(cat);
        let p = null;
        if (places.length) {
          // Nearest-ish, with a little whim; sleepier cats love the sun.
          const scored = places.map((pl) => [pl, dist(pl, cat) * rnd.range(0.7, 1.3) - (pl.kind === "sun" ? cat.tune.sleepy * 0.8 : 0)]);
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
        steps.push(go(p, "purpose", 0.12, SAY.bed), ...sleepSteps(cat, say, dur(cat, 60, 140) * cat.tune.sleepy));
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
        steps.push(go(s, "purpose", 0.12, SAY.pileGo), ...sleepSteps(cat, say, dur(cat, 70, 160) * cat.tune.sleepy));
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
          go(s, "purpose", 0.15, SAY.sunGo),
          { type: "turn", yaw: -Math.PI / 2 + rnd.range(-0.6, 0.6), doing: SAY.sunGo },
        );
        if (cat.gentle) steps.push(hold("loaf", dur(cat, 20, 40), SAY.bask, { look: "about", restore: { play: 0.01, sleep: 0.004 } }));
        else {
          // Over on its side in the warmth, a wriggle on its back, then a long bask.
          steps.push(hold("flop", dur(cat, 4, 8), SAY.flop, { fidget: false }));
          if (rnd.chance(0.35 + 0.5 * t.playful)) steps.push(hold("roll", dur(cat, 3, 5.5), SAY.roll, { restore: { play: 0.08 }, fidget: false }));
          steps.push(hold("flop", dur(cat, 10, 24), SAY.bask, { restore: { play: 0.02, sleep: 0.006 }, fidget: false }));
        }
        if (rnd.chance(0.45)) steps.push(hold("sleep", dur(cat, 20, 50) * cat.tune.sleepy, SAY.napSun, { restore: { sleep: 0.03 }, fidget: false }), ...wakeSteps(cat));
        steps.push({ type: "call", fn: () => { cat.needs.play = Math.min(cat.needs.play, 0.3); } });
        break;
      }
      case "eat":
      case "drink": {
        const list = (kind === "eat" ? BOWLS : WATERS).filter((b) => free(b.id) && clearOfCats(b.stand, cat));
        if (!list.length) return null;
        const b = nearest(cat, list, (p) => p.stand);
        if (!reserve(b.id, cat)) return null;
        act.ignore.add(b.id); // it may come right up to its own bowl
        cat.dest = { ...b.stand };
        const d = kind === "eat" ? dur(cat, 7, 13) : dur(cat, 4, 8);
        act.reason = kind === "eat" ? SAY.eatGo : SAY.drinkGo;
        // A hungry, lively cat trots to its bowl.
        const mode = kind === "eat" && cat.needs.hunger > 0.8 && t.energy > 0.55 && t.foodie > 0.5 ? "hurry" : "purpose";
        steps.push(
          go(b.stand, mode, 0.1, act.reason),
          { type: "turn", yaw: b.yaw, doing: act.reason },
          hold("eat", d, kind === "eat" ? SAY.eat : SAY.drink, { restore: kind === "eat" ? { hunger: 1.2 / d } : { thirst: 1.2 / d }, fidget: false }),
        );
        if (kind === "eat" && rnd.chance(0.4 + 0.3 * t.proud)) steps.push(hold("groom", dur(cat, 3, 6), SAY.lick, { fidget: false }));
        steps.push({ type: "call", fn: () => release(cat, b.id) });
        break;
      }
      case "climb": {
        if (!canDo(t, "hop")) return null; // (a model that can't leap doesn't climb)
        const trees = L.TREES.filter((T) => free(T.low.id) && clearOfCats(T.ground, cat));
        if (!trees.length) return null;
        const T = nearest(cat, trees, (x) => x.ground);
        if (dist(T.ground, cat) > 14 || !reserve(T.low.id, cat)) return null;
        cat.dest = { ...T.ground };
        act.reason = SAY.climbGo;
        const up = { x: T.low.x, y: T.low.y + 0.3, z: T.low.z };
        steps.push(
          go(T.ground, "purpose", 0.12, SAY.climbGo),
          { type: "turn", yaw: yawTo(T.low.x - T.ground.x, T.low.z - T.ground.z), doing: SAY.climb },
          // Now and then a good scratch on the post before going up.
          ...(rnd.chance(0.45) ? [hold("scratch", dur(cat, 2, 3.6), SAY.scratch, { fidget: false })] : []),
          // Eyes on the platform, a little crouch, then up.
          hold("crouch", rnd.range(0.5, 0.9) * tempoOf(cat), SAY.sizeUp, { target: () => up, fidget: false }),
          { type: "hop", x: T.low.x, z: T.low.z, y: T.low.y, air: 0.52, apex: 0.4, doing: SAY.climb, then: () => { cat.perch = { id: T.low.id, ground: T.ground, y: T.low.y }; } },
          hold("sit", dur(cat, 10, 22), SAY.perch, { look: "about", restore: { explore: 0.04 } }),
        );
        if (rnd.chance(0.45 * cat.tune.climber)) steps.push({ type: "upTop", tree: T });
        else if (rnd.chance(0.4)) steps.push(hold("loaf", dur(cat, 10, 20), SAY.perch, { look: "about", restore: { explore: 0.03 } }));
        steps.push({ type: "call", fn: () => { cat.needs.explore = 0.1; } });
        break;
      }
      case "porch": {
        const S = L.STEP;
        if (!canDo(t, "hop") || dist(S.ground, cat) > 14 || !reserve(S.id, cat)) return null;
        cat.dest = { ...S.ground };
        act.reason = SAY.porchGo;
        steps.push(
          go(S.ground, "stroll", 0.1, SAY.porchGo),
          { type: "turn", yaw: yawTo(S.x - S.ground.x, S.z - S.ground.z), doing: SAY.porchGo },
          hold("crouch", rnd.range(0.4, 0.6) * tempoOf(cat), SAY.porchGo, { fidget: false }),
          { type: "hop", x: S.x, z: S.z, y: S.y, air: 0.36, apex: 0.18, doing: SAY.porchGo, then: () => { cat.perch = { id: S.id, ground: S.ground, y: S.y }; } },
          { type: "turn", yaw: S.sitYaw, doing: SAY.porch },
          hold("sit", dur(cat, 14, 30), SAY.porch, { look: "about", restore: { explore: 0.03 } }),
        );
        if (rnd.chance(0.45)) steps.push(hold("loaf", dur(cat, 12, 25), SAY.porch, { look: "about", restore: { sleep: 0.008 } }));
        steps.push({ type: "call", fn: () => { cat.needs.explore = 0.12; } });
        break;
      }
      case "pond": {
        const spots = POND_SPOTS.filter((p) => free(p.id) && clearOfCats(p, cat));
        if (!spots.length) return null;
        const p = nearest(cat, spots);
        if (dist(p, cat) > 15 || !reserve(p.id, cat)) return null;
        cat.dest = { x: p.x, z: p.z };
        act.reason = SAY.pondGo;
        const water = { x: p.x + Math.cos(p.yaw) * 1.3, z: p.z - Math.sin(p.yaw) * 1.3 };
        steps.push(
          go(p, "stroll", 0.15, SAY.pondGo),
          { type: "turn", yaw: p.yaw, doing: SAY.pond },
          hold("sit", dur(cat, 8, 16), SAY.pond, { look: "about", home: water, restore: { explore: 0.04 } }),
        );
        if (rnd.chance(0.6)) steps.push(hold("dab", dur(cat, 2, 3.5), SAY.dab, { target: () => water, restore: { play: 0.05 }, fidget: false }), hold("loaf", dur(cat, 8, 16), SAY.pond, { look: "about", home: water, restore: { explore: 0.03 } }));
        else steps.push(hold("sit", dur(cat, 6, 12), SAY.pond, { look: "about", home: water, restore: { explore: 0.03 } }));
        steps.push({ type: "call", fn: () => { cat.needs.explore = 0.1; } });
        break;
      }
      case "play": {
        const y = nearest(cat, yarns.filter((v) => !v.player));
        if (!y || dist(y, cat) > 13 || !canDo(t, "pounce")) return null;
        y.player = cat.id;
        act.yarn = y;
        act.reason = SAY.play;
        const pounces = cat.kitten ? rnd.int(2, 3) : rnd.int(1, 2);
        const eager = (cat.kitten || (t.energy > 0.65 && t.playful > 0.6)) && !cat.lazy;
        // Up to it at a walk (a keen kitten trots), the last stretch in a low stalk.
        steps.push({ type: "chase", target: () => y, stopAt: 2.3, mode: eager ? "hurry" : "purpose", until: 14, doing: SAY.play });
        for (let k = 0; k < pounces; k++) {
          steps.push(
            { type: "chase", target: () => y, stopAt: 1.2, mode: "stalk", stalk: true, until: 6, doing: SAY.stalk, skipIfNear: 1.5 },
            { type: "face", target: () => y, doing: SAY.crouch },
            hold("crouch", rnd.range(0.5, 1.1), SAY.crouch, { target: () => y, fidget: false }),
            hold("wiggle", rnd.range(0.5, 1.1), SAY.wiggle, { target: () => y, fidget: false }),
            { type: "hop", pounce: true, to: () => y, short: 0.42, y: 0, air: 0.32, apex: 0.2, doing: SAY.pounce, land: () => bat(cat, y) },
            // Eyes on the ball as it rolls off, before the next stalk.
            hold("stand", rnd.range(1, 2), SAY.play, { target: () => y, restore: { play: 0.12 }, fidget: false }),
          );
        }
        steps.push(hold("sit", dur(cat, 3, 7), SAY.play, { target: () => y, fidget: false }));
        steps.push({ type: "call", fn: () => { y.player = null; cat.needs.play = 0.05; } });
        break;
      }
      case "chase": {
        const mates = playmates(cat);
        if (!mates.length) return null;
        const mate = nearest(cat, mates);
        if (mate.traits.grumpy > 0.62 && rnd.chance(0.8)) return declined(cat, mate);
        return startChase(cat, mate);
      }
      case "butterfly": {
        const bs = lowButterflies(cat);
        if (!bs.length || !canDo(t, "pounce")) return null;
        const b = nearest(cat, bs);
        targeted.set(b, cat.id);
        act.prey = b;
        act.reason = SAY.butterfly;
        const tries = rnd.int(1, 2);
        for (let k = 0; k < tries; k++) {
          steps.push(
            { type: "chase", target: () => b, stopAt: 1.25, mode: k ? "purpose" : "stalk", stalk: !k, until: 7, doing: SAY.butterfly, endOk: true, giveUpIf: () => b.y > 2.4 },
            { type: "face", target: () => b, doing: SAY.wiggle },
            hold("wiggle", rnd.range(0.5, 0.9), SAY.wiggle, { target: () => b, fidget: false }),
            { type: "hop", pounce: true, to: () => ({ x: b.x, z: b.z }), short: 0.35, y: 0, air: 0.46, apex: 0.62, reach: true, start: () => critters?.startle?.(b, cat), doing: SAY.leap },
            hold("sit", rnd.range(1.8, 3), SAY.missed, { target: () => b, restore: { play: 0.1 }, tag: "after", fidget: false }),
          );
        }
        steps.push({ type: "call", fn: () => { targeted.delete(b); cat.needs.play = Math.max(0, cat.needs.play - 0.2); } });
        break;
      }
      case "bird": {
        const bs = landedBirds(cat);
        if (!bs.length || !canDo(t, "pounce")) return null;
        const b = nearest(cat, bs);
        targeted.set(b, cat.id);
        act.prey = b;
        act.reason = SAY.birdGo;
        const high = b.y > 0.4, gone = () => b.state !== "perched";
        steps.push(
          { type: "chase", target: () => b, stopAt: high ? 1.0 : 1.5, mode: "creep", stalk: true, until: 10, doing: SAY.birdGo, endOk: true, giveUpIf: gone, scareAt: 0.9 },
          { type: "face", target: () => b, doing: SAY.crouch },
          hold("crouch", rnd.range(0.6, 1.2), SAY.crouch, { target: () => b, abortIf: gone, fidget: false }),
          hold("wiggle", rnd.range(0.4, 0.8), SAY.wiggle, { target: () => b, abortIf: gone, fidget: false }),
          { type: "hop", pounce: true, to: () => ({ x: b.x, z: b.z }), short: high ? 0.55 : 0.5, y: 0, air: 0.42, apex: high ? 0.7 : 0.38, reach: true, start: () => critters?.startle?.(b, cat), doing: SAY.swat },
          // A keen hunter sits and chatters at the one that got away.
          hold(t.hunter > 0.55 ? "chatter" : "sit", rnd.range(2.5, 4.5), t.hunter > 0.55 ? SAY.chatter : SAY.birdGone, { target: () => b, restore: { play: 0.15 }, tag: "after", fidget: false }),
          { type: "call", fn: () => { targeted.delete(b); cat.needs.play = Math.max(0, cat.needs.play - 0.3); } },
        );
        break;
      }
      case "groom": {
        act.reason = SAY.groom;
        const pre = settleHere(cat, act);
        if (!pre) return null;
        steps.push(...pre);
        steps.push(hold("groom", dur(cat, 18, 36), SAY.groom, { restore: { groom: 0.05 } }));
        steps.push({ type: "call", fn: () => { cat.needs.groom = 0.05; } });
        break;
      }
      case "follow": {
        const ls = leaders(cat);
        if (!ls.length) return null;
        const lead = nearest(cat, ls);
        act.lead = lead;
        act.reason = `Following ${lead.name}`;
        // A hello first: face the friend with the tail straight up.
        steps.push({ type: "face", target: () => lead, doing: SAY.greet }, hold("greet", dur(cat, 1.2, 2.2), SAY.greet, { target: () => lead, fidget: false }));
        steps.push({ type: "follow", lead, until: dur(cat, 12, 24), doing: act.reason });
        steps.push({ type: "call", fn: () => { cat.needs.social = 0.08; } });
        break;
      }
      case "visit": {
        // Up to a friend who is resting, tail up, a cheek rub, then a sit beside it.
        const fs = friends(cat);
        if (!fs.length) return null;
        const f = nearest(cat, fs);
        if (dist(f, cat) > 9) return null;
        const a = Math.atan2(cat.z - f.z, cat.x - f.x) + rnd.range(-0.5, 0.5);
        const s = { x: f.x + Math.cos(a) * 0.85, z: f.z + Math.sin(a) * 0.85 };
        if (!nav.pointFree(s.x, s.z, L.CAT.bodyR)) return null;
        act.nuzzle = f; act.mate = f;
        act.reason = `Saying hello to ${f.name}`;
        cat.dest = s;
        const head = () => ({ x: f.x, y: 0.35, z: f.z });
        steps.push(
          go(s, "stroll", 0.2, act.reason, { then: () => { f.greetedBy = cat; f.greetUntil = time + 6; } }),
          { type: "face", target: () => f, doing: act.reason },
          hold("greet", dur(cat, 1, 1.6), SAY.greet, { target: head, fidget: false }),
          hold("headBunt", dur(cat, 1.8, 3.2), `Rubbing cheeks with ${f.name}`, { target: head, restore: { social: 0.15 }, fidget: false }),
          hold(rnd.chance(cat.p.loaf) ? "loaf" : "sit", dur(cat, 18, 40), `Keeping ${f.name} company`, { target: head, restore: { social: 0.03 } }),
          { type: "call", fn: () => { cat.needs.social = 0.08; if (f.greetedBy === cat) f.greetedBy = null; } },
        );
        break;
      }
      case "zoomies": {
        cat.lastZoom = time;
        act.reason = SAY.zoom;
        steps.push(hold("wiggle", 0.6, SAY.zoom, { fidget: false }));
        let from = { x: cat.x, z: cat.z };
        const legs = [];
        for (let k = 0; k < rnd.int(3, 4); k++) {
          const s = randomSpot(rnd, cat, { near: from, min: 2.5, max: 5 }) || randomSpot(rnd, cat);
          if (!s) break;
          legs.push(s);
          from = s;
        }
        if (!legs.length) return null;
        // Straight on from leg to leg (no slowing at the corners), braking only at the last.
        legs.forEach((s, k) => steps.push(go(s, "zoom", 0.5, SAY.zoom, { through: k < legs.length - 1, turn: TURN.zoom })));
        cat.dest = from;
        steps.push(hold("stand", rnd.range(0.6, 1.1), SAY.pant, { fidget: false }), hold("pant", dur(cat, 3, 5), SAY.pant, { restore: { play: 0.1 } }));
        break;
      }
      case "wander": {
        const s = randomSpot(rnd, cat, rnd.chance(0.8) ? { near: cat, min: 2.2, max: 6.5 } : { near: cat, min: 5, max: 11 }) || randomSpot(rnd, cat, { near: cat, min: 1.5, max: 8 });
        if (!s) return null;
        cat.dest = s;
        act.reason = SAY.wander;
        steps.push(go(s, "stroll", 0.25, SAY.wander));
        // Nose down to see who has been by; a curious cat more often.
        if (rnd.chance(cat.p.sniff)) steps.push(hold("sniff", dur(cat, 1.5, 3.5), SAY.sniff, { restore: { explore: 0.05 }, fidget: false }));
        if (t.signature === "hindStand" && rnd.chance(0.5)) steps.push(hold("hindStand", dur(cat, 2, 3.5), SAY.hindStand, { look: "about", fidget: false }));
        if (t.signature === "spin" && rnd.chance(0.4)) steps.push({ type: "circle", turns: rnd.range(1, 2), doing: SAY.spin });
        if (!rnd.chance(cat.p.loaf)) steps.push(hold("sit", dur(cat, 25, 60), SAY.look, { look: "about", restore: { explore: 0.04 } }));
        else steps.push(hold(t.signature === "drapeLean" && !cat.gentle && rnd.chance(0.6) ? "flop" : "loaf", dur(cat, 30, 70), SAY.rest, { look: "about", restore: { explore: 0.04, sleep: 0.004 } }));
        break;
      }
      case "rest":
      default: {
        act.kind = "rest";
        act.reason = SAY.rest;
        cat.dest = { x: cat.x, z: cat.z };
        const pre = settleHere(cat, act);
        if (pre) steps.push(...pre);
        // Staying put in the posture it is already in is the easiest rest of all.
        const lying = cat.posture === "lie" || cat.posture === "sleep" ? rnd.chance(0.85) : cat.posture === "sit" ? rnd.chance(cat.p.loaf * 0.5) : rnd.chance(cat.p.loaf);
        steps.push(hold(lying ? "loaf" : "sit", dur(cat, 30, 70), SAY.rest, { look: "about", restore: { sleep: 0.005 } }));
      }
    }
    return act;
  }

  /** A friendly bat at a ball of yarn as a pounce lands. */
  function bat(cat, y) {
    if (Math.hypot(y.x - cat.x, y.z - cat.z) > 0.9) return;
    const a = cat.yaw + cat.rnd.range(-0.5, 0.5), s = cat.rnd.range(1.2, 2.3);
    y.vx += Math.cos(a) * s; y.vz -= Math.sin(a) * s;
  }

  /** A grumpy cat asked to play says no: it turns its head away; the one asking gives up. */
  function declined(cat, mate) {
    cat.chaseCool = time + 45; mate.chaseCool = time + 30;
    mate.snubFrom = cat; mate.snubUntil = time + 5;
    const act = { kind: "invite", steps: [], i: 0, t: 0, reason: `Inviting ${mate.name} to play`, ignore: new Set() };
    act.steps.push(
      { type: "face", target: () => mate, doing: SAY.invite },
      hold("wiggle", 0.8, SAY.invite, { target: () => mate, fidget: false }),
      hold("sit", dur(cat, 2.5, 4.5), SAY.declined, { target: () => mate, fidget: false }),
      { type: "call", fn: () => { cat.needs.play = Math.max(0.2, cat.needs.play - 0.3); } },
    );
    return act;
  }

  /** A chase for two: `runner` dashes about the lawn, `chaser` gives chase, then both sit and pant.
      Returns the runner's activity; the chaser's starts at once (it was sitting or lying about). */
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
    runner.chaseCool = time + rnd.range(120, 240); chaser.chaseCool = time + chaser.rnd.range(120, 240);
    const run = { kind: "chase", steps: [], i: 0, t: 0, reason: `Playing chase with ${chaser.name}`, ignore: new Set(), mate: chaser, done: false };
    const give = { kind: "chased", steps: [], i: 0, t: 0, reason: `Chasing ${runner.name}`, ignore: new Set(), lead: runner };
    // The runner bows and wiggles until its friend is up and crouched, then is off.
    const ready = () => give.ready || runner.act !== run;
    run.steps.push(
      { type: "face", target: () => chaser, doing: SAY.invite },
      hold("wiggle", 3, SAY.invite, { target: () => chaser, fidget: false, until: () => run.t > 0.7 && ready() }),
      ...legs.map((s, k) => go(s, "flee", 0.5, `Running from ${chaser.name}`, { through: k < legs.length - 1, turn: TURN.zoom, then: k === legs.length - 1 ? () => { run.done = true; } : null })),
      hold("stand", rnd.range(0.6, 1), SAY.pant, { target: () => chaser, fidget: false }),
      { type: "face", target: () => chaser, doing: SAY.pant },
      hold("pant", dur(runner, 2.5, 4), SAY.pant, { target: () => chaser, restore: { play: 0.15 } }),
      { type: "call", fn: () => { runner.needs.play = 0.1; } },
    );
    runner.dest = from;
    give.steps.push(
      { type: "face", target: () => runner, doing: `Chasing ${runner.name}` },
      hold("crouch", 0.6, SAY.wiggle, { target: () => runner, fidget: false, then: () => { give.ready = true; } }),
      { type: "pursue", lead: runner, stopAt: 1.05, until: 20, doing: `Chasing ${runner.name}`, whileTrue: () => runner.act === run && !run.done },
      { type: "face", target: () => runner, doing: SAY.pant },
      hold("pant", dur(chaser, 2.5, 4), SAY.pant, { target: () => runner, restore: { play: 0.15 } }),
      { type: "call", fn: () => { chaser.needs.play = 0.12; } },
    );
    begin(chaser, give);
    chaser.dest = null;
    return run;
  }

  /** Swap in a new activity, releasing what the old one held. */
  function begin(cat, act) {
    if (cat.act) finish(cat, false);
    // (What its own model can't show (traits.avoid) it doesn't do: such a hold shows the nearest plain
    // pose it can, for as long, with no mannerisms slipped in.)
    for (const s of act.steps) if (s.type === "hold") { const a = allowedAction(cat.traits, s.action); if (a !== s.action) { s.action = a; s.fidget = false; s.anim = undefined; } }
    cat.act = act; act.i = 0; act.t = 0; act.started = false;
    // Whatever it stands in now (a bowl's clearance it walked into) it may stay in while it pulls
    // up, not be shoved out of in one tick before its first step starts.
    act.ignoreNow = withContaining(act.ignore, cat);
  }
  function finish(cat, completed) {
    const a = cat.act;
    if (!a) return;
    if (!completed) cat.cool[a.kind] = time + 6; // gave up: try something else for a while
    if (a.yarn && a.yarn.player === cat.id) a.yarn.player = null;
    if (a.prey && targeted.get(a.prey) === cat.id) targeted.delete(a.prey);
    if (a.nuzzle && a.nuzzle.greetedBy === cat) a.nuzzle.greetedBy = null;
    // A posture change cut short (only a forced activity does that) leaves the cat in the nearer posture.
    const st = a.steps[a.i];
    if (st && st.type === "trans" && a.started && a.t > st.dur * 0.5) cat.posture = ACTIONS[st.name].to;
    // Places held for the activity are let go, except the perch the cat still sits on.
    for (const h of [...cat.holds]) if (!cat.perch || h !== cat.perch.id) release(cat, h);
    cat.last = a.kind;
    cat.act = null;
    cat.dest = null;
    if (!completed) cat.route = null;
  }

  /* ── Running a step ────────────────────────────────────────────────── */

  /** Turns the cat's heading towards `want` at most `rate` rad/s. Returns the remaining difference. */
  function turnToward(cat, want, rate, dt) {
    const d = wrapAngle(want - cat.yaw);
    const s = Math.max(-rate * dt, Math.min(rate * dt, d));
    cat.yaw = wrapAngle(cat.yaw + s);
    return d - s;
  }

  /** Changes the cat's speed towards v, no quicker than it can speed up or brake. */
  function ease(cat, v, dt, run) {
    const a = v > cat.speed ? (run ? ACCEL_RUN : ACCEL) : (run ? BRAKE_RUN : BRAKE);
    cat.speed += clamp(v - cat.speed, -a * dt, a * dt);
    if (cat.speed < 1e-3) cat.speed = 0;
  }

  /** Walk towards (tx, tz) along the cat's current route at up to `vmax`. Returns "moving",
      "arrived" or "stuck". `through`: a leg that runs straight on into the next (no braking at its end). */
  function walk(cat, step, tx, tz, dt, vmax, arrive, ignore, through = false) {
    const act = cat.act;
    // (Re)plan when the target has moved away from the route's end, or on request.
    if (!cat.route || Math.hypot(cat.route.goal.x - tx, cat.route.goal.z - tz) > 0.6 || cat.route.stale) {
      // Standing in the clearance of a prop it has no business in (nudged there by another cat), it
      // first steps straight back out of it: a route from in there would run through the prop.
      let sx = cat.x, sz = cat.z, out = null;
      if (nav.containing(sx, sz).some((id) => !(ignore && ignore.has(id)))) {
        const q = { x: sx, z: sz };
        nav.project(q, ignore, nav.clearR + 0.03);
        if (Math.hypot(q.x - sx, q.z - sz) > 1e-3) { out = q; sx = q.x; sz = q.z; }
      }
      let pts = nav.route(sx, sz, tx, tz, ignore);
      if (!pts) {
        // The target is tucked against something (a ball of yarn by a bush, say): aim just clear of it.
        const q = { x: tx, z: tz };
        nav.project(q, ignore, nav.clearR + 0.04);
        pts = nav.route(sx, sz, q.x, q.z, ignore);
      }
      if (!pts) return "stuck";
      if (out) pts.unshift(out);
      cat.route = { pts, i: 0, out: !!out, goal: { x: tx, z: tz }, check: 0, best: Infinity, bestAt: time, replans: (cat.route?.replans || 0), rx: NaN, rz: NaN, qx: tx, qz: tz };
    }
    const R = cat.route;
    // The target itself kept clear of props (worked out again only when it moves).
    if (tx !== R.rx || tz !== R.rz) {
      const q = { x: tx, z: tz };
      nav.project(q, ignore, nav.bodyR + 0.02);
      R.rx = tx; R.rz = tz; R.qx = q.x; R.qz = q.z;
      R.pts[R.pts.length - 1] = q;
    }
    tx = R.qx; tz = R.qz;
    const last = R.pts.length - 1;
    let wp = R.pts[R.i];
    if (R.i < last && Math.hypot(wp.x - cat.x, wp.z - cat.z) < (R.out && R.i === 0 ? 0.08 : 0.35)) { R.i++; wp = R.pts[R.i]; }
    if ((R.check -= dt) <= 0 && !(R.out && R.i === 0)) {
      R.check = 0.3;
      // String-pulling: skip a waypoint once the next one is in plain view.
      while (R.i < last && nav.segmentClear(cat.x, cat.z, R.pts[R.i + 1].x, R.pts[R.i + 1].z, withContaining(ignore, cat))) { R.i++; }
      wp = R.pts[R.i];
    }
    const d0 = Math.hypot(tx - cat.x, tz - cat.z);
    // Arrived (a cat not yet on its way that is only a shuffle off is there already, and one hemmed in
    // on its last stretch is as near as it will get); but a walk that has only just been seen goes on
    // a step or two first (no blip).
    const going = !!cat.motion.gait, shown = going ? time - cat.moveSince : 0;
    if (d0 < arrive + (going ? 0.01 : SHUFFLE) && (!going || shown >= 0.3 || through)) return "arrived";
    R.arrive = arrive; // (for the stall check: how near is near enough)
    if (R.closeEnough && d0 < arrive + CLOSE_ENOUGH + 1e-6 && (!going || shown >= 0.3)) return "arrived";

    // Progress check: a cat that makes no headway for a while gives up on this route. On the last
    // stretch (a bowl, a stand, a spot beside another cat) it gives up sooner: waiting there looks stuck.
    const close = d0 < 1.6;
    if (d0 < R.best - 0.15) { R.best = d0; R.bestAt = time; }
    else if (time - R.bestAt > (close ? 1.5 : 3.2)) {
      if (R.replans >= (close ? 1 : 2)) return "stuck";
      R.stale = true; R.replans++; R.bestAt = time;
    }
    const sprint = vmax >= RUN_MIN - 1e-6;
    if ((R.stalls >= 2 && !(cat.waitUntil > time)) || R.replans > 3) return "stuck";
    // Standing its moment (it has only just stopped), or hemmed in and waiting its turn: it stays
    // put, brakes if it has to, and does not tread on the spot. The progress check above still
    // gives up on the route if the way never opens.
    if (cat.stopUntil > time || cat.waitUntil > time) {
      if (cat.waitUntil > time) cat.doing = SAY.wait;
      cat.brakeT = cat.speed / (sprint ? BRAKE_RUN : BRAKE);
      ease(cat, 0, dt, sprint);
      advance(cat, dt);
      return "moving";
    }

    let dx = wp.x - cat.x, dz = wp.z - cat.z;
    const D = cat.detour;
    if (D) {
      if (time > D.until || Math.hypot(D.x - cat.x, D.z - cat.z) < 0.3) cat.detour = null;
      else { dx = D.x - cat.x; dz = D.z - cat.z; }
    }
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    // Personal space: ease away from other cats nearby, more from ones lying still. One lying in
    // its path a little way ahead it plans to pass (a point beside it, on the side it is already
    // a little to), in good time: cats step round each other, they don't bump into them.
    // (All of it by size: a big cat is passed wider and seen coming from further off.)
    const look = 1.3, my = cat.size;
    let block = null, blockAhead = Infinity, blockLat = 0;
    for (const o of cats) {
      if (o === cat || o.y > 0.3) continue;
      const k = (my + o.size) * 0.5, lk = look * k, room = L.CAT.personal * k;
      const ox = cat.x - o.x, oz = cat.z - o.z;
      if (ox > lk || ox < -lk || oz > lk || oz < -lk) continue;
      const d = Math.hypot(ox, oz);
      if (d > lk || d < 1e-4) continue;
      if (act && (act.lead === o || act.mate === o)) { if (d > 0.5 * k) continue; }
      else if (!o.moving && !D) {
        // In the way if it passes closer than both bodies side by side (and the other's length, if it lies across the way).
        const ahead = -(ox * dx + oz * dz), lat = ox * dz - oz * dx;
        const need = BODY * (my + o.size) + (HALF_LEN[o.pose] || 0.3) * o.size * Math.abs(Math.cos(o.yaw) * dz + Math.sin(o.yaw) * dx) + 0.05;
        if (ahead > 0.2 * k && ahead < blockAhead && Math.abs(lat) < need && d0 > d + 0.4 * k) { block = o; blockAhead = ahead; blockLat = lat; }
      }
      if (d < room) {
        const w = (room - d) / room * (o.moving ? 1.1 : 1.8);
        dx += (ox / d) * w; dz += (oz / d) * w;
      }
    }
    if (block) cat.detour = aside(cat, block, blockLat >= 0 ? -1 : 1);
    // Standing (or stopped by a body it walked into, its gait still showing), about to set off
    // straight into another cat's body (the one it waited for is still there): it goes round it if
    // it can, else waits on a moment rather than walk into it again, and after a while of that gives
    // up the walk. (No step or two into it and back, over and over: a blip, or a cat pushing.)
    if (cat.speed < 0.05) {
      // (stepping out from against another cat, that one's body doesn't hold it back: it is leaving it;
      // squeezing out of a knot of cats, no standing one does (a sitting or lying cat is never walked through))
      const skip = D && D.escape ? D.from : null, ghost = !!(D && D.ghost);
      let o = bodyAhead(cat, dx, dz, act, skip, ghost) || turnBlocked(cat, yawTo(dx, dz), act, skip, ghost) || propAhead(cat, dx, dz, ignore);
      if (o) {
        if (!D && o !== true && !o.moving) {
          // (The way round only if its first steps are clear too; standing in the other's body
          // already, first a step out of it.)
          const A = bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, o) < -0.05 ? clearSpot(cat, o, "walk") : aside(cat, o);
          if (A) { const ax = A.x - cat.x, az = A.z - cat.z; if (!bodyAhead(cat, ax, az, act) && !propAhead(cat, ax, az, ignore)) { cat.detour = { x: A.x, z: A.z, until: time + 3 }; dx = ax; dz = az; o = null; } }
        }
        // (Waited a moment already, and still hemmed in (pressed against another cat, one that came up
        // close while it sat, or squeezed between two, its way round blocked too): it steps out, away
        // from the one it is pressed against, to the first clear spot of a few tried round that way, and
        // goes on from there, as a cat squeezes out of a tight spot; two cats pressed together would
        // otherwise wait on each other for good.)
        // (In another cat's body already, it steps out at once. Jammed in a knot of cats for a few
        // seconds with no clear way out of the one it is in, it squeezes out between them all the same:
        // for that step out, the bodies round it don't hold it back (a moment's brush past, rather than
        // two cats standing in each other for good).)
        if (o) {
          const jam = (cat.jamT || 0) > 1.4;
          if (!(D && D.escape) || (jam && !D.ghost)) {
            const E = stepOut(cat, o, act, ignore, (R.waited || 0) >= 0.9, jam);
            if (E) { cat.detour = E; dx = E.x - cat.x; dz = E.z - cat.z; o = null; if (E.ghost) cat.jamT = 0; }
          }
          if (o) cat.jamT = inBody(cat) ? (cat.jamT || 0) + WAIT_ON : 0;
        }
        if (o) {
          // (Up against a prop, it finds its way again from where it stands.)
          if (o === true) { R.stale = true; R.replans = (R.replans || 0) + 1; }
          R.waited = (R.waited || 0) + WAIT_ON;
          if (R.waited > 3 || R.replans > 3) return "stuck";
          cat.waitUntil = time + WAIT_ON; cat.doing = SAY.wait;
          return "moving";
        }
      }
    }
    const want = yawTo(dx, dz);
    const left = turnToward(cat, want, step.turn || (sprint ? TURN.zoom : TURN.walk), dt);
    // How fast it would like to go: slower into a sharp turn (a walking cat all but stops and
    // steps round; a sprinting one banks round instead), braking to a stop at the goal unless
    // the leg runs on into the next, and a short hop taken in slow steps, not a blip.
    const c = Math.cos(Math.min(Math.abs(left), Math.PI / 2));
    let v = sprint ? Math.max(RUN_FLOOR, vmax * Math.max(0.72, c)) : vmax * c;
    if (!through && R.i === last) {
      const brake = sprint ? BRAKE_RUN : BRAKE, vb = Math.sqrt(2 * brake * Math.max(0, d0 - arrive));
      if (vb < v) { v = vb; cat.brakeT = cat.speed / brake; }
    }
    // Never a creep: a short way is stepped at a walk, not inched (and, going on, a cat that is not
    // stepping round a sharp turn on the spot walks at least V_MIN, right to its last step).
    const vmin = Math.min(vmax, cat.stalk ? V_MIN_STALK : V_MIN);
    if (!through && shown < MIN_MOVE) v = Math.min(v, Math.max(vmin, (d0 - arrive) / (MIN_MOVE - shown)));
    if (!sprint && v < vmin && Math.abs(left) < 0.35 && (through || d0 > arrive)) v = vmin;
    ease(cat, v, dt, sprint);
    cat.wantV = v;
    if (sprint && v > cat.speed) cat.runIntent = true;
    advance(cat, dt);
    if (cat.speed < 0.25 && Math.abs(left) > 0.2) cat.pivoting = true;
    return "moving";
  }

  /** Slowing to a stop where it is going (in the gait it is in: no last-moment change of step). */
  function pullUp(cat, dt) {
    const sprint = cat.speed > WALK_MAX;
    cat.wa = "move"; cat.lookOn = false;
    ease(cat, 0, dt, sprint);
    cat.brakeT = cat.speed / (sprint ? BRAKE_RUN : BRAKE);
    advance(cat, dt);
  }

  /** Moves the cat on along its heading at its speed. */
  function advance(cat, dt) {
    if (cat.speed <= 0) return;
    cat.x += Math.cos(cat.yaw) * cat.speed * dt;
    cat.z -= Math.sin(cat.yaw) * cat.speed * dt;
    cat.moving = cat.speed > 0.02;
  }

  /** The cat whose body `cat` would be in (closer than both bodies side by side plus `room`) standing
      at (x, z), facing `yaw`, in the shared pose `pose`; null if none (cats meant to touch aside).
      Every other cat's body counts at least at its walking length: one sitting or curled up beside
      the spot will stand up there, and needs the room. */
  function crowding(cat, x, z, yaw, pose, room = 0) {
    const h = (HALF_LEN[pose] || 0.3) * cat.size, fx = Math.cos(yaw) * h, fz = -Math.sin(yaw) * h;
    for (const o of cats) {
      if (o === cat || o.y > 0.3 || o.perch || together(cat, o)) continue;
      const reach = 0.8 * (cat.size + o.size) + room;
      if (Math.abs(o.x - x) > reach || Math.abs(o.z - z) > reach) continue;
      const oh = Math.max(HALF_LEN[o.pose] || 0.3, HALF_LEN.walk) * o.size, ox = Math.cos(o.yaw) * oh, oz = -Math.sin(o.yaw) * oh;
      const cp = closestPoints(x - fx, z - fz, x + fx, z + fz, o.x - ox, o.z - oz, o.x + ox, o.z + oz);
      if (Math.hypot(cp[2] - cp[0], cp[3] - cp[1]) < BODY * (cat.size + o.size) + room) return o;
    }
    return null;
  }

  /** The cat (passing, or standing there) whose body this one's would be in if it stood up (or woke and lay out:
      its body at `pose`'s length) where it sits or lies, when it is not in it already (null if none). */
  function risesInto(cat, pose = "walk") {
    for (const o of cats) {
      if (o === cat || o.y > 0.3 || o.perch || together(cat, o)) continue;
      if (Math.abs(o.x - cat.x) > 0.8 * (cat.size + o.size) || Math.abs(o.z - cat.z) > 0.8 * (cat.size + o.size)) continue;
      if (bodyGap(cat, cat.x, cat.z, cat.yaw, pose, o) < -0.06 && bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, o) > -0.06) return o;
    }
    return null;
  }

  /** Where a cat in another's body (the one it is most in), or pressed against `o` a while (`waited`), steps out to: away
      from it, or up to 90 degrees either side of that, 0.7 of a body on, the first such spot that is clear
      of props and of every other cat's body; null if none. The detour it makes of it (`escape`, `from`). */
  /** Whether a cat is in another's body (more than a brush). */
  function inBody(cat) {
    for (const c of cats) { if (c !== cat && c.y <= 0.3 && !c.perch && !together(cat, c) && Math.abs(c.x - cat.x) < 1.6 && Math.abs(c.z - cat.z) < 1.6 && bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, c) < -0.05) return true; }
    return false;
  }
  function stepOut(cat, o, act, ignore, waited, force = false) {
    let from = null, worst = -0.05;
    for (const c of cats) {
      if (c === cat || c.y > 0.3 || c.perch || together(cat, c) || Math.abs(c.x - cat.x) > 1.6 || Math.abs(c.z - cat.z) > 1.6) continue;
      const g = bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, c);
      if (g < worst) { worst = g; from = c; }
    }
    if (!from) return null;
    // (straight on the way it faces first, if that leads away from the other: no turning round inside
    // its body; but not along it, which takes it out slowly)
    const base = Math.atan2(cat.z - from.z, cat.x - from.x), k = 0.7 * Math.max(1, cat.size), head = Math.atan2(-Math.sin(cat.yaw), Math.cos(cat.yaw));
    const ways = Math.cos(head - base) > 0.5 ? [head, base] : [base];
    const ign = withContaining(ignore, cat);
    for (const a of [...ways, base + 0.5, base - 0.5, base + 1, base - 1, base + 1.5, base - 1.5]) {
      const x = cat.x + Math.cos(a) * k, z = cat.z + Math.sin(a) * k;
      if (!nav.pointFree(x, z, L.CAT.clearR, act && act.ignoreNow) || !nav.segmentClear(cat.x, cat.z, x, z, ign, nav.bodyR)) continue;
      const yaw = Math.atan2(-(z - cat.z), x - cat.x);
      let clear = true;
      for (const c of cats) { if (c === cat || c === from || c.y > 0.3 || c.perch || together(cat, c) || Math.abs(c.x - x) > 1.6 || Math.abs(c.z - z) > 1.6) continue; if (bodyGap(cat, x, z, yaw, "walk", c) < (force && c.posture === "stand" ? -0.08 : 0.02)) { clear = false; break; } }
      if (clear && bodyGap(cat, x, z, yaw, "walk", from) > bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, from) + 0.05) return { x, z, until: time + 2.5, escape: true, from, ghost: force };
    }
    return null;
  }

  /** The cat another's body would swing into as it turns on the spot towards `want` (its first few
      degrees of the turn), if any: standing close beside one, a cat can't swing its hind end through it. */
  function turnBlocked(cat, want, act, skip = null, standOk = false) {
    const left = wrapAngle(want - cat.yaw);
    if (Math.abs(left) < 0.2) return null;
    const yaw = cat.yaw + Math.sign(left) * 0.15;
    for (const o of cats) {
      if (o === cat || o === skip || (standOk && o.posture === "stand") || o.y > 0.3 || o.perch || (act && (act.lead === o || act.mate === o || act.nuzzle === o))) continue;
      if (Math.abs(o.x - cat.x) > 0.8 * (cat.size + o.size) || Math.abs(o.z - cat.z) > 0.8 * (cat.size + o.size)) continue;
      const g = bodyGap(cat, cat.x, cat.z, yaw, cat.pose, o);
      if (g < -0.02 && g < bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, o) - 0.01) return o;
    }
    return null;
  }

  /** Room to turn round on the spot before lying down (its body swinging right round) clear of every cat. */
  function roomToTurn(cat) {
    for (const o of cats) {
      if (o === cat || o.y > 0.3 || o.perch || together(cat, o) || Math.abs(o.x - cat.x) > 3 || Math.abs(o.z - cat.z) > 3) continue;
      if (Math.hypot(o.x - cat.x, o.z - cat.z) < (HALF_LEN.walk + BODY) * cat.size + 0.25 + ((HALF_LEN[o.pose] || 0.3) + BODY) * o.size) return false;
    }
    return true;
  }

  /** True when a standing cat's first steps in direction (dx, dz) run into a prop (the hard check would stop it). */
  function propAhead(cat, dx, dz, ignore) {
    const l = Math.hypot(dx, dz) || 1, x = cat.x + (dx / l) * 0.25, z = cat.z + (dz / l) * 0.25;
    const ign = withContaining(ignore, cat);
    if (nav.segmentClear(cat.x, cat.z, x, z, ign, nav.bodyR)) return false;
    // (Inside a prop's clearance already, only a step further into the prop itself counts.)
    const p = { x, z };
    return nav.project(p, ignore) && Math.hypot(p.x - x, p.z - z) > 0.12;
  }

  /** A spot a short step away from `o` where `cat` can settle in `pose` clear of every cat (null if none). */
  function clearSpot(cat, o, pose) {
    const away = Math.atan2(cat.z - o.z, cat.x - o.x), rnd = cat.rnd;
    for (let t = 0; t < 12; t++) {
      const a = away + rnd.range(-1.2, 1.2), d = rnd.range(0.35, 1.1) * (cat.size + o.size) * 0.5;
      const x = cat.x + Math.cos(a) * d, z = cat.z + Math.sin(a) * d;
      if (!nav.pointFree(x, z, L.CAT.clearR, cat.act && cat.act.ignoreNow)) continue;
      if (!crowding(cat, x, z, Math.atan2(-(z - cat.z), x - cat.x), pose, 0.08) && !crowding(cat, x, z, Math.atan2(-(z - cat.z), x - cat.x), "walk", 0.02)) return { x, z };
    }
    return null;
  }

  /** The cat whose body this one (standing) would walk straight into with its next step or so in
      direction (dx, dz), if any (not the one it follows or plays with). */
  function bodyAhead(cat, dx, dz, act, skip = null, standOk = false) {
    const l = Math.hypot(dx, dz) || 1, h = HALF_LEN.walk * cat.size, fx = Math.cos(cat.yaw) * h, fz = -Math.sin(cat.yaw) * h, ax = cat.x + (dx / l) * 0.12, az = cat.z + (dz / l) * 0.12;
    for (const o of cats) {
      if (o === cat || o === skip || (standOk && o.posture === "stand") || o.y > 0.3 || o.perch || (act && (act.lead === o || act.mate === o || act.nuzzle === o))) continue;
      const reach = 0.8 * (cat.size + o.size) + 0.15;
      if (Math.abs(o.x - cat.x) > reach || Math.abs(o.z - cat.z) > reach) continue;
      const oh = (HALF_LEN[o.pose] || 0.3) * o.size, ox = Math.cos(o.yaw) * oh, oz = -Math.sin(o.yaw) * oh, min = BODY * (cat.size + o.size);
      let cp = closestPoints(ax - fx, az - fz, ax + fx, az + fz, o.x - ox, o.z - oz, o.x + ox, o.z + oz);
      const dNext = Math.hypot(cp[2] - cp[0], cp[3] - cp[1]);
      if (dNext >= min) continue;
      cp = closestPoints(cat.x - fx, cat.z - fz, cat.x + fx, cat.z + fz, o.x - ox, o.z - oz, o.x + ox, o.z + oz);
      const dNow = Math.hypot(cp[2] - cp[0], cp[3] - cp[1]);
      // (Already in its body, it may step out along it: only a step deeper in counts.)
      if (dNext < dNow - (dNow < min ? 0.02 : 1e-4)) return o;
    }
    return null;
  }

  /** A way round the cat lying in this one's path (`b`, or the nearest still one just ahead): a
      point beside it, on the preferred side if that is clear, else the other. */
  function aside(cat, b = null, prefer = 0) {
    if (!b) {
      const fx = Math.cos(cat.yaw), fz = -Math.sin(cat.yaw);
      let best = 1.1 * Math.max(1, cat.size), bd = Infinity;
      for (const o of cats) {
        if (o === cat || o.moving || o.y > 0.3) continue;
        const ox = o.x - cat.x, oz = o.z - cat.z, reach = 1.1 * (cat.size + o.size) * 0.5;
        if (ox > best || ox < -best || oz > best || oz < -best) continue;
        const d = Math.hypot(ox, oz);
        if (d < reach && d / reach < bd && ox * fx + oz * fz > 0) { bd = d / reach; b = o; }
      }
    }
    if (!b || !cat.route) return null;
    const g = cat.route, ignore = cat.act && cat.act.ignoreNow;
    // Perpendicular to the way from this cat to the one in its way, far enough out to pass it
    // without touching, whichever way it lies (both bodies and its length).
    let px = -(b.z - cat.z), pz = b.x - cat.x;
    const pl = Math.hypot(px, pz) || 1; px /= pl; pz /= pl;
    const off = BODY * (cat.size + b.size) + (HALF_LEN[b.pose] || 0.3) * b.size + 0.14;
    let out = null, score = Infinity;
    for (const side of [1, -1]) {
      const x = b.x + px * side * off, z = b.z + pz * side * off;
      if (!nav.pointFree(x, z, L.CAT.bodyR + 0.05, ignore) || !nav.segmentClear(cat.x, cat.z, x, z, withContaining(ignore, cat), nav.bodyR)) continue;
      let clear = true;
      for (const o of cats) { const r = 0.6 * (cat.size + o.size) * 0.5; if (o !== cat && o !== b && Math.abs(o.x - x) < r && Math.abs(o.z - z) < r) { clear = false; break; } }
      if (!clear) continue;
      // The side asked for if it is clear, else the one nearer the goal.
      const sc = Math.hypot(g.qx - x, g.qz - z) - (side === prefer ? 10 : 0);
      if (sc < score) { score = sc; out = { x, z, until: time + 3 }; }
    }
    return out;
  }

  // (but a bowl or a water dish only when it stands right over it: at a bowl's stand, inside its
  // clearance, a cat that went on to ignore the bowl would walk off straight over it, or stop in it)
  const withContaining = (ignore, cat) => {
    const s = new Set(ignore || []);
    for (const id of nav.containing(cat.x, cat.z)) { const b = RIM_OF.get(id); if (!b || Math.hypot(cat.x - b.x, cat.z - b.z) < b.r + 0.2) s.add(id); }
    return s;
  };

  /** The posture a step needs the cat in when it starts (null: any). A seated cat asked to face
      something near where it looks just turns its head; for anything further round it gets up. */
  function postureFor(cat, step) {
    switch (step.type) {
      case "go": case "chase": case "circle": case "hop": return "stand";
      case "pursue": case "follow": return step.seated ? "sit" : "stand";
      case "turn": case "face": {
        if (cat.posture === "stand") return "stand";
        return Math.abs(wrapAngle(faceYaw(cat, step) - cat.yaw)) > HEAD_TURN ? "stand" : null;
      }
      case "hold": return baseOf(ACTIONS[step.action].posture);
      default: return null;
    }
  }
  const faceYaw = (cat, step) => {
    if (step.type === "turn") return step.yaw;
    const tg = step.target();
    return yawTo(tg.x - cat.x, tg.z - cat.z);
  };

  /** On to the activity's next step (it starts in this same tick). */
  function nextStep(act, step) { if (step.then) step.then(); act.i++; act.started = false; return true; }
  /** Gives up on the activity (the next is chosen in this same tick). */
  function abortAct(cat) { finish(cat, false); return true; }

  /** Runs the cat's activity for dt seconds. When a step ends, the next one starts in the same
      tick (with no time of its own yet), and when the activity ends the next is chosen at once,
      so the cat is never shown a step with the wrong pose. */
  function run(cat, dt) {
    cat.wa = null; cat.wu = null;
    for (let k = 0; k < 20; k++) {
      if (!cat.act) begin(cat, choose(cat));
      if (!runStep(cat, k ? 0 : dt)) break;
    }
    if (!cat.wa) cat.wa = POSTURE_LOOP[cat.posture];
  }

  /** One step for dt seconds. Returns true when the step (or the activity) ended this tick. */
  function runStep(cat, dt) {
    const act = cat.act;
    const step = act.steps[act.i];
    if (!step) { finish(cat, true); return true; }
    if (!act.started) {
      // Still on the move and about to stand still (a hold, a turn, a posture change): it pulls up
      // over a stride or two first rather than stopping dead.
      // (A gait or a stop that has only just been seen is seen out first.)
      if (!TRAVEL.has(step.type) && (cat.speed > 0.3 || (cat.motion.gait && time - cat.gaitSince < MIN_SHOW.move) || time < cat.stopUntil)) { pullUp(cat, dt); return false; }
      // Out of a paw wash, a sprawl on its side, a stretch up the trunk: back into the plain pose first
      // (and onto its side, or its back, only from the pose that leads there).
      const uw = unwindFor(cat, step, time);
      if (uw) { act.steps.splice(act.i, 0, hold(uw.action, uw.dur, step.doing || cat.doing, { fidget: false })); return true; }
      // Another posture first? Put the posture changes in before this step, and start the first.
      const want = postureFor(cat, step);
      if (want && want !== cat.posture) {
        // (Sitting or lying down where it stands, but in another cat's body there, or where its body
        // standing up again would be in one: it steps clear first.)
        if (cat.posture === "stand" && step.type === "hold" && !step.roomed && !cat.perch) {
          const o = crowding(cat, cat.x, cat.z, cat.yaw, POSTURE_POSE[want], -0.04) || crowding(cat, cat.x, cat.z, cat.yaw, "walk", -0.04);
          const s = o && clearSpot(cat, o, POSTURE_POSE[want]);
          if (s) { step.roomed = true; cat.dest = s; act.steps.splice(act.i, 0, go(s, "stroll", 0.1, step.doing || act.reason)); return true; }
          // (in another cat's body with nowhere clear to step to (landed from a hop right by one, say): it
          // stands a moment for the other to move on, rather than sit down in it; a few times, then it may)
          if (o && bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, o) < -0.05 && (step.roomWait = (step.roomWait || 0) + 1) < 4) { act.steps.splice(act.i, 0, hold("stand", 0.6, step.doing || act.reason, { fidget: false })); return true; }
          step.roomed = true;
        }
        // (Getting up (or waking and stretching out) where its body, longer then, would be in another cat's:
        // one that came up close while it sat or lay (sitting, a cat is short; standing, long). It stays as
        // it is a while longer, for the other to move on, rather than rise into it and leave the two of
        // them in each other; several times, then it gets up all the same.)
        if (!cat.perch && (step.rise || 0) < 8 && (HALF_LEN[POSTURE_POSE[want]] || 0.3) > (HALF_LEN[cat.pose] || 0.3) + 0.05) {
          const o = risesInto(cat, POSTURE_POSE[want]);
          // (one standing there, free to go, is asked to move over (makeRoom), as a cat about to get up
          // makes the other step back)
          if (o) { step.rise = (step.rise || 0) + 1; if (o.posture === "stand" && time - o.motion.since > 0.6) makeRoom(o, cat); act.steps.splice(act.i, 0, hold(POSTURE_LOOP[cat.posture], 0.8, step.doing || act.reason, { fidget: false })); return true; }
        }
        const path = transitionPath(cat.posture, want);
        if (path.length) {
          act.steps.splice(act.i, 0, ...path.map((name) => ({ type: "trans", name, dur: transDur(name, tempoOf(cat)), doing: step.doing })));
          return true;
        }
      }
      // (Hopping down from a perch onto a spot another cat has come and settled on since it chose it:
      // another clear spot by the perch's foot, or it waits up there a moment for the cat to move on.)
      if (step.type === "hop" && step.down && crowding(cat, step.x, step.z, yawTo(step.x - cat.x, step.z - cat.z), "walk", 0.05)) {
        const g = step.down.ground;
        for (let k = 0; k < 12; k++) {
          const a = cat.rnd.range(0, Math.PI * 2), d = cat.rnd.range(0.45, 1), q = { x: g.x + Math.cos(a) * d, z: g.z + Math.sin(a) * d };
          if (nav.pointFree(q.x, q.z, L.CAT.clearR) && nav.segmentClear(g.x, g.z, q.x, q.z, null, nav.bodyR) && !crowding(cat, q.x, q.z, yawTo(q.x - cat.x, q.z - cat.z), "walk", 0.05)) { step.x = q.x; step.z = q.z; break; }
        }
        if (crowding(cat, step.x, step.z, yawTo(step.x - cat.x, step.z - cat.z), "walk", 0.05) && (step.waits = (step.waits || 0) + 1) < 6) {
          act.steps.splice(act.i, 0, hold("stand", 0.8, SAY.hopDown, { fidget: false }));
          return true;
        }
      }
      act.started = true; act.t = 0; act.ignoreNow = withContaining(act.ignore, cat); cat.route = null; cat.stall = 0; cat.waitUntil = 0; cat.detour = null;
    }
    act.t += dt;
    cat.doing = step.doing || act.reason;

    switch (step.type) {
      case "trans": {
        // A posture change: sitting down, getting up, lying down, curling up, waking. It stays put.
        cat.speed = 0; cat.moving = false; cat.lookOn = false;
        cat.wa = step.name; cat.wu = Math.min(1, act.t / step.dur);
        if (act.t >= step.dur) { cat.posture = ACTIONS[step.name].to; return nextStep(act, step); }
        break;
      }
      case "go": {
        cat.wa = "move"; cat.lookOn = false;
        const r = walk(cat, step, step.x, step.z, dt, speedOf(cat, step.mode), step.arrive, act.ignoreNow, !!step.through);
        if (r === "arrived") { cat.route = null; return nextStep(act, step); }
        if (r === "stuck") return abortAct(cat);
        break;
      }
      case "chase": {
        const tg = step.target();
        if (step.giveUpIf && step.giveUpIf()) { skipTo(act, cat); return true; }
        const d = Math.hypot(tg.x - cat.x, tg.z - cat.z);
        // Close enough already: straight on to what comes next, without a blip of walking.
        if (act.t <= dt && (d <= step.stopAt + 0.1 || (step.skipIfNear && d < step.skipIfNear))) return nextStep(act, step);
        if (step.scareAt && d < step.stopAt + step.scareAt && critters?.startle && tg.state === "perched" && cat.rnd.chance(dt * 0.6)) critters.startle(tg, cat);
        if (d <= step.stopAt + 0.1) { cat.route = null; return nextStep(act, step); }
        if (act.t > step.until) { if (step.endOk) { skipTo(act, cat); return true; } return abortAct(cat); }
        // Aim at a point short of the target, on the cat's side of it.
        const k = d > 1e-3 ? Math.max(0, d - step.stopAt) / d : 0;
        cat.wa = "move"; cat.stalk = !!step.stalk; cat.lookOn = false;
        const r = walk(cat, step, cat.x + (tg.x - cat.x) * k, cat.z + (tg.z - cat.z) * k, dt, speedOf(cat, step.mode), 0.15, act.ignoreNow);
        if (r === "arrived") { cat.route = null; return nextStep(act, step); }
        if (r === "stuck") return abortAct(cat);
        break;
      }
      case "pursue":
      case "follow": return company(cat, act, step, dt);
      case "turn":
      case "face": {
        const want = faceYaw(cat, step);
        if (!step.init) {
          step.init = true;
          const diff = Math.abs(wrapAngle(want - cat.yaw));
          // Sitting or lying and nearly facing it (postureFor let it stay down): the head turns, not the
          // body; standing close beside another cat, with no room to swing its body round: it faces as
          // near as it can (the head does the rest) rather than start a turn its neighbour stops.
          if (cat.posture !== "stand" || diff < 0.2 || turnBlocked(cat, want, act)) {
            if (step.target) act.faceTarget = step.target;
            return nextStep(act, step);
          }
          step.rate = Math.min(step.type === "face" ? TURN.still * 1.5 : TURN.still, Math.max(0.7, diff / 0.45));
        }
        cat.wa = "move"; cat.speed = 0; cat.moving = false;
        if (step.target) setLook(cat, step.target()); else cat.lookOn = false;
        // Turning on the spot, a few small steps round; a cat that has only just stopped stands its moment first.
        if (time < cat.stopUntil) break;
        // Round (the last of it turned last tick: what follows starts in a tick with no turn in it,
        // so a cat never sits down or lies down while its body is still turning); or its body up
        // against another's, it can turn no further: it faces as near as it got.
        if (Math.abs(wrapAngle(want - cat.yaw)) < 0.03 || act.t > 3 || (cat.held > 0.7 && act.t > 0.05)) { if (step.target) act.faceTarget = step.target; return nextStep(act, step); }
        turnToward(cat, want, step.rate, dt);
        cat.pivoting = true;
        break;
      }
      case "circle": {
        // Round before lying down, in real small steps: a slow walk round a tight circle, at an even
        // pace to the end and braking only in its last step (circleStep); only with room to turn round
        // (in a pile or close beside another cat it just lies down).
        if (step.turned == null && !roomToTurn(cat)) return nextStep(act, step);
        // (A cat that has only just stopped stands its moment first, as before a turn.)
        if (time < cat.stopUntil) break;
        if (circleStep(cat, step, dt)) return nextStep(act, step);
        break;
      }
      case "hold": {
        cat.speed = 0; cat.moving = false;
        cat.posture = baseOf(ACTIONS[step.action].posture);
        if (step.abortIf && step.abortIf()) { skipTo(act, cat); return true; }
        if (step.restore) for (const k in step.restore) cat.needs[k] = Math.max(0, cat.needs[k] - step.restore[k] * dt);
        const a = fidget(cat, act, step);
        if (a === step.action) {
          cat.wa = a;
          cat.wu = ACTIONS[a].kind === "once" ? Math.min(1, act.t / step.dur) : null;
          holdLook(cat, act, step);
        }
        if (act.t >= step.dur || (step.until && step.until())) return nextStep(act, step);
        break;
      }
      case "hop": {
        // Gather, leap, land. The cat leaves the ground only for the middle of it (AIR0..AIR1).
        if (!step.from) {
          step.from = { x: cat.x, y: cat.y, z: cat.z };
          if (step.to) {
            // A leap at something: land a little short of it (the cat never gets it).
            const tg = step.to(), dx = tg.x - cat.x, dz = tg.z - cat.z, d = Math.hypot(dx, dz) || 1;
            let len = Math.max(0.25, Math.min(1.8, d - step.short));
            // (and not on top of another cat: it pulls the leap up short of one in the way)
            const busy = (x, z) => !!crowding(cat, x, z, Math.atan2(-dz, dx), "walk", 0.06);
            while (len > 0.25 && busy(cat.x + (dx / d) * len, cat.z + (dz / d) * len)) len -= 0.1;
            len = Math.max(0.2, len);
            // (Nowhere to land but on a cat: it thinks better of it.)
            if (busy(cat.x + (dx / d) * len, cat.z + (dz / d) * len)) { cat.hopPitch = 0; return nextStep(act, step); }
            const p = { x: cat.x + (dx / d) * len, z: cat.z + (dz / d) * len };
            nav.project(p, act.ignoreNow);
            step.x = p.x; step.z = p.z;
          }
          step.D = step.air / (AIR1 - AIR0);
          step.top = Math.max(step.from.y, step.y) + step.apex;
          step.aim = Math.hypot(step.x - cat.x, step.z - cat.z) > 0.05 ? yawTo(step.x - cat.x, step.z - cat.z) : cat.yaw;
          if (step.start) step.start();
        }
        const f = step.from, u = Math.min(1, act.t / step.D), e = clamp01((u - AIR0) / (AIR1 - AIR0));
        cat.wa = step.pounce ? "pounce" : "hop"; cat.wu = u;
        cat.speed = 0; cat.moving = false;
        if (step.to && u < AIR1) setLook(cat, step.to()); else cat.lookOn = false;
        if (u < AIR0) turnToward(cat, step.aim, 4, dt); // lining up while it gathers
        cat.x = f.x + (step.x - f.x) * e;
        cat.z = f.z + (step.z - f.z) * e;
        cat.y = e <= 0 ? f.y : e >= 1 ? step.y : quadThrough(f.y, step.top, step.y, e);
        const hd = Math.hypot(step.x - f.x, step.z - f.z);
        cat.hopPitch = e > 0 && e < 1 ? Math.atan2(quadSlope(f.y, step.top, step.y, e), Math.max(0.3, hd)) * 0.7 + (step.reach ? Math.sin(e * Math.PI) * 0.5 : 0) : 0;
        if (e >= 1 && !step.landed) { step.landed = true; if (step.land) step.land(); }
        if (u >= 1) { cat.y = step.y; cat.hopPitch = 0; cat.posture = "stand"; return nextStep(act, step); }
        break;
      }
      case "upTop": {
        // From the low platform, sometimes on up to the top.
        const T = step.tree;
        if (free(T.high.id) && reserve(T.high.id, cat)) {
          const low = T.low.id, up = { x: T.high.x, y: T.high.y + 0.3, z: T.high.z };
          act.steps.splice(act.i + 1, 0,
            { type: "turn", yaw: yawTo(T.high.x - T.low.x, T.high.z - T.low.z), doing: SAY.climb },
            hold("crouch", cat.rnd.range(0.5, 0.8) * tempoOf(cat), SAY.sizeUp, { target: () => up, fidget: false }),
            { type: "hop", x: T.high.x, z: T.high.z, y: T.high.y, air: 0.48, apex: 0.36, doing: SAY.climb, then: () => { release(cat, low); cat.perch = { id: T.high.id, ground: T.landing, y: T.high.y }; } },
            hold(cat.rnd.chance(0.5) ? "sit" : "loaf", dur(cat, 12, 24), SAY.top, { look: "about", restore: { explore: 0.04 } }),
          );
        }
        return nextStep(act, step);
      }
      case "call": step.fn(); return nextStep(act, step);
      default: return nextStep(act, step);
    }
    return false;
  }

  /** Following a friend, or chasing the runner in a chase: close behind it while it moves, and
      when it stops, stopping too, standing, turning to face it, and (after SIT_AFTER seconds of
      standing still) sitting to watch it; up again only once it is really off somewhere. */
  function company(cat, act, step, dt) {
    const lead = step.lead, pursue = step.type === "pursue";
    if (act.t > step.until || (pursue && !step.whileTrue())) {
      // Done: it pulls up first (a chaser does not stop dead from a run).
      if (cat.speed > 0.05 || (cat.motion.gait && time - cat.moveSince < 0.35)) { pullUp(cat, dt); return false; }
      cat.route = null; return nextStep(act, step);
    }
    const d = Math.hypot(lead.x - cat.x, lead.z - cat.z);
    if (step.seated) {
      cat.wa = "sit"; setLook(cat, lead, 0.3);
      const far = lead.moving && lead.y < 0.3 && d > (pursue ? step.stopAt + 1.2 : 2.4);
      step.far = far ? (step.far || 0) + dt : 0;
      if (step.far > 0.5) { carryOn(act, step, false); return nextStep(act, step); }
      return false;
    }
    // Where to be, and how fast to get there (matching the other cat's pace, never jumping).
    let tx, tz, v;
    const k = (cat.size + lead.size) * 0.5; // (a big cat is kept further from)
    if (pursue) {
      tx = lead.x; tz = lead.z;
      v = clamp((lead.moving ? lead.speed : 0) + 1.6 * (d - step.stopAt * k - 0.25), 0, speedOf(cat, "pursue"));
    } else if (lead.moving && lead.y < 0.05) {
      tx = lead.x - Math.cos(lead.yaw) * 1.3 * k; tz = lead.z + Math.sin(lead.yaw) * 1.3 * k;
      v = clamp(lead.speed + 1.1 * (Math.hypot(tx - cat.x, tz - cat.z) - 0.25), 0, speedOf(cat, "follow"));
    } else {
      const a = Math.atan2(cat.z - lead.z, cat.x - lead.x);
      tx = lead.x + Math.cos(a) * 1.4 * k; tz = lead.z + Math.sin(a) * 1.4 * k;
      v = clamp(1.1 * (Math.hypot(tx - cat.x, tz - cat.z) - 0.2), 0, speedOf(cat, "stroll"));
    }
    // Once stopped it stays stopped until there is somewhere worth going; on the move it keeps to a
    // real walk, or stops (it never creeps along behind), and once off it goes a step or two (no blip).
    if (!cat.motion.gait && cat.speed < 0.05 && v < 0.35) v = 0;
    else if (v < V_MIN) v = v < V_MIN * 0.6 && !(cat.motion.gait && time - cat.moveSince < MIN_MOVE) ? 0 : V_MIN;
    cat.wa = "move";
    if (v === 0) {
      ease(cat, 0, dt, pursue);
      advance(cat, dt);
      setLook(cat, lead, 0.3);
      // Face it, in a few steps, once it has stood a moment.
      const want = yawTo(lead.x - cat.x, lead.z - cat.z), diff = Math.abs(wrapAngle(want - cat.yaw));
      if (cat.speed < 0.05 && time >= cat.stopUntil && (step.turning || diff > 0.7)) {
        step.turning = diff > 0.05;
        turnToward(cat, want, 2, dt);
        cat.pivoting = step.turning;
      }
      step.still = cat.speed < 0.03 && !cat.pivoting ? (step.still || 0) + dt : 0;
      if (step.still > SIT_AFTER && !lead.moving && canDo(cat.traits, "sit")) { carryOn(act, step, true); return nextStep(act, step); } // (one whose model can't sit keeps standing)
      return false;
    }
    step.still = 0; step.turning = false;
    cat.lookOn = false;
    const r = walk(cat, step, tx, tz, dt, v, 0.05, act.ignoreNow, true);
    if (r === "arrived") { ease(cat, 0, dt, pursue); advance(cat, dt); }
    else if (r === "stuck") { cat.route = null; step.until = -1; } // no way through: it pulls up and gives up
    return false;
  }

  /** Continues a follow or a pursue as a new step, seated or on its feet (the posture change goes in before it). */
  function carryOn(act, step, seated) {
    act.steps.splice(act.i + 1, 0, { type: step.type, lead: step.lead, stopAt: step.stopAt, whileTrue: step.whileTrue, until: Math.max(0.5, step.until - act.t), seated, doing: step.doing });
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

  /* ── What it looks at, and the little things it does while it holds a pose ── */

  /** Point the head at p ({x, z, y?}); y defaults to `y`. */
  function setLook(cat, p, y = 0.3) {
    cat.lookAt.x = p.x; cat.lookAt.z = p.z; cat.lookAt.y = p.y ?? y;
    cat.lookOn = true;
  }

  function holdLook(cat, act, step) {
    const action = step.action;
    if (cat.greetedBy && cat.greetUntil > time && cat.greetedBy.act?.nuzzle === cat) return setLook(cat, cat.greetedBy, 0.35);
    if (cat.snubFrom && cat.snubUntil > time) {
      // Asked to play and not in the mood: its head turned pointedly away from the one asking.
      const away = cat.yaw + clampAbs(wrapAngle(yawTo(cat.snubFrom.x - cat.x, cat.snubFrom.z - cat.z) + Math.PI - cat.yaw), HEAD_MAX);
      cat.doing = SAY.notNow;
      return setLook(cat, { x: cat.x + Math.cos(away) * 3, z: cat.z - Math.sin(away) * 3 }, 0.3);
    }
    if (step.target) return setLook(cat, step.target());
    if (step.look === "about") return lookAbout(cat, act, step);
    if (act.faceTarget && (action === "pant" || action === "sit" || action === "stand")) return setLook(cat, act.faceTarget());
    cat.lookOn = false;
  }

  /** A cat holding a pose looks about now and then with quick turns of the head, and sometimes at
      you (a grumpy one pointedly away from you); if you are behind it and it likes company, it
      may get up and turn round to watch you. */
  function lookAbout(cat, act, step) {
    const rnd = cat.rnd, t = cat.traits;
    if (!act.look || act.lookStep !== step) { act.look = { x: 0, y: 0, z: 0, on: false }; act.lookStep = step; act.lookNext = time + rnd.range(0.5, 2); act.lookingAtYou = false; }
    const L0 = act.look;
    if (time >= act.lookNext) {
      act.lookNext = time + rnd.range(2.2, 6) * (1.35 - 0.7 * t.curious) * (cat.posture === "lie" ? 1.4 : 1);
      act.lookingAtYou = false; act.lookingAway = false;
      const r = rnd.next();
      const aim = (yaw, d, y) => { L0.x = cat.x + Math.cos(yaw) * d; L0.z = cat.z - Math.sin(yaw) * d; L0.y = y; L0.on = true; };
      if (viewer && r < cat.p.viewer) {
        const toV = wrapAngle(yawTo(viewer.x - cat.x, viewer.z - cat.z) - cat.yaw);
        if (t.grumpy > 0.62 && rnd.chance(0.6)) { aim(cat.yaw + clampAbs(wrapAngle(toV + Math.PI), HEAD_MAX), 3, 0.3); act.lookingAway = true; }
        else if (Math.abs(toV) <= HEAD_MAX) { L0.x = viewer.x; L0.z = viewer.z; L0.y = viewer.y; L0.on = true; act.lookingAtYou = true; }
        else if (!cat.perch && step.dur - act.t > 8 && time - cat.motion.since > 3 && t.grumpy < 0.6 && rnd.chance(0.25 * (0.5 + t.social))) {
          // Turns round to watch you: up, round, and settled again.
          const rest = step.dur - act.t - 1.5;
          act.steps.splice(act.i + 1, 0,
            { type: "turn", yaw: wrapAngle(cat.yaw + toV), doing: SAY.turnToYou },
            hold(step.action, rest, step.doing, { look: "about", restore: step.restore }));
          step.dur = act.t; // this hold ends now
        } else aim(cat.yaw + Math.sign(toV) * HEAD_MAX * 0.9, 3, 0.8); // a glance over its shoulder
      } else if (r < cat.p.viewer + 0.22) L0.on = false; // straight ahead, at nothing much
      else if (step.home && rnd.chance(0.7)) { L0.x = step.home.x + rnd.range(-0.6, 0.6); L0.z = step.home.z + rnd.range(-0.6, 0.6); L0.y = 0; L0.on = true; }
      else aim(cat.yaw + rnd.range(-1.1, 1.1), rnd.range(2, 6), rnd.range(0, 0.7));
    }
    if (L0.on) setLook(cat, L0); else cat.lookOn = false;
    if (act.lookingAtYou) cat.doing = SAY.atYou;
    else if (act.lookingAway) cat.doing = SAY.turnAway;
  }

  /** While a cat holds a pose it now and then slips in a mannerism of its own (pickFidget: a
      yawn, a paw wash, a scratch behind the ear, its signature move), in the same posture.
      Returns the action shown now. */
  function fidget(cat, act, step) {
    const f = act.fid;
    if (f && f.step === step) {
      if (act.t < f.end) {
        cat.wa = f.action; cat.wu = f.once ? Math.min(1, (act.t - f.t0) / (f.end - f.t0)) : null;
        // Its own clip moves the head (a wash, a yawn); a chattering hunter keeps its eyes on the bird.
        if (f.target) setLook(cat, f.target, 0.8); else cat.lookOn = false;
        if (SAY[f.action]) cat.doing = SAY[f.action];
        return f.action;
      }
      act.fid = null;
    }
    if (step.fidget === false || step.dur < 6 || ACTIONS[step.action].kind !== "loop" || isReduced) return step.action;
    const rnd = cat.rnd;
    if (act.fidStep !== step) { act.fidStep = step; act.fidAt = act.t + rnd.range(5, 16) * cat.tune.rhythm; }
    if (act.t < act.fidAt) return step.action;
    act.fidAt = act.t + rnd.range(12, 28) * cat.tune.rhythm;
    if (!rnd.chance(cat.p.fidget)) return step.action;
    const posture = ACTIONS[step.action].posture;
    let name = null, target = null;
    // A keen hunter that spots a bird it cannot reach chatters at it.
    if (posture === "sit" && cat.traits.hunter > 0.55 && critters?.birds && canDo(cat.traits, "chatter")) {
      for (const b of critters.birds) if (Math.abs(b.x - cat.x) < 8 && Math.abs(b.z - cat.z) < 8 && b.y > 0.3) { name = "chatter"; target = b; break; }
    }
    if (!name) name = pickFidget(cat.traits, posture, rnd.next);
    // (Onto its back only from its side: from a loaf a cat first flops over; the roll comes later.)
    name = leadFidget(name, step.action);
    if (!name || name === step.action || ACTIONS[name]?.posture !== posture || (cat.gentle && COMEDY.has(name))) return step.action;
    if (ACTIONS[name].kind === "once" && UNWIND[step.action]) return step.action; // no yawn with a paw still at its face
    const isOnce = ACTIONS[name].kind === "once";
    const range = FIDGETS[name]?.dur || [2, 4];
    const d = isOnce ? onceDur(cat, name) : rnd.range(range[0], range[1]) * cat.tune.rhythm;
    if (step.dur - act.t < d + 1) return step.action;
    act.fid = { step, action: name, t0: act.t, end: act.t + d, once: isOnce, target };
    return fidget(cat, act, step);
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

  /** The most a cat is shoved aside in one tick (units): overlaps are worked out over a few ticks,
      never in one visible jump (and a cat squeezed between two others is not flicked to and fro). */
  const MAX_PUSH = 0.035;
  /** Two resting cats this far into each other (units, into both bodies side by side) are in each other's space. */
  const CROWD = 0.1, CROWD_WAIT = 0.6;
  let seg = new Float64Array(0), push = new Float64Array(0), hard = new Float64Array(0);
  /** Cats meant to be touching: a cheek rub with a friend visited, a nap pile. (Not a chase's pair:
      they run close, but they never sit down in each other.) */
  const together = (a, b) => (a.act && (a.act.nuzzle === b || a.act.kind === "pile")) || (b.act && (b.act.nuzzle === a || b.act.kind === "pile"));
  /** Turning on the spot in small steps (and shown stepping): it can step aside as it turns. */
  const turning = (c) => c.pivoting && c.wa === "move" && !!c.motion.gait;
  function resolveCats(dt) {
    const n = cats.length;
    if (seg.length < n * 4) { seg = new Float64Array(n * 4); push = new Float64Array(n * 2); hard = new Float64Array(n * 2); }
    for (let i = 0; i < n; i++) {
      const c = cats[i], h = (HALF_LEN[c.pose] || 0.3) * c.size, fx = Math.cos(c.yaw) * h, fz = -Math.sin(c.yaw) * h;
      seg[i * 4] = c.x - fx; seg[i * 4 + 1] = c.z - fz; seg[i * 4 + 2] = c.x + fx; seg[i * 4 + 3] = c.z + fz;
      push[i * 2] = 0; push[i * 2 + 1] = 0; hard[i * 2] = 0; hard[i * 2 + 1] = 0;
      c.crowdBy = null; c.hardSum = 0;
    }
    for (let i = 0; i < n; i++) {
      const a = cats[i];
      if (a.y > 0.3 || a.perch) continue;
      for (let j = i + 1; j < n; j++) {
        const b = cats[j], reach = 0.8 * (a.size + b.size);
        if (Math.abs(b.x - a.x) > reach || Math.abs(b.z - a.z) > reach) continue;
        if (b.y > 0.3 || b.perch) continue;
        // (one squeezing out of a knot of cats (stepOut, `ghost`) brushes past the standing ones round it)
        if ((a.detour && a.detour.ghost && !b.moving && b.posture === "stand") || (b.detour && b.detour.ghost && !a.moving && a.posture === "stand")) continue;
        const am = a.moving || turning(a), bm = b.moving || turning(b);
        const still = !am && !bm, body = BODY * (a.size + b.size);
        const cp = closestPoints(seg[i * 4], seg[i * 4 + 1], seg[i * 4 + 2], seg[i * 4 + 3], seg[j * 4], seg[j * 4 + 1], seg[j * 4 + 2], seg[j * 4 + 3]);
        let dx = cp[2] - cp[0], dz = cp[3] - cp[1], d = Math.hypot(dx, dz);
        if (still) {
          // Two resting cats in each other (one landed or settled on the other): neither is slid
          // aside; the one that settled there last gets up and moves over (below).
          if (d < body - CROWD && !together(a, b) && !airborne(a) && !airborne(b)) {
            const rank = (c) => (c.posture === "sleep" ? 2 : c.posture === "lie" ? 1 : 0);
            const mover = rank(a) !== rank(b) ? (rank(a) < rank(b) ? a : b) : (a.motion.since >= b.motion.since ? a : b);
            mover.crowdBy = mover === a ? b : a;
          }
          continue;
        }
        // A cat going up to a friend to rub cheeks may come right up to it.
        const min = (a.act && a.act.nuzzle === b) || (b.act && b.act.nuzzle === a) ? body * 0.4 : body;
        if (d >= min) continue;
        if (d < 1e-5) { dx = b.x - a.x; dz = b.z - a.z; d = Math.hypot(dx, dz) || 1; if (d < 1e-5) { dx = 1; dz = 0; } }
        const k = min - d, nx = dx / d, nz = dz / d;
        // Only a cat on the move is pushed (one lying still stays put); two moving share it. Whatever
        // a cat's own step this tick took it further into the other is taken back in full (it is
        // stopped by the other's body, or slides along it, and never walks through it); the rest of
        // the overlap is eased out over a few ticks.
        // (Its own motion: its step, or its body swung round as it turns on the spot; so a cat turning
        // beside another steps its hind end round rather than sweep it through the other.)
        const inA = am ? Math.max(0, bodyGap(a, a.px, a.pz, a.pyaw, a.pose, b) + k) : 0, inB = bm ? Math.max(0, bodyGap(b, b.px, b.pz, b.pyaw, b.pose, a) + k) : 0;
        const share = am && bm ? 0.5 : 1;
        const ha = Math.min(k * share, inA), hb = Math.min(k * share, inB);
        const ka = am ? k * share - ha : 0, kb = bm ? k * share - hb : 0;
        hard[i * 2] -= nx * ha; hard[i * 2 + 1] -= nz * ha;
        hard[j * 2] += nx * hb; hard[j * 2 + 1] += nz * hb;
        a.hardSum += ha; b.hardSum += hb;
        push[i * 2] -= nx * ka; push[i * 2 + 1] -= nz * ka;
        push[j * 2] += nx * kb; push[j * 2 + 1] += nz * kb;
      }
    }
    for (let i = 0; i < n; i++) {
      const c = cats[i];
      let px = push[i * 2], pz = push[i * 2 + 1];
      // (moved over after a moment in another cat's space)
      // (and if that cat can't get out of it, hemmed in, the other one, sitting or lying there awake, gets
      // up and moves over instead: two cats never stay in each other for good)
      if (c.crowdBy) {
        c.crowdT = (c.crowdT || 0) + dt; c.crowdLong = (c.crowdLong || 0) + dt;
        if (c.crowdT > CROWD_WAIT) { c.crowdT = 0; const o = c.crowdBy; if (c.crowdLong > 2.5 && (o.posture === "sit" || o.posture === "lie")) makeRoom(o, c); else makeRoom(c, o); }
      } else { c.crowdT = 0; c.crowdLong = 0; }
      let hx = hard[i * 2], hz = hard[i * 2 + 1];
      if (px === 0 && pz === 0 && hx === 0 && hz === 0) { c.held = 0; continue; }
      // Turning on the spot squeezed between two (its body swinging into both; what one takes back
      // the other gives): it can't turn that way; the turn is undone and it counts as held back (so it
      // gives up the turn, or goes another way). Stuck there a moment, it wriggles round after all.
      const sweep = Math.abs(wrapAngle(c.yaw - c.pyaw)) * (HALF_LEN[c.pose] || 0.3) * c.size;
      const squeezed = c.hardSum > 1e-4 && Math.hypot(hx, hz) < 0.6 * c.hardSum && sweep > 1e-4 && Math.hypot(c.x - c.px, c.z - c.pz) < sweep;
      c.squeezeT = squeezed ? c.squeezeT + dt : 0;
      if (squeezed && c.squeezeT < 0.25) { c.x = c.px; c.z = c.pz; c.yaw = c.pyaw; c.held = 1; continue; }
      // A walking cat that brushes another is nudged no faster than its own legs carry it (it
      // steps aside, it isn't skated), and it turns a little the way it is nudged, so the step
      // aside is a change of course, not a slide. What is taken back of its own step is never more
      // than the step itself (squeezed between two, it stays where it was).
      const l = Math.hypot(px, pz), cap = Math.min(MAX_PUSH, Math.max(turning(c) ? 0.3 * dt : c.wantV > 0 ? 0.004 : 0, 0.6 * c.speed * dt)), f = l > cap ? cap / l : 1;
      // (Its own motion: its step, or the sweep of its body turning on the spot.)
      const sx = c.x - c.px, sz = c.z - c.pz, sl = Math.hypot(sx, sz);
      const own = Math.max(sl, Math.abs(wrapAngle(c.yaw - c.pyaw)) * (HALF_LEN[c.pose] || 0.3) * c.size), hl = Math.hypot(hx, hz);
      if (hl > own && hl > 0) { hx *= own / hl; hz *= own / hl; }
      // How much of its step it is being held back (for the stall check: walking on the spot): what
      // is taken back against the way it stepped (a cat stepping its body clear as it turns is not held).
      // A step more than a third taken back is taken back whole: a cat that walks into another stops
      // against it (and stops, waits or goes round: the stall check), it does not slide slowly along it.
      c.held = sl > 1e-6 ? Math.min(1, Math.max(0, -(hx * sx + hz * sz) / sl) / sl) : 0;
      if (c.held > 0.34 && !turning(c)) { hx = -sx; hz = -sz; c.held = 1; }
      px = px * f + hx; pz = pz * f + hz;
      c.x += px; c.z += pz;
      if (c.speed > 0.05) {
        const vx = Math.cos(c.yaw) * c.speed * dt + px, vz = -Math.sin(c.yaw) * c.speed * dt + pz;
        if (Math.hypot(vx, vz) > 0.3 * c.speed * dt) c.yaw = wrapAngle(c.yaw + clamp(wrapAngle(yawTo(vx, vz) - c.yaw), -1.5 * dt, 1.5 * dt));
      }
    }
  }
  /** A resting cat sitting or lying in another's space gets up and moves a little way off, and
      sits there a moment before it decides what to do next. */
  function makeRoom(cat, other) {
    // (Not in the middle of something only just begun, or just changing what it does: it gets up a moment later.)
    if (!cat.act || cat.perch || airborne(cat) || time - cat.motion.since < MIN_SHOW.stand || (cat.wa !== "move" && cat.wa !== cat.motion.action)) return;
    const st = cat.act.steps[cat.act.i];
    if (st && (st.type === "trans" || st.type === "hop")) return;
    const away = { x: cat.x + (cat.x - other.x) * 0.5, z: cat.z + (cat.z - other.z) * 0.5 };
    const s = randomSpot(cat.rnd, cat, { near: away, min: 0.4, max: 1.4 }) || randomSpot(cat.rnd, cat, { near: cat, min: 1, max: 2.5 });
    if (!s) return;
    const act = { kind: "rest", steps: [go(s, "stroll", 0.2, SAY.wander), hold(cat.rnd.chance(0.5) ? "sit" : "stand", dur(cat, 1.5, 4), SAY.look)], i: 0, t: 0, reason: SAY.look, ignore: new Set() };
    cat.dest = s;
    begin(cat, act);
  }

  function groundY(cat) {
    for (const b of L.BEDS) if (Math.abs(cat.x - b.x) < b.r && Math.hypot(cat.x - b.x, cat.z - b.z) < b.r - 0.12) return b.y;
    for (const p of L.NAP_PILES) if (p.kind === "cushion" && Math.hypot(cat.x - p.x, cat.z - p.z) < p.r - 0.1) return p.y;
    return 0;
  }

  const scratch = { x: 0, z: 0 };
  const airborne = (cat) => { const st = cat.act && cat.act.steps[cat.act.i]; return !!st && st.type === "hop" && cat.act.started; };

  function update(dt) {
    if (isReduced) return;
    time += dt;
    for (const cat of cats) {
      const nd = cat.needs, gr = cat.growth;
      for (let k = 0; k < NEEDS.length; k++) { const n = NEEDS[k]; nd[n] = Math.min(1.2, nd[n] + gr[k] * dt); }
      cat.moving = false; cat.pivoting = false; cat.stalk = false; cat.runIntent = false; cat.brakeT = Infinity; cat.wantV = 0;
      cat.px = cat.x; cat.pz = cat.z; cat.pyaw = cat.yaw;
      run(cat, dt);
    }
    resolveCats(dt);
    for (const cat of cats) {
      const st = cat.act && cat.act.steps[cat.act.i];
      if (!cat.perch && !airborne(cat) && (cat.moving || cat.x !== cat.px || cat.z !== cat.pz || cat.ySettle)) {
        // Nothing is walked through: the hard check after steering and personal space.
        const p = scratch; p.x = cat.x; p.z = cat.z;
        nav.project(p, cat.act ? cat.act.ignoreNow : withContaining(null, cat));
        // (How much of its step a prop took back: pressed against one, it is walking on the spot.)
        const own = Math.hypot(cat.x - cat.px, cat.z - cat.pz);
        cat.heldProp = own > 1e-6 ? Math.min(1, Math.hypot(p.x - cat.x, p.z - cat.z) / own) : 0;
        cat.x = p.x; cat.z = p.z;
        // Step up onto a bed's cushion (or the big cushion), down onto the grass.
        const g = groundY(cat);
        cat.y += (g - cat.y) * Math.min(1, dt * 10);
        cat.ySettle = Math.abs(g - cat.y) > 1e-3;
      }
      // A cat that tries to walk but gets nowhere (pushed back as far as it steps by another cat,
      // a bowl, a post) stops treading: every STALL_WAIT seconds its headway is checked, and if it
      // has made little it walks round the cat in its way, or, with nothing to walk round (a
      // crowd, a tight corner), stands and waits a moment.
      if (((cat.moving && cat.speed > 0.15) || cat.wantV > 0.15 || (cat.pivoting && cat.held > 0.7)) && st && WALKING_STEPS.has(st.type)) {
        if (cat.stall === 0) { cat.stallX = cat.x; cat.stallZ = cat.z; }
        // (Held back by another cat's body for most of its step: it doesn't wait out the check.)
        const byProp = (cat.heldProp || 0) > 0.7;
        cat.heldT = byProp || (cat.held || 0) > 0.7 ? (cat.heldT || 0) + dt : 0;
        if ((cat.stall += dt) > STALL_WAIT || cat.heldT > HELD_WAIT) {
          const made = Math.hypot(cat.x - cat.stallX, cat.z - cat.stallZ) / cat.stall;
          cat.stall = 0;
          if (made < Math.max(STALL_SPEED, cat.speed * 0.4) || cat.heldT > HELD_WAIT) {
            // (Walked into something, it has stopped: its speed is what it really made.)
            const R = cat.route, near = R && Math.hypot(R.qx - cat.x, R.qz - cat.z) < (R.arrive ?? 0.15) + CLOSE_ENOUGH;
            if (cat.heldT > HELD_WAIT && dt > 0 && !near) { cat.speed = Math.min(cat.speed, Math.hypot(cat.x - cat.px, cat.z - cat.pz) / dt); cat.wantV = 0; }
            cat.heldT = 0;
            // (Even the way round blocked: it waits; blocked again after that, it gives up the
            // walk rather than tread on the spot, starting off and stopping, again and again. Held
            // up this near where it was going (as near as walk() then takes for arriving), it is as
            // near as it will get: it has arrived. Up against a prop, it finds its way again from
            // where it is.)
            if (near) R.closeEnough = true;
            else if (R && byProp) { R.stale = true; R.replans = (R.replans || 0) + 1; cat.detour = null; }
            else {
              if (R) R.stalls = (R.stalls || 0) + 1;
              cat.detour = cat.detour ? null : aside(cat);
              if (!cat.detour) cat.waitUntil = time + WAIT_FOR;
            }
          }
        }
      } else cat.stall = 0;
      publishMotion(cat, dt, time);
      animateShared(cat, dt, time);
    }
    for (const y of yarns) stepYarn(y, dt);
  }

  function needRate(cat, n) {
    const t = cat.tune;
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
      if (cat.rnd.chance(0.85) && act.kind !== "chase") fastForward(cat);
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
        if (st.dur < 3 || ACTIONS[st.action].kind !== "loop" || st.doing === SAY.settle || st.doing === SAY.wake || st.action === "roll") { act.i++; continue; }
        act.started = true; act.t = cat.rnd.range(0, st.dur * 0.7); act.ignoreNow = withContaining(act.ignore, cat);
        snapMotion(cat, st.action, time);
        break;
      }
      else if (st.type !== "circle" && st.type !== "upTop") break; // chase, follow: just start walking
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
      ...POND_SPOTS.slice(0, 5).map((p) => ({ id: p.id, x: p.x, z: p.z, y: 0, pose: "sit", yaw: p.yaw, say: SAY.pond })),
    ];
    const order = [...cats].sort((a, b) => a.index - b.index);
    for (const cat of order) {
      const s = spots.shift();
      let pose;
      if (s) {
        reserve(s.id, cat);
        cat.x = s.x; cat.z = s.z; cat.y = s.y; cat.perch = s.perch || null;
        if (s.yaw != null) cat.yaw = s.yaw;
        pose = s.pose;
      } else {
        const p = randomSpot(cat.rnd, cat, { front: 0.7 }) || { x: cat.x, z: cat.z };
        cat.x = p.x; cat.z = p.z; cat.y = 0;
        pose = cat.rnd.pick(["loaf", "sit", "sleep", "sit"]);
      }
      snapMotion(cat, allowedAction(cat.traits, pose), time); // (one whose model can't sit or lie stands)
      cat.dest = { x: cat.x, z: cat.z };
      cat.moving = false; cat.speed = 0;
      cat.doing = s ? s.say : pose === "sleep" ? SAY.napGrass : pose === "sit" ? SAY.look : SAY.rest;
      const a = cat.anim; a.bob = 0; a.pitch = 0; a.pivot = 0; a.roll = 0; a.rollY = 0; a.sx = a.sy = a.sz = 1; cat.rollS = 0;
    }
  }

  function setReduced(on) {
    if (on === isReduced) return;
    isReduced = on;
    if (on) settleAll();
    else for (const cat of cats) {
      // Wake up where they settled (getting up properly); a cat on a perch hops down as its first move.
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
    /** Where the camera is, so a sitting cat can look at the person watching (y: its height, if known). */
    setViewer(x, z, y = 1.6) { if (viewer) { viewer.x = x; viewer.z = z; viewer.y = y; } else viewer = { x, z, y }; },
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

/* ── Publishing what a cat does (shared with the Hall of Fame, meadow.js) ── */

/** Sets cat.motion for this tick from what its step wants (cat.wa: an action, or "move" for travel,
    whose gait is picked here; cat.wu: its progress) and how it actually moved since cat.px, cat.pz,
    cat.pyaw. Keeps cat.stride (the instanced models' step phase) in step with the odometer. */
export function publishMotion(cat, dt, time) {
  const m = cat.motion;
  const moved = Math.hypot(cat.x - cat.px, cat.z - cat.pz);
  const turned = wrapAngle(cat.yaw - cat.pyaw);
  m.yawRate = dt > 0 ? turned / dt : 0;
  let action = cat.wa, gait = null;
  let odo = moved;
  if (action === "move") {
    // The gait from how fast it goes (turning on the spot counts as slow steps), with
    // hysteresis and a dwell; a sprint launches straight into a run.
    // (A cat held fast by another cat's body or a prop for more than a brush of a frame or two, its
    // step taken back, has stopped whatever speed its step asked for: its legs are not shown running
    // on the spot. A brush is seen out in the gait it has, below.)
    const pivot = cat.pivoting && dt > 0 ? (Math.abs(turned) / dt) * PIVOT_ARC : 0;
    const real = dt > 0 ? moved / dt : cat.speed, held = (cat.heldT || 0) > 0.05 && (cat.held > 0.7 || cat.heldProp > 0.7);
    // (and it has no way left on it: a cat stopped by a body does not carry on into it, or ease off
    // a speed it no longer has, showing a step or two more)
    if (held) cat.speed = Math.min(cat.speed, real);
    let v = Math.max(cat.speed, pivot);
    if (cat.runIntent && cat.speed > 0.05 && !held) v = Math.max(v, GAIT_BANDS.runUp + 0.01);
    gait = gaitFor(m.gait, v, time - cat.gaitSince, { stalk: cat.stalk && v >= 0.03 });
    if (m.gait && gait && gait !== m.gait && (time - cat.gaitSince < GAIT_DWELL || (cat.brakeT < (m.gait === "run" ? 0.4 : 0.3) && RANK[gait] < RANK[m.gait]))) gait = m.gait;
    // Pulling up (nothing asks it on), it stops in the gait it is in: no last-moment change of step
    // (and the last steps of a stalk are the stalk's, not a walk's).
    if (m.gait && gait && gait !== m.gait && !(cat.wantV > 0) && (m.gait === "stalk" || RANK[gait] < RANK[m.gait])) gait = m.gait;
    // Once on the move it is shown moving at least MIN_SHOW.move, even if it pulls up at once; but
    // one stopped dead (held by a body, or waiting with nowhere to go) is not left frozen mid-stride
    // beyond a real step's showing: it stands, and its legs square up.
    // (Brought up short out of a run or a trot, all but stopped, it stands: it doesn't drop into a walk
    // on the way, a walk that would only be seen frozen, its legs going nowhere.)
    if (!cat.pivoting && real < 0.1 && v < 0.1 && gait && m.gait && RANK[gait] < RANK[m.gait] && RANK[m.gait] > RANK.walk) gait = null;
    const dead = !cat.pivoting && real < 0.03 && (held || !(cat.wantV > 0));
    if (!gait && m.gait && time - cat.gaitSince < MIN_SHOW.move && !(dead && time - m.since >= 0.25)) gait = m.gait;
    if (cat.pivoting) { odo += Math.abs(turned) * PIVOT_ARC; if (m.gait && gait) gait = m.gait; } // turning on the spot in the gait it has
    // It counts as stopped only once it has been still a moment (setting off again is not a stop),
    // unless it means to stop (nothing asks it to go on): then it stands at once, and does not stand
    // there frozen mid-stride.
    cat.slowFor = gait || cat.lastWa !== "move" ? 0 : cat.slowFor + dt; // (setting off counts as not yet stopped)
    const grace = cat.wantV > 0 || cat.pivoting ? 0.12 : 0.03;
    if (gait) action = gait;
    else if (cat.slowFor < grace && m.gait) { gait = m.gait; action = m.action; }
    else if (cat.slowFor < grace && ACTIONS[m.action].posture !== "sit" && ACTIONS[m.action].posture !== "lie" && ACTIONS[m.action].posture !== "sleep") action = m.action;
    else action = "stand";
  }
  cat.lastWa = cat.wa;
  m.odometer += odo;
  cat.stride += odo * 5.2;
  if (gait !== m.gait) { if (gait && !m.gait) cat.moveSince = time; cat.gaitSince = time; m.gait = gait; }
  if (action !== m.action) {
    // A loop that has only just started is not swapped for another loop in the same posture
    // before MIN_SHOW (a fidget, the next hold); it just starts a moment later.
    const cur = ACTIONS[m.action], nxt = ACTIONS[action];
    if (cur.kind === "loop" && nxt.kind === "loop" && cur.posture === nxt.posture && time - m.since < MIN_SHOW[cur.posture] && odo < 1e-6) action = m.action;
  }
  if (action !== m.action) {
    m.action = action; m.since = time;
    // Stopped on its way: it stands its moment before it steps off again.
    if (action === "stand" && cat.wa === "move") cat.stopUntil = time + MIN_SHOW.stand;
  }
  const A = ACTIONS[m.action];
  m.posture = A.posture;
  m.u = A.kind === "once" || A.kind === "trans" ? (m.action === cat.wa ? cat.wu ?? 0 : m.u ?? 0) : null;
  m.look = cat.lookOn ? cat.lookAt : null;
}

/** One tick of turning round on the spot before lying down (a "circle" step: { turns }), shared with
    the Hall of Fame: a slow walk round a tight circle (radius CIRCLE_R) at an even pace, never a creep,
    braking to a stop in the last few degrees. Returns true when it is round. */
const CIRCLE_R = 0.2;
export function circleStep(cat, step, dt) {
  if (step.turned == null) { step.turned = 0; step.dir = cat.rnd.chance(0.5) ? 1 : -1; }
  const left = step.turns * Math.PI * 2 - step.turned;
  const pace = Math.max(V_MIN, 0.4 * Math.min(1, cat.tune.pace + 0.1)), vb = Math.sqrt(2 * BRAKE * Math.max(0, left) * CIRCLE_R);
  // (Done once the last of it would be inched: the rest is under a step. Hemmed in by another cat's
  // body, it has turned round as far as it can.)
  if (left <= 1e-4 || (vb < V_MIN && step.turned > 0.5) || (cat.held > 0.7 && step.turned > 0)) { cat.speed = 0; cat.moving = false; return true; }
  cat.wa = "move"; cat.lookOn = false;
  const v = Math.max(V_MIN, Math.min(pace, vb));
  const a = v > cat.speed ? ACCEL : BRAKE;
  cat.speed += clamp(v - cat.speed, -a * dt, a * dt);
  cat.wantV = v;
  const turn = Math.min(left, (Math.max(cat.speed, 0.08) / CIRCLE_R) * dt);
  cat.yaw = wrapAngle(cat.yaw + step.dir * turn);
  step.turned += turn;
  if (cat.speed > 0) { cat.x += Math.cos(cat.yaw) * cat.speed * dt; cat.z -= Math.sin(cat.yaw) * cat.speed * dt; cat.moving = cat.speed > 0.02; }
  return false;
}

/** Sets what the view shows, straight away (a new start, reduced motion). */
export function snapMotion(cat, action, time) {
  const m = cat.motion;
  m.action = action; m.posture = ACTIONS[action].posture; m.gait = null; m.u = null; m.since = time; m.look = null; m.yawRate = 0;
  cat.posture = baseOf(m.posture); cat.wa = action; cat.wu = null; cat.speed = 0; cat.lookOn = false;
  setPose(cat, poseOf(action), time);
}

/* ── Animation values for the shared (instanced) models ────────────── */

function setPose(cat, pose, time) {
  if (cat.pose !== pose) { cat.prevPose = cat.pose; cat.pose = pose; cat.poseSince = time; }
}

export function animateShared(cat, dt, time, still = false) {
  const a = cat.anim, m = cat.motion, t = time + cat.phase, act = m.action;
  a.bob = 0; a.pitch = 0; a.pivot = 0; a.roll = 0; a.rollY = 0; a.sx = 1; a.sy = 1; a.sz = 1;
  setPose(cat, poseOf(act, m.u ?? 0), time);
  if (still) return;
  const breath = cat.tune.breath, held = time - m.since;
  let roll = 0;
  if (cat.pose === "walk") {
    const k = Math.min(1, cat.speed / 1.2);
    a.bob = Math.abs(Math.sin(cat.stride)) * (0.035 + 0.03 * k);
    a.pitch = Math.sin(cat.stride * 2) * 0.018 * k;
    a.roll = Math.sin(cat.stride) * 0.025 * k;
    // A springy gait: a little squash as the paws land, a stretch at the top of each step.
    a.sy = 1 + (Math.abs(Math.sin(cat.stride)) - 0.5) * 0.035 * k; a.sx = 1 - (a.sy - 1) * 0.5;
    if (act === "sniff") { a.pivot = 1; a.pitch = -0.12; }
  } else if (cat.pose === "sleep") {
    const s = Math.sin(t * Math.PI * 2 * 0.2 * breath);
    a.sy = 1 + s * 0.028; a.sx = a.sz = 1 + s * 0.012;
  } else if (act === "roll") {
    // On its back, rolling from one side to the other, belly to the sun.
    const u = held * 1.1 * breath;
    roll = Math.sin(u) * 1.25 + Math.sin(u * 2.3) * 0.12; a.rollY = 0.42; a.sx = 1.04;
  } else if (act === "flop") {
    roll = 1.1; a.rollY = 0.42; a.sx = 1.04;
    const s = Math.sin(t * Math.PI * 2 * 0.25 * breath); a.sy = 1 + s * 0.02;
  } else if (act === "eat") {
    // Head down in the bowl, chewing in little bursts, looking up now and then.
    const cycle = (t * 0.42) % 1, up = cycle > 0.8 ? Math.sin((cycle - 0.8) / 0.2 * Math.PI) : 0;
    a.pivot = 1; a.pitch = -(0.21 + Math.max(0, Math.sin(t * Math.PI * 2 * 1.7)) * 0.06) * (1 - up) - 0.03 * up;
  } else if (act === "dab") {
    // Leaning out over the water, dipping a paw.
    a.pivot = 1; a.pitch = -0.16 - Math.max(0, Math.sin(held * Math.PI * 2 * 1.3)) * 0.12;
  } else if (act === "groom" || act === "legLick") {
    // Licks in bursts, a tilt one way then the other, pauses between.
    const burst = Math.max(0, Math.sin(t * Math.PI * 2 * 0.23));
    const lick = Math.sin(t * Math.PI * 2 * 2.1);
    a.roll = lick * 0.075 * burst + Math.sign(Math.sin(t * 0.37)) * 0.05 * burst;
    a.pitch = -(0.05 + Math.abs(lick) * 0.05) * burst;
  } else if (act === "stretch") {
    const k = Math.sin(Math.min(1, m.u ?? 0) * Math.PI);
    a.sx = 1 + k * 0.09; a.sy = 1 - k * 0.05; a.pivot = -1;
  } else if (act === "wiggle") {
    a.pivot = 1; a.roll = Math.sin(t * Math.PI * 2 * 4.5) * 0.06; a.sy = 0.96;
  } else if (act === "crouch" || act === "scratch") {
    a.sy = 0.93; a.sx = 1.03;
  } else if (act === "pant") {
    const s = Math.sin(t * Math.PI * 2 * 1.6); a.sy = 1 + s * 0.022;
  } else if (act === "chatter" || (act === "sit" && m.look && m.look.y > 1)) {
    // Head up, following what got away (or the person watching).
    a.pivot = 1; a.pitch = 0.12 + Math.sin(t * 1.3) * 0.03;
  } else if (act === "hop" || act === "pounce") {
    a.pitch = cat.hopPitch || 0; a.pivot = act === "pounce" ? -0.6 : 0;
  } else {
    const s = Math.sin(t * Math.PI * 2 * 0.3 * breath); a.sy = 1 + s * 0.012; a.sx = a.sz = 1 + s * 0.004;
  }
  // Rolling over onto its side and back takes a moment, not a tick.
  cat.rollS += (roll - cat.rollS) * Math.min(1, dt * 5);
  if (roll || Math.abs(cat.rollS) > 1e-3) a.roll = cat.rollS;
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


/* ── Small maths ─────────────────────────────────────────────────────────── */

/** Closest points between segments p1→p2 and q1→q2 in the plane: [px, pz, qx, qz] (one shared array, reused). */
const CP = new Float64Array(4);
function closestPoints(p1x, p1z, p2x, p2z, q1x, q1z, q2x, q2z) {
  const d1x = p2x - p1x, d1z = p2z - p1z, d2x = q2x - q1x, d2z = q2z - q1z, rx = p1x - q1x, rz = p1z - q1z;
  const a = d1x * d1x + d1z * d1z, e = d2x * d2x + d2z * d2z, f = d2x * rx + d2z * rz;
  let s = 0, t = 0;
  if (a < 1e-9 && e < 1e-9) { CP[0] = p1x; CP[1] = p1z; CP[2] = q1x; CP[3] = q1z; return CP; }
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
  CP[0] = p1x + d1x * s; CP[1] = p1z + d1z * s; CP[2] = q1x + d2x * t; CP[3] = q1z + d2z * t;
  return CP;
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampAbs = (v, m) => (v < -m ? -m : v > m ? m : v);

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
