/* Where everything in the garden is. One source for both the scenery (garden.js draws it)
   and the cats (cats.js uses it to find beds, bowls, perches and a way round).

   Axes: x to the right of the cottage, z towards its porch (the cottage's front faces +z),
   y up. One unit is roughly the height of a small door. Headings ("yaw") follow the cat
   models, which face +x: yaw 0 faces +x, and a cat moves along (cos yaw, -sin yaw).

   The garden is wide: ninety-odd cats live in it at once, so there are many beds, three cat
   trees, two feeding corners, a pond, a vegetable patch, sunny lawns and nap piles. */

/** Cat size: a sitting cat is `size` units tall; the other poses are fitted to match. */
export const CAT = { size: 1.2, bodyR: 0.3, clearR: 0.42, personal: 1.0 };

/** The cottage, scaled to `height` and centred. Its footprint (with the porch stairs) was
    measured by casting rays down onto sanctuary.glb at that scale. */
export const HOUSE = { height: 5.2, minX: -2.8, maxX: 2.8, minZ: -2.6, maxZ: 2.6 };

/** Cats keep inside walkR; the fence runs all the way round at fenceR, with a gate where each
    path leaves (angles in degrees, measured from +x towards +z). */
export const GARDEN = { walkR: 17, fenceR: 18.6, gates: [[85, 95], [265, 275], [193, 203]] };

const HALF_PI = Math.PI / 2;

/** The bottom step of the porch stairs: a perch a cat hops up to. Heights are the step tops. */
export const STEP = { id: "step", kind: "step", x: 0.4, z: 2.6, y: 0.23, sitYaw: -HALF_PI, ground: { x: -0.5, z: 3.32 } };

/** Round cat beds: r is the outer rim, y the cushion a cat lies on. */
const BED_COLORS = [0xe98a6b, 0x7fb3d5, 0xf2c14e, 0xa98bd4, 0x8cc084, 0xf29bb2];
export const BEDS = [
  [4.75, 4.35], [-2.1, 6.15], [-5.2, -2.3], [4.6, -3.3], [7.9, 2.6], [-7.3, 3.4],
  [2.3, 10.4], [-4.6, 12.2], [12.2, -1.2], [-12.6, -2.2], [4.4, -13.4], [-2.8, -9.8],
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
];
/** A nap pile's slot k in garden coordinates. */
export function slotAt(pile, k) {
  const [dx, dz] = pile.slots[k], c = Math.cos(pile.rot || 0), s = Math.sin(pile.rot || 0);
  return { x: pile.x + dx * c + dz * s, z: pile.z - dx * s + dz * c };
}

/** Open, sunny lawn: where cats sunbathe and roll. Two cats can share one, a little apart. */
export const SUN_PATCHES = [
  [3.1, 6.3], [-4.3, 5.1], [10.6, 5.2], [-13.6, 2.3], [0.6, 14.4], [13.0, -6.2], [-7.4, 13.8], [-0.8, -13.8], [9.6, 13.0], [-11.2, -12.0],
].map(([x, z], i) => ({ id: `sun-${i + 1}`, kind: "sun", x, z, r: 1.3, slots: [[-0.55, 0.2], [0.55, -0.2]] }));

/** Food bowls and water dishes: two feeding corners. A cat stands at `stand` facing `yaw`
    (towards the bowl, and towards the usual view, so its face shows). */
const bowl = (id, x, z, kind = "bowl") => ({ id, kind, x, z, r: kind === "water" ? 0.34 : 0.25, stand: { x, z: z - 0.63 - (kind === "water" ? 0.08 : 0) }, yaw: -HALF_PI });
export const BOWLS = [bowl("bowl-1", -3.35, 3.58), bowl("bowl-2", -4.2, 3.58), bowl("bowl-3", 9.1, -3.6), bowl("bowl-4", 9.95, -3.6), bowl("bowl-5", 10.8, -3.6)];
export const WATERS = [bowl("water-1", -5.12, 3.46, "water"), bowl("water-2", 11.75, -3.66, "water")];

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
export const TREES = [catTree("tree-1", 4.9, 0.5), catTree("tree-2", -9.2, -4.6), catTree("tree-3", 12.6, 8.6)];

/** Balls of yarn: where they start. They roll when played with. */
export const YARNS = [
  { id: "yarn-1", x: 1.75, z: 5.3, r: 0.17, color: 0xe4574a },
  { id: "yarn-2", x: -2.9, z: 7.35, r: 0.17, color: 0x4f86d9 },
  { id: "yarn-3", x: 8.6, z: 6.8, r: 0.17, color: 0xf3b73b },
  { id: "yarn-4", x: -8.4, z: 0.6, r: 0.17, color: 0x8e62c9 },
  { id: "yarn-5", x: 4.4, z: -8.2, r: 0.17, color: 0xe86fa0 },
  { id: "yarn-6", x: -4.2, z: -12.4, r: 0.17, color: 0x46a86c },
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
];

/** Shade trees inside the fence: cats walk round the trunk and under the leaves. */
export const GARDEN_TREES = [
  { id: "gtree-1", x: -13.4, z: -8.4, r: 0.42, s: 1.5 },
  { id: "gtree-2", x: 14.6, z: -3.2, r: 0.42, s: 1.35 },
  { id: "gtree-3", x: 14.6, z: 6.6, r: 0.4, s: 1.25 },
  { id: "gtree-4", x: -11.6, z: 12.8, r: 0.4, s: 1.2 },
  { id: "gtree-5", x: 1.8, z: -15.6, r: 0.42, s: 1.4 },
];

/** A bird bath on the lawn behind the cottage: birds come down to it. */
export const BIRD_BATH = { id: "birdbath", x: 2.6, z: -9.2, r: 0.42, top: 0.98 };

/** The stepping-stone paths: control points, from the porch out to the gates, the pond and the patch. */
export const PATHS = [
  [[-0.5, 3.4], [0.3, 6.4], [-0.9, 9.8], [0.5, 13.6], [0, 17.6], [0, 23]],
  [[-0.6, 7.6], [-3.6, 8.9], [-6.2, 8.1], [-7.0, 7.9]],
  [[1.6, 4.2], [5.2, 4.3], [8.6, 1.6], [9.7, -1.8], [8.3, -5.6], [8.0, -6.6]],
  [[-0.4, -3.8], [-1.4, -6.8], [0.6, -11.2], [-0.4, -15], [0, -17.6], [0, -23]],
  [[-4.0, 5.2], [-9.4, 3.0], [-14.0, 0.6], [-17.2, -4.6], [-21, -8.4]],
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
