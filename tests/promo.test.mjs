/* The promo poster: every post passes the rules and fits, the media exists, rotation, the quiet
   window, dryRun, and the chunked video upload against a fake X. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./helpers.mjs";
import { run, checkPromo, compose, weightedLength, nextPost, LIMIT } from "../scripts/promo.mjs";
import { uploadVideo, postTime } from "../scripts/lib/x-api.mjs";

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const POSTS = read("data/promo-posts.json");
const MEDIA = read("assets/promo/media.json");
const CREDS = { X_API_KEY: "k", X_API_SECRET: "s", X_ACCESS_TOKEN: "t", X_ACCESS_SECRET: "a" };
const NOW = new Date("2026-09-26T12:00:00Z");

test("promo config: enabled, every 120 minutes by default, posting for real", () => {
  const c = read("data/promo-config.json");
  assert.deepEqual(c, { enabled: true, everyMinutes: 120, dryRun: false });
});

test("every promo post passes the content rules, has no price talk, at most one cashtag, and fits in 280 with its link", () => {
  assert.equal(POSTS.link, "https://catcoinsanctuary.com/?v=3");
  assert.ok(POSTS.posts.length >= 20);
  assert.equal(new Set(POSTS.posts.map((p) => p.id)).size, POSTS.posts.length, "ids are unique");
  assert.equal(new Set(POSTS.posts.map((p) => p.text)).size, POSTS.posts.length, "texts are distinct");
  for (const p of POSTS.posts) {
    const text = compose(p, POSTS.link);
    const c = checkPromo(text);
    assert.ok(c.ok, `${p.id}: ${JSON.stringify(c.violations)}`);
    assert.ok(weightedLength(text) <= LIMIT, p.id);
    assert.ok(!/most successful/i.test(text), p.id);
  }
  for (const a of ["what", "adopt", "lore", "garden", "research", "hall", "community", "hourly"]) assert.ok(POSTS.posts.some((p) => p.angle === a), a);
});

test("the rules catch price talk, a second cashtag and length", () => {
  assert.equal(checkPromo("Buy now! https://catcoinsanctuary.com/").ok, false);
  assert.equal(checkPromo("$CATSANC and $OTHER").ok, false);
  assert.equal(checkPromo("Launch on pump.fun 🚀 $CATSANC").ok, true);
  assert.equal(checkPromo("a".repeat(281)).ok, false);
  assert.equal(weightedLength("https://example.com/a/very/long/path/that/is/long"), 23);
});

test("every post's media is in the manifest, and every file there exists and is small enough", () => {
  const ids = new Map(MEDIA.media.map((m) => [m.id, m]));
  for (const p of POSTS.posts) assert.ok(ids.has(p.media), `${p.id}: ${p.media}`);
  let total = 0;
  for (const m of MEDIA.media) {
    const f = path.join(ROOT, m.file);
    assert.ok(fs.existsSync(f), m.file);
    assert.ok(m.shows && ["image", "video"].includes(m.type), m.id);
    const size = fs.statSync(f).size; total += size;
    assert.ok(size < (m.type === "video" ? 15 : 5) * 1024 * 1024, m.file);
    assert.match(m.file, m.type === "video" ? /^assets\/promo\/.+\.mp4$/ : /^assets\/promo\/.+\.jpg$/);
  }
  assert.ok(total < 60 * 1024 * 1024, "assets/promo is over 60 MB");
  assert.ok(!fs.readFileSync(path.join(ROOT, "index.html"), "utf8").includes("assets/promo"), "the page never loads the promo media");
});

test("rotation: the post after the last one, wrapping round", () => {
  const ps = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(nextPost(ps, { lastId: null }).id, "a");
  assert.equal(nextPost(ps, { lastId: "b" }).id, "c");
  assert.equal(nextPost(ps, { lastId: "c" }).id, "a");
});

test("snowflake ids read back to their time", () => {
  const id = String(BigInt(NOW.getTime() - 1288834974657) << 22n | 12345n);
  assert.equal(postTime(id).toISOString(), NOW.toISOString());
});

function sandbox({ state, announced = { cats: {} }, config = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "promo-"));
  fs.mkdirSync(path.join(dir, "data"));
  fs.mkdirSync(path.join(dir, "assets/promo"), { recursive: true });
  const w = (f, v) => fs.writeFileSync(path.join(dir, f), JSON.stringify(v));
  w("data/promo-posts.json", { link: "https://catcoinsanctuary.com/?v=3", posts: [{ id: "one", media: "still", text: "Hello 🐾" }, { id: "two", media: "clip", text: "Clip 🎥" }] });
  w("assets/promo/media.json", { media: [{ id: "still", file: "assets/promo/s.jpg", type: "image", shows: "x" }, { id: "clip", file: "assets/promo/c.mp4", type: "video", shows: "y" }] });
  fs.writeFileSync(path.join(dir, "assets/promo/s.jpg"), Buffer.alloc(10));
  fs.writeFileSync(path.join(dir, "assets/promo/c.mp4"), Buffer.alloc(10));
  w("data/promo-config.json", { enabled: true, everyMinutes: 120, dryRun: false, ...config });
  if (state) w("data/promo-state.json", state);
  w("data/announced.json", announced);
  return { dir, read: (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) };
}
/** A fake X: the account's last post was `lastAgoMin` minutes ago. */
function fakeX({ lastAgoMin = 60 } = {}) {
  const calls = [];
  const lastId = String((BigInt(NOW.getTime() - lastAgoMin * 60_000 - 1288834974657) << 22n));
  const f = async (url, init) => {
    calls.push({ url, method: init.method });
    assert.match(init.headers.Authorization, /^OAuth oauth_consumer_key="k"/);
    if (url.endsWith("/2/users/me")) return Response.json({ data: { id: "42" } });
    if (url.includes("/2/users/42/tweets")) return Response.json({ data: [{ id: lastId }] });
    if (url.includes("/initialize")) return Response.json({ data: { id: "v1" } });
    if (url.includes("/append")) return new Response(null, { status: 204 });
    if (url.includes("/finalize")) return Response.json({ data: { id: "v1", processing_info: { state: "pending", check_after_secs: 1 } } });
    if (url.includes("command=STATUS")) return Response.json({ data: { processing_info: { state: "succeeded" } } });
    if (url.includes("media/upload")) return Response.json({ data: { id: "m1" } });
    if (url.endsWith("/2/tweets")) return Response.json({ data: { id: "900" } }, { status: 201 });
    return new Response("?", { status: 404 });
  };
  f.calls = calls; return f;
}
const quiet = { log: () => {}, now: () => NOW, sleep: async () => {} };

test("posts the first post with its image, records it, then waits everyMinutes", async () => {
  const s = sandbox();
  const x = fakeX();
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, ...quiet });
  assert.equal(r.posted, "900");
  assert.equal(s.read("data/promo-state.json").lastId, "one");
  assert.ok(x.calls.some((c) => c.url === "https://api.x.com/2/media/upload"));
  const again = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX(), ...quiet, now: () => new Date(NOW.getTime() + 60 * 60_000) });
  assert.match(again.skipped, /every 120 min/);
});

test("the next post is a clip, uploaded in chunks (initialize, append, finalize, status)", async () => {
  const s = sandbox({ state: { lastId: "one", lastPostedAt: "2026-09-26T09:00:00Z", history: [] } });
  const x = fakeX();
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, ...quiet });
  assert.equal(r.posted, "900");
  const order = x.calls.map((c) => c.url).filter((u) => u.includes("media/upload")).map((u) => u.replace(/.*upload/, ""));
  assert.deepEqual(order, ["/initialize", "/v1/append", "/v1/finalize", "?command=STATUS&media_id=v1"]);
  assert.equal(s.read("data/promo-state.json").history.at(-1).media, "clip");
});

test("skips when the account posted within 10 minutes: recorded in announced.json, or seen on X", async () => {
  const recent = sandbox({ announced: { cats: { A: { status: "posted", at: new Date(NOW.getTime() - 4 * 60_000).toISOString() } } } });
  assert.match((await run({ root: recent.dir, env: CREDS, fetchImpl: fakeX(), ...quiet })).skipped, /posted 4 min ago \(recorded\)/);
  const onX = sandbox();
  const x = fakeX({ lastAgoMin: 3 });
  assert.match((await run({ root: onX.dir, env: CREDS, fetchImpl: x, ...quiet })).skipped, /\(on X\)/);
  assert.ok(!x.calls.some((c) => c.url.endsWith("/2/tweets")));
});

test("dryRun and disabled never reach X or write state", async () => {
  for (const config of [{ dryRun: true }, { enabled: false }]) {
    const s = sandbox({ config });
    const x = fakeX();
    await run({ root: s.dir, env: CREDS, fetchImpl: x, ...quiet });
    assert.equal(x.calls.length, 0);
    assert.ok(!fs.existsSync(path.join(s.dir, "data/promo-state.json")));
  }
});

test("uploadVideo falls back to v1.1 INIT/APPEND/FINALIZE when v2 refuses", async () => {
  const seen = [];
  const f = async (url, init) => {
    if (url.includes("api.x.com")) return new Response("{}", { status: 403 });
    const cmd = init.body instanceof FormData ? init.body.get("command") : new URL(url).searchParams.get("command");
    seen.push(cmd);
    if (cmd === "INIT") return Response.json({ media_id_string: "77" });
    if (cmd === "FINALIZE") return Response.json({ media_id_string: "77", processing_info: { state: "in_progress", check_after_secs: 1 } });
    if (cmd === "STATUS") return Response.json({ processing_info: { state: "succeeded" } });
    return new Response(null, { status: 204 });
  };
  const id = await uploadVideo(Buffer.alloc(10), "video/mp4", { apiKey: "k", apiSecret: "s", accessToken: "t", accessSecret: "a" }, f, { chunkBytes: 4, sleep: async () => {} });
  assert.equal(id, "77");
  assert.deepEqual(seen, ["INIT", "APPEND", "APPEND", "APPEND", "FINALIZE", "STATUS"]);
});
