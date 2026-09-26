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
export const GARDEN = { walkR: 26, fenceR: 27.6, gates: [[86, 94], [266, 274], [196, 205]] };

const HALF_PI = Math.PI / 2;

/** The bottom step of the porch stairs: a perch a cat hops up to. Heights are the step tops. */
export const STEP = { id: "step", kind: "step", x: 0.4, z: 2.6, y: 0.23, sitYaw: -HALF_PI, ground: { x: -0.5, z: 3.32 } };

/** Round cat beds: r is the outer rim, y the cushion a cat lies on. */
const BED_COLORS = [0xe98a6b, 0x7fb3d5, 0xf2c14e, 0xa98bd4, 0x8cc084, 0xf29bb2];
export const BEDS = [
  [4.75, 4.35], [-2.1, 6.15], [-5.2, -2.3], [4.6, -3.3], [7.9, 2.6], [-7.3, 3.4],
  [2.3, 10.4], [-4.6, 12.2], [12.2, -1.2], [-12.6, -2.2], [4.4, -13.4], [-2.8, -9.8],
  [19.7, 7.2], [10.5, 18.2], [-11.8, 16.8], [-19.7, 7.2], [-14.8, -14.8], [10.5, -18.2], [19.5, -9.1], [-7.5, -23.2],
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
  { id: "gtree-11", x: 11.9, z: 22.6, r: 0.42, s: 1.35 },
];

/** A bird bath on the lawn behind the cottage: birds come down to it. */
export const BIRD_BATH = { id: "birdbath", x: 2.6, z: -9.2, r: 0.42, top: 0.98 };

/* ── The meadow rings round the fence ─────────────────────────────────────── */

/** The two meadow rings round the fence, each an annulus [inner, outer] with a ring path through
    its middle: room kept for the adoptable cats still to come (no cat lives there now). */
export const MEADOW = {
  ring1: { inner: 32, outer: 50, path: 40.5 },
  ring2: { inner: 53.5, outer: 82, path: 66 },
};

/** The Hall of Fame: a round paved plaza in the first meadow ring (front right of the cottage),
    where the legendary cat coins that already exist live, apart from the adoptable cats. A fountain
    with a gold coin on a pedestal in the middle, a "Hall of Fame" sign at its garden edge. */
export const HALL_OF_FAME = (() => {
  const x = 28.6, z = 27.6, r = 7.2;
  const toGarden = Math.atan2(-z, -x); // the direction from the plaza towards the cottage
  return {
    id: "hall-of-fame", x, z, r,
    fountain: { x, z, r: 1.75 },
    sign: { x: x + Math.cos(toGarden) * (r - 0.6), z: z + Math.sin(toGarden) * (r - 0.6), w: 4.2, yaw: Math.atan2(-x, -z) },
  };
})();
/** True inside the Hall of Fame plaza (with `pad` more round its edge). */
export const inHall = (x, z, pad = 0) => Math.hypot(x - HALL_OF_FAME.x, z - HALL_OF_FAME.z) < HALL_OF_FAME.r + pad;

/** The second pond, out in the first meadow ring. */
export const POND2 = { id: "pond-2", x: 34.7, z: -27.1, r: 4.0 };

const ringPath = (r, wobble) => {
  const pts = [];
  for (let k = 0; k <= 36; k++) { const a = (k / 36) * Math.PI * 2; const rr = r + Math.sin(a * 5) * wobble; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  return pts;
};

/** The stepping-stone paths: control points, from the porch out to the gates, the pond and the
    patch, on through the meadows, and the two ring paths. */
export const PATHS = [
  [[-0.5, 3.4], [0.3, 6.4], [-0.9, 9.8], [0.5, 13.6], [0, 17.6], [0.4, 23], [0, 28], [0.5, 34], [0, 40.5], [-0.5, 52], [0.4, 60], [0, 66]],
  [[-0.6, 7.6], [-3.6, 8.9], [-6.2, 8.1], [-7.0, 7.9]],
  [[1.6, 4.2], [5.2, 4.3], [8.6, 1.6], [9.7, -1.8], [8.3, -5.6], [8.0, -6.6]],
  [[-0.4, -3.8], [-1.4, -6.8], [0.6, -11.2], [-0.4, -15], [0, -17.6], [-0.4, -23], [0, -28], [0.5, -34], [0, -40.5], [-0.5, -52], [0, -66]],
  [[-4.0, 5.2], [-9.4, 3.0], [-14.0, 0.6], [-17.2, -4.6], [-21, -8.4], [-25.6, -10.6], [-31, -12.6], [-37.6, -15.3], [-48, -19.5], [-61, -24.8]],
  ringPath(MEADOW.ring1.path, 0.8),
  ringPath(MEADOW.ring2.path, 1.2),
  [[29.3, -30.6], [31.2, -28.8], [POND2.x - POND2.r - 0.9, POND2.z - 0.5]],
];

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
  ];
}

/* ── The meadows: ground, trees, benches, the second pond ───────────────────── */

export function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/** The ground's height at (x, z): flat in the garden and just outside the fence, then meadows
    gently rolling up to hills and a far ridge (flat again round the second pond). */
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r < 30) return 0;
  const a = Math.atan2(z, x);
  const near = smooth(30, 95, r) * (0.7 + 0.8 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 - 0.4) + 0.4 * Math.sin(x * 0.05 - z * 0.07));
  const hills = smooth(88, 190, r) * (3.5 + 4.5 * Math.sin(a * 3 + 0.7) + 3 * Math.sin(a * 7 - 1.1) + 2 * Math.sin(r * 0.04 + a * 2));
  const ridge = smooth(240, 370, r) * (13 + 8 * Math.sin(a * 5 + 0.3) + 5 * Math.sin(a * 11 + 2.1) + 3 * Math.sin(a * 17));
  let h = Math.max(0, near) + Math.max(0, hills) + Math.max(0, ridge);
  const dp = Math.hypot(x - POND2.x, z - POND2.z);
  if (dp < POND2.r + 7) h *= smooth(POND2.r + 0.6, POND2.r + 7, dp);
  const dh = Math.hypot(x - HALL_OF_FAME.x, z - HALL_OF_FAME.z);
  if (dh < HALL_OF_FAME.r + 8) h *= smooth(HALL_OF_FAME.r + 0.4, HALL_OF_FAME.r + 8, dh);
  return h;
}

/** Every stepping stone's spot (the paths sampled), cached. */
let stoneCache = null;
export function pathStones() {
  if (!stoneCache) stoneCache = PATHS.flatMap((p, i) => pathSamples(p, i === 0 ? 0.8 : 0.85)).filter((s) => !inHall(s.x, s.z, -0.2)); // the plaza is paved
  return stoneCache;
}
function nearPath(x, z, d) {
  for (const s of pathStones()) if (Math.abs(s.x - x) < d && Math.abs(s.z - z) < d && Math.hypot(s.x - x, s.z - z) < d) return true;
  return false;
}

/** Benches along the ring paths, facing across them: meadow cats walk round them. */
export const BENCHES = [
  ...[30, 120, 210, 300].map((deg, i) => ({ ring: 1, deg, i })),
  ...[70, 160, 250, 340].map((deg, i) => ({ ring: 2, deg, i })),
].map(({ ring, deg, i }) => {
  const a = (deg * Math.PI) / 180, r = (ring === 1 ? MEADOW.ring1.path : MEADOW.ring2.path) + 2.1;
  return { id: `bench-${ring}-${i + 1}`, x: Math.cos(a) * r, z: Math.sin(a) * r, r: 1.0, yaw: -a + Math.PI / 2, faceX: -Math.cos(a), faceZ: -Math.sin(a) };
});

/** Flower fields in the meadows: lavender, poppies, buttercups and mixed ones. */
export const FLOWER_FIELDS = [
  { x: -39.0, z: 22.5, rx: 7, rz: 4.5, cols: "lavender", n: 900 },
  { x: 44.5, z: 13.5, rx: 6.5, rz: 4.5, cols: "poppy", n: 800 },
  { x: -19.4, z: -44.2, rx: 7, rz: 4, cols: "buttercup", n: 800 },
  { x: 12.0, z: 45.5, rx: 6, rz: 4, cols: "mixed", n: 700 },
  { x: -10.0, z: 58.5, rx: 9, rz: 5, cols: "pink", n: 900 },
  { x: 36.0, z: -62.5, rx: 9, rz: 5, cols: "buttercup", n: 900 },
  { x: -74.0, z: 4.0, rx: 6, rz: 9, cols: "lavender", n: 900 },
  { x: 52.0, z: 52.0, rx: 8, rz: 6, cols: "poppy", n: 900 },
  { x: -50.0, z: -50.0, rx: 8, rz: 6, cols: "mixed", n: 900 },
];

/** Trees scattered through the meadow rings, clear of the paths, the benches and the pond. */
export const MEADOW_TREES = (() => {
  const rnd = makeRandom("meadow-trees-v1");
  const out = [];
  for (let t = 0; t < 2000 && out.length < 96; t++) {
    const r = rnd.range(MEADOW.ring1.inner - 1, MEADOW.ring2.outer + 4), a = rnd.range(0, Math.PI * 2);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    // Keep a clear view over the front meadow, from the cottage to the gate and beyond.
    if (z > 0 && Math.abs(x) < 9 + r * 0.2 && r < 60) continue;
    if (nearPath(x, z, 3.0)) continue;
    if (Math.hypot(x - POND2.x, z - POND2.z) < POND2.r + 3.5) continue;
    if (BENCHES.some((b) => Math.hypot(b.x - x, b.z - z) < 4)) continue;
    if (inHall(x, z, 3.5)) continue;
    if (FLOWER_FIELDS.some((f) => ((x - f.x) / (f.rx + 1.5)) ** 2 + ((z - f.z) / (f.rz + 1.5)) ** 2 < 1)) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 5.2)) continue;
    const s = rnd.range(1.1, 1.8);
    out.push({ id: `mtree-${out.length + 1}`, x, z, r: 0.5 * s, s, blossom: rnd.chance(0.14) });
  }
  return out;
})();

/** Flowering bushes and shrubs dotted through the meadows (meadow cats walk round them). */
export const MEADOW_BUSHES = (() => {
  const rnd = makeRandom("meadow-bushes-v1");
  const out = [];
  for (let t = 0; t < 3000 && out.length < 90; t++) {
    const r = rnd.range(MEADOW.ring1.inner, MEADOW.ring2.outer + 3), a = rnd.range(0, Math.PI * 2);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (nearPath(x, z, 2.0)) continue;
    if (Math.hypot(x - POND2.x, z - POND2.z) < POND2.r + 2.5) continue;
    if (BENCHES.some((b) => Math.hypot(b.x - x, b.z - z) < 3)) continue;
    if (inHall(x, z, 2)) continue;
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

/** True when a meadow cat can stand at (x, z) with `pad` of room: in a ring, clear of trees, benches and the pond. */
export function meadowFree(x, z, pad = 0.5) {
  const r = Math.hypot(x, z);
  if (r < MEADOW.ring1.inner - 0.5 || r > MEADOW.ring2.outer + 0.5) return false;
  if (Math.hypot(x - POND2.x, z - POND2.z) < POND2.r + 0.3 + pad) return false;
  for (const t of MEADOW_TREES) if (Math.abs(t.x - x) < 3 && Math.abs(t.z - z) < 3 && Math.hypot(t.x - x, t.z - z) < t.r + pad) return false;
  for (const b of BENCHES) if (Math.hypot(b.x - x, b.z - z) < b.r + pad) return false;
  for (const b of MEADOW_BUSHES) if (Math.abs(b.x - x) < 2 && Math.abs(b.z - z) < 2 && Math.hypot(b.x - x, b.z - z) < b.r + pad) return false;
  return true;
}
