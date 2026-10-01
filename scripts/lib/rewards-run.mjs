/**
 * THE $CATSANC HOLDER REWARDS' RUNS: the chain, the files and the clock around the rules of
 * scripts/lib/rewards.mjs (which decides every amount) and the claim of scripts/lib/pump-fees.mjs,
 * one phase a call, with no file system, network or clock of their own (scripts/rewards.mjs brings
 * them: `io` reads and writes files by their repo path, `rpc` is scripts/lib/rpc.mjs createRpc(),
 * `now`, `sleep` and `random` keep time). The Rewards workflow (.github/workflows/rewards.yml) commits
 * after each phase. Every phase is safe to run again after a crash at any point.
 *
 *   snapshot  (no key) the hour's sample of $CATSANC holders, at a random moment: the process draws
 *             D in [0, SAMPLE_WINDOW) seconds, sleeps D, reads the chain once (the mint, every token
 *             account of it by getProgramAccounts, the mint again at that slot or later, the slot's
 *             block time), keeps it in memory and sleeps until SAMPLE_WINDOW seconds after it started;
 *             only then does it check, apply (lots, points, a period close when due: the accounts of
 *             the wallets with points are read first, so an owner that can never be paid gets no share)
 *             and write, so neither the log nor the commit tells when the sample was taken. Between the
 *             two it prints one fixed line. Each write records the rules in force (state.json "rules",
 *             which the site quotes). Without a valid mint in data/socials.json "contract" it waits for
 *             nothing and does nothing (a notice); a contract that differs from the mint the rewards
 *             track stops sampling until the owner dispatches the workflow with new_epoch=<contract>
 *             (REWARDS_NEW_EPOCH).
 *   send      (the only phase with LAUNCH_WALLET_KEY) in order:
 *             1. settle what was sent before: each claim and payout row still "sending", by its
 *                signature (finalized: a claim is measured from its own transaction, measureClaim; a
 *                payout paid or failed) or, never landed, as "expired": only once the finalized block
 *                height is EXPIRY_MARGIN past its blockhash's last valid height AND, asked again after
 *                that, neither its status nor the transaction is known (an expired payout's wallets are
 *                held until the history is counted past it, so one that landed after all is found first);
 *             2. count the wallet's transactions since the ledger's cursor (in "on" and "dry" mode: it
 *                sends nothing, it records what is on chain): a claim the ledger does not list (a
 *                stranger's permissionless claim, or one whose record never reached main) is measured
 *                and counted; a payout the ledger lost (the exact shape the payout builder makes, to
 *                wallets owed that much) is recorded so it is never paid twice; a claim or payout the
 *                ledger settled as expired but that is on chain is settled as what it did; then the
 *                cursor moves on. Oldest first, saved every COUNT_CHUNK transactions and within COUNT_MS,
 *                so a flood of transactions naming the wallet only delays the count by some runs: it
 *                goes on next run where it stopped, and the payouts wait until it has caught up. The
 *                first run only sets the cursor (nothing earlier counts) and sends nothing, so no
 *                transaction can ever fall before a cursor set later;
 *             3. claim (claimPlan over readClaimState, or the "wsol" route when WSOL someone else claimed
 *                into the wallet's own WSOL account waits to be unwrapped: I2 reads the native balance):
 *                built, checked from its bytes, SIMULATED UNSIGNED;
 *                in "on" mode signed only then, written "sending" with the holder share fixed now, sent,
 *                confirmed and measured. Claims run even while the mint gate fails (the pot keeps growing);
 *             4. pay (planPayouts over payoutBudget, within RUN_MS of its own): each batch built and
 *                checked from its bytes (gate 1, its size), I1, I2 on the live balance, the run caps, the
 *                unsigned copy simulated (gate 5: no error, the payer losing at most the batch, read at
 *                the simulation's slot), the wallet still an active launcher; in "on" mode signed only
 *                then, written "sending" (owed reduced) BEFORE it is sent, sent, and confirmed before the
 *                next. A batch whose simulation fails is simulated wallet by wallet: a wallet whose own
 *                transfer fails is carried and held for HOLD_MS (the run exits 1 so a person sees it),
 *                the batch goes out without it, and the other batches go on.
 *             A payout sent earlier and not settled yet stops every payout this run.
 *
 * MODE (REWARDS_ENABLED): "on" claims and pays; "dry" samples (real samples, points and closes are
 * written), counts the wallet's transactions, builds and simulates claims and payouts UNSIGNED, and
 * signs and sends nothing; anything else does nothing. Nothing here buys, sells or swaps: the only
 * transactions are the creator-fee claim (pump-fees.mjs checkClaimMessage) and SystemProgram transfers
 * from the wallet (rewards.mjs checkPayoutMessage), each re-checked from its bytes before it is signed.
 *
 * THE INVARIANTS. A payout batch is signed only when P + F + in flight + Σnet + fee ≤ E (I1: never more
 * than the holders' claimed share, less what was paid and the payout fees; recordPayoutSending checks it
 * again) and the wallet's live balance ≥ LAUNCH_MIN_BALANCE_SOL + max(0, E − P − F − in flight) (I2: the
 * holders' SOL is really there, so a payout never dips into the launcher's own reserve). The launcher,
 * for its part, spends only balance − the holders' earmark (launcher.mjs rewardsEarmark).
 */
import { isAddress, base58Decode, base58Encode } from "../../assets/collection.js";
import { decodeCompactU16, signTransaction, serializeTransaction } from "./solana-tx.mjs";
import { SYSTEM_PROGRAM, COMPUTE_BUDGET_PROGRAM } from "./programs.mjs";
import * as R from "./rewards.mjs";
import {
  readClaimState, claimPlan, buildClaimTransaction, signClaimTransaction, unsignedClaimTransaction, measureClaim, MIN_CLAIM_LAMPORTS,
} from "./pump-fees.mjs";
import { walletFromEnv, walletProblem, launchCaps, isRefusal, signatureOf, CONFIRM_WAIT_MS, CONFIRM_POLL_MS } from "./launcher.mjs";
import { dexScreenerPriceUsd, WRAPPED_SOL_MINT } from "./launchlab.mjs";

/** How long one send phase may keep starting new payouts, from the moment the payouts start (the workflow's job has 30 minutes). */
export const RUN_MS = 12 * 60_000;
/** How long one send phase may spend counting the wallet's transactions (reading each): the rest is counted next run, where this one stopped. */
export const COUNT_MS = 6 * 60_000;
/** The count saves its progress (the cursor and what it recorded) every this many transactions. */
export const COUNT_CHUNK = 200;
/** Pages of 1,000 signatures the count lists past the cursor at most (listing is cheap; reading each is what takes time). More, and a person must look. */
export const MAX_SIGNATURE_PAGES = 200;
/** Blocks past a blockhash's last valid height before a transaction not found is declared never landed (nodes behind a load balancer disagree). */
export const EXPIRY_MARGIN = 150;
/** How long a wallet whose own transfer fails in simulation is held out of the payouts. */
export const HOLD_MS = 24 * 3_600_000;
/** How long, at most, an expired payout's wallets wait for the wallet's history to be counted past it (it is released sooner when it is). */
export const EXPIRED_HOLD_MS = 6 * 3_600_000;
/** JSON-RPC "Minimum context slot has not been reached": the node answering is behind the slot asked for. */
const MIN_CONTEXT_SLOT_NOT_REACHED = -32016;
const MIN_CONTEXT_SLOT_TRIES = 5;
const MIN_CONTEXT_SLOT_WAIT_MS = 2_000;
/** Addresses per getMultipleAccounts call. */
const ACCOUNTS_PER_CALL = 100;
export const WINDOW_LINE = "Rewards: the sampling window is open: the sample is taken at a random moment in it and recorded when the window closes.";

const ISO_SECONDS = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const errText = (err) => { try { return JSON.stringify(err).slice(0, 160); } catch { return "an error"; } };
const S = (v) => R.solText(v);

/** A serialized transaction's message (base64 in, base64 out): what its signatures sign. */
function messageOf(base64) {
  const bytes = Buffer.from(base64, "base64");
  const { value: n, size } = decodeCompactU16(bytes, 0);
  return bytes.subarray(size + 64 * n).toString("base64");
}

/** `call()` again while the node answering is behind the slot asked for (-32016), a few times, a little later each. */
async function atContextSlot(call, sleep) {
  for (let tries = 0; ; tries++) {
    try { return await call(); } catch (e) {
      if (e?.code !== MIN_CONTEXT_SLOT_NOT_REACHED || tries >= MIN_CONTEXT_SLOT_TRIES) throw e;
      await sleep(MIN_CONTEXT_SLOT_WAIT_MS);
    }
  }
}

/* ── the files ────────────────────────────────────────────────────────────────────────── */

function readJson(io, rel) {
  const text = io.readText(rel);
  if (text === null || text === undefined) return null;
  try { return JSON.parse(text.replace(/^\uFEFF/, "")); } catch { throw new R.RewardsError(`${rel} is not valid JSON`); }
}

/**
 * The state and the ledger, each validated, and the identity between them checked: a file that does
 * not add up is refused, never trusted. Both missing is a fresh start; one missing while the other is
 * there is refused (fail closed: the ledger alone knows the holders' claimed share, the state alone
 * what each wallet is owed; neither is ever rebuilt from nothing).
 */
export function loadRewards(io) {
  const sj = readJson(io, R.REWARDS_FILES.state), lj = readJson(io, R.REWARDS_FILES.ledger);
  if ((sj === null) !== (lj === null)) {
    const [missing, there] = sj === null ? [R.REWARDS_FILES.state, R.REWARDS_FILES.ledger] : [R.REWARDS_FILES.ledger, R.REWARDS_FILES.state];
    throw new R.RewardsError(`${missing} is missing while ${there} is there: nothing is done until a person restores it from the repository's history (it is never started again from nothing)`);
  }
  const state = R.validateRewardsState(sj);
  const ledger = R.validateRewardsLedger(lj);
  const p = R.identityProblem(state, ledger);
  if (p) throw new R.RewardsError(`${R.REWARDS_FILES.state} and ${R.REWARDS_FILES.ledger} disagree: ${p}; nothing is done until a person looks`);
  return { state, ledger };
}

/** Write the ledger, then the state, after checking the identity and that each text reads back as itself. */
export function saveRewards(io, state, ledger) {
  const p = R.identityProblem(state, ledger);
  if (p) throw new R.RewardsError(`${p}: nothing written (a bug; a person must look)`);
  const lt = R.ledgerText(ledger), st = R.stateText(state);
  if (R.ledgerText(R.validateRewardsLedger(JSON.parse(lt))) !== lt || R.stateText(R.validateRewardsState(JSON.parse(st))) !== st) {
    throw new R.RewardsError("the rewards files would not read back as written: nothing written (a bug; a person must look)");
  }
  io.writeText(R.REWARDS_FILES.ledger, lt);
  io.writeText(R.REWARDS_FILES.state, st);
}

const contractOf = (io) => {
  const socials = readJson(io, R.REWARDS_FILES.socials);
  return typeof socials?.contract === "string" ? socials.contract.trim() : "";
};

/** The excluded addresses (data/wallets.json and data/rewards-exclude.json); throws when either does not parse: no sample. */
const exclusionsOf = (io) => R.exclusionSet({ wallets: readJson(io, R.REWARDS_FILES.wallets), exclude: readJson(io, R.REWARDS_FILES.exclude) });

/** Accounts (base64), by address; null for one that does not exist. */
async function accountsOf(rpc, addresses, commitment = "confirmed") {
  const map = new Map();
  for (let i = 0; i < addresses.length; i += ACCOUNTS_PER_CALL) {
    const chunk = addresses.slice(i, i + ACCOUNTS_PER_CALL);
    const got = await rpc.getMultipleAccounts(chunk, { commitment });
    if (!Array.isArray(got) || got.length !== chunk.length) throw new R.RewardsError("getMultipleAccounts did not answer for every account");
    chunk.forEach((a, j) => map.set(a, got[j] ?? null));
  }
  return map;
}

/** The wallets with lots or points whose account can never be paid (R.unpayableReason), address → why: read at a close, so they get no share of it. */
async function unpayableOf(rpc, state) {
  const who = [...state.wallets].filter(([, w]) => w.lots.length || w.pts > 0n).map(([a]) => a);
  const accounts = await accountsOf(rpc, who, "finalized");
  const out = new Map();
  for (const a of who) { const why = R.unpayableReason(a, accounts.get(a)); if (why) out.set(a, why); }
  return out;
}

/* ── snapshot ─────────────────────────────────────────────────────────────────────────── */

/**
 * Read one sample of `contract`'s holders: { sample, accounts, frozen } or { problem }. The mint is read
 * before the token accounts (at their slot S or earlier) and again after them (at S or later), so a
 * burn between the reads (a fixed-supply mint's supply only falls) does not skip the hour, while a
 * truncated answer still does (R.supplyProblem); the sample's supply is the accounts' own total, the
 * supply at S. Nothing is logged here (the caller holds every line until the window closes).
 */
export async function readSample({ rpc, contract, state, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  try {
    const info = await rpc.call("getAccountInfo", [contract, { encoding: "base64", commitment: "finalized" }]);
    const gate = R.mintGate({ contract, account: info?.value ?? null, state });
    if (!gate.ok) return { problem: gate.problem, gate };
    const gpa = await rpc.call("getProgramAccounts", [gate.tokenProgram, {
      encoding: "base64", commitment: "finalized", withContext: true,
      filters: [{ memcmp: { offset: 0, bytes: gate.mint } }],
      dataSlice: { offset: R.TOKEN_SLICE.offset, length: R.TOKEN_SLICE.length },
    }]);
    const slot = gpa?.context?.slot;
    if (!Number.isSafeInteger(slot) || !Array.isArray(gpa?.value)) return { problem: "getProgramAccounts did not answer with a slot and a list of token accounts" };
    const firstSlot = info?.context?.slot;
    if (!Number.isSafeInteger(firstSlot) || firstSlot > slot) return { problem: "the mint was read at a later slot than the token accounts (the RPC's nodes disagree): the supply is not bracketed" };
    // The mint at that slot or later (an RPC behind a load balancer may answer from a node not there yet: -32016, asked again).
    const again = await atContextSlot(() => rpc.call("getAccountInfo", [gate.mint, { encoding: "base64", commitment: "finalized", minContextSlot: slot }]), sleep);
    const m = R.mintGate({ contract, account: again?.value ?? null, state });
    if (!m.ok) return { problem: m.problem, gate: m };
    const h = R.holdersFromAccounts(gpa.value, { tokenProgram: m.tokenProgram });
    const sp = R.supplyProblem({ total: h.total, supply: m.supply, supplyBefore: gate.supply, fixedSupply: gate.fixedSupply === true && m.fixedSupply === true });
    if (sp) return { problem: sp };
    let T = null;
    try { const bt = await rpc.call("getBlockTime", [slot]); if (Number.isSafeInteger(bt) && bt > 0) T = bt; } catch { T = null; }
    if (T === null) T = Math.floor(now() / 1000); // the runner's time, whole seconds (the rules skip it unless it is after the last sample's)
    return { sample: { T, slot, mint: m.mint, tokenProgram: m.tokenProgram, decimals: m.decimals, supply: h.total, holders: h.holders }, accounts: h.accounts, frozen: h.frozen };
  } catch (e) {
    return { problem: `the chain could not be read (${String(e?.message ?? e).slice(0, 200)})` };
  }
}

/**
 * SNAPSHOT (no key). Returns { mode, outcome, code, written, closed (the audit record or null) }.
 * outcome: off, no_mint, mint_changed, skipped, invalid_mint, genesis, sampled.
 */
export async function snapshot({ io, env = {}, rpc, fetchImpl = globalThis.fetch, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  random = (n) => Math.floor(Math.random() * n), log = () => {}, scrub = (t) => t }) {
  const mode = R.rewardsMode(env);
  const out = { mode, outcome: "nothing", code: 0, written: false, closed: null };
  if (mode === "off") { log("Rewards: off (REWARDS_ENABLED is neither on nor dry); nothing done."); return { ...out, outcome: "off" }; }
  const cfg = R.rewardsConfig(env);
  for (const n of cfg.notes) log(`::warning title=Rewards::${n}`);
  const { state, ledger } = loadRewards(io);
  const contract = contractOf(io);

  // The owner's new epoch (workflow_dispatch new_epoch=<address>, which must be the contract).
  const newEpoch = String(env.REWARDS_NEW_EPOCH ?? "").trim();
  if (newEpoch) {
    if (!isAddress(newEpoch)) throw new R.RewardsError("new_epoch must be a Solana address");
    if (newEpoch !== contract) throw new R.RewardsError("new_epoch must equal data/socials.json \"contract\"");
    const excluded = exclusionsOf(io);
    const unpayable = state.epoch !== null ? await unpayableOf(rpc, state) : null;
    const closed = R.startNewEpoch(state, ledger, { mint: newEpoch, contract }, cfg, { excluded, unpayable });
    R.setRules(state, cfg);
    if (closed) io.writeText(R.periodPath(closed.k), R.auditText(closed));
    saveRewards(io, state, ledger);
    Object.assign(out, { written: true, closed });
    log(`Rewards: a new epoch for ${newEpoch}: ${closed ? `period ${closed.k} closed at the last sample (${S(closed.pot)} released from the pot, ${S(closed.rows.reduce((s, r) => s + r[2], 0n))} allocated, ${R.periodPath(closed.k)}); ` : ""}every wallet's lots and points cleared, what each is owed kept; the next valid sample starts it.`);
  }

  // No read and no wait without a mint to sample, or with a contract other than the one tracked.
  const quick = R.mintGate({ contract, account: undefined, state });
  if (!isAddress(contract) || quick.changed) {
    log(quick.changed ? `::warning title=Rewards::${quick.problem}` : `::notice title=Rewards::${quick.problem}. Creator fees are still claimed and kept for the holders.`);
    return { ...out, outcome: quick.changed ? "mint_changed" : "no_mint" };
  }

  // The hidden moment: one random wait, one read (retried once), silence until the window closes.
  const start = now();
  const D = random(R.SAMPLE_WINDOW);
  if (!Number.isSafeInteger(D) || D < 0 || D >= R.SAMPLE_WINDOW) throw new R.RewardsError("the random moment is not a whole number of seconds in the window");
  log(WINDOW_LINE);
  await sleep(D * 1000);
  let read = await readSample({ rpc, contract, state, now, sleep });
  if (read.problem && !read.gate) read = await readSample({ rpc, contract, state, now, sleep });
  const rest = start + R.SAMPLE_WINDOW * 1000 - now();
  if (rest > 0) await sleep(rest);

  if (read.problem) {
    const changed = read.gate?.changed === true;
    log(`${read.gate ? (changed ? "::warning" : "::notice") : "::warning"} title=Rewards::no sample this hour: ${scrub(read.problem)}${read.gate ? "" : " (a missed sample: at most two hours are credited across a gap)"}.`);
    return { ...out, outcome: changed ? "mint_changed" : read.gate ? "invalid_mint" : "skipped" };
  }
  const excluded = exclusionsOf(io); // fail closed: an exclusion file that does not parse throws, and no sample is used
  const { sample } = read;
  // The pot's worth: the unallocated holders' SOL (E − A) at SOL's price on DexScreener (wrapped SOL's pairs). Worth
  // REWARDS_CLOSE_USD or more, the period closes at this sample. No price: no such close this hour (the period's end still closes it).
  let potClose = null;
  const U = ledger.E - ledger.A;
  if (state.epoch !== null && sample.T > state.tPrev && sample.T < state.periodEnd && cfg.closeUsd > 0 && U > 0n) {
    try {
      const solUsd = await dexScreenerPriceUsd(WRAPPED_SOL_MINT, fetchImpl);
      const usd = (Number(U) / 1e9) * solUsd;
      if (usd >= cfg.closeUsd) potClose = { usd, solUsd };
      else log(`Rewards: the unallocated holder pot (${S(U)}) is worth about $${usd.toFixed(2)} at $${solUsd.toFixed(2)} a SOL; the period closes early once it is worth $${cfg.closeUsd}.`);
    } catch (e) {
      log(`::notice title=Rewards::SOL's price could not be read (${scrub(String(e?.message ?? e)).slice(0, 120)}): whether the pot is worth $${cfg.closeUsd} is checked again next hour.`);
    }
  }
  // A close is due at this sample: the accounts of the wallets with points are read (after the window: they say nothing about its moment).
  let unpayable = null;
  if (state.epoch !== null && (sample.T >= state.periodEnd || potClose) && sample.T > state.tPrev) {
    try { unpayable = await unpayableOf(rpc, state); } catch (e) {
      log(`::warning title=Rewards::no sample this hour: the period closes at this sample and the accounts of the wallets with points could not be read (${scrub(String(e?.message ?? e)).slice(0, 160)}); the close waits for the next hour.`);
      return { ...out, outcome: "skipped" };
    }
  }
  const res = R.applySample(state, ledger, sample, cfg, { excluded, unpayable, closeNow: potClose !== null });
  if (res.status === "skipped") {
    log(`::warning title=Rewards::no sample this hour: ${res.reason}.`);
    return { ...out, outcome: "skipped" };
  }
  R.setRules(state, cfg);
  if (res.closed) io.writeText(R.periodPath(res.closed.k), R.auditText(res.closed));
  saveRewards(io, state, ledger);
  Object.assign(out, { written: true, closed: res.closed ?? out.closed });
  let counted = 0, held = 0n;
  for (const w of state.wallets.values()) if (w.lots.length) { counted++; for (const l of w.lots) held += l[0]; }
  log(`Rewards: ${res.status === "genesis" ? "the first sample (genesis: every counted balance starts at age 0)" : "sampled"} at slot ${sample.slot} (block time ${ISO_SECONDS(sample.T * 1000)}): `
    + `${read.accounts} token accounts, ${counted} wallets counted at or over ${res.minBalance} raw units, holding ${held} of the supply ${sample.supply}; `
    + `${res.changed} wallet(s) changed; period ${state.period} ends ${ISO_SECONDS(state.periodEnd * 1000)}.`);
  if (res.excludedNow.length) log(`Rewards: ${res.excludedNow.length} wallet(s) excluded from now on (their points and lots cleared; what they are owed is still paid).`);
  if (res.closed) {
    const c = res.closed;
    const total = c.rows.reduce((s, r) => s + r[2], 0n);
    const why = c.trigger === "pot" && potClose ? ` early (the pot is worth about $${potClose.usd.toFixed(2)} at $${potClose.solUsd.toFixed(2)} a SOL, $${cfg.closeUsd} or more)` : "";
    log(`Rewards: period ${c.k} closed${why}: ${S(c.pot)} released (${c.releasePct}% of the unallocated ${S(c.E - c.A_before)}), ${S(total)} of it split by points over ${c.rows.length} wallet(s), at most ${S(c.capAmt)} each (the rest stays in the pot); published in ${R.periodPath(c.k)}.`);
    if (c.refused.length) log(`::notice title=Rewards::${c.refused.length} owner(s) with points can never be paid (${[...new Set(c.refused.map((r) => r[2]))].join("; ")}): no share for them, listed in ${R.periodPath(c.k)}.`);
  }
  return { ...out, outcome: res.status };
}

/* ── settling what was sent ───────────────────────────────────────────────────────────── */

/**
 * Whether a transaction sent with `lastValidBlockHeight` can be declared never landed: the finalized
 * block height is EXPIRY_MARGIN blocks past it, and asked again AFTER that height was read, neither its
 * status nor the transaction itself is known (a node behind the one that answered the height may not
 * have its block yet). Returns { never, slot (the finalized slot then: any landing was before it) }.
 */
async function neverLanded(rpc, sig, lastValidBlockHeight) {
  const height = await rpc.getBlockHeight({ commitment: "finalized" });
  if (!Number.isSafeInteger(height) || height <= lastValidBlockHeight + EXPIRY_MARGIN) return { never: false };
  let slot = null;
  try { const s = await rpc.call("getSlot", [{ commitment: "finalized" }]); if (Number.isSafeInteger(s) && s >= 0) slot = s; } catch { slot = null; }
  if ((await rpc.getSignatureStatuses([sig]))?.[0]) return { never: false };
  if (await rpc.getTransaction(sig)) return { never: false };
  return { never: true, slot };
}

/** Settle a claim row still sending: finalized → measured and "landed" (net may be negative: a claim that failed on chain cost its fee); never landed (neverLanded) → "expired". */
async function settleClaimRow(L, row, { rpc, wallet, now, log }) {
  const st = (await rpc.getSignatureStatuses([row.sig]))?.[0] ?? null;
  if (st) {
    if (st.confirmationStatus !== "finalized") return { changed: false, pending: true };
    const tx = await rpc.getTransaction(row.sig);
    if (!tx) return { changed: false, pending: true };
    if (tx.transaction?.signatures?.[0] !== row.sig) throw new R.RewardsError(`the RPC answered for another transaction than the claim ${row.sig.slice(0, 12)}…`);
    const m = measureClaim(tx, { wallet });
    const forHolders = R.settleClaim(L, row.sig, { status: "landed", claimed: m.claimed, walletFee: m.walletFee, net: m.net }, { settledAt: ISO_SECONDS(now()) });
    log(`Rewards: the claim ${row.sig.slice(0, 12)}… ${m.failed ? "failed on chain (its fee comes off the pot)" : `brought in ${S(m.claimed)}`}; fee ${S(m.walletFee)}; ${S(forHolders)} for the holders (${row.sharePct}%).`);
    if (m.wsolAfter !== null && m.wsolAfter > 0n) log(`::warning title=Rewards::${S(m.wsolAfter)} of WSOL sits wrapped in the wallet's token account after the claim ${row.sig.slice(0, 12)}…; it counts as claimed, and is SOL again once a "wsol" claim closes that account.`);
    return { changed: true };
  }
  if ((await neverLanded(rpc, row.sig, row.lastValidBlockHeight)).never) {
    R.settleClaim(L, row.sig, { status: "expired" }, { settledAt: ISO_SECONDS(now()) });
    log(`Rewards: the claim ${row.sig.slice(0, 12)}… never landed and its blockhash expired: nothing was claimed.`);
    return { changed: true };
  }
  return { changed: false, pending: true };
}

/** Why a landed, successful payout transaction did not move exactly its row's nets to its wallets, or null. */
function payoutMoveProblem(tx, row) {
  const keys = tx.transaction?.message?.accountKeys ?? [];
  for (const [owner, net] of row.rows) {
    const i = keys.indexOf(owner);
    const d = i < 0 ? null : BigInt(tx.meta.postBalances[i]) - BigInt(tx.meta.preBalances[i]);
    if (d !== net) return `the payout ${row.sig.slice(0, 12)}… moved ${d} lamports to ${owner}, not the ${net} its row says: a person must look`;
  }
  return null;
}

/**
 * Settle a payout row still sending: finalized → "paid" (each recipient's change checked against the
 * row) or "failed" (landed, failed: its fee is spent, the rest owed again); never landed (neverLanded)
 * → "expired" (all owed again), its wallets held until the wallet's history is counted past it (or
 * EXPIRED_HOLD_MS), so a payout that did land after all is found before they are paid again.
 */
async function settlePayoutRow(state, L, row, { rpc, now, log }) {
  const st = (await rpc.getSignatureStatuses([row.sig]))?.[0] ?? null;
  if (st) {
    if (st.confirmationStatus !== "finalized") return { changed: false, pending: true };
    const tx = await rpc.getTransaction(row.sig);
    if (!tx) return { changed: false, pending: true };
    if (tx.transaction?.signatures?.[0] !== row.sig) throw new R.RewardsError(`the RPC answered for another transaction than the payout ${row.sig.slice(0, 12)}…`);
    const failed = !!(st.err || tx.meta?.err);
    if (!failed) { const p = payoutMoveProblem(tx, row); if (p) throw new R.RewardsError(p); }
    R.settlePayout(state, L, row.sig, failed ? "failed" : "paid", { settledAt: ISO_SECONDS(now()) });
    const net = row.rows.reduce((s, r) => s + r[1], 0n);
    log(failed ? `::warning title=Rewards::the payout ${row.sig.slice(0, 12)}… failed on chain (${errText(st.err ?? tx.meta.err)}): its fee ${S(row.fee)} is spent; its ${row.rows.length} wallet(s) are owed again.`
      : `Rewards: the payout ${row.sig.slice(0, 12)}… is final: ${S(net)} to ${row.rows.length} wallet(s), fee ${S(row.fee)}.`);
    return { changed: true, outcome: failed ? "failed" : "paid" };
  }
  const nl = await neverLanded(rpc, row.sig, row.lastValidBlockHeight);
  if (nl.never) {
    R.settlePayout(state, L, row.sig, "expired", { settledAt: ISO_SECONDS(now()) });
    R.holdWallets(state, row.rows.map((r) => r[0]), { until: ISO_SECONDS(now() + EXPIRED_HOLD_MS), slot: nl.slot,
      reason: `the payout ${row.sig.slice(0, 12)}… expired; it is sent again once the wallet's history is counted past it` });
    log(`Rewards: the payout ${row.sig.slice(0, 12)}… never landed and its blockhash expired: its ${row.rows.length} wallet(s) are owed again, and paid once the wallet's history is counted past it.`);
    return { changed: true, outcome: "expired" };
  }
  return { changed: false, pending: true };
}

/** Every row still sending, settled when it can be. Returns { changed, payoutPending, claimPending }. */
async function settleAll(state, L, ctx) {
  let changed = false, payoutPending = false, claimPending = false;
  for (const row of L.claims.filter((r) => r.status === "sending")) {
    const s = await settleClaimRow(L, row, ctx);
    if (s.changed) changed = true; else claimPending = true;
  }
  for (const row of L.payouts.filter((r) => r.status === "sending")) {
    const s = await settlePayoutRow(state, L, row, ctx);
    if (s.changed) changed = true; else payoutPending = true;
  }
  return { changed, payoutPending, claimPending };
}

/** Poll `settle` (a settle*Row call) every `pollMs` until it settles or `waitMs` has passed. */
async function confirm(settle, { now, sleep, waitMs, pollMs }) {
  const deadline = now() + waitMs;
  for (;;) {
    await sleep(pollMs);
    const s = await settle();
    if (s.changed || now() + pollMs > deadline) return s;
  }
}

/* ── counting the wallet's transactions since the cursor ──────────────────────────────── */

/**
 * The payout a transaction is, when it has exactly the shape the payout builder makes for `wallet`
 * (rewards.mjs payoutInstructions: SetComputeUnitLimit(CU_LIMIT(k)), SetComputeUnitPrice, then k
 * SystemProgram transfers from the wallet to distinct recipients, one signer, the fee FEE(k)):
 * { rows: [{ owner, lamports, share }], fee, failed }, the shares as planPayouts splits the fee. Else null.
 */
export function payoutOf(tx, wallet) {
  const msg = tx?.transaction?.message;
  if (!msg || !Array.isArray(msg.accountKeys) || !Array.isArray(msg.instructions)) return null;
  if (tx.meta?.loadedAddresses && ((tx.meta.loadedAddresses.writable ?? []).length || (tx.meta.loadedAddresses.readonly ?? []).length)) return null;
  const keys = msg.accountKeys;
  if (keys[0] !== wallet || msg.header?.numRequiredSignatures !== 1) return null;
  const k = msg.instructions.length - 2;
  if (k < 1 || k > R.PER_TX) return null;
  const ixs = msg.instructions.map((ix) => ({ programId: keys[ix.programIdIndex], accounts: (ix.accounts ?? []).map((i) => keys[i]), data: Buffer.from(base58Decode(ix.data ?? "", 2000) ?? []) }));
  const [lim, price, ...transfers] = ixs;
  if (lim.programId !== COMPUTE_BUDGET_PROGRAM || lim.accounts.length || lim.data.length !== 5 || lim.data[0] !== 2 || lim.data.readUInt32LE(1) !== R.cuLimit(k)) return null;
  if (price.programId !== COMPUTE_BUDGET_PROGRAM || price.accounts.length || price.data.length !== 9 || price.data[0] !== 3) return null;
  const fee = R.payoutFee(k, price.data.readBigUInt64LE(1));
  if (!Number.isSafeInteger(tx.meta?.fee) || BigInt(tx.meta.fee) !== fee) return null;
  const kb = BigInt(k), seen = new Set();
  const rows = [];
  for (const [j, t] of transfers.entries()) {
    if (t.programId !== SYSTEM_PROGRAM || t.accounts.length !== 2 || t.accounts[0] !== wallet || t.data.length !== 12 || t.data.readUInt32LE(0) !== 2) return null;
    const to = t.accounts[1];
    if (to === wallet || seen.has(to)) return null;
    seen.add(to);
    const lamports = t.data.readBigUInt64LE(4);
    if (lamports === 0n) return null;
    rows.push({ owner: to, lamports, share: fee / kb + (BigInt(j) < fee % kb ? 1n : 0n) });
  }
  return { rows, fee, failed: tx.meta.err !== null && tx.meta.err !== undefined };
}

/**
 * Classify one wallet transaction newer than the cursor (getSignaturesForAddress's entry `s`) and record
 * what it did. Returns null (counted), a problem (the count stops before it, and a person must look) or
 * { wait } (a row of the ledger's still sending that is not final yet: the count stops before it, and
 * goes on next run).
 */
async function classify(state, L, s, { rpc, wallet, cfg, now, log }) {
  const sig = s.signature;
  const kind = R.classifySignature(L, sig);
  const settledAt = ISO_SECONDS(now());
  const notYet = `the RPC did not give the wallet's transaction ${sig.slice(0, 12)}… yet; counted next run`;
  const final = s.confirmationStatus === undefined || s.confirmationStatus === null || s.confirmationStatus === "finalized";
  if (kind === "payout") {
    const row = L.payouts.find((r) => r.sig === sig);
    if (row.status === "sending") {
      // Still sending in the ledger, but the history lists it: settled now from its transaction, so the cursor never passes a row
      // that a later, wrong "expired" could owe again.
      if (!final) return { wait: `the payout ${sig.slice(0, 12)}… is not final yet` };
      const tx = await rpc.getTransaction(sig);
      if (!tx) return notYet;
      const failed = !!(s.err || tx.meta?.err);
      const moved = failed ? null : payoutMoveProblem(tx, row);
      if (moved) return moved;
      R.settlePayout(state, L, sig, failed ? "failed" : "paid", { settledAt });
      log(`Rewards: the payout ${sig.slice(0, 12)}… is on chain: settled as ${failed ? "failed (its fee spent, its wallets owed the rest)" : "paid"}.`);
      return null;
    }
    if (row.status !== "expired") return null;
    // Settled as expired (its wallets owed again), but it is on chain: settled now as what it did.
    const tx = await rpc.getTransaction(sig);
    if (!tx) return notYet;
    const failed = !!(s.err || tx.meta?.err);
    const moved = failed ? null : payoutMoveProblem(tx, row);
    if (moved) return moved;
    const p = R.landExpiredPayout(state, L, sig, failed ? "failed" : "paid", { settledAt });
    if (p) return `the payout ${sig} was settled as expired (its wallets owed again) but it is on chain, and ${p}: payouts are paused until a person looks`;
    log(`::warning title=Rewards::the payout ${sig.slice(0, 12)}… was settled as expired but it is on chain: recorded as ${failed ? "failed (its fee spent, its wallets owed the rest)" : "paid"}; it is never paid twice.`);
    return null;
  }
  if (kind === "claim") {
    const row = L.claims.find((r) => r.sig === sig);
    if (row.status === "sending") {
      // Still sending in the ledger, but the history lists it: measured and settled now from its own transaction.
      if (!final) return { wait: `the claim ${sig.slice(0, 12)}… is not final yet` };
      const tx = await rpc.getTransaction(sig);
      if (!tx) return notYet;
      const m = measureClaim(tx, { wallet });
      const forHolders = R.settleClaim(L, sig, { status: "landed", claimed: m.claimed, walletFee: m.walletFee, net: m.net }, { settledAt });
      log(`Rewards: the claim ${sig.slice(0, 12)}… is on chain: ${m.failed ? "it failed (its fee comes off the pot)" : `it brought in ${S(m.claimed)}`}, ${S(forHolders)} for the holders (${row.sharePct}%).`);
      return null;
    }
    if (row.status !== "expired") return null;
    // Settled as expired, but it is on chain: measured and counted after all (a failed one cost its fee).
    const tx = await rpc.getTransaction(sig);
    if (!tx) return notYet;
    let m = null;
    try { m = measureClaim(tx, { wallet }); } catch (e) { log(`::warning title=Rewards::the claim ${sig.slice(0, 12)}… was settled as expired but is on chain, and it could not be measured (${e.message.slice(0, 120)}); a person may look.`); }
    if (m) {
      const forHolders = R.landExpiredClaim(L, sig, m, { settledAt });
      log(`::warning title=Rewards::the claim ${sig.slice(0, 12)}… was settled as expired but it is on chain: ${m.failed ? "it failed (its fee comes off the pot)" : `${S(m.claimed)} counted after all`}, ${S(forHolders)} for the holders (${row.sharePct}%).`);
    }
    return null;
  }
  // Not in the ledger: a failed one is read too (a lost payout that failed on chain still spent its fee).
  const tx = await rpc.getTransaction(sig);
  if (!tx) return notYet;
  let m = null;
  try { m = measureClaim(tx, { wallet }); } catch (e) { log(`::warning title=Rewards::the wallet's transaction ${sig.slice(0, 12)}… could not be read as a claim (${e.message.slice(0, 120)}); it is not counted.`); }
  const sentAt = Number.isSafeInteger(tx.blockTime) ? ISO_SECONDS(tx.blockTime * 1000) : settledAt;
  const lost = m && m.claimed === 0n ? payoutOf(tx, wallet) : null;
  if (m && m.claimed > 0n) {
    R.recordClaimSending(L, { sig, lastValidBlockHeight: 0, sharePct: cfg.holderSharePct, sentAt });
    const forHolders = R.settleClaim(L, sig, { status: "landed", claimed: m.claimed, walletFee: m.walletFee, net: m.net }, { settledAt });
    log(`::notice title=Rewards::a claim the ledger did not list (${sig.slice(0, 12)}…, paid by ${m.feePayer === wallet ? "the wallet" : m.feePayer}) brought in ${S(m.claimed)}: counted, ${S(forHolders)} for the holders (${cfg.holderSharePct}%).`);
  } else if (lost) {
    const covered = lost.rows.every((r) => (state.wallets.get(r.owner)?.owed ?? -1n) >= r.lamports + r.share);
    const i1 = R.i1Problem(L, lost.rows.reduce((a, r) => a + r.lamports + r.share, 0n));
    if (!covered || i1) {
      return `the wallet's transaction ${sig} is shaped exactly like a payout but the ledger does not list it and ${!covered ? "its recipients are not owed that much" : i1}: payouts are paused until a person looks (once it is known not to be a payout of the holders', setting ${R.REWARDS_FILES.ledger} "cursor" to its signature skips it; never set the cursor past a transaction the count has not classified yet)`;
    }
    R.recordPayoutSending(state, L, { rows: lost.rows, fee: lost.fee }, { sig, lastValidBlockHeight: 0, sentAt });
    R.settlePayout(state, L, sig, lost.failed ? "failed" : "paid", { settledAt });
    log(`::warning title=Rewards::a payout the ledger had lost (${sig.slice(0, 12)}…, ${lost.rows.length} wallet(s)) was found on chain and recorded as ${lost.failed ? "failed" : "paid"}: it is never paid twice.`);
  }
  return null;
}

/**
 * Classify every wallet transaction newer than the cursor, oldest first, and move the cursor on (see
 * the header, step 2). With no cursor yet, the cursor is set to the wallet's newest transaction and
 * nothing earlier counts. The signatures are listed back to the cursor first (MAX_SIGNATURE_PAGES), then
 * read and classified one by one; the progress is saved every COUNT_CHUNK, and after COUNT_MS the count
 * stops where it is (behind: the next run goes on from there). Returns { changed, problem, behind, left,
 * started }: a problem stops at that transaction (the cursor stays before it) and pauses the payouts, as
 * does being behind.
 */
async function countSince(state, L, ctx) {
  const { rpc, wallet, now, log, io, countMs = COUNT_MS } = ctx;
  if (L.cursor === null) {
    const newest = await rpc.getSignaturesForAddress(wallet, { limit: 1 });
    if (!Array.isArray(newest)) throw new R.RewardsError("getSignaturesForAddress did not answer with a list");
    if (!newest.length) return { changed: false, problem: null, behind: false, started: false };
    R.advanceCursor(L, newest[0].signature);
    log(`Rewards: the ledger counts the wallet's transactions from ${newest[0].signature.slice(0, 12)}… on (nothing earlier is a claim for the holders); claims and payouts start next run, once this is committed.`);
    return { changed: true, problem: null, behind: false, started: true };
  }
  const list = [];
  let before;
  for (let page = 0; ; page++) {
    if (page >= MAX_SIGNATURE_PAGES) {
      return { changed: false, behind: true, problem: `more than ${MAX_SIGNATURE_PAGES * 1000} wallet transactions since the ledger's cursor: they cannot be listed back to it in one run. A person must look; never move "cursor" in ${R.REWARDS_FILES.ledger} past a transaction the count has not classified (a lost payout among them would be paid twice)` };
    }
    const got = await rpc.getSignaturesForAddress(wallet, { until: L.cursor, before, limit: 1000 });
    if (!Array.isArray(got)) throw new R.RewardsError("getSignaturesForAddress did not answer with a list");
    list.push(...got);
    if (got.length < 1000) break;
    before = got[got.length - 1].signature;
  }
  list.reverse();
  const started = now();
  let changed = false, done = 0;
  let slotHolds = [...state.wallets.values()].some((w) => w.hold && w.hold.slot !== null);
  for (const s of list) {
    if (done > 0 && done % COUNT_CHUNK === 0) {
      saveRewards(io, state, L);                              // lasting progress: a timeout loses at most one chunk
      if (now() - started > countMs) {
        log(`Rewards: ${done} of the wallet's ${list.length} transactions since the cursor counted this run; the other ${list.length - done} next run, from where this one stopped.`);
        return { changed, problem: null, behind: true, left: list.length - done };
      }
    }
    const problem = await classify(state, L, s, ctx);
    if (problem?.wait) {
      log(`Rewards: ${problem.wait}: the count stops before it and goes on from there next run.`);
      return { changed, problem: null, behind: true, left: list.length - done };
    }
    if (problem) return { changed, problem, behind: true, left: list.length - done };
    R.advanceCursor(L, s.signature);
    const released = slotHolds ? R.releaseHolds(state, s.slot) : 0;
    if (released) {
      log(`Rewards: the wallet's history is counted past ${released} expired payout(s)' wallets: they are paid again from now on.`);
      slotHolds = [...state.wallets.values()].some((w) => w.hold && w.hold.slot !== null);
    }
    changed = true; done++;
  }
  return { changed, problem: null, behind: false, left: 0 };
}

/* ── the claim ────────────────────────────────────────────────────────────────────────── */

async function claimOnce(ctx) {
  const { mode, cfg, L, state, rpc, keypair, walletsFile, io, now, sleep, log, scrub, confirmWaitMs, confirmPollMs } = ctx;
  const wallet = keypair.publicKey, dry = mode === "dry" ? "(dry run) " : "";
  if (L.claims.some((r) => r.status === "sending")) { log("Rewards: a claim sent earlier is not settled yet; no new claim this run."); return { outcome: "pending" }; }
  const cs = await readClaimState(rpc, { wallet });
  const minLamports = cfg.minClaimLamports > MIN_CLAIM_LAMPORTS ? cfg.minClaimLamports : MIN_CLAIM_LAMPORTS;
  let plan = claimPlan(cs, { minLamports });
  // PumpSwap fees someone else claimed into the wallet's own WSOL account count as claimed but are no SOL the
  // payouts can spend (I2 reads the native balance) until that account is closed: the "wsol" route unwraps them.
  // What waits there is the account's token amount (a real WSOL account of the wallet's), never its lamports less today's rent.
  const wrapped = cs.walletWsolAmount ?? 0n;
  if (wrapped > 0n && cs.ammVaultExists && wrapped + cs.total >= minLamports) {
    plan = { curve: cs.curveClaimable > 0n, amm: "wsol", createWsolAta: false };
    log(`Rewards: ${S(wrapped)} of WSOL sits wrapped in the wallet's WSOL account: the claim takes the "wsol" route, which unwraps it.`);
  }
  if (!plan) { log(`Rewards: ${S(cs.total)} of creator fees waits to be claimed, under REWARDS_MIN_CLAIM_SOL (${S(minLamports)}); no claim this run.`); return { outcome: "under_minimum" }; }
  const bh = await rpc.getLatestBlockhash();
  if (!bh?.blockhash || !Number.isSafeInteger(bh.lastValidBlockHeight)) throw new R.RewardsError("the RPC gave no blockhash");
  const built = buildClaimTransaction({ wallet, recentBlockhash: bh.blockhash, ...plan });
  const unsigned = unsignedClaimTransaction(built);
  const before = await rpc.getBalance(wallet);
  const sim = await rpc.simulateTransaction(unsigned, { addresses: [wallet] });
  const after = sim?.accounts?.[0]?.lamports;
  const simProblem = !sim ? "no answer" : sim.err !== null ? errText(sim.err) : !Number.isSafeInteger(after) || !Number.isSafeInteger(before) ? "no balance around it" : null;
  if (simProblem) { log(`::warning title=Rewards::${dry}the claim's simulation did not pass (${simProblem}); nothing was sent.`); return { outcome: "simulation_failed" }; }
  const gain = BigInt(after) - BigInt(before);
  if (gain <= 0n) { log(`Rewards: ${dry}the claim would bring in nothing after its fee (${S(gain)}); nothing was sent.`); return { outcome: "nothing_to_claim" }; }
  const vaults = [plan.curve ? "the bonding-curve vault" : null, plan.amm ? `PumpSwap's, route ${plan.amm}` : null].filter(Boolean).join(" and ");
  const what = `${S(cs.total)} waiting (${vaults}), the wallet +${S(gain)} after the fee in simulation`;
  if (mode === "dry") { log(`Rewards (dry run): a claim of ${what} simulates cleanly. Nothing was signed or sent.`); return { outcome: "dry" }; }
  const late = walletProblem(wallet, walletsFile, now());
  if (late) { log(`::error title=Rewards::${late} now. Nothing was sent.`); return { outcome: "wallet_not_listed", code: 1 }; }

  // Signed only now, the very message simulated; written "sending" (the holder share fixed now) BEFORE it goes out.
  const signed = signClaimTransaction(built, keypair);
  if (messageOf(signed) !== messageOf(unsigned)) throw new R.RewardsError("the signed claim is not the transaction that was simulated; nothing was sent");
  const sig = signatureOf(signed);
  const row = R.recordClaimSending(L, { sig, lastValidBlockHeight: bh.lastValidBlockHeight, sharePct: cfg.holderSharePct, sentAt: ISO_SECONDS(now()) });
  saveRewards(io, state, L);
  try {
    const got = await rpc.sendTransaction(signed);
    if (got !== sig) log(`::warning title=Rewards::the RPC named the claim ${String(got).slice(0, 12)}…, not ${sig.slice(0, 12)}…`);
  } catch (e) {
    const why = scrub(String(e?.message ?? e)).slice(0, 200);
    if (isRefusal(e)) {
      R.settleClaim(L, sig, { status: "expired" }, { settledAt: ISO_SECONDS(now()) });
      saveRewards(io, state, L);
      log(`::warning title=Rewards::the RPC refused the claim (${why}); nothing went out.`);
      return { outcome: "refused" };
    }
    log(`::warning title=Rewards::no clear answer from the RPC for the claim (${why}); its row stays "sending" and is settled by its signature later.`);
    return { outcome: "sending", code: 1 };
  }
  log(`Rewards: sent a creator-fee claim: https://solscan.io/tx/${sig} (${what}).`);
  const s = await confirm(() => settleClaimRow(L, row, { rpc, wallet, now, log }), { now, sleep, waitMs: confirmWaitMs, pollMs: confirmPollMs });
  if (s.changed) { saveRewards(io, state, L); return { outcome: row.status }; }
  log("Rewards: the claim is not final yet; a later run settles it.");
  return { outcome: "sending" };
}

/* ── the payouts ──────────────────────────────────────────────────────────────────────── */

const lamportsOf = (acct) => (acct && Number.isSafeInteger(acct.lamports) ? BigInt(acct.lamports) : acct ? null : 0n);

async function payOut(ctx) {
  const { mode, cfg, caps, L, state, rpc, keypair, walletsFile, io, now, sleep, log, scrub, confirmWaitMs, confirmPollMs, runMs } = ctx;
  const startedAt = now();                                    // the payouts' own time: the count before them had its own
  const wallet = keypair.publicKey, dry = mode === "dry" ? "(dry run) " : "";
  const out = { outcome: "nothing", code: 0, paid: 0n, batches: 0 };
  const owedList = [...state.wallets].filter(([, w]) => w.owed > 0n).map(([a]) => a);
  if (state.epoch === null && state.period === 0 && !owedList.length) {
    log("::notice title=Rewards::no $CATSANC mint has been sampled yet (data/socials.json \"contract\"): nothing is owed, nothing is paid.");
    return { ...out, outcome: "no_mint" };
  }
  if (!owedList.length) { log("Rewards: no wallet is owed anything; no payouts."); return out; }
  let rent = null;
  try { const r = await rpc.call("getMinimumBalanceForRentExemption", [0]); if (Number.isSafeInteger(r) && r >= 0) rent = BigInt(r); } catch { rent = null; }
  if (rent === null) { log("::warning title=Rewards::the rent-exempt minimum could not be read: no payouts this run."); return { ...out, outcome: "no_rent" }; }
  const minBalanceLamports = BigInt(caps.minBalanceLamports);
  const balance0 = await rpc.getBalance(wallet);
  if (!Number.isSafeInteger(balance0)) throw new R.RewardsError("the RPC gave no balance for the wallet");
  const i2 = R.i2Problem(L, { balance: BigInt(balance0), minBalanceLamports });
  if (i2) { log(`::warning title=Rewards::${i2}. No payouts until the wallet holds the holders' SOL again; a person must look.`); return { ...out, outcome: "i2", code: 1 }; }
  const accounts = await accountsOf(rpc, owedList.filter((a) => !R.RESERVED_ACCOUNT_KEYS.has(a)));
  const pot = R.payoutBudget(L, { maxLamportsPerRun: cfg.maxLamportsPerRun, spentThisRun: 0n });
  const price = cfg.priorityMicroLamports;
  const plan = R.planPayouts(state, { pot, accounts, rent, priceMicroLamports: price, minPayoutLamports: cfg.minPayoutLamports, maxTx: cfg.maxTxPerRun, payer: wallet, nowMs: now() });
  const reasons = new Map();
  for (const c of plan.carry) { const why = c.reason.replace(/^held until \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/, "held"); reasons.set(why, (reasons.get(why) ?? 0) + 1); }
  log(`Rewards: ${owedList.length} wallet(s) owed; ${plan.payouts.length} due now in ${plan.batches.length} transaction(s), ${S(plan.spend)} with fees (this run may spend ${S(pot)}: the holders' unpaid ${S(R.holdersUnpaid(L))}, REWARDS_MAX_SOL_PER_RUN ${S(cfg.maxLamportsPerRun)}); `
    + `${plan.carry.length} carried to a later run (${S(plan.carried)})${reasons.size ? `: ${[...reasons].map(([r, n]) => `${n} ${r}`).join("; ")}` : ""}.`);
  let spent = 0n;
  const labelOf = (n, batch) => `payout ${n + 1} of ${plan.batches.length} (${batch.rows.length} wallet(s), ${S(batch.debit - batch.fee)} + fee ${S(batch.fee)})`;

  /**
   * Gates 1 to 7 for one batch: { built, unsigned, bh } when it may be signed, else { problem, code }
   * (simFailed: the simulation itself failed, which may be one recipient's doing).
   */
  const gate = async (batch) => {
    const bh = await rpc.getLatestBlockhash();
    if (!bh?.blockhash || !Number.isSafeInteger(bh.lastValidBlockHeight)) throw new R.RewardsError("the RPC gave no blockhash");
    // Gates 1 and 2: the message, from its bytes (only the budget and these transfers from the wallet), and its size.
    const built = R.buildPayoutMessage({ payer: wallet, recentBlockhash: bh.blockhash, rows: batch.rows, priceMicroLamports: price });
    if (built.fee !== batch.fee) throw new R.RewardsError("the payout's fee is not the plan's (a bug; refused)");
    // Gate 3, I1 (in dry mode the batches before this one were not recorded, so they are added here).
    const i1 = R.i1Problem(L, batch.debit + (mode === "dry" ? spent : 0n));
    if (i1) return { problem: i1, code: 1 };
    // Gate 6, the run caps.
    if (spent + batch.debit > cfg.maxLamportsPerRun) return { problem: `it would take the run past REWARDS_MAX_SOL_PER_RUN (${S(cfg.maxLamportsPerRun)})`, code: 0 };
    // Gate 4, I2, on the live balance, read with its slot; gate 5, the unsigned copy simulated at that slot or later.
    const addrs = [wallet, ...batch.rows.map((r) => r.owner)];
    const got = await rpc.call("getMultipleAccounts", [addrs, { encoding: "base64", commitment: "confirmed" }]);
    const beforeAccts = got?.value, slot = got?.context?.slot;
    if (!Array.isArray(beforeAccts) || beforeAccts.length !== addrs.length) throw new R.RewardsError("getMultipleAccounts did not answer for the payout's accounts");
    const balance = lamportsOf(beforeAccts[0]);
    if (balance === null) throw new R.RewardsError("the wallet's balance could not be read");
    const i2now = R.i2Problem(L, { balance, minBalanceLamports });
    if (i2now) { log(`::warning title=Rewards::${i2now}.`); return { problem: "I2 refused it", code: 1 }; }
    const unsigned = b64(serializeTransaction(built.messageBytes, [new Uint8Array(64)]));
    const sim = await atContextSlot(() => rpc.simulateTransaction(unsigned, { addresses: addrs, ...(Number.isSafeInteger(slot) ? { minContextSlot: slot } : {}) }), sleep);
    if (!sim || sim.err !== null || !Array.isArray(sim.accounts) || sim.accounts.length !== addrs.length) {
      return { simFailed: true, problem: `the simulation did not pass (${!sim ? "no answer" : sim.err !== null ? errText(sim.err) : "no accounts after it"})`, code: 1 };
    }
    const before = new Map(), after = new Map();
    addrs.forEach((a, i) => { const x = lamportsOf(beforeAccts[i]), y = lamportsOf(sim.accounts[i]); if (x !== null) before.set(a, x); if (y !== null) after.set(a, y); });
    const simProblem = R.simulationProblem({ payer: wallet, rows: batch.rows, fee: batch.fee, before, after, rent });
    if (simProblem) return { problem: simProblem, code: 1 };
    // Gate 7, the wallet still an active launcher.
    const late = walletProblem(wallet, walletsFile, now());
    if (late) { log(`::error title=Rewards::${late} now.`); return { problem: "the wallet is not an active launcher", code: 1 }; }
    return { built, unsigned, bh, problem: null };
  };

  /** Each wallet of a batch whose simulation failed, simulated alone: { bad: Map owner → its own error, unsure (a simulation gave no answer) }. */
  const isolate = async (batch) => {
    const bad = new Map();
    let unsure = false;
    const bh = await rpc.getLatestBlockhash();
    if (!bh?.blockhash) return { bad, unsure: true };
    for (const p of batch.picks) {
      const one = R.payoutBatch([p], { priceMicroLamports: price, rent });
      const m = R.buildPayoutMessage({ payer: wallet, recentBlockhash: bh.blockhash, rows: one.rows, priceMicroLamports: price });
      const sim = await rpc.simulateTransaction(b64(serializeTransaction(m.messageBytes, [new Uint8Array(64)])), { addresses: [] });
      if (!sim) unsure = true;
      else if (sim.err !== null) bad.set(p.owner, errText(sim.err));
    }
    return { bad, unsure };
  };

  for (const [n, planned] of plan.batches.entries()) {
    if (now() - startedAt > runMs) { log("Rewards: the run's time is up; the other payouts go out next run."); break; }
    if (out.batches >= cfg.maxTxPerRun) break;
    let batch = planned;
    const stop = (why, extra = {}) => { log(`::warning title=Rewards::${dry}${labelOf(n, batch)}: ${why}; nothing was sent, and no other payout this run.`); return { ...out, outcome: "refused", ...extra }; };
    let g = await gate(batch);
    if (g.simFailed) {
      // One recipient can make a whole batch fail: find it by simulating each wallet alone, carry and hold it, and send the rest.
      out.code = 1;
      const { bad, unsure } = await isolate(batch);
      if (unsure || !bad.size || bad.size === batch.picks.length) {
        return stop(`${g.problem}, and ${unsure ? "a wallet's own simulation gave no answer" : !bad.size ? "every wallet of it simulates alone" : "no wallet of it simulates alone"}: it is not one recipient's doing`, { code: 1 });
      }
      const until = ISO_SECONDS(now() + HOLD_MS);
      for (const [a, why] of bad) {
        log(`::warning title=Rewards::${dry}${a}: its own transfer fails in simulation (${why}); it is carried${mode === "on" ? ` and held until ${until}` : ""}, and ${labelOf(n, batch)} goes out without it.`);
        if (mode === "on") R.holdWallets(state, [a], { until, reason: `its payout failed in simulation (${why})` });
      }
      if (mode === "on") saveRewards(io, state, L);
      const rest = batch.picks.filter((p) => !bad.has(p.owner));
      batch = R.payoutBatch(rest, { priceMicroLamports: price, rent });
      g = await gate(batch);
      if (g.simFailed) return stop(`${g.problem} again without the wallets that failed alone`, { code: 1 });
    }
    if (g.problem) return stop(g.problem, { code: g.code || out.code });
    const label = labelOf(n, batch);
    if (mode === "dry") {
      log(`Rewards (dry run): ${label} simulates cleanly. Nothing was signed or sent.`);
      spent += batch.debit; out.batches++;
      continue;
    }

    // Signed only now: a copy of the very message simulated, checked again from its bytes; written "sending" BEFORE it goes out.
    const { built, unsigned, bh } = g;
    const messageBytes = Uint8Array.from(built.messageBytes);
    R.checkPayoutMessage(messageBytes, { payer: wallet, rows: batch.rows, priceMicroLamports: price });
    const signatures = signTransaction(messageBytes, [keypair]);
    const signed = b64(serializeTransaction(messageBytes, signatures));
    if (messageOf(signed) !== messageOf(unsigned)) throw new R.RewardsError("the signed payout is not the transaction that was simulated; nothing was sent");
    const sig = base58Encode(signatures[0]);
    const row = R.recordPayoutSending(state, L, batch, { sig, lastValidBlockHeight: bh.lastValidBlockHeight, sentAt: ISO_SECONDS(now()) });
    saveRewards(io, state, L);
    try {
      const got = await rpc.sendTransaction(signed);
      if (got !== sig) log(`::warning title=Rewards::the RPC named the payout ${String(got).slice(0, 12)}…, not ${sig.slice(0, 12)}…`);
    } catch (e) {
      const why = scrub(String(e?.message ?? e)).slice(0, 200);
      if (isRefusal(e)) {
        R.settlePayout(state, L, sig, "expired", { settledAt: ISO_SECONDS(now()) });
        saveRewards(io, state, L);
        log(`::warning title=Rewards::the RPC refused ${label} (${why}); nothing went out, its wallets are owed again.`);
        return { ...out, outcome: "refused" };
      }
      log(`::warning title=Rewards::no clear answer from the RPC for ${label} (${why}); its row stays "sending" and is settled by its signature later; no other payout this run.`);
      return { ...out, outcome: "sending", code: 1 };
    }
    spent += batch.debit; out.batches++;
    log(`Rewards: sent ${label}: https://solscan.io/tx/${sig}`);
    const s = await confirm(() => settlePayoutRow(state, L, row, { rpc, now, log }), { now, sleep, waitMs: confirmWaitMs, pollMs: confirmPollMs });
    if (!s.changed) { log("Rewards: the payout is not final yet; a later run settles it, and no other payout goes out before."); return { ...out, outcome: "sending" }; }
    saveRewards(io, state, L);
    if (s.outcome !== "paid") return { ...out, outcome: s.outcome };
    out.paid += batch.debit - batch.fee;
  }
  return { ...out, outcome: mode === "dry" ? "dry" : out.batches ? "paid" : "nothing" };
}

/* ── send ─────────────────────────────────────────────────────────────────────────────── */

/**
 * SEND (the key): settle, count, claim (when `claim`), pay (when `pay`). Returns { mode, outcome,
 * code, claim, pay }: code 1 when a person must look (the wallet not listed, I2, an unclear send, a
 * lost payout that does not add up, a payout whose simulation failed), else 0. Nothing is signed in dry
 * mode, and nothing signed ever leaves the runner but through sendTransaction in "on" mode.
 */
export async function send({ io, env = {}, rpc, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {}, scrub = (t) => t,
  claim: doClaim = true, pay: doPay = true, confirmWaitMs = CONFIRM_WAIT_MS, confirmPollMs = CONFIRM_POLL_MS, runMs = RUN_MS, countMs = COUNT_MS }) {
  const mode = R.rewardsMode(env);
  const out = { mode, outcome: "nothing", code: 0, claim: null, pay: null };
  if (mode === "off") { log("Rewards: off (REWARDS_ENABLED is neither on nor dry); nothing done."); return { ...out, outcome: "off" }; }
  const cfg = R.rewardsConfig(env);
  for (const n of cfg.notes) log(`::warning title=Rewards::${n}`);
  const caps = launchCaps(env);
  for (const n of caps.notes.filter((x) => x.startsWith("LAUNCH_MIN_BALANCE_SOL"))) log(`::warning title=Rewards::${n}`);
  const keypair = walletFromEnv(env.LAUNCH_WALLET_KEY);
  const wallet = keypair.publicKey;
  const walletsFile = readJson(io, R.REWARDS_FILES.wallets) ?? { launchers: [] };
  const unlisted = walletProblem(wallet, walletsFile, now());
  if (unlisted) { log(`::error title=Rewards::${unlisted}. Nothing was claimed or paid.`); return { ...out, outcome: "wallet_not_listed", code: 1 }; }
  const { state, ledger: L } = loadRewards(io);
  const ctx = { mode, cfg, caps, L, state, rpc, keypair, wallet, walletsFile, io, now, sleep, log, scrub, confirmWaitMs, confirmPollMs, runMs, countMs };

  // 1. What was sent before.
  const settled = await settleAll(state, L, ctx);
  if (settled.changed) saveRewards(io, state, L);
  // 2. The wallet's transactions since the cursor (dry mode too: it sends nothing, it records what the chain did).
  const counted = await countSince(state, L, ctx);
  if (counted.changed) saveRewards(io, state, L);
  if (counted.problem) { log(`::error title=Rewards::${counted.problem}.`); out.code = 1; }
  // Nothing is sent before the ledger's cursor is committed: a transaction whose record were lost with
  // the cursor's first commit would otherwise fall before the next run's first cursor, uncounted.
  if (L.cursor === null || counted.started) {
    if (L.cursor === null) log("Rewards: the wallet has no transaction yet to count from; nothing is claimed or paid this run.");
    out.outcome = "started";
    return out;
  }
  // 3. The claim (even while the mint gate fails: the pot keeps growing, the launcher's earmark protects it).
  if (doClaim) {
    out.claim = await claimOnce(ctx);
    if (out.claim.code) out.code = 1;
  }
  // 4. The payouts.
  if (doPay) {
    if (settled.payoutPending) { log("Rewards: a payout sent earlier is not settled yet; no payouts this run."); out.pay = { outcome: "pending" }; }
    else if (counted.problem) out.pay = { outcome: "paused" };
    else if (counted.behind) {
      log(`Rewards: ${counted.left} of the wallet's transactions since the cursor are not counted yet: no payouts until they are (a payout whose record was lost among them must never be paid twice).`);
      out.pay = { outcome: "counting" };
    } else {
      out.pay = await payOut(ctx);
      if (out.pay.code) out.code = 1;
    }
  }
  const p = R.identityProblem(state, L);
  if (p) throw new R.RewardsError(`${p} (a bug; a person must look)`);
  log(`Rewards: the ledger now: E ${S(L.E)} (the holders' share of every claim), allocated ${S(L.A)}, paid ${S(L.P)}, payout fees ${S(L.F)}; unpaid ${S(R.holdersUnpaid(L))}.`);
  out.outcome = out.pay?.outcome ?? out.claim?.outcome ?? "nothing";
  return out;
}
