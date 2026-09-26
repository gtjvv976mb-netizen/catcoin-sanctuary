/* The collection rules the page and the builder share (assets/collection.js). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  STOCK_PAIRS, XSTOCKS, MAX_CATS, COAT_COLOURS, COAT_PATTERNS, validateCollection, validateWallets, links, buyLinks, BUY_SITES, coatFromMint, coatProblem,
  textProblem, proseProblem, httpsProblem, sourceDateProblem, isAddress, isSignature, base58Decode, parseTime, pairByMint,
} from "../assets/collection.js";
import { readTokenMetadata } from "../scripts/lib/chain.mjs";
import { OFFICIAL, STONKFUN_PAIRS, PAIR_MINTS, BUY_EVIDENCE, GME_LAUNCHER, GOOGL_LAUNCHER, GME_LAUNCH, GOOGL_LAUNCH, ROOT, OWNER } from "./helpers.mjs";

const NOW = Date.parse("2026-09-25T18:00:00Z");
const WALLETS = { launchers: [
  { address: GME_LAUNCHER, since: "2026-09-01", label: "GMEx launcher" },
  { address: GOOGL_LAUNCHER, since: "2026-09-24T00:00:00Z", until: "2026-10-01", label: "GOOGLx launcher" },
] };
/** The two real launches as the builder writes them. */
const GME = Object.freeze({
  mint: "EcB7LMNFXdSbzY4DQ6Uc9AKXmb9DCKqAeoNmLvNp3HvL", name: "1 GME can change your life", symbol: "1GME",
  pair: { symbol: "GMEx", mint: "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc" }, pool: "2un6cyq4X2fMdgevvUSpcueiX1ER2CxRjsPxNMNkHcFz",
  payer: GME_LAUNCHER, tx: GME_LAUNCH, time: "2026-09-24T20:57:15Z",
});
const GOOGL = Object.freeze({
  mint: "FMWVAjJz6vuDqenkkncQAk7AamxjzaRHXJe13M8ZRuQ5", name: "MedPad", symbol: "MEDPAD",
  pair: { symbol: "GOOGLx", mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN" }, pool: "6WaiMQjLXLWpxYTZzFofeMpm71rVtTRx4PD1qwovZBSW",
  payer: GOOGL_LAUNCHER, tx: GOOGL_LAUNCH, time: "2026-09-24T20:57:36Z",
});
const check = (cats, opts = {}) => validateCollection({ cats }, { wallets: WALLETS, nowMs: NOW, ...opts });
const refusal = (entry) => { const r = check([entry]); assert.equal(r.cats.length, 0, JSON.stringify(entry)); return r.refused[0].clause; };

test("the 24 xStocks match the official product list, row by row, by mint and symbol", () => {
  assert.equal(XSTOCKS.length, 24);
  assert.equal(OFFICIAL.products.length, 24);
  for (const p of OFFICIAL.products) {
    const x = XSTOCKS.find((s) => s.symbol === p.symbol);
    assert.ok(x, p.symbol);
    assert.equal(x.mint, p.addresses.solana, p.symbol);
  }
});

test("the 93 stock pairs are StonkFun's own rows (xstock, backpack, prestock, tessera), launchable and LaunchLab-ready, as recorded", () => {
  assert.equal(STOCK_PAIRS.length, 93);
  const count = (c) => STOCK_PAIRS.filter((p) => p.category === c).length;
  assert.deepEqual([count("xstock"), count("backpack"), count("prestock"), count("tessera")], [24, 60, 7, 2]);
  assert.equal(STONKFUN_PAIRS.url, "https://www.stonkfun.xyz/api/public/v1/pairs?launchable=true&launchLabReady=true");
  assert.match(STONKFUN_PAIRS.readAt, /^2026-09-25T/);
  assert.equal(STONKFUN_PAIRS.pairs.length, 93);
  for (const p of STOCK_PAIRS) {
    const row = STONKFUN_PAIRS.pairs.find((r) => r.mint === p.mint);
    assert.ok(row, `${p.symbol} is in StonkFun's list`);
    assert.equal(row.symbol, p.stonkfun, p.symbol);
    assert.equal(row.category, p.category, p.symbol);
    assert.equal(row.launchable, true, p.symbol);
    assert.equal(row.launchLabReady, true, p.symbol);
    assert.equal(row.tokenProgram, "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", p.symbol);
    assert.ok(isAddress(p.mint));
  }
  assert.equal(new Set(STOCK_PAIRS.map((p) => p.mint)).size, 93);
  assert.equal(new Set(STOCK_PAIRS.map((p) => p.symbol)).size, 93, "every pair shows a symbol of its own");
});

test("each pair's symbol and name are the ones its own mint carries on chain", () => {
  assert.equal(PAIR_MINTS.accounts.length, 93);
  for (const a of PAIR_MINTS.accounts) {
    assert.equal(a.owner, "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
    const meta = readTokenMetadata(Buffer.from(a.dataBase64, "base64"));
    const p = pairByMint(a.address);
    assert.equal(meta.mint, a.address);
    assert.deepEqual([p.symbol, p.name], [meta.symbol, meta.name], a.address);
  }
});

test("the pairs are exactly the planned cats' stocks: every researched symbol has its pair, and no pair is outside the research", () => {
  const info = JSON.parse(fs.readFileSync(path.join(ROOT, "data/cats-info.json"), "utf8"));
  const symbols = new Set(STOCK_PAIRS.map((p) => p.stonkfun));
  for (const k of Object.keys(info)) assert.ok(symbols.has(k), k);
  for (const s of symbols) assert.ok(info[s], s);
  // the crypto tokens StonkFun files under "backpack" are not stock pairs
  for (const crypto of ["DOGE", "LINK", "PEPE", "AVAX", "TAO", "ENA"]) assert.ok(!symbols.has(crypto), crypto);
  assert.deepEqual(STOCK_PAIRS.filter((p) => p.stonkfun === "OPENAI").map((p) => [p.symbol, p.category]), [["OPENAI", "prestock"], ["tOpenAI", "tessera"]]);
});

test("two real launches validate, come back as clean copies, newest first", () => {
  const r = check([GME, { ...GOOGL, extra: undefined }].map((e) => JSON.parse(JSON.stringify(e))));
  assert.deepEqual(r.refused, []);
  assert.deepEqual(r.cats.map((c) => c.symbol), ["MEDPAD", "1GME"]);
  assert.deepEqual(r.cats[0], GOOGL);
  assert.ok(!Object.isFrozen(r.cats[0]));
});

test("an entry's fields are closed", () => {
  assert.equal(refusal({ ...GME, website: "x" }), "unknown_field");
  assert.equal(refusal({ ...GME, buy: [{ label: "GMGN", url: "https://evil.example" }] }), "unknown_field");
  assert.equal(refusal({ ...GME, look: { coat: "Smoke" } }), "unknown_field");
  assert.equal(refusal({ ...GME, pair: { ...GME.pair, name: "GameStop" } }), "pair");
  const { tx, ...noTx } = GME;
  assert.equal(refusal(noTx), "tx");
});

test("addresses and signatures must be canonical base58 of the right length", () => {
  assert.equal(refusal({ ...GME, mint: GME_LAUNCH }), "mint");            // a 64-byte signature where 32 bytes belong
  assert.equal(refusal({ ...GME, tx: GME.mint }), "tx");                   // 32 bytes where 64 belong
  assert.equal(refusal({ ...GME, pool: GME.pool.replace(/.$/, "0") }), "pool"); // 0 is not base58
  assert.equal(refusal({ ...GME, payer: `1${GME.payer}` }), "payer");      // a leading zero byte: 33 bytes
  assert.equal(refusal({ ...GME, mint: 42 }), "mint");
  assert.equal(isSignature(GME_LAUNCH), true);
  assert.equal(base58Decode("I0Ol"), null);
});

test("names and symbols: markup, hidden characters and links are refused", () => {
  const bad = [
    "<b>Cat</b>", "Cat &amp; Co", "Cat\u200bCoin", "\u202eTac", "Cat\u0000", "Cat\nCoin", " Cat", "Cat ", "Cat  Coin", "Cat\u00a0Coin",
    "https://evil.example", "see www.cats", "cat.fun", "javascript:alert(1)", "data:text/html,x", "ipfs://x", "Cat\u2028", "",
    "x".repeat(65), "Z\u0301\u0302\u0303\u0304",
  ];
  for (const name of bad) assert.equal(refusal({ ...GME, name }), "name", JSON.stringify(name));
  for (const symbol of ["ME  OW", "<CAT>", "C\u200dAT", "A".repeat(17), " CAT"]) assert.equal(refusal({ ...GME, symbol }), "symbol", symbol);
  for (const ok of ["1 GME can change your life", "Café Cat", "Mr. Whiskers", "猫", "Cat 🐱", "I-RUN", "O'Malley", "M&M Cat"]) {
    assert.equal(textProblem(ok, { maxBytes: 64 }), null, ok);
  }
});

test("the pair must be one of the stock pairs, symbol and mint together", () => {
  assert.equal(refusal({ ...GME, pair: { symbol: "SOL", mint: "So11111111111111111111111111111111111111112" } }), "pair");
  assert.equal(refusal({ ...GME, pair: { symbol: "SPYx", mint: GME.pair.mint } }), "pair");
  assert.equal(refusal({ ...GME, pair: { symbol: "GMEx", mint: XSTOCKS[0].mint } }), "pair");
  assert.equal(refusal({ ...GME, pair: { symbol: "OPENAI", mint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ" } }), "pair"); // the Tessera mint is tOpenAI
  assert.equal(refusal({ ...GME, pool: GME.mint }), "accounts");
  for (const p of [STOCK_PAIRS.find((x) => x.symbol === "ANTHROPIC"), STOCK_PAIRS.find((x) => x.symbol === "tKalshi"), STOCK_PAIRS.find((x) => x.symbol === "NKE")]) {
    assert.equal(check([{ ...GME, pair: { symbol: p.symbol, mint: p.mint } }]).cats.length, 1, p.symbol);
  }
});

test("the payer must be a listed wallet, active at the launch's time", () => {
  assert.equal(refusal({ ...GME, payer: GOOGL_LAUNCHER, time: "2026-09-10T00:00:00Z" }), "payer");  // before its since
  const later = check([{ ...GOOGL, time: "2026-10-01T00:00:00Z" }], { nowMs: Date.parse("2026-12-01T00:00:00Z") });
  assert.equal(later.refused[0].clause, "payer");                                                  // at its until (exclusive)
  assert.equal(refusal({ ...GME, payer: "So11111111111111111111111111111111111111112" }), "payer");
  assert.equal(check([GME], { wallets: { launchers: [] } }).refused[0].clause, "payer");
  assert.equal(check([GOOGL]).cats.length, 1);
});

test("times: the exact format, a real date, not in the future", () => {
  for (const time of ["2026-09-24", "2026-09-24T20:57:15.000Z", "2026-09-24T20:57:15+00:00", "2026-02-30T00:00:00Z", 1790283435]) {
    assert.equal(refusal({ ...GME, time }), "time", String(time));
  }
  assert.equal(refusal({ ...GME, time: "2026-09-25T18:30:00Z" }), "time");
  assert.equal(parseTime("2026-09-24"), Date.parse("2026-09-24T00:00:00Z"));
});

test("duplicates are dropped by mint and by transaction, and the order never depends on the input", () => {
  const r = check([GME, GOOGL, { ...GME }, { ...GOOGL, mint: "EjY6mhmMr26swbV3qeADwQhVq7zrYSrCUZThLBY29HFF" }]);
  assert.equal(r.cats.length, 2);
  assert.equal(r.cats[1].mint, GME.mint);
  assert.equal(r.cats.filter((c) => c.tx === GOOGL.tx).length, 1); // one of the two entries claiming that transaction
  assert.deepEqual(r.refused.map((x) => x.clause), ["duplicate", "duplicate"]);
  const same = { ...GOOGL, time: GME.time };
  assert.deepEqual(check([GME, same]).cats.map((c) => c.mint), check([same, GME]).cats.map((c) => c.mint));
});

test("the collection holds at most MAX_CATS; the oldest past that are refused", () => {
  assert.equal(MAX_CATS, 500);
  const r = check([GME, GOOGL], { max: 1 });
  assert.deepEqual(r.cats.map((c) => c.symbol), ["MEDPAD"]);
  assert.equal(r.refused[0].clause, "over_max");
});

test("a malformed file yields no cats and one shape refusal", () => {
  for (const data of [null, [], { cats: {} }, { cats: [], note: "x" }, "cats"]) {
    const r = validateCollection(data, { wallets: WALLETS, nowMs: NOW });
    assert.deepEqual(r.cats, []);
    assert.equal(r.refused[0].clause, "shape");
  }
});

test("wallets.json: closed fields, real addresses, plain labels, since before until, no repeats", () => {
  assert.deepEqual(validateWallets(WALLETS).refused, []);
  const one = (w) => validateWallets({ launchers: [w] }).refused[0]?.clause;
  const base = { address: GME_LAUNCHER, since: "2026-09-01", label: "Launcher" };
  assert.equal(one({ ...base, address: "not-an-address" }), "address");
  assert.equal(one({ ...base, since: "September" }), "since");
  assert.equal(one({ ...base, until: "2026-08-01" }), "until");
  assert.equal(one({ ...base, label: "<script>" }), "label");
  assert.equal(one({ ...base, label: "x".repeat(49) }), "label");
  assert.equal(one({ ...base, note: "hi" }), "unknown_field");
  assert.equal(validateWallets({ launchers: [base, base] }).refused[0].clause, "duplicate");
  assert.equal(validateWallets({ wallets: [] }).refused[0].clause, "shape");
});

test("links: Solscan token and transaction, and the StonkFun token page; nothing for a bad entry", () => {
  assert.deepEqual(links(GME), {
    token: `https://solscan.io/token/${GME.mint}`,
    tx: `https://solscan.io/tx/${GME.tx}`,
    stonkfun: `https://www.stonkfun.xyz/token/${GME.mint}`,
  });
  assert.equal(links({ ...GME, mint: "javascript:alert(1)" }), null);
  assert.equal(links({ ...GME, tx: GME.mint }), null);
  assert.equal(links(null), null);
});

test("buy links: GMGN and FOMO pages for a mint, in the formats checked on 2026-09-25; none for anything else", () => {
  assert.deepEqual(buyLinks(GME.mint), [
    { label: "GMGN", url: `https://gmgn.ai/sol/token/${GME.mint}` },
    { label: "FOMO", url: `https://fomo.family/tokens/solana/${GME.mint}` },
  ]);
  for (const bad of [null, undefined, "", "planned", GME_LAUNCH, "javascript:alert(1)", `${GME.mint}/../../x`, `${GME.mint}?x=1`, 42, { mint: GME.mint }]) {
    assert.deepEqual(buyLinks(bad), [], String(bad));
  }
  // the formats are the ones the evidence records, and every check there named the mint it opened
  for (const site of BUY_SITES) {
    const ev = BUY_EVIDENCE.sites.find((s) => s.label === site.label);
    assert.equal(ev.format, site.url("<mint>"));
    assert.equal(BUY_EVIDENCE.checked, "2026-09-25");
    assert.ok(ev.checks.some((c) => c.url === site.url("7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr") || c.url.includes("7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr")), site.label);
    assert.ok(ev.checks.some((c) => c.url.includes(GME.mint)), `${site.label} was checked with a real StonkFun token`);
  }
  for (const { url } of buyLinks(GME.mint)) assert.equal(httpsProblem(url), null);
});

test("coats: a launched token with no planned cat wears the same coat for the same mint, and every coat is valid", () => {
  const a = coatFromMint(GME.mint), b = coatFromMint(GME.mint);
  assert.deepEqual(a, b);
  assert.equal(coatProblem(a), null);
  const spread = new Set(STOCK_PAIRS.map((x) => JSON.stringify(coatFromMint(x.mint))));
  assert.ok(spread.size >= 6, "coats vary across mints");
  for (const x of STOCK_PAIRS) assert.equal(coatProblem(coatFromMint(x.mint)), null);
  assert.match(coatProblem({ base: "plaid", second: "", pattern: "solid", eyes: "" }), /base/);
  assert.match(coatProblem({ base: "black", second: "", pattern: "zigzag", eyes: "" }), /pattern/);
  assert.match(coatProblem({ base: "black", second: "", pattern: "solid", eyes: "<b>" }), /eyes/);
  assert.match(coatProblem({ base: "black", second: "", pattern: "solid", eyes: "", tint: "#fff" }), /unknown/);
  assert.ok(COAT_COLOURS.includes("ginger") && COAT_PATTERNS.includes("calico"));
});

test("prose, links and source dates: what research text may carry", () => {
  for (const ok of ["Amazon.com, Inc.", "He said \"I am not a cat\" to Congress.", "Hims & Hers", "5 < 6 is fine", "Line one.\n\nLine two."]) assert.equal(proseProblem(ok), null, ok);
  for (const bad of ["<img src=x onerror=alert(1)>", "</p>", "<!-- x -->", "&lt;b&gt;", "javascript:alert(1)", "a\u202eb", " lead", "", "x".repeat(2001)]) {
    assert.notEqual(proseProblem(bad), null, JSON.stringify(bad));
  }
  assert.equal(httpsProblem("https://x.com/elonmusk/status/1703330562356957232"), null);
  for (const bad of ["http://x.com/a", "javascript:alert(1)", "https://user:pw@x.com/", "https://x.com/a b", "https://localhost/", "data:text/html,x", "//x.com"]) assert.notEqual(httpsProblem(bad), null, bad);
  for (const ok of ["2023", "2013-08", "2026-09-25"]) assert.equal(sourceDateProblem(ok, NOW), null, ok);
  for (const bad of ["2026-13", "2026-02-30", "Sept 2026", "2027-01-01", "", 2026]) assert.notEqual(sourceDateProblem(bad, NOW), null, String(bad));
});

test("the shipped wallets.json lists the owner's wallet, from 2026-09-25", () => {
  const w = validateWallets(JSON.parse(fs.readFileSync(path.join(ROOT, "data/wallets.json"), "utf8")));
  assert.deepEqual(w.refused, []);
  assert.deepEqual(w.launchers.map((l) => [l.address, l.since, l.label]), [[OWNER, "2026-09-25T00:00:00Z", "Owner"]]);
});

/* ── data/famous.json: the famous cat coins ─────────────────────────────────────────── */

import { validateFamous, famousProblem, famousBuyLink, marketWarnings, tierFor, contractProblem, TIER_RULE, GMGN_CHAINS } from "../assets/collection.js";
import { refreshFamous, fromPairs, serialize as serializeFamous } from "../scripts/refresh-famous.mjs";
import { modelIdFor } from "../assets/ui/models.js";
import { DATA_NOW } from "./helpers.mjs";

const FAMOUS = JSON.parse(fs.readFileSync(path.join(ROOT, "data/famous.json"), "utf8"));
const coinBy = (sym, chain) => FAMOUS.coins.find((c) => c.symbol === sym && (!chain || c.chain === chain));

test("famous coins: the shipped file validates, Solana coins only, every coin once, ids and contracts unique", () => {
  const r = validateFamous(FAMOUS, { nowMs: DATA_NOW });
  assert.deepEqual(r.refused, []);
  assert.equal(r.coins.length, FAMOUS.coins.length);
  assert.ok(r.coins.length >= 180, `${r.coins.length} coins`);
  assert.ok(r.coins.every((c) => c.chain === "solana"), "the owner's rule: Solana coins only");
  assert.equal(new Set(r.coins.map((c) => c.id)).size, r.coins.length);
  assert.equal(new Set(r.coins.map((c) => `${c.chain}:${c.contract.toLowerCase()}`)).size, r.coins.length);
  const stock = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, "data/planned.json"), "utf8")).cats.map((c) => c.ticker));
  for (const c of r.coins) assert.ok(!stock.has(c.id), `${c.id} is a stock cat's ticker`);
});

test("famous coins: tiers follow the rule (main for $1M and up or a company or project cat, ring 1 from $100k, ring 2 below), set when placed", () => {
  assert.equal(tierFor(5e6, null), "main");
  assert.equal(tierFor(30_000, "Backpack (exchange/wallet) mascot"), "main");
  assert.equal(tierFor(250_000, null), "ring1");
  assert.equal(tierFor(40_000, null), "ring2");
  const counts = { main: 0, ring1: 0, ring2: 0 };
  for (const c of FAMOUS.coins) {
    counts[c.tier]++;
    // Placed from the research's figures; the daily refresh never moves a coin, so only the shape is checked here.
    assert.ok(["main", "ring1", "ring2"].includes(c.tier), c.id);
    if (c.company) assert.equal(c.tier, "main", `${c.id}: a company or project cat lives in the main garden`);
  }
  assert.ok(counts.main > 0 && counts.ring1 > 0 && counts.ring2 > 0, JSON.stringify(counts));
});

test("famous coins: every buy link is the GMGN page for its own contract", () => {
  for (const c of FAMOUS.coins) {
    if (GMGN_CHAINS[c.chain]) assert.deepEqual(c.buy, { label: "GMGN", url: `https://gmgn.ai/${GMGN_CHAINS[c.chain]}/token/${c.contract}` }, c.id);
    else { assert.equal(c.buy.label, "DexScreener", c.id); assert.ok(c.buy.url.startsWith(`https://dexscreener.com/${c.chain}/`), c.id); }
  }
  assert.deepEqual(famousBuyLink("solana", "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"), { label: "GMGN", url: "https://gmgn.ai/sol/token/7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr" });
  assert.equal(famousBuyLink("robinhood", "0x020bfc650a365f8bb26819deaabf3e21291018b4").label, "DexScreener");
  assert.match(famousProblem({ ...coinBy("POPCAT", "solana"), chain: "base", contract: "0x9a26f5433671751c3276a065f57e5a02d2817973", buy: { label: "GMGN", url: "https://gmgn.ai/base/token/0x9a26f5433671751c3276a065f57e5a02d2817973" } }), /chain/, "a Base coin is refused");
  const popcat = coinBy("POPCAT", "solana");
  assert.match(famousProblem({ ...popcat, buy: { label: "GMGN", url: "https://gmgn.ai/sol/token/So11111111111111111111111111111111111111112" } }), /GMGN page for its contract/);
  assert.match(famousProblem({ ...popcat, buy: { label: "Pump", url: `https://pump.fun/${popcat.contract}` } }), /GMGN/);
});

test("famous coins: the rules refuse what is unsafe or unsourced", () => {
  const ok = coinBy("POPCAT", "solana");
  assert.equal(famousProblem(ok, { nowMs: DATA_NOW }), null);
  const bad = (patch) => famousProblem({ ...ok, ...patch }, { nowMs: DATA_NOW });
  assert.match(bad({ id: "Popcat!" }), /id/);
  assert.match(bad({ name: "<b>Popcat</b>" }), /name/);
  assert.match(bad({ chain: "moon" }), /chain/);
  assert.match(bad({ chain: "bsc" }), /chain/);
  assert.match(bad({ contract: "0x1234" }), /Solana mint/);
  assert.match(bad({ tier: "vip" }), /tier/);
  assert.match(bad({ logo: "https://example.com/logo.png" }), /logo/);
  assert.match(bad({ market: { ...ok.market, marketCapUsd: -1 } }), /marketCapUsd/);
  assert.match(bad({ market: { ...ok.market, measuredAt: "2099-01-01T00:00:00Z" } }), /future/);
  assert.match(bad({ links: { x: "https://evil.example/popcat", website: null } }), /links\.x/);
  assert.match(bad({ links: { x: null, website: "https://pump.fun/coin/x" } }), /trading/);
  assert.match(bad({ lore: "<script>alert(1)</script>" }), /lore/);
  assert.match(bad({ disclaimer: "Have fun." }), /not affiliated/);
  assert.match(bad({ extra: 1 }), /unknown field/);
  assert.equal(contractProblem("ethereum", "0xaaee1a9723aadb7afa2810263653a34ba2c21c7a"), null);
  assert.match(contractProblem("base", "0x12"), /0x/);
  const twice = validateFamous({ ...FAMOUS, coins: [ok, { ...ok, id: "popcat-again", logo: null }] }, { nowMs: DATA_NOW });
  assert.equal(twice.coins.length, 1);
  assert.equal(twice.refused[0].clause, "duplicate");
  assert.equal(validateFamous({ coins: "no" }).refused[0].clause, "shape");
  assert.equal(validateFamous({ coins: [], extra: 1 }).refused[0].clause, "shape");
});

test("famous coins: the flagged Solana coins are in, each with an honest warning; unresearched lore says where it comes from", () => {
  const warns = (c) => c.warnings.join(" ");
  assert.ok(FAMOUS.coins.some((c) => /panther/i.test(c.name) && /panther, not a house cat/i.test(warns(c))), "the Solana panther coin");
  assert.ok(FAMOUS.coins.filter((c) => /cat-themed by CoinGecko/.test(warns(c))).length >= 25, "the CoinGecko cat-themed coins");
  for (const c of FAMOUS.coins) {
    if (c.loreSource.kind === "profile") continue;
    assert.equal(c.catName, null, `${c.id}: no researched cat name`);
    assert.equal(c.who, "", `${c.id}: no researched story`);
    assert.ok(c.loreSource.url, `${c.id}: its lore names its source`);
  }
  assert.match(warns(coinBy("PURR", "solana")), /not Hyperliquid's official PURR/);
  assert.match(warns(coinBy("NEARKAT", "solana")), /meerkat/);
  for (const c of FAMOUS.coins) assert.match(c.disclaimer, /not affiliated/i, c.id);
});

test("famous coins: market warnings come from the latest figures", () => {
  const at = "2026-09-26T00:00:00Z", now = Date.parse(at);
  assert.deepEqual(marketWarnings({ marketCapUsd: 5e6, liquidityUsd: 5e5, volume24hUsd: 2e5, measuredAt: at, source: "coingecko" }, { nowMs: now }), []);
  const w = marketWarnings({ marketCapUsd: 15_000, liquidityUsd: 2_000, volume24hUsd: 30, measuredAt: at, source: "dexscreener" }, { nowMs: now + 5 * 86_400_000 });
  assert.equal(w.length, 4);
  assert.match(w[0], /Almost no trading: \$30/);
  assert.match(w[1], /Very little liquidity: \$2,000/);
  assert.match(w[2], new RegExp(`below the sanctuary's \\$${TIER_RULE.minMcap.toLocaleString("en-US")} floor`));
  assert.match(w[3], /5 days old/);
});

test("famous coins: every logo is a small WebP on this site, and no logo file is left without its coin", () => {
  const dir = path.join(ROOT, "assets/coins");
  for (const c of FAMOUS.coins) {
    if (!c.logo) continue;
    const b = fs.readFileSync(path.join(ROOT, c.logo));
    assert.ok(b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP", c.logo);
    assert.ok(b.length <= 30_000, `${c.logo} is ${b.length} bytes`);
  }
  const named = new Set(FAMOUS.coins.map((c) => c.logo).filter(Boolean));
  for (const f of fs.readdirSync(dir)) assert.ok(named.has(`assets/coins/${f}`), `assets/coins/${f} belongs to no coin`);
  assert.ok(named.size >= FAMOUS.coins.length * 0.85, `${named.size} logos`);
});

test("famous coins: the daily refresh takes DexScreener's pair figures and CoinGecko's circulating market cap, keeps the rest, and still validates", async () => {
  const popcat = coinBy("POPCAT", "solana"), cash = coinBy("MEW", "solana");
  const data = { ...FAMOUS, coins: [popcat, cash, { ...coinBy("BTC", "solana") }] };
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(String(url));
    const u = new URL(url);
    if (u.hostname === "api.dexscreener.com" && u.pathname.startsWith("/tokens/v1/solana/")) {
      return new Response(JSON.stringify([
        { pairAddress: popcat.pair.address || "P1", baseToken: { address: popcat.contract }, marketCap: 60_000_000, fdv: 61_000_000, liquidity: { usd: 5_000_000 }, volume: { h24: 900_000 } },
        { pairAddress: "OTHER", baseToken: { address: popcat.contract }, marketCap: 60_000_000, liquidity: { usd: 10 }, volume: { h24: 100 } },
      ]), { status: 200 });
    }
    if (u.hostname === "api.coingecko.com") return new Response(JSON.stringify([{ id: popcat.coingeckoId, market_cap: 58_000_000, total_volume: 1e6 }]), { status: 200 });
    return new Response("[]", { status: 200 });
  };
  const now = Date.parse("2026-09-27T05:41:00Z");
  const r = await refreshFamous({ data, fetchImpl, nowMs: now, pause: 0 });
  const p = r.data.coins.find((c) => c.id === popcat.id);
  assert.equal(p.market.marketCapUsd, 58_000_000, "CoinGecko's circulating market cap");
  assert.equal(p.market.volume24hUsd, 900_100, "volume summed over its pairs");
  assert.equal(p.market.source, "coingecko");
  assert.equal(p.market.measuredAt, "2026-09-27T05:41:00Z");
  assert.equal(p.tier, popcat.tier, "the refresh never moves a coin");
  assert.ok(r.kept.includes(cash.id), "a coin no source answered for keeps its figures");
  assert.deepEqual(r.data.coins.find((c) => c.id === cash.id).market, cash.market);
  assert.deepEqual(validateFamous(r.data, { nowMs: now }).refused, []);
  assert.ok(asked.every((a) => a.startsWith("https://api.dexscreener.com/tokens/v1/") || a.startsWith("https://api.coingecko.com/api/v3/coins/markets?")), asked.join("\n"));
  assert.deepEqual(JSON.parse(serializeFamous(r.data)), r.data);
  assert.equal(fromPairs(popcat, [{ baseToken: { address: "someone else" } }]), null);
});

test("famous coins: a model in assets/models/cats/index.json finds its coin by id, contract or a unique symbol", () => {
  const residents = [{ id: "PATCHPAW", kind: "stock" }, ...FAMOUS.coins.map((c) => ({ ...c, kind: "famous", ticker: c.symbol }))];
  const popcat = coinBy("POPCAT", "solana");
  assert.equal(modelIdFor("PATCHPAW", residents), "PATCHPAW");
  assert.equal(modelIdFor(popcat.id, residents), popcat.id);
  assert.equal(modelIdFor(popcat.contract, residents), popcat.id);
  assert.equal(modelIdFor(popcat.contract.toLowerCase(), residents), popcat.id);
  assert.equal(modelIdFor(`solana:${popcat.contract}`, residents), popcat.id);
  assert.equal(modelIdFor("POPCAT", residents), popcat.id);
  assert.equal(modelIdFor("$POPCAT", residents), popcat.id);
  const mew = coinBy("MEW", "solana");
  assert.equal(modelIdFor("MEW", residents), mew.id);
  const twin = { ...mew, id: "mew-twin", contract: "So11111111111111111111111111111111111111112", kind: "famous", ticker: "MEW" };
  assert.equal(modelIdFor("MEW", [...residents, twin]), null, "a symbol several coins share names none");
  assert.equal(modelIdFor("PATCHPAW", [...residents, { ...twin, id: "patchpaw-coin", ticker: "PATCHPAW" }]), "PATCHPAW", "a stock cat's ticker is the stock cat");
  assert.equal(modelIdFor("NOT-A-CAT", residents), null);
});
