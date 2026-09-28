/**
 * WHERE THE AUTOMATIC LAUNCHER LAUNCHES A CAT (the owner's routing rule), pure and offline:
 *   · by default on pump.fun, priced in SOL                                     "pump-sol"
 *   · a cat tied to a company that has a stock: on StonkFun (Raydium LaunchLab),
 *     priced in that company's tokenized stock (a STOCK_PAIRS pair)               "stonkfun"
 *   · a cat tied to a coin pump.fun offers as a quote: on pump.fun, priced in
 *     that coin                                                                  "pump-quote"
 * The builders: scripts/lib/pump.mjs ("pump-sol", and "pump-quote" with its `quote`) and
 * scripts/lib/launchlab.mjs ("stonkfun").
 *
 * THE TIES live in data/cat-watch.json, edited by hand (watchLinksProblems checks them):
 *   · a figure may carry "stock": a STOCK_PAIRS symbol, or "pumpQuote": { symbol, mint }: the cat
 *     IS that figure, so the tie holds when the post's cat is the figure (its reading took the
 *     figure's name, reading.nameFrom "figure", or the cat's name is the figure's name or alias);
 *   · "accountLinks": { "<X handle>": { "stock": … } | { "pumpQuote": … } } ties a big account
 *     (a company) to its stock or coin: the tie holds for a cat post of that account
 *     (candidate.bigAccount, any case).
 * A figure's tie is tried before its account's; the first one that can be used wins.
 *
 * WHEN A TIE CANNOT BE USED the cat launches on pump.fun in SOL:
 *   · a stock pair that already has a sanctuary cat (usedPairs; one cat per pair, the rule
 *     assets/collection.js validatePlanned keeps for planned cats; usedStockPairs computes it):
 *     today 91 of the 93 pairs have a planned cat, and only tOpenAI and tKalshi are free;
 *   · any stock pair when the caller did not say which pairs are taken (usedPairs missing, or not
 *     a Set or a list): the rule fails closed, so a pair is never given a second cat by omission;
 *   · a symbol that is not one of the stock pairs;
 *   · a coin data/pump-quotes.json does not list (pumpQuotes, pump.mjs validatePumpQuotes);
 *   · a listed coin while pump.mjs PUMP_QUOTE_VERIFIED is false (no coin-priced pump.fun launch has
 *     been recorded), unless the owner opts in (pumpQuoteOptIn: true; the launcher reads it from the
 *     repository variable LAUNCH_PUMP_QUOTE=on, scripts/lib/launcher.mjs pumpQuoteOptIn, simulates
 *     such a launch before sending it, and falls back to SOL if anything fails before the send).
 * The launcher calls this through scripts/lib/venues.mjs chooseVenue, which maps the answer onto a
 * registered venue and computes usedPairs (usedStockPairs over the files, plus its own launches'
 * pairs that no file shows yet).
 */
import { STOCK_PAIRS, isAddress, textProblem } from "../../assets/collection.js";
import { PUMP_QUOTE_VERIFIED, quoteProblem } from "./pump.mjs";

export const VENUE_IDS = Object.freeze(["pump-sol", "stonkfun", "pump-quote"]);

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const lower = (s) => (typeof s === "string" ? s.trim().toLowerCase() : "");
const HANDLE = /^\w{1,15}$/;

/** Why a tie ({ stock } or { pumpQuote: { symbol, mint } }, alone) is malformed, or null. */
export function linkProblem(link, { stocks = STOCK_PAIRS } = {}) {
  if (!isObj(link)) return "a tie is { stock } or { pumpQuote }";
  const keys = Object.keys(link);
  if (keys.length !== 1 || !["stock", "pumpQuote"].includes(keys[0])) return "a tie is exactly one of stock or pumpQuote";
  if (keys[0] === "stock") return stocks.some((s) => s.symbol === link.stock) ? null : `${String(link.stock).slice(0, 16)} is not one of the stock pairs`;
  const q = link.pumpQuote;
  if (!isObj(q) || Object.keys(q).some((k) => !["symbol", "mint"].includes(k))) return "pumpQuote is { symbol, mint }";
  if (textProblem(q.symbol, { maxBytes: 16 })) return "pumpQuote's symbol is not plain text";
  if (!isAddress(q.mint)) return "pumpQuote's mint is not an address";
  if (stocks.some((s) => s.mint === q.mint)) return "a stock pair is a stock tie, not a pumpQuote";
  return null;
}

/**
 * Every problem with the ties in data/cat-watch.json (as read): figures' "stock" / "pumpQuote"
 * (at most one, each valid) and "accountLinks" (an object of X handles to ties, each handle once in
 * any case). Returns a list of strings, empty when all is well. The rest of the file is
 * scripts/scan-trending-cats.mjs watchList's to check.
 */
export function watchLinksProblems(raw, { stocks = STOCK_PAIRS } = {}) {
  const out = [];
  for (const f of Array.isArray(raw?.figures) ? raw.figures : []) {
    if (!isObj(f) || (f.stock === undefined && f.pumpQuote === undefined)) continue;
    if (f.stock !== undefined && f.pumpQuote !== undefined) { out.push(`${f.name}: a stock or a pumpQuote, not both`); continue; }
    const p = linkProblem(f.stock !== undefined ? { stock: f.stock } : { pumpQuote: f.pumpQuote }, { stocks });
    if (p) out.push(`${f.name}: ${p}`);
  }
  if (raw?.accountLinks === undefined) return out;
  if (!isObj(raw.accountLinks)) return [...out, "accountLinks is { handle: tie }"];
  const seen = new Set();
  for (const [handle, link] of Object.entries(raw.accountLinks)) {
    if (!HANDLE.test(handle)) out.push(`${handle.slice(0, 20)}: not an X handle (no @)`);
    else if (seen.has(handle.toLowerCase())) out.push(`${handle}: listed twice`);
    seen.add(handle.toLowerCase());
    const p = linkProblem(link, { stocks });
    if (p) out.push(`${handle}: ${p}`);
  }
  return out;
}

const aliasesOf = (f) => (Array.isArray(f.aliases) ? f.aliases : []);

/**
 * The watched figure the candidate's cat is, or null: the figure the post names (candidate.figure)
 * when the reading took its name (reading.nameFrom "figure") or the cat's name is the figure's name
 * or an alias; failing that, a figure whose name (only its aliases, for a matchOnlyAliases figure
 * such as "Tom") is the cat's name, as another lens may have found the post.
 */
function figureOf(candidate, watch) {
  const figures = Array.isArray(watch?.figures) ? watch.figures.filter(isObj) : [];
  const r = candidate?.reading, cat = lower(r?.catName), named = lower(candidate?.figure);
  const f = named ? figures.find((x) => lower(x.name) === named) : null;
  if (f && (r?.nameFrom === "figure" || (cat && [f.name, ...aliasesOf(f)].some((n) => lower(n) === cat)))) return f;
  if (!cat) return null;
  return figures.find((x) => (x.matchOnlyAliases === true ? aliasesOf(x) : [x.name, ...aliasesOf(x)]).some((n) => lower(n) === cat)) ?? null;
}

/**
 * The ties that apply to a data/trending-cats.json post (`candidate`), given data/cat-watch.json
 * as read (`watch`), in the order they are tried: [{ from: "figure" | "account", stock } or
 * { from, pumpQuote: { symbol, mint } }]. Malformed ties are left out.
 */
export function venueLinks(candidate, watch, { stocks = STOCK_PAIRS } = {}) {
  const links = [];
  const add = (from, link) => { if (!linkProblem(link, { stocks })) links.push({ from, ...link }); };
  const figure = figureOf(candidate, watch);
  if (figure && !(figure.stock !== undefined && figure.pumpQuote !== undefined)) {
    if (figure.stock !== undefined) add("figure", { stock: figure.stock });
    else if (figure.pumpQuote !== undefined) add("figure", { pumpQuote: figure.pumpQuote });
  }
  const handle = lower(candidate?.bigAccount);
  if (handle && isObj(watch?.accountLinks)) {
    const hit = Object.entries(watch.accountLinks).filter(([h]) => h.toLowerCase() === handle);
    if (hit.length === 1) add("account", hit[0][1]);
  }
  return links;
}

/**
 * The stock pairs (mints) that already have a sanctuary cat: every pair a planned cat is priced in
 * (data/planned.json; validatePlanned allows one planned cat per pair, and a row it would refuse
 * still holds its pair), every stock pair a proved launch is priced in (data/collection.json), and
 * every stock pair an adoptable cat names (data/adoptables.json). `extra` adds mints the caller
 * knows about (a launch sent but not yet proved). Returns a Set of mints.
 */
export function usedStockPairs({ planned, collection, adoptables, extra = [] } = {}, { stocks = STOCK_PAIRS } = {}) {
  const pairs = new Set(stocks.map((s) => s.mint));
  const used = new Set();
  const take = (rows) => { for (const r of Array.isArray(rows) ? rows : []) if (pairs.has(r?.pair?.mint)) used.add(r.pair.mint); };
  take(planned?.cats);
  take(collection?.cats);
  take(adoptables?.cats);
  for (const m of extra) if (pairs.has(m)) used.add(m);
  return used;
}

/**
 * The venue for a data/trending-cats.json post (`candidate`) under the owner's rule, with
 * data/cat-watch.json as read (`watch`). Options: `usedPairs` (usedStockPairs, a Set or a list of
 * mints; REQUIRED for a stock tie: without it no stock pair is used), `pumpQuotes`
 * (data/pump-quotes.json's validated list), `pumpQuoteOptIn` (the owner's explicit opt-in to the
 * unverified coin-priced pump.fun venue), `stocks` (STOCK_PAIRS). Returns
 *   { id: "stonkfun", pair: { symbol, mint }, from, reason: "stock" }
 *   { id: "pump-quote", quote: { symbol, mint }, tokenProgram, from, reason: "pump_quote" }
 *   { id: "pump-sol", reason }  reason: "default" (no tie), or why the first tie could not be used:
 *     "pair_taken", "pairs_unknown" (no usedPairs given), "quote_not_listed", "quote_unverified"
 * Never throws: anything malformed is no tie.
 */
export function chooseVenue(candidate, watch, options) {
  const { usedPairs, pumpQuotes = [], pumpQuoteOptIn = false, stocks = STOCK_PAIRS } = isObj(options) ? options : {};
  const used = usedPairs instanceof Set ? usedPairs : Array.isArray(usedPairs) ? new Set(usedPairs) : null; // null: unknown, fail closed
  const listed = Array.isArray(pumpQuotes) ? pumpQuotes : [];
  let why = null;
  for (const link of venueLinks(candidate, watch, { stocks })) {
    if (link.stock !== undefined) {
      const pair = stocks.find((s) => s.symbol === link.stock);
      if (used === null) { why ??= "pairs_unknown"; continue; }
      if (!used.has(pair.mint)) return { id: "stonkfun", pair: { symbol: pair.symbol, mint: pair.mint }, from: link.from, reason: "stock" };
      why ??= "pair_taken";
      continue;
    }
    const q = listed.find((x) => x?.mint === link.pumpQuote.mint);
    if (!q || quoteProblem(q)) { why ??= "quote_not_listed"; continue; }
    if (!PUMP_QUOTE_VERIFIED && pumpQuoteOptIn !== true) { why ??= "quote_unverified"; continue; }
    return { id: "pump-quote", quote: { symbol: q.symbol, mint: q.mint }, tokenProgram: q.tokenProgram, from: link.from, reason: "pump_quote" };
  }
  return { id: "pump-sol", reason: why ?? "default" };
}
