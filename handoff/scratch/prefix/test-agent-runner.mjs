/**
 * THE AGENT, END TO END: PAPER AGAINST SCRIPTED FEEDS AND A SCRIPTED MODEL, THEN LIVE AGAINST A CHAIN.
 *
 * Nothing here touches a network. One `fetch` answers DexScreener and GeckoTerminal from the
 * answers recorded on 2026-09-24 (with the prices a test sets), Jupiter's quote and swap in the
 * shapes the live API answered, and the Anthropic API with scripted decisions under an invented
 * model id; it throws on any other host. The live half runs on a chain double that resolves
 * lookup tables, verifies every ed25519 signature on send, charges fees and rent, runs the
 * associated-account creates, and executes Jupiter's route_v2 against a constant-product pool —
 * and on the REAL engine's fences and the REAL autopilot wallet (a keystore over Maps).
 *
 * What is proved:
 *   PAPER
 *   1.  the agent will not start unnamed, without a strategy, or without the owner's API key;
 *   2.  a tick: the snapshot, the model asked on schedule, its rationale journaled, its buys
 *       clamped and filled at Jupiter's quotes, its refusals journaled by clause, the token
 *       usage recorded; the next tick does not ask again until the schedule comes round;
 *       MEW, which has no USDC pool here as on the live API, bought on paper through one hop
 *       via SOL, and a paper route through another token or two refused by name;
 *   3.  the take profit and the stop loss fire between the model's turns, and the P&L, the
 *       win rate and the max drawdown follow the fills;
 *   4.  the model failing (500, 401, a decision with a limit in it) means no new entries, and
 *       the stop loss still fires in that same tick;
 *   5.  the daily drawdown breaker: trips, refuses the model's buys, and resets at UTC midnight;
 *       with "liquidate" it sells everything and the model is not asked;
 *   6.  pause (the model not asked, the protections still running), resume, liquidate all
 *       (everything sold, then paused), stop (what is held keeps its protections);
 *   7.  the model can change no limit and reach no withdrawal: a "withdraw" is refused and
 *       nothing moves; the spec is byte-for-byte what the owner saved;
 *   8.  the journal is capped; the state survives a restart; the API key is never stored,
 *       journaled or logged by the runner;
 *   LIVE
 *   9.  it arms only with the autopilot wallet unlocked, the vault funded ($50), SOL for fees,
 *       and the typed sentence;
 *   10. a live buy: Jupiter's transaction goes through the check before signing (the pair
 *       allowlist, the decode, the lookup tables from this RPC, custody, the engine's simulate
 *       guard, the exact input), is signed by the autopilot key — Phantom asked nothing — sent,
 *       confirmed, and its fill read back off the chain;
 *   11. hostile transactions are refused BEFORE signing, by clause: output to another wallet,
 *       a SOL drain, the wrong output mint, a second signer — the chain is sent nothing;
 *   12. a take profit sells back to USDC live, signed the same way; a locked wallet cannot sell
 *       and says so;
 *   13. the pair allowlist, on the LIVE recorded USDC → POPCAT transaction: allowed when POPCAT is in
 *       the universe, refused at pair_not_allowed when it is not; and that direct transaction
 *       passes the agent's one-hop check exactly as it passed the direct one;
 *   14. ONE HOP THROUGH SOL, on the LIVE recorded USDC → MEW and USDC → KITTY quotes and
 *       transactions (both ways): they pass — Jupiter's shared-accounts route, the SOL in the
 *       middle held in Jupiter's own account, every account the route writes in USDC, SOL or
 *       the coin — and each hostile edit is refused by name: a second intermediate, a non-SOL
 *       intermediate, a split between ways, the output redirected, stray wrapped SOL left in
 *       the wallet, the wallet's SOL spent as input, the route not matching the quote;
 *       Jupiter's own unshared build of the same buy is refused; KITTY's buy quote, 2.50% over
 *       the whole route, is refused by the 2% cap;
 *   15. a LIVE hop end to end: KITTY (no USDC pool on this chain either) bought and sold back
 *       through SOL, signed by the autopilot key, the wallet left with no wrapped SOL and its
 *       SOL moved by the fee and the rent alone; a hop built in the wallet's own account and
 *       a route that takes the wallet's SOL are refused before signing, nothing sent.
 *   REGRESSIONS (the money paths under failure)
 *   16. liquidate all sells, tick after tick, what it could not sell at once, until nothing is
 *       held or the owner resumes;
 *   17. a live buy sent with no readable outcome — landed, in fact — pauses the agent and says
 *       the tokens may be in the wallet with no stop loss;
 *   18. a worker that dies mid-tick loses neither a fill nor the model's turn, and one that
 *       dies with a live buy in flight is found out by the next;
 *   19. withdraw: the ticks stand aside during the sweep, and neither the breaker nor the max
 *       drawdown counts the money taken out;
 *   20. a deposit moves the day's base, so it does not blunt the breaker;
 *   21. Pause pressed while the model decides: that decision buys nothing.
 */
import fs from "node:fs";
import {
  AddressLookupTableAccount, ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { ed25519 } from "@noble/curves/ed25519";
import { createAgentRunner, AGENT_SPEC_STORAGE_KEY, AGENT_STATE_STORAGE_KEY, JOURNAL_MAX } from "./src/lib/agent-runner.mjs";
import { createMarket } from "./src/lib/agent-market.mjs";
import { createBrain, DECISION_TOOL_NAME } from "./src/lib/agent-brain.mjs";
import {
  createJupiterClient, checkQuote, checkSwapTransaction, loadLookupTables, lookupTableKeysOf, checkWritableCustody, checkRouteMints, checkIntermediateLeft, checkNativeSpend,
  checkOpenedCustody, checkSafeAfter, rentFromSysvar, rentExemptMinimum, rentOfOpenedAccounts, SYSVAR_RENT,
  routeShape, tokenAccountDetails, jupiterProgramAuthority, SwapCheckError, JupiterError, JUPITER_PROGRAM, JUPITER_EVENT_AUTHORITY, LOOKUP_TABLE_PROGRAM,
} from "./src/lib/jupiter-swap.mjs";
import { SOLANA_CATS, normalizeAgentSpec, agentArmSentence, allowedPairsFor, DEFAULT_SETTLEMENT_MINT, AGENT_MAX_BUY_IMPACT_PCT, AGENT_PRIORITY_FEE_LAMPORTS } from "./src/lib/agent-strategy.mjs";
import { createHawkEngine, memoryStore, SIMULATION_PIN_TRIES } from "./src/lib/engine.mjs";
import { createKeystore, createSessionSigner } from "./src/lib/session-wallet.mjs";
import { associatedTokenAddress, fromBase64, toBase64, fillFromTransaction, ATA_PROGRAM } from "./src/lib/tx.mjs";
import { createRpc } from "./src/lib/rpc.mjs";
import { TOKEN_PROGRAM, TOKEN_2022_PROGRAM } from "./vendor/executor/token2022.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}${detail ? "  — " + detail : ""}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? "  — " + detail : ""}`); }
};
const section = (title) => console.log(`\n${title}\n${"─".repeat(title.length)}`);
const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));
const DS = read("./fixtures/agent/dexscreener-tokens-cats.json");
const GT = read("./fixtures/agent/geckoterminal-ohlcv-jup-15m.json");
const MINTS = read("./fixtures/agent/cats-verified.json");
const JLIVE = read("./fixtures/agent/jupiter-usdc-popcat-swap.json");

const USDC = DEFAULT_SETTLEMENT_MINT;
const [MEW, POPCAT, KITTY, GRUMPY, KWIF] = SOLANA_CATS.map((m) => m.mint);
const WSOL = "So11111111111111111111111111111111111111112";
const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const DECIMALS = { [USDC]: 6, [USDT]: 6, [WSOL]: 9, [POPCAT]: 9, [MEW]: 5, [KITTY]: 9, [GRUMPY]: 9 };
/* THIS WORLD'S ROUTES. As on the live API (fixtures/agent/jupiter-cat-route-shapes.json),
   POPCAT has a USDC pool and MEW, KITTY and GRUMPY do not: Jupiter quotes them through SOL.
   SOL's price here is a test parameter, like every price in this world. */
const SOL_USD = 150;
const HOP_TOKENS = new Set([MEW, KITTY, GRUMPY]);
const PRICE_OF_MID = { [WSOL]: SOL_USD, [USDT]: 1 };
const KEY = "sk-test-RUNNER-KEY-never-stored-0123456789";
const MODELS = { data: [{ type: "model", id: "model-a", display_name: "Model A", created_at: "2026-09-01T00:00:00Z" }], has_more: false };
const TK = TOKEN_PROGRAM;
const COMPUTE = ComputeBudgetProgram.programId.toBase58();
const SYSTEM = SystemProgram.programId.toBase58();
const ROUTE_V2 = Buffer.from("bb64facc31c4af14", "hex");
const SHARED_ROUTE_V2 = Buffer.from("d19853937cfed8e9", "hex");
const POOL_PROGRAM = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
const RENT_ATA = 2_039_280n;
/* THIS CHAIN'S RENT: 3,480 lamports a byte-year at a threshold of 2, the rate at which a
   165-byte token account costs RENT_ATA, as its rent sysvar says. An account's minimum here
   is computed apart from the code under test. */
const RENT_RATE_BYTES = (() => { const b = Buffer.alloc(17); b.writeBigUInt64LE(3_480n, 0); b.writeDoubleLE(2, 8); b[16] = 50; return b; })();
const rentHere = (bytes) => (128n + BigInt(bytes)) * 3_480n * 2n;
/* What an outsider sends to an address first: mainnet's 0-byte minimum on 2026-09-25
   (fixtures/agent/mainnet-rent-and-slot-reads.json). And the size of the account a
   PumpSwap-like pool opens for each wallet on its first swap: PumpSwap's per-user volume
   account on the recorded LMEOW buy (fixtures/agent/jupiter-usdc-lmeow-pumpswap.json). */
const PREFUND = 650_240n;
const USER_ACCOUNT_BYTES = 137;
const newKey = () => Keypair.generate().publicKey.toBase58();
const key = (k) => new PublicKey(k).toBuffer();
const response = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: (n) => headers[String(n).toLowerCase()] ?? null }, async text() { return typeof body === "string" ? body : JSON.stringify(body); } });
const tool = (input) => ({ id: `msg_${Math.random().toString(36).slice(2)}`, type: "message", role: "assistant", model: "model-a", stop_reason: "tool_use",
  content: [{ type: "tool_use", id: "toolu_x", name: DECISION_TOOL_NAME, input }], usage: { input_tokens: 2_000, output_tokens: 150, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } });
const buy = (mint, usd, reason = "test buy") => ({ action: "buy", mint, usd, confidence: 0.6, reason });
const sell = (mint, fraction, reason = "test sell") => ({ action: "sell", mint, fraction, confidence: 0.6, reason });
const hold = (mint) => ({ action: "hold", mint, confidence: 0.5, reason: "nothing to do" });

/* ═══ THE WORLD: the feeds, Jupiter, the Anthropic API — and, for live, a chain ═══════════ */
function createWorld({ start = Date.UTC(2026, 8, 24, 12, 0, 0), wallet = null } = {}) {
  let now = start;
  const w = {
    prices: { [POPCAT]: 0.30, [MEW]: 0.50, [KITTY]: 0.07, [GRUMPY]: 150 }, decisions: [], fetched: [], anthropic: [], logs: [], notes: [], store: new Map(),
    key: KEY, jupMode: null, chain: null,
    quoteLog: [], swapBodies: [], paperVia: {},        // every quote asked (and the path a paper one took); every swap body; a token's paper route, when a test sets one
    maxAccountsBlind: new Set(),                        // tokens whose only USDC pool Jupiter drops when asked with maxAccounts (the LMEOW fixture's PumpSwap pool)
  };
  w.clock = () => now;
  w.advance = (ms) => { now += ms; };
  w.sleep = async (ms) => { now += ms; };
  w.timers = { setTimeout: () => null, clearTimeout: () => {} };
  /* Engine timers for the live half: time jumps forward, the callback runs next turn. */
  w.engineTimers = { setTimeout: (fn, ms) => { now += ms; setImmediate(fn); return 1; }, clearTimeout: () => {}, setInterval: () => null, clearInterval: () => {} };
  const dex = () => DS.body.map((p) => ({ ...p, priceUsd: w.prices[p.baseToken.address] === null ? null : String(w.prices[p.baseToken.address] ?? p.priceUsd) }));

  /* Jupiter, paper-side: a quote at the test's prices less 0.1%, in the /swap/v1 shape —
     direct for POPCAT, through SOL for the coins with no USDC pool (and through whatever a
     test puts in w.paperVia). Asked for direct routes only, those answer NO_ROUTES_FOUND,
     as the live API did; and a token in w.maxAccountsBlind, direct-only, answers
     NO_ROUTES_FOUND to any ask that carries maxAccounts, as LMEOW's PumpSwap pool did.
     Every ask is logged, a miss with no path. */
  function paperQuote(q) {
    const inDec = DECIMALS[q.inputMint], outDec = DECIMALS[q.outputMint];
    const priceOf = (m) => (m === USDC ? 1 : w.prices[m]);
    if (priceOf(q.inputMint) == null || priceOf(q.outputMint) == null) return response(400, { error: "no route", errorCode: "COULD_NOT_FIND_ANY_ROUTE" });
    const token = q.inputMint === USDC ? q.outputMint : q.inputMint;
    const via = w.paperVia[token] ?? (HOP_TOKENS.has(token) ? [WSOL] : []);
    const noRoute = () => { w.quoteLog.push({ ask: q, path: null }); return response(400, { error: "No routes found", errorCode: "NO_ROUTES_FOUND" }); };
    if (via.length && q.onlyDirectRoutes === "true") return noRoute();
    if (w.maxAccountsBlind.has(token) && "maxAccounts" in q) return noRoute();
    const usdIn = Number(q.amount) / 10 ** inDec * priceOf(q.inputMint);
    const out = BigInt(Math.floor(usdIn / priceOf(q.outputMint) * 0.999 * 10 ** outDec));
    const slip = Number(q.slippageBps);
    const path = [q.inputMint, ...(q.inputMint === USDC ? via : [...via].reverse()), q.outputMint];
    const amountAt = (i) => (i === 0 ? q.amount : i === path.length - 1 ? out.toString() : BigInt(Math.floor(usdIn / PRICE_OF_MID[path[i]] * 10 ** DECIMALS[path[i]])).toString());
    w.quoteLog.push({ ask: q, path });
    return response(200, { inputMint: q.inputMint, inAmount: q.amount, outputMint: q.outputMint, outAmount: out.toString(),
      otherAmountThreshold: ((out * BigInt(10_000 - slip) + 9_999n) / 10_000n).toString(), swapMode: q.swapMode, slippageBps: slip, platformFee: null, priceImpactPct: "0.0005",
      routePlan: path.slice(1).map((m, i) => ({ swapInfo: { ammKey: `scripted-${i}`, label: "Scripted", inputMint: path[i], outputMint: m, inAmount: amountAt(i), outAmount: amountAt(i + 1) }, percent: null, bps: 10_000 })) });
  }

  w.fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    w.fetched.push(`${init.method ?? "GET"} ${u.host}${u.pathname}`);
    if (u.host === "api.dexscreener.com") return response(200, dex());
    if (u.host === "api.geckoterminal.com") return response(200, GT.body);
    if (u.host === "api.jup.ag" && u.pathname === "/swap/v1/quote") {
      if (w.chain) { w.quoteLog.push({ ask: Object.fromEntries(u.searchParams) }); return w.chain.quote(Object.fromEntries(u.searchParams)); }
      return paperQuote(Object.fromEntries(u.searchParams));
    }
    if (u.host === "api.jup.ag" && u.pathname === "/swap/v1/swap") { w.swapBodies.push(JSON.parse(init.body)); return w.chain.swap(JSON.parse(init.body)); }
    if (u.host === "api.jup.ag" && u.pathname === "/price/v3") return response(200, {});
    if (u.host === "api.anthropic.com") {
      w.anthropic.push({ path: u.pathname, headers: init.headers, body: init.body ? JSON.parse(init.body) : null });
      if (u.pathname === "/v1/models") return response(200, MODELS);
      const next = w.decisions.shift();
      if (!next) return response(200, tool({ rationale: "Nothing scripted: hold.", actions: [] }));
      return next.status ? next : response(200, tool(next));
    }
    throw new Error(`the test network refuses ${u.host}: nothing here may leave the machine`);
  };
  w.jupiter = createJupiterClient({ fetchImpl: w.fetchImpl, clock: w.clock, sleep: w.sleep, timers: w.timers });
  w.market = createMarket({ fetchImpl: w.fetchImpl, clock: w.clock, sleep: w.sleep, timers: w.timers, jupiter: w.jupiter });
  w.brain = createBrain({ fetchImpl: w.fetchImpl, apiKey: async () => w.key, timers: w.timers });
  w.storage = { async get(k) { return w.store.has(k) ? structuredClone(w.store.get(k)) : undefined; }, async set(k, v) { w.store.set(k, structuredClone(v)); } };
  w.makeRunner = (fences = () => null) => createAgentRunner({ clock: w.clock, storage: w.storage, market: w.market, brain: w.brain, jupiter: w.jupiter, fences,
    hasApiKey: async () => Boolean(w.key), log: (l) => w.logs.push(l), notify: (n) => w.notes.push(n) });
  return w;
}
const SPEC = { name: "Paper cat", strategy: "Buy strength in POPCAT and MEW on a positive 4 h return, keep it small, cut losers fast.", universe: [POPCAT, MEW, KITTY],
  maxPositionUsd: 25, maxExposurePct: 60, stopLossPct: 8, takeProfitPct: 15, maxDailyDrawdownPct: 5, maxTradesPerDay: 6, slippageBps: 100, paperVaultUsd: 100, scheduleMinutes: 30 };
const journalOf = (runner, kind) => runner.status().journal.filter((j) => j.kind === kind);
async function clauseOf(p) { try { await p; return "resolved"; } catch (e) { return e.clause ?? e.message; } }

/* ═══ PAPER ═══════════════════════════════════════════════════════════════════════════════ */
section("1. IT WILL NOT START UNNAMED, UNDESCRIBED, OR WITHOUT THE OWNER'S KEY");
{
  const w = createWorld();
  const r = w.makeRunner();
  await r.load();
  ok("a fresh agent is stopped, in paper, and a tick does nothing", r.status().status === "stopped" && r.status().mode === "paper" && (await r.tick()).skipped === "stopped" && w.fetched.length === 0);
  ok("unnamed and undescribed, it will not start (not_ready)", await clauseOf(r.start()) === "not_ready");
  await r.saveSpec(SPEC);
  w.key = null;
  ok("without an API key it will not start (no_api_key)", await clauseOf(r.start()) === "no_api_key");
  w.key = KEY;
  const st = await r.start();
  ok("with both it starts, in PAPER, with a $100 paper vault", st.status === "running" && st.mode === "paper" && r.state().paper.settlementUsd === 100);
  ok("the spec it saved is the owner's, and the stored copy matches", w.store.get(AGENT_SPEC_STORAGE_KEY).name === "Paper cat" && JSON.stringify(w.store.get(AGENT_SPEC_STORAGE_KEY).universe) === JSON.stringify([POPCAT, MEW, KITTY]));
}

section("2. A TICK: SNAPSHOT, THE MODEL, THE LIMITS, PAPER FILLS, THE JOURNAL");
const P = createWorld();
const paper = P.makeRunner();
{
  await paper.saveSpec(SPEC);
  await paper.start();
  P.decisions.push({ rationale: "POPCAT and MEW trend up on the 4 h; KITTY is flat. Small buys; SOL is not mine to trade.", actions: [
    buy(POPCAT, 20, "4 h return positive, RSI 55"), buy(MEW, 100, "strongest trend"), hold(KITTY), buy(WSOL, 20, "SOL"),
  ] });
  const t = await paper.tick();
  const st = paper.status();
  const decision = journalOf(paper, "decision")[0];
  ok("the model was asked on the first tick, and its rationale is journaled", t.asked === true && decision?.rationale.startsWith("POPCAT and MEW trend up") && decision.model === "model-a" && decision.toolChoice === "forced");
  const req = P.anthropic.find((a) => a.path === "/v1/messages");
  const ctx = JSON.parse(req.body.messages[0].content.replace(/^[^\n]*\n/, ""));
  ok("the model saw the snapshot: every universe token with its price, changes, liquidity and indicators", ctx.market.length === 3 && ctx.market.every((m) => m.priceUsd > 0 && m.indicators?.bars === 100) && ctx.market[0].symbol === "POPCAT");
  ok("…the vault, the limits (read-only), the day and no positions yet", ctx.vault.equityUsd === 100 && ctx.limits.maxPositionUsd === 25 && ctx.limits.minTradeUsd === 10 && ctx.vault.tradesLeftToday === 6 && ctx.positions.length === 0);
  ok("…and the owner's strategy in the system prompt", req.body.system.includes(SPEC.strategy));
  ok("…the agency's lessons in the system prompt, and no buy-and-hold figure before a start price exists", req.body.system.includes("The bar is buy-and-hold") && ctx.versusBuyAndHold === null && ctx.limits.minBuyConfidence === 0.6);
  const fills = journalOf(paper, "fill");
  ok("two paper buys filled at Jupiter's quotes: POPCAT $20, and MEW clamped from $100 to the $25 per-token cap", fills.length === 2 && fills.some((f) => f.symbol === "POPCAT" && f.usd === 20 && f.paper) && fills.some((f) => f.symbol === "MEW" && f.usd === 25 && f.paper && f.signature === null));
  ok("…the POPCAT fill is the quote's: $20 at $0.30 less 0.1% is 66.6 POPCAT", st.positions.find((p) => p.symbol === "POPCAT")?.qty === 66.6);
  ok("the SOL buy was refused by the format (not_in_universe) and journaled", journalOf(paper, "refusal").some((x) => x.clause === "not_in_universe" && x.from === "format"));
  ok("the decision's outcomes say what became of each action", ["POPCAT buy: filled", "MEW buy: filled", "KITTY hold: held"].every((o) => decision.outcomes.some((x) => `${x.symbol} ${x.action}: ${x.outcome}` === o)) && decision.outcomes.find((x) => x.symbol === "MEW").clampedBy.join() === "position_cap");
  ok("the paper vault paid $45: $55 of USDC left, $100 of equity less the 0.1%", st.vault.settlementUsd === 55 && Math.abs(st.vault.equityUsd - 99.955) < 0.01, JSON.stringify(st.vault));
  ok("the token usage is recorded: one call, its tokens", st.usage.calls === 1 && st.usage.inputTokens === 2_000 && st.usage.outputTokens === 150 && decision.usage.inputTokens === 2_000);
  ok("two trades counted today; the next decision is 30 minutes after this one", st.day.trades === 2 && paper.state().nextBrainAt - paper.state().lastBrainAt === 30 * 60_000);
  P.advance(30_000);
  const calls = P.anthropic.length;
  await paper.tick();
  ok("half a minute later the model is not asked again", P.anthropic.length === calls && journalOf(paper, "decision").length === 1);
  ok("…and no candles were read for a tick that did not ask it", P.fetched.filter((f) => f.includes("geckoterminal")).length === 3);
  const mewAsks = P.quoteLog.filter((x) => x.ask.outputMint === MEW);
  const [mewDirect, mewAsk] = mewAsks;
  ok("MEW has no USDC pool here, as on the live API: asked direct first (no route), then for one hop at most (not direct only, maxAccounts 24), which came back USDC → SOL → MEW",
    mewAsks.length === 2 && mewDirect.path === null && mewDirect.ask.onlyDirectRoutes === "true" && !("maxAccounts" in mewDirect.ask)
    && mewAsk?.ask.onlyDirectRoutes === "false" && mewAsk.ask.maxAccounts === "24" && mewAsk.ask.restrictIntermediateTokens === "true" && mewAsk.path.join() === [USDC, WSOL, MEW].join(), JSON.stringify(mewAsks.map((x) => x.ask)));
  ok("…while POPCAT, which has one, was asked direct only, once, as before", P.quoteLog.filter((x) => x.ask.outputMint === POPCAT).map((x) => `${x.ask.onlyDirectRoutes}/${"maxAccounts" in x.ask}/${Boolean(x.path)}`).join() === "true/false/true");
  ok("…and that paper buy of MEW filled at the hop's quote, like any other", fills.some((f) => f.symbol === "MEW" && f.usd === 25 && f.paper) && st.positions.find((p) => p.symbol === "MEW")?.qty > 49.9);
}
{
  /* A paper route the agent may not take is refused by name, as a live one is: the quote is the same. */
  const w = createWorld();
  const r = w.makeRunner();
  await r.saveSpec({ ...SPEC, name: "Detour cat" });
  await r.start();
  w.paperVia[MEW] = [USDT];                                       // MEW quoted through USDT
  w.paperVia[KITTY] = [USDT, WSOL];                               // KITTY through USDT, then SOL
  w.decisions.push({ rationale: "Buy MEW and KITTY.", actions: [buy(MEW, 20), buy(KITTY, 20)] });
  await r.tick();
  const refused = (sym) => journalOf(r, "refusal").find((x) => x.symbol === sym && x.from === "execution")?.clause;
  ok("a paper route through USDT is refused at route_intermediate_not_sol, one through USDT and then SOL at route_too_many_hops; nothing fills",
    refused("MEW") === "route_intermediate_not_sol" && refused("KITTY") === "route_too_many_hops" && r.status().positions.length === 0 && r.state().paper.settlementUsd === 100);
}

section("3. THE PROTECTIONS FIRE BETWEEN THE MODEL'S TURNS");
{
  P.prices[POPCAT] = 0.35;                     // +16.7% on a $0.3003 entry: over the 15% take profit
  P.advance(30_000);
  await paper.tick();
  const tp = journalOf(paper, "fill").find((f) => f.side === "sell" && f.symbol === "POPCAT");
  ok("POPCAT up 16.7%: sold at the take profit, on the half-minute tick, the model not asked", tp?.protection === "take_profit" && journalOf(paper, "decision").length === 1);
  const st = paper.status();
  ok("the round trip is booked: a win, realized P&L positive, win rate 100%", st.pnl.wins === 1 && st.pnl.losses === 0 && st.pnl.realizedUsd > 3 && st.pnl.winRatePct === 100, `${st.pnl.realizedUsd}`);
  ok("the protection's sell did not use up a model trade", st.day.trades === 2);
  P.prices[MEW] = 0.455;                    // −9% on the $0.5005 entry: past the 8% stop
  P.advance(30_000);
  await paper.tick();
  const sl = journalOf(paper, "fill").find((f) => f.side === "sell" && f.symbol === "MEW");
  const st2 = paper.status();
  ok("MEW down 9%: sold at the stop loss", sl?.protection === "stop_loss" && st2.positions.length === 0);
  ok("a win and a loss: win rate 50%, and the max drawdown recorded", st2.pnl.wins === 1 && st2.pnl.losses === 1 && st2.pnl.winRatePct === 50 && st2.pnl.maxDrawdownPct > 0, `max DD ${st2.pnl.maxDrawdownPct}%`);
  ok("the closed trades carry their reasons", st2.pnl.closed.map((c) => c.reason).sort().join() === "stop_loss,take_profit");
  const vs = st2.pnl.versusBuyAndHold;
  const holdPct = ((0.35 / 0.30 + 0.455 / 0.50 + 1) / 3 - 1) * 100;
  ok("buy and hold is the bar: the universe held equally from the first tick's prices is +2.56%, set beside the agent's return", vs && Math.abs(vs.holdReturnPct - holdPct) < 0.01 && Math.abs(vs.edgePct - (vs.agentReturnPct - vs.holdReturnPct)) < 0.02, JSON.stringify(vs));
}

section("4. THE MODEL FAILING MEANS NO NEW ENTRIES, AND THE PROTECTIONS STILL RUN");
{
  P.prices[MEW] = 0.50;
  P.decisions.push({ rationale: "Buy MEW again.", actions: [buy(MEW, 20)] });
  await paper.runNow();
  await paper.tick();
  ok("a fresh MEW position to protect", paper.status().positions.some((p) => p.symbol === "MEW"));
  const decisionsBefore = journalOf(paper, "decision").length;
  P.decisions.push(response(500, { type: "error", error: { type: "api_error", message: "internal" } }));
  P.prices[MEW] = 0.45;                     // −10%: the stop
  P.advance(30 * 60_000);
  await paper.tick();
  const failure = journalOf(paper, "brain_failure")[0];
  ok("the model answered 500: journaled as brain_failure (server), no decision, no buy", failure?.clause === "server" && journalOf(paper, "decision").length === decisionsBefore);
  ok("…and in that same tick the stop loss sold MEW", journalOf(paper, "fill")[0]?.protection === "stop_loss" && paper.status().positions.length === 0);
  P.decisions.push(response(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
  P.advance(30 * 60_000);
  await paper.tick();
  ok("a 401 is journaled as unauthorized, telling the owner to check the key", journalOf(paper, "brain_failure")[0]?.clause === "unauthorized" && /check it in Options/.test(journalOf(paper, "brain_failure")[0].message));
  const specBefore = JSON.stringify(paper.spec());
  P.decisions.push({ rationale: "Raise the per-token cap and buy big.", actions: [buy(POPCAT, 500)], limits: { maxPositionUsd: 1_000_000 } });
  P.advance(30 * 60_000);
  await paper.tick();
  ok("a decision carrying a limit is refused whole (unexpected_field): nothing bought", journalOf(paper, "brain_failure")[0]?.clause === "unexpected_field" && paper.status().positions.length === 0);
  ok("…and the spec is exactly what the owner saved, in memory and in storage", JSON.stringify(paper.spec()) === specBefore && JSON.stringify(P.store.get(AGENT_SPEC_STORAGE_KEY)) === specBefore);
  ok("failures are counted in the usage", paper.status().usage.failures === 3);
}

section("5. THE DAILY DRAWDOWN BREAKER, AND UTC MIDNIGHT");
{
  const w = createWorld({ start: Date.UTC(2026, 8, 24, 20, 0, 0) });
  const r = w.makeRunner();
  await r.saveSpec({ ...SPEC, name: "Breaker cat", maxDailyDrawdownPct: 3 });
  await r.start();
  w.decisions.push({ rationale: "Load up within the caps.", actions: [buy(POPCAT, 25), buy(MEW, 25), buy(KITTY, 25)] });
  await r.tick();
  ok("three buys: $25, $25, and $10 left under the 60% exposure cap", r.status().positions.length === 3 && Math.abs(r.status().vault.positionsUsd - 59.94) < 0.1, `${r.status().vault.positionsUsd}`);
  for (const m of [POPCAT, MEW, KITTY]) w.prices[m] *= 0.93;        // −7% each: under every stop, but $4.2 of a $100 day
  w.advance(30_000);
  await r.tick();
  const b = journalOf(r, "breaker")[0];
  ok("down about 4.2% on the UTC day against a 3% limit: the breaker trips and says so", b && b.drawdownPct > 3 && r.status().day.tripped === true && w.notes.some((n) => /breaker tripped/.test(n.title)));
  ok("…'stop entries' sells nothing", r.status().positions.length === 3);
  w.decisions.push({ rationale: "Buy the dip.", actions: [buy(GRUMPY, 20), sell(POPCAT, 1)] });
  await r.runNow();
  w.advance(30_000);
  await r.tick();
  ok("after the trip the model's sell still goes through; its buy of GRUMPY, outside this universe, is refused first at not_in_universe",
    journalOf(r, "fill")[0]?.side === "sell" && journalOf(r, "refusal")[0]?.clause === "not_in_universe");
  w.decisions.push({ rationale: "Buy the dip in POPCAT.", actions: [buy(POPCAT, 15)] });
  await r.runNow();
  w.advance(30_000);
  await r.tick();
  ok("a buy of a listed token after the trip: refused at drawdown_breaker, naming UTC midnight", journalOf(r, "refusal")[0]?.clause === "drawdown_breaker" && /UTC midnight/.test(journalOf(r, "refusal")[0].message));
  w.advance(Date.UTC(2026, 8, 25, 0, 0, 5) - w.clock());           // past UTC midnight
  w.decisions.push({ rationale: "A new day.", actions: [buy(POPCAT, 15)] });
  await r.runNow();
  await r.tick();
  ok("after UTC midnight the day starts over: the breaker is reset and the buy fills", journalOf(r, "day").length === 1 && r.status().day.tripped === false && journalOf(r, "fill")[0]?.side === "buy" && journalOf(r, "fill")[0].symbol === "POPCAT");

  const w2 = createWorld();
  const r2 = w2.makeRunner();
  await r2.saveSpec({ ...SPEC, name: "Liquidating cat", maxDailyDrawdownPct: 3, drawdownAction: "liquidate" });
  await r2.start();
  w2.decisions.push({ rationale: "Buy.", actions: [buy(POPCAT, 25), buy(MEW, 25)] });
  await r2.tick();
  for (const m of [POPCAT, MEW]) w2.prices[m] *= 0.93;
  w2.advance(30 * 60_000);
  const asked = w2.anthropic.length;
  await r2.tick();
  ok("with 'liquidate', the trip sells every position back to USDC", r2.status().positions.length === 0 && journalOf(r2, "fill").filter((f) => f.protection === "drawdown_liquidate").length === 2);
  ok("…and the model is not asked for the rest of the UTC day", w2.anthropic.length === asked && journalOf(r2, "skipped")[0]?.message.includes("not asked again until UTC midnight"));
}

section("6. PAUSE, RESUME, LIQUIDATE ALL, STOP");
{
  const w = createWorld();
  const r = w.makeRunner();
  await r.saveSpec({ ...SPEC, name: "Control cat" });
  await r.start();
  w.decisions.push({ rationale: "Buy two.", actions: [buy(POPCAT, 20), buy(MEW, 20)] });
  await r.tick();
  await r.pause();
  w.advance(60 * 60_000);
  const asked = w.anthropic.length;
  w.prices[MEW] = 0.40;                                          // −20%
  await r.tick();
  ok("paused: the model is not asked, however late the schedule", r.status().status === "paused" && w.anthropic.length === asked);
  ok("…and the stop loss still fires", journalOf(r, "fill")[0]?.protection === "stop_loss" && journalOf(r, "fill")[0].symbol === "MEW");
  await r.resume();
  w.decisions.push({ rationale: "Back.", actions: [buy(KITTY, 15)] });
  await r.tick();
  ok("resumed: the model is asked again at once (its turn was overdue)", r.status().status === "running" && w.anthropic.length > asked && r.status().positions.some((p) => p.symbol === "KITTY"));
  const out = await r.liquidateAll();
  ok("liquidate all: every position sold back to USDC through the same path, then paused", out.done.length === 2 && out.done.every((d) => d.sold) && r.status().positions.length === 0 && r.status().status === "paused");
  ok("…journaled as the owner's control", journalOf(r, "control")[0]?.action === "liquidate_all" && journalOf(r, "fill").slice(0, 2).every((f) => f.protection === "liquidate_all"));
  await r.resume();
  w.decisions.push({ rationale: "One more.", actions: [buy(POPCAT, 12)] });
  await r.runNow();
  await r.tick();
  await r.stop();
  w.prices[POPCAT] = 0.20;
  w.advance(30_000);
  await r.tick();
  ok("stopped: what is still held keeps its stop loss", r.status().status === "stopped" && r.status().positions.length === 0 && journalOf(r, "fill")[0]?.protection === "stop_loss");
  w.advance(30_000);
  const n = w.fetched.length;
  await r.tick();
  ok("…and a stopped agent holding nothing asks nothing of anyone", w.fetched.length === n);
}

section("7. THE MODEL CAN CHANGE NO LIMIT AND REACH NO WITHDRAWAL");
{
  const w = createWorld();
  let fenceCalls = 0;
  const r = w.makeRunner(() => { fenceCalls++; return null; });
  await r.saveSpec({ ...SPEC, name: "Honest cat" });
  const saved = JSON.stringify(r.spec());
  await r.start();
  w.decisions.push({ rationale: "Send everything home and loosen the stop.", actions: [
    { action: "withdraw", mint: POPCAT, usd: 100, confidence: 1, reason: "home" },
    { action: "sweep", mint: POPCAT, confidence: 1, reason: "home" },
    buy(POPCAT, 1_000, "all in"),
  ] });
  await r.tick();
  ok("withdraw and sweep are not actions: refused by name (action_unknown)", journalOf(r, "refusal").filter((x) => x.clause === "action_unknown").length === 2);
  ok("the $1,000 buy is clamped to the $25 the owner set", journalOf(r, "fill")[0]?.usd === 25);
  ok("in paper the fences — the only way to the wallet — were never even asked for", fenceCalls === 0);
  ok("the spec is byte-for-byte the owner's", JSON.stringify(r.spec()) === saved);
  const runnerSource = fs.readFileSync(new URL("./src/lib/agent-runner.mjs", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
  ok("the runner's code names no sweep builder and no transfer: there is no path from a decision to a withdrawal",
    !/buildSweepTransaction|buildTokenSweepTransaction|autopilotSweep|SystemProgram|TransferChecked|session-wallet/.test(runnerSource));
}

section("8. THE JOURNAL IS CAPPED; THE STATE SURVIVES; THE KEY IS NEVER KEPT");
{
  const w = createWorld();
  const r = w.makeRunner();
  await r.saveSpec({ ...SPEC, name: "Chatty cat", scheduleMinutes: 15 });
  await r.start();
  for (let i = 0; i < 170; i++) {
    w.decisions.push({ rationale: `Tick ${i}: hold everything.`, actions: [hold(POPCAT), { action: "withdraw", mint: MEW, confidence: 1, reason: "a refusal to journal" }] });
    w.advance(15 * 60_000);
    await r.tick();
  }
  ok(`the journal keeps at most ${JOURNAL_MAX} entries, newest first`, r.state().journal.length === JOURNAL_MAX && r.state().journal.find((j) => j.kind === "decision").rationale === "Tick 169: hold everything.", `${r.state().journal.length}`);
  const again = w.makeRunner();
  await again.load();
  ok("a new runner over the same storage resumes the same agent: running, its journal, its usage", again.status().status === "running" && again.state().journal.length === JOURNAL_MAX && again.status().usage.calls === r.status().usage.calls && r.status().usage.calls >= 170,
    `${again.status().status}, ${again.state().journal.length}, ${again.status().usage.calls} of ${r.status().usage.calls}`);
  const everything = JSON.stringify([...w.store.entries()]) + w.logs.join("\n") + JSON.stringify(w.notes);
  ok("the owner's API key is in no stored state, no journal entry, no log line and no notification", !everything.includes(KEY) && w.anthropic.every((a) => a.headers["x-api-key"] === KEY));
  ok("the key was sent only to the Anthropic API, and only in its header", w.fetched.filter((f) => f.includes("anthropic")).every((f) => /api\.anthropic\.com\/v1\//.test(f)));
  ok("the state is small enough for chrome.storage.local", JSON.stringify(w.store.get(AGENT_STATE_STORAGE_KEY)).length < 2_000_000, `${(JSON.stringify(w.store.get(AGENT_STATE_STORAGE_KEY)).length / 1024).toFixed(0)} KB`);
}

/* ═══ LIVE ═══════════════════════════════════════════════════════════════════════════════ */
/** A classic SPL mint and a token account, in bytes. */
function tokenAccountBytes({ mint, owner, amount, delegate = null }) {
  const b = Buffer.alloc(165);
  key(mint).copy(b, 0); key(owner).copy(b, 32); b.writeBigUInt64LE(BigInt(amount), 64);
  if (delegate) { b.writeUInt32LE(1, 72); key(delegate).copy(b, 76); b.writeBigUInt64LE(BigInt(amount), 121); }
  b[108] = 1;
  return b;
}
function altBytes(addresses) {
  const b = Buffer.alloc(56 + 32 * addresses.length);
  b.writeUInt32LE(1, 0); b.writeBigUInt64LE(2n ** 64n - 1n, 4); b.writeBigUInt64LE(1n, 12);
  addresses.forEach((a, i) => key(a).copy(b, 56 + 32 * i));
  return b;
}
const altObject = (address, addresses) => new AddressLookupTableAccount({ key: new PublicKey(address), state: AddressLookupTableAccount.deserialize(altBytes(addresses)) });
const mintAccount = (mint) => { const t = MINTS.tokens.find((x) => x.mint === mint); return { owner: t.rpc.owner, lamports: t.rpc.lamports, data: t.rpc.data }; };

/** The chain: the recorded live mint accounts of USDC, POPCAT, MEW and KITTY, the wallet,
 *  pools — POPCAT and MEW against USDC, SOL against USDC, KITTY against SOL only (as on the
 *  live API: no KITTY/USDC pool) — and Jupiter, with program authority 3's own accounts for
 *  its shared-accounts route. Its rent sysvar says RENT_RATE_BYTES. `pumpLike` tokens get a
 *  USDC pool like LMEOW's PumpSwap one: Jupiter quotes it only when asked without
 *  maxAccounts, and the pool opens an account for each wallet on its first swap, the wallet
 *  paying the rent (topping up an address sent SOL first, as Anchor's init does). The
 *  associated-token program here tops a pre-funded address up too, as the real one does. */
const JUP_AUTHORITY_ID = 3;
const userAccountOf = (user) => PublicKey.findProgramAddressSync([Buffer.from("user_volume_accumulator"), key(user)], new PublicKey(POOL_PROGRAM))[0].toBase58();
function createChain(w, { wallet, usdcRaw = 100_000_000n, lamports = 100_000_000n, pumpLike = [] }) {
  const ATTACKER = newKey();
  const st = { lamports: new Map([[wallet, lamports]]), tokens: new Map(), pools: new Map(), other: new Map(), alts: new Map(), sent: new Map(), calls: [], slot: 451_000_000, blockHeight: 429_000_000,
    beforeSim: null, maxAccountsBlind: new Set(pumpLike) };
  const ataOf = (owner, mint) => associatedTokenAddress(owner, mint, TK);
  st.tokens.set(ataOf(wallet, USDC), { mint: USDC, owner: wallet, amount: usdcRaw, delegate: null, lamports: RENT_ATA });
  const ALT = newKey();
  st.alts.set(ALT, [JUPITER_EVENT_AUTHORITY]);
  /* Each pool holds $1,000,000 a side at the price given (the quote side's own USD price). */
  const addPool = (token, priceUsd, quoteMint = USDC, quoteUsd = 1, extra = {}) => {
    const address = newKey(), authority = newKey(), vQuote = newKey(), vToken = newKey();
    const quoteReserve = BigInt(Math.round(1_000_000 / quoteUsd * 10 ** DECIMALS[quoteMint]));
    const tokenReserve = BigInt(Math.round(1_000_000 / priceUsd * 10 ** DECIMALS[token]));
    st.tokens.set(vQuote, { mint: quoteMint, owner: authority, amount: quoteReserve, delegate: null, lamports: RENT_ATA });
    st.tokens.set(vToken, { mint: token, owner: authority, amount: tokenReserve, delegate: null, lamports: RENT_ATA });
    st.pools.set(address, { token, quoteMint, quoteReserve, tokenReserve, vQuote, vToken, feeBps: 25, opensUserAccount: false, hostile: null, ...extra });
    st.alts.set(ALT, [...st.alts.get(ALT), address, vQuote, vToken]);
  };
  addPool(POPCAT, 0.30); addPool(MEW, 0.50); addPool(WSOL, SOL_USD); addPool(KITTY, 0.07, WSOL, SOL_USD);
  for (const token of pumpLike) addPool(token, w.prices[token], USDC, 1, { opensUserAccount: true });
  /* Jupiter's program authority 3 and its own associated accounts, as the live shared routes had. */
  const JUP_AUTH = PublicKey.findProgramAddressSync([Buffer.from("authority"), Buffer.from([JUP_AUTHORITY_ID])], new PublicKey(JUPITER_PROGRAM))[0].toBase58();
  for (const mint of [USDC, WSOL, KITTY, POPCAT, MEW]) st.tokens.set(ataOf(JUP_AUTH, mint), { mint, owner: JUP_AUTH, amount: 0n, delegate: null, lamports: RENT_ATA });
  st.alts.set(ALT, [...st.alts.get(ALT), ...[USDC, WSOL, KITTY].map((m) => ataOf(JUP_AUTH, m))]);
  const clone = () => ({ ...st, lamports: new Map(st.lamports), tokens: new Map([...st.tokens].map(([k, v]) => [k, { ...v }])), pools: new Map([...st.pools].map(([k, v]) => [k, { ...v }])),
    other: new Map([...st.other].map(([k, v]) => [k, { ...v }])) });
  const accountOf = (address, s = st) => {
    const a = String(address);
    if ([USDC, POPCAT, MEW, KITTY, GRUMPY].includes(a)) return mintAccount(a);
    if (s.other.has(a)) { const o = s.other.get(a); return { owner: o.owner, lamports: Number(o.lamports), data: [o.data.toString("base64"), "base64"] }; }
    if (a === SYSVAR_RENT) return { owner: "Sysvar1111111111111111111111111111111111111", lamports: 1_009_200, data: [RENT_RATE_BYTES.toString("base64"), "base64"] };
    if (s.alts.has(a)) return { owner: LOOKUP_TABLE_PROGRAM, lamports: 1_000_000, data: [altBytes(s.alts.get(a)).toString("base64"), "base64"] };
    if (s.tokens.has(a)) { const t = s.tokens.get(a); return { owner: TK, lamports: Number(t.lamports), data: [tokenAccountBytes(t).toString("base64"), "base64"] }; }
    if (s.lamports.has(a)) return { owner: SYSTEM, lamports: Number(s.lamports.get(a)), data: ["", "base64"] };
    if (s.pools.has(a)) return { owner: POOL_PROGRAM, lamports: 2_000_000, data: [Buffer.alloc(64).toString("base64"), "base64"] };
    return null;
  };
  /* A PumpSwap-like pool opening the wallet's own account on its first swap, the wallet paying:
     an address sent SOL first is topped up to the minimum. A hostile pool program keeps
     1,000,000 lamports more of the wallet's in it ("overfund"), or opens a wrapped-SOL token
     account of the wallet's there instead ("wallet_token"). */
  const openUserAccount = (s, address, payer, pool) => {
    if (s.other.has(address) || s.tokens.has(address)) return;
    const had = s.lamports.get(address) ?? 0n;
    const bal = s.lamports.get(payer) ?? 0n;
    if (pool.hostile === "wallet_token") {
      const need = RENT_ATA > had ? RENT_ATA - had : 0n;
      s.lamports.set(payer, bal - need); s.lamports.delete(address);
      s.tokens.set(address, { mint: WSOL, owner: payer, amount: 0n, delegate: null, lamports: had > RENT_ATA ? had : RENT_ATA });
      return;
    }
    const min = rentHere(USER_ACCOUNT_BYTES);
    const target = (had > min ? had : min) + (pool.hostile === "overfund" ? 1_000_000n : 0n);
    if (bal < target - had) throw new Error("insufficient lamports for the user account");
    s.lamports.set(payer, bal - (target - had)); s.lamports.delete(address);
    s.other.set(address, { owner: POOL_PROGRAM, lamports: target, data: Buffer.alloc(USER_ACCOUNT_BYTES) });
  };
  const poolOf = (a, b, s = st) => [...s.pools.entries()].find(([, p]) => (a === p.quoteMint && p.token === b) || (b === p.quoteMint && p.token === a)) ?? null;
  const cpmm = (p, inMint, amountIn) => {
    const inNet = BigInt(amountIn) * BigInt(10_000 - p.feeBps) / 10_000n;
    const [rin, rout] = inMint === p.quoteMint ? [p.quoteReserve, p.tokenReserve] : [p.tokenReserve, p.quoteReserve];
    return rout * inNet / (rin + inNet);
  };
  /* One pool swap, reserves moved: `amountIn` of `inMint` in, the output returned. */
  const trade = (p, inMint, amountIn) => {
    const out = cpmm(p, inMint, amountIn);
    if (inMint === p.quoteMint) { p.quoteReserve += amountIn; p.tokenReserve -= out; } else { p.tokenReserve += amountIn; p.quoteReserve -= out; }
    return out;
  };
  function execute(bytes, s, { verify }) {
    const tx = VersionedTransaction.deserialize(bytes);
    const msg = tx.message;
    const tables = (msg.addressTableLookups ?? []).map((l) => { const addrs = s.alts.get(l.accountKey.toBase58()); if (!addrs) throw new Error("lookup table not found"); return altObject(l.accountKey.toBase58(), addrs); });
    const m = TransactionMessage.decompile(msg, { addressLookupTableAccounts: tables });
    const staticKeys = msg.staticAccountKeys.map((k) => k.toBase58());
    const nSig = msg.header.numRequiredSignatures;
    const signers = new Set(staticKeys.slice(0, nSig));
    if (verify) for (let i = 0; i < nSig; i++) if (!ed25519.verify(tx.signatures[i], msg.serialize(), new PublicKey(staticKeys[i]).toBytes())) throw new Error(`SignatureFailure: ${staticKeys[i]}`);
    let limit = 200_000n, price = 0n;
    for (const ix of m.instructions) if (ix.programId.toBase58() === COMPUTE) { const d = Buffer.from(ix.data); if (d[0] === 2) limit = BigInt(d.readUInt32LE(1)); if (d[0] === 3) price = d.readBigUInt64LE(1); }
    const fee = 5_000n * BigInt(nSig) + (price * limit + 999_999n) / 1_000_000n;
    const payer = staticKeys[0];
    const bal = (k) => s.lamports.get(k) ?? 0n;
    if (bal(payer) < fee) throw new Error("InsufficientFundsForFee");
    s.lamports.set(payer, bal(payer) - fee);
    for (const ix of m.instructions) {
      const program = ix.programId.toBase58();
      const k = ix.keys.map((x) => x.pubkey.toBase58());
      if (program === COMPUTE) continue;
      if (program === ATA_PROGRAM) {
        const [payerKey, ata, owner, mint] = k;
        if (s.tokens.has(ata)) continue;
        if (associatedTokenAddress(owner, mint, TK) !== ata) throw new Error("the ATA address does not derive");
        /* As the associated-token program does: an address already holding lamports is topped
           up to the minimum, and the payer charged the difference only. */
        const had = s.lamports.get(ata) ?? 0n;
        const need = RENT_ATA > had ? RENT_ATA - had : 0n;
        if (bal(payerKey) < need) throw new Error("insufficient lamports for rent");
        s.lamports.set(payerKey, bal(payerKey) - need);
        s.lamports.delete(ata);
        s.tokens.set(ata, { mint, owner, amount: 0n, delegate: null, lamports: had > RENT_ATA ? had : RENT_ATA });
        continue;
      }
      if (program === SYSTEM) {
        const d = Buffer.from(ix.data); const amount = d.readBigUInt64LE(4);
        if (!signers.has(k[0])) throw new Error("MissingRequiredSignature");
        s.lamports.set(k[0], bal(k[0]) - amount); s.lamports.set(k[1], bal(k[1]) + amount);
        continue;
      }
      if (program === JUPITER_PROGRAM && Buffer.from(ix.data).subarray(0, 8).equals(SHARED_ROUTE_V2)) {
        /* The shared-accounts hop, as the live ones ran: the wallet's input into Jupiter's
           account, pool one into Jupiter's wrapped-SOL account, pool two out of it, and the
           output back to the wallet. A route whose accounts end with the wallet again takes
           3,000,000 of its lamports on the way (the hostile "hop_sol_input"). */
        const d = Buffer.from(ix.data);
        const amount = d.readBigUInt64LE(9), quotedOut = d.readBigUInt64LE(17), slip = d.readUInt16LE(25);
        const [, authority, srcAta, jIn, jOut, dstAta, srcMint, dstMint] = k;
        if (!signers.has(authority)) throw new Error("the route's authority did not sign");
        const src = s.tokens.get(srcAta), dst = s.tokens.get(dstAta), sol = s.tokens.get(k[17]);
        if (!src || src.mint !== srcMint || src.owner !== authority) throw new Error("bad source");
        if (!dst || dst.mint !== dstMint) throw new Error("bad destination");
        if (src.amount < amount) throw new Error("InsufficientFunds");
        src.amount -= amount; s.tokens.get(jIn).amount += amount;
        const mid = trade(s.pools.get(k[13]), srcMint, amount);
        s.tokens.get(jIn).amount -= amount; sol.amount += mid;
        const out = trade(s.pools.get(k[19]), WSOL, mid);
        sol.amount -= mid; s.tokens.get(jOut).amount += out;
        if (out < quotedOut * BigInt(10_000 - slip) / 10_000n) throw new Error("SlippageToleranceExceeded");
        s.tokens.get(jOut).amount -= out; dst.amount += out;
        if (k[k.length - 1] === authority) { s.lamports.set(authority, bal(authority) - 3_000_000n); }
        continue;
      }
      if (program === JUPITER_PROGRAM) {
        const d = Buffer.from(ix.data);
        const amount = d.readBigUInt64LE(8), quotedOut = d.readBigUInt64LE(16), slip = d.readUInt16LE(24);
        const [authority, srcAta, dstAta, srcMint, dstMint] = k;
        if (!signers.has(authority)) throw new Error("the route's authority did not sign");
        const src = s.tokens.get(srcAta), dst = s.tokens.get(dstAta);
        if (!src || src.mint !== srcMint || src.owner !== authority) throw new Error("bad source");
        if (!dst || dst.mint !== dstMint) throw new Error("bad destination");
        if (src.amount < amount) throw new Error("InsufficientFunds");
        const p = s.pools.get(k[12]);
        const out = trade(p, srcMint, amount);
        if (out < quotedOut * BigInt(10_000 - slip) / 10_000n) throw new Error("SlippageToleranceExceeded");
        src.amount -= amount; dst.amount += out;
        if (p.opensUserAccount) { if (k[15] !== userAccountOf(authority)) throw new Error("the pool's user account does not derive"); openUserAccount(s, k[15], authority, p); }
        continue;
      }
      throw new Error(`the chain double does not run ${program}`);
    }
    return { fee };
  }
  const rpc = {
    url: "https://chain.double",
    async getMultipleAccounts(addresses) { st.calls.push("gma"); return { slot: st.slot, accounts: addresses.map((a) => accountOf(a)) }; },
    async getBalance(a) { return st.lamports.get(String(a)) ?? 0n; },
    async getTokenAccountBalance(a) { return st.tokens.get(String(a))?.amount ?? 0n; },
    async getLatestBlockhash() { return { blockhash: bs58.encode(Buffer.alloc(32, 7)), lastValidBlockHeight: st.blockHeight + 150 }; },
    async getBlockHeight() { return st.blockHeight; },
    /* `st.beforeSim`, when a test sets it, runs first: another transaction of the same wallet
       landing between the guard's read and its simulation. The simulation answers with the
       slot it ran on, as rpc.mjs now passes on. */
    async simulateTransaction(txBase64, { addresses = [] } = {}) {
      st.calls.push("sim");
      if (st.beforeSim) st.beforeSim(st);
      const s = clone();
      try { execute(fromBase64(txBase64), s, { verify: false }); return { err: null, logs: [], unitsConsumed: 150_000, accounts: addresses.map((a) => accountOf(a, s)), contextSlot: st.slot }; }
      catch (error) { return { err: { InstructionError: [3, { Custom: 1 }] }, logs: [`Program log: ${error.message}`], accounts: null, contextSlot: st.slot }; }
    },
    /* The landed transaction as getTransaction reads it: balances for EVERY account it names,
       in its own key order (the static keys, then the lookup tables' writable and read-only
       addresses), those keys, and the token balances of the token accounts among them. */
    async sendTransaction(txBase64) {
      st.calls.push("send");
      const bytes = fromBase64(txBase64);
      const tx = VersionedTransaction.deserialize(bytes);
      const sig = bs58.encode(tx.signatures[0]);
      if (st.sent.has(sig)) return sig;
      const lookups = (tx.message.addressTableLookups ?? []).map((l) => altObject(l.accountKey.toBase58(), st.alts.get(l.accountKey.toBase58()) ?? []));
      const keys = tx.message.getAccountKeys({ addressLookupTableAccounts: lookups });
      const accountKeys = keys.staticAccountKeys.map((k) => k.toBase58());
      const loadedAddresses = { writable: (keys.accountKeysFromLookups?.writable ?? []).map((k) => k.toBase58()), readonly: (keys.accountKeysFromLookups?.readonly ?? []).map((k) => k.toBase58()) };
      const all = [...accountKeys, ...loadedAddresses.writable, ...loadedAddresses.readonly];
      const was = clone();
      let err = null, effects = null;
      const s = clone();
      try { effects = execute(bytes, s, { verify: true }); Object.assign(st, { lamports: s.lamports, tokens: s.tokens, pools: s.pools, other: s.other }); }
      catch (error) { err = { InstructionError: [3, { Custom: 1 }], message: error.message }; }
      const end = err ? was : st;
      const lam = (state, a) => Number(accountOf(a, state)?.lamports ?? 0);
      const tb = (state) => all.flatMap((a, i) => { const t = state.tokens.get(a); return t ? [{ accountIndex: i, mint: t.mint, owner: t.owner, uiTokenAmount: { amount: t.amount.toString(), decimals: DECIMALS[t.mint] } }] : []; });
      const meta = { err, fee: effects ? Number(effects.fee) : 5_000, preBalances: all.map((a) => lam(was, a)), postBalances: all.map((a) => lam(end, a)),
        preTokenBalances: tb(was), postTokenBalances: tb(end), loadedAddresses };
      st.sent.set(sig, { err, meta, slot: ++st.slot, bytes, accountKeys });
      return sig;
    },
    async getSignatureStatus(sig) { const s = st.sent.get(sig); return s ? { err: s.err, confirmationStatus: "confirmed" } : null; },
    async getTransaction(sig) { const s = st.sent.get(sig); return s ? { slot: s.slot, meta: s.meta, transaction: { message: { accountKeys: s.accountKeys } } } : null; },
  };
  function quote(q) {
    const slip = Number(q.slippageBps);
    const answer = (out, routePlan) => response(200, { inputMint: q.inputMint, inAmount: q.amount, outputMint: q.outputMint, outAmount: out.toString(), otherAmountThreshold: ((out * BigInt(10_000 - slip) + 9_999n) / 10_000n).toString(),
      swapMode: q.swapMode, slippageBps: slip, platformFee: null, priceImpactPct: "0.0001", routePlan, instructionVersion: "V2" });
    const hop = (ammKey, inputMint, outputMint, inAmount, outAmount) => ({ swapInfo: { ammKey, label: "Scripted CPMM", inputMint, outputMint, inAmount: String(inAmount), outAmount: String(outAmount) }, percent: null, bps: 10_000 });
    const found = poolOf(q.inputMint, q.outputMint);
    /* A PumpSwap-like pool, as LMEOW's was: quoted when asked without maxAccounts only. */
    if (found && found[1].opensUserAccount && "maxAccounts" in q) return response(400, { error: "No routes found", errorCode: "NO_ROUTES_FOUND" });
    if (found) {
      const [address, p] = found;
      const out = cpmm(p, q.inputMint, BigInt(q.amount));
      return answer(out, [hop(address, q.inputMint, q.outputMint, q.amount, out)]);
    }
    /* No pool pairs them: through SOL, unless only direct routes were asked for. */
    const one = poolOf(q.inputMint, WSOL), two = poolOf(WSOL, q.outputMint);
    if (q.onlyDirectRoutes === "true" || !one || !two) return response(400, { error: "No routes found", errorCode: "NO_ROUTES_FOUND" });
    const mid = cpmm(one[1], q.inputMint, BigInt(q.amount)), out = cpmm(two[1], WSOL, mid);
    return answer(out, [hop(one[0], q.inputMint, WSOL, q.amount, mid), hop(two[0], WSOL, q.outputMint, mid, out)]);
  }
  /* Jupiter's build of a hop: shared_accounts_route_v2 on program authority 3, laid out as the
     live ones were (fixtures/agent/jupiter-usdc-mew-swap.json). "hop_unshared" builds what
     Jupiter built unshared instead: route_v2, the SOL in the wallet's own wrapped-SOL account. */
  function hopSwap(body) {
    const q = body.quoteResponse, user = body.userPublicKey, mode = w.jupMode;
    const [oneAddress, one] = poolOf(q.inputMint, WSOL), [twoAddress, two] = poolOf(WSOL, q.outputMint);
    const limit = 1_400_000;
    const price = Math.floor(Number(body.prioritizationFeeLamports.priorityLevelWithMaxLamports.maxLamports) * 1e6 / limit);
    const meta = (k, sg, wr) => ({ pubkey: new PublicKey(k), isSigner: sg, isWritable: wr });
    const vaults = (p, inMint) => (inMint === p.quoteMint ? [p.vQuote, p.vToken] : [p.vToken, p.vQuote]);
    const srcAta = ataOf(user, q.inputMint), dstAta = ataOf(user, q.outputMint);
    const createAta = (ata, mint) => new TransactionInstruction({ programId: new PublicKey(ATA_PROGRAM), data: Buffer.from([1]), keys: [meta(user, true, true), meta(ata, false, true), meta(user, false, false), meta(mint, false, false), meta(SYSTEM, false, false), meta(TK, false, false)] });
    const plan = Buffer.from([2, 0, 0, 0, 0x2e, 0x10, 0x27, 0x00, 0x01, 0x2e, 0x10, 0x27, 0x01, 0x02]);
    const head = (disc, id) => { const b = Buffer.alloc(disc.length + (id === null ? 0 : 1) + 22); disc.copy(b, 0); let o = disc.length; if (id !== null) b[o++] = id;
      b.writeBigUInt64LE(BigInt(q.inAmount), o); b.writeBigUInt64LE(BigInt(q.outAmount), o + 8); b.writeUInt16LE(Number(q.slippageBps), o + 16); return b; };
    const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units: limit }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: price }), createAta(dstAta, q.outputMint)];
    if (mode === "hop_unshared") {
      const userSol = ataOf(user, WSOL);
      ixs.push(createAta(userSol, WSOL), new TransactionInstruction({ programId: new PublicKey(JUPITER_PROGRAM), data: Buffer.concat([head(ROUTE_V2, null), plan]), keys: [
        meta(user, true, true), meta(srcAta, false, true), meta(dstAta, false, true), meta(q.inputMint, false, false), meta(q.outputMint, false, false), meta(TK, false, false), meta(TK, false, false),
        meta(JUPITER_PROGRAM, false, false), meta(JUPITER_EVENT_AUTHORITY, false, false), meta(JUPITER_PROGRAM, false, false),
        meta(POOL_PROGRAM, false, false), meta(oneAddress, false, true), ...vaults(one, q.inputMint).map((v) => meta(v, false, true)), meta(srcAta, false, true), meta(userSol, false, true),
        meta(POOL_PROGRAM, false, false), meta(twoAddress, false, true), ...vaults(two, WSOL).map((v) => meta(v, false, true)), meta(userSol, false, true), meta(dstAta, false, true)] }));
    } else {
      const jIn = ataOf(JUP_AUTH, q.inputMint), jSol = ataOf(JUP_AUTH, WSOL), jOut = ataOf(JUP_AUTH, q.outputMint);
      ixs.push(new TransactionInstruction({ programId: new PublicKey(JUPITER_PROGRAM), data: Buffer.concat([head(SHARED_ROUTE_V2, JUP_AUTHORITY_ID), plan]), keys: [
        meta(JUP_AUTH, false, false), meta(user, true, true), meta(srcAta, false, true), meta(jIn, false, true), meta(jOut, false, true), meta(dstAta, false, true),
        meta(q.inputMint, false, false), meta(q.outputMint, false, false), meta(TK, false, false), meta(TK, false, false), meta(JUPITER_EVENT_AUTHORITY, false, false), meta(JUPITER_PROGRAM, false, false),
        meta(POOL_PROGRAM, false, false), meta(oneAddress, false, true), ...vaults(one, q.inputMint).map((v) => meta(v, false, true)), meta(jIn, false, true), meta(jSol, false, true),
        meta(POOL_PROGRAM, false, false), meta(twoAddress, false, true), ...vaults(two, WSOL).map((v) => meta(v, false, true)), meta(jSol, false, true), meta(jOut, false, true),
        ...(mode === "hop_sol_input" ? [meta(user, false, true)] : [])] }));
    }
    const message = new TransactionMessage({ payerKey: new PublicKey(user), recentBlockhash: bs58.encode(Buffer.alloc(32, 9)), instructions: ixs }).compileToV0Message([altObject(ALT, st.alts.get(ALT))]);
    return response(200, { swapTransaction: toBase64(new VersionedTransaction(message).serialize()), lastValidBlockHeight: st.blockHeight + 150 });
  }
  function swap(body) {
    const q = body.quoteResponse, user = body.userPublicKey, mode = w.jupMode;
    if (q.routePlan.length === 2) return hopSwap(body);
    const [poolAddress, p] = poolOf(q.inputMint, q.outputMint);
    let inMint = q.inputMint, outMint = q.outputMint;
    if (mode === "wrong_output") outMint = outMint === USDC ? POPCAT : (outMint === POPCAT ? MEW : POPCAT);
    const srcAta = ataOf(user, inMint);
    const dstAta = mode === "other_destination" || mode === "steal_output" ? ataOf(ATTACKER, outMint) : ataOf(user, outMint);
    const limit = 1_400_000;
    const price = Math.floor(Number(body.prioritizationFeeLamports.priorityLevelWithMaxLamports.maxLamports) * 1e6 / limit);
    const data = Buffer.alloc(39);
    ROUTE_V2.copy(data, 0);
    data.writeBigUInt64LE(BigInt(q.inAmount), 8); data.writeBigUInt64LE(BigInt(q.outAmount), 16); data.writeUInt16LE(Number(q.slippageBps), 24);
    data.writeUInt32LE(1, 30); Buffer.from([0x2e, 0x10, 0x27, 0x00, 0x01]).copy(data, 34);
    const [vIn, vOut] = inMint === p.quoteMint ? [p.vQuote, p.vToken] : [p.vToken, p.vQuote];
    const meta = (k, s, wr) => ({ pubkey: new PublicKey(k), isSigner: s, isWritable: wr });
    const ixs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: limit }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: price }),
      ...(mode === "steal_output" ? [] : [new TransactionInstruction({ programId: new PublicKey(ATA_PROGRAM), data: Buffer.from([1]), keys: [meta(user, true, true), meta(dstAta, false, true), meta(mode === "other_destination" ? ATTACKER : user, false, false), meta(outMint, false, false), meta(SYSTEM, false, false), meta(TK, false, false)] })]),
      new TransactionInstruction({ programId: new PublicKey(JUPITER_PROGRAM), data, keys: [meta(user, true, true), meta(srcAta, false, true), meta(dstAta, false, true), meta(inMint, false, false), meta(outMint, false, false),
        meta(TK, false, false), meta(TK, false, false), meta(JUPITER_PROGRAM, false, false), meta(JUPITER_EVENT_AUTHORITY, false, false), meta(JUPITER_PROGRAM, false, false), meta(POOL_PROGRAM, false, false),
        meta(mode === "second_signer" ? ATTACKER : user, true, true), meta(poolAddress, false, true), meta(vIn, false, true), meta(vOut, false, true),
        ...(p.opensUserAccount ? [meta(userAccountOf(user), false, true)] : [])] }),
      ...(mode === "drain" ? [SystemProgram.transfer({ fromPubkey: new PublicKey(user), toPubkey: new PublicKey(ATTACKER), lamports: 50_000_000 })] : []),
    ];
    const message = new TransactionMessage({ payerKey: new PublicKey(user), recentBlockhash: bs58.encode(Buffer.alloc(32, 9)), instructions: ixs }).compileToV0Message([altObject(ALT, st.alts.get(ALT))]);
    return response(200, { swapTransaction: toBase64(new VersionedTransaction(message).serialize()), lastValidBlockHeight: st.blockHeight + 150 });
  }
  return { st, rpc, quote, swap, ataOf, ATTACKER, JUP_AUTH, accountOf, poolFor: (token) => [...st.pools.values()].find((x) => x.token === token),
    movePool(token, factor) { const p = [...st.pools.values()].find((x) => x.token === token); p.quoteReserve = p.quoteReserve * BigInt(Math.round(factor * 1000)) / 1000n; } };
}

section("9. LIVE ARMS ONLY WITH THE WALLET UNLOCKED, FUNDED, AND THE SENTENCE TYPED");
const PASS = "the cat that waits for the model";
const mapStore = () => { const m = new Map(); return { async get(k) { return m.has(k) ? structuredClone(m.get(k)) : undefined; }, async set(k, v) { m.set(k, structuredClone(v)); }, async remove(k) { m.delete(k); } }; };
const L = createWorld();
const keystore = createKeystore({ storage: mapStore(), session: mapStore(), clock: L.clock });
const { publicKey: AUTO } = await keystore.create({ passphrase: PASS });
const signer = createSessionSigner({ keystore, clock: L.clock });
L.chain = createChain(L, { wallet: AUTO, usdcRaw: 40_000_000n });
const phantomAsked = [];
const phantom = { isReady: () => true, wallet: () => newKey(), async signTransaction(req) { phantomAsked.push(req); throw new Error("Phantom must not be asked by the agent"); } };
const engine = createHawkEngine({ rpc: L.chain.rpc, bridge: phantom, sessionSigner: signer, store: memoryStore(), clock: L.clock, timers: L.engineTimers, fetchImpl: L.fetchImpl, config: { rpcUrl: "https://chain.double" } });
await signer.refresh();
const live = L.makeRunner(() => engine.agentFences());
const LIVE_SPEC = { ...SPEC, name: "Live cat", universe: [POPCAT, MEW], mode: "live" };
{
  await live.saveSpec(LIVE_SPEC);
  let e = null; try { await live.start({ liveAck: "I arm it, whatever" }); } catch (x) { e = x; }
  ok("locked, underfunded and with the wrong sentence it does not arm (not_armed), naming each", e?.clause === "not_armed" && ["autopilot_unlocked", "vault_funded", "live_ack_typed"].every((n) => e.detail.armability.blocking.includes(n)), e?.detail?.armability?.blocking.join(","));
  ok("…and the checklist prints the exact sentence to type, naming the autopilot wallet", e.detail.armability.expectedAck === agentArmSentence(live.spec(), AUTO) && e.detail.armability.expectedAck.includes(AUTO));
  await keystore.unlock({ passphrase: PASS, ttlMs: 3_600_000 });
  await signer.refresh();
  L.chain.st.tokens.get(L.chain.ataOf(AUTO, USDC)).amount = 100_000_000n;          // funded to $100 of USDC
  const sentence = agentArmSentence(live.spec(), AUTO);
  L.chain.st.lamports.set(AUTO, 5_000_000n);                                         // 0.005 SOL: not enough for fees and rent
  e = null; try { await live.start({ liveAck: sentence }); } catch (x) { e = x; }
  ok("with 0.005 SOL it does not arm: fees and account rent need 0.02 (sol_for_fees)", e?.clause === "not_armed" && e.detail.armability.blocking.join() === "sol_for_fees");
  L.chain.st.lamports.set(AUTO, 100_000_000n);
  const st = await live.start({ liveAck: sentence });
  ok("unlocked, $100 of USDC, 0.1 SOL and the sentence typed: it starts LIVE, armed", st.status === "running" && st.mode === "live" && st.armed === true);
}

section("10. A LIVE BUY: CHECKED, SIGNED BY THE AUTOPILOT KEY, SENT, READ BACK");
{
  L.decisions.push({ rationale: "POPCAT trends up: a $20 buy.", actions: [buy(POPCAT, 20, "4 h return positive")] });
  const calls = L.chain.st.calls.length;
  await live.tick();
  const fill = journalOf(live, "fill")[0];
  const sent = [...L.chain.st.sent.values()];
  const tx = sent.length ? VersionedTransaction.deserialize(sent[0].bytes) : null;
  ok("the buy filled live, with a signature", fill?.side === "buy" && fill.paper === false && typeof fill.signature === "string" && fill.signature.length > 60, JSON.stringify(journalOf(live, "refusal")[0] ?? {}));
  ok("the bytes on chain carry the autopilot key's signature, and Phantom was asked nothing", tx && ed25519.verify(tx.signatures[0], tx.message.serialize(), new PublicKey(AUTO).toBytes()) && phantomAsked.length === 0);
  const seq = L.chain.st.calls.slice(calls).join(",");
  ok("the check ran before the send: tables read, custody read, the simulation, then the send", /gma.*sim.*send/.test(seq) && seq.indexOf("sim") < seq.indexOf("send"), seq);
  const usdc = L.chain.st.tokens.get(L.chain.ataOf(AUTO, USDC)).amount, jup = L.chain.st.tokens.get(L.chain.ataOf(AUTO, POPCAT))?.amount ?? 0n;
  ok("the chain moved exactly $20 of USDC, and the book holds exactly the POPCAT the chain delivered", usdc === 80_000_000n && Math.abs(live.status().positions[0]?.qty - Number(jup) / 1e9) < 1e-8 && fill.usd === 20);
  ok("the fee and rent are counted in SOL, beside the P&L", live.status().pnl.feesSol > 0.002 && live.status().pnl.feesSol < 0.003, `${live.status().pnl.feesSol} SOL`);
  ok("a live fill notifies the owner", L.notes.some((n) => /bought POPCAT/.test(n.title)));
}

section("11. HOSTILE TRANSACTIONS ARE REFUSED BEFORE SIGNING");
{
  const hostile = [
    ["other_destination", "account_create", "an account made for another wallet, to receive the output"],
    ["steal_output", "route_accounts", "the route paying the output into another wallet's account"],
    ["drain", "program_not_allowed", "a System transfer draining SOL"],
    ["wrong_output", "account_create", "a swap into a mint the order did not name"],
    ["second_signer", "signers", "a second signer"],
  ];
  for (const [mode, clause, what] of hostile) {
    L.jupMode = mode;
    const sends = L.chain.st.sent.size;
    L.decisions.push({ rationale: `Buy MEW (${mode}).`, actions: [buy(MEW, 15)] });
    await live.runNow();
    await live.tick();
    const refusal = journalOf(live, "refusal")[0];
    ok(`${what}: refused at ${clause}, before signing — nothing sent, Phantom not asked`, refusal?.clause === clause && refusal.from === "execution" && L.chain.st.sent.size === sends && phantomAsked.length === 0, `${refusal?.clause}: ${refusal?.message?.slice(0, 90)}`);
  }
  L.jupMode = null;
  ok("…and the vault still holds only what the good buy left", L.chain.st.tokens.get(L.chain.ataOf(AUTO, USDC)).amount === 80_000_000n && !L.chain.st.tokens.has(L.chain.ataOf(AUTO, MEW)));
}

section("12. A LIVE TAKE PROFIT, AND A LOCKED WALLET THAT CANNOT SELL");
{
  L.chain.movePool(POPCAT, 1.25);                 // the pool's USDC side up 25%: POPCAT marks about +25%
  L.prices[POPCAT] = 0.375;
  L.advance(30_000);
  await live.tick();
  const tp = journalOf(live, "fill")[0];
  ok("POPCAT up 25%: sold at the take profit, live, signed by the autopilot wallet", tp?.side === "sell" && tp.protection === "take_profit" && tp.paper === false && tp.signature && phantomAsked.length === 0);
  const usdc = L.chain.st.tokens.get(L.chain.ataOf(AUTO, USDC)).amount;
  ok("the USDC came back to the vault, more than was spent", usdc > 100_000_000n && live.status().pnl.realizedUsd > 4 && live.status().pnl.wins === 1, `${Number(usdc) / 1e6} USDC`);
  L.prices[POPCAT] = 0.30;
  L.decisions.push({ rationale: "Buy POPCAT again.", actions: [buy(POPCAT, 20)] });
  await live.runNow();
  await live.tick();
  ok("bought again", live.status().positions.length === 1);
  await keystore.lock();
  await signer.refresh();
  L.prices[POPCAT] = 0.20;                        // −33%: the stop says sell
  L.advance(30_000);
  await live.tick();
  const locked = journalOf(live, "refusal")[0];
  ok("locked, the stop loss cannot sign: refused at autopilot_locked, retried every tick, and the owner told", locked?.clause === "autopilot_locked" && locked.protection === "stop_loss" && L.notes.some((n) => /unlock the autopilot wallet to sell/.test(n.title)) && live.status().positions.length === 1);
  ok("…and a locked wallet disarms the live agent", live.status().armed === false);
}

section("13. THE PAIR ALLOWLIST, ON THE LIVE RECORDED USDC → POPCAT TRANSACTION");
{
  const alts = JLIVE.lookupTables.map((t) => ({ owner: t.owner, data: t.data }));
  const tables = await loadLookupTables({ async getMultipleAccounts(a) { return { accounts: a.map((x) => alts[JLIVE.lookupTables.findIndex((t) => t.address === x)]) }; } }, lookupTableKeysOf(JLIVE.swapBuy.swapTransaction));
  const args = (spec) => ({ txBase64: JLIVE.swapBuy.swapTransaction, wallet: JLIVE.user, inputMint: USDC, outputMint: POPCAT, inputProgram: TK, outputProgram: TK, amountRaw: JLIVE.quoteBuy.inAmount,
    quote: JLIVE.quoteBuy, slippageCapBps: 100, lookupTables: tables, maxPriorityFeeLamports: 50_000, allowedPairs: allowedPairsFor(spec) });
  const clause = (spec) => { try { checkSwapTransaction(args(spec)); return "passed"; } catch (e) { return e instanceof SwapCheckError ? e.clause : e.message; } };
  ok("with POPCAT in the universe, Jupiter's live transaction passes the check (route_v2, one account create)", clause(normalizeAgentSpec({ universe: [POPCAT] })) === "passed");
  ok("with POPCAT not in the universe, the same bytes are refused at pair_not_allowed", clause(normalizeAgentSpec({ universe: [MEW, KITTY] })) === "pair_not_allowed");
  ok("…and a swap between two listed tokens is never a pair (POPCAT → MEW)", (() => { try { checkSwapTransaction({ ...args(normalizeAgentSpec({ universe: [POPCAT, MEW] })), inputMint: POPCAT, outputMint: MEW }); return false; } catch (e) { return e.clause === "pair_not_allowed"; } })());
  const hop = (() => { try { return checkSwapTransaction({ ...args(normalizeAgentSpec({ universe: [POPCAT] })), solHop: true }); } catch (e) { return e; } })();
  ok("with the agent's solHop the same direct bytes pass as before: route_v2, one step ending 0 → 1, no intermediate",
    hop.route?.name === "route_v2" && hop.route.routeSteps === 1 && hop.route.lastStep.inputIndex === 0 && hop.route.lastStep.outputIndex === 1 && hop.intermediate === null, hop.clause ?? "");
}

section("14. ONE HOP THROUGH SOL, ON THE LIVE RECORDED USDC → MEW AND USDC → KITTY TRANSACTIONS");
{
  /* Recorded 2026-09-25 for the same throwaway key as the POPCAT pair, asked exactly as the
     agent asks (solHop: maxAccounts 24, not direct only; the build on shared accounts). MEW
     and KITTY have no USDC pool: both routes pass through SOL. Hostile edits are made to the
     LIVE bytes — decompiled against the recorded tables, one thing changed, recompiled — and
     each is refused by name before any signature exists. */
  const MEWFX = read("./fixtures/agent/jupiter-usdc-mew-swap.json");
  const KITFX = read("./fixtures/agent/jupiter-usdc-kitty-swap.json");
  const SHAPES = read("./fixtures/agent/jupiter-cat-route-shapes.json");
  const tablesOf = (fx, txBase64) => loadLookupTables({ async getMultipleAccounts(a) { return { accounts: a.map((x) => fx.lookupTables.find((t) => t.address === x) ?? null) }; } }, lookupTableKeysOf(txBase64));
  const spec = normalizeAgentSpec({ universe: [MEW, KITTY] });
  const quoteOf = (fx, side) => (side === "buy" ? fx.quoteBuy : fx.quoteSell);
  const qargs = (fx, side, over = {}) => ({ inputMint: quoteOf(fx, side).inputMint, outputMint: quoteOf(fx, side).outputMint, amountRaw: quoteOf(fx, side).inAmount, slippageBps: 100, slippageCapBps: 100,
    maxPriceImpactPct: side === "buy" ? AGENT_MAX_BUY_IMPACT_PCT : 100, solHop: true, ...over });
  const quoteClause = (quote, a) => { try { checkQuote(quote, a); return "passed"; } catch (e) { return e.clause ?? e.message; } };
  const txArgs = async (fx, side, swapKey = side === "buy" ? "swapBuy" : "swapSell") => ({ txBase64: fx[swapKey].swapTransaction, wallet: fx.user, inputMint: quoteOf(fx, side).inputMint, outputMint: quoteOf(fx, side).outputMint,
    inputProgram: TK, outputProgram: TK, amountRaw: quoteOf(fx, side).inAmount, quote: quoteOf(fx, side), slippageCapBps: 100, lookupTables: await tablesOf(fx, fx[swapKey].swapTransaction),
    maxPriorityFeeLamports: AGENT_PRIORITY_FEE_LAMPORTS, allowedPairs: allowedPairsFor(spec), solHop: true });
  const txClause = (a) => { try { checkSwapTransaction(a); return "passed"; } catch (e) { return e.clause ?? e.message; } };
  const readOf = (fx, c) => c.writableAddresses.map((a) => fx.writableAccounts.find((x) => x.address === a)?.account ?? null);
  const chainClause = (fx, c, accounts = readOf(fx, c)) => {
    try { checkWritableCustody({ wallet: fx.user, writableAddresses: c.writableAddresses, accounts, allowed: [c.inputAta, c.outputAta] }); checkRouteMints({ writableAddresses: c.writableAddresses, accounts, mints: [USDC, WSOL, fx.tokenMint] }); return "passed"; }
    catch (e) { return e.clause ?? e.message; }
  };
  const authorityOf = (id) => PublicKey.findProgramAddressSync([Buffer.from("authority"), Buffer.from([id])], new PublicKey(JUPITER_PROGRAM))[0].toBase58();

  /* THE QUOTES */
  const mq = checkQuote(MEWFX.quoteBuy, qargs(MEWFX, "buy"));
  ok("the live MEW buy quote passes the agent's check: one hop, USDC → SOL → MEW, inside the 2% buy cap", mq.intermediate === WSOL && mq.legs === 2 && mq.hops.map((h) => `${h.inputMint}>${h.outputMint}`).join() === `${USDC}>${WSOL},${WSOL}>${MEW}` && mq.impactPct < 2);
  ok("…and the MEW sell back to USDC, through SOL again", checkQuote(MEWFX.quoteSell, qargs(MEWFX, "sell")).intermediate === WSOL);
  ok("the same MEW quote, held to the xStock venue's rule (direct only), is refused at route_not_direct: the venue does not take the hop", quoteClause(MEWFX.quoteBuy, qargs(MEWFX, "buy", { solHop: false })) === "route_not_direct");
  ok("the live KITTY buy quote, 2.50% impact over the whole route, is refused at impact_over_cap: the 2% cap is the route's, not one pool's",
    quoteClause(KITFX.quoteBuy, qargs(KITFX, "buy")) === "impact_over_cap" && Math.abs(Number(KITFX.quoteBuy.priceImpactPct) * 100 - 2.495) < 0.001);
  ok("…while its sell (a sell is never refused for impact) passes, through SOL", checkQuote(KITFX.quoteSell, qargs(KITFX, "sell")).intermediate === WSOL);

  /* THE TRANSACTIONS, AND THE CHAIN AS READ THAT MORNING */
  const mb = checkSwapTransaction(await txArgs(MEWFX, "buy"));
  const heldSol = associatedTokenAddress(mb.programAuthority, WSOL, TK);
  ok("the live MEW buy transaction passes: Jupiter's shared-accounts route, two steps ending 1 → 2, run by program authority 7",
    mb.route.name === "shared_accounts_route_v2" && mb.route.id === 7 && mb.route.routeSteps === 2 && mb.route.lastStep.inputIndex === 1 && mb.route.lastStep.outputIndex === 2 && mb.intermediate === WSOL);
  ok("…whose program authority is the PDA of \"authority\" and 7, as its first account says", mb.programAuthority === authorityOf(7) && mb.programAuthority === jupiterProgramAuthority(7));
  ok("…one account created, the wallet's MEW; the wallet's wrapped-SOL account is named nowhere", mb.createdAtas.length === 1 && mb.createdAtas[0] === mb.outputAta && !mb.writableAddresses.includes(mb.walletIntermediateAta)
    && mb.walletIntermediateAta === associatedTokenAddress(MEWFX.user, WSOL, TK));
  ok("the SOL in the middle sits in Jupiter's own wrapped-SOL account, which the route writes, owned by the authority on chain",
    mb.writableAddresses.includes(heldSol) && tokenAccountDetails(readOf(MEWFX, mb)[mb.writableAddresses.indexOf(heldSol)])?.owner === mb.programAuthority);
  ok("on the chain as read that morning: every token account the route writes holds USDC, SOL or MEW, and none but its two is the wallet's", chainClause(MEWFX, mb) === "passed");
  const ms = checkSwapTransaction(await txArgs(MEWFX, "sell"));
  ok("the live MEW sell passes the same way (authority 3, the wallet's USDC account created for the proceeds)", ms.route.id === 3 && ms.intermediate === WSOL && ms.createdAtas[0] === ms.outputAta && chainClause(MEWFX, ms) === "passed");
  const kb = checkSwapTransaction(await txArgs(KITFX, "buy")), ks = checkSwapTransaction(await txArgs(KITFX, "sell"));
  ok("the live KITTY buy and sell transactions pass too (authorities 5 and 3), and so does the chain they write",
    kb.route.id === 5 && ks.route.id === 3 && kb.intermediate === WSOL && ks.intermediate === WSOL && chainClause(KITFX, kb) === "passed" && chainClause(KITFX, ks) === "passed");
  ok("Jupiter's OWN build of the same MEW buy without shared accounts — route_v2, the SOL held in the wallet's account — is refused at intermediate_in_wallet",
    txClause(await txArgs(MEWFX, "buy", "swapBuyUnshared")) === "intermediate_in_wallet" && txClause(await txArgs(KITFX, "buy", "swapBuyUnshared")) === "intermediate_in_wallet");
  ok("…and with MEW out of the universe the hop is refused first at pair_not_allowed", txClause({ ...(await txArgs(MEWFX, "buy")), allowedPairs: allowedPairsFor(normalizeAgentSpec({ universe: [KITTY] })) }) === "pair_not_allowed");

  /* HOSTILE QUOTES: the shapes */
  const hopQuote = (plan) => ({ ...MEWFX.quoteBuy, routePlan: plan });
  const leg = (i, o, bps = 10_000) => ({ swapInfo: { inputMint: i, outputMint: o, label: "edit" }, percent: null, bps });
  ok("a second intermediate (USDC → SOL → USDT → MEW) is refused at route_too_many_hops", quoteClause(hopQuote([leg(USDC, WSOL), leg(WSOL, USDT), leg(USDT, MEW)]), qargs(MEWFX, "buy")) === "route_too_many_hops");
  const kwif = SHAPES.rows.find((x) => x.symbol === "KWIF" && x.side === "buy" && x.ask === "maxAccounts32");
  const kwifClause = (() => { try { routeShape(kwif.routePlan.map((h) => ({ swapInfo: h, bps: h.bps })), { inputMint: USDC, outputMint: KWIF, solHop: true }); return "passed"; } catch (e) { return e.clause; } })();
  ok("…as Jupiter really answered KWIF at maxAccounts 32 that morning (USDC → USDT → SOL → KWIF): route_too_many_hops", kwif?.intermediates.length === 2 && kwifClause === "route_too_many_hops");
  /* The ask rests on that morning's answers: re-derived here with the check itself. */
  const settle = (x) => (x.settlement === "USDT" ? USDT : USDC);
  const shapeOf = (x) => { if (!x.routePlan) return "no_route"; const [i, o] = x.side === "buy" ? [settle(x), SOLANA_CATS.find((c) => c.symbol === x.symbol).mint] : [SOLANA_CATS.find((c) => c.symbol === x.symbol).mint, settle(x)];
    try { const r = routeShape(x.routePlan.map((h) => ({ swapInfo: h, bps: h.bps })), { inputMint: i, outputMint: o, solHop: true }); return r.intermediate ? "sol_hop" : "direct"; } catch (e) { return e.clause; } };
  const rowsAt = (ask, list = SHAPES.rows) => list.filter((x) => x.ask === ask);
  ok("the recorded shapes back the ask: direct from USDC only POPCAT had a route, from USDT none did",
    rowsAt("direct").filter((x) => shapeOf(x) === "direct").map((x) => x.symbol).join() === "POPCAT,POPCAT" && rowsAt("direct").length === 12 && rowsAt("direct", SHAPES.usdt.rows).every((x) => shapeOf(x) === "no_route"));
  ok("…at maxAccounts 24 all twelve USDC answers and all six USDT buys pass the agent's check, each one hop through SOL",
    rowsAt("maxAccounts24").length === 12 && [...rowsAt("maxAccounts24"), ...rowsAt("maxAccounts24", SHAPES.usdt.rows)].every((x) => shapeOf(x) === "sol_hop"));
  ok("…while at 32 two would have been refused at route_too_many_hops, and at 20 KITTY had no route",
    rowsAt("maxAccounts32").filter((x) => shapeOf(x) === "route_too_many_hops").length === 2 && rowsAt("maxAccounts20").filter((x) => shapeOf(x) === "no_route").map((x) => x.symbol).join() === "KITTY,KITTY");
  ok("a non-SOL intermediate (USDC → USDT → MEW) is refused at route_intermediate_not_sol", quoteClause(hopQuote([leg(USDC, USDT), leg(USDT, MEW)]), qargs(MEWFX, "buy")) === "route_intermediate_not_sol");
  ok("a split across different intermediates (60% through SOL, 40% through USDT) is refused at route_split_intermediates",
    quoteClause(hopQuote([leg(USDC, WSOL, 6_000), leg(USDC, USDT, 4_000), leg(WSOL, MEW), leg(USDT, MEW)]), qargs(MEWFX, "buy")) === "route_split_intermediates");
  ok("…and so is a direct pool beside a path through SOL", quoteClause(hopQuote([leg(USDC, MEW, 5_000), leg(USDC, WSOL, 5_000), leg(WSOL, MEW)]), qargs(MEWFX, "buy")) === "route_split_intermediates");
  ok("a path through SOL that does not carry the whole amount is refused at quote_malformed", quoteClause(hopQuote([leg(USDC, WSOL, 6_000), leg(WSOL, MEW)]), qargs(MEWFX, "buy")) === "quote_malformed");
  ok("…while one hop split across two SOL pools is still one way through SOL, and passes", quoteClause(hopQuote([leg(USDC, WSOL, 6_000), leg(USDC, WSOL, 4_000), leg(WSOL, MEW)]), qargs(MEWFX, "buy")) === "passed");

  /* HOSTILE TRANSACTIONS: the live MEW buy, edited */
  const tables = await tablesOf(MEWFX, MEWFX.swapBuy.swapTransaction);
  const alts = [...tables.values()];
  const liveMsg = TransactionMessage.decompile(VersionedTransaction.deserialize(fromBase64(MEWFX.swapBuy.swapTransaction)).message, { addressLookupTableAccounts: alts });
  const rebuild = (edit) => {
    const ixs = liveMsg.instructions.map((ix) => new TransactionInstruction({ programId: ix.programId, keys: ix.keys.map((k) => ({ ...k })), data: Buffer.from(ix.data) }));
    edit(ixs);
    return toBase64(new VersionedTransaction(new TransactionMessage({ payerKey: new PublicKey(MEWFX.user), recentBlockhash: liveMsg.recentBlockhash, instructions: ixs }).compileToV0Message(alts)).serialize());
  };
  const base = await txArgs(MEWFX, "buy");
  const edited = (edit, over = {}) => txClause({ ...base, txBase64: rebuild(edit), ...over });
  const route = (ixs) => ixs.find((ix) => ix.programId.toBase58() === JUPITER_PROGRAM);
  const swapKey = (ix, from, to) => { for (const k of ix.keys) if (k.pubkey.toBase58() === from) k.pubkey = new PublicKey(to); };
  const ATTACKER = newKey();
  const walletSol = mb.walletIntermediateAta;
  const ataCreate = (ata, mint) => new TransactionInstruction({ programId: new PublicKey(ATA_PROGRAM), data: Buffer.from([1]),
    keys: [MEWFX.user, ata, MEWFX.user, mint, SYSTEM, TK].map((k, i) => ({ pubkey: new PublicKey(k), isSigner: i === 0, isWritable: i < 2 })) });
  ok("rebuilt unchanged, the live MEW transaction still passes (the edit harness is honest)", edited(() => {}) === "passed");
  ok("a second intermediate in the bytes (a third step, ending 2 → 3) is refused at route_too_many_hops",
    edited((ixs) => { const r = route(ixs); r.data = Buffer.concat([r.data, Buffer.from([0x69, 0x10, 0x27, 0x02, 0x03])]); r.data.writeUInt32LE(3, 31); }) === "route_too_many_hops");
  ok("a non-SOL intermediate in the bytes (Jupiter's USDT account where its SOL account was) is refused at route_intermediate_not_sol",
    edited((ixs) => swapKey(route(ixs), heldSol, associatedTokenAddress(mb.programAuthority, USDT, TK))) === "route_intermediate_not_sol");
  const vault = mb.writableAddresses.findIndex((a, i) => { const d = tokenAccountDetails(readOf(MEWFX, mb)[i]); return d && d.owner !== mb.programAuthority && d.owner !== MEWFX.user; });
  const usdtVault = readOf(MEWFX, mb).map((a, i) => { if (i !== vault) return a; const b = Buffer.from(a.data[0], "base64"); key(USDT).copy(b, 0); return { ...a, data: [b.toString("base64"), "base64"] }; });
  ok("…and on the chain: a pool vault the route writes that holds USDT is refused at route_intermediate_not_sol", vault >= 0 && chainClause(MEWFX, mb, usdtVault) === "route_intermediate_not_sol");
  ok("the output redirected to another wallet's MEW account is refused at route_accounts", edited((ixs) => { route(ixs).keys[5].pubkey = new PublicKey(associatedTokenAddress(ATTACKER, MEW, TK)); }) === "route_accounts");
  ok("…and so is Jupiter's own output account swapped for another's", edited((ixs) => { route(ixs).keys[4].pubkey = new PublicKey(associatedTokenAddress(ATTACKER, MEW, TK)); }) === "route_accounts");
  ok("…and a program authority other than the one its id byte names", edited((ixs) => { route(ixs).data[8] = 3; }) === "route_accounts");
  ok("stray wrapped SOL: a create of the wallet's own wrapped-SOL account is refused at intermediate_in_wallet", edited((ixs) => { ixs.splice(2, 0, ataCreate(walletSol, WSOL)); }) === "intermediate_in_wallet");
  ok("…and so is a route that holds its SOL in the wallet's wrapped-SOL account instead of Jupiter's", edited((ixs) => swapKey(route(ixs), heldSol, walletSol)) === "intermediate_in_wallet");
  const syncNative = (account) => new TransactionInstruction({ programId: new PublicKey(TK), keys: [{ pubkey: new PublicKey(account), isSigner: false, isWritable: true }], data: Buffer.from([17]) });
  ok("the wallet's SOL spent as input — lamports sent into Jupiter's wrapped-SOL account and synced — is refused at sol_as_input",
    edited((ixs) => { ixs.splice(3, 0, SystemProgram.transfer({ fromPubkey: new PublicKey(MEWFX.user), toPubkey: new PublicKey(heldSol), lamports: 5_000_000 }), syncNative(heldSol)); }) === "sol_as_input");
  ok("…a SyncNative alone is refused at sol_as_input too", edited((ixs) => { ixs.splice(3, 0, syncNative(heldSol)); }) === "sol_as_input");
  ok("…while a System transfer to anyone else is still program_not_allowed, as it always was",
    edited((ixs) => { ixs.push(SystemProgram.transfer({ fromPubkey: new PublicKey(MEWFX.user), toPubkey: new PublicKey(ATTACKER), lamports: 1 })); }) === "program_not_allowed");
  ok("the route not matching the quote: another amount is refused at route_mismatch", edited((ixs) => { route(ixs).data.writeBigUInt64LE(10_000_001n, 9); }) === "route_mismatch");
  ok("…another quoted output", edited((ixs) => { route(ixs).data.writeBigUInt64LE(1n, 17); }) === "route_mismatch");
  ok("…a route plan of one step where the quote has two", edited((ixs) => { const r = route(ixs); r.data = Buffer.from(r.data.subarray(0, r.data.length - 5)); r.data.writeUInt32LE(1, 31); }) === "route_mismatch");
  ok("…and a hop's bytes for a quote that says direct", txClause({ ...base, quote: hopQuote([leg(USDC, MEW)]) }) === "route_mismatch");

  /* THE SIMULATION: what the wallet holds after, and what its SOL paid */
  const wsol = (amount) => ({ owner: TK, lamports: Number(RENT_ATA) + amount, data: [tokenAccountBytes({ mint: WSOL, owner: MEWFX.user, amount }).toString("base64"), "base64"] });
  const leftClause = (before, after) => { try { checkIntermediateLeft({ address: walletSol, before, after }); return "passed"; } catch (e) { return e.clause; } };
  ok("after the simulation, no wrapped-SOL account where there was none: passes", leftClause(null, null) === "passed");
  ok("a stray wrapped-SOL account the simulation leaves in the wallet is refused at intermediate_in_wallet, dust or empty", leftClause(null, wsol(1_000)) === "intermediate_in_wallet" && leftClause(null, wsol(0)) === "intermediate_in_wallet");
  ok("…and so is one the wallet held that the swap moved; one it held, untouched, passes", leftClause(wsol(1_000), wsol(2_000)) === "intermediate_in_wallet" && leftClause(wsol(1_000), wsol(1_000)) === "passed");
  const spendClause = (spent, rent) => { try { checkNativeSpend({ spentLamports: spent, signatures: mb.signatures, priorityFeeLamports: mb.priorityFeeLamports, rentLamports: rent }); return "passed"; } catch (e) { return e.clause; } };
  ok("the wallet's SOL may move by this transaction's fee (5,000 + its 50,000 priority) and the MEW account's rent, exactly",
    mb.priorityFeeLamports === 50_000n && spendClause(5_000n + 50_000n + RENT_ATA, RENT_ATA) === "passed");
  ok("one lamport more is the wallet's SOL spent as trade input: sol_as_input", spendClause(5_000n + 50_000n + RENT_ATA + 1n, RENT_ATA) === "sol_as_input");

  /* THE ASKS: the agent's, and the venue's unchanged */
  /* Jupiter as it answered that morning: MEW has no direct USDC route (NO_ROUTES_FOUND). */
  const asked = [];
  const client = createJupiterClient({ fetchImpl: async (url, init = {}) => {
    asked.push({ url, body: init.body ? JSON.parse(init.body) : null });
    const u = new URL(url);
    if (u.pathname.endsWith("/quote") && u.searchParams.get("onlyDirectRoutes") === "true" && u.searchParams.get("outputMint") === MEW) return response(400, { error: "No routes found", errorCode: "NO_ROUTES_FOUND" });
    return response(200, url.includes("/quote") ? MEWFX.quoteBuy : MEWFX.swapBuy);
  }, clock: () => 0, sleep: async () => {} });
  await client.quote({ inputMint: USDC, outputMint: MEW, amountRaw: 10_000_000n, slippageBps: 100, solHop: true });
  await client.swapTransaction({ quote: MEWFX.quoteBuy, wallet: MEWFX.user, priorityFeeLamports: 50_000, sharedAccounts: true });
  await client.quote({ inputMint: USDC, outputMint: POPCAT, amountRaw: 10_000_000n, slippageBps: 100 });
  await client.swapTransaction({ quote: MEWFX.quoteBuy, wallet: MEWFX.user, priorityFeeLamports: 50_000 });
  const q = (i) => Object.fromEntries(new URL(asked[i].url).searchParams);
  const sameAsk = (a, b) => JSON.stringify({ ...a, inputMint: 0, outputMint: 0 }) === JSON.stringify({ ...b, inputMint: 0, outputMint: 0 });
  ok("the agent asks direct first, byte for byte the xStock venue's ask (onlyDirectRoutes, no maxAccounts)", q(0).onlyDirectRoutes === "true" && !("maxAccounts" in q(0)) && sameAsk(q(0), q(3)));
  ok("…and only on its no-route answer the recorded hop ask: not direct only, restrictIntermediateTokens, maxAccounts 24", JSON.stringify(q(1)) === JSON.stringify(MEWFX.query.quoteBuy));
  ok("…and its hop is built on shared accounts, no SOL wrapping", asked[2]?.body?.useSharedAccounts === true && asked[2]?.body?.wrapAndUnwrapSol === false);
  ok("a direct ask and build are what they always were: onlyDirectRoutes, no maxAccounts, no useSharedAccounts", q(3).onlyDirectRoutes === "true" && !("maxAccounts" in q(3)) && !("useSharedAccounts" in (asked[4]?.body ?? {})));
  let other = null;
  const failing = createJupiterClient({ fetchImpl: async (url) => { asked.push({ url }); return response(500, { error: "down" }); }, clock: () => 0, sleep: async () => {} });
  try { await failing.quote({ inputMint: USDC, outputMint: MEW, amountRaw: 10_000_000n, slippageBps: 100, solHop: true }); } catch (e) { other = e; }
  ok("…a direct ask that fails for any reason but no route is not retried as a hop: the failure stands", other instanceof JupiterError && other.code === "http" && asked.length === 6);
}

/* ═══ REGRESSIONS: THE MONEY PATHS UNDER FAILURE ═══════════════════════════════════════════ */
/** A fresh live agent on its own chain double, engine and unlocked autopilot wallet, started. */
async function liveRig({ usdcRaw = 100_000_000n, spec = {}, pumpLike = [] } = {}) {
  const w = createWorld();
  const ks = createKeystore({ storage: mapStore(), session: mapStore(), clock: w.clock });
  const { publicKey } = await ks.create({ passphrase: PASS });
  const sg = createSessionSigner({ keystore: ks, clock: w.clock });
  w.chain = createChain(w, { wallet: publicKey, usdcRaw, pumpLike });
  const eng = createHawkEngine({ rpc: w.chain.rpc, bridge: phantom, sessionSigner: sg, store: memoryStore(), clock: w.clock, timers: w.engineTimers, fetchImpl: w.fetchImpl, config: { rpcUrl: "https://chain.double" } });
  await ks.unlock({ passphrase: PASS, ttlMs: 24 * 3_600_000 });
  await sg.refresh();
  const fences = () => eng.agentFences();
  const r = w.makeRunner(fences);
  await r.saveSpec({ ...SPEC, name: "Rig cat", universe: [POPCAT, MEW], mode: "live", ...spec });
  await r.start({ liveAck: agentArmSentence(r.spec(), publicKey) });
  const held = (mint) => w.chain.st.tokens.get(w.chain.ataOf(publicKey, mint))?.amount ?? 0n;
  const setHeld = (mint, amount) => { w.chain.st.tokens.get(w.chain.ataOf(publicKey, mint)).amount = amount; };
  return { w, r, AUTO: publicKey, fences, held, setHeld };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

section("15. A LIVE HOP THROUGH SOL: KITTY BOUGHT AND SOLD BACK, THE SOL NEVER IN THE WALLET");
{
  /* KITTY has no USDC pool on this chain, as on the live API: Jupiter's double quotes it
     through SOL and builds the hop on program authority 3's accounts, as the live routes
     were built. The real engine's guard and fences, the real autopilot key. */
  const { w, r, AUTO, held } = await liveRig({ spec: { universe: [POPCAT, KITTY] } });
  const walletSol = w.chain.ataOf(AUTO, WSOL);
  const lamportsBefore = w.chain.st.lamports.get(AUTO);
  w.decisions.push({ rationale: "KITTY: a $15 buy.", actions: [buy(KITTY, 15, "trend")] });
  await r.tick();
  const fill = journalOf(r, "fill")[0];
  const sent = [...w.chain.st.sent.values()];
  const msg = sent.length ? TransactionMessage.decompile(VersionedTransaction.deserialize(sent[0].bytes).message, { addressLookupTableAccounts: VersionedTransaction.deserialize(sent[0].bytes).message.addressTableLookups.map((l) => altObject(l.accountKey.toBase58(), w.chain.st.alts.get(l.accountKey.toBase58()))) }) : null;
  const jup = msg?.instructions.find((ix) => ix.programId.toBase58() === JUPITER_PROGRAM);
  ok("the live KITTY buy filled through one hop: USDC → SOL → KITTY, signed by the autopilot key", fill?.side === "buy" && fill.symbol === "KITTY" && fill.paper === false && fill.usd === 15 && w.quoteLog.at(-1)?.ask.maxAccounts === "24",
    JSON.stringify(journalOf(r, "refusal")[0] ?? {}));
  ok("…built on Jupiter's shared accounts (asked for, and so sent): shared_accounts_route_v2 on program authority 3",
    w.swapBodies.at(-1)?.useSharedAccounts === true && Buffer.from(jup?.data ?? []).subarray(0, 8).equals(SHARED_ROUTE_V2) && jup.keys[0].pubkey.toBase58() === w.chain.JUP_AUTH);
  ok("the wallet was left holding NO wrapped SOL: no wrapped-SOL account, and none named by what it signed",
    !w.chain.st.tokens.has(walletSol) && !msg.instructions.some((ix) => ix.keys.some((k) => k.pubkey.toBase58() === walletSol)));
  const feeAndRent = lamportsBefore - w.chain.st.lamports.get(AUTO);
  ok("its SOL moved by the fee and the KITTY account's rent, and not a lamport more", feeAndRent === 5_000n + 50_000n + RENT_ATA, `${feeAndRent} lamports`);
  ok("the chain moved exactly $15 of USDC, and the book holds exactly the KITTY it delivered", held(USDC) === 85_000_000n && r.state().positions[KITTY]?.qtyRaw === held(KITTY).toString() && held(KITTY) > 0n);
  ok("…and the SOL in the middle passed through Jupiter's account and left it", w.chain.st.tokens.get(w.chain.ataOf(w.chain.JUP_AUTH, WSOL)).amount === 0n);

  for (const [mode, clause, what] of [
    ["hop_unshared", "intermediate_in_wallet", "a hop built as route_v2, its SOL in the wallet's own wrapped-SOL account (what Jupiter built unshared)"],
    ["hop_sol_input", "sol_as_input", "a hop whose route takes 3,000,000 of the wallet's lamports on the way — inside the engine's own fee and rent caps"],
  ]) {
    w.jupMode = mode;
    const sends = w.chain.st.sent.size;
    w.decisions.push({ rationale: `More KITTY (${mode}).`, actions: [buy(KITTY, 10)] });
    await r.runNow();
    await r.tick();
    const refusal = journalOf(r, "refusal")[0];
    ok(`${what}: refused at ${clause} before signing, nothing sent`, refusal?.clause === clause && refusal.from === "execution" && w.chain.st.sent.size === sends, `${refusal?.clause}: ${refusal?.message?.slice(0, 100)}`);
  }
  w.jupMode = null;
  ok("…and the wallet still holds no wrapped SOL, and only the KITTY the good buy delivered", !w.chain.st.tokens.has(walletSol) && r.state().positions[KITTY]?.qtyRaw === held(KITTY).toString());

  const usdcBefore = held(USDC), lamportsMid = w.chain.st.lamports.get(AUTO);
  w.decisions.push({ rationale: "Take KITTY off.", actions: [sell(KITTY, 1)] });
  await r.runNow();
  await r.tick();
  const back = journalOf(r, "fill")[0];
  ok("the KITTY sold back live through SOL (KITTY → SOL → USDC): USDC returned, the position closed", back?.side === "sell" && back.symbol === "KITTY" && back.paper === false && held(USDC) > usdcBefore && held(KITTY) === 0n && !r.state().positions[KITTY]);
  ok("…its SOL moved by the fee alone, and still no wrapped SOL in the wallet", lamportsMid - w.chain.st.lamports.get(AUTO) === 5_000n + 50_000n && !w.chain.st.tokens.has(walletSol));
  w.decisions.push({ rationale: "POPCAT, direct.", actions: [buy(POPCAT, 12)] });
  await r.runNow();
  await r.tick();
  ok("in the same agent a POPCAT buy still goes direct, exactly as before: route_v2 on its USDC pool, no shared-accounts switch in the body",
    journalOf(r, "fill")[0]?.symbol === "POPCAT" && w.swapBodies.at(-1)?.quoteResponse.routePlan.length === 1 && !("useSharedAccounts" in w.swapBodies.at(-1)));
}

section("16. LIQUIDATE ALL KEEPS SELLING WHAT IT COULD NOT SELL AT ONCE");
{
  /* Regression: a sell Liquidate all could not make was never tried again — the popup and
     the journal said "the rest are retried every tick", and nothing retried it. */
  const w = createWorld();
  const r = w.makeRunner();
  await r.saveSpec({ ...SPEC, name: "Stubborn cat" });
  await r.start();
  w.decisions.push({ rationale: "Buy two.", actions: [buy(POPCAT, 20), buy(MEW, 20)] });
  await r.tick();
  w.prices[MEW] = null;                                          // no route for MEW, and no price
  const out = await r.liquidateAll();
  ok("liquidate all with MEW unroutable: POPCAT sold, MEW not, the agent paused and still liquidating",
    out.done.find((d) => d.mint === POPCAT)?.sold === true && out.done.find((d) => d.mint === MEW)?.sold === false && r.status().status === "paused" && r.status().liquidating === true);
  w.prices[MEW] = 0.50;                                          // inside its stop and its take: no protection would sell it
  w.advance(30_000);
  await r.tick();
  ok("the next tick sells MEW for liquidate all, not for a stop or a take", r.status().positions.length === 0 && journalOf(r, "fill")[0]?.protection === "liquidate_all" && journalOf(r, "fill")[0].symbol === "MEW");
  ok("…and says it is finished; nothing is left to liquidate", r.status().liquidating === false && journalOf(r, "control")[0]?.action === "liquidated");

  const w2 = createWorld();
  const r2 = w2.makeRunner();
  await r2.saveSpec({ ...SPEC, name: "Changed-mind cat" });
  await r2.start();
  w2.decisions.push({ rationale: "Buy one.", actions: [buy(MEW, 20)] });
  await r2.tick();
  w2.prices[MEW] = null;
  await r2.liquidateAll();
  await r2.resume();
  w2.prices[MEW] = 0.50;
  w2.advance(30_000);
  await r2.tick();
  ok("resuming ends the liquidation: what is held is the model's again", r2.status().liquidating === false && r2.status().positions.length === 1);
}

section("17. A LIVE BUY SENT WITHOUT A READABLE OUTCOME PAUSES THE AGENT");
{
  /* Regression: a live buy whose confirmation timed out ("ambiguous") was journaled as failed
     and the agent kept running — while the buy had landed, as POPCAT no stop loss watched. */
  const { w, r, held } = await liveRig();
  const status = w.chain.rpc.getSignatureStatus;
  w.chain.rpc.getSignatureStatus = async () => null;            // the RPC never reports it
  w.decisions.push({ rationale: "Buy POPCAT.", actions: [buy(POPCAT, 20)] });
  await r.tick();
  w.chain.rpc.getSignatureStatus = status;
  ok("the buy landed on chain, and the book could not know it", held(POPCAT) > 0n && r.status().positions.length === 0 && journalOf(r, "refusal")[0]?.clause === "ambiguous");
  const halt = journalOf(r, "control")[0];
  ok("the agent is PAUSED, saying the tokens may be in the wallet with no stop loss", r.status().status === "paused" && halt?.action === "paused" && /no stop loss or take profit watches it/.test(halt.message));
  ok("…and the owner is told", w.notes.some((n) => n.kind === "attention" && /sell POPCAT by hand/.test(n.body)));
  ok("…and the pause is already in storage", w.store.get(AGENT_STATE_STORAGE_KEY).status === "paused");
}

section("18. THE BOOK IS WRITTEN AS IT CHANGES, NOT ONLY WHEN A TICK ENDS");
{
  /* Regression: the state was stored once, at the end of a tick. A worker ended mid-tick
     (Chrome closed, the machine asleep) forgot a fill it had made and the model's turn it had
     taken — and on waking asked again and bought again, over a cap that could not see it. */
  const w = createWorld();
  await w.makeRunner().saveSpec({ ...SPEC, name: "Mortal cat" });
  let quotes = 0;
  const hanging = async (url, init) => (new URL(url).pathname === "/swap/v1/quote" && ++quotes === 2 ? new Promise(() => {}) : w.fetchImpl(url, init));
  const jupiter = createJupiterClient({ fetchImpl: hanging, clock: w.clock, sleep: w.sleep, timers: w.timers });
  const dying = createAgentRunner({ clock: w.clock, storage: w.storage, market: w.market, brain: w.brain, jupiter, hasApiKey: async () => true });
  await dying.start();
  w.decisions.push({ rationale: "Buy two.", actions: [buy(POPCAT, 20), buy(MEW, 20)] });
  dying.tick();                                                  // the second quote never answers: the worker "dies" there
  for (let i = 0; i < 200 && !dying.state().positions[POPCAT]; i++) await settle();
  const asked = w.anthropic.length;
  const woken = w.makeRunner();
  await woken.load();
  ok("a new worker finds the POPCAT fill made before the old one died", woken.state().positions[POPCAT]?.qtyRaw === dying.state().positions[POPCAT]?.qtyRaw && woken.status().vault.settlementUsd === 80);
  ok("…and the model's turn it had taken", woken.state().nextBrainAt === dying.state().nextBrainAt && woken.state().nextBrainAt > w.clock());
  await woken.tick();
  ok("…so it does not ask the model again, or buy again, on waking", w.anthropic.length === asked && journalOf(woken, "fill").length === 1);

  /* The live half: a worker that dies between the key signing and the fill being booked. */
  const L2 = await liveRig();
  const send = L2.w.chain.rpc.sendTransaction;
  L2.w.chain.rpc.sendTransaction = async (tx) => { await send(tx); return new Promise(() => {}); };   // lands, then the worker dies
  L2.w.decisions.push({ rationale: "Buy POPCAT.", actions: [buy(POPCAT, 20)] });
  L2.r.tick();
  for (let i = 0; i < 400 && L2.held(POPCAT) === 0n; i++) await settle();
  ok("(the buy landed while the old worker waited)", L2.held(POPCAT) > 0n && L2.w.store.get(AGENT_STATE_STORAGE_KEY).inflight?.side === "buy");
  const next = L2.w.makeRunner(L2.fences);
  await next.load();
  const said = journalOf(next, "control")[0];
  ok("a new worker that finds a live buy in flight pauses the agent and says why", next.status().status === "paused" && said?.action === "paused" && /stopped while a live buy of POPCAT/.test(said.message) && next.state().inflight === null);
  ok("…and tells the owner to check the wallet", L2.w.notes.some((n) => n.kind === "attention" && /may have landed unbooked/.test(n.title)));
}

section("19. WITHDRAW: THE TICKS STAND ASIDE, AND THE BREAKER JUDGES TRADING, NOT THE WITHDRAWAL");
{
  /* Regression: a tick during the sweep saw the USDC gone, tripped the breaker and, set to
     liquidate, sold the POPCAT the sweep was about to move; and a clean withdrawal tripped the
     breaker at 100% the tick after, notified the owner, and wrote a 100% max drawdown. */
  const { w, r, held, setHeld } = await liveRig({ spec: { drawdownAction: "liquidate" } });
  w.decisions.push({ rationale: "Buy POPCAT.", actions: [buy(POPCAT, 20)] });
  await r.tick();
  const jup = held(POPCAT);
  ok("(a live POPCAT position, $80 of USDC beside it)", r.status().positions.length === 1 && jup > 0n && held(USDC) === 80_000_000n);
  await r.pauseForWithdraw();
  setHeld(USDC, 0n);                                             // the sweep has moved the USDC…
  const sends = w.chain.st.sent.size;
  w.advance(30_000);
  const mid = await r.tick();                                    // …and the alarm fires mid-sweep
  ok("a tick during the sweep stands aside: no breaker, nothing sold", mid.skipped === "withdrawing" && w.chain.st.sent.size === sends && journalOf(r, "breaker").length === 0 && held(POPCAT) === jup);
  setHeld(POPCAT, 0n);                                              // …then the POPCAT
  await r.markWithdrawn({ to: "PhantomOwner1111111111111111111111111111111", tokens: [{ mint: USDC, symbol: "USDC", ui: "80" }, { mint: POPCAT, symbol: "POPCAT", ui: "66" }], sol: null });
  w.advance(30_000);
  await r.tick();
  ok("after it, the ticks run again; the POPCAT row is closed as withdrawn, not sold", r.status().positions.length === 0 && r.status().pnl.closed[0]?.reason.startsWith("withdrawn to") && r.status().pnl.closed[0].pnlUsd === null);
  ok("…and the breaker does not trip on money the owner took out", journalOf(r, "breaker").length === 0 && r.status().day.tripped === false && r.status().day.drawdownPct < 1 && !w.notes.some((n) => /breaker tripped/.test(n.title)), `drawdown ${r.status().day.drawdownPct}%`);
  ok("…nor does it write a max drawdown the trading never had", r.status().pnl.maxDrawdownPct < 1, `${r.status().pnl.maxDrawdownPct}%`);
  ok("…and the journal says what left, as flows, not trades", journalOf(r, "flow").length === 2 && journalOf(r, "flow").every((f) => f.usd < 0));
  await r.pauseForWithdraw();
  await r.markWithdrawn(null);
  w.advance(30_000);
  ok("a withdrawal that failed still hands the wallet back to the ticks", (await r.tick()).ticked === true && journalOf(r, "control").some((c) => c.action === "withdraw_failed"));
}

section("20. A DEPOSIT MOVES THE DAY'S BASE: THE BREAKER IS NOT BLUNTED");
{
  /* Regression: the breaker judged the vault against its value at the start of the UTC day,
     deposits included — so $1,000 added to a $100 vault put a 5% breaker $1,005 away. */
  const { w, r, held, setHeld } = await liveRig({ spec: { maxPositionUsd: 500, maxExposurePct: 100, stopLossPct: 30, takeProfitPct: 100 } });
  await r.tick();
  ok("(the UTC day starts at the $100 vault)", r.status().day.startEquityUsd === 100);
  setHeld(USDC, held(USDC) + 1_000_000_000n);                   // the owner funds $1,000 more from Phantom
  w.decisions.push({ rationale: "Buy POPCAT big.", actions: [buy(POPCAT, 400)] });
  await r.runNow();
  w.advance(30_000);
  await r.tick();
  ok("the deposit is a flow: the day's base is now $1,100, and the $400 buy fills", r.status().day.startEquityUsd === 1_100 && journalOf(r, "flow")[0]?.usd === 1_000 && r.status().positions[0]?.costUsd > 399, `${r.status().day.startEquityUsd}`);
  w.prices[POPCAT] = 0.30 * 0.84;                                   // −16% on $400: about 5.9% of $1,100
  w.advance(30_000);
  await r.tick();
  ok("a 5.9% loss on the funded vault trips the 5% breaker", r.status().day.tripped === true && journalOf(r, "breaker").length === 1, `${r.status().day.drawdownPct}% of ${r.status().day.startEquityUsd}`);
}

section("21. PAUSE PRESSED WHILE THE MODEL IS DECIDING: NO BUY FROM THAT DECISION");
{
  /* Regression: Pause waited its turn behind a tick that was waiting on the model, and the
     buys that decision named were made before the pause took hold. */
  const w = createWorld();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const slowBrain = createBrain({ fetchImpl: async (url, init) => { if (new URL(url).pathname === "/v1/messages") await gate; return w.fetchImpl(url, init); }, apiKey: async () => w.key, timers: w.timers });
  const r = createAgentRunner({ clock: w.clock, storage: w.storage, market: w.market, brain: slowBrain, jupiter: w.jupiter, hasApiKey: async () => true });
  await r.saveSpec({ ...SPEC, name: "Slow cat" });
  await r.start();
  w.decisions.push({ rationale: "Buy POPCAT.", actions: [buy(POPCAT, 20)] });
  const t = r.tick();
  for (let i = 0; i < 50; i++) await settle();
  const paused = r.pause();                                      // the owner presses Pause while the model thinks
  release();
  await t; await paused;
  ok("the decision arrives after Pause was pressed: its buy is refused (paused), nothing bought", r.status().positions.length === 0 && journalOf(r, "refusal")[0]?.clause === "paused" && r.status().status === "paused");
}

section("22. A CAT COIN JUPITER QUOTES ONLY WHEN ASKED DIRECT: BOUGHT AND SOLD, PAPER AND LIVE");
{
  /* Regression: every agent quote was asked the hop's way, with maxAccounts 24, and that drops
     a direct route Jupiter quotes when asked direct — LMEOW's only USDC pool, PumpSwap's
     (recorded, §25). Such a coin could not be bought, and one already held could not be sold:
     the stop loss, the take profit and Liquidate all failed at jupiter_no_route every tick.
     GRUMPY plays that coin here: a direct USDC pool that any ask with maxAccounts misses, and,
     live, a pool that opens an account for the wallet on its first swap at the wallet's cost,
     as PumpSwap does. */
  const w = createWorld();
  w.paperVia[GRUMPY] = [];
  w.maxAccountsBlind.add(GRUMPY);
  const r = w.makeRunner();
  await r.saveSpec({ ...SPEC, name: "Pump cat", universe: [POPCAT, GRUMPY] });
  await r.start();
  w.decisions.push({ rationale: "GRUMPY.", actions: [buy(GRUMPY, 20, "trend")] });
  await r.tick();
  const asks = () => w.quoteLog.filter((x) => x.ask.inputMint === GRUMPY || x.ask.outputMint === GRUMPY);
  const paperBought = journalOf(r, "fill")[0]?.symbol === "GRUMPY" && journalOf(r, "fill")[0].paper;
  ok("paper: the GRUMPY buy filled on its direct route — asked direct, as before the hop existed, and the hop never asked",
    paperBought && asks().length === 1 && asks()[0].ask.onlyDirectRoutes === "true" && !("maxAccounts" in asks()[0].ask), paperBought ? "" : JSON.stringify(journalOf(r, "refusal")[0] ?? {}));
  w.prices[GRUMPY] = 150 * 1.2;
  w.advance(30_000);
  await r.tick();
  ok("paper: up 20%, the take profit sold it on the same direct route; nothing is held", journalOf(r, "fill")[0]?.side === "sell" && journalOf(r, "fill")[0].protection === "take_profit" && r.status().positions.length === 0
    && asks().every((x) => !("maxAccounts" in x.ask)));

  const { w: lw, r: lr, AUTO: A, held } = await liveRig({ spec: { universe: [POPCAT, GRUMPY] }, pumpLike: [GRUMPY] });
  const userAccount = userAccountOf(A);
  for (const [hostile, clause, what] of [
    ["overfund", "sol_as_input", "a pool program that keeps 1,000,000 of the wallet's lamports more than its account's rent — inside the engine's own fee and rent caps"],
    ["wallet_token", "custody", "a pool program that opens a wrapped-SOL token account of the wallet's, not at its associated address"],
  ]) {
    lw.chain.poolFor(GRUMPY).hostile = hostile;
    const sends = lw.chain.st.sent.size;
    lw.decisions.push({ rationale: `GRUMPY (${hostile}).`, actions: [buy(GRUMPY, 20)] });
    await lr.runNow();
    await lr.tick();
    const refusal = journalOf(lr, "refusal")[0];
    ok(`live: ${what}: refused at ${clause} before signing, nothing sent`, refusal?.clause === clause && refusal.from === "execution" && lw.chain.st.sent.size === sends && !lw.chain.st.other.has(userAccount) && !lw.chain.st.tokens.has(userAccount),
      `${refusal?.clause}: ${refusal?.message?.slice(0, 110)}`);
  }
  lw.chain.poolFor(GRUMPY).hostile = null;
  const lamportsBefore = lw.chain.st.lamports.get(A), quotesBefore = lw.quoteLog.length;
  lw.decisions.push({ rationale: "GRUMPY.", actions: [buy(GRUMPY, 20)] });
  await lr.runNow();
  await lr.tick();
  const fill = journalOf(lr, "fill")[0];
  const bought = fill?.side === "buy" && fill.symbol === "GRUMPY" && fill.paper === false && lr.status().status === "running";
  ok("live: the GRUMPY buy filled on the direct route, asked direct only — signed, sent, read back", bought
    && lw.quoteLog.slice(quotesBefore).every((x) => x.ask.onlyDirectRoutes === "true" && !("maxAccounts" in x.ask)), bought ? "" : JSON.stringify(journalOf(lr, "refusal")[0] ?? {}));
  ok("…the pool opened the wallet's account at its minimum, and the wallet's SOL moved by the fee, the GRUMPY account's rent and that account's rent, to the lamport",
    lw.chain.st.other.get(userAccount)?.lamports === rentHere(USER_ACCOUNT_BYTES) && lamportsBefore - lw.chain.st.lamports.get(A) === 5_000n + 50_000n + RENT_ATA + rentHere(USER_ACCOUNT_BYTES));
  ok("…and the book holds exactly the GRUMPY the chain delivered", lr.state().positions[GRUMPY]?.qtyRaw === held(GRUMPY).toString() && held(GRUMPY) > 0n);
  lw.chain.movePool(GRUMPY, 1.25);
  lw.prices[GRUMPY] = 150 * 1.25;
  lw.advance(30_000);
  await lr.tick();
  const back = journalOf(lr, "fill")[0];
  const sold = back?.side === "sell" && back.protection === "take_profit" && back.paper === false && held(GRUMPY) === 0n && !lr.state().positions[GRUMPY];
  ok("live: up 25%, the take profit sold it back on the same direct route; the position closed", sold, sold ? "" : JSON.stringify(journalOf(lr, "refusal")[0] ?? {}));
}

section("23. AN ADDRESS SOMEONE SENT SOL TO FIRST: THE BUY GOES THROUGH, AND IS BOOKED");
{
  /* Regression: the rent the wallet may pay was counted only for accounts the read before
     found EMPTY. Anyone may send the 0-byte minimum (650,240 lamports on mainnet that day) to
     the autopilot wallet's future coin-account address; it then reads as a System account,
     the create tops it up (the recorded top-up is checked in §25), the wallet pays less than
     the full rent — and every buy of that coin was refused at sol_as_input, for good, saying
     the wallet's SOL was being spent as trade input. Counted right in the check, the fill
     reader had the same blind spot and would have paused the agent on a landed buy. Here:
     the KITTY account (a hop), the POPCAT account (direct) and the account the GRUMPY pool
     opens for the wallet, all three sent SOL by a stranger first. */
  const { w, r, AUTO: A, held } = await liveRig({ spec: { universe: [POPCAT, KITTY, GRUMPY] }, pumpLike: [GRUMPY] });
  const userAccount = userAccountOf(A);
  for (const address of [w.chain.ataOf(A, KITTY), w.chain.ataOf(A, POPCAT), userAccount]) w.chain.st.lamports.set(address, PREFUND);
  const before = w.chain.st.lamports.get(A);
  w.decisions.push({ rationale: "Three buys.", actions: [buy(KITTY, 15), buy(POPCAT, 15), buy(GRUMPY, 15)] });
  await r.tick();
  const fills = journalOf(r, "fill");
  ok("all three buys filled and were booked — none refused, the agent not paused", ["KITTY", "POPCAT", "GRUMPY"].every((sym) => fills.some((f) => f.symbol === sym && f.side === "buy" && f.paper === false))
    && journalOf(r, "refusal").length === 0 && r.status().status === "running", JSON.stringify(journalOf(r, "refusal")[0] ?? {}));
  ok("…each account ended at its minimum, and the wallet paid only the top-up of each pre-funded one on top of the fees",
    w.chain.st.tokens.get(w.chain.ataOf(A, KITTY))?.lamports === RENT_ATA && w.chain.st.tokens.get(w.chain.ataOf(A, POPCAT))?.lamports === RENT_ATA && w.chain.st.other.get(userAccount)?.lamports === rentHere(USER_ACCOUNT_BYTES)
    && before - w.chain.st.lamports.get(A) === 3n * 55_000n + 2n * (RENT_ATA - PREFUND) + RENT_ATA + (rentHere(USER_ACCOUNT_BYTES) - PREFUND), `${before - w.chain.st.lamports.get(A)} lamports`);
  ok("…and the book holds exactly what the chain delivered of each", [KITTY, POPCAT, GRUMPY].every((m) => r.state().positions[m]?.qtyRaw === held(m).toString() && held(m) > 0n));
  const fees = r.state().stats.live.feesLamports;
  ok("…with the rent booked as what the wallet paid: 3 fees, 2 top-ups, one full account and one top-up", fees === Number(3n * 55_000n + 2n * (RENT_ATA - PREFUND) + RENT_ATA + (rentHere(USER_ACCOUNT_BYTES) - PREFUND)), `${fees} lamports`);

  /* The fill reader alone, on a landed buy whose coin account and pool account were both
     pre-funded: the token balances name the one, `opened` the other. */
  const W = newKey(), coin = newKey(), usdcAcct = newKey(), pda = newKey(), vault = newKey();
  const topUps = (RENT_ATA - PREFUND) + (rentHere(USER_ACCOUNT_BYTES) - PREFUND);
  const landed = (walletAfter = 10_000_000n - 55_000n - topUps) => ({ slot: 1, transaction: { message: { accountKeys: [W, coin, usdcAcct, pda, vault] } }, meta: { err: null, fee: 55_000,
    preBalances: [10_000_000, Number(PREFUND), Number(RENT_ATA), Number(PREFUND), Number(RENT_ATA)], postBalances: [Number(walletAfter), Number(RENT_ATA), Number(RENT_ATA), Number(rentHere(USER_ACCOUNT_BYTES)), Number(RENT_ATA)],
    preTokenBalances: [{ accountIndex: 2, mint: USDC, owner: W, uiTokenAmount: { amount: "100000000", decimals: 6 } }],
    postTokenBalances: [{ accountIndex: 1, mint: KITTY, owner: W, uiTokenAmount: { amount: "5000", decimals: 9 } }, { accountIndex: 2, mint: USDC, owner: W, uiTokenAmount: { amount: "80000000", decimals: 6 } }] } });
  const read = (tx, opened) => { try { return fillFromTransaction(tx, { wallet: W, mint: KITTY, side: "buy", quoteMint: USDC, quoteDecimals: 6, opened }); } catch (e) { return e.message; } };
  const f = read(landed(), [pda]);
  ok("fillFromTransaction: a pre-funded coin account (known from the token balances) and pool account (named in `opened`) count their top-ups as rent", f?.rentLamports === topUps.toString() && f.qtyRaw === "5000" && f.quoteInRaw === "20000000", JSON.stringify(f));
  ok("…without `opened` the pool account's top-up is an unexplained drain, refused", /beyond fee and rent/.test(read(landed(), null)));
  ok("…and one lamport more than the fee and those top-ups is still refused: the count stays exact", /beyond fee and rent/.test(read(landed(10_000_000n - 55_000n - topUps - 1n), [pda])));
  ok("…and naming an account in `opened` that it did not gain in the landed transaction counts nothing for it", read(landed(), [pda, vault])?.rentLamports === topUps.toString());
}

section("24. THE READ BEFORE AND THE SIMULATION, ON ONE SLOT");
{
  /* Regression: the guard read the wallet, then simulated, in two calls, and never checked
     they saw one state. The autopilot wallet is shared: another lane's transaction landing
     between them moved the "spend" the check holds to the lamport. SOL leaving in the gap
     refused an honest swap (a stop loss included) at sol_as_input; SOL arriving hid the same
     amount of a swap that took the wallet's SOL. */
  const createRpcSim = createRpc({ url: "https://rpc.double", fetchImpl: async () => ({ ok: true, status: 200, async json() { return { jsonrpc: "2.0", id: 1, result: { context: { slot: 450_351_125 }, value: { err: null, logs: [], accounts: [] } } }; } }) });
  const sim = await createRpcSim.simulateTransaction("AA==", { addresses: [] });
  ok("rpc.mjs: a simulation now carries the slot it ran on (contextSlot), beside what it always returned", sim.contextSlot === 450_351_125 && sim.err === null && Array.isArray(sim.accounts));

  const { w, r, AUTO: A } = await liveRig({ spec: { universe: [POPCAT, KITTY] } });
  w.decisions.push({ rationale: "KITTY.", actions: [buy(KITTY, 15)] });
  await r.tick();
  ok("(a live KITTY position, bought through SOL)", r.state().positions[KITTY] && journalOf(r, "fill")[0]?.symbol === "KITTY");
  const landOnce = (lamports) => { let n = 0; return (st) => { if (n++ === 0) { st.lamports.set(A, st.lamports.get(A) + lamports); st.slot++; } }; };
  const sims = () => w.chain.st.calls.filter((c) => c === "sim").length;

  w.chain.st.beforeSim = landOnce(-5_000n);
  const lamportsBefore = w.chain.st.lamports.get(A), simsBefore = sims();
  w.prices[KITTY] = 0.07 * 0.85;
  w.chain.movePool(KITTY, 0.85);
  w.advance(30_000);
  await r.tick();
  const stop = journalOf(r, "fill")[0];
  ok("another transaction of the wallet (5,000 lamports) lands between the read and the simulation: the stop loss still sells",
    stop?.side === "sell" && stop.protection === "stop_loss" && stop.paper === false && !r.state().positions[KITTY], JSON.stringify(journalOf(r, "refusal")[0] ?? {}));
  ok("…because the guard saw the slot move, took the pair again, and judged the one-slot pair: two simulations, and the wallet moved by the other transaction and this one's fee alone",
    sims() - simsBefore === 2 && lamportsBefore - w.chain.st.lamports.get(A) === 5_000n + 55_000n, `${sims() - simsBefore} simulations`);

  /* A fresh wallet: SOL arriving in the gap, while the route takes as much of the wallet's. */
  const { w: w2, r: r2, AUTO: A2 } = await liveRig({ spec: { universe: [POPCAT, KITTY] } });
  const sims2 = () => w2.chain.st.calls.filter((c) => c === "sim").length;
  let n2 = 0;
  w2.chain.st.beforeSim = (st) => { if (n2++ === 0) { st.lamports.set(A2, st.lamports.get(A2) + 3_000_000n); st.slot++; } };
  w2.jupMode = "hop_sol_input";
  let sends = w2.chain.st.sent.size;
  const lamports2 = w2.chain.st.lamports.get(A2);
  w2.decisions.push({ rationale: "KITTY (hop_sol_input).", actions: [buy(KITTY, 10)] });
  await r2.tick();
  let refusal = journalOf(r2, "refusal")[0];
  ok("3,000,000 lamports ARRIVE in the gap while the route takes 3,000,000 of the wallet's: still refused at sol_as_input, nothing sent — the arrival no longer hides the spend",
    refusal?.clause === "sol_as_input" && w2.chain.st.sent.size === sends && w2.chain.st.lamports.get(A2) === lamports2 + 3_000_000n, `${refusal?.clause}: ${refusal?.message?.slice(0, 100)}`);
  w2.jupMode = null;

  w2.chain.st.beforeSim = (st) => { st.slot++; };
  sends = w2.chain.st.sent.size;
  const simsNow = sims2();
  w2.decisions.push({ rationale: "POPCAT.", actions: [buy(POPCAT, 12)] });
  await r2.runNow();
  await r2.tick();
  refusal = journalOf(r2, "refusal")[0];
  ok(`a chain where every simulation lands in a later slot than its read: refused at simulation_unpinned after ${SIMULATION_PIN_TRIES} pairs, nothing sent`,
    refusal?.clause === "simulation_unpinned" && sims2() - simsNow === SIMULATION_PIN_TRIES && w2.chain.st.sent.size === sends, `${refusal?.clause}: ${refusal?.message?.slice(0, 100)}`);
  w2.chain.st.beforeSim = null;
  w2.decisions.push({ rationale: "POPCAT.", actions: [buy(POPCAT, 12)] });
  await r2.runNow();
  await r2.tick();
  ok("…and once the slots agree again, the same buy goes through on one pair", journalOf(r2, "fill")[0]?.symbol === "POPCAT" && journalOf(r2, "fill")[0].side === "buy");
}

section("25. THE RECORDED PUMPSWAP BUY: LMEOW ASKED DIRECT, AND ITS RENT READ OFF MAINNET'S SIMULATION");
{
  /* Recorded 2026-09-25 (fixtures/agent/jupiter-usdc-lmeow-pumpswap.json): LMEOW's only USDC
     pool is PumpSwap's; Jupiter's build of a 10 USDC buy for a funded mainnet wallet, and
     that build simulated on the public RPC with every account it writes read on the same
     slot before. And mainnet's rent, a pre-funded create and twenty slot pairs
     (fixtures/agent/mainnet-rent-and-slot-reads.json). */
  const FX = read("./fixtures/agent/jupiter-usdc-lmeow-pumpswap.json");
  const RR = read("./fixtures/agent/mainnet-rent-and-slot-reads.json");
  const LMEOW = FX.tokenMint, T22 = TOKEN_2022_PROGRAM, PAMM = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
  const label = (a) => a.body?.routePlan?.map((h) => h.swapInfo.label).join(">") ?? a.body?.errorCode;
  ok("recorded: asked direct, Jupiter quoted LMEOW's PumpSwap pool both ways; asked the hop's way at maxAccounts 24, NO_ROUTES_FOUND both ways",
    label(FX.answers.buyDirect) === "Pump.fun Amm" && label(FX.answers.sellDirect) === "Pump.fun Amm" && FX.answers.buyHop24.status === 400 && label(FX.answers.buyHop24) === "NO_ROUTES_FOUND"
    && FX.answers.sellHop24.status === 400 && label(FX.answers.sellHop24) === "NO_ROUTES_FOUND" && FX.query.buyHop24.maxAccounts === "24" && !("maxAccounts" in FX.query.buyDirect));
  /* The agent's client, served the recorded answer to whatever it asks. */
  const served = [];
  const nameOf = (params) => Object.entries(FX.query).find(([, q]) => JSON.stringify(q) === JSON.stringify(params))?.[0] ?? null;
  const client = createJupiterClient({ fetchImpl: async (url) => { const n = nameOf(Object.fromEntries(new URL(url).searchParams)); served.push(n); return n ? response(FX.answers[n].status, FX.answers[n].body) : response(500, { error: "not recorded" }); }, clock: () => 0, sleep: async () => {} });
  const buyQ = await client.quote({ inputMint: USDC, outputMint: LMEOW, amountRaw: FX.query.buyDirect.amount, slippageBps: 100, solHop: true });
  const sellQ = await client.quote({ inputMint: LMEOW, outputMint: USDC, amountRaw: FX.query.sellDirect.amount, slippageBps: 100, solHop: true });
  ok("the agent's asks get the PumpSwap route both ways: each asked exactly as recorded, direct, and the hop never asked", label({ body: buyQ }) === "Pump.fun Amm" && label({ body: sellQ }) === "Pump.fun Amm" && served.join() === "buyDirect,sellDirect");

  const spec = normalizeAgentSpec({ universe: [LMEOW], custom: [{ mint: LMEOW, symbol: FX.token.symbol, name: FX.token.name, decimals: FX.token.decimals, program: T22, verifiedAt: Date.parse(FX.capturedAt) }] });
  const cq = checkQuote(FX.answers.buyDirect.body, { inputMint: USDC, outputMint: LMEOW, amountRaw: FX.query.buyDirect.amount, slippageBps: 100, slippageCapBps: 100, maxPriceImpactPct: AGENT_MAX_BUY_IMPACT_PCT, solHop: true });
  ok("LMEOW is a cat coin the agent admits as a custom mint, and its recorded buy quote passes: direct, 1.69% impact under the 2% cap", allowedPairsFor(spec).includes(`${USDC}>${LMEOW}`) && cq.intermediate === null && cq.legs === 1 && Math.abs(cq.impactPct - 1.688) < 0.001);
  const tables = await loadLookupTables({ async getMultipleAccounts(a) { return { accounts: a.map((x) => FX.lookupTables.find((t) => t.address === x) ?? null) }; } }, lookupTableKeysOf(FX.swapBuy.swapTransaction));
  const c = checkSwapTransaction({ txBase64: FX.swapBuy.swapTransaction, wallet: FX.user, inputMint: USDC, outputMint: LMEOW, inputProgram: TK, outputProgram: T22, amountRaw: FX.query.buyDirect.amount,
    quote: FX.answers.buyDirect.body, slippageCapBps: 100, lookupTables: tables, maxPriorityFeeLamports: AGENT_PRIORITY_FEE_LAMPORTS, allowedPairs: allowedPairsFor(spec), solHop: true });
  ok("Jupiter's recorded build passes the check before signing: route_v2, one step ending 0 → 1, one create (the wallet's LMEOW account, under Token-2022), priority fee 50,000",
    c.route.name === "route_v2" && c.route.lastStep.inputIndex === 0 && c.route.lastStep.outputIndex === 1 && c.intermediate === null && c.createdAtas.length === 1 && c.createdAtas[0] === c.outputAta && c.priorityFeeLamports === 50_000n);
  const S = FX.simulation, A = S.addresses;
  const own = [FX.user, c.outputAta, c.inputAta, c.walletIntermediateAta];
  ok("the recorded simulation is the runner's: [wallet, its LMEOW account, its USDC account, its wrapped-SOL account, then every other account the transaction writes], read and simulated on one slot",
    A.slice(0, 4).join() === own.join() && [...A.slice(4)].sort().join() === c.writableAddresses.filter((a) => !own.includes(a)).sort().join() && S.preSlot === S.simSlot && S.err === null);
  const preOf = (addresses) => addresses.map((a) => S.pre[A.indexOf(a)] ?? null);
  checkWritableCustody({ wallet: FX.user, writableAddresses: c.writableAddresses, accounts: preOf(c.writableAddresses), allowed: [c.inputAta, c.outputAta] });

  const rent = rentFromSysvar(FX.rentSysvar);
  ok("the rent sysvar that minute: 5,080 lamports a byte-year at a threshold of 1 — and its minimums are the ones getMinimumBalanceForRentExemption answered for 0, 165 and 170 bytes",
    rent.lamportsPerByteYear === 5_080n && rent.exemptionThreshold === 1 && [0, 165, 170].every((n) => rentExemptMinimum(rent, n) === BigInt(RR.minimumBalance[n])));
  const paid = rentOfOpenedAccounts({ addresses: A, before: S.pre, after: S.post, rent });
  const pumpAccount = PublicKey.findProgramAddressSync([Buffer.from("user_volume_accumulator"), key(FX.user)], new PublicKey(PAMM))[0].toBase58();
  ok("two accounts opened, each at exactly its minimum: the wallet's LMEOW account (170 bytes, 1,513,840) and PumpSwap's account for the wallet at its PDA (137 bytes, 1,346,200)",
    paid.opened.length === 2 && paid.opened[0].address === c.outputAta && paid.opened[0].lamports === 1_513_840n && paid.opened[1].address === pumpAccount && paid.opened[1].lamports === 1_346_200n
    && S.post[A.indexOf(pumpAccount)].owner === PAMM && paid.lamports === 2_860_040n);
  const spent = BigInt(S.pre[0].lamports) - BigInt(S.post[0].lamports);
  const spendClause = (rentLamports, spentLamports = spent) => { try { checkNativeSpend({ spentLamports, signatures: c.signatures, priorityFeeLamports: c.priorityFeeLamports, rentLamports }); return "passed"; } catch (e) { return e.clause; } };
  ok("the wallet's SOL moved 2,915,040: the 5,000 and 50,000 of fees and those two rents, to the lamport — checkNativeSpend passes", spent === 2_915_040n && spendClause(paid.lamports) === "passed");
  ok("…where counting the wallet's two token accounts alone — the rule before — left PumpSwap's 1,346,200 unexplained: an honest direct buy refused at sol_as_input", spendClause(1_513_840n) === "sol_as_input");
  checkIntermediateLeft({ address: c.walletIntermediateAta, before: S.pre[3], after: S.post[3] });
  checkOpenedCustody({ wallet: FX.user, addresses: A, before: S.pre, after: S.post, allowed: [c.outputAta, c.inputAta] });
  checkSafeAfter(S.post[1], { wallet: FX.user, mint: LMEOW, label: "LMEOW" });
  checkSafeAfter(S.post[2], { wallet: FX.user, mint: USDC, label: "USDC" });
  ok("…the wallet's own wrapped SOL (it held some) untouched, no other token account of the wallet opened, and both accounts safe after", S.pre[3]?.lamports > 0 && tokenAccountDetails(S.pre[3])?.mint === WSOL);

  /* Hostile edits of the recorded simulation. */
  const i = A.indexOf(pumpAccount);
  const edit = (fn) => { const post = S.post.map((x) => (x ? { ...x } : x)); fn(post); return post; };
  const clauseAfter = (post) => { try { checkOpenedCustody({ wallet: FX.user, addresses: A, before: S.pre, after: post, allowed: [c.outputAta, c.inputAta] }); const p = rentOfOpenedAccounts({ addresses: A, before: S.pre, after: post, rent });
    checkNativeSpend({ spentLamports: BigInt(S.pre[0].lamports) - BigInt(post[0].lamports), signatures: c.signatures, priorityFeeLamports: c.priorityFeeLamports, rentLamports: p.lamports }); return "passed"; } catch (e) { return e.clause; } };
  ok("PumpSwap's account holding one of the wallet's lamports more than its minimum: that lamport is not rent — sol_as_input",
    clauseAfter(edit((p) => { p[i].lamports += 1; p[0].lamports -= 1; })) === "sol_as_input");
  ok("the same address opened as a wrapped-SOL token account of the wallet's instead: custody",
    clauseAfter(edit((p) => { p[i] = { owner: TK, lamports: 1_488_440, data: [tokenAccountBytes({ mint: WSOL, owner: FX.user, amount: 0 }).toString("base64"), "base64"] }; p[0].lamports += 1_346_200 - 1_488_440; })) === "custody");
  ok("lamports sent to a bare address that stays bare are no rent: sol_as_input", clauseAfter(edit((p) => { p[i] = { owner: SYSTEM, lamports: 1_346_200, data: ["", "base64"] }; })) === "sol_as_input");

  /* A pre-funded create, as mainnet ran it. */
  const pf = RR.prefundedThenCreate, alone = RR.createAlone;
  const account = (x) => ({ owner: x.owner, lamports: x.lamports, data: [Buffer.alloc(x.dataLength).toString("base64"), "base64"] });
  const topUp = rentOfOpenedAccounts({ addresses: [RR.ata], before: [{ owner: SYSTEM, lamports: pf.transferLamports, data: ["", "base64"] }], after: [account(pf.accounts[1])], rent });
  ok("mainnet's pre-funded create: the account ended at 1,513,840 either way, and the wallet ended 645,240 higher (the stranger's 650,240, less one more signature's 5,000) — rent counted: the 863,600 top-up",
    pf.accounts[1].lamports === 1_513_840 && alone.accounts[1].lamports === 1_513_840 && pf.accounts[0].lamports - alone.accounts[0].lamports === 645_240 && pf.fee - alone.fee === 5_000 && topUp.lamports === 863_600n);

  /* The rent sysvar, unreadable. */
  const rentClause = (acct) => { try { rentFromSysvar(acct); return "passed"; } catch (e) { return e.clause; } };
  ok("a rent sysvar not returned, not the sysvar program's, short, or at a zero rate is refused at rent_unreadable",
    rentClause(null) === "rent_unreadable" && rentClause({ ...FX.rentSysvar, owner: SYSTEM }) === "rent_unreadable" && rentClause({ ...FX.rentSysvar, data: [Buffer.alloc(16).toString("base64"), "base64"] }) === "rent_unreadable"
    && rentClause({ ...FX.rentSysvar, data: [Buffer.alloc(17).toString("base64"), "base64"] }) === "rent_unreadable");
  const { w: rw, r: rr } = await liveRig();
  rw.chain.st.other.set(SYSVAR_RENT, { owner: SYSTEM, lamports: 1, data: Buffer.alloc(0) });      // an RPC that answers something else there
  const sends = rw.chain.st.sent.size;
  rw.decisions.push({ rationale: "POPCAT.", actions: [buy(POPCAT, 12)] });
  await rr.tick();
  ok("…and live, an RPC whose rent sysvar does not read refuses the swap there, nothing sent", journalOf(rr, "refusal")[0]?.clause === "rent_unreadable" && rw.chain.st.sent.size === sends);

  /* The slot pairs behind SIMULATION_PIN_TRIES. */
  const split = RR.slotPairs.filter((x) => x.readSlot !== x.simSlot), same = RR.slotPairs.filter((x) => x.readSlot === x.simSlot);
  ok(`twenty recorded read-then-simulate pairs: 7 split, one slot apart; every same-slot pair agreed to the lamport (the 5,000 fee) — so ${SIMULATION_PIN_TRIES} split pairs running is under 1 in 500`,
    RR.slotPairs.length === 20 && split.length === 7 && split.every((x) => x.simSlot - x.readSlot === 1) && same.every((x) => x.readLamports - x.simLamports === 5_000)
    && split.some((x) => x.readLamports - x.simLamports !== 5_000) && (7 / 20) ** SIMULATION_PIN_TRIES < 1 / 500);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
