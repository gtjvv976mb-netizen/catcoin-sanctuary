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
     the middle half. A leap lands only where the cat's whole body is clear of the pond (with its
     rim) and every solid prop, or it lands short or doesn't leap.

   Character. Each cat's traits (traits.js: energy, sleepiness, playfulness, boldness, ...) come
   in with its resident (r.traits; a cat without any is an ordinary adult, NEUTRAL_TRAITS) and its
   motion style (r.style: its tempo). They set its pace and rhythm, how it scores activities,
   how long it holds a pose, the little things it does while it holds one (pickFidget: a yawn, a
   paw wash, an ear scratch, its own signature move), how often it looks at you, whether it will
   play chase. The rest is seeded from its id, so a cat behaves the same way on every visit.

   Two cats never share a bed, a bowl, a slot or a perch (a place is reserved when a cat heads
   for it). Cats keep a little personal space, steer round the cottage and props on routes from
   nav.js, and are pushed back out of anything they would otherwise walk into. A cat found in the
   water or a solid prop walks straight out (walkOut), and never sits or lies down in one.

   Big cats (a lion, a tiger, a cheetah: drawn BIG_SIZE × an ordinary cat or more, traits.js
   SPECIES). Everything about a cat's body goes by the size it is drawn at (sizeOf): its body, the
   room it needs and leaves, where it stands to watch the pond or visit a friend. It moves as a big
   animal does (catmotion gaitScale): walks, trots and runs at √size times the speeds, in gait bands
   that much faster, turns and steps √size times more slowly and takes that much longer over each
   move, so its paws stay planted and its cadence is slow and heavy. A big cat finds its way on a
   route-finder of its own, built for its body (it keeps its whole body clear of the props, not a
   house cat's), and leaves the house cats' things alone: no cat beds, cat trees, porch step, nap
   piles, food bowls or balls of yarn, no zoomies or games of chase. It naps and basks across a whole
   sunny patch or on the open lawn, watches the pond and drinks from it from further back, grooms,
   wanders and rests, stalks birds and butterflies. Cats keep company (follow, visit, chase) only with
   cats not far off their own size: a lion does not chase a house cat, nor rub cheeks with its back.
   With reduced motion, every cat settles in one spot and stays there, still.

   The birds and butterflies live in critters.js. The simulation only reads where they are and
   asks them to fly off (`critters.startle`), so it still runs without them (under Node). */

import { makeRandom } from "./rng.js";
import { NavWorld, distToObstacle, yawTo, wrapAngle } from "./nav.js";
import * as L from "./layout.js";
import { MAX_SCALE, MIN_SCALE } from "./traits.js";
import { ACTIONS, FIDGETS, GAIT_BANDS, GAIT_DWELL, MIN_SHOW, NEUTRAL_TRAITS, allowedAction, canDo, gaitFor, gaitScale, LEG_VMAX, legCapAhead, legStep, newLegs, pickFidget, transDur, transitionPath } from "./catmotion.js";

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
/** Waits (0.8 s each) before a cat that can't get up clear of another gives up what it meant to do. */
const RISE_WAITS = 8;
/** How long (s) a big cat whose way was stuck does only what it does in place (a rest, a wash) before it tries again. */
const HEMMED = 10;
/** How far (units) a visitor comes into its friend's body to rub cheeks: touching. */
const NUZZLE = 0.08;
/** Near enough (units into the friend) to settle beside it: settling checks the room exactly. */
const TOUCH_ARRIVE = 0.1;
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
export const sizeOf = (cat) => { const s = cat.style && cat.style.scale; return s > 0 ? clamp(s, MIN_SCALE, MAX_SCALE) : 1; };
/** A big cat (a leopard, a lion; not a bobcat or a Savannah): too big for the house cats' beds, cat
    trees, porch step, piles, bowls and yarn, and finding its way on a route-finder of its own. */
export const BIG_SIZE = 1.5;
/** Cats drawn this big or more (a Savannah, a bobcat, the big cats) keep their whole body, nose to
    hindquarters, out of the props (propDepth); a smaller one's middle is kept out, and its route-finder's
    berth keeps the rest. */
export const LONG = 1.25;
/** Cats that keep company (follow, visit, chase): not more than this many times the other's size. */
export const ALIKE = 1.5;
export const alike = (a, b) => Math.max(a.size, b.size) <= ALIKE * Math.min(a.size, b.size);
/** How far apart two cats settle when one of them is big (0 when neither is): far enough for either
    to get up and turn round (its body swinging right round) clear of the other, so a big cat is never
    left hemmed in by house cats sat down within its reach, nor one settles within a big one's. */
export const bigRoom = (a, b) => (a.size >= BIG_SIZE || b.size >= BIG_SIZE ? (HALF_LEN.walk + BODY) * (a.size + b.size) + 0.1 : 0);
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
  drinkGo: "Off for a drink", drink: "Having a drink", drinkPond: "Drinking at the pond", climbGo: "Off to a cat tree", climb: "Climbing the cat tree", sizeUp: "Sizing up the jump",
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
  // The big cats' own route-finder: its routes keep the biggest one's whole body (BODY × its size, and
  // a little) clear of every prop, where a house cat's keep only a house cat's clear (a lion routed on
  // those walks through lantern posts and bushes). Built once, only when there is a big cat.
  const bigMax = Math.max(0, ...residents.map((r) => sizeOf({ style: r.style })).filter((s) => s >= BIG_SIZE)), bigR = bigMax * BODY;
  /** How far round a big cat of this size its whole body reaches, at its longest (stretching): the
      room it needs clear of every prop where it settles, whichever way it lies (0 for a house cat). */
  const reachPad = (size) => (size >= BIG_SIZE ? (BODY + HALF_LEN.stretch) * size : size >= LONG ? (BODY + HALF_LEN.walk) * size : 0);
  const NO_POND = new Set([L.POND.id]);
  // (and its head out from under the garden trees' lowest leaves: a crown (flora.js: centre 3.9 s up,
  // 2 s across, s = 0.85 of the tree's scale) hangs lowest by the trunk, so a big cat taller than that
  // keeps as far off the trunk as the crown is low over its head, not just clear of the trunk)
  const headH = bigMax * L.CAT.size * 0.95, crown = (t) => { const s = t.s * 0.85, low = 3.9 * s - headH; return low > 2 * s ? 0 : Math.sqrt(4 * s * s - Math.max(0, low) ** 2) - bigR; };
  const TREE_OF = new Map(L.GARDEN_TREES.map((t) => [t.id, t]));
  const bigObstacles = L.obstacles().map((o) => (TREE_OF.has(o.id) ? { ...o, r: Math.max(o.r, crown(TREE_OF.get(o.id))) } : o));
  const bigNav = bigR ? new NavWorld({ obstacles: bigObstacles, walkR: L.GARDEN.walkR, clearR: Math.round((bigR + 0.12) * 100) / 100, bodyR: Math.round(bigR * 100) / 100 }) : null;
  const navOf = (size) => (size >= BIG_SIZE && bigNav ? bigNav : nav);
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
  /** Reserves all of these places for the cat, or none of them (a big cat's whole sunny patch). */
  const reserveAll = (ids, cat) => { const got = []; for (const id of ids) { if (!reserve(id, cat)) { for (const g of got) release(cat, g); return false; } got.push(id); } return true; };

  /** Spots other cats need to reach: the bowl and dish stands, the foot of the stairs and the trees, the pond edge. */
  const STANDS = [...L.BOWLS.map((b) => b.stand), ...L.WATERS.map((w) => w.stand), L.STEP.ground, ...L.TREES.flatMap((t) => [t.ground, t.landing]), ...L.POND_SPOTS];
  // Only the bowls, dishes and pond spots a cat can actually stand at (a prop set down over one,
  // like the research desk by the first bowls, puts it out of reach: a cat would get up, find no
  // way there and give up, again and again).
  const standable = (p, id) => nav.pointFree(p.x, p.z, nav.clearR - 0.02, id ? new Set([id]) : null);
  const BOWLS = L.BOWLS.filter((b) => standable(b.stand, b.id));
  /** Every bowl and dish in the garden, by id. */
  const RIM_OF = new Map([...L.BOWLS, ...L.WATERS].map((b) => [b.id, b]));
  /** The props a cat may be in (cat beds, bowls and dishes, cat trees' feet); every other one is solid. */
  const USABLE = new Set([...L.BEDS.map((b) => b.id), ...RIM_OF.keys(), ...L.TREES.map((t) => t.id)]);
  const TREE_FOOT = new Set(L.TREES.map((t) => t.id));
  const WATERS = L.WATERS.filter((w) => standable(w.stand, w.id));
  const POND_SPOTS = L.POND_SPOTS.filter((p) => standable(p));
  // A big cat's places: the pond's edge further back (the same spots, moved out till its body is clear
  // of the water, its head over it), and whole sunny patches (both slots) to nap and bask in.
  /** How far from the pond's middle a big cat stands at its edge (BIG_POND): on the bank, where its head may reach out over it. */
  const BANK = bigNav ? L.POND.r + 0.25 + bigNav.clearR + 0.06 : 0;
  const BIG_POND = !bigNav ? [] : L.POND_SPOTS.map((p) => {
    const d = BANK;
    return { ...p, x: L.POND.x + Math.cos(Math.atan2(p.z - L.POND.z, p.x - L.POND.x)) * d, z: L.POND.z + Math.sin(Math.atan2(p.z - L.POND.z, p.x - L.POND.x)) * d };
  }).filter((p) => bigNav.pointFree(p.x, p.z, bigNav.clearR - 0.02) && bigNav.pointFree(p.x, p.z, reachPad(bigMax) * 0.85, NO_POND));
  const BIG_SUN = !bigNav ? [] : L.SUN_PATCHES.filter((s) => bigNav.pointFree(s.x, s.z, Math.max(bigNav.clearR, reachPad(bigMax))));
  const sunIds = (s) => s.slots.map((_, k) => `${s.id}#${k}`);
  const PILE_SLOTS = L.NAP_PILES.flatMap((p) => p.slots.map((_, k) => ({ id: `${p.id}#${k}`, pile: p, k, ...L.slotAt(p, k) })));
  const inPile = (x, z, pad = 0) => L.NAP_PILES.some((p) => p.r ? Math.hypot(p.x - x, p.z - z) < p.r + pad : Math.hypot(p.x - x, p.z - z) < Math.max(p.w, p.d) / 2 + pad);

  /** Is (x, z) a reasonable place for a cat to stop: clear of props, other cats and their destinations
      (a big cat's body clear of them all, and of the house cats' places). */
  function spotOk(x, z, self, space = L.CAT.personal * 1.12) {
    const N = self ? self.nav : nav, g = self ? Math.max(1, self.size) : 1;
    // (a big cat's whole body clear of the props, however it lies or stretches there)
    if (!N.pointFree(x, z, Math.max(N.clearR + 0.05, self ? reachPad(self.size) : 0))) return false;
    const k = (self ? self.size : 1) * 0.5;
    for (const c of cats) {
      if (c === self) continue;
      // (room for both: a big cat takes more of it, room enough to turn round in)
      const sp = Math.max(space * (k + c.size * 0.5), self ? bigRoom(self, c) : 0);
      if (Math.abs(c.x - x) < sp && Math.abs(c.z - z) < sp && Math.hypot(c.x - x, c.z - z) < sp) return false;
      if (c.dest && Math.hypot(c.dest.x - x, c.dest.z - z) < sp) return false;
    }
    for (const b of L.BEDS) if (Math.hypot(b.x - x, b.z - z) < b.r + 0.5 * g) return false;
    for (const s of L.SUN_PATCHES) if (Math.hypot(s.x - x, s.z - z) < s.r + (g - 1) * BODY) return false;
    if (inPile(x, z, 0.4 * g)) return false;
    for (const p of STANDS) if (Math.hypot(p.x - x, p.z - z) < 0.85 * g) return false;
    return true;
  }

  /** True when no other cat is sitting (or lying) on this spot. */
  function clearOfCats(p, self, room = 0.7) {
    const k = (self ? self.size : 1) * 0.5;
    for (const c of cats) {
      if (c === self || c.moving) continue;
      const r = Math.max(room * (k + c.size * 0.5), self ? bigRoom(self, c) : 0);
      if (Math.abs(c.x - p.x) < r && Math.abs(c.z - p.z) < r && Math.hypot(c.x - p.x, c.z - p.z) < r) return false;
    }
    return true;
  }
  /** A cat (not itself, awake or asleep, on the ground) this one would sit or lie down too close to,
      a big one or a small one beside a big one (bigRoom); null if none. */
  function tooNearBig(cat, x = cat.x, z = cat.z) {
    for (const c of cats) {
      if (c === cat || c.y > 0.3 || c.perch || together(cat, c)) continue;
      const r = bigRoom(cat, c);
      if (r && Math.abs(c.x - x) < r && Math.abs(c.z - z) < r && Math.hypot(c.x - x, c.z - z) < r) return c;
    }
    return null;
  }

  /** Before resting or washing where it stands: a cat in someone's way moves aside first,
      and a cat still in the bed, slot or sunny spot it woke in keeps it while it stays. */
  function settleHere(cat, act) {
    if (cat.perch) return [];
    if (STANDS.some((p) => Math.hypot(p.x - cat.x, p.z - cat.z) < 0.85 * Math.max(1, cat.size))) {
      const g = Math.max(1, cat.size), s = randomSpot(cat.rnd, cat, { near: cat, min: 1.4 * g, max: 3.2 * g }) || randomSpot(cat.rnd, cat);
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
    // (a big cat on a sunny patch has the whole of it)
    if (cat.big) for (const sp of BIG_SUN) if (Math.hypot(sp.x - cat.x, sp.z - cat.z) < 0.35 * cat.size) for (const id of sunIds(sp)) reserve(id, cat);
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
    // Its size: its body, the route-finder for it, and how its motion scales (gaitScale: fr).
    const size = sizeOf({ style }), cnav = navOf(size);
    return {
      id: r.id, name: r.name, model: r.model === "ginger" ? "ginger" : "cat", index: i,
      rnd, traits: t, style, tune, p, needs, size, fr: gaitScale(size), big: size >= BIG_SIZE, nav: cnav, bodyR: Math.max(cnav.bodyR, BODY * size),
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
      // (every field a cat ever gets, from the start: the hot loops over all the cats stay fast when every cat has the same shape)
      heldFree: 0, jamT: 0, crowdLong: 0, growth: null, legs: newLegs(), turnFlip: 0, hemmedUntil: 0,
    };
  }

  residents.forEach((r, i) => cats.push(makeCat(r, i)));
  for (const c of cats) c.growth = NEEDS.map((n) => GROWTH[n] * needRate(c, n));
  const byIdMap = new Map(cats.map((c) => [c.id, c]));

  /* ── Choosing what to do ───────────────────────────────────────────── */

  function freeSleepPlaces(cat) {
    const out = [];
    // (a big cat: a whole sunny patch, free and clear of cats; never a cat bed)
    if (cat.big) {
      for (const s of BIG_SUN) { const ids = sunIds(s); if (ids.every(free)) out.push({ id: ids[0], ids, x: s.x, z: s.z, y: 0, kind: "sun" }); }
      return out.filter((p) => clearOfCats(p, cat, 0.9));
    }
    for (const b of L.BEDS) if (free(b.id)) out.push({ id: b.id, x: b.x, z: b.z, y: b.y, kind: "bed", ignore: b.id });
    for (const s of L.SUN_PATCHES) s.slots.forEach(([dx, dz], k) => { const id = `${s.id}#${k}`; if (free(id)) out.push({ id, x: s.x + dx, z: s.z + dz, y: 0, kind: "sun" }); });
    return out.filter((p) => p.kind === "bed" || clearOfCats(p, cat, 0.9));
  }

  function leaders(cat) {
    return cats.filter((c) => c !== cat && c.moving && c.y < 0.05 && c.act && !["follow", "zoomies", "chase", "chased", "visit"].includes(c.act.kind)
      && alike(c, cat) && Math.abs(c.x - cat.x) < 7 && Math.abs(c.z - cat.z) < 7);
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
      && c.needs.sleep < 0.75 && !c.gentle && !c.lazy && !c.big && alike(c, cat) && time > c.chaseCool
      && Math.abs(c.x - cat.x) < 6 && Math.abs(c.z - cat.z) < 6 && Math.hypot(c.x - cat.x, c.z - cat.z) < 6 && Math.hypot(c.x - cat.x, c.z - cat.z) > 0.7 * (cat.size + c.size));
  }

  /** Friends resting nearby that a sociable cat might go and greet. */
  function friends(cat) {
    return cats.filter((c) => c !== cat && !c.perch && c.y < 0.05 && settled(c, 1.5) && !c.greetedBy && c.traits.grumpy < 0.7 && alike(c, cat)
      && Math.abs(c.x - cat.x) < 7 && Math.abs(c.z - cat.z) < 7 && Math.hypot(c.x - cat.x, c.z - cat.z) > 0.7 * (cat.size + c.size));
  }

  function lowButterflies(cat) {
    if (!critters?.butterflies) return [];
    return critters.butterflies.filter((b) => b.y < 1.5 && !targeted.has(b) && Math.hypot(b.x, b.z) < L.GARDEN.walkR - 0.5
      && Math.abs(b.x - cat.x) < 7 && Math.abs(b.z - cat.z) < 7 && cat.nav.pointFree(b.x, b.z, cat.big ? cat.nav.clearR * 0.7 : 0.3));
  }

  function landedBirds(cat) {
    if (!critters?.birds) return [];
    return critters.birds.filter((b) => b.state === "perched" && b.reachable && !targeted.has(b)
      && Math.abs(b.x - cat.x) < 9 && Math.abs(b.z - cat.z) < 9);
  }

  const canChase = (cat) => !cat.gentle && !cat.lazy && !cat.big && time > cat.chaseCool && cat.traits.grumpy < 0.75;

  function choose(cat) {
    const n = cat.needs, k = cat.tune, t = cat.traits, rnd = cat.rnd;
    const opts = [];
    const add = (kind, score) => {
      if (score > 0 && !(cat.cool[kind] > time)) opts.push([kind, score + rnd.range(0, 0.28) - (cat.last === kind ? 0.35 : 0)]);
    };
    add("nap", n.sleep * 1.0 * k.sleepy);
    // (A big cat leaves the house cats' things alone: no piles, bowls, dishes or yarn; it basks on a
    // whole sunny patch and drinks at the pond.)
    const big = cat.big;
    if (!big && PILE_SLOTS.some((s) => free(s.id))) add("pile", n.sleep * (0.6 + k.social * 0.4) * k.sleepy);
    if (big ? BIG_SUN.some((s) => sunIds(s).every(free)) : L.SUN_PATCHES.some((s) => s.slots.some((_, j) => free(`${s.id}#${j}`)))) add("sunroll", 0.08 + (n.play * 0.35 + n.sleep * 0.4) * (cat.gentle ? 0.7 : k.playful));
    if (!big && BOWLS.some((b) => free(b.id) && clearOfCats(b.stand, cat))) add("eat", n.hunger * 1.15 * k.hungry);
    if (big ? BIG_POND.some((p) => free(p.id)) : WATERS.some((w) => free(w.id) && clearOfCats(w.stand, cat))) add("drink", n.thirst * 1.05);
    if (!big && yarns.some((y) => !y.player)) add("play", n.play * 0.7 * k.playful * (cat.lazy ? 0.5 : 1));
    if (canChase(cat) && n.play > 0.35 && playmates(cat).length) add("chase", n.play * 0.6 * k.playful * (0.5 + k.social * 0.5));
    if (!cat.blind && n.sleep < 0.75 && lowButterflies(cat).length) add("butterfly", 0.12 + n.play * 1.0 * k.hunter);
    if (!cat.blind && n.sleep < 0.85 && landedBirds(cat).length) add("bird", 0.4 + n.play * 0.9 * k.hunter);
    if ((big ? BIG_POND : POND_SPOTS).some((p) => free(p.id))) add("pond", n.explore * (0.45 + 0.35 * t.curious));
    if (!big && k.climber > 0 && L.TREES.some((T) => free(T.low.id) && clearOfCats(treeFoot(T, cat), cat))) add("climb", n.explore * 0.72 * k.climber);
    if (!big && !cat.blind && free(L.STEP.id) && clearOfCats(L.STEP.ground, cat)) add("porch", n.explore * 0.5);
    add("groom", n.groom * 0.95 * k.tidy);
    if (leaders(cat).length) add("follow", n.social * 0.6 * k.social * (cat.kitten ? 1.3 : 1));
    if (t.social > 0.45 && friends(cat).length) add("visit", n.social * 0.7 * k.social);
    add("wander", 0.26 + n.explore * 0.42 * (0.7 + 0.6 * t.curious));
    // Cats are thrifty with effort: one already sitting or lying is happy to stay put a while longer.
    const down = cat.posture === "sit" || cat.posture === "lie";
    add("rest", 0.16 + n.sleep * 0.35 + (1 - t.energy) * 0.15 + (down ? 0.3 : 0));
    // Zoomies: kittens and lively, playful cats; never a lazy or a gentle one, nor a big cat.
    if (!big && !cat.gentle && !cat.lazy && time - cat.lastZoom > (cat.kitten ? 60 : 120) && n.sleep < 0.5
      && rnd.chance(0.01 + 0.06 * t.playful * t.energy + (cat.kitten ? 0.06 : 0))) opts.push(["zoomies", 3]);
    opts.sort((a, b) => b[1] - a[1]);
    // (A big cat hemmed in, its way stuck, settles where it is a while (a rest, a wash) rather than set off on one errand
    // after another it can't go on, waiting its turn at each.)
    for (const [kind] of opts) { if (cat.hemmedUntil > time && kind !== "rest" && kind !== "groom") continue; const act = build(cat, kind); if (act) return act; }
    return build(cat, "rest");
  }

  /* ── Building an activity: a list of small steps ───────────────────── */

  const dur = (cat, a, b) => cat.rnd.range(a, b) * cat.tune.rhythm;
  const tempoOf = (cat) => clamp(cat.style.tempo ?? 1, 0.6, 1.5);
  /** One-off actions last as long as their clip (catrig: yawn 2 s, stretch 2.2 s at tempo 1, shake 0.8 s),
      a big cat's that much longer (gaitScale). */
  const onceDur = (cat, action) => (action === "shake" ? 0.8 : action === "yawn" ? 2 * tempoOf(cat) : action === "stretch" ? 2.2 * tempoOf(cat) : 1) * cat.fr;
  /** How long a posture change takes this cat: its tempo's, and a big cat's that much longer (gaitScale). */
  const transFor = (cat, name) => transDur(name, tempoOf(cat)) * cat.fr;
  const hold = (action, d, doing, o) => ({ type: "hold", action, dur: d, doing, ...o });
  const once = (cat, action, doing, o) => hold(action, onceDur(cat, action), doing, { fidget: false, ...o });
  const go = (p, mode, arrive, doing, o) => ({ type: "go", x: p.x, z: p.z, mode, arrive, doing, ...o });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const nearest = (cat, list, key = (p) => p) => list.slice().sort((p, q) => dist(key(p), cat) - dist(key(q), cat))[0];

  /** Travel speed for a kind of travel, at this cat's pace, kept inside its gait band (a big cat's
      speeds and bands √size times faster: gaitScale). */
  function speedOf(cat, mode) {
    const f = cat.fr, v = SPEED[mode] * cat.tune.pace * f;
    if (mode === "zoom" || mode === "flee" || mode === "pursue") return Math.max(RUN_MIN * f, v);
    if (mode === "hurry") return cat.lazy ? Math.min(WALK_MAX * f, SPEED.purpose * cat.tune.pace * f) : clamp(v, TROT_MIN * f, TROT_MAX * f);
    if (mode === "stalk" || mode === "creep") return v;
    return Math.min(WALK_MAX * f, v);
  }

  /** Where a cat takes off for a cat tree's low platform (or lands from the top, `top`): far enough out for its body,
      stretched out to leap, to clear the tree's foot, whatever its size. */
  function treeFoot(T, cat, top = false) {
    const p = top ? T.landing : T.ground, x = Math.max(p.x, T.base.maxX + (HALF_LEN.stretch + BODY) * Math.max(1, cat.size) + 0.05);
    return x === p.x || !cat.nav.pointFree(x, p.z, cat.nav.clearR - 0.02) ? p : { x, z: p.z };
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
        if (cat.nav.pointFree(q.x, q.z, cat.nav.clearR) && cat.nav.segmentClear(p.ground.x, p.ground.z, q.x, q.z, null, cat.bodyR) && clear(q)) { g = q; break; }
      }
    }
    return [
      { type: "turn", yaw: yawTo(g.x - cat.x, g.z - cat.z), doing: SAY.hopDown },
      { type: "hop", x: g.x, z: g.z, y: 0, air: (0.36 + p.y * 0.1) * cat.fr, apex: 0.16, doing: SAY.hopDown, down: p, then: () => { release(cat, p.id); cat.perch = null; } },
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
          if (!reserveAll(p.ids || [p.id], cat)) return null;
          if (p.ignore) act.ignore.add(p.ignore);
          say = p.kind === "bed" ? SAY.napBed : SAY.napSun;
        } else {
          const s = randomSpot(rnd, cat, { near: cat, min: 0.5 * cat.size, max: 5 * Math.max(1, cat.size) }) || randomSpot(rnd, cat, { front: 0.5 });
          if (!s) return null;
          p = { x: s.x, z: s.z, y: 0 };
        }
        act.reason = SAY.bed;
        cat.dest = { x: p.x, z: p.z };
        steps.push(go(p, "purpose", 0.12, SAY.bed), ...sleepSteps(cat, say, dur(cat, 60, 140) * cat.tune.sleepy));
        break;
      }
      case "pile": {
        if (cat.big) return null; // (a big cat naps on its own, on a sunny patch or the grass)
        // Prefer a pile that already has a cat or two in it: they nap together.
        const slots = PILE_SLOTS.filter((s) => free(s.id) && clearOfCats(s, cat, 0.6));
        if (!slots.length) return null;
        const score = (s) => dist(s, cat) * rnd.range(0.8, 1.2) - PILE_SLOTS.filter((o) => o.pile === s.pile && reserved.has(o.id)).length * 3;
        const s = slots.sort((a, b) => score(a) - score(b))[0];
        if (dist(s, cat) > 16 || !reserve(s.id, cat)) return null;
        cat.dest = { x: s.x, z: s.z };
        act.pile = s.pile; // (the cats it may lie up against)
        act.reason = SAY.pileGo;
        const say = s.pile.kind === "blanket" ? SAY.blanket : SAY.pile;
        steps.push(go(s, "purpose", 0.12, SAY.pileGo, { then: () => { act.atPile = true; } }), ...sleepSteps(cat, say, dur(cat, 70, 160) * cat.tune.sleepy));
        break;
      }
      case "sunroll": {
        const slots = [];
        // (a big cat: a whole patch, lying across the middle of it)
        if (cat.big) { for (const sp of BIG_SUN) { const ids = sunIds(sp); if (ids.every(free)) slots.push({ id: ids[0], ids, x: sp.x, z: sp.z }); } }
        else for (const sp of L.SUN_PATCHES) sp.slots.forEach(([dx, dz], k) => { const id = `${sp.id}#${k}`; if (free(id)) slots.push({ id, x: sp.x + dx, z: sp.z + dz }); });
        const open = slots.filter((s) => clearOfCats(s, cat, 0.9) && dist(s, cat) < 12 * Math.max(1, cat.fr));
        if (!open.length) return null;
        const s = nearest(cat, open);
        if (!reserveAll(s.ids || [s.id], cat)) return null;
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
        if (cat.big) {
          // A big cat drinks at the pond, from its own spot further back (its head over the water).
          if (kind === "eat") return null;
          const spots = BIG_POND.filter((p) => free(p.id) && clearOfCats(p, cat));
          if (!spots.length) return null;
          const p = nearest(cat, spots);
          if (dist(p, cat) > 20 || !reserve(p.id, cat)) return null;
          cat.dest = { x: p.x, z: p.z };
          act.reason = SAY.drinkGo;
          const d = dur(cat, 4, 8) * cat.fr;
          steps.push(
            go(p, "purpose", 0.12, act.reason),
            { type: "turn", yaw: p.yaw, doing: act.reason },
            hold("eat", d, SAY.drinkPond, { restore: { thirst: 1.2 / d }, fidget: false }),
            { type: "call", fn: () => release(cat, p.id) },
          );
          break;
        }
        const list = (kind === "eat" ? BOWLS : WATERS).filter((b) => free(b.id) && clearOfCats(b.stand, cat));
        if (!list.length) return null;
        const b = nearest(cat, list, (p) => p.stand);
        if (!reserve(b.id, cat)) return null;
        // (it may come right up to its own bowl: but only for the last step to it, from a spot just back from
        // its stand, so the way there never crosses the bowl, coming from its far side)
        const ox = b.stand.x - b.x, oz = b.stand.z - b.z, ol = Math.hypot(ox, oz) || 1, back = { x: b.stand.x + (ox / ol) * 0.35, z: b.stand.z + (oz / ol) * 0.35 };
        const near = nav.pointFree(back.x, back.z, L.CAT.clearR) && Math.hypot(cat.x - b.stand.x, cat.z - b.stand.z) > 0.5;
        if (!near) act.ignore.add(b.id);
        cat.dest = { ...b.stand };
        const d = kind === "eat" ? dur(cat, 7, 13) : dur(cat, 4, 8);
        act.reason = kind === "eat" ? SAY.eatGo : SAY.drinkGo;
        // A hungry, lively cat trots to its bowl.
        const mode = kind === "eat" && cat.needs.hunger > 0.8 && t.energy > 0.55 && t.foodie > 0.5 ? "hurry" : "purpose";
        if (near) steps.push(go(back, mode, 0.15, act.reason, { through: true }), { type: "call", fn: () => { act.ignore.add(b.id); } });
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
        if (!canDo(t, "hop") || cat.big) return null; // (a model that can't leap doesn't climb; a big cat leaves the cat trees be)
        const trees = L.TREES.filter((T) => free(T.low.id) && clearOfCats(treeFoot(T, cat), cat));
        if (!trees.length) return null;
        const T = nearest(cat, trees, (x) => treeFoot(x, cat));
        const G = treeFoot(T, cat);
        if (dist(G, cat) > 14 || !reserve(T.low.id, cat)) return null;
        cat.dest = { ...G };
        act.reason = SAY.climbGo;
        const up = { x: T.low.x, y: T.low.y + 0.3, z: T.low.z };
        steps.push(
          go(G, "purpose", 0.12, SAY.climbGo),
          { type: "turn", yaw: yawTo(T.low.x - G.x, T.low.z - G.z), doing: SAY.climb },
          // Now and then a good scratch on the post before going up.
          ...(rnd.chance(0.45) ? [hold("scratch", dur(cat, 2, 3.6), SAY.scratch, { fidget: false })] : []),
          // Eyes on the platform, a little crouch, then up.
          hold("crouch", rnd.range(0.5, 0.9) * tempoOf(cat), SAY.sizeUp, { target: () => up, fidget: false }),
          { type: "hop", x: T.low.x, z: T.low.z, y: T.low.y, air: 0.52 * cat.fr, apex: 0.4, foot: G, doing: SAY.climb, then: () => { cat.perch = { id: T.low.id, ground: G, y: T.low.y }; } },
          hold("sit", dur(cat, 10, 22), SAY.perch, { look: "about", restore: { explore: 0.04 } }),
        );
        if (rnd.chance(0.45 * cat.tune.climber)) steps.push({ type: "upTop", tree: T });
        else if (rnd.chance(0.4)) steps.push(hold("loaf", dur(cat, 10, 20), SAY.perch, { look: "about", restore: { explore: 0.03 } }));
        steps.push({ type: "call", fn: () => { cat.needs.explore = 0.1; } });
        break;
      }
      case "porch": {
        const S = L.STEP;
        if (!canDo(t, "hop") || cat.big || dist(S.ground, cat) > 14 || !reserve(S.id, cat)) return null;
        cat.dest = { ...S.ground };
        act.reason = SAY.porchGo;
        steps.push(
          go(S.ground, "stroll", 0.1, SAY.porchGo),
          { type: "turn", yaw: yawTo(S.x - S.ground.x, S.z - S.ground.z), doing: SAY.porchGo },
          hold("crouch", rnd.range(0.4, 0.6) * tempoOf(cat), SAY.porchGo, { fidget: false }),
          { type: "hop", x: S.x, z: S.z, y: S.y, air: 0.36 * cat.fr, apex: 0.18, doing: SAY.porchGo, then: () => { cat.perch = { id: S.id, ground: S.ground, y: S.y }; } },
          { type: "turn", yaw: S.sitYaw, doing: SAY.porch },
          hold("sit", dur(cat, 14, 30), SAY.porch, { look: "about", restore: { explore: 0.03 } }),
        );
        if (rnd.chance(0.45)) steps.push(hold("loaf", dur(cat, 12, 25), SAY.porch, { look: "about", restore: { sleep: 0.008 } }));
        steps.push({ type: "call", fn: () => { cat.needs.explore = 0.12; } });
        break;
      }
      case "pond": {
        // (a big cat from its own spots, further back: BIG_POND)
        const spots = (cat.big ? BIG_POND : POND_SPOTS).filter((p) => free(p.id) && clearOfCats(p, cat));
        if (!spots.length) return null;
        const p = nearest(cat, spots);
        if (dist(p, cat) > 15 * Math.max(1, cat.fr) || !reserve(p.id, cat)) return null;
        cat.dest = { x: p.x, z: p.z };
        act.reason = SAY.pondGo;
        const reach = 1.3 * Math.max(1, cat.size), water = { x: p.x + Math.cos(p.yaw) * reach, z: p.z - Math.sin(p.yaw) * reach };
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
        if (!y || cat.big || dist(y, cat) > 13 || !canDo(t, "pounce")) return null;
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
            { type: "hop", pounce: true, to: () => y, short: 0.42, y: 0, air: 0.32 * cat.fr, apex: 0.2, doing: SAY.pounce, land: () => bat(cat, y) },
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
        const tries = rnd.int(1, 2), g = Math.max(1, cat.size);
        for (let k = 0; k < tries; k++) {
          steps.push(
            { type: "chase", target: () => b, stopAt: 1.25 * g, mode: k ? "purpose" : "stalk", stalk: !k, until: 7 * cat.fr, doing: SAY.butterfly, endOk: true, giveUpIf: () => b.y > 2.4 * g },
            { type: "face", target: () => b, doing: SAY.wiggle },
            hold("wiggle", rnd.range(0.5, 0.9) * cat.fr, SAY.wiggle, { target: () => b, fidget: false }),
            { type: "hop", pounce: true, to: () => ({ x: b.x, z: b.z }), short: 0.35 * g, y: 0, air: 0.46 * cat.fr, apex: 0.62 * g, reach: true, start: () => critters?.startle?.(b, cat), doing: SAY.leap },
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
        const high = b.y > 0.4, gone = () => b.state !== "perched", g = Math.max(1, cat.size);
        steps.push(
          { type: "chase", target: () => b, stopAt: (high ? 1.0 : 1.5) * g, mode: "creep", stalk: true, until: 10 * cat.fr, doing: SAY.birdGo, endOk: true, giveUpIf: gone, scareAt: 0.9 * g },
          { type: "face", target: () => b, doing: SAY.crouch },
          hold("crouch", rnd.range(0.6, 1.2) * cat.fr, SAY.crouch, { target: () => b, abortIf: gone, fidget: false }),
          hold("wiggle", rnd.range(0.4, 0.8) * cat.fr, SAY.wiggle, { target: () => b, abortIf: gone, fidget: false }),
          { type: "hop", pounce: true, to: () => ({ x: b.x, z: b.z }), short: (high ? 0.55 : 0.5) * g, y: 0, air: 0.42 * cat.fr, apex: (high ? 0.7 : 0.38) * g, reach: true, start: () => critters?.startle?.(b, cat), doing: SAY.swat },
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
        // (cheek to cheek: its body just touching the friend's, both bodies as big as they are drawn (bodyGap);
        // eyes on its head, where its head is: a cheek rub between cats of a size, alike)
        const a = Math.atan2(cat.z - f.z, cat.x - f.x) + rnd.range(-0.5, 0.5);
        let s = null;
        for (let d = 0.5; d <= 2.2; d += 0.05) {
          const x = f.x + Math.cos(a) * d * Math.max(1, f.size), z = f.z + Math.sin(a) * d * Math.max(1, f.size);
          if (bodyGap(cat, x, z, yawTo(f.x - x, f.z - z), "walk", f) >= -NUZZLE) { s = { x, z }; break; }
        }
        if (!s || !cat.nav.pointFree(s.x, s.z, cat.bodyR)) return null;
        act.nuzzle = f; act.mate = f; act.friend = f;
        act.reason = `Saying hello to ${f.name}`;
        cat.dest = s;
        const head = () => ({ x: f.x, y: 0.35 * f.size, z: f.z });
        // (then it settles beside the friend, clear of its body; with no room there, it steps off)
        const settle = rnd.chance(cat.p.loaf) ? "loaf" : "sit", keep = `Keeping ${f.name} company`;
        const fLen = () => ((HALF_LEN[f.pose] || 0.3) > HALF_LEN.walk ? f.pose : "walk");
        const apart = () => { act.nuzzle = null; act.mate = null; };
        const stay = hold(settle, dur(cat, 18, 40), keep, { target: head, restore: { social: 0.03 } });
        // (no room, or stopped short still in its body: a step clear, and it doesn't stay)
        const off = () => { stay.skip = true; const q = besideSpot(cat, f, "walk"); if (q) { act.steps.splice(act.i + 1, 0, go(q, "stroll", 0.08, keep)); cat.dest = q; } };
        const beside = go(s, "stroll", 0.04, keep, { then: () => { if (bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, f, fLen()) > -TOUCH_ARRIVE) apart(); else if (!stay.skip) off(); } });
        // (the friend going off meanwhile: the visit is off)
        const gone = () => f.moving || f.y > 0.3 || !f.act || TRAVEL.has(f.act.steps[f.act.i]?.type), goneNow = () => act.t > 0.3 && gone();
        steps.push(
          go(s, "stroll", 0.08, act.reason, { abortIf: gone, then: () => { f.greetedBy = cat; f.greetUntil = time + 6; } }),
          { type: "face", target: () => f, doing: act.reason },
          hold("greet", dur(cat, 1, 1.6), SAY.greet, { target: head, fidget: false, abortIf: goneNow }),
          hold("headBunt", dur(cat, 1.8, 3.2), `Rubbing cheeks with ${f.name}`, { target: head, restore: { social: 0.15 }, fidget: false, abortIf: goneNow }),
          { type: "call", fn: () => { const p = besideSpot(cat, f, settle === "loaf" ? "loaf" : "sit"); if (p) { beside.x = p.x; beside.z = p.z; cat.dest = p; } else { beside.skip = true; off(); } } },
          beside,
          stay,
          { type: "call", fn: () => { apart(); cat.needs.social = 0.08; if (f.greetedBy === cat) f.greetedBy = null; } },
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
        // (a big cat patrols further, its strides longer)
        const g = cat.fr, s = randomSpot(rnd, cat, rnd.chance(0.8) ? { near: cat, min: 2.2 * g, max: 6.5 * g } : { near: cat, min: 5 * g, max: 11 * g }) || randomSpot(rnd, cat, { near: cat, min: 1.5 * g, max: 8 * g });
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
    // (either of them up on a perch hops down first: a runner that set off from the top of a cat tree ran
    // about the lawn at the tree's height)
    run.steps.push(
      ...leavePerch(runner),
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
      ...leavePerch(chaser),
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
    if (a.friend && a.friend.greetedBy === cat) a.friend.greetedBy = null;
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
    const act = cat.act, nav = cat.nav, g = Math.max(1, cat.size), f = cat.fr;
    // (A big cat arrives, and is near, by its own size.)
    arrive *= g;
    // (Re)plan when the target has moved away from the route's end, or on request.
    if (!cat.route || Math.hypot(cat.route.goal.x - tx, cat.route.goal.z - tz) > 0.6 * g || cat.route.stale) {
      // Standing in the clearance of a prop it has no business in (nudged there by another cat), it
      // first steps straight back out of it: a route from in there would run through the prop.
      let sx = cat.x, sz = cat.z, out = null;
      // (merely beside something solid, no nearer than bodyR, it just sets off)
      if (nav.containing(sx, sz).some((id) => !(ignore && ignore.has(id)) && (USABLE.has(id) || distToObstacle(nav.byId.get(id), sx, sz) < cat.bodyR - 0.02))) {
        const q = { x: sx, z: sz };
        nav.project(q, ignore, nav.clearR + 0.03);
        // (A long cat alongside the prop walks out along a heading it can turn to (outAlong): turned to step straight
        // out, end on to the prop, its hindquarters would be in it.)
        const A = cat.size >= LONG && outAlong(cat, ignore);
        if (A) { q.x = A.x; q.z = A.z; }
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
      // (A long cat that can't turn onto its way's first leg either way round, a prop at its flank: it walks out
      // first along a heading it can turn to.)
      if (!out && cat.size >= LONG && pts.length && !turnFree(cat, yawTo(pts[0].x - sx, pts[0].z - sz), ignore)) { const A = outAlong(cat, ignore); if (A) { out = A; pts = nav.route(A.x, A.z, tx, tz, ignore) || pts; } }
      if (out) pts.unshift(out);
      cat.route = { pts, i: 0, out: !!out, goal: { x: tx, z: tz }, check: 0, best: Infinity, bestAt: time, replans: (cat.route?.replans || 0), rx: NaN, rz: NaN, qx: tx, qz: tz };
    }
    const R = cat.route;
    // The target itself kept clear of props (worked out again only when it moves).
    if (tx !== R.rx || tz !== R.rz) {
      const q = { x: tx, z: tz };
      nav.project(q, ignore, cat.bodyR + 0.02);
      R.rx = tx; R.rz = tz; R.qx = q.x; R.qz = q.z;
      R.pts[R.pts.length - 1] = q;
    }
    tx = R.qx; tz = R.qz;
    const last = R.pts.length - 1;
    let wp = R.pts[R.i];
    if (R.i < last && Math.hypot(wp.x - cat.x, wp.z - cat.z) < (R.out && R.i === 0 ? 0.08 : 0.35 * g)) { R.i++; wp = R.pts[R.i]; }
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
    if (d0 < arrive + (going ? 0.01 : SHUFFLE * g) && (!going || shown >= 0.3 * f || through)) return "arrived";
    R.arrive = arrive; // (for the stall check: how near is near enough)
    if (R.closeEnough && d0 < arrive + CLOSE_ENOUGH * g + 1e-6 && (!going || shown >= 0.3 * f)) return "arrived";

    // Progress check: a cat that makes no headway for a while gives up on this route. On the last
    // stretch (a bowl, a stand, a spot beside another cat) it gives up sooner: waiting there looks stuck.
    const close = d0 < 1.6 * g;
    if (d0 < R.best - 0.15 * g) { R.best = d0; R.bestAt = time; }
    else if (time - R.bestAt > (close ? 1.5 : 3.2) * f) {
      if (R.replans >= (close ? 1 : 2)) return "stuck";
      R.stale = true; R.replans++; R.bestAt = time;
    }
    const sprint = vmax >= RUN_MIN * f - 1e-6;
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
      if (time > D.until || Math.hypot(D.x - cat.x, D.z - cat.z) < 0.3 * g) cat.detour = null;
      else { dx = D.x - cat.x; dz = D.z - cat.z; }
    }
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    // Personal space: ease away from other cats nearby, more from ones lying still; one lying in its path
    // ahead it passes beside, in good time (by size: a big cat is passed wider, seen from further off).
    const look = 1.3, my = cat.size;
    let block = null, blockAhead = Infinity, blockLat = 0;
    for (const o of cats) {
      if (o === cat || o.y > 0.3) continue;
      // (a big cat sees one lying in its way further off, by its own length: it needs the room to swing its body round it)
      const k = (my + o.size) * 0.5, lk = look * k + (my > 1 ? 2 * (HALF_LEN.walk + BODY) * (my - 1) : 0), room = L.CAT.personal * k;
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
    // Standing, about to set off straight into another cat's body: it goes round it if it can, else waits on
    // a moment, and after a while of that gives up the walk (no step into it and back, over and over).
    if (cat.speed < 0.05) {
      // (stepping out from against another cat, that one's body doesn't hold it back: it is leaving it;
      // squeezing out of a knot of cats, no standing one does (a sitting or lying cat is never walked through))
      const skip = D && D.escape ? D.from : step.escapeFrom || null, ghost = !!(D && D.ghost);
      const ahead = bodyAhead(cat, dx, dz, act, skip, ghost);
      let o = ahead || turnBlocked(cat, yawTo(dx, dz), act, skip, ghost) || propAhead(cat, dx, dz, ignore);
      if (o) {
        if (!D && o !== true && !o.moving) {
          // (The way round only if its first steps are clear too; standing in the other's body
          // already, first a step out of it.)
          const A = bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, o) < -0.05 ? clearSpot(cat, o, "walk") : aside(cat, o);
          if (A) { const ax = A.x - cat.x, az = A.z - cat.z; if (!bodyAhead(cat, ax, az, act) && !propAhead(cat, ax, az, ignore)) { cat.detour = { x: A.x, z: A.z, until: time + 3 }; dx = ax; dz = az; o = null; } }
        }
        // (Waited a moment already and still hemmed in, or in another cat's body: it steps out, away from the
        // one it is pressed against, to the first clear spot tried round that way, as a cat squeezes out of a
        // tight spot. Jammed in a knot of cats a few seconds, it squeezes out between the standing ones (stepOut).)
        if (o) {
          const jam = (cat.jamT || 0) > 1.4;
          if (!(D && D.escape) || (jam && !D.ghost)) {
            // (hemmed in beside one a while, it steps off from it; but not back from one standing or resting in its way
            // ahead, not in its body: it goes round, waits, has a small one move over, or gives up (no pacing to and fro))
            const E = stepOut(cat, o, act, ignore, (R.waited || 0) >= 0.9 && o !== ahead, jam);
            if (E) { cat.detour = E; dx = E.x - cat.x; dz = E.z - cat.z; o = null; if (E.ghost) cat.jamT = 0; }
          }
          if (o) cat.jamT = inBody(cat) ? (cat.jamT || 0) + WAIT_ON : 0;
        }
        if (o) {
          // (Stalking its prey, a prop in the way (a flower bed, a cat bed): it has come as near as it can, and stops
          // short of it there, rather than wait for a way round.)
          if (o === true && step.type === "chase" && step.stalk) return "arrived";
          // (Up against a prop, it finds its way again from where it stands.)
          if (o === true) { R.stale = true; R.replans = (R.replans || 0) + 1; }
          // (A cat resting in a big cat's way, a third of its size or less, gets up and moves over once it has kept
          // it waiting a moment, as a house cat makes way for a lion: a lion alongside a bed can't turn round.)
          else if (!o.moving && cat.size >= 1.5 * o.size && (R.waited || 0) >= 0.9) makeRoom(o, cat);
          R.waited = (R.waited || 0) + WAIT_ON;
          if (R.waited > 3 || R.replans > 3) return "stuck";
          cat.waitUntil = time + WAIT_ON; cat.doing = SAY.wait;
          return "moving";
        }
      }
    }
    const want = yawTo(dx, dz);
    // (A long cat whose turn on the spot a prop took back, its hindquarters swinging into it, turns the other
    // way round, the long way, as a cat backed up against something does.)
    let aim = want;
    if (cat.turnFlip) { const l0 = wrapAngle(want - cat.yaw); if (Math.sign(l0) === cat.turnFlip && Math.abs(l0) > 0.3) aim = cat.yaw - cat.turnFlip * 1.2; else cat.turnFlip = 0; }
    const yaw0 = cat.yaw, l1 = turnToward(cat, aim, (step.turn || (sprint ? TURN.zoom : TURN.walk)) / f, dt), left = aim === want ? l1 : wrapAngle(want - cat.yaw);
    // How fast it would like to go: slower into a sharp turn (a walking cat all but stops and
    // steps round; a sprinting one banks round instead), braking to a stop at the goal unless
    // the leg runs on into the next, and a short hop taken in slow steps, not a blip.
    const c = Math.cos(Math.min(Math.abs(left), Math.PI / 2));
    let v = sprint ? Math.max(RUN_FLOOR * f, vmax * Math.max(0.72, c)) : vmax * c;
    if (!through && R.i === last) {
      const brake = sprint ? BRAKE_RUN : BRAKE, vb = Math.sqrt(2 * brake * Math.max(0, d0 - arrive));
      if (vb < v) { v = vb; cat.brakeT = cat.speed / brake; }
    }
    // Never a creep: a short way is stepped at a walk, not inched (and, going on, a cat that is not
    // stepping round a sharp turn on the spot walks at least V_MIN, right to its last step).
    const vmin = Math.min(vmax, (cat.stalk ? V_MIN_STALK : V_MIN) * f), minMove = MIN_MOVE * f;
    if (!through && shown < minMove) v = Math.min(v, Math.max(vmin, (d0 - arrive) / (minMove - shown)));
    if (!sprint && v < vmin && Math.abs(left) < 0.35 && (through || d0 > arrive)) v = vmin;
    ease(cat, v, dt, sprint);
    cat.wantV = v;
    if (sprint && v > cat.speed) cat.runIntent = true;
    advance(cat, dt);
    // (a turn sharp enough to see is stepped, not made standing or getting up)
    if (cat.speed < 0.25 * f && (Math.abs(left) > 0.2 || Math.abs(wrapAngle(cat.yaw - yaw0)) > 0.45 * dt)) cat.pivoting = true;
    return "moving";
  }

  /** Slowing to a stop where it is going (in the gait it is in: no last-moment change of step). */
  function pullUp(cat, dt) {
    const sprint = cat.speed > WALK_MAX * cat.fr;
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
      at (x, z), facing `yaw`, in the shared pose `pose`; null if none (its pile mates aside).
      Every other cat's body counts at least at its walking length: one sitting or curled up beside
      the spot will stand up there, and needs the room. */
  function crowding(cat, x, z, yaw, pose, room = 0) {
    const h = (HALF_LEN[pose] || 0.3) * cat.size, fx = Math.cos(yaw) * h, fz = -Math.sin(yaw) * h;
    for (const o of cats) {
      if (o === cat || o.y > 0.3 || o.perch || samePile(cat, o)) continue;
      const reach = 0.8 * (cat.size + o.size) + room;
      if (Math.abs(o.x - x) > reach || Math.abs(o.z - z) > reach) continue;
      const oh = Math.max(HALF_LEN[bigPose(o)] || 0.3, HALF_LEN.walk) * o.size, ox = Math.cos(o.yaw) * oh, oz = -Math.sin(o.yaw) * oh;
      const cp = closestPoints(x - fx, z - fz, x + fx, z + fz, o.x - ox, o.z - oz, o.x + ox, o.z + oz);
      if (Math.hypot(cp[2] - cp[0], cp[3] - cp[1]) < BODY * (cat.size + o.size) + room) return o;
    }
    return null;
  }

  /** The cat (passing, or standing there) whose body this one's would be in if it stood up (or woke and lay out:
      its body at `pose`'s length) where it sits or lies, when it is not in it already (null if none). (One it
      is in already, it gets up and steps out of: waiting there on each other, the two would stay so.) */
  function risesInto(cat, pose = "walk", up = true) {
    for (const o of cats) {
      // (a visitor too: the cheek rub ends first; a pile mate it may touch)
      if (o === cat || o.y > 0.3 || o.perch) continue;
      const deep = samePile(cat, o) ? TOUCH : 0.06;
      if (Math.abs(o.x - cat.x) > 0.8 * (cat.size + o.size) || Math.abs(o.z - cat.z) > 0.8 * (cat.size + o.size)) continue;
      const op = bigPose(o);
      const gUp = bodyGap(cat, cat.x, cat.z, cat.yaw, pose, o, op), gNow = bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, o, op);
      // (one it is in already, no further, but to move over: makeRoom)
      if (gUp < -deep && (gNow > -deep || (!(up && cat.act && cat.act.room) && gUp < gNow - 0.03))) return o;
    }
    return null;
  }

  /** Whether a cat in the air lands where `cat`, landing at (x, z), would be in its body. */
  function landsNear(cat, x, z) {
    for (const o of cats) {
      if (o === cat || !airborne(o)) continue;
      const st = o.act.steps[o.act.i];
      if (st.x != null && st.from && Math.abs(st.y || 0) < 0.3 && Math.hypot(st.x - x, st.z - z) < (HALF_LEN.walk + BODY) * (cat.size + o.size) + 0.06) return true;
    }
    return false;
  }
  /** The cat a standing cat would stretch out (to `pose`) further into. */
  function growsInto(cat, pose) {
    for (const o of cats) {
      if (o === cat || o.y > 0.3 || o.perch || Math.abs(o.x - cat.x) > 0.8 * (cat.size + o.size) || Math.abs(o.z - cat.z) > 0.8 * (cat.size + o.size)) continue;
      const op = bigPose(o), gUp = bodyGap(cat, cat.x, cat.z, cat.yaw, pose, o, op);
      if (gUp < -KEEP_OUT && gUp < bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, o, op) - 0.02) return o;
    }
    return null;
  }
  /** Where a cat in another's body (the one it is most in), or pressed against `o` a while (`waited`), steps out to: away
      from it, or up to 90 degrees either side of that, 0.7 of a body on, the first such spot that is clear
      of props and of every other cat's body; null if none. The detour it makes of it (`escape`, `from`). */
  /** Whether a cat is in another's body (more than a brush). */
  /** How far apart two cats' centres can be with their bodies (at their longest) still touching: the
      window the body checks look in (a lion's reaches much further than a house cat's). */
  const reachOf = (a, b) => 0.8 * (a.size + b.size);
  function inBody(cat) {
    for (const c of cats) { if (c !== cat && c.y <= 0.3 && !c.perch && !together(cat, c) && Math.abs(c.x - cat.x) < reachOf(cat, c) && Math.abs(c.z - cat.z) < reachOf(cat, c) && bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, c, bigPose(c)) < -0.05) return true; }
    return false;
  }
  function stepOut(cat, o, act, ignore, waited, force = false) {
    let from = null, worst = -0.05;
    for (const c of cats) {
      if (c === cat || c.y > 0.3 || c.perch || together(cat, c) || Math.abs(c.x - cat.x) > reachOf(cat, c) || Math.abs(c.z - cat.z) > reachOf(cat, c)) continue;
      const g = bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, c, bigPose(c));
      if (g < worst) { worst = g; from = c; }
    }
    // (A big cat, or one beside a big cat, not in its body but hemmed in beside it a while, unable to
    // turn or step off without swinging into it: it steps off away from that one.)
    if (!from) { if (!waited || !o || o === true || !(cat.big || o.big)) return null; from = o; }
    // (straight on the way it faces first, if that leads away from the other: no turning round inside
    // its body; but not along it, which takes it out slowly)
    const base = Math.atan2(cat.z - from.z, cat.x - from.x), k = 0.7 * Math.max(1, cat.size), head = Math.atan2(-Math.sin(cat.yaw), Math.cos(cat.yaw));
    const ways = Math.cos(head - base) > 0.5 ? [head, base] : [base];
    const ign = withContaining(ignore, cat), N = cat.nav;
    // (a spot as near a prop as its body goes; a prop whose berth it stands in already doesn't bar the way off;
    // and round as far as sideways-and-back: pinned between a prop and a cat, straight out is into the prop)
    for (const a of [...ways, base + 0.5, base - 0.5, base + 1, base - 1, base + 1.5, base - 1.5, base + 2, base - 2]) {
      const x = cat.x + Math.cos(a) * k, z = cat.z + Math.sin(a) * k;
      if (!N.pointFree(x, z, cat.bodyR, bowlsKept(act && act.ignoreNow)) || !N.segmentClear(cat.x, cat.z, x, z, ign, cat.bodyR)) continue;
      const yaw = Math.atan2(-(z - cat.z), x - cat.x);
      let clear = true;
      for (const c of cats) { if (c === cat || c === from || c.y > 0.3 || c.perch || samePile(cat, c) || Math.abs(c.x - x) > reachOf(cat, c) || Math.abs(c.z - z) > reachOf(cat, c)) continue; if (bodyGap(cat, x, z, yaw, "walk", c) < (force && c.posture === "stand" ? -0.08 : 0.02)) { clear = false; break; } }
      // (and a way it can set off on: the step's first stride and the turn onto it clear of every body but
      // the one it leaves, as the walk itself will find them; a spot clear at the end of a way that brushes
      // a sleeper on the way would only be waited at, over and over)
      if (!clear || bodyAhead(cat, x - cat.x, z - cat.z, act, from, force) || turnBlocked(cat, yawTo(x - cat.x, z - cat.z), act, from, force) || propAhead(cat, x - cat.x, z - cat.z, ignore)) continue;
      if (bodyGap(cat, x, z, yaw, "walk", from) > bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, from) + 0.05) return { x, z, until: time + 2.5, escape: true, from, ghost: force };
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
      const op = bigPose(o), g = bodyGap(cat, cat.x, cat.z, yaw, cat.pose, o, op);
      if (g < -0.02 && g < bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, o, op) - 0.01) return o;
    }
    return null;
  }

  /** Room to turn round on the spot before lying down (its body swinging right round) clear of every cat. */
  function roomToTurn(cat) {
    for (const o of cats) {
      const w = 3 * Math.max(1, (cat.size + o.size) * 0.5);
      if (o === cat || o.y > 0.3 || o.perch || together(cat, o) || Math.abs(o.x - cat.x) > w || Math.abs(o.z - cat.z) > w) continue;
      if (Math.hypot(o.x - cat.x, o.z - cat.z) < (HALF_LEN.walk + BODY) * cat.size + 0.25 + ((HALF_LEN[o.pose] || 0.3) + BODY) * o.size) return false;
    }
    return true;
  }

  /** Whether a long cat can turn on the spot from its heading round to `want`, one way or the other, without its body
      going further into a prop than a brush and than it is. */
  function turnFree(cat, want, ignore) {
    const ign = withContaining(ignore, cat), bank = onBank(cat, cat.x, cat.z), g0 = Math.max(PROP_BRUSH, propDepth(cat, cat.x, cat.z, cat.yaw, cat.pose, ign, bank)) + 1e-3;
    const left = wrapAngle(want - cat.yaw);
    for (const way of [Math.sign(left) || 1, -(Math.sign(left) || 1)]) {
      const arc = way === Math.sign(left) ? Math.abs(left) : Math.PI * 2 - Math.abs(left);
      let ok = true;
      for (let a = 0.15; a < arc + 0.15; a += 0.15) if (propDepth(cat, cat.x, cat.z, cat.yaw + way * Math.min(a, arc), "walk", ign, bank) > g0) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }
  /** Where a long cat hemmed in by a prop at its flank walks out to: along a heading it can turn to (either way round from
      its own, no further into the prop), the nearest spot clear of the route-finder's berth, reached without its body
      going further in on the way; null if none. */
  function outAlong(cat, ignore) {
    const N = cat.nav, g = Math.max(1, cat.size), ign = withContaining(ignore, cat), bank = onBank(cat, cat.x, cat.z);
    const g0 = Math.max(PROP_BRUSH, propDepth(cat, cat.x, cat.z, cat.yaw, cat.pose, ign, bank)) + 1e-3;
    let best = null, score = Infinity;
    for (const way of [1, -1]) {
      for (let a = 0; a <= Math.PI + 1e-6; a += 0.3) {
        const yaw = cat.yaw + way * a;
        if (propDepth(cat, cat.x, cat.z, yaw, "walk", ign, bank) > g0) break; // (it can turn no further this way)
        const fx = Math.cos(yaw), fz = -Math.sin(yaw);
        for (let d = 0.3 * g; d <= 2.2 * g; d += 0.15 * g) {
          if (propDepth(cat, cat.x + fx * (d - 0.15 * g), cat.z + fz * (d - 0.15 * g), yaw, "walk", ign, bank) > g0) break;
          const x = cat.x + fx * d, z = cat.z + fz * d;
          if (N.pointFree(x, z, N.clearR + 0.02, ignore) && propDepth(cat, x, z, yaw, "walk", ign, bank) <= g0) { const sc = d + a * g; if (sc < score) { score = sc; best = { x, z }; } break; }
        }
      }
    }
    return best;
  }

  /** True when a standing cat's first steps in direction (dx, dz) run into a prop (the hard check would stop it). */
  function propAhead(cat, dx, dz, ignore) {
    const g = Math.max(1, cat.size), N = cat.nav, l = Math.hypot(dx, dz) || 1, x = cat.x + (dx / l) * 0.25 * g, z = cat.z + (dz / l) * 0.25 * g;
    const ign = withContaining(ignore, cat);
    // (walking out of a prop it is in (walkOut): that prop doesn't hold it back)
    if (cat.act && cat.act.steps[cat.act.i]?.escapeOut && solidDepth(cat, landIgnore(ign)) > 0) return false;
    // (a long cat: its own body, as the hard check keeps it: further into a prop than a brush and than it is)
    if (cat.size >= LONG) { const bank = onBank(cat, cat.x, cat.z); return propDepth(cat, x, z, yawTo(dx, dz), "walk", ign, bank) > Math.max(PROP_BRUSH, propDepth(cat, cat.x, cat.z, cat.yaw, cat.pose, ign, bank)) + 0.01; }
    if (N.segmentClear(cat.x, cat.z, x, z, ign, cat.bodyR)) return false;
    // (Inside a prop's clearance already, only a step further into the prop itself counts.)
    const p = { x, z };
    if (!N.project(p, ignore, cat.bodyR)) return false;
    const d1 = Math.hypot(p.x - x, p.z - z);
    if (d1 <= 0.12 * g) return false;
    const q = { x: cat.x, z: cat.z };
    N.project(q, ignore, cat.bodyR);
    return d1 > Math.hypot(q.x - cat.x, q.z - cat.z) - 0.05;
  }

  /** A spot a short step (`far` times) from `o` where `cat` can settle in `pose` clear of every cat, or null. */
  function clearSpot(cat, o, pose, far = 1) {
    const away = Math.atan2(cat.z - o.z, cat.x - o.x), rnd = cat.rnd, big = bigRoom(cat, o);
    for (let t = 0; t < 12; t++) {
      // (off out of a big cat's reach, when one of the two is big)
      const a = away + rnd.range(-1.2, 1.2), d = big ? rnd.range(0.55, 1.05 * far) * big : rnd.range(0.35, 1.1 * far) * (cat.size + o.size) * 0.5;
      const x = cat.x + Math.cos(a) * d, z = cat.z + Math.sin(a) * d;
      if (!cat.nav.pointFree(x, z, cat.nav.clearR, bowlsKept(cat.act && cat.act.ignoreNow)) || (big && tooNearBig(cat, x, z))) continue;
      if (!crowding(cat, x, z, Math.atan2(-(z - cat.z), x - cat.x), pose, 0.08) && !crowding(cat, x, z, Math.atan2(-(z - cat.z), x - cat.x), "walk", 0.02) && pathOk(cat, x, z, o)) return { x, z };
    }
    return null;
  }

  /** A spot beside `f` for this cat to settle in (`pose`), its body just clear of f's (and of every other
      cat's, props too, and reached without passing over one): of the ways round f, the nearest to where it
      stands; null if none. */
  function besideSpot(cat, f, pose) {
    if (f.perch || f.y > 0.3 || cat.perch) return null;
    let best = null, bd = Infinity;
    // (clear of the friend at its standing length: either may get up)
    const fp = (HALF_LEN[f.pose] || 0.3) > HALF_LEN.walk ? f.pose : "walk";
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      for (let d = 0.35; d <= 1.6; d += 0.05) {
        // (clear whichever way it ends up facing: it may come round a detour to it, and turn as it settles)
        const x = f.x + Math.cos(a) * d * Math.max(1, f.size, cat.size), z = f.z + Math.sin(a) * d * Math.max(1, f.size, cat.size), yaw = yawTo(f.x - x, f.z - z);
        let g = Infinity; for (let q = 0; q < 8; q++) g = Math.min(g, bodyGap(cat, x, z, yaw + (q * Math.PI) / 8, pose, f, fp), bodyGap(cat, x, z, yaw + (q * Math.PI) / 8, "walk", f, fp) + 0.03);
        if (g < 0.01) continue;
        if (g > 0.2) break;
        if (cat.nav.pointFree(x, z, cat.bodyR, bowlsKept(cat.act && cat.act.ignoreNow)) && cat.nav.segmentClear(cat.x, cat.z, x, z, withContaining(cat.act && cat.act.ignoreNow, cat), cat.bodyR) && ![0, 1, 2, 3].some((q) => crowdingBut(cat, x, z, yaw + (q * Math.PI) / 4, pose, f)) && pathOk(cat, x, z, f)) {
          const dd = Math.hypot(x - cat.x, z - cat.z); if (dd < bd) { bd = dd; best = { x, z }; }
        }
        break;
      }
    }
    return best;
  }
  /** As crowding, not counting `skip`. */
  function crowdingBut(cat, x, z, yaw, pose, skip) {
    for (const o of cats) {
      if (o === cat || o === skip || o.y > 0.3 || o.perch || samePile(cat, o)) continue;
      if (Math.abs(o.x - x) > 2 * Math.max(1, (cat.size + o.size) * 0.5) || Math.abs(o.z - z) > 2 * Math.max(1, (cat.size + o.size) * 0.5)) continue;
      if (bodyGap(cat, x, z, yaw, pose, o) < 0.02 || bodyGap(cat, x, z, yaw, "walk", o) < -0.04) return o;
    }
    return null;
  }

  /** An activity's props to ignore, less its bowl or water dish: a spot to step clear to, or to settle in, is
      never in a bowl (a cat that had eaten stepped clear of another into its own bowl, and sat down in it). */
  const bowlsKept = (ignore) => (ignore ? new Set([...ignore].filter((id) => !RIM_OF.has(id))) : ignore);

  /** Whether the straight way from where a cat stands to (x, z) keeps its body out of every still cat's (one
      it is against already, no further in) but `skip`'s, the one it goes round or leaves: a way round one, or
      out of a crowd, that passes over a sleeper beside it would be walked (a detour is followed without
      looking) and then waited on inside its body. */
  function pathOk(cat, x, z, skip = null) {
    // (looking as far round as the way and the two bodies reach)
    const w = Math.hypot(x - cat.x, z - cat.z);
    for (const o of cats) {
      const r = Math.max(2.5, w + reachOf(cat, o));
      if (o === cat || o === skip || o.moving || o.y > 0.3 || o.perch || together(cat, o) || Math.abs(o.x - cat.x) > r || Math.abs(o.z - cat.z) > r) continue;
      const g0 = bodyGap(cat, cat.x, cat.z, cat.yaw, cat.pose, o);
      if (pathGap(cat, cat.x, cat.z, x, z, o) < Math.min(0, g0) - 0.03) return false;
    }
    return true;
  }

  /** The cat whose body this one (standing) would walk straight into with its next step or so in
      direction (dx, dz), if any (not the one it follows or plays with). */
  function bodyAhead(cat, dx, dz, act, skip = null, standOk = false) {
    const l = Math.hypot(dx, dz) || 1, h = HALF_LEN.walk * cat.size, fx = Math.cos(cat.yaw) * h, fz = -Math.sin(cat.yaw) * h, ax = cat.x + (dx / l) * 0.12, az = cat.z + (dz / l) * 0.12;
    for (const o of cats) {
      if (o === cat || o === skip || (standOk && o.posture === "stand") || o.y > 0.3 || o.perch || (act && (act.lead === o || act.mate === o || act.nuzzle === o))) continue;
      const reach = 0.8 * (cat.size + o.size) + 0.15;
      if (Math.abs(o.x - cat.x) > reach || Math.abs(o.z - cat.z) > reach) continue;
      const oh = (HALF_LEN[bigPose(o)] || 0.3) * o.size, ox = Math.cos(o.yaw) * oh, oz = -Math.sin(o.yaw) * oh, min = BODY * (cat.size + o.size);
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
      if (!cat.nav.pointFree(x, z, cat.bodyR + 0.05, bowlsKept(ignore)) || !cat.nav.segmentClear(cat.x, cat.z, x, z, withContaining(ignore, cat), cat.bodyR)) continue;
      let clear = true;
      for (const o of cats) { const r = 0.6 * (cat.size + o.size) * 0.5; if (o !== cat && o !== b && Math.abs(o.x - x) < r && Math.abs(o.z - z) < r) { clear = false; break; } }
      if (!clear || !pathOk(cat, x, z, b)) continue;
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
    // (A big cat is never in a prop it may stay in (no beds, no bowls): pushed near one, it is pushed
    // back out of it, never let into it.)
    if (cat.big) return s;
    // (by its body's reach, not its route-finder's clearance: a big cat merely near a post is not let into it)
    // (Only what a cat uses (USABLE; for a long cat, not its tree's foot): let into the pond or a vegetable bed it
    // stood in as a step began, a cat stayed there a minute and more.)
    for (const id of cat.nav.containing(cat.x, cat.z, Math.min(cat.nav.clearR, cat.bodyR + 0.12))) { if (!USABLE.has(id) || (cat.size >= LONG && TREE_FOOT.has(id))) continue; const b = RIM_OF.get(id); if (!b || Math.hypot(cat.x - b.x, cat.z - b.z) < b.r + 0.2) s.add(id); }
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
    // (a step found not to be taken)
    if (step.skip && !act.started) { act.i++; return true; }
    // (In the water or a solid prop: out of it first.)
    if (walkOut(cat, act, step)) return true;
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
        // (Sitting or lying down in another cat's body, or where it couldn't stand up again clear of one: it
        // steps clear first, checked again wherever it gets to. And not within a big cat's reach, nor a big
        // cat within a house cat's (tooNearBig): one step off for that, not a dance.)
        if (cat.posture === "stand" && step.type === "hold" && !cat.perch) {
          const body = crowding(cat, cat.x, cat.z, cat.yaw, POSTURE_POSE[want], -0.04) || crowding(cat, cat.x, cat.z, cat.yaw, "walk", -0.04);
          const o = body || (step.bigRoomed ? null : tooNearBig(cat));
          if (o) {
            if (!body) step.bigRoomed = true;
            const n = (step.roomTries = (step.roomTries || 0) + 1), s = n <= 3 && clearSpot(cat, o, POSTURE_POSE[want], n > 1 ? 2 : 1);
            if (s) { cat.dest = s; act.steps.splice(act.i, 0, go(s, "stroll", 0.1, step.doing || act.reason)); return true; }
            // (nowhere clear: it stands a moment; still no room, it does something else)
            if (body && n <= 6) { act.steps.splice(act.i, 0, hold("stand", 0.6, step.doing || act.reason, { fidget: false })); return true; }
            if (body) return abortAct(cat);
          }
        }
        // (Getting up, or waking and stretching out, where its longer body (at its longest on the way, a stretch
        // further still) would be in another cat's: it stays as it is a while, for the other to move on.)
        let upPose = step.type === "hold" ? POSE_OF[step.action] || POSTURE_POSE[want] : POSTURE_POSE[want];
        for (const name of transitionPath(cat.posture, want)) { const p = POSTURE_POSE[ACTIONS[name].to]; if ((HALF_LEN[p] || 0) > (HALF_LEN[upPose] || 0)) upPose = p; }
        if (!cat.perch && (HALF_LEN[upPose] || 0.3) > (HALF_LEN[cat.pose] || 0.3) + 0.03) {
          const o = risesInto(cat, upPose, want === "stand");
          // (one standing there is asked to move over; kept waiting, it gives up)
          if (o) {
            if ((step.rise = (step.rise || 0) + 1) > RISE_WAITS) return abortAct(cat);
            if (o.posture === "stand" && time - o.motion.since > 0.6) makeRoom(o, cat);
            act.steps.splice(act.i, 0, hold(POSTURE_LOOP[cat.posture], 0.8, step.doing || act.reason, { fidget: false }));
            return true;
          }
        }
        const path = transitionPath(cat.posture, want);
        if (path.length) {
          act.steps.splice(act.i, 0, ...path.map((name) => ({ type: "trans", name, dur: transFor(cat, name), doing: step.doing })));
          return true;
        }
      }
      // (Standing, it doesn't stretch out (a stretch, a crouch, a wiggle) into a cat: it stands instead.)
      // (A long cat not into a prop either: a lion crouched to pounce beside a cat bed had its chest in it.)
      if (step.type === "hold" && cat.posture === "stand" && !cat.perch && (HALF_LEN[POSE_OF[step.action]] || 0) > (HALF_LEN[cat.pose] || 0.3) + 0.03
        && (growsInto(cat, POSE_OF[step.action]) || (cat.size >= LONG && propDepth(cat, cat.x, cat.z, cat.yaw, POSE_OF[step.action], act.ignoreNow, onBank(cat, cat.x, cat.z)) > Math.max(PROP_BRUSH, propDepth(cat, cat.x, cat.z, cat.yaw, cat.pose, act.ignoreNow, onBank(cat, cat.x, cat.z))) + 1e-3))) {
        if (ACTIONS[step.action].kind === "once") { step.skip = true; return true; }
        step.action = allowedAction(cat.traits, "stand"); step.fidget = false;
      }
      // (Hopping down onto a spot a cat has settled on since: another clear spot by the perch's foot, looking
      // further round the longer it waits; never onto a cat: it waits up there as long as it takes.)
      const downBusy = (x, z) => crowding(cat, x, z, yawTo(x - cat.x, z - cat.z), "walk", 0.05) || landsNear(cat, x, z);
      if (step.type === "hop" && step.down && downBusy(step.x, step.z)) {
        const g = step.down.ground, far = Math.min(1.5, 1 + 0.05 * (step.waits || 0));
        for (let k = 0; k < 16; k++) {
          const a = cat.rnd.range(0, Math.PI * 2), d = cat.rnd.range(0.45, far), q = { x: g.x + Math.cos(a) * d, z: g.z + Math.sin(a) * d };
          if (cat.nav.pointFree(q.x, q.z, cat.nav.clearR) && cat.nav.segmentClear(g.x, g.z, q.x, q.z, null, cat.bodyR) && !downBusy(q.x, q.z)) { step.x = q.x; step.z = q.z; break; }
        }
        if (downBusy(step.x, step.z)) {
          step.waits = (step.waits || 0) + 1;
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
        // (its last frame, u = 1, shown for a tick first: never cut short of its end)
        if (act.t >= step.dur) { if (!step.ended) { step.ended = true; break; } cat.posture = ACTIONS[step.name].to; return nextStep(act, step); }
        break;
      }
      case "go": {
        if (step.abortIf && step.abortIf()) return abortAct(cat);
        cat.wa = "move"; cat.lookOn = false;
        const r = walk(cat, step, step.x, step.z, dt, speedOf(cat, step.mode), step.arrive, act.ignoreNow, !!step.through);
        if (r === "arrived") { cat.route = null; return nextStep(act, step); }
        if (r === "stuck") { if (cat.big) cat.hemmedUntil = time + HEMMED; return abortAct(cat); }
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
        if (r === "stuck") { if (cat.big) cat.hemmedUntil = time + HEMMED; return abortAct(cat); }
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
            // (a hunter that can't turn to face its prey doesn't wiggle and leap at it: it watches it get away)
            if (diff > 0.6 && act.prey) { skipTo(act, cat); return true; }
            return nextStep(act, step);
          }
          // (a big cat turns round on the spot more slowly: gaitScale)
          step.rate = Math.min(step.type === "face" ? TURN.still * 1.5 : TURN.still, Math.max(0.7, diff / 0.45)) / cat.fr;
        }
        cat.wa = "move"; cat.speed = 0; cat.moving = false;
        if (step.target) setLook(cat, step.target()); else cat.lookOn = false;
        // Turning on the spot, a few small steps round; a cat that has only just stopped stands its moment first.
        if (time < cat.stopUntil) break;
        // Round (the last of it turned last tick: what follows starts in a tick with no turn in it,
        // so a cat never sits down or lies down while its body is still turning); or its body up
        // against another's, it can turn no further: it faces as near as it got.
        if (Math.abs(wrapAngle(want - cat.yaw)) < 0.03 || act.t > 3 || ((cat.held > 0.7 || cat.heldProp > 0.7) && act.t > 0.05)) {
          if (step.target) act.faceTarget = step.target;
          if (Math.abs(wrapAngle(want - cat.yaw)) > 0.6 && act.prey) { skipTo(act, cat); return true; }
          return nextStep(act, step);
        }
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
          // (Up its cat tree: nudged in nearer the tree's foot since, it goes back to its spot first.)
          if (step.foot && (step.backs || 0) < 2 && propDepth(cat, cat.x, cat.z, yawTo(step.x - cat.x, step.z - cat.z), "stretch") > PROP_BRUSH + 0.02) {
            step.backs = (step.backs || 0) + 1;
            act.steps.splice(act.i, 0, go(step.foot, "stroll", 0.05, SAY.climbGo), { type: "turn", yaw: yawTo(step.x - step.foot.x, step.z - step.foot.z), doing: SAY.climb });
            return true;
          }
          step.from = { x: cat.x, y: cat.y, z: cat.z };
          // (A long cat with no room to stretch out for the leap where it stands, a prop at its chest or its
          // hindquarters, thinks better of it.)
          if (step.pounce && cat.size >= LONG) {
            const bank = onBank(cat, cat.x, cat.z), g0 = Math.max(PROP_BRUSH, propDepth(cat, cat.x, cat.z, cat.yaw, cat.pose, act.ignoreNow, bank)) + 1e-3;
            if (propDepth(cat, cat.x, cat.z, cat.yaw, "stretch", act.ignoreNow, bank) > g0) { step.from = null; cat.hopPitch = 0; return nextStep(act, step); }
          }
          if (step.to) {
            // A leap at something: land a little short of it (the cat never gets it).
            const tg = step.to(), dx = tg.x - cat.x, dz = tg.z - cat.z, d = Math.hypot(dx, dz) || 1;
            // (never off sideways or backwards: not facing it, it thinks better of it)
            if (step.pounce && Math.abs(wrapAngle(yawTo(dx, dz) - cat.yaw)) > 0.6) { step.from = null; cat.hopPitch = 0; return nextStep(act, step); }
            let len = Math.max(0.25, Math.min(1.8 * Math.max(1, cat.size), d - step.short));
            // (not onto a cat, nor where one in the air will land: it pulls the leap up short)
            // (and a long cat's whole body, stretched out as it lands, not into a prop, nor over one on the way:
            // a big cat's leap is long, and a spot between two props too close for its body (the cottage's
            // front and its flower bed) is no place to land)
            // (Every cat: on dry, clear ground (dryLanding), nothing solid on the way. A house cat that leapt at a
            // butterfly over the pond sat in the water 40 s.)
            const long = cat.size >= LONG, ign = landIgnore(act.ignoreNow), yw = Math.atan2(-dz, dx);
            const busy = (x, z) => !!crowding(cat, x, z, yw, "walk", 0.06) || landsNear(cat, x, z)
              // (at the leap's heading, and at its own, should the turn as it gathers fall short)
              || !dryLanding(cat, x, z, yw, ign) || !dryLanding(cat, x, z, cat.yaw, ign)
              || !cat.nav.segmentClear(cat.x, cat.z, x, z, ign, long ? cat.bodyR : BODY * cat.size * 0.5);
            while (len > 0.25 && busy(cat.x + (dx / d) * len, cat.z + (dz / d) * len)) len -= 0.1;
            len = Math.max(0.2, len);
            // (Nowhere dry and clear to land: it thinks better of it.)
            if (busy(cat.x + (dx / d) * len, cat.z + (dz / d) * len)) { step.from = null; cat.hopPitch = 0; return nextStep(act, step); }
            step.x = cat.x + (dx / d) * len; step.z = cat.z + (dz / d) * len;
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
        if (u < AIR0) {
          // lining up while it gathers (a long cat's body not swung round into a prop)
          const y0 = cat.yaw;
          turnToward(cat, step.aim, 4 / cat.fr, dt);
          if (cat.size >= LONG && step.pounce && propDepth(cat, cat.x, cat.z, cat.yaw, "stretch", act.ignoreNow) > Math.max(PROP_BRUSH, propDepth(cat, cat.x, cat.z, y0, "stretch", act.ignoreNow)) + 1e-3) cat.yaw = y0;
        }
        // (Up onto a platform: up first, over after, never through the tree's foot or the platform.)
        const eh = step.y > f.y + 0.3 ? e * e : e;
        cat.x = f.x + (step.x - f.x) * eh;
        cat.z = f.z + (step.z - f.z) * eh;
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
            { type: "hop", x: T.high.x, z: T.high.z, y: T.high.y, air: 0.48 * cat.fr, apex: 0.36, doing: SAY.climb, then: () => { release(cat, low); cat.perch = { id: T.high.id, ground: treeFoot(T, cat, true), y: T.high.y }; } },
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
    const d = Math.hypot(lead.x - cat.x, lead.z - cat.z), f = cat.fr, hy = 0.3 * lead.size;
    if (step.seated) {
      cat.wa = "sit"; setLook(cat, lead, hy);
      const far = lead.moving && lead.y < 0.3 && d > (pursue ? step.stopAt + 1.2 : 2.4) * Math.max(1, (cat.size + lead.size) * 0.5);
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
    if (!cat.motion.gait && cat.speed < 0.05 && v < 0.35 * f) v = 0;
    else if (v < V_MIN * f) v = v < V_MIN * f * 0.6 && !(cat.motion.gait && time - cat.moveSince < MIN_MOVE * f) ? 0 : V_MIN * f;
    cat.wa = "move";
    if (v === 0) {
      ease(cat, 0, dt, pursue);
      advance(cat, dt);
      setLook(cat, lead, hy);
      // Face it, in a few steps, once it has stood a moment.
      const want = yawTo(lead.x - cat.x, lead.z - cat.z), diff = Math.abs(wrapAngle(want - cat.yaw));
      if (cat.speed < 0.05 && time >= cat.stopUntil && (step.turning || diff > 0.7)) {
        step.turning = diff > 0.05;
        turnToward(cat, want, 2 / f, dt);
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
    // (Heights and distances it looks at go by its own size and the other cat's: a big cat's eyes are
    // higher, its glances reach further, and it looks at a friend's head where its head is.)
    const g = Math.max(1, cat.size);
    if (cat.greetedBy && cat.greetUntil > time && cat.greetedBy.act?.friend === cat) return setLook(cat, { x: cat.greetedBy.x, z: cat.greetedBy.z }, 0.35 * cat.greetedBy.size);
    if (cat.snubFrom && cat.snubUntil > time) {
      // Asked to play and not in the mood: its head turned pointedly away from the one asking.
      const away = cat.yaw + clampAbs(wrapAngle(yawTo(cat.snubFrom.x - cat.x, cat.snubFrom.z - cat.z) + Math.PI - cat.yaw), HEAD_MAX);
      cat.doing = SAY.notNow;
      return setLook(cat, { x: cat.x + Math.cos(away) * 3 * g, z: cat.z - Math.sin(away) * 3 * g }, 0.3 * g);
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
    const L0 = act.look, g = Math.max(1, cat.size);
    if (time >= act.lookNext) {
      act.lookNext = time + rnd.range(2.2, 6) * (1.35 - 0.7 * t.curious) * (cat.posture === "lie" ? 1.4 : 1);
      act.lookingAtYou = false; act.lookingAway = false;
      const r = rnd.next();
      const aim = (yaw, d, y) => { L0.x = cat.x + Math.cos(yaw) * d; L0.z = cat.z - Math.sin(yaw) * d; L0.y = y; L0.on = true; };
      if (viewer && r < cat.p.viewer) {
        const toV = wrapAngle(yawTo(viewer.x - cat.x, viewer.z - cat.z) - cat.yaw);
        if (t.grumpy > 0.62 && rnd.chance(0.6)) { aim(cat.yaw + clampAbs(wrapAngle(toV + Math.PI), HEAD_MAX), 3 * g, 0.3 * g); act.lookingAway = true; }
        else if (Math.abs(toV) <= HEAD_MAX) { L0.x = viewer.x; L0.z = viewer.z; L0.y = viewer.y; L0.on = true; act.lookingAtYou = true; }
        else if (!cat.perch && step.dur - act.t > 8 && time - cat.motion.since > 3 && t.grumpy < 0.6 && rnd.chance(0.25 * (0.5 + t.social))) {
          // Turns round to watch you: up, round, and settled again.
          const rest = step.dur - act.t - 1.5;
          act.steps.splice(act.i + 1, 0,
            { type: "turn", yaw: wrapAngle(cat.yaw + toV), doing: SAY.turnToYou },
            hold(step.action, rest, step.doing, { look: "about", restore: step.restore }));
          step.dur = act.t; // this hold ends now
        } else aim(cat.yaw + Math.sign(toV) * HEAD_MAX * 0.9, 3 * g, 0.8 * g); // a glance over its shoulder
      } else if (r < cat.p.viewer + 0.22) L0.on = false; // straight ahead, at nothing much
      else if (step.home && rnd.chance(0.7)) { L0.x = step.home.x + rnd.range(-0.6, 0.6); L0.z = step.home.z + rnd.range(-0.6, 0.6); L0.y = 0; L0.on = true; }
      else aim(cat.yaw + rnd.range(-1.1, 1.1), rnd.range(2, 6) * g, rnd.range(0, 0.7) * g);
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
      const dx = y.x - c.x, dz = y.z - c.z, r = 0.3 + BODY * c.size; // (0.56 for an ordinary cat)
      if (dx > r || dx < -r || dz > r || dz < -r) continue;
      const d = Math.hypot(dx, dz);
      if (d > r || d < 1e-4) continue;
      if (c.moving) { const push = Math.max(0, c.speed * 0.9 - Math.hypot(y.vx, y.vz)); y.vx += (dx / d) * push; y.vz += (dz / d) * push; }
      else { y.x = c.x + (dx / d) * r; y.z = c.z + (dz / d) * r; }
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
  /** Cats meant to be touching: a visitor and its friend rubbing cheeks (act.nuzzle, until it is beside it), two in the
      same pile once both are there. (Not a chase's pair: they never sit down in each other.) */
  const samePile = (a, b) => !!a.act && !!b.act && a.act.atPile && b.act.atPile && a.act.pile === b.act.pile;
  const together = (a, b) => (a.act && a.act.nuzzle === b) || (b.act && b.act.nuzzle === a) || samePile(a, b);
  /** Turning on the spot in small steps (and shown stepping): it can step aside as it turns. */
  const turning = (c) => c.pivoting && c.wa === "move" && !!c.motion.gait;
  function resolveCats(dt) {
    const n = cats.length;
    if (seg.length < n * 4) { seg = new Float64Array(n * 4); push = new Float64Array(n * 2); hard = new Float64Array(n * 2); }
    for (let i = 0; i < n; i++) {
      const c = cats[i], h = (HALF_LEN[bigPose(c)] || 0.3) * c.size, fx = Math.cos(c.yaw) * h, fz = -Math.sin(c.yaw) * h;
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
            // (standing moves before sitting, sitting before lying, lying before asleep)
            const rank = (c) => (c.posture === "sleep" ? 3 : c.posture === "lie" ? 2 : c.posture === "sit" ? 1 : 0);
            const mover = rank(a) !== rank(b) ? (rank(a) < rank(b) ? a : b) : (a.motion.since >= b.motion.since ? a : b);
            mover.crowdBy = mover === a ? b : a;
          }
          continue;
        }
        // A cat going up to a friend to rub cheeks may come NUZZLE into it.
        const min = (a.act && a.act.nuzzle === b) || (b.act && b.act.nuzzle === a) ? body - NUZZLE : body;
        if (d >= min) continue;
        if (d < 1e-5) { dx = b.x - a.x; dz = b.z - a.z; d = Math.hypot(dx, dz) || 1; if (d < 1e-5) { dx = 1; dz = 0; } }
        const k = min - d, nx = dx / d, nz = dz / d;
        // Only a cat on the move is pushed; two moving share it. What its own motion this tick (its step, or
        // its body swung round turning on the spot) took it further into the other is taken back in full (it
        // never walks through it); the rest of the overlap is eased out over a few ticks.
        const inA = am ? Math.max(0, bodyGap(a, a.px, a.pz, a.pyaw, a.pose, b, bigPose(b)) + k) : 0, inB = bm ? Math.max(0, bodyGap(b, b.px, b.pz, b.pyaw, b.pose, a, bigPose(a)) + k) : 0;
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
      // (one on its feet steps out at once, one resting moves over after a moment; if hemmed in, the other)
      if (c.crowdBy) {
        c.crowdT = (c.crowdT || 0) + dt; c.crowdLong = (c.crowdLong || 0) + dt;
        const o = c.crowdBy, st = c.act && c.act.steps[c.act.i];
        if (st && st.escapeFrom) c.crowdT = 0;
        else if (c.posture === "stand" && c.crowdT > 0.1 && shuffleOut(c, o)) c.crowdT = 0;
        else if (c.crowdT > CROWD_WAIT) {
          c.crowdT = 0;
          // (not one that would get up further into it)
          const rise = o.posture === "sit" || o.posture === "lie" ? bodyGap(o, o.x, o.z, o.yaw, "walk", c) - bodyGap(o, o.x, o.z, o.yaw, o.pose, c) : -1;
          if (c.crowdLong > 2.5 && rise > -0.06) makeRoom(o, c); else makeRoom(c, o);
        }
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
        if (Math.hypot(vx, vz) > 0.3 * c.speed * dt) c.yaw = wrapAngle(c.yaw + clamp(wrapAngle(yawTo(vx, vz) - c.yaw), -1.5 * dt / c.fr, 1.5 * dt / c.fr));
      }
    }
  }
  /** Nothing a cat does in a tick (its step, a nudge, a prop's push back, its body swung round as it turns) leaves it
      deeper in another cat's body than a brush (KEEP_OUT) and than it was: that is taken back, the turn first, and it
      counts as held back. (A runner banking round beside a sitting cat, one nudged into a third.) */
  const KEEP_OUT = 0.05, TOUCH = NUZZLE + 0.03;
  function keepOut() {
    for (const c of cats) {
      // (gathering for a leap, its turn is checked; in the air, nothing)
      const hop = airborne(c);
      if (c.perch || c.y > 0.3 || (hop && c.yaw === c.pyaw) || (c.x === c.px && c.z === c.pz && c.yaw === c.pyaw)) continue;
      for (const o of cats) {
        if (o === c || o.y > 0.3 || o.perch || Math.abs(o.x - c.x) > 1.7 * Math.max(c.size, o.size) || Math.abs(o.z - c.z) > 1.7 * Math.max(c.size, o.size)) continue;
        // (cats meant to touch, or one squeezing out past standing ones, may touch: never merge)
        const lim = together(c, o) || (c.detour && c.detour.ghost && !o.moving && o.posture === "stand") ? TOUCH : KEEP_OUT;
        const op = bigPose(o), g1 = bodyGap(c, c.x, c.z, c.yaw, c.pose, o, op);
        if (g1 >= -lim) continue;
        const g0 = bodyGap(c, c.px, c.pz, c.pyaw, c.pose, o, op);
        // (in it a little already, it may wriggle a hair deeper turning to leave; stepping out, a little more)
        const leaving = (c.detour && c.detour.escape && c.detour.from === o) || c.act?.steps[c.act.i]?.escapeFrom === o;
        if (g1 >= g0 - 1e-4 || (g0 < -lim && lim === KEEP_OUT && g1 >= g0 - 0.03 && g1 >= -lim - (leaving ? 0.15 : 0.08))) continue;
        if (hop || (c.yaw !== c.pyaw && bodyGap(c, c.x, c.z, c.pyaw, c.pose, o, op) >= Math.min(g0, -lim) - 1e-4)) c.yaw = c.pyaw;
        else { c.x = c.px; c.z = c.pz; c.yaw = c.pyaw; }
        c.held = 1;
      }
    }
  }
  /** The pose other cats keep clear of: for one changing posture, the longer of its two. */
  function bigPose(c) {
    const a = c.act, st = a && a.started && a.steps[a.i];
    if (!st || st.type !== "trans") return c.pose;
    const A = ACTIONS[st.name], p0 = POSTURE_POSE[A.from], p1 = POSTURE_POSE[A.to];
    return (HALF_LEN[p1] || 0) > (HALF_LEN[p0] || 0) ? p1 : p0;
  }

  /** A standing cat in another's body steps out (stepOut) and carries on; false if it can't. */
  const TIED = new Set(["eat", "scratch"]);
  function shuffleOut(cat, o) {
    const act = cat.act, st = act && act.steps[act.i];
    if (!st || cat.perch || airborne(cat) || cat.posture !== "stand" || st.type === "trans" || st.type === "hop" || st.type === "upTop" || (st.type === "hold" && TIED.has(st.action))) return false;
    // (no blip of what it shows)
    if (!cat.motion.gait && time - cat.motion.since < 0.3) return false;
    const E = stepOut(cat, o, act, act.ignoreNow, true, false);
    if (!E) return false;
    act.steps.splice(act.i, 0, go(E, "stroll", 0.05, st.doing || act.reason, { escapeFrom: E.from }));
    act.started = false;
    return true;
  }

  /** A resting cat sitting or lying in another's space gets up and moves a little way off, and
      sits there a moment before it decides what to do next. */
  function makeRoom(cat, other) {
    // (Not in the middle of something only just begun, or just changing what it does: it gets up a moment later.)
    if (!cat.act || cat.perch || airborne(cat) || time - cat.motion.since < MIN_SHOW.stand || (cat.wa !== "move" && cat.wa !== cat.motion.action)) return;
    // (Moving over already: not sent off again each time it is asked.)
    if (cat.act.room) return;
    const st = cat.act.steps[cat.act.i];
    if (st && (st.type === "trans" || st.type === "hop")) return;
    // (away from the other, as far as the bigger of the two needs)
    const away = { x: cat.x + (cat.x - other.x) * 0.5, z: cat.z + (cat.z - other.z) * 0.5 };
    const g = Math.max(1, cat.size, other.size), s = randomSpot(cat.rnd, cat, { near: away, min: 0.4 * g, max: 1.4 * g }) || randomSpot(cat.rnd, cat, { near: cat, min: g, max: 2.5 * g });
    if (!s) return;
    const act = { kind: "rest", room: true, steps: [go(s, "stroll", 0.2, SAY.wander), hold(cat.rnd.chance(0.5) ? "sit" : "stand", dur(cat, 1.5, 4), SAY.look)], i: 0, t: 0, reason: SAY.look, ignore: new Set() };
    cat.dest = s;
    begin(cat, act);
  }

  /** Pushes a big cat (at p) out of every prop its body's ends (its nose and hindquarters) are in;
      its middle is kept out of them all the same (the last word: a push that frees its nose from a
      flower bed never shoves its middle into the cottage). */
  const _end = { x: 0, z: 0 };
  function bodyOut(cat, p, ignore, bank = false) {
    const h = (HALF_LEN[cat.pose] || 0.3) * cat.size * 0.9, fx = Math.cos(cat.yaw) * h, fz = -Math.sin(cat.yaw) * h;
    const endIgnore = bank ? new Set([...(ignore || []), L.POND.id]) : ignore;
    for (let pass = 0; pass < 2; pass++) {
      for (const s of [1, -1]) {
        _end.x = p.x + fx * s; _end.z = p.z + fz * s;
        const x0 = _end.x, z0 = _end.z;
        if (cat.nav.project(_end, endIgnore, cat.bodyR)) { p.x += _end.x - x0; p.z += _end.z - z0; }
      }
      cat.nav.project(p, ignore, cat.bodyR);
    }
  }

  /** How deep (units) a cat's body at (x, z), facing `yaw`, in `pose`, is in a prop (0 when clear): its whole
      capsule (HALF_LEN × size either side of its middle, BODY × size round) against every prop but `ignore`'s
      (on the pond's bank, `bank`, its head may reach out over the water: 0.2 × its size past the water's edge). */
  function propDepth(cat, x, z, yaw, pose, ignore = null, bank = false) {
    const h = (HALF_LEN[pose] || 0.3) * cat.size, fx = Math.cos(yaw) * h, fz = -Math.sin(yaw) * h, R = BODY * cat.size, w = h + R;
    let worst = 0;
    for (let o of cat.nav.obstacles) {
      if (ignore && ignore.has(o.id)) continue;
      if (bank && o.id === L.POND.id) o = { type: "circle", x: o.x, z: o.z, r: L.POND.r - 0.2 * cat.size };
      if (o.type === "circle" ? Math.abs(o.x - x) > o.r + w || Math.abs(o.z - z) > o.r + w : x < o.minX - w || x > o.maxX + w || z < o.minZ - w || z > o.maxZ + w) continue;
      for (let i = 0; i <= 6; i++) { const u = i / 3 - 1, d = R - distToObstacle(o, x + fx * u, z + fz * u); if (d > worst) worst = d; }
    }
    return worst;
  }
  /** Of the props a step lets a cat into, the ones it may land or stand in (USABLE). */
  const landIgnore = (ign) => (ign && ign.size ? new Set([...ign].filter((id) => USABLE.has(id))) : null);
  /** Whether a cat landing at (x, z), facing `yaw`, has its whole body (stretched out) clear of every prop but `ign`
      (the pond with its rim, no bank allowance), its middle bodyR off them as its walk keeps it. */
  const dryLanding = (cat, x, z, yaw, ign) => propDepth(cat, x, z, yaw, "stretch", ign) <= PROP_BRUSH && cat.nav.pointFree(x, z, cat.bodyR, ign);
  /** How far a cat's middle is into something solid (the pond with its rim too) beyond its bodyR berth. */
  function solidDepth(cat, ign) {
    let worst = 0;
    const x = cat.x, z = cat.z, w = cat.bodyR;
    for (const o of cat.nav.obstacles) {
      if (o.type === "circle" ? Math.abs(o.x - x) > o.r + w || Math.abs(o.z - z) > o.r + w : x < o.minX - w || x > o.maxX + w || z < o.minZ - w || z > o.maxZ + w) continue;
      if (USABLE.has(o.id) || (ign && ign.has(o.id))) continue;
      const d = w - distToObstacle(o, x, z);
      if (d > worst) worst = d;
    }
    return worst;
  }
  /** The nearest spot out of the water or a solid prop where its whole body stands clear, the way it faces first. */
  function wayOut(cat, ign) {
    const g = Math.max(1, cat.size), N = cat.nav, head = Math.atan2(-Math.sin(cat.yaw), Math.cos(cat.yaw));
    for (let d = 0.2 * g; d <= 4 * g + 1e-9; d += 0.1 * g) {
      let best = null, bs = Infinity;
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2, x = cat.x + Math.cos(a) * d, z = cat.z + Math.sin(a) * d, yaw = yawTo(x - cat.x, z - cat.z);
        if (!N.pointFree(x, z, Math.max(N.clearR, cat.bodyR + 0.05), ign) || propDepth(cat, x, z, yaw, "walk", ign) > PROP_BRUSH || crowding(cat, x, z, yaw, "walk", 0.06)) continue;
        const sc = Math.abs(wrapAngle(a - head));
        if (sc < bs) { bs = sc; best = { x, z }; }
      }
      if (best) return best;
    }
    return null;
  }
  /** How deep a cat's middle may be in something solid (beyond bodyR) before it walks out (walkOut). */
  const SOLID_DEEP = 0.1;
  /** How deep its body may be in something solid as it sits, lies or loafs down there. */
  const SETTLE_DEEP = 0.2;
  const SETTLES = new Set(["sit", "lie", "sleep"]);
  /** A cat found in the water or a solid prop walks straight out, before its next step or out of the hold it is in (a
      posture change under way is seen out first). True if it set off. */
  function walkOut(cat, act, step) {
    if (cat.perch || airborne(cat) || !step || step.type === "hop" || step.type === "upTop" || step.type === "call" || (act.started && step.type === "trans")) return false;
    // (on its way: walk steps it out)
    if (WALKING_STEPS.has(step.type)) return false;
    // (a hold looked at 5 times a second; not sent again while on its way out; 3 tries at most)
    if (act.started && time < (cat.outCheck || 0)) return false;
    cat.outCheck = time + 0.2;
    for (let k = act.i; k < act.steps.length; k++) if (act.steps[k].escapeOut) return false;
    if ((act.outTries || 0) >= 3) return false;
    const ign = landIgnore(act.ignoreNow);
    // (its middle in it; or about to sit, lie or loaf down with its body well into it)
    const settling = !act.started && step.type === "hold" && step.action && SETTLES.has(ACTIONS[step.action]?.posture);
    // (at the pond to watch or drink, its head may be over the rim)
    const sIgn = act.kind === "pond" || act.kind === "drink" ? new Set([...(ign || []), L.POND.id]) : ign;
    if (solidDepth(cat, ign) <= SOLID_DEEP && !(settling && propDepth(cat, cat.x, cat.z, cat.yaw, POSE_OF[step.action] || cat.pose, sIgn) > SETTLE_DEEP)) return false;
    const E = wayOut(cat, ign);
    if (!E) return false;
    act.outTries = (act.outTries || 0) + 1;
    cat.dest = E;
    act.steps.splice(act.i, 0, go(E, "stroll", 0.05, step.doing || act.reason, { escapeOut: true }));
    act.started = false;
    return true;
  }
  /** On the pond's bank (where it watches and drinks): its head may reach out over the water (propDepth). */
  const onBank = (cat, x, z) => Math.hypot(x - L.POND.x, z - L.POND.z) < L.POND.r + 1.2 * cat.size;
  /** A brush of a prop (units into it) that is let be. */
  const PROP_BRUSH = 0.03;
  /** How fast (units/s, × gaitScale) a cat found further into a prop than its own step took it (landed or
      got up there) is eased back out of it: at an amble, over several ticks, never popped out in one. */
  const PROP_EASE = 0.35;

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
      // (Its step and any nudge from the cats round it carry it no further in a tick than the legs it shows will step
      // (legCapAhead): so the props' hard check, and keepOut, work from where its legs really take it.)
      // (setting off afresh, the gait it starts in: a stalk's legs, or a walk's)
      const vl = (cat.legs.cur < 0 ? LEG_VMAX[cat.stalk ? 3 : 0] : legCapAhead(cat.legs, dt)) * cat.fr * dt, ml = Math.hypot(cat.x - cat.px, cat.z - cat.pz);
      if (vl > 0 && ml > vl && cat.y < 0.05) { const k = vl / ml; cat.x = cat.px + (cat.x - cat.px) * k; cat.z = cat.pz + (cat.z - cat.pz) * k; }
      // (a big cat turning on the spot too: its nose and hindquarters swing round)
      const long = cat.size >= LONG;
      if (!cat.perch && !airborne(cat) && (cat.moving || cat.x !== cat.px || cat.z !== cat.pz || cat.ySettle || (long && cat.yaw !== cat.pyaw))) {
        // Nothing is walked through: the hard check after steering and personal space.
        const p = scratch; p.x = cat.x; p.z = cat.z;
        const ign = cat.act ? cat.act.ignoreNow : withContaining(null, cat), bank = long && onBank(cat, cat.x, cat.z);
        cat.nav.project(p, ign, cat.bodyR);
        // (A long cat's whole body, nose and hindquarters too, not only its middle: a lion's head doesn't
        // go through a bush it walks past or turns beside. On the pond's bank, where it watches and drinks,
        // its head may reach out over the water.)
        if (long) bodyOut(cat, p, ign, bank);
        // (Never a pop: a prop takes back the cat's own step and turn this tick, and a little more; found
        // further in than that (landed there, got up there), it is eased out at an amble over a few ticks.)
        // (Its own motion: its step, and the sweep of its body turning on the spot, whose hind end it steps round
        // clear of the prop; a long cat's turn as it walks is undone rather than pushed: below.)
        // (a long cat's hind end stepped round a step's worth at most: a turn that needs more is undone)
        const sweep = Math.abs(wrapAngle(cat.yaw - cat.pyaw)) * (HALF_LEN[cat.pose] || 0.3) * cat.size;
        const own = Math.hypot(cat.x - cat.px, cat.z - cat.pz) + (!long ? sweep : cat.pivoting ? Math.min(sweep, 0.015 * cat.size) : 0);
        // (walking out of a prop (walkOut), on its own legs: only eased)
        const out = cat.act && cat.act.steps[cat.act.i]?.escapeOut;
        const lim = (out ? 0 : own) + PROP_EASE * cat.fr * dt, pl = Math.hypot(p.x - cat.x, p.z - cat.z);
        if (pl > lim) { p.x = cat.x + ((p.x - cat.x) * lim) / pl; p.z = cat.z + ((p.z - cat.z) * lim) / pl; }
        // (A long cat's tick never leaves its body deeper in a prop than a brush and than it was (a keepOut for
        // props): where its step and turn took it, if that is so; else with the turn undone (it walks on
        // straight, and turns once it can); else pushed along the prop; else the step undone too, held back.
        // One in a prop already takes the push out of it.)
        let undone = false;
        if (long && !out) {
          const g0 = propDepth(cat, cat.px, cat.pz, cat.pyaw, cat.pose, ign, bank), lim0 = Math.max(PROP_BRUSH, g0) + 1e-3;
          const gA = propDepth(cat, cat.x, cat.z, cat.yaw, cat.pose, ign, bank), turned = cat.yaw !== cat.pyaw;
          if (g0 > PROP_BRUSH && propDepth(cat, p.x, p.z, cat.yaw, cat.pose, ign, bank) < Math.min(gA, lim0)) { /* eased out: p */ }
          else if (gA <= lim0) { p.x = cat.x; p.z = cat.z; }
          else if (cat.pivoting && propDepth(cat, p.x, p.z, cat.yaw, cat.pose, ign, bank) <= lim0) { /* stepped round clear of it: p */ }
          else if (turned && propDepth(cat, cat.x, cat.z, cat.pyaw, cat.pose, ign, bank) <= lim0) {
            // (turning on the spot that way into it: it turns the other way round from now on; that way too, it
            // is held there (the stall check finds it another way, or it gives up))
            if (cat.pivoting) {
              // (wedged, a prop taking back its turn both ways round: it stands a moment, and finds its way again, out along a
              // heading it can turn to (walk: turnFree, outAlong); no turning to and fro on the spot)
              if (cat.turnFlip) { cat.turnFlip = 0; if (cat.route) cat.route.stale = true; cat.waitUntil = time + WAIT_ON; }
              else cat.turnFlip = Math.sign(wrapAngle(cat.yaw - cat.pyaw));
            }
            p.x = cat.x; p.z = cat.z; cat.yaw = cat.pyaw; undone = true;
          }
          else if (propDepth(cat, p.x, p.z, cat.yaw, cat.pose, ign, bank) <= lim0) { /* along the prop: p */ }
          else if (turned && propDepth(cat, p.x, p.z, cat.pyaw, cat.pose, ign, bank) <= lim0) { cat.yaw = cat.pyaw; undone = true; }
          else { p.x = cat.px; p.z = cat.pz; cat.yaw = cat.pyaw; undone = true; }
          // (and pushed along it no further in the tick than its legs step (legCapAhead): no skating along a bush)
          const vl = (cat.legs.cur < 0 ? LEG_VMAX[cat.stalk ? 3 : 0] : legCapAhead(cat.legs, dt)) * cat.fr * dt, ml = Math.hypot(p.x - cat.px, p.z - cat.pz);
          if (vl > 0 && ml > vl) {
            const qx = cat.px + ((p.x - cat.px) * vl) / ml, qz = cat.pz + ((p.z - cat.pz) * vl) / ml;
            if (propDepth(cat, qx, qz, cat.yaw, cat.pose, ign, bank) <= lim0) { p.x = qx; p.z = qz; } else { p.x = cat.px; p.z = cat.pz; cat.yaw = cat.pyaw; undone = true; }
          }
        }
        // (How much of its step a prop took back: pressed against one, it is walking on the spot.)
        const step0 = Math.hypot(cat.x - cat.px, cat.z - cat.pz);
        cat.heldProp = undone && (p.x === cat.px && p.z === cat.pz) ? 1 : step0 > 1e-6 ? Math.min(1, Math.hypot(p.x - cat.x, p.z - cat.z) / step0) : 0;
        cat.x = p.x; cat.z = p.z;
        // Step up onto a bed's cushion (or the big cushion), down onto the grass.
        const g = groundY(cat);
        cat.y += (g - cat.y) * Math.min(1, dt * 10);
        cat.ySettle = Math.abs(g - cat.y) > 1e-3;
      }
    }
    keepOut();
    for (const cat of cats) {
      const st = cat.act && cat.act.steps[cat.act.i];
      // A cat that tries to walk but gets nowhere (pushed back as far as it steps by another cat,
      // a bowl, a post) stops treading: every STALL_WAIT seconds its headway is checked, and if it
      // has made little it walks round the cat in its way, or, with nothing to walk round (a
      // crowd, a tight corner), stands and waits a moment.
      if (((cat.moving && cat.speed > 0.15) || cat.wantV > 0.15 || (cat.pivoting && (cat.held > 0.7 || cat.heldProp > 0.7))) && st && WALKING_STEPS.has(st.type)) {
        if (cat.stall === 0) { cat.stallX = cat.x; cat.stallZ = cat.z; }
        // (Held back by another cat's body for most of its step: it doesn't wait out the check.)
        const byProp = (cat.heldProp || 0) > 0.7;
        // (a tick or two let go in between, as it pushes off again from a standstill, or a tick with next to
        // no headway, held a moment ago, is still being held)
        const noStep = cat.heldT > 0 && Math.hypot(cat.x - cat.px, cat.z - cat.pz) < 0.15 * cat.fr * dt;
        if (byProp || (cat.held || 0) > 0.7 || noStep) { cat.heldT = (cat.heldT || 0) + dt; cat.heldFree = 0; }
        else if ((cat.heldFree = (cat.heldFree || 0) + dt) > 0.05) cat.heldT = 0;
        if ((cat.stall += dt) > STALL_WAIT || cat.heldT > HELD_WAIT) {
          const made = Math.hypot(cat.x - cat.stallX, cat.z - cat.stallZ) / cat.stall;
          cat.stall = 0;
          if (made < Math.max(STALL_SPEED * cat.fr, cat.speed * 0.4) || cat.heldT > HELD_WAIT) {
            // (Walked into something, it has stopped: its speed is what it really made.)
            const R = cat.route, near = R && Math.hypot(R.qx - cat.x, R.qz - cat.z) < (R.arrive ?? 0.15) + CLOSE_ENOUGH * Math.max(1, cat.size);
            // (Only a creep's worth on against what stopped it: it stands, rather than inch on in a gait.)
            if ((cat.heldT > HELD_WAIT || (cat.heldT > 0.03 && made < STALL_SPEED * cat.fr)) && dt > 0 && !near) {
              const real = Math.hypot(cat.x - cat.px, cat.z - cat.pz) / dt;
              if (real < 0.15 * cat.fr) { cat.speed = 0; cat.x = cat.px; cat.z = cat.pz; cat.moving = false; } // (stopped where it stood)
              else cat.speed = Math.min(cat.speed, real);
              cat.wantV = 0;
            }
            cat.heldT = 0;
            // (Even the way round blocked: it waits; blocked again, it gives up the walk. Held up this near
            // where it was going, it has arrived. Up against a prop, it finds its way again from there.)
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
      // (not into a cat there)
      if (st.type === "go" && crowding(cat, st.x, st.z, cat.yaw, "walk", 0.05)) break;
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
    // (The big cats first take whole sunny patches from the far end of the list, and those patches'
    // slots are no one else's; they never get a bed, a perch or a pile.)
    const bigs = cats.filter((c) => c.big), bigSun = BIG_SUN.slice(-bigs.length || BIG_SUN.length).reverse(), taken = new Set();
    const bigSpots = new Map(bigs.map((c, i) => { const s = bigSun[i]; if (!s) return [c, null]; for (const id of sunIds(s)) taken.add(id); return [c, { id: sunIds(s), x: s.x, z: s.z, y: 0, pose: i % 2 ? "loaf" : "sleep", yaw: -Math.PI / 2 + 0.5, say: i % 2 ? SAY.sunLoaf : SAY.napSun }]; }));
    const spots = [
      { id: L.STEP.id, x: L.STEP.x, z: L.STEP.z, y: L.STEP.y, pose: "sit", yaw: L.STEP.sitYaw, perch: { id: L.STEP.id, ground: L.STEP.ground, y: L.STEP.y }, say: SAY.porch },
      ...L.TREES.flatMap((T) => [tree(T, false), tree(T, true)]),
      ...L.BEDS.map(bed),
      ...PILE_SLOTS.map((s) => ({ id: s.id, x: s.x, z: s.z, y: s.pile.y, pose: "sleep", say: s.pile.kind === "blanket" ? SAY.blanket : SAY.pile })),
      ...L.SUN_PATCHES.flatMap((s, i) => [sun(s, 0, i % 2 ? "sleep" : "loaf"), sun(s, 1, i % 2 ? "loaf" : "sleep")]).filter((s) => !taken.has(s.id)),
      ...POND_SPOTS.slice(0, 5).map((p) => ({ id: p.id, x: p.x, z: p.z, y: 0, pose: "sit", yaw: p.yaw, say: SAY.pond })),
    ];
    const order = [...cats].sort((a, b) => a.index - b.index);
    for (const cat of order) {
      const s = cat.big ? bigSpots.get(cat) : spots.shift();
      let pose;
      if (s) {
        for (const id of [].concat(s.id)) reserve(id, cat);
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
    /** The route-finder a cat of this size walks by (the big cats' own, for their bodies). */
    navOf,
    /** The big cats' own places: the pond spots they watch and drink from, the sunny patches they nap on. */
    bigPlaces: { pond: BIG_POND, sun: BIG_SUN },
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
    cat.pyaw. Keeps cat.stride (the instanced models' step phase) in step with the odometer (a big
    cat's strides as much longer as it is drawn). A big cat's gait bands are gaitScale times faster. */
export function publishMotion(cat, dt, time) {
  const m = cat.motion, size = cat.size || 1, f = gaitScale(size);
  const moved = Math.hypot(cat.x - cat.px, cat.z - cat.pz);
  const turned = wrapAngle(cat.yaw - cat.pyaw);
  m.yawRate = dt > 0 ? turned / dt : 0;
  let action = cat.wa, gait = null;
  let odo = moved;
  if (action === "move") {
    // The gait from how fast it goes (turning on the spot counts as slow steps), with
    // hysteresis and a dwell; a sprint launches straight into a run.
    // (A cat held fast by a body or a prop beyond a brush has stopped: no legs running on the spot.)
    const pivot = cat.pivoting && dt > 0 ? (Math.abs(turned) / dt) * PIVOT_ARC * size : 0;
    const real = dt > 0 ? moved / dt : cat.speed, held = (cat.heldT || 0) > 0.05 && (cat.held > 0.7 || cat.heldProp > 0.7);
    if (held) cat.speed = Math.min(cat.speed, real);
    let v = Math.max(cat.speed, pivot);
    if (cat.runIntent && cat.speed > 0.05 && !held) v = Math.max(v, (GAIT_BANDS.runUp + 0.01) * f);
    gait = gaitFor(m.gait, v, time - cat.gaitSince, { stalk: cat.stalk && v >= 0.03, scale: f });
    if (m.gait && gait && gait !== m.gait && (time - cat.gaitSince < GAIT_DWELL || (cat.brakeT < (m.gait === "run" ? 0.4 : 0.3) && RANK[gait] < RANK[m.gait]))) gait = m.gait;
    // Pulling up (nothing asks it on), it stops in the gait it is in: no last-moment change of step
    // (and the last steps of a stalk are the stalk's, not a walk's).
    if (m.gait && gait && gait !== m.gait && !(cat.wantV > 0) && (m.gait === "stalk" || RANK[gait] < RANK[m.gait])) gait = m.gait;
    // Once on the move it is shown moving at least MIN_SHOW.move; but one stopped dead is not left frozen
    // mid-stride beyond a step's showing: it stands (out of a run or trot straight to standing, no walk).
    if (!cat.pivoting && real < 0.1 * f && v < 0.1 * f && gait && m.gait && RANK[gait] < RANK[m.gait] && RANK[m.gait] > RANK.walk) gait = null;
    const dead = !cat.pivoting && real < 0.03 && (held || !(cat.wantV > 0));
    if (!gait && m.gait && time - cat.gaitSince < MIN_SHOW.move && !(dead && time - m.since >= 0.25)) gait = m.gait;
    if (cat.pivoting) { odo += Math.abs(turned) * PIVOT_ARC * size; if (m.gait && gait) gait = m.gait; } // turning on the spot in the gait it has
    // It counts as stopped once still a moment, or at once if nothing asks it on.
    cat.slowFor = gait || cat.lastWa !== "move" ? 0 : cat.slowFor + dt; // (setting off counts as not yet stopped)
    const grace = cat.wantV > 0 || cat.pivoting ? 0.12 : 0.03;
    if (gait) action = gait;
    else if (cat.slowFor < grace && m.gait) { gait = m.gait; action = m.action; }
    else if (cat.slowFor < grace && ACTIONS[m.action].posture !== "sit" && ACTIONS[m.action].posture !== "lie" && ACTIONS[m.action].posture !== "sleep") action = m.action;
    else action = "stand";
  }
  // (The legs shown, as the view blends them (legStep): its speed is held to the ground they step, and the next
  // tick's step and nudges are too (update): a cat held in a walk as it picks up speed does not skate.)
  const cap = legStep(cat.legs || (cat.legs = newLegs()), ACTIONS[action].kind === "gait" ? action : null, dt) * f;
  if (cap > 0) cat.speed = Math.min(cat.speed, cap);
  cat.lastWa = cat.wa;
  m.odometer += odo;
  cat.stride += (odo * 5.2) / size;
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
  // (a big cat round a circle as much wider as it is, at its own pace: gaitScale)
  const g = Math.max(1, cat.size || 1), f = gaitScale(g), R = CIRCLE_R * g, vmin = V_MIN * f;
  const left = step.turns * Math.PI * 2 - step.turned;
  const pace = Math.max(vmin, 0.4 * f * Math.min(1, cat.tune.pace + 0.1)), vb = Math.sqrt(2 * BRAKE * Math.max(0, left) * R);
  // (Done once the last of it would be inched: the rest is under a step. Hemmed in by another cat's
  // body, it has turned round as far as it can.)
  if (left <= 1e-4 || (vb < vmin && step.turned > 0.5) || (cat.held > 0.7 && step.turned > 0)) { cat.speed = 0; cat.moving = false; return true; }
  cat.wa = "move"; cat.lookOn = false;
  const v = Math.max(vmin, Math.min(pace, vb));
  const a = v > cat.speed ? ACCEL : BRAKE;
  cat.speed += clamp(v - cat.speed, -a * dt, a * dt);
  cat.wantV = v;
  const turn = Math.min(left, (Math.max(cat.speed, 0.08) / R) * dt);
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
    const k = Math.min(1, cat.speed / (1.2 * gaitScale(cat.size || 1)));
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
