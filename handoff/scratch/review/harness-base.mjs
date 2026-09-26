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
        /* REVIEW EDIT: the real associated-token program's create_pda_account: an address that
           already holds lamports is topped up to the rent minimum (payer pays the difference),
           then allocated and assigned; otherwise create_account for the full rent. */
        const prefund = s.lamports.get(ata) ?? 0n;
        const need = RENT_ATA > prefund ? RENT_ATA - prefund : 0n;
        if (bal(payerKey) < need) throw new Error("insufficient lamports for rent");
        s.lamports.set(payerKey, bal(payerKey) - need);
        s.lamports.delete(ata);
        s.tokens.set(ata, { mint, owner, amount: 0n, delegate: null, lamports: prefund > RENT_ATA ? prefund : RENT_ATA });
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
const PASS = "the cat that waits for the model";
const mapStore = () => { const m = new Map(); return { async get(k) { return m.has(k) ? structuredClone(m.get(k)) : undefined; }, async set(k, v) { m.set(k, structuredClone(v)); }, async remove(k) { m.delete(k); } }; };
const phantomAsked = [];
const phantom = { isReady: () => true, wallet: () => newKey(), async signTransaction(req) { phantomAsked.push(req); throw new Error("Phantom must not be asked by the agent"); } };
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
