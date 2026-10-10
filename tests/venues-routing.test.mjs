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
import { serialize } from "../scripts/build-collection.mjs";
import { watchText, readOwned, FILES } from "../scripts/lib/launcher.mjs";
import { fsStore } from "../scripts/launch.mjs";

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));
/*
 * data/cat-watch.json and data/pump-quotes.json are edited by hand, and npm test gates every Pages deploy (the
 * launcher's coins are served by Pages): no test here asserts anything of the SHIPPED files but what the launcher
 * needs of them, which always holds (it parses, or the launcher warns and reads it as empty). The ties' rules are
 * tested on tests/fixtures/cat-watch.json, a copy of the file as seeded, never on the owner's current file.
 */
const WATCH = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/cat-watch.json"), "utf8"));
/** An owner-edited data file as the launcher reads it (scripts/lib/launcher.mjs readOwned): unreadable, `fallback` and a warning. */
const owned = (rel, fallback) => { const logs = []; return { value: readOwned(fsStore(ROOT), rel, fallback, (l) => logs.push(l)), logs }; };
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

/**
 * What the shipped-files tests ask of data/cat-watch.json's ties, which the owner edits by hand (its linksNote: "the owner
 * may add, change or remove"): every tie valid (watchLinksProblems), on a watched account, never a politician's or a
 * person's. Never the file's layout, nor which ties there are today: npm test gates every Pages deploy, and the launcher's
 * coins are served by Pages. Returns the problems.
 */
function watchTieProblems(watch) {
  const out = [...watchLinksProblems(watch)].map((p) => (typeof p === "string" ? p : JSON.stringify(p)));
  const watched = new Set([...(watch.topAccounts ?? []), ...(watch.bigAccounts ?? [])].map((h) => h.toLowerCase()));
  for (const [handle, link] of Object.entries(watch.accountLinks ?? {})) {
    if (!watched.has(handle.toLowerCase())) out.push(`${handle} is not a watched account`);
    if (/^(BarackObama|JoeBiden|realDonaldTrump|POTUS|WhiteHouse|KamalaHarris|elonmusk|saylor|BillGates)$/i.test(handle)) out.push(`${handle}: no politician, no person`);
    if (link.stock !== undefined && !STOCK_PAIRS.some((s) => s.symbol === link.stock)) out.push(`${handle}: ${link.stock} is not a stock pair`);
  }
  return out;
}

/** A data/pump-quotes.json text an owner might write: valid, every row accepted (the Collection's builder stops on a refused one). Returns the problems. Checked on fixtures only, never on the shipped file. */
function pumpQuotesFileProblems(text) {
  let file;
  try { file = JSON.parse(text); } catch { return ["not JSON"]; }
  const v = validatePumpQuotes(file), out = v.refused.map((r) => `row ${r.index}: ${r.detail}`);
  if (!Array.isArray(file?.quotes)) out.push("quotes is not a list");
  return out;
}

test("data/cat-watch.json's ties (as seeded: tests/fixtures/cat-watch.json): every stock is one of the stock pairs, only watched companies are tied, no politician; seeded with stocks only; watchList and every query are unchanged by them", () => {
  assert.deepEqual(watchTieProblems(WATCH), []);
  const links = Object.entries(WATCH.accountLinks);
  assert.ok(links.length >= 10, "the companies with a stock pair are seeded");
  assert.match(WATCH.linksNote, /the owner may add, change or remove/);
  // The owner's edits the note allows pass the same check, however the file is laid out: a coin tie (with the opt-in), a
  // figure tied to a stock, the one-line accountLinks wrapped over several lines. The one-line layout is made here (the
  // launcher's own writer, watchText), never taken from a file the owner may have laid out otherwise.
  const text = watchText(WATCH);
  const wrapped = text.replace(/\n "accountLinks": \{ /, '\n "accountLinks": {\n  ').replace(/\}, "([A-Za-z0-9_]+)": \{/g, '},\n  "$1": {');
  const edited = { ...JSON.parse(wrapped), accountLinks: { ...WATCH.accountLinks, pumpdotfun: { pumpQuote: { symbol: "MEOW", mint: MEOW.mint } } },
    figures: WATCH.figures.map((f, i) => (i === 0 ? { ...f, stock: "tOpenAI" } : f)), bigAccounts: [...WATCH.bigAccounts, "pumpdotfun"] };
  assert.notEqual(wrapped, text, "the test really wraps it");
  assert.deepEqual(watchTieProblems(edited), []);
  assert.deepEqual(watchTieProblems({ ...WATCH, accountLinks: { ...WATCH.accountLinks, elonmusk: { stock: "TSLAx" } }, bigAccounts: [...WATCH.bigAccounts, "elonmusk"] }), ["elonmusk: no politician, no person"]);
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

test("usedStockPairs: one cat per stock pair, as the site keeps it for planned cats, plus proved launches and adoptables; today only tOpenAI, tKalshi and the held-back cats' pairs are free", () => {
  const used = usedStockPairs({ planned: PLANNED, collection: read("collection.json"), adoptables: read("adoptables.json") });
  const free = STOCK_PAIRS.filter((s) => !used.has(s.mint)).map((s) => s.symbol);
  // Only the pairs no planned cat has can be free: the two that never had one, and those of the cats held back with no lore
  // (data/held.json, 2026-10-01); the launcher may give one of them its StonkFun cat (then it is used too).
  // 2026-10-10: NEURALINK's planned cat, SILKSTRIPE (Elon Musk's Schrödinger), moved to the adoptables to launch on
  // pump.fun in SOL, the owner's choice; its pair is free too.
  const moved = ["NEURALINK"];
  assert.ok(moved.every((s) => !PLANNED.cats.some((c) => c.pair.symbol === s)), "a moved cat's pair has no planned cat");
  assert.ok(free.length <= 2 + read("held.json").held.length + moved.length, free.join(", "));
  assert.ok(free.length > 2, "the held-back cats' pairs are free again");
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
  assert.deepEqual(chooseVenue(post(), TEST_WATCH), { id: "pump-sol", reason: "default" }, "no tie: no options needed");
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
  assert.deepEqual(chooseVenue(post({ figure: "Tom", catName: "Tom", nameFrom: "figure", bigAccount: "OpenAI" }), TEST_WATCH, { ...free, pumpQuotes: QUOTES }),
    { id: "stonkfun", pair: pair("tOpenAI"), from: "account", reason: "stock" }, "an unusable coin tie falls through to the account's stock");

  // malformed ties and junk are no tie, and nothing throws
  assert.deepEqual(chooseVenue(post({ figure: "Bingus", catName: "Bingus", nameFrom: "figure" }), TEST_WATCH, free), { id: "pump-sol", reason: "default" });
  assert.deepEqual(chooseVenue(post({ bigAccount: "BadCo" }), TEST_WATCH, free), { id: "pump-sol", reason: "default" });
  for (const [c, w] of [[null, null], [42, "x"], [post({ bigAccount: "OpenAI" }), { accountLinks: [] }], [{ bigAccount: {}, figure: 5, reading: "x" }, TEST_WATCH], [post({ figure: "Nyan Cat", nameFrom: "figure" }), { figures: "x" }]]) {
    assert.deepEqual(chooseVenue(c, w), { id: "pump-sol", reason: "default" });
  }
  // which pairs are taken must be said: without a Set or a list of mints a stock tie is never used (fails closed; review)
  const openai = post({ bigAccount: "OpenAI" });
  for (const opts of [undefined, null, {}, { usedPairs: undefined }, { usedPairs: null }, { usedPairs: "junk" }, { usedPairs: 5 }, { usedPairs: new Map([[pair("tOpenAI").mint, 1]]) }, { usedPairs: {} }]) {
    assert.deepEqual(chooseVenue(openai, TEST_WATCH, opts), { id: "pump-sol", reason: "pairs_unknown" }, String(opts && JSON.stringify(opts)));
  }
  assert.deepEqual(chooseVenue(openai, TEST_WATCH), { id: "pump-sol", reason: "pairs_unknown" }, "the registry's two-argument call");
  assert.deepEqual(chooseVenue(openai, TEST_WATCH, { usedPairs: [] }).id, "stonkfun", "an empty list: every pair is free");
  assert.deepEqual(chooseVenue(both, TEST_WATCH, {}), { id: "pump-sol", reason: "pairs_unknown" }, "neither the figure's nor the account's stock");
  assert.deepEqual(chooseVenue(post({ figure: "Tom", catName: "Tom", nameFrom: "figure", bigAccount: "OpenAI" }), TEST_WATCH, { pumpQuotes: QUOTES, pumpQuoteOptIn: true }).id, "pump-quote",
    "a coin tie does not depend on the stock pairs");
  for (const c of [post(), post({ bigAccount: "OpenAI" }), pumpPost]) assert.ok(VENUE_IDS.includes(chooseVenue(c, TEST_WATCH, { pumpQuotes: QUOTES, pumpQuoteOptIn: true }).id));
  assert.deepEqual(venueLinks(both, TEST_WATCH), [{ from: "figure", stock: "tKalshi" }, { from: "account", stock: "tOpenAI" }]);
});

test("with the seeded ties and the shipped sanctuary data: every tied company launches on StonkFun exactly when its pair is free (today only OpenAI, on tOpenAI), otherwise in SOL", () => {
  const usedPairs = usedStockPairs({ planned: PLANNED, collection: read("collection.json"), adoptables: read("adoptables.json") });
  const pumpQuotes = validatePumpQuotes(owned(FILES.pumpQuotes, { quotes: [] }).value).quotes;
  const routes = {};
  for (const [handle, link] of Object.entries(WATCH.accountLinks)) {
    const v = chooseVenue(post({ bigAccount: handle, catName: "Mochi" }), WATCH, { usedPairs, pumpQuotes });
    const p = pair(link.stock);
    assert.deepEqual(v, usedPairs.has(p.mint) ? { id: "pump-sol", reason: "pair_taken" } : { id: "stonkfun", pair: p, from: "account", reason: "stock" }, handle);
    routes[handle] = v.id === "stonkfun" ? v.pair.symbol : v.id;
  }
  if (WATCH.accountLinks.OpenAI && !usedPairs.has(pair("tOpenAI").mint)) assert.equal(routes.OpenAI, "tOpenAI", "while tOpenAI has no cat");
  assert.deepEqual(chooseVenue(post({ catName: "Mochi" }), WATCH, { usedPairs, pumpQuotes }), { id: "pump-sol", reason: "default" }, "an ordinary cat: pump.fun in SOL");
});

test("a data/pump-quotes.json the owner writes (as its note says, however it is laid out) passes; a refused row is found (no coin-priced launch until the owner lists one and opts in)", () => {
  const file = { note: "The coins a sanctuary pump.fun launch may be priced in, edited by hand.", quotes: [] };
  assert.deepEqual(pumpQuotesFileProblems(serialize(file)), []);
  const bonk = { symbol: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" };
  assert.deepEqual(pumpQuotesFileProblems(serialize({ ...file, quotes: [bonk] })), []);
  assert.deepEqual(pumpQuotesFileProblems(JSON.stringify({ ...file, quotes: [bonk] })), [], "on one line");
  assert.deepEqual(pumpQuotesFileProblems(JSON.stringify({ quotes: [bonk] })), [], "with no note");
  assert.match(pumpQuotesFileProblems(serialize({ ...file, quotes: [{ ...bonk, tokenProgram: "nope" }] })).join(), /row 0/, "a refused row (the Collection's builder would stop)");
  assert.match(pumpQuotesFileProblems(serialize({ ...file, quotes: [{ symbol: "SOL", mint: "So11111111111111111111111111111111111111112", tokenProgram: bonk.tokenProgram }] })).join(), /row 0/);
});

test("owner-edited files never stop the launcher: a typo, a BOM, an extra key or any layout in data/cat-watch.json or data/pump-quotes.json is read as empty with a warning, or read as it is (fixtures)", () => {
  const dir = fs.mkdtempSync(path.join(ROOT, "tests", ".tmp-owned-"));
  try {
    const io = fsStore(dir);
    fs.mkdirSync(path.join(dir, "data"));
    const readAs = (rel, text, fallback) => { fs.writeFileSync(path.join(dir, rel), text); const logs = []; return { value: readOwned(io, rel, fallback, (l) => logs.push(l)), logs }; };
    const bonk = { symbol: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" };
    // Unreadable: read as empty, with a warning.
    for (const [rel, text, fallback] of [[FILES.pumpQuotes, '{ "quotes": [ { "symbol": "BONK", } ] ', { quotes: [] }], [FILES.watch, '{ "figures": [ { "name": "Nyan Cat" }, ] }', { figures: [] }]]) {
      const r = readAs(rel, text, fallback);
      assert.deepEqual(r.value, fallback, rel);
      assert.ok(r.logs.some((l) => /^::warning.*is not valid JSON; it is read as empty/.test(l)), rel);
    }
    // A BOM, an extra key, another layout: read as it is, no warning.
    const q = readAs(FILES.pumpQuotes, `\uFEFF${JSON.stringify({ quotes: [bonk] }, null, 4)}`, { quotes: [] });
    assert.deepEqual([validatePumpQuotes(q.value).quotes.map((x) => x.symbol), q.logs], [["BONK"], []]);
    // An extra key there is refused by the one rule the builder and the page share: the launcher then warns and prices no cat in a coin (quotesOf).
    const x = readAs(FILES.pumpQuotes, JSON.stringify({ quotes: [bonk], extra: 1 }), { quotes: [] });
    assert.deepEqual([validatePumpQuotes(x.value).quotes, validatePumpQuotes(x.value).refused.length > 0], [[], true]);
    const w = readAs(FILES.watch, `\uFEFF${JSON.stringify({ ...WATCH, myNotes: "x" }, null, 2)}`, { figures: [] });
    assert.deepEqual([w.value.accountLinks, w.logs], [WATCH.accountLinks, []]);
    assert.equal(chooseVenue(post({ bigAccount: "OpenAI", catName: "Mochi" }), w.value, { usedPairs: [] }).id, "stonkfun", "its ties still route");
    // A tie the owner got wrong is skipped by the router, never a stop.
    const bad = { ...WATCH, accountLinks: { ...WATCH.accountLinks, OpenAI: { stock: "NOPE" } } };
    assert.deepEqual(chooseVenue(post({ bigAccount: "OpenAI", catName: "Mochi" }), bad, { usedPairs: [] }), { id: "pump-sol", reason: "default" });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("the shipped data/cat-watch.json and data/pump-quotes.json: only what the launcher needs (it reads them, or warns and reads them as empty), whatever their layout: as they are, pretty-printed or re-wrapped", () => {
  for (const [rel, fallback] of [[FILES.watch, { figures: [] }], [FILES.pumpQuotes, { quotes: [] }]]) {
    const r = owned(rel, fallback);
    assert.ok(r.logs.length === 0 || r.logs.every((l) => /^::warning.*read as empty/.test(l)), rel);
    if (r.value === fallback) continue;                              // unreadable: the launcher reads it as empty, and so do these tests
    for (const text of [JSON.stringify(r.value, null, 2), JSON.stringify(r.value), rel === FILES.watch ? watchText(r.value) : serialize(r.value)]) {
      assert.doesNotThrow(() => (rel === FILES.watch ? chooseVenue(post({ bigAccount: "OpenAI", catName: "Mochi" }), JSON.parse(text), { usedPairs: [] }) : validatePumpQuotes(JSON.parse(text))), rel);
    }
  }
  // The seeded ties' test wraps a one-line layout made by construction: however the real file is laid out, it still wraps.
  const real = owned(FILES.watch, null).value;
  if (real && typeof real === "object" && !Array.isArray(real)) {
    for (const layout of [JSON.stringify(real, null, 2), JSON.stringify(real)]) {
      const text = watchText(JSON.parse(layout));
      const wrapped = text.replace(/\n "accountLinks": \{ /, '\n "accountLinks": {\n  ').replace(/\}, "([A-Za-z0-9_]+)": \{/g, '},\n  "$1": {');
      if (Object.keys(real.accountLinks ?? {}).length) assert.notEqual(wrapped, text);
      assert.deepEqual(JSON.parse(wrapped), JSON.parse(text));
    }
  }
});
