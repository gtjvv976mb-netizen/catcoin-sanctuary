/* $CATSANC holder rewards, end to end (scripts/rewards.mjs over scripts/lib/rewards-run.mjs): the hourly
   sample at a hidden random moment (the mint gate, the supply check, a changed mint and new_epoch), the
   send phase (settle, count the wallet's transactions since the cursor, claim, pay) against a fake
   Solana that executes what it is sent, dry mode sending nothing, the pot never spent past E − P − F,
   the launcher's reserve never touched (I2), every crash point (refused, never landed, a record lost),
   the key and the RPC URL never printed, the shipped files, and the Rewards workflow read as text.
   No network and no real key: throwaway keys from crypto.randomBytes; temporary folders are removed. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { ROOT } from "./helpers.mjs";
import { base58Decode, base58Encode } from "../assets/collection.js";
import {
  keypairFromSecret, compileLegacyMessage, decodeLegacyMessage, decompileInstructions, decodeTransaction, serializeTransaction, transactionToJson,
  verifyEd25519, pda,
} from "../scripts/lib/solana-tx.mjs";
import { SYSTEM_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, COMPUTE_BUDGET_PROGRAM } from "../scripts/lib/programs.mjs";
import { PUMP } from "../scripts/lib/pump.mjs";
import {
  creatorVault, collectCreatorFeeInstruction, EVENT_IX_TAG, EVENT_DISC, wsolAta, ammCreatorVaultAta, ammCreatorVaultAuthority, checkClaimMessage, WSOL_MINT,
} from "../scripts/lib/pump-fees.mjs";
import { createRpc } from "../scripts/lib/rpc.mjs";
import * as R from "../scripts/lib/rewards.mjs";
import { WINDOW_LINE, payoutOf, loadRewards } from "../scripts/lib/rewards-run.mjs";
import { main, PHASES } from "../scripts/rewards.mjs";
import { fsStore } from "../scripts/launch.mjs";
import { rewardsEarmark } from "../scripts/lib/launcher.mjs";

/* ── fixtures ─────────────────────────────────────────────────────────────────────────── */

const MINT = "GPAAHLhvBUuRs5Lkfe9MuZBuQVU5RSprn1K2NyJbpump";
const OWNER = "3J57tqAJqRmSBn1ZYDu9JpMMyTfBHdcGGwECiPQeiji3";           // data/wallets.json's owner: never earns
const RENT = 650_240;
const SUPPLY = 1_000_000_000_000_000n;                                     // 1B tokens, 6 decimals
const pct = (p) => (SUPPLY * BigInt(Math.round(p * 1e4))) / 1_000_000n;
const START = Date.parse("2026-09-30T02:00:00Z");
const HOUR = 3_600_000;
const T0 = Math.floor(START / 1000);
const RPC_URL = "https://rpc.example.test/v1/?api-key=RPCKEY9f8e7d6c5b4a3";
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const FILES = R.REWARDS_FILES;

function throwaway() {
  const seed = randomBytes(32);
  const kp = keypairFromSecret(Uint8Array.from(seed));
  return { kp, address: kp.publicKey, base58: base58Encode(Buffer.concat([seed, Buffer.from(kp.publicKeyBytes)])) };
}
const holderAddress = () => throwaway().address;                            // on the curve, as a person's wallet is
const CURVE_PDA = pda(["utf8:bonding-curve", MINT], PUMP.program);          // off the curve: never earns
let sigN = 0;
/** A fresh transaction signature (64 bytes in base58). */
const fakeSig = () => base58Encode(createHash("sha512").update(`sig:${++sigN}:${Math.random()}`).digest());

/** A throwaway site: only the files the rewards read, the wallet listed as the auto launcher. Removed after the test. */
function makeSite(t, { wallet, contract = MINT, exclude = [], state = null, ledger = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rewards-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  put("data/wallets.json", `${JSON.stringify({ launchers: [{ address: OWNER, since: "2026-09-25T00:00:00Z", label: "Owner" }, ...(wallet ? [{ address: wallet, since: "2026-09-01", label: "Auto launcher" }] : [])] }, null, 2)}\n`);
  put("data/socials.json", `${JSON.stringify({ ticker: "$CATSANC", contract, links: [] }, null, 2)}\n`);
  put(FILES.exclude, `${JSON.stringify({ note: R.EXCLUDE_NOTE, exclude }, null, 2)}\n`);
  put(FILES.state, R.stateText(state ?? R.emptyState()));                   // never the live files: what they hold changes every hour
  put(FILES.ledger, R.ledgerText(ledger ?? R.emptyLedger()));
  const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
  return { root, io: fsStore(root), read, put, json: (rel) => JSON.parse(read(rel)), exists: (rel) => fs.existsSync(path.join(root, rel)),
    load: () => loadRewards(fsStore(root)) };
}

/** A clock that sleep moves on; every sleep is recorded. */
function clock(start = START) {
  const c = { t: start, sleeps: [] };
  c.now = () => c.t;
  c.sleep = async (ms) => { c.sleeps.push(ms); c.t += ms; };
  return c;
}

/** pump.fun's CollectCreatorFeeEvent self-CPI data: the tag, the event, { timestamp, creator, fee, quote = the zero key }. */
function pumpEventData(creator, amount) {
  const d = Buffer.alloc(16 + 80);
  Buffer.from(EVENT_IX_TAG + EVENT_DISC.collectCreatorFee, "hex").copy(d, 0);
  d.writeBigInt64LE(1_790_000_000n, 16); Buffer.from(base58Decode(creator)).copy(d, 24); d.writeBigUInt64LE(amount, 56); Buffer.from(base58Decode(SYSTEM_PROGRAM)).copy(d, 64);
  return d;
}

/**
 * A fake Solana that executes what it is sent: SystemProgram transfers, pump.fun's creator-fee collect
 * (the vault's lamports above rent to the creator, with its event) and the compute budget (the fee is
 * 5,000 per signature plus the priority fee). The $CATSANC mint (Token-2022, `holders` [[owner, raw,
 * state]]) answers getAccountInfo and getProgramAccounts. `land`: "finalize" (default), "confirm" (seen,
 * not final until finalizeAll()), "error" (lands, fails on chain: only the fee is spent), "never"
 * (dropped); `refuse` answers the send with a preflight refusal;
 * `short` answers that many getProgramAccounts with a row missing. Every call is recorded.
 */
function fakeChain({ wallet, balance = 2_000_000_000, claimable = 0, holders = [], tokenProgram = TOKEN_2022_PROGRAM, decimals = 6 } = {}) {
  const s = { time: T0, slot: 460_000_000, height: 1000, lastValid: 1150, land: "finalize", refuse: null, drop: false, short: 0, rent: RENT, blockTime: true, simErr: null,
    onSend: null, holders: holders.map((h) => [...h]), mintAccount: undefined, gpaError: null, special: new Map(), behind: 0,
    failTo: new Set(), onSim: null, hideStatus: new Set(), hideTx: new Set(), burn: 0n, mintAuthority: false, rent165: 2_039_280 };
  const lamports = new Map([[wallet, BigInt(balance)], [creatorVault(wallet), BigInt(RENT + claimable)]]);
  const calls = [], txs = new Map(), statuses = new Map(), history = new Map(), sent = [], simulated = [];
  const supply = () => s.holders.reduce((t, h) => t + h[1], 0n);
  const account = (a) => { if (s.special.has(a)) return structuredClone(s.special.get(a)); const l = lamports.get(a) ?? 0n; return l > 0n ? { owner: SYSTEM_PROGRAM, lamports: Number(l), data: ["", "base64"], executable: false, rentEpoch: 0, space: 0 } : null; };
  const mintAccount = () => {
    if (s.mintAccount !== undefined) return s.mintAccount;
    const d = Buffer.alloc(300); d.writeBigUInt64LE(supply(), 36); d[44] = decimals; d[45] = 1; d[165] = 1;
    if (s.mintAuthority) { d.writeUInt32LE(1, 0); Buffer.from(base58Decode(OWNER)).copy(d, 4); }
    return { owner: tokenProgram, lamports: 1_461_600, executable: false, rentEpoch: 0, data: [d.toString("base64"), "base64"], space: 300 };
  };
  const tokenRows = () => s.holders.map(([owner, amount, state = 1], i) => {
    const d = Buffer.alloc(77); Buffer.from(base58Decode(owner)).copy(d, 0); d.writeBigUInt64LE(amount, 32); d[76] = state;
    return { pubkey: base58Encode(createHash("sha256").update(`token-account:${i}:${owner}`).digest()), account: { owner: tokenProgram, lamports: 2_039_280, executable: false, rentEpoch: 0, data: [d.toString("base64"), "base64"] } };
  });
  /** Execute a legacy message on `bal` (a Map, changed in place). */
  function execute(messageBytes, bal, { fail = false } = {}) {
    const msg = decodeLegacyMessage(messageBytes);
    const keys = msg.accountKeys, ixs = decompileInstructions(msg);
    const get = (k) => bal.get(k) ?? 0n, set = (k, v) => bal.set(k, v);
    let limit = null, price = 0n;
    for (const ix of ixs) if (ix.programId === COMPUTE_BUDGET_PROGRAM) { const d = Buffer.from(ix.data); if (d[0] === 2) limit = d.readUInt32LE(1); if (d[0] === 3) price = d.readBigUInt64LE(1); }
    const fee = 5000n * BigInt(msg.header.numRequiredSignatures) + (BigInt(limit ?? 200_000 * ixs.length) * price + 999_999n) / 1_000_000n;
    const pre = keys.map(get);
    if (get(keys[0]) < fee) return { keys, pre, post: pre, fee: 0n, inner: [], err: "InsufficientFundsForFee" };
    const before = new Map(bal);
    set(keys[0], get(keys[0]) - fee);
    const inner = [];
    let err = null;
    ixs.forEach((ix, n) => {
      if (err) return;
      const d = Buffer.from(ix.data);
      if (ix.programId === COMPUTE_BUDGET_PROGRAM) return;
      if (ix.programId === SYSTEM_PROGRAM && d.length === 12 && d.readUInt32LE(0) === 2) {
        const [from, to] = ix.keys.map((k) => k.pubkey), v = d.readBigUInt64LE(4);
        if (R.RESERVED_ACCOUNT_KEYS.has(to)) { err = { InstructionError: [n, "ReadonlyLamportChange"] }; return; }
        if (s.failTo.has(to)) { err = { InstructionError: [n, "ExternalAccountLamportSpend"] }; return; }
        if (get(from) < v) { err = { InstructionError: [n, { Custom: 1 }] }; return; }
        set(from, get(from) - v); set(to, get(to) + v);
        if (get(to) < BigInt(RENT)) err = { InsufficientFundsForRent: { account_index: keys.indexOf(to) } };
        return;
      }
      if (ix.programId === PUMP.program) {
        const creator = ix.keys[0].pubkey, vault = creatorVault(creator);
        const amt = get(vault) > BigInt(RENT) ? get(vault) - BigInt(RENT) : 0n;
        set(vault, get(vault) - amt); set(creator, get(creator) + amt);
        if (amt > 0n) inner.push({ index: n, instructions: [{ programIdIndex: keys.indexOf(PUMP.program), accounts: [keys.indexOf(PUMP.eventAuthority)], data: base58Encode(pumpEventData(creator, amt)), stackHeight: 2 }] });
        return;
      }
      err = { InstructionError: [n, "UnsupportedProgramId"] };
    });
    if (fail && !err) err = { InstructionError: [ixs.length - 1, { Custom: 6000 }] };
    if (err) { bal.clear(); for (const [k, v] of before) bal.set(k, v); set(keys[0], get(keys[0]) - fee); inner.length = 0; }
    return { keys, pre, post: keys.map(get), fee, inner, err };
  }
  /** Land a serialized transaction (bytes): executed, its answer kept, listed in each account's history. */
  function land(bytes, { status = "finalized", fail = false } = {}) {
    const { signatures, messageBytes } = decodeTransaction(bytes);
    const sig = base58Encode(signatures[0]);
    const r = execute(messageBytes, lamports, { fail });
    const json = transactionToJson(bytes);
    txs.set(sig, { slot: s.slot, blockTime: s.time, version: "legacy", transaction: json.transaction,
      meta: { err: r.err, fee: Number(r.fee), preBalances: r.pre.map(Number), postBalances: r.post.map(Number), innerInstructions: r.inner, loadedAddresses: { writable: [], readonly: [] }, logMessages: [] } });
    statuses.set(sig, { slot: s.slot, confirmations: null, err: r.err, confirmationStatus: status });
    for (const k of new Set(r.keys)) history.set(k, [{ signature: sig, err: r.err, slot: s.slot, blockTime: s.time, confirmationStatus: status, memo: null }, ...(history.get(k) ?? [])]);
    s.slot += 1;
    return sig;
  }
  async function fetchImpl(url, init) {
    const { id, method, params } = JSON.parse(init.body);
    calls.push({ method, params });
    const ok = (result) => new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), { status: 200 });
    const fail = (code, message) => new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }), { status: 200 });
    const ctx = { slot: s.slot };
    switch (method) {
      case "getAccountInfo":
        if (params[1]?.minContextSlot !== undefined && s.behind > 0) { s.behind--; return fail(-32016, "Minimum context slot has not been reached"); }
        return ok({ context: ctx, value: params[0] === MINT ? mintAccount() : account(params[0]) });
      case "getProgramAccounts": {
        if (s.gpaError) return fail(-32010, s.gpaError);
        const [program, opts] = params;
        assert.deepEqual(opts, { encoding: "base64", commitment: "finalized", withContext: true, filters: [{ memcmp: { offset: 0, bytes: MINT } }], dataSlice: { offset: 32, length: 77 } });
        let rows = program === tokenProgram ? tokenRows() : [];
        if (s.short > 0) { s.short--; rows = rows.slice(1); }
        if (s.burn > 0n) { s.holders[0][1] -= s.burn; s.burn = 0n; }      // a holder burns right after the listed slot
        return ok({ context: ctx, value: rows });
      }
      case "getBlockTime": return ok(s.blockTime ? s.time : null);
      case "getMinimumBalanceForRentExemption": return ok(params[0] === 165 ? s.rent165 : s.rent);
      case "getMultipleAccounts": return ok({ context: ctx, value: params[0].map((a) => (a === MINT ? mintAccount() : account(a))) });
      case "getBalance": return ok({ context: ctx, value: Number(lamports.get(params[0]) ?? 0n) });
      case "getLatestBlockhash": return ok({ context: ctx, value: { blockhash: base58Encode(randomBytes(32)), lastValidBlockHeight: s.lastValid } });
      case "getBlockHeight": return ok(s.height);
      case "getSlot": return ok(s.slot - 1);                            // the newest slot a transaction landed in
      case "simulateTransaction": {
        simulated.push(params[0]);
        assert.equal(params[1].sigVerify, false);
        s.onSim?.(params);
        if (s.simErr) return ok({ context: ctx, value: { err: s.simErr, logs: [], accounts: null } });
        const { messageBytes } = decodeTransaction(new Uint8Array(Buffer.from(params[0], "base64")));
        const copy = new Map(lamports);
        const r = execute(messageBytes, copy);
        const acc = (a) => { const l = copy.get(a) ?? 0n; return l > 0n ? { owner: SYSTEM_PROGRAM, lamports: Number(l), data: ["", "base64"], executable: false, rentEpoch: 0 } : null; };
        return ok({ context: ctx, value: { err: r.err, logs: [], unitsConsumed: 1000, accounts: (params[1].accounts?.addresses ?? []).map(acc) } });
      }
      case "sendTransaction": {
        if (s.drop) throw new TypeError("fetch failed");
        if (s.refuse) return fail(-32002, s.refuse);
        const bytes = new Uint8Array(Buffer.from(params[0], "base64"));
        const { signatures, messageBytes, message } = decodeTransaction(bytes);
        const sig = base58Encode(signatures[0]);
        assert.ok(verifyEd25519(message.accountKeys[0], messageBytes, signatures[0]), "only a signed transaction is sent");
        sent.push({ sig, bytes });
        s.onSend?.(sig);
        if (s.land !== "never") land(bytes, { status: s.land === "confirm" ? "confirmed" : "finalized", fail: s.land === "error" });
        return ok(sig);
      }
      case "getSignatureStatuses": return ok({ context: ctx, value: params[0].map((x) => (s.hideStatus.has(x) ? null : structuredClone(statuses.get(x) ?? null))) });
      case "getTransaction": {
        const [sig, opts] = params;
        assert.equal(opts.encoding, "json"); assert.equal(opts.maxSupportedTransactionVersion, 0);
        return ok(s.hideTx.has(sig) ? null : structuredClone(txs.get(sig) ?? null));
      }
      case "getSignaturesForAddress": {
        const [address, { limit = 1000, before, until } = {}] = params;
        let list = history.get(address) ?? [];
        if (before) { const i = list.findIndex((x) => x.signature === before); list = i < 0 ? [] : list.slice(i + 1); }
        if (until) { const i = list.findIndex((x) => x.signature === until); if (i >= 0) list = list.slice(0, i); }
        return ok(structuredClone(list.slice(0, limit)));
      }
      default: return fail(-32601, "Method not found");
    }
  }
  const rpc = createRpc({ url: "https://rpc.example.test", fetchImpl, delayMs: 0, backoffMs: 0, retries: 1 });
  return {
    s, lamports, calls, txs, statuses, history, sent, simulated, rpc, fetchImpl, land,
    methods: () => calls.map((c) => c.method),
    finalizeAll: () => { for (const v of statuses.values()) v.confirmationStatus = "finalized"; for (const l of history.values()) for (const x of l) x.confirmationStatus = "finalized"; },
    /** The wallet's newest transaction (one made before the rewards counted anything, when it has none yet): a ledger's cursor. */
    newest: () => history.get(wallet)?.[0]?.signature ?? (() => { const sig = fakeSig(); history.set(wallet, [{ signature: sig, err: null, slot: 1, blockTime: T0 - 86_400, confirmationStatus: "finalized", memo: null }]); return sig; })(),
    /** A transaction the wallet made before the rewards counted anything (its funding, say). */
    older: () => { const sig = fakeSig(); history.set(wallet, [...(history.get(wallet) ?? []), { signature: sig, err: null, slot: 1, blockTime: T0 - 86_400, confirmationStatus: "finalized", memo: null }]); return sig; },
    /** `n` junk transactions that name the wallet (a stranger's dust transfers, every one landed): they are in its history and each reads as a transaction. */
    flood: (n, { err = null } = {}) => {
      const from = throwaway().address, fresh = [];
      for (let i = 0; i < n; i++) {
        const sig = fakeSig();
        txs.set(sig, { slot: s.slot, blockTime: s.time, version: "legacy", transaction: { signatures: [sig], message: { header: { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 1 }, accountKeys: [from, wallet, SYSTEM_PROGRAM], recentBlockhash: SYSTEM_PROGRAM, instructions: [] } },
          meta: { err, fee: 5000, preBalances: [1_000_000, 0, 1], postBalances: [994_999, 1, 1], innerInstructions: [], loadedAddresses: { writable: [], readonly: [] }, logMessages: [] } });
        fresh.push({ signature: sig, err, slot: s.slot, blockTime: s.time, confirmationStatus: "finalized", memo: null });
        s.slot += 1;
      }
      history.set(wallet, [...fresh.reverse(), ...(history.get(wallet) ?? [])]);
    },
  };
}

/** Run one phase through the CLI: { code, logs, errs }. `rpc`: another RPC than the chain's own (a slow one, a failing one). */
async function run(phase, { env, chain, c, random = () => 1234, confirmWaitMs = 9_000, confirmPollMs = 3_000, site, rpc = chain.rpc }) {
  const logs = [], errs = [];
  const code = await main([phase], { env, root: site.root, rpc, now: c.now, sleep: c.sleep, random, stdout: (l) => logs.push(l), stderr: (l) => errs.push(l), confirmWaitMs, confirmPollMs });
  return { code, logs, errs, all: [...logs, ...errs].join("\n") };
}

/** Holders: three people (30%, 10%, 5%), one under the minimum, the owner (listed: excluded), the bonding curve (off the curve), a frozen account. */
function population() {
  const [a, b, c, dust] = [holderAddress(), holderAddress(), holderAddress(), holderAddress()];
  const rows = [[a, pct(30)], [b, pct(10)], [c, pct(5)], [dust, pct(0.005)], [OWNER, pct(5)], [CURVE_PDA, pct(49.995) - pct(1)], [holderAddress(), pct(1), 2]];
  return { a, b, c, dust, rows };
}

/**
 * The files after a claim of `claimed` lamports and one period of samples (a day: REWARDS_EVERY_DAYS 1),
 * built with the rules directly: { state, ledger } with what each wallet is owed. `cursor`: the ledger's.
 */
function seeded({ holders, claimed = 1_000_000_000n, cursor = null, releasePct = "50", capPct = "10" }) {
  const state = R.emptyState(), L = R.emptyLedger();
  const g = fakeSig();
  R.recordClaimSending(L, { sig: g, lastValidBlockHeight: 1, sharePct: 100, sentAt: iso(START - 2 * 86_400_000) });
  R.settleClaim(L, g, { status: "landed", claimed, walletFee: 0n, net: claimed }, { settledAt: iso(START - 2 * 86_400_000) });
  const cfg = R.rewardsConfig({ REWARDS_EVERY_DAYS: "1", REWARDS_RELEASE_PCT: releasePct, REWARDS_WALLET_CAP_PCT: capPct });
  const map = new Map(holders.filter((h) => (h[2] ?? 1) === 1).map(([o, v]) => [o, v]));   // as holdersFromAccounts reads them: no frozen account
  for (let h = 0; h <= 24; h++) R.applySample(state, L, { T: T0 - 86_400 + h * 3600, slot: 1 + h, mint: MINT, tokenProgram: TOKEN_2022_PROGRAM, decimals: 6, supply: SUPPLY, holders: map }, cfg, { excluded: new Set([OWNER]) });
  assert.equal(state.period, 2, "one period closed");
  if (cursor) R.advanceCursor(L, cursor);
  return { state, ledger: L };
}
const owedOf = (state) => new Map([...state.wallets].filter(([, w]) => w.owed > 0n).map(([a, w]) => [a, w.owed]));
const sum = (xs) => xs.reduce((a, b) => a + b, 0n);

/* ── the CLI ──────────────────────────────────────────────────────────────────────────── */

test("the CLI: its phases, a usage line for anything else, and nothing done while REWARDS_ENABLED is neither on nor dry", async (t) => {
  assert.deepEqual(PHASES, ["snapshot", "send", "claim", "pay"]);
  const w = throwaway();
  const site = makeSite(t, { wallet: w.address });
  const chain = fakeChain({ wallet: w.address }), c = clock();
  const errs = [];
  assert.equal(await main(["bogus"], { env: {}, root: site.root, rpc: chain.rpc, stderr: (l) => errs.push(l), stdout: () => {} }), 2);
  assert.match(errs[0], /Usage: node scripts\/rewards\.mjs snapshot \| send \| claim \| pay/);
  const before = [site.read(FILES.state), site.read(FILES.ledger)];
  for (const REWARDS_ENABLED of [undefined, "", "off", "yes", "no"]) {
    for (const phase of PHASES) {
      const r = await run(phase, { env: { REWARDS_ENABLED, LAUNCH_WALLET_KEY: w.base58 }, chain, c, site });
      assert.equal(r.code, 0);
      assert.ok(r.logs.some((l) => /off \(REWARDS_ENABLED is neither on nor dry\); nothing done/.test(l)), r.all);
    }
  }
  assert.deepEqual([chain.calls, c.sleeps], [[], []], "off reads nothing and waits for nothing");
  assert.deepEqual([site.read(FILES.state), site.read(FILES.ledger)], before, "off writes nothing");
});

/* ── snapshot ─────────────────────────────────────────────────────────────────────────── */

test("snapshot: without a valid $CATSANC mint it reads nothing, waits for nothing and writes nothing (the fees keep being claimed)", async (t) => {
  for (const contract of ["", "   ", "not-an-address"]) {
    const site = makeSite(t, { contract });
    const chain = fakeChain({ wallet: holderAddress() }), c = clock();
    const r = await run("snapshot", { env: { REWARDS_ENABLED: "on" }, chain, c, site });
    assert.equal(r.code, 0);
    assert.ok(r.logs.some((l) => /^::notice title=Rewards::.*nothing is sampled.*Creator fees are still claimed/.test(l)), r.all);
    assert.deepEqual(chain.calls, [], "no chain read");
    assert.deepEqual(c.sleeps, [], "no wait");
    assert.equal(site.read(FILES.state), R.stateText(R.emptyState()));
  }
  // A contract that is an address but not a mint: read once at the hidden moment, nothing sampled.
  const site = makeSite(t, { contract: MINT });
  const chain = fakeChain({ wallet: holderAddress() }), c = clock();
  chain.s.mintAccount = { owner: SYSTEM_PROGRAM, lamports: 1, executable: false, rentEpoch: 0, data: ["", "base64"] };
  const r = await run("snapshot", { env: { REWARDS_ENABLED: "dry" }, chain, c, site });
  assert.equal(r.code, 0);
  assert.ok(r.logs.some((l) => /no sample this hour: the contract .* is not a valid mint/.test(l)), r.all);
  assert.deepEqual(chain.methods(), ["getAccountInfo"], "an invalid mint is not read again");
  assert.equal(site.json(FILES.state).epoch, null);
});

test("snapshot: the hidden moment: one random wait, the chain read at it, nothing printed until the window closes, then genesis written", async (t) => {
  const pop = population();
  const site = makeSite(t);
  const chain = fakeChain({ wallet: holderAddress(), holders: pop.rows }), c = clock();
  const out = [];
  const trace = { now: c.now, sleep: async (ms) => { out.push(`sleep ${ms} after ${chain.calls.length} calls`); await c.sleep(ms); } };
  const drawn = [];
  const code = await main(["snapshot"], { env: { REWARDS_ENABLED: "on", SOLANA_RPC_URL: RPC_URL }, root: site.root, rpc: chain.rpc, ...trace,
    random: (n) => { drawn.push(n); return 1234; }, stdout: (l) => out.push(l), stderr: (l) => out.push(l) });
  assert.equal(code, 0);
  assert.deepEqual(drawn, [R.SAMPLE_WINDOW], "D is drawn in [0, SAMPLE_WINDOW)");
  assert.equal(out[0], "Rewards: snapshot; Solana through the RPC in SOLANA_RPC_URL.");
  assert.equal(out[1], WINDOW_LINE);
  assert.equal(out[2], "sleep 1234000 after 0 calls", "nothing is read before the moment");
  assert.equal(out[3], "sleep 2066000 after 4 calls", "read at the moment (mint, token accounts, mint at that slot, block time), then silence until 3,300 s after the start");
  assert.deepEqual(chain.methods(), ["getAccountInfo", "getProgramAccounts", "getAccountInfo", "getBlockTime"]);
  assert.equal(chain.calls[2].params[1].minContextSlot, chain.s.slot, "the supply is read at the token accounts' slot or later");
  assert.match(out[4], /^Rewards: the first sample \(genesis/);
  assert.equal(out.length, 5);
  const st = site.json(FILES.state);
  assert.deepEqual([st.mint, st.tokenProgram, st.decimals, st.epoch, st.period, st.periodEnd], [MINT, TOKEN_2022_PROGRAM, 6, T0, 1, T0 + 7 * 86_400]);
  // Counted: the three people; not the dust wallet (under 0.01% of the supply), the owner, the bonding curve or the frozen account.
  assert.deepEqual(Object.keys(st.wallets).sort(), [pop.a, pop.b, pop.c].sort());
  assert.deepEqual(st.wallets[pop.a].lots, [[String(pct(30)), 0]]);
  assert.equal(site.read(FILES.ledger), R.ledgerText(R.emptyLedger()), "a sample changes no ledger total before a close");
});

test("snapshot: an incomplete answer (the supply check) is retried once, then the hour is skipped; a read error too; chain time must move on", async (t) => {
  const pop = population();
  const site = makeSite(t);
  const chain = fakeChain({ wallet: holderAddress(), holders: pop.rows }), c = clock();
  const env = { REWARDS_ENABLED: "on" };
  chain.s.short = 1;                                                            // the first answer misses a row; the retry is whole
  assert.equal((await run("snapshot", { env, chain, c, site })).code, 0);
  assert.equal(chain.methods().filter((m) => m === "getProgramAccounts").length, 2);
  assert.equal(site.json(FILES.state).epoch, T0, "the retry was whole: genesis");
  // A node behind the token accounts' slot (a load-balanced RPC): the mint is asked again, a little later.
  chain.s.behind = 2; chain.s.time += 1800; chain.s.slot += 4500;
  assert.equal((await run("snapshot", { env, chain, c, site })).code, 0);
  assert.deepEqual(c.sleeps.slice(-4), [1_234_000, 2_000, 2_000, 2_062_000], "asked again twice, and the window still closes 3,300 s after the start");
  assert.equal(site.json(FILES.state).tPrev, T0 + 1800);
  const after = site.read(FILES.state);
  chain.s.short = 2; chain.s.time += 1800; chain.s.slot += 4500;
  const r = await run("snapshot", { env, chain, c, site });
  assert.equal(r.code, 0);
  assert.ok(r.logs.some((l) => /^::warning title=Rewards::no sample this hour: the token accounts add up to .* incomplete/.test(l)), r.all);
  assert.equal(site.read(FILES.state), after, "a skipped sample writes nothing");
  assert.deepEqual(c.sleeps.slice(-2), [1_234_000, 2_066_000], "the window is kept whole even when the hour is skipped");
  chain.s.gpaError = "excluded from account secondary indexes";
  const e = await run("snapshot", { env, chain, c, site });
  assert.ok(e.logs.some((l) => /no sample this hour: the chain could not be read \(getProgramAccounts: excluded/.test(l)), e.all);
  chain.s.gpaError = null;
  // The same block time as the last sample: skipped by the rules.
  chain.s.time = T0 + 1800;
  const same = await run("snapshot", { env, chain, c, site });
  assert.ok(same.logs.some((l) => /no sample this hour: T \d+ is not after/.test(l)), same.all);
  assert.equal(site.read(FILES.state), after);
  // No block time from the RPC: the runner's clock, whole seconds.
  chain.s.blockTime = false; chain.s.slot += 9000; c.t = (T0 + 7200) * 1000 + 999;
  await run("snapshot", { env, chain, c, site });
  assert.equal(site.json(FILES.state).tPrev, T0 + 7200 + 1234, "the runner's time at the moment, floored");
});

test("snapshot: a contract other than the mint tracked stops sampling (owed still paid); new_epoch=<contract> closes the period, clears lots and points, keeps owed", async (t) => {
  const pop = population();
  const { state, ledger } = seeded({ holders: pop.rows });
  const owed = owedOf(state);
  const OTHER = holderAddress();
  const site = makeSite(t, { contract: OTHER, state, ledger });
  const chain = fakeChain({ wallet: holderAddress(), holders: pop.rows }), c = clock();
  const r = await run("snapshot", { env: { REWARDS_ENABLED: "on" }, chain, c, site });
  assert.equal(r.code, 0);
  assert.ok(r.logs.some((l) => l.startsWith("::warning title=Rewards::") && l.includes(`new_epoch=${OTHER}`)), r.all);
  assert.deepEqual([chain.calls, c.sleeps], [[], []]);
  // new_epoch must be the contract.
  const wrong = await run("snapshot", { env: { REWARDS_ENABLED: "on", REWARDS_NEW_EPOCH: MINT }, chain, c, site });
  assert.equal(wrong.code, 1);
  assert.match(wrong.errs.join("\n"), /new_epoch must equal data\/socials\.json "contract"/);
  // The owner's new epoch: closed at the last sample (an audit file), owed kept, lots and points gone; genesis at this hour's sample.
  site.put("data/socials.json", JSON.stringify({ ticker: "$CATSANC", contract: MINT, links: [] }));
  chain.s.time = T0 + 3600;
  const k = site.json(FILES.state).period;
  const n = await run("snapshot", { env: { REWARDS_ENABLED: "on", REWARDS_NEW_EPOCH: ` ${MINT} ` }, chain, c, site });
  assert.equal(n.code, 0, n.all);
  assert.ok(n.logs.some((l) => /a new epoch for/.test(l)), n.all);
  assert.ok(site.exists(R.periodPath(k)), "the period is closed at the last sample and published");
  const after = site.load();
  assert.equal(after.state.epoch, T0 + 3600, "genesis at the next valid sample");
  for (const [a, v] of owed) assert.ok(after.state.wallets.get(a).owed >= v, "what each wallet was owed is kept");
  assert.equal(R.identityProblem(after.state, after.ledger), null);
});

/* ── send: end to end ─────────────────────────────────────────────────────────────────── */

test("end to end: the claim is measured into E, a day of hidden samples closes a period, and the payouts go out, written \"sending\" first, never past E − P − F", async (t) => {
  const pop = population();
  const w = throwaway();
  const site = makeSite(t, { wallet: w.address });
  const chain = fakeChain({ wallet: w.address, balance: 1_000_000_000, claimable: 500_000_000, holders: pop.rows }), c = clock();
  chain.older();
  const env = { REWARDS_ENABLED: "on", REWARDS_EVERY_DAYS: "1", LAUNCH_WALLET_KEY: w.base58 };

  // 1. The first run only sets the cursor (claims and payouts start once it is committed).
  const first = await run("send", { env, chain, c, site });
  assert.equal(first.code, 0, first.all);
  assert.ok(first.logs.some((l) => /counts the wallet's transactions from/.test(l)));
  assert.equal(site.json(FILES.ledger).cursor, chain.history.get(w.address)[0].signature);
  assert.deepEqual(chain.sent, []);

  // 2. The claim: simulated unsigned, written "sending" with the share fixed now, sent signed, measured from its own transaction.
  let atSend = null;
  chain.s.onSend = (sig) => { atSend = { sig, ledger: site.json(FILES.ledger) }; };
  const claim = await run("send", { env: { ...env, REWARDS_HOLDER_SHARE_PCT: "80" }, chain, c, site });
  assert.equal(claim.code, 0, claim.all);
  assert.equal(chain.sent.length, 1);
  assert.deepEqual(atSend.ledger.claims.map((r) => [r.sig, r.status, r.sharePct]), [[atSend.sig, "sending", 80]]);
  const sim = decodeTransaction(new Uint8Array(Buffer.from(chain.simulated[0], "base64")));
  assert.ok(sim.signatures.every((x) => x.every((b) => b === 0)), "the simulated copy is unsigned");
  assert.deepEqual(sim.messageBytes, decodeTransaction(chain.sent[0].bytes).messageBytes, "what was simulated is what was sent");
  const L1 = site.json(FILES.ledger);
  const fee = 5000 + 40_000 * 50_000 / 1e6;                                   // the claim's base fee and priority fee
  assert.deepEqual(L1.claims[0], { ...L1.claims[0], status: "landed", claimed: "500000000", walletFee: String(fee), net: String(500_000_000 - fee), forHolders: String(Math.floor((500_000_000 - fee) * 0.8)) });
  assert.equal(L1.E, String(Math.floor((500_000_000 - fee) * 0.8)));
  assert.ok(claim.logs.some((l) => /no \$CATSANC mint has been sampled yet/.test(l)), "no payouts before any sample");
  const E = BigInt(L1.E);

  // 3. A day of hourly samples at hidden moments: a period closes and is published.
  chain.s.onSend = null;
  for (let h = 0; h <= 24; h++) {
    c.t = START + (h + 1) * HOUR; chain.s.time = T0 + h * 3600; chain.s.slot += 9000;
    const r = await run("snapshot", { env: { REWARDS_ENABLED: "on", REWARDS_EVERY_DAYS: "1" }, chain, c, site, random: () => (h * 997) % R.SAMPLE_WINDOW });
    assert.equal(r.code, 0, r.all);
  }
  const audit = site.json(R.periodPath(1));
  assert.equal(audit.pot, String(E / 2n), "half of the unallocated pot");
  assert.deepEqual(audit.rows.map((x) => x[0]).sort(), [pop.a, pop.b, pop.c].sort(), "only the three people have points");
  const alloc = new Map(audit.rows.map(([a, , v]) => [a, BigInt(v)]));
  assert.ok(sum([...alloc.values()]) <= E / 2n && [...alloc.values()].every((v) => v <= BigInt(audit.capAmt)));
  const { state: s2, ledger: L2 } = site.load();
  assert.deepEqual(owedOf(s2), alloc);

  // 4. The payouts: one transaction of three transfers, "sending" (owed already reduced) when it went out, then paid.
  const balance = chain.lamports.get(w.address);
  chain.s.onSend = (sig) => { atSend = { sig, ledger: site.json(FILES.ledger), state: site.json(FILES.state) }; };
  const pay = await run("send", { env, chain, c, site });
  assert.equal(pay.code, 0, pay.all);
  assert.equal(chain.sent.length, 2);
  const row = atSend.ledger.payouts[0];
  assert.deepEqual([row.sig, row.status, row.rows.length], [atSend.sig, "sending", 3]);
  for (const [a] of alloc) assert.equal(atSend.state.wallets[a].owed, "0", "owed is reduced before the send");
  const L3 = site.json(FILES.ledger);
  assert.equal(L3.payouts[0].status, "paid");
  const payFee = R.payoutFee(3, 100_000);
  assert.equal(BigInt(L3.payouts[0].fee), payFee);
  const nets = L3.payouts[0].rows.map(([a, net, share]) => { assert.equal(BigInt(net) + BigInt(share), alloc.get(a)); return BigInt(net); });
  for (const [a, net] of L3.payouts[0].rows) assert.equal(chain.lamports.get(a), BigInt(net), "each wallet received exactly its net");
  assert.equal(chain.lamports.get(w.address), balance - sum(nets) - payFee, "the wallet paid exactly the transfers and the fee");
  assert.equal(BigInt(L3.P), sum(nets));
  assert.equal(BigInt(L3.F), payFee);
  assert.ok(BigInt(L3.P) + BigInt(L3.F) <= BigInt(L3.E), "never more than the holders' claimed share");
  assert.equal(sum(nets) + payFee, sum([...alloc.values()]), "fee shares come out of each wallet's own amount");
  assert.ok(sum(nets) + payFee <= E - BigInt(L2.P) - BigInt(L2.F));
  // The payout message: only the compute budget and transfers from the wallet to the three.
  const ixs = decompileInstructions(decodeTransaction(chain.sent[1].bytes).message);
  assert.deepEqual(ixs.map((i) => i.programId), [COMPUTE_BUDGET_PROGRAM, COMPUTE_BUDGET_PROGRAM, SYSTEM_PROGRAM, SYSTEM_PROGRAM, SYSTEM_PROGRAM]);
  assert.deepEqual(payoutOf(chain.txs.get(atSend.sig), w.address).rows.map((r) => [r.owner, String(r.lamports), String(r.share)]), L3.payouts[0].rows);

  // 5. Again: nothing more is sent; the payout's own signature moves the cursor.
  const again = await run("send", { env, chain, c, site });
  assert.equal(again.code, 0, again.all);
  assert.equal(chain.sent.length, 2);
  assert.equal(site.json(FILES.ledger).cursor, atSend.sig);
});

test("dry: the claim and the payouts are built and simulated unsigned; nothing is signed or sent and the ledger does not change", async (t) => {
  const pop = population();
  const w = throwaway();
  const chain = fakeChain({ wallet: w.address, claimable: 300_000_000, holders: pop.rows }), c = clock();
  const { state, ledger } = seeded({ holders: pop.rows, cursor: chain.newest() });
  const site = makeSite(t, { wallet: w.address, state, ledger });
  const before = [site.read(FILES.state), site.read(FILES.ledger)];
  const r = await run("send", { env: { REWARDS_ENABLED: "dry", LAUNCH_WALLET_KEY: w.base58 }, chain, c, site });
  assert.equal(r.code, 0, r.all);
  assert.ok(!chain.methods().includes("sendTransaction"), "nothing is sent");
  assert.equal(chain.simulated.length, 2, "the claim and one payout transaction");
  for (const b of chain.simulated) assert.ok(decodeTransaction(new Uint8Array(Buffer.from(b, "base64"))).signatures.every((x) => x.every((y) => y === 0)), "simulated unsigned");
  assert.ok(r.logs.some((l) => /^Rewards \(dry run\): a claim of .* simulates cleanly\. Nothing was signed or sent\./.test(l)), r.all);
  assert.ok(r.logs.some((l) => /^Rewards \(dry run\): payout 1 of 1 \(3 wallet\(s\).* simulates cleanly\. Nothing was signed or sent\./.test(l)), r.all);
  assert.deepEqual([site.read(FILES.state), site.read(FILES.ledger)], before);
  assert.equal(chain.lamports.get(creatorVault(w.address)), BigInt(RENT + 300_000_000), "nothing claimed");
});

test("the pot: a payout never spends more than E − P − F (a wallet is paid in part and the rest carried), nor more than REWARDS_MAX_SOL_PER_RUN", async (t) => {
  const pop = population();
  const w = throwaway();
  const chain = fakeChain({ wallet: w.address, balance: 3_000_000_000, holders: pop.rows }), c = clock();
  // Everything released (100%, no cap), then a claim that failed on chain took its fee off E: the wallets are owed a little more than E − P − F.
  const { state, ledger } = seeded({ holders: pop.rows, cursor: chain.newest(), releasePct: "100", capPct: "100" });
  const g = fakeSig();
  R.recordClaimSending(ledger, { sig: g, lastValidBlockHeight: 1, sharePct: 100, sentAt: iso(START) });
  R.settleClaim(ledger, g, { status: "landed", claimed: 0n, walletFee: 7000n, net: -7000n }, { settledAt: iso(START) });
  const owed = sum([...owedOf(state).values()]);
  const room = ledger.E - ledger.P - ledger.F;
  assert.ok(owed > room, "owed is more than the holders' claimed share left");
  const site = makeSite(t, { wallet: w.address, state, ledger });
  const r = await run("pay", { env: { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58 }, chain, c, site });
  assert.equal(r.code, 0, r.all);
  const after = site.load();
  const spent = after.ledger.P + after.ledger.F;
  assert.ok(spent <= room, `spent ${spent}, room ${room}`);
  assert.ok(room - spent < 20_000n, "all but the last few lamports went out");
  assert.equal(chain.lamports.get(w.address), 3_000_000_000n - spent);
  assert.ok(r.logs.some((l) => /paid in part/.test(l)), r.all);
  assert.equal(R.identityProblem(after.state, after.ledger), null);
  assert.ok(sum([...owedOf(after.state).values()]) > 0n, "the rest is carried, never lost");

  // REWARDS_MAX_SOL_PER_RUN: at most that per run (transfers and fees); the rest next run.
  const s2 = seeded({ holders: pop.rows, cursor: chain.newest() });
  const site2 = makeSite(t, { wallet: w.address, ...s2 });
  const r2 = await run("pay", { env: { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58, REWARDS_MAX_SOL_PER_RUN: "0.1" }, chain, c, site: site2 });
  assert.equal(r2.code, 0, r2.all);
  const L = site2.load().ledger;
  assert.ok(L.P + L.F <= 100_000_000n && L.P + L.F > 99_000_000n, String(L.P + L.F));
});

test("I2: a wallet that no longer holds the holders' SOL above the launcher's reserve pays nothing and says why", async (t) => {
  const pop = population();
  const w = throwaway();
  const chain = fakeChain({ wallet: w.address, balance: 400_000_000, holders: pop.rows }), c = clock();
  const { state, ledger } = seeded({ holders: pop.rows, cursor: chain.newest() });   // E = 1 SOL unpaid, the wallet holds 0.4
  const site = makeSite(t, { wallet: w.address, state, ledger });
  const before = [site.read(FILES.state), site.read(FILES.ledger)];
  const r = await run("pay", { env: { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58 }, chain, c, site });
  assert.equal(r.code, 1);
  assert.ok(r.logs.some((l) => /^::warning title=Rewards::I2: the wallet holds 400000000 lamports, less than LAUNCH_MIN_BALANCE 20000000 plus the holders' unpaid 1000000000/.test(l)), r.all);
  assert.deepEqual(chain.sent, []);
  assert.deepEqual([site.read(FILES.state), site.read(FILES.ledger)], before);
  // Funded again (reserve and the holders' SOL): paid.
  chain.lamports.set(w.address, 1_100_000_000n);
  const ok = await run("pay", { env: { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58 }, chain, c, site });
  assert.equal(ok.code, 0, ok.all);
  assert.equal(chain.sent.length, 1);
  assert.ok(chain.lamports.get(w.address) >= 20_000_000n + R.holdersUnpaid(site.load().ledger), "the reserve and the rest of the holders' SOL are still there");
});

test("crash points: a refused payout owes again; one that never lands blocks the next payouts until its blockhash expires, then is paid once; one that fails on chain spends only its fee", async (t) => {
  const pop = population();
  const w = throwaway();
  const chain = fakeChain({ wallet: w.address, balance: 10_000_000_000, holders: pop.rows }), c = clock();
  const { state, ledger } = seeded({ holders: pop.rows, cursor: chain.newest() });
  const owed = owedOf(state);
  const site = makeSite(t, { wallet: w.address, state, ledger });
  const env = { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58 };
  chain.s.refuse = "Transaction simulation failed: Blockhash not found";
  const refused = await run("pay", { env, chain, c, site });
  assert.equal(refused.code, 0, refused.all);
  let now = site.load();
  assert.equal(now.ledger.payouts[0].status, "expired");
  assert.deepEqual(owedOf(now.state), owed, "owed again, to the lamport");
  chain.s.refuse = null;

  chain.s.land = "never";
  const lost = await run("pay", { env, chain, c, site });
  assert.equal(lost.code, 0, lost.all);
  now = site.load();
  assert.equal(now.ledger.payouts[1].status, "sending");
  assert.equal(R.identityProblem(now.state, now.ledger), null);
  const blocked = await run("pay", { env, chain, c, site });
  assert.ok(blocked.logs.some((l) => /a payout sent earlier is not settled yet; no payouts this run/.test(l)), blocked.all);
  assert.equal(chain.sent.length, 1, "nothing more sent while one is unsettled");
  chain.s.height = 2000;                                                       // its blockhash expired: it can never land
  chain.s.land = "finalize";
  const expired = await run("pay", { env, chain, c, site });
  assert.equal(expired.code, 0, expired.all);
  now = site.load();
  assert.deepEqual(now.ledger.payouts.map((p) => p.status), ["expired", "expired"]);
  for (const [a] of owed) assert.equal(now.state.wallets.get(a).hold?.slot, chain.s.slot - 1, "owed again, and held until the wallet's history is counted past the expiry");
  assert.ok(expired.logs.some((l) => /3 held \(or until the wallet's history is counted past it\)/.test(l)), expired.all);
  assert.equal(chain.sent.length, 1, "not paid again in the run that found it expired");
  // Any newer transaction of the wallet's (here a stranger's dust transfer) is counted past it: the wallets are paid, once.
  chain.flood(1);
  const paid = await run("pay", { env, chain, c, site });
  assert.equal(paid.code, 0, paid.all);
  now = site.load();
  assert.deepEqual(now.ledger.payouts.map((p) => p.status), ["expired", "expired", "paid"]);
  for (const [a, v] of owed) assert.equal(chain.lamports.get(a) + BigInt(now.ledger.payouts[2].rows.find((x) => x[0] === a)[2]), v, "paid once");
  assert.equal(owedOf(now.state).size, 0);

  // Landed but failed on chain: its fee is spent (the wallets' shares of it), the rest owed again; paid by the next run.
  const s4 = seeded({ holders: pop.rows, cursor: chain.newest() });
  const site4 = makeSite(t, { wallet: w.address, ...s4 });
  const owed4 = owedOf(s4.state), before4 = chain.lamports.get(w.address);
  chain.s.land = "error";
  const failed = await run("pay", { env, chain, c, site: site4 });
  assert.ok(failed.logs.some((l) => /^::warning title=Rewards::the payout .* failed on chain .*: its fee 0\.00000519 SOL is spent; its 3 wallet\(s\) are owed again/.test(l)), failed.all);
  now = site4.load();
  const frow = now.ledger.payouts[0];
  assert.deepEqual([frow.status, now.ledger.P, now.ledger.F], ["failed", 0n, frow.fee]);
  for (const [a, net, share] of frow.rows) assert.equal(now.state.wallets.get(a).owed, owed4.get(a) - share, "owed again, less its share of the fee spent");
  assert.equal(chain.lamports.get(w.address), before4 - frow.fee, "only the fee left the wallet");
  assert.equal(R.identityProblem(now.state, now.ledger), null);
  chain.s.land = "finalize";
  await run("pay", { env, chain, c, site: site4 });
  assert.deepEqual(site4.load().ledger.payouts.map((p) => p.status), ["failed", "paid"]);

  // Seen but not final within the wait: stays "sending", settled by the next run.
  const s3 = seeded({ holders: pop.rows, cursor: chain.newest() });
  const site3 = makeSite(t, { wallet: w.address, ...s3 });
  chain.s.land = "confirm";
  await run("pay", { env, chain, c, site: site3 });
  assert.equal(site3.load().ledger.payouts[0].status, "sending");
  chain.finalizeAll();
  await run("pay", { env, chain, c, site: site3 });
  assert.equal(site3.load().ledger.payouts[0].status, "paid");
  chain.s.land = "finalize";
});

test("a record lost after the send (its commit never reached main) is found on chain: a payout is never paid twice, a claim is still counted", async (t) => {
  const pop = population();
  const w = throwaway();
  const chain = fakeChain({ wallet: w.address, claimable: 200_000_000, holders: pop.rows }), c = clock();
  const { state, ledger } = seeded({ holders: pop.rows, cursor: chain.newest() });
  const site = makeSite(t, { wallet: w.address, state, ledger });
  const env = { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58 };
  const lostFiles = [site.read(FILES.state), site.read(FILES.ledger)];
  const r = await run("send", { env, chain, c, site });
  assert.equal(r.code, 0, r.all);
  assert.equal(chain.sent.length, 2, "a claim and a payout");
  const good = site.load();
  const received = new Map([...owedOf(state).keys()].map((a) => [a, chain.lamports.get(a)]));
  // The commit is lost: main still has the files from before the run.
  site.put(FILES.state, lostFiles[0]); site.put(FILES.ledger, lostFiles[1]);
  const again = await run("send", { env, chain, c, site });
  assert.equal(again.code, 0, again.all);
  assert.ok(again.logs.some((l) => /a claim the ledger did not list .* counted/.test(l)), again.all);
  assert.ok(again.logs.some((l) => /a payout the ledger had lost .* recorded as paid: it is never paid twice/.test(l)), again.all);
  assert.equal(chain.sent.length, 2, "nothing is paid twice");
  for (const [a, v] of received) assert.equal(chain.lamports.get(a), v);
  const back = site.load();
  assert.deepEqual([back.ledger.E, back.ledger.P, back.ledger.F], [good.ledger.E, good.ledger.P, good.ledger.F]);
  assert.deepEqual(owedOf(back.state), owedOf(good.state));

  // A payout-shaped transaction to wallets that are not owed that much: the payouts pause, a person must look.
  const kinds = new Map([[pop.a, 5_000_000n]]);
  const msg = compileLegacyMessage({ payer: w.address, recentBlockhash: base58Encode(randomBytes(32)), instructions: R.payoutInstructions({ payer: w.address, rows: [{ owner: pop.a, lamports: kinds.get(pop.a) }], priceMicroLamports: 100_000 }) });
  chain.land(serializeTransaction(msg.bytes, [Uint8Array.from(w.kp.sign(msg.bytes))]));
  const paused = await run("send", { env, chain, c, site });
  assert.equal(paused.code, 1);
  assert.ok(paused.logs.some((l) => /shaped exactly like a payout but the ledger does not list it and its recipients are not owed that much: payouts are paused/.test(l)), paused.all);
});

test("claims: a stranger's claim is counted; under the minimum nothing is claimed; a claim still sending waits, its share fixed when it was sent; a refused claim changes nothing", async (t) => {
  const w = throwaway();
  const chain = fakeChain({ wallet: w.address, claimable: 5_000_000 }), c = clock();
  const L = R.emptyLedger();
  R.advanceCursor(L, chain.older());
  const site = makeSite(t, { wallet: w.address, ledger: L });
  const env = { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58 };
  // Under REWARDS_MIN_CLAIM_SOL (0.01): no claim, not even simulated.
  const under = await run("claim", { env, chain, c, site });
  assert.ok(under.logs.some((l) => /0\.005 SOL of creator fees waits to be claimed, under REWARDS_MIN_CLAIM_SOL \(0\.01 SOL\)/.test(l)), under.all);
  assert.deepEqual(chain.simulated, []);
  // A stranger claims the launcher's fees (permissionless), paying the fee: counted for the holders.
  const stranger = throwaway();
  chain.lamports.set(stranger.address, 10_000_000n);
  const m = compileLegacyMessage({ payer: stranger.address, recentBlockhash: base58Encode(randomBytes(32)), instructions: [collectCreatorFeeInstruction({ creator: w.address })] });
  chain.land(serializeTransaction(m.bytes, [Uint8Array.from(stranger.kp.sign(m.bytes))]));
  const counted = await run("claim", { env, chain, c, site });
  assert.equal(counted.code, 0, counted.all);
  assert.equal(site.load().ledger.E, 5_000_000n);
  assert.ok(counted.logs.some((l) => l.includes(`paid by ${stranger.address}`)), counted.all);

  // The share is fixed at the send: sent at 40%, settled while the variable says 100.
  chain.lamports.set(creatorVault(w.address), BigInt(RENT) + 100_000_000n);
  chain.s.land = "confirm";
  const sent = await run("claim", { env: { ...env, REWARDS_HOLDER_SHARE_PCT: "40" }, chain, c, site });
  assert.equal(sent.code, 0, sent.all);
  assert.equal(site.load().ledger.claims.at(-1).status, "sending");
  const waits = await run("claim", { env, chain, c, site });
  assert.ok(waits.logs.some((l) => /a claim sent earlier is not settled yet; no new claim this run/.test(l)), waits.all);
  chain.finalizeAll();
  await run("claim", { env: { ...env, REWARDS_HOLDER_SHARE_PCT: "100" }, chain, c, site });
  const row = site.load().ledger.claims.at(-1);
  assert.deepEqual([row.status, row.sharePct, row.forHolders], ["landed", 40, R.floorDiv(row.net * 40n, 100n)]);
  chain.s.land = "finalize";

  // A refused claim: expired at once, nothing counted.
  chain.lamports.set(creatorVault(w.address), BigInt(RENT) + 100_000_000n);
  chain.s.refuse = "Transaction simulation failed";
  const E = site.load().ledger.E;
  const refused = await run("claim", { env, chain, c, site });
  assert.ok(refused.logs.some((l) => /the RPC refused the claim/.test(l)), refused.all);
  assert.deepEqual([site.load().ledger.claims.at(-1).status, site.load().ledger.E], ["expired", E]);
});

test("claims: WSOL someone left wrapped in the wallet's own WSOL account is unwrapped by the \"wsol\" route; what waits there is its token amount, never its lamports less today's rent", async (t) => {
  const w = throwaway();
  const setup = (wsolAccount) => {
    const chain = fakeChain({ wallet: w.address, claimable: 50_000_000 }), c = clock();
    chain.s.rent165 = 1_488_440;                                                // today's rent for a token account; older ones hold 2,039,280
    const L = R.emptyLedger();
    R.advanceCursor(L, chain.older());
    const site = makeSite(t, { wallet: w.address, ledger: L });
    // A graduated coin's PumpSwap vault (an initialized WSOL account of the vault authority), empty.
    const vault = Buffer.alloc(165);
    Buffer.from(base58Decode(WSOL_MINT)).copy(vault, 0); Buffer.from(base58Decode(ammCreatorVaultAuthority(w.address))).copy(vault, 32); vault[108] = 1;
    chain.s.special.set(ammCreatorVaultAta(w.address), { owner: TOKEN_PROGRAM, lamports: 2_039_280, executable: false, rentEpoch: 0, data: [vault.toString("base64"), "base64"] });
    chain.s.special.set(wsolAta(w.address), wsolAccount);
    chain.lamports.set(wsolAta(w.address), BigInt(wsolAccount.lamports));
    return { chain, c, site };
  };
  const wsolAccount = (amount, lamports) => {
    const d = Buffer.alloc(165);
    Buffer.from(base58Decode(WSOL_MINT)).copy(d, 0); Buffer.from(base58Decode(w.address)).copy(d, 32); d.writeBigUInt64LE(amount, 64); d[108] = 1;
    return { owner: TOKEN_PROGRAM, lamports, executable: false, rentEpoch: 0, data: [d.toString("base64"), "base64"] };
  };
  const env = { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58 };
  // 3 SOL of WSOL in it: the "wsol" route.
  const full = setup(wsolAccount(3_000_000_000n, 3_002_039_280));
  const r = await run("claim", { env, ...full });
  assert.ok(r.logs.some((l) => /3 SOL of WSOL sits wrapped in the wallet's WSOL account: the claim takes the "wsol" route/.test(l)), r.all);
  const shape = checkClaimMessage(decodeTransaction(new Uint8Array(Buffer.from(full.chain.simulated[0], "base64"))).messageBytes, { wallet: w.address });
  assert.deepEqual([shape.curve, shape.amm, shape.createWsolAta], [true, "wsol", false]);
  // (This fake chain does not run PumpSwap: the simulation fails, and so nothing is sent.)
  assert.ok(r.logs.some((l) => /the claim's simulation did not pass .*nothing was sent/.test(l)), r.all);
  assert.deepEqual(full.chain.sent, []);
  // An empty WSOL account made when rent was higher (2,039,280 lamports; 1,488,440 today), or plain SOL someone sent to its
  // address: no WSOL waits there. The usual claim goes out (not a "wsol" claim that cannot work), and no WSOL is reported.
  for (const acct of [wsolAccount(0n, 2_039_280), { owner: SYSTEM_PROGRAM, lamports: 2_000_000, executable: false, rentEpoch: 0, data: ["", "base64"] }]) {
    const x = setup(acct);
    const q = await run("claim", { env, ...x });
    assert.equal(q.code, 0, q.all);
    assert.ok(!/sits wrapped|WSOL/.test(q.all), q.all);
    const sh = checkClaimMessage(decodeTransaction(new Uint8Array(Buffer.from(x.chain.simulated[0], "base64"))).messageBytes, { wallet: w.address });
    assert.deepEqual([sh.curve, sh.amm], [true, null]);
    assert.equal(x.chain.sent.length, 1);
    assert.equal(x.site.load().ledger.claims[0].status, "landed");
  }
});

test("the wallet must be an active launcher in data/wallets.json; the key and the RPC URL never reach the output", async (t) => {
  const w = throwaway();
  const site = makeSite(t, { wallet: null });
  const chain = fakeChain({ wallet: w.address }), c = clock();
  const r = await run("send", { env: { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58, SOLANA_RPC_URL: RPC_URL }, chain, c, site });
  assert.equal(r.code, 1);
  assert.ok(r.logs.some((l) => l.startsWith(`::error title=Rewards::the launch wallet ${w.address} is not an active launcher`)), r.all);
  assert.deepEqual(chain.methods(), []);
  const noKey = await run("send", { env: { REWARDS_ENABLED: "on" }, chain, c, site });
  assert.equal(noKey.code, 1);
  assert.match(noKey.errs.join("\n"), /LAUNCH_WALLET_KEY is not set/);
  // An error that quotes both (as a careless RPC might): scrubbed.
  const leaky = { ...chain.rpc, getSignaturesForAddress: async () => { throw new Error(`boom ${w.base58} at ${RPC_URL}`); } };
  const site2 = makeSite(t, { wallet: w.address });
  const errs = [], logs = [];
  const code = await main(["send"], { env: { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58, SOLANA_RPC_URL: RPC_URL }, root: site2.root, rpc: leaky, now: c.now, sleep: c.sleep, stdout: (l) => logs.push(l), stderr: (l) => errs.push(l) });
  assert.equal(code, 1);
  const all = [...logs, ...errs, ...r.logs, ...r.errs].join("\n");
  assert.ok(all.includes("boom"));
  for (const secret of [w.base58, RPC_URL, "RPCKEY9f8e7d6c5b4a3"]) assert.ok(!all.includes(secret), "a secret reached the output");
});

test("payoutOf reads back exactly the payouts the builder makes, and nothing else", () => {
  const w = throwaway().address, a = holderAddress(), b = holderAddress();
  const rows = [{ owner: a, lamports: 9_000_000n }, { owner: b, lamports: 3_000_000n }];
  const tx = (instructions, fee = Number(R.payoutFee(2, 100_000)), payer = w) => {
    const msg = compileLegacyMessage({ payer, recentBlockhash: base58Encode(randomBytes(32)), instructions });
    const json = transactionToJson(serializeTransaction(msg.bytes, [new Uint8Array(64)]));
    return { ...json, meta: { err: null, fee, preBalances: [], postBalances: [] } };
  };
  const good = payoutOf(tx(R.payoutInstructions({ payer: w, rows, priceMicroLamports: 100_000 })), w);
  const f = R.payoutFee(2, 100_000);
  assert.deepEqual(good, { rows: [{ owner: a, lamports: 9_000_000n, share: f / 2n + f % 2n }, { owner: b, lamports: 3_000_000n, share: f / 2n }], fee: f, failed: false });
  const ixs = R.payoutInstructions({ payer: w, rows, priceMicroLamports: 100_000 });
  assert.equal(payoutOf(tx(ixs, 5000), w), null, "another fee");
  assert.equal(payoutOf(tx(ixs), holderAddress()), null, "another payer");
  assert.equal(payoutOf(tx(ixs.slice(1)), w), null, "no compute-unit limit");
  assert.equal(payoutOf(tx([ixs[0], ixs[1], ixs[2], ixs[2]]), w), null, "a recipient twice");
  assert.equal(payoutOf(tx([...ixs.slice(0, 2), { ...ixs[2], keys: [ixs[2].keys[0], { pubkey: w, isSigner: true, isWritable: true }] }, ixs[3]]), w), null, "to the wallet itself");
  assert.equal(payoutOf(tx([...ixs, collectCreatorFeeInstruction({ creator: w })]), w), null, "anything else in it");
});

/* ── what one wallet, a flood or a lagging node cannot do ─────────────────────────────── */

test("one recipient cannot stop the payouts: a reserved account key is never put in a transaction, and a wallet whose own transfer fails in simulation is carried and held while the others are paid (the run exits 1)", async (t) => {
  const pop = population();
  const w = throwaway();
  const chain = fakeChain({ wallet: w.address, balance: 3_000_000_000, holders: pop.rows }), c = clock();
  const { state, ledger } = seeded({ holders: pop.rows, cursor: chain.newest() });
  // A state from before the rule, owing a reserved key (NativeLoader1111…, on the curve): carried with its reason, never simulated.
  const NATIVE = "NativeLoader1111111111111111111111111111111";
  state.wallets.set(NATIVE, { lots: [], pts: 0n, ptsAt: 0, owed: 50_000_000n, first: null });
  ledger.A += 50_000_000n;
  const site = makeSite(t, { wallet: w.address, state, ledger });
  const env = { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58 };
  const owed = owedOf(state);
  chain.s.failTo.add(pop.b);                                                   // b's transfer always fails, as a reserved key's does
  const r = await run("pay", { env, chain, c, site });
  assert.equal(r.code, 1, "a person sees it");
  assert.ok(r.logs.some((l) => l.includes(`${pop.b}: its own transfer fails in simulation`) && /held until/.test(l)), r.all);
  assert.ok(r.logs.some((l) => /1 a reserved account/.test(l)), r.all);
  assert.equal(chain.sent.length, 1, "the batch went out without b");
  const L1 = site.load();
  assert.deepEqual(L1.ledger.payouts.map((p) => [p.status, p.rows.map((x) => x[0]).sort()]), [["paid", [pop.a, pop.c].sort()]]);
  assert.equal(L1.state.wallets.get(pop.b).owed, owed.get(pop.b), "b is still owed all of it");
  assert.match(L1.state.wallets.get(pop.b).hold.reason, /its payout failed in simulation \(.*ExternalAccountLamportSpend/);
  assert.equal(L1.state.wallets.get(NATIVE).owed, 50_000_000n);
  for (const b64 of chain.simulated) assert.ok(!decodeTransaction(new Uint8Array(Buffer.from(b64, "base64"))).message.accountKeys.includes(NATIVE), "never in a transaction");
  // The next run: b is held, not simulated again; nothing else is due.
  const sims = chain.simulated.length;
  const again = await run("pay", { env, chain, c, site });
  assert.equal(again.code, 0, again.all);
  assert.equal(chain.simulated.length, sims);
  assert.ok(again.logs.some((l) => /1 held: its payout failed in simulation/.test(l)), again.all);
  // A day later its transfer works again: b is paid, once, and its hold is gone.
  chain.s.failTo.clear();
  c.t += 25 * HOUR;
  const later = await run("pay", { env, chain, c, site });
  assert.equal(later.code, 0, later.all);
  const L3 = site.load();
  const row = L3.ledger.payouts[1].rows.find((x) => x[0] === pop.b);
  assert.equal(chain.lamports.get(pop.b) + row[2], owed.get(pop.b));
  assert.equal(L3.state.wallets.get(pop.b)?.hold, undefined);
  assert.equal(R.identityProblem(L3.state, L3.ledger), null);
});

test("gate 5 compares nothing read at another slot: a recipient that trades, or SOL sent to the payer, between the balance read and the simulation does not stop the payouts", async (t) => {
  const pop = population();
  const w = throwaway();
  const chain = fakeChain({ wallet: w.address, holders: pop.rows }), c = clock();
  const { state, ledger } = seeded({ holders: pop.rows, cursor: chain.newest() });
  const site = makeSite(t, { wallet: w.address, state, ledger });
  chain.lamports.set(pop.a, 50_000_000n);
  chain.s.onSim = () => { chain.lamports.set(pop.a, chain.lamports.get(pop.a) - 7_000n); chain.lamports.set(w.address, chain.lamports.get(w.address) + 1_000_000n); };
  const r = await run("pay", { env: { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58 }, chain, c, site });
  assert.equal(r.code, 0, r.all);
  assert.equal(chain.sent.length, 1);
  assert.equal(site.load().ledger.payouts[0].status, "paid");
  const sim = chain.calls.find((x) => x.method === "simulateTransaction");
  const read = chain.calls.findLast((x, i) => x.method === "getMultipleAccounts" && i < chain.calls.indexOf(sim));
  assert.deepEqual(read.params[0][0], w.address, "the payer's and the recipients' balances, read with their slot");
  assert.ok(Number.isSafeInteger(sim.params[1].minContextSlot), "the simulation runs at that slot or later");
});

test("a flood of transactions naming the wallet (10,500 here, about 0.05 SOL of fees) only delays: the count saves as it goes and catches up over runs, a failure loses at most a chunk, and a launch waits only until then", async (t) => {
  const pop = population();
  const w = throwaway();
  const chain = fakeChain({ wallet: w.address, balance: 2_000_000_000, holders: pop.rows }), c = clock();
  const { state, ledger } = seeded({ holders: pop.rows, cursor: chain.newest() });
  const site = makeSite(t, { wallet: w.address, state, ledger });
  const env = { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58 };
  chain.flood(10_500);
  const junk = chain.history.get(w.address).slice(0, 10_500).reverse().map((x) => x.signature);   // oldest first
  const counted = () => junk.indexOf(site.json(FILES.ledger).cursor) + 1;
  // Every transaction read takes 100 ms (a provider's spacing); the RPC may give up at a chosen read.
  let reads = 0, failAt = Infinity;
  const slow = { ...chain.rpc, getTransaction: async (...a) => { c.t += 100; if (++reads === failAt) throw new Error("the RPC kept refusing"); return chain.rpc.getTransaction(...a); } };
  const earmark = () => rewardsEarmark({ io: site.io, rpc: slow, wallet: w.address, env, now: c.now });
  // Before they are counted: the earmark cannot read them all in its time, so a launch waits (fail closed).
  assert.match((await earmark()).problem, /take too long to read/);
  // A run whose RPC fails after 1,000 reads keeps those 1,000 counted.
  failAt = reads + 1_001;
  const broken = await run("pay", { env, chain, c, site, rpc: slow });
  assert.equal(broken.code, 1, broken.all);
  assert.equal(counted(), 1_000, "five chunks of 200 were saved before the failure");
  failAt = Infinity;
  // Each run counts for its own time and goes on where the last one stopped; the payouts wait until it has caught up.
  const next = await run("pay", { env, chain, c, site, rpc: slow });
  assert.equal(next.code, 0, next.all);
  assert.ok(next.logs.some((l) => /not counted yet: no payouts until they are/.test(l)), next.all);
  assert.deepEqual(chain.sent, []);
  assert.ok(counted() >= 1_000 + 3_000 && counted() < 10_500, String(counted()));
  let runs = 0;
  while (!chain.sent.length && runs < 5) { const r = await run("pay", { env, chain, c, site, rpc: slow }); assert.equal(r.code, 0, r.all); runs++; }
  assert.ok(runs <= 2, `${runs} more runs`);
  assert.equal(counted(), 10_500, "caught up: nothing skipped, the cursor never moved past a transaction not classified");
  assert.equal(chain.sent.length, 1, "then paid");
  // Counted: the earmark reads nothing more, and holds exactly the holders' unpaid (the launch goes on).
  assert.deepEqual(await earmark(), { lamports: R.holdersUnpaid(site.load().ledger), problem: null });
});

test("dry mode counts the wallet's transactions too: a stranger's claim while rewards are dry is the holders' (the launcher holds it back in any mode), and the cursor moves on; nothing is sent", async (t) => {
  const w = throwaway();
  const chain = fakeChain({ wallet: w.address, claimable: 300_000_000 }), c = clock();
  const L = R.emptyLedger();
  R.advanceCursor(L, chain.older());
  const site = makeSite(t, { wallet: w.address, ledger: L });
  const stranger = throwaway();
  chain.lamports.set(stranger.address, 10_000_000n);
  const m = compileLegacyMessage({ payer: stranger.address, recentBlockhash: base58Encode(randomBytes(32)), instructions: [collectCreatorFeeInstruction({ creator: w.address })] });
  const sig = chain.land(serializeTransaction(m.bytes, [Uint8Array.from(stranger.kp.sign(m.bytes))]));
  // Not counted yet: the launcher holds back what it claimed, whatever REWARDS_ENABLED says (a deposit would not be held).
  for (const REWARDS_ENABLED of ["off", "dry", "on"]) assert.deepEqual(await rewardsEarmark({ io: site.io, rpc: chain.rpc, wallet: w.address, env: { REWARDS_ENABLED } }), { lamports: 300_000_000n, problem: null }, REWARDS_ENABLED);
  const r = await run("send", { env: { REWARDS_ENABLED: "dry", LAUNCH_WALLET_KEY: w.base58 }, chain, c, site });
  assert.equal(r.code, 0, r.all);
  assert.ok(r.logs.some((l) => /a claim the ledger did not list .* counted/.test(l)), r.all);
  assert.equal(site.load().ledger.E, 300_000_000n);
  assert.equal(site.json(FILES.ledger).cursor, sig);
  assert.ok(!chain.methods().includes("sendTransaction"));
  assert.deepEqual(await rewardsEarmark({ io: site.io, rpc: chain.rpc, wallet: w.address, env: { REWARDS_ENABLED: "off" } }), { lamports: 300_000_000n, problem: null }, "counted: E now holds it");
});

test("\"expired\" takes more than one RPC answer: a payout a lagging node cannot see stays sending while its transaction is found; one settled expired that landed after all is recorded as what it did (failed or paid), never paid twice; an expired claim found on chain is counted", async (t) => {
  const pop = population();
  const w = throwaway();
  const chain = fakeChain({ wallet: w.address, balance: 3_000_000_000, claimable: 200_000_000, holders: pop.rows }), c = clock();
  const env = { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58 };
  const lagging = ({ tx = false } = {}) => (sig) => { chain.s.hideStatus.add(sig); if (tx) chain.s.hideTx.add(sig); chain.s.height = 2_000; };
  const caughtUp = () => { chain.s.hideStatus.clear(); chain.s.hideTx.clear(); chain.s.height = 1_000; chain.s.onSend = null; chain.s.land = "finalize"; };
  // 1. It landed; the node asked for its status is behind, the height long past its blockhash: its transaction is found, so it is not expired.
  const s1 = seeded({ holders: pop.rows, cursor: chain.newest() });
  const site1 = makeSite(t, { wallet: w.address, ...s1 });
  chain.s.onSend = lagging();
  await run("pay", { env, chain, c, site: site1 });
  assert.equal(site1.load().ledger.payouts[0].status, "sending");
  // The next run's node still cannot see its status, but the wallet's history lists it, final: the count settles it from its transaction.
  chain.s.onSend = null; chain.s.height = 1_000;
  const r1 = await run("pay", { env, chain, c, site: site1 });
  assert.ok(r1.logs.some((l) => /the payout .* is on chain: settled as paid/.test(l)), r1.all);
  assert.equal(site1.load().ledger.payouts[0].status, "paid");
  assert.equal(chain.sent.length, 1);
  caughtUp();
  // 2. It landed and FAILED on chain, and neither its status nor its transaction can be seen: settled expired, its wallets held.
  const s2 = seeded({ holders: pop.rows, cursor: chain.newest() });
  const site2 = makeSite(t, { wallet: w.address, ...s2 });
  const owed2 = owedOf(s2.state), E2 = s2.ledger.E, start2 = chain.lamports.get(w.address);
  chain.s.land = "error"; chain.s.onSend = lagging({ tx: true });
  await run("pay", { env, chain, c, site: site2 });
  assert.equal(site2.load().ledger.payouts[0].status, "expired");
  caughtUp();
  // The next run finds it on chain: recorded as failed (its fee spent, each wallet owed less its share of it); the wallets wait for the history to move past it.
  const found = await run("pay", { env, chain, c, site: site2 });
  assert.ok(found.logs.some((l) => /was settled as expired but it is on chain: recorded as failed/.test(l)), found.all);
  let now2 = site2.load();
  const failedRow = now2.ledger.payouts[0];
  assert.deepEqual([failedRow.status, now2.ledger.F], ["failed", failedRow.fee]);
  for (const [a, , share] of failedRow.rows) assert.equal(now2.state.wallets.get(a).owed, owed2.get(a) - share);
  chain.flood(1);
  await run("pay", { env, chain, c, site: site2 });
  now2 = site2.load();
  assert.deepEqual(now2.ledger.payouts.map((p) => p.status), ["failed", "paid"]);
  assert.ok(start2 - chain.lamports.get(w.address) <= E2, "the wallet paid out no more than the holders' share: the failed payout's fee is counted");
  assert.equal(start2 - chain.lamports.get(w.address), now2.ledger.P + now2.ledger.F);
  assert.equal(R.identityProblem(now2.state, now2.ledger), null);
  // 3. It landed, invisible: expired; found on chain next run: recorded as paid, and nothing is sent again.
  const s3 = seeded({ holders: pop.rows, cursor: chain.newest() });
  const site3 = makeSite(t, { wallet: w.address, ...s3 });
  chain.s.onSend = lagging({ tx: true });
  await run("pay", { env, chain, c, site: site3 });
  assert.equal(site3.load().ledger.payouts[0].status, "expired");
  caughtUp();
  const sent3 = chain.sent.length;
  const r3 = await run("pay", { env, chain, c, site: site3 });
  assert.ok(r3.logs.some((l) => /was settled as expired but it is on chain: recorded as paid; it is never paid twice/.test(l)), r3.all);
  assert.equal(chain.sent.length, sent3, "never paid twice");
  assert.equal(site3.load().ledger.payouts[0].status, "paid");
  assert.equal(owedOf(site3.load().state).size, 0);
  // 4. A claim that landed, invisible: expired; found on chain next run: counted after all.
  const L4 = R.emptyLedger();
  R.advanceCursor(L4, chain.newest());
  const site4 = makeSite(t, { wallet: w.address, ledger: L4 });
  chain.s.onSend = lagging({ tx: true });
  await run("claim", { env, chain, c, site: site4 });
  assert.deepEqual([site4.load().ledger.claims[0].status, site4.load().ledger.E], ["expired", 0n]);
  caughtUp();
  const r4 = await run("claim", { env, chain, c, site: site4 });
  assert.ok(r4.logs.some((l) => /the claim .* was settled as expired but it is on chain: 0\.2 SOL counted after all/.test(l)), r4.all);
  assert.ok(site4.load().ledger.E > 199_000_000n);
});

test("a missing ledger or state is refused while the other file is there: the holders' share is never started again from nothing", async (t) => {
  const w = throwaway();
  const chain = fakeChain({ wallet: w.address }), c = clock();
  for (const gone of [FILES.ledger, FILES.state]) {
    const site = makeSite(t, { wallet: w.address });
    fs.rmSync(path.join(site.root, gone));
    for (const phase of ["send", "snapshot"]) {
      const r = await run(phase, { env: { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58 }, chain, c, site });
      assert.equal(r.code, 1, r.all);
      assert.ok(r.errs.some((l) => l.includes(`${gone} is missing while`)), r.all);
      assert.ok(!site.exists(gone), "nothing written");
    }
  }
  // Neither file (a fresh start): the first run only sets the cursor.
  const site = makeSite(t, { wallet: w.address });
  fs.rmSync(path.join(site.root, "data/rewards"), { recursive: true });
  chain.older();
  const r = await run("send", { env: { REWARDS_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58 }, chain, c, site });
  assert.equal(r.code, 0, r.all);
  assert.ok(site.json(FILES.ledger).cursor);
});

test("snapshot: a burn right after the token accounts' slot does not skip the hour (the supply is bracketed by a read before and one after); a mint that can still mint must match both", async (t) => {
  const pop = population();
  const site = makeSite(t);
  const chain = fakeChain({ wallet: holderAddress(), holders: pop.rows }), c = clock();
  chain.s.burn = 1n;                                                            // 1 raw unit burnt between the listing and the second mint read
  const r = await run("snapshot", { env: { REWARDS_ENABLED: "on" }, chain, c, site });
  assert.equal(r.code, 0, r.all);
  assert.equal(chain.methods().filter((m) => m === "getProgramAccounts").length, 1, "taken at the first read");
  assert.equal(site.json(FILES.state).epoch, T0, "genesis");
  const mintable = makeSite(t);
  const chain2 = fakeChain({ wallet: holderAddress(), holders: pop.rows });
  chain2.s.mintAuthority = true; chain2.s.burn = 1n;
  const r2 = await run("snapshot", { env: { REWARDS_ENABLED: "on" }, chain: chain2, c, site: mintable });
  assert.equal(r2.code, 0, r2.all);
  assert.equal(chain2.methods().filter((m) => m === "getProgramAccounts").length, 2, "a mint with a mint authority: the first read is refused, the retry (no burn) is whole");
});

test("snapshot: at a close the accounts of the wallets with points are read, and an owner that can never be paid (a program) gets no share; each sample records the rules in force, which the site quotes", async (t) => {
  const pop = population();
  const L = R.emptyLedger();
  const g = fakeSig();
  R.recordClaimSending(L, { sig: g, lastValidBlockHeight: 1, sharePct: 100, sentAt: iso(START) });
  R.settleClaim(L, g, { status: "landed", claimed: 1_000_000_000n, walletFee: 0n, net: 1_000_000_000n }, { settledAt: iso(START) });
  const site = makeSite(t, { ledger: L });
  const chain = fakeChain({ wallet: holderAddress(), holders: pop.rows }), c = clock();
  chain.s.special.set(pop.c, { owner: "BPFLoaderUpgradeab1e11111111111111111111111", lamports: 1_141_440, executable: true, rentEpoch: 0, data: ["", "base64"], space: 36 });
  const env = { REWARDS_ENABLED: "on", REWARDS_EVERY_DAYS: "1", REWARDS_MIN_PAYOUT_SOL: "0.002" };
  const logs = [];
  for (let h = 0; h <= 24; h++) {
    c.t = START + (h + 1) * HOUR; chain.s.time = T0 + h * 3600; chain.s.slot += 9000;
    const r = await run("snapshot", { env, chain, c, site });
    assert.equal(r.code, 0, r.all);
    logs.push(...r.logs);
  }
  const audit = site.json(R.periodPath(1));
  assert.deepEqual(audit.refused.map((x) => [x[0], x[2]]), [[pop.c, "its account is executable (a program)"]]);
  assert.deepEqual(audit.rows.map((x) => x[0]).sort(), [pop.a, pop.b].sort(), "only payable owners share the pot");
  assert.equal(site.load().state.wallets.get(pop.c)?.owed ?? 0n, 0n);
  assert.ok(logs.some((l) => /1 owner\(s\) with points can never be paid \(its account is executable \(a program\)\)/.test(l)), logs.join("\n"));
  // The rules in force, recorded for the site (REWARDS_MIN_PAYOUT_SOL included).
  const st = site.load().state;
  assert.deepEqual(site.json(FILES.state).rules, { everyDays: 1, releasePct: 50, walletCapPct: 10, minBalancePpm: 100, minPayoutLamports: "2000000" });
  assert.equal(R.rewardsSiteText(st.rules)[2].title, "Every day,");
  assert.match(R.rewardsSiteText(st.rules)[2].text, /under 0\.002 SOL/);
});

/* ── the shipped files ────────────────────────────────────────────────────────────────── */

test("the rewards files in the repository: the state and the ledger validate, agree (the identity) and are in the rules' own layout; each has its note (the owner's exclusion list is checked on fixtures only)", () => {
  const text = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
  const state = R.validateRewardsState(JSON.parse(text(FILES.state)));
  const ledger = R.validateRewardsLedger(JSON.parse(text(FILES.ledger)));
  assert.equal(R.stateText(state), text(FILES.state), "state.json is in the rules' own layout");
  assert.equal(R.ledgerText(ledger), text(FILES.ledger), "ledger.json is in the rules' own layout");
  assert.equal(R.identityProblem(state, ledger), null);
  for (const rel of [FILES.state, FILES.ledger]) assert.equal(typeof JSON.parse(text(rel)).note, "string", rel);
  // data/rewards-exclude.json is the owner's, edited by hand, and npm test gates every Pages deploy (and so every launch) and both
  // Rewards jobs: a typo in it must stop only the samples (snapshot refuses it at run time), never the tests. So it is not read here.
  const wallets = JSON.parse(text("data/wallets.json"));
  assert.ok(R.exclusionSet({ wallets, exclude: null }).has("HxhisqFBeZRJcBWkjnumk6HwWxFLGVVD6jfX23tXHzQh"), "the launcher never earns");
  // Every published period is a well-formed audit record that adds up.
  const dir = path.join(ROOT, FILES.periods);
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    assert.match(f, /^[1-9]\d*\.json$/);
    const a = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    assert.ok(a.rows.reduce((s, r) => s + BigInt(r[2]), 0n) <= BigInt(a.pot), f);
  }
});

/* ── the workflow ─────────────────────────────────────────────────────────────────────── */

const W = fs.readFileSync(path.join(ROOT, ".github/workflows/rewards.yml"), "utf8");
const LAUNCH_W = fs.readFileSync(path.join(ROOT, ".github/workflows/launch.yml"), "utf8");
const steps = W.split(/\n      - /);
const job = (name) => { const from = W.indexOf(`\n  ${name}:\n`); const next = W.slice(from + 1).search(/\n  [a-z][\w-]*:\n/); return next < 0 ? W.slice(from) : W.slice(from, from + 1 + next); };

test("rewards workflow: hourly and by hand (new_epoch), no permission by default, its own group; the pay job shares the launcher's group, the sample job does not", () => {
  assert.match(W, /^name: Rewards$/m);
  assert.match(W, /on:\n  schedule:\n    - cron: "7 \* \* \* \*"\n  workflow_dispatch:\n    inputs:\n      new_epoch:\n/);
  assert.match(W, /^permissions: \{\}$/m);
  assert.match(W, /\nconcurrency:\n  group: rewards\n  cancel-in-progress: false\n/);
  assert.deepEqual([...W.matchAll(/^  ([a-z][\w-]*):\n    (?:needs|if|runs-on)/gm)].map((m) => m[1]), ["sample", "pay"]);
  assert.match(job("pay"), /\n    concurrency:\n      group: launch\n      cancel-in-progress: false\n/, "a launch and a payout never spend from the wallet at once");
  assert.match(LAUNCH_W, /\nconcurrency:\n  group: launch\n/, "the Launch workflow's group, by the same name");
  assert.ok(!/concurrency:/.test(job("sample")), "the hour-long sample job never keeps a launch waiting");
  assert.deepEqual([...W.matchAll(/^\s+permissions:\n((?:\s{6}\S.*\n)+)/gm)].map((m) => m[1].trim()), ["contents: write", "contents: write"]);
  for (const name of ["sample", "pay"]) assert.match(job(name), /timeout-minutes: \d+/, name);
  // Off unless REWARDS_ENABLED is on or dry (an unset variable runs nothing).
  assert.match(job("sample"), /\n    if: \$\{\{ vars\.REWARDS_ENABLED == 'on' \|\| vars\.REWARDS_ENABLED == 'dry' \}\}\n/);
  assert.match(job("pay"), /\n    needs: sample\n    if: \$\{\{ !cancelled\(\) && \(vars\.REWARDS_ENABLED == 'on' \|\| vars\.REWARDS_ENABLED == 'dry'\) \}\}\n/, "claims run even when the sample failed");
  assert.ok(Number(job("sample").match(/timeout-minutes: (\d+)/)[1]) * 60 > R.SAMPLE_WINDOW + 600, "the sample job outlasts the window");
});

test("rewards workflow: pinned actions, no stored credentials, no dependency installed, the tests first", () => {
  assert.deepEqual([...new Set([...W.matchAll(/uses:\s*(\S+)\s*#\s*(\S+)/g)].map((m) => `${m[1]} ${m[2]}`))], [
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 v7.0.1",
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 v7.0.0",
  ]);
  for (const m of W.matchAll(/uses:\s*(\S+)/g)) assert.match(m[1], /^actions\/[\w-]+@[0-9a-f]{40}$/);
  assert.equal([...W.matchAll(/actions\/checkout@/g)].length, 2);
  assert.equal([...W.matchAll(/- uses: actions\/checkout@\S+ # v7\.0\.1\n\s+with:\n\s+ref: main\n\s+persist-credentials: false\n/g)].length, 2);
  assert.ok(!/\bnpm\b|node_modules/.test(W), "no package reaches a job, least of all the one with the key");
  for (const [name, phase] of [["sample", "snapshot"], ["pay", "send"]]) {
    assert.match(job(name), new RegExp(`- run: node --test tests/rewards\\.test\\.mjs tests/rewards-cli\\.test\\.mjs tests/pump-fees\\.test\\.mjs\\n[\\s\\S]*run: node scripts/rewards\\.mjs ${phase}\\n`), name);
  }
});

test("rewards workflow: the wallet key in the pay job's send step only; the RPC URL in the sample and send steps; the variables where they are read; no expression in a script", () => {
  assert.deepEqual([...new Set([...W.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]))].sort(), ["LAUNCH_WALLET_KEY", "SOLANA_RPC_URL"]);
  const withSecrets = steps.filter((s) => /secrets\./.test(s));
  assert.equal(withSecrets.length, 2);
  const [snap, snd] = withSecrets;
  assert.match(snap, /run: node scripts\/rewards\.mjs snapshot$/);
  assert.deepEqual([...snap.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]), ["SOLANA_RPC_URL"], "the sample never sees the key");
  assert.match(snd, /run: node scripts\/rewards\.mjs send$/);
  assert.deepEqual([...snd.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]).sort(), ["LAUNCH_WALLET_KEY", "SOLANA_RPC_URL"]);
  assert.equal([...W.matchAll(/LAUNCH_WALLET_KEY: \$\{\{ secrets\.LAUNCH_WALLET_KEY \}\}/g)].length, 1, "the key once");
  assert.ok(job("pay").includes("secrets.LAUNCH_WALLET_KEY") && !job("sample").includes("LAUNCH_WALLET_KEY"));
  assert.ok(!/^ {0,4}env:/m.test(W), "secrets and variables in a step's env, never a job's or the workflow's");
  // The sample records the rules the site quotes (REWARDS_MIN_PAYOUT_SOL among them), so it reads them all.
  for (const v of ["REWARDS_ENABLED", "REWARDS_EVERY_DAYS", "REWARDS_RELEASE_PCT", "REWARDS_WALLET_CAP_PCT", "REWARDS_MIN_BALANCE_PPM", "REWARDS_MIN_PAYOUT_SOL"]) assert.match(snap, new RegExp(`${v}: \\$\\{\\{ vars\\.${v} \\}\\}`), v);
  assert.match(snap, /REWARDS_NEW_EPOCH: \$\{\{ inputs\.new_epoch \}\}/);
  for (const v of ["REWARDS_ENABLED", "REWARDS_HOLDER_SHARE_PCT", "REWARDS_MIN_PAYOUT_SOL", "REWARDS_MIN_CLAIM_SOL", "REWARDS_MAX_TX_PER_RUN", "REWARDS_MAX_SOL_PER_RUN", "LAUNCH_PRIORITY_MICROLAMPORTS", "LAUNCH_MIN_BALANCE_SOL"]) {
    assert.match(snd, new RegExp(`${v}: \\$\\{\\{ vars\\.${v} \\}\\}`), v);
  }
  for (const v of Object.values(R.REWARDS_VARS)) assert.ok(W.includes(`vars.${v}`), `${v} reaches the workflow`);
  for (const step of steps) {
    // A script: the lines under "run: |" indented past the key (a step's piece of text may run on into the next job's header).
    const run = step.includes("run: |") ? step.split("run: |")[1].split("\n").slice(1).filter((l, i, a) => a.slice(0, i + 1).every((x) => x.startsWith("          ") || !x.trim())).join("\n") : step.match(/run: .*/)?.[0] ?? "";
    assert.ok(!run.includes("${{"), `no expression inside a script: ${step.slice(0, 60)}`);
  }
  assert.ok(steps.filter((s) => s.includes("run: |")).every((s) => s.split("run: |")[1].includes("git push") || s.includes("push origin HEAD:main")));
  // The launcher knows whether rewards are on or dry (a missing rewards ledger then makes a launch wait).
  const launchSend = LAUNCH_W.split(/\n      - /).find((s) => /node scripts\/launch\.mjs send$/.test(s));
  assert.match(launchSend, /REWARDS_ENABLED: \$\{\{ vars\.REWARDS_ENABLED \}\}/);
});

test("rewards workflow: a commit after each job of data/rewards only, the token handed to git for the push alone, one rebase retry; the payouts' commit runs whatever happened before it", () => {
  const commits = steps.filter((s) => /git -c user\.name="github-actions\[bot\]"/.test(s));
  assert.equal(commits.length, 2);
  const [c1, c2] = commits;
  assert.ok(job("sample").includes('commit -q -m "Rewards: the hour\'s sample of the holders"') && job("pay").includes('commit -q -m "Rewards: record the claims and payouts"'));
  for (const c of commits) {
    assert.match(c, /git add -- data\/rewards\n/);
    assert.match(c, /if git diff --cached --quiet; then echo "Nothing changed\."; exit 0; fi/);
    assert.match(c, /GH_TOKEN: \$\{\{ github\.token \}\}/);
    assert.match(c, /auth=\$\(printf 'x-access-token:%s' "\$GH_TOKEN" \| base64 -w0\)\n\s+echo "::add-mask::\$auth"/);
    assert.match(c, /if ! git -c http\.extraheader="AUTHORIZATION: basic \$auth" push origin HEAD:main; then\n\s+git -c http\.extraheader="AUTHORIZATION: basic \$auth" fetch origin main\n\s+git -c user\.name="github-actions\[bot\]" -c user\.email="41898282\+github-actions\[bot\]@users\.noreply\.github\.com" rebase origin\/main\n\s+git -c http\.extraheader="AUTHORIZATION: basic \$auth" push origin HEAD:main\n\s+fi/);
    assert.ok(!/secrets\./.test(c));
    assert.match(c, /commit -q -m "Rewards: [a-z' ]+"/, "a fixed message: the commit's text and time say nothing about the sample's moment");
  }
  assert.match(c1, /\n\s+if: \$\{\{ !cancelled\(\) \}\}\n/);
  assert.match(c2, /\n\s+if: \$\{\{ always\(\) \}\}\n/, "a transaction sent is committed even when the send step failed or the run was cancelled");
  assert.ok(!/sanctuary-launches|socials|wallets\.json|rewards-exclude/.test(commits.join("\n")), "the owner's files are never committed by the bot");
});
