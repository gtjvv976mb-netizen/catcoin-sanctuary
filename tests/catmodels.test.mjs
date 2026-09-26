/* Per-cat models (assets/models/cats/): every cat listed in index.json is a planned cat or a famous
   cat coin (keyed by its id, contract or symbol: assets/ui/models.js), has a
   full and a far GLB that parse, carry one textured mesh (JPEG colour texture, no decoder-only
   extensions) and fit the web budget. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers.mjs";
import { modelIdFor } from "../assets/ui/models.js";

const DIR = path.join(ROOT, "assets/models/cats");
const BUDGET = { "": 600_000, "-lo": 150_000 };
const BUDGET_HD = { "": 800_000, "-lo": 300_000 }; // Hunyuan3D multiview models (2K texture)
const OK_EXT = new Set(["KHR_mesh_quantization", "KHR_texture_transform"]);
const index = JSON.parse(fs.readFileSync(path.join(DIR, "index.json"), "utf8"));
const planned = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, "data/planned.json"), "utf8")).cats.map((c) => c.ticker));
const famous = JSON.parse(fs.readFileSync(path.join(ROOT, "data/famous.json"), "utf8")).coins.map((c) => ({ ...c, kind: "famous", ticker: c.symbol }));
const adoptable = JSON.parse(fs.readFileSync(path.join(ROOT, "data/adoptables.json"), "utf8")).cats.map((c) => ({ id: c.ticker, kind: "adoptable" }));
const residents = [...[...planned].map((id) => ({ id, kind: "stock" })), ...adoptable, ...famous];
const fileOf = (key, d) => (typeof d.file === "string" ? d.file : key);

function readGlb(buf) {
  assert.equal(buf.readUInt32LE(0), 0x46546c67, "GLB magic");
  assert.equal(buf.readUInt32LE(4), 2, "glTF 2");
  assert.equal(buf.readUInt32LE(8), buf.length, "declared length");
  let off = 12, json = null, bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString("utf8")); else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  return { json, bin };
}

test("cat models: index lists only planned cats, adoptable cats and famous coins, with sane dimensions", () => {
  assert.ok(Object.keys(index.cats).length > 0);
  for (const [t, d] of Object.entries(index.cats)) {
    assert.ok(modelIdFor(t, residents), `${t} is a planned cat, an adoptable cat or a famous coin`);
    assert.equal(d.height, 1, `${t} is normalized to 1 unit tall`);
    assert.ok(d.len > d.width && d.len < 2.5, `${t} stands lengthwise along +X (len ${d.len}, width ${d.width})`);
  }
});

for (const [key, d] of Object.entries(index.cats)) {
  const t = fileOf(key, d);
  for (const tag of ["", "-lo"]) {
    test(`cat models: ${t}${tag}.glb is a valid textured GLB under ${(d.hd ? BUDGET_HD : BUDGET)[tag] / 1000} KB`, () => {
      const f = path.join(DIR, `${t}${tag}.glb`);
      assert.ok(fs.existsSync(f), `${f} exists`);
      const buf = fs.readFileSync(f);
      assert.ok(buf.length <= (d.hd ? BUDGET_HD : BUDGET)[tag], `${buf.length} bytes`);
      const { json, bin } = readGlb(buf);
      assert.ok(json && bin);
      for (const e of json.extensionsRequired || []) assert.ok(OK_EXT.has(e), `needs only extensions three.js reads without a decoder (${e})`);
      const prims = json.meshes.flatMap((m) => m.primitives);
      assert.ok(prims.length >= 1);
      for (const p of prims) { assert.ok("POSITION" in p.attributes && "TEXCOORD_0" in p.attributes); }
      assert.ok(json.images?.length >= 1 && json.images.every((i) => i.mimeType === "image/jpeg"), "JPEG texture");
      const mat = json.materials[prims[0].material];
      assert.ok(mat.pbrMetallicRoughness.baseColorTexture, "has a colour texture");
      for (const bv of json.bufferViews) assert.ok(bv.byteOffset + bv.byteLength <= bin.length);
    });
  }
}

test("cat models: every planned cat with a model file is in the index", () => {
  const files = new Set(Object.entries(index.cats).map(([k, d]) => fileOf(k, d)));
  for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith(".glb") && !f.endsWith("-lo.glb"))) assert.ok(files.has(f.replace(".glb", "")), f);
});
