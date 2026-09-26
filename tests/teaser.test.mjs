/* "Who's that cat?": data/next-cat.json never names its cat, follows the announce order, and moves
   on after each post or release; the page's tab, card and easel are wired without inline code. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./helpers.mjs";
import { listCats, run, pick, DEFAULT_CONFIG } from "../scripts/announce.mjs";
import { teaserId, silhouettePath, upcoming, hintProblems, giveaways, nextCatFile, CATEGORIES } from "../scripts/lib/next-cat.mjs";
import { readNext, countdown, CHIPS } from "../assets/ui/teaser.js";

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const PLANNED = read("data/planned.json"), ADOPT = read("data/adoptables.json");
const CATS = listCats(PLANNED, read("data/collection.json"), ADOPT);
const OWNER = new Map(ADOPT.cats.map((a) => [a.ticker, a.owner]));
const HINTS = read("scripts/teaser-hints.json").cats;
const CREDS = { X_API_KEY: "k", X_API_SECRET: "s", X_ACCESS_TOKEN: "t", X_ACCESS_SECRET: "a" };
const quiet = { log: () => {}, sleep: async () => {} };
const fakeX = () => { let n = 100; return async (url) => new Response(JSON.stringify({ data: { id: String(url.includes("media") ? "m1" : n++) } }), { status: url.includes("media") ? 200 : 201 }); };
const byId = new Map(CATS.map((c) => [teaserId(c.key), c]));

test("no name leak: the shipped next-cat.json and every silhouette's name say nothing of the cat", () => {
  const next = read("data/next-cat.json");
  assert.deepEqual(Object.keys(next).sort(), ["category", "expectedAt", "hint", "id", "silhouette"]);
  assert.match(next.id, /^[0-9a-f]{16}$/);
  const cat = byId.get(next.id);
  assert.ok(cat, "the id is one of the sanctuary's cats");
  assert.equal(next.silhouette, silhouettePath(cat.key));
  assert.ok(CATEGORIES.includes(next.category));
  const text = JSON.stringify(next).toLowerCase();
  for (const w of giveaways({ ...cat, owner: OWNER.get(cat.key) })) assert.ok(!new RegExp(`(^|[^a-z0-9])${w}`).test(text), `next-cat.json says "${w}"`);
  for (const f of fs.readdirSync(path.join(ROOT, "assets/teaser"))) {
    assert.match(f, /^[0-9a-f]{16}\.png$/);
    assert.ok(byId.has(f.slice(0, 16)), `${f} is a cat's hash`);
    assert.ok(fs.statSync(path.join(ROOT, "assets/teaser", f)).size < 40_000, `${f} is small`);
  }
});

test("every hint passes the content rules and names no cat, owner, company or ticker; a leaky one is never used", () => {
  for (const [k, h] of Object.entries(HINTS)) {
    const cat = CATS.find((c) => c.key === k);
    assert.ok(cat, k);
    assert.deepEqual(hintProblems(h, { ...cat, owner: OWNER.get(k) }), [], k);
  }
  const cat = CATS.find((c) => c.key === "MARUBOX");
  assert.ok(hintProblems("📦 Maru loves boxes", cat).length);
  assert.ok(hintProblems("📦 loves $MARUBOX", cat).length);
  const f = nextCatFile({ cats: [cat], state: { cats: {} }, queue: { cats: [] }, config: DEFAULT_CONFIG, hints: { MARUBOX: "Maru!" } });
  assert.doesNotMatch(f.hint, /maru/i);
});

test("every upcoming cat has a silhouette and a hint", () => {
  const order = upcoming(CATS, read("data/announced.json"), read("data/release-queue.json"), { ...DEFAULT_CONFIG, ...read("data/announce-config.json") });
  for (const c of order) {
    assert.ok(fs.existsSync(path.join(ROOT, silhouettePath(c.key))), `${c.key}: run node scripts/build-teasers.mjs`);
    assert.ok(HINTS[c.key], `${c.key}: add a hint to scripts/teaser-hints.json`);
  }
});

function sandbox(state, queue = { cats: [] }, config = { dryRun: false, perRun: 1, thread: false, announceBacklog: true, backlogPerRun: 1 }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "teaser-"));
  fs.mkdirSync(path.join(dir, "data"));
  const cats = PLANNED.cats.slice(0, 6);
  const w = (f, v) => fs.writeFileSync(path.join(dir, "data", f), JSON.stringify(v));
  w("planned.json", { ...PLANNED, cats }); w("collection.json", { cats: [] }); w("announced.json", state(cats)); w("announce-config.json", config); w("release-queue.json", queue);
  return { dir, cats, next: () => JSON.parse(fs.readFileSync(path.join(dir, "data/next-cat.json"), "utf8")) };
}

test("the next cat is always the one the announcer posts next, and the file moves on after each post", async () => {
  const s = sandbox((cats) => ({ cats: Object.fromEntries(cats.map((c) => [c.ticker, { status: "backlog" }])) }));
  let t = Date.parse("2026-10-01T10:05:00Z");
  const now = () => new Date(t);
  let expected = null;
  for (let i = 0; i < 4; i++) {
    const r = await run({ root: s.dir, env: CREDS, fetchImpl: fakeX(), now, ...quiet });
    assert.equal(r.posted.length, 1);
    if (expected) assert.equal(teaserId(r.posted[0].key), expected, `run ${i}: posted the teased cat`);
    const n = s.next();
    assert.notEqual(n.id, teaserId(r.posted[0].key));
    assert.equal(n.id, teaserId(s.cats[i + 1].ticker));
    assert.ok(Date.parse(n.expectedAt) > t && Date.parse(n.expectedAt) - t <= 21 * 60_000);
    expected = n.id;
    t += 20 * 60_000;
  }
});

test("the order matches pick(): new cats, then retries, then the backlog, then the release queue", () => {
  const cats = CATS.slice(0, 8);
  const state = { cats: { [cats[0].key]: { status: "backlog" }, [cats[1].key]: { status: "posted" }, [cats[2].key]: { status: "failed", attempts: 1 }, [cats[4].key]: { status: "backlog" }, [cats[5].key]: { status: "held" } } };
  const queue = { cats: [{ key: cats[6].key, approved: true }, { key: cats[7].key, approved: false }] };
  const order = upcoming(cats, state, queue, DEFAULT_CONFIG).map((c) => c.key);
  assert.deepEqual(order, [cats[3].key, cats[2].key, cats[0].key, cats[4].key, cats[6].key]);
  assert.equal(order[0], pick(cats, state, { ...DEFAULT_CONFIG, perRun: 1 }, new Set([cats[6].key, cats[7].key]))[0].key);
});

test("after a release the teaser moves on to the following cat in the queue", async () => {
  const cats = PLANNED.cats.filter((c) => c.proof?.url).slice(0, 4);
  const [a, b, c] = cats.slice(1).map((x) => x.ticker);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "teaser-rel-"));
  for (const d of ["data", "assets/portraits", "assets/kits", "assets/ingame"]) fs.mkdirSync(path.join(dir, d), { recursive: true });
  const w = (f, v) => fs.writeFileSync(path.join(dir, "data", f), JSON.stringify(v));
  w("planned.json", { ...PLANNED, cats }); w("collection.json", { cats: [] }); w("announce-config.json", { dryRun: false, perRun: 1, thread: false });
  w("announced.json", { cats: { [cats[0].ticker]: { status: "posted" } } });
  w("release-queue.json", { lastReleaseAt: null, cats: [a, b, c].map((key) => ({ key, approved: true })) });
  for (const x of cats) { fs.writeFileSync(path.join(dir, x.portrait), "x"); fs.writeFileSync(path.join(dir, `assets/ingame/${x.ticker}.jpg`), "x"); }
  fs.writeFileSync(path.join(dir, "assets/kits/kits.json"), JSON.stringify({ cats: Object.fromEntries(cats.map((x) => [x.ticker, { token: "t.png" }])) }));
  const next = () => JSON.parse(fs.readFileSync(path.join(dir, "data/next-cat.json"), "utf8"));
  let t = Date.parse("2026-10-01T10:00:00Z");
  const r = await run({ root: dir, env: CREDS, fetchImpl: fakeX(), now: () => new Date(t), ...quiet });
  assert.equal(r.released, a);
  assert.equal(next().id, teaserId(b));
  assert.equal(next().expectedAt, "2026-10-01T11:00:00.000Z");
  t += 60 * 60_000;
  const r2 = await run({ root: dir, env: CREDS, fetchImpl: fakeX(), now: () => new Date(t), ...quiet });
  assert.equal(r2.released, b);
  assert.equal(next().id, teaserId(c));
});

test("the page: a tab, a dialog, the easel; the file is checked before use; no inline styles or scripts", () => {
  assert.equal(readNext({ id: "Maru", silhouette: "x.png" }), null);
  assert.equal(readNext({ id: "0123456789abcdef", silhouette: "https://evil/x.png", category: "?" }).silhouette, null);
  assert.equal(countdown(-1), "any minute now 👀");
  assert.equal(countdown(65_000), "1m 05s");
  assert.equal(countdown(3_900_000), "1h 05m");
  assert.deepEqual(Object.keys(CHIPS).sort(), [...CATEGORIES].sort());
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /<button class="nextcat-tab" id="nextcat-tab" type="button" aria-haspopup="dialog" hidden>/);
  assert.match(html, /<dialog class="whos" id="whos" aria-labelledby="whos-title"><\/dialog>/);
  assert.doesNotMatch(html, /\sstyle=/);
  const js = fs.readFileSync(path.join(ROOT, "assets/ui/teaser.js"), "utf8");
  assert.doesNotMatch(js, /innerHTML|\.style\b/);
  assert.match(js, /https:\/\/x\.com\/catcosanctuary/);
  assert.match(fs.readFileSync(path.join(ROOT, "assets/world/world.js"), "utf8"), /easel\.hit\(ray\)/);
  assert.match(fs.readFileSync(path.join(ROOT, ".github/workflows/announce.yml"), "utf8"), /git add -- .*data\/next-cat\.json/);
});
