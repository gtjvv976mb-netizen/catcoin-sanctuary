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
import { createAgentRunner, AGENT_SPEC_STORAGE_KEY, AGENT_STATE_STORAGE_KEY, JOURNAL_MAX } from "/home/user/Cat-Intelligence-Agency/src/lib/agent-runner.mjs";
import { createMarket } from "/home/user/Cat-Intelligence-Agency/src/lib/agent-market.mjs";
import { createBrain, DECISION_TOOL_NAME } from "/home/user/Cat-Intelligence-Agency/src/lib/agent-brain.mjs";
import {
  createJupiterClient, checkQuote, checkSwapTransaction, loadLookupTables, lookupTableKeysOf, checkWritableCustody, checkRouteMints, checkIntermediateLeft, checkNativeSpend,
  routeShape, tokenAccountDetails, jupiterProgramAuthority, SwapCheckError, JUPITER_PROGRAM, JUPITER_EVENT_AUTHORITY, LOOKUP_TABLE_PROGRAM,
} from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import { SOLANA_CATS, normalizeAgentSpec, agentArmSentence, allowedPairsFor, DEFAULT_SETTLEMENT_MINT, AGENT_MAX_BUY_IMPACT_PCT, AGENT_PRIORITY_FEE_LAMPORTS } from "/home/user/Cat-Intelligence-Agency/src/lib/agent-strategy.mjs";
import { createHawkEngine, memoryStore } from "/home/user/Cat-Intelligence-Agency/src/lib/engine.mjs";
import { createKeystore, createSessionSigner } from "/home/user/Cat-Intelligence-Agency/src/lib/session-wallet.mjs";
import { associatedTokenAddress, fromBase64, toBase64, ATA_PROGRAM } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
import { TOKEN_PROGRAM } from "/home/user/Cat-Intelligence-Agency/vendor/executor/token2022.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}${detail ? "  — " + detail : ""}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? "  — " + detail : ""}`); }
};
const section = (title) => console.log(`\n${title}\n${"─".repeat(title.length)}`);
const read = (p) => JSON.parse(fs.readFileSync(new URL(p, "file:///home/user/Cat-Intelligence-Agency/"), "utf8"));
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
     as the live API did. */
  function paperQuote(q) {
    const inDec = DECIMALS[q.inputMint], outDec = DECIMALS[q.outputMint];
    const priceOf = (m) => (m === USDC ? 1 : w.prices[m]);
    if (priceOf(q.inputMint) == null || priceOf(q.outputMint) == null) return response(400, { error: "no route", errorCode: "COULD_NOT_FIND_ANY_ROUTE" });
    const token = q.inputMint === USDC ? q.outputMint : q.inputMint;
    const via = w.paperVia[token] ?? (HOP_TOKENS.has(token) ? [WSOL] : []);
    if (via.length && q.onlyDirectRoutes === "true") return response(400, { error: "No routes found", errorCode: "NO_ROUTES_FOUND" });
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
  const mewAsk = P.quoteLog.find((x) => x.ask.outputMint === MEW);
  ok("MEW has no USDC pool here, as on the live API: its quote asked for one hop at most (not direct only, maxAccounts 24) and came back USDC → SOL → MEW",
    mewAsk?.ask.onlyDirectRoutes === "false" && mewAsk.ask.maxAccounts === "24" && mewAsk.ask.restrictIntermediateTokens === "true" && mewAsk.path.join() === [USDC, WSOL, MEW].join(), JSON.stringify(mewAsk?.ask));
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
  const runnerSource = fs.readFileSync(new URL("file:///home/user/Cat-Intelligence-Agency/src/lib/agent-runner.mjs"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
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
 *  its shared-accounts route. */
const JUP_AUTHORITY_ID = 3;
function createChain(w, { wallet, usdcRaw = 100_000_000n, lamports = 100_000_000n }) {
  const ATTACKER = newKey();
  const st = { lamports: new Map([[wallet, lamports]]), tokens: new Map(), pools: new Map(), alts: new Map(), sent: new Map(), calls: [], slot: 451_000_000, blockHeight: 429_000_000 };
  const ataOf = (owner, mint) => associatedTokenAddress(owner, mint, TK);
  st.tokens.set(ataOf(wallet, USDC), { mint: USDC, owner: wallet, amount: usdcRaw, delegate: null, lamports: RENT_ATA });
  const ALT = newKey();
  st.alts.set(ALT, [JUPITER_EVENT_AUTHORITY]);
  /* Each pool holds $1,000,000 a side at the price given (the quote side's own USD price). */
  const addPool = (token, priceUsd, quoteMint = USDC, quoteUsd = 1) => {
    const address = newKey(), authority = newKey(), vQuote = newKey(), vToken = newKey();
    const quoteReserve = BigInt(Math.round(1_000_000 / quoteUsd * 10 ** DECIMALS[quoteMint]));
    const tokenReserve = BigInt(Math.round(1_000_000 / priceUsd * 10 ** DECIMALS[token]));
    st.tokens.set(vQuote, { mint: quoteMint, owner: authority, amount: quoteReserve, delegate: null, lamports: RENT_ATA });
    st.tokens.set(vToken, { mint: token, owner: authority, amount: tokenReserve, delegate: null, lamports: RENT_ATA });
    st.pools.set(address, { token, quoteMint, quoteReserve, tokenReserve, vQuote, vToken, feeBps: 25 });
    st.alts.set(ALT, [...st.alts.get(ALT), address, vQuote, vToken]);
  };
  addPool(POPCAT, 0.30); addPool(MEW, 0.50); addPool(WSOL, SOL_USD); addPool(KITTY, 0.07, WSOL, SOL_USD);
  /* Jupiter's program authority 3 and its own associated accounts, as the live shared routes had. */
  const JUP_AUTH = PublicKey.findProgramAddressSync([Buffer.from("authority"), Buffer.from([JUP_AUTHORITY_ID])], new PublicKey(JUPITER_PROGRAM))[0].toBase58();
  for (const mint of [USDC, WSOL, KITTY, POPCAT, MEW]) st.tokens.set(ataOf(JUP_AUTH, mint), { mint, owner: JUP_AUTH, amount: 0n, delegate: null, lamports: RENT_ATA });
  st.alts.set(ALT, [...st.alts.get(ALT), ...[USDC, WSOL, KITTY].map((m) => ataOf(JUP_AUTH, m))]);
  const clone = () => ({ ...st, lamports: new Map(st.lamports), tokens: new Map([...st.tokens].map(([k, v]) => [k, { ...v }])), pools: new Map([...st.pools].map(([k, v]) => [k, { ...v }])) });
  const accountOf = (address, s = st) => {
    const a = String(address);
    if ([USDC, POPCAT, MEW, KITTY].includes(a)) return mintAccount(a);
    if (s.alts.has(a)) return { owner: LOOKUP_TABLE_PROGRAM, lamports: 1_000_000, data: [altBytes(s.alts.get(a)).toString("base64"), "base64"] };
    if (s.tokens.has(a)) { const t = s.tokens.get(a); return { owner: TK, lamports: Number(t.lamports), data: [tokenAccountBytes(t).toString("base64"), "base64"] }; }
    if (s.lamports.has(a)) return { owner: SYSTEM, lamports: Number(s.lamports.get(a)), data: ["", "base64"] };
    if (s.pools.has(a)) return { owner: POOL_PROGRAM, lamports: 2_000_000, data: [Buffer.alloc(64).toString("base64"), "base64"] };
    return null;
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
        if (bal(payerKey) < RENT_ATA) throw new Error("insufficient lamports for rent");
        s.lamports.set(payerKey, bal(payerKey) - RENT_ATA);
        s.tokens.set(ata, { mint, owner, amount: 0n, delegate: null, lamports: RENT_ATA });
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
        continue;
      }
      throw new Error(`the chain double does not run ${program}`);
    }
    return { fee };
  }
  const ownedBy = (s, owner) => [...s.tokens.entries()].filter(([, t]) => t.owner === owner).map(([a]) => a);
  const rpc = {
    url: "https://chain.double",
    async getMultipleAccounts(addresses) { st.calls.push("gma"); return { slot: st.slot, accounts: addresses.map((a) => accountOf(a)) }; },
    async getBalance(a) { return st.lamports.get(String(a)) ?? 0n; },
    async getTokenAccountBalance(a) { return st.tokens.get(String(a))?.amount ?? 0n; },
    async getLatestBlockhash() { return { blockhash: bs58.encode(Buffer.alloc(32, 7)), lastValidBlockHeight: st.blockHeight + 150 }; },
    async getBlockHeight() { return st.blockHeight; },
    async simulateTransaction(txBase64, { addresses = [] } = {}) {
      st.calls.push("sim");
      const s = clone();
      try { execute(fromBase64(txBase64), s, { verify: false }); return { err: null, logs: [], unitsConsumed: 150_000, accounts: addresses.map((a) => accountOf(a, s)) }; }
      catch (error) { return { err: { InstructionError: [3, { Custom: 1 }] }, logs: [`Program log: ${error.message}`], accounts: null }; }
    },
    async sendTransaction(txBase64) {
      st.calls.push("send");
      const bytes = fromBase64(txBase64);
      const tx = VersionedTransaction.deserialize(bytes);
      const sig = bs58.encode(tx.signatures[0]);
      if (st.sent.has(sig)) return sig;
      const payer = tx.message.staticAccountKeys[0].toBase58();
      const before = [payer, ...ownedBy(st, payer)];
      const pre = before.map((a) => ({ a, lamports: a === payer ? st.lamports.get(a) ?? 0n : st.tokens.get(a)?.lamports ?? 0n, token: st.tokens.get(a) ? { ...st.tokens.get(a) } : null }));
      let err = null, effects = null;
      const s = clone();
      try { effects = execute(bytes, s, { verify: true }); Object.assign(st, { lamports: s.lamports, tokens: s.tokens, pools: s.pools }); }
      catch (error) { err = { InstructionError: [3, { Custom: 1 }], message: error.message }; }
      const after = [...new Set([...before, ...ownedBy(st, payer)])];
      const lam = (a) => (a === payer ? st.lamports.get(a) ?? 0n : st.tokens.get(a)?.lamports ?? 0n);
      const preOf = (a) => pre.find((p) => p.a === a);
      const tb = (list) => list.filter((x) => x.token).map((x) => ({ accountIndex: x.i, mint: x.token.mint, owner: x.token.owner, uiTokenAmount: { amount: x.token.amount.toString(), decimals: DECIMALS[x.token.mint] } }));
      const meta = { err, fee: effects ? Number(effects.fee) : 5_000,
        preBalances: after.map((a) => Number(preOf(a)?.lamports ?? 0n)), postBalances: after.map((a) => Number(err ? preOf(a)?.lamports ?? 0n : lam(a))),
        preTokenBalances: tb(after.map((a, i) => ({ i, token: preOf(a)?.token ?? null }))), postTokenBalances: tb(after.map((a, i) => ({ i, token: err ? preOf(a)?.token ?? null : st.tokens.get(a) ? { ...st.tokens.get(a) } : null }))) };
      st.sent.set(sig, { err, meta, slot: ++st.slot, bytes });
      return sig;
    },
    async getSignatureStatus(sig) { const s = st.sent.get(sig); return s ? { err: s.err, confirmationStatus: "confirmed" } : null; },
    async getTransaction(sig) { const s = st.sent.get(sig); return s ? { slot: s.slot, meta: s.meta } : null; },
  };
  function quote(q) {
    const slip = Number(q.slippageBps);
    const answer = (out, routePlan) => response(200, { inputMint: q.inputMint, inAmount: q.amount, outputMint: q.outputMint, outAmount: out.toString(), otherAmountThreshold: ((out * BigInt(10_000 - slip) + 9_999n) / 10_000n).toString(),
      swapMode: q.swapMode, slippageBps: slip, platformFee: null, priceImpactPct: "0.0001", routePlan, instructionVersion: "V2" });
    const hop = (ammKey, inputMint, outputMint, inAmount, outAmount) => ({ swapInfo: { ammKey, label: "Scripted CPMM", inputMint, outputMint, inAmount: String(inAmount), outAmount: String(outAmount) }, percent: null, bps: 10_000 });
    const found = poolOf(q.inputMint, q.outputMint);
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
        meta(mode === "second_signer" ? ATTACKER : user, true, true), meta(poolAddress, false, true), meta(vIn, false, true), meta(vOut, false, true)] }),
      ...(mode === "drain" ? [SystemProgram.transfer({ fromPubkey: new PublicKey(user), toPubkey: new PublicKey(ATTACKER), lamports: 50_000_000 })] : []),
    ];
    const message = new TransactionMessage({ payerKey: new PublicKey(user), recentBlockhash: bs58.encode(Buffer.alloc(32, 9)), instructions: ixs }).compileToV0Message([altObject(ALT, st.alts.get(ALT))]);
    return response(200, { swapTransaction: toBase64(new VersionedTransaction(message).serialize()), lastValidBlockHeight: st.blockHeight + 150 });
  }
  return { st, rpc, quote, swap, ataOf, ATTACKER, JUP_AUTH, movePool(token, factor) { const p = [...st.pools.values()].find((x) => x.token === token); p.quoteReserve = p.quoteReserve * BigInt(Math.round(factor * 1000)) / 1000n; } };
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
  const asked = [];
  const client = createJupiterClient({ fetchImpl: async (url, init = {}) => { asked.push({ url, body: init.body ? JSON.parse(init.body) : null }); return response(200, url.includes("/quote") ? MEWFX.quoteBuy : MEWFX.swapBuy); }, clock: () => 0, sleep: async () => {} });
  await client.quote({ inputMint: USDC, outputMint: MEW, amountRaw: 10_000_000n, slippageBps: 100, solHop: true });
  await client.swapTransaction({ quote: MEWFX.quoteBuy, wallet: MEWFX.user, priorityFeeLamports: 50_000, sharedAccounts: true });
  await client.quote({ inputMint: USDC, outputMint: POPCAT, amountRaw: 10_000_000n, slippageBps: 100 });
  await client.swapTransaction({ quote: MEWFX.quoteBuy, wallet: MEWFX.user, priorityFeeLamports: 50_000 });
  const q = (i) => Object.fromEntries(new URL(asked[i].url).searchParams);
  ok("the agent's ask is the recorded one: not direct only, restrictIntermediateTokens, maxAccounts 24", JSON.stringify(q(0)) === JSON.stringify(MEWFX.query.quoteBuy));
  ok("…and its hop is built on shared accounts, no SOL wrapping", asked[1].body.useSharedAccounts === true && asked[1].body.wrapAndUnwrapSol === false);
  ok("a direct ask and build are what they always were: onlyDirectRoutes, no maxAccounts, no useSharedAccounts", q(2).onlyDirectRoutes === "true" && !("maxAccounts" in q(2)) && !("useSharedAccounts" in asked[3].body));
}

/* ═══ REGRESSIONS: THE MONEY PATHS UNDER FAILURE ═══════════════════════════════════════════ */
/** A fresh live agent on its own chain double, engine and unlocked autopilot wallet, started. */
async function liveRig({ usdcRaw = 100_000_000n, spec = {} } = {}) {
  const w = createWorld();
  const ks = createKeystore({ storage: mapStore(), session: mapStore(), clock: w.clock });
  const { publicKey } = await ks.create({ passphrase: PASS });
  const sg = createSessionSigner({ keystore: ks, clock: w.clock });
  w.chain = createChain(w, { wallet: publicKey, usdcRaw });
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

section("REPRO: another autopilot transaction lands between simulateGuard's read and its simulation");
async function scenario({ foreignDebit, label }) {
  const { w, r, AUTO, held } = await liveRig({ spec: { universe: [POPCAT, KITTY] } });
  w.decisions.push({ rationale: "KITTY: a $15 buy.", actions: [buy(KITTY, 15, "trend")] });
  await r.tick();
  const bought = journalOf(r, "fill")[0];
  ok(`${label}: the KITTY buy filled first (setup)`, bought?.side === "buy" && bought.symbol === "KITTY", JSON.stringify(journalOf(r, "refusal")[0] ?? {}));
  /* Between the guard's getMultipleAccounts and its simulateTransaction, a sniper-lane
     transaction signed by the same autopilot wallet lands: the wallet loses its fee. */
  const rpc = w.chain.rpc, origSim = rpc.simulateTransaction;
  let fired = false;
  rpc.simulateTransaction = async (tx, opts) => {
    if (!fired && foreignDebit > 0n && (opts?.addresses ?? []).includes(AUTO)) { fired = true; w.chain.st.lamports.set(AUTO, w.chain.st.lamports.get(AUTO) - foreignDebit); }
    return origSim(tx, opts);
  };
  const lamportsMid = w.chain.st.lamports.get(AUTO), sent = w.chain.st.sent.size;
  w.decisions.push({ rationale: "Take KITTY off.", actions: [sell(KITTY, 1)] });
  await r.runNow();
  await r.tick();
  rpc.simulateTransaction = origSim;
  const back = journalOf(r, "fill")[0], refusal = journalOf(r, "refusal")[0];
  console.log(`   [${label}] foreign debit ${foreignDebit}; fill: ${back?.side}/${back?.symbol}; refusal: ${refusal?.clause} — ${refusal?.message?.slice(0, 220)}; sends ${w.chain.st.sent.size - sent}; lamports moved ${lamportsMid - w.chain.st.lamports.get(AUTO)}`);
  return { back, refusal, sends: w.chain.st.sent.size - sent };
}
const control = await scenario({ foreignDebit: 0n, label: "control" });
ok("control: with no other transaction in between, the legitimate KITTY sell fills", control.back?.side === "sell" && control.back.symbol === "KITTY");
const raced = await scenario({ foreignDebit: 5_000n, label: "raced" });
ok("raced: a 5,000-lamport fee of another autopilot tx landing in the window refuses the SAME legitimate sell at sol_as_input, nothing sent",
  raced.refusal?.clause === "sol_as_input" && raced.sends === 0);
const racedBig = await scenario({ foreignDebit: 2_100_000n, label: "raced-big" });
console.log(`   [raced-big] clause ${racedBig.refusal?.clause}`);
console.log(`\n${pass} passed, ${fail} failed`);
