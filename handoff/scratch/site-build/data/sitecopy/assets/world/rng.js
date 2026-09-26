/* Small seeded randomness, so each cat keeps its own rhythm from one visit to the next.
   No three.js here: this file, layout.js, nav.js and cats.js also run under plain Node. */

/** A 32-bit hash of a string (FNV-1a), used as a seed. */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** mulberry32: a tiny, good-enough PRNG. Returns a function giving floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded random source with a few helpers. */
export function makeRandom(seed) {
  const next = typeof seed === "string" ? mulberry32(hashString(seed)) : mulberry32(seed);
  const r = {
    next,
    range: (a, b) => a + next() * (b - a),
    int: (a, b) => Math.floor(a + next() * (b - a + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
  };
  return r;
}
