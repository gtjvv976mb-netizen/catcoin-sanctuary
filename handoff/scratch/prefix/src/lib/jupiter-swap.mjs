/**
 * JUPITER, FOR THE xSTOCK VENUE: A QUOTE, A TRANSACTION, AND THE CHECK BEFORE SIGNING.
 *
 * Jupiter builds the transaction here, which the pump.fun lane never lets anyone do: that
 * lane encodes its own buy_v2 and decodes it back. So the whole weight of "what is being
 * signed" sits on the check in this file, and the check is a port of the executor's own —
 * upstream executor/jupiter.mjs `validateTransaction`, `decodeJupiterExactIn`,
 * `validateRouteAccounts` and `tokenAccountDetails` — which cannot be vendored because it
 * imports the SQLite journal. The port keeps every refusal that applies to a swap paid
 * in a token and drops the wrapped-SOL branches, because this venue never spends SOL on
 * a swap: it pays in the pool's own stock.
 *
 * WHAT WAS READ OFF THE LIVE API ON 2026-09-24 (fixtures/xstock-pools/jupiter-gldx-swap.json):
 *   · base https://api.jup.ag/swap/v1; keyless requests allowed at 0.5 a second (Jupiter's
 *     portal docs; responses carried x-ratelimit-remaining 4 of 5). lite-api.jup.ag is
 *     being retired and is not used.
 *   · GET /quote with onlyDirectRoutes=true and instructionVersion=V2 for GLDx → GAYMF
 *     returned one hop on the Raydium CPMM pool the discovery feed had found.
 *   · POST /swap for that quote returned a v0 transaction with one lookup table and four
 *     top-level instructions: compute-unit limit, compute-unit price, one idempotent
 *     associated-account create (the token's), and one Jupiter `route_v2` whose data held
 *     the input amount, the quoted output and the slippage at the offsets decoded below.
 *   · `priceImpactPct` is a FRACTION measured against Jupiter's reference price: 0.0126 at
 *     0.01 GLDx and 0.0258 at 1 GLDx, and the 1.32-point difference is the 1.34% worse
 *     effective rate the larger fill got.
 *   · `otherAmountThreshold` on /swap/v1 is the CEILING of out × (10000 − slippage) / 10000
 *     (three quotes, three round-ups); the executor's /swap/v2 path floors it. Either is
 *     accepted, and the lane's floor is the threshold itself, never below it.
 *   · A pool Jupiter cannot route answers HTTP 400 {"errorCode":"TOKEN_NOT_TRADABLE"} (the
 *     brand-new pump.fun curve quoted in GLDx did); that is a refusal by name, `no_route`.
 *
 * ONE HOP THROUGH SOL, FOR COINMARKETCAT'S AGENT ONLY. Cat coins trade against SOL. Asked
 * for direct routes from USDC on 2026-09-25, only POPCAT of the six preset cat coins had one;
 * the other five answered NO_ROUTES_FOUND both ways; from USDT none had one, POPCAT included
 * (fixtures/agent/jupiter-cat-route-shapes.json).
 * So a caller that passes `solHop` (the agent does; the xStock venue never does) may take
 * exactly one intermediate, and only SOL. What the live API showed that morning, and what
 * each rule below rests on (fixtures/agent/jupiter-usdc-mew-swap.json, jupiter-usdc-kitty-swap.json):
 *   · THE ASK. Jupiter's quote has no parameter that names the intermediate token; what keeps
 *     a route short is maxAccounts. With onlyDirectRoutes=false and restrictIntermediateTokens
 *     =true, at maxAccounts 24 all twelve answers (six coins, both ways) were one hop through
 *     SOL; at 32 two took a second intermediate (KWIF's buy went through USDT and then SOL); at
 *     20 KITTY had no route. So the hop is asked at 24, and the SHAPE is held by the check, not
 *     trusted: `routeShape` refuses a second hop, a split between different ways, and any
 *     intermediate but SOL, each by name.
 *   · BUT DIRECT IS ASKED FIRST, exactly as the xStock venue asks (onlyDirectRoutes=true, no
 *     maxAccounts), and the hop only when that answers no route. maxAccounts is a limit on the
 *     WHOLE route, a direct one too: LMEOW, a pump.fun cat coin whose only USDC pool is
 *     PumpSwap's, had a direct route both ways when asked direct and NO_ROUTES_FOUND both ways
 *     when asked for the hop at 24, the same minute (fixtures/agent/jupiter-usdc-lmeow-pumpswap
 *     .json, 2026-09-25). Asked only the hop's way, a coin like that could be neither bought nor
 *     — worse — sold, stop loss included.
 *   · THE BUILD. Asked with useSharedAccounts true, Jupiter builds shared_accounts_route_v2:
 *     the wallet's input goes into an account of one of Jupiter's own program authorities
 *     (the PDA of "authority" and the id byte the instruction carries), the route runs
 *     between that authority's accounts, and the output comes back to the wallet. The
 *     intermediate SOL sits in that AUTHORITY's wrapped-SOL associated account, written by
 *     both steps (four live transactions, authorities 3, 5 and 7); the only wallet accounts
 *     the transaction names are its settlement and token accounts. Asked with
 *     useSharedAccounts false for the same quote, Jupiter built route_v2 with the
 *     intermediate in the WALLET's own wrapped-SOL account, created in the same transaction
 *     and never closed (nothing closes it without SOL wrapping): refused, `intermediate_in_wallet`.
 *   · THE ROUTE PLAN. Each step starts with a Swap enum whose payload length depends on the
 *     AMM (none for Raydium, one byte for BisonFi, nine for Flux), so steps are not read from
 *     the front: that would need a table of every AMM Jupiter routes. But the plan is the
 *     instruction's last argument, so its last four bytes are always the last step's bps,
 *     input index and output index: 0 → 1 on every recorded direct route, 1 → 2 on every
 *     recorded hop (0 the input, 1 the SOL, 2 the output). Those, and the step count, are
 *     bound to the quote.
 *
 * What is NOT known: whether /swap/v1 keeps answering (Jupiter calls it "no longer actively
 * maintained" and names /swap/v2/build its successor; no sunset date is published), and
 * how Jupiter routes a pool in its first seconds (its listing rules key a grace period to
 * the token's age). Both surface here as refusals, never as guesses.
 */
import {
  AddressLookupTableAccount, ComputeBudgetProgram, PublicKey, TransactionMessage, VersionedTransaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM, TOKEN_2022_PROGRAM } from "../../vendor/executor/token2022.mjs";
import { ATA_PROGRAM, WSOL, SYSTEM_PROGRAM, SIGNATURE_FEE_LAMPORTS, associatedTokenAddress, fromBase64 } from "./tx.mjs";

export const JUPITER_SWAP_API = "https://api.jup.ag/swap/v1";
/** Jupiter's price API on the same host and the same keyless budget: the agent's fallback
 *  price for a token DexScreener did not price (src/lib/agent-market.mjs). Read live on
 *  2026-09-24: { <mint>: { usdPrice, liquidity, decimals, priceChange24h, … } }, cached 5 s. */
export const JUPITER_PRICE_API = "https://api.jup.ag/price/v3";
export const JUPITER_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
export const JUPITER_EVENT_AUTHORITY = "D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf";
export const LOOKUP_TABLE_PROGRAM = "AddressLookupTab1e1111111111111111111111111";
const COMPUTE_PROGRAM = ComputeBudgetProgram.programId.toBase58();
/** Keyless: 0.5 requests a second, per the portal's rate-limit table. A little slack on top. */
export const JUPITER_KEYLESS_INTERVAL_MS = 2_100;
/** The compute-unit ceiling a Jupiter swap may ask for (its default limit is this). */
export const JUPITER_MAX_COMPUTE_UNITS = 1_400_000;
/** Codes Jupiter answers when it cannot price a pair. Each is `no_route` here. */
export const JUPITER_NO_ROUTE_CODES = Object.freeze(new Set([
  "NO_ROUTES_FOUND", "COULD_NOT_FIND_ANY_ROUTE", "TOKEN_NOT_TRADABLE", "ROUTE_PLAN_DOES_NOT_CONSUME_ALL_THE_AMOUNT",
]));
/** The one intermediate a `solHop` route may pass through: wrapped SOL, held by Jupiter. */
export const JUPITER_HOP_MINT = WSOL;
/** maxAccounts on the one-hop ask: at 24 every preset cat coin, both ways, came back direct
 *  or one hop through SOL on 2026-09-25 (fixtures/agent/jupiter-cat-route-shapes.json). */
export const JUPITER_HOP_MAX_ACCOUNTS = 24;
/** The rent sysvar: the chain's own rate, from which an account's rent-exempt minimum is
 *  computed. Read on 2026-09-25: 5,080 lamports a byte-year at a threshold of 1, so 650,240
 *  for an account of no data and 1,488,440 for a 165-byte token account — the answers
 *  getMinimumBalanceForRentExemption gave that minute (fixtures/agent/mainnet-rent-and-slot-reads.json). */
export const SYSVAR_RENT = "SysvarRent111111111111111111111111111111111";
const SYSVAR_OWNER = "Sysvar1111111111111111111111111111111111111";
/** The bytes the chain charges rent on beyond an account's data (Agave's ACCOUNT_STORAGE_OVERHEAD). */
const ACCOUNT_STORAGE_OVERHEAD = 128n;
/** A token-program instruction that turns lamports sent to a wrapped-SOL account into
 *  wrapped SOL: the one way SOL becomes a token without Jupiter's help. */
const SYNC_NATIVE = 17;

/* Anchor's eight-byte discriminators of the two exact-in instructions whose safety fields
   sit at fixed offsets (executor/jupiter.mjs JUPITER_EXACT_IN). Any other Jupiter
   instruction — the v1 `route`, an exact-out route — is refused: its limits follow a
   variable-length route plan and cannot be read without guessing. */
const JUPITER_EXACT_IN = new Map([
  ["bb64facc31c4af14", { name: "route_v2", shared: false }],
  ["d19853937cfed8e9", { name: "shared_accounts_route_v2", shared: true }],
]);

export class JupiterError extends Error {
  constructor(code, message, detail = {}) { super(message); this.name = "JupiterError"; this.code = code; this.detail = detail; }
}
/** A transaction the check refused. `clause` names which rule. */
export class SwapCheckError extends Error {
  constructor(clause, message, detail = {}) { super(message); this.name = "SwapCheckError"; this.clause = clause; this.detail = detail; }
}

/**
 * Jupiter's program authority number `id` (one byte of the instruction; the recorded routes
 * used 3, 5 and 7): the PDA of "authority" and that byte under the Jupiter program. It owns the accounts a shared
 * route runs between — including, on a hop, the wrapped SOL in the middle.
 */
const authorities = new Map();
export function jupiterProgramAuthority(id) {
  const n = Number(id);
  if (!authorities.has(n)) authorities.set(n, PublicKey.findProgramAddressSync([Buffer.from("authority"), Buffer.from([n])], new PublicKey(JUPITER_PROGRAM))[0].toBase58());
  return authorities.get(n);
}

const isStr = (v) => typeof v === "string" && v.length > 0;
const positiveRaw = (v, label) => {
  const t = String(v ?? "");
  if (!/^\d+$/.test(t) || BigInt(t) <= 0n) throw new SwapCheckError("quote_malformed", `${label} must be a positive integer, got ${JSON.stringify(v)}`);
  return BigInt(t);
};

/* ── the client: two requests and a rate budget ──────────────────────────────────── */

/**
 * `priority` on each request:
 *   "live"        a sell, a live entry, a live mark: waits for the next slot (up to 15 s)
 *   "entry"       a first-notice evaluation: waits too
 *   "background"  a would-have row's mark: skipped (JupiterError "rate_budget") when no
 *                 slot is free now — a missed paper sample costs nothing, a late sell does
 */
export function createJupiterClient({
  fetchImpl = globalThis.fetch, clock = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  timers = { setTimeout: globalThis.setTimeout.bind(globalThis), clearTimeout: globalThis.clearTimeout.bind(globalThis) },
  baseUrl = JUPITER_SWAP_API, priceUrl = JUPITER_PRICE_API, intervalMs = JUPITER_KEYLESS_INTERVAL_MS, timeoutMs = 10_000, maxWaitMs = 15_000,
} = {}) {
  let nextAt = 0;
  let backoffUntil = 0;
  const counters = { requests: 0, ok: 0, noRoute: 0, rateLimited: 0, errors: 0, skipped: 0 };
  let lastError = null;

  async function slot(priority) {
    const now = clock();
    const readyAt = Math.max(nextAt, backoffUntil);
    if (readyAt > now) {
      if (priority === "background") { counters.skipped++; throw new JupiterError("rate_budget", "no Jupiter request slot is free this tick (keyless: 0.5 a second)"); }
      if (readyAt - now > maxWaitMs) throw new JupiterError("rate_limited", `Jupiter asked for a pause until ${new Date(readyAt).toISOString()}`);
      await sleep(readyAt - now);
    }
    nextAt = Math.max(clock(), nextAt) + intervalMs;
  }

  async function request(path, { query = null, body = null, priority = "entry", base = baseUrl } = {}) {
    await slot(priority);
    counters.requests++;
    const url = `${base}${path}${query ? `?${new URLSearchParams(query).toString()}` : ""}`;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? timers.setTimeout(() => controller.abort(), timeoutMs) : null;
    let res, text;
    try {
      res = await fetchImpl(url, {
        method: body === null ? "GET" : "POST", signal: controller?.signal,
        headers: body === null ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" },
        ...(body === null ? {} : { body: JSON.stringify(body) }),
      });
      text = typeof res.text === "function" ? await res.text() : JSON.stringify(await res.json());
    } catch (error) {
      counters.errors++; lastError = String(error?.message ?? error);
      throw new JupiterError("network", error?.name === "AbortError" ? `Jupiter did not answer inside ${timeoutMs}ms` : `Jupiter unreachable: ${lastError}`);
    } finally { if (timer !== null) timers.clearTimeout(timer); }
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    if (res.status === 429) {
      counters.rateLimited++;
      const reset = Number(typeof res.headers?.get === "function" ? res.headers.get("x-ratelimit-reset") : NaN);
      const resetMs = Number.isFinite(reset) && reset > 0 ? reset * 1000 : 0;
      backoffUntil = Math.max(clock() + 10_000, Math.min(resetMs, clock() + 120_000));
      lastError = "HTTP 429";
      throw new JupiterError("rate_limited", "Jupiter answered 429: over the keyless rate limit");
    }
    if (!res.ok) {
      const code = isStr(parsed?.errorCode) ? parsed.errorCode : null;
      const message = isStr(parsed?.error) ? parsed.error : `HTTP ${res.status}`;
      if (code && JUPITER_NO_ROUTE_CODES.has(code)) { counters.noRoute++; throw new JupiterError("no_route", `${message} (${code})`, { errorCode: code }); }
      counters.errors++; lastError = `${res.status} ${code ?? ""} ${message}`.trim();
      throw new JupiterError("http", `Jupiter ${res.status}: ${message}${code ? ` (${code})` : ""}`, { status: res.status, errorCode: code });
    }
    if (parsed === null || typeof parsed !== "object") { counters.errors++; throw new JupiterError("malformed", "Jupiter answered with something that is not JSON"); }
    counters.ok++;
    return parsed;
  }

  return Object.freeze({
    /** An exact-in quote on a DIRECT route (the xStock venue's only ask): the pool pairs the
     *  two mints, and a hop through a third token would put accounts on the wallet this venue
     *  never checks. With `solHop` (the agent) the same direct ask goes first, byte for byte,
     *  and only when Jupiter answers it with a no-route code is a short route asked for —
     *  onlyDirectRoutes=false, restrictIntermediateTokens=true, maxAccounts=24 — which on the
     *  recorded morning came back one hop through SOL for every preset cat coin but POPCAT.
     *  Direct first, because maxAccounts binds a direct route too: at 24 Jupiter drops a
     *  PumpSwap pool it quotes when asked direct (the LMEOW fixture). A coin with no direct
     *  route costs a second request out of the same keyless budget. Jupiter cannot be told
     *  WHICH intermediate; checkQuote holds that. */
    async quote({ inputMint, outputMint, amountRaw, slippageBps, priority = "entry", solHop = false }) {
      const ask = (shape) => request("/quote", { priority, query: {
        inputMint, outputMint, amount: String(amountRaw), slippageBps: String(slippageBps), swapMode: "ExactIn", ...shape, instructionVersion: "V2",
      } });
      const direct = { onlyDirectRoutes: "true", restrictIntermediateTokens: "true" };
      if (!solHop) return ask(direct);
      try { return await ask(direct); }
      catch (error) { if (!(error instanceof JupiterError && error.code === "no_route")) throw error; }
      return ask({ onlyDirectRoutes: "false", restrictIntermediateTokens: "true", maxAccounts: String(JUPITER_HOP_MAX_ACCOUNTS) });
    },
    /** The unsigned transaction for a quote, for `wallet`. No SOL wrapping (this venue never
     *  spends SOL on a swap), a fixed compute limit, the priority fee capped at the lane's.
     *  `sharedAccounts` (a hop) asks for Jupiter's shared-accounts route, which keeps the
     *  intermediate SOL in Jupiter's own account; a direct swap's body is unchanged. */
    swapTransaction({ quote, wallet, priorityFeeLamports, priority = "live", sharedAccounts = false }) {
      return request("/swap", { priority, body: {
        quoteResponse: quote, userPublicKey: wallet, wrapAndUnwrapSol: false, dynamicComputeUnitLimit: false,
        ...(sharedAccounts ? { useSharedAccounts: true } : {}),
        prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: Number(priorityFeeLamports), priorityLevel: "veryHigh", global: false } },
      } });
    },
    /** USD prices for up to 50 mints in one request, on the same rate budget as every
     *  quote and swap: one keyless client, so the agent and the xStock venue never ask
     *  Jupiter for more than 0.5 requests a second between them. */
    prices({ mints, priority = "background" }) {
      const ids = [...new Set((mints ?? []).map(String))].slice(0, 50);
      return request("", { priority, base: priceUrl, query: { ids: ids.join(",") } });
    },
    status() { const now = clock(); return { ...counters, lastError, nextSlotInMs: Math.max(0, nextAt - now), restingForMs: Math.max(0, backoffUntil - now) }; },
  });
}

/**
 * THE PAIR ALLOWLIST. A caller that trades only between named mints (the agent: its
 * settlement token and its universe, either way) passes `allowedPairs` as "in>out"
 * strings, and a swap whose input and output are not one of them is refused at
 * `pair_not_allowed` — before a quote is asked for, and again inside the check before
 * signing, on the mints the transaction is bound to.
 */
export function assertPairAllowed({ inputMint, outputMint, allowedPairs }) {
  const pairs = allowedPairs instanceof Set ? allowedPairs : new Set(allowedPairs ?? []);
  if (!pairs.has(`${inputMint}>${outputMint}`))
    throw new SwapCheckError("pair_not_allowed", `${inputMint} → ${outputMint} is not a pair this swap may be: only the settlement token and the listed tokens, either way`);
}

/* ── the quote: does it say what was asked? ──────────────────────────────────────── */

/**
 * THE ROUTE'S SHAPE, read off the quote's route plan. Each part of a /swap/v1 route plan
 * names the mint it takes and the mint it gives, and its share (bps) of what it takes.
 * Without `solHop` every part must go straight from the input to the output, the parts
 * adding up to the whole: the direct route, as it always was. With `solHop` a route may
 * instead take ONE intermediate, SOL: every part goes input → SOL or SOL → output, the
 * parts on each side adding up to the whole. Refused by name:
 *   route_not_direct            (no solHop) a part goes anywhere but input → output; or a
 *                               direct route's parts do not add up to 10000 bps
 *   route_too_many_hops         a part goes between two intermediates: a second hop
 *   route_split_intermediates   the parts go different ways — a direct pool beside a path
 *                               through SOL, or SOL beside another token
 *   route_intermediate_not_sol  the one intermediate is not SOL
 *   quote_malformed             a part that leads nowhere, or a side through SOL that does
 *                               not add up to the whole
 * Returns { intermediate (the SOL mint, or null when direct), legs (1 or 2), steps }.
 */
export function routeShape(routePlan, { inputMint, outputMint, solHop = false }) {
  const bad = (clause, message) => { throw new SwapCheckError(clause, message); };
  const hops = Array.isArray(routePlan) ? routePlan : [];
  if (!hops.length) bad("quote_malformed", "the quote has no route plan");
  const where = (s) => `${s.inputMint} → ${s.outputMint}${s.label ? ` on ${s.label}` : ""}`;
  if (!solHop) {
    let bps = 0;
    for (const h of hops) {
      const s = h?.swapInfo ?? {};
      if (s.inputMint !== inputMint || s.outputMint !== outputMint)
        bad("route_not_direct", `a hop goes ${where(s)}: only a direct ${inputMint} → ${outputMint} route is accepted`);
      bps += Number(h?.bps ?? 0);
    }
    if (bps !== 10_000) bad("route_not_direct", `the route's parts add up to ${bps} bps, not 10000`);
    return Object.freeze({ intermediate: null, legs: 1, steps: hops.length });
  }
  let directParts = 0, directBps = 0;
  const into = new Map(), outOf = new Map();
  for (const h of hops) {
    const s = h?.swapInfo ?? {};
    const bps = Number(h?.bps ?? 0);
    const fromIn = s.inputMint === inputMint, toOut = s.outputMint === outputMint;
    const mids = [s.inputMint, s.outputMint].filter((m) => m !== inputMint && m !== outputMint);
    if (fromIn && toOut) { directParts++; directBps += bps; }
    else if (fromIn && mids.length === 1) into.set(s.outputMint, (into.get(s.outputMint) ?? 0) + bps);
    else if (toOut && mids.length === 1) outOf.set(s.inputMint, (outOf.get(s.inputMint) ?? 0) + bps);
    else if (mids.length === 2) bad("route_too_many_hops", `a hop goes ${where(s)}, between two intermediates: a route may pass through one token, SOL, and no more`);
    else bad("quote_malformed", `a hop goes ${where(s)}, which is no step from ${inputMint} towards ${outputMint}`);
  }
  const ways = [...(directParts ? ["direct"] : []), ...new Set([...into.keys(), ...outOf.keys()])];
  if (ways.length > 1)
    bad("route_split_intermediates", `the route splits its parts between ${ways.map((w) => (w === "direct" ? "a direct pool" : `a path through ${w}`)).join(" and ")}: it may go one way only, direct or through SOL`);
  if (directParts) {
    if (directBps !== 10_000) bad("route_not_direct", `the route's parts add up to ${directBps} bps, not 10000`);
    return Object.freeze({ intermediate: null, legs: 1, steps: hops.length });
  }
  const [mid] = ways;
  if (mid !== JUPITER_HOP_MINT) bad("route_intermediate_not_sol", `the route passes through ${mid}: the one intermediate a route may take is SOL (${JUPITER_HOP_MINT})`);
  if (into.get(mid) !== 10_000 || outOf.get(mid) !== 10_000)
    bad("quote_malformed", `the route's parts into SOL add up to ${into.get(mid) ?? 0} bps and out of it to ${outOf.get(mid) ?? 0}, not 10000 each`);
  return Object.freeze({ intermediate: mid, legs: 2, steps: hops.length });
}

/**
 * Port of executor/jupiter.mjs `validateOrderEnvelope` for the /swap/v1 quote shape. The
 * quote must echo the pair, the exact input and exact-in mode; its slippage must be the one
 * asked for and inside the cap; the minimum output must be the quoted output less that
 * slippage (either rounding); no platform fee; the impact inside the cap — the WHOLE
 * route's impact, one figure however many pools it crosses; and the route the shape
 * `routeShape` allows: direct, or with `solHop` also one hop through SOL.
 */
export function checkQuote(quote, { inputMint, outputMint, amountRaw, slippageBps, slippageCapBps, maxPriceImpactPct, solHop = false }) {
  const q = quote ?? {};
  const bad = (clause, message) => { throw new SwapCheckError(clause, message); };
  if (q.inputMint !== inputMint) bad("quote_mismatch", `Jupiter quoted input ${q.inputMint}, not ${inputMint}`);
  if (q.outputMint !== outputMint) bad("quote_mismatch", `Jupiter quoted output ${q.outputMint}, not ${outputMint}`);
  if (String(q.inAmount) !== String(amountRaw)) bad("quote_mismatch", `Jupiter quoted an input of ${q.inAmount}, not the ${amountRaw} asked for`);
  if (q.swapMode !== "ExactIn") bad("quote_mismatch", `Jupiter quoted swap mode ${q.swapMode}, not ExactIn`);
  const slip = Number(q.slippageBps);
  if (!Number.isInteger(slip) || slip !== Number(slippageBps) || slip > Number(slippageCapBps))
    bad("quote_mismatch", `Jupiter quoted slippage ${q.slippageBps} bps; asked ${slippageBps}, cap ${slippageCapBps}`);
  const out = positiveRaw(q.outAmount, "outAmount");
  const min = positiveRaw(q.otherAmountThreshold, "otherAmountThreshold");
  if (min > out) bad("quote_mismatch", `the minimum output ${min} is above the quoted output ${out}`);
  const scaled = out * BigInt(10_000 - slip);
  const floor = scaled / 10_000n, ceil = (scaled + 9_999n) / 10_000n;
  if (min !== floor && min !== ceil) bad("quote_mismatch", `the minimum output ${min} is not ${out} less ${slip} bps (${floor}–${ceil})`);
  const fee = q.platformFee == null ? 0 : Number(q.platformFee.feeBps ?? q.platformFee.amount ?? NaN);
  if (q.platformFee != null && fee !== 0) bad("quote_mismatch", `the quote carries a platform fee (${JSON.stringify(q.platformFee)}); none was asked for`);
  const impactFraction = Number(q.priceImpactPct);
  if (!Number.isFinite(impactFraction)) bad("quote_malformed", `the quote's priceImpactPct is not a number (${JSON.stringify(q.priceImpactPct)})`);
  const impactPct = Math.abs(impactFraction) * 100;
  if (impactPct > Number(maxPriceImpactPct)) bad("impact_over_cap", `price impact ${impactPct.toFixed(3)}% is over the ${maxPriceImpactPct}% cap`);
  const shape = routeShape(q.routePlan, { inputMint, outputMint, solHop });
  return Object.freeze({ outRaw: out, minOutRaw: min, impactPct, slippageBps: slip, intermediate: shape.intermediate, legs: shape.legs,
    hops: Object.freeze(q.routePlan.map((h) => Object.freeze({ ammKey: h.swapInfo?.ammKey ?? null, label: h.swapInfo?.label ?? null, inputMint: h.swapInfo?.inputMint ?? null, outputMint: h.swapInfo?.outputMint ?? null, bps: Number(h.bps) }))) });
}

/* ── the transaction: decode, bind, refuse ───────────────────────────────────────── */

/** Port of executor/jupiter.mjs `decodeJupiterExactIn`: the fixed safety fields of a
 *  route_v2 / shared_accounts_route_v2, bound to what the quote said. Beyond the port: the
 *  shared route's program-authority byte, and the route plan's step count and its LAST
 *  step's input and output indexes (the instruction's last four bytes), bound to the
 *  quote's steps and legs when the caller names them — a direct route ends 0 → 1, a hop
 *  through SOL 1 → 2, and a route that ends past token 2 has more than one intermediate. */
export function decodeJupiterRoute(data, expected) {
  const bytes = Buffer.from(data || []);
  const bad = (message) => { throw new SwapCheckError("route_mismatch", message); };
  if (bytes.length < 8) bad("the Jupiter instruction is shorter than its discriminator");
  const variant = JUPITER_EXACT_IN.get(bytes.subarray(0, 8).toString("hex"));
  if (!variant) throw new SwapCheckError("route_unsupported", `Jupiter instruction ${bytes.subarray(0, 8).toString("hex")} is not an exact-in route_v2`);
  const amountOffset = variant.shared ? 9 : 8;
  const routeCountOffset = variant.shared ? 31 : 30;
  if (bytes.length <= routeCountOffset + 4) bad(`the ${variant.name} instruction is truncated`);
  const id = variant.shared ? bytes[8] : null;
  const amount = bytes.readBigUInt64LE(amountOffset);
  const quotedOut = bytes.readBigUInt64LE(amountOffset + 8);
  const slippageBps = bytes.readUInt16LE(amountOffset + 16);
  const platformFeeBps = bytes.readUInt16LE(amountOffset + 18);
  const positiveSlippageBps = bytes.readUInt16LE(amountOffset + 20);
  const routeSteps = bytes.readUInt32LE(routeCountOffset);
  if (!(routeSteps >= 1 && routeSteps <= 16)) bad(`the route plan has ${routeSteps} steps`);
  /* Each step is at least a variant byte, its bps and two indexes. */
  if (bytes.length < routeCountOffset + 4 + 5 * routeSteps) bad(`the ${variant.name} instruction is too short for ${routeSteps} route steps`);
  const lastStep = Object.freeze({ bps: bytes.readUInt16LE(bytes.length - 4), inputIndex: bytes[bytes.length - 2], outputIndex: bytes[bytes.length - 1] });
  if (amount !== BigInt(expected.amountRaw)) bad(`the instruction spends ${amount}, not the ticket's ${expected.amountRaw}`);
  if (quotedOut !== BigInt(expected.quotedOutRaw)) bad(`the instruction's quoted output ${quotedOut} is not the quote's ${expected.quotedOutRaw}`);
  if (slippageBps !== Number(expected.slippageBps) || slippageBps > Number(expected.slippageCapBps))
    bad(`the instruction's slippage is ${slippageBps} bps; the quote said ${expected.slippageBps}, the cap is ${expected.slippageCapBps}`);
  if (platformFeeBps !== 0) bad(`the instruction takes a ${platformFeeBps} bps platform fee`);
  if (positiveSlippageBps !== 0) bad(`the instruction takes an unrequested ${positiveSlippageBps} bps positive-slippage fee`);
  if (expected.legs != null) {
    const legs = Number(expected.legs);
    if (lastStep.outputIndex > 2)
      throw new SwapCheckError("route_too_many_hops", `the instruction's route plan ends at token ${lastStep.outputIndex}: it passes through ${lastStep.outputIndex - 1} intermediates, and a route may pass through one, SOL`);
    if (lastStep.inputIndex !== legs - 1 || lastStep.outputIndex !== legs)
      bad(`the instruction's route plan ends ${lastStep.inputIndex} → ${lastStep.outputIndex}; the quote's ${legs === 1 ? "direct route ends 0 → 1" : "hop through SOL ends 1 → 2"}`);
  }
  if (expected.steps != null && routeSteps !== Number(expected.steps)) bad(`the instruction's route plan has ${routeSteps} steps; the quote's has ${expected.steps}`);
  return Object.freeze({ ...variant, id, amount, quotedOut, slippageBps, routeSteps, lastStep });
}

const keyOf = (meta) => meta?.pubkey?.toBase58?.() ?? null;
function exactKey(meta, expected, label, { signer = false, writable = false } = {}) {
  if (keyOf(meta) !== String(expected)) throw new SwapCheckError("route_accounts", `${label} is ${keyOf(meta)}, not ${expected}`);
  if (signer && !meta.isSigner) throw new SwapCheckError("route_accounts", `${label} is not a signer`);
  if (writable && !meta.isWritable) throw new SwapCheckError("route_accounts", `${label} is not writable`);
}

/** Port of executor/jupiter.mjs `validateRouteAccounts`: the route spends from the
 *  wallet's own input account, pays into its own output account, in the named mints and
 *  programs, and nowhere else. A shared route also names the program authority its id
 *  byte derives, and that authority's OWN associated accounts for the input and output
 *  mints as the accounts it runs between — the layout every recorded shared route had
 *  (fixtures/agent/jupiter-usdc-mew-swap.json, jupiter-usdc-kitty-swap.json). */
export function checkRouteAccounts(ix, route, { wallet, inputMint, outputMint, inputProgram, outputProgram, inputAta, outputAta }) {
  const k = ix.keys;
  if (route.name === "route_v2") {
    if (k.length < 10) throw new SwapCheckError("route_accounts", "the route_v2 account list is truncated");
    exactKey(k[0], wallet, "route_v2 transfer authority", { signer: true });
    exactKey(k[1], inputAta, "route_v2 source token account", { writable: true });
    exactKey(k[2], outputAta, "route_v2 destination token account", { writable: true });
    exactKey(k[3], inputMint, "route_v2 source mint");
    exactKey(k[4], outputMint, "route_v2 destination mint");
    exactKey(k[5], inputProgram, "route_v2 source token program");
    exactKey(k[6], outputProgram, "route_v2 destination token program");
    if (keyOf(k[7]) !== JUPITER_PROGRAM && keyOf(k[7]) !== outputAta) throw new SwapCheckError("route_accounts", "route_v2's optional destination sends the output away from the wallet");
    exactKey(k[8], JUPITER_EVENT_AUTHORITY, "route_v2 event authority");
    exactKey(k[9], JUPITER_PROGRAM, "route_v2 program account");
    return;
  }
  if (k.length < 12) throw new SwapCheckError("route_accounts", "the shared_accounts_route_v2 account list is truncated");
  const authority = jupiterProgramAuthority(route.id);
  exactKey(k[0], authority, `shared route_v2 program authority (number ${route.id})`);
  exactKey(k[1], wallet, "shared route_v2 transfer authority", { signer: true });
  exactKey(k[3], associatedTokenAddress(authority, inputMint, inputProgram), "shared route_v2 program source account");
  exactKey(k[4], associatedTokenAddress(authority, outputMint, outputProgram), "shared route_v2 program destination account");
  exactKey(k[2], inputAta, "shared route_v2 source token account", { writable: true });
  exactKey(k[5], outputAta, "shared route_v2 destination token account", { writable: true });
  exactKey(k[6], inputMint, "shared route_v2 source mint");
  exactKey(k[7], outputMint, "shared route_v2 destination mint");
  exactKey(k[8], inputProgram, "shared route_v2 source token program");
  exactKey(k[9], outputProgram, "shared route_v2 destination token program");
  exactKey(k[10], JUPITER_EVENT_AUTHORITY, "shared route_v2 event authority");
  exactKey(k[11], JUPITER_PROGRAM, "shared route_v2 program account");
}

/** The lookup-table addresses a transaction names, so the caller can resolve them on its
 *  own RPC before the check. An undecodable transaction names none; the check refuses it. */
export function lookupTableKeysOf(txBase64) {
  try { return (VersionedTransaction.deserialize(fromBase64(txBase64)).message.addressTableLookups ?? []).map((l) => l.accountKey.toBase58()); }
  catch { return []; }
}

/** The lookup tables a v0 message names, resolved from THIS lane's RPC (never from what
 *  Jupiter says they hold): each must exist and be owned by the lookup-table program. */
export async function loadLookupTables(rpc, addresses) {
  const list = [...new Set(addresses.map(String))];
  if (!list.length) return new Map();
  const read = await rpc.getMultipleAccounts(list);
  const out = new Map();
  list.forEach((address, i) => {
    const account = read.accounts?.[i];
    if (!account?.data) throw new SwapCheckError("lookup_table_unavailable", `lookup table ${address} was not found on this RPC`);
    if (String(account.owner) !== LOOKUP_TABLE_PROGRAM) throw new SwapCheckError("lookup_table_unavailable", `${address} is owned by ${account.owner}, not the lookup-table program`);
    const bytes = Array.isArray(account.data) ? Buffer.from(account.data[0], account.data[1] || "base64") : Buffer.from(account.data);
    let state;
    try { state = AddressLookupTableAccount.deserialize(bytes); }
    catch (error) { throw new SwapCheckError("lookup_table_unavailable", `lookup table ${address} does not decode: ${error.message}`); }
    out.set(address, new AddressLookupTableAccount({ key: new PublicKey(address), state }));
  });
  return out;
}

/**
 * THE CHECK BEFORE SIGNING. Port of executor/jupiter.mjs `validateTransaction`, for a swap
 * paid in a token. Refuses (SwapCheckError, by clause) unless:
 *   · the wallet is the fee payer and the ONLY signer;
 *   · every lookup table resolves from the lane's RPC and the message decompiles against it;
 *   · the only top-level programs are the compute budget (limit ≤ the cap, a price), the
 *     associated-token program (idempotent creates of the wallet's OWN account for the
 *     input or output mint, under that mint's program, paid by the wallet), and exactly one
 *     Jupiter exact-in route — no System transfer, no token instruction, nothing else;
 *   · the route spends exactly `amountRaw` from the wallet's input account into its output
 *     account, at the quote's output and slippage (inside the cap), with no fee of its own,
 *     in as many steps as the quote has and ending where the quote's shape ends;
 *   · the priority fee its compute budget implies is inside `maxPriorityFeeLamports`.
 * It is pure: the lookup tables arrive resolved. What it returns (the writable accounts,
 * the two custody accounts) is what the lane pre-reads and simulates next.
 * With `allowedPairs` (the agent passes its own), the input and output must also be one of
 * those pairs, or nothing else is read: `pair_not_allowed`.
 *
 * SOL NEVER PAYS FOR THE TRADE. A System instruction that moves the wallet's lamports into
 * an account the route writes (or into the wallet's wrapped-SOL account), and any
 * SyncNative, is `sol_as_input`: that is SOL being turned into swap input, and the
 * autopilot's SOL pays fees and rent only. (Any other System instruction is still
 * `program_not_allowed`, as before.)
 *
 * WITH `solHop` (the agent), the quote's route may be one hop through SOL (`routeShape`),
 * and when it is, the transaction must keep that SOL out of the wallet:
 *   · the route is the SHARED-accounts route_v2, whose intermediate sits in Jupiter's
 *     program authority's own wrapped-SOL account, and that account is written by the route
 *     (else `route_intermediate_not_sol`: whatever it passes through is not held as SOL);
 *     a plain route_v2 hop keeps it in the wallet's own account: `intermediate_in_wallet`;
 *   · no account create for the wallet's wrapped-SOL account, and the route does not name
 *     that account at all: `intermediate_in_wallet`. (No other instruction can name it: the
 *     compute budget names no account, and anything else is refused above.)
 * What it returns then also names the wallet's wrapped-SOL account, which the caller
 * simulates beside the other two to prove it is untouched (checkIntermediateLeft).
 */
export function checkSwapTransaction({
  txBase64, wallet, inputMint, outputMint, inputProgram, outputProgram, amountRaw, quote,
  slippageCapBps, lookupTables = new Map(), maxPriorityFeeLamports, maxComputeUnits = JUPITER_MAX_COMPUTE_UNITS, allowedPairs = null, solHop = false,
}) {
  const bad = (clause, message) => { throw new SwapCheckError(clause, message); };
  if (allowedPairs !== null) assertPairAllowed({ inputMint, outputMint, allowedPairs });
  for (const [label, program] of [["input", inputProgram], ["output", outputProgram]])
    if (program !== TOKEN_PROGRAM && program !== TOKEN_2022_PROGRAM) bad("token_program", `the ${label} mint's program ${program} is not a token program`);
  const shape = routeShape(quote?.routePlan, { inputMint, outputMint, solHop });
  let tx;
  try { tx = VersionedTransaction.deserialize(fromBase64(txBase64)); }
  catch (error) { bad("malformed", `the transaction Jupiter returned does not decode: ${error.message}`); }
  const msg = tx.message;
  const staticKeys = msg.staticAccountKeys.map((k) => k.toBase58());
  const required = msg.header.numRequiredSignatures;
  if (required !== 1 || staticKeys[0] !== wallet)
    bad("signers", `the transaction's signers are ${staticKeys.slice(0, required).join(", ") || "none"}; only ${wallet} may sign it`);
  const lookups = msg.addressTableLookups ?? [];
  const tables = lookups.map((l) => {
    const t = lookupTables.get(l.accountKey.toBase58());
    if (!t) bad("lookup_table_unavailable", `lookup table ${l.accountKey.toBase58()} was not resolved`);
    return t;
  });
  let message;
  try { message = TransactionMessage.decompile(msg, { addressLookupTableAccounts: tables }); }
  catch (error) { bad("lookup_table_mismatch", `the message does not decompile against its lookup tables: ${error.message}`); }
  if (message.payerKey.toBase58() !== wallet) bad("signers", `the fee payer is ${message.payerKey.toBase58()}, not ${wallet}`);

  const inputAta = associatedTokenAddress(wallet, inputMint, inputProgram);
  const outputAta = associatedTokenAddress(wallet, outputMint, outputProgram);
  const walletSolAta = associatedTokenAddress(wallet, WSOL, TOKEN_PROGRAM);
  const programOf = new Map([[inputMint, inputProgram], [outputMint, outputProgram]]);
  const ataOf = new Map([[inputMint, inputAta], [outputMint, outputAta]]);
  /* The accounts the route writes, read first: a lamport sent into any of them is swap input. */
  const routeWrites = new Set(message.instructions.filter((ix) => ix.programId.toBase58() === JUPITER_PROGRAM).flatMap((ix) => ix.keys.filter((k) => k.isWritable).map(keyOf)));
  let routes = 0, route = null, computeLimit = null, computePrice = 0n, programAuthority = null;
  const createdAtas = [];
  for (const ix of message.instructions) {
    const program = ix.programId.toBase58();
    for (const meta of ix.keys) if (meta.isSigner && keyOf(meta) !== wallet) bad("signers", `${program} asks ${keyOf(meta)} to sign`);
    if (program === COMPUTE_PROGRAM) {
      const d = Buffer.from(ix.data);
      if (d[0] === 2 && d.length >= 5) {
        computeLimit = d.readUInt32LE(1);
        if (!(computeLimit > 0 && computeLimit <= maxComputeUnits)) bad("compute_budget", `a compute-unit limit of ${computeLimit} is outside 1..${maxComputeUnits}`);
      } else if (d[0] === 3 && d.length >= 9) computePrice = d.readBigUInt64LE(1);
      else bad("compute_budget", `compute-budget instruction ${d[0]} is not one this lane accepts`);
      continue;
    }
    if (program === ATA_PROGRAM) {
      const opcode = ix.data.length ? ix.data[0] : 0;
      if (![0, 1].includes(opcode) || ix.keys.length < 6) bad("account_create", "an associated-token instruction other than a create");
      if (keyOf(ix.keys[0]) !== wallet || keyOf(ix.keys[2]) !== wallet) bad("account_create", `an account create is paid by ${keyOf(ix.keys[0])} or owned by ${keyOf(ix.keys[2])}, not the wallet`);
      const mint = keyOf(ix.keys[3]);
      if (shape.intermediate && mint === shape.intermediate)
        bad("intermediate_in_wallet", `the transaction creates the wallet's own wrapped-SOL account (${keyOf(ix.keys[1])}): the SOL in the middle of the hop would sit in the wallet, and the account would be left behind`);
      if (!programOf.has(mint)) bad("account_create", `an account create for ${mint}, which is neither side of this swap`);
      if (keyOf(ix.keys[1]) !== ataOf.get(mint)) bad("account_create", `the account created for ${mint} is ${keyOf(ix.keys[1])}, not the wallet's own ${ataOf.get(mint)}`);
      if (keyOf(ix.keys[5]) !== programOf.get(mint)) bad("account_create", `the account for ${mint} is created under ${keyOf(ix.keys[5])}, not its mint's program`);
      createdAtas.push(ataOf.get(mint));
      continue;
    }
    if (program === JUPITER_PROGRAM) {
      routes++;
      route = decodeJupiterRoute(ix.data, { amountRaw, quotedOutRaw: quote.outAmount, slippageBps: quote.slippageBps, slippageCapBps, steps: shape.steps, legs: shape.legs });
      if (shape.intermediate && !route.shared)
        bad("intermediate_in_wallet", "Jupiter built the hop as a plain route_v2, which holds the SOL in the middle in the wallet's own wrapped-SOL account; only the shared-accounts route keeps it in Jupiter's");
      checkRouteAccounts(ix, route, { wallet, inputMint, outputMint, inputProgram, outputProgram, inputAta, outputAta });
      if (route.shared) programAuthority = jupiterProgramAuthority(route.id);
      if (shape.intermediate) {
        if (ix.keys.some((m) => keyOf(m) === walletSolAta))
          bad("intermediate_in_wallet", `the route names the wallet's own wrapped-SOL account ${walletSolAta}: the SOL in the middle of the hop stays in Jupiter's account, never the wallet's`);
        const held = associatedTokenAddress(programAuthority, shape.intermediate, TOKEN_PROGRAM);
        if (!ix.keys.some((m) => keyOf(m) === held && m.isWritable))
          bad("route_intermediate_not_sol", `the route never writes ${held}, Jupiter's own wrapped-SOL account for authority ${route.id}: whatever it passes through, it is not held as SOL`);
      }
      continue;
    }
    /* SOL turned into swap input: lamports from the wallet into an account the route
       writes, or into the wallet's wrapped-SOL account; or a SyncNative anywhere. */
    if (program === SYSTEM_PROGRAM && ix.keys.some((m) => keyOf(m) === wallet && m.isSigner && m.isWritable)) {
      const into = ix.keys.map(keyOf).find((a) => a !== wallet && (routeWrites.has(a) || a === walletSolAta));
      if (into) bad("sol_as_input", `a System instruction moves the wallet's SOL into ${into}, an account this swap trades through: the wallet's SOL pays fees and rent, never the trade`);
    }
    if ((program === TOKEN_PROGRAM || program === TOKEN_2022_PROGRAM) && ix.data.length && ix.data[0] === SYNC_NATIVE)
      bad("sol_as_input", `a SyncNative turns the SOL sent to ${keyOf(ix.keys[0])} into wrapped SOL: the wallet's SOL pays fees and rent, never the trade`);
    /* A System transfer, a token instruction, a memo, anything else: this swap needs none. */
    bad("program_not_allowed", `the transaction calls ${program}, which a ${inputMint} → ${outputMint} swap does not need`);
  }
  if (routes !== 1) bad("route_count", `the transaction holds ${routes} Jupiter routes, not one`);
  if (createdAtas.length > 2) bad("account_create", `${createdAtas.length} account creates`);
  const limit = BigInt(computeLimit ?? 200_000 * message.instructions.length);
  const priorityFeeLamports = (computePrice * limit + 999_999n) / 1_000_000n;
  if (priorityFeeLamports > BigInt(maxPriorityFeeLamports))
    bad("priority_fee_over_budget", `the compute budget implies a ${priorityFeeLamports} lamport priority fee, over the ${maxPriorityFeeLamports} this lane allows`);
  const writableAddresses = [...new Set(message.instructions.flatMap((ix) => ix.keys.filter((k) => k.isWritable).map(keyOf)))];
  if (writableAddresses.length > 64) bad("too_many_writable", `${writableAddresses.length} writable accounts is more than can be inspected`);
  return Object.freeze({
    route, priorityFeeLamports, computeUnitLimit: Number(limit), computeUnitPrice: computePrice, signatures: required,
    createdAtas: Object.freeze(createdAtas), inputAta, outputAta, writableAddresses: Object.freeze(writableAddresses),
    lookupTables: Object.freeze(lookups.map((l) => l.accountKey.toBase58())),
    intermediate: shape.intermediate, legs: shape.legs, programAuthority, walletIntermediateAta: walletSolAta,
  });
}

/* ── token accounts: whose, and who else can move them ───────────────────────────── */

/** Port of executor/jupiter.mjs `tokenAccountDetails`: a Token or Token-2022 account's
 *  mint, owner, amount, delegate and close authority, or null when it is not one. */
export function tokenAccountDetails(account) {
  if (!account?.data) return null;
  const program = String(account.owner ?? "");
  const data = Array.isArray(account.data) ? Buffer.from(account.data[0], account.data[1] || "base64") : Buffer.from(account.data);
  const classic = program === TOKEN_PROGRAM && data.length === 165;
  const t22 = program === TOKEN_2022_PROGRAM && (data.length === 165 || (data.length >= 166 && data[165] === 2));
  if (!classic && !t22) return null;
  const optionKey = (offset) => { const tag = data.readUInt32LE(offset); if (tag === 0) return null; if (tag !== 1) throw new SwapCheckError("custody", "a token account has an invalid option tag"); return new PublicKey(data.subarray(offset + 4, offset + 36)).toBase58(); };
  return Object.freeze({
    program, mint: new PublicKey(data.subarray(0, 32)).toBase58(), owner: new PublicKey(data.subarray(32, 64)).toBase58(),
    amount: data.readBigUInt64LE(64), delegate: optionKey(72), state: data[108], delegatedAmount: data.readBigUInt64LE(121), closeAuthority: optionKey(129),
  });
}

/** No token account the wallet owns may be writable in the swap except the two it trades
 *  through: a route that touches the wallet's other balances is refused. `accounts` is the
 *  lane's own read of `writableAddresses`, in order. */
export function checkWritableCustody({ wallet, writableAddresses, accounts, allowed }) {
  const ok = new Set(allowed);
  writableAddresses.forEach((address, i) => {
    let d = null;
    try { d = tokenAccountDetails(accounts[i]); } catch (error) { throw new SwapCheckError("custody", `${address}: ${error.message}`); }
    if (d && d.owner === wallet && !ok.has(address)) throw new SwapCheckError("custody", `the swap writes to ${address}, another token account of this wallet (${d.mint})`);
  });
}

/** After the simulation: the two custody accounts are initialised, unfrozen, and nobody
 *  else may spend or close them (executor/jupiter.mjs `assertSafeTokenAccount`). */
export function checkSafeAfter(account, { wallet, mint, label }) {
  const d = tokenAccountDetails(account);
  if (!d) throw new SwapCheckError("custody", `after the simulation the ${label} account is not a token account`);
  if (d.owner !== wallet || d.mint !== mint) throw new SwapCheckError("custody", `after the simulation the ${label} account belongs to ${d.owner} in ${d.mint}`);
  if (d.state !== 1) throw new SwapCheckError("custody", `after the simulation the ${label} account is not initialised and unfrozen`);
  if (d.delegate || d.delegatedAmount !== 0n) throw new SwapCheckError("custody", `after the simulation the ${label} account has a delegate (${d.delegate})`);
  if (d.closeAuthority) throw new SwapCheckError("custody", `after the simulation the ${label} account has a close authority (${d.closeAuthority})`);
}

/* ── a hop through SOL, and the wallet's SOL: what the chain says ────────────────────── */

/** A HOP'S MINTS, ON CHAIN. The quote says which tokens the route passes through; the
 *  accounts it writes say it too. Every token account the transaction writes — the pools'
 *  vaults, Jupiter's own accounts, the wallet's two — must hold one of `mints` (the
 *  settlement token, SOL, the listed token), or the route passes through something else:
 *  `route_intermediate_not_sol`. `accounts` is the lane's own read of `writableAddresses`,
 *  in order (the same read checkWritableCustody takes). A direct route is not held to
 *  this: its check is what it always was. */
export function checkRouteMints({ writableAddresses, accounts, mints }) {
  const ok = new Set(mints);
  writableAddresses.forEach((address, i) => {
    let d = null;
    try { d = tokenAccountDetails(accounts[i]); } catch (error) { throw new SwapCheckError("custody", `${address}: ${error.message}`); }
    if (d && !ok.has(d.mint))
      throw new SwapCheckError("route_intermediate_not_sol", `the route writes ${address}, an account of ${d.mint}: a hop passes through SOL and touches no token but ${[...ok].join(", ")}`);
  });
}

const bytesOf = (account) => (Array.isArray(account?.data) ? Buffer.from(account.data[0] ?? "", account.data[1] || "base64") : Buffer.from(account?.data ?? []));

/** After the simulation: the wallet's wrapped-SOL account is exactly what it was — absent
 *  and still absent, or the same owner, lamports and bytes. A swap that leaves the wallet
 *  holding wrapped SOL it did not hold (a stray account with the hop's SOL, or only its
 *  rent), or that empties one it did hold, is `intermediate_in_wallet`. */
export function checkIntermediateLeft({ address, before, after }) {
  const same = (!before && !after) || (Boolean(before) && Boolean(after) && String(before.owner) === String(after.owner)
    && BigInt(before.lamports ?? 0) === BigInt(after.lamports ?? 0) && bytesOf(before).equals(bytesOf(after)));
  if (!same) throw new SwapCheckError("intermediate_in_wallet", `after the simulation the wallet's wrapped-SOL account ${address} ${!before ? "exists" : !after ? "is gone" : "has changed"}: the SOL in the middle of a hop never passes through the wallet`);
}

/* ── the rent a swap may charge the wallet ────────────────────────────────────────────── */

/** The chain's rent rate, from the rent sysvar's own bytes (lamports per byte-year, u64;
 *  the exemption threshold, f64): refused as `rent_unreadable` when the account is not the
 *  sysvar or does not decode to a positive rate. Read on the lane's RPC with the swap's other
 *  accounts, never assumed: the rate on mainnet has changed before, and a stale constant
 *  would either refuse honest swaps or let an account keep SOL the rate does not explain. */
export function rentFromSysvar(account) {
  const bad = (why) => { throw new SwapCheckError("rent_unreadable", `the rent sysvar ${why}: an account's rent-exempt minimum cannot be computed`); };
  if (!account) bad("was not returned by this RPC");
  if (String(account.owner) !== SYSVAR_OWNER) bad(`is owned by ${account.owner}, not the sysvar program`);
  const d = bytesOf(account);
  if (d.length < 17) bad(`holds ${d.length} bytes, not the 17 of a rate`);
  const lamportsPerByteYear = d.readBigUInt64LE(0), exemptionThreshold = d.readDoubleLE(8);
  if (!(lamportsPerByteYear > 0n) || !(Number.isFinite(exemptionThreshold) && exemptionThreshold > 0)) bad(`reads ${lamportsPerByteYear} lamports a byte-year at a threshold of ${exemptionThreshold}`);
  return Object.freeze({ lamportsPerByteYear, exemptionThreshold });
}
/** An account's rent-exempt minimum at `rent`, as the runtime computes it (Agave's
 *  Rent::minimum_balance: the data and 128 bytes of overhead, times the rate, times the
 *  threshold, truncated). */
export function rentExemptMinimum(rent, dataLength) {
  return BigInt(Math.floor(Number((ACCOUNT_STORAGE_OVERHEAD + BigInt(dataLength)) * rent.lamportsPerByteYear) * rent.exemptionThreshold));
}

/** Not yet an account: nothing there, or a bare address holding lamports — no data, owned by
 *  the System program. That second kind is what anyone makes of an address by sending it SOL,
 *  and what the associated-token program and Anchor's init top up rather than pay in full. */
const unopened = (account) => !account || (String(account.owner) === SYSTEM_PROGRAM && bytesOf(account).length === 0);

/**
 * THE RENT A SWAP PAYS, read off the simulation. `addresses` are the accounts read before
 * (`before`) and simulated after (`after`), in the same order and at the same slot. An
 * account the swap OPENS — unopened before, an account after: the wallet's new coin or
 * settlement account, and an AMM's own account for the wallet that the AMM makes the wallet
 * pay for (PumpSwap's per-user volume account on the recorded LMEOW buy) — costs the wallet
 * what it gained, up to its rent-exempt minimum at the chain's rate:
 *   rent = min(after, minimum(after's data length)) − before
 * So an address someone sent SOL to first is charged only the top-up the create really
 * takes, never refused for the SOL a stranger put there; and SOL an opened account holds
 * beyond its minimum is not rent, so checkNativeSpend counts it against the wallet. An
 * account that existed before is never rent, whatever it gained; a bare address that stays
 * bare is never rent either (lamports sent to it are a transfer).
 * Returns { lamports, opened: [{ address, lamports, minimum, gained }] }.
 */
export function rentOfOpenedAccounts({ addresses, before, after, rent }) {
  let lamports = 0n;
  const opened = [];
  addresses.forEach((address, i) => {
    const b = before?.[i] ?? null, a = after?.[i] ?? null;
    if (!unopened(b) || unopened(a)) return;
    const had = BigInt(b?.lamports ?? 0), now = BigInt(a.lamports ?? 0);
    const minimum = rentExemptMinimum(rent, bytesOf(a).length);
    const paid = (now < minimum ? now : minimum) - had;
    const charged = paid > 0n ? paid : 0n;
    lamports += charged;
    opened.push(Object.freeze({ address, lamports: charged, minimum, gained: now - had }));
  });
  return Object.freeze({ lamports, opened: Object.freeze(opened) });
}

/** After the simulation: no account the swap OPENS may be a token account of the wallet
 *  other than the two it trades through (`allowed`). The before-read's custody check sees
 *  only accounts that already exist; this is the same rule for the ones the swap makes — a
 *  third token account, a wrapped-SOL account at an address that is not the wallet's
 *  associated one, left behind in the wallet: `custody`. */
export function checkOpenedCustody({ wallet, addresses, before, after, allowed }) {
  const ok = new Set(allowed);
  addresses.forEach((address, i) => {
    if (!unopened(before?.[i] ?? null) || unopened(after?.[i] ?? null) || ok.has(address)) return;
    let d = null;
    try { d = tokenAccountDetails(after[i]); } catch (error) { throw new SwapCheckError("custody", `${address}: ${error.message}`); }
    if (d && d.owner === wallet) throw new SwapCheckError("custody", `the simulation opens ${address}, a token account of this wallet in ${d.mint}, beside the two this swap trades through`);
  });
}

/** After the simulation: the wallet's SOL moved by the transaction's own fee (the signature
 *  fee and the priority fee its compute budget implies) and the rent of the accounts it
 *  opens (rentOfOpenedAccounts: what each gained, up to its rent-exempt minimum), and not one
 *  lamport more. More is the wallet's SOL spent as trade input — the engine's own guard allows
 *  up to its fee and rent caps, and still does, as the outer bound; this holds the swap to
 *  what it itself explains: `sol_as_input`. The spend is only as exact as the two reads it
 *  is taken between, so the caller judges it on a read and a simulation of ONE slot (the
 *  engine's simulateGuard with `pinSlot`). (A node whose simulation does not charge the fee
 *  to the payer shows less spent, never more: the bound is then looser by the fee alone.) */
export function checkNativeSpend({ spentLamports, signatures = 1, priorityFeeLamports, rentLamports = 0n }) {
  const fee = BigInt(SIGNATURE_FEE_LAMPORTS) * BigInt(signatures) + BigInt(priorityFeeLamports);
  const allowed = fee + BigInt(rentLamports);
  if (BigInt(spentLamports) > allowed)
    throw new SwapCheckError("sol_as_input", `the simulation takes ${spentLamports} lamports of the wallet's SOL; the fee (${fee}) and the rent of the accounts it opens (${rentLamports}) explain ${allowed}: the wallet's SOL pays fees and rent, never the trade`);
}
