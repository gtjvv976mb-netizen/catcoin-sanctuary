/* Posts about site updates and adoptions on X: every shipped draft passes the checks, the gaps, the
   order, the state kept around each post, held drafts, missing secrets, refusals, and the workflow step. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT } from "./helpers.mjs";
import { SITE, HASHTAGS, LIMIT, cardLink, weightedLength, listCats, checkPost } from "../scripts/announce.mjs";
import { checkUpdate, draftAdoption, candidates, waitReason, lastAnnouncerPost, validAdoption, run, IMAGE_PATH, MAX_ATTEMPTS, LAUNCHPADS } from "../scripts/post-updates.mjs";
import { kitsOf } from "../scripts/lib/adoptions.mjs";

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const SHIPPED = read("data/updates.json");
// Catbus's adoption went out as a thread (data/thread-adoption-catbus.json), so it is shipped as posted;
// the runs below start from before that, to exercise the adoption post.
// The bot records its posts in the shipped file, so the runs below start from a fresh copy of the queue.
const UPDATES = { ...SHIPPED, lastPostedAt: null, adoptionsPosted: {},
  posts: SHIPPED.posts.map(({ id, text, image, approved }) => ({ id, text, ...(image ? { image } : {}), approved, status: "queued", postedAt: null, tweet: null })) };
const ADOPTIONS = read("data/adoptions.json");
const ADOPTABLES = read("data/adoptables.json");
const COLLECTION = read("data/collection.json");
const CATS = listCats(read("data/planned.json"), COLLECTION, ADOPTABLES);
const CAPTIONS = read("data/lore.json").cats || {};
const KITS = new Map(kitsOf({ planned: read("data/planned.json"), adoptables: ADOPTABLES }).map((k) => [k.key, k]));
const CATEGORY = new Map(ADOPTABLES.cats.map((c) => [c.ticker, c.category]));
const CREDS = { X_API_KEY: "k", X_API_SECRET: "s", X_ACCESS_TOKEN: "t", X_ACCESS_SECRET: "a" };
const T0 = Date.parse("2026-10-01T12:00:00Z");
const MIN = 60_000;
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

/** A throwaway root: the shipped updates and adoptions, Catbus as the only cat, its pictures and the updates' images. */
function sandbox({ updates = UPDATES, adoptions = ADOPTIONS, announced = { cats: {} }, queue = { cats: [] }, config = { dryRun: false }, adoptables = { cats: ADOPTABLES.cats.filter((c) => c.ticker === "NEKOBUS") } } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "updates-"));
  const w = (f, v) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), Buffer.isBuffer(v) ? v : JSON.stringify(v, null, 2) + "\n"); };
  w("data/updates.json", updates); w("data/adoptions.json", adoptions); w("data/announced.json", announced); w("data/release-queue.json", queue);
  w("data/announce-config.json", config); w("data/planned.json", { stocks: [], cats: [] }); w("data/collection.json", { cats: [] });
  w("data/adoptables.json", adoptables); w("data/lore.json", { cats: { NEKOBUS: CAPTIONS.NEKOBUS } });
  for (const f of ["assets/lore/NEKOBUS.webp", "assets/ingame/NEKOBUS.jpg", ...updates.posts.map((p) => p.image).filter(Boolean)]) w(f, JPEG);
  return { dir, read: (f) => JSON.parse(fs.readFileSync(path.join(dir, "data", f), "utf8")), raw: (f) => fs.readFileSync(path.join(dir, "data", f), "utf8") };
}
/** A fake X: records every request, answers each post with a new id; `onTweet` sees each post as it is made. */
function fakeX({ fail = null, onTweet = null } = {}) {
  const calls = []; let n = 500;
  const f = async (url, init) => {
    calls.push({ url, init });
    assert.match(init.headers.Authorization, /^OAuth oauth_consumer_key="k", .*oauth_signature="/);
    if (fail?.(url)) return new Response(JSON.stringify({ title: "nope" }), { status: fail(url) });
    if (url.includes("media/upload")) return new Response(JSON.stringify({ data: { id: "m1" } }), { status: 200 });
    onTweet?.(JSON.parse(init.body));
    return new Response(JSON.stringify({ data: { id: String(n++) } }), { status: 201 });
  };
  f.calls = calls;
  f.tweets = () => calls.filter((c) => c.url === "https://api.x.com/2/tweets").map((c) => JSON.parse(c.init.body));
  return f;
}
const at = (ms) => () => new Date(ms);
const quiet = { log: () => {} };
const catbus = () => candidates({ posts: [] }, ADOPTIONS, { cats: CATS, ownMints: new Set(COLLECTION.cats.map((c) => c.mint)) }).find((c) => c.id === "NEKOBUS");

test("every shipped update is approved and queued, fits 280, passes the rules, links only the site and carries 1-2 of the announcer's hashtags", () => {
  assert.equal(UPDATES.minGapMinutes, 180);
  assert.ok(UPDATES.lastPostedAt === null || !Number.isNaN(Date.parse(UPDATES.lastPostedAt)));
  assert.equal(SHIPPED.adoptionsPosted.NEKOBUS.status, "posted", "Catbus went out as its thread: never posted twice");
  assert.ok(fs.existsSync(path.join(ROOT, "data/thread-adoption-catbus.json")));
  assert.equal(UPDATES.posts.length, 10);
  assert.equal(new Set(UPDATES.posts.map((p) => p.id)).size, UPDATES.posts.length);
  for (const p of UPDATES.posts) {
    assert.equal(p.approved, true, p.id);
    assert.ok(["queued", "posting", "posted", "failed", "held"].includes(p.status), p.id);
    const r = checkUpdate(p.text);
    assert.ok(r.ok, `${p.id}: ${JSON.stringify(r.violations)}`);
    assert.ok(weightedLength(p.text) <= LIMIT, `${p.id}: ${weightedLength(p.text)}`);
    assert.deepEqual(p.text.match(/https?:\/\/\S+/g) || [], [SITE], p.id);
    const tags = p.text.match(/#\w+/g) || [];
    assert.ok(tags.length >= 1 && tags.length <= 2 && tags.every((t) => HASHTAGS.includes(t)), `${p.id}: ${tags}`);
    assert.doesNotMatch(p.text, /\$[A-Za-z0-9]|\b(buy|pump|moon|price|mcap)\b/i, p.id);
    if (p.image) { assert.match(p.image, IMAGE_PATH, p.id); assert.ok(fs.existsSync(path.join(ROOT, p.image)), `${p.id}: ${p.image}`); }
  }
});

test("the updates name what the site really has, and none repeats what the threads already posted", () => {
  const site = ["index.html", "assets/ui/card.js", "assets/ui/trending.js", "assets/ui/panels.js"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
  for (const words of ["Adopted", "Adopted by the community", "Adopt a Cat", "Hall of Fame", "by the fountain", "Only the mint shown here"]) assert.ok(site.includes(words), words);
  const posted = ["data/thread-mechanics.json", "data/thread-adoption-catbus.json"].map((f) => read(f).posts.join("\n")).join("\n");
  for (const p of UPDATES.posts) for (const topic of [/Trending tab/i, /rebuilt in 3D|remade in 3D/i, /every hour/i, /First (cat )?adopt/i]) {
    if (topic.test(posted)) assert.doesNotMatch(p.text, topic, `${p.id} repeats a thread`);
  }
});

test("the CATBUS adoption drafts within 280, passes the checks, and names the cat, its coin, the launchpad and its card", () => {
  for (const a of ADOPTIONS.adoptions) assert.ok(validAdoption(a), a.key);
  const it = catbus();
  assert.ok(it && it.first);
  const kit = KITS.get("NEKOBUS"), category = CATEGORY.get("NEKOBUS");
  for (const opts of [{ caption: CAPTIONS.NEKOBUS, ingame: true, first: true }, { caption: CAPTIONS.NEKOBUS, ingame: false, first: false }, {}]) {
    const d = draftAdoption(it.adoption, it.cat, { kit, category, ...opts });
    assert.ok(d.ok, JSON.stringify(d.violations));
    assert.ok(weightedLength(d.text) <= LIMIT, String(weightedLength(d.text)));
    for (const s of ["Catbus", "My Neighbor Totoro", "Nekobasu (CATBUS)", "launched on PumpFun by a visitor from its kit", "We didn't launch it", cardLink("NEKOBUS"), "#catcoin"]) assert.ok(d.text.includes(s), s);
    assert.doesNotMatch(d.text, /\$CATBUS/);
    assert.equal(/FIRST ADOPTION/.test(d.text), !!opts.first);
  }
});

test("an adoption is written with the cat's own kit, never the stranger's text; a bad kit or an unknown launchpad is not drafted", () => {
  const { adoption, cat } = catbus();
  const kit = KITS.get("NEKOBUS");
  for (const odd of [{ name: "Balloon.Cat to the moon" }, { name: "Neko@bus 🚀" }, { symbol: "$CATBUS" }]) {
    const d = draftAdoption({ ...adoption, ...odd }, cat, { kit, category: "tv-movie" });
    assert.ok(d.ok, JSON.stringify(d.violations));
    assert.ok(d.text.includes("Nekobasu (CATBUS)") && !/moon|@|\$/.test(d.text.replace(/https:\S+/g, "")), d.text);
  }
  for (const [k, rule] of [[{ ...kit, name: "Neko.bus" }, "kit_name"], [{ ...kit, ticker: "$CATBUS" }, "kit_ticker"], [null, "kit_name"]]) {
    const d = draftAdoption(adoption, cat, { kit: k });
    assert.equal(d.ok, false);
    assert.ok(d.violations.some((v) => v.rule === rule), JSON.stringify(d.violations));
  }
  assert.ok(draftAdoption({ ...adoption, launchpad: "elsewhere" }, cat, { kit }).violations.some((v) => v.rule === "launchpad"));
});

test("an owner is named only when it is a company or a show, short and without a handle; a person's cat never tags its owner", () => {
  const { adoption, cat } = catbus();
  const kit = KITS.get("NEKOBUS");
  assert.match(draftAdoption(adoption, cat, { kit, category: "tv-movie" }).text, /Catbus, the cat of My Neighbor Totoro, now has a coin/);
  for (const [company, category] of [["Jane Doe (@janedoe)", "viral"], ["My Neighbor Totoro", "celebrity"], ["@someone", "company"], ["A very long company description that goes on", "company"]]) {
    const d = draftAdoption(adoption, { ...cat, company }, { kit, category });
    assert.ok(d.ok && !d.text.includes(company) && !d.text.includes("@"), `${company}: ${d.text}`);
  }
});

test("every cat's adoption fits and passes, on either launchpad: an adoption is never held for its length", () => {
  const cats = listCats(read("data/planned.json"), { cats: [] }, ADOPTABLES);
  // A cat whose own name trips the no-price-talk rule ("Pumice the Moon-Dust Cat") cannot be posted by the announcer either.
  const unsayable = cats.filter((c) => KITS.get(c.key) && checkPost(`${c.name} ${KITS.get(c.key).name}`).violations.some((v) => v.rule === "price_talk"));
  assert.ok(unsayable.length <= 3, unsayable.map((c) => c.name).join(", "));
  for (const c of cats) {
    const kit = KITS.get(c.key);
    if (!kit || unsayable.includes(c)) continue;
    for (const launchpad of Object.keys(LAUNCHPADS)) {
      const a = { ...ADOPTIONS.adoptions[0], key: c.key, launchpad };
      const d = draftAdoption(a, c, { kit, category: CATEGORY.get(c.key), caption: CAPTIONS[c.key] ?? null, ingame: true });
      assert.ok(d.ok && weightedLength(d.text) <= LIMIT, `${c.key} on ${launchpad}: ${JSON.stringify(d.violations)}`);
    }
  }
});

test("candidates: adoptions first (not the owner's own mint, not an unknown cat), then approved queued updates in order", () => {
  const cats = CATS;
  const a = ADOPTIONS.adoptions[0];
  const updates = { posts: [{ id: "u1", approved: true, status: "queued" }, { id: "u2", approved: false, status: "queued" }, { id: "u3", approved: true, status: "posted" }, { id: "u4", approved: true, status: "failed", attempts: MAX_ATTEMPTS - 1 }, { id: "u5", approved: true, status: "failed", attempts: MAX_ATTEMPTS }, { id: "u6", approved: true, status: "held" }] };
  assert.deepEqual(candidates(updates, ADOPTIONS, { cats }).map((c) => c.id), ["NEKOBUS", "u1", "u4"]);
  assert.deepEqual(candidates(updates, ADOPTIONS, { cats, ownMints: new Set([a.mint]) }).map((c) => c.id), ["u1", "u4"]);
  assert.deepEqual(candidates(updates, { adoptions: [{ ...a, key: "NOSUCHCAT" }] }, { cats }).map((c) => c.id), ["u1", "u4"]);
  for (const status of ["posting", "posted", "held"]) assert.deepEqual(candidates({ ...updates, adoptionsPosted: { NEKOBUS: { status } } }, ADOPTIONS, { cats }).map((c) => c.id), ["u1", "u4"], status);
});

test("gaps: minGapMinutes after its own last post, 15 minutes after the announcer's post or release", () => {
  const u = (mins, gap = 180) => ({ minGapMinutes: gap, lastPostedAt: new Date(T0 - mins * MIN).toISOString() });
  const none = { cats: {} };
  assert.ok(waitReason({ updates: u(179), announced: none, queue: {}, nowMs: T0 }));
  assert.equal(waitReason({ updates: u(180), announced: none, queue: {}, nowMs: T0 }), null);
  assert.equal(waitReason({ updates: u(61, 60), announced: none, queue: {}, nowMs: T0 }), null);
  assert.equal(waitReason({ updates: { minGapMinutes: 180, lastPostedAt: null }, announced: none, queue: {}, nowMs: T0 }), null);
  const cat = (mins, status = "posted") => ({ cats: { A: { status: "posted", at: "2026-09-27T00:00:00Z" }, B: { status, at: new Date(T0 - mins * MIN).toISOString() } } });
  assert.ok(waitReason({ updates: {}, announced: cat(14), queue: {}, nowMs: T0 }));
  assert.equal(waitReason({ updates: {}, announced: cat(15), queue: {}, nowMs: T0 }), null);
  assert.equal(waitReason({ updates: {}, announced: cat(1, "held"), queue: {}, nowMs: T0 }), null, "a held cat is not a post");
  assert.ok(waitReason({ updates: {}, announced: none, queue: { lastReleaseAt: new Date(T0 - 10 * MIN).toISOString() }, nowMs: T0 }));
  assert.equal(lastAnnouncerPost(cat(30), { lastReleaseAt: new Date(T0 - 20 * MIN).toISOString() }), T0 - 20 * MIN);
});

test("order: the adoption first, then each update in file order, one a run and minGapMinutes apart; never twice", async () => {
  const s = sandbox();
  const order = [];
  let t = T0;
  for (let i = 0; i < 1 + UPDATES.posts.length; i++) {
    const x = fakeX();
    const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, now: at(t), ...quiet });
    assert.equal(x.tweets().length, 1, `run ${i}`);
    order.push(r.posted.id);
    if (i === 0) {
      assert.equal(r.posted.kind, "adoption");
      assert.equal(x.calls.filter((c) => c.url.includes("media/upload")).length, 2, "lore picture and in-game look");
      assert.deepEqual(x.tweets()[0].media.media_ids, ["m1", "m1"]);
      assert.ok(x.tweets()[0].text.includes("Nekobasu (CATBUS)"));
    }
    // Twenty minutes later (the next run): too soon.
    const early = fakeX();
    assert.ok((await run({ root: s.dir, env: CREDS, fetchImpl: early, now: at(t + 20 * MIN), ...quiet })).waited);
    assert.equal(early.calls.length, 0);
    t += 180 * MIN;
  }
  assert.deepEqual(order, ["NEKOBUS", ...UPDATES.posts.map((p) => p.id)]);
  const st = s.read("updates.json");
  assert.equal(st.adoptionsPosted.NEKOBUS.status, "posted");
  assert.ok(st.posts.every((p) => p.status === "posted" && p.tweet && p.postedAt));
  const x = fakeX();
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, now: at(t), ...quiet });
  assert.equal(r.posted, null);
  assert.equal(x.calls.length, 0);
});

test("state: 'posting' is saved before the post goes out, 'posted' with its id after; a crash left 'posting' is never retried", async () => {
  const s = sandbox();
  const seen = [];
  const x = fakeX({ onTweet: () => seen.push(s.read("updates.json").adoptionsPosted.NEKOBUS) });
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, now: at(T0), ...quiet });
  assert.equal(seen[0].status, "posting");
  assert.equal(seen[0].attempts, 1);
  const rec = s.read("updates.json").adoptionsPosted.NEKOBUS;
  assert.deepEqual([rec.status, rec.tweet, rec.postedAt, rec.mint], ["posted", r.posted.tweet, new Date(T0).toISOString(), ADOPTIONS.adoptions[0].mint]);
  assert.equal(s.read("updates.json").lastPostedAt, new Date(T0).toISOString());
  // An update: the same.
  const seen2 = [];
  const x2 = fakeX({ onTweet: () => seen2.push(s.read("updates.json").posts[0].status) });
  await run({ root: s.dir, env: CREDS, fetchImpl: x2, now: at(T0 + 180 * MIN), ...quiet });
  assert.deepEqual(seen2, ["posting"]);
  assert.equal(s.read("updates.json").posts[0].status, "posted");
  // Left "posting" by a crash: skipped for good, the next one goes.
  const crashed = sandbox({ updates: { ...UPDATES, adoptionsPosted: { NEKOBUS: { status: "posting", attempts: 1 } } } });
  const x3 = fakeX();
  const r3 = await run({ root: crashed.dir, env: CREDS, fetchImpl: x3, now: at(T0), ...quiet });
  assert.equal(r3.posted.id, UPDATES.posts[0].id);
  assert.equal(crashed.read("updates.json").adoptionsPosted.NEKOBUS.status, "posting");
});

test("a draft that fails the checks is held and never posted; the next one goes out in its place", async () => {
  const posts = [
    { id: "bad", text: `🚀 Buy CATBUS before it moons!\n${SITE}\n#catcoin`, approved: true, status: "queued", postedAt: null, tweet: null },
    { id: "unapproved", text: `🐾 Fine words\n${SITE}\n#catcoin`, approved: false, status: "queued", postedAt: null, tweet: null },
    { id: "elsewhere", text: `🐾 See https://example.com/ and ${SITE}\n#catcoin`, approved: true, status: "queued", postedAt: null, tweet: null },
    { id: "good", text: `🐾 A new cat moves in every hour\n${SITE}\n#catcoin`, approved: true, status: "queued", postedAt: null, tweet: null },
  ];
  const s = sandbox({ updates: { ...UPDATES, posts }, adoptions: { adoptions: [] } });
  const x = fakeX();
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, now: at(T0), ...quiet });
  assert.deepEqual(r.held, ["bad", "elsewhere"]);
  assert.equal(r.posted.id, "good");
  assert.deepEqual(x.tweets().map((t) => t.text), [posts[3].text]);
  const st = s.read("updates.json").posts;
  assert.equal(st[0].status, "held");
  assert.ok(st[0].violations.some((v) => v.rule === "price_talk"));
  assert.ok(st[2].violations.some((v) => v.rule === "link"));
  assert.equal(st[1].status, "queued");
  const x2 = fakeX();
  await run({ root: s.dir, env: CREDS, fetchImpl: x2, now: at(T0 + 999 * MIN), ...quiet });
  assert.equal(x2.calls.length, 0);
  // An adoption whose coin does not carry its cat's kit name is not one (the site would not show it): skipped, never posted.
  const s2 = sandbox({ adoptions: { adoptions: [{ ...ADOPTIONS.adoptions[0], name: "Nekobasu to the moon" }] } });
  const r2 = await run({ root: s2.dir, env: CREDS, fetchImpl: fakeX(), now: at(T0), ...quiet });
  assert.deepEqual(r2.held, []);
  assert.equal(s2.read("updates.json").adoptionsPosted.NEKOBUS, undefined);
  assert.equal(r2.posted.id, UPDATES.posts[0].id);
});

test("no X secrets: nothing drafted, recorded or sent; dry run: the draft is logged and nothing changes", async () => {
  const files = ["updates.json", "adoptions.json", "announced.json"];
  const s = sandbox();
  const before = files.map((f) => s.raw(f));
  const x = fakeX();
  for (const env of [{}, { X_API_KEY: "only-one" }]) {
    const r = await run({ root: s.dir, env, fetchImpl: x, now: at(T0), ...quiet });
    assert.equal(r.mode, "none");
  }
  assert.equal(x.calls.length, 0);
  assert.deepEqual(files.map((f) => s.raw(f)), before);
  const d = sandbox({ config: { dryRun: true } });
  const lines = [];
  const r = await run({ root: d.dir, env: CREDS, fetchImpl: x, now: at(T0), log: (l) => lines.push(l) });
  assert.equal(r.mode, "dryRun");
  assert.equal(x.calls.length, 0);
  assert.equal(d.raw("updates.json"), before[0]);
  assert.ok(lines.some((l) => l.includes("would post adoption NEKOBUS") && l.includes("Nekobasu (CATBUS)")));
});

test("a 429 stops the run: nothing else is tried, the post keeps its tries and goes out on a later run", async () => {
  const s = sandbox();
  const x = fakeX({ fail: (u) => (u.endsWith("/2/tweets") ? 429 : null) });
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, now: at(T0), ...quiet });
  assert.deepEqual(r.failed, ["NEKOBUS"]);
  assert.equal(x.tweets().length, 1);
  const st = s.read("updates.json");
  assert.equal(st.adoptionsPosted.NEKOBUS.status, "failed");
  assert.equal(st.adoptionsPosted.NEKOBUS.attempts, 0);
  assert.equal(st.lastPostedAt, null);
  assert.ok(st.posts.every((p) => p.status === "queued"));
  const r2 = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX(), now: at(T0 + 20 * MIN), ...quiet });
  assert.equal(r2.posted.id, "NEKOBUS");
});

test("a failed post is tried at most 3 times, one try a run, then the queue moves on", async () => {
  const s = sandbox();
  let t = T0;
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const x = fakeX({ fail: (u) => (u.endsWith("/2/tweets") ? 503 : null) });
    const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, now: at(t), ...quiet });
    assert.deepEqual(r.failed, ["NEKOBUS"]);
    assert.equal(x.tweets().length, 1, "one try a run");
    assert.equal(s.read("updates.json").adoptionsPosted.NEKOBUS.attempts, i);
    t += 20 * MIN;
  }
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX(), now: at(t), ...quiet });
  assert.equal(r.posted.id, UPDATES.posts[0].id);
  assert.equal(s.read("updates.json").adoptionsPosted.NEKOBUS.status, "failed");
});

test("announce workflow: post-updates.mjs runs in the one step with the X secrets, both posters always run, the step fails if either did, and its file is committed", { skip: process.platform === "win32" }, () => {
  const W = fs.readFileSync(path.join(ROOT, ".github/workflows/announce.yml"), "utf8");
  const steps = W.split(/\n      - /).filter((s) => /secrets\./.test(s));
  assert.equal(steps.length, 1);
  assert.match(steps[0], /node scripts\/announce\.mjs[\s\S]*node scripts\/post-updates\.mjs/);
  assert.match(W, /git add -- [^\n]*data\/updates\.json/);
  const script = steps[0].slice(steps[0].indexOf("run: |") + "run: |".length).replace(/^ {10}/gm, "").trim();
  // A stand-in node that records what ran and fails as told.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "announce-step-"));
  const ran = path.join(dir, "ran");
  fs.writeFileSync(path.join(dir, "node"), '#!/bin/sh\necho "$1" >> "$RAN"\ncase "$1" in\n  scripts/post-thread.mjs) exit "${FAIL_THREAD:-0}" ;;\n  scripts/announce.mjs) exit "${FAIL_ANNOUNCE:-0}" ;;\n  scripts/post-updates.mjs) exit "${FAIL_UPDATES:-0}" ;;\nesac\nexit 99\n', { mode: 0o755 });
  const step = (fail) => {
    fs.rmSync(ran, { force: true });
    const r = spawnSync("bash", ["-e", "-c", script], { env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, RAN: ran, ...fail } });
    return { code: r.status, ran: fs.readFileSync(ran, "utf8").trim().split("\n").map((l) => path.basename(l)) };
  };
  assert.deepEqual(step({}), { code: 0, ran: ["post-thread.mjs", "announce.mjs", "post-updates.mjs"] });
  assert.deepEqual(step({ FAIL_ANNOUNCE: "3" }), { code: 3, ran: ["post-thread.mjs", "announce.mjs", "post-updates.mjs"] });
  assert.deepEqual(step({ FAIL_UPDATES: "1" }), { code: 1, ran: ["post-thread.mjs", "announce.mjs", "post-updates.mjs"] });
  assert.deepEqual(step({ FAIL_THREAD: "2" }), { code: 2, ran: ["post-thread.mjs", "announce.mjs", "post-updates.mjs"] }, "a refused thread never holds up the cats");
});

/* ── Review fixes: a cat the sanctuary launches itself is never "adopted by a visitor" (A); the last line before X (D) ── */

const SANCT_MINT = "Gu11GadotMint1111111111111111111111111111pum";
const SANCT_LAUNCH = { mint: SANCT_MINT, tx: "5".repeat(88), launchpad: "pump.fun", at: "2026-09-28T10:00:00Z" };
const withLaunch = (ticker, launch = SANCT_LAUNCH) => ({ cats: ADOPTABLES.cats.map((c) => (c.ticker === ticker ? { ...c, launch } : c)) });

test("candidates: no adoption of a cat the sanctuary launches itself (launched or still launching), and no adoption of a coin a launch field names (A)", () => {
  const a = ADOPTIONS.adoptions[0];
  const updates = { posts: [{ id: "u1", approved: true, status: "queued" }] };
  assert.deepEqual(candidates(updates, ADOPTIONS, { cats: CATS }).map((c) => c.id), [a.key, "u1"], "control");
  for (const collection of [{ cats: [] }, COLLECTION]) {
    const cats = listCats(read("data/planned.json"), collection, withLaunch(a.key));
    assert.equal(cats.find((c) => c.key === a.key).sanctuary, true);
    assert.deepEqual(candidates(updates, ADOPTIONS, { cats }).map((c) => c.id), ["u1"]);
  }
  // A clone of the sanctuary's coin recorded for another cat, and the sanctuary's own coin: never one.
  const other = ADOPTABLES.cats.find((c) => c.ticker !== a.key);
  const own = { ...a, key: other.ticker, name: other.coinName || other.name, symbol: other.launchTicker || other.ticker, mint: SANCT_MINT };
  assert.deepEqual(candidates(updates, { adoptions: [own] }, { cats: CATS }).map((c) => c.id), [other.ticker, "u1"], "control");
  assert.deepEqual(candidates(updates, { adoptions: [own] }, { cats: CATS, ownMints: new Set([SANCT_MINT]) }).map((c) => c.id), ["u1"]);
});

test("run: an adoption of a cat with a launch field is never posted, and a launch field's mint is the owner's own coin (A)", async () => {
  const s = sandbox({ adoptables: withLaunch("NEKOBUS") });
  const x = fakeX();
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, now: at(T0), ...quiet });
  assert.deepEqual([r.posted.kind, r.posted.id], ["update", UPDATES.posts[0].id]);
  assert.deepEqual(x.tweets().map((t) => t.text), [UPDATES.posts[0].text], "no \"ADOPTED! … launched by a visitor\" post");
  assert.equal(s.read("updates.json").adoptionsPosted.NEKOBUS, undefined);
  // Another cat's launch field names the adopted coin's mint: it is the sanctuary's coin, not a visitor's.
  const other = ADOPTABLES.cats.find((c) => c.ticker !== "NEKOBUS");
  const s2 = sandbox({ adoptables: { cats: [...ADOPTABLES.cats.filter((c) => c.ticker === "NEKOBUS"), { ...other, launch: { ...SANCT_LAUNCH, mint: ADOPTIONS.adoptions[0].mint } }] } });
  const r2 = await run({ root: s2.dir, env: CREDS, fetchImpl: fakeX(), now: at(T0), ...quiet });
  assert.equal(r2.posted.kind, "update");
  assert.equal(s2.read("updates.json").adoptionsPosted.NEKOBUS, undefined);
});

test("the last line before X: an update or adoption draft naming a Solana address is held, never posted (D)", async () => {
  const mint = "7Yk3fQeW9sPzD4nV2mXcR8tLbH6uJgA1oKqE5iNwTy3p";
  const posts = [
    { id: "ca", text: `🐾 The new coin: ${mint}\n${SITE}\n#catcoin`, approved: true, status: "queued", postedAt: null, tweet: null },
    { id: "good", text: `🐾 A new cat moves in every hour\n${SITE}\n#catcoin`, approved: true, status: "queued", postedAt: null, tweet: null },
  ];
  assert.equal(checkUpdate(posts[0].text).ok, true, "the other checks let it through");
  const s = sandbox({ updates: { ...UPDATES, posts }, adoptions: { adoptions: [] } });
  const x = fakeX();
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, now: at(T0), ...quiet });
  assert.deepEqual(r.held, ["ca"]);
  assert.equal(r.posted.id, "good");
  assert.ok(!x.tweets().some((t) => t.text.includes(mint)));
  const st = s.read("updates.json").posts[0];
  assert.equal(st.status, "held");
  assert.deepEqual(st.violations.map((v) => v.rule), ["address"]);
  // Dry run: held too, nothing logged as a post.
  const logs = [];
  const d = await run({ root: sandbox({ updates: { ...UPDATES, posts }, adoptions: { adoptions: [] }, config: { dryRun: true } }).dir, env: CREDS, fetchImpl: fakeX(), now: at(T0), log: (m) => logs.push(m) });
  assert.deepEqual(d.held, ["ca"]);
  assert.ok(!logs.some((m) => m.includes(mint) && /would post/.test(m)));
});
