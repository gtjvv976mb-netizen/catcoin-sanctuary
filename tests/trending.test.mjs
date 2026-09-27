/* The Trending tab: its builder (scripts/build-trending.mjs) against fake sources, the file's checks,
   the panel as a visitor sees it, and its workflow. No test reaches the network. */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers.mjs";
import { installDom, Element } from "./minidom.mjs";
import { checkTrending, clean, createTrending, usd, pct } from "../assets/ui/trending.js";
import { shell } from "../assets/ui/panels.js";
import { buildTrending, isCatCoin, crude, catIndex, copycatOf, imageSha256, X_EVERY_MINUTES } from "../scripts/build-trending.mjs";

const NOW = Date.parse("2026-09-27T09:00:00Z");
const MINT = (n) => `${"So1anaMint".padEnd(38, "x")}${String(n).padStart(4, "0")}`.replace(/[0OIl]/g, "9");
const PAIR = (n) => `${"Pa1rAddr".padEnd(38, "y")}${String(n).padStart(4, "0")}`.replace(/[0OIl]/g, "8");
const X_CREDS = { X_API_KEY: "k", X_API_SECRET: "s", X_ACCESS_TOKEN: "t", X_ACCESS_SECRET: "a" };
const CREATOR = "LGfWJwhiBVYhgK2opEaLvXtWydBnMdEdtvLC6FfpYTw";
const STORY = "The Catbus (Nekobasu) is the twelve-legged grinning bus-cat of Hayao Miyazaki's My Neighbor Totoro (1988).";
const PROOF = "https://x.com/Rainmaker1973/status/1833451037694308415";
const TOKEN = Buffer.from("the Catbus kit's token picture");
const TOKEN_SHA = crypto.createHash("sha256").update(TOKEN).digest("hex");

const data = () => ({
  famous: { coins: [
    { id: "a", name: "Alpha Cat", symbol: "ACAT", chain: "solana", contract: MINT(1), tier: "main", pair: { address: PAIR(1) } },
    { id: "b", name: "Beta Cat", symbol: "BCAT", chain: "solana", contract: MINT(2), tier: "main", pair: { address: PAIR(2) } },
    { id: "c", name: "Side Cat", symbol: "SIDE", chain: "solana", contract: MINT(3), tier: "extra", pair: { address: PAIR(3) } },
  ] },
  collection: { cats: [] },
  planned: { cats: [{ ticker: "WARMSPOT", name: "Warm Spot", description: "Warm Spot naps in the one patch of sun that reaches the porch every afternoon. A cat coin priced in SPYx." }] },
  adoptables: { cats: [{ ticker: "NEKOBUS", name: "Catbus", coinName: "Nekobasu", launchTicker: "CATBUS", story: STORY, proof: { kind: "x", url: PROOF }, existingCoin: { symbol: "Catbus", contract: MINT(98), mcapUsd: 1932 } }] },
  kits: { cats: { NEKOBUS: { tokenSha256: TOKEN_SHA } } },
  wallets: { launchers: [{ address: MINT(97) }] },
  adoptions: { note: "Adoptions.", adoptions: [] },
  announced: { cats: {
    NEKOBUS: { status: "posted", at: "2026-09-26T20:00:00Z", ids: ["1001", "1002"] },
    WARMSPOT: { status: "posted", at: "2026-09-27T08:00:00Z", ids: ["1003"] },
    OLD: { status: "posted", at: "2026-09-01T08:00:00Z", ids: ["1004"] },
  } },
  trending: {},
});

const launches = [
  { mint: MINT(10), name: "Fomo Cat", symbol: "FOMOCAT", created_timestamp: NOW - 60_000, usd_market_cap: 5000 },
  { mint: MINT(11), name: "Fomo Cat", symbol: "FOMOCAT", created_timestamp: NOW - 120_000, usd_market_cap: 9000 },
  { mint: MINT(12), name: "Fuck Cat", symbol: "FCAT", created_timestamp: NOW - 180_000, usd_market_cap: 1 },
  { mint: MINT(13), name: "Plants vs Zombies", symbol: "PVZ", created_timestamp: NOW - 200_000, usd_market_cap: 1 },
  // Catbus's kit launched twice: the first is its adoption, the later relaunch (same words) a copycat.
  { mint: MINT(14), name: "Nekobasu", symbol: "catbus", description: STORY, image_uri: "https://ipfs.io/ipfs/kit", created_timestamp: NOW - 240_000, usd_market_cap: 3000, creator: CREATOR },
  { mint: MINT(15), name: "Nekobasu", symbol: "CATBUS", description: STORY, twitter: PROOF, image_uri: "https://ipfs.io/ipfs/kit", created_timestamp: NOW - 250_000, usd_market_cap: 2000, creator: CREATOR },
  // A planned cat's kit, its card as the website: an adoption though its name says nothing of cats.
  { mint: MINT(16), name: "Warm Spot", symbol: "WARMSPOT", website: "https://catcoinsanctuary.com/#cat=WARMSPOT", created_timestamp: NOW - 260_000, creator: CREATOR },
  // The owner's own launch of the same kit is never an adoption.
  { mint: MINT(17), name: "Warm Spot", symbol: "WARMSPOT", website: "https://catcoinsanctuary.com/#cat=WARMSPOT", created_timestamp: NOW - 270_000, creator: MINT(97) },
];

/** Fake DexScreener, pump.fun, IPFS and X. `x` is the X answer: a function (url) -> Response; `launched`: pump.fun's newest page. */
function fakeFetch({ x, pump = true, launched = launches } = {}) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    if (url.startsWith("https://ipfs.io/ipfs/")) return url.endsWith("/kit") ? new Response(TOKEN) : new Response("gone", { status: 504 });
    if (url.startsWith("https://api.dexscreener.com/tokens/v1/solana/")) {
      const mints = decodeURIComponent(url.split("/").pop()).split(",");
      const pairs = mints.map((m, i) => ({ baseToken: { address: m, name: "x", symbol: "X" }, pairAddress: m === MINT(1) ? PAIR(1) : m === MINT(2) ? PAIR(2) : PAIR(50 + i),
        marketCap: m === MINT(1) ? 2e6 : 1234, volume: { h24: m === MINT(1) ? 10 : m === MINT(2) ? 500 : 5 }, priceChange: { h24: m === MINT(2) ? -12.345 : 3 },
        liquidity: { usd: 100 }, pairCreatedAt: NOW - 3_600_000 }));
      return new Response(JSON.stringify(pairs));
    }
    if (url.startsWith("https://frontend-api-v3.pump.fun/coins")) {
      if (!pump) return new Response("down", { status: 503 });
      const offset = Number(new URL(url).searchParams.get("offset"));
      return new Response(JSON.stringify(offset === 0 ? launched : [{ mint: MINT(20), name: "Old Cat", symbol: "OLD", created_timestamp: NOW - 3_600_000 }]));
    }
    if (url.startsWith("https://api.x.com/2/tweets")) return x(url);
    throw new Error(`unexpected ${url}`);
  };
  return { fn, calls };
}

test("cat coins by name or ticker; crude names are left out; copycats by ticker, launch ticker or coin name", () => {
  for (const [n, s] of [["Fomo Cat", "FOMOCAT"], ["x", "GRENCAT"], ["neko", "neko"], ["🐈 thing", "T"]]) assert.ok(isCatCoin(n, s), n);
  for (const [n, s] of [["Plants vs Zombies", "PVZ"], ["Education", "EDU"], ["Catch me", "CTCH"]]) assert.ok(!isCatCoin(n, s), n);
  assert.ok(crude("Fuck Cat", "FCAT") && crude("SexyCat", "SC") && !crude("Fomo Cat", "FOMOCAT"));
  const idx = catIndex(data());
  assert.equal(copycatOf({ mint: "m", symbol: "catbus", name: "x" }, idx), "NEKOBUS");
  assert.equal(copycatOf({ mint: "m", symbol: "NEKOBUS", name: "x" }, idx), "NEKOBUS");
  assert.equal(copycatOf({ mint: "m", symbol: "Z", name: "Neko-basu" }, idx), "NEKOBUS");
  assert.equal(copycatOf({ mint: "m", symbol: "WARMSPOT", name: "x" }, idx), "WARMSPOT");
  assert.equal(copycatOf({ mint: "m", symbol: "Z", name: "Catbus" }, idx), null, "a cat's plain name is too common to call a copy");
  const ours = catIndex({ ...data(), collection: { cats: [{ mint: "ours", symbol: "CATBUS" }] } });
  assert.equal(copycatOf({ mint: "ours", symbol: "CATBUS", name: "Nekobasu" }, ours), null, "the cat's own launch is not a copy");
});

test("build: movers by volume from the Hall of Fame; new cat coins grouped, crude and non-cat ones out, adoptions then copycats first; X without keys", async () => {
  const { fn } = fakeFetch();
  const { trending: t, adoptions } = await buildTrending({ data: data(), fetchImpl: fn, nowMs: NOW, pause: 0 });
  assert.deepEqual(t.activity.items.map((r) => r.id), ["b", "a"], "tier main only, by 24 h volume");
  assert.equal(t.activity.items[0].change24hPct, -12.3);
  assert.equal(t.activity.items[1].pair, PAIR(1), "the coin's own pair when DexScreener lists it");
  // Every launch was tested against the kits: Catbus's first launch of its kit and Warm Spot's are adoptions.
  assert.deepEqual(adoptions.adoptions.map((a) => [a.key, a.mint, a.evidence.join(" ")]).sort(),
    [["NEKOBUS", MINT(15), "name ticker description proof-link"], ["WARMSPOT", MINT(16), "name ticker card-link"]], "its picture is not read when its words already match the kit");
  assert.deepEqual(adoptions.adoptions.find((a) => a.key === "NEKOBUS"), { key: "NEKOBUS", mint: MINT(15), name: "Nekobasu", symbol: "CATBUS", launchpad: "pump.fun", creator: CREATOR,
    createdAt: "2026-09-27T08:55:50Z", foundAt: "2026-09-27T09:00:00Z", evidence: ["name", "ticker", "description", "proof-link"] });
  assert.equal(adoptions.note, "Adoptions.", "the file's own note is kept");
  const fresh = t.fresh.items;
  // Adoptions first, each its own row; then copycats: the relaunch of Catbus's kit and the owner's launch not yet in the collection.
  assert.deepEqual(fresh.slice(0, 4).map((r) => [r.mint, r.adoptedOf ?? null, r.copycatOf ?? null, r.count]),
    [[MINT(15), "NEKOBUS", null, 1], [MINT(16), "WARMSPOT", null, 1], [MINT(14), null, "NEKOBUS", 1], [MINT(17), null, "WARMSPOT", 1]]);
  assert.ok(!("copycatOf" in fresh[0]), "an adoption is not also a copycat");
  assert.deepEqual(t.fresh.all.filter((r) => r.adoptedOf).map((r) => r.mint).sort(), [MINT(15), MINT(16)].sort());
  const fomo = fresh.find((r) => r.symbol === "FOMOCAT");
  assert.equal(fomo.count, 2, "spam relaunches are one row");
  assert.ok(!fresh.some((r) => ["FCAT", "PVZ", "OLD"].includes(r.symbol)), "crude, not a cat, and older than the last run");
  assert.deepEqual(t.x, { updatedAt: null, status: "no-keys", items: [] });
  const c = checkTrending(t);
  for (const k of ["activity", "fresh", "x"]) assert.equal(c[k].items.length, t[k].items.length, `${k}: every row passes the page's check`);
  assert.equal(c.fresh.items[0].adoptedOf, "NEKOBUS");
});

test("build: a recorded adoption stays its cat's; the kit's later launches are copycats; it is listed for a week", async () => {
  const recorded = { key: "NEKOBUS", mint: MINT(99), name: "Nekobasu", symbol: "CATBUS", launchpad: "pump.fun", creator: CREATOR,
    createdAt: "2026-09-25T10:00:00Z", foundAt: "2026-09-25T10:20:00Z", evidence: ["name", "ticker", "card-link"] };
  const d = { ...data(), adoptions: { note: "Adoptions.", adoptions: [recorded] } };
  const { fn, calls } = fakeFetch();
  const { trending: t, adoptions } = await buildTrending({ data: d, fetchImpl: fn, nowMs: NOW, pause: 0 });
  assert.deepEqual(adoptions.adoptions.map((a) => a.mint).sort(), [MINT(16), MINT(99)].sort(), "the earlier launch keeps Catbus");
  assert.deepEqual(adoptions.adoptions.find((a) => a.key === "NEKOBUS"), recorded, "its record as it was");
  const row = (m) => t.fresh.items.find((r) => r.mint === m);
  assert.equal(row(MINT(99)).adoptedOf, "NEKOBUS", "listed from the record, though no run saw it launch");
  assert.equal(row(MINT(99)).marketCapUsd, 1234, "its market cap read from DexScreener");
  assert.equal(t.fresh.items[0].mint, MINT(16), "adoptions first, the newest first");
  const later = t.fresh.items.find((r) => r.copycatOf === "NEKOBUS");
  assert.equal(later.count, 2, "both later launches of the kit are copycats, one row");
  assert.ok(!calls.some((u) => u.startsWith("https://ipfs.io/")), "no picture read for a cat already adopted");
  // A week on, the adoption leaves the list but not the record.
  const old = await buildTrending({ data: { ...d, trending: t, adoptions }, fetchImpl: fakeFetch({ launched: [] }).fn, nowMs: Date.parse("2026-10-02T11:00:00Z"), pause: 0 });
  assert.ok(!old.trending.fresh.items.some((r) => r.mint === MINT(99)));
  assert.deepEqual(old.adoptions.adoptions.map((a) => a.mint).sort(), [MINT(16), MINT(99)].sort());
});

test("build: the token picture counts when it is the kit's, and a picture that will not load costs nothing", async () => {
  const pic = (n, image_uri) => ({ mint: MINT(n), name: "Nekobasu", symbol: "CATBUS", image_uri, created_timestamp: NOW - 60_000 - n, creator: CREATOR });
  let { fn } = fakeFetch({ launched: [pic(30, "https://ipfs.io/ipfs/down"), pic(31, "http://ipfs.io/ipfs/kit")] });
  let r = await buildTrending({ data: data(), fetchImpl: fn, nowMs: NOW, pause: 0 });
  assert.deepEqual(r.adoptions.adoptions, [], "no picture, or not over https: name and ticker alone are copycats");
  assert.deepEqual(r.trending.fresh.items.filter((x) => x.copycatOf === "NEKOBUS").map((x) => x.count), [2]);
  ({ fn } = fakeFetch({ launched: [pic(32, "https://ipfs.io/ipfs/kit")] }));
  r = await buildTrending({ data: data(), fetchImpl: fn, nowMs: NOW, pause: 0 });
  assert.deepEqual(r.adoptions.adoptions.map((a) => [a.mint, a.evidence.join(" ")]), [[MINT(32), "name ticker image"]]);
  assert.equal(await imageSha256(async () => new Response(TOKEN, { headers: { "content-length": String(50 * 1024 * 1024) } }), "https://ipfs.io/ipfs/big"), null, "too big");
  assert.equal(await imageSha256(async () => { throw new Error("timeout"); }, "https://ipfs.io/ipfs/slow"), null);
});

test("build: X figures ranked by engagement, only the last 14 days, at most every 3 hours; a refusal keeps the last figures", async () => {
  let asked = 0;
  const ok = (url) => {
    asked++;
    assert.match(url, /ids=1003,1001&tweet\.fields=public_metrics$/, "newest first, the first post of each cat, nothing older than 14 days");
    return new Response(JSON.stringify({ data: [{ id: "1001", public_metrics: { like_count: 50, retweet_count: 10 } }, { id: "1003", public_metrics: { like_count: 5 } }] }));
  };
  let { fn } = fakeFetch({ x: ok });
  const { trending: t } = await buildTrending({ data: data(), env: X_CREDS, fetchImpl: fn, nowMs: NOW, pause: 0 });
  assert.equal(t.x.status, "ok");
  assert.deepEqual(t.x.items.map((r) => [r.key, r.name, r.likes]), [["NEKOBUS", "Catbus", 50], ["WARMSPOT", "Warm Spot", 5]]);
  // Not due yet: X is not asked, the list stays.
  const d2 = { ...data(), trending: t };
  ({ fn } = fakeFetch({ x: ok }));
  const { trending: t2 } = await buildTrending({ data: d2, env: X_CREDS, fetchImpl: fn, nowMs: NOW + 60_000, pause: 0 });
  assert.equal(asked, 1);
  assert.deepEqual(t2.x, t.x);
  // Due, and X says no: the last figures stay, the status says why.
  ({ fn } = fakeFetch({ x: () => new Response("{}", { status: 429 }) }));
  const { trending: t3 } = await buildTrending({ data: d2, env: X_CREDS, fetchImpl: fn, nowMs: NOW + X_EVERY_MINUTES * 60_000 + 1, pause: 0 });
  assert.equal(t3.x.status, "limited");
  assert.deepEqual(t3.x.items, t.x.items);
});

test("build: a source that does not answer leaves its list as it was", async () => {
  const { trending: first, adoptions } = await buildTrending({ data: data(), fetchImpl: fakeFetch().fn, nowMs: NOW, pause: 0 });
  const { fn } = fakeFetch({ pump: false });
  const { trending: t, adoptions: a2 } = await buildTrending({ data: { ...data(), trending: first, adoptions }, fetchImpl: fn, nowMs: NOW + 20 * 60_000, pause: 0 });
  assert.equal(t.fresh.updatedAt, first.fresh.updatedAt, "pump.fun down: the list is last run's");
  const groups = (items) => items.map((r) => `${r.symbol.toUpperCase()}×${r.count}${r.adoptedOf ? " adopted" : ""}`).sort();
  assert.deepEqual(groups(t.fresh.items), groups(first.fresh.items), "the same coins (a group's biggest may change as caps are read again)");
  assert.deepEqual(a2, adoptions, "the adoptions as they were");
});

test("the page's check: bad rows dropped, strangers' text cleaned, never a link it did not build", () => {
  const c = checkTrending({
    updatedAt: "2026-09-27T09:00:00Z",
    activity: { items: [{ id: "a", name: "A", chain: "solana", mint: MINT(1), pair: PAIR(1) }, { name: "B", chain: "java script:", mint: MINT(2), pair: PAIR(2) }, { name: "C", chain: "solana", mint: "bad", pair: PAIR(3) }] },
    fresh: { items: [{ mint: MINT(4), name: "Evil‮\u0000 <b>cat</b>", symbol: "X".repeat(40), createdAt: "2026-09-27T08:00:00Z", copycatOf: "../x" }, { mint: MINT(5), createdAt: "yesterday" }] },
    x: { status: "ok", items: [{ key: "NEKOBUS", tweet: "123456", likes: -3 }, { key: "NEKOBUS", tweet: "javascript:1" }] },
  });
  assert.equal(c.activity.items.length, 1);
  assert.equal(c.fresh.items.length, 1);
  assert.equal(c.fresh.items[0].name, "Evil <b>cat</b>", "control and direction characters out; the page sets it as text");
  assert.equal(c.fresh.items[0].symbol.length, 16);
  assert.equal(c.fresh.items[0].copycatOf, null);
  assert.deepEqual(c.x.items.map((r) => r.likes), [0]);
  assert.equal(checkTrending(null), null);
  assert.equal(clean(" a \n b ", 10), "a b");
  assert.equal(usd(2_500_000), "$2.5M"); assert.equal(usd(4003), "$4k"); assert.equal(pct(-12.34), "-12%"); assert.equal(pct(3.21), "+3.2%");
});

test("the shipped data/trending.json passes the page's check whole", () => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, "data/trending.json"), "utf8"));
  const c = checkTrending(j);
  for (const k of ["activity", "fresh", "x"]) assert.equal(c[k].items.length, (j[k]?.items || []).length, k);
});

function dialog() {
  const d = new Element("dialog");
  d.open = false;
  d.showModal = () => { d.open = true; };
  d.close = () => { d.open = false; };
  return d;
}

test("the Trending panel: three tabs, rows with links it built, adoptions and copycat warnings that open the cat", async () => {
  const remove = installDom();
  try {
    const { trending: t } = await buildTrending({ data: data(), fetchImpl: fakeFetch().fn, nowMs: NOW, pause: 0 });
    const d = dialog();
    const opened = [];
    const names = { NEKOBUS: "Catbus", WARMSPOT: "Warm Spot" };
    const panel = createTrending({ dialog: d, shell, catOf: (id) => (names[id] ? { name: names[id] } : null), onOpenCat: (id) => opened.push(id), now: () => NOW });
    panel.setData(t);
    panel.open();
    assert.ok(d.open);
    const tabs = d.querySelectorAll(".trend-tab");
    assert.deepEqual(tabs.map((b) => b.textContent), ["Top movers", "New on pump.fun", "Hot on X"]);
    assert.equal(d.querySelectorAll(".trend-row").length, 2);
    assert.deepEqual(d.querySelectorAll("a").map((a) => a.href), [`https://dexscreener.com/solana/${PAIR(2)}`, `https://dexscreener.com/solana/${PAIR(1)}`]);
    for (const a of d.querySelectorAll("a")) { assert.match(a.href, /^https:\/\/dexscreener\.com\/solana\/[1-9A-HJ-NP-Za-km-z]+$/); assert.equal(a.rel, "noopener noreferrer"); }
    tabs[1].click();
    const rows = d.querySelectorAll(".trend-row");
    assert.equal(rows.length, t.fresh.items.length);
    assert.match(rows[0].textContent, /Adopted/);
    assert.doesNotMatch(rows[0].textContent, /Copycat/);
    assert.equal(d.querySelectorAll(".trend-adopted").length, 2);
    assert.equal(d.querySelectorAll(".trend-copy").length, 2);
    assert.deepEqual(d.querySelectorAll(".trend-cat").map((b) => b.textContent), ["See Catbus", "See Warm Spot", "Not the real Catbus", "Not the real Warm Spot"]);
    for (const a of d.querySelectorAll("a")) assert.match(a.href, /^https:\/\/pump\.fun\/coin\/[1-9A-HJ-NP-Za-km-z]+$/);
    assert.match(d.textContent, /by strangers\. Not affiliated/);
    assert.match(d.textContent, /“Adopted”: launched by a visitor from the cat's own kit on this site\./);
    assert.match(d.textContent, /“Copycat”: uses a sanctuary cat's name or ticker without being its adoption\./);
    d.querySelectorAll(".trend-cat")[0].click();
    assert.deepEqual(opened, ["NEKOBUS"]);
    assert.equal(d.open, false, "opening the cat closes the panel");
    panel.open();
    d.querySelectorAll(".trend-cat")[3].click();
    assert.deepEqual(opened, ["NEKOBUS", "WARMSPOT"], "the copycat's warning opens the real cat");
    panel.open();
    d.querySelectorAll(".trend-tab")[2].click();
    assert.match(d.textContent, /X figures are not available right now/);
  } finally { remove(); }
});

test("trending workflow: pinned actions, every 20 min and by hand, contents: write for the build, X secrets only there, the next-run job runs no repository code", () => {
  const W = fs.readFileSync(path.join(ROOT, ".github/workflows/trending.yml"), "utf8");
  const uses = [...W.matchAll(/uses:\s*(\S+)\s*#\s*(\S+)/g)].map((m) => `${m[1]} ${m[2]}`);
  assert.deepEqual(uses, ["actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 v7.0.1", "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 v7.0.0"]);
  assert.match(W, /cron: "\*\/20 \* \* \* \*"/);
  assert.match(W, /workflow_dispatch:/);
  assert.match(W, /^permissions: \{\}$/m);
  assert.deepEqual([...W.matchAll(/^\s+permissions:\n((?:\s{6}\S.*\n)+)/gm)].map((m) => m[1].trim()), ["contents: write", "actions: write"]);
  assert.match(W, /persist-credentials: false/);
  const steps = W.split(/\n      - /);
  const withSecrets = steps.filter((s) => /secrets\./.test(s));
  assert.equal(withSecrets.length, 1);
  assert.match(withSecrets[0], /node scripts\/build-trending\.mjs/);
  assert.match(W, /git add -- data\/trending\.json data\/adoptions\.json\n/);
  const next = W.slice(W.indexOf("\n  next:"));
  assert.match(next, /vars\.TRENDING_CHAIN != 'off'/);
  assert.match(next, /gh workflow run trending\.yml/);
  assert.ok(!/uses:|\bnode\b|\bnpm\b|secrets\./.test(next));
});
