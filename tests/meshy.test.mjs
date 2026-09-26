/* The Meshy fixer's pure parts: queue order, request bodies, reference pictures, and recording a model. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ordered, imageRef, retextureBody, referenceBody, modelBody, recordModel, STANDING } from "../scripts/meshy.mjs";

const QUEUE = { cats: {
  B: { action: "rebuild", priority: 1, styleImage: "generate", referencePrompt: "A cream cartoon cat." },
  A: { action: "retexture", priority: 1, styleImage: "https://pbs.twimg.com/media/x.jpg", retexturePrompt: "A jet-black cat with four white paws." },
  C: { action: "retexture", priority: 2, styleImage: "generate", retexturePrompt: "A ginger tabby." },
  D: { action: "ok", priority: 3, styleImage: "generate" },
} };

test("the queue runs worst first, retextures before rebuilds, skips done and ok cats, and filters", () => {
  assert.deepEqual(ordered(QUEUE).map((q) => q.key), ["A", "B", "C"]);
  assert.deepEqual(ordered(QUEUE, { state: { A: { status: "done" } } }).map((q) => q.key), ["B", "C"]);
  assert.deepEqual(ordered(QUEUE, { state: { A: { status: "failed" } } }).map((q) => q.key), ["A", "B", "C"]);
  assert.deepEqual(ordered(QUEUE, { priority: 1 }).map((q) => q.key), ["A", "B"]);
  assert.deepEqual(ordered(QUEUE, { only: "rebuild" }).map((q) => q.key), ["B"]);
  assert.deepEqual(ordered(QUEUE, { keys: ["C"] }).map((q) => q.key), ["C"]);
  // Within one priority and action, the queue's order (cats about to be posted first) wins over the key.
  const byOrder = { cats: { X: { action: "rebuild", priority: 1, order: 2 }, Y: { action: "rebuild", priority: 1, order: 1 }, Z: { action: "rebuild", priority: 1 } } };
  assert.deepEqual(ordered(byOrder).map((q) => q.key), ["Y", "X", "Z"]);
});

test("the shipped queue: every cat has an action, a priority and a way to style it", () => {
  const q = JSON.parse(fs.readFileSync(new URL("../scripts/meshy.queue.json", import.meta.url), "utf8"));
  for (const [k, c] of Object.entries(q.cats)) {
    assert.ok(["retexture", "rebuild", "ok"].includes(c.action), k);
    assert.ok([1, 2, 3].includes(c.priority), k);
    if (c.action === "retexture") assert.ok(c.retexturePrompt?.length > 20 && c.retexturePrompt.length <= 800, `${k}: retexturePrompt`);
    if (c.action === "rebuild") assert.ok(c.referencePrompt?.length > 20, `${k}: referencePrompt`);
  }
});

test("reference pictures: https as is, repo JPG/PNG as data URIs, 'generate' and missing files as none", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meshy-"));
  fs.writeFileSync(path.join(dir, "a.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
  fs.writeFileSync(path.join(dir, "b.png"), Buffer.from([0x89, 0x50]));
  assert.equal(imageRef("https://pbs.twimg.com/media/x.jpg", dir), "https://pbs.twimg.com/media/x.jpg");
  assert.match(imageRef("a.jpg", dir), /^data:image\/jpeg;base64,/);
  assert.match(imageRef("b.png", dir), /^data:image\/png;base64,/);
  assert.equal(imageRef("generate", dir), null);
  assert.equal(imageRef("missing.jpg", dir), null);
  assert.equal(imageRef("http://insecure.example/x.jpg", dir), null);
});

test("a retexture keeps the model's own geometry and UVs and styles from the prompt, or from the picture with --image", () => {
  const job = { url: "https://d8j0ntlcm91z4.cloudfront.net/raw.glb" };
  const b = retextureBody({ key: "A", ...QUEUE.cats.A }, job);
  assert.equal(b.model_url, job.url);
  assert.equal(b.enable_original_uv, true);
  assert.equal(retextureBody({ key: "A", action: "retexture", retexturePrompt: "x" }, null, { originalUv: false }).enable_original_uv, false);
  assert.equal(b.text_style_prompt, "A jet-black cat with four white paws.");
  assert.ok(!("image_style_url" in b));
  const i = retextureBody({ key: "A", ...QUEUE.cats.A }, job, { useImage: true });
  assert.equal(i.image_style_url, "https://pbs.twimg.com/media/x.jpg");
  assert.ok(!("text_style_prompt" in i));
  assert.equal(retextureBody({ key: "C", ...QUEUE.cats.C }, null).model_url, "https://catcoinsanctuary.com/assets/models/cats/C.glb");
  assert.throws(() => retextureBody({ key: "Z", action: "retexture", styleImage: "generate" }, job), /no retexturePrompt/);
});

test("a rebuild makes four-legged reference views, from the picture when there is one, then a textured model", () => {
  const gen = referenceBody({ key: "B", ...QUEUE.cats.B });
  assert.equal(gen.kind, "text-to-image");
  assert.ok(gen.body.prompt.startsWith("A cream cartoon cat.") && gen.body.prompt.includes(STANDING));
  assert.equal(gen.body.generate_multi_view, true);
  const ref = referenceBody({ key: "A", action: "rebuild", styleImage: "https://pbs.twimg.com/media/x.jpg", referencePrompt: "A black cat." });
  assert.equal(ref.kind, "image-to-image");
  assert.deepEqual(ref.body.reference_image_urls, ["https://pbs.twimg.com/media/x.jpg"]);
  const m = modelBody(["u1", "u2", "u3", "u4", "u5"]);
  assert.deepEqual(m.image_urls, ["u1", "u2", "u3", "u4"]);
  assert.equal(m.texture_image_url, undefined, "textured from all the views, not just the first (often the back)");
  assert.equal(m.should_texture, true);
});

test("a finished model replaces the job entry and keeps the old one under previous, once", () => {
  const jobs = { A: { model_job: "old", url: "https://x/old.glb", status: "done" } };
  recordModel(jobs, "A", { model_job: "new", url: "https://x/new.glb", status: "done" });
  assert.equal(jobs.A.model_job, "new");
  assert.equal(jobs.A.previous.model_job, "old");
  recordModel(jobs, "A", { model_job: "newer", url: "https://x/newer.glb", status: "done" });
  assert.equal(jobs.A.previous.model_job, "new");
  assert.ok(!("previous" in jobs.A.previous));
});
