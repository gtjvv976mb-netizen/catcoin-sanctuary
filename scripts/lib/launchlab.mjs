/**
 * A STONKFUN LAUNCH, BUILT AND SIGNED OFFLINE: Raydium LaunchLab's initialize_with_token_2022 on
 * StonkFun's standard platform, priced in one of the sanctuary's stock pairs (assets/collection.js
 * STOCK_PAIRS): exactly the launch scripts/lib/chain.mjs proveLaunch records, and nothing else: no
 * dev buy, no token account, no transfer. Stage 4 of the launcher. No dependencies (node:crypto,
 * through solana-tx.mjs); the only network call is fetchPricing, through the fetch it is given.
 *
 * THE NUMBERS come from StonkFun's public API (no key; https://www.stonkfun.xyz/developers, read
 * 2026-09-27 and 2026-09-28): GET /api/public/v1/launchlab/pricing?quoteMint=<mint> (fetchPricing)
 * answers with the GlobalConfig for that quote (curve.configId), the raise sized in the quote's own
 * decimals (raise.raw: it follows the quote's price, so it is fetched right before each launch),
 * the supply and the part sold on the curve, the curve's migration (cpmm) and creator-fee setting,
 * and the platform and curve-rule ids. StonkFun adopts (lists, forwards fees for) only a pool built
 * to exactly that shape. Every field is checked (pricingFromAnswer), and the program, the platforms
 * and the curve rules must be chain.mjs's pinned ids and PDAs, or the answer is refused. The
 * numbers are bounded too, so a buggy or tampered answer cannot launch an absurd curve: the supply
 * and the sale must be StonkFun's standard ones (STANDARD_SUPPLY, STANDARD_SALE: both real answers
 * and all six recorded launches), and the raise must be worth 85 SOL (STANDARD_RAISE_SOL, the
 * answer's own raise.basis) at the answer's own SOL and quote prices, within RAISE_TOLERANCE (in
 * both real answers it is within 1e-11 of 85 × solUsd / quoteUsd × 10^decimals). The config
 * itself can be read back before a launch (checkPricingConfig: LaunchLab's GlobalConfig for that
 * very quote). tests/fixtures/stonkfun-pricing.json keeps two real answers.
 *
 * THE INSTRUCTION (buildInitializeWithToken2022) is chain.mjs decodeInitialize read backwards:
 *   data  sha256("global:initialize_with_token_2022")[0..8]; MintParams { decimals 6, name, symbol,
 *         uri }; CurveParams::Constant { supply, total_base_sell, total_quote_fund_raising (the
 *         raise), migrate_type 1 (cpmm) }; VestingParams { 0, 0, 0 }; amm_fee_on (the pricing's
 *         cpmmCreatorFeeOn); Option<TransferFeeExtensionParams> None, written as StonkFun's own
 *         site writes it: the tag 0, then ten zero bytes (five of the six recorded launches, and
 *         all four the Collection accepts).
 *   the sixteen accounts, in chain.mjs's order:
 *          0 payer = the wallet (writable signer)  1 creator = the wallet
 *          2 global config (the pricing's)  3 StonkFun's standard platform  4 LaunchLab's authority
 *          5 pool = PDA["pool", mint, quote] (w)  6 the new mint (writable signer)  7 the stock pair
 *          8 base vault = PDA["pool_vault", pool, mint] (w)  9 quote vault = PDA["pool_vault", pool, quote] (w)
 *          10 Token-2022 (the base)  11 Token-2022 (every stock pair's program)  12 system program
 *          13 event authority  14 LaunchLab  15 StonkFun's curve rule = PDA["platform_curve_rule", platform, config]
 *   The creator is the payer, one account, whose meta is the payer's: every recorded launch has it
 *   so, so what LaunchLab asks of a creator that is not the payer cannot be read off them, and this
 *   module never builds one.
 * tests/launchlab.test.mjs rebuilds all six recorded StonkFun launches' instructions from their
 * decoded inputs byte for byte (data, keys and flags), and one whole recorded launch message, whose
 * real signatures then verify over the rebuilt bytes.
 *
 * THE TRANSACTION (buildLaunchTransaction): legacy; SetComputeUnitLimit, SetComputeUnitPrice and
 * the initialize. It is checked from its bytes when built and again when signed (checkLaunchMessage:
 * signers exactly [wallet, mint], nothing but the compute budget and this initialize, pump.mjs's
 * priority-fee guard, and chain.mjs proveLaunch itself run on the unsigned message).
 */
import { base58Encode, isAddress, pairProblem, textProblem } from "../../assets/collection.js";
import { SYSTEM_PROGRAM, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, COMPUTE_BUDGET_PROGRAM } from "./programs.mjs";
import {
  LAUNCHLAB_PROGRAM, LAUNCHLAB_AUTHORITY, LAUNCHLAB_EVENT_AUTHORITY, STONKFUN_PLATFORM, STONKFUN_PLATFORM_REWARD, IX,
  poolAddress, vaultAddress, curveRuleAddress, decodeInitialize, proveLaunch, readGlobalConfigQuote,
} from "./chain.mjs";
import {
  compileLegacyMessage, decodeLegacyMessage, decompileInstructions, setComputeUnitLimit, setComputeUnitPrice, signTransaction,
  serializeTransaction, priorityFeeLamports, MAX_COMPUTE_UNIT_LIMIT, DEFAULT_INSTRUCTION_COMPUTE_UNIT_LIMIT, PACKET_DATA_SIZE,
} from "./solana-tx.mjs";
import { MAX_PRIORITY_FEE_LAMPORTS, launchTextProblem } from "./pump.mjs";

export { MAX_PRIORITY_FEE_LAMPORTS };

/** StonkFun's pricing endpoint (its public API, no key). */
export const PRICING_URL = "https://www.stonkfun.xyz/api/public/v1/launchlab/pricing";
/** A pricing answer older than this is refused: the raise follows the quote's price. */
export const PRICING_MAX_AGE_MS = 10 * 60_000;
/** The most characters of an answer read (a real one is about 2,100). */
const MAX_ANSWER_CHARS = 64 * 1024;

/**
 * The name, symbol and uri limits, in UTF-8 bytes. LaunchLab's own limits were not read: these
 * are pump.fun's name and uri limits and the sanctuary's longest ticker (/^[A-Z0-9]{2,10}$/), all
 * within what the Collection shows (64 and 16 bytes) and what every recorded launch used.
 */
export const LAUNCHLAB_LIMITS = Object.freeze({ name: 32, symbol: 10, uri: 200 });
/** The base mint's decimals: every LaunchLab launch has 6, and StonkFun adopts no other. */
export const BASE_DECIMALS = 6;
/** migrate_type 1: the curve graduates to Raydium CPMM ("cpmm"), the only one StonkFun adopts. */
export const MIGRATE_CPMM = 1;
/** StonkFun's standard supply and the part sold on the curve, raw (6 decimals: 1,000,000,000 and 793,100,000 coins):
    both real pricing answers and all six recorded launches have exactly these. Any other is refused. */
export const STANDARD_SUPPLY = 1_000_000_000_000_000n;
export const STANDARD_SALE = 793_100_000_000_000n;
/** The raise is sized to be worth this many SOL ("Sized so this launch is worth the same as the default 85 SOL raise.", raise.basis). */
export const STANDARD_RAISE_SOL = 85;
/** How far a raise may be from STANDARD_RAISE_SOL at the answer's own prices (the real answers: within 1e-11). */
export const RAISE_TOLERANCE = 0.02;
/** The launch's defaults: the initialize alone used 91,866 compute units in the recorded IREN launch (5egBA4T2). */
export const LAUNCH_DEFAULTS = Object.freeze({ computeUnitLimit: 200_000, computeUnitPriceMicroLamports: 100_000 });

const U64_MAX = 2n ** 64n - 1n;
/** What follows the None tag of Option<TransferFeeExtensionParams> in StonkFun's own launches: ten zero bytes. */
const NONE_TAIL = new Uint8Array(10);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isPrice = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;

/** Why a raise is not worth STANDARD_RAISE_SOL (within RAISE_TOLERANCE) at `solUsd` and `quoteUsd` for a quote of `decimals`, or null. */
function raiseProblem(raise, { solUsd, quoteUsd } = {}, decimals) {
  if (!isPrice(solUsd) || !isPrice(quoteUsd)) return "the prices of SOL and of the quote are not positive numbers";
  const expected = (STANDARD_RAISE_SOL * solUsd / quoteUsd) * 10 ** decimals;
  const ratio = Number(raise) / expected;
  if (!(Number.isFinite(expected) && expected > 0 && Math.abs(ratio - 1) <= RAISE_TOLERANCE)) {
    return `the raise is not worth ${STANDARD_RAISE_SOL} SOL at the answer's own prices (${Number.isFinite(ratio) ? `${ratio.toFixed(4)} times that` : "unreadable"})`;
  }
  return null;
}

export class PricingError extends Error { constructor(message) { super(message); this.name = "PricingError"; } }

/** A raw amount (a decimal string or a safe integer) as a BigInt in 0..2^64-1, or undefined. */
function rawAmount(v) {
  if (typeof v === "string" ? !/^(0|[1-9][0-9]{0,19})$/.test(v) : !(Number.isSafeInteger(v) && v >= 0)) return undefined;
  const n = BigInt(v);
  return n <= U64_MAX ? n : undefined;
}

/* ── the pricing ──────────────────────────────────────────────────────────────────────── */

/**
 * StonkFun's pricing answer (the parsed JSON body) for `quoteMint`, checked field by field and
 * reduced to what a launch needs: a frozen { quote: { mint, symbol, decimals, tokenProgram },
 * configId, curveRule (the standard platform's), supply, totalSellA, raise (BigInts), baseDecimals,
 * migrateType (1), cpmmCreatorFeeOn (0 or 1), prices: { solUsd, quoteUsd }, observedAt }. Refused
 * (PricingError): another quote; a quote that is not a Token-2022 mint; another program than
 * LaunchLab; a platform or a curve rule that is not the pinned one (or its PDA for that config); a
 * curve that is not the constant one, that does not migrate to cpmm, or whose base does not have 6
 * decimals; a supply, sale or raise that is not a whole u64 (0 < sale < supply, raise > 0 and not
 * below its own minimum); a supply or sale that is not StonkFun's standard one; a raise not worth
 * 85 SOL (within 2%) at the answer's own prices, or prices that are not positive numbers; any
 * vesting; a standard mode with a transfer fee; prices observed more than `maxAgeMs` before `nowMs`
 * or in its future.
 */
export function pricingFromAnswer(body, quoteMint, { nowMs = Date.now(), maxAgeMs = PRICING_MAX_AGE_MS } = {}) {
  const bad = (why) => { throw new PricingError(`StonkFun's pricing for ${String(quoteMint).slice(0, 8)}…: ${why}`); };
  if (!isAddress(quoteMint)) throw new TypeError("the quote mint is not a base58 address");
  const d = isObj(body) ? body.data : undefined;
  if (!isObj(d)) bad("the answer has no data");
  const { quote: q, raise: r, curve: c, platform: p, curveRule: rule, modes: m, prices } = d;
  if (![q, r, c, p, rule, m, prices].every(isObj)) bad("a part of the answer is missing");
  if (q.mint !== quoteMint) bad("the answer is for another quote");
  if (q.tokenProgram !== TOKEN_2022_PROGRAM) bad("the quote is not a Token-2022 mint (every stock pair is)");
  if (!Number.isInteger(q.decimals) || q.decimals < 0 || q.decimals > 18) bad("the quote's decimals are not 0 to 18");
  if (textProblem(q.symbol, { maxBytes: 16 })) bad("the quote's symbol is not plain text");
  if (c.programId !== LAUNCHLAB_PROGRAM) bad("the program is not Raydium LaunchLab's pinned one");
  if (!isAddress(c.configId)) bad("the config is not an address");
  if (c.curveType !== "ConstantCurve") bad("the curve is not the constant-product one");
  if (c.migrateType !== "cpmm") bad("the curve does not migrate to cpmm");
  if (c.baseDecimals !== BASE_DECIMALS) bad(`the coin would not have ${BASE_DECIMALS} decimals`);
  const supply = rawAmount(c.supply), totalSellA = rawAmount(c.totalSellA), raise = rawAmount(r.raw);
  if (supply === undefined || totalSellA === undefined || raise === undefined) bad("the supply, the sale or the raise is not a whole u64");
  if (!(totalSellA > 0n && totalSellA < supply)) bad("the sale must be above 0 and below the supply");
  if (raise <= 0n) bad("the raise must be above 0");
  if (r.minimumRaw !== undefined && !(rawAmount(r.minimumRaw) <= raise)) bad("the raise is below its own minimum");
  if (supply !== STANDARD_SUPPLY || totalSellA !== STANDARD_SALE) bad("the supply or the sale is not StonkFun's standard one (1,000,000,000 coins, 793,100,000 on the curve)");
  const raiseBad = raiseProblem(raise, prices, q.decimals);
  if (raiseBad) bad(raiseBad);
  const v = c.vesting;
  if (!isObj(v) || ["totalLockedAmount", "cliffPeriod", "unlockPeriod"].some((k) => rawAmount(v[k]) !== 0n)) bad("a launch here vests nothing");
  if (c.cpmmCreatorFeeOn !== 0 && c.cpmmCreatorFeeOn !== 1) bad("cpmmCreatorFeeOn is not 0 or 1");
  if (p.standard !== STONKFUN_PLATFORM || p.reward !== STONKFUN_PLATFORM_REWARD) bad("the platforms are not StonkFun's pinned ones");
  if (rule.standard !== curveRuleAddress(STONKFUN_PLATFORM, c.configId) || rule.reward !== curveRuleAddress(STONKFUN_PLATFORM_REWARD, c.configId)) {
    bad("the curve rules are not PDA[\"platform_curve_rule\", platform, config]");
  }
  if (!isObj(m.standard) || m.standard.transferFee !== null) bad("the standard mode carries a transfer fee");
  const observed = typeof prices.observedAt === "string" ? Date.parse(prices.observedAt) : NaN;
  if (!Number.isFinite(observed)) bad("the prices have no observedAt time");
  if (observed > nowMs + 5 * 60_000) bad("the prices are dated in the future");
  if (nowMs - observed > maxAgeMs) bad(`the prices are ${Math.round((nowMs - observed) / 60_000)} minutes old; fetch them again`);
  return Object.freeze({
    quote: Object.freeze({ mint: q.mint, symbol: q.symbol, decimals: q.decimals, tokenProgram: q.tokenProgram }),
    configId: c.configId, curveRule: rule.standard, supply, totalSellA, raise, baseDecimals: BASE_DECIMALS, migrateType: MIGRATE_CPMM,
    cpmmCreatorFeeOn: c.cpmmCreatorFeeOn, prices: Object.freeze({ solUsd: prices.solUsd, quoteUsd: prices.quoteUsd }), observedAt: prices.observedAt,
  });
}

/**
 * GET StonkFun's pricing for `quoteMint` (a stock pair's mint) through `fetchImpl` and check it
 * (pricingFromAnswer; `nowMs` and `maxAgeMs` go to it). Throws PricingError when StonkFun cannot be
 * reached, answers with an error status, a body over 64 KB or anything that is not JSON, or an
 * answer pricingFromAnswer refuses; TypeError for a quote that is not an address (nothing fetched).
 */
export async function fetchPricing(quoteMint, fetchImpl = globalThis.fetch, { nowMs, maxAgeMs, timeoutMs = 20_000 } = {}) {
  if (!isAddress(quoteMint)) throw new TypeError("the quote mint is not a base58 address");
  if (typeof fetchImpl !== "function") throw new TypeError("fetchPricing needs a fetch function");
  let res, text;
  try {
    res = await fetchImpl(`${PRICING_URL}?quoteMint=${quoteMint}`, { method: "GET", headers: { accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
    text = await res.text();
  } catch (e) {
    throw new PricingError(`StonkFun could not be reached (${e?.name === "TimeoutError" ? "timed out" : "network error"})`);
  }
  if (typeof text !== "string" || text.length > MAX_ANSWER_CHARS) throw new PricingError("StonkFun's answer is not a short text");
  let body;
  try { body = JSON.parse(text); } catch { body = undefined; }
  if (!res.ok) {
    const code = isObj(body?.error) && /^[a-z_]{2,40}$/.test(body.error.code ?? "") ? `: ${body.error.code}` : "";
    throw new PricingError(`StonkFun answered HTTP ${res.status}${code}`);
  }
  if (body === undefined) throw new PricingError("StonkFun's answer is not JSON");
  return pricingFromAnswer(body, quoteMint, { nowMs, maxAgeMs });
}

/**
 * Whether `configAccount` (a getMultipleAccounts answer, base64, for pricing.configId) is
 * LaunchLab's GlobalConfig for the pricing's quote, with the constant curve: { ok: true } or
 * { ok: false, detail }. The Collection makes the same check after a launch (checkLaunchAccounts);
 * made before, a config StonkFun's answer got wrong costs nothing.
 */
export function checkPricingConfig(pricing, configAccount) {
  const no = (detail) => ({ ok: false, detail });
  if (!isObj(configAccount) || configAccount.owner !== LAUNCHLAB_PROGRAM || !Array.isArray(configAccount.data)) return no("the config is not a LaunchLab account on chain");
  let config;
  try { config = readGlobalConfigQuote(Buffer.from(configAccount.data[0], "base64")); } catch (e) { return no(e.message); }
  if (config.quoteMint !== pricing?.quote?.mint) return no("the config is for another quote");
  if (config.curveType !== 0) return no("the config is not for the constant-product curve");
  return { ok: true };
}

/** Why `pricing` is not one pricingFromAnswer would return (re-checked wherever it is used), or null. */
function pricingProblem(p) {
  if (!isObj(p) || !isObj(p.quote) || !isAddress(p.quote.mint) || p.quote.tokenProgram !== TOKEN_2022_PROGRAM) return "the pricing's quote";
  if (!Number.isInteger(p.quote.decimals) || p.quote.decimals < 0 || p.quote.decimals > 18) return "the pricing's quote";
  if (!isAddress(p.configId) || p.curveRule !== curveRuleAddress(STONKFUN_PLATFORM, p.configId)) return "the pricing's config or curve rule";
  const big = (n) => typeof n === "bigint" && n >= 0n && n <= U64_MAX;
  if (![p.supply, p.totalSellA, p.raise].every(big) || p.supply !== STANDARD_SUPPLY || p.totalSellA !== STANDARD_SALE || p.raise <= 0n) return "the pricing's supply, sale or raise";
  if (!isObj(p.prices) || raiseProblem(p.raise, p.prices, p.quote.decimals)) return "the pricing's raise for its prices";
  if (p.baseDecimals !== BASE_DECIMALS || p.migrateType !== MIGRATE_CPMM || ![0, 1].includes(p.cpmmCreatorFeeOn)) return "the pricing's curve";
  return null;
}

/* ── the instruction ──────────────────────────────────────────────────────────────────── */

const u8 = (n, what) => {
  if (!Number.isInteger(n) || n < 0 || n > 255) throw new RangeError(`${what} is not a byte`);
  return Buffer.from([n]);
};
const u64 = (n, what) => {
  const v = typeof n === "bigint" ? n : Number.isSafeInteger(n) ? BigInt(n) : -1n;
  if (v < 0n || v > U64_MAX) throw new RangeError(`${what} is not a u64`);
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(v);
  return b;
};
const str = (s, what) => {
  if (typeof s !== "string") throw new TypeError(`${what} is not text`);
  const b = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(b.length);
  return Buffer.concat([len, b]);
};

/**
 * initialize_with_token_2022's data, the inverse of chain.mjs decodeInitialize: { decimals, name,
 * symbol, uri, supply, totalBaseSell, raise, migrateType, vesting: [3 × u64], ammFeeOn } with the
 * constant curve and no transfer fee, the None tag followed by `noneTail` (ten zero bytes, as
 * StonkFun's site sends it, by default; a recorded launch's own ten bytes, or none, to rebuild it).
 */
export function encodeInitializeData({ decimals = BASE_DECIMALS, name, symbol, uri, supply, totalBaseSell, raise, migrateType = MIGRATE_CPMM, vesting = [0n, 0n, 0n], ammFeeOn = 0, noneTail = NONE_TAIL } = {}) {
  if (migrateType !== 0 && migrateType !== 1) throw new RangeError("migrateType is 0 (amm) or 1 (cpmm)");
  if (ammFeeOn !== 0 && ammFeeOn !== 1) throw new RangeError("ammFeeOn is 0 or 1");
  if (!Array.isArray(vesting) || vesting.length !== 3) throw new TypeError("vesting is three u64s");
  if (!(noneTail instanceof Uint8Array) || (noneTail.length !== 0 && noneTail.length !== 10)) throw new TypeError("what follows the None tag is nothing or ten bytes");
  return new Uint8Array(Buffer.concat([
    Buffer.from(IX.initializeWithToken2022, "hex"),
    u8(decimals, "decimals"), str(name, "the name"), str(symbol, "the symbol"), str(uri, "the uri"),
    u8(0, "the curve"), u64(supply, "the supply"), u64(totalBaseSell, "the sale"), u64(raise, "the raise"), u8(migrateType, "migrateType"),
    ...vesting.map((x, i) => u64(x, `vesting ${i}`)),
    u8(ammFeeOn, "ammFeeOn"),
    u8(0, "the transfer-fee option"), Buffer.from(noneTail),
  ]));
}

const address = (value, what) => {
  const a = typeof value === "string" ? value : value?.publicKey; // an address, or a keypair
  if (!isAddress(a)) throw new TypeError(`${what} is not a base58 address`);
  return a;
};

/**
 * The sixteen account metas of initialize_with_token_2022 (see the header) for a new `mint` paid
 * and created by `payer`, priced in `quote` under `quoteTokenProgram`, with `globalConfig` on
 * `platform`: every PDA derived here, as chain.mjs proveLaunch re-derives it.
 */
export function initializeAccounts({ payer, globalConfig, platform = STONKFUN_PLATFORM, mint, quote, quoteTokenProgram = TOKEN_2022_PROGRAM } = {}) {
  const pool = poolAddress(mint, quote);
  const m = (pubkey, isWritable = false, isSigner = false) => ({ pubkey, isSigner, isWritable });
  return [
    m(payer, true, true), m(payer, true, true), m(globalConfig), m(platform), m(LAUNCHLAB_AUTHORITY), m(pool, true), m(mint, true, true), m(quote),
    m(vaultAddress(pool, mint), true), m(vaultAddress(pool, quote), true), m(TOKEN_2022_PROGRAM), m(quoteTokenProgram), m(SYSTEM_PROGRAM),
    m(LAUNCHLAB_EVENT_AUTHORITY), m(LAUNCHLAB_PROGRAM), m(curveRuleAddress(platform, globalConfig)),
  ];
}

/**
 * initialize_with_token_2022 as an instruction { programId, keys, data } from raw inputs: `payer`
 * (also the creator), `globalConfig`, `platform`, `mint`, `quote`, `quoteTokenProgram` and `args`
 * (encodeInitializeData's). It checks addresses only, so it can rebuild any recorded launch;
 * buildInitializeWithToken2022 is the one a launch uses.
 */
export function initializeWithToken2022Instruction({ payer, globalConfig, platform = STONKFUN_PLATFORM, mint, quote, quoteTokenProgram = TOKEN_2022_PROGRAM, args } = {}) {
  [payer, globalConfig, platform, mint, quote].forEach((a, i) => address(a, ["the payer", "the config", "the platform", "the mint", "the quote"][i]));
  if (quoteTokenProgram !== TOKEN_PROGRAM && quoteTokenProgram !== TOKEN_2022_PROGRAM) throw new TypeError("the quote's token program is the classic token program or Token-2022");
  if (new Set([payer, mint, quote]).size !== 3) throw new Error("the payer, the mint and the quote must be three accounts");
  return { programId: LAUNCHLAB_PROGRAM, keys: initializeAccounts({ payer, globalConfig, platform, mint, quote, quoteTokenProgram }), data: encodeInitializeData(args) };
}

/**
 * The launch's initialize_with_token_2022: a new `mint` paid and created by `wallet` (addresses or
 * keypairs), on StonkFun's standard platform, priced in `pair` (a stock pair { symbol, mint }) with
 * the numbers of `pricing` (pricingFromAnswer's, for that pair), 6 decimals, no vesting, no
 * transfer fee. Throws on a pair that is not a stock pair, pricing for another quote or not
 * pricingFromAnswer's shape, and a name, symbol or uri launchTextProblem refuses (LAUNCHLAB_LIMITS).
 */
export function buildInitializeWithToken2022({ wallet, mint, pair, name, symbol, uri, pricing } = {}) {
  wallet = address(wallet, "the wallet");
  mint = address(mint, "the mint");
  const pp = pairProblem(pair);
  if (pp) throw new Error(`the pair: ${pp}`);
  const bad = pricingProblem(pricing);
  if (bad) throw new TypeError(`${bad} is not what fetchPricing returns`);
  if (pricing.quote.mint !== pair.mint) throw new Error("the pricing is for another quote than the pair");
  const text = launchTextProblem({ name, symbol, uri }, LAUNCHLAB_LIMITS);
  if (text) throw new RangeError(text);
  return initializeWithToken2022Instruction({
    payer: wallet, globalConfig: pricing.configId, platform: STONKFUN_PLATFORM, mint, quote: pair.mint, quoteTokenProgram: TOKEN_2022_PROGRAM,
    args: { decimals: BASE_DECIMALS, name, symbol, uri, supply: pricing.supply, totalBaseSell: pricing.totalSellA, raise: pricing.raise, migrateType: MIGRATE_CPMM, ammFeeOn: pricing.cpmmCreatorFeeOn },
  });
}

/* ── the transaction ──────────────────────────────────────────────────────────────────── */

/** A frozen copy of what a launch was built with, so the check at sign time reads the same numbers. */
const freezePricing = (p) => Object.freeze({ ...p, quote: Object.freeze({ ...p.quote }), prices: Object.freeze({ ...p.prices }) });

/**
 * Build the launch: a legacy transaction paid by `wallet` (who is also the coin's creator), holding
 * SetComputeUnitLimit, SetComputeUnitPrice and buildInitializeWithToken2022's instruction, and
 * nothing else. `keyOrder` is compileLegacyMessage's ("first-seen", or "sorted" as StonkFun's
 * site orders them). Returns a frozen { messageBytes, signers ([wallet, mint]), instructions,
 * wallet, mint, pair, pricing, message }. Throws on anything the initialize, the fee guard or
 * checkLaunchMessage refuses.
 */
export function buildLaunchTransaction({
  wallet, mint, pair, name, symbol, uri, pricing, recentBlockhash, keyOrder = "first-seen",
  computeUnitLimit = LAUNCH_DEFAULTS.computeUnitLimit,
  computeUnitPriceMicroLamports = LAUNCH_DEFAULTS.computeUnitPriceMicroLamports,
} = {}) {
  wallet = address(wallet, "the wallet");
  mint = address(mint, "the mint");
  if (!Number.isInteger(computeUnitLimit) || computeUnitLimit < 1 || computeUnitLimit > MAX_COMPUTE_UNIT_LIMIT) {
    throw new RangeError(`a compute-unit limit is 1..${MAX_COMPUTE_UNIT_LIMIT}`);
  }
  const price = typeof computeUnitPriceMicroLamports === "bigint" ? computeUnitPriceMicroLamports
    : Number.isSafeInteger(computeUnitPriceMicroLamports) ? BigInt(computeUnitPriceMicroLamports) : -1n;
  if (price < 0n) throw new RangeError("a compute-unit price is a whole number of micro-lamports, 0 or more");
  const priorityFee = priorityFeeLamports(computeUnitLimit, price);
  if (priorityFee > MAX_PRIORITY_FEE_LAMPORTS) {
    throw new RangeError(`a priority fee of ${priorityFee} lamports is more than the ${MAX_PRIORITY_FEE_LAMPORTS} this launcher allows`);
  }
  const init = buildInitializeWithToken2022({ wallet, mint, pair, name, symbol, uri, pricing });
  const instructions = [setComputeUnitLimit(computeUnitLimit), setComputeUnitPrice(price), init];
  const message = compileLegacyMessage({ payer: wallet, recentBlockhash, instructions, keyOrder });
  const signers = message.accountKeys.slice(0, message.header.numRequiredSignatures);
  const size = 1 + 64 * signers.length + message.bytes.length;
  if (size > PACKET_DATA_SIZE) throw new RangeError(`the launch would be ${size} bytes; Solana takes at most ${PACKET_DATA_SIZE}`);
  const frozen = { pair: Object.freeze({ symbol: pair.symbol, mint: pair.mint }), pricing: freezePricing(pricing) };
  checkLaunchMessage(message.bytes, { wallet, mint, ...frozen });
  return Object.freeze({ messageBytes: message.bytes, signers, instructions, wallet, mint, ...frozen, message });
}

const PLACEHOLDER_SIGNATURE = base58Encode(new Uint8Array(64).fill(1));

/** A decoded legacy message in the shape getTransaction answers (json), successful, with placeholder signatures: what chain.mjs proveLaunch reads. */
function asRecordedTransaction(msg) {
  return {
    version: "legacy", slot: 1, blockTime: 1,
    meta: { err: null, status: { Ok: null }, innerInstructions: [] },
    transaction: {
      signatures: Array.from({ length: msg.header.numRequiredSignatures }, () => PLACEHOLDER_SIGNATURE),
      message: {
        header: { ...msg.header }, accountKeys: [...msg.accountKeys], recentBlockhash: msg.recentBlockhash,
        instructions: msg.instructions.map((ix) => ({ programIdIndex: ix.programIdIndex, accounts: [...ix.accounts], data: base58Encode(ix.data) })),
      },
    },
  };
}

/**
 * Check, from the bytes alone, that a message is a launch this module would build for `wallet`,
 * `mint`, `pair` and `pricing`: signed by exactly [wallet, mint]; at most one SetComputeUnitLimit
 * and one SetComputeUnitPrice (no accounts, the 5- and 9-byte forms) with a limit of 1..1,400,000
 * and a priority fee within MAX_PRIORITY_FEE_LAMPORTS (no limit: 200,000 units an instruction are
 * assumed); exactly one initialize_with_token_2022 whose data, accounts and flags are
 * buildInitializeWithToken2022's for its own name, symbol and uri; no other instruction (no dev
 * buy, no token account); and chain.mjs proveLaunch, run on the message as if it had landed,
 * records it for this wallet, mint and pair. Returns the decoded arguments; throws otherwise.
 */
export function checkLaunchMessage(messageBytes, { wallet, mint, pair, pricing } = {}) {
  const msg = decodeLegacyMessage(messageBytes);
  const signers = msg.accountKeys.slice(0, msg.header.numRequiredSignatures);
  if (signers.length !== 2 || signers[0] !== wallet || signers[1] !== mint) throw new Error("the signers are not [wallet, mint]");
  let limit = null, price = null, init = null;
  for (const ix of decompileInstructions(msg)) {
    const d = Buffer.from(ix.data);
    const budget = ix.programId === COMPUTE_BUDGET_PROGRAM && ix.keys.length === 0;
    if (budget && d[0] === 2 && d.length === 5) {
      if (limit !== null) throw new Error("more than one compute-budget instruction of a kind");
      limit = d.readUInt32LE(1);
    } else if (budget && d[0] === 3 && d.length === 9) {
      if (price !== null) throw new Error("more than one compute-budget instruction of a kind");
      price = d.readBigUInt64LE(1);
    } else if (ix.programId === LAUNCHLAB_PROGRAM && d.subarray(0, 8).toString("hex") === IX.initializeWithToken2022) {
      if (init) throw new Error("more than one initialize");
      init = ix;
    } else {
      throw new Error(`an instruction for ${ix.programId} that a launch does not carry`);
    }
  }
  if (limit !== null && (limit < 1 || limit > MAX_COMPUTE_UNIT_LIMIT)) throw new Error(`a compute-unit limit of ${limit}; a launch asks for 1..${MAX_COMPUTE_UNIT_LIMIT}`);
  const units = limit ?? Math.min(MAX_COMPUTE_UNIT_LIMIT, DEFAULT_INSTRUCTION_COMPUTE_UNIT_LIMIT * msg.instructions.length);
  const priorityFee = priorityFeeLamports(units, price ?? 0n);
  if (priorityFee > MAX_PRIORITY_FEE_LAMPORTS) {
    throw new Error(`a priority fee of ${priorityFee} lamports is more than the ${MAX_PRIORITY_FEE_LAMPORTS} this launcher allows`);
  }
  if (!init) throw new Error("no initialize_with_token_2022");
  const args = decodeInitialize(init.data);
  const want = buildInitializeWithToken2022({ wallet, mint, pair, name: args.name, symbol: args.symbol, uri: args.uri, pricing });
  if (init.keys.length !== want.keys.length || init.keys.some((k, i) => k.pubkey !== want.keys[i].pubkey || k.isSigner !== want.keys[i].isSigner || k.isWritable !== want.keys[i].isWritable)) {
    throw new Error("the initialize's accounts are not the ones for this wallet, mint, pair and config");
  }
  if (Buffer.compare(Buffer.from(init.data), Buffer.from(want.data)) !== 0) throw new Error("the initialize's data is not the one for this pricing");
  const proof = proveLaunch(asRecordedTransaction(msg), { wallet });
  if (!proof.ok) throw new Error(`the Collection would not record this launch: ${proof.clause} (${proof.detail})`);
  if (proof.launch.mint !== mint || proof.launch.pair.mint !== pair.mint) throw new Error("the Collection would record another mint or pair");
  return args;
}

/**
 * Sign a built launch with the wallet's and the mint's keypairs and return the serialized
 * transaction, base64 (what sendTransaction takes). As in pump.mjs: the message is copied once and
 * that copy is re-checked from its bytes (checkLaunchMessage, with the pair and pricing it was
 * built with), signed and serialized, so bytes that are not this plain launch are never signed.
 */
export function signLaunchTransaction(built, walletKeypair, mintKeypair) {
  if (!built || !(built.messageBytes instanceof Uint8Array)) throw new TypeError("signLaunchTransaction takes what buildLaunchTransaction returned");
  if (walletKeypair?.publicKey !== built.wallet) throw new Error("the wallet keypair is not the launch's wallet");
  if (mintKeypair?.publicKey !== built.mint) throw new Error("the mint keypair is not the launch's mint");
  const messageBytes = Uint8Array.from(built.messageBytes); // what is checked is what is signed and sent
  checkLaunchMessage(messageBytes, { wallet: built.wallet, mint: built.mint, pair: built.pair, pricing: built.pricing });
  const signatures = signTransaction(messageBytes, [walletKeypair, mintKeypair]);
  return Buffer.from(serializeTransaction(messageBytes, signatures)).toString("base64");
}
