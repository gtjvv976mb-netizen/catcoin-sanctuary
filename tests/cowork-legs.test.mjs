/* Per-vertex leg labels (assets/models/cats/<KEY>.legs.json, from scripts/cowork-legs.mjs): each file
   covers both copies of its model vertex for vertex, names only the four legs, and every leg is there. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeLegs, encodeLegs, BODY } from "../scripts/cowork-legs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "assets/models/cats");
const INDEX = JSON.parse(fs.readFileSync(path.join(DIR, "index.json"), "utf8")).cats;
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".legs.json")).sort();

/** A GLB's first primitive's vertex count (its POSITION accessor), without decoding the mesh. */
function vertexCount(file) {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12), js = JSON.parse(b.subarray(20, 20 + jl).toString());
  return js.accessors[js.meshes[0].primitives[0].attributes.POSITION].count;
}

test("encodeLegs/decodeLegs round-trip", () => {
  const lab = Uint8Array.from([BODY, BODY, 0, 0, 0, 3, BODY, 1, 2, 2]);
  const s = encodeLegs(lab);
  assert.equal(s, "b2,03,3,b,1,22");
  assert.deepEqual(Array.from(decodeLegs(s, lab.length)), Array.from(lab));
  assert.equal(decodeLegs(s, lab.length + 1), null, "a short string is refused");
  assert.equal(decodeLegs("b2,x", 3), null, "a bad token is refused");
});

test("every legs file matches its model, both copies, and names all four legs", () => {
  for (const f of files) {
    const key = f.replace(".legs.json", ""), j = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
    assert.ok(INDEX[key], `${f}: ${key} is not in index.json`);
    assert.equal(j.v, 1, `${f}: version`);
    for (const [copy, suffix, nk] of [["full", "", "n"], ["far", "-lo", "nlo"]]) {
      if (!(copy in j)) continue;
      const n = vertexCount(path.join(DIR, `${INDEX[key].file || key}${suffix}.glb`));
      assert.equal(j[nk], n, `${f}: ${copy} copy has ${n} vertices, the file says ${j[nk]}`);
      const lab = decodeLegs(j[copy], n);
      assert.ok(lab, `${f}: ${copy} labels do not decode to ${n} vertices`);
      const counts = [0, 0, 0, 0, 0];
      for (const l of lab) counts[l === BODY ? 4 : l]++;
      for (let l = 0; l < 4; l++) assert.ok(counts[l] > 0.005 * n, `${f}: ${copy} leg ${l} has only ${counts[l]} of ${n} vertices`);
      assert.ok(counts[4] > 0.3 * n, `${f}: ${copy} copy leaves only ${counts[4]} body vertices`);
    }
    assert.ok("full" in j || "far" in j, `${f}: no labels`);
    assert.ok(fs.statSync(path.join(DIR, f)).size < 12_000, `${f} is over 12 KB`);
  }
});

test("legs-index.json lists exactly the legs files", () => {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, "legs-index.json"), "utf8"));
  assert.equal(j.v, 1);
  assert.deepEqual(j.cats, files.map((f) => f.replace(".legs.json", "")));
});
