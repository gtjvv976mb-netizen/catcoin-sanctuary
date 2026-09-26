import { createSanctuary } from "/home/user/cat-sanctuary/assets/world/cats.js";
import { createMeadow } from "/home/user/cat-sanctuary/assets/world/meadow.js";
let t0 = performance.now();
const res = Array.from({ length: 220 }, (_, i) => ({ id: `c${i}`, name: `c${i}` }));
const s = createSanctuary({ residents: res });
console.log("build ms", (performance.now() - t0).toFixed(0));
const mres = Array.from({ length: 260 }, (_, i) => ({ id: `m${i}`, name: `m${i}`, tier: i < 116 ? "ring1" : "ring2" }));
t0 = performance.now();
const m = createMeadow({ residents: mres, startIndex: 220 });
console.log("meadow build ms", (performance.now() - t0).toFixed(0));
m.setFocus(0, 0, 0, 30);
for (let i = 0; i < 60; i++) { s.update(1 / 30); m.update(1 / 30); }
const T = [];
for (let i = 0; i < 300; i++) { const a = performance.now(); s.update(1 / 30); m.update(1 / 30); T.push(performance.now() - a); }
T.sort((a, b) => a - b);
console.log("sim ms median", T[150].toFixed(2), "p95", T[285].toFixed(2), "max", T[299].toFixed(2), m.counts());
