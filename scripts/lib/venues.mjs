/**
 * WHERE THE LAUNCHER LAUNCHES A CAT: a small registry of venues, each one a builder the launcher's
 * core (scripts/lib/launcher.mjs) drives the same way, and chooseVenue(), which picks one for a
 * trending cat. The core never names a launchpad itself: it asks the row's venue for everything
 * that differs between launchpads (the coin's text limits, its metadata's shape, the transaction,
 * the signing, the proof read back off the chain, the pair the sanctuary shows it priced in).
 *
 * A venue is { id, launchpad, label, announceAs, pair, textProblem, metadata, build, sign, prove }:
 *   id           the key a ledger row (data/sanctuary-launches.json) keeps, e.g. "pump-sol";
 *   launchpad    what data/adoptables.json's `launch.launchpad` and data/collection.json's
 *                `launchpad` say ("pump.fun" | "stonkfun");
 *   label        the launchpad's name in logs; announceAs, its name in an X post ("PumpFun": the
 *                post rules refuse "pump.fun", see scripts/post-updates.mjs);
 *   pair         { symbol, mint } the coin is priced in, as the adoptable card shows it;
 *   textProblem({ name, symbol, uri })  why the coin's name, symbol or metadata uri cannot be
 *                launched there, or null;
 *   metadata({ name, symbol, description, image, website, twitter, createdOn })  the metadata JSON
 *                the coin's uri serves (the launcher hosts it at coins/<postId>.json);
 *   build({ wallet, mint, name, symbol, uri, recentBlockhash, computeUnitPriceMicroLamports }, ctx)
 *                (async; ctx = { fetchImpl, rpc }) the unsigned launch, as the venue's builder returns it;
 *   sign(built, walletKeypair, mintKeypair)  the signed transaction, base64 (re-checked at sign time);
 *   prove(tx, { wallet })  the Collection's own proof of a getTransaction answer (scripts/lib/chain.mjs).
 *
 * Today there is one venue, "pump-sol": pump.fun's create_v2 priced in SOL, no dev buy
 * (scripts/lib/pump.mjs), proved by chain.mjs proveLaunchPump. Another stage adds "stonkfun" (a cat
 * tied to a company's stock) and "pump-quote" (pump.fun priced in a coin) by registering them here
 * and routing to them in chooseVenue; the launcher's core does not change.
 */
import { SOL_PAIR } from "../../assets/collection.js";
import { buildLaunchTransaction, signLaunchTransaction, launchTextProblem } from "./pump.mjs";
import { proveLaunchPump } from "./chain.mjs";

const VENUES = new Map();
const VENUE_ID = /^[a-z][a-z0-9-]{1,31}$/;
const FUNCTIONS = ["textProblem", "metadata", "build", "sign", "prove"];

/** Add a venue to the registry (an id is registered once). Returns the frozen venue. */
export function registerVenue(venue) {
  if (!venue || !VENUE_ID.test(venue.id ?? "")) throw new TypeError("a venue needs an id: lower-case letters, digits and dashes");
  if (VENUES.has(venue.id)) throw new Error(`the venue ${venue.id} is registered already`);
  if (!["pump.fun", "stonkfun"].includes(venue.launchpad)) throw new TypeError(`${venue.id}: launchpad is pump.fun or stonkfun`);
  if (typeof venue.label !== "string" || typeof venue.announceAs !== "string") throw new TypeError(`${venue.id}: label and announceAs are text`);
  if (!venue.pair || typeof venue.pair.symbol !== "string" || typeof venue.pair.mint !== "string") throw new TypeError(`${venue.id}: pair is { symbol, mint }`);
  for (const f of FUNCTIONS) if (typeof venue[f] !== "function") throw new TypeError(`${venue.id}: ${f} must be a function`);
  const frozen = Object.freeze({ ...venue, pair: Object.freeze({ ...venue.pair }) });
  VENUES.set(frozen.id, frozen);
  return frozen;
}

/** The venue registered under `id`, or null. */
export const venueById = (id) => VENUES.get(id) ?? null;
/** Every registered venue's id, in registration order. */
export const venueIds = () => [...VENUES.keys()];

/** pump.fun's create_v2, priced in SOL: the metadata shape pump.fun itself writes, plus the site and X links. */
export const PUMP_SOL = registerVenue({
  id: "pump-sol",
  launchpad: "pump.fun",
  label: "pump.fun",
  announceAs: "PumpFun",
  pair: SOL_PAIR,
  textProblem: ({ name, symbol, uri }) => launchTextProblem({ name, symbol, uri }),
  metadata: ({ name, symbol, description, image, website, twitter, createdOn }) =>
    ({ name, symbol, description, image, showName: true, createdOn, website, twitter }),
  build: async ({ wallet, mint, name, symbol, uri, recentBlockhash, computeUnitPriceMicroLamports }) =>
    buildLaunchTransaction({ wallet, mint, name, symbol, uri, recentBlockhash, ...(computeUnitPriceMicroLamports !== undefined ? { computeUnitPriceMicroLamports } : {}) }),
  sign: (built, walletKeypair, mintKeypair) => signLaunchTransaction(built, walletKeypair, mintKeypair),
  prove: (tx, { wallet }) => proveLaunchPump(tx, { wallet }),
});

/**
 * The venue for a trending cat: `candidate` is its data/trending-cats.json post, `watch` its
 * data/cat-watch.json figure (or null). Every cat goes to pump.fun priced in SOL for now; the
 * StonkFun and coin-priced routes are added here by the stage that builds them.
 */
export function chooseVenue(candidate, watch = null) {
  return PUMP_SOL;
}
