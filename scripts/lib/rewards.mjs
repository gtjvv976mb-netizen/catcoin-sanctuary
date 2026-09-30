/**
 * $CATSANC HOLDER REWARDS, v1: THE RULES, WITH NO NETWORK, FILES OR CLOCK OF THEIR OWN. The creator
 * fees the automatic launcher's wallet CLAIMS (scripts/lib/pump-fees.mjs, measured from each claim
 * transaction) times REWARDS_HOLDER_SHARE_PCT go to the holders of $CATSANC, the sanctuary's own coin
 * (its mint: data/socials.json "contract"), in proportion to points: tokens held × time held × an age
 * bonus that grows from 1× toward 2×. The workflow (scripts/rewards.mjs, .github/workflows/rewards.yml)
 * brings the chain, the files and the clock; everything that decides an amount is here and is tested in
 * tests/rewards.test.mjs. No dependencies beyond the repository's own pure modules.
 *
 * NUMBERS. Every amount, lamport and point is a BigInt; there is no floating point anywhere in the money
 * or points arithmetic. Times (chain seconds) and the verified clock V are integer Numbers, turned into
 * BigInt only for mFp. In the files, amounts and lamports are canonical decimal strings (^\d{1,20}$,
 * at most 2^64−1), E may be negative (^-?\d{1,20}$), points are ^\d{1,60}$. Every rounding goes toward
 * the holders getting less or equal, never more: mFp floor, dt whole capped seconds, a merged lot takes
 * the younger date, MIN_BAL ceil, forHolders floor toward −∞, pot / cap / allocation floor. The only
 * exception is required: a payout's fee shares add up to exactly its fee.
 *
 * THE MINT GATE (mintGate, mintFromAccount). Valid only when the contract is an address, the account
 * exists (finalized), is owned by the token program or Token-2022, has ≥ 82 bytes, byte 45 = 1
 * (initialized) and, past 165 bytes, byte 165 = 1 (a Mint); 83..165 bytes is refused (a token account
 * or a multisig, never a mint). supply = u64LE[36..44], decimals = byte 44.
 * No valid mint: no sample and no close (claims still run, E grows, the launcher's earmark protects it).
 * A contract that differs from the stored mint after genesis: no samples and no closes until the owner
 * dispatches new_epoch=<contract> (startNewEpoch); owed amounts are still paid.
 *
 * A SAMPLE (holdersFromAccounts, supplyProblem, applySample). getProgramAccounts(mint's program,
 * memcmp 0 = mint, dataSlice 32..109) gives, per token account, owner [0..32], amount u64LE[32..40],
 * state [76] (1 initialized, 2 frozen). Valid only when Σ amount over ALL accounts (frozen and excluded
 * included) is the mint's supply at the accounts' slot (bracketed by a mint read before and one after
 * them when the mint can never mint again: supply only falls then, so a burn between the reads is no
 * reason to skip the hour; else equal to both) and the exclusions parse (exclusionSet: fail closed).
 * The counted balance of an owner: the sum of its state-1 accounts; 0 when the owner is in
 * data/wallets.json (any row, any dates), off the curve (a PDA: curves, pools, lockers, vaults), a
 * reserved or program address (NEVER_EARN), the tracked mint itself, in data/rewards-exclude.json, or
 * under MIN_BAL = ceil(supply × PPM / 10⁶).
 *
 * THE UPDATE (applySample), at each valid sample at chain time T (> the previous T):
 *   genesis   T0 = T, V = 0, periodEnd = T0 + EVERY days; each counted balance b > 0 gets lots [[b, 0]];
 *             no points.
 *   later     dt = min(T − tPrev, GAP_CAP), Vn = V + dt. For each owner with lots or in the sample,
 *             b0 = Σlots, b1 = counted balance:
 *             1. newly excluded: pts = 0, lots = [], owed kept; next owner.
 *             2. credit c = min(b0, b1), walking lots oldest first: pts += take × dt × mFp(V − since)
 *                (age at the start of the interval).
 *             3. b1 > b0: push [b1 − b0, Vn] (earns nothing this interval, age 0 in the next); over
 *                MAX_LOTS lots, merge the adjacent pair i, i+1 that minimises
 *                amount_i × (mFp(Vn − s_i) − mFp(Vn − s_{i+1})) (ties: lowest i) into
 *                [amount_i + amount_{i+1}, s_{i+1}] (the younger date).
 *             4. b1 < b0: remove b0 − b1 from the newest lot back; the oldest keep their age.
 *             Then V = Vn, tPrev = T. Age runs on V, the verified clock: it only advances by capped dt,
 *             so no age builds up during outages or while the system is off.
 *   lazily    a wallet whose counted balance did not change is not touched: its points for the
 *             intervals since `ptsAt` are brought up to date (bit-identical) only when its lots change
 *             or at a close, so an hourly commit only touches the wallets that traded.
 *   close     when T ≥ periodEnd, after this sample's credit (closePeriod): the points of an owner that
 *             can never be paid (opts.unpayable: executable, owned by a program, a System account
 *             holding data; read by the workflow at the close) are set to 0 and listed in the audit;
 *             U = E − A, pot = U > 0 ? floor(U × RELEASE_PCT / 100) : 0; each wallet with points gets
 *             alloc_j = min(floor(pot × pts_j / Σpts), capAmt), capAmt = floor(pot × CAP_PCT / 100)
 *             (allocate): what the cap holds back is not handed to other wallets, it stays in E − A for
 *             later closes. owed += alloc, A += Σalloc, every pts = 0, k += 1, periodEnd += EVERY days
 *             until it is past T.
 *
 * mFp(a) = 1,000,000 + floor(1,000,000 × a / (a + 1,209,600)), a = max(0, verified-clock seconds):
 * bounded (< 2×), strictly increasing, concave; 1.333 at 7 days, 1.5 at 14, 1.682 at 30.
 *
 * THE LEDGER (data/rewards/ledger.json): E (entitled: Σ forHolders of the settled claims, signed),
 * A (allocated), P (net paid), F (payout fees), cursor (the newest wallet signature classified), claims
 * and payouts rows, all kept (so E, P and F are re-summed from the rows on every load: a hand-edited
 * total is refused). Always: A = P + F + Σowed + Σ(net + share over payout rows still sending)
 * (identityProblem).
 *   claim   recordClaimSending (status "sending", sharePct = the clamped share AT SEND) → settleClaim:
 *           "landed" (measureClaim: net = claimed − walletFee, negative for a claim that failed on
 *           chain; forHolders = floorDiv(net × sharePct, 100); E += forHolders) or "expired" (never
 *           landed: nothing).
 *   payout  planPayouts → per batch the gates (checkPayoutMessage, i1Problem, i2Problem,
 *           simulationProblem, the run caps) → recordPayoutSending (the row "sending" with its
 *           signature, BEFORE the send; owed_j −= net_j + share_j) → settlePayout: "paid" (P += Σnet,
 *           F += fee), "failed" (landed but failed: F += fee, owed_j += net_j), "expired" (never landed:
 *           owed_j += net_j + share_j; its wallets are held (hold) until the wallet's history has been
 *           counted past it, so a payout that did land after all is found before they are paid again).
 *           An expired row found on chain later is settled as what it was (landExpiredClaim,
 *           landExpiredPayout).
 *   I1      P + F + (in flight) + Σnet + f ≤ E: a payout never spends more than the holders' claimed share
 *           minus what was already paid and the payout fees. I2: the wallet's live balance ≥
 *           LAUNCH_MIN_BALANCE + max(0, E − P − F − in flight), else the launcher spent holders' SOL.
 *   earmark what the launcher must leave alone: max(0, E − P − F) + Σ claimed over wallet signatures
 *           newer than the cursor that the ledger does not list or lists as a claim still sending
 *           (earmarkLamports, earmarkSignatures; the launcher measures each with measureClaim).
 *
 * PAYOUTS (planPayouts). A wallet with owed > 0 is due when owed ≥ thr + FEE1 (thr = MIN_PAYOUT while it
 * holds, EXIT_MIN once it sold out), it is not held (a payout of it that failed in simulation, or one
 * that expired, holds it until `hold.until`), it is no reserved account key (RESERVED_ACCOUNT_KEYS: a
 * transfer to one always fails), its account does not exist or is a System Program account with no
 * data that is not executable, and lamports + (owed − FEE1) ≥ RENT (read live). Due wallets, owed
 * descending then address, in ceil(n / 20) transactions of near-equal size (so the smallest payees
 * never carry a transaction's fee almost alone); a batch of k pays fee f = FEE(k), share_j =
 * floor(f/k) + (j < f mod k ? 1 : 0), net_j = amount_j − share_j. A wallet owed more than what is left of
 * the run's budget is paid that part when the part itself passes the same thresholds. Every other wallet
 * is carried forward with its reason; nothing is ever forfeited; a wallet excluded later is still paid
 * what it is owed; the payer is never a recipient. Σ(net + share) ≤ pot by construction, and asserted.
 */
import { isAddress, isSignature, base58Decode, base58Encode, parseTime, validateWallets } from "../../assets/collection.js";
import {
  isOnCurve, compileLegacyMessage, decodeLegacyMessage, decompileInstructions, isWritableIndex,
  setComputeUnitLimit, setComputeUnitPrice, priorityFeeLamports, PACKET_DATA_SIZE,
} from "./solana-tx.mjs";
import { SYSTEM_PROGRAM, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, COMPUTE_BUDGET_PROGRAM, ATA_PROGRAM, PUMPFUN_PROGRAM } from "./programs.mjs";

/* ── constants (changing one takes a visible pull request; each is tested) ─────────────── */

/** Fixed-point scale of the age multiplier: mFp(0) = SCALE is 1×. */
export const SCALE = 1_000_000n;
/** The multiplier's ceiling, fixed point: M = 2 (never reached). */
export const M_FP = 2_000_000n;
/** The age, in verified-clock seconds, at which a token is half way to the ceiling: 14 days (1.5×). */
export const H = 1_209_600;
/** The most seconds one interval between two samples may count (2 hours): a gap credits no more. */
export const GAP_CAP = 7_200;
/** The sampling window: the moment is drawn uniformly in [0, SAMPLE_WINDOW) seconds after the job starts. */
export const SAMPLE_WINDOW = 3_300;
/** The most lots (batches of tokens with their own age) one wallet keeps. */
export const MAX_LOTS = 16;
/** Transfers per payout transaction (20 is 1,198 bytes; 21 would be 1,247, over PACKET_DATA_SIZE). */
export const PER_TX = 20;
/** Payout threshold, lamports, for a wallet that sold out (holds no lots). */
export const EXIT_MIN = 10_000n;
/** The signature fee of a one-signer transaction, lamports. */
export const BASE_FEE = 5_000n;
export const DAY_SECONDS = 86_400;
export const U64_MAX = 2n ** 64n - 1n;
export const LAMPORTS_PER_SOL = 1_000_000_000n;
/** The mint account's layout (the classic token program's, which Token-2022 extends). */
export const MINT_LAYOUT = Object.freeze({ minSize: 82, supply: 36, decimals: 44, initialized: 45, accountTypeAt: 165, accountTypeMint: 1 });
/** getProgramAccounts' dataSlice for a token account: owner (32), amount (8), delegate (36), state (1). */
export const TOKEN_SLICE = Object.freeze({ offset: 32, length: 77, owner: 0, amount: 32, state: 76 });
export const TOKEN_STATE = Object.freeze({ initialized: 1, frozen: 2 });
/** The mint account's mint authority: a COption (u32LE tag at 0: 0 None, 1 Some) of a key at 4..36. None: nothing can ever be minted, so the supply only falls. */
export const MINT_AUTHORITY = Object.freeze({ tag: 0, key: 4 });

/**
 * The runtime's reserved account keys (Agave's reserved_account_keys: the builtin and precompile
 * programs, every sysvar, the native loader and the sysvar owner), and the incinerator. A legacy
 * message demotes a reserved key from writable to read-only, so a SystemProgram transfer to one always
 * fails (ReadonlyLamportChange): none is ever paid, and none ever earns. Several are on the curve
 * (NativeLoader1111…, Sysvar1111…, Feature1111…, the System Program), so offCurve alone lets them in.
 */
export const RESERVED_ACCOUNT_KEYS = Object.freeze(new Set([
  "AddressLookupTab1e1111111111111111111111111", "BPFLoader2111111111111111111111111111111111", "BPFLoader1111111111111111111111111111111111",
  "BPFLoaderUpgradeab1e11111111111111111111111", "ComputeBudget111111111111111111111111111111", "Config1111111111111111111111111111111111111",
  "Ed25519SigVerify111111111111111111111111111", "Feature111111111111111111111111111111111111", "LoaderV411111111111111111111111111111111111",
  "KeccakSecp256k11111111111111111111111111111", "Secp256r1SigVerify1111111111111111111111111", "StakeConfig11111111111111111111111111111111",
  "Stake11111111111111111111111111111111111111", SYSTEM_PROGRAM, "Vote111111111111111111111111111111111111111",
  "ZkE1Gama1Proof11111111111111111111111111111", "ZkTokenProof1111111111111111111111111111111",
  "SysvarC1ock11111111111111111111111111111111", "SysvarEpochRewards1111111111111111111111111", "SysvarEpochSchedu1e111111111111111111111111",
  "SysvarFees111111111111111111111111111111111", "Sysvar1nstructions1111111111111111111111111", "SysvarLastRestartS1ot1111111111111111111111",
  "SysvarRecentB1ockHashes11111111111111111111", "SysvarRent111111111111111111111111111111111", "SysvarRewards111111111111111111111111111111",
  "SysvarS1otHashes111111111111111111111111111", "SysvarS1otHistory11111111111111111111111111", "SysvarStakeHistory1111111111111111111111111",
  "NativeLoader1111111111111111111111111111111", "Sysvar1111111111111111111111111111111111111", "1nc1nerator11111111111111111111111111111111",
]));
/** Owners that never earn whatever they hold: the reserved keys (the System Program's "dead address" among them) and the token, associated-token, pump.fun and PumpSwap programs. The tracked mint itself never earns either (applySample). */
export const NEVER_EARN = Object.freeze(new Set([
  ...RESERVED_ACCOUNT_KEYS, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, ATA_PROGRAM, PUMPFUN_PROGRAM, "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
]));

/** The files the workflow reads and writes, by their repository path. */
export const REWARDS_FILES = Object.freeze({
  state: "data/rewards/state.json",
  ledger: "data/rewards/ledger.json",
  periods: "data/rewards/periods",
  exclude: "data/rewards-exclude.json",
  socials: "data/socials.json",
  wallets: "data/wallets.json",
});
/** The public audit file of closed period k. */
export const periodPath = (k) => {
  if (!Number.isSafeInteger(k) || k < 1) throw new RewardsError("a period number is a whole number from 1");
  return `${REWARDS_FILES.periods}/${k}.json`;
};

export class RewardsError extends Error { constructor(message) { super(message); this.name = "RewardsError"; } }

const min = (a, b) => (a < b ? a : b);
const max = (a, b) => (a > b ? a : b);
const ceilDiv = (a, b) => (a + b - 1n) / b; // a ≥ 0, b > 0
/** a / b rounded toward −∞ (BigInt division truncates toward 0). */
export const floorDiv = (a, b) => {
  if (b === 0n) throw new RangeError("division by zero");
  const q = a / b;
  return a % b !== 0n && (a < 0n) !== (b < 0n) ? q - 1n : q;
};
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const extraKey = (o, allowed) => Object.keys(o).find((k) => !allowed.includes(k));
const isTime = (t) => parseTime(t, { dayAllowed: false }) !== null;
const whole = (n, lo = 0, hi = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= lo && n <= hi;
const toBig = (v, what) => {
  if (typeof v === "bigint") return v;
  if (Number.isSafeInteger(v)) return BigInt(v);
  throw new RewardsError(`${what} is not a whole number`);
};

/* ── the age multiplier and the fee ───────────────────────────────────────────────────── */

/** The age multiplier, fixed point (1,000,000 = 1×): 1,000,000 + floor(1,000,000 × a / (a + H)), a = max(0, age) in verified-clock seconds. */
export function mFp(age) {
  let a = typeof age === "bigint" ? age : Number.isSafeInteger(age) ? BigInt(age) : null;
  if (a === null) throw new TypeError("an age is a whole number of seconds");
  if (a < 0n) a = 0n;
  return SCALE + ((M_FP - SCALE) * a) / (a + BigInt(H));
}

/** The compute-unit limit a payout of n transfers asks for: 1,000 + 300·n. */
export const cuLimit = (n) => {
  if (!whole(n, 1, PER_TX)) throw new RangeError(`a payout has 1..${PER_TX} transfers`);
  return 1_000 + 300 * n;
};
/** The fee of a payout of n transfers at `priceMicroLamports`: 5,000 + ceil(CU_LIMIT(n) × price / 10⁶), lamports (BigInt). */
export const payoutFee = (n, priceMicroLamports) => BASE_FEE + priorityFeeLamports(cuLimit(n), toBig(priceMicroLamports, "the priority price"));

/** The minimum counted balance: ceil(supply × ppm / 10⁶), raw units. */
export function minBalance(supply, ppm) {
  const s = toBig(supply, "the supply"), p = toBig(ppm, "the minimum-balance ppm");
  if (s < 0n || p < 0n) throw new RewardsError("the supply and the ppm are 0 or more");
  return ceilDiv(s * p, 1_000_000n);
}

/* ── configuration (repository variables, each clamped as launchCaps clamps its caps) ────── */

/** REWARDS_ENABLED: "on" (claims and payouts are sent), "dry" (samples, points and closes are committed; claims and payouts are built and simulated unsigned, nothing is signed or sent), anything else "off". */
export function rewardsMode(env = {}) {
  const v = String(env.REWARDS_ENABLED ?? "").trim().toLowerCase();
  return v === "on" ? "on" : v === "dry" ? "dry" : "off";
}

export const REWARDS_DEFAULTS = Object.freeze({
  holderSharePct: 100, everyDays: 7, releasePct: 50, walletCapPct: 10, minBalancePpm: 100,
  minPayoutSol: 0.001, minClaimSol: 0.01, maxTxPerRun: 10, maxSolPerRun: 2, priorityMicroLamports: 100_000,
});
export const REWARDS_RANGES = Object.freeze({
  holderSharePct: [0, 100], everyDays: [1, 30], releasePct: [10, 100], walletCapPct: [1, 100], minBalancePpm: [10, 10_000],
  minPayoutSol: [0.0001, 0.1], minClaimSol: [0.001, 1], maxTxPerRun: [1, 50], maxSolPerRun: [0, 20], priorityMicroLamports: [0, 1_000_000],
});
export const REWARDS_VARS = Object.freeze({
  holderSharePct: "REWARDS_HOLDER_SHARE_PCT", everyDays: "REWARDS_EVERY_DAYS", releasePct: "REWARDS_RELEASE_PCT",
  walletCapPct: "REWARDS_WALLET_CAP_PCT", minBalancePpm: "REWARDS_MIN_BALANCE_PPM", minPayoutSol: "REWARDS_MIN_PAYOUT_SOL",
  minClaimSol: "REWARDS_MIN_CLAIM_SOL", maxTxPerRun: "REWARDS_MAX_TX_PER_RUN", maxSolPerRun: "REWARDS_MAX_SOL_PER_RUN",
  priorityMicroLamports: "LAUNCH_PRIORITY_MICROLAMPORTS",
});
const SOL_KEYS = ["minPayoutSol", "minClaimSol", "maxSolPerRun"];

/**
 * The rewards configuration from the repository variables, each with its default when unset or not a
 * number, clamped into its range (whole numbers except the SOL amounts): { mode, holderSharePct,
 * everyDays, releasePct, walletCapPct, minBalancePpm, maxTxPerRun, priorityMicroLamports (Numbers),
 * minPayoutLamports, minClaimLamports, maxLamportsPerRun (BigInt lamports), notes (what was defaulted
 * or clamped, for the log) }.
 */
export function rewardsConfig(env = {}) {
  const notes = [];
  const read = (k) => {
    const name = REWARDS_VARS[k], def = REWARDS_DEFAULTS[k], [lo, hi] = REWARDS_RANGES[k];
    const raw = env[name];
    if (raw === undefined || raw === null || String(raw).trim() === "") return def;
    let n = Number(String(raw).trim());
    if (!Number.isFinite(n)) { notes.push(`${name} is not a number; the default ${def} is used`); return def; }
    if (!SOL_KEYS.includes(k) && !Number.isInteger(n)) { const f = Math.floor(n); notes.push(`${name} ${n} is not a whole number; ${f} is used`); n = f; }
    if (n < lo || n > hi) { const c = Math.min(hi, Math.max(lo, n)); notes.push(`${name} ${n} is outside ${lo}..${hi}; ${c} is used`); return c; }
    return n;
  };
  const lamports = (k) => BigInt(Math.round(read(k) * 1e9));
  return {
    mode: rewardsMode(env),
    holderSharePct: read("holderSharePct"), everyDays: read("everyDays"), releasePct: read("releasePct"),
    walletCapPct: read("walletCapPct"), minBalancePpm: read("minBalancePpm"), maxTxPerRun: read("maxTxPerRun"),
    priorityMicroLamports: read("priorityMicroLamports"),
    minPayoutLamports: lamports("minPayoutSol"), minClaimLamports: lamports("minClaimSol"), maxLamportsPerRun: lamports("maxSolPerRun"),
    notes,
  };
}

/** The parts of the configuration the state rules use, checked (a caller passes rewardsConfig's answer, or a part of it). */
function rulesOf(cfg = {}) {
  const d = REWARDS_DEFAULTS;
  const c = {
    everyDays: cfg.everyDays ?? d.everyDays, releasePct: cfg.releasePct ?? d.releasePct,
    walletCapPct: cfg.walletCapPct ?? d.walletCapPct, minBalancePpm: cfg.minBalancePpm ?? d.minBalancePpm,
  };
  for (const k of Object.keys(c)) {
    const [lo, hi] = REWARDS_RANGES[k];
    if (!whole(c[k], lo, hi)) throw new RewardsError(`${REWARDS_VARS[k]} must be a whole number in ${lo}..${hi} (use rewardsConfig)`);
  }
  return c;
}

/* ── the mint gate ────────────────────────────────────────────────────────────────────── */

const bytesOf = (account, what) => {
  if (!Array.isArray(account?.data) || typeof account.data[0] !== "string" || account.data[1] !== "base64") throw new RewardsError(`${what}'s data is not [base64, "base64"]`);
  return Buffer.from(account.data[0], "base64");
};

/** The mint from its getAccountInfo answer (base64): { tokenProgram, supply (BigInt), decimals, fixedSupply (no mint authority: the supply can only fall) }. Throws RewardsError when it is not an initialized mint. */
export function mintFromAccount(account) {
  if (!account) throw new RewardsError("the mint account does not exist");
  if (account.owner !== TOKEN_PROGRAM && account.owner !== TOKEN_2022_PROGRAM) throw new RewardsError("the mint account is not owned by the token program or Token-2022");
  const d = bytesOf(account, "the mint account");
  if (d.length < MINT_LAYOUT.minSize) throw new RewardsError(`the mint account has ${d.length} bytes; a mint has at least ${MINT_LAYOUT.minSize}`);
  if (d[MINT_LAYOUT.initialized] !== 1) throw new RewardsError("the mint is not initialized");
  if (d.length > MINT_LAYOUT.accountTypeAt && d[MINT_LAYOUT.accountTypeAt] !== MINT_LAYOUT.accountTypeMint) throw new RewardsError("the account is not a Mint (its account type byte)");
  // A mint is exactly 82 bytes, or (Token-2022 with extensions) padded to 165 and typed at byte 165; 83..165 bytes is a token account or a multisig.
  if (d.length !== MINT_LAYOUT.minSize && d.length <= MINT_LAYOUT.accountTypeAt) throw new RewardsError(`the account has ${d.length} bytes: a mint has 82, or more than 165 with its type byte`);
  return Object.freeze({ tokenProgram: account.owner, supply: d.readBigUInt64LE(MINT_LAYOUT.supply), decimals: d[MINT_LAYOUT.decimals], fixedSupply: d.readUInt32LE(MINT_AUTHORITY.tag) === 0 });
}

/**
 * Whether sampling may go on: `contract` (data/socials.json "contract"), `account` (its getAccountInfo
 * answer, finalized; null when it does not exist; undefined when it was not read) and `state` (the
 * rewards state: its stored mint). Returns a frozen { ok, changed, problem, mint, tokenProgram, supply,
 * decimals }. ok false: no sample and no close. changed: the contract is not the stored mint (the
 * owner must dispatch new_epoch=<contract>; owed amounts are still paid).
 */
export function mintGate({ contract, account, state } = {}) {
  const no = (problem, changed = false) => Object.freeze({ ok: false, changed, problem, mint: null, tokenProgram: null, supply: null, decimals: null, fixedSupply: null });
  const c = typeof contract === "string" ? contract.trim() : "";
  if (!c) return no("no $CATSANC contract is set in data/socials.json: nothing is sampled until one is");
  if (!isAddress(c)) return no("data/socials.json \"contract\" is not a Solana address: nothing is sampled");
  if (state?.mint && state.mint !== c) {
    return no(`data/socials.json "contract" (${c}) is not the mint the rewards track (${state.mint}): no samples and no closes until the owner runs the Rewards workflow with new_epoch=${c} (owed amounts are still paid)`, true);
  }
  if (account === undefined) return no("the mint account was not read");
  let m;
  try { m = mintFromAccount(account); } catch (e) { return no(`the contract ${c} is not a valid mint: ${e.message}`); }
  if (state?.tokenProgram && state.tokenProgram !== m.tokenProgram) return no(`the mint's token program is not the one the rewards track (${state.tokenProgram})`, true);
  if (m.supply === 0n) return no("the mint's supply is 0");
  return Object.freeze({ ok: true, changed: false, problem: null, mint: c, ...m });
}

/* ── a sample: the token accounts, the exclusions ──────────────────────────────────────── */

/**
 * The balances in a getProgramAccounts answer (its value: [{ pubkey, account: { owner, data: [base64,
 * "base64"] } }], each data the TOKEN_SLICE slice). Returns { holders: Map owner → BigInt (the sum of
 * its initialized accounts; owners with 0 left out), total (every account, frozen included), frozen,
 * accounts }. Throws RewardsError on anything it cannot read: a slice of the wrong length, an account
 * of another program than `tokenProgram` (when given), a state that is neither initialized nor frozen,
 * an account listed twice.
 */
export function holdersFromAccounts(list, { tokenProgram = null } = {}) {
  if (!Array.isArray(list)) throw new RewardsError("getProgramAccounts did not answer with a list");
  const holders = new Map(), seen = new Set();
  let total = 0n, frozen = 0n;
  for (const item of list) {
    if (!isAddress(item?.pubkey)) throw new RewardsError("a token account without an address");
    if (seen.has(item.pubkey)) throw new RewardsError(`the token account ${item.pubkey} is listed twice`);
    seen.add(item.pubkey);
    if (tokenProgram && item.account?.owner !== tokenProgram) throw new RewardsError(`the token account ${item.pubkey} is not the mint's program's`);
    const d = bytesOf(item.account, `the token account ${item.pubkey}`);
    if (d.length !== TOKEN_SLICE.length) throw new RewardsError(`the token account ${item.pubkey} slice has ${d.length} bytes, not ${TOKEN_SLICE.length}`);
    const owner = new Uint8Array(d.subarray(TOKEN_SLICE.owner, TOKEN_SLICE.owner + 32));
    const amount = d.readBigUInt64LE(TOKEN_SLICE.amount);
    const state = d[TOKEN_SLICE.state];
    if (state !== TOKEN_STATE.initialized && state !== TOKEN_STATE.frozen) throw new RewardsError(`the token account ${item.pubkey} is neither initialized nor frozen`);
    total += amount;
    if (state === TOKEN_STATE.frozen) { frozen += amount; continue; }
    if (amount === 0n) continue;
    const o = base58Encode(owner);
    holders.set(o, (holders.get(o) ?? 0n) + amount);
  }
  return { holders, total, frozen, accounts: list.length };
}

/**
 * Why a sample must not be used, or null. total: Σ over every token account at the accounts' slot S;
 * supply: the mint's supply read at S or later; supplyBefore (when given): the supply read at S or
 * earlier; fixedSupply: the mint has no mint authority. With both reads of a fixed-supply mint, the
 * supply at S lies between them (it can only fall: a burn), so supply ≤ total ≤ supplyBefore is a whole
 * answer; otherwise (a mint that can still mint, or one read only) total must equal every read. A
 * truncated answer (a row missing) falls under the later supply and is refused.
 */
export function supplyProblem({ total, supply, supplyBefore = undefined, fixedSupply = false }) {
  if (typeof total !== "bigint" || typeof supply !== "bigint" || (supplyBefore !== undefined && typeof supplyBefore !== "bigint")) return "the sample's total or the supply is not a number";
  if (supplyBefore !== undefined && fixedSupply === true) {
    if (supply <= total && total <= supplyBefore) return null;
    return `the token accounts add up to ${total}, outside the mint's supply read before (${supplyBefore}) and after (${supply}) them: the answer is incomplete, the sample is skipped`;
  }
  if (total !== supply || (supplyBefore !== undefined && total !== supplyBefore)) return `the token accounts add up to ${total}, not the mint's supply ${supply}: the answer is incomplete, the sample is skipped`;
  return null;
}

export const EXCLUDE_NOTE = "Wallets that never earn $CATSANC holder rewards (scripts/lib/rewards.mjs), besides data/wallets.json's and every off-curve owner (pools, bonding curves, lockers, vaults): { address, reason }. Edited by the owner. A wallet added here stops earning at the next sample; what it was already owed is still paid.";

/** data/rewards-exclude.json: { note, exclude: [{ address, reason }] }. Missing: empty. Anything malformed throws (fail closed: no sample). */
export function validateExcludeFile(data) {
  if (data === null || data === undefined) return { note: EXCLUDE_NOTE, exclude: [] };
  if (!isObj(data) || !Array.isArray(data.exclude) || extraKey(data, ["note", "exclude"])) throw new RewardsError(`${REWARDS_FILES.exclude} must be { note, exclude: [{ address, reason }] }`);
  const seen = new Set();
  data.exclude.forEach((r, i) => {
    if (!isObj(r) || extraKey(r, ["address", "reason"])) throw new RewardsError(`${REWARDS_FILES.exclude}: row ${i + 1} must be { address, reason }`);
    if (!isAddress(r.address)) throw new RewardsError(`${REWARDS_FILES.exclude}: row ${i + 1}'s address is not a Solana address`);
    if (typeof r.reason !== "string" || r.reason.length < 1 || r.reason.length > 200) throw new RewardsError(`${REWARDS_FILES.exclude}: row ${i + 1} needs a short reason`);
    if (seen.has(r.address)) throw new RewardsError(`${REWARDS_FILES.exclude}: ${r.address} is listed twice`);
    seen.add(r.address);
  });
  return { note: typeof data.note === "string" ? data.note : EXCLUDE_NOTE, exclude: data.exclude.map((r) => ({ address: r.address, reason: r.reason })) };
}

/**
 * The excluded addresses: every data/wallets.json launchers row (whatever its dates) and every
 * data/rewards-exclude.json row. Throws RewardsError when either does not parse or holds a bad address
 * (fail closed: no sample).
 */
export function exclusionSet({ wallets, exclude = null } = {}) {
  const w = validateWallets(wallets ?? null);
  if (w.refused.length) throw new RewardsError(`${REWARDS_FILES.wallets} does not parse (${w.refused[0].detail}): no sample`);
  const set = new Set(w.launchers.map((l) => l.address));
  for (const r of validateExcludeFile(exclude).exclude) set.add(r.address);
  return set;
}

const CURVE = new Map();
/** True when `owner` is not an address or is off the ed25519 curve (a PDA: a bonding curve, a pool, a locker, a vault): it never earns. Memoised. */
export function offCurve(owner) {
  let v = CURVE.get(owner);
  if (v === undefined) {
    const b = typeof owner === "string" && isAddress(owner) ? base58Decode(owner) : null;
    v = !b || !isOnCurve(b);
    if (CURVE.size > 200_000) CURVE.clear();
    CURVE.set(owner, v);
  }
  return v;
}

/** The exclusion predicate applySample uses: the set, the reserved and program addresses (NEVER_EARN), off-curve owners, and the caller's callback. */
function excluder({ excluded = new Set(), isExcluded = null } = {}) {
  if (!(excluded instanceof Set)) throw new RewardsError("excluded must be a Set of addresses");
  if (isExcluded !== null && typeof isExcluded !== "function") throw new RewardsError("isExcluded must be a function");
  return (o) => excluded.has(o) || NEVER_EARN.has(o) || offCurve(o) || (isExcluded !== null && isExcluded(o) === true);
}

/* ── the state ────────────────────────────────────────────────────────────────────────── */

export const STATE_NOTE = "The $CATSANC holder rewards' sampling state (scripts/lib/rewards.mjs): the rules in force (the repository variables the site quotes), the verified clock V, the current period, and each wallet's lots [[amount, since V]] (oldest first), points this period, what it is owed in lamports, and a hold on its payouts, if any. Written by the Rewards workflow; do not edit by hand.";
const STATE_FIELDS = ["note", "version", "rules", "mint", "tokenProgram", "decimals", "epoch", "tPrev", "slotPrev", "V", "period", "periodStart", "periodEnd", "intervals", "wallets"];
const WALLET_FIELDS = ["lots", "pts", "ptsAt", "owed", "first", "hold"];
const HOLD_FIELDS = ["until", "slot", "reason"];
export const STATE_VERSION = 1;

/** The rules the site quotes (state.json "rules", written by each sample from the repository variables). */
export const RULE_KEYS = Object.freeze(["everyDays", "releasePct", "walletCapPct", "minBalancePpm", "minPayoutLamports"]);
const MIN_PAYOUT_RANGE = REWARDS_RANGES.minPayoutSol.map((s) => BigInt(Math.round(s * 1e9)));
/** { everyDays, releasePct, walletCapPct, minBalancePpm, minPayoutLamports (BigInt) } from rewardsConfig's answer (or a part of it; the defaults fill the rest). */
export function siteRules(cfg = {}) {
  const r = rulesOf(cfg);
  const minPayoutLamports = cfg.minPayoutLamports ?? BigInt(Math.round(REWARDS_DEFAULTS.minPayoutSol * 1e9));
  if (typeof minPayoutLamports !== "bigint" || minPayoutLamports < MIN_PAYOUT_RANGE[0] || minPayoutLamports > MIN_PAYOUT_RANGE[1]) throw new RewardsError("minPayoutLamports must be a BigInt in REWARDS_MIN_PAYOUT_SOL's range (use rewardsConfig)");
  return Object.freeze({ ...r, minPayoutLamports });
}
const sameRules = (a, b) => !!a && !!b && RULE_KEYS.every((k) => a[k] === b[k]);
/** Record the rules in force in the state (true when they changed: the state is to be written). */
export function setRules(state, cfg) {
  const r = siteRules(cfg);
  if (sameRules(state.rules, r)) return false;
  state.rules = r;
  return true;
}

/** A state before any genesis (no mint tracked yet). Wallets: Map address → { lots: [[BigInt, V]], pts, ptsAt, owed, first, hold? }. */
export function emptyState() {
  return {
    version: STATE_VERSION, rules: null, mint: null, tokenProgram: null, decimals: null, epoch: null, tPrev: null, slotPrev: null,
    V: 0, period: 0, periodStart: null, periodEnd: null, intervals: [], wallets: new Map(),
  };
}

const newWallet = (first) => ({ lots: [], pts: 0n, ptsAt: 0, owed: 0n, first });
const lotsSum = (w) => {
  const l = w.lots;
  if (l.length === 0) return 0n;
  let s = l[0][0];
  for (let i = 1; i < l.length; i++) s += l[i][0];
  return s;
};

const AMOUNT = /^\d{1,20}$/;
const SIGNED = /^-?\d{1,20}$/;
const POINTS = /^\d{1,60}$/;
function readAmount(v, what, { signed = false, points = false } = {}) {
  const re = points ? POINTS : signed ? SIGNED : AMOUNT;
  if (typeof v !== "string" || !re.test(v)) throw new RewardsError(`${what} must be a whole number written as a string`);
  const n = BigInt(v);
  if (String(n) !== v) throw new RewardsError(`${what} is not written canonically (no leading zeros, no -0)`);
  if (!points && (n > U64_MAX || n < -U64_MAX)) throw new RewardsError(`${what} is more than 2^64 − 1`);
  return n;
}

/**
 * data/rewards/state.json, checked field by field and turned into the working state (BigInts, wallets a
 * Map). A missing file is emptyState(). Anything malformed throws RewardsError: a corrupted file is
 * refused, never trusted.
 */
export function validateRewardsState(data) {
  if (data === null || data === undefined) return emptyState();
  const bad = (m) => { throw new RewardsError(`${REWARDS_FILES.state}: ${m}`); };
  if (!isObj(data)) bad("must be an object");
  const extra = extraKey(data, STATE_FIELDS);
  if (extra) bad(`unknown field ${extra}`);
  if (data.version !== STATE_VERSION) bad(`version must be ${STATE_VERSION}`);
  const s = emptyState();
  if (data.rules !== null && data.rules !== undefined) {
    const r = data.rules;
    if (!isObj(r) || extraKey(r, RULE_KEYS) || RULE_KEYS.some((k) => r[k] === undefined)) bad(`rules must be null or { ${RULE_KEYS.join(", ")} }`);
    try { s.rules = siteRules({ ...r, minPayoutLamports: readAmount(r.minPayoutLamports, "rules.minPayoutLamports") }); } catch (e) { bad(`rules: ${e.message}`); }
  } else if (data.rules === undefined) bad("rules must be null or the rules in force");
  const pre = data.epoch === null;
  if (pre) {
    for (const k of ["mint", "tokenProgram", "decimals", "tPrev", "slotPrev", "periodStart", "periodEnd"]) if (data[k] !== null) bad(`${k} must be null before genesis`);
    if (data.V !== 0) bad("V must be 0 before genesis");
    if (!Array.isArray(data.intervals) || data.intervals.length) bad("intervals must be empty before genesis");
  } else {
    if (!whole(data.epoch, 1)) bad("epoch must be a chain time in seconds");
    if (!isAddress(data.mint)) bad("mint must be an address");
    if (data.tokenProgram !== TOKEN_PROGRAM && data.tokenProgram !== TOKEN_2022_PROGRAM) bad("tokenProgram must be the token program or Token-2022");
    if (!whole(data.decimals, 0, 255)) bad("decimals must be 0..255");
    if (!whole(data.tPrev, data.epoch)) bad("tPrev must be a chain time at or after epoch");
    if (!whole(data.slotPrev)) bad("slotPrev must be a slot");
    if (!whole(data.V)) bad("V must be whole seconds");
    if (!whole(data.period, 1)) bad("period must be 1 or more after genesis");
    if (!whole(data.periodStart, 1) || !whole(data.periodEnd, 1) || data.periodEnd <= data.periodStart) bad("periodStart and periodEnd must be chain times, start before end");
    if (data.periodEnd <= data.tPrev) bad("periodEnd must be after tPrev (a due close was not made)");
    if (!Array.isArray(data.intervals)) bad("intervals must be a list");
    let at = null;
    data.intervals.forEach((iv, i) => {
      if (!Array.isArray(iv) || iv.length !== 2 || !whole(iv[0]) || !whole(iv[1], 1, GAP_CAP)) bad(`interval ${i + 1} must be [V_start, dt] with dt 1..${GAP_CAP}`);
      if (at !== null && iv[0] !== at) bad(`interval ${i + 1} does not start where the one before ends`);
      at = iv[0] + iv[1];
    });
    if (at !== null && at !== data.V) bad("the last interval does not end at V");
    s.mint = data.mint; s.tokenProgram = data.tokenProgram; s.decimals = data.decimals; s.epoch = data.epoch;
    s.tPrev = data.tPrev; s.slotPrev = data.slotPrev; s.V = data.V; s.periodStart = data.periodStart; s.periodEnd = data.periodEnd;
    s.intervals = data.intervals.map((iv) => [iv[0], iv[1]]);
  }
  if (!whole(data.period)) bad("period must be a whole number");
  s.period = data.period;
  if (!isObj(data.wallets)) bad("wallets must be an object keyed by address");
  for (const [a, w] of Object.entries(data.wallets)) {
    const wb = (m) => bad(`wallet ${a}: ${m}`);
    if (!isAddress(a)) bad(`wallet key ${String(a).slice(0, 50)} is not an address`);
    if (!isObj(w)) wb("must be an object");
    const x = extraKey(w, WALLET_FIELDS);
    if (x) wb(`unknown field ${x}`);
    if (!Array.isArray(w.lots) || w.lots.length > MAX_LOTS) wb(`lots must be a list of at most ${MAX_LOTS}`);
    if (pre && w.lots.length) wb("no lots before genesis");
    let prev = -1, sum = 0n;
    const lots = w.lots.map((l, i) => {
      if (!Array.isArray(l) || l.length !== 2) wb(`lot ${i + 1} must be [amount, sinceV]`);
      const amt = readAmount(l[0], `wallet ${a} lot ${i + 1}'s amount`);
      if (amt === 0n) wb(`lot ${i + 1} is empty`);
      if (!whole(l[1], 0, s.V)) wb(`lot ${i + 1}'s since must be 0..V`);
      if (l[1] < prev) wb("lots must be oldest first");
      prev = l[1]; sum += amt;
      return [amt, l[1]];
    });
    if (sum > U64_MAX) wb("its lots add up to more than 2^64 − 1");
    const pts = readAmount(w.pts, `wallet ${a}'s pts`, { points: true });
    if (pre && pts !== 0n) wb("no points before genesis");
    if ((lots.length || pts > 0n) && offCurve(a)) wb("an off-curve owner (a PDA) never holds lots or points");
    if (!whole(w.ptsAt, 0, s.intervals.length)) wb("ptsAt must index the period's intervals");
    const owed = readAmount(w.owed, `wallet ${a}'s owed`);
    if (w.first !== null && !whole(w.first, 1)) wb("first must be a chain time or null");
    const row = { lots, pts, ptsAt: w.ptsAt, owed, first: w.first };
    if (w.hold !== undefined) {
      const h = w.hold;
      if (!isObj(h) || extraKey(h, HOLD_FIELDS) || !isTime(h.until) || !(h.slot === null || whole(h.slot)) || typeof h.reason !== "string" || h.reason.length < 1 || h.reason.length > 300) {
        wb("hold must be { until: YYYY-MM-DDTHH:MM:SSZ, slot: a slot or null, reason }");
      }
      row.hold = { until: h.until, slot: h.slot, reason: h.reason };
    }
    s.wallets.set(a, row);
  }
  return s;
}

/** The state as written: plain JSON (amounts as strings, wallets sorted by address). */
export function stateJson(state) {
  const wallets = {};
  for (const a of [...state.wallets.keys()].sort()) {
    const w = state.wallets.get(a);
    wallets[a] = { lots: w.lots.map(([amt, s]) => [String(amt), s]), pts: String(w.pts), ptsAt: w.ptsAt, owed: String(w.owed), first: w.first ?? null };
    if (w.hold) wallets[a].hold = { until: w.hold.until, slot: w.hold.slot ?? null, reason: w.hold.reason };
  }
  const rules = state.rules ? Object.fromEntries(RULE_KEYS.map((k) => [k, k === "minPayoutLamports" ? String(state.rules[k]) : state.rules[k]])) : null;
  return {
    note: STATE_NOTE, version: STATE_VERSION, rules, mint: state.mint, tokenProgram: state.tokenProgram, decimals: state.decimals,
    epoch: state.epoch, tPrev: state.tPrev, slotPrev: state.slotPrev, V: state.V, period: state.period,
    periodStart: state.periodStart, periodEnd: state.periodEnd, intervals: state.intervals.map((iv) => [iv[0], iv[1]]), wallets,
  };
}

/** state.json's text: the globals one per line, the intervals on one line, one wallet per line (so an hourly commit touches only the wallets that traded). */
export function stateText(state) {
  const j = stateJson(state);
  const lines = ["{"];
  for (const k of STATE_FIELDS.filter((f) => f !== "intervals" && f !== "wallets")) lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(j[k])},`);
  lines.push(`  "intervals": ${JSON.stringify(j.intervals)},`);
  const ws = Object.entries(j.wallets);
  if (!ws.length) lines.push(`  "wallets": {}`);
  else {
    lines.push(`  "wallets": {`);
    ws.forEach(([a, w], i) => lines.push(`    ${JSON.stringify(a)}: ${JSON.stringify(w)}${i < ws.length - 1 ? "," : ""}`));
    lines.push("  }");
  }
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

/* ── points ───────────────────────────────────────────────────────────────────────────── */

/** Σ over intervals [from, upto) of dt × mFp(V_start − since), memoised per call (many lots share a since). */
function weightSum(state, since, from, upto, memo) {
  const key = `${since}:${from}:${upto}`;
  let s = memo.get(key);
  if (s === undefined) {
    s = 0n;
    for (let j = from; j < upto; j++) { const iv = state.intervals[j]; s += BigInt(iv[1]) * mFp(iv[0] - since); }
    memo.set(key, s);
  }
  return s;
}

/** Bring a wallet's points up to interval `upto` over intervals it held steady through (full credit on every lot). Bit-identical to crediting each interval as it came. */
function accrue(state, w, upto, memo) {
  if (w.lots.length && w.ptsAt < upto) for (const [amt, since] of w.lots) w.pts += amt * weightSum(state, since, w.ptsAt, upto, memo);
  w.ptsAt = upto;
}

/** Credit one interval [Vs, Vs + dt) on min(b0, b1) = c, walking the lots oldest first (the rule as written). */
function credit(w, Vs, dt, c) {
  let left = c;
  const d = BigInt(dt);
  for (const lot of w.lots) {
    if (left === 0n) break;
    const take = lot[0] < left ? lot[0] : left;
    w.pts += take * d * mFp(Vs - lot[1]);
    left -= take;
  }
}

/** Merge, in place, the adjacent pair of lots that loses the least age bonus at clock Vn, amount_i × (mFp(Vn − s_i) − mFp(Vn − s_{i+1})) (ties: the lowest i), into [amount_i + amount_{i+1}, s_{i+1}] (the younger date). */
export function mergeLots(lots, Vn) {
  if (!Array.isArray(lots) || lots.length < 2) throw new RewardsError("merging takes at least two lots");
  let best = -1, bestLoss = null;
  for (let i = 0; i + 1 < lots.length; i++) {
    const loss = lots[i][0] * (mFp(Vn - lots[i][1]) - mFp(Vn - lots[i + 1][1]));
    if (bestLoss === null || loss < bestLoss) { bestLoss = loss; best = i; }
  }
  lots.splice(best, 2, [lots[best][0] + lots[best + 1][0], lots[best + 1][1]]);
}

/** Apply a counted-balance change b0 → b1 to the lots at the new clock Vn (a buy pushes a new lot; a sell takes from the newest). */
function updateLots(w, b0, b1, Vn) {
  if (b1 > b0) {
    w.lots.push([b1 - b0, Vn]);
    while (w.lots.length > MAX_LOTS) mergeLots(w.lots, Vn);
  } else if (b1 < b0) {
    let out = b0 - b1;
    while (out > 0n) {
      const top = w.lots[w.lots.length - 1];
      if (top[0] <= out) { out -= top[0]; w.lots.pop(); } else { w.lots[w.lots.length - 1] = [top[0] - out, top[1]]; out = 0n; }
    }
  }
}

/** Bring every wallet's points up to date (at a close, or before comparing states). */
export function accrueAll(state, memo = new Map()) {
  for (const w of state.wallets.values()) accrue(state, w, state.intervals.length, memo);
}

/** Addresses in payout rows still sending (their wallet rows are kept). */
function inFlightAddresses(ledger) {
  const s = new Set();
  for (const p of ledger?.payouts ?? []) if (p.status === "sending") for (const r of p.rows) s.add(r[0]);
  return s;
}

/** Delete wallet rows (all, or only `only`'s addresses) with no lots, no points, nothing owed and nothing in flight. */
export function pruneWallets(state, ledger = null, only = null) {
  const keep = inFlightAddresses(ledger);
  const drop = (a) => { const w = state.wallets.get(a); if (w && !w.lots.length && w.pts === 0n && w.owed === 0n && !keep.has(a)) state.wallets.delete(a); };
  if (only) for (const a of only) drop(a);
  else for (const a of [...state.wallets.keys()]) drop(a);
}

/**
 * Apply one VALID sample (the caller has passed mintGate and supplyProblem) to `state`, in place:
 * sample = { T (chain seconds), slot, mint, tokenProgram, decimals, supply (BigInt), holders (Map owner
 * → raw balance, BigInt: the sum of its initialized accounts) }. cfg: rewardsConfig's answer (everyDays,
 * releasePct, walletCapPct, minBalancePpm). opts: { excluded (Set: data/wallets.json and the exclude
 * file, exclusionSet), isExcluded (a further predicate), unpayable (Map address → why: owners whose
 * account can never be paid, read at a close; their points are not allocated), eager (credit every
 * wallet at every sample; for the tests' lazy = eager proof) }. Off-curve owners, NEVER_EARN and the
 * mint itself are always excluded. A close due at this sample allocates into owed and adds to
 * ledger.A (closePeriod).
 * Returns { status: "genesis" | "sampled" | "skipped", reason?, closed (the period's audit record or
 * null), changed (wallets whose lots changed), excludedNow (addresses newly excluded), minBalance }.
 */
export function applySample(state, ledger, sample, cfg = {}, opts = {}) {
  const c = rulesOf(cfg);
  const exOpts = excluder(opts);
  const ex = (o) => o === sample?.mint || exOpts(o);
  const { T, slot, mint, tokenProgram, decimals, supply, holders } = sample ?? {};
  if (!whole(T, 1)) throw new RewardsError("the sample's time T is whole chain seconds");
  if (!whole(slot)) throw new RewardsError("the sample's slot is a whole number");
  if (state.epoch === null ? !isAddress(mint) : mint !== state.mint) throw new RewardsError("the sample is not of the mint the rewards track (mintGate first)");
  if (tokenProgram !== TOKEN_PROGRAM && tokenProgram !== TOKEN_2022_PROGRAM) throw new RewardsError("the sample's token program is not a token program");
  if (!whole(decimals, 0, 255)) throw new RewardsError("the sample's decimals are 0..255");
  if (typeof supply !== "bigint" || supply <= 0n || supply > U64_MAX) throw new RewardsError("the sample's supply is a BigInt in 1..2^64−1");
  if (!(holders instanceof Map)) throw new RewardsError("the sample's holders are a Map owner → BigInt");
  let sum = 0n, badHolder = false;
  holders.forEach((b, o) => {
    if (typeof o !== "string" || typeof b !== "bigint" || b < 0n || b > U64_MAX) badHolder = true;
    else sum += b;
  });
  if (badHolder) throw new RewardsError("a holder's balance is a BigInt in 0..2^64−1");
  if (sum > supply) throw new RewardsError("the holders hold more than the supply");
  const minBal = minBalance(supply, c.minBalancePpm);
  const excludedNow = [];

  if (state.epoch === null) {
    Object.assign(state, {
      mint, tokenProgram, decimals, epoch: T, tPrev: T, slotPrev: slot, V: 0, intervals: [],
      period: Math.max(state.period, 1), periodStart: T, periodEnd: T + c.everyDays * DAY_SECONDS,
    });
    let changed = 0;
    for (const w of state.wallets.values()) { w.lots = []; w.pts = 0n; w.ptsAt = 0; }
    for (const [o, raw] of holders) {
      if (ex(o)) continue;
      const b = raw >= minBal ? raw : 0n;
      if (b === 0n) continue;
      let w = state.wallets.get(o);
      if (!w) { w = newWallet(T); state.wallets.set(o, w); }
      w.first ??= T;
      w.lots = [[b, 0]];
      changed++;
    }
    return { status: "genesis", closed: null, changed, excludedNow, minBalance: minBal };
  }

  if (tokenProgram !== state.tokenProgram) throw new RewardsError("the sample is not of the token program the rewards track (mintGate first)");
  if (!(T > state.tPrev)) return { status: "skipped", reason: `T ${T} is not after the previous sample's ${state.tPrev}`, closed: null, changed: 0, excludedNow, minBalance: minBal };
  if (!(slot > state.slotPrev)) return { status: "skipped", reason: `slot ${slot} is not after the previous sample's ${state.slotPrev}`, closed: null, changed: 0, excludedNow, minBalance: minBal };

  const dt = Math.min(T - state.tPrev, GAP_CAP);
  const Vs = state.V, Vn = Vs + dt;
  const i = state.intervals.length;
  state.intervals.push([Vs, dt]);
  const memo = new Map();
  const touched = [];
  // Every owner in the sample, then every wallet with lots or points that is not (it sold out, or fell under the minimum).
  const visit = (o, raw) => {
    let w = state.wallets.get(o);
    if (ex(o)) {
      if (w && (w.lots.length || w.pts > 0n)) { w.lots = []; w.pts = 0n; w.ptsAt = i + 1; excludedNow.push(o); touched.push(o); }
      return;
    }
    const b0 = w ? lotsSum(w) : 0n;
    const b1 = raw >= minBal ? raw : 0n;
    if (b1 === b0 && !opts.eager) return; // lazy: brought up to date when its lots change, or at the close
    if (!w) { if (b1 === 0n) return; w = newWallet(T); w.ptsAt = i; state.wallets.set(o, w); }
    if (opts.eager) { if (w.ptsAt !== i) throw new RewardsError("eager accrual fell behind"); }
    else accrue(state, w, i, memo);
    credit(w, Vs, dt, min(b0, b1));
    if (b1 !== b0) { updateLots(w, b0, b1, Vn); touched.push(o); }
    w.first ??= T;
    w.ptsAt = i + 1;
  };
  holders.forEach((raw, o) => visit(o, raw));
  const gone = [];
  state.wallets.forEach((w, a) => { if ((w.lots.length || w.pts > 0n) && !holders.has(a)) gone.push(a); });
  for (const a of gone) visit(a, 0n);
  if (opts.eager) state.wallets.forEach((w) => { w.ptsAt = i + 1; });
  state.V = Vn; state.tPrev = T; state.slotPrev = slot;

  let closed = null;
  if (T >= state.periodEnd) closed = closePeriod(state, ledger, { T, slot }, c, { isExcluded: ex, memo, unpayable: opts.unpayable ?? null });
  pruneWallets(state, ledger, closed ? null : touched);
  return { status: "sampled", closed, changed: touched.length, excludedNow, minBalance: minBal };
}

/* ── the period close ─────────────────────────────────────────────────────────────────── */

/**
 * Split `pot` (BigInt lamports) over entries [[address, pts]] pro rata, with a per-wallet cap:
 * alloc_j = min(floor(pot × pts_j / Σpts), capAmt), capAmt = floor(pot × capPct / 100). What the cap
 * holds back from a wallet is NOT handed to the others (that would pay a short holding or a split wallet
 * more than its points, and erase the age bonus): it is left over, stays unallocated (E − A) and is
 * released again at later closes. Returns { alloc: Map address → lamports, capAmt, total, leftover }.
 * Σalloc ≤ pot, no wallet over capAmt and none over its pro-rata share (asserted).
 */
export function allocate(pot, entries, capPct) {
  if (typeof pot !== "bigint" || pot < 0n) throw new RewardsError("the pot is a BigInt, 0 or more");
  if (!whole(capPct, 1, 100)) throw new RewardsError("the cap is a whole percent 1..100");
  const alloc = new Map();
  const live = entries.filter(([, p]) => {
    if (typeof p !== "bigint" || p < 0n) throw new RewardsError("points are BigInts, 0 or more");
    return p > 0n;
  }).sort((x, y) => (x[1] === y[1] ? (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0) : x[1] > y[1] ? -1 : 1));
  if (!live.length || pot === 0n) return { alloc, capAmt: 0n, total: 0n, leftover: pot };
  const capAmt = (pot * BigInt(capPct)) / 100n;
  let tot = 0n;
  for (const [, p] of live) tot += p;
  for (const [a, p] of live) alloc.set(a, min((pot * p) / tot, capAmt));
  let total = 0n;
  for (const [a, p] of live) {
    const v = alloc.get(a);
    if (v < 0n || v > capAmt || v * tot > pot * p) throw new RewardsError("allocation over the cap or its points' share (a bug: refused)");
    total += v;
  }
  if (total > pot) throw new RewardsError("allocation over the pot (a bug: refused)");
  return { alloc, capAmt, total, leftover: pot - total };
}

/**
 * Close the current period at the sample (T, slot), in place: bring every wallet's points up to date,
 * set to 0 the points of an excluded owner and of one in `unpayable` (Map address → why: its account
 * can never be paid; listed in the record's `refused`), release pot = floor(max(0, E − A) × releasePct
 * / 100), allocate it (walletCapPct), owed += alloc, ledger.A += Σalloc, every pts = 0, period += 1,
 * periodEnd moves on by everyDays until it is past T. Returns the audit record { k, start, end, T,
 * slot, E, A_before, pot, capAmt, totalPts, releasePct, capPct, refused: [[address, pts, why]], rows:
 * [[address, pts, alloc]] } (BigInts; auditJson / auditText to write it).
 */
export function closePeriod(state, ledger, { T, slot }, cfg = {}, { isExcluded = null, memo = new Map(), unpayable = null } = {}) {
  const c = rulesOf(cfg);
  if (state.epoch === null) throw new RewardsError("no period is open before genesis");
  if (!ledger || typeof ledger.E !== "bigint" || typeof ledger.A !== "bigint") throw new RewardsError("closePeriod needs the ledger");
  if (unpayable !== null && !(unpayable instanceof Map)) throw new RewardsError("unpayable must be a Map address → why");
  accrueAll(state, memo);
  const ex = typeof isExcluded === "function" ? isExcluded : excluder({});
  const entries = [], refused = [];
  let totalPts = 0n;
  for (const [a, w] of state.wallets) {
    if (w.pts > 0n && ex(a)) w.pts = 0n;
    if (w.pts > 0n && unpayable?.has(a)) { refused.push([a, w.pts, String(unpayable.get(a)).slice(0, 200)]); w.pts = 0n; }
    if (w.pts > 0n) { entries.push([a, w.pts]); totalPts += w.pts; }
  }
  refused.sort((x, y) => (x[0] < y[0] ? -1 : 1));
  const U = ledger.E - ledger.A;
  const pot = U > 0n ? (U * BigInt(c.releasePct)) / 100n : 0n;
  const { alloc, capAmt, total } = allocate(pot, entries, c.walletCapPct);
  const A_before = ledger.A;
  for (const [a, v] of alloc) {
    const w = state.wallets.get(a);
    w.owed += v;
    if (w.owed > U64_MAX) throw new RewardsError(`wallet ${a} would be owed more than 2^64 − 1`);
  }
  ledger.A += total;
  entries.sort((x, y) => (x[1] === y[1] ? (x[0] < y[0] ? -1 : 1) : x[1] > y[1] ? -1 : 1));
  const record = {
    k: state.period, start: state.periodStart, end: state.periodEnd, T, slot, E: ledger.E, A_before, pot, capAmt, totalPts,
    releasePct: c.releasePct, capPct: c.walletCapPct, refused, rows: entries.map(([a, p]) => [a, p, alloc.get(a) ?? 0n]),
  };
  for (const w of state.wallets.values()) { w.pts = 0n; w.ptsAt = 0; }
  state.intervals = [];
  state.period += 1;
  const step = c.everyDays * DAY_SECONDS;
  state.periodStart = state.periodEnd;
  state.periodEnd += step;
  while (state.periodEnd <= T) { state.periodStart = state.periodEnd; state.periodEnd += step; }
  return record;
}

/** A period's audit record as written (strings for the big numbers). */
export function auditJson(r) {
  return {
    k: r.k, start: r.start, end: r.end, T: r.T, slot: r.slot, E: String(r.E), A_before: String(r.A_before), pot: String(r.pot),
    capAmt: String(r.capAmt), totalPts: String(r.totalPts), releasePct: r.releasePct, capPct: r.capPct,
    refused: (r.refused ?? []).map(([a, p, why]) => [a, String(p), why]),
    rows: r.rows.map(([a, p, v]) => [a, String(p), String(v)]),
  };
}
/** periods/<k>.json's text: one row per line. */
export function auditText(r) {
  const j = auditJson(r);
  const head = Object.entries(j).filter(([k]) => k !== "rows").map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  const rows = j.rows.map((x, i) => `    ${JSON.stringify(x)}${i < j.rows.length - 1 ? "," : ""}`);
  return `{\n${head.join("\n")}\n  "rows": [${rows.length ? `\n${rows.join("\n")}\n  ` : ""}]\n}\n`;
}

/**
 * The owner's new_epoch=<address> (it must equal the contract): the current period is closed at the last
 * valid sample (its record returned, or null before any genesis), every wallet's lots and points are
 * cleared (owed kept), and genesis happens at the next valid sample of the contract's mint.
 */
export function startNewEpoch(state, ledger, { mint, contract } = {}, cfg = {}, opts = {}) {
  if (!isAddress(mint)) throw new RewardsError("new_epoch must be a Solana address");
  if (mint !== (typeof contract === "string" ? contract.trim() : contract)) throw new RewardsError("new_epoch must equal data/socials.json \"contract\"");
  let closed = null;
  if (state.epoch !== null) closed = closePeriod(state, ledger, { T: state.tPrev, slot: state.slotPrev }, cfg, { isExcluded: excluder(opts), unpayable: opts.unpayable ?? null });
  for (const w of state.wallets.values()) { w.lots = []; w.pts = 0n; w.ptsAt = 0; }
  Object.assign(state, { mint: null, tokenProgram: null, decimals: null, epoch: null, tPrev: null, slotPrev: null, V: 0, intervals: [], periodStart: null, periodEnd: null });
  pruneWallets(state, ledger);
  return closed;
}

/* ── the ledger ───────────────────────────────────────────────────────────────────────── */

export const LEDGER_NOTE = "The $CATSANC holder rewards' ledger (scripts/lib/rewards.mjs): E = the holders' share of every creator-fee claim the launcher wallet made (measured from each claim transaction), A = allocated to wallets, P = paid, F = payout fees, and every claim and payout row. A = P + F + Σowed + Σ(net + share of payouts still sending). Written by the Rewards workflow; do not edit by hand.";
export const LEDGER_VERSION = 1;
export const CLAIM_STATUSES = Object.freeze(["sending", "landed", "expired"]);
export const PAYOUT_STATUSES = Object.freeze(["sending", "paid", "failed", "expired"]);
const LEDGER_FIELDS = ["note", "version", "E", "A", "P", "F", "cursor", "claims", "payouts"];
const CLAIM_FIELDS = ["sig", "lastValidBlockHeight", "status", "sharePct", "sentAt", "settledAt", "claimed", "walletFee", "net", "forHolders"];
const PAYOUT_FIELDS = ["sig", "lastValidBlockHeight", "status", "fee", "sentAt", "settledAt", "rows"];

export function emptyLedger() {
  return { version: LEDGER_VERSION, E: 0n, A: 0n, P: 0n, F: 0n, cursor: null, claims: [], payouts: [] };
}

/**
 * data/rewards/ledger.json, checked row by row and re-summed: E must be Σ forHolders of the landed
 * claims, P Σnet of the paid payouts, F Σfee of the paid and failed ones, A ≥ P + F + in flight; each
 * claim's forHolders = floorDiv(net × sharePct, 100) and net = claimed − walletFee; each payout's shares
 * add up to its fee; no signature twice. A missing file is emptyLedger(). Anything else throws
 * RewardsError (the file is refused, never trusted). Returns the working ledger (BigInts).
 */
export function validateRewardsLedger(data) {
  if (data === null || data === undefined) return emptyLedger();
  const bad = (m) => { throw new RewardsError(`${REWARDS_FILES.ledger}: ${m}`); };
  if (!isObj(data)) bad("must be an object");
  const extra = extraKey(data, LEDGER_FIELDS);
  if (extra) bad(`unknown field ${extra}`);
  if (data.version !== LEDGER_VERSION) bad(`version must be ${LEDGER_VERSION}`);
  const L = emptyLedger();
  L.E = readAmount(data.E, "E", { signed: true });
  for (const k of ["A", "P", "F"]) L[k] = readAmount(data[k], k);
  if (data.cursor !== null && !isSignature(data.cursor)) bad("cursor must be a signature or null");
  L.cursor = data.cursor;
  if (!Array.isArray(data.claims) || !Array.isArray(data.payouts)) bad("claims and payouts must be lists");
  const sigs = new Set();
  const sigOf = (r, what, i) => {
    if (!isSignature(r.sig)) bad(`${what} ${i + 1}'s sig is not a signature`);
    if (sigs.has(r.sig)) bad(`the signature ${r.sig} is listed twice`);
    sigs.add(r.sig);
    if (!whole(r.lastValidBlockHeight)) bad(`${what} ${i + 1}'s lastValidBlockHeight must be a whole number`);
    if (!isTime(r.sentAt)) bad(`${what} ${i + 1}'s sentAt must be YYYY-MM-DDTHH:MM:SSZ`);
    if (r.status === "sending" ? r.settledAt !== undefined : !isTime(r.settledAt)) bad(`${what} ${i + 1}: a settled row has settledAt, a sending row none`);
  };
  let E = 0n;
  data.claims.forEach((r, i) => {
    if (!isObj(r) || extraKey(r, CLAIM_FIELDS)) bad(`claim ${i + 1} has an unknown field`);
    sigOf(r, "claim", i);
    if (!CLAIM_STATUSES.includes(r.status)) bad(`claim ${i + 1}'s status is unknown`);
    if (!whole(r.sharePct, 0, 100)) bad(`claim ${i + 1}'s sharePct must be 0..100`);
    const row = { sig: r.sig, lastValidBlockHeight: r.lastValidBlockHeight, status: r.status, sharePct: r.sharePct, sentAt: r.sentAt };
    if (r.settledAt !== undefined) row.settledAt = r.settledAt;
    const measured = ["claimed", "walletFee", "net", "forHolders"];
    if (r.status === "landed") {
      row.claimed = readAmount(r.claimed, `claim ${i + 1}'s claimed`);
      row.walletFee = readAmount(r.walletFee, `claim ${i + 1}'s walletFee`);
      row.net = readAmount(r.net, `claim ${i + 1}'s net`, { signed: true });
      row.forHolders = readAmount(r.forHolders, `claim ${i + 1}'s forHolders`, { signed: true });
      if (row.net !== row.claimed - row.walletFee) bad(`claim ${i + 1}: net is not claimed − walletFee`);
      if (row.forHolders !== floorDiv(row.net * BigInt(row.sharePct), 100n)) bad(`claim ${i + 1}: forHolders is not floor(net × sharePct / 100)`);
      E += row.forHolders;
    } else if (measured.some((k) => r[k] !== undefined)) bad(`claim ${i + 1}: only a landed claim has amounts`);
    L.claims.push(row);
  });
  let P = 0n, F = 0n, flight = 0n;
  data.payouts.forEach((r, i) => {
    if (!isObj(r) || extraKey(r, PAYOUT_FIELDS)) bad(`payout ${i + 1} has an unknown field`);
    sigOf(r, "payout", i);
    if (!PAYOUT_STATUSES.includes(r.status)) bad(`payout ${i + 1}'s status is unknown`);
    const fee = readAmount(r.fee, `payout ${i + 1}'s fee`);
    if (!Array.isArray(r.rows) || r.rows.length < 1 || r.rows.length > PER_TX) bad(`payout ${i + 1} has 1..${PER_TX} rows`);
    const seen = new Set();
    let shares = 0n, nets = 0n;
    const rows = r.rows.map((x, j) => {
      if (!Array.isArray(x) || x.length !== 3 || !isAddress(x[0])) bad(`payout ${i + 1} row ${j + 1} must be [address, net, share]`);
      if (seen.has(x[0])) bad(`payout ${i + 1} pays ${x[0]} twice`);
      seen.add(x[0]);
      const net = readAmount(x[1], `payout ${i + 1} row ${j + 1}'s net`), share = readAmount(x[2], `payout ${i + 1} row ${j + 1}'s share`);
      if (net === 0n) bad(`payout ${i + 1} row ${j + 1} pays nothing`);
      shares += share; nets += net;
      return [x[0], net, share];
    });
    if (shares !== fee) bad(`payout ${i + 1}: the shares do not add up to the fee`);
    if (r.status === "paid") { P += nets; F += fee; }
    if (r.status === "failed") F += fee;
    if (r.status === "sending") flight += nets + fee;
    const row = { sig: r.sig, lastValidBlockHeight: r.lastValidBlockHeight, status: r.status, fee, sentAt: r.sentAt, rows };
    if (r.settledAt !== undefined) row.settledAt = r.settledAt;
    L.payouts.push(row);
  });
  if (L.E !== E) bad(`E is ${L.E} but the landed claims give ${E}`);
  if (L.P !== P) bad(`P is ${L.P} but the paid payouts give ${P}`);
  if (L.F !== F) bad(`F is ${L.F} but the paid and failed payouts' fees give ${F}`);
  if (L.A < L.P + L.F + flight) bad("A is less than what was paid, the fees and what is in flight");
  return L;
}

/** The ledger as written (strings for the amounts), rows in the order they were made. */
export function ledgerJson(L) {
  const claim = (r) => {
    const o = { sig: r.sig, lastValidBlockHeight: r.lastValidBlockHeight, status: r.status, sharePct: r.sharePct, sentAt: r.sentAt };
    if (r.settledAt !== undefined) o.settledAt = r.settledAt;
    if (r.status === "landed") Object.assign(o, { claimed: String(r.claimed), walletFee: String(r.walletFee), net: String(r.net), forHolders: String(r.forHolders) });
    return o;
  };
  const payout = (r) => {
    const o = { sig: r.sig, lastValidBlockHeight: r.lastValidBlockHeight, status: r.status, fee: String(r.fee), sentAt: r.sentAt };
    if (r.settledAt !== undefined) o.settledAt = r.settledAt;
    o.rows = r.rows.map(([a, n, s]) => [a, String(n), String(s)]);
    return o;
  };
  return {
    note: LEDGER_NOTE, version: LEDGER_VERSION, E: String(L.E), A: String(L.A), P: String(L.P), F: String(L.F), cursor: L.cursor,
    claims: L.claims.map(claim), payouts: L.payouts.map(payout),
  };
}
/** ledger.json's text: the totals one per line, one claim or payout row per line. */
export function ledgerText(L) {
  const j = ledgerJson(L);
  const list = (name, rows, last) => (rows.length
    ? [`  "${name}": [`, ...rows.map((r, i) => `    ${JSON.stringify(r)}${i < rows.length - 1 ? "," : ""}`), `  ]${last ? "" : ","}`]
    : [`  "${name}": []${last ? "" : ","}`]);
  const head = ["note", "version", "E", "A", "P", "F", "cursor"].map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(j[k])},`);
  return `${["{", ...head, ...list("claims", j.claims, false), ...list("payouts", j.payouts, true), "}"].join("\n")}\n`;
}

/** Σ(net + share) over the payout rows still sending: what may already have left the wallet but is not in P or F yet. */
export function inFlightLamports(L) {
  let s = 0n;
  for (const p of L.payouts) if (p.status === "sending") for (const r of p.rows) s += r[1] + r[2];
  return s;
}

/** Why the state and the ledger disagree (A ≠ P + F + Σowed + in flight), or null. */
export function identityProblem(state, L) {
  let owed = 0n;
  for (const w of state.wallets.values()) owed += w.owed;
  const rhs = L.P + L.F + owed + inFlightLamports(L);
  return L.A === rhs ? null : `the ledger's A (${L.A}) is not P + F + Σowed + in flight (${rhs})`;
}

const listed = (L, sig) => L.claims.find((r) => r.sig === sig) ?? L.payouts.find((r) => r.sig === sig) ?? null;

/** A claim about to be sent: its row "sending", with the holder share fixed NOW (sharePct: the clamped REWARDS_HOLDER_SHARE_PCT). Write the ledger before sending. */
export function recordClaimSending(L, { sig, lastValidBlockHeight, sharePct, sentAt }) {
  if (!isSignature(sig)) throw new RewardsError("the claim's signature is not a signature");
  if (listed(L, sig)) throw new RewardsError(`the signature ${sig} is already in the ledger`);
  if (!whole(lastValidBlockHeight)) throw new RewardsError("lastValidBlockHeight is a whole number");
  if (!whole(sharePct, 0, 100)) throw new RewardsError("sharePct is a whole percent 0..100");
  if (!isTime(sentAt)) throw new RewardsError("sentAt is YYYY-MM-DDTHH:MM:SSZ");
  const row = { sig, lastValidBlockHeight, status: "sending", sharePct, sentAt };
  L.claims.push(row);
  return row;
}

/**
 * Settle a claim row still sending. outcome: { status: "landed", claimed, walletFee, net } (measureClaim's
 * answer: net = claimed − walletFee, negative when the claim failed on chain and only cost its fee) →
 * forHolders = floorDiv(net × the row's sharePct, 100), E += forHolders; or { status: "expired" } (never
 * landed: nothing). Returns forHolders (0n when expired).
 */
export function settleClaim(L, sig, outcome, { settledAt } = {}) {
  const row = L.claims.find((r) => r.sig === sig);
  if (!row) throw new RewardsError(`no claim ${sig} in the ledger`);
  if (row.status !== "sending") throw new RewardsError(`the claim ${sig} is already settled`);
  if (!isTime(settledAt)) throw new RewardsError("settledAt is YYYY-MM-DDTHH:MM:SSZ");
  const status = outcome?.status ?? (outcome && "net" in outcome ? "landed" : null);
  if (status === "expired") { row.status = "expired"; row.settledAt = settledAt; return 0n; }
  if (status !== "landed") throw new RewardsError("a claim settles as landed or expired");
  const claimed = toBig(outcome.claimed, "claimed"), walletFee = toBig(outcome.walletFee, "walletFee"), net = toBig(outcome.net, "net");
  if (claimed < 0n || walletFee < 0n || net !== claimed - walletFee) throw new RewardsError("a claim's net is claimed − walletFee, both 0 or more");
  const forHolders = floorDiv(net * BigInt(row.sharePct), 100n);
  Object.assign(row, { status: "landed", settledAt, claimed, walletFee, net, forHolders });
  L.E += forHolders;
  return forHolders;
}

/** What holders are owed and not yet paid out: max(0, E − P − F). */
export const holdersUnpaid = (L) => max(0n, L.E - L.P - L.F);

/** I1: P + F + (in flight) + debit ≤ E, else why not. debit = Σnet + fee of the batch about to be signed. */
export function i1Problem(L, debit) {
  const d = toBig(debit, "the debit");
  const after = L.P + L.F + inFlightLamports(L) + d;
  return after <= L.E ? null : `I1: paid ${L.P} + fees ${L.F} + in flight ${inFlightLamports(L)} + this batch ${d} would be more than the holders' claimed share E ${L.E}`;
}

/** I2: the wallet's live balance ≥ LAUNCH_MIN_BALANCE + max(0, E − P − F − in flight), else the launcher has spent holders' SOL (refuse, warn). */
export function i2Problem(L, { balance, minBalanceLamports }) {
  const b = toBig(balance, "the balance"), m = toBig(minBalanceLamports, "the minimum balance");
  const need = m + max(0n, L.E - L.P - L.F - inFlightLamports(L));
  return b >= need ? null : `I2: the wallet holds ${b} lamports, less than LAUNCH_MIN_BALANCE ${m} plus the holders' unpaid ${need - m}: the launcher has spent holders' SOL`;
}

/** What one run may still pay out (transfers + fees): min(E − P − F − in flight, maxLamportsPerRun − spentThisRun), never below 0. */
export function payoutBudget(L, { maxLamportsPerRun, spentThisRun = inFlightLamports(L) } = {}) {
  const cap = toBig(maxLamportsPerRun, "maxLamportsPerRun") - toBig(spentThisRun, "spentThisRun");
  return max(0n, min(L.E - L.P - L.F - inFlightLamports(L), cap));
}

/**
 * A payout batch (planPayouts' batches[i]) about to be sent: gate I1 again, write its row "sending"
 * (signature, lastValidBlockHeight, rows [[address, net, share]]) and subtract net + share from each
 * owed. Write the ledger and the state before sending.
 */
export function recordPayoutSending(state, L, batch, { sig, lastValidBlockHeight, sentAt }) {
  if (!isSignature(sig)) throw new RewardsError("the payout's signature is not a signature");
  if (listed(L, sig)) throw new RewardsError(`the signature ${sig} is already in the ledger`);
  if (!whole(lastValidBlockHeight)) throw new RewardsError("lastValidBlockHeight is a whole number");
  if (!isTime(sentAt)) throw new RewardsError("sentAt is YYYY-MM-DDTHH:MM:SSZ");
  const rows = batch?.rows;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > PER_TX) throw new RewardsError(`a batch has 1..${PER_TX} rows`);
  const seen = new Set();
  let shares = 0n, debit = 0n;
  for (const r of rows) {
    const w = state.wallets.get(r.owner);
    if (!w || seen.has(r.owner)) throw new RewardsError(`the batch pays ${r.owner}, who is not owed or is paid twice`);
    seen.add(r.owner);
    if (typeof r.lamports !== "bigint" || typeof r.share !== "bigint" || r.lamports <= 0n || r.share < 0n) throw new RewardsError("a row is { owner, lamports > 0, share ≥ 0 } in BigInts");
    if (r.lamports + r.share > w.owed) throw new RewardsError(`the batch would pay ${r.owner} more than it is owed`);
    shares += r.share; debit += r.lamports + r.share;
  }
  if (shares !== batch.fee) throw new RewardsError("the fee shares do not add up to the fee");
  const p = i1Problem(L, debit);
  if (p) throw new RewardsError(p);
  for (const r of rows) { const w = state.wallets.get(r.owner); w.owed -= r.lamports + r.share; delete w.hold; }
  const row = { sig, lastValidBlockHeight, status: "sending", fee: batch.fee, sentAt, rows: rows.map((r) => [r.owner, r.lamports, r.share]) };
  L.payouts.push(row);
  return row;
}

/**
 * Settle a payout row still sending: "paid" (finalized, succeeded: P += Σnet, F += fee), "failed"
 * (landed but failed: F += fee, owed_j += net_j), "expired" (never landed and its blockhash expired:
 * owed_j += net_j + share_j). A wallet row deleted meanwhile comes back.
 */
export function settlePayout(state, L, sig, outcome, { settledAt } = {}) {
  const row = L.payouts.find((r) => r.sig === sig);
  if (!row) throw new RewardsError(`no payout ${sig} in the ledger`);
  if (row.status !== "sending") throw new RewardsError(`the payout ${sig} is already settled`);
  if (!isTime(settledAt)) throw new RewardsError("settledAt is YYYY-MM-DDTHH:MM:SSZ");
  const back = (a, v) => { let w = state.wallets.get(a); if (!w) { w = newWallet(null); state.wallets.set(a, w); } w.owed += v; };
  if (outcome === "paid") { for (const r of row.rows) L.P += r[1]; L.F += row.fee; }
  else if (outcome === "failed") { L.F += row.fee; for (const r of row.rows) back(r[0], r[1]); }
  else if (outcome === "expired") for (const r of row.rows) back(r[0], r[1] + r[2]);
  else throw new RewardsError("a payout settles as paid, failed or expired");
  row.status = outcome; row.settledAt = settledAt;
  return row;
}

/**
 * A claim settled "expired" that is on chain after all (the wallet's history lists it): settled now as
 * what it did, `measured` being measureClaim's answer ({ claimed, walletFee, net }; net < 0 for one that
 * failed on chain), E += forHolders at the row's own sharePct. Returns forHolders.
 */
export function landExpiredClaim(L, sig, measured, { settledAt } = {}) {
  const row = L.claims.find((r) => r.sig === sig);
  if (!row || row.status !== "expired") throw new RewardsError(`no expired claim ${sig} in the ledger`);
  const was = row.settledAt;
  row.status = "sending"; delete row.settledAt;
  try {
    return settleClaim(L, sig, { status: "landed", claimed: measured?.claimed, walletFee: measured?.walletFee, net: measured?.net }, { settledAt });
  } catch (e) { row.status = "expired"; row.settledAt = was; throw e; }
}

/**
 * A payout settled "expired" (its wallets owed again: net + share each) that is on chain after all:
 * settled now as what it did, "paid" (owed_j −= net_j + share_j, P += Σnet, F += fee) or "failed"
 * (owed_j −= share_j: its fee was spent, F += fee). Returns why it cannot be (a wallet no longer owed
 * that much: it was paid again; or I1), and then changes nothing; else null.
 */
export function landExpiredPayout(state, L, sig, outcome, { settledAt } = {}) {
  const row = L.payouts.find((r) => r.sig === sig);
  if (!row || row.status !== "expired") throw new RewardsError(`no expired payout ${sig} in the ledger`);
  if (outcome !== "paid" && outcome !== "failed") throw new RewardsError("an expired payout found on chain is paid or failed");
  if (!isTime(settledAt)) throw new RewardsError("settledAt is YYYY-MM-DDTHH:MM:SSZ");
  const back = (r) => (outcome === "paid" ? r[1] + r[2] : r[2]);
  if (!row.rows.every((r) => (state.wallets.get(r[0])?.owed ?? -1n) >= back(r))) return "its wallets are no longer owed what it paid them (they were paid again)";
  const p = i1Problem(L, outcome === "paid" ? row.rows.reduce((s, r) => s + r[1], 0n) + row.fee : row.fee);
  if (p) return p;
  for (const r of row.rows) state.wallets.get(r[0]).owed -= back(r);
  if (outcome === "paid") for (const r of row.rows) L.P += r[1];
  L.F += row.fee;
  row.status = outcome; row.settledAt = settledAt;
  return null;
}

/** Hold `addresses`' payouts until `until` (YYYY-MM-DDTHH:MM:SSZ) or, when `slot` is given, until the wallet's history is counted past that slot (releaseHolds), for `reason`. A wallet row deleted meanwhile comes back. */
export function holdWallets(state, addresses, { until, slot = null, reason }) {
  if (!isTime(until) || !(slot === null || whole(slot)) || typeof reason !== "string" || !reason) throw new RewardsError("a hold is { until, slot, reason }");
  for (const a of addresses) {
    let w = state.wallets.get(a);
    if (!w) { w = newWallet(null); state.wallets.set(a, w); }
    w.hold = { until, slot, reason: reason.slice(0, 300) };
  }
}

/** Release the holds kept until the wallet's history was counted past a slot older than `slot` (a signature at `slot` was just counted). Returns how many were released. */
export function releaseHolds(state, slot) {
  let n = 0;
  if (!whole(slot)) return n;
  for (const w of state.wallets.values()) if (w.hold && w.hold.slot !== null && w.hold.slot < slot) { delete w.hold; n++; }
  return n;
}

/** The ledger's settled or pending row kind for a wallet signature: "claim", "payout" or "other" (the pay job classifies every signature newer than the cursor, then moves the cursor). */
export function classifySignature(L, sig) {
  if (L.claims.some((r) => r.sig === sig)) return "claim";
  if (L.payouts.some((r) => r.sig === sig)) return "payout";
  return "other";
}

/** Move the cursor to the newest signature classified. */
export function advanceCursor(L, sig) {
  if (!isSignature(sig)) throw new RewardsError("the cursor is a signature");
  L.cursor = sig;
}

/** Of the wallet signatures newer than the cursor (getSignaturesForAddress until: cursor), the ones whose lamport change the earmark counts: not in the ledger, or a claim still sending. */
export function earmarkSignatures(L, sigs) {
  return sigs.filter((s) => {
    const c = L.claims.find((r) => r.sig === s);
    if (c) return c.status === "sending";
    return !L.payouts.some((r) => r.sig === s);
  });
}

/** Lamports the launcher must leave alone: max(0, E − P − F) + Σ max(0, d) over `deltas`, what each of earmarkSignatures' transactions claimed (the launcher measures it with measureClaim; a deposit claims nothing). No rewards ledger: 0. */
export function earmarkLamports(L, deltas = []) {
  let e = L ? holdersUnpaid(L) : 0n;
  for (const d of deltas) { const v = toBig(d, "a lamport change"); if (v > 0n) e += v; }
  return e;
}

/* ── payouts ─────────────────────────────────────────────────────────────────────────── */

/**
 * Why `address` can never be paid in SOL, from its account (a getMultipleAccounts answer, base64; null:
 * it does not exist, which is fine), or null: a reserved account key (RESERVED_ACCOUNT_KEYS), an
 * executable account, one owned by a program other than the System Program (a mint, a token account,
 * a program), or a System account holding data (a nonce account). The close gives such an owner no
 * share, and planPayouts never picks one.
 */
export function unpayableReason(address, acct) {
  if (RESERVED_ACCOUNT_KEYS.has(address)) return "a reserved account (a sysvar or a builtin program): the runtime refuses any SOL sent to it";
  if (acct === null) return null;
  if (!isObj(acct)) return "its account was not read";
  if (acct.executable) return "its account is executable (a program)";
  if (acct.owner !== SYSTEM_PROGRAM) return "its account is not a System Program account";
  if (!Array.isArray(acct.data) || typeof acct.data[0] !== "string") return "its account's data was not read";
  if (Buffer.from(acct.data[0], "base64").length !== 0 || (acct.space !== undefined && acct.space !== 0)) return "its account holds data";
  return null;
}

/** Why an account may not receive a payout (unpayableReason), or null, and its lamports. null (not found) is fine: 0 lamports. A number is lamports of a plain account. */
function recipientOf(address, acct) {
  if (RESERVED_ACCOUNT_KEYS.has(address)) return { lamports: 0n, problem: unpayableReason(address, null) };
  if (acct === null) return { lamports: 0n, problem: null };
  if (typeof acct === "bigint" || typeof acct === "number") return { lamports: toBig(acct, "lamports"), problem: null };
  if (!isObj(acct)) return { lamports: 0n, problem: "its account was not read" };
  let lamports;
  try { lamports = toBig(acct.lamports, "lamports"); } catch { return { lamports: 0n, problem: "its account's lamports are unreadable" }; }
  return { lamports, problem: unpayableReason(address, acct) };
}

/** Whether a wallet's hold (a failed simulation, an expired payout) still keeps it out of the payouts at `nowMs` (null: any hold does). */
const heldAt = (w, nowMs) => !!w.hold && (nowMs === null || !(Date.parse(w.hold.until) <= nowMs));

/**
 * One payout transaction from picked wallets [{ owner, amount (net + share), thr, lamports, owed }]:
 * k = picks.length, f = FEE(k), share_j = floor(f/k) + (j < f mod k ? 1 : 0), net_j = amount_j − share_j.
 * Returns { rows: [{ owner, lamports (net), share }], fee, debit, picks }. Every share is at most FEE1, so
 * a pick that passed planPayouts' thresholds with FEE1 passes them in any batch (asserted).
 */
export function payoutBatch(picks, { priceMicroLamports, rent }) {
  const k = picks?.length;
  if (!whole(k, 1, PER_TX)) throw new RewardsError(`a payout has 1..${PER_TX} transfers`);
  const rentL = toBig(rent, "the rent-exempt minimum"), fee1 = payoutFee(1, priceMicroLamports);
  const f = payoutFee(k, priceMicroLamports), kb = BigInt(k);
  const rows = picks.map((g, j) => {
    const share = f / kb + (BigInt(j) < f % kb ? 1n : 0n);
    const net = g.amount - share;
    if (share > fee1 || net < g.thr || g.lamports + net < rentL || net + share > g.owed) throw new RewardsError("a payout row breaks its threshold, the rent rule or its owed (a bug: refused)");
    return { owner: g.owner, lamports: net, share };
  });
  let debit = 0n, shares = 0n;
  for (const r of rows) { debit += r.lamports + r.share; shares += r.share; }
  if (shares !== f) throw new RewardsError("fee shares do not add up to the fee (a bug: refused)");
  return { rows, fee: f, debit, picks: picks.map((g) => ({ ...g })) };
}

/**
 * Who is paid this run, and how. state: its wallets' owed and lots; pot: the most this run may spend
 * (transfers + fees; payoutBudget); accounts: Map address → the recipient's getMultipleAccounts answer
 * (null: it does not exist; a number: lamports of a plain account); rent: getMinimumBalanceForRentExemption(0),
 * read this run (null: no payouts); priceMicroLamports; minPayoutLamports; exitMin; maxTx; payer (never
 * paid); nowMs (the run's clock: a wallet whose hold lasts past it is carried; null: every held wallet
 * is). Returns { batches: [{ rows: [{ owner, lamports (net), share }], fee, debit, picks }], payouts (the
 * rows, flat, with their batch), carry: [{ owner, owed, reason }], carried, dust (Σowed of wallets under
 * their threshold), spend (Σ debit) }. The picked wallets go in ceil(n / perTx) transactions of
 * near-equal size, in order. spend ≤ pot, each row's net + share ≤ its owed, net ≥ its threshold and
 * lamports + net ≥ rent (asserted).
 */
export function planPayouts(state, { pot, accounts = new Map(), rent, priceMicroLamports = REWARDS_DEFAULTS.priorityMicroLamports,
  minPayoutLamports = BigInt(Math.round(REWARDS_DEFAULTS.minPayoutSol * 1e9)), exitMin = EXIT_MIN, maxTx = REWARDS_DEFAULTS.maxTxPerRun, perTx = PER_TX, payer = null,
  nowMs = null } = {}) {
  if (typeof pot !== "bigint" || pot < 0n) throw new RewardsError("the pot is a BigInt, 0 or more");
  if (!(accounts instanceof Map)) throw new RewardsError("accounts is a Map address → account");
  if (!whole(maxTx, 0) || !whole(perTx, 1, PER_TX)) throw new RewardsError(`maxTx is 0 or more and perTx 1..${PER_TX}`);
  const minPay = toBig(minPayoutLamports, "minPayoutLamports"), exit = toBig(exitMin, "exitMin");
  const carry = [];
  let dust = 0n;
  const owedList = [...state.wallets].filter(([, w]) => w.owed > 0n)
    .sort((x, y) => (x[1].owed === y[1].owed ? (x[0] < y[0] ? -1 : 1) : x[1].owed > y[1].owed ? -1 : 1));
  const rentL = rent === null || rent === undefined ? null : toBig(rent, "the rent-exempt minimum");
  if (rentL === null || rentL < 0n) {
    for (const [a, w] of owedList) carry.push({ owner: a, owed: w.owed, reason: "the rent-exempt minimum could not be read: no payouts this run" });
    return done();
  }
  const fee1 = payoutFee(1, priceMicroLamports);
  let remaining = pot;
  const picked = [];
  for (const [a, w] of owedList) {
    const thr = w.lots.length ? minPay : exit;
    const keep = (reason) => carry.push({ owner: a, owed: w.owed, reason });
    if (a === payer) { keep("the payer is never a recipient"); continue; }
    if (w.owed < thr + fee1) { dust += w.owed; keep(`under the payout threshold (${thr + fee1} lamports with the fee)`); continue; }
    if (!isAddress(a)) { keep("not an address"); continue; }
    if (heldAt(w, nowMs)) { keep(`held until ${w.hold.until}${w.hold.slot !== null ? " (or until the wallet's history is counted past it)" : ""}: ${w.hold.reason}`); continue; }
    if (!RESERVED_ACCOUNT_KEYS.has(a) && !accounts.has(a)) { keep("its account was not read"); continue; }
    const r = recipientOf(a, accounts.get(a) ?? null);
    if (r.problem) { keep(r.problem); continue; }
    if (r.lamports + (w.owed - fee1) < rentL) { keep(`needs ${rentL} lamports on its account to exist (rent): carried until its reward covers it`); continue; }
    if (picked.length >= maxTx * perTx) { keep("REWARDS_MAX_TX_PER_RUN reached: next run"); continue; }
    const amount = min(w.owed, remaining);
    if (amount < thr + fee1 || r.lamports + (amount - fee1) < rentL) { keep("REWARDS_MAX_SOL_PER_RUN or the holders' unpaid pot reached: next run"); continue; }
    remaining -= amount;
    picked.push({ owner: a, amount, thr, lamports: r.lamports, owed: w.owed });
    if (amount < w.owed) carry.push({ owner: a, owed: w.owed - amount, reason: "paid in part (the run's budget): the rest next run" });
  }
  // ceil(n / perTx) transactions of near-equal size (the first n mod count one larger), in owed order.
  const batches = [], count = Math.ceil(picked.length / perTx);
  for (let i = 0, s = 0; i < count; i++) {
    const k = Math.floor(picked.length / count) + (i < picked.length % count ? 1 : 0);
    batches.push(payoutBatch(picked.slice(s, s + k), { priceMicroLamports, rent: rentL }));
    s += k;
  }
  return done(batches);

  function done(bs = []) {
    const payouts = bs.flatMap((b, i) => b.rows.map((r) => ({ ...r, batch: i })));
    let spend = 0n, carried = 0n;
    for (const b of bs) spend += b.debit;
    for (const c of carry) carried += c.owed;
    if (spend > pot) throw new RewardsError("the payouts would spend more than the pot (a bug: refused)");
    return { batches: bs, payouts, carry, carried, dust, spend };
  }
}

/* ── the payout transaction ──────────────────────────────────────────────────────────── */

/** SystemProgram.Transfer from → to, `lamports` (u32 2, u64). */
export function transferInstruction(from, to, lamports) {
  const v = toBig(lamports, "lamports");
  if (v <= 0n || v > U64_MAX) throw new RewardsError("a transfer is 1..2^64−1 lamports");
  const d = Buffer.alloc(12);
  d.writeUInt32LE(2, 0);
  d.writeBigUInt64LE(v, 4);
  return { programId: SYSTEM_PROGRAM, keys: [{ pubkey: from, isSigner: true, isWritable: true }, { pubkey: to, isSigner: false, isWritable: true }], data: new Uint8Array(d) };
}

/** [SetComputeUnitLimit(CU_LIMIT(k)), SetComputeUnitPrice(price), Transfer(payer → r_j, net_j) × k]. rows: [{ owner, lamports }]. */
export function payoutInstructions({ payer, rows, priceMicroLamports }) {
  if (!isAddress(payer)) throw new RewardsError("the payer is not an address");
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > PER_TX) throw new RewardsError(`a payout has 1..${PER_TX} transfers`);
  return [setComputeUnitLimit(cuLimit(rows.length)), setComputeUnitPrice(toBig(priceMicroLamports, "the priority price")), ...rows.map((r) => transferInstruction(payer, r.owner, r.lamports))];
}

/** The payout's legacy message (the payer signs and pays, alone): { payer, rows, priceMicroLamports, fee, messageBytes, size }. */
export function buildPayoutMessage({ payer, recentBlockhash, rows, priceMicroLamports }) {
  const m = compileLegacyMessage({ payer, recentBlockhash, instructions: payoutInstructions({ payer, rows, priceMicroLamports }) });
  const size = 1 + 64 + m.bytes.length;
  if (size > PACKET_DATA_SIZE) throw new RewardsError(`the payout would be ${size} bytes; Solana takes at most ${PACKET_DATA_SIZE}`);
  checkPayoutMessage(m.bytes, { payer, rows, priceMicroLamports });
  return { payer, rows: rows.map((r) => ({ owner: r.owner, lamports: toBig(r.lamports, "lamports") })), priceMicroLamports, fee: payoutFee(rows.length, priceMicroLamports), messageBytes: m.bytes, size };
}

/**
 * Gate 1, from the bytes alone: exactly [SetComputeUnitLimit(CU_LIMIT(k)), SetComputeUnitPrice(price),
 * Transfer(payer → r_j, net_j) × k] with these recipients and amounts in this order, recipients distinct
 * and not the payer, one signer (the payer), no writable account but the payer and the recipients, no
 * account no instruction uses, at most PACKET_DATA_SIZE bytes signed. Returns { fee, total, size };
 * throws RewardsError otherwise.
 */
export function checkPayoutMessage(messageBytes, { payer, rows, priceMicroLamports }) {
  if (!isAddress(payer)) throw new RewardsError("the payer is not an address");
  const k = rows?.length;
  if (!whole(k, 1, PER_TX)) throw new RewardsError(`a payout has 1..${PER_TX} transfers`);
  const msg = decodeLegacyMessage(messageBytes);
  const size = 1 + 64 + messageBytes.length;
  if (size > PACKET_DATA_SIZE) throw new RewardsError(`the payout is ${size} bytes; Solana takes at most ${PACKET_DATA_SIZE}`);
  if (msg.header.numRequiredSignatures !== 1 || msg.header.numReadonlySignedAccounts !== 0 || msg.accountKeys[0] !== payer) throw new RewardsError("the one signer and fee payer is not the payer");
  const ixs = decompileInstructions(msg);
  if (ixs.length !== k + 2) throw new RewardsError(`the payout has ${ixs.length} instructions, not ${k + 2}`);
  const same = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
  const want = payoutInstructions({ payer, rows, priceMicroLamports });
  const recipients = new Set();
  ixs.forEach((ix, n) => {
    const w = want[n];
    if (ix.programId !== w.programId || !same(ix.data, w.data)) throw new RewardsError(`instruction ${n + 1} is not the payout's`);
    if (ix.keys.length !== w.keys.length) throw new RewardsError(`instruction ${n + 1} has other accounts than the payout's`);
    ix.keys.forEach((key, i) => {
      if (key.pubkey !== w.keys[i].pubkey || key.isSigner !== w.keys[i].isSigner || key.isWritable !== w.keys[i].isWritable) throw new RewardsError(`instruction ${n + 1}'s account ${i} is not the payout's`);
    });
    if (n >= 2) {
      const to = ix.keys[1].pubkey;
      if (to === payer || recipients.has(to)) throw new RewardsError("a recipient is the payer or is paid twice");
      recipients.add(to);
    }
  });
  const writable = new Set([payer, ...recipients]);
  msg.accountKeys.forEach((key, i) => {
    if (isWritableIndex(msg.header, msg.accountKeys.length, i) !== writable.has(key)) throw new RewardsError(`the account ${key} is ${writable.has(key) ? "read-only" : "writable"} in the message`);
  });
  const used = new Set([payer, ...recipients, SYSTEM_PROGRAM, COMPUTE_BUDGET_PROGRAM]);
  const stray = msg.accountKeys.find((key) => !used.has(key));
  if (stray) throw new RewardsError(`the account ${stray} is in the message but not the payout's`);
  const fee = payoutFee(k, priceMicroLamports);
  let total = fee;
  for (const r of rows) total += toBig(r.lamports, "lamports");
  return { fee, total, size };
}

/**
 * Gate 5, on the unsigned copy's simulation (its err null is checked by the caller; gate 1 has already
 * proved from the bytes that the message only moves net_j from the payer to each recipient and pays
 * the fee): the payer lost at most Σnet + fee (before − after; anyone may send the payer SOL between
 * the two reads, nobody can take any), and every recipient ends at or over `rent`. before/after: Map
 * address → lamports (BigInt) read before the simulation (at its slot or earlier) and after it. A
 * recipient's own balance may move between the reads (it trades, it pays fees): it is not compared.
 * Returns the problem or null.
 */
export function simulationProblem({ payer, rows, fee, before, after, rent = 0n }) {
  if (!(before instanceof Map) || !(after instanceof Map)) return "the simulation's balances were not read";
  let total = toBig(fee, "the fee");
  const rentL = toBig(rent, "the rent-exempt minimum");
  for (const r of rows) {
    total += toBig(r.lamports, "lamports");
    if (!after.has(r.owner)) return `the simulation gave no balance for ${r.owner}`;
    const a = toBig(after.get(r.owner), "lamports");
    if (a < rentL) return `the simulation leaves ${r.owner} with ${a} lamports, under the rent-exempt minimum ${rentL}`;
  }
  if (!before.has(payer) || !after.has(payer)) return "the simulation gave no balance for the payer";
  const lost = toBig(before.get(payer), "lamports") - toBig(after.get(payer), "lamports");
  return lost <= total ? null : `the simulation took ${lost} lamports from the payer, more than the batch's ${total}`;
}

/* ── the website ─────────────────────────────────────────────────────────────────────── */

/** Lamports as SOL text for the log ("0.0045 SOL"). */
export const solText = (lamports) => {
  const v = toBig(lamports, "lamports"), neg = v < 0n, a = neg ? -v : v;
  const frac = String(a % LAMPORTS_PER_SOL).padStart(9, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${a / LAMPORTS_PER_SOL}${frac ? `.${frac}` : ""} SOL`;
};

/**
 * The site's explanation, three lines, built from the rules in force (siteRules: state.json "rules",
 * which each sample writes from the repository variables), so the site never quotes other numbers than
 * the ones the workflow uses. assets/ui/rewards.js rewardsText is a copy, kept equal by the tests. The
 * minimum is shown in tokens of a 1 billion supply (every pump.fun coin's).
 */
export function rewardsSiteText(rules = {}) {
  const r = siteRules(rules);
  const share = r.releasePct === 50 ? "half" : r.releasePct === 100 ? "all" : `${r.releasePct}%`;
  const cap = r.walletCapPct < 100 ? `, at most ${r.walletCapPct}% of it to any one wallet (the rest stays in the pot for later),` : "";
  return Object.freeze([
    Object.freeze({ title: "Hold $CATSANC, earn SOL.", text: `Once an hour, at a random moment, we check every wallet. You earn points for tokens you held at both this check and the one before: balance × hours × age bonus. You need at least ${(r.minBalancePpm * 1_000).toLocaleString("en-US")} $CATSANC (${r.minBalancePpm / 10_000}% of the 1 billion supply). Pools, bonding curves and team wallets don't count.` }),
    Object.freeze({ title: "Older tokens earn more.", text: "Each token's bonus grows from 1× toward 2×: 1.33× after 1 week, 1.5× after 2 weeks, 1.68× after a month. A brand-new holder always earns at least half the top rate. When you sell, your newest tokens go first, so your oldest keep their age. Tokens you buy or receive start at 1×, and age counts from the first rewards check, so tokens held before the rewards started also begin at 1×." }),
    Object.freeze({ title: r.everyDays === 1 ? "Every day," : `Every ${r.everyDays} days,`, text: `${share} of the unpaid holder pot (the creator fees our launcher bot has claimed) is split by points${cap} and sent to you automatically. Amounts under ${solText(r.minPayoutLamports).slice(0, -4)} SOL are saved for your next payout and never lost. Every payout's points and amounts are published.` }),
  ]);
}
/** The site's three lines with the defaults (what the page shows until state.json has its rules). */
export const REWARDS_SITE_TEXT = rewardsSiteText();
/** What never goes in the pot (listed on the site as excluded). */
export const REWARDS_SITE_EXCLUDED = "Only SOL goes in the pot: pump.fun and PumpSwap creator fees our launcher claims. StonkFun (Raydium LaunchLab) coins pay their creator no fee on chain, and coins priced in another coin pay in that coin; neither is claimed, because turning it into SOL would need a swap, and the launcher never trades.";

