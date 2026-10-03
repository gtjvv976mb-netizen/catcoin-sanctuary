/* How many legs a cat model stands on. In a slice of the model between 5% and 15% of its height (the shins
   of every standing model), the points are split into the cat's two sides halfway across (z), and each
   side's points, ordered nose to tail (x), break into columns wherever a gap of more than 4 cm opens; a
   column holding at least 12% of its side's points is a leg. Counting each side along its own length keeps
   a fluffy pair of legs that touch across the middle apart, and a fringe of fur from making a leg of its
   own. A model made from views that disagree about where the hind legs stand (one side drawn mid-stride)
   grows a fifth leg there: three columns on that side. Used by tests/catlegs.test.mjs for every model made
   with the squared stance (cat-models.jobs.json stance "square") or checked to stand on four (legs: 4). */

/** pos: model-space positions (Float32Array, y up). Returns { legs, sides: [one side's legs, the other's] }. */
export function legColumns(pos, { lo = 0.05, hi = 0.15, gap = 0.04, frac = 0.12 } = {}) {
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < pos.length; i += 3) { if (pos[i] < minY) minY = pos[i]; if (pos[i] > maxY) maxY = pos[i]; }
  const h = maxY - minY, pts = [];
  for (let i = 0; i < pos.length; i += 3) {
    const t = (pos[i + 1] - minY) / h;
    if (t > lo && t < hi) pts.push([pos[i], pos[i + 2]]);
  }
  if (!pts.length) return { legs: 0, sides: [0, 0] };
  let zLo = Infinity, zHi = -Infinity;
  for (const p of pts) { if (p[1] < zLo) zLo = p[1]; if (p[1] > zHi) zHi = p[1]; }
  const zMid = (zLo + zHi) / 2;
  const sides = [0, 1].map((s) => {
    const xs = pts.filter((p) => (p[1] < zMid) === (s === 0)).map((p) => p[0]).sort((a, b) => a - b);
    if (!xs.length) return 0;
    const runs = [];
    let run = 1;
    for (let i = 1; i < xs.length; i++) { if (xs[i] - xs[i - 1] > gap) { runs.push(run); run = 0; } run++; }
    runs.push(run);
    return runs.filter((n) => n >= frac * xs.length).length;
  });
  return { legs: sides[0] + sides[1], sides };
}
