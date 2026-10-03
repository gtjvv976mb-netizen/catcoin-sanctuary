/* Every cat model made with the squared stance (scripts/cat-models.jobs.json stance "square": a standing
   reference and four views of the cat standing square, no stride) stands on exactly four legs. The views
   of the earlier models showed the cat mid-stride, so the left and right views disagreed about the hind
   legs and the 3D step built both: a fifth leg (scripts/CAT-MODELS.md, 2026-10-03). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./helpers.mjs";
import { readGlbMesh } from "../scripts/lib/skingauge.mjs";
import { legColumns } from "../scripts/lib/legcount.mjs";

const THREE = await import(pathToFileURL(path.join(ROOT, "assets/vendor/three/three.module.min.js")).href);
const jobs = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/cat-models.jobs.json"), "utf8"));
// Also the models checked by eye to stand on four legs (legs: 4), though made before the squared stance.
const square = Object.keys(jobs).filter((k) => jobs[k]?.stance === "square" || jobs[k]?.legs === 4);

test("squared-stance (and checked) cat models stand on exactly four legs", () => {
  assert.ok(square.length > 0, "no model is marked stance: square");
  const bad = [];
  for (const key of square) {
    const file = path.join(ROOT, "assets/models/cats", `${key}.glb`);
    if (!fs.existsSync(file)) { bad.push(`${key}: no model`); continue; }
    const { legs, sides } = legColumns(readGlbMesh(file, THREE, fs).pos);
    if (legs !== 4 || sides[0] !== 2) bad.push(`${key}: ${legs} legs (${sides.join(" + ")} a side)`);
  }
  assert.deepEqual(bad, []);
});

test("the leg count sees a fifth leg", () => {
  // Four columns at the corners of a 0.6 x 0.3 box, and a fifth beside the left hind one.
  const pts = [];
  const leg = (x, z) => { for (let i = 0; i < 200; i++) pts.push(x + (i % 4) * 0.004, 0.05 + (i / 200) * 0.12, z + Math.floor(i / 50) * 0.004); };
  for (const [x, z] of [[0.3, 0.15], [0.3, -0.15], [-0.3, 0.15], [-0.3, -0.15]]) leg(x, z);
  pts.push(0, 1, 0, 0, 0, 0);
  assert.equal(legColumns(Float32Array.from(pts)).legs, 4);
  leg(-0.12, -0.15);
  assert.equal(legColumns(Float32Array.from(pts)).legs, 5);
});
