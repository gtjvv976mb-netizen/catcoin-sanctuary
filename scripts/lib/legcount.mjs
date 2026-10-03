/* How many legs a cat model stands on: the separate columns its mesh makes in a thin slice between 8% and
   14% of its height (mid-shin on every standing model), each a connected patch of 1 cm cells (8-connected)
   holding at least half as many points as the fourth biggest. A model made from views that disagree about
   where the hind legs stand (one side drawn mid-stride) grows a fifth leg there: five columns. The paws
   themselves are a worse slice: toes and fur fringes split them, and a kitten's touch. Used by
   tests/catlegs.test.mjs for every model made with the squared stance (cat-models.jobs.json stance "square"). */

/** pos: model-space positions (Float32Array, y up). Returns { legs, columns: [{ x, z, points }] }. */
export function legColumns(pos, { lo = 0.08, hi = 0.14, cell = 0.01 } = {}) {
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < pos.length; i += 3) { if (pos[i] < minY) minY = pos[i]; if (pos[i] > maxY) maxY = pos[i]; }
  const h = maxY - minY, cells = new Map();
  for (let i = 0; i < pos.length; i += 3) {
    const t = (pos[i + 1] - minY) / h;
    if (t <= lo || t >= hi) continue;
    const key = `${Math.floor(pos[i] / cell)},${Math.floor(pos[i + 2] / cell)}`;
    cells.set(key, (cells.get(key) || 0) + 1);
  }
  const seen = new Set(), blobs = [];
  for (const start of cells.keys()) {
    if (seen.has(start)) continue;
    seen.add(start);
    const stack = [start];
    let points = 0, xs = 0, zs = 0, n = 0;
    while (stack.length) {
      const c = stack.pop(), [x, z] = c.split(",").map(Number);
      points += cells.get(c); xs += x; zs += z; n++;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const nb = `${x + dx},${z + dz}`;
        if (cells.has(nb) && !seen.has(nb)) { seen.add(nb); stack.push(nb); }
      }
    }
    blobs.push({ x: (xs / n) * cell, z: (zs / n) * cell, points });
  }
  blobs.sort((a, b) => b.points - a.points);
  const ref = blobs[Math.min(3, blobs.length - 1)]?.points ?? 0;
  const columns = blobs.filter((b) => b.points >= 0.5 * ref);
  return { legs: columns.length, columns };
}
