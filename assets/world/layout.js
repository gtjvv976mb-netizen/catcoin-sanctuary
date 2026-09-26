/* Where everything in the garden is. One source for both the scenery (garden.js draws it)
   and the cats (cats.js uses it to find beds, bowls, perches and a way round).

   Axes: x to the right of the cottage, z towards its porch (the cottage's front faces +z),
   y up. One unit is roughly the height of a small door. Headings ("yaw") follow the cat
   models, which face +x: yaw 0 faces +x, and a cat moves along (cos yaw, -sin yaw).

   The garden is wide: two hundred-odd cats live in it at once (the stock cats and the biggest
   adoptable cats), so there are many beds, five cat trees, four feeding corners, a pond, a
   vegetable patch, sunny lawns and nap piles. Round the fence lie two meadow rings (MEADOW), kept
   free for the adoptable cats still to come, with ring paths, benches, trees, flower fields and a
   second pond; in one corner of the first ring is the Hall of Fame plaza (HALL_OF_FAME), where the
   legendary cat coins that already exist sit round a fountain. No three.js here: this file also runs under plain Node. */

import { makeRandom } from "./rng.js";

/** Cat size: a sitting cat is `size` units tall; the other poses are fitted to match. */
export const CAT = { size: 1.2, bodyR: 0.3, clearR: 0.42, personal: 1.0 };

/** The cottage, scaled to `height` and centred. Its footprint (with the porch stairs) was
    measured by casting rays down onto sanctuary.glb at that scale. */
export const HOUSE = { height: 5.2, minX: -2.8, maxX: 2.8, minZ: -2.6, maxZ: 2.6 };

/** Cats keep inside walkR; the fence runs all the way round at fenceR, with a gate where each
    path leaves (angles in degrees, measured from +x towards +z). */
export const GARDEN = { walkR: 36, fenceR: 37.6, gates: [[87, 93], [267, 273], [197, 203], [327, 333]] };

const HALF_PI = Math.PI / 2;

/** The bottom step of the porch stairs: a perch a cat hops up to. Heights are the step tops. */
export const STEP = { id: "step", kind: "step", x: 0.4, z: 2.6, y: 0.23, sitYaw: -HALF_PI, ground: { x: -0.5, z: 3.32 } };

/** Round cat beds: r is the outer rim, y the cushion a cat lies on. */
const BED_COLORS = [0xe98a6b, 0x7fb3d5, 0xf2c14e, 0xa98bd4, 0x8cc084, 0xf29bb2];
export const BEDS = [
  [4.75, 4.35], [-2.1, 6.15], [-5.2, -2.3], [4.6, -3.3], [7.9, 2.6], [-7.3, 3.4],
  [2.3, 10.4], [-4.6, 12.2], [12.2, -1.2], [-12.6, -2.2], [4.4, -13.4], [-2.8, -9.8],
  [19.7, 7.2], [10.5, 18.2], [-11.8, 16.8], [-19.7, 7.2], [-14.8, -14.8], [10.5, -18.2], [19.5, -9.1], [-7.5, -23.2],
  [29.5, 4.2], [22.4, 24.6], [-6.6, 32.4], [-29.8, 17.6], [-31.6, -4.4], [-27.6, -20.6], [4.6, -33.4], [30.8, -12.8],
].map(([x, z], i) => ({ id: `bed-${i + 1}`, kind: "bed", x, z, r: 0.76, y: 0.1, color: BED_COLORS[i % BED_COLORS.length] }));

/** Nap piles: soft spots where several cats sleep together, close enough to touch. Slots are
    offsets in the pile's own frame (turned by `rot`). */
export const NAP_PILES = [
  { id: "blanket", kind: "blanket", x: 7.2, z: 10.6, w: 3.0, d: 2.3, rot: 0.25, y: 0.03,
    slots: [[-0.85, -0.45], [0.05, -0.55], [0.9, -0.35], [-0.55, 0.45], [0.45, 0.5]] },
  { id: "cushion", kind: "cushion", x: -6.4, z: -7.2, r: 1.25, y: 0.16, rot: 0,
    slots: [[-0.45, -0.25], [0.45, -0.2], [0, 0.45]] },
  { id: "mat", kind: "mat", x: 3.6, z: 7.3, w: 2.1, d: 1.4, rot: -0.2, y: 0.02,
    slots: [[-0.5, 0], [0.5, 0.05]] },
  { id: "blanket-2", kind: "blanket", x: -12.2, z: -21.2, w: 3.0, d: 2.3, rot: 0.4, y: 0.03,
    slots: [[-0.85, -0.45], [0.05, -0.55], [0.9, -0.35], [-0.55, 0.45], [0.45, 0.5]] },
  { id: "cushion-2", kind: "cushion", x: 21.0, z: 4.0, r: 1.25, y: 0.16, rot: 0,
    slots: [[-0.45, -0.25], [0.45, -0.2], [0, 0.45]] },
];
/** A nap pile's slot k in garden coordinates. */
export function slotAt(pile, k) {
  const [dx, dz] = pile.slots[k], c = Math.cos(pile.rot || 0), s = Math.sin(pile.rot || 0);
  return { x: pile.x + dx * c + dz * s, z: pile.z - dx * s + dz * c };
}

/** Open, sunny lawn: where cats sunbathe and roll. Two cats can share one, a little apart. */
export const SUN_PATCHES = [
  [3.1, 6.3], [-4.3, 5.1], [10.6, 5.2], [-13.6, 2.3], [0.6, 14.4], [13.0, -6.2], [-7.4, 13.8], [-0.8, -13.8], [9.6, 13.0], [-11.2, -12.0],
  [16.9, 14.1], [-5.8, 21.7], [-20.4, 11.8], [-22.9, -2.0], [-16.1, -17.8], [5.8, -21.7], [18.0, -15.1], [22.5, 0.0],
  [31.0, 9.6], [17.6, 29.0], [-20.8, 27.4], [-33.2, 5.4], [-30.4, -13.2], [-4.4, -33.6], [27.4, -22.4], [7.4, 32.8],
].map(([x, z], i) => ({ id: `sun-${i + 1}`, kind: "sun", x, z, r: 1.3, slots: [[-0.55, 0.2], [0.55, -0.2]] }));

/** Food bowls and water dishes: two feeding corners. A cat stands at `stand` facing `yaw`
    (towards the bowl, and towards the usual view, so its face shows). */
const bowl = (id, x, z, kind = "bowl") => ({ id, kind, x, z, r: kind === "water" ? 0.34 : 0.25, stand: { x, z: z - 0.63 - (kind === "water" ? 0.08 : 0) }, yaw: -HALF_PI });
export const BOWLS = [
  bowl("bowl-1", -3.35, 3.58), bowl("bowl-2", -4.2, 3.58), bowl("bowl-3", 9.1, -3.6), bowl("bowl-4", 9.95, -3.6), bowl("bowl-5", 10.8, -3.6),
  bowl("bowl-6", -18.4, 16.2), bowl("bowl-7", -17.55, 16.2), bowl("bowl-8", 14.2, 19.4), bowl("bowl-9", 15.05, 19.4),
];
export const WATERS = [bowl("water-1", -5.12, 3.46, "water"), bowl("water-2", 11.75, -3.66, "water"), bowl("water-3", -16.63, 16.08, "water"), bowl("water-4", 15.98, 19.28, "water")];
/** The feeding corners' worn earth (for the ground's colour). */
export const FEEDING_CORNERS = [[-4.2, 3.0], [10.4, -4.2], [-17.5, 15.6], [15.1, 18.8]];

/** Cat trees: a base board, a tall post with the top platform and a short one with the low
    platform, set apart so a cat on the low one clears the top one. */
function catTree(id, x, z) {
  return {
    id, kind: "tree",
    base: { minX: x - 0.45, maxX: x + 0.45, minZ: z - 1.05, maxZ: z + 1.05 },
    low: { id: `${id}-low`, x, z: z + 0.52, y: 1.05, r: 0.5 },
    high: { id: `${id}-high`, x, z: z - 0.55, y: 1.95, r: 0.5 },
    ground: { x: x + 1.12, z: z + 0.5 },     // where a cat stands to jump up
    landing: { x: x + 1.15, z: z - 0.7 },    // where it lands jumping down from the top
  };
}
export const TREES = [catTree("tree-1", 4.9, 0.5), catTree("tree-2", -9.2, -4.6), catTree("tree-3", 12.6, 8.6), catTree("tree-4", 5.95, 22.2), catTree("tree-5", 15.5, -18.5)];

/** Balls of yarn: where they start. They roll when played with. */
export const YARNS = [
  { id: "yarn-1", x: 1.75, z: 5.3, r: 0.17, color: 0xe4574a },
  { id: "yarn-2", x: -2.9, z: 7.35, r: 0.17, color: 0x4f86d9 },
  { id: "yarn-3", x: 8.6, z: 6.8, r: 0.17, color: 0xf3b73b },
  { id: "yarn-4", x: -8.4, z: 0.6, r: 0.17, color: 0x8e62c9 },
  { id: "yarn-5", x: 4.4, z: -8.2, r: 0.17, color: 0xe86fa0 },
  { id: "yarn-6", x: -4.2, z: -12.4, r: 0.17, color: 0x46a86c },
  { id: "yarn-7", x: 17.5, z: 10.5, r: 0.17, color: 0xe4574a },
  { id: "yarn-8", x: -16.5, z: 11.5, r: 0.17, color: 0xf3b73b },
  { id: "yarn-9", x: -10.0, z: -17.0, r: 0.17, color: 0x4f86d9 },
  { id: "yarn-10", x: 12.0, z: -20.5, r: 0.17, color: 0xe86fa0 },
];

/** Lantern posts by the porch stairs (unlit by day). */
export const LANTERNS = [
  { id: "lantern-1", x: -1.75, z: 3.3 },
  { id: "lantern-2", x: 0.78, z: 3.3 },
  { id: "lantern-3", x: -1.55, z: 11.6 }, { id: "lantern-4", x: 1.7, z: 18.4 }, { id: "lantern-5", x: -1.45, z: 25.2 },
  { id: "lantern-6", x: 1.6, z: -20.2 }, { id: "lantern-7", x: -1.6, z: -29.4 },
];

/** Flower beds round the cottage: low timber boxes of flowers. */
export const FLOWER_BEDS = [
  { id: "flowers-left", minX: -3.45, maxX: -2.85, minZ: -2.1, maxZ: 1.7 },
  { id: "flowers-front", minX: 1.35, maxX: 3.45, minZ: 3.05, maxZ: 3.62 },
  { id: "flowers-back", minX: -1.8, maxX: 1.8, minZ: -3.62, maxZ: -3.05 },
];

/** The pond: a round pool with lily pads. Cats sit at its edge and watch the water. */
export const POND = { id: "pond", x: -10.6, z: 7.6, r: 3.0 };
/** Places at the pond's edge where a cat sits and watches, facing the water. */
export const POND_SPOTS = [0.35, 1.05, 1.75, 2.45, 3.3, 4.1, 4.9, 5.6].map((a, i) => {
  const d = POND.r + 0.78;
  const x = POND.x + Math.cos(a) * d, z = POND.z + Math.sin(a) * d;
  return { id: `pond-${i + 1}`, x, z, yaw: Math.atan2(-(POND.z - z), POND.x - x) };
});

/** The vegetable and herb patch: raised timber beds with paths between the rows. */
export const VEG_BEDS = [
  { id: "veg-1", minX: 5.4, maxX: 10.6, minZ: -12.4, maxZ: -11.4, crop: "cabbage" },
  { id: "veg-2", minX: 5.4, maxX: 10.6, minZ: -10.3, maxZ: -9.3, crop: "carrot" },
  { id: "veg-3", minX: 5.4, maxX: 10.6, minZ: -8.2, maxZ: -7.2, crop: "herbs" },
  { id: "veg-4", minX: 8.4, maxX: 15.6, minZ: -27.6, maxZ: -26.6, crop: "cabbage" },
  { id: "veg-5", minX: 8.4, maxX: 15.6, minZ: -29.6, maxZ: -28.6, crop: "carrot" },
  { id: "veg-6", minX: 8.4, maxX: 14.4, minZ: -31.6, maxZ: -30.6, crop: "herbs" },
];

/** Bushes inside the garden (obstacles). */
export const BUSHES = [
  { id: "bush-1", x: -3.7, z: -4.8, r: 0.72 },
  { id: "bush-2", x: 2.8, z: -5.4, r: 0.8 },
  { id: "bush-3", x: -14.6, z: 6.6, r: 0.8 },
  { id: "bush-4", x: 14.4, z: 3.6, r: 0.7 },
  { id: "bush-5", x: -6.2, z: 15.2, r: 0.75 },
  { id: "bush-6", x: 13.4, z: -10.2, r: 0.8 },
  { id: "bush-7", x: -15.2, z: -5.6, r: 0.7 },
  { id: "bush-8", x: 23.8, z: 9.5, r: 0.8 },
  { id: "bush-9", x: -23.4, z: 8.3, r: 0.75 },
  { id: "bush-10", x: -3.2, z: 24.6, r: 0.7 },
  { id: "bush-11", x: 21.6, z: -11.5, r: 0.8 },
  { id: "bush-12", x: -22.2, z: -12.8, r: 0.7 },
  { id: "bush-13", x: 7.8, z: -24.5, r: 0.75 },
];

/** Shade trees inside the fence: cats walk round the trunk and under the leaves. */
export const GARDEN_TREES = [
  { id: "gtree-1", x: -13.4, z: -8.4, r: 0.42, s: 1.5 },
  { id: "gtree-2", x: 14.6, z: -3.2, r: 0.42, s: 1.35 },
  { id: "gtree-3", x: 14.6, z: 6.6, r: 0.4, s: 1.25 },
  { id: "gtree-4", x: -11.6, z: 12.8, r: 0.4, s: 1.2 },
  { id: "gtree-5", x: 1.8, z: -15.6, r: 0.42, s: 1.4 },
  { id: "gtree-6", x: 18.7, z: 17.8, r: 0.42, s: 1.4 },
  { id: "gtree-7", x: -22.6, z: 13.5, r: 0.42, s: 1.3 },
  { id: "gtree-8", x: -24.2, z: -5.6, r: 0.4, s: 1.25 },
  { id: "gtree-9", x: 23.9, z: -4.5, r: 0.42, s: 1.45 },
  { id: "gtree-10", x: -4.8, z: -24.6, r: 0.4, s: 1.3 },
  { id: "gtree-11", x: 16.2, z: 25.6, r: 0.42, s: 1.35 },
];

/** A bird bath on the lawn behind the cottage: birds come down to it. */
export const BIRD_BATH = { id: "birdbath", x: 2.6, z: -9.2, r: 0.42, top: 0.98 };

/* ── The outer garden (the band the garden grew by): a kitchen garden with a glasshouse, a potting
   shed, rose arches over the front path, benches and planters. ─────────────────────────────── */

/** The glasshouse beside the kitchen garden (a rectangle; its door faces +x). */
export const GREENHOUSE = { id: "greenhouse", minX: 17.6, maxX: 23.4, minZ: -29.4, maxZ: -25.0, h: 2.3 };
/** The potting shed at the back left. Its door faces +x. */
export const SHED = { id: "shed", minX: -24.2, maxX: -20.2, minZ: -29.0, maxZ: -25.6, h: 2.2 };
/** Rose arches over the front path, near the gate: a post each side. */
export const ROSE_ARCHES = [29.2, 31.8, 34.4].map((z, i) => ({ id: `arch-${i + 1}`, x: 0.15, z, half: 1.05 }));
/** Benches in the garden, and a planter at each end; `yaw` turns the seat to face the cottage. */
export const GARDEN_BENCHES = [[-27.4, 14.2], [27.2, 12.4], [-12.4, 31.2], [-13.6, -31.4]].map(([x, z], i) => ({ id: `gbench-${i + 1}`, x, z, r: 1.0, yaw: Math.atan2(x, z) + Math.PI / 2 }));
export const PLANTERS = GARDEN_BENCHES.flatMap((b) => [-1.45, 1.45].map((s, k) => ({ id: `${b.id}-pot-${k + 1}`, x: b.x + Math.cos(b.yaw) * s, z: b.z - Math.sin(b.yaw) * s, r: 0.36 })));

/* ── The meadow rings round the fence ─────────────────────────────────────── */

/** The two meadow rings round the fence, each an annulus [inner, outer] with a ring path through
    its middle: room kept for the adoptable cats still to come (no cat lives there now). */
export const MEADOW = {
  ring1: { inner: 42, outer: 64, path: 53 },
  ring2: { inner: 68, outer: 104, path: 85 },
};

/** The Hall of Fame: a round paved plaza in the first meadow ring (front right of the cottage),
    where the legendary cat coins that already exist live, apart from the adoptable cats. A fountain
    with a gold coin on a pedestal in the middle, a "Hall of Fame" sign at its garden edge. */
export const HALL_OF_FAME = (() => {
  const x = 37.2, z = 36.0, r = 7.6;
  const toGarden = Math.atan2(-z, -x); // the direction from the plaza towards the cottage
  return {
    id: "hall-of-fame", x, z, r,
    fountain: { x, z, r: 1.75 },
    sign: { x: x + Math.cos(toGarden) * (r - 0.6), z: z + Math.sin(toGarden) * (r - 0.6), w: 4.2, yaw: Math.atan2(-x, -z) },
  };
})();
/** True inside the Hall of Fame plaza (with `pad` more round its edge). */
export const inHall = (x, z, pad = 0) => Math.hypot(x - HALL_OF_FAME.x, z - HALL_OF_FAME.z) < HALL_OF_FAME.r + pad;

/** The second pond, out in the first meadow ring (back right), and the third, which the stream
    runs through (back left, between the rings). Their water is level with the garden (y = 0). */
export const POND2 = { id: "pond-2", x: 45.0, z: -35.5, r: 4.6 };
export const POND3 = { id: "pond-3", x: -58.0, z: -45.0, r: 5.8 };

/** The stream: down from the far hills at the back left, through the third pond, across the back
    meadows and away into the hills on the right. `w` is the width of its bed. */
export const STREAM = {
  w: 2.2,
  pts: [[-460, -350], [-330, -262], [-220, -196], [-150, -146], [-108, -100], [-86, -70], [-70, -55], [-58, -45],
    [-47, -57], [-38, -70], [-26, -92], [-6, -99], [10, -101], [27, -104], [52, -119], [84, -142], [132, -176], [212, -232], [330, -306], [470, -392]],
};
/** The stream's centre line, sampled about every 1.5 units, with a coarse grid to find the nearest samples fast. */
const streamLine = (() => {
  const out = [];
  const P = STREAM.pts, at = (i) => P[Math.max(0, Math.min(P.length - 1, i))];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const n = Math.max(2, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 1.5));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      // A gentle meander on top of the curve.
      out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), z: f(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  out.push({ x: P[P.length - 1][0], z: P[P.length - 1][1] });
  out.forEach((p, i) => { p.i = i; });
  return out;
})();
const SGRID = 12, sgrid = new Map();
for (const p of streamLine) {
  const gx = Math.floor(p.x / SGRID), gz = Math.floor(p.z / SGRID);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const k = `${gx + a},${gz + b}`; if (!sgrid.has(k)) sgrid.set(k, []); sgrid.get(k).push(p); }
}
/** The stream's samples (for drawing it). */
export const streamSamples = () => streamLine;
/** How far (x, z) is from the stream's centre line (Infinity when well away), and the nearest sample. */
export function streamNear(x, z) {
  const list = sgrid.get(`${Math.floor(x / SGRID)},${Math.floor(z / SGRID)}`);
  let best = Infinity, at = null;
  if (list) for (const p of list) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; at = p; } }
  return { d: Math.sqrt(best), at };
}

const ringPath = (r, wobble) => {
  const pts = [];
  for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2; const rr = r + Math.sin(a * 5) * wobble; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  return pts;
};

/** The paths: control points, from the porch out to the gates, the pond and the patch, on through
    the meadows, and the two ring paths. Inside the fence they are gravel with a brick edge; out in
    the meadows, stepping stones in a mown strip. */
export const PATHS = [
  [[-0.5, 3.4], [0.3, 6.4], [-0.9, 9.8], [0.5, 13.6], [0, 17.6], [0.4, 23], [0, 28], [0.3, 34], [0, 40], [0.6, 47], [0, 53], [-0.5, 62], [0.4, 72], [0, 85]],
  [[-0.6, 7.6], [-3.6, 8.9], [-6.2, 8.1], [-7.0, 7.9]],
  [[1.6, 4.2], [5.2, 4.3], [8.6, 1.6], [9.7, -1.8], [8.3, -5.6], [8.0, -6.6]],
  [[-0.4, -3.8], [-1.4, -6.8], [0.6, -11.2], [-0.4, -15], [0, -17.6], [-0.4, -23], [0, -30], [0.5, -38], [0, -45], [-0.6, -53], [0.4, -62], [-0.5, -72], [0.6, -85], [-0.8, -97], [0.4, -106]],
  [[-4.0, 5.2], [-9.4, 3.0], [-14.0, 0.6], [-17.2, -4.6], [-21, -8.4], [-25.6, -10.6], [-31, -11.4], [-37.6, -13.4], [-45, -16.5], [-53, -19.6], [-66, -24], [-85, -30]],
  ringPath(MEADOW.ring1.path, 0.9),
  ringPath(MEADOW.ring2.path, 1.4),
  [[23.4, -21.6], [29.5, -17.8], [33.4, -19.6], [38.2, -25.2], [POND2.x - POND2.r - 1.0, POND2.z + 0.4]],
];
/** Paths 0 to 4 run inside the fence as gravel; the rest are stepping stones only. */
export const GRAVEL = { width: 1.25 };

/** Where birds may come down to rest: the roof ridge and the porch roof (measured on the model). */
export const BIRD_PERCHES = {
  ridge: { from: { x: 0, y: 4.86, z: -1.8 }, to: { x: 0, y: 4.86, z: 0.6 } },
  porchRoof: { from: { x: -1.4, y: 2.42, z: 1.3 }, to: { x: 1.4, y: 2.42, z: 1.3 } },
};

/** Smooth points along a path (Catmull-Rom through its control points), about `step` apart. */
export function pathSamples(ctrl, step = 0.78) {
  const pts = [];
  const P = (i) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push({ x: f(p0[0], p1[0], p2[0], p3[0]), z: f(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  const last = ctrl[ctrl.length - 1];
  pts.push({ x: last[0], z: last[1] });
  return pts;
}

/** Where the fence has a gap (angle in degrees from +x towards +z). */
export function inGate(deg) {
  const a = ((deg % 360) + 360) % 360;
  return GARDEN.gates.some(([f, t]) => a > f && a < t);
}

/** Every obstacle a cat must walk round. */
export function obstacles() {
  return [
    { id: "house", type: "rect", minX: HOUSE.minX, maxX: HOUSE.maxX, minZ: HOUSE.minZ, maxZ: HOUSE.maxZ },
    ...TREES.map((t) => ({ id: t.id, type: "rect", ...t.base })),
    ...FLOWER_BEDS.map((f) => ({ id: f.id, type: "rect", minX: f.minX, maxX: f.maxX, minZ: f.minZ, maxZ: f.maxZ })),
    ...VEG_BEDS.map((f) => ({ id: f.id, type: "rect", minX: f.minX, maxX: f.maxX, minZ: f.minZ, maxZ: f.maxZ })),
    ...BEDS.map((b) => ({ id: b.id, type: "circle", x: b.x, z: b.z, r: b.r })),
    ...[...BOWLS, ...WATERS].map((b) => ({ id: b.id, type: "circle", x: b.x, z: b.z, r: b.r })),
    ...LANTERNS.map((l) => ({ id: l.id, type: "circle", x: l.x, z: l.z, r: 0.16 })),
    ...BUSHES.map((b) => ({ id: b.id, type: "circle", x: b.x, z: b.z, r: b.r })),
    ...GARDEN_TREES.map((b) => ({ id: b.id, type: "circle", x: b.x, z: b.z, r: b.r })),
    { id: POND.id, type: "circle", x: POND.x, z: POND.z, r: POND.r + 0.25 },
    { id: BIRD_BATH.id, type: "circle", x: BIRD_BATH.x, z: BIRD_BATH.z, r: BIRD_BATH.r },
    { id: GREENHOUSE.id, type: "rect", minX: GREENHOUSE.minX, maxX: GREENHOUSE.maxX, minZ: GREENHOUSE.minZ, maxZ: GREENHOUSE.maxZ },
    { id: SHED.id, type: "rect", minX: SHED.minX, maxX: SHED.maxX, minZ: SHED.minZ, maxZ: SHED.maxZ },
    ...ROSE_ARCHES.flatMap((a) => [-1, 1].map((s) => ({ id: `${a.id}-${s}`, type: "circle", x: a.x + s * a.half, z: a.z, r: 0.14 }))),
    ...GARDEN_BENCHES.map((b) => ({ id: b.id, type: "circle", x: b.x, z: b.z, r: b.r })),
    ...PLANTERS.map((p) => ({ id: p.id, type: "circle", x: p.x, z: p.z, r: p.r })),
    // Research HQ by the porch (research.js): the desk and its stool, and the map board.
    { id: "research-desk", type: "circle", x: -3.35, z: 3.45, r: 0.75 },
    { id: "research-board", type: "circle", x: -4.2, z: 2.75, r: 0.65 },
  ];
}

/* ── The meadows: ground, trees, benches, walls, the ponds and the stream ───────────────────── */

export function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/** The land before the stream, the ponds and the plaza are cut into it. */
function landHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r < 40) return 0;
  const a = Math.atan2(z, x);
  const near = smooth(40, 112, r) * (1.3 + 1.1 * Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06 - 0.4) + 0.6 * Math.sin(x * 0.031 - z * 0.045) + 0.25 * Math.sin(x * 0.21 + z * 0.17));
  const hills = smooth(104, 240, r) * (9 + 7.5 * Math.sin(a * 3 + 0.7) + 4.5 * Math.sin(a * 7 - 1.1) + 3 * Math.sin(r * 0.03 + a * 2) + 1.4 * Math.sin(x * 0.09 - z * 0.07));
  const ridge = smooth(270, 460, r) * (30 + 14 * Math.sin(a * 5 + 0.3) + 8 * Math.sin(a * 11 + 2.1) + 5 * Math.sin(a * 17));
  return Math.max(0, near) + Math.max(0, hills) + Math.max(0, ridge);
}

/** The stream's water level at a sample of its centre line (cached). */
const waterCache = new Map();
export function streamWater(p) {
  let y = waterCache.get(p.i);
  if (y === undefined) {
    const d3 = Math.hypot(p.x - POND3.x, p.z - POND3.z);
    y = landHeight(p.x, p.z) * flatten(p.x, p.z) - 0.28;
    if (d3 < POND3.r + 10) y = Math.min(y, -0.04 + (d3 - POND3.r) * 0.05);
    y = Math.max(y, -0.04);
    waterCache.set(p.i, y);
  }
  return y;
}
/** 0 where the plaza and the ponds need level ground, 1 where the land keeps its shape. */
function flatten(x, z) {
  let k = 1;
  const d2 = Math.hypot(x - POND2.x, z - POND2.z);
  if (d2 < POND2.r + 9) k *= smooth(POND2.r + 0.6, POND2.r + 9, d2);
  const d3 = Math.hypot(x - POND3.x, z - POND3.z);
  if (d3 < POND3.r + 11) k *= smooth(POND3.r + 0.6, POND3.r + 11, d3);
  const dh = Math.hypot(x - HALL_OF_FAME.x, z - HALL_OF_FAME.z);
  if (dh < HALL_OF_FAME.r + 9) k *= smooth(HALL_OF_FAME.r + 0.4, HALL_OF_FAME.r + 9, dh);
  return k;
}

/** The ground's height at (x, z): flat in the garden and just outside the fence, then meadows
    gently rolling up to wooded hills and a far ridge; level round the ponds and the plaza, with
    the stream's bed cut through it and a basin under each pond. */
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = r < 40 ? 0 : landHeight(x, z) * flatten(x, z);
  // Pond basins (the water sits at y = -0.04).
  const d1 = Math.hypot(x - POND.x, z - POND.z);
  if (d1 < POND.r + 0.2) h = Math.min(h, -0.55 * (1 - smooth(POND.r - 1.4, POND.r + 0.2, d1)));
  for (const P of [POND2, POND3]) {
    const d = Math.hypot(x - P.x, z - P.z);
    if (d < P.r + 0.3) h = Math.min(h, -0.7 * (1 - smooth(P.r - 1.8, P.r + 0.3, d)));
  }
  // The stream's bed.
  if (r > 44) {
    const s = streamNear(x, z);
    if (s.d < STREAM.w * 0.5 + 3.2) {
      const bed = streamWater(s.at) - 0.45;
      const k = 1 - smooth(STREAM.w * 0.5 - 0.4, STREAM.w * 0.5 + 3.2, s.d);
      h = h + (Math.min(h, bed) - h) * k;
    }
  }
  return h;
}

/** Where a path crosses the stream: a wooden footbridge, along the path, over the water. */
export const BRIDGES = (() => {
  const out = [];
  PATHS.forEach((p, pi) => {
    const pts = pathSamples(p, 0.5);
    let run = null;
    pts.forEach((q, k) => {
      const s = streamNear(q.x, q.z);
      const wet = s.d < STREAM.w * 0.5 + 2.4 && Math.hypot(q.x, q.z) > 44 && Math.hypot(q.x - POND3.x, q.z - POND3.z) > POND3.r + 2;
      if (wet) { if (!run) run = { from: k, best: k, d: s.d }; if (s.d < run.d) { run.best = k; run.d = s.d; } run.to = k; }
      else if (run) { out.push(bridgeAt(pts, run, pi)); run = null; }
    });
    if (run) out.push(bridgeAt(pts, run, pi));
  });
  function bridgeAt(pts, run, pi) {
    const a = pts[Math.max(0, run.from - 2)], b = pts[Math.min(pts.length - 1, run.to + 2)], c = pts[run.best];
    const len = Math.hypot(b.x - a.x, b.z - a.z) + 1.0;
    const s = streamNear(c.x, c.z);
    return { id: `bridge-${out.length + 1}`, path: pi, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, len, yaw: Math.atan2(-(b.z - a.z), b.x - a.x), water: streamWater(s.at), w: 1.7 };
  }
  return out;
})();
/** True on a bridge's deck (with `pad` more). */
export function onBridge(x, z, pad = 0) {
  for (const b of BRIDGES) {
    const dx = x - b.x, dz = z - b.z, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    const u = dx * c - dz * s, v = dx * s + dz * c;
    if (Math.abs(u) < b.len / 2 + pad && Math.abs(v) < b.w / 2 + pad) return true;
  }
  return false;
}

/** True in water: a pond, or the stream. */
export function inWater(x, z, pad = 0) {
  for (const P of [POND, POND2, POND3]) if (Math.hypot(x - P.x, z - P.z) < P.r + pad) return true;
  if (Math.hypot(x, z) > 44 && streamNear(x, z).d < STREAM.w * 0.5 + 1.1 + pad) return true;
  return false;
}

/** Every stepping stone's spot (the paths sampled), cached. Not on the plaza (it is paved), in the
    water, on a bridge, or on the gravel inside the fence. */
let stoneCache = null;
export function pathStones() {
  if (!stoneCache) stoneCache = PATHS.flatMap((p, i) => pathSamples(p, i === 0 ? 0.8 : 0.85).map((s) => ({ ...s, path: i })))
    .filter((s) => !inHall(s.x, s.z, -0.2) && !inWater(s.x, s.z, 0.5) && !onBridge(s.x, s.z, 0.3));
  return stoneCache;
}
/** The gravel paths' centre lines inside the fence (the first five paths, sampled). */
let gravelCache = null;
export function gravelPoints() {
  if (!gravelCache) gravelCache = PATHS.slice(0, 5).concat([PATHS[7]]).flatMap((p) => pathSamples(p, 0.5)).filter((s) => Math.hypot(s.x, s.z) < GARDEN.fenceR + 0.8);
  return gravelCache;
}
const pathGrid = new Map();
function nearPath(x, z, d) {
  if (!pathGrid.size) for (const s of pathStones().concat(gravelPoints())) {
    const k = `${Math.floor(s.x / 6)},${Math.floor(s.z / 6)}`;
    if (!pathGrid.has(k)) pathGrid.set(k, []);
    pathGrid.get(k).push(s);
  }
  const gx = Math.floor(x / 6), gz = Math.floor(z / 6);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const list = pathGrid.get(`${gx + a},${gz + b}`);
    if (list) for (const s of list) if (Math.abs(s.x - x) < d && Math.abs(s.z - z) < d && Math.hypot(s.x - x, s.z - z) < d) return true;
  }
  for (const b of BRIDGES) if (Math.hypot(b.x - x, b.z - z) < b.len / 2 + d) return true;
  return false;
}
export { nearPath };

/** Benches along the ring paths, facing across them: meadow cats walk round them. */
export const BENCHES = [
  ...[30, 120, 210, 300].map((deg, i) => ({ ring: 1, deg, i })),
  ...[70, 160, 250, 340].map((deg, i) => ({ ring: 2, deg, i })),
].map(({ ring, deg, i }) => {
  const a = (deg * Math.PI) / 180, r = (ring === 1 ? MEADOW.ring1.path : MEADOW.ring2.path) + 2.1;
  return { id: `bench-${ring}-${i + 1}`, x: Math.cos(a) * r, z: Math.sin(a) * r, r: 1.0, yaw: -a + Math.PI / 2, faceX: -Math.cos(a), faceZ: -Math.sin(a) };
});

/** Flower fields in the meadows: lavender, poppies, buttercups, cornflowers, daisies and mixed ones. */
export const FLOWER_FIELDS = [
  { x: -49.0, z: 28.5, rx: 8, rz: 5, cols: "lavender", n: 1100 },
  { x: 55.5, z: 16.5, rx: 7.5, rz: 5, cols: "poppy", n: 1000 },
  { x: -24.4, z: -55.2, rx: 8, rz: 4.5, cols: "buttercup", n: 1000 },
  { x: 15.0, z: 56.5, rx: 7, rz: 4.5, cols: "mixed", n: 900 },
  { x: -12.0, z: 75.5, rx: 10, rz: 5.5, cols: "pink", n: 1100 },
  { x: 38.0, z: -80.5, rx: 10, rz: 5.5, cols: "cornflower", n: 1000 },
  { x: -92.0, z: 6.0, rx: 6.5, rz: 10, cols: "lavender", n: 1100 },
  { x: 66.0, z: 64.0, rx: 9, rz: 6.5, cols: "poppy", n: 1100 },
  { x: -64.0, z: 60.0, rx: 9, rz: 6.5, cols: "daisy", n: 1100 },
  { x: 90.0, z: -12.0, rx: 7, rz: 9, cols: "buttercup", n: 1000 },
  { x: 22.0, z: -58.0, rx: 6.5, rz: 4.2, cols: "daisy", n: 800 },
];

/** Dry-stone walls through the meadows: field boundaries, each a list of points, broken where a path or the stream passes. */
export const WALLS = (() => {
  const arc = (r, a0, a1) => { const out = []; for (let a = a0; a <= a1 + 1e-6; a += 2) out.push([Math.cos((a * Math.PI) / 180) * r, Math.sin((a * Math.PI) / 180) * r]); return out; };
  return [arc(65.6, 100, 190), arc(65.6, 20, 70), arc(66.2, 215, 250), arc(106, 150, 330), arc(106, -20, 60),
    [[44, 12], [52, 20], [60, 23], [66, 22]], [[-44, 40], [-52, 44], [-60, 42]], [[70, -48], [82, -60], [90, -72]]];
})();
let wallGrid = null;
function nearWall(x, z, d) {
  if (!wallGrid) {
    // Each wall segment filed under every 8-unit cell it passes near.
    wallGrid = new Map();
    for (const w of WALLS) for (let i = 0; i < w.length - 1; i++) {
      const [ax, az] = w[i], [bx, bz] = w[i + 1];
      const x0 = Math.floor((Math.min(ax, bx) - 4) / 8), x1 = Math.floor((Math.max(ax, bx) + 4) / 8), z0 = Math.floor((Math.min(az, bz) - 4) / 8), z1 = Math.floor((Math.max(az, bz) + 4) / 8);
      for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) { const k = `${gx},${gz}`; if (!wallGrid.has(k)) wallGrid.set(k, []); wallGrid.get(k).push([ax, az, bx, bz]); }
    }
  }
  const list = wallGrid.get(`${Math.floor(x / 8)},${Math.floor(z / 8)}`);
  if (!list) return false;
  for (const [ax, az, bx, bz] of list) {
    const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    if (Math.hypot(ax + vx * t - x, az + vz * t - z) < d) return true;
  }
  return false;
}
export { nearWall };

/** Trees scattered through the meadow rings, clear of the paths, the benches, the ponds and the
    stream. `kind`: oak, birch, cherry (in blossom) or apple (in fruit). */
export const MEADOW_TREES = (() => {
  const rnd = makeRandom("meadow-trees-v2");
  const out = [];
  for (let t = 0; t < 4000 && out.length < 150; t++) {
    const r = rnd.range(MEADOW.ring1.inner - 1, MEADOW.ring2.outer + 6), a = rnd.range(0, Math.PI * 2);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    // Keep a clear view over the front meadow, from the cottage to the gate and beyond.
    if (z > 0 && Math.abs(x) < 10 + r * 0.2 && r < 80) continue;
    if (nearPath(x, z, 3.0)) continue;
    if (inWater(x, z, 3.2)) continue;
    if (BENCHES.some((b) => Math.hypot(b.x - x, b.z - z) < 4)) continue;
    if (inHall(x, z, 4)) continue;
    if (nearWall(x, z, 2.2)) continue;
    if (FLOWER_FIELDS.some((f) => ((x - f.x) / (f.rx + 1.5)) ** 2 + ((z - f.z) / (f.rz + 1.5)) ** 2 < 1)) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 5.6)) continue;
    const s = rnd.range(1.1, 1.8);
    const roll = rnd.next();
    const kind = roll < 0.44 ? "oak" : roll < 0.66 ? "birch" : roll < 0.84 ? "cherry" : "apple";
    out.push({ id: `mtree-${out.length + 1}`, x, z, r: 0.5 * s, s, kind, blossom: kind === "cherry" });
  }
  return out;
})();

/** Flowering bushes and shrubs dotted through the meadows (meadow cats walk round them). */
export const MEADOW_BUSHES = (() => {
  const rnd = makeRandom("meadow-bushes-v2");
  const out = [];
  for (let t = 0; t < 5000 && out.length < 130; t++) {
    const r = rnd.range(MEADOW.ring1.inner, MEADOW.ring2.outer + 3), a = rnd.range(0, Math.PI * 2);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (nearPath(x, z, 2.0)) continue;
    if (inWater(x, z, 2.0)) continue;
    if (BENCHES.some((b) => Math.hypot(b.x - x, b.z - z) < 3)) continue;
    if (inHall(x, z, 2.5)) continue;
    if (nearWall(x, z, 1.5)) continue;
    if (MEADOW_TREES.some((o) => Math.hypot(o.x - x, o.z - z) < 3)) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 4.5)) continue;
    out.push({ id: `mbush-${out.length + 1}`, x, z, r: rnd.range(0.6, 1.05), flowers: rnd.chance(0.55) ? rnd.pick([0xf29bb2, 0xfbe3ea, 0xf6d04d, 0xc9a6f0, 0xffffff]) : null });
  }
  return out;
})();

/** Places at the second pond's edge where a meadow cat sits and watches the water. */
export const POND2_SPOTS = [0.3, 1.2, 2.1, 3.0, 4.2, 5.2].map((a, i) => {
  const d = POND2.r + 0.8;
  const x = POND2.x + Math.cos(a) * d, z = POND2.z + Math.sin(a) * d;
  return { id: `pond2-${i + 1}`, x, z, yaw: Math.atan2(-(POND2.z - z), POND2.x - x) };
});

/** True when a Hall of Fame cat can stand at (x, z) with `pad` of room: on the plaza, clear of
    the fountain and the sign. */
export function hallFree(x, z, pad = 0.5) {
  const H = HALL_OF_FAME, d = Math.hypot(x - H.x, z - H.z);
  if (d > H.r - pad || d < H.fountain.r + pad) return false;
  return Math.hypot(x - H.sign.x, z - H.sign.z) > 1.2 + pad;
}

/** True when a meadow cat can stand at (x, z) with `pad` of room: in a ring, clear of trees, benches, walls and water. */
export function meadowFree(x, z, pad = 0.5) {
  const r = Math.hypot(x, z);
  if (r < MEADOW.ring1.inner - 0.5 || r > MEADOW.ring2.outer + 0.5) return false;
  if (inWater(x, z, 0.3 + pad) && !onBridge(x, z)) return false;
  if (nearWall(x, z, 0.5 + pad)) return false;
  for (const t of MEADOW_TREES) if (Math.abs(t.x - x) < 3 && Math.abs(t.z - z) < 3 && Math.hypot(t.x - x, t.z - z) < t.r + pad) return false;
  for (const b of BENCHES) if (Math.hypot(b.x - x, b.z - z) < b.r + pad) return false;
  for (const b of MEADOW_BUSHES) if (Math.abs(b.x - x) < 2 && Math.abs(b.z - z) < 2 && Math.hypot(b.x - x, b.z - z) < b.r + pad) return false;
  return true;
}
