/* The launcher, stage 4: where a trending cat launches (scripts/lib/venues-routing.mjs chooseVenue,
   the owner's rule), the ties in data/cat-watch.json, and the one-cat-per-stock-pair rule. Pure:
   no network. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { VENUE_IDS, chooseVenue, venueLinks, usedStockPairs, watchLinksProblems, linkProblem } from "../scripts/lib/venues-routing.mjs";
import { validatePumpQuotes, PUMP_QUOTE_VERIFIED } from "../scripts/lib/pump.mjs";
import { TOKEN_2022_PROGRAM } from "../scripts/lib/programs.mjs";
import { watchList, bigQueries, figureQueries } from "../scripts/scan-trending-cats.mjs";
import { STOCK_PAIRS, validatePlanned } from "../assets/collection.js";
import { ROOT, DATA_NOW } from "./helpers.mjs";

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));
const WATCH = read("cat-watch.json");
const PLANNED = read("planned.json");
const pair = (symbol) => { const p = STOCK_PAIRS.find((s) => s.symbol === symbol); return { symbol: p.symbol, mint: p.mint }; };
const MEOW = Object.freeze({ symbol: "MEOW", mint: "MEoWkY1hD4n8vUe8vNQ4yLzVz9Hq1zVQf7mH3ZcVb2p", tokenProgram: TOKEN_2022_PROGRAM });
const QUOTES = validatePumpQuotes({ quotes: [MEOW] }).quotes;
/** A post as data/trending-cats.json keeps it (only what the rule reads). */
const post = ({ bigAccount, figure, catName = null, nameFrom } = {}) => ({
  id: "1971234567890123456", url: "https://x.com/someone/status/1971234567890123456", stage: "viral", ...(bigAccount ? { bigAccount } : {}), ...(figure ? { figure } : {}),
  reading: { catName, coinName: catName, ticker: catName ? "CAT" : null, kind: "real", sensitive: false, aboutOneCat: true, readBy: "rules", ...(nameFrom ? { nameFrom } : {}) },
});
const TEST_WATCH = {
  figures: [
    { name: "Nyan Cat", aliases: ["Pop-Tart Cat"], kind: "meme", stock: "tKalshi" },
    { name: "Tom", aliases: ["Tom and Jerry"], matchOnlyAliases: true, kind: "cartoon", pumpQuote: { symbol: "MEOW", mint: MEOW.mint } },
    { name: "Bingus", aliases: [], kind: "meme", stock: "NOPE" },
    { name: "Keyboard Cat", aliases: [], kind: "meme" },
  ],
  accountLinks: { OpenAI: { stock: "tOpenAI" }, Tesla: { stock: "TSLAx" }, pumpdotfun: { pumpQuote: { symbol: "MEOW", mint: MEOW.mint } }, BadCo: { stock: "TSLAx", pumpQuote: { symbol: "MEOW", mint: MEOW.mint } } },
};

test("data/cat-watch.json's ties: every stock is one of the stock pairs, only watched companies are tied, no politician, no coin seeded; watchList and every query are unchanged by them", () => {
  assert.deepEqual(watchLinksProblems(WATCH), []);
  const links = Object.entries(WATCH.accountLinks);
  assert.ok(links.length >= 10, "the companies with a stock pair are seeded");
  const watched = new Set([...WATCH.topAccounts, ...WATCH.bigAccounts].map((h) => h.toLowerCase()));
  for (const [handle, link] of links) {
    assert.ok(watched.has(handle.toLowerCase()), `${handle} is a watched account`);
    assert.ok(!/^(BarackObama|JoeBiden|realDonaldTrump|POTUS|WhiteHouse|KamalaHarris|elonmusk|saylor|BillGates)$/i.test(handle), `${handle}: no politician, no person`);
    assert.deepEqual(Object.keys(link), ["stock"], `${handle}: no pumpQuote is seeded`);
    assert.ok(STOCK_PAIRS.some((s) => s.symbol === link.stock), `${handle}: ${link.stock} is a stock pair`);
  }
  assert.ok(!WATCH.figures.some((f) => f.stock !== undefined || f.pumpQuote !== undefined), "no figure's company has a stock pair today");
  assert.match(WATCH.linksNote, /the owner may add, change or remove/);
  // the trend watch ignores the ties: its lists and queries are exactly what they are without them
  const names = new Set([...read("adoptables.json").cats, ...PLANNED.cats].flatMap((c) => [c.name, c.coinName, c.ticker, c.launchTicker]).filter(Boolean).map((s) => String(s).toLowerCase()));
  const bare = structuredClone(WATCH);
  delete bare.accountLinks; delete bare.linksNote;
  for (const f of bare.figures) { delete f.stock; delete f.pumpQuote; }
  const [w, b] = [watchList(WATCH, names), watchList(bare, names)];
  assert.deepEqual(w, b);
  assert.deepEqual(bigQueries(w.bigAccounts, w.topAccounts), bigQueries(b.bigAccounts, b.topAccounts));
  assert.deepEqual(figureQueries(w.figures), figureQueries(b.figures));
  assert.deepEqual(watchList(TEST_WATCH).figures.map((f) => Object.keys(f)), watchList(TEST_WATCH).figures.map(() => ["name", "aliases", "kind", "ticker", "matchOnlyAliases", "needsCatWord", "terms"]), "a figure's tie is not passed on");
});

test("watchLinksProblems and linkProblem: a tie is exactly one stock pair symbol or one { symbol, mint } coin, on an X handle listed once", () => {
  assert.equal(linkProblem({ stock: "TSLAx" }), null);
  assert.equal(linkProblem({ pumpQuote: { symbol: "MEOW", mint: MEOW.mint } }), null);
  const bad = [
    [{ stock: "TSLA" }, /not one of the stock pairs/],
    [{ stock: "TSLAx", pumpQuote: { symbol: "MEOW", mint: MEOW.mint } }, /exactly one/],
    [{ ticker: "TSLAx" }, /exactly one/],
    [{ pumpQuote: { symbol: "MEOW", mint: "nope" } }, /not an address/],
    [{ pumpQuote: { symbol: "MEOW", mint: MEOW.mint, tokenProgram: TOKEN_2022_PROGRAM } }, /\{ symbol, mint \}/],
    [{ pumpQuote: { symbol: "<b>", mint: MEOW.mint } }, /symbol/],
    [{ pumpQuote: { symbol: "TSLAx", mint: pair("TSLAx").mint } }, /stock tie/],
    ["TSLAx", /a tie is/],
  ];
  for (const [link, pattern] of bad) assert.match(linkProblem(link), pattern, JSON.stringify(link));
  assert.deepEqual(watchLinksProblems(TEST_WATCH), ["Bingus: NOPE is not one of the stock pairs", "BadCo: a tie is exactly one of stock or pumpQuote"]);
  assert.deepEqual(watchLinksProblems({ figures: [{ name: "X", stock: "TSLAx", pumpQuote: { symbol: "MEOW", mint: MEOW.mint } }] }), ["X: a stock or a pumpQuote, not both"]);
  assert.deepEqual(watchLinksProblems({ accountLinks: { "@Tesla": { stock: "TSLAx" }, tesla: { stock: "TSLAx" }, TESLA: { stock: "TSLAx" } } }), ["@Tesla: not an X handle (no @)", "TESLA: listed twice"]);
  assert.deepEqual(watchLinksProblems({ accountLinks: [] }), ["accountLinks is { handle: tie }"]);
  assert.deepEqual(watchLinksProblems({}), []);
  assert.deepEqual(watchLinksProblems(null), []);
});

test("usedStockPairs: one cat per stock pair, as the site keeps it for planned cats, plus proved launches and adoptables; today only tOpenAI and tKalshi are free", () => {
  const used = usedStockPairs({ planned: PLANNED, collection: read("collection.json"), adoptables: read("adoptables.json") });
  const free = STOCK_PAIRS.filter((s) => !used.has(s.mint)).map((s) => s.symbol);
  assert.deepEqual(free, ["tOpenAI", "tKalshi"]);
  for (const c of validatePlanned(PLANNED, { nowMs: DATA_NOW }).cats) assert.ok(used.has(c.pair.mint), `${c.ticker}'s pair`);
  // a proved StonkFun launch takes its pair; a pump.fun one (SOL) takes none; so does a launch sent but not yet proved (extra)
  const launched = usedStockPairs({ collection: { cats: [{ pair: pair("tOpenAI") }, { pair: { symbol: "SOL", mint: "So11111111111111111111111111111111111111112" }, launchpad: "pump.fun" }] } });
  assert.deepEqual([...launched], [pair("tOpenAI").mint]);
  assert.deepEqual([...usedStockPairs({ extra: [pair("tKalshi").mint, "So11111111111111111111111111111111111111112"] })], [pair("tKalshi").mint]);
  assert.deepEqual([...usedStockPairs({ adoptables: { cats: [{ pair: pair("GPRO") }, { pair: { symbol: "STONK", mint: "6GmAFSYs4gk3FDao5FzzySQpPZaWsa4rUJHacpMpUNgx" } }] } })], [pair("GPRO").mint]);
  assert.equal(usedStockPairs({ planned: { cats: "x" }, collection: null, adoptables: 5 }).size, 0);
  assert.equal(usedStockPairs().size, 0);
});

test("chooseVenue: SOL by default; a company's stock on StonkFun unless its pair has a cat; a figure's tie before its account's; a listed coin only with the owner's opt-in", () => {
  const free = { usedPairs: new Set() };
  assert.deepEqual(chooseVenue(post(), TEST_WATCH, free), { id: "pump-sol", reason: "default" });
  assert.deepEqual(chooseVenue(post({ bigAccount: "openai" }), TEST_WATCH, free), { id: "stonkfun", pair: pair("tOpenAI"), from: "account", reason: "stock" });
  assert.deepEqual(chooseVenue(post({ bigAccount: "Tesla" }), TEST_WATCH, { usedPairs: [pair("TSLAx").mint] }), { id: "pump-sol", reason: "pair_taken" });
  assert.deepEqual(chooseVenue(post({ bigAccount: "Tesla" }), TEST_WATCH, free), { id: "stonkfun", pair: pair("TSLAx"), from: "account", reason: "stock" });
  assert.deepEqual(chooseVenue(post({ bigAccount: "someone_else" }), TEST_WATCH, free), { id: "pump-sol", reason: "default" });

  // a figure's tie holds when the post's cat is that figure
  const nyan = post({ figure: "Nyan Cat", catName: "Nyan Cat", nameFrom: "figure" });
  assert.deepEqual(chooseVenue(nyan, TEST_WATCH, free), { id: "stonkfun", pair: pair("tKalshi"), from: "figure", reason: "stock" });
  assert.deepEqual(chooseVenue(post({ figure: "Nyan Cat", catName: "pop-tart cat" }), TEST_WATCH, free).pair, pair("tKalshi"), "the cat's name is an alias");
  assert.deepEqual(chooseVenue(post({ catName: "Nyan Cat" }), TEST_WATCH, free).pair, pair("tKalshi"), "found by another lens: the cat's name is the figure's");
  assert.deepEqual(chooseVenue(post({ figure: "Nyan Cat", catName: "Mochi" }), TEST_WATCH, free), { id: "pump-sol", reason: "default" }, "a post that mentions the figure about another cat");
  assert.deepEqual(chooseVenue(post({ catName: "Tom" }), TEST_WATCH, free), { id: "pump-sol", reason: "default" }, "Tom alone is too common a name (matchOnlyAliases)");
  // the figure's tie first; when its pair is taken the account's is tried
  const both = post({ bigAccount: "OpenAI", figure: "Nyan Cat", catName: "Nyan Cat", nameFrom: "figure" });
  assert.equal(chooseVenue(both, TEST_WATCH, free).from, "figure");
  assert.deepEqual(chooseVenue(both, TEST_WATCH, { usedPairs: [pair("tKalshi").mint] }), { id: "stonkfun", pair: pair("tOpenAI"), from: "account", reason: "stock" });
  assert.deepEqual(chooseVenue(both, TEST_WATCH, { usedPairs: [pair("tKalshi").mint, pair("tOpenAI").mint] }), { id: "pump-sol", reason: "pair_taken" });

  // a coin: listed, and (while the venue is unverified) opted into
  assert.equal(PUMP_QUOTE_VERIFIED, false);
  const pumpPost = post({ bigAccount: "pumpdotfun" });
  assert.deepEqual(chooseVenue(pumpPost, TEST_WATCH, free), { id: "pump-sol", reason: "quote_not_listed" });
  assert.deepEqual(chooseVenue(pumpPost, TEST_WATCH, { pumpQuotes: QUOTES }), { id: "pump-sol", reason: "quote_unverified" });
  assert.deepEqual(chooseVenue(pumpPost, TEST_WATCH, { pumpQuotes: QUOTES, pumpQuoteOptIn: "yes" }), { id: "pump-sol", reason: "quote_unverified" }, "only true opts in");
  assert.deepEqual(chooseVenue(pumpPost, TEST_WATCH, { pumpQuotes: QUOTES, pumpQuoteOptIn: true }),
    { id: "pump-quote", quote: { symbol: "MEOW", mint: MEOW.mint }, tokenProgram: TOKEN_2022_PROGRAM, from: "account", reason: "pump_quote" });
  const tom = post({ figure: "Tom", catName: "Tom", nameFrom: "figure" });
  assert.equal(chooseVenue(tom, TEST_WATCH, { pumpQuotes: QUOTES, pumpQuoteOptIn: true }).from, "figure");
  assert.deepEqual(chooseVenue(post({ figure: "Tom", catName: "Tom", nameFrom: "figure", bigAccount: "OpenAI" }), TEST_WATCH, { pumpQuotes: QUOTES }),
    { id: "stonkfun", pair: pair("tOpenAI"), from: "account", reason: "stock" }, "an unusable coin tie falls through to the account's stock");

  // malformed ties and junk are no tie, and nothing throws
  assert.deepEqual(chooseVenue(post({ figure: "Bingus", catName: "Bingus", nameFrom: "figure" }), TEST_WATCH, free), { id: "pump-sol", reason: "default" });
  assert.deepEqual(chooseVenue(post({ bigAccount: "BadCo" }), TEST_WATCH, free), { id: "pump-sol", reason: "default" });
  for (const [c, w] of [[null, null], [42, "x"], [post({ bigAccount: "OpenAI" }), { accountLinks: [] }], [{ bigAccount: {}, figure: 5, reading: "x" }, TEST_WATCH], [post({ figure: "Nyan Cat", nameFrom: "figure" }), { figures: "x" }]]) {
    assert.deepEqual(chooseVenue(c, w), { id: "pump-sol", reason: "default" });
  }
  assert.deepEqual(chooseVenue(post({ bigAccount: "OpenAI" }), TEST_WATCH, { usedPairs: "junk" }).id, "stonkfun");
  for (const c of [post(), post({ bigAccount: "OpenAI" }), pumpPost]) assert.ok(VENUE_IDS.includes(chooseVenue(c, TEST_WATCH, { pumpQuotes: QUOTES, pumpQuoteOptIn: true }).id));
  assert.deepEqual(venueLinks(both, TEST_WATCH), [{ from: "figure", stock: "tKalshi" }, { from: "account", stock: "tOpenAI" }]);
});

test("with the shipped data: every tied company launches on StonkFun exactly when its pair is free (today only OpenAI, on tOpenAI), otherwise in SOL", () => {
  const usedPairs = usedStockPairs({ planned: PLANNED, collection: read("collection.json"), adoptables: read("adoptables.json") });
  const pumpQuotes = validatePumpQuotes(read("pump-quotes.json")).quotes;
  const routes = {};
  for (const [handle, link] of Object.entries(WATCH.accountLinks)) {
    const v = chooseVenue(post({ bigAccount: handle, catName: "Mochi" }), WATCH, { usedPairs, pumpQuotes });
    const p = pair(link.stock);
    assert.deepEqual(v, usedPairs.has(p.mint) ? { id: "pump-sol", reason: "pair_taken" } : { id: "stonkfun", pair: p, from: "account", reason: "stock" }, handle);
    routes[handle] = v.id === "stonkfun" ? v.pair.symbol : v.id;
  }
  if (WATCH.accountLinks.OpenAI) assert.equal(routes.OpenAI, "tOpenAI");
  assert.deepEqual(chooseVenue(post({ catName: "Mochi" }), WATCH, { usedPairs, pumpQuotes }), { id: "pump-sol", reason: "default" }, "an ordinary cat: pump.fun in SOL");
});
