/**
 * THE SCOUT: CAT COINS FROM JUPITER'S VERIFIED LIST, EACH READ ON CHAIN AND QUOTED THE WAY THE AGENT TRADES.
 *
 * With the scout on (spec.scoutOn, off by default), CoinMarketCat's agent keeps the tokens the
 * owner ticked as PINS and fills up to `scoutSlots` more seats with cat coins found here. What
 * this file does is one SCAN, and nothing else: it reads, it judges, it returns a report. It
 * holds no state, signs nothing, sends nothing, and adds nothing to what the agent may trade —
 * the runner decides what a report is worth (agent-runner.mjs adoptScout), and a coin counts
 * only through agent-strategy.mjs `withScout`, on the runner's own clock.
 *
 * A SCAN, IN ORDER, each step able to refuse a coin by a named clause (SCOUT_CLAUSES):
 *
 *   1. THE LIST. Jupiter's verified-token list (bots/lib/verified.mjs URLS.jupiterVerified), one
 *      request through the worker's paced client for lite-api.jup.ag. It is about 5 MB (5,232,631
 *      and 5,232,902 bytes in two reads on 2026-09-25, 3,693 rows), so it is read here, the cat
 *      rows kept, and the rest dropped at once. A list that does not arrive, is not a list, or
 *      is short, fails the whole scan: nothing is admitted from half a list.
 *   2. JUPITER'S FIGURES, STATIC GATES: verified, a cat by its name or ticker (the check Popcat
 *      uses), not a copy of an established cat coin's name, not SOL or a settlement token, and
 *      every figure the floors need actually given — a missing figure is missing, never 0 —
 *      then the owner's floors (liquidity, 24-hour volume, age) and the fixed ones (liquidity no
 *      more than the market cap, a thousand holders). These are Jupiter's numbers, and they
 *      only ever REFUSE: nothing is admitted on Jupiter's word.
 *   3. THE CHAIN, over the owner's RPC, in one getMultipleAccounts: each mint must be an
 *      initialized mint, of an extension set the agent can trade, not paused, with the decimals
 *      and program Jupiter said (a list that disagrees with the chain is not trusted for that
 *      coin), and with NO mint authority and NO freeze authority. Jupiter's own audit is not
 *      read: on 2026-09-25 it called INBRED's mint authority disabled while its mint account
 *      still named one (fixtures/agent/scout-mints.json). The admitted row carries the chain's
 *      decimals and program, never Jupiter's.
 *   4. THE ROUTE, quoted exactly as the agent's own swap asks and checks it: Jupiter asked
 *      direct first, and one hop through SOL only when there is no direct route
 *      (jupiter-swap.mjs `quote`, `hopOnly` for the second ask), each answer held to
 *      `checkQuote` with the agent's `solHop` — so a route through anything but SOL, through
 *      two tokens, or split between ways is refused here as it would be at trade time. The buy
 *      is quoted at the owner's per-token cap and must move the price no more than the agent's
 *      2% cap; the sell is quoted for what that buy would get, and the round trip may lose no
 *      more than SCOUT_RULES.maxRoundTripLossPct. Every quote is "background": it takes a
 *      free slot of the keyless Jupiter budget the agent and the xStock venue share, or waits
 *      (at most three tries), and never delays a live trade. A 429 ends the probing for the
 *      scan; what was not probed is said, by name.
 *
 * Each pinned coin gets one buy quote the same way, reported beside the scan and never used to
 * remove a pin: the owner may see that a pin's route is over the cap today and every buy of it
 * will be refused.
 *
 * WHAT IS NOT KNOWN, and SCOUT_UNMEASURED prints: liquidity, volume, holders, top-holder share
 * and age are Jupiter's figures; the chain read is each mint's own account, not its pools; and
 * a route is one quote at one size at one minute. Whether admitted coins trade well is not
 * measured by any of it.
 *
 * Injected: `http` (the bots' client, allowed lite-api.jup.ag only), `jupiter` (the worker's
 * one keyless client), `rpc` (a function: the owner's RPC client, or null with none set),
 * `clock` and `sleep`. The file names no host itself.
 */
import { HOSTS, URLS } from "../../bots/lib/verified.mjs";
import { detectCat } from "../../bots/lib/catdetect.mjs";
import { copycatOf } from "../../bots/popcat/established.mjs";
import { describeMint, parseMintExtensions, assertTradeableExtensions, TOKEN_PROGRAM, TOKEN_2022_PROGRAM } from "../../vendor/executor/token2022.mjs";
import { checkQuote, JupiterError, SwapCheckError, JUPITER_KEYLESS_INTERVAL_MS } from "./jupiter-swap.mjs";
import { WSOL, unitsToRaw } from "./tx.mjs";
import { SETTLEMENT_TOKENS, SCOUT_RULES, AGENT_MAX_BUY_IMPACT_PCT } from "./agent-strategy.mjs";

/** The one fixed host the scout calls itself (its quotes go through the shared Jupiter client). */
export const SCOUT_HOSTS = Object.freeze([HOSTS.jupiter]);

/**
 * EVERY WAY A SCAN, OR A COIN IN IT, IS REFUSED.
 *   the scan (nothing is admitted):
 *     scout_no_rpc            no RPC is set: every coin is read on chain, paper included
 *     scout_list_unread       the list did not arrive: network, HTTP error, rate limited, too large
 *     scout_list_malformed    not a JSON list, or under SCOUT_RULES.minListLength rows
 *     scout_chain_unread      the one getMultipleAccounts failed
 *     scout_stale_spec        (the runner) the spec's dials changed while the scan ran
 *   a coin, on Jupiter's figures:
 *     scout_row_malformed     a list row with no valid mint (and, in the runner, a stored row that does not normalize)
 *     not_a_cat_coin          not a cat by its name or ticker (counted, not listed)
 *     scout_not_verified      not verified on Jupiter's list
 *     scout_copycat           its name or ticker is an established cat coin's, on another mint
 *     scout_settlement        SOL or a settlement token
 *     scout_unmeasured        a figure the floors need is missing (named)
 *     scout_thin              liquidity under the owner's floor
 *     scout_liquidity_over_mcap  more "liquidity" than market cap
 *     scout_quiet             24-hour volume under the owner's floor
 *     scout_too_new           younger than the owner's floor (its first pool's age)
 *     scout_few_holders       under SCOUT_RULES.minHolders holders
 *     scout_probe_budget      passed so far, but past the SCOUT_RULES.maxProbed best-ranked
 *   a coin, on chain:
 *     scout_mint_unreadable   no account, not a mint, or not initialized
 *     scout_mint_unsupported  a Token-2022 extension the agent cannot trade, or paused
 *     scout_jupiter_disagrees the chain's decimals or token program are not Jupiter's
 *     scout_mint_authority    someone can still mint more of it
 *     scout_freeze_authority  someone can still freeze a holder's account
 *   a coin, on its route (the agent's own quote and checkQuote):
 *     scout_no_route          no route either way the agent asks, buy or sell
 *     scout_route_refused     the route Jupiter offers is one the agent's check refuses (its clause is named)
 *     scout_buy_impact        the buy at the per-token cap moves the price over the 2% cap
 *     scout_round_trip        buying and selling straight back loses over SCOUT_RULES.maxRoundTripLossPct
 *     scout_route_unprobed    no quote could be had: the budget, a 429, the network — not measured, so not admitted
 */
export const SCOUT_CLAUSES = Object.freeze([
  "scout_no_rpc", "scout_list_unread", "scout_list_malformed", "scout_chain_unread", "scout_stale_spec",
  "scout_row_malformed", "not_a_cat_coin", "scout_not_verified", "scout_copycat", "scout_settlement", "scout_unmeasured", "scout_thin",
  "scout_liquidity_over_mcap", "scout_quiet", "scout_too_new", "scout_few_holders", "scout_probe_budget",
  "scout_mint_unreadable", "scout_mint_unsupported", "scout_jupiter_disagrees", "scout_mint_authority", "scout_freeze_authority",
  "scout_no_route", "scout_route_refused", "scout_buy_impact", "scout_round_trip", "scout_route_unprobed",
]);

export const SCOUT_UNMEASURED = "Liquidity, volume, holders, top-holder share and age are Jupiter's figures; only each mint's decimals, " +
  "program, authorities and extensions are read on chain, and a route is one quote each way at your per-token cap, direct or through SOL " +
  "as the agent trades. Whether admitted coins trade well is unmeasured. A cat coin is a cat by its name.";

/** How many refused coins a report names (the funnel counts every one). */
export const SCOUT_REFUSED_LISTED = 120;
/** getMultipleAccounts takes at most a hundred addresses: one call, so at most this many coins are read. */
const CHAIN_READ_MAX = 100;
const DAY_MS = 86_400_000;
const SETTLEMENT_OR_SOL = new Set([WSOL, ...SETTLEMENT_TOKENS.map((s) => s.mint)]);
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const shortMint = (m) => `${m.slice(0, 4)}…${m.slice(-4)}`;
const finiteOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const cleanName = (v) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);
const r = (n, d = 4) => (n === null || !Number.isFinite(n) ? null : Number(n.toFixed(d)));

/* ── Jupiter's row ────────────────────────────────────────────────────────────────── */

/**
 * One row of Jupiter's token list, as the scout reads it — or null when it is not a token
 * row at all (no valid mint). Every figure is a finite number or null, and each null is named
 * in `missing`: 24-hour volume is Jupiter's buy plus sell volume and is null without both; age
 * is the days since its first pool opened. The symbol shown is Jupiter's when it is plain,
 * else the short mint; the NAME is kept for the cat and copycat checks only and never leaves
 * this file in a report.
 */
export function parseJupiterToken(t, now) {
  if (t === null || typeof t !== "object" || Array.isArray(t)) return null;
  const mint = typeof t.id === "string" ? t.id : "";
  if (!BASE58.test(mint)) return null;
  const rawSymbol = cleanName(t.symbol).slice(0, 20);
  const stats = t.stats24h && typeof t.stats24h === "object" ? t.stats24h : null;
  const buyVol = finiteOrNull(stats?.buyVolume), sellVol = finiteOrNull(stats?.sellVolume);
  const firstPoolAt = typeof t.firstPool?.createdAt === "string" ? Date.parse(t.firstPool.createdAt) : NaN;
  const decimals = Number.isInteger(t.decimals) && t.decimals >= 0 && t.decimals <= 18 ? t.decimals : null;
  const program = t.tokenProgram === TOKEN_PROGRAM || t.tokenProgram === TOKEN_2022_PROGRAM ? t.tokenProgram : null;
  const holders = Number.isInteger(t.holderCount) && t.holderCount >= 0 ? t.holderCount : null;
  const row = {
    mint, symbol: /^[A-Za-z0-9$._-]{1,12}$/.test(rawSymbol) ? rawSymbol : shortMint(mint), rawSymbol, name: cleanName(t.name),
    verified: t.isVerified === true, decimals, program,
    liquidityUsd: finiteOrNull(t.liquidity), mcapUsd: finiteOrNull(t.mcap), volume24hUsd: buyVol !== null && sellVol !== null ? buyVol + sellVol : null,
    holders, topHoldersPct: finiteOrNull(t.audit?.topHoldersPercentage),
    ageDays: Number.isFinite(firstPoolAt) && firstPoolAt <= now ? (now - firstPoolAt) / DAY_MS : null,
  };
  row.missing = ["decimals", "program", "liquidityUsd", "mcapUsd", "volume24hUsd", "holders", "ageDays"].filter((k) => row[k] === null);
  return row;
}

/**
 * JUPITER'S FIGURES, THE STATIC GATES, in order: cats only first (the other 3,600-odd rows are
 * counted and dropped), then the owner's pins skipped, then the rest. `floors` are the owner's dials
 * ({ minLiquidityUsd, minVolume24hUsd, minAgeDays }); `pins` the mints the owner ticked, which
 * the scout skips ("pinned": not a refusal). Returns { ok: true } or { ok: false, clause, message }.
 */
export function listVerdict(row, floors, { pins = new Set() } = {}) {
  const no = (clause, message) => ({ ok: false, clause, message });
  if (!row) return no("scout_row_malformed", "a list row with no valid mint");
  if (!detectCat({ name: row.name, symbol: row.rawSymbol }).isCat) return no("not_a_cat_coin", `${row.symbol} is not a cat by its name or ticker`);
  if (pins.has(row.mint)) return { ok: false, pinned: true, clause: null, message: "pinned by the owner" };
  if (!row.verified) return no("scout_not_verified", `${row.symbol} is not verified on Jupiter's list`);
  const copy = copycatOf({ name: row.name, symbol: row.rawSymbol, mint: row.mint });
  if (copy) return no("scout_copycat", `${row.symbol} carries the name or ticker of ${copy.symbol} (${copy.mint}), on another mint`);
  if (SETTLEMENT_OR_SOL.has(row.mint)) return no("scout_settlement", `${row.symbol} is SOL or a settlement token`);
  if (row.missing.length) return no("scout_unmeasured", `${row.symbol}: Jupiter gives no ${row.missing.join(", ")}`);
  if (row.liquidityUsd < floors.minLiquidityUsd) return no("scout_thin", `${row.symbol}: $${Math.round(row.liquidityUsd).toLocaleString("en-US")} of liquidity, under the $${floors.minLiquidityUsd.toLocaleString("en-US")} floor`);
  if (SCOUT_RULES.liquidityNotOverMcap && row.liquidityUsd > row.mcapUsd) return no("scout_liquidity_over_mcap", `${row.symbol}: $${Math.round(row.liquidityUsd).toLocaleString("en-US")} of "liquidity" against $${Math.round(row.mcapUsd).toLocaleString("en-US")} of market cap`);
  if (row.volume24hUsd < floors.minVolume24hUsd) return no("scout_quiet", `${row.symbol}: $${Math.round(row.volume24hUsd).toLocaleString("en-US")} traded in 24 hours, under the $${floors.minVolume24hUsd.toLocaleString("en-US")} floor`);
  if (row.ageDays < floors.minAgeDays) return no("scout_too_new", `${row.symbol}: its first pool is ${row.ageDays.toFixed(1)} days old, under the ${floors.minAgeDays}-day floor`);
  if (row.holders < SCOUT_RULES.minHolders) return no("scout_few_holders", `${row.symbol}: ${row.holders} holders, under ${SCOUT_RULES.minHolders}`);
  return { ok: true };
}

/* ── the chain ────────────────────────────────────────────────────────────────────── */

/**
 * CAN THIS MINT BE TRADED AT ALL: an account that is an initialized mint of a token program,
 * with only the Token-2022 extensions the agent's check accepts, and not paused. The worker
 * runs the same on a custom mint before the owner may save it. Returns { ok: true, facts } or
 * { ok: false, clause: "mint_unreadable" | "mint_unsupported", message }.
 */
export function mintAdmission(account, mint) {
  let facts;
  try { facts = describeMint(account, mint); }
  catch (error) { return { ok: false, clause: "mint_unreadable", message: error.message }; }
  if (facts.initialized !== true) return { ok: false, clause: "mint_unreadable", message: `${mint} is not an initialized mint` };
  if (facts.program === TOKEN_2022_PROGRAM) {
    try { assertTradeableExtensions(parseMintExtensions(Buffer.from(account.data[0], account.data[1] || "base64")), mint); }
    catch (error) { return { ok: false, clause: "mint_unsupported", message: error.message }; }
  }
  if (facts.paused) return { ok: false, clause: "mint_unsupported", message: `${mint} is paused by its issuer` };
  return { ok: true, facts };
}

/** THE CHAIN'S WORD ON ONE ROW: admissible, Jupiter's decimals and program, no authorities. */
export function chainVerdict(row, account) {
  const no = (clause, message) => ({ ok: false, clause, message });
  const got = mintAdmission(account, row.mint);
  if (!got.ok) return no(got.clause === "mint_unreadable" ? "scout_mint_unreadable" : "scout_mint_unsupported", `${row.symbol}: ${got.message}`);
  const f = got.facts;
  if (f.decimals !== row.decimals || f.program !== row.program)
    return no("scout_jupiter_disagrees", `${row.symbol}: the chain reads ${f.decimals} decimals under ${f.program}; Jupiter's list says ${row.decimals} under ${row.program}`);
  if (f.mintAuthority) return no("scout_mint_authority", `${row.symbol}: ${f.mintAuthority} can still mint more of it`);
  if (f.freezeAuthority) return no("scout_freeze_authority", `${row.symbol}: ${f.freezeAuthority} can still freeze a holder's account`);
  return { ok: true, facts: f };
}

/* ── the route ────────────────────────────────────────────────────────────────────── */

/** One side's Jupiter answer (a quote, or the JupiterError it threw) held to the agent's check. */
function sideVerdict(answer, { inputMint, outputMint, amountRaw, slippageBps, side }) {
  if (answer instanceof JupiterError) {
    if (answer.code === "no_route") return { ok: false, clause: "scout_no_route", message: `no ${side} route, asked direct and then through SOL: ${answer.message}` };
    return { ok: false, clause: "scout_route_unprobed", message: `the ${side} quote could not be had (${answer.code}): ${answer.message}` };
  }
  try {
    const q = checkQuote(answer, { inputMint, outputMint, amountRaw, slippageBps, slippageCapBps: slippageBps, maxPriceImpactPct: side === "buy" ? AGENT_MAX_BUY_IMPACT_PCT : 100, solHop: true });
    return { ok: true, q };
  } catch (error) {
    if (!(error instanceof SwapCheckError)) throw error;
    if (error.clause === "impact_over_cap") return { ok: false, clause: "scout_buy_impact", message: `the buy: ${error.message}` };
    return { ok: false, clause: "scout_route_refused", check: error.clause, message: `the ${side} route is one the agent's check refuses (${error.clause}): ${error.message}` };
  }
}

/**
 * THE ROUTE'S VERDICT, on a buy answer and (when the buy passed) a sell answer, each a Jupiter
 * quote or the JupiterError it threw. The buy spends `sizeRaw` of the settlement token; the
 * sell sells what that buy quoted out. Returns { ok: true, route } — via "direct" or "SOL", the
 * buy's impact and the round trip — or { ok: false, clause, side, message }. `sell` undefined
 * means only the buy is judged (a pin's report).
 */
export function routeVerdict({ buy, sell }, { settlementMint, mint, sizeRaw, slippageBps }) {
  const b = sideVerdict(buy, { inputMint: settlementMint, outputMint: mint, amountRaw: String(sizeRaw), slippageBps, side: "buy" });
  if (!b.ok) return { ...b, side: "buy" };
  const route = { via: b.q.intermediate ? "SOL" : "direct", buyImpactPct: r(b.q.impactPct), roundTripLossPct: null, sellImpactPct: null, outRaw: b.q.outRaw.toString(),
    hops: b.q.hops.map((h) => h.label).filter(Boolean) };
  if (sell === undefined) return { ok: true, route };
  const s = sideVerdict(sell, { inputMint: mint, outputMint: settlementMint, amountRaw: b.q.outRaw.toString(), slippageBps, side: "sell" });
  if (!s.ok) return { ...s, side: "sell" };
  const lossPct = (1 - Number(s.q.outRaw) / Number(sizeRaw)) * 100;
  route.roundTripLossPct = r(lossPct);
  route.sellImpactPct = r(s.q.impactPct);
  route.sellVia = s.q.intermediate ? "SOL" : "direct";
  if (lossPct > SCOUT_RULES.maxRoundTripLossPct)
    return { ok: false, clause: "scout_round_trip", side: "sell", message: `buying and selling straight back loses ${lossPct.toFixed(2)}%, over the ${SCOUT_RULES.maxRoundTripLossPct}% the scout allows`, route };
  return { ok: true, route };
}

/**
 * THE ORDER CANDIDATES ARE PROBED IN, fixed so two scans of the same list agree: coins the
 * agent holds that the scout seated, then its other seated coins (a seat is not lost to a
 * newcomer by the order of a list), then 24-hour volume, then liquidity, both highest first,
 * then the mint. `incumbents` maps mint → { held }.
 */
export function rankCompare(incumbents = new Map()) {
  const tier = (row) => (incumbents.has(row.mint) ? (incumbents.get(row.mint).held ? 0 : 1) : 2);
  return (a, b) => tier(a) - tier(b) || b.volume24hUsd - a.volume24hUsd || b.liquidityUsd - a.liquidityUsd || (a.mint < b.mint ? -1 : a.mint > b.mint ? 1 : 0);
}

/* ── the scan ─────────────────────────────────────────────────────────────────────── */

export function createScout({ http, jupiter, rpc = () => null, clock = () => Date.now(), sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  if (!http || typeof http.json !== "function") throw new Error("createScout needs the bots' http client");
  if (!jupiter || typeof jupiter.quote !== "function") throw new Error("createScout needs the shared Jupiter client");

  /**
   * One scan. `input` is the runner's (scoutInput): { dialsKey, settlementMint, sizeUsd,
   * slippageBps, pins: [{ mint, symbol }], incumbents: [{ mint, held }], floors }. Returns the
   * report: { ok: true, at, dialsKey, settlementMint, sizeUsd, admitted, pinRoutes, funnel,
   * refusedBy, refused } or { ok: false, at, dialsKey, settlementMint, clause, message }.
   */
  async function scan(input) {
    const at = clock();
    const head = { at, dialsKey: input.dialsKey, settlementMint: input.settlementMint, sizeUsd: input.sizeUsd };
    const fail = (clause, message) => ({ ok: false, ...head, clause, message });
    const client = rpc();
    if (!client) return fail("scout_no_rpc", "no RPC is set: the scout reads every coin it would admit on chain, over your RPC, paper included — set one in Options");
    const settlement = SETTLEMENT_TOKENS.find((s) => s.mint === input.settlementMint);
    if (!settlement) return fail("scout_stale_spec", `${input.settlementMint} is not a settlement token`);
    const sizeRaw = BigInt(unitsToRaw(Number(input.sizeUsd).toFixed(2), settlement.decimals, "the per-token cap"));

    /* 1. The list. */
    let list;
    try { list = await http.json(URLS.jupiterVerified, { timeoutMs: SCOUT_RULES.listTimeoutMs, maxBytes: SCOUT_RULES.maxListBytes }); }
    catch (error) { return fail("scout_list_unread", `Jupiter's verified list did not arrive (${error?.clause ?? error?.code ?? "error"}): ${error?.message ?? error}`); }
    if (!Array.isArray(list)) return fail("scout_list_malformed", "Jupiter's verified list is not a list");
    if (list.length < SCOUT_RULES.minListLength) return fail("scout_list_malformed", `Jupiter's verified list has ${list.length} rows, under the ${SCOUT_RULES.minListLength} a whole list has`);

    /* 2. Jupiter's figures. */
    const pins = new Set((input.pins ?? []).map((p) => p.mint));
    const refused = [];
    const refusedBy = {};
    const funnel = { listed: list.length, cats: 0, pinned: 0, listPassed: 0, chainRead: 0, chainPassed: 0, probed: 0, admitted: 0 };
    const refuse = (row, clause, message, extra = {}) => {
      refusedBy[clause] = (refusedBy[clause] ?? 0) + 1;
      if (clause !== "not_a_cat_coin" && clause !== "scout_row_malformed" && refused.length < SCOUT_REFUSED_LISTED) refused.push({ mint: row.mint, symbol: row.symbol, clause, message, ...extra });
    };
    const passed = [];
    for (const t of list) {
      const row = parseJupiterToken(t, at);
      const v = listVerdict(row, input.floors, { pins });
      if (row && v.clause !== "not_a_cat_coin" && v.clause !== "scout_row_malformed") funnel.cats++;
      if (v.ok) passed.push(row);
      else if (v.pinned) funnel.pinned++;
      else refuse(row ?? { mint: null, symbol: null }, v.clause, v.message);
    }
    list = null;                                  // the 5 MB goes now; only the cat rows are kept
    funnel.listPassed = passed.length;

    /* 3. The chain: one read, in rank order. */
    const incumbents = new Map((input.incumbents ?? []).map((x) => [x.mint, { held: x.held === true }]));
    passed.sort(rankCompare(incumbents));
    for (const row of passed.slice(CHAIN_READ_MAX)) refuse(row, "scout_probe_budget", `${row.symbol}: past the ${CHAIN_READ_MAX} coins one chain read takes`);
    const toRead = passed.slice(0, CHAIN_READ_MAX);
    let read = { slot: null, accounts: [] };
    if (toRead.length) {
      try { read = await client.getMultipleAccounts(toRead.map((x) => x.mint), { commitment: "confirmed" }); }
      catch (error) { return fail("scout_chain_unread", `the mints could not be read over your RPC: ${error?.message ?? error}`); }
    }
    const readAt = clock();
    funnel.chainRead = toRead.length;
    const onChain = [];
    toRead.forEach((row, i) => {
      const v = chainVerdict(row, read.accounts?.[i] ?? null);
      if (v.ok) onChain.push({ row, facts: v.facts });
      else refuse(row, v.clause, v.message);
    });
    funnel.chainPassed = onChain.length;

    /* 4. The routes, one coin at a time, the best-ranked first. */
    let resting = null;                           // Jupiter answered 429 or is resting: no more probes this scan
    async function ask(args) {
      for (let attempt = 1; ; attempt++) {
        if (resting) throw resting;
        try { return await jupiter.quote({ ...args, slippageBps: input.slippageBps, priority: "background" }); }
        catch (error) {
          if (!(error instanceof JupiterError)) throw new JupiterError("error", String(error?.message ?? error));
          if (error.code === "rate_limited") { resting = error; throw error; }
          if (error.code !== "rate_budget" || attempt >= SCOUT_RULES.probeRetries) throw error;
          await sleep(JUPITER_KEYLESS_INTERVAL_MS);
        }
      }
    }
    /* Direct first, and the hop only on a no-route answer: the agent's own order of asking. */
    async function quoteLikeTheAgent(inputMint, outputMint, amountRaw) {
      const args = { inputMint, outputMint, amountRaw: String(amountRaw) };
      try { return await ask({ ...args, solHop: false }); }
      catch (error) { if (!(error instanceof JupiterError && error.code === "no_route")) return error; }
      try { return await ask({ ...args, solHop: true, hopOnly: true }); }
      catch (error) { return error instanceof JupiterError ? error : new JupiterError("error", String(error?.message ?? error)); }
    }
    const args = { settlementMint: settlement.mint, sizeRaw, slippageBps: input.slippageBps };
    const admitted = [];
    onChain.forEach(({ row }, i) => { if (i >= SCOUT_RULES.maxProbed) refuse(row, "scout_probe_budget", `${row.symbol}: past the ${SCOUT_RULES.maxProbed} best-ranked coins a scan probes`); });
    for (const { row, facts } of onChain.slice(0, SCOUT_RULES.maxProbed)) {
      funnel.probed++;
      const buy = await quoteLikeTheAgent(settlement.mint, row.mint, sizeRaw);
      let v = routeVerdict({ buy }, { ...args, mint: row.mint });
      if (v.ok) {
        const sell = await quoteLikeTheAgent(row.mint, settlement.mint, BigInt(v.route.outRaw));
        v = routeVerdict({ buy, sell }, { ...args, mint: row.mint });
      }
      if (!v.ok) { refuse(row, v.clause, v.message, v.check ? { check: v.check } : {}); continue; }
      admitted.push({
        mint: row.mint, symbol: row.symbol, decimals: facts.decimals, program: facts.program, rank: admitted.length,
        route: { via: v.route.via, sellVia: v.route.sellVia, buyImpactPct: v.route.buyImpactPct, sellImpactPct: v.route.sellImpactPct, roundTripLossPct: v.route.roundTripLossPct, sizeUsd: input.sizeUsd, at: clock(), hops: v.route.hops },
        jupiter: { liquidityUsd: r(row.liquidityUsd, 0), mcapUsd: r(row.mcapUsd, 0), volume24hUsd: r(row.volume24hUsd, 0), holders: row.holders, topHoldersPct: r(row.topHoldersPct, 2), ageDays: r(row.ageDays, 1) },
        chain: { readAt, slot: read.slot ?? null, mintAuthority: null, freezeAuthority: null },
      });
    }
    funnel.admitted = admitted.length;

    /* Each pin: one buy quote, the same way, for the owner's eyes. A pin is never removed. */
    const pinRoutes = [];
    for (const p of input.pins ?? []) {
      const buy = await quoteLikeTheAgent(settlement.mint, p.mint, sizeRaw);
      const v = routeVerdict({ buy }, { ...args, mint: p.mint });
      pinRoutes.push(v.ok ? { mint: p.mint, symbol: p.symbol, ok: true, via: v.route.via, buyImpactPct: v.route.buyImpactPct, at: clock() }
        : { mint: p.mint, symbol: p.symbol, ok: false, clause: v.clause, ...(v.check ? { check: v.check } : {}), message: v.message, at: clock() });
    }
    return { ok: true, ...head, settlementSymbol: settlement.symbol, slippageBps: input.slippageBps, readSlot: read.slot ?? null, admitted, pinRoutes, funnel, refusedBy, refused };
  }
  return Object.freeze({ scan });
}
