/* The X announcer: drafting, the content rules, length, no double posts, the missing-secrets path, and its workflow. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./helpers.mjs";
import { INGAME_LINE, listCats, draft, checkPost, weightedLength, cardLink, pick, run, LIMIT, readiness, rosterLeft, releasesFile, PAUSED_REASON, addressIn, guardDraft, provedCollection, postImages } from "../scripts/announce.mjs";
import { proveLaunchPump } from "../scripts/lib/chain.mjs";
import { pumpLaunch } from "./helpers.mjs";
import { oauthHeader } from "../scripts/lib/x-api.mjs";
import { hiddenByQueue } from "../assets/residents.js";

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const PLANNED = read("data/planned.json");
const CATS = listCats(PLANNED);
const CREDS = { X_API_KEY: "k", X_API_SECRET: "s", X_ACCESS_TOKEN: "t", X_ACCESS_SECRET: "a" };

function sandbox({ announced = { cats: {} }, config = {}, planned = PLANNED, queue = null, collection = { cats: [] }, adoptables = null, wallets = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "announce-"));
  fs.mkdirSync(path.join(dir, "data"));
  const w = (f, v) => fs.writeFileSync(path.join(dir, "data", f), JSON.stringify(v));
  w("planned.json", planned); w("collection.json", collection); w("announced.json", announced); w("announce-config.json", config);
  if (queue) w("release-queue.json", queue);
  if (adoptables) w("adoptables.json", adoptables);
  // The bots read the collection as the page does (validated), so the test entries' payers are listed launchers unless a test says otherwise.
  w("wallets.json", wallets ?? { launchers: [...new Set((collection.cats || []).map((e) => e?.payer).filter(Boolean))].map((address) => ({ address, since: "2020-01-01", label: "Test launcher" })) });
  return { dir, read: (f) => JSON.parse(fs.readFileSync(path.join(dir, "data", f), "utf8")) };
}
/** A fake X: records every request, answers each post with a new id. */
function fakeX({ fail = null } = {}) {
  const calls = []; let n = 100;
  const f = async (url, init) => {
    calls.push({ url, init });
    assert.match(init.headers.Authorization, /^OAuth oauth_consumer_key="k", .*oauth_signature="/);
    if (fail?.(url)) return new Response(JSON.stringify({ title: "nope" }), { status: fail(url) });
    if (url.includes("media/upload")) return new Response(JSON.stringify({ data: { id: "m1" } }), { status: 200 });
    return new Response(JSON.stringify({ data: { id: String(n++) } }), { status: 201 });
  };
  f.calls = calls; return f;
}
const quiet = { log: () => {}, sleep: async () => {} };

test("the card link is the site's own deep link (#cat=<id>, as assets/ui/main.js reads it)", () => {
  const main = fs.readFileSync(path.join(ROOT, "assets/ui/main.js"), "utf8");
  assert.ok(main.includes("#cat=${encodeURIComponent(id)}"));
  assert.match(cardLink("PATCHPAW"), /^https:\/\/catcoinsanctuary\.com\/(\?v=\w+)?#cat=PATCHPAW$/);
});

test("every planned cat drafts to <= 280 characters that pass the content rules, or is held", () => {
  let ok = 0;
  for (const c of CATS) {
    const d = draft(c);
    if (!d.ok) { assert.ok(d.violations.length > 0, c.key); continue; }
    ok++;
    const [p1, p2] = d.posts;
    assert.ok(weightedLength(p1.text) <= LIMIT && p1.text.length <= LIMIT, `${c.key}: ${p1.text.length}`);
    assert.ok(p1.text.includes(c.name) || p1.text.includes("Meet "), c.key);
    assert.ok(p1.text.includes(cardLink(c.id)), c.key);
    assert.ok(p1.text.includes("No coin yet: be the first to adopt it"), c.key);
    assert.match(p1.text, /#catcoin/);
    assert.doesNotMatch(p1.text, /\b(price|buy|moon|pump|profit|guarantee)/i, c.key);
    if (c.proof?.kind === "x") assert.ok(p1.text.includes(`As seen in @${c.proof.handle}'s post`), c.key);
    if (p2) { assert.ok(weightedLength(p2.text) <= LIMIT, c.key); assert.ok(p2.text.includes(c.proof.url), c.key); }
  }
  assert.ok(ok >= CATS.length - 5, `${ok} of ${CATS.length} drafted`);
});

test("the rules refuse price talk, promises, links that are not cited, brands, and overlong posts", () => {
  for (const bad of ["Buy it before it moons", "Guaranteed returns for holders", "Price target $5", "100x soon", "Visit scamcoin.xyz now", "A cat for Tesla fans", "x".repeat(281)]) {
    assert.equal(checkPost(bad).ok, false, bad);
  }
  assert.equal(checkPost("Meet Patchpaw, a calico.\nhttps://catcoinsanctuary.com/#cat=PATCHPAW", ["https://catcoinsanctuary.com/#cat=PATCHPAW"]).ok, true);
});

test("backlog: the seeded record marks every existing cat backlog, and a run takes new cats first, then 1-2 from the backlog", () => {
  const seeded = read("data/announced.json");
  const ADOPTABLE = read("data/adoptables.json").cats;
  // A cat the launcher launched has no record until the announcer's next run holds it by rule (holdSanctuaryCats).
  const unrecorded = ADOPTABLE.filter((c) => c.launch && !seeded.cats[c.ticker]);
  assert.equal(Object.keys(seeded.cats).length, PLANNED.cats.length + ADOPTABLE.length - unrecorded.length);
  for (const c of ADOPTABLE) assert.ok(["held", "backlog", "posted", "queued", "failed"].includes(seeded.cats[c.ticker]?.status) || unrecorded.includes(c), `${c.ticker} has a record`);
  for (const c of PLANNED.cats) assert.ok(["backlog", "posted", "queued", "failed", "held"].includes(seeded.cats[c.ticker]?.status), c.ticker);
  const cfg = read("data/announce-config.json");
  assert.equal(typeof cfg.dryRun, "boolean");
  // The live record drains as cats post, so the picking rules run on a fixed state: three in the backlog, the rest posted.
  const state = { cats: Object.fromEntries(CATS.map((c, i) => [c.key, { status: i < 3 ? "backlog" : "posted" }])) };
  assert.equal(pick(CATS, state, { ...cfg, perRun: 3, announceBacklog: true, backlogPerRun: 2 }).length, 2);
  assert.equal(pick(CATS, state, { ...cfg, announceBacklog: false }).length, 0);
  const oneNew = structuredClone(state); delete oneNew.cats[CATS[5].key];
  const p = pick(CATS, oneNew, { perRun: 3, announceBacklog: true, backlogPerRun: 1 });
  const firstBacklog = CATS.find((c) => oneNew.cats[c.key]?.status === "backlog");
  assert.deepEqual(p.map((c) => c.key), [CATS[5].key, firstBacklog.key]);
});

test("dry run: drafts go to the queue as a preview, nothing is recorded, nothing reaches X", async () => {
  const s = sandbox({ config: { dryRun: true, perRun: 2 } });
  const x = fakeX();
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, ...quiet });
  assert.equal(r.mode, "dryRun");
  assert.equal(x.calls.length, 0);
  assert.deepEqual(s.read("announced.json"), { cats: {} });
  const q = s.read("announce-queue.json");
  assert.equal(q.drafts.length, 2);
  assert.match(q.drafts[0].posts[0].intent, /^https:\/\/x\.com\/intent\/post\?text=/);
});

test("missing secrets: no failure, drafts queued with intent links, cats recorded as queued and not queued twice", async () => {
  const s = sandbox({ config: { dryRun: false, perRun: 2 } });
  const r1 = await run({ root: s.dir, env: {}, ...quiet });
  assert.equal(r1.mode, "queue");
  assert.equal(r1.queued.length, 2);
  const r2 = await run({ root: s.dir, env: { X_API_KEY: "only-one" }, ...quiet });
  assert.equal(r2.mode, "queue");
  assert.ok(!r2.queued.some((k) => r1.queued.includes(k)));
  const q = s.read("announce-queue.json");
  assert.equal(q.drafts.length, 4);
  assert.equal(new Set(q.drafts.map((d) => d.key)).size, 4);
  for (const k of [...r1.queued, ...r2.queued]) assert.equal(s.read("announced.json").cats[k].status, "queued");
});

test("posting: at most perRun cats, spaced apart, image + proof reply, ids recorded, never posted twice", async () => {
  const withProof = CATS.slice(2).find((c) => c.proof?.kind === "x" && draft(c).posts.length === 2);
  const planned = { ...PLANNED, cats: PLANNED.cats.filter((c) => c.ticker === withProof.key || c.ticker === CATS[0].key || c.ticker === CATS[1].key) };
  const s = sandbox({ planned, config: { dryRun: false, perRun: 2, spacingMinutes: 7 } });
  fs.mkdirSync(path.join(s.dir, "assets/portraits"), { recursive: true });
  for (const c of planned.cats) fs.writeFileSync(path.join(s.dir, c.portrait), Buffer.from([0xff, 0xd8, 0xff]));
  const x = fakeX(); const sleeps = [];
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, log: () => {}, sleep: async (ms) => { sleeps.push(ms); } });
  assert.equal(r.posted.length, 2);
  assert.deepEqual(sleeps, [7 * 60_000]);
  const tweets = x.calls.filter((c) => c.url === "https://api.x.com/2/tweets").map((c) => JSON.parse(c.init.body));
  assert.ok(tweets[0].media?.media_ids?.[0] === "m1");
  const state = s.read("announced.json").cats;
  for (const p of r.posted) assert.equal(state[p.key].status, "posted");
  const replies = tweets.filter((t) => t.reply);
  for (const t of replies) assert.ok(tweets.some(() => true) && t.reply.in_reply_to_tweet_id);
  // Second and third runs: only the one remaining cat, then nothing.
  const x2 = fakeX();
  const r2 = await run({ root: s.dir, env: CREDS, fetchImpl: x2, ...quiet });
  assert.equal(r2.posted.length, 1);
  assert.ok(!r.posted.some((p) => p.key === r2.posted[0].key));
  const x3 = fakeX();
  const r3 = await run({ root: s.dir, env: CREDS, fetchImpl: x3, ...quiet });
  assert.equal(r3.posted.length, 0);
  assert.equal(x3.calls.length, 0);
});

test("a cat left 'posting' by a crash is never retried; a refused post is recorded failed and the run stops", async () => {
  const [a, b] = CATS;
  const s = sandbox({ announced: { cats: { [a.key]: { status: "posting" } } }, planned: { ...PLANNED, cats: PLANNED.cats.slice(0, 3) }, config: { dryRun: false, perRun: 3, thread: false } });
  const x = fakeX({ fail: (u) => (u.endsWith("/2/tweets") ? 401 : null) });
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, ...quiet });
  assert.deepEqual(r.failed, [b.key]);
  const st = s.read("announced.json").cats;
  assert.equal(st[a.key].status, "posting");
  assert.equal(st[b.key].status, "failed");
  assert.equal(st[b.key].attempts, 1);
  assert.equal(st[PLANNED.cats[2].ticker], undefined);
});

test("OAuth 1.0a header is well formed and deterministic for a fixed nonce and time", () => {
  // Credentials from the developer.x.com signature example; JSON and multipart bodies are never signed.
  const h = oauthHeader("POST", "https://api.x.com/1.1/statuses/update.json?include_entities=true",
    { apiKey: "xvz1evFS4wEEPTGEFPHBog", apiSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw", accessToken: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb", accessSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE" },
    { nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg", timestamp: 1318622958 });
  assert.match(h, /oauth_signature="[A-Za-z0-9%]+"/);
  assert.match(h, /oauth_signature_method="HMAC-SHA1"/);
});

test("announce workflow: pinned actions, push on planned.json + every 20 min, contents: write for posting, actions: write only for the next-run job, X secrets only in the posting step", () => {
  const W = fs.readFileSync(path.join(ROOT, ".github/workflows/announce.yml"), "utf8");
  const uses = [...W.matchAll(/uses:\s*(\S+)\s*#\s*(\S+)/g)].map((m) => `${m[1]} ${m[2]}`);
  assert.deepEqual(uses, ["actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 v7.0.1", "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 v7.0.0"]);
  assert.match(W, /push:\n\s+branches: \[main\]\n\s+paths:\n\s+- data\/planned\.json/);
  assert.match(W, /cron: "\*\/20 \* \* \* \*"/);
  assert.match(W, /^permissions: \{\}$/m);
  const perms = [...W.matchAll(/^\s+permissions:\n((?:\s{6}\S.*\n)+)/gm)].map((m) => m[1].trim());
  assert.deepEqual(perms, ["contents: write", "actions: write"]);
  // The next-run job runs no code of the repository's: no checkout, no node, no secrets.
  const next = W.slice(W.indexOf("\n  next:"));
  assert.match(next, /needs: announce/);
  assert.match(next, /gh workflow run announce\.yml/);
  assert.match(next, /vars\.ANNOUNCE_CHAIN != 'off'/);
  assert.ok(!/uses:|\bnode\b|\bnpm\b|secrets\./.test(next), "the next job runs repository code or sees a secret");
  assert.match(W, /persist-credentials: false/);
  const steps = W.split(/\n      - /);
  const withSecrets = steps.filter((s) => /secrets\./.test(s));
  assert.equal(withSecrets.length, 1);
  assert.match(withSecrets[0], /node scripts\/announce\.mjs/);
  assert.deepEqual([...new Set([...W.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]))].sort(), ["X_ACCESS_SECRET", "X_ACCESS_TOKEN", "X_API_KEY", "X_API_SECRET"]);
  assert.match(W, /git add -- data\/announced\.json data\/announce-queue\.json data\/release-queue\.json data\/releases\.json/);
  assert.match(W, /- data\/release-queue\.json/);
});

/* ── Releases: after the initial roster, one approved, ready cat an hour; X first, then the site ── */
function releaseSandbox({ queueKeys, announced, fail = false } = {}) {
  const cats = PLANNED.cats.filter((c) => c.proof?.url).slice(0, 4);
  const planned = { ...PLANNED, cats };
  const state = { cats: Object.fromEntries(cats.map((c) => [c.ticker, { status: "posted", ids: ["1"] }])) };
  for (const k of queueKeys) delete state.cats[k];
  Object.assign(state.cats, announced || {});
  const s = sandbox({ planned, announced: state, config: { dryRun: false, perRun: 1, thread: false }, queue: { lastReleaseAt: null, cats: queueKeys.map((key) => ({ key, approved: true })) } });
  fs.mkdirSync(path.join(s.dir, "assets/portraits"), { recursive: true });
  fs.mkdirSync(path.join(s.dir, "assets/kits"), { recursive: true });
  fs.mkdirSync(path.join(s.dir, "assets/ingame"), { recursive: true });
  for (const c of cats) fs.writeFileSync(path.join(s.dir, c.portrait), Buffer.from([0xff, 0xd8, 0xff]));
  for (const c of cats) fs.writeFileSync(path.join(s.dir, `assets/ingame/${c.ticker}.jpg`), Buffer.from([0xff, 0xd8, 0xff]));
  fs.writeFileSync(path.join(s.dir, "assets/kits/kits.json"), JSON.stringify({ cats: Object.fromEntries(cats.map((c) => [c.ticker, { token: `assets/kits/${c.ticker}/token.png` }])) }));
  return { ...s, cats };
}

test("release queue: queued cats are never posted as roster cats, and hold the roster open only if not queued", () => {
  const state = { cats: {} };
  const queued = new Set(CATS.map((c) => c.key));
  assert.equal(pick(CATS, state, { perRun: 3 }, queued).length, 0);
  assert.equal(rosterLeft(CATS, state, queued), 0);
  assert.ok(rosterLeft(CATS, state) > 0);
});

test("release: roster empty -> the first approved, ready cat is posted on X, then released with its tweet id; one an hour", async () => {
  const [, , a, b] = PLANNED.cats.filter((c) => c.proof?.url).slice(0, 4).map((c) => c.ticker);
  const s = releaseSandbox({ queueKeys: [a, b] });
  let t = Date.parse("2026-10-01T10:00:00Z");
  const now = () => new Date(t);
  const x = fakeX();
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, now, ...quiet });
  assert.equal(r.released, a);
  const q = s.read("release-queue.json");
  assert.equal(q.cats[0].status, "released");
  assert.equal(q.cats[0].tweet, r.posted[0].ids[0]);
  assert.equal(q.lastReleaseAt, "2026-10-01T10:00:00.000Z");
  const rel = s.read("releases.json");
  assert.deepEqual(rel.hidden, [b]);
  assert.equal(rel.released[0].key, a);
  // 20 minutes later: too soon.
  t += 20 * 60_000;
  const r2 = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX(), now, ...quiet });
  assert.equal(r2.posted.length, 0);
  // An hour after the first: the next one.
  t += 40 * 60_000;
  const r3 = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX(), now, ...quiet });
  assert.equal(r3.released, b);
  assert.deepEqual(s.read("releases.json").hidden, []);
});

test("release: if X refuses, the cat is not released on the site and is tried again next run", async () => {
  const k = PLANNED.cats.filter((c) => c.proof?.url)[3].ticker;
  const s = releaseSandbox({ queueKeys: [k] });
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX({ fail: (u) => (u.endsWith("/2/tweets") ? 503 : null) }), ...quiet });
  assert.deepEqual(r.failed, [k]);
  assert.equal(s.read("release-queue.json").cats[0].status, undefined);
  assert.deepEqual(s.read("releases.json").hidden, [k]);
  const r2 = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX(), ...quiet });
  assert.equal(r2.released, k);
});

test("release: not while the roster lasts; held, unapproved or incomplete cats wait; no secrets means no release", async () => {
  const keys = PLANNED.cats.filter((c) => c.proof?.url).slice(0, 4).map((c) => c.ticker);
  // A backlog cat left: that goes first, the queue waits.
  let s = releaseSandbox({ queueKeys: [keys[3]], announced: { [keys[0]]: { status: "backlog" } } });
  let r = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX(), ...quiet });
  assert.deepEqual(r.posted.map((p) => p.key), [keys[0]]);
  assert.equal(r.released, undefined);
  // Held stays held.
  s = releaseSandbox({ queueKeys: [keys[3]], announced: { [keys[3]]: { status: "held" } } });
  r = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX(), ...quiet });
  assert.equal(r.posted.length, 0);
  // Missing kit: not ready.
  s = releaseSandbox({ queueKeys: [keys[3]] });
  fs.writeFileSync(path.join(s.dir, "assets/kits/kits.json"), JSON.stringify({ cats: {} }));
  assert.deepEqual(readiness(s.cats[3] && listCats({ ...PLANNED, cats: [s.cats[3]] })[0], { root: s.dir, kits: {} }), ["kit"]);
  r = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX(), ...quiet });
  assert.equal(r.posted.length, 0);
  // Missing in-game shot: not ready.
  s = releaseSandbox({ queueKeys: [keys[3]] });
  fs.rmSync(path.join(s.dir, `assets/ingame/${keys[3]}.jpg`));
  assert.deepEqual(readiness(listCats({ ...PLANNED, cats: [s.cats[3]] })[0], { root: s.dir, kits: { [keys[3]]: { token: "x" } } }), ["ingame"]);
  r = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX(), ...quiet });
  assert.equal(r.posted.length, 0);
  // Not approved.
  s = releaseSandbox({ queueKeys: [keys[3]] });
  const q = s.read("release-queue.json"); q.cats[0].approved = false; fs.writeFileSync(path.join(s.dir, "data/release-queue.json"), JSON.stringify(q));
  r = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX(), ...quiet });
  assert.equal(r.posted.length, 0);
  // No X secrets: drafted, never released.
  s = releaseSandbox({ queueKeys: [keys[3]] });
  r = await run({ root: s.dir, env: {}, ...quiet });
  assert.equal(r.released, undefined);
  assert.deepEqual(s.read("releases.json").hidden, [keys[3]]);
});

test("release: queueing an adoptable held only because announcing is paused releases it; shown: true cats are never hidden", async () => {
  const keys = PLANNED.cats.filter((c) => c.proof?.url).slice(0, 4).map((c) => c.ticker);
  let s = releaseSandbox({ queueKeys: [keys[3]], announced: { [keys[3]]: { status: "held", reason: PAUSED_REASON } } });
  let r = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX(), ...quiet });
  assert.deepEqual(r.posted.map((p) => p.key), [keys[3]]);
  assert.equal(r.released, keys[3]);
  // Any other hold still holds.
  s = releaseSandbox({ queueKeys: [keys[3]], announced: { [keys[3]]: { status: "held", reason: "proof does not show or name a cat" } } });
  r = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX(), ...quiet });
  assert.equal(r.posted.length, 0);
  const rel = releasesFile({ cats: [{ key: "A", approved: true }, { key: "B", approved: true, shown: true }, { key: "C", status: "released", releasedAt: "2026-09-27T00:00:00Z" }] }, "now");
  assert.deepEqual(rel.hidden, ["A"]);
  assert.deepEqual([...hiddenByQueue({ cats: [{ key: "A" }, { key: "B", shown: true }, { key: "C", status: "released" }] })], ["A"]);
});

test("adoptable cats: the lore picture object gives the portrait path", () => {
  const [c] = listCats({ stocks: [], cats: [] }, { cats: [] }, { cats: [{ ticker: "LOREOBJ", name: "L", lore: { image: "assets/lore/LOREOBJ.webp", caption: "c" } }] });
  assert.equal(c.portrait, "assets/lore/LOREOBJ.webp");
  assert.deepEqual(readiness(c, { root: ROOT, kits: {} }).includes("portrait"), true);
});

test("adoptable cats with no lore picture yet: their own portrait is the post image, and they are ready with it", () => {
  const s = fs.mkdtempSync(path.join(os.tmpdir(), "announce-"));
  fs.mkdirSync(path.join(s, "assets/portraits"), { recursive: true });
  fs.writeFileSync(path.join(s, "assets/portraits/NOLORE.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
  const [c, p] = listCats({ stocks: [], cats: [] }, { cats: [] }, { cats: [
    { ticker: "NOLORE", name: "N", portrait: "assets/portraits/NOLORE.jpg", lore: null },
    { ticker: "PENDING", name: "P", portrait: "pending", lore: null }] });
  assert.equal(c.portrait, "assets/portraits/NOLORE.jpg");
  assert.equal(p.portrait, "assets/lore/PENDING.webp");
  assert.equal(readiness(c, { root: s, kits: {} }).includes("portrait"), false);
  assert.equal(readiness(p, { root: s, kits: {} }).includes("portrait"), true);
  assert.deepEqual(postImages(c, { image: c.portrait }, s), [path.join(s, "assets/portraits/NOLORE.jpg")]);
});

test("shipped release queue: approved adoptable cats held as paused, all shown (the site keeps showing them)", () => {
  const q = read("data/release-queue.json");
  const ann = read("data/announced.json").cats;
  for (const e of q.cats.filter((e) => e.status !== "released")) {
    assert.equal(e.shown, true, e.key);
    assert.ok(["held", "posting", "posted", "failed", "needs_review"].includes(ann[e.key]?.status) || !ann[e.key], e.key);
  }
});

test("the shipped release queue and releases file are well formed", () => {
  const q = read("data/release-queue.json");
  assert.ok(Array.isArray(q.cats));
  for (const e of q.cats) assert.equal(typeof e.key, "string");
  const rel = read("data/releases.json");
  assert.ok(Array.isArray(rel.hidden) && Array.isArray(rel.released));
});

test("in-game shot: a second image after the lore photo, a line in the post if it fits, and a failed upload still posts", async () => {
  const cat = CATS[0];
  const planned = { ...PLANNED, cats: PLANNED.cats.filter((c) => c.ticker === cat.key) };
  const setup = ({ portrait = true, game = true } = {}) => {
    const s = sandbox({ planned, config: { dryRun: false, perRun: 1, thread: false } });
    fs.mkdirSync(path.join(s.dir, "assets/portraits"), { recursive: true });
    fs.mkdirSync(path.join(s.dir, "assets/ingame"), { recursive: true });
    if (portrait) fs.writeFileSync(path.join(s.dir, planned.cats[0].portrait), Buffer.from([0xff, 0xd8, 0xff, 1]));
    if (game) fs.writeFileSync(path.join(s.dir, `assets/ingame/${cat.key}.jpg`), Buffer.from([0xff, 0xd8, 0xff, 2]));
    return s;
  };
  // Both: two uploads, portrait first, and the post names the in-game look.
  let x = fakeX();
  await run({ root: setup().dir, env: CREDS, fetchImpl: x, ...quiet });
  let ups = x.calls.filter((c) => c.url.includes("media/upload"));
  assert.equal(ups.length, 2);
  let tweet = JSON.parse(x.calls.find((c) => c.url === "https://api.x.com/2/tweets").init.body);
  assert.equal(tweet.media.media_ids.length, 2);
  assert.ok(tweet.text.includes(INGAME_LINE));
  assert.ok(weightedLength(tweet.text) <= LIMIT);
  // Only the in-game shot: one upload.
  x = fakeX();
  await run({ root: setup({ portrait: false }).dir, env: CREDS, fetchImpl: x, ...quiet });
  assert.equal(x.calls.filter((c) => c.url.includes("media/upload")).length, 1);
  // No shot: no line.
  x = fakeX();
  await run({ root: setup({ game: false }).dir, env: CREDS, fetchImpl: x, ...quiet });
  tweet = JSON.parse(x.calls.find((c) => c.url === "https://api.x.com/2/tweets").init.body);
  assert.ok(!tweet.text.includes(INGAME_LINE));
  assert.equal(tweet.media.media_ids.length, 1);
  // The second upload fails: the post goes out with the first.
  x = fakeX({ fail: (url) => (url.includes("media/upload") && x.calls.filter((c) => c.url.includes("media/upload")).length === 2 ? 500 : null) });
  const r = await run({ root: setup().dir, env: CREDS, fetchImpl: x, ...quiet });
  assert.equal(r.posted.length, 1);
  tweet = JSON.parse(x.calls.find((c) => c.url === "https://api.x.com/2/tweets").init.body);
  assert.equal(tweet.media.media_ids.length, 1);
});

test("every planned cat still drafts within 280 with the in-game line", () => {
  for (const c of CATS) { const d = draft(c, { ingame: true }); if (d.ok) assert.ok(weightedLength(d.posts[0].text) <= LIMIT, c.key); }
});

/* ── The last line before X: no post names a Solana address (review finding D) ─────────────────── */

const PUMP_L = pumpLaunch();
const PUMP_ENTRY = (() => { const { launch: x } = proveLaunchPump(PUMP_L.tx, { wallet: PUMP_L.wallet }); const { uri, ...e } = x; return e; })();
const STONK_ENTRY = { ...PUMP_ENTRY, pair: { symbol: "GMEx", mint: "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc" } };
delete STONK_ENTRY.launchpad;

test("addressIn / guardDraft: a base58 run of 32+ characters anywhere (a mint in a card link, a signature, a word) holds the draft; nothing shorter does", () => {
  const mint = PUMP_L.mint, sig = PUMP_L.signature;
  assert.equal(addressIn(`Meet the cat\n${cardLink(mint)}`), mint);
  assert.equal(addressIn(`CA: ${mint} 🚀`), mint);
  assert.equal(addressIn(`the launch ${sig}`), sig, "a signature too");
  assert.equal(addressIn("https://x.com/Rainmaker1973/status/1833451037694308415 #catcoin #CatsOfX"), null);
  assert.equal(addressIn(`${cardLink("MEREDITCAT")} Supercalifragilisticexpialidocious`), null);
  assert.equal(addressIn(`${cardLink(mint)}`, [cardLink(mint)]), null, "the one allowed string");
  assert.equal(addressIn(`${cardLink(mint)} ${mint}`, [cardLink(mint)]), mint, "allowed only where it is allowed");
  const posts = { ok: true, posts: [{ text: "fine" }, { text: `🔗 ${mint}` }], violations: [] };
  const held = guardDraft(posts);
  assert.equal(held.ok, false);
  assert.deepEqual(held.posts, []);
  assert.deepEqual(held.violations, [{ rule: "address", term: `${mint.slice(0, 6)}…`, field: "post" }]);
  const text = guardDraft({ ok: true, text: `New: ${mint}`, violations: [] });
  assert.deepEqual([text.ok, text.text, text.violations[0].rule], [false, null, "address"]);
  const fine = { ok: true, posts: [{ text: "fine" }], violations: [] };
  assert.equal(guardDraft(fine), fine);
  const bad = { ok: false, posts: [], violations: [{ rule: "length" }] };
  assert.equal(guardDraft(bad), bad);
});

test("every shipped cat (planned and adoptable) drafts the same with the guard: none names an address", () => {
  const all = listCats(PLANNED, { cats: [] }, read("data/adoptables.json"));
  for (const c of all) for (const thread of [true, false]) {
    const d = draft(c, { thread });
    assert.equal(guardDraft(d).ok, d.ok, c.key);
  }
});

test("a draft naming an address is held (needs_review) in every mode and never reaches X; an owner-launched StonkFun coin's own card link still posts, as before", async () => {
  const mint = "7Yk3fQeW9sPzD4nV2mXcR8tLbH6uJgA1oKqE5iNwTy3p";
  const cat = PLANNED.cats[0];
  const planned = { ...PLANNED, cats: [{ ...cat, name: `Patch ${mint}` }] };
  for (const config of [{ dryRun: false, perRun: 1, thread: false }, { dryRun: true, perRun: 1 }]) {
    const s = sandbox({ planned, config });
    const x = fakeX();
    const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, ...quiet });
    assert.deepEqual(r.held, [cat.ticker], JSON.stringify(config));
    assert.deepEqual(r.drafts[0].violations.map((v) => v.rule), ["address"]);
    assert.equal(x.calls.filter((c) => c.url === "https://api.x.com/2/tweets").length, 0);
    if (!config.dryRun) assert.equal(s.read("announced.json").cats[cat.ticker].status, "needs_review");
  }
  // An owner-launched StonkFun coin that no cat has: listed by its mint, its card link carries it, and it posts as before.
  const s = sandbox({ planned: { stocks: PLANNED.stocks, cats: [] }, collection: { cats: [STONK_ENTRY] }, config: { dryRun: false, perRun: 1, thread: false } });
  const x = fakeX();
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, ...quiet });
  assert.deepEqual(r.posted.map((p) => p.key), [STONK_ENTRY.mint]);
  const tweet = JSON.parse(x.calls.find((c) => c.url === "https://api.x.com/2/tweets").init.body);
  assert.ok(tweet.text.includes(cardLink(STONK_ENTRY.mint)));
  assert.ok(tweet.text.includes("Adopted! Its owner has launched it"));
});

test("a proved pump.fun coin no adoptable claims is never picked, drafted or posted by the announcer", async () => {
  const s = sandbox({ planned: { stocks: PLANNED.stocks, cats: [] }, collection: { cats: [PUMP_ENTRY] }, config: { dryRun: false, perRun: 3 } });
  const x = fakeX();
  const r = await run({ root: s.dir, env: CREDS, fetchImpl: x, ...quiet });
  assert.deepEqual([r.drafts.length, r.posted.length, x.calls.length], [0, 0, 0]);
  assert.equal(s.read("announced.json").cats[PUMP_ENTRY.mint], undefined);
});

test("the bots read the collection as the page does: an entry validateCollection refuses is never listed or announced", async () => {
  const at = (iso) => Date.parse(iso);
  const listed = (since) => ({ launchers: [{ address: PUMP_ENTRY.payer, since, label: "Launcher" }] });
  const s = sandbox({ planned: { stocks: PLANNED.stocks, cats: [] }, collection: { cats: [STONK_ENTRY] }, wallets: listed("2020-01-01") });
  assert.deepEqual(provedCollection(path.join(s.dir, "data"), Date.now()).cats.map((e) => e.mint), [STONK_ENTRY.mint]);
  // The same entry when its wallet was listed only after the launch, or with an unknown field: the page does not show it, so the bots never list it.
  const late = sandbox({ planned: { stocks: PLANNED.stocks, cats: [] }, collection: { cats: [STONK_ENTRY] }, wallets: listed("2099-01-01"), config: { dryRun: false, perRun: 1, thread: false } });
  assert.equal(provedCollection(path.join(late.dir, "data"), at("2099-06-01T00:00:00Z")).cats.length, 0);
  const x = fakeX();
  const r = await run({ root: late.dir, env: CREDS, fetchImpl: x, ...quiet });
  assert.deepEqual([r.drafts.length, r.posted.length, x.calls.length], [0, 0, 0], "an unproved coin is never announced");
  const odd = sandbox({ planned: { stocks: PLANNED.stocks, cats: [] }, collection: { cats: [{ ...STONK_ENTRY, extra: 1 }] } });
  assert.equal(provedCollection(path.join(odd.dir, "data"), Date.now()).cats.length, 0);
  assert.equal(provedCollection(path.join(odd.dir, "missing"), Date.now()).cats.length, 0, "no files: no cats");
});

test("no thread file waiting to be posted carries an address (post-thread.mjs holds such a thread)", () => {
  for (const f of fs.readdirSync(path.join(ROOT, "data")).filter((n) => /^(intro-)?thread.*\.json$/.test(n))) {
    const t = JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));
    if (t.ids) continue;
    for (const p of t.posts || []) assert.equal(addressIn(p), null, `${f}: ${p.slice(0, 40)}`);
  }
  assert.match(fs.readFileSync(path.join(ROOT, "scripts", "post-thread.mjs"), "utf8"), /addressIn\(p\)/, "post-thread.mjs checks every post before posting");
});
