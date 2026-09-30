/* How a cat gets from one thing to the next: the vocabulary shared by the behaviour sim (cats.js,
   meadow.js), the animation controller (catviews.js) and the clips (catrig.js). No three.js, so
   the sim and the Node tests read the same table as the page.

   Every tick the sim publishes cat.motion = { action, posture, gait, u, odometer, yawRate, look }:
   - action: one of ACTIONS below, the clip to show. It changes only when what the cat does changes,
     never for a single frame.
   - posture: ACTIONS[action].posture.
   - gait: "walk" | "trot" | "run" | "stalk" | null, with hysteresis (gaitFor) and a minimum dwell.
   - u: 0..1 progress through a "once" or "trans" action (the view sets the clip's time from it),
     null for loops.
   - odometer: distance actually moved (model units of the world), which steps the gait clips.
   - yawRate: how fast the body is turning (rad/s), for the spine bend.
   - look: {x, y, z} the cat is looking at, or null.

   A cat never jumps between postures: to go from one posture to another the sim first plays the
   transition clips on transitionPath (sitting down, getting up, curling up, waking), each for
   transDur seconds, and does not move meanwhile. */

export const POSTURES = ["move", "stand", "sit", "lie", "sleep", "air"];

/** kind: "gait" (loop stepped by distance), "loop" (plays until changed), "once" (plays once,
    time from u) or "trans" (a posture change, time from u; from/to postures). */
export const ACTIONS = {
  // On the move
  walk: { posture: "move", kind: "gait" },
  trot: { posture: "move", kind: "gait" },
  run: { posture: "move", kind: "gait" },
  stalk: { posture: "move", kind: "gait" },
  // Standing
  stand: { posture: "stand", kind: "loop" },
  sniff: { posture: "stand", kind: "loop" },
  greet: { posture: "stand", kind: "loop" }, // tail straight up, head up
  eat: { posture: "stand", kind: "loop" },
  crouch: { posture: "stand", kind: "loop" }, // hunting crouch, eyes on prey
  wiggle: { posture: "stand", kind: "loop" }, // bottom wiggle before a pounce
  scratch: { posture: "stand", kind: "loop" }, // claws on a trunk, reared up
  headBunt: { posture: "stand", kind: "loop" }, // cheek rub on a friend or a post
  hindStand: { posture: "stand", kind: "loop" }, // up on the hind legs to look (MICHI)
  shake: { posture: "stand", kind: "once" }, // whole-body shake
  stretch: { posture: "stand", kind: "once" }, // play bow then a long back stretch
  // Sitting
  sit: { posture: "sit", kind: "loop" },
  look: { posture: "sit", kind: "loop" },
  pant: { posture: "sit", kind: "loop" },
  groom: { posture: "sit", kind: "loop" }, // licks a forepaw and washes the face
  legLick: { posture: "sit", kind: "loop" }, // one hind leg up, licking it ("cello")
  earScratch: { posture: "sit", kind: "loop" }, // a hind paw scratching behind the ear
  knead: { posture: "sit", kind: "loop" },
  beckon: { posture: "sit", kind: "loop" }, // one forepaw raised and waving (MANEKI)
  chatter: { posture: "sit", kind: "loop" }, // staring up at a bird, jaw-chatter head tremor
  yawn: { posture: "sit", kind: "once" }, // head up, back arches a little
  // Lying
  loaf: { posture: "lie", kind: "loop" }, // sphinx, forelegs in front
  dab: { posture: "lie", kind: "loop" }, // batting at the water from a loaf
  flop: { posture: "lie", kind: "loop" }, // on its side, legs out, sunbathing
  roll: { posture: "lie", kind: "loop" }, // on its back, wriggling
  // Asleep
  sleep: { posture: "sleep", kind: "loop" }, // curled nose to tail
  // In the air
  hop: { posture: "air", kind: "once" }, // gather, leap, land (u follows the hop)
  pounce: { posture: "air", kind: "once" },
  // Posture changes
  sitDown: { posture: "sit", kind: "trans", from: "stand", to: "sit" },
  standUp: { posture: "stand", kind: "trans", from: "sit", to: "stand" },
  lieDown: { posture: "lie", kind: "trans", from: "stand", to: "lie" },
  getUp: { posture: "stand", kind: "trans", from: "lie", to: "stand" },
  sitToLie: { posture: "lie", kind: "trans", from: "sit", to: "lie" },
  lieToSit: { posture: "sit", kind: "trans", from: "lie", to: "sit" },
  curlUp: { posture: "sleep", kind: "trans", from: "lie", to: "sleep" },
  wake: { posture: "lie", kind: "trans", from: "sleep", to: "lie" },
};

/** Seconds each posture change takes for an ordinary adult; tempo scales it (kittens quicker,
    old or heavy cats slower). Getting up from lying takes a moment more: a cat lying with its
    forepaws tucked under must bring them out first. */
export const TRANS_DUR = { sitDown: 0.75, standUp: 0.55, lieDown: 0.95, getUp: 0.85, sitToLie: 0.75, lieToSit: 0.8, curlUp: 1.4, wake: 1.2 };

export const transDur = (name, tempo = 1) => (TRANS_DUR[name] ?? 0.6) * Math.min(1.5, Math.max(0.6, tempo));

/** "move" and "air" count as standing for posture changes (a cat stops, then sits). */
const base = (p) => (p === "move" || p === "air" ? "stand" : p);
const EDGES = Object.entries(ACTIONS).filter(([, a]) => a.kind === "trans").map(([name, a]) => [a.from, a.to, name]);

/** The transition clips that take a cat from one posture to another, in order: shortest path
    over sitDown/standUp/lieDown/getUp/sitToLie/lieToSit/curlUp/wake. [] when already there. */
export function transitionPath(from, to) {
  const a = base(from), b = base(to);
  if (a === b) return [];
  const prev = new Map([[a, null]]), queue = [a];
  while (queue.length) {
    const p = queue.shift();
    if (p === b) break;
    for (const [f, t, name] of EDGES) if (f === p && !prev.has(t)) { prev.set(t, [p, name]); queue.push(t); }
  }
  if (!prev.has(b)) return [];
  const path = [];
  for (let p = b; prev.get(p); p = prev.get(p)[0]) path.unshift(prev.get(p)[1]);
  return path;
}

/** Gait bands (world units per second of an ordinary cat) with hysteresis: a cat changes gait
    only when clearly into the next band, so speeds near a boundary do not flicker. */
export const GAIT_BANDS = { trotUp: 1.55, trotDown: 1.25, runUp: 2.45, runDown: 1.95 };
/** Shortest time in one gait before another may start (s): half a second, and a hair more, so a change never falls a
    rounding error inside it (seen at 0.4999 s on the page). */
export const GAIT_DWELL = 0.52;

/** Dynamic similarity (the Froude number): an animal `size` times as big as an ordinary cat walks,
    trots and runs at √size times the speeds (each gait at the same Froude number: a lion strolls
    where a house cat strolls, only on longer legs), steps and turns √size times more slowly, and
    takes √size times as long over a move (sitting down, a yawn, a leap); so its stride, tied to
    the distance it covers, keeps its paws planted, and a big cat has the slow, heavy cadence of a
    big animal instead of walking in slow motion. Only bigger cats: a kitten keeps its own pace
    (tune.pace, style.tempo). The sims (speeds, gait bands, turn rates, durations) and the view
    (the fastest the legs are stepped, the idle loops' clock) all use this one factor. */
export const gaitScale = (size = 1) => Math.sqrt(size > 1 ? size : 1);

/** The gait for a speed, given the current one (null when not moving) and how long it has lasted.
    `scale`: the cat's gaitScale (a big cat's bands are that much faster). */
export function gaitFor(prev, speed, since = Infinity, { stalk = false, scale = 1 } = {}) {
  if (speed < 0.03) return null; // (still: whatever its size)
  if (scale !== 1) speed /= scale;
  // (into a stalk too only once the gait it is in has been seen its dwell: no walk flicked into a stalk)
  if (stalk) return prev && prev !== "stalk" && since < GAIT_DWELL ? prev : "stalk";
  const B = GAIT_BANDS;
  let want;
  if (prev === "run") want = speed < B.runDown ? (speed < B.trotDown ? "walk" : "trot") : "run";
  else if (prev === "trot") want = speed > B.runUp ? "run" : speed < B.trotDown ? "walk" : "trot";
  else want = speed > B.runUp ? "run" : speed > B.trotUp ? "trot" : "walk";
  if (prev && prev !== "stalk" && want !== prev && since < GAIT_DWELL) return prev;
  return want;
}

/** Shortest time an action is shown before the sim may change it (s), except for urgent events
    (a startle, a pounce, a hop). Loops only; once and trans actions last their own length. */
export const MIN_SHOW = { stand: 0.45, sit: 1.2, lie: 1.5, sleep: 3, move: 0.35 };

/** Idle mannerisms a cat may slip in while holding a posture, and which traits make them likely
    (traits are 0..1, see traits.js). dur: seconds [min, max]. The sim picks them (pickFidget);
    the tail flicks, head tilts, slow blinks and breathing are done by the view's procedural
    layers and are not actions. */
export const FIDGETS = {
  yawn: { postures: ["sit", "lie"], dur: [1.8, 2.4], weight: (t) => 0.4 + t.sleepy },
  groom: { postures: ["sit"], dur: [3, 6], weight: (t) => 0.3 + t.proud * 0.6 + (1 - t.energy) * 0.2 },
  legLick: { postures: ["sit"], dur: [3, 5], weight: (t) => 0.15 + t.proud * 0.5 },
  earScratch: { postures: ["sit"], dur: [1.6, 2.6], weight: (t) => 0.25 + t.energy * 0.2 },
  knead: { postures: ["sit"], dur: [2.5, 4.5], weight: (t) => 0.1 + t.social * 0.5 + t.sleepy * 0.2 },
  look: { postures: ["sit"], dur: [2.5, 5], weight: (t) => 0.4 + t.curious * 0.8 },
  shake: { postures: ["stand"], dur: [0.8, 0.8], weight: (t) => 0.2 },
  sniff: { postures: ["stand"], dur: [1.5, 3], weight: (t) => 0.3 + t.curious * 0.8 },
  flop: { postures: ["lie"], dur: [6, 14], weight: (t) => 0.1 + t.sleepy * 0.6 + (1 - t.energy) * 0.3 },
  roll: { postures: ["lie"], dur: [2.5, 4.5], weight: (t) => 0.05 + t.playful * 0.5 + t.social * 0.2 },
};

/** A signature move from a cat's own story (traits.signature) and the action that plays it. */
export const SIGNATURES = { beckon: "beckon", hindStand: "hindStand", loaf: "loaf", wash: "groom", boxSit: "sit", headTilt: "look", stareDown: "look", sphinxWatch: "loaf", ringCurl: "sleep", drapeLean: "flop", lapClaim: "knead", spin: "stand", slowBlink: "sit", popMouth: "sit", blep: "sit" };

/** Neutral traits (every value 0.5, an ordinary adult) for cats with none. `avoid`: actions (keys of
    ACTIONS) this cat's own model cannot show without its skin tearing (traits.js MODEL_LIMITS): the sims
    never give them, and the view shows the posture's plain pose, or standing, instead. */
export const NEUTRAL_TRAITS = { energy: 0.5, sleepy: 0.5, playful: 0.5, bold: 0.5, social: 0.5, grumpy: 0.5, proud: 0.5, grace: 0.5, curious: 0.5, hunter: 0.5, vocal: 0.5, foodie: 0.5, age: "adult", build: "normal", legs: "normal", size: "medium", flags: [], signature: null, avoid: [] };

/** Whether this cat's own model can show `action` (its traits' `avoid` list, see traits.js MODEL_LIMITS). */
export const canDo = (traits, action) => !(Array.isArray(traits?.avoid) && traits.avoid.includes(action));
/** The plain loop each posture falls back to, in order, when a cat's model can't show an action. */
const FALLBACK = { sleep: ["sleep", "loaf", "sit", "stand"], lie: ["loaf", "sit", "stand"], sit: ["sit", "stand"], stand: ["stand"], move: ["stand"], air: ["stand"] };
/** `action` if this cat may show it, else the nearest plain pose it may: its posture's own loop, or
    the next posture up (a cat that can't curl up dozes in its loaf; one that can only stand stands). */
export function allowedAction(traits, action) {
  if (canDo(traits, action)) return action;
  for (const a of FALLBACK[ACTIONS[action]?.posture] || ["stand"]) if (canDo(traits, a)) return a;
  return "stand";
}

/** A fidget for a cat holding `posture`, by trait-weighted chance; rnd() gives 0..1. Null if none fits. */
export function pickFidget(traits, posture, rnd) {
  const t = { ...NEUTRAL_TRAITS, ...(traits || {}) };
  const options = Object.entries(FIDGETS).filter(([name, f]) => f.postures.includes(posture) && canDo(t, name)).map(([name, f]) => [name, Math.max(0, f.weight(t))]);
  const sig = t.signature && SIGNATURES[t.signature];
  if (sig && ACTIONS[sig]?.posture === posture && canDo(t, sig)) options.push([sig, 1.2]);
  const total = options.reduce((s, [, w]) => s + w, 0);
  if (!total) return null;
  let r = rnd() * total;
  for (const [name, w] of options) { r -= w; if (r <= 0) return name; }
  return options[options.length - 1][0];
}
