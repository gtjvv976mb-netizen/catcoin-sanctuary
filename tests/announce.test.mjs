/* The X announcer: drafting, the content rules, length, no double posts, the missing-secrets path, and its workflow. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./helpers.mjs";
import { listCats, draft, checkPost, weightedLength, cardLink, pick, run, LIMIT } from "../scripts/announce.mjs";
import { oauthHeader } from "../scripts/lib/x-api.mjs";

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const PLANNED = read("data/planned.json");
const CATS = listCats(PLANNED);
const CREDS = { X_API_KEY: "k", X_API_SECRET: "s", X_ACCESS_TOKEN: "t", X_ACCESS_SECRET: "a" };

function sandbox({ announced = { cats: {} }, config = {}, planned = PLANNED } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "announce-"));
  fs.mkdirSync(path.join(dir, "data"));
  const w = (f, v) => fs.writeFileSync(path.join(dir, "data", f), JSON.stringify(v));
  w("planned.json", planned); w("collection.json", { cats: [] }); w("announced.json", announced); w("announce-config.json", config);
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
  assert.equal(cardLink("PATCHPAW"), "https://catcoinsanctuary.com/#cat=PATCHPAW");
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
    assert.ok(p1.text.includes("Not launched yet, be the first to adopt"), c.key);
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
  assert.equal(Object.keys(seeded.cats).length, PLANNED.cats.length + ADOPTABLE.length);
  for (const c of ADOPTABLE) assert.ok(["held", "backlog", "posted", "queued", "failed"].includes(seeded.cats[c.ticker]?.status), `${c.ticker} has a record`);
  for (const c of PLANNED.cats) assert.ok(["backlog", "posted", "queued", "failed", "held"].includes(seeded.cats[c.ticker]?.status), c.ticker);
  const cfg = read("data/announce-config.json");
  assert.equal(typeof cfg.dryRun, "boolean");
  assert.equal(pick(CATS, seeded, { ...cfg, perRun: 3, announceBacklog: true, backlogPerRun: 2 }).length, 2);
  assert.equal(pick(CATS, seeded, { ...cfg, announceBacklog: false }).length, 0);
  const oneNew = structuredClone(seeded); delete oneNew.cats[CATS[5].key];
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

test("announce workflow: pinned actions, push on planned.json + every 2 h, contents: write only, X secrets only in the posting step", () => {
  const W = fs.readFileSync(path.join(ROOT, ".github/workflows/announce.yml"), "utf8");
  const uses = [...W.matchAll(/uses:\s*(\S+)\s*#\s*(\S+)/g)].map((m) => `${m[1]} ${m[2]}`);
  assert.deepEqual(uses, ["actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 v7.0.1", "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 v7.0.0"]);
  assert.match(W, /push:\n\s+branches: \[main\]\n\s+paths:\n\s+- data\/planned\.json/);
  assert.match(W, /cron: "\*\/20 \* \* \* \*"/);
  assert.match(W, /^permissions: \{\}$/m);
  const perms = [...W.matchAll(/^\s+permissions:\n((?:\s{6}\S.*\n)+)/gm)].map((m) => m[1].trim());
  assert.deepEqual(perms, ["contents: write"]);
  assert.match(W, /persist-credentials: false/);
  const steps = W.split(/\n      - /);
  const withSecrets = steps.filter((s) => /secrets\./.test(s));
  assert.equal(withSecrets.length, 1);
  assert.match(withSecrets[0], /node scripts\/announce\.mjs/);
  assert.deepEqual([...new Set([...W.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]))].sort(), ["X_ACCESS_SECRET", "X_ACCESS_TOKEN", "X_API_KEY", "X_API_SECRET"]);
  assert.match(W, /git add -- data\/announced\.json data\/announce-queue\.json/);
});
