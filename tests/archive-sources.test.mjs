// The source-model archive list (scripts/source-models.sha256.json) that scripts/archive-sources.py
// downloads and checks against: well formed, and named the way scripts/archive-sources.mjs names files.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sources } from "../scripts/archive-sources.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const M = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/source-models.sha256.json"), "utf8"));

test("archive list: every entry is complete", () => {
  assert.equal(M.v, 1);
  const files = Object.entries(M.files);
  assert.ok(files.length > 100, `${files.length} entries`);
  for (const [f, e] of files) {
    assert.match(f, /\.glb$/, f);
    assert.ok(["url", "lo_url"].includes(e.field), `${f}: field ${e.field}`);
    assert.ok(typeof e.key === "string" && e.key, `${f}: key`);
    assert.ok(Number.isInteger(e.bytes) && e.bytes > 1000, `${f}: bytes ${e.bytes}`);
    assert.match(e.sha256, /^[0-9a-f]{64}$/, `${f}: sha256`);
    assert.match(e.url, /^https:\/\//, `${f}: url`);
  }
});

test("archive list: file names follow scripts/archive-sources.mjs", () => {
  for (const [f, e] of Object.entries(M.files)) {
    const entry = e.field === "url" ? { url: e.url, model_job: e.job } : { lo_url: e.url, lo_job: e.job };
    const [s] = sources({ [e.key]: entry });
    assert.equal(s.file, f);
  }
});
