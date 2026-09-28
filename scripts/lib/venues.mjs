/**
 * WHERE THE LAUNCHER LAUNCHES A CAT: a small registry of venues, each one a builder the launcher's
 * core (scripts/lib/launcher.mjs) drives the same way, and chooseVenue(), which routes a trending cat
 * to one of them by the owner's rule (scripts/lib/venues-routing.mjs). The core never names a
 * launchpad itself: it asks the row's venue for everything that differs between launchpads (the
 * coin's text limits, the pairs it may be priced in, its metadata, the transaction, the signing, the
 * proof read back off the chain).
 *
 * A venue is { id, launchpad, label, announceAs, pair, pairProblem, textProblem, metadata, build, unsigned, sign, prove }:
 *   id           the key a ledger row (data/sanctuary-launches.json) keeps: "pump-sol", "stonkfun", "pump-quote";
 *   launchpad    what data/adoptables.json's `launch.launchpad` and data/collection.json's
 *                `launchpad` say ("pump.fun" | "stonkfun"; a StonkFun entry has none);
 *   label        the launchpad's name in logs; announceAs, its name in an X post ("PumpFun": the
 *                post rules refuse "pump.fun", see scripts/post-updates.mjs);
 *   pair         the { symbol, mint } every launch there is priced in (pump-sol: SOL), or null when the
 *                route gives it per cat (stonkfun: the cat's stock pair; pump-quote: the coin);
 *   pairProblem(pair)  why a cat priced in `pair` cannot launch there, or null;
 *   textProblem({ name, symbol, uri })  why the coin's name, symbol or metadata uri cannot be
 *                launched there, or null;
 *   metadata({ name, symbol, description, image, website, twitter, createdOn })  the metadata JSON
 *                the coin's uri serves (the launcher hosts it at coins/<postId>.json);
 *   build({ wallet, mint, name, symbol, uri, pair, recentBlockhash, computeUnitPriceMicroLamports }, ctx)
 *                (async; ctx = { fetchImpl, rpc, nowMs, quotes, pumpQuoteOptIn }) the unsigned launch;
 *   unsigned(built)  the same transaction with its signature slots zero-filled, base64, after the very
 *                checks sign makes: what the launcher simulates, so nothing signed leaves the runner
 *                before the send itself;
 *   sign(built, walletKeypair, mintKeypair)  the signed transaction, base64 (re-checked at sign time);
 *   prove(tx, { wallet, quotes })  the Collection's own proof of a getTransaction answer (scripts/lib/chain.mjs).
 *
 * The venues (none buys or sells anything: no dev buy, no trading):
 *   "pump-sol"    pump.fun's create_v2 priced in SOL (scripts/lib/pump.mjs), proved by chain.mjs
 *                 proveLaunchPump. The default, and the fallback of the other two.
 *   "stonkfun"    Raydium LaunchLab's initialize_with_token_2022 on StonkFun's standard platform, priced
 *                 in the cat's stock pair (scripts/lib/launchlab.mjs): StonkFun's pricing is fetched right
 *                 before the build (its raise follows the stock's price), its GlobalConfig is read back
 *                 over the RPC (checkPricingConfig), and the message is checked again at sign time
 *                 (pricing bounds, proveLaunch on the unsigned message). Proved by chain.mjs proveLaunch.
 *   "pump-quote"  pump.fun's create_v2 priced in a coin data/pump-quotes.json lists (pump.fun's Custom
 *                 Pairs, UNVERIFIED: pump.mjs PUMP_QUOTE_VERIFIED is false), built only while the owner
 *                 opts in (the repository variable LAUNCH_PUMP_QUOTE=on). Proved by proveLaunchPump
 *                 with that list.
 * All three serve the same metadata JSON (pump.fun's shape: StonkFun's LaunchLab reads the same name,
 * symbol, description, image, website and twitter, and ignores showName and createdOn), so a StonkFun
 * or coin-priced launch that falls back to pump.fun in SOL before it is sent keeps the file already
 * served at its uri (tests/launcher.test.mjs checks the three agree).
 */
import { SOL_PAIR, STOCK_PAIRS, pairProblem as stockPairProblem, isAddress, textProblem as plainTextProblem } from "../../assets/collection.js";
import { buildLaunchTransaction as buildPump, signLaunchTransaction as signPump, unsignedLaunchTransaction as unsignedPump, launchTextProblem } from "./pump.mjs";
import { fetchPricing, checkPricingConfig, buildLaunchTransaction as buildLaunchLab, signLaunchTransaction as signLaunchLab, unsignedLaunchTransaction as unsignedLaunchLab, LAUNCHLAB_LIMITS } from "./launchlab.mjs";
import { proveLaunch, proveLaunchPump } from "./chain.mjs";
import { chooseVenue as route, usedStockPairs } from "./venues-routing.mjs";

const VENUES = new Map();
const VENUE_ID = /^[a-z][a-z0-9-]{1,31}$/;
const FUNCTIONS = ["pairProblem", "textProblem", "metadata", "build", "unsigned", "sign", "prove"];

/** Add a venue to the registry (an id is registered once). Returns the frozen venue. */
export function registerVenue(venue) {
  if (!venue || !VENUE_ID.test(venue.id ?? "")) throw new TypeError("a venue needs an id: lower-case letters, digits and dashes");
  if (VENUES.has(venue.id)) throw new Error(`the venue ${venue.id} is registered already`);
  if (!["pump.fun", "stonkfun"].includes(venue.launchpad)) throw new TypeError(`${venue.id}: launchpad is pump.fun or stonkfun`);
  if (typeof venue.label !== "string" || typeof venue.announceAs !== "string") throw new TypeError(`${venue.id}: label and announceAs are text`);
  if (venue.pair !== null && (!venue.pair || typeof venue.pair.symbol !== "string" || typeof venue.pair.mint !== "string")) throw new TypeError(`${venue.id}: pair is { symbol, mint } or null`);
  for (const f of FUNCTIONS) if (typeof venue[f] !== "function") throw new TypeError(`${venue.id}: ${f} must be a function`);
  const frozen = Object.freeze({ ...venue, pair: venue.pair && Object.freeze({ ...venue.pair }) });
  VENUES.set(frozen.id, frozen);
  return frozen;
}

/** The venue registered under `id`, or null. */
export const venueById = (id) => VENUES.get(id) ?? null;
/** Every registered venue's id, in registration order. */
export const venueIds = () => [...VENUES.keys()];

/** The coin's metadata JSON, the same for every venue (see the header): pump.fun's shape, with the site and X links. */
const metadata = ({ name, symbol, description, image, website, twitter, createdOn }) =>
  ({ name, symbol, description, image, showName: true, createdOn, website, twitter });
const priceText = (computeUnitPriceMicroLamports) => (computeUnitPriceMicroLamports !== undefined ? { computeUnitPriceMicroLamports } : {});

/** pump.fun's create_v2, priced in SOL. */
export const PUMP_SOL = registerVenue({
  id: "pump-sol",
  launchpad: "pump.fun",
  label: "pump.fun",
  announceAs: "PumpFun",
  pair: SOL_PAIR,
  pairProblem: (pair) => (pair?.mint === SOL_PAIR.mint && pair?.symbol === SOL_PAIR.symbol && Object.keys(pair).length === 2 ? null : "a pump.fun launch in SOL is priced in SOL"),
  textProblem: ({ name, symbol, uri }) => launchTextProblem({ name, symbol, uri }),
  metadata,
  build: async ({ wallet, mint, name, symbol, uri, recentBlockhash, computeUnitPriceMicroLamports }) =>
    buildPump({ wallet, mint, name, symbol, uri, recentBlockhash, ...priceText(computeUnitPriceMicroLamports) }),
  unsigned: (built) => unsignedPump(built),
  sign: (built, walletKeypair, mintKeypair) => signPump(built, walletKeypair, mintKeypair),
  prove: (tx, { wallet }) => proveLaunchPump(tx, { wallet }),
});

/** StonkFun (Raydium LaunchLab on StonkFun's standard platform), priced in the cat's stock pair. */
export const STONKFUN = registerVenue({
  id: "stonkfun",
  launchpad: "stonkfun",
  label: "StonkFun",
  announceAs: "StonkFun",
  pair: null,
  pairProblem: (pair) => stockPairProblem(pair),
  textProblem: ({ name, symbol, uri }) => launchTextProblem({ name, symbol, uri }, LAUNCHLAB_LIMITS),
  metadata,
  build: async ({ wallet, mint, name, symbol, uri, pair, recentBlockhash, computeUnitPriceMicroLamports }, { fetchImpl, rpc, nowMs } = {}) => {
    // The raise follows the stock's price: fetched now, right before the build, and bounded (launchlab.mjs pricingFromAnswer).
    const pricing = await fetchPricing(pair.mint, fetchImpl, { nowMs });
    // The GlobalConfig StonkFun names, read back: LaunchLab's, for this very stock, the constant curve.
    const [config] = (await rpc.getMultipleAccounts([pricing.configId])) ?? [null];
    const c = checkPricingConfig(pricing, config);
    if (!c.ok) throw new Error(`StonkFun's config for ${pair.symbol}: ${c.detail}`);
    return buildLaunchLab({ wallet, mint, pair, name, symbol, uri, pricing, recentBlockhash, ...priceText(computeUnitPriceMicroLamports) });
  },
  unsigned: (built) => unsignedLaunchLab(built),
  sign: (built, walletKeypair, mintKeypair) => signLaunchLab(built, walletKeypair, mintKeypair),
  prove: (tx, { wallet }) => proveLaunch(tx, { wallet }),
});

/** pump.fun's create_v2 priced in a listed coin (unverified: only with the owner's opt-in). */
export const PUMP_QUOTE = registerVenue({
  id: "pump-quote",
  launchpad: "pump.fun",
  label: "pump.fun (priced in a coin)",
  announceAs: "PumpFun",
  pair: null,
  pairProblem: (pair) => (!pair || typeof pair !== "object" || Object.keys(pair).some((k) => !["symbol", "mint"].includes(k)) || !isAddress(pair.mint) || plainTextProblem(pair.symbol, { maxBytes: 16 })
    ? "a coin-priced pump.fun launch is priced in { symbol, mint }"
    : pair.mint === SOL_PAIR.mint || STOCK_PAIRS.some((s) => s.mint === pair.mint) ? "a coin-priced pump.fun launch is priced in neither SOL nor a stock pair" : null),
  textProblem: ({ name, symbol, uri }) => launchTextProblem({ name, symbol, uri }),
  metadata,
  build: async ({ wallet, mint, name, symbol, uri, pair, recentBlockhash, computeUnitPriceMicroLamports }, { quotes = [], pumpQuoteOptIn = false } = {}) => {
    if (pumpQuoteOptIn !== true) throw new Error("the owner has not opted in to coin-priced pump.fun launches (LAUNCH_PUMP_QUOTE)");
    const listed = (Array.isArray(quotes) ? quotes : []).find((q) => q?.mint === pair.mint);
    if (!listed || listed.symbol !== pair.symbol) throw new Error(`${pair.symbol} is not a coin data/pump-quotes.json lists under that symbol`);
    return buildPump({ wallet, mint, name, symbol, uri, recentBlockhash, quote: { mint: pair.mint }, quotes, ...priceText(computeUnitPriceMicroLamports) });
  },
  unsigned: (built) => unsignedPump(built),
  sign: (built, walletKeypair, mintKeypair) => signPump(built, walletKeypair, mintKeypair),
  prove: (tx, { wallet, quotes = [] }) => {
    const p = proveLaunchPump(tx, { wallet, quotes });
    return p.ok && p.launch.pair.mint === SOL_PAIR.mint ? { ok: false, clause: "pump_not_quote", detail: "priced in SOL, not in a coin" } : p;
  },
});

/**
 * The stock pairs a new launch may not take (one cat per pair): every pair a planned cat, a
 * Collection entry or an adoptable names (venues-routing.mjs usedStockPairs, over the files as the
 * site reads them: data/planned.json, data/collection.json, data/adoptables.json), plus `extra`:
 * the pairs of the launcher's own launches that are not in data/adoptables.json yet (prepared,
 * sent, or launched and not recorded or not proved). A Set of mints.
 */
export const takenPairs = ({ planned, collection, adoptables, extra = [] } = {}) => usedStockPairs({ planned, collection, adoptables, extra });

/**
 * The route for a trending cat: `candidate` is its data/trending-cats.json post, `watch` data/cat-watch.json
 * as read (its figures' and accounts' ties). `options`: { planned, collection, adoptables, extraPairs }
 * (the used pairs, takenPairs), `pumpQuotes` (data/pump-quotes.json's validated list) and
 * `pumpQuoteOptIn` (LAUNCH_PUMP_QUOTE is "on"). Returns { venue, pair, reason, from? }: `venue` a
 * registered venue, `pair` the { symbol, mint } the cat is priced in there, `reason` the rule's
 * ("stock", "pump_quote", or for pump.fun in SOL "default", "pair_taken", "pairs_unknown",
 * "quote_not_listed", "quote_unverified").
 */
export function chooseVenue(candidate, watch, { planned, collection, adoptables, extraPairs = [], pumpQuotes = [], pumpQuoteOptIn = false } = {}) {
  // A file that could not be read leaves the pairs in use unknown: no stock pair is used then (the rule fails closed).
  const known = [planned, collection, adoptables].every((f) => Array.isArray(f?.cats));
  const usedPairs = known ? takenPairs({ planned, collection, adoptables, extra: extraPairs }) : undefined;
  const r = route(candidate, watch, { usedPairs, pumpQuotes, pumpQuoteOptIn });
  if (r.id === "stonkfun") return { venue: STONKFUN, pair: { ...r.pair }, reason: r.reason, from: r.from };
  if (r.id === "pump-quote") return { venue: PUMP_QUOTE, pair: { symbol: r.quote.symbol, mint: r.quote.mint }, reason: r.reason, from: r.from };
  return { venue: PUMP_SOL, pair: { ...SOL_PAIR }, reason: r.reason };
}
