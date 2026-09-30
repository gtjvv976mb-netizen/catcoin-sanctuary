/* $CATSANC holder rewards (scripts/lib/rewards.mjs): the age multiplier, the mint gate, reading a
   sample, the lot and points rules (lazy accrual proved equal to eager), the period close and its
   cap, the payout plan (thresholds, the rent rule, fee shares, batches, the run caps), the
   ledger (the identity A = P + F + Σowed + in flight after every step, I1 and I2, claims with the
   holder share fixed at send, the launcher's earmark), the payout transaction's bytes, the validators
   (a corrupted file is refused), and the website's text. Every scenario of the spec's table (§13) is
   re-run here through the module (where the cap binds, with the cap that leaves what it holds back in
   the pot instead of handing it to other wallets). No network, no files, no keys. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { ROOT } from "./helpers.mjs";
import { base58Encode, base58Decode, isSignature } from "../assets/collection.js";
import { isOnCurve, pda, compileLegacyMessage, decodeLegacyMessage, encodeLegacyMessage, setComputeUnitLimit, setComputeUnitPrice, PACKET_DATA_SIZE } from "../scripts/lib/solana-tx.mjs";
import { SYSTEM_PROGRAM, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, PUMPFUN_PROGRAM } from "../scripts/lib/programs.mjs";
import { LAUNCH_DEFAULTS } from "../scripts/lib/pump.mjs";
import { creatorVault } from "../scripts/lib/pump-fees.mjs";
import * as R from "../scripts/lib/rewards.mjs";
import { capProblem } from "../scripts/lib/launcher.mjs";

/* ── the harness ─────────────────────────────────────────────────────────────────────── */

const DAY = 86_400, HOUR = 3_600;
const SUPPLY = 1_000_000_000_000_000n;                    // 1B tokens, 6 decimals
const pct = (p) => (SUPPLY * BigInt(Math.round(p * 1e6))) / 100_000_000n;
const DAILY = 1_000_000_000n / 7n;                          // 1 SOL a week, claimed daily
const MINT = "GPAAHLhvBUuRs5Lkfe9MuZBuQVU5RSprn1K2NyJbpump";
const LAUNCHER = "HxhisqFBeZRJcBWkjnumk6HwWxFLGVVD6jfX23tXHzQh";
const RENT = 650_240n;
const T_BASE = 1_790_000_000;                               // chain seconds of the harness's t = 0
const CFG = R.rewardsConfig({});

/** The spec's xorshift and sampling schedule: cron :07, a 0–15 min start delay, the hidden moment D, runs one after another. */
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function sampleTimes(hours, { seed = 1, random = true, cronDelayMax = 900, missPct = 0, outages = [] } = {}) {
  const r = rng(seed); const out = []; let end = -Infinity;
  for (let h = 0; h < hours; h++) {
    if (!random) { const T = h * HOUR; if (!outages.some(([a, b]) => T >= a && T < b)) out.push(T); continue; }
    const start = Math.max(h * HOUR + 420 + Math.floor(r() * cronDelayMax), end);
    const D = Math.floor(r() * R.SAMPLE_WINDOW);
    const T = start + D; end = start + R.SAMPLE_WINDOW + 60;
    if (r() * 100 < missPct) continue;
    if (outages.some(([a, b]) => T >= a && T < b)) continue;
    out.push(T);
  }
  return out;
}

/** An on-curve address per name, deterministic; among one run's names the addresses sort as the names do (ties in payout order are broken by address). */
const CURVE_ADDRS = new Map();
const onCurveFrom = (seed) => {
  if (!CURVE_ADDRS.has(seed)) for (let i = 0; ; i++) { const h = createHash("sha256").update(`${seed}:${i}`).digest(); if (isOnCurve(h)) { CURVE_ADDRS.set(seed, base58Encode(h)); break; } }
  return CURVE_ADDRS.get(seed);
};
const ADDRS = new Map();
function addressesFor(names) {
  const key = names.join("|");
  if (!ADDRS.has(key)) {
    const sorted = [...names].sort();
    const addrs = sorted.map((n) => onCurveFrom(`catsanc-test:${n}`)).sort();
    ADDRS.set(key, new Map(sorted.map((n, i) => [n, addrs[i]])));
  }
  return ADDRS.get(key);
}
const UNIT = new Map();
const addr = (name) => { if (!UNIT.has(name)) UNIT.set(name, onCurveFrom(`unit:${name}`)); return UNIT.get(name); };

/** A fresh signature: "2" and 87 more base58 digits is always 64 bytes (58^87 ≤ n < 3·58^87 < 2^512), so a counter in the last digits makes unique ones cheaply. */
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
let sigN = 0;
const sig = () => { let n = ++sigN, tail = ""; for (let i = 0; i < 8; i++) { tail = B58[n % 58] + tail; n = Math.floor(n / 58); } return `2${"A".repeat(79)}${tail}`; };
const iso = (t) => new Date((T_BASE + t) * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
const NOW = "2026-09-30T01:15:00Z";

/** holders: Map name → [[t, raw], …] (a step: the last event at or before t) or a function t → raw. */
const background = (n = 100, p = 0.2) => new Map(Array.from({ length: n }, (_, i) => [`S${String(i).padStart(3, "0")}`, [[0, pct(p)]]]));

/**
 * Run the rules over a schedule of samples as the workflow would: the day's claim (recorded "sending",
 * settled "landed"), the sample, a close when due, and payouts (planPayouts, each batch through I1,
 * written "sending", settled "paid", the recipient's lamports grown). With check, the identity, P + F ≤ E
 * and the rent rule are asserted after every step.
 */
function simulate({ holders, days, cfg = {}, seed = 1, random = true, missPct = 0, outages = [], claimDaily = DAILY, lamports = null,
  excludeAt = null, times = null, pay = true, eager = false, check = true }) {
  const names = [...holders.keys()];
  const A = addressesFor(names);
  const N = new Map([...A].map(([n, a]) => [a, n]));
  const c = { ...CFG, ...cfg };
  const state = R.emptyState(), ledger = R.emptyLedger();
  const acct = new Map(names.map((n) => [A.get(n), lamports?.get(n) ?? 10_000_000n]));
  const periods = [], paid = new Map(), feeShare = new Map();
  const steps = [], fns = [];
  for (const [n, h] of holders) {
    if (typeof h === "function") fns.push([A.get(n), h]);
    else for (const [t, v] of h) steps.push([t, A.get(n), v]);
  }
  steps.sort((x, y) => x[0] - y[0]);
  const bal = new Map();
  let si = 0, nextClaim = 1;
  const T = times ?? sampleTimes(days * 24 + 2, { seed, random, missPct, outages });
  const NOEX = new Set();
  for (const t of T) {
    if (t > days * DAY + 2 * HOUR) break;
    while (nextClaim * DAY <= t) {
      const s = sig();
      R.recordClaimSending(ledger, { sig: s, lastValidBlockHeight: 1, sharePct: c.holderSharePct, sentAt: iso(t) });
      R.settleClaim(ledger, s, { status: "landed", claimed: claimDaily, walletFee: 0n, net: claimDaily }, { settledAt: iso(t) });
      nextClaim++;
    }
    while (si < steps.length && steps[si][0] <= t) { const [, a, v] = steps[si++]; if (v > 0n) bal.set(a, v); else bal.delete(a); }
    for (const [a, f] of fns) { const v = f(t); if (v > 0n) bal.set(a, v); else bal.delete(a); }
    const exNames = excludeAt ? excludeAt(t) : null;
    const excluded = exNames ? new Set([...exNames].map((n) => A.get(n))) : NOEX;
    const res = R.applySample(state, ledger, { T: T_BASE + t, slot: t + 1, mint: MINT, tokenProgram: TOKEN_2022_PROGRAM, decimals: 6, supply: SUPPLY, holders: bal }, c, { excluded, eager });
    if (res.closed) {
      const r = res.closed;
      periods.push({ idx: periods.length + 1, pot: r.pot, capAmt: r.capAmt, totPts: r.totalPts, alloc: new Map(r.rows.map(([a, , v]) => [N.get(a), v])), pts: new Map(r.rows.map(([a, p]) => [N.get(a), p])), record: r });
    }
    if (check) assert.equal(R.identityProblem(state, ledger), null);
    if (pay) {
      const pot = R.payoutBudget(ledger, { maxLamportsPerRun: c.maxLamportsPerRun, spentThisRun: 0n });
      const accounts = new Map([...state.wallets.keys()].map((a) => [a, acct.get(a) ?? 0n]));
      const plan = R.planPayouts(state, { pot, accounts, rent: RENT, priceMicroLamports: c.priorityMicroLamports, minPayoutLamports: c.minPayoutLamports, maxTx: c.maxTxPerRun });
      assert.ok(plan.spend <= pot);
      for (const b of plan.batches) {
        assert.equal(R.i1Problem(ledger, b.debit), null);
        const s = sig();
        R.recordPayoutSending(state, ledger, b, { sig: s, lastValidBlockHeight: 1, sentAt: iso(t) });
        if (check) assert.equal(R.identityProblem(state, ledger), null);
        R.settlePayout(state, ledger, s, "paid", { settledAt: iso(t) });
        for (const r of b.rows) {
          const before = acct.get(r.owner) ?? 0n;
          if (check) assert.ok(before + r.lamports >= RENT, "a recipient is left under the rent-exempt minimum");
          acct.set(r.owner, before + r.lamports);
          const n = N.get(r.owner);
          paid.set(n, (paid.get(n) ?? 0n) + r.lamports); feeShare.set(n, (feeShare.get(n) ?? 0n) + r.share);
        }
      }
      if (check) { assert.equal(R.identityProblem(state, ledger), null); assert.ok(ledger.P + ledger.F <= ledger.E); }
    }
  }
  return { state, ledger, periods, paid, feeShare, A, owedOf: (n) => state.wallets.get(A.get(n))?.owed ?? 0n };
}
const sol = (l) => (Number(l) / 1e9).toFixed(6);
const share = (v, pot) => (pot > 0n ? (Number((v * 1_000_000n) / pot) / 1e4).toFixed(3) + "%" : "-");
const ratio = (a, b) => (b > 0n ? (Number((a * 1_000_000n) / b) / 1e6).toFixed(3) : "-");
const allocOf = (e, k, n) => e.periods[k - 1]?.alloc.get(n) ?? 0n;
const sumAlloc = (e, n, from, to) => e.periods.filter((p) => p.idx >= from && p.idx <= to).reduce((s, p) => s + (p.alloc.get(n) ?? 0n), 0n);

/** A sample for the unit tests: holders given by name. */
const sampleOf = (T, byName, { supply = SUPPLY, slot = T } = {}) => ({
  T: T_BASE + T, slot, mint: MINT, tokenProgram: TOKEN_2022_PROGRAM, decimals: 6, supply,
  holders: new Map(Object.entries(byName).map(([n, v]) => [addr(n), v])),
});
const W = (state, n) => state.wallets.get(addr(n));

/* ── constants, the multiplier, the fee ─────────────────────────────────────────────── */

test("the code constants are the spec's", () => {
  for (let i = 0; i < 3; i++) assert.ok(isSignature(sig()), "the tests' signatures are real 64-byte base58");
  assert.equal(R.SCALE, 1_000_000n);
  assert.equal(R.M_FP, 2_000_000n);
  assert.equal(R.H, 1_209_600);
  assert.equal(R.H, 14 * DAY);
  assert.equal(R.GAP_CAP, 7_200);
  assert.equal(R.SAMPLE_WINDOW, 3_300);
  assert.equal(R.MAX_LOTS, 16);
  assert.equal(R.PER_TX, 20);
  assert.equal(R.EXIT_MIN, 10_000n);
  assert.equal(R.cuLimit(1), 1_300);
  assert.equal(R.cuLimit(20), 7_000);
  assert.throws(() => R.cuLimit(21), RangeError);
  assert.throws(() => R.cuLimit(0), RangeError);
  assert.equal(R.payoutFee(1, 100_000), 5_130n, "FEE1 at the default price");
  assert.equal(R.payoutFee(18, 100_000), 5_640n);
  assert.equal(R.payoutFee(20, 100_000), 5_700n);
  assert.equal(R.payoutFee(1, 0), 5_000n);
  assert.equal(R.payoutFee(1, 1), 5_001n, "the priority fee is rounded up, as the runtime charges it");
  assert.equal(R.periodPath(3), "data/rewards/periods/3.json");
  assert.throws(() => R.periodPath(0), R.RewardsError);
  // the priority price is the launcher's: same default and range
  assert.equal(R.REWARDS_DEFAULTS.priorityMicroLamports, LAUNCH_DEFAULTS.computeUnitPriceMicroLamports);
  assert.deepEqual(R.REWARDS_RANGES.priorityMicroLamports, [0, 1_000_000]);
});

test("the age multiplier: the spec's table, bounded, increasing, concave, floored", () => {
  const table = [[0, "1.000"], [HOUR, "1.003"], [DAY, "1.067"], [3 * DAY, "1.176"], [7 * DAY, "1.333"], [14 * DAY, "1.500"], [21 * DAY, "1.600"],
    [30 * DAY, "1.682"], [60 * DAY, "1.811"], [90 * DAY, "1.865"], [180 * DAY, "1.928"], [365 * DAY, "1.963"]];
  for (const [a, m] of table) assert.equal((Number(R.mFp(a)) / 1e6).toFixed(3), m, `age ${a}`);
  assert.equal(R.mFp(0), 1_000_000n);
  assert.equal(R.mFp(-5), 1_000_000n, "a negative age is 0");
  assert.equal(R.mFp(14 * DAY), 1_500_000n);
  assert.equal(R.mFp(10n ** 15n), 1_999_999n, "never reaches 2×");
  assert.equal(R.mFp(7 * DAY), R.mFp(BigInt(7 * DAY)));
  assert.throws(() => R.mFp(1.5), TypeError);
  let prev = R.mFp(0), prevStep = null;
  for (let a = 3_600; a <= 400 * DAY; a += 3_600) {
    const m = R.mFp(a);
    assert.ok(m > prev, "strictly increasing");
    const step = m - prev;
    if (prevStep !== null) assert.ok(step <= prevStep + 1n, "concave (up to the floor's one unit)");
    assert.ok(m < R.M_FP);
    prev = m; prevStep = step;
  }
  const r = rng(5);
  for (let i = 0; i < 2000; i++) {
    const a = BigInt(Math.floor(r() * 1e9));
    const m = R.mFp(a);
    // floor: m − 1e6 ≤ 1e6·a/(a+H) < m − 1e6 + 1
    assert.ok((m - 1_000_000n) * (a + 1_209_600n) <= 1_000_000n * a);
    assert.ok((m - 1_000_000n + 1n) * (a + 1_209_600n) > 1_000_000n * a);
  }
  assert.ok(R.mFp(0) * 2n >= R.M_FP, "a brand-new holder earns at least half the top rate");
});

test("floorDiv rounds toward −∞; minBalance rounds up", () => {
  assert.equal(R.floorDiv(7n, 2n), 3n);
  assert.equal(R.floorDiv(-7n, 2n), -4n);
  assert.equal(R.floorDiv(-6n, 2n), -3n);
  assert.equal(R.floorDiv(-5001n * 50n, 100n), -2501n);
  assert.equal(R.floorDiv(0n, 3n), 0n);
  assert.throws(() => R.floorDiv(1n, 0n), RangeError);
  assert.equal(R.minBalance(SUPPLY, 100), 100_000_000_000n, "100 ppm of 1B tokens is 100,000 tokens (6 decimals)");
  assert.equal(R.minBalance(999_999n, 100), 100n, "ceil(99.9999)");
  assert.equal(R.minBalance(1_000_000n, 100), 100n);
  assert.equal(R.minBalance(1_000_001n, 100), 101n);
});

/* ── configuration ──────────────────────────────────────────────────────────────────── */

test("the repository variables: defaults, clamping (logged), whole numbers, SOL in lamports, the mode", () => {
  assert.deepEqual({ ...CFG, notes: undefined }, {
    mode: "off", holderSharePct: 100, everyDays: 7, releasePct: 50, walletCapPct: 10, minBalancePpm: 100, maxTxPerRun: 10,
    priorityMicroLamports: 100_000, minPayoutLamports: 1_000_000n, minClaimLamports: 10_000_000n, maxLamportsPerRun: 2_000_000_000n, notes: undefined,
  });
  assert.deepEqual(CFG.notes, []);
  for (const [v, m] of [["on", "on"], [" ON ", "on"], ["dry", "dry"], ["Dry", "dry"], ["off", "off"], ["", "off"], ["yes", "off"], [undefined, "off"]]) assert.equal(R.rewardsMode({ REWARDS_ENABLED: v }), m);
  const c = R.rewardsConfig({
    REWARDS_HOLDER_SHARE_PCT: "150", REWARDS_EVERY_DAYS: "0", REWARDS_RELEASE_PCT: "5", REWARDS_WALLET_CAP_PCT: "20.7", REWARDS_MIN_BALANCE_PPM: "1e9",
    REWARDS_MIN_PAYOUT_SOL: "1", REWARDS_MIN_CLAIM_SOL: "abc", REWARDS_MAX_TX_PER_RUN: "-3", REWARDS_MAX_SOL_PER_RUN: "0", LAUNCH_PRIORITY_MICROLAMPORTS: "5000000", REWARDS_ENABLED: "dry",
  });
  assert.equal(c.mode, "dry");
  assert.equal(c.holderSharePct, 100);
  assert.equal(c.everyDays, 1);
  assert.equal(c.releasePct, 10);
  assert.equal(c.walletCapPct, 20);
  assert.equal(c.minBalancePpm, 10_000);
  assert.equal(c.minPayoutLamports, 100_000_000n);
  assert.equal(c.minClaimLamports, 10_000_000n);
  assert.equal(c.maxTxPerRun, 1);
  assert.equal(c.maxLamportsPerRun, 0n, "0 pays nothing");
  assert.equal(c.priorityMicroLamports, 1_000_000);
  assert.equal(c.notes.length, 9, c.notes.join("; "));
  assert.ok(!c.notes.some((n) => /REWARDS_MAX_SOL_PER_RUN/.test(n)), "0 is in range: no note");
  assert.ok(c.notes.some((n) => /REWARDS_MIN_CLAIM_SOL is not a number/.test(n)));
  assert.equal(R.rewardsConfig({ REWARDS_MIN_PAYOUT_SOL: "0.0001" }).minPayoutLamports, 100_000n);
  assert.equal(R.rewardsConfig({ REWARDS_MAX_SOL_PER_RUN: "20" }).maxLamportsPerRun, 20_000_000_000n);
});

/* ── the mint gate ──────────────────────────────────────────────────────────────────── */

/** A mint account as getAccountInfo returns it (base64). */
function mintAccount({ owner = TOKEN_2022_PROGRAM, supply = SUPPLY, decimals = 6, initialized = 1, size = 82, typeByte = 1 } = {}) {
  const d = Buffer.alloc(size);
  if (size >= 82) { d.writeBigUInt64LE(supply, 36); d[44] = decimals; d[45] = initialized; }
  if (size > 165) d[165] = typeByte;
  return { owner, lamports: 1_461_600, executable: false, data: [d.toString("base64"), "base64"] };
}

test("the mint gate: empty, invalid, missing, not a mint, and a changed mint all stop sampling", () => {
  const ok = R.mintGate({ contract: MINT, account: mintAccount({ size: 300 }), state: R.emptyState() });
  assert.equal(ok.ok, true);
  assert.equal(ok.mint, MINT);
  assert.equal(ok.tokenProgram, TOKEN_2022_PROGRAM);
  assert.equal(ok.supply, SUPPLY);
  assert.equal(ok.decimals, 6);
  assert.equal(R.mintGate({ contract: ` ${MINT} `, account: mintAccount({ owner: TOKEN_PROGRAM }) }).ok, true, "the classic token program too");
  const no = (args, re, changed = false) => { const g = R.mintGate(args); assert.equal(g.ok, false); assert.equal(g.changed, changed); assert.match(g.problem, re); assert.equal(g.supply, null); };
  no({ contract: "", account: mintAccount() }, /no \$CATSANC contract/);
  no({ contract: "   " }, /no \$CATSANC contract/);
  no({ contract: undefined }, /no \$CATSANC contract/);
  no({ contract: "not-an-address", account: mintAccount() }, /not a Solana address/);
  no({ contract: MINT, account: null }, /does not exist/);
  no({ contract: MINT }, /not read/);
  no({ contract: MINT, account: mintAccount({ owner: SYSTEM_PROGRAM }) }, /not owned by the token program/);
  no({ contract: MINT, account: mintAccount({ size: 81 }) }, /at least 82/);
  no({ contract: MINT, account: mintAccount({ initialized: 0 }) }, /not initialized/);
  no({ contract: MINT, account: mintAccount({ size: 300, typeByte: 2 }) }, /not a Mint/);
  no({ contract: MINT, account: mintAccount({ size: 165 }) }, /82, or more than 165/);
  assert.equal(R.mintGate({ contract: MINT, account: mintAccount({ size: 166 }) }).ok, true, "166 bytes typed as a Mint");
  no({ contract: MINT, account: mintAccount({ supply: 0n }) }, /supply is 0/);
  const tracked = { ...R.emptyState(), mint: LAUNCHER, tokenProgram: TOKEN_2022_PROGRAM };
  no({ contract: MINT, account: mintAccount(), state: tracked }, /new_epoch=GPAAHLhvBUuRs5Lkfe9MuZBuQVU5RSprn1K2NyJbpump/, true);
  no({ contract: MINT, account: mintAccount({ owner: TOKEN_PROGRAM }), state: { ...tracked, mint: MINT } }, /token program/, true);
  assert.throws(() => R.mintFromAccount(null), R.RewardsError);
  assert.throws(() => R.mintFromAccount({ owner: TOKEN_PROGRAM, data: ["", "base58"] }), R.RewardsError);
  // the shipped contract is an address (the gate itself reads the chain in the workflow)
  const socials = JSON.parse(fs.readFileSync(path.join(ROOT, "data/socials.json"), "utf8"));
  assert.equal(typeof socials.contract, "string");
  if (socials.contract) assert.notEqual(R.mintGate({ contract: socials.contract }).problem, "data/socials.json \"contract\" is not a Solana address: nothing is sampled");
});

/* ── reading a sample ───────────────────────────────────────────────────────────────── */

/** A getProgramAccounts row with the TOKEN_SLICE data slice. */
function tokenRow(owner, amount, state = 1, { program = TOKEN_2022_PROGRAM, pubkey = base58Encode(randomBytes(32)), length = 77 } = {}) {
  const d = Buffer.alloc(length);
  Buffer.from(base58Decode(owner)).copy(d, 0);
  if (length >= 40) d.writeBigUInt64LE(amount, 32);
  if (length >= 77) d[76] = state;
  return { pubkey, account: { owner: program, lamports: 2_039_280, executable: false, data: [d.toString("base64"), "base64"] } };
}

test("a sample's balances: initialized accounts summed per owner, frozen counted only in the supply check", () => {
  const [a, b, c] = [addr("a"), addr("b"), addr("c")];
  const rows = [tokenRow(a, 5n), tokenRow(a, 7n), tokenRow(b, 100n, 2), tokenRow(c, 0n), tokenRow(b, 3n)];
  const r = R.holdersFromAccounts(rows, { tokenProgram: TOKEN_2022_PROGRAM });
  assert.deepEqual([...r.holders], [[a, 12n], [b, 3n]]);
  assert.equal(r.total, 115n);
  assert.equal(r.frozen, 100n);
  assert.equal(r.accounts, 5);
  assert.equal(R.supplyProblem({ total: 115n, supply: 115n }), null);
  assert.match(R.supplyProblem({ total: 114n, supply: 115n }), /incomplete/);
  assert.throws(() => R.holdersFromAccounts([rows[0], rows[0]]), /twice/);
  assert.throws(() => R.holdersFromAccounts([tokenRow(a, 1n, 1, { length: 76 })]), /slice/);
  assert.throws(() => R.holdersFromAccounts([tokenRow(a, 1n, 0)]), /neither initialized nor frozen/);
  assert.throws(() => R.holdersFromAccounts([tokenRow(a, 1n, 1, { program: TOKEN_PROGRAM })], { tokenProgram: TOKEN_2022_PROGRAM }), /program/);
  assert.throws(() => R.holdersFromAccounts(null), R.RewardsError);
  assert.deepEqual(R.TOKEN_SLICE, { offset: 32, length: 77, owner: 0, amount: 32, state: 76 });
});

test("exclusions: every data/wallets.json row and the owner's list, failing closed; off-curve owners never earn", () => {
  const wallets = JSON.parse(fs.readFileSync(path.join(ROOT, "data/wallets.json"), "utf8"));
  const set = R.exclusionSet({ wallets, exclude: { note: "x", exclude: [{ address: addr("mm"), reason: "a market maker" }] } });
  assert.ok(set.has(LAUNCHER));
  for (const l of wallets.launchers) assert.ok(set.has(l.address));
  assert.ok(set.has(addr("mm")));
  assert.equal(R.exclusionSet({ wallets }).size, wallets.launchers.length, "no exclude file: only the wallets");
  // a retired launcher (an until date) is still excluded
  const retired = { launchers: [{ address: addr("old"), since: "2026-01-01", until: "2026-02-01", label: "Auto launcher 0" }] };
  assert.ok(R.exclusionSet({ wallets: retired }).has(addr("old")));
  assert.throws(() => R.exclusionSet({ wallets: { launchers: [{ address: "nope", since: "2026-01-01", label: "x" }] } }), /does not parse/);
  assert.throws(() => R.exclusionSet({ wallets: null }), /does not parse/);
  assert.throws(() => R.exclusionSet({ wallets, exclude: { exclude: [{ address: "bad", reason: "x" }] } }), /not a Solana address/);
  assert.throws(() => R.exclusionSet({ wallets, exclude: { exclude: [{ address: addr("mm"), reason: "" }] } }), /reason/);
  assert.throws(() => R.exclusionSet({ wallets, exclude: { exclude: [{ address: addr("mm"), reason: "x" }, { address: addr("mm"), reason: "y" }] } }), /twice/);
  assert.throws(() => R.exclusionSet({ wallets, exclude: { exclude: [], extra: 1 } }), R.RewardsError);
  assert.throws(() => R.exclusionSet({ wallets, exclude: { exclude: [{ address: addr("mm"), reason: "x", note: 1 }] } }), R.RewardsError);
  assert.deepEqual(R.validateExcludeFile(undefined).exclude, []);
  // off-curve: a PDA (pump.fun's creator vault of the launcher, the bonding-curve program's kind of account) never earns
  assert.equal(R.offCurve(creatorVault(LAUNCHER)), true);
  assert.equal(R.offCurve(pda(["utf8:bonding-curve", MINT], PUMPFUN_PROGRAM)), true);
  assert.equal(R.offCurve(LAUNCHER), false);
  assert.equal(R.offCurve(addr("x")), false);
  assert.equal(R.offCurve("S000"), true, "not an address: never earns");
});

test("reserved account keys and program addresses never earn and are never paid (a transfer to a reserved key always fails), though several are on the curve", () => {
  for (const k of R.RESERVED_ACCOUNT_KEYS) assert.equal(base58Decode(k)?.length, 32, k);
  const NATIVE = "NativeLoader1111111111111111111111111111111", SYSVAR = "Sysvar1111111111111111111111111111111111111", FEATURE = "Feature111111111111111111111111111111111111";
  for (const k of [NATIVE, SYSVAR, FEATURE, SYSTEM_PROGRAM]) {
    assert.equal(R.offCurve(k), false, `${k} is on the curve: offCurve alone lets it in`);
    assert.ok(R.RESERVED_ACCOUNT_KEYS.has(k), k);
  }
  for (const k of ["1nc1nerator11111111111111111111111111111111", "SysvarRent111111111111111111111111111111111", "Vote111111111111111111111111111111111111111"]) assert.ok(R.RESERVED_ACCOUNT_KEYS.has(k), k);
  // None of them earns, nor the token and launch programs, nor the tracked mint itself (tokens sent to it by mistake).
  const s = R.emptyState(), L = R.emptyLedger();
  const smp = sampleOf(0, { a: pct(1) });
  for (const k of [NATIVE, SYSVAR, FEATURE, SYSTEM_PROGRAM, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, PUMPFUN_PROGRAM, MINT]) smp.holders.set(k, pct(2));
  R.applySample(s, L, smp, CFG);
  assert.deepEqual([...s.wallets.keys()], [addr("a")]);
  // One owed already (a state from before this rule) is carried with its reason, never put in a transaction.
  const st = owedState([["a", 50_000_000n]]);
  for (const k of [NATIVE, SYSVAR]) st.wallets.set(k, { lots: [], pts: 0n, ptsAt: 0, owed: 50_000_000n, first: null });
  const plan = R.planPayouts(st, { pot: 10n ** 12n, accounts: new Map([[addr("a"), sysAcct(1_000_000)], [SYSVAR, sysAcct(57_760_221)]]), rent: RENT });
  assert.deepEqual(plan.payouts.map((x) => x.owner), [addr("a")]);
  for (const k of [NATIVE, SYSVAR]) assert.match(plan.carry.find((c) => c.owner === k).reason, /reserved account/);
  // What can never be paid, from the account: a reserved key, a program, a program-owned account, a System account holding data.
  assert.equal(R.unpayableReason(addr("a"), null), null, "a wallet with no account yet is paid once its reward covers the rent");
  assert.equal(R.unpayableReason(addr("a"), sysAcct(5)), null);
  assert.match(R.unpayableReason(NATIVE, null), /reserved/);
  assert.match(R.unpayableReason(addr("a"), sysAcct(5, { executable: true })), /executable/);
  assert.match(R.unpayableReason(addr("a"), { lamports: 1_461_600, owner: TOKEN_2022_PROGRAM, executable: false, data: [Buffer.alloc(82).toString("base64"), "base64"] }), /not a System Program account/);
  assert.match(R.unpayableReason(addr("a"), sysAcct(1_447_680, { data: [Buffer.alloc(80).toString("base64"), "base64"], space: 80 })), /holds data/);
});

/* ── the update rules ───────────────────────────────────────────────────────────────── */

test("genesis: every counted balance becomes one lot of age 0; no points; excluded and small balances are left out", () => {
  const s = R.emptyState(), L = R.emptyLedger();
  const min = R.minBalance(SUPPLY, 100);
  const smp = sampleOf(0, { a: pct(1), b: min, c: min - 1n });
  smp.holders.set(LAUNCHER, pct(5));
  smp.holders.set(creatorVault(LAUNCHER), pct(5));
  const r = R.applySample(s, L, smp, CFG, { excluded: new Set([LAUNCHER]) });
  assert.equal(r.status, "genesis");
  assert.equal(r.minBalance, min);
  assert.equal(s.epoch, T_BASE);
  assert.equal(s.V, 0);
  assert.equal(s.period, 1);
  assert.equal(s.periodEnd, T_BASE + 7 * DAY);
  assert.equal(s.mint, MINT);
  assert.deepEqual(W(s, "a").lots, [[pct(1), 0]]);
  assert.deepEqual(W(s, "b").lots, [[min, 0]], "exactly the minimum counts");
  assert.equal(W(s, "c"), undefined, "one raw unit under the minimum counts 0");
  assert.equal(s.wallets.has(LAUNCHER), false);
  assert.equal(s.wallets.has(creatorVault(LAUNCHER)), false);
  for (const w of s.wallets.values()) assert.equal(w.pts, 0n);
});

test("credit: tokens held at both samples × capped seconds × the age at the interval's start; a wallet seen once earns 0", () => {
  const s = R.emptyState(), L = R.emptyLedger();
  const b = pct(1);
  R.applySample(s, L, sampleOf(0, { a: b }), CFG);
  R.applySample(s, L, sampleOf(3_000, { a: b, once: b }), CFG);
  R.applySample(s, L, sampleOf(6_000, { a: b }), CFG);
  R.accrueAll(s);
  assert.equal(W(s, "a").pts, b * 3_000n * R.mFp(0) + b * 3_000n * R.mFp(3_000));
  assert.equal(W(s, "once")?.pts ?? 0n, 0n, "seen at one sample only: nothing");
  // a five-hour gap counts two hours, and the clock (age) advances two hours only
  R.applySample(s, L, sampleOf(6_000 + 5 * HOUR, { a: b }), CFG);
  assert.equal(s.V, 6_000 + R.GAP_CAP);
  R.accrueAll(s);
  assert.equal(W(s, "a").pts, b * 3_000n * R.mFp(0) + b * 3_000n * R.mFp(3_000) + b * 7_200n * R.mFp(6_000));
  // a sample not after the previous one is skipped, and changes nothing
  const before = R.stateText(s);
  assert.equal(R.applySample(s, L, sampleOf(6_000 + 5 * HOUR, { a: 2n * b }, { slot: 99_999_999 }), CFG).status, "skipped");
  assert.equal(R.applySample(s, L, sampleOf(6_000 + 6 * HOUR, { a: 2n * b }, { slot: 1 }), CFG).status, "skipped", "a slot not after the previous one");
  assert.equal(R.stateText(s), before);
  assert.throws(() => R.applySample(s, L, { ...sampleOf(99_999, { a: b }), mint: LAUNCHER }, CFG), /mint/);
  assert.throws(() => R.applySample(s, L, sampleOf(99_999, { a: SUPPLY + 1n }), CFG), /more than the supply/);
  assert.throws(() => R.applySample(s, L, sampleOf(99_999, { a: -1n }), CFG), R.RewardsError);
});

test("lots: a buy is a new lot of age 0 that earns nothing the interval it arrived; a sell takes the newest first; selling out resets", () => {
  const s = R.emptyState(), L = R.emptyLedger();
  const b = pct(1);
  R.applySample(s, L, sampleOf(0, { a: b }), CFG);
  R.applySample(s, L, sampleOf(3_600, { a: 3n * b }), CFG);            // buys 2b
  assert.deepEqual(W(s, "a").lots, [[b, 0], [2n * b, 3_600]]);
  assert.equal(W(s, "a").pts, b * 3_600n * R.mFp(0), "the new tokens earn nothing for the interval they arrived in");
  R.applySample(s, L, sampleOf(7_200, { a: 3n * b }), CFG);
  R.accrueAll(s);
  assert.equal(W(s, "a").pts, b * 3_600n * R.mFp(0) + b * 3_600n * R.mFp(3_600) + 2n * b * 3_600n * R.mFp(0), "age 0 in the next interval");
  R.applySample(s, L, sampleOf(10_800, { a: b + b / 2n }), CFG);        // sells 1.5b: the newest lot goes first
  assert.deepEqual(W(s, "a").lots, [[b, 0], [b / 2n, 3_600]]);
  R.applySample(s, L, sampleOf(14_400, { a: b / 2n }), CFG);            // sells b more: the rest of the new lot, then half of the old
  assert.deepEqual(W(s, "a").lots, [[b / 2n, 0]], "the oldest keep their age");
  const pts = (R.accrueAll(s), W(s, "a").pts);
  R.applySample(s, L, sampleOf(18_000, {}), CFG);                       // sells out
  assert.deepEqual(W(s, "a").lots, []);
  assert.equal(W(s, "a").pts, pts, "points already earned this period are kept");
  R.applySample(s, L, sampleOf(21_600, { a: b }), CFG);                 // buys back
  assert.deepEqual(W(s, "a").lots, [[b, 21_600]], "a buy after selling out starts at age 0");
  // a transfer is a sell at the sender and a buy at the receiver: age never moves with tokens
  R.applySample(s, L, sampleOf(25_200, { a: b / 2n, r: b / 2n }), CFG);
  assert.deepEqual(W(s, "a").lots, [[b / 2n, 21_600]]);
  assert.deepEqual(W(s, "r").lots, [[b / 2n, 25_200]]);
});

test("lots: past 16, the adjacent pair losing the least bonus merges into one with the younger date (ties: the oldest pair)", () => {
  const s = R.emptyState(), L = R.emptyLedger();
  const u = 1_000_000_000_000n; // 1,000,000 tokens a buy
  let t = 0, bal = u * 100n;
  R.applySample(s, L, sampleOf(t, { a: bal }), CFG);
  for (let i = 1; i <= 15; i++) { t += 3_600; bal += u; R.applySample(s, L, sampleOf(t, { a: bal }), CFG); }
  assert.equal(W(s, "a").lots.length, 16);
  const lots = W(s, "a").lots.map((l) => [...l]);
  t += 3_600; bal += u;
  R.applySample(s, L, sampleOf(t, { a: bal }), CFG);
  const Vn = s.V;
  const pushed = [...lots, [u, Vn]];
  let best = -1, bestLoss = null;
  for (let i = 0; i + 1 < pushed.length; i++) {
    const loss = pushed[i][0] * (R.mFp(Vn - pushed[i][1]) - R.mFp(Vn - pushed[i + 1][1]));
    if (bestLoss === null || loss < bestLoss) { bestLoss = loss; best = i; }
  }
  const want = [...pushed];
  want.splice(best, 2, [pushed[best][0] + pushed[best + 1][0], pushed[best + 1][1]]);
  assert.deepEqual(W(s, "a").lots, want);
  assert.equal(W(s, "a").lots.length, 16);
  assert.equal(W(s, "a").lots.reduce((x, l) => x + l[0], 0n), bal, "a merge never changes the balance");
  assert.deepEqual(W(s, "a").lots[0], [u * 100n, 0], "the big old lot is not merged into a young one while a cheaper pair exists");
  // equal losses: the lowest pair wins
  const tie = [[5n, 100], [5n, 100], [5n, 100]];
  R.mergeLots(tie, 1_000);
  assert.deepEqual(tie, [[10n, 100], [5n, 100]]);
  // the cheapest pair: a small old lot next to a young one loses less than a big one
  const lots1 = [[1_000n, 0], [1n, 50_000], [1_000n, 90_000], [1_000n, 90_001]];
  R.mergeLots(lots1, 100_000);
  assert.deepEqual(lots1, [[1_000n, 0], [1n, 50_000], [2_000n, 90_001]], "pair (2,3) loses 1,000 × (m(10,000) − m(9,999))");
  const lots2 = [[1_000n, 0], [1n, 50_000], [1_000n, 60_000]];
  R.mergeLots(lots2, 100_000);
  assert.deepEqual(lots2, [[1_000n, 0], [1_001n, 60_000]], "the 1-token lot merges forward, taking the younger date");
  assert.throws(() => R.mergeLots([[1n, 0]], 1), R.RewardsError);
});

test("exclusion: a newly excluded wallet loses its points and lots at once, keeps what it is owed, and is still paid", () => {
  const s = R.emptyState(), L = R.emptyLedger();
  R.recordClaimSending(L, { sig: sig(), lastValidBlockHeight: 1, sharePct: 100, sentAt: NOW });
  R.settleClaim(L, L.claims[0].sig, { claimed: 1_000_000_000n, walletFee: 0n, net: 1_000_000_000n }, { settledAt: NOW });
  const cfg = { ...CFG, everyDays: 1 };
  R.applySample(s, L, sampleOf(0, { a: pct(1), b: pct(1) }), cfg);
  for (let t = 3_600; t <= DAY; t += 3_600) R.applySample(s, L, sampleOf(t, { a: pct(1), b: pct(1) }), cfg);
  const owed = W(s, "a").owed;
  assert.ok(owed > 0n);
  R.applySample(s, L, sampleOf(DAY + 3_600, { a: pct(1), b: pct(1) }), cfg);
  const r = R.applySample(s, L, sampleOf(DAY + 7_200, { a: pct(1), b: pct(1) }), cfg, { excluded: new Set([addr("a")]) });
  assert.deepEqual(r.excludedNow, [addr("a")]);
  assert.deepEqual(W(s, "a").lots, []);
  assert.equal(W(s, "a").pts, 0n);
  assert.equal(W(s, "a").owed, owed, "owed is kept");
  // a wallet with points but no lots (it sold out) that is then excluded loses its points too
  R.applySample(s, L, sampleOf(DAY + 10_800, { b: 0n }), cfg);
  assert.ok(W(s, "b").pts > 0n && !W(s, "b").lots.length);
  R.applySample(s, L, sampleOf(DAY + 14_400, {}), cfg, { isExcluded: (o) => o === addr("b") });
  assert.equal(W(s, "b").pts, 0n);
  // what "a" is owed is still paid although it is excluded now
  const plan = R.planPayouts(s, { pot: R.payoutBudget(L, { maxLamportsPerRun: 2_000_000_000n }), accounts: new Map([[addr("a"), 10_000_000n], [addr("b"), 10_000_000n]]), rent: RENT });
  assert.ok(plan.payouts.some((p) => p.owner === addr("a")));
});

test("a falling supply or a changed minimum is a sell; an owner under the minimum earns nothing", () => {
  const s = R.emptyState(), L = R.emptyLedger();
  R.applySample(s, L, sampleOf(0, { a: 100_000_000_000n }), CFG);
  assert.equal(W(s, "a").lots.length, 1);
  R.applySample(s, L, sampleOf(3_600, { a: 100_000_000_000n, b: pct(1) }), { ...CFG, minBalancePpm: 101 });
  assert.equal(W(s, "a"), undefined, "now under the minimum: counted 0, credited min(b0, 0) = 0, and its empty row is dropped");
  assert.equal(R.minBalance(SUPPLY, 101), 101_000_000_000n);
});

test("lazy accrual equals eager accrual, bit for bit, on random histories", () => {
  let full = 0;
  for (let run = 0; run < 12; run++) {
    const r = rng(300 + run);
    const names = Array.from({ length: 25 }, (_, i) => `h${i}`);
    const events = new Map(names.map((n) => [n, []]));
    let t = 0;
    const times = [];
    const cur = new Map(names.map((n) => [n, r() < 0.5 ? pct(r() * 2) : 0n]));
    for (const n of names) events.get(n).push([0, cur.get(n)]);
    for (let k = 0; k < 24 * 20; k++) {
      t += r() < 0.05 ? Math.floor(r() * 5 * HOUR) + 1 : 1_800 + Math.floor(r() * 3_600);
      times.push(t);
      for (const n of names) {
        const x = r();
        if (x < 0.30) cur.set(n, cur.get(n) + pct(r() * 0.3));                 // many buys: lots fill up and merge
        else if (x < 0.31) cur.set(n, 0n);
        else if (x < 0.33) cur.set(n, cur.get(n) / 3n);
        else if (x < 0.335) cur.set(n, 99_999_000_000n);                       // just under the minimum
        else continue;
        events.get(n).push([t, cur.get(n)]);
      }
    }
    const holders = new Map([...events].map(([n, ev]) => [n, ev]));
    const excludeAt = (tt) => (tt > 5 * DAY && tt < 6 * DAY ? new Set(["h3", "h4"]) : null);
    const cfg = { everyDays: 1 + (run % 3), walletCapPct: 5 + run * 7, releasePct: 30 + run * 5 };
    const lazy = simulate({ holders, days: 25, times, cfg, excludeAt, pay: run % 2 === 0 });
    const eager = simulate({ holders, days: 25, times, cfg, excludeAt, eager: true, pay: run % 2 === 0 });
    assert.ok(lazy.periods.length >= 5);
    assert.equal(lazy.periods.length, eager.periods.length);
    lazy.periods.forEach((p, i) => assert.deepEqual(R.auditJson(p.record), R.auditJson(eager.periods[i].record), `run ${run} period ${i + 1}`));
    R.accrueAll(lazy.state); R.accrueAll(eager.state);
    assert.equal(R.stateText(lazy.state), R.stateText(eager.state));
    if ([...lazy.state.wallets.values()].some((w) => w.lots.length === R.MAX_LOTS)) full++;
  }
  assert.ok(full >= 6, `wallets at ${R.MAX_LOTS} lots (merging) in only ${full} of 12 runs`);
});

test("an hourly sample rewrites only the lines of the wallets that traded", () => {
  const s = R.emptyState(), L = R.emptyLedger();
  const holders = { a: pct(1), b: pct(2), c: pct(3) };
  R.applySample(s, L, sampleOf(0, holders), CFG);
  R.applySample(s, L, sampleOf(3_600, holders), CFG);
  const before = R.stateText(s).split("\n");
  R.applySample(s, L, sampleOf(7_200, { ...holders, b: pct(2.5) }), CFG);
  const after = R.stateText(s).split("\n");
  const changed = after.filter((l, i) => l !== before[i]);
  assert.ok(changed.every((l) => !l.includes(addr("a")) && !l.includes(addr("c"))), "a and c did not trade: their lines are the same");
  assert.ok(changed.some((l) => l.includes(addr("b"))));
});

/* ── the close and the water-fill ───────────────────────────────────────────────────── */

test("allocate: pro rata by points, at most the cap each, floors, nothing over the pot, and what the cap holds back handed to nobody (a 20,000-case fuzz)", () => {
  const e = (m) => [...m.alloc].sort();
  let a = R.allocate(1_000n, [["x", 1n], ["y", 1n], ["z", 2n]], 100);
  assert.deepEqual(e(a), [["x", 250n], ["y", 250n], ["z", 500n]]);
  a = R.allocate(1_000n, [["x", 1n], ["y", 1n], ["z", 98n]], 10);
  assert.equal(a.capAmt, 100n, "10% of the pot, however few wallets have points");
  assert.deepEqual(e(a), [["x", 10n], ["y", 10n], ["z", 100n]], "z is capped; x and y get their points' share and no more");
  assert.equal(a.leftover, 880n, "what the cap held back stays in the pot (E − A) for later closes");
  a = R.allocate(1_000n, [["w", 900n], ...Array.from({ length: 20 }, (_, i) => [`s${i}`, 5n])], 10);
  assert.equal(a.capAmt, 100n);
  assert.equal(a.alloc.get("w"), 100n);
  assert.equal(a.alloc.get("s0"), 5n, "the capped wallet's excess is not shared out: each other wallet gets its points' share");
  assert.deepEqual(e(R.allocate(0n, [["x", 1n]], 10)), []);
  assert.deepEqual(e(R.allocate(10n, [["x", 0n]], 10)), []);
  assert.equal(R.allocate(10n, [], 10).leftover, 10n);
  assert.deepEqual(e(R.allocate(10n, [["x", 7n]], 10)), [["x", 1n]], "one wallet: at most 10% of the pot, the rest stays for later");
  assert.deepEqual(e(R.allocate(10n, [["x", 7n]], 100)), [["x", 10n]], "no cap (100%): one wallet takes the pot");
  assert.deepEqual(e(R.allocate(2n, [["x", 1n], ["y", 1n], ["z", 1n]], 10)), [["x", 0n], ["y", 0n], ["z", 0n]], "fewer lamports than wallets: nothing, and the pot stays");
  assert.throws(() => R.allocate(-1n, [], 10), R.RewardsError);
  assert.throws(() => R.allocate(1n, [], 0), R.RewardsError);
  // the fuzz: each wallet exactly min(floor(pot × pts / Σpts), floor(pot × cap / 100))
  const r = rng(42);
  let bad = 0;
  for (let i = 0; i < 20_000; i++) {
    const n = 1 + Math.floor(r() * 60);
    const entries = Array.from({ length: n }, (_, j) => [`a${j}`, BigInt(Math.floor(r() ** 3 * 1e12)) * BigInt(1 + Math.floor(r() * 1e6))]);
    const pot = BigInt(Math.floor(r() * 1e12));
    const cap = 1 + Math.floor(r() * 100);
    const { alloc, capAmt, total, leftover } = R.allocate(pot, entries, cap);
    const live = entries.filter(([, p]) => p > 0n);
    const tot = live.reduce((x, [, p]) => x + p, 0n);
    let s = 0n, capped = 0;
    for (const [k, p] of live) {
      const v = alloc.get(k) ?? 0n, pro = pot > 0n ? (pot * p) / tot : 0n;
      s += v;
      if (pot > 0n && v !== (pro < capAmt ? pro : capAmt)) bad++;
      if (v > capAmt || v * tot > pot * p) bad++;
      if (pro > capAmt) capped++;
    }
    if (s > pot || s !== total || leftover !== pot - s) bad++;
    if (live.length && !capped && pot - s >= BigInt(live.length)) bad++;
  }
  assert.equal(bad, 0);
});

test("the cap hands nobody another wallet's share: a two-hour minimum-balance sniper among few holders gets its points' share, not pot ÷ wallets; a split wallet next to a capped whale no more than its uncapped share", () => {
  const MIN = R.minBalance(SUPPLY, R.REWARDS_DEFAULTS.minBalancePpm);
  const close = (h) => simulate({ holders: h, days: 7.05, random: false, pay: false }).periods[0];
  for (const [honest, snipers] of [[1, 1], [3, 1], [5, 5]]) {
    const h = new Map();
    for (let i = 0; i < honest; i++) h.set(`H${i}`, [[0, pct(5)]]);
    for (let i = 0; i < snipers; i++) h.set(`SN${i}`, [[7 * DAY - 2 * HOUR, MIN]]);
    const p = close(h);
    let sn = 0n;
    for (let i = 0; i < snipers; i++) {
      const pts = p.pts.get(`SN${i}`), v = p.alloc.get(`SN${i}`);
      assert.ok(pts > 0n, "the sniper held for two hours: some points");
      assert.equal(v, (p.pot * pts) / p.totPts, "exactly its points' share");
      sn += v;
    }
    assert.ok(sn * 10_000n < p.pot, `${snipers} sniper(s) next to ${honest} holder(s) of a week: under 0.01% of the pot, not ${100 / (honest + snipers)}% (${share(sn, p.pot)})`);
    for (let i = 0; i < honest; i++) assert.equal(p.alloc.get(`H${i}`), p.capAmt, "each week-long holder is capped at 10% of the pot");
    assert.equal(p.capAmt, p.pot / 10n);
  }
  // An honest single-wallet whale of 20% (capped) next to 20% split into 50 wallets: the split gets its uncapped pro-rata share, never more.
  const mk = (cap) => { const h = background(); h.set("W", [[0, pct(20)]]); for (let i = 0; i < 50; i++) h.set(`X${i}`, [[0, pct(0.4)]]); return simulate({ holders: h, days: 7.05, random: false, pay: false, cfg: { walletCapPct: cap } }).periods[0]; };
  const capped = mk(10), open = mk(100);
  const split = (p) => [...p.alloc].filter(([n]) => n.startsWith("X")).reduce((x, [, v]) => x + v, 0n);
  assert.equal(capped.alloc.get("W"), capped.capAmt, "the whale: 10%");
  assert.ok(split(capped) <= split(open), `the split gets ${share(split(capped), capped.pot)} with the cap, ${share(split(open), open.pot)} without`);
  assert.ok(split(open) - split(capped) < 50n, "the same share, less at most a lamport a wallet");
  assert.equal(share(split(capped), capped.pot), "33.333%");
});

test("the close: pot = floor(max(0, E − A) × release), owed and A grow by the allocation, the period ends never drift", () => {
  const s = R.emptyState(), L = R.emptyLedger();
  const claim = (net, sharePct = 100) => { const g = sig(); R.recordClaimSending(L, { sig: g, lastValidBlockHeight: 1, sharePct, sentAt: NOW }); return R.settleClaim(L, g, { claimed: net > 0n ? net : 0n, walletFee: net > 0n ? 0n : -net, net }, { settledAt: NOW }); };
  claim(1_000_000_001n);
  const cfg = { ...CFG, everyDays: 1 };
  R.applySample(s, L, sampleOf(0, { a: pct(1), b: pct(3) }), cfg);
  let closed = null;
  for (let t = 3_000; !closed; t += 3_000) closed = R.applySample(s, L, sampleOf(t, { a: pct(1), b: pct(3) }), cfg).closed;
  assert.equal(closed.k, 1);
  assert.equal(closed.pot, 500_000_000n, "floor(1,000,000,001 × 50 / 100)");
  assert.equal(closed.A_before, 0n);
  assert.equal(closed.E, 1_000_000_001n);
  assert.equal(closed.start, T_BASE);
  assert.equal(closed.end, T_BASE + DAY);
  assert.equal(closed.T, T_BASE + 87_000, "the first sample at or after the end");
  const total = closed.rows.reduce((x, r) => x + r[2], 0n);
  assert.equal(L.A, total);
  assert.equal(W(s, "a").owed + W(s, "b").owed, total);
  assert.deepEqual(closed.rows.map((r) => r[0]), [addr("b"), addr("a")], "rows by points, largest first");
  assert.equal(s.period, 2);
  assert.equal(s.periodStart, T_BASE + DAY);
  assert.equal(s.periodEnd, T_BASE + 2 * DAY);
  assert.equal(s.intervals.length, 0);
  for (const w of s.wallets.values()) assert.equal(w.pts, 0n);
  assert.deepEqual(JSON.parse(R.auditText(closed)), R.auditJson(closed));
  // a five-day outage: one close, and the next end is the first nominal boundary past T
  const r2 = R.applySample(s, L, sampleOf(DAY + 5 * DAY + 100, { a: pct(1), b: pct(3) }), cfg);
  assert.equal(r2.closed.k, 2);
  assert.equal(s.periodEnd, T_BASE + 7 * DAY);
  assert.equal(s.periodStart, T_BASE + 6 * DAY);
  // E below A (a failed claim cost more than it gave): no pot until claims cover it
  claim(-(L.E - L.A) - 10n);
  assert.ok(L.E < L.A);
  let c3 = null;
  for (let t = 6 * DAY + 3_000; !c3; t += 3_000) c3 = R.applySample(s, L, sampleOf(t, { a: pct(1), b: pct(3) }), cfg).closed;
  assert.equal(c3.pot, 0n);
  assert.equal(c3.rows.every((r) => r[2] === 0n), true);
});

test("the close: an owner whose account can never be paid (a program, a mint, a nonce account) gets no share; it is listed in the period's record and its share stays in the pot", () => {
  const s = R.emptyState(), L = R.emptyLedger();
  const g = sig();
  R.recordClaimSending(L, { sig: g, lastValidBlockHeight: 1, sharePct: 100, sentAt: NOW });
  R.settleClaim(L, g, { claimed: 1_000_000_000n, walletFee: 0n, net: 1_000_000_000n }, { settledAt: NOW });
  const cfg = { ...CFG, everyDays: 1, walletCapPct: 100 };
  const hs = { a: pct(1), b: pct(1), prog: pct(2) };
  const unpayable = new Map([[addr("prog"), "its account is executable (a program)"]]);
  R.applySample(s, L, sampleOf(0, hs), cfg);
  let closed = null;
  for (let t = 3_600; !closed; t += 3_600) closed = R.applySample(s, L, sampleOf(t, hs), cfg, { unpayable }).closed;
  assert.equal(closed.refused.length, 1);
  assert.deepEqual([closed.refused[0][0], closed.refused[0][2]], [addr("prog"), "its account is executable (a program)"]);
  assert.ok(closed.refused[0][1] > 0n, "its points are shown");
  assert.deepEqual(closed.rows.map((r) => r[0]).sort(), [addr("a"), addr("b")].sort(), "only payable wallets share the pot");
  assert.equal(W(s, "prog").owed, 0n);
  assert.equal(W(s, "a").owed, closed.pot / 2n, "the two payable wallets split the pot between them");
  assert.equal(L.A, W(s, "a").owed + W(s, "b").owed);
  assert.deepEqual(JSON.parse(R.auditText(closed)).refused, [[addr("prog"), String(closed.refused[0][1]), "its account is executable (a program)"]]);
  assert.equal(R.identityProblem(s, L), null);
  assert.throws(() => R.closePeriod(s, L, { T: T_BASE + 9 * DAY, slot: 9 * DAY }, cfg, { unpayable: new Set() }), /Map/);
});

test("the supply check: a burn between the two mint reads of a fixed-supply mint is not a truncated answer; a missing row still is, and a mint that can still mint must match both reads", () => {
  const mintOf = (supply, authority = false) => {
    const d = Buffer.alloc(82); if (authority) { d.writeUInt32LE(1, 0); Buffer.from(base58Decode(LAUNCHER)).copy(d, 4); }
    d.writeBigUInt64LE(supply, 36); d[44] = 6; d[45] = 1;
    return { owner: TOKEN_2022_PROGRAM, lamports: 1_461_600, executable: false, data: [d.toString("base64"), "base64"] };
  };
  assert.equal(R.mintFromAccount(mintOf(SUPPLY)).fixedSupply, true, "no mint authority: the supply only falls");
  assert.equal(R.mintFromAccount(mintOf(SUPPLY, true)).fixedSupply, false);
  const burnt = SUPPLY - 1n;
  assert.equal(R.supplyProblem({ total: SUPPLY, supply: burnt, supplyBefore: SUPPLY, fixedSupply: true }), null, "one raw unit burnt after the token accounts' slot");
  assert.equal(R.supplyProblem({ total: burnt, supply: burnt - 5n, supplyBefore: SUPPLY, fixedSupply: true }), null, "burns on both sides of it");
  assert.match(R.supplyProblem({ total: SUPPLY - 10n, supply: burnt, supplyBefore: SUPPLY, fixedSupply: true }), /incomplete/, "a row missing: under the later supply");
  assert.match(R.supplyProblem({ total: SUPPLY + 1n, supply: SUPPLY, supplyBefore: SUPPLY, fixedSupply: true }), /incomplete/);
  assert.match(R.supplyProblem({ total: SUPPLY, supply: burnt, supplyBefore: SUPPLY, fixedSupply: false }), /incomplete/, "a mint that can still mint: no bracket");
  assert.equal(R.supplyProblem({ total: SUPPLY, supply: SUPPLY, supplyBefore: SUPPLY, fixedSupply: false }), null);
  assert.match(R.supplyProblem({ total: SUPPLY, supply: burnt }), /incomplete/, "one read only: equality");
});

test("a changed mint: sampling stops; new_epoch closes the period at the last sample, clears lots and points, keeps owed; genesis follows", () => {
  const s = R.emptyState(), L = R.emptyLedger();
  const g = sig();
  R.recordClaimSending(L, { sig: g, lastValidBlockHeight: 1, sharePct: 100, sentAt: NOW });
  R.settleClaim(L, g, { claimed: 400_000_000n, walletFee: 0n, net: 400_000_000n }, { settledAt: NOW });
  R.applySample(s, L, sampleOf(0, { a: pct(1) }), CFG);
  R.applySample(s, L, sampleOf(3_600, { a: pct(1) }), CFG);
  const other = LAUNCHER; // any other address as the new contract
  const gate = R.mintGate({ contract: other, account: mintAccount(), state: s });
  assert.equal(gate.ok, false);
  assert.equal(gate.changed, true);
  assert.throws(() => R.startNewEpoch(s, L, { mint: other, contract: MINT }), /equal/);
  assert.throws(() => R.startNewEpoch(s, L, { mint: "x", contract: "x" }), /address/);
  const closed = R.startNewEpoch(s, L, { mint: other, contract: other });
  assert.equal(closed.k, 1);
  assert.equal(closed.T, T_BASE + 3_600);
  assert.equal(closed.pot, 200_000_000n);
  const owed = W(s, "a").owed;
  assert.ok(owed > 0n);
  assert.deepEqual(W(s, "a").lots, []);
  assert.equal(s.epoch, null);
  assert.equal(s.mint, null);
  assert.equal(R.mintGate({ contract: other, account: mintAccount(), state: s }).ok, true, "the gate passes for the new contract");
  assert.equal(R.identityProblem(s, L), null);
  const r = R.applySample(s, L, { ...sampleOf(9_000, { a: pct(2) }), mint: other }, CFG);
  assert.equal(r.status, "genesis");
  assert.equal(s.period, 2);
  assert.deepEqual(W(s, "a").lots, [[pct(2), 0]]);
  assert.equal(W(s, "a").owed, owed);
  assert.deepEqual(R.validateRewardsState(JSON.parse(R.stateText(s))), s);
});

/* ── payouts ────────────────────────────────────────────────────────────────────────── */

/** A state with wallets owed given amounts (holding: a lot; not: none). */
function owedState(rows) {
  const s = R.emptyState();
  Object.assign(s, { mint: MINT, tokenProgram: TOKEN_2022_PROGRAM, decimals: 6, epoch: T_BASE, tPrev: T_BASE, slotPrev: 1, period: 1, periodStart: T_BASE, periodEnd: T_BASE + 7 * DAY });
  for (const [name, owed, holding = true] of rows) s.wallets.set(addr(name), { lots: holding ? [[pct(1), 0]] : [], pts: 0n, ptsAt: 0, owed, first: T_BASE });
  return s;
}
const sysAcct = (lamports, extra = {}) => ({ lamports, owner: SYSTEM_PROGRAM, executable: false, data: ["", "base64"], ...extra });

test("who is due: the thresholds with the fee, the sold-out threshold, the recipient's account, the rent rule", () => {
  const F1 = R.payoutFee(1, 100_000);
  const MP = 1_000_000n;
  const s = owedState([
    ["under", MP + F1 - 1n], ["at", MP + F1], ["exit", R.EXIT_MIN + F1, false], ["exitUnder", R.EXIT_MIN + F1 - 1n, false],
    ["zero", RENT + F1 - 1n, false], ["zeroOk", RENT + F1, false], ["low", 100_000_000n], ["token", 50_000_000n], ["exec", 50_000_000n], ["data", 50_000_000n], ["unread", 50_000_000n],
  ]);
  s.wallets.set(LAUNCHER, { lots: [], pts: 0n, ptsAt: 0, owed: 50_000_000n, first: null });
  const accounts = new Map([
    [addr("under"), sysAcct(10_000_000)], [addr("at"), sysAcct(10_000_000)], [addr("exit"), sysAcct(10_000_000)], [addr("exitUnder"), sysAcct(10_000_000)],
    [addr("zero"), null], [addr("zeroOk"), null], [addr("low"), sysAcct(1)],
    [addr("token"), { lamports: 2_039_280, owner: TOKEN_PROGRAM, executable: false, data: [Buffer.alloc(165).toString("base64"), "base64"] }],
    [addr("exec"), sysAcct(5_000_000, { executable: true })], [addr("data"), sysAcct(5_000_000, { data: [Buffer.alloc(8).toString("base64"), "base64"] })],
    [LAUNCHER, sysAcct(1_000_000_000)],
  ]);
  const plan = R.planPayouts(s, { pot: 10_000_000_000n, accounts, rent: RENT, priceMicroLamports: 100_000, minPayoutLamports: MP, payer: LAUNCHER });
  const paidTo = new Map(plan.payouts.map((p) => [p.owner, p]));
  const carried = new Map(plan.carry.map((c) => [c.owner, c.reason]));
  for (const n of ["at", "exit", "zeroOk", "low"]) assert.ok(paidTo.has(addr(n)), n);
  for (const n of ["under", "exitUnder", "zero", "token", "exec", "data", "unread"]) assert.ok(carried.has(addr(n)), n);
  assert.ok(carried.has(LAUNCHER) && !paidTo.has(LAUNCHER), "the payer is never a recipient");
  assert.match(carried.get(addr("under")), /threshold/);
  assert.match(carried.get(addr("zero")), /rent/);
  assert.match(carried.get(addr("token")), /System Program/);
  assert.match(carried.get(addr("exec")), /executable/);
  assert.match(carried.get(addr("data")), /data/);
  assert.match(carried.get(addr("unread")), /not read/);
  assert.equal(plan.dust, (MP + F1 - 1n) + (R.EXIT_MIN + F1 - 1n), "dust: owed under the threshold");
  for (const p of plan.payouts) {
    const w = s.wallets.get(p.owner);
    const thr = w.lots.length ? MP : R.EXIT_MIN;
    assert.ok(p.lamports >= thr, "net ≥ its threshold");
    const lam = accounts.get(p.owner) === null ? 0n : BigInt(accounts.get(p.owner).lamports);
    assert.ok(lam + p.lamports >= RENT, "the account ends rent-exempt");
    assert.ok(p.lamports + p.share <= w.owed);
  }
  // the rent: unreadable, no payouts at all
  const none = R.planPayouts(s, { pot: 10_000_000_000n, accounts, rent: null });
  assert.equal(none.payouts.length, 0);
  assert.ok(none.carry.every((c) => /rent-exempt minimum could not be read/.test(c.reason)));
  // with the live value: an account of 1 lamport is paid when 1 + owed − FEE1 ≥ rent
  const edge = owedState([["e1", RENT - 1n + F1, false], ["e2", RENT - 2n + F1, false]]);
  const ep = R.planPayouts(edge, { pot: 10n ** 12n, accounts: new Map([[addr("e1"), sysAcct(1)], [addr("e2"), sysAcct(1)]]), rent: RENT });
  assert.deepEqual(ep.payouts.map((p) => p.owner), [addr("e1")]);
});

test("batches: at most 20 to a transaction, in transactions of near-equal size, owed descending then address, fee shares summing exactly to the fee", () => {
  const rows = Array.from({ length: 45 }, (_, i) => [`p${String(i).padStart(2, "0")}`, 5_000_000n + BigInt(i % 7) * 1_000n]);
  const s = owedState(rows);
  const accounts = new Map(rows.map(([n]) => [addr(n), sysAcct(10_000_000)]));
  const plan = R.planPayouts(s, { pot: 10n ** 12n, accounts, rent: RENT, priceMicroLamports: 123_457 });
  assert.deepEqual(plan.batches.map((b) => b.rows.length), [15, 15, 15], "three transactions either way; no small tail carrying a whole fee");
  // 21 wallets at the default price: [11, 10], not [20, 1] (whose last wallet paid 5,130 lamports, 18 times a full batch's 285).
  const s21 = owedState(rows.slice(0, 21)), p21 = R.planPayouts(s21, { pot: 10n ** 12n, accounts, rent: RENT });
  assert.deepEqual(p21.batches.map((b) => b.rows.length), [11, 10]);
  assert.equal(p21.batches.reduce((x, b) => x + b.fee, 0n), R.payoutFee(20, 100_000) + R.payoutFee(1, 100_000), "the same total fee as [20, 1]");
  const most = p21.payouts.reduce((x, r) => (r.share > x ? r.share : x), 0n), least = p21.payouts.reduce((x, r) => (r.share < x ? r.share : x), 10n ** 9n);
  assert.ok(most <= 541n && most - least <= 60n, `shares ${least}..${most} lamports`);
  for (const [n, sizes] of [[1, [1]], [20, [20]], [40, [20, 20]], [41, [14, 14, 13]]]) {
    const st = owedState(Array.from({ length: n }, (_, i) => [`q${i}`, 5_000_000n]));
    assert.deepEqual(R.planPayouts(st, { pot: 10n ** 12n, accounts: new Map([...st.wallets.keys()].map((a) => [a, sysAcct(10_000_000)])), rent: RENT }).batches.map((b) => b.rows.length), sizes, `${n} wallets`);
  }
  const order = rows.map(([n, o]) => [addr(n), o]).sort((x, y) => (x[1] === y[1] ? (x[0] < y[0] ? -1 : 1) : x[1] > y[1] ? -1 : 1)).map((x) => x[0]);
  assert.deepEqual(plan.payouts.map((p) => p.owner), order);
  for (const b of plan.batches) {
    const k = BigInt(b.rows.length), f = R.payoutFee(b.rows.length, 123_457);
    assert.equal(b.fee, f);
    assert.equal(b.rows.reduce((x, r) => x + r.share, 0n), f);
    b.rows.forEach((r, j) => assert.equal(r.share, f / k + (BigInt(j) < f % k ? 1n : 0n)));
    assert.equal(b.debit, b.rows.reduce((x, r) => x + r.lamports + r.share, 0n));
    assert.equal(b.debit, b.rows.reduce((x, r) => x + s.wallets.get(r.owner).owed, 0n), "each wallet's debit is exactly what it is owed");
  }
  // the run's transaction cap
  const two = R.planPayouts(s, { pot: 10n ** 12n, accounts, rent: RENT, maxTx: 2 });
  assert.equal(two.batches.length, 2);
  assert.equal(two.carry.filter((c) => /MAX_TX/.test(c.reason)).length, 5);
});

test("the pot: never spent past, a wallet paid in part when the run's budget runs short, carry never lost", () => {
  const s = owedState([["big", 3_000_000_000n], ["mid", 500_000_000n], ["small", 2_000_000n]]);
  const accounts = new Map([["big", 0], ["mid", 0], ["small", 0]].map(([n]) => [addr(n), sysAcct(10_000_000)]));
  const plan = R.planPayouts(s, { pot: 2_000_000_000n, accounts, rent: RENT });
  assert.equal(plan.spend, 2_000_000_000n);
  assert.deepEqual(plan.payouts.map((p) => p.owner), [addr("big")], "the largest first, in part");
  const totalOwed = 3_502_000_000n;
  assert.equal(plan.spend + plan.carried, totalOwed, "what is not paid is carried, to the lamport");
  // fuzz: random owed, lamports, pots, prices; spend ≤ pot, rows within owed, thresholds and rent hold
  const r = rng(77);
  for (let i = 0; i < 400; i++) {
    const n = 1 + Math.floor(r() * 70);
    const rows = Array.from({ length: n }, (_, j) => [`f${j}`, BigInt(Math.floor(r() ** 2 * 2e9)), r() < 0.7]);
    const st = owedState(rows);
    const acc = new Map(rows.map(([nm]) => [addr(nm), r() < 0.3 ? null : sysAcct(Math.floor(r() * 2_000_000))]));
    const pot = BigInt(Math.floor(r() * 5e9));
    const price = Math.floor(r() * 1_000_001);
    const minPay = BigInt(100_000 + Math.floor(r() * 5_000_000));
    const p = R.planPayouts(st, { pot, accounts: acc, rent: RENT, priceMicroLamports: price, minPayoutLamports: minPay, maxTx: 1 + Math.floor(r() * 5) });
    assert.ok(p.spend <= pot);
    let owedAll = 0n;
    for (const w of st.wallets.values()) owedAll += w.owed;
    assert.equal(p.spend + p.carried, owedAll);
    for (const b of p.batches) assert.equal(b.rows.reduce((x, y) => x + y.share, 0n), b.fee);
    for (const q of p.payouts) {
      const w = st.wallets.get(q.owner);
      assert.ok(q.lamports + q.share <= w.owed);
      assert.ok(q.lamports >= (w.lots.length ? minPay : R.EXIT_MIN));
      const a = acc.get(q.owner);
      assert.ok((a === null ? 0n : BigInt(a.lamports)) + q.lamports >= RENT);
    }
  }
  assert.throws(() => R.planPayouts(s, { pot: -1n, accounts, rent: RENT }), R.RewardsError);
});

/* ── the payout transaction ─────────────────────────────────────────────────────────── */

test("the payout transaction: sizes (18: 1,100 bytes; 20: 1,198; 21 too big), and gate 1 refuses any other message", () => {
  const payer = LAUNCHER, blockhash = base58Encode(randomBytes(32));
  const rowsOf = (n) => Array.from({ length: n }, () => ({ owner: base58Encode(randomBytes(32)), lamports: 1_000_000_000n }));
  const b18 = R.buildPayoutMessage({ payer, recentBlockhash: blockhash, rows: rowsOf(18), priceMicroLamports: 100_000 });
  assert.equal(b18.size, 1_100);
  const rows20 = rowsOf(20);
  const b20 = R.buildPayoutMessage({ payer, recentBlockhash: blockhash, rows: rows20, priceMicroLamports: 100_000 });
  assert.equal(b20.size, 1_198);
  assert.equal(b20.fee, 5_700n);
  assert.equal(b20.fee / 20n, 285n);
  // 21 transfers do not fit (compiled by hand: the module will not build one)
  const transfer = (to) => R.transferInstruction(payer, to, 1_000_000_000n);
  const m21 = compileLegacyMessage({ payer, recentBlockhash: blockhash, instructions: [setComputeUnitLimit(1_000 + 300 * 21), setComputeUnitPrice(100_000), ...rowsOf(21).map((r) => transfer(r.owner))] });
  assert.equal(1 + 64 + m21.bytes.length, 1_247);
  assert.ok(1 + 64 + m21.bytes.length > PACKET_DATA_SIZE);
  assert.throws(() => R.buildPayoutMessage({ payer, recentBlockhash: blockhash, rows: rowsOf(21), priceMicroLamports: 100_000 }), R.RewardsError);
  const ok = R.checkPayoutMessage(b20.messageBytes, { payer, rows: rows20, priceMicroLamports: 100_000 });
  assert.equal(ok.total, 20_000_000_000n + 5_700n);
  // tampering: another amount, another recipient, a swapped order, an extra writable, another price or limit, another signer
  const refuse = (instructions, rows = rows20, p = payer) => assert.throws(() => R.checkPayoutMessage(compileLegacyMessage({ payer: p, recentBlockhash: blockhash, instructions }).bytes, { payer, rows, priceMicroLamports: 100_000 }), R.RewardsError);
  const base = () => R.payoutInstructions({ payer, rows: rows20, priceMicroLamports: 100_000 });
  let ix = base(); ix[2] = R.transferInstruction(payer, rows20[0].owner, 1_000_000_001n); refuse(ix);
  ix = base(); ix[5] = R.transferInstruction(payer, base58Encode(randomBytes(32)), 1_000_000_000n); refuse(ix);
  ix = base(); [ix[2], ix[3]] = [ix[3], ix[2]]; refuse(ix);
  ix = base(); ix[4] = { ...ix[4], keys: [...ix[4].keys, { pubkey: base58Encode(randomBytes(32)), isSigner: false, isWritable: true }] }; refuse(ix);
  ix = base(); ix[1] = setComputeUnitPrice(100_001); refuse(ix);
  ix = base(); ix[0] = setComputeUnitLimit(7_001); refuse(ix);
  ix = base(); ix.push(R.transferInstruction(payer, base58Encode(randomBytes(32)), 1n)); refuse(ix);
  ix = base(); ix[3] = R.transferInstruction(payer, rows20[0].owner, 1_000_000_000n); refuse(ix, rows20.map((r, i) => (i === 1 ? rows20[0] : r)));
  refuse(base(), rows20, base58Encode(randomBytes(32)));
  // a stray read-only key in the account list
  const m = compileLegacyMessage({ payer, recentBlockhash: blockhash, instructions: base() });
  const stray = decodeLegacyMessage(m.bytes);
  stray.accountKeys.push(base58Encode(randomBytes(32)));
  stray.header.numReadonlyUnsignedAccounts += 1;
  assert.throws(() => R.checkPayoutMessage(encodeLegacyMessage(stray), { payer, rows: rows20, priceMicroLamports: 100_000 }), R.RewardsError);
  // gate 5: the payer lost at most the batch, every recipient ends rent-exempt
  const before = new Map([[payer, 30_000_000_000n], ...rows20.map((r) => [r.owner, 0n])]);
  const after = new Map([[payer, 30_000_000_000n - 20_000_000_000n - 5_700n], ...rows20.map((r) => [r.owner, r.lamports])]);
  const gate5 = (x = after) => R.simulationProblem({ payer, rows: rows20, fee: 5_700n, before, after: x, rent: RENT });
  assert.equal(gate5(), null);
  // Balances read around the simulation move for reasons of their own: a recipient that trades, a deposit to the payer. Neither stops the payout.
  assert.equal(gate5(new Map([...after, [rows20[3].owner, rows20[3].lamports - 7_000n]])), null, "a recipient that paid a fee of its own meanwhile");
  assert.equal(gate5(new Map([...after, [payer, after.get(payer) + 1_000_000n]])), null, "someone sent the payer SOL meanwhile");
  assert.match(gate5(new Map([...after, [payer, after.get(payer) - 1n]])), /took 20000005701 lamports from the payer, more than the batch's 20000005700/);
  assert.match(gate5(new Map([...after, [rows20[3].owner, RENT - 1n]])), /under the rent-exempt minimum/);
  const noRow = new Map(after); noRow.delete(rows20[5].owner);
  assert.match(gate5(noRow), /no balance for/);
  const noPayer = new Map(after); noPayer.delete(payer);
  assert.match(gate5(noPayer), /no balance for the payer/);
});

/* ── the ledger ─────────────────────────────────────────────────────────────────────── */

test("claims: the holder share is fixed when the claim is sent; a failed claim's fee comes off E, rounded toward −∞; an expired one changes nothing", () => {
  const L = R.emptyLedger();
  const g1 = sig(), g2 = sig(), g3 = sig();
  R.recordClaimSending(L, { sig: g1, lastValidBlockHeight: 10, sharePct: 50, sentAt: NOW });
  // the owner changes REWARDS_HOLDER_SHARE_PCT to 100 before the claim settles: the row keeps 50
  assert.equal(R.rewardsConfig({ REWARDS_HOLDER_SHARE_PCT: "100" }).holderSharePct, 100);
  assert.equal(R.settleClaim(L, g1, { claimed: 1_000_005_001n, walletFee: 5_000n, net: 1_000_000_001n }, { settledAt: NOW }), 500_000_000n);
  assert.equal(L.E, 500_000_000n);
  R.recordClaimSending(L, { sig: g2, lastValidBlockHeight: 11, sharePct: 50, sentAt: NOW });
  assert.equal(R.settleClaim(L, g2, { failed: true, claimed: 0n, walletFee: 5_001n, net: -5_001n }, { settledAt: NOW }), -2_501n);
  assert.equal(L.E, 500_000_000n - 2_501n);
  R.recordClaimSending(L, { sig: g3, lastValidBlockHeight: 12, sharePct: 100, sentAt: NOW });
  assert.equal(R.settleClaim(L, g3, { status: "expired" }, { settledAt: NOW }), 0n);
  assert.equal(L.E, 500_000_000n - 2_501n);
  assert.throws(() => R.settleClaim(L, g3, { status: "expired" }, { settledAt: NOW }), /already settled/);
  assert.throws(() => R.recordClaimSending(L, { sig: g1, lastValidBlockHeight: 1, sharePct: 50, sentAt: NOW }), /already/);
  assert.throws(() => R.recordClaimSending(L, { sig: sig(), lastValidBlockHeight: 1, sharePct: 101, sentAt: NOW }), /sharePct/);
  const g4 = sig();
  R.recordClaimSending(L, { sig: g4, lastValidBlockHeight: 1, sharePct: 0, sentAt: NOW });
  assert.throws(() => R.settleClaim(L, g4, { claimed: 10n, walletFee: 0n, net: 9n }, { settledAt: NOW }), /net/);
  assert.equal(R.settleClaim(L, g4, { claimed: 10n, walletFee: 0n, net: 10n }, { settledAt: NOW }), 0n, "a 0% share gives the holders nothing");
  assert.deepEqual(R.validateRewardsLedger(JSON.parse(R.ledgerText(L))), L);
});

test("the ledger identity after every step; I1 and I2 refuse; payouts settle as paid, failed or expired", () => {
  const s = R.emptyState(), L = R.emptyLedger();
  const cfg = { ...CFG, everyDays: 1 };
  const g = sig();
  R.recordClaimSending(L, { sig: g, lastValidBlockHeight: 1, sharePct: 100, sentAt: NOW });
  assert.equal(R.identityProblem(s, L), null);
  R.settleClaim(L, g, { claimed: 2_000_000_000n, walletFee: 0n, net: 2_000_000_000n }, { settledAt: NOW });
  const hs = { a: pct(1), b: pct(2), c: pct(3) };
  R.applySample(s, L, sampleOf(0, hs), cfg);
  for (let t = 3_600; t <= DAY; t += 3_600) { R.applySample(s, L, sampleOf(t, hs), cfg); assert.equal(R.identityProblem(s, L), null); }
  assert.ok(L.A > 0n && L.A <= 1_000_000_000n, "half of the 2 SOL was released and allocated");
  const accounts = new Map(Object.keys(hs).map((n) => [addr(n), sysAcct(10_000_000)]));
  const budget = R.payoutBudget(L, { maxLamportsPerRun: 2_000_000_000n });
  assert.equal(budget, 2_000_000_000n);
  const plan = R.planPayouts(s, { pot: budget, accounts, rent: RENT, maxTx: 10, perTx: 1 });
  assert.equal(plan.batches.length, 3);
  const [b1, b2, b3] = plan.batches;
  const [s1, s2, s3] = [sig(), sig(), sig()];
  R.recordPayoutSending(s, L, b1, { sig: s1, lastValidBlockHeight: 5, sentAt: NOW });
  assert.equal(R.identityProblem(s, L), null);
  assert.equal(R.inFlightLamports(L), b1.debit);
  R.recordPayoutSending(s, L, b2, { sig: s2, lastValidBlockHeight: 5, sentAt: NOW });
  R.recordPayoutSending(s, L, b3, { sig: s3, lastValidBlockHeight: 5, sentAt: NOW });
  assert.equal(R.identityProblem(s, L), null);
  const owedBefore = (b) => b.rows[0].lamports + b.rows[0].share;
  R.settlePayout(s, L, s1, "paid", { settledAt: NOW });
  assert.equal(L.P, b1.rows[0].lamports);
  assert.equal(L.F, b1.fee);
  assert.equal(R.identityProblem(s, L), null);
  R.settlePayout(s, L, s2, "failed", { settledAt: NOW });
  assert.equal(L.F, b1.fee + b2.fee);
  assert.equal(s.wallets.get(b2.rows[0].owner).owed, b2.rows[0].lamports, "a failed payout gives back the net; its fee is spent");
  assert.equal(R.identityProblem(s, L), null);
  R.settlePayout(s, L, s3, "expired", { settledAt: NOW });
  assert.equal(s.wallets.get(b3.rows[0].owner).owed, owedBefore(b3), "an expired payout gives back everything");
  assert.equal(R.identityProblem(s, L), null);
  assert.throws(() => R.settlePayout(s, L, s3, "paid", { settledAt: NOW }), /already settled/);
  assert.deepEqual(R.validateRewardsLedger(JSON.parse(R.ledgerText(L))), L);
  assert.deepEqual(R.validateRewardsState(JSON.parse(R.stateText(s))), s);
  // I1: a batch that would take P + F + in flight past E is refused, and never written
  const big = { rows: [{ owner: addr("a"), lamports: L.E - L.P - L.F, share: 1n }], fee: 1n, debit: L.E - L.P - L.F + 1n };
  s.wallets.get(addr("a")).owed += 10n ** 12n; L.A += 10n ** 12n; // pretend it is owed more (a corrupt allocation)
  assert.match(R.i1Problem(L, big.debit), /^I1/);
  const rowsBefore = L.payouts.length;
  assert.throws(() => R.recordPayoutSending(s, L, big, { sig: sig(), lastValidBlockHeight: 1, sentAt: NOW }), /I1/);
  assert.equal(L.payouts.length, rowsBefore);
  assert.equal(R.i1Problem(L, L.E - L.P - L.F), null, "exactly E is allowed");
  s.wallets.get(addr("a")).owed -= 10n ** 12n; L.A -= 10n ** 12n;
  // I2: the wallet must still hold the launch minimum plus the holders' unpaid
  const unpaid = L.E - L.P - L.F;
  assert.equal(R.i2Problem(L, { balance: 20_000_000n + unpaid, minBalanceLamports: 20_000_000n }), null);
  assert.match(R.i2Problem(L, { balance: 20_000_000n + unpaid - 1n, minBalanceLamports: 20_000_000n }), /spent holders' SOL/);
  // other refusals
  assert.throws(() => R.recordPayoutSending(s, L, { rows: [{ owner: addr("zz"), lamports: 1n, share: 0n }], fee: 0n }, { sig: sig(), lastValidBlockHeight: 1, sentAt: NOW }), /not owed/);
  assert.throws(() => R.recordPayoutSending(s, L, { rows: [{ owner: b2.rows[0].owner, lamports: 1n, share: 1n }], fee: 5n }, { sig: sig(), lastValidBlockHeight: 1, sentAt: NOW }), /shares/);
  assert.throws(() => R.recordPayoutSending(s, L, b1, { sig: s1, lastValidBlockHeight: 1, sentAt: NOW }), /already/);
});

test("holds: a held wallet is carried until its hold ends, or (an expired payout's) until the wallet's history is counted past it; with no clock, every hold holds", () => {
  const s = owedState([["a", 50_000_000n], ["b", 40_000_000n]]);
  const accounts = new Map([[addr("a"), sysAcct(10_000_000)], [addr("b"), sysAcct(10_000_000)]]);
  const plan = (nowMs) => R.planPayouts(s, { pot: 10n ** 12n, accounts, rent: RENT, nowMs });
  R.holdWallets(s, [addr("a")], { until: "2026-10-01T00:00:00Z", reason: "its payout failed in simulation ({\"InstructionError\":[2,\"ReadonlyLamportChange\"]})" });
  let p = plan(Date.parse("2026-09-30T12:00:00Z"));
  assert.deepEqual(p.payouts.map((x) => x.owner), [addr("b")]);
  assert.match(p.carry.find((c) => c.owner === addr("a")).reason, /^held until 2026-10-01T00:00:00Z: its payout failed in simulation/);
  assert.deepEqual(plan(Date.parse("2026-10-01T00:00:00Z")).payouts.map((x) => x.owner), [addr("a"), addr("b")], "the hold has ended: tried again");
  assert.deepEqual(plan(null).payouts.map((x) => x.owner), [addr("b")], "no clock: held");
  // An expired payout's hold is released once a signature newer than its slot is counted.
  R.holdWallets(s, [addr("b")], { until: "2026-10-01T06:00:00Z", slot: 500, reason: "the payout 2AAAA… expired" });
  assert.equal(R.releaseHolds(s, 500), 0, "a signature of the slot itself: not past it");
  assert.equal(R.releaseHolds(s, 501), 1);
  assert.equal(W(s, "b").hold, undefined);
  assert.ok(W(s, "a").hold, "a time-only hold stays");
  assert.throws(() => R.holdWallets(s, [addr("a")], { until: "soon", reason: "x" }), R.RewardsError);
  // A payout sent to a wallet clears its (ended) hold.
  const L = R.emptyLedger();
  const g = sig();
  R.recordClaimSending(L, { sig: g, lastValidBlockHeight: 1, sharePct: 100, sentAt: NOW });
  R.settleClaim(L, g, { claimed: 1_000_000_000n, walletFee: 0n, net: 1_000_000_000n }, { settledAt: NOW });
  L.A = 90_000_000n;
  const b = plan(Date.parse("2026-10-02T00:00:00Z")).batches[0];
  R.recordPayoutSending(s, L, b, { sig: sig(), lastValidBlockHeight: 1, sentAt: NOW });
  assert.equal(W(s, "a").hold, undefined);
  assert.equal(R.identityProblem(s, L), null);
});

test("an expired claim or payout found on chain after all is settled as what it did: a claim counted, a payout paid or failed (never paid twice)", () => {
  const L = R.emptyLedger(), s = owedState([["a", 50_000_000n], ["b", 40_000_000n]]);
  const g = sig();
  R.recordClaimSending(L, { sig: g, lastValidBlockHeight: 1, sharePct: 80, sentAt: NOW });
  R.settleClaim(L, g, { status: "expired" }, { settledAt: NOW });
  assert.equal(L.E, 0n);
  assert.throws(() => R.landExpiredClaim(L, g, { claimed: 10n, walletFee: 0n, net: 9n }, { settledAt: NOW }), /net/);
  assert.equal(L.claims[0].status, "expired", "a bad measurement changes nothing");
  assert.equal(R.landExpiredClaim(L, g, { claimed: 1_000_005_000n, walletFee: 5_000n, net: 1_000_000_000n }, { settledAt: NOW }), 800_000_000n, "counted at the share fixed when it was sent");
  assert.deepEqual([L.claims[0].status, L.E], ["landed", 800_000_000n]);
  assert.throws(() => R.landExpiredClaim(L, g, {}, { settledAt: NOW }), /no expired claim/);
  L.A = 90_000_000n;
  const accounts = new Map([[addr("a"), sysAcct(10_000_000)], [addr("b"), sysAcct(10_000_000)]]);
  const b = R.planPayouts(s, { pot: 10n ** 12n, accounts, rent: RENT, nowMs: 0 }).batches[0];
  const send = () => { const x = sig(); R.recordPayoutSending(s, L, b, { sig: x, lastValidBlockHeight: 1, sentAt: NOW }); R.settlePayout(s, L, x, "expired", { settledAt: NOW }); return x; };
  // Paid after all: the wallets are owed what it paid them no more.
  const paid = send();
  assert.equal(R.landExpiredPayout(s, L, paid, "paid", { settledAt: NOW }), null);
  assert.deepEqual([W(s, "a").owed, W(s, "b").owed, L.P, L.F], [0n, 0n, b.debit - b.fee, b.fee]);
  assert.equal(R.identityProblem(s, L), null);
  // Failed after all: its fee was spent (each wallet's share of it), the rest still owed.
  s.wallets.get(addr("a")).owed = 50_000_000n; s.wallets.get(addr("b")).owed = 40_000_000n; L.A += 90_000_000n;
  const failed = send();
  assert.equal(R.landExpiredPayout(s, L, failed, "failed", { settledAt: NOW }), null);
  assert.deepEqual([W(s, "a").owed, W(s, "b").owed, L.F], [50_000_000n - b.rows[0].share, 40_000_000n - b.rows[1].share, 2n * b.fee]);
  assert.equal(R.identityProblem(s, L), null);
  // Paid again meanwhile (its wallets no longer owed that much): refused, nothing changed.
  s.wallets.get(addr("a")).owed = 50_000_000n; s.wallets.get(addr("b")).owed = 40_000_000n; L.A = L.P + L.F + 90_000_000n;
  const again = send();
  s.wallets.get(addr("a")).owed -= 1n; L.A -= 1n;
  const before = R.ledgerText(L);
  assert.match(R.landExpiredPayout(s, L, again, "paid", { settledAt: NOW }), /no longer owed/);
  assert.equal(R.ledgerText(L), before);
  assert.deepEqual(R.validateRewardsLedger(JSON.parse(R.ledgerText(L))), L);
});

test("the launcher's earmark: the holders' unpaid plus what unrecorded or unsettled claims brought in; none without a ledger", () => {
  const L = R.emptyLedger();
  assert.equal(R.earmarkLamports(null), 0n, "no rewards ledger: the earmark is 0");
  assert.equal(R.earmarkLamports(L), 0n);
  const g = sig();
  R.recordClaimSending(L, { sig: g, lastValidBlockHeight: 1, sharePct: 100, sentAt: NOW });
  R.settleClaim(L, g, { claimed: 700n, walletFee: 0n, net: 700n }, { settledAt: NOW });
  const pending = sig(), payout = sig(), unknown = sig(), other = sig();
  R.recordClaimSending(L, { sig: pending, lastValidBlockHeight: 1, sharePct: 100, sentAt: NOW });
  L.payouts.push({ sig: payout, lastValidBlockHeight: 1, status: "paid", fee: 0n, sentAt: NOW, settledAt: NOW, rows: [[addr("a"), 100n, 0n]] });
  L.P = 100n;
  assert.deepEqual(R.earmarkSignatures(L, [unknown, pending, g, payout, other]), [unknown, pending, other], "unlisted, or a claim still sending");
  assert.equal(R.earmarkLamports(L, [250n, -40n, 0, 10]), 600n + 250n + 10n, "max(0, E − P − F) + the positive changes");
  L.E = -5n; L.claims.length = 0;
  assert.equal(R.earmarkLamports(L), 0n, "a negative E − P − F earmarks nothing");
  assert.equal(R.classifySignature(L, pending), "other");
  assert.equal(R.classifySignature(L, payout), "payout");
  R.advanceCursor(L, other);
  assert.equal(L.cursor, other);
  assert.throws(() => R.advanceCursor(L, "x"), R.RewardsError);
});

/* ── the validators ─────────────────────────────────────────────────────────────────── */

test("the state and the ledger files: round trips, and every kind of corruption is refused", () => {
  const holders = new Map([["a", [[0, pct(1)], [2 * DAY, pct(2)]]], ["b", [[0, pct(3)], [3 * DAY, pct(1)]]], ["c", [[DAY, pct(0.5)]]]]);
  const e = simulate({ holders, days: 9, cfg: { everyDays: 2 } });
  e.state.wallets.set(addr("zz"), { lots: [], pts: 0n, ptsAt: 0, owed: 5n, first: null });
  e.ledger.A += 5n;
  // the rules in force, and a wallet held out of the payouts
  assert.equal(R.setRules(e.state, R.rewardsConfig({ REWARDS_EVERY_DAYS: "2", REWARDS_MIN_PAYOUT_SOL: "0.002" })), true);
  assert.equal(R.setRules(e.state, R.rewardsConfig({ REWARDS_EVERY_DAYS: "2", REWARDS_MIN_PAYOUT_SOL: "0.002" })), false, "unchanged: nothing to write");
  R.holdWallets(e.state, [addr("zz")], { until: NOW, slot: 12, reason: "its payout failed in simulation" });
  const sj = JSON.parse(R.stateText(e.state)), lj = JSON.parse(R.ledgerText(e.ledger));
  assert.deepEqual(sj.rules, { everyDays: 2, releasePct: 50, walletCapPct: 10, minBalancePpm: 100, minPayoutLamports: "2000000" });
  assert.deepEqual(sj.wallets[addr("zz")].hold, { until: NOW, slot: 12, reason: "its payout failed in simulation" });
  assert.equal(R.stateText(e.state).split("\n").filter((l) => l.includes('"hold"')).length, 1, "only a held wallet's line carries a hold");
  assert.deepEqual(R.validateRewardsState(sj), e.state);
  assert.deepEqual(R.validateRewardsLedger(lj), e.ledger);
  assert.deepEqual(R.validateRewardsState(null), R.emptyState());
  assert.deepEqual(R.validateRewardsLedger(undefined), R.emptyLedger());
  assert.equal(R.identityProblem(R.validateRewardsState(sj), R.validateRewardsLedger(lj)), null);
  assert.deepEqual(R.validateRewardsState(JSON.parse(R.stateText(R.emptyState()))), R.emptyState());
  assert.deepEqual(R.validateRewardsLedger(JSON.parse(R.ledgerText(R.emptyLedger()))), R.emptyLedger());
  const a = e.A.get("a");
  const stateBad = {
    "version": (j) => { j.version = 2; }, "unknown field": (j) => { j.extra = 1; }, "mint": (j) => { j.mint = "x"; },
    "token program": (j) => { j.tokenProgram = SYSTEM_PROGRAM; }, "tPrev before epoch": (j) => { j.tPrev = j.epoch - 1; },
    "periodEnd not after tPrev": (j) => { j.periodEnd = j.tPrev; }, "interval gap": (j) => { j.intervals[1][0] += 1; },
    "intervals end": (j) => { j.V += 1; }, "dt over the gap cap": (j) => { j.intervals.push([j.V, 7_201]); j.V += 7_201; },
    "wallet key": (j) => { j.wallets["not-an-address"] = j.wallets[a]; }, "wallet field": (j) => { j.wallets[a].extra = 1; },
    "too many lots": (j) => { j.wallets[a].lots = Array.from({ length: 17 }, () => ["1", 0]); }, "zero lot": (j) => { j.wallets[a].lots[0][0] = "0"; },
    "negative amount": (j) => { j.wallets[a].lots[0][0] = "-1"; }, "leading zero": (j) => { j.wallets[a].lots[0][0] = "01"; },
    "over u64": (j) => { j.wallets[a].lots[0][0] = String(2n ** 64n); }, "a number, not a string": (j) => { j.wallets[a].lots[0][0] = 5; },
    "since after V": (j) => { j.wallets[a].lots[0][1] = j.V + 1; }, "lots not oldest first": (j) => { j.wallets[a].lots = [["1", 5], ["1", 1]]; },
    "pts": (j) => { j.wallets[a].pts = "1.5"; }, "ptsAt": (j) => { j.wallets[a].ptsAt = j.intervals.length + 1; },
    "owed over u64": (j) => { j.wallets[a].owed = "18446744073709551616"; }, "first": (j) => { j.wallets[a].first = -1; },
    "off-curve owner with lots": (j) => { j.wallets[creatorVault(LAUNCHER)] = j.wallets[a]; },
    "pre-genesis lots": (j) => { Object.assign(j, { epoch: null, mint: null, tokenProgram: null, decimals: null, tPrev: null, slotPrev: null, periodStart: null, periodEnd: null, V: 0, intervals: [] }); },
    "no rules field": (j) => { delete j.rules; }, "rules out of range": (j) => { j.rules.everyDays = 31; }, "rules field unknown": (j) => { j.rules.extra = 1; },
    "rules min payout a number": (j) => { j.rules.minPayoutLamports = 2_000_000; }, "rules min payout out of range": (j) => { j.rules.minPayoutLamports = "1"; },
    "hold until": (j) => { j.wallets[addr("zz")].hold.until = "tomorrow"; }, "hold field": (j) => { j.wallets[addr("zz")].hold.x = 1; },
    "hold reason": (j) => { j.wallets[addr("zz")].hold.reason = ""; }, "hold slot": (j) => { j.wallets[addr("zz")].hold.slot = -1; },
  };
  for (const [name, f] of Object.entries(stateBad)) {
    const j = structuredClone(sj);
    f(j);
    assert.throws(() => R.validateRewardsState(j), R.RewardsError, `state: ${name}`);
  }
  const ledgerBad = {
    "version": (j) => { j.version = 0; }, "unknown field": (j) => { j.x = 1; }, "E edited": (j) => { j.E = String(BigInt(j.E) + 1n); },
    "P edited": (j) => { j.P = String(BigInt(j.P) + 1n); }, "F edited": (j) => { j.F = String(BigInt(j.F) + 1n); },
    "A under P + F": (j) => { j.A = "0"; }, "cursor": (j) => { j.cursor = "abc"; },
    "forHolders": (j) => { j.claims[0].forHolders = String(BigInt(j.claims[0].forHolders) + 1n); j.E = String(BigInt(j.E) + 1n); },
    "net": (j) => { j.claims[0].net = String(BigInt(j.claims[0].net) - 1n); },
    "claim status": (j) => { j.claims[0].status = "done"; }, "sharePct": (j) => { j.claims[0].sharePct = 101; },
    "sending claim with amounts": (j) => { j.claims[0].status = "sending"; delete j.claims[0].settledAt; },
    "duplicate signature": (j) => { j.payouts[0].sig = j.claims[0].sig; }, "sentAt": (j) => { j.claims[0].sentAt = "yesterday"; },
    "settledAt on a sending row": (j) => { j.payouts[0].status = "sending"; }, "fee ≠ Σshare": (j) => { j.payouts[0].fee = String(BigInt(j.payouts[0].fee) + 1n); },
    "zero net": (j) => { j.payouts[0].rows[0][1] = "0"; }, "twice in one payout": (j) => { j.payouts[0].rows.push([...j.payouts[0].rows[0]]); },
    "21 rows": (j) => { j.payouts[0].rows = Array.from({ length: 21 }, () => [addr("q"), "1", "0"]); }, "row shape": (j) => { j.payouts[0].rows[0] = [addr("q"), "1"]; },
    "payout status": (j) => { j.payouts[0].status = "sent"; }, "lastValidBlockHeight": (j) => { j.payouts[0].lastValidBlockHeight = -1; },
  };
  assert.ok(lj.claims.length && lj.payouts.length);
  for (const [name, f] of Object.entries(ledgerBad)) {
    const j = structuredClone(lj);
    f(j);
    assert.throws(() => R.validateRewardsLedger(j), R.RewardsError, `ledger: ${name}`);
  }
  // an audit file is plain JSON of the close
  const rec = e.periods[0].record;
  assert.deepEqual(JSON.parse(R.auditText(rec)), R.auditJson(rec));
  assert.deepEqual(Object.keys(R.auditJson(rec)), ["k", "start", "end", "T", "slot", "E", "A_before", "pot", "capAmt", "totalPts", "releasePct", "capPct", "refused", "rows"]);
});

/* ── the spec's scenarios (§13), through the module ─────────────────────────────────── */

test("scenario 1: a 20% whale against 100 wallets of 0.2%, with a 10%, 20% and no cap (what the cap holds back stays in the pot: later pots are larger)", () => {
  const want = {
    10: [["0.500000", "0.050000", "10.000%", "0.002500", "0.500%"], ["1.266500", "0.126650", "10.000%", "0.006332", "0.500%"], ["1.619588", "0.161959", "10.000%", "0.008098", "0.500%"], "5.000"],
    20: [["0.500000", "0.100000", "20.000%", "0.002500", "0.500%"], ["1.173563", "0.234713", "20.000%", "0.005868", "0.500%"], ["1.409339", "0.281868", "20.000%", "0.007047", "0.500%"], "2.500"],
    100: [["0.500000", "0.250000", "50.000%", "0.002500", "0.500%"], ["0.937500", "0.468750", "50.000%", "0.004687", "0.500%"], ["0.999023", "0.499512", "50.000%", "0.004995", "0.500%"], "1.000"],
  };
  for (const cap of [10, 20, 100]) {
    const h = background(); h.set("WHALE", [[0, pct(20)]]);
    const e = simulate({ holders: h, days: 71, cfg: { walletCapPct: cap } });
    [1, 4, 10].forEach((k, i) => {
      const p = e.periods[k - 1], w = allocOf(e, k, "WHALE"), s = allocOf(e, k, "S000");
      assert.deepEqual([sol(p.pot), sol(w), share(w, p.pot), sol(s), share(s, p.pot)], want[cap][i], `cap ${cap} P${k}`);
      assert.equal(ratio(100n * s, w), want[cap][3], "small holders' per-token rate ÷ the whale's");
    });
  }
});

test("scenario 2: a newcomer buying 1% on day 20 against a 1% veteran from day 0 (the final curve's row of 2b)", () => {
  const h = background(); h.set("VET", [[0, pct(1)]]); h.set("NEW", [[20 * DAY, pct(1)]]);
  const e = simulate({ holders: h, days: 85, seed: 7 });
  assert.equal(sol(allocOf(e, 3, "NEW")), "0.003855");
  assert.equal(sol(allocOf(e, 3, "VET")), "0.041483");
  assert.equal(ratio(allocOf(e, 3, "NEW"), allocOf(e, 3, "VET")), "0.093");
  assert.equal(sol(allocOf(e, 4, "NEW")), "0.032477");
  assert.equal(sol(allocOf(e, 4, "VET")), "0.043096");
  const ratios = Object.fromEntries([4, 5, 6, 7, 8, 10, 12].map((k) => [k, ratio(allocOf(e, k, "NEW"), allocOf(e, k, "VET"))]));
  assert.deepEqual(ratios, { 4: "0.754", 5: "0.855", 6: "0.904", 7: "0.932", 8: "0.949", 10: "0.968", 12: "0.978" });
  assert.equal(sol(sumAlloc(e, "NEW", 3, 12)), "0.376627");
  assert.equal(sol(sumAlloc(e, "VET", 3, 12)), "0.446363");
  assert.equal(ratio(sumAlloc(e, "NEW", 3, 12), sumAlloc(e, "VET", 3, 12)), "0.844");
});

/** Scenario 3's sniper: 10% bought `x` seconds before P4's nominal end, sold right after the closing sample; 200 random schedules. */
function sniper(x, N = 200) {
  let sum = 0, mx = 0, zero = 0, hon = 0;
  for (let s = 1; s <= N; s++) {
    const times = sampleTimes(29 * 24 + 4, { seed: 1000 + s });
    const end = times[0] + 28 * DAY;
    const closeT = times.find((t) => t >= end);
    const h = background(); h.set("HONEST", [[0, pct(10)]]); h.set("SNIPER", [[end - x, pct(10)], [closeT + 1, 0n]]);
    const e = simulate({ holders: h, days: 28.2, times, pay: false, check: false });
    const p = e.periods[3], a = p.alloc.get("SNIPER") ?? 0n;
    const f = Number((a * 1_000_000n) / p.pot) / 1e4;
    sum += f; mx = Math.max(mx, f); if (a === 0n) zero++;
    hon += Number(((p.alloc.get("HONEST") ?? 0n) * 1_000_000n) / p.pot) / 1e4;
  }
  return { mean: (sum / N).toFixed(3), max: mx.toFixed(3), zero, honest: (hon / N).toFixed(3) };
}

test("scenario 3: a sniper buying 10% minutes before the close earns about nothing; with fixed :00 samples it would not", () => {
  assert.deepEqual(sniper(10 * 60), { mean: "0.029", max: "0.223", zero: 155, honest: "10.000" });
  assert.deepEqual(sniper(60 * 60), { mean: "0.108", max: "0.322", zero: 44, honest: "10.000" });
  // with fixed :00 samples, the sample times are predictable
  for (const [x, want] of [[59 * 60, "0.000%"], [61 * 60, "0.121%"]]) {
    const times = sampleTimes(29 * 24 + 4, { random: false });
    const end = 28 * DAY;
    const h = background(); h.set("HONEST", [[0, pct(10)]]); h.set("SNIPER", [[end - x, pct(10)], [end + 1, 0n]]);
    const e = simulate({ holders: h, days: 28.2, times, pay: false, check: false });
    assert.equal(share(e.periods[3].alloc.get("SNIPER") ?? 0n, e.periods[3].pot), want, `bought ${x / 60} min before`);
  }
});

test("scenario 3, the rest of the table: 30 and 120 minutes, and a day", () => {
  assert.deepEqual(sniper(30 * 60), { mean: "0.057", max: "0.223", zero: 107, honest: "10.000" });
  assert.deepEqual(sniper(120 * 60), { mean: "0.233", max: "0.437", zero: 0, honest: "10.000" });
  const day = sniper(24 * HOUR);
  assert.equal(day.mean, "2.908");
  assert.equal(day.max, "3.092");
});

test("scenario 3b: 20% held only around each :00 earns 21× with fixed samples, 1× with the random moment", () => {
  const flash = (T) => { const m = ((T % 3600) + 3600) % 3600; return pct(1) + (m >= 3480 || m < 120 ? pct(20) : 0n); };
  for (const [random, want] of [[false, "21.000"], [true, "1.000"]]) {
    const h = background(); h.set("CTRL", [[0, pct(1)]]); h.set("FLASH", flash);
    const e = simulate({ holders: h, days: 15, random, seed: 3, cfg: { walletCapPct: 100 } });
    assert.equal(ratio(e.periods[1].pts.get("FLASH"), e.periods[1].pts.get("CTRL")), want);
  }
});

test("scenario 4: splitting earns no more than one wallet; moving to fresh wallets loses age; dust wallets under the minimum earn 0", () => {
  const mk = (variant) => {
    const h = background();
    if (variant === "one") h.set("X", [[0, pct(5)]]);
    if (variant === "fifty") for (let i = 0; i < 50; i++) h.set(`X${i}`, [[0, pct(0.1)]]);
    if (variant === "move30") { h.set("X", [[0, pct(5)], [30 * DAY, 0n]]); for (let i = 0; i < 50; i++) h.set(`X${i}`, [[30 * DAY, pct(0.1)]]); }
    return simulate({ holders: h, days: 71, cfg: { walletCapPct: 100 } });
  };
  const tot = (e, k) => [...e.periods[k - 1].alloc].filter(([n]) => n.startsWith("X")).reduce((s, [, v]) => s + v, 0n);
  const all = (e) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].reduce((s, k) => s + tot(e, k), 0n);
  const one = mk("one"), fifty = mk("fifty"), moved = mk("move30");
  assert.deepEqual([4, 5, 6, 8, 10].map((k) => sol(tot(one, k))), ["0.187500", "0.193750", "0.196875", "0.199219", "0.199805"]);
  assert.deepEqual([4, 5, 6, 8, 10].map((k) => sol(tot(fifty, k))), ["0.187500", "0.193750", "0.196875", "0.199219", "0.199805"]);
  assert.equal(sol(all(one)), "1.800195");
  assert.ok(all(fifty) <= all(one) && all(one) - all(fifty) < 50n * 10n, "fifty wallets from day 0 earn what one does, less at most a lamport a wallet a period (each allocation is floored)");
  assert.deepEqual([4, 5, 6, 8, 10].map((k) => sol(tot(moved, k))), ["0.187500", "0.154083", "0.162723", "0.183411", "0.190631"]);
  assert.deepEqual([5, 6, 8, 10].map((k) => ratio(tot(moved, k), tot(one, k))), ["0.795", "0.827", "0.921", "0.954"]);
  assert.equal(sol(all(moved)), "1.667271");
  // a 20% whale with the 10% cap: one wallet 10%; pre-split into 50 wallets: 50%, the uncapped pro-rata share and no more
  const h1 = background(); h1.set("W", [[0, pct(20)]]);
  const h2 = background(); for (let i = 0; i < 50; i++) h2.set(`W${i}`, [[0, pct(0.4)]]);
  const e1 = simulate({ holders: h1, days: 29 }), e2 = simulate({ holders: h2, days: 29 });
  assert.equal(share(allocOf(e1, 4, "W"), e1.periods[3].pot), "10.000%");
  const w2 = [...e2.periods[3].alloc].filter(([n]) => n.startsWith("W")).reduce((s, [, v]) => s + v, 0n);
  assert.equal(share(w2, e2.periods[3].pot), "50.000%");
  const h3 = background(); h3.set("W", [[0, pct(20)]]);
  const uncapped = simulate({ holders: h3, days: 29, cfg: { walletCapPct: 100 } });
  assert.ok(w2 <= allocOf(uncapped, 4, "W"), "a split never earns more than the uncapped single wallet");
  // 1,000 wallets of 99,999 tokens, just under the minimum
  const h4 = background(); for (let i = 0; i < 1000; i++) h4.set(`D${i}`, [[0, 99_999_000_000n]]);
  const e4 = simulate({ holders: h4, days: 8 });
  assert.equal([...e4.periods[0].alloc].filter(([n]) => n.startsWith("D")).reduce((s, [, v]) => s + v, 0n), 0n);
  assert.equal(e4.state.wallets.size, 100, "they are not even tracked");
});

test("scenario 5: partial sells and rebuys", () => {
  const h = background();
  h.set("Y", [[0, pct(1)]]);
  h.set("X", [[0, pct(1)], [30 * DAY, pct(0.5)]]);
  h.set("Z", [[0, pct(0.5)]]);
  h.set("R", [[0, pct(1)], [30 * DAY, pct(0.5)], [37 * DAY, pct(1)]]);
  h.set("Q", [[0, pct(1)], [30 * DAY, 0n], [37 * DAY, pct(1)]]);
  const e = simulate({ holders: h, days: 71, seed: 5 });
  const row = (k) => [ratio(allocOf(e, k, "X"), allocOf(e, k, "Z")), ratio(allocOf(e, k, "R"), allocOf(e, k, "Y")), ratio(allocOf(e, k, "Q"), allocOf(e, k, "Y"))];
  assert.deepEqual(row(4), ["2.000", "1.000", "1.000"]);
  assert.deepEqual(row(5), ["1.275", "0.638", "0.275"]);
  assert.deepEqual(row(6), ["1.000", "0.736", "0.472"]);
  assert.deepEqual(row(7), ["1.000", "0.889", "0.777"]);
  assert.deepEqual(row(8), ["1.000", "0.926", "0.851"]);
  assert.deepEqual(row(10), ["1.000", "0.959", "0.919"]);
});

test("x1: a wash round trip gains nothing and adding to an old wallet launders no age", () => {
  const h = background();
  h.set("CTRL", [[0, pct(1)]]);
  h.set("WASH", [[0, pct(1)], [30 * DAY, pct(2)], [31 * DAY, pct(1)]]);
  h.set("LAUND", [[0, pct(0.5)], [30 * DAY, pct(5.5)]]);
  h.set("PAIR_OLD", [[0, pct(0.5)]]); h.set("PAIR_NEW", [[30 * DAY, pct(5)]]);
  const e = simulate({ holders: h, days: 57, seed: 9, cfg: { walletCapPct: 100 } });
  for (const k of [6, 7, 8]) assert.equal(ratio(allocOf(e, k, "WASH"), allocOf(e, k, "CTRL")), "1.000");
  for (const k of [5, 6, 7, 8]) assert.equal(ratio(allocOf(e, k, "LAUND"), allocOf(e, k, "PAIR_OLD") + allocOf(e, k, "PAIR_NEW")), "1.000");
});

test("x2: a 12-hour outage builds no age and credits at most two hours", () => {
  const mk = (outages) => {
    const h = background(); h.set("STEADY", [[0, pct(1)]]);
    h.set("ENDS", [[0, pct(1)], [10 * DAY + 1800, 0n], [10 * DAY + 11 * HOUR, pct(1)]]);
    return simulate({ holders: h, days: 15, seed: 11, outages });
  };
  const a = mk([]), b = mk([[10 * DAY, 10 * DAY + 12 * HOUR]]);
  assert.equal(sol(allocOf(a, 2, "STEADY")), "0.034406");
  assert.equal(sol(allocOf(b, 2, "STEADY")), "0.034091");
  assert.equal(ratio(allocOf(b, 2, "STEADY"), allocOf(a, 2, "STEADY")), "0.991");
  assert.equal(ratio(allocOf(b, 2, "ENDS"), allocOf(b, 2, "STEADY")), "1.000", "sold and bought back inside the outage: the capped credit of a steady holder");
  assert.equal(ratio(allocOf(a, 2, "ENDS"), allocOf(a, 2, "STEADY")), "0.799", "without the outage it is caught");
});

test("x3: small and sold-out wallets are carried, never forfeited; a 0-lamport recipient waits for the rent", () => {
  const h = background();
  h.set("TINY", [[0, 150_000_000_000n]]);
  h.set("TINY0", [[0, 150_000_000_000n]]);
  h.set("EXIT0", [[0, 150_000_000_000n], [8 * DAY, 0n]]);
  const e = simulate({ holders: h, days: 57, lamports: new Map([["TINY0", 0n], ["EXIT0", 0n]]) });
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map((k) => sol(allocOf(e, k, "TINY"))), ["0.000374", "0.000562", "0.000655", "0.000702", "0.000725", "0.000737", "0.000743", "0.000746"]);
  assert.deepEqual([1, 2, 3].map((k) => sol(allocOf(e, k, "EXIT0"))), ["0.000374", "0.000071", "0.000000"]);
  for (const n of ["TINY", "TINY0"]) {
    assert.equal(sol(e.paid.get(n)), "0.004498");
    assert.equal(e.feeShare.get(n), 990n, "in transactions of near-equal size the smallest payees share a fee with the rest (7,740 lamports when they came last, in a tail of their own)");
    assert.equal(sol(e.owedOf(n)), "0.000746");
  }
  assert.equal(e.paid.get("EXIT0") ?? 0n, 0n);
  assert.equal(sol(e.owedOf("EXIT0")), "0.000445", "carried: it needs 650,240 + the fee to create its account");
  // funded, it is paid at once at the sold-out threshold: the first run after it sold out (P1's 0.000374), then P2's at the P2 close
  const h2 = background(); h2.set("EXITF", [[0, 150_000_000_000n], [8 * DAY, 0n]]); h2.set("EXIT0", [[0, 150_000_000_000n], [8 * DAY, 0n]]);
  const f = simulate({ holders: h2, days: 22, lamports: new Map([["EXIT0", 0n]]) });
  assert.equal(sol(allocOf(f, 1, "EXITF") + allocOf(f, 2, "EXITF")), "0.000445");
  const rowsOf = (n) => f.ledger.payouts.flatMap((p) => p.rows.filter((row) => row[0] === f.A.get(n)).map((row) => [p.sentAt, row[1], row[2]]));
  const exitRows = rowsOf("EXITF");
  assert.deepEqual(exitRows.map((x) => [sol(x[1]), x[2]]), [["0.000369", 5_130n], ["0.000071", 348n]], "paid alone right after it sold out, then in a transaction with the others");
  assert.ok(Date.parse(exitRows[0][0]) - (T_BASE + 8 * DAY) * 1000 < 2 * HOUR * 1000, "paid within the hour or two after it sold out");
  assert.equal(sol(f.paid.get("EXITF")), "0.000440");
  assert.equal(f.owedOf("EXITF"), 0n);
  assert.equal(sol(f.owedOf("EXIT0")), "0.000445");
  assert.equal(rowsOf("EXIT0").length, 0);
});

test("x4: a one-off 5 SOL claim is released as 50%, 25%, 12.5% … of it", () => {
  const s = R.emptyState(), L = R.emptyLedger();
  const g = sig();
  R.recordClaimSending(L, { sig: g, lastValidBlockHeight: 1, sharePct: 100, sentAt: NOW });
  R.settleClaim(L, g, { claimed: 5_000_000_000n, walletFee: 0n, net: 5_000_000_000n }, { settledAt: NOW });
  const A = addressesFor([...background().keys()]);
  const holders = new Map([...A.values()].map((a) => [a, pct(0.2)]));
  const pots = [];
  for (const t of sampleTimes(24 * 43)) {
    const r = R.applySample(s, L, { T: T_BASE + t, slot: t + 1, mint: MINT, tokenProgram: TOKEN_2022_PROGRAM, decimals: 6, supply: SUPPLY, holders }, CFG);
    if (r.closed) pots.push(sol(r.closed.pot));
  }
  assert.deepEqual(pots, ["2.500000", "1.250000", "0.625000", "0.312500", "0.156250", "0.078125"]);
});

test("fuzz: 40 runs of 30 days with random settings, 30% of recipients at 0 lamports, 5% of samples missed: the identity, P + F ≤ E and the rent rule hold throughout", () => {
  let closes = 0;
  const totals = [];
  for (let k = 0; k < 40; k++) {
    const r = rng(900 + k);
    const cfg = {
      walletCapPct: 1 + Math.floor(r() * 100), releasePct: 10 + Math.floor(r() * 91), holderSharePct: Math.floor(r() * 101),
      minPayoutLamports: BigInt(100_000 + Math.floor(r() * 5_000_000)), priorityMicroLamports: Math.floor(r() * 1_000_001), everyDays: 1 + Math.floor(r() * 7), maxTxPerRun: 1 + Math.floor(r() * 10),
    };
    const c = { ...CFG, ...cfg };
    const n = 30 + Math.floor(r() * 50);
    const names = Array.from({ length: n }, (_, i) => `h${i}`);
    const A = addressesFor(names);
    const acct = new Map();
    for (const nm of names) if (r() < 0.3) acct.set(A.get(nm), 0n);
    const bal = new Map(names.map((nm) => [nm, r() < 0.6 ? pct(r() * 2) : 0n]));
    const s = R.emptyState(), L = R.emptyLedger();
    let nextClaim = 1;
    for (const t of sampleTimes(24 * 30, { seed: 77 + k, missPct: 5 })) {
      while (nextClaim * DAY / 4 <= t) {
        const net = BigInt(Math.floor(r() * 400_000_000)), g = sig();
        R.recordClaimSending(L, { sig: g, lastValidBlockHeight: 1, sharePct: c.holderSharePct, sentAt: iso(t) });
        R.settleClaim(L, g, { claimed: net, walletFee: 0n, net }, { settledAt: iso(t) });
        nextClaim++;
      }
      for (const nm of names) { const x = r(); if (x < 0.01) bal.set(nm, 0n); else if (x < 0.03) bal.set(nm, bal.get(nm) + pct(r())); else if (x < 0.05) bal.set(nm, bal.get(nm) / 2n); else if (x < 0.052) bal.set(nm, 50_000_000_000n); }
      const holders = new Map([...bal].filter(([, b]) => b > 0n).map(([nm, b]) => [A.get(nm), b]));
      const res = R.applySample(s, L, { T: T_BASE + t, slot: t + 1, mint: MINT, tokenProgram: TOKEN_2022_PROGRAM, decimals: 6, supply: SUPPLY, holders }, c);
      if (res.closed) {
        closes++;
        const sum = res.closed.rows.reduce((x, y) => x + y[2], 0n);
        assert.ok(sum <= res.closed.pot);
        assert.ok(res.closed.rows.every((y) => y[2] <= res.closed.capAmt));
      }
      assert.equal(R.identityProblem(s, L), null);
      const accounts = new Map([...s.wallets.keys()].map((a) => [a, acct.get(a) ?? 10_000_000n]));
      const plan = R.planPayouts(s, { pot: R.payoutBudget(L, { maxLamportsPerRun: c.maxLamportsPerRun, spentThisRun: 0n }), accounts, rent: RENT, priceMicroLamports: c.priorityMicroLamports, minPayoutLamports: c.minPayoutLamports, maxTx: c.maxTxPerRun });
      for (const b of plan.batches) {
        const g = sig();
        R.recordPayoutSending(s, L, b, { sig: g, lastValidBlockHeight: 1, sentAt: iso(t) });
        assert.equal(R.identityProblem(s, L), null);
        R.settlePayout(s, L, g, "paid", { settledAt: iso(t) });
        for (const row of b.rows) { const before = acct.get(row.owner) ?? 10_000_000n; assert.ok(before + row.lamports >= RENT); acct.set(row.owner, before + row.lamports); }
      }
      assert.equal(R.identityProblem(s, L), null);
      assert.ok(L.P + L.F <= L.E);
    }
    assert.deepEqual(R.validateRewardsLedger(JSON.parse(R.ledgerText(L))), L);
    assert.deepEqual(R.validateRewardsState(JSON.parse(R.stateText(s))), s);
    totals.push([L.E, L.A]);
  }
  assert.equal(closes, 581);
  assert.deepEqual(totals[0], [6_237_919_266n, 2_721_891_831n], "E as the spec's reference engine computed it; A with the cap holding back what is over it");
  assert.deepEqual(totals[1], [21_360_301_987n, 7_463_107_241n]);
});

test("fuzz: the launch reserve is never touched: each launch is decided by the launcher's own capProblem on balance − earmark (how send() applies the earmark is tested in tests/launcher.test.mjs), each payout by I1 and I2", () => {
  const MIN = 20_000_000n;
  const caps = { maxPerDay: 1_000_000, maxLamportsPerLaunch: 1e12, maxLamportsPerDay: 1e15, minBalanceLamports: Number(MIN) };
  let worst = null, launches = 0, refused = 0;
  for (let k = 0; k < 40; k++) {
    const r = rng(500 + k);
    const sharePct = k % 2 ? 100 : Math.floor(r() * 101);
    const names = Array.from({ length: 50 }, (_, i) => `h${i}`);
    const A = addressesFor(names);
    const holders = new Map(names.map((nm) => [A.get(nm), pct(r() * 2)]));
    const s = R.emptyState(), L = R.emptyLedger();
    let B = 50_000_000n, nextClaim = 1, nextLaunch = 1;
    const inv = () => { const v = B - R.earmarkLamports(L) - MIN; if (worst === null || v < worst) worst = v; };
    for (const t of sampleTimes(24 * 28, { seed: 5 + k })) {
      while (nextClaim * DAY / 2 <= t) {
        const net = BigInt(Math.floor(r() * 300_000_000)), g = sig();
        R.recordClaimSending(L, { sig: g, lastValidBlockHeight: 1, sharePct, sentAt: iso(t) });
        // between the send and the settle, the claim's lamports are earmarked by its signature
        B += net;
        assert.ok(R.earmarkLamports(L, R.earmarkSignatures(L, [g]).map(() => net)) >= R.earmarkLamports(L) + net);
        R.settleClaim(L, g, { claimed: net, walletFee: 0n, net }, { settledAt: iso(t) });
        nextClaim++; inv();
      }
      while (nextLaunch * DAY / 3 <= t) {
        const loss = BigInt(Math.floor(r() * 30_000_000));
        const why = capProblem({ stats: { count: 0, lamports: 0 }, caps, lossLamports: Number(loss), balanceLamports: Number(B - R.earmarkLamports(L)) });
        if (why === null) { B -= loss; launches++; } else { assert.match(why, /would fall under LAUNCH_MIN_BALANCE_SOL/); refused++; }
        nextLaunch++; inv();
      }
      R.applySample(s, L, { T: T_BASE + t, slot: t + 1, mint: MINT, tokenProgram: TOKEN_2022_PROGRAM, decimals: 6, supply: SUPPLY, holders }, { ...CFG, walletCapPct: 10 });
      const accounts = new Map([...s.wallets.keys()].map((a) => [a, 10_000_000n]));
      const plan = R.planPayouts(s, { pot: R.payoutBudget(L, { maxLamportsPerRun: CFG.maxLamportsPerRun, spentThisRun: 0n }), accounts, rent: RENT });
      for (const b of plan.batches) {
        assert.equal(R.i1Problem(L, b.debit), null);
        assert.equal(R.i2Problem(L, { balance: B, minBalanceLamports: MIN }), null, "the holders' SOL is there");
        const g = sig();
        R.recordPayoutSending(s, L, b, { sig: g, lastValidBlockHeight: 1, sentAt: iso(t) });
        B -= b.debit;
        R.settlePayout(s, L, g, "paid", { settledAt: iso(t) });
        inv();
      }
    }
  }
  assert.ok(worst >= 0n, `the launch reserve went ${worst} lamports under`);
  assert.ok(launches > 1_000 && refused > 1_000, `${launches} launches, ${refused} refused by the earmark`);
});

/* ── the website ────────────────────────────────────────────────────────────────────── */

test("the website's three lines say what the rules do, with the numbers of the rules in force (the defaults, or the variables a sample recorded)", () => {
  const textOf = (lines) => lines.map((l) => `${l.title} ${l.text}`).join("\n");
  const text = textOf(R.REWARDS_SITE_TEXT);
  assert.deepEqual(R.REWARDS_SITE_TEXT, R.rewardsSiteText(R.rewardsConfig({})), "the shipped text is the defaults'");
  assert.equal(R.REWARDS_SITE_TEXT.length, 3);
  assert.deepEqual(R.REWARDS_SITE_TEXT.map((l) => l.title), ["Hold $CATSANC, earn SOL.", "Older tokens earn more.", "Every 7 days,"]);
  assert.match(text, /Once an hour, at a random moment/);
  const tokens = R.minBalance(SUPPLY, R.REWARDS_DEFAULTS.minBalancePpm) / 1_000_000n;
  assert.match(text, new RegExp(`at least ${Number(tokens).toLocaleString("en-US")} \\$CATSANC \\(0\\.01% of the 1 billion supply\\)`));
  const m = (d) => (Number(R.mFp(d * DAY)) / 1e6).toFixed(2).replace(/0$/, "");
  assert.match(text, new RegExp(`${m(7).replace(".", "\\.")}× after 1 week, ${m(14).replace(".", "\\.")}× after 2 weeks, ${m(30).replace(".", "\\.")}× after a month`));
  assert.match(text, /from 1× toward 2×/);
  assert.equal(R.M_FP / R.SCALE, 2n);
  assert.match(text, /at least half the top rate/);
  assert.match(text, /newest tokens go first/);
  assert.match(text, /age counts from the first rewards check, so tokens held before the rewards started also begin at 1×/, "genesis: every holder starts at age 0, and the site says so");
  assert.equal(R.REWARDS_DEFAULTS.everyDays, 7);
  assert.equal(R.REWARDS_DEFAULTS.releasePct, 50);
  assert.match(text, /half of the unpaid holder pot/);
  assert.match(text, new RegExp(`at most ${R.REWARDS_DEFAULTS.walletCapPct}% of it to any one wallet \\(the rest stays in the pot for later\\)`));
  assert.match(text, new RegExp(`under ${R.REWARDS_DEFAULTS.minPayoutSol} SOL are saved`));
  assert.match(text, /never lost/);
  assert.match(text, /published/);
  // Other variables: the text says what the workflow then does (no code to edit).
  const other = textOf(R.rewardsSiteText(R.rewardsConfig({ REWARDS_EVERY_DAYS: "14", REWARDS_RELEASE_PCT: "30", REWARDS_WALLET_CAP_PCT: "20", REWARDS_MIN_BALANCE_PPM: "250", REWARDS_MIN_PAYOUT_SOL: "0.0025" })));
  assert.match(other, /Every 14 days, 30% of the unpaid holder pot .* at most 20% of it to any one wallet/);
  assert.match(other, /at least 250,000 \$CATSANC \(0\.025% of the 1 billion supply\)/);
  assert.match(other, /under 0\.0025 SOL are saved/);
  const all = textOf(R.rewardsSiteText({ everyDays: 1, releasePct: 100, walletCapPct: 100 }));
  assert.match(all, /Every day, all of the unpaid holder pot \(the creator fees our launcher bot has claimed\) is split by points and sent to you automatically/, "no cap: no cap quoted");
  assert.throws(() => R.rewardsSiteText({ everyDays: 31 }), R.RewardsError);
  assert.deepEqual(R.rewardsSiteText(R.siteRules(R.rewardsConfig({ REWARDS_EVERY_DAYS: "3" }))), R.rewardsSiteText(R.rewardsConfig({ REWARDS_EVERY_DAYS: "3" })), "from state.json's rules as from the variables");
  assert.match(R.REWARDS_SITE_EXCLUDED, /StonkFun/);
  assert.match(R.REWARDS_SITE_EXCLUDED, /swap/);
  assert.ok(Object.isFrozen(R.REWARDS_SITE_TEXT) && R.REWARDS_SITE_TEXT.every(Object.isFrozen));
  assert.equal(R.solText(4_491_000n), "0.004491 SOL");
  assert.equal(R.solText(-5_001n), "-0.000005001 SOL");
  assert.equal(R.solText(2_000_000_000n), "2 SOL");
});
