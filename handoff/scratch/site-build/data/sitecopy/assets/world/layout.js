/* Where everything in the garden is. One source for both the scenery (garden.js draws it)
   and the cats (cats.js uses it to find beds, bowls and a way round).

   Axes: x to the right of the cottage, z towards its porch (the cottage's front faces +z),
   y up. One unit is roughly the height of a small door. Headings ("yaw") follow the cat
   models, which face +x: yaw 0 faces +x, and a cat moves along (cos yaw, -sin yaw). */

/** Cat size: a sitting cat is `size` units tall; the other poses are fitted to match. */
export const CAT = { size: 1.2, bodyR: 0.3, clearR: 0.42, personal: 1.05 };

/** The cottage, scaled to `height` and centred. Its footprint (with the porch stairs) was
    measured by casting rays down onto sanctuary.glb at that scale. */
export const HOUSE = { height: 5.2, minX: -2.5, maxX: 2.55, minZ: -2.55, maxZ: 2.5 };

/** Cats keep inside walkR; the fence runs round the front at fenceR, with a gate on the path. */
export const GARDEN = { walkR: 8.2, fenceR: 9.0, fenceFrom: -22, fenceTo: 202, gateFrom: 86.5, gateTo: 97.5 };

const HALF_PI = Math.PI / 2;

/** The bottom step of the porch stairs: a perch a cat hops up to. Heights are the step tops. */
export const STEP = { id: "step", kind: "step", x: -0.5, z: 2.5, y: 0.23, sitYaw: -HALF_PI, ground: { x: -0.5, z: 3.32 } };

/** Round cat beds: r is the outer rim, y the cushion a cat lies on. */
export const BEDS = [
  { id: "bed-a", kind: "bed", x: 4.75, z: 4.35, r: 0.76, y: 0.1, color: 0x7d5b86 },
  { id: "bed-b", kind: "bed", x: -5.2, z: -2.3, r: 0.76, y: 0.1, color: 0x5f7a8c },
  { id: "bed-c", kind: "bed", x: 4.6, z: -3.3, r: 0.76, y: 0.1, color: 0x9a5a4a },
  { id: "bed-d", kind: "bed", x: -2.1, z: 6.15, r: 0.76, y: 0.1, color: 0x6f8a5c },
];

/** Soft warm pools of the low evening sun. Two cats can share one, a little apart. */
export const SUN_PATCHES = [
  { id: "sun-1", kind: "sun", x: 3.0, z: 6.45, r: 1.3, slots: [[-0.52, 0.18], [0.55, -0.2]] },
  { id: "sun-2", kind: "sun", x: -4.35, z: 5.2, r: 1.3, slots: [[-0.4, -0.35], [0.5, 0.35]] },
];

/** Food bowls and the water dish, by the cottage's front-left corner. A cat stands at `stand`
    facing `yaw` (towards the bowl, and towards the usual view, so its face shows). */
export const BOWLS = [
  { id: "bowl-1", kind: "bowl", x: -3.35, z: 3.58, r: 0.25, stand: { x: -3.35, z: 2.95 }, yaw: -HALF_PI },
  { id: "bowl-2", kind: "bowl", x: -4.2, z: 3.58, r: 0.25, stand: { x: -4.2, z: 2.95 }, yaw: -HALF_PI },
];
export const WATER = { id: "water", kind: "water", x: -5.12, z: 3.46, r: 0.34, stand: { x: -5.12, z: 2.76 }, yaw: -HALF_PI };

/** The cat tree: a base board, a tall post with the top platform and a short one with the
    low platform, set apart so a cat on the low one clears the top one. */
export const TREE = {
  id: "tree", kind: "tree",
  base: { minX: 4.45, maxX: 5.35, minZ: -0.55, maxZ: 1.55 },
  low: { id: "tree-low", x: 4.9, z: 1.02, y: 1.05, r: 0.5 },
  high: { id: "tree-high", x: 4.9, z: -0.05, y: 1.95, r: 0.5 },
  ground: { x: 6.02, z: 1.0 },       // where a cat stands to jump up
  landing: { x: 6.05, z: -0.2 },     // where it lands jumping down from the top
};

/** Balls of yarn: where they start. They roll when played with. */
export const YARNS = [
  { id: "yarn-1", x: 1.75, z: 5.3, r: 0.17, color: 0xd8604f },
  { id: "yarn-2", x: -2.9, z: 7.35, r: 0.17, color: 0x6c8fc7 },
];

/** Lantern posts: two by the stairs, one at the gate. */
export const LANTERNS = [
  { id: "lantern-1", x: -1.75, z: 3.3 },
  { id: "lantern-2", x: 0.78, z: 3.3 },
  { id: "lantern-3", x: 0.95, z: 8.75 },
];

/** Flower beds: low timber boxes of flowers. */
export const FLOWER_BEDS = [
  { id: "flowers-left", minX: -3.45, maxX: -2.85, minZ: -2.1, maxZ: 1.7 },
  { id: "flowers-front", minX: 1.35, maxX: 3.45, minZ: 3.05, maxZ: 3.62 },
  { id: "flowers-back", minX: -1.8, maxX: 1.8, minZ: -3.62, maxZ: -3.05 },
];

/** Bushes inside the garden (obstacles) and a hedge line outside it (scenery only). */
export const BUSHES = [
  { id: "bush-1", x: -3.7, z: -4.7, r: 0.72 },
  { id: "bush-2", x: 2.8, z: -5.3, r: 0.8 },
  { id: "bush-3", x: -0.4, z: -5.9, r: 0.62 },
  { id: "bush-4", x: 7.0, z: -2.0, r: 0.6 },
];

/** The stepping-stone path: from the stairs, gently curving out through the gate. */
export function pathPoints() {
  const pts = [];
  for (let z = 3.0; z <= 9.9; z += 0.78) pts.push({ x: -0.45 + 0.5 * Math.sin((z - 3.0) * 0.62), z });
  return pts;
}

/** Every obstacle a cat must walk round. */
export function obstacles() {
  return [
    { id: "house", type: "rect", minX: HOUSE.minX, maxX: HOUSE.maxX, minZ: HOUSE.minZ, maxZ: HOUSE.maxZ },
    { id: TREE.id, type: "rect", ...TREE.base },
    ...FLOWER_BEDS.map((f) => ({ id: f.id, type: "rect", minX: f.minX, maxX: f.maxX, minZ: f.minZ, maxZ: f.maxZ })),
    ...BEDS.map((b) => ({ id: b.id, type: "circle", x: b.x, z: b.z, r: b.r })),
    ...BOWLS.map((b) => ({ id: b.id, type: "circle", x: b.x, z: b.z, r: b.r })),
    { id: WATER.id, type: "circle", x: WATER.x, z: WATER.z, r: WATER.r },
    ...LANTERNS.map((l) => ({ id: l.id, type: "circle", x: l.x, z: l.z, r: 0.16 })),
    ...BUSHES.map((b) => ({ id: b.id, type: "circle", x: b.x, z: b.z, r: b.r })),
  ];
}
