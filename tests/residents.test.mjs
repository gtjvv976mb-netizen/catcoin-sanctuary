/* What the page receives from assets/residents.js: the planned cats and the launched tokens,
   merged; buy links only for a launched token; the famous cat coins after them (optional: a missing
   data/famous.json leaves the stock cats as they are); nothing fetched but the data files; cats queued in data/release-queue.json and not released are hidden. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadResidents, mergeResidents } from "../assets/residents.js";
import { validatePlanned, validateCollection, validateWallets, coatProblem, pairByMint } from "../assets/collection.js";
import { proveLaunch } from "../scripts/lib/chain.mjs";
import { launchTx, GME_LAUNCHER, GOOGL_LAUNCHER, GME_LAUNCH, GOOGL_LAUNCH, ANTHROPIC_LAUNCHER, ROOT, DATA_NOW } from "./helpers.mjs";

/* These tests read the shipped data: the real clock (tests/helpers.mjs DATA_NOW), not a frozen one. */
const NOW = DATA_NOW;
const BASE = "https://catcoinsanctuary.com/";
const PLANNED = JSON.parse(fs.readFileSync(path.join(ROOT, "data/planned.json"), "utf8"));
const WALLETS = { launchers: [
  { address: GME_LAUNCHER, since: "2026-09-01", label: "GMEx launcher" },
  { address: GOOGL_LAUNCHER, since: "2026-09-01", label: "GOOGLx launcher" },
  { address: ANTHROPIC_LAUNCHER, since: "2026-09-01", label: "PreStock launcher" },
] };
const GMEX = pairByMint("Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc");
const planned = (ticker) => PLANNED.cats.find((c) => c.ticker === ticker);
const research = (mint) => PLANNED.stocks.find((s) => s.pair.mint === mint);

/** The real GMEx launch as the builder writes it, with its symbol set to a planned cat's ticker. */
const GME = Object.freeze({
  mint: "EcB7LMNFXdSbzY4DQ6Uc9AKXmb9DCKqAeoNmLvNp3HvL", name: "Roaring Kitty", symbol: "SAVEPAWS",
  pair: { symbol: "GMEx", mint: GMEX.mint }, pool: "2un6cyq4X2fMdgevvUSpcueiX1ER2CxRjsPxNMNkHcFz",
  payer: GME_LAUNCHER, tx: GME_LAUNCH, time: "2026-09-24T20:57:15Z",
});
/** The real GOOGLx launch: its ticker is no planned cat's. */
const GOOGL = Object.freeze({
  mint: "FMWVAjJz6vuDqenkkncQAk7AamxjzaRHXJe13M8ZRuQ5", name: "MedPad", symbol: "MEDPAD",
  pair: { symbol: "GOOGLx", mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN" }, pool: "6WaiMQjLXLWpxYTZzFofeMpm71rVtTRx4PD1qwovZBSW",
  payer: GOOGL_LAUNCHER, tx: GOOGL_LAUNCH, time: "2026-09-24T20:57:36Z",
});
/** The real ANTHROPIC PreStock launch (Hollow Finch). */
const HLFINC = Object.freeze({
  mint: "8X4PaVZR3ikUDSgMadgUycw2dtTH4mcUVJY5xkZirWpk", name: "Hollow Finch", symbol: "HLFINC",
  pair: { symbol: "ANTHROPIC", mint: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw" }, pool: "FfRs69ssyUsxdAV9JfAytSkuQSVnAkQJN3krearzf8TZ",
  payer: ANTHROPIC_LAUNCHER, tx: "4Q6JhGwzCVVo1Yt7Pe6KVzJHE1yYDyzvDfwi8VMMjKXTyaAcXr3eX2uaYvkWDBZc2dmK9ADp5d9ZorEAanfr2mPc", time: "2026-09-24T20:29:58Z",
});

function site(files) {
  const asked = [];
  const fetchImpl = async (url, init) => {
    asked.push({ url: String(url), init });
    const rel = new URL(url).pathname.slice(1);
    return rel in files ? new Response(JSON.stringify(files[rel]), { status: 200 }) : new Response("not found", { status: 404 });
  };
  return { fetchImpl, asked };
}
const files = (cats = [], wallets = WALLETS, plannedFile = PLANNED) => ({ "data/planned.json": plannedFile, "data/collection.json": { cats }, "data/wallets.json": wallets });
const load = (f) => quiet(() => loadResidents({ fetchImpl: site(f).fetchImpl, base: BASE, nowMs: NOW }));
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };

test("the launches used here are the real ones (mint, pool, signature, time, pair)", () => {
  for (const [prefix, wallet, e] of [["2VJ6Eqt9", GME_LAUNCHER, GME], ["592bMtm5", GOOGL_LAUNCHER, GOOGL], ["4Q6JhGwz", ANTHROPIC_LAUNCHER, HLFINC]]) {
    const { launch } = proveLaunch(launchTx(prefix), { wallet });
    assert.deepEqual([launch.mint, launch.pool, launch.tx, launch.time, launch.pair], [e.mint, e.pool, e.tx, e.time, e.pair]);
  }
});

test("no token yet: every planned cat, not launched, with no mint, no buy link and no explorer link", async () => {
  const { fetchImpl, asked } = site(files());
  const r = await quiet(() => loadResidents({ fetchImpl, base: BASE, nowMs: NOW }));
  assert.equal(r.length, PLANNED.cats.length);
  assert.deepEqual(r.map((c) => c.id), PLANNED.cats.map((c) => c.ticker));
  for (const c of r) {
    assert.deepEqual(c.token, { status: "planned" });
    assert.deepEqual(c.buy, []);
    assert.equal(c.explorer, null);
    assert.equal(c.planned, true);
    assert.ok(!/gmgn|fomo\.family|solscan|stonkfun\.xyz\/token/.test(JSON.stringify(c)), `${c.id} carries no token link`);
    assert.equal(coatProblem(c.coat), null);
    for (const must of [/not affiliated/i, /StonkFun/, /no intrinsic value/i, /not financial advice/i]) assert.match(c.disclaimer, must, c.id);
    assert.equal(c.portrait, `assets/portraits/${c.id}.jpg`);
    assert.ok(c.stock && c.who && c.pair.mint, c.id);
  }
  assert.deepEqual(asked.map((a) => a.url).sort(), [`${BASE}data/adoptables.json`, `${BASE}data/collection.json`, `${BASE}data/famous.json`, `${BASE}data/lore.json`, `${BASE}data/planned.json`, `${BASE}data/real-photos.json`, `${BASE}data/release-queue.json`, `${BASE}data/wallets.json`]);
  assert.ok(asked.every((a) => a.init.credentials === "same-origin"));
});

test("a launched token takes its planned cat by pair mint and ticker: its token, its buy links, the cat's story and research", async () => {
  const r = await load(files([GME]));
  assert.equal(r.length, PLANNED.cats.length);
  const [first] = r;
  assert.equal(first.id, "SAVEPAWS");
  assert.equal(r.filter((c) => c.id === "SAVEPAWS").length, 1);
  assert.deepEqual(first.token, { status: "launched", mint: GME.mint, launchedAt: GME.time, tx: GME.tx, pool: GME.pool, payer: GME.payer, name: GME.name, symbol: GME.symbol });
  assert.deepEqual(first.buy, [
    { label: "GMGN", url: `https://gmgn.ai/sol/token/${GME.mint}` },
    { label: "FOMO", url: `https://fomo.family/tokens/solana/${GME.mint}` },
  ]);
  assert.deepEqual(first.explorer, { token: `https://solscan.io/token/${GME.mint}`, tx: `https://solscan.io/tx/${GME.tx}`, stonkfun: `https://www.stonkfun.xyz/token/${GME.mint}` });
  assert.equal(first.description, planned("SAVEPAWS").story);
  assert.equal(first.portrait, "assets/portraits/SAVEPAWS.jpg");
  assert.equal(first.stock, "GameStop Corp.");
  assert.equal(first.realCatName, "Roaring Kitty");
  assert.equal(first.plannedName, null);
  assert.deepEqual(first.pair, { symbol: "GMEx", name: GMEX.name, mint: GMEX.mint, category: "xstock", stonkfun: "GMEX" });
  assert.deepEqual(first.links, research(GMEX.mint).links);
  assert.deepEqual(first.virality, research(GMEX.mint).virality);
  assert.ok(r.slice(1).every((c) => c.token.status === "planned" && c.buy.length === 0));
});

test("the match is by pair mint AND ticker: the same ticker on another pair, or another ticker on the pair, is a token of its own", async () => {
  const otherPair = { ...GME, pair: { symbol: "GOOGLx", mint: GOOGL.pair.mint }, pool: GOOGL.pool };
  const r = await load(files([otherPair]));
  assert.equal(r[0].id, GME.mint);
  assert.equal(r[0].planned, false);
  assert.equal(r.find((c) => c.id === "SAVEPAWS").token.status, "planned");
  const r2 = await load(files([GOOGL]));
  assert.equal(r2.find((c) => c.id === "MOMOTHECAT").token.status, "planned");   // the GOOGLx cat: MEDPAD is not its ticker
  const medpad = r2[0];
  assert.equal(medpad.id, GOOGL.mint);
  assert.equal(medpad.planned, false);
  assert.equal(medpad.stock, research(GOOGL.pair.mint).company);
  assert.equal(medpad.who, research(GOOGL.pair.mint).realCat.who);             // the stock's research still says who its cat is
  assert.equal(medpad.description, "");
  assert.equal(medpad.portrait, null);
  assert.equal(medpad.coatFrom, "mint");
  assert.equal(coatProblem(medpad.coat), null);
  assert.equal(medpad.buy.length, 2);
  assert.ok(medpad.buy.every((b) => b.url.endsWith(`/${GOOGL.mint}`)));
});

test("a launched token with no planned cat (a PreStock whose sheet is not written yet) still shows, with its stock's research", async () => {
  const r = await load(files([HLFINC]));
  const c = r[0];
  assert.equal(c.id, HLFINC.mint);
  assert.equal(c.name, "Hollow Finch");
  assert.equal(c.pair.symbol, "ANTHROPIC");
  assert.equal(c.pair.category, "prestock");
  assert.equal(c.stock, research(HLFINC.pair.mint).company);
  assert.match(c.disclaimer, /not financial advice/);
  assert.equal(c.token.status, "launched");
});

test("ticker case aside; a second launch of the same planned cat shows as a token of its own; launched first, newest first", async () => {
  const lower = { ...GME, symbol: "savepaws" };
  const again = { ...GME, mint: "EjY6mhmMr26swbV3qeADwQhVq7zrYSrCUZThLBY29HFF", tx: GOOGL_LAUNCH, time: "2026-09-25T10:00:00Z", pool: GOOGL.pool };
  const r = await load(files([again, lower]));
  assert.equal(r[0].id, again.mint);              // newest first
  assert.equal(r[0].planned, false);
  assert.equal(r[1].id, "SAVEPAWS");              // the first launch took the cat
  assert.equal(r[1].token.mint, GME.mint);
  assert.equal(r[1].ticker, "savepaws");
  assert.equal(r.slice(2).every((c) => c.token.status === "planned"), true);
  const renamed = await load(files([{ ...GME, name: "Save Point" }]));
  assert.equal(renamed[0].name, "Save Point");
  assert.equal(renamed[0].plannedName, "Roaring Kitty");
});

test("buy links appear exactly when a cat is launched, and always name its own mint", async () => {
  const r = await load(files([GME, GOOGL, HLFINC]));
  for (const c of r) {
    if (c.token.status === "launched") {
      assert.equal(c.buy.length, 2, c.id);
      for (const b of c.buy) assert.ok(b.url.endsWith(`/${c.token.mint}`) && b.url.startsWith("https://"), b.url);
    } else {
      assert.deepEqual(c.buy, [], c.id);
      assert.equal(c.token.mint, undefined);
    }
  }
  assert.equal(r.filter((c) => c.token.status === "launched").length, 3);
});

test("entries that fail the checks are left out: hostile names, an unlisted payer, a planned cat that tries to carry a mint or a buy link", async () => {
  const hostile = [
    { ...GME, name: "<img src=x onerror=alert(1)>" },
    { ...GME, symbol: "SAVE‮PAWS" },
    { ...GME, name: "Buy at https://evil.example" },
    { ...GOOGL, payer: "So11111111111111111111111111111111111111112" },
    { ...GOOGL, pair: { symbol: "SOL", mint: "So11111111111111111111111111111111111111112" } },
  ];
  const r = await quiet(() => load(files(hostile)));
  assert.ok(r.every((c) => c.token.status === "planned" && c.buy.length === 0));
  const withMint = structuredClone(PLANNED);
  withMint.cats[0].mint = GME.mint;
  withMint.cats[1].buy = [{ label: "GMGN", url: `https://gmgn.ai/sol/token/${GME.mint}` }];
  withMint.cats[2].name = "<script>alert(1)</script>";
  const r2 = await quiet(() => load(files([], WALLETS, withMint)));
  assert.equal(r2.length, PLANNED.cats.length - 3);
  assert.ok(r2.every((c) => c.buy.length === 0));
  assert.ok(!r2.some((c) => /<script/.test(JSON.stringify(c))));
});

test("a file that cannot be fetched rejects, so the page never shows a launched cat as not launched", async () => {
  for (const missing of ["data/planned.json", "data/collection.json", "data/wallets.json"]) {
    const f = files([GME]);
    delete f[missing];
    await assert.rejects(load(f), /404/, missing);
  }
});

test("mergeResidents works on validated data alone, and changing a card never changes the data", () => {
  const p = validatePlanned(PLANNED, { nowMs: NOW });
  const c = validateCollection({ cats: [GME] }, { wallets: validateWallets(WALLETS), nowMs: NOW });
  const r = mergeResidents({ planned: p, cats: c.cats });
  r[0].coat.base = "odd";
  r[0].links.length = 0;
  r[0].virality.push({ label: "x" });
  const again = mergeResidents({ planned: p, cats: c.cats });
  assert.notEqual(again[0].coat.base, "odd");
  assert.ok(again[0].links.length > 0);
  assert.equal(again[0].virality.length, p.stocks.find((s) => s.stonkfun === "GMEX").virality.length);
});

/* ── The famous cat coins ─────────────────────────────────────────────────────────── */

const FAMOUS = JSON.parse(fs.readFileSync(path.join(ROOT, "data/famous.json"), "utf8"));

test("famous cat coins follow the stock cats, each marked famous, with its own buy link and no stock pair", async () => {
  const r = await load({ ...files(), "data/famous.json": FAMOUS });
  const stock = r.filter((c) => c.kind !== "famous"), famous = r.filter((c) => c.kind === "famous");
  assert.equal(stock.length, PLANNED.cats.length);
  assert.deepEqual(r.slice(0, stock.length), stock, "the stock cats come first");
  assert.equal(famous.length, FAMOUS.coins.length);
  for (const c of famous) {
    assert.deepEqual(c.token, { status: "famous" });
    assert.equal(c.ticker, c.symbol);
    assert.equal(c.planned, false);
    assert.match(c.buy.url, /^https:\/\/(gmgn\.ai\/(sol|eth|base|bsc)\/token\/|dexscreener\.com\/)/, c.id);
    assert.ok(!stock.some((s) => s.id === c.id), `${c.id} is also a stock cat's id`);
  }
});

test("a famous coin file that is missing or broken leaves the stock cats as they are", async () => {
  for (const broken of [undefined, { coins: "no" }, { note: "", refreshedAt: "", coins: [{ id: "BAD ID" }] }]) {
    const f = files();
    if (broken !== undefined) f["data/famous.json"] = broken;
    const r = await load(f);
    assert.equal(r.length, PLANNED.cats.length);
    assert.ok(r.every((c) => c.kind !== "famous"));
  }
});

test("release queue: a queued cat is hidden until it is released; a released one shows", async () => {
  const [a, b] = PLANNED.cats;
  const f = { ...files(), "data/release-queue.json": { cats: [{ key: a.ticker, approved: true }, { key: b.ticker, approved: true, status: "released", releasedAt: "2026-09-26T12:00:00Z" }] } };
  const r = await load(f);
  assert.ok(!r.some((c) => c.id === a.ticker), "queued cat hidden");
  assert.ok(r.some((c) => c.id === b.ticker), "released cat shown");
  assert.equal(r.length, PLANNED.cats.length - 1);
});
