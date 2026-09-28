/**
 * THE SANCTUARY'S AUTOMATIC LAUNCHER: its whole logic, with no file system, network or clock of its
 * own (scripts/launch.mjs brings them: `io` reads and writes files by their repo path, `rpc` is
 * scripts/lib/rpc.mjs createRpc(), `fetchImpl` fetches the site, `now` and `sleep` keep time). Every
 * phase is idempotent and safe to run again after a crash at any point.
 *
 * WHAT IT LAUNCHES. Cats the trend watch found (data/trending-cats.json), newest post first, at most
 * one a run, only "watch-list cats": a reading named after a data/cat-watch.json figure
 * (reading.nameFrom "figure"), or a cartoon or fiction cat that a big account posted
 * (post.bigAccount) or an X trend named (nameFrom "trend"). Anything else (a real pet, a name the rules
 * guessed) waits for the owner: its post id in data/launch-approvals.json { approve: [ids] } lets it
 * through the watch-list rule, and every other rule still applies. Never a sensitive cat, one the trend
 * watch marked known, one already in the sanctuary (data/planned.json, data/adoptables.json: names and
 * tickers, letter case aside), one in the ledger, a post older than MAX_POST_AGE_HOURS or without a
 * pbs.twimg.com picture, and never one whose coin text, metadata or X post would break the site's
 * content rules (the post is drafted before the launch: scripts/post-updates.mjs draftLaunch).
 *
 * HOW. The venue (scripts/lib/venues.mjs; pump.fun priced in SOL today) builds and signs the launch;
 * the launcher never buys or sells anything. The coin's mint is derived from the wallet's seed and the
 * post id (scripts/lib/solana-tx.mjs deriveMintKeypair), so one post can only ever make one coin: a
 * retry sends the same mint again, and the chain refuses a second create. The mint address is never
 * written or printed before its transaction is sent (a known, unused address can be pre-funded by
 * anyone to block the create): the coin's metadata file is named by the post id
 * (coins/<postId>.json, served by the site), and the ledger row gets mintPublic only once it is sent.
 *
 * THE LEDGER, data/sanctuary-launches.json { note, launches: [row] }, newest first, at most
 * LEDGER_MAX rows (old finished rows are dropped first; none in flight ever is). A row:
 *   { postId, url, name, coinName, ticker, venue, policy, lore, image, metadataPath, status,
 *     preparedAt, attempts, cat, and, as it goes: tx, sentAt, lastValidBlockHeight, mintPublic,
 *     spentLamports, settledAt, launchedAt, recordedAt, retry, reason }
 *   status "prepared" (its metadata written; no tx, no mint) → "sending" (tx = the signed
 *   transaction's signature and its blockhash's lastValidBlockHeight, written BEFORE it is sent) →
 *   "launched" (settled: finalized and proved by the venue; mintPublic, spentLamports from the
 *   transaction's own balances, launchedAt = its block time) or "failed" (reason; retry: may be
 *   prepared again with the SAME mint, at most MAX_ATTEMPTS sends). `cat` is the adoptable row the
 *   cat gets once launched (data/adoptables.json, checked by assets/ui/adoptables.js before anything
 *   is prepared).
 *
 * THE PHASES (the workflow commits between them):
 *   prepare  settles "sending" rows by their signature (finalized: launched or failed; unknown after
 *            the blockhash expired: failed, retry), prepares a retryable failed row again, or, with
 *            nothing in flight and the day's count not reached, prepares ONE new cat: its metadata
 *            file and its ledger row. data/launch-approvals.json is only read.
 *   send     (the only phase with the key) settles "sending" rows, then for the prepared row: checks
 *            the chain for its mint (a launch that happened but was never recorded is recovered, an
 *            address someone else touched fails for good), waits (bounded) until the site serves the
 *            committed metadata at its uri, builds, signs and SIMULATES the launch, and refuses unless
 *            the simulation succeeds, the wallet's loss is within LAUNCH_MAX_SOL_PER_LAUNCH, the last
 *            24 hours' spend plus this one is within LAUNCH_MAX_SOL_PER_DAY and the balance stays at or
 *            above LAUNCH_MIN_BALANCE_SOL. In dry mode it stops there. Otherwise it writes the row
 *            "sending", sends, and confirms with bounded polling.
 *   record   for each launched row not recorded yet: its tx in data/launches.json (the Collection proves
 *            it first), the cat in data/adoptables.json with its `launch`, held in data/announced.json
 *            (the X post is scripts/post-updates.mjs's, once the Collection has proved the mint), a 3D
 *            model queued in scripts/meshy.queue.json, its hotlinked real photo in data/real-photos.json,
 *            and its figure (and any other figure now in the sanctuary) off data/cat-watch.json, as the
 *            trend watch's own checks expect of a cat that moved in.
 *
 * MODE (LAUNCH_ENABLED): "on" launches; "dry" builds and simulates but writes nothing new and sends
 * nothing (it still settles rows already sent); anything else does nothing at all.
 */
import { validateWallets, activeLauncher, isAddress, isSignature, textProblem, httpsProblem, coatProblem, parseTime, base58Encode, TICKER } from "../../assets/collection.js";
import { adoptableProblem, validateAdoptables, tributeLine, ADOPTABLE_CATEGORIES, realPhotoOf } from "../../assets/ui/adoptables.js";
import { keypairFromSecret, deriveMintKeypair, decodeCompactU16, decodeLegacyMessage, decompileInstructions, priorityFeeLamports, MAX_COMPUTE_UNIT_LIMIT, DEFAULT_INSTRUCTION_COMPUTE_UNIT_LIMIT } from "./solana-tx.mjs";
import { TOKEN_2022_PROGRAM, COMPUTE_BUDGET_PROGRAM } from "./programs.mjs";
import { LAUNCH_DEFAULTS } from "./pump.mjs";
import { venueById, chooseVenue } from "./venues.mjs";
import { coatFromLook } from "./coat.mjs";
import { tickerFor } from "./read-cat-post.mjs";
import { RpcError } from "./rpc.mjs";
import { PAUSED_REASON } from "../announce.mjs";
import { draftLaunch, checkUpdate } from "../post-updates.mjs";

/* ── constants ─────────────────────────────────────────────────────────────────────────── */

export const SITE_ORIGIN = "https://catcoinsanctuary.com";
export const X_ACCOUNT = "https://x.com/catcosanctuary";
export const FILES = Object.freeze({
  ledger: "data/sanctuary-launches.json",
  approvals: "data/launch-approvals.json",
  trending: "data/trending-cats.json",
  watch: "data/cat-watch.json",
  adoptables: "data/adoptables.json",
  planned: "data/planned.json",
  wallets: "data/wallets.json",
  launches: "data/launches.json",
  announced: "data/announced.json",
  realPhotos: "data/real-photos.json",
  collection: "data/collection.json",
  meshy: "scripts/meshy.queue.json",
});
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
/** A post older than this is never launched (nor sent, once prepared). */
export const MAX_POST_AGE_HOURS = 48;
/** Sends a row may make in all (a failed one is prepared again, with the same mint, until then). */
export const MAX_ATTEMPTS = 3;
export const LEDGER_MAX = 200;
/** How long the send phase waits for the site to serve the coin's metadata, and how often it looks. */
export const METADATA_WAIT_MS = 15 * 60_000;
export const METADATA_POLL_MS = 20_000;
/** How long the send phase waits for its transaction to be finalized, and how often it asks. */
export const CONFIRM_WAIT_MS = 120_000;
export const CONFIRM_POLL_MS = 3_000;
/** Solana's fee per signature, in lamports. */
export const SIGNATURE_FEE_LAMPORTS = 5_000;
/** An X status id: the only post ids the trend watch has, and the only file names coins/ gets. */
export const X_POST_ID = /^\d{5,25}$/;
const X_POST_URL = /^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})$/;
const PBS_IMAGE = /^https:\/\/pbs\.twimg\.com\/[^\s"'<>]+$/;
const ISO_SECONDS = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

/** The caps' defaults, and the range each is clamped to (SOL, except the count). */
export const DEFAULT_CAPS = Object.freeze({ maxPerDay: 3, maxSolPerLaunch: 0.03, maxSolPerDay: 0.1, minBalanceSol: 0.02 });
export const CAP_RANGES = Object.freeze({ maxPerDay: [0, 10], maxSolPerLaunch: [0, 0.1], maxSolPerDay: [0, 0.5], minBalanceSol: [0.01, 1000] });
export const CAP_VARS = Object.freeze({ maxPerDay: "LAUNCH_MAX_PER_DAY", maxSolPerLaunch: "LAUNCH_MAX_SOL_PER_LAUNCH", maxSolPerDay: "LAUNCH_MAX_SOL_PER_DAY", minBalanceSol: "LAUNCH_MIN_BALANCE_SOL" });
/** The priority fee's price (micro-lamports per compute unit): LAUNCH_PRIORITY_MICROLAMPORTS, clamped. */
export const PRIORITY_RANGE = Object.freeze([0, 1_000_000]);

export class LaunchError extends Error { constructor(message) { super(message); this.name = "LaunchError"; } }

/* ── configuration ─────────────────────────────────────────────────────────────────────── */

/** LAUNCH_ENABLED: "on" (launch), "dry" (build and simulate only), anything else "off" (do nothing). Letter case aside, as the workflow's gate compares it. */
export function launchMode(env = {}) {
  const v = String(env.LAUNCH_ENABLED ?? "").trim().toLowerCase();
  return v === "on" ? "on" : v === "dry" ? "dry" : "off";
}

/**
 * The caps, from the repository variables, each with its default when unset or not a number and
 * clamped into its range: { maxPerDay, maxLamportsPerLaunch, maxLamportsPerDay, minBalanceLamports,
 * priorityMicroLamports, notes } (notes: what was defaulted or clamped, for the log).
 */
export function launchCaps(env = {}) {
  const notes = [];
  const read = (name, def, [lo, hi], integer = false) => {
    const raw = env[name];
    if (raw === undefined || raw === null || String(raw).trim() === "") return def;
    let n = Number(String(raw).trim());
    if (!Number.isFinite(n)) { notes.push(`${name} is not a number; the default ${def} is used`); return def; }
    if (integer) n = Math.floor(n);
    if (n < lo || n > hi) { const c = Math.min(hi, Math.max(lo, n)); notes.push(`${name} ${n} is outside ${lo}..${hi}; ${c} is used`); return c; }
    return n;
  };
  const sol = (k) => Math.round(read(CAP_VARS[k], DEFAULT_CAPS[k], CAP_RANGES[k]) * LAMPORTS_PER_SOL);
  return {
    maxPerDay: read(CAP_VARS.maxPerDay, DEFAULT_CAPS.maxPerDay, CAP_RANGES.maxPerDay, true),
    maxLamportsPerLaunch: sol("maxSolPerLaunch"),
    maxLamportsPerDay: sol("maxSolPerDay"),
    minBalanceLamports: sol("minBalanceSol"),
    priorityMicroLamports: read("LAUNCH_PRIORITY_MICROLAMPORTS", LAUNCH_DEFAULTS.computeUnitPriceMicroLamports, PRIORITY_RANGE, true),
    notes,
  };
}

export const sol = (lamports) => `${(lamports / LAMPORTS_PER_SOL).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} SOL`;

/**
 * The launch wallet from LAUNCH_WALLET_KEY: the 64-byte secret key in base58 (as Phantom exports it)
 * or as a JSON byte array (as the Solana CLI writes it), or the 32-byte seed as a JSON byte array.
 * No error ever quotes the value.
 */
export function walletFromEnv(value) {
  if (typeof value !== "string" || !value.trim()) throw new LaunchError("LAUNCH_WALLET_KEY is not set: nothing can be signed");
  const text = value.trim();
  if (text.startsWith("[")) {
    let list;
    try { list = JSON.parse(text); } catch { list = null; } // the parser's message would quote the value
    if (!Array.isArray(list) || (list.length !== 32 && list.length !== 64) || !list.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)) {
      throw new LaunchError("LAUNCH_WALLET_KEY given as JSON must be an array of 64 byte values (the secret key) or 32 (the seed)");
    }
    const bytes = Uint8Array.from(list);
    list.fill(0);
    try { return keypairFromSecret(bytes); } catch (e) { throw new LaunchError(`LAUNCH_WALLET_KEY: ${e.message}`); } finally { bytes.fill(0); }
  }
  try { return keypairFromSecret(text); } catch (e) { throw new LaunchError(`LAUNCH_WALLET_KEY: ${e.message}`); }
}

/** Why the wallet may not launch now (it must be an active launcher in data/wallets.json now and in ten minutes), or null. */
export function walletProblem(address, walletsFile, nowMs) {
  const w = validateWallets(walletsFile ?? {});
  if (!activeLauncher(w.launchers, address, nowMs) || !activeLauncher(w.launchers, address, nowMs + 10 * 60_000)) {
    return `the launch wallet ${address} is not an active launcher in data/wallets.json, so the Collection could never prove its launches`;
  }
  return null;
}

/** What to tell the owner when the wallet is not listed. */
export const walletInstructions = (address, nowMs) => [
  `To let this wallet launch, add it to "launchers" in data/wallets.json (keep the rows already there) and commit to main:`,
  `  { "address": "${address}", "since": "${ISO_SECONDS(nowMs).slice(0, 10)}", "label": "Auto launcher" }`,
  `"since" must be at or before its first launch; retire it later with an "until" date, never by deleting the row.`,
  `If that is not the wallet you meant, the repository secret LAUNCH_WALLET_KEY holds another wallet's key.`,
];

/* ── the coin's metadata (hosted by the site at coins/<postId>.json) ───────────────────── */

export const metadataPath = (postId) => `coins/${postId}.json`;
export const metadataUri = (postId) => `${SITE_ORIGIN}/coins/${postId}.json`;
export const cardUrl = (ticker) => `${SITE_ORIGIN}/#cat=${encodeURIComponent(ticker)}`;
/** The coin's description: its lore line and where it comes from. */
export const descriptionOf = (lore) => `${/[.!?…]$/.test(lore) ? lore : `${lore}.`} From the Catcoin Sanctuary.`;

/** The metadata JSON a row's coin serves, in its venue's shape. */
export function coinMetadata(row) {
  const venue = venueById(row.venue);
  if (!venue) throw new LaunchError(`unknown venue ${row.venue}`);
  return venue.metadata({ name: row.coinName, symbol: row.ticker, description: descriptionOf(row.lore), image: row.image, website: cardUrl(row.ticker), twitter: X_ACCOUNT, createdOn: SITE_ORIGIN });
}
/** The metadata file's exact text. */
export const metadataText = (meta) => `${JSON.stringify(meta, null, 2)}\n`;

/** Whether `uri` (with a cache-busting query when `bust`) answers 200 with exactly `text`. Never throws. */
export async function metadataServed({ fetchImpl, uri, text, bust = null, timeoutMs = 15_000 }) {
  try {
    const res = await fetchImpl(bust === null ? uri : `${uri}?check=${bust}`, { cache: "no-store", headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    return res.status === 200 && (await res.text()) === text;
  } catch { return false; }
}

/**
 * Wait (at most `waitMs`) until the site serves the metadata. A cache-busting query is asked first,
 * so the uri itself is never asked (and never cached as missing by the CDN) before the file is
 * deployed; then the exact uri, the one the coin will carry, must answer 200 with the exact text.
 */
export async function waitForMetadata({ fetchImpl, uri, text, now, sleep, waitMs = METADATA_WAIT_MS, pollMs = METADATA_POLL_MS }) {
  const deadline = now() + waitMs;
  for (let tries = Math.floor(waitMs / pollMs); ; tries--) {
    if (await metadataServed({ fetchImpl, uri, text, bust: now() }) && await metadataServed({ fetchImpl, uri, text })) return true;
    if (tries <= 0 || now() + pollMs > deadline) return false;
    await sleep(pollMs);
  }
}

/* ── the ledger ────────────────────────────────────────────────────────────────────────── */

export const LEDGER_NOTE = "The sanctuary's automatic launcher's ledger (scripts/launch.mjs, scripts/lib/launcher.mjs): one row per trending post it prepared, newest first. prepared → sending (tx written before it is sent) → launched or failed. The mint (mintPublic) is written only once its transaction is sent. Written by the Launch workflow; do not edit by hand while a row is prepared or sending.";
export const STATUSES = Object.freeze(["prepared", "sending", "launched", "failed"]);
const ROW_FIELDS = ["postId", "url", "name", "coinName", "ticker", "venue", "policy", "figure", "lore", "image", "metadataPath", "status", "preparedAt", "attempts", "cat",
  "tx", "sentAt", "lastValidBlockHeight", "mintPublic", "spentLamports", "settledAt", "launchedAt", "recordedAt", "retry", "reason"];
export const POLICIES = Object.freeze(["figure", "trend", "big-account", "approved"]);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isTime = (t) => parseTime(t, { dayAllowed: false }) !== null;

/** Why one ledger row is malformed, or null. */
export function rowProblem(r) {
  if (!isObj(r)) return "not an object";
  const extra = Object.keys(r).filter((k) => !ROW_FIELDS.includes(k));
  if (extra.length) return `unknown field ${extra[0]}`;
  if (!X_POST_ID.test(r.postId ?? "")) return "postId must be an X status id";
  const m = X_POST_URL.exec(r.url ?? "");
  if (!m || m[2] !== r.postId) return "url must be the post's x.com status link";
  for (const k of ["name", "coinName"]) if (textProblem(r[k], { maxChars: 60 })) return `${k} must be plain text`;
  if (!TICKER.test(r.ticker ?? "")) return "ticker must be 2 to 10 capital letters or digits";
  if (!venueById(r.venue)) return `venue ${String(r.venue).slice(0, 20)} is not registered`;
  if (!POLICIES.includes(r.policy)) return "policy is unknown";
  if (r.figure !== undefined && (typeof r.figure !== "string" || textProblem(r.figure, { maxChars: 60 }))) return "figure must be a watch-list figure's name";
  if (typeof r.lore !== "string" || r.lore.length < 1 || r.lore.length > 200) return "lore must be one line";
  if (!PBS_IMAGE.test(r.image ?? "")) return "image must be a pbs.twimg.com picture";
  if (r.metadataPath !== metadataPath(r.postId)) return "metadataPath must be coins/<postId>.json";
  if (!STATUSES.includes(r.status)) return "status is unknown";
  if (!isTime(r.preparedAt)) return "preparedAt must be YYYY-MM-DDTHH:MM:SSZ";
  if (!Number.isInteger(r.attempts) || r.attempts < 0 || r.attempts > MAX_ATTEMPTS) return `attempts must be 0..${MAX_ATTEMPTS}`;
  if (!isObj(r.cat) || r.cat.ticker !== r.ticker || adoptableProblem(r.cat)) return "cat must be the adoptable row the cat gets";
  for (const k of ["sentAt", "settledAt", "launchedAt", "recordedAt"]) if (r[k] !== undefined && !isTime(r[k])) return `${k} must be YYYY-MM-DDTHH:MM:SSZ`;
  if (r.spentLamports !== undefined && (!Number.isSafeInteger(r.spentLamports) || r.spentLamports < 0)) return "spentLamports must be a whole number";
  if (r.retry !== undefined && typeof r.retry !== "boolean") return "retry must be true or false";
  if (r.reason !== undefined && (typeof r.reason !== "string" || r.reason.length > 300)) return "reason must be short text";
  if (r.tx !== undefined && !isSignature(r.tx)) return "tx must be a signature";
  if (r.mintPublic !== undefined && !isAddress(r.mintPublic)) return "mintPublic must be an address";
  if (r.lastValidBlockHeight !== undefined && !Number.isSafeInteger(r.lastValidBlockHeight)) return "lastValidBlockHeight must be a whole number";
  if (r.status === "prepared" && (r.tx !== undefined || r.mintPublic !== undefined || r.lastValidBlockHeight !== undefined)) return "a prepared row has no tx and no mint";
  if (r.status === "sending" && (r.tx === undefined || r.sentAt === undefined || r.lastValidBlockHeight === undefined)) return "a sending row has tx, sentAt and lastValidBlockHeight";
  if (r.status === "launched" && (r.tx === undefined || r.mintPublic === undefined || r.launchedAt === undefined || r.spentLamports === undefined)) return "a launched row has tx, mintPublic, launchedAt and spentLamports";
  if (r.status === "failed" && (typeof r.reason !== "string" || typeof r.retry !== "boolean")) return "a failed row has a reason and retry";
  if (r.recordedAt !== undefined && r.status !== "launched") return "only a launched row is recorded";
  return null;
}

/** data/sanctuary-launches.json, checked row by row: { note, launches }. A malformed file stops the launcher (throws). A missing one is empty. */
export function validateLedger(data) {
  if (data === null || data === undefined) return { note: LEDGER_NOTE, launches: [] };
  if (!isObj(data) || !Array.isArray(data.launches) || Object.keys(data).some((k) => k !== "note" && k !== "launches")) throw new LaunchError(`${FILES.ledger} must be { note, launches: [...] }`);
  const seen = new Set();
  data.launches.forEach((r, i) => {
    const p = rowProblem(r);
    if (p) throw new LaunchError(`${FILES.ledger}: row ${i + 1}${X_POST_ID.test(r?.postId ?? "") ? ` (${r.postId})` : ""}: ${p}`);
    if (seen.has(r.postId)) throw new LaunchError(`${FILES.ledger}: the post ${r.postId} is listed twice`);
    seen.add(r.postId);
  });
  const inFlight = data.launches.filter((r) => r.status === "prepared" || r.status === "sending");
  if (inFlight.length > 1) throw new LaunchError(`${FILES.ledger}: ${inFlight.length} rows are in flight; the launcher keeps at most one`);
  return { note: typeof data.note === "string" ? data.note : LEDGER_NOTE, launches: data.launches.map((r) => structuredClone(r)) };
}

/** A row that is done for good: launched and recorded, or failed with no retry left. */
const finished = (r) => (r.status === "launched" && !!r.recordedAt) || (r.status === "failed" && (!r.retry || r.attempts >= MAX_ATTEMPTS));

/** The ledger as written: newest first, at most LEDGER_MAX rows (the oldest finished rows go first). */
export function ledgerText(ledger) {
  const rows = [...ledger.launches].sort((a, b) => Date.parse(b.preparedAt) - Date.parse(a.preparedAt));
  while (rows.length > LEDGER_MAX) {
    const i = rows.findLastIndex(finished);
    if (i < 0) break;
    rows.splice(i, 1);
  }
  return `${JSON.stringify({ note: ledger.note ?? LEDGER_NOTE, launches: rows }, null, 2)}\n`;
}

/** The last 24 hours: { count (sending or launched), lamports (spent, and the per-launch cap for a row still sending) }. */
export function dayStats(ledger, nowMs, caps) {
  let count = 0, lamports = 0;
  for (const r of ledger.launches) {
    const t = Date.parse(r.sentAt ?? "");
    if (!(t > nowMs - DAY_MS)) continue;
    if (r.status === "sending" || r.status === "launched") count++;
    lamports += (r.spentLamports ?? 0) + (r.status === "sending" ? caps.maxLamportsPerLaunch : 0);
  }
  return { count, lamports };
}

/** Why a launch that would cost `lossLamports` from a balance of `balanceLamports` must not go out, or null. */
export function capProblem({ stats, caps, lossLamports, balanceLamports }) {
  if (stats.count >= caps.maxPerDay) return `${stats.count} launch(es) in the last 24 hours already (LAUNCH_MAX_PER_DAY ${caps.maxPerDay})`;
  if (!Number.isSafeInteger(lossLamports) || lossLamports < 0) return "the simulation gave no usable balance";
  if (lossLamports > caps.maxLamportsPerLaunch) return `it would cost the wallet ${sol(lossLamports)}, more than LAUNCH_MAX_SOL_PER_LAUNCH (${sol(caps.maxLamportsPerLaunch)})`;
  if (stats.lamports + lossLamports > caps.maxLamportsPerDay) return `the last 24 hours' ${sol(stats.lamports)} plus ${sol(lossLamports)} is more than LAUNCH_MAX_SOL_PER_DAY (${sol(caps.maxLamportsPerDay)})`;
  if (balanceLamports - lossLamports < caps.minBalanceLamports) return `the wallet's ${sol(balanceLamports)} would fall under LAUNCH_MIN_BALANCE_SOL (${sol(caps.minBalanceLamports)}) after ${sol(lossLamports)}`;
  return null;
}

/* ── choosing a cat ────────────────────────────────────────────────────────────────────── */

/** data/launch-approvals.json { note, approve: [postIds] } as a Set of post ids (malformed entries left out). */
export function approvalsOf(data) {
  return new Set((Array.isArray(data?.approve) ? data.approve : []).map((v) => String(v ?? "").trim()).filter((v) => X_POST_ID.test(v)));
}

/** The watch-list figures (data/cat-watch.json), by name. */
const figuresOf = (watch) => new Map((Array.isArray(watch?.figures) ? watch.figures : []).filter((f) => isObj(f) && typeof f.name === "string").map((f) => [f.name, f]));

/**
 * Why the owner's policy lets this post launch on its own, or null (it waits for data/launch-approvals.json):
 * "figure" (named after a watch-list figure still on the list), "trend" or "big-account" (a cartoon or
 * fiction cat an X trend named or a big account posted), "approved" (the owner listed its id).
 */
export function policyOf(post, { approvals = new Set(), watch = null } = {}) {
  const r = post?.reading;
  if (r?.nameFrom === "figure" && typeof post.figure === "string" && figuresOf(watch).has(post.figure)) return "figure";
  const drawn = r?.kind === "cartoon" || r?.kind === "fiction";
  if (drawn && r?.nameFrom === "trend") return "trend";
  if (drawn && typeof post?.bigAccount === "string" && post.bigAccount) return "big-account";
  if (approvals.has(String(post?.id))) return "approved";
  return null;
}

/** Everything a cat's name or ticker may not be (the sanctuary's cats, the ledger's live rows), lower case. */
export function takenNames({ adoptables, planned, ledger }) {
  const out = new Set();
  for (const c of [...(planned?.cats ?? []), ...(adoptables?.cats ?? [])]) for (const k of [c?.name, c?.coinName, c?.ticker, c?.launchTicker]) if (typeof k === "string") out.add(k.toLowerCase());
  for (const r of ledger?.launches ?? []) if (r.status !== "failed" || (r.retry && r.attempts < MAX_ATTEMPTS)) for (const k of [r.name, r.coinName, r.ticker]) out.add(k.toLowerCase());
  return out;
}

const oneLine = (s, max) => String(s ?? "").replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
const slug = (s) => String(s ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
const ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
const DEFAULT_LOOK = (name) => `${name}, drawn from the picture in the X post that made it famous: the same fur colours, markings and eyes as there.`;
/** What Meshy's reference views are drawn from when the watch list gives no look: the post's picture itself. */
export const DEFAULT_REFERENCE = "The cat in the reference picture, with exactly its fur colours, markings, eye colour and build.";
const dateText = (ms) => new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * The adoptable row a trending cat gets (without its `launch`, added once launched), or { problem }.
 * Its look and coat come from its watch-list figure when there is one (data/cat-watch.json figures may
 * carry look, coat, owner and category), else from safe defaults; the portrait is pending (the post's
 * picture is hotlinked through data/real-photos.json, never copied).
 */
export function adoptableFor(post, { figure = null, pair, taken = { ids: new Set() }, nowMs }) {
  const r = post.reading, handle = post.author.handle, name = oneLine(r.catName, 60), ticker = r.ticker;
  const drawn = r.kind === "cartoon" || r.kind === "fiction";
  const owner = oneLine(figure?.owner, 120) || (figure ? (["real", "meme"].includes(figure.kind) ? "its owners" : "its creators")
    : drawn ? "its creators" : oneLine(post.author?.name, 120) || `@${handle}`);
  const category = ADOPTABLE_CATEGORIES.includes(figure?.category) ? figure.category : figure?.kind === "meme" || !drawn ? "viral" : "tv-movie";
  const look = typeof figure?.look === "string" && figure.look.length >= 20 && figure.look.length <= 600 ? figure.look : DEFAULT_LOOK(name);
  const coat = figure?.coat && coatProblem(figure.coat) === null ? { ...figure.coat } : coatFromLook(look);
  const postedMs = Date.parse(post.postedAt);
  const lore = oneLine(r.lore, 200);
  const story = `${/[.!?…]$/.test(lore) ? lore : `${lore}.`} ${name} was trending on X on ${dateText(postedMs)}, and the sanctuary gave it a coin.`;
  let id = [slug(name), `${slug(name)}-${ticker.toLowerCase()}`, ticker.toLowerCase()].find((x) => ID_RE.test(x) && !taken.ids.has(x));
  for (let n = 2; !id && n < 10; n++) if (!taken.ids.has(`${ticker.toLowerCase()}-${n}`)) id = `${ticker.toLowerCase()}-${n}`;
  if (!id) return { problem: "no free id for the cat" };
  const cat = {
    id, ticker, name, coinName: oneLine(r.coinName, 60), owner, category, story, look, coat, pair: { symbol: pair.symbol, mint: pair.mint },
    proof: { kind: "x", url: post.url, author: handle, handle, date: ISO_SECONDS(postedMs).slice(0, 10), dateType: "posted", text: oneLine(post.text, 600),
      note: `Found by the sanctuary's trend watch on ${ISO_SECONDS(nowMs).slice(0, 10)}.`, image: null },
    sources: [], existingCoin: null, memorial: false, tribute: tributeLine(owner), sensitivity: "",
    portrait: null, portraitStatus: "pending", confidence: r.readBy === "claude" ? "high" : "medium", lore: null,
  };
  const p = adoptableProblem(cat);
  return p ? { problem: `the adoptable row would be refused: ${p}` } : { cat };
}

/**
 * The ledger row a post would get, or { problem }: every rule the launcher keeps (see the header).
 * `ctx` = { nowMs, approvals, watch, ledger, adoptables, planned }.
 */
export function candidateRow(post, ctx) {
  const no = (problem) => ({ problem });
  const r = post?.reading;
  if (!isObj(post) || !X_POST_ID.test(String(post.id ?? ""))) return no("not an X post");
  if (!isObj(r)) return no("not read");
  if (r.sensitive !== false) return no("sensitive");
  if (post.known === true) return no("already in the sanctuary (the trend watch says so)");
  if (r.aboutOneCat !== true || !["real", "cartoon", "fiction"].includes(r.kind)) return no("not about one cat");
  for (const k of ["catName", "coinName", "ticker", "lore"]) if (typeof r[k] !== "string" || !r[k].trim()) return no(`the reading has no ${k}`);
  const policy = policyOf(post, ctx);
  if (!policy) return no("not a watch-list cat: waits for the owner (data/launch-approvals.json)");
  const postedMs = Date.parse(post.postedAt ?? "");
  if (!Number.isFinite(postedMs) || postedMs > ctx.nowMs + 10 * 60_000) return no("the post's time is unknown");
  if (ctx.nowMs - postedMs > MAX_POST_AGE_HOURS * HOUR_MS) return no(`older than ${MAX_POST_AGE_HOURS} hours`);
  const handle = post.author?.handle;
  const m = X_POST_URL.exec(post.url ?? "");
  if (!m || m[2] !== String(post.id) || typeof handle !== "string" || m[1].toLowerCase() !== handle.toLowerCase() || handle === "i") return no("the post's author is unknown");
  const image = (Array.isArray(post.media) ? post.media : []).map((x) => x?.url).find((u) => typeof u === "string" && PBS_IMAGE.test(u) && !httpsProblem(u));
  if (!image) return no("no pbs.twimg.com picture");
  const name = oneLine(r.catName, 60), coinName = oneLine(r.coinName, 60), ticker = r.ticker, lore = oneLine(r.lore, 200);
  if (name !== r.catName || coinName !== r.coinName || lore !== r.lore) return no("the reading's text is not one plain line");
  if (!TICKER.test(ticker)) return no("the ticker is not 2 to 10 capital letters or digits");
  if (/[@#$<>]|https?:|www\./i.test(lore)) return no("the lore line has a mention, a hashtag, a $ or a link");
  if (oneLine(post.text, 600).length < 10) return no("the post has too few words to quote as its proof");
  if ((ctx.ledger?.launches ?? []).some((x) => x.postId === String(post.id))) return no("already in the ledger");
  const taken = takenNames(ctx);
  for (const k of [name, coinName, ticker]) if (taken.has(k.toLowerCase())) return no(`${k} is already a sanctuary cat, or launched`);
  const figure = typeof post.figure === "string" ? figuresOf(ctx.watch).get(post.figure) ?? null : null;
  const venue = chooseVenue(post, figure);
  const uri = metadataUri(String(post.id));
  const bad = venue.textProblem({ name: coinName, symbol: ticker, uri });
  if (bad) return no(`the coin cannot be launched as named: ${bad}`);
  // The adoptable row, checked with the whole file (a free id and ticker).
  const cats = ctx.adoptables?.cats ?? [];
  const built = adoptableFor(post, { figure, pair: venue.pair, taken: { ids: new Set(cats.map((c) => c.id)) }, nowMs: ctx.nowMs });
  if (built.problem) return no(built.problem);
  const v = validateAdoptables({ cats: [...cats, built.cat] }, { taken: new Set((ctx.planned?.cats ?? []).map((c) => c.ticker)) });
  if (v.refused.some((x) => x.index === cats.length)) return no(`the adoptable row would be refused: ${v.refused.find((x) => x.index === cats.length).detail}`);
  const row = {
    postId: String(post.id), url: post.url, name, coinName, ticker, venue: venue.id, policy, ...(figure ? { figure: figure.name } : {}), lore, image,
    metadataPath: metadataPath(String(post.id)), status: "prepared", preparedAt: ISO_SECONDS(ctx.nowMs), attempts: 0, cat: built.cat,
  };
  // The site's content rules: the metadata's description, and the X post, drafted now (a held post means no launch).
  const cited = [name, coinName, ticker, ...(figure ? [figure.name, ...(Array.isArray(figure.aliases) ? figure.aliases : [])] : [])];
  const meta = coinMetadata(row);
  const d = checkUpdate(meta.description, cited);
  if (!d.ok) return no(`the coin's description breaks the content rules (${d.violations.map((x) => `${x.rule}: ${x.term}`).join("; ")})`);
  const post2 = draftLaunch({ id: ticker, name }, { coinName, ticker, lore, launchpad: venue.launchpad, cited });
  if (!post2.ok) return no(`its X post would be held (${post2.violations.map((x) => `${x.rule}: ${x.term}`).join("; ")})`);
  if (rowProblem(row)) return no(`the ledger row would be malformed: ${rowProblem(row)}`);
  return { row, post };
}

/** The newest post that may launch: { row, post, skipped } or { row: null, skipped: [{ id, why }] }. Candidates and approved posts only. */
export function selectCandidate(ctx) {
  const ids = new Set([...(Array.isArray(ctx.trending?.candidates) ? ctx.trending.candidates.map(String) : []), ...ctx.approvals]);
  const posts = (Array.isArray(ctx.trending?.posts) ? ctx.trending.posts : []).filter((p) => ids.has(String(p?.id)))
    .sort((a, b) => (Date.parse(b.postedAt) || 0) - (Date.parse(a.postedAt) || 0));
  const skipped = [];
  for (const post of posts) {
    const c = candidateRow(post, ctx);
    if (c.row) return { row: c.row, post, skipped };
    skipped.push({ id: String(post.id), why: c.problem });
  }
  return { row: null, skipped };
}

/* ── the watch list, once a cat moves in ───────────────────────────────────────────────── */

/** A text as a figure term is compared: CamelCase split, "&" as "and", lower case, words by single spaces. */
const termText = (s) => String(s ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").replace(/&/g, " and ").toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, " ").trim();
const saysWords = (text, term) => { const t = termText(term); return !!t && ` ${text} `.includes(` ${t} `); };

/**
 * The watch-list figures (data/cat-watch.json) that a sanctuary with these names has taken in: its
 * name or an alias is a sanctuary cat's name or ticker, its ticker is one, or one of its terms is
 * found in a sanctuary cat's name (alone, with "Cat" after it, or as "#<Name>Cat"). A superset of what
 * the trend watch itself leaves out (scripts/scan-trending-cats.mjs watchList and figureIn, checked by
 * tests/trendwatch.test.mjs): letter case and cat words aside, so it never keeps one the scan would drop.
 * `names` are the sanctuary's names and tickers; returns the figures' names.
 */
export function figuresAtHome(watch, names) {
  const lower = new Set([...names].map((n) => String(n).toLowerCase()));
  const texts = [...names].filter((n) => /\p{L}/u.test(n)).flatMap((n) => [n, `${n} Cat`, `${String(n).replace(/[^\p{L}\p{N}]/gu, "")}Cat`]).map(termText);
  return (Array.isArray(watch?.figures) ? watch.figures : []).filter((f) => {
    if (typeof f?.name !== "string") return false;
    const aliases = Array.isArray(f.aliases) ? f.aliases.filter((a) => typeof a === "string") : [];
    if ([f.name, ...aliases].some((n) => lower.has(n.toLowerCase()))) return true;
    const ticker = (typeof f.ticker === "string" && f.ticker ? f.ticker.replace(/^\$+/, "").toUpperCase() : tickerFor(f.name)) ?? "";
    if (ticker && lower.has(ticker.toLowerCase())) return true;
    const terms = f.matchOnlyAliases === true ? aliases : [f.name, ...aliases];
    return terms.some((t) => texts.some((x) => saysWords(x, t)));
  }).map((f) => f.name);
}

/** data/cat-watch.json as it is written by hand: the handle lists a few to a line, one figure a line. */
export function watchText(watch) {
  const inline = (v) => (Array.isArray(v) ? `[${v.map(inline).join(", ")}]`
    : isObj(v) ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(", ")} }` : JSON.stringify(v));
  const lines = ["{"];
  const keys = Object.keys(watch);
  keys.forEach((k, i) => {
    const v = watch[k], end = i < keys.length - 1 ? "," : "";
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      const rows = [];
      for (let j = 0; j < v.length; j += 9) rows.push(`  ${v.slice(j, j + 9).map((x) => JSON.stringify(x)).join(", ")}`);
      lines.push(` ${JSON.stringify(k)}: [`, ...rows.map((r, j) => `${r}${j < rows.length - 1 ? "," : ""}`), ` ]${end}`);
    } else if (Array.isArray(v)) {
      lines.push(` ${JSON.stringify(k)}: [`, ...v.map((x, j) => `  ${inline(x)}${j < v.length - 1 ? "," : ""}`), ` ]${end}`);
    } else lines.push(` ${JSON.stringify(k)}: ${inline(v)}${end}`);
  });
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

/* ── the chain ─────────────────────────────────────────────────────────────────────────── */

/** The first signature of a signed transaction (base64), base58: the transaction's id. */
export function signatureOf(base64) {
  const bytes = Buffer.from(base64, "base64");
  const { value: n, size } = decodeCompactU16(bytes, 0);
  if (n < 1 || bytes.length < size + 64) throw new LaunchError("the signed transaction carries no signature");
  return base58Encode(bytes.subarray(size, size + 64));
}

/** The most a legacy transaction can pay in fees: every signature, and its priority fee at its own compute-unit limit (or the runtime's default). */
export function feeUpperBound(base64) {
  try { return legacyFeeUpperBound(base64); } catch { return FEE_BOUND_FALLBACK; }
}
/** The bound when a transaction cannot be read as legacy (a v0 venue): 0.0001 SOL. */
export const FEE_BOUND_FALLBACK = 100_000;
function legacyFeeUpperBound(base64) {
  const bytes = Buffer.from(base64, "base64");
  const { value: n, size } = decodeCompactU16(bytes, 0);
  const msg = decodeLegacyMessage(Uint8Array.from(bytes.subarray(size + 64 * n)));
  let limit = null, price = 0n;
  for (const ix of decompileInstructions(msg)) {
    if (ix.programId !== COMPUTE_BUDGET_PROGRAM) continue;
    const d = Buffer.from(ix.data);
    if (d[0] === 2 && d.length === 5) limit = d.readUInt32LE(1);
    if (d[0] === 3 && d.length === 9) price = d.readBigUInt64LE(1);
  }
  const units = limit ?? Math.min(MAX_COMPUTE_UNIT_LIMIT, DEFAULT_INSTRUCTION_COMPUTE_UNIT_LIMIT * msg.instructions.length);
  return n * SIGNATURE_FEE_LAMPORTS + Number(priorityFeeLamports(units, price));
}

const errText = (err) => { try { return JSON.stringify(err).slice(0, 160); } catch { return "an error"; } };
const spentOf = (tx) => {
  const pre = tx?.meta?.preBalances?.[0], post = tx?.meta?.postBalances?.[0];
  return Number.isSafeInteger(pre) && Number.isSafeInteger(post) && pre >= post ? pre - post : Number.isSafeInteger(tx?.meta?.fee) ? tx.meta.fee : 0;
};

/**
 * Settle a "sending" row by its signature: finalized and proved by its venue → "launched" (mint,
 * spend, block time); finalized with an error → "failed" (retry); unknown once the finalized block
 * height is past the blockhash's lastValidBlockHeight (it can never land) → "failed" (retry);
 * otherwise unchanged. Returns { row, changed, note }.
 */
export async function settleSending(row, { rpc, nowMs }) {
  const venue = venueById(row.venue);
  const statuses = await rpc.getSignatureStatuses([row.tx]);
  const st = Array.isArray(statuses) ? statuses[0] : null;
  if (st) {
    if (st.confirmationStatus !== "finalized") return { row, changed: false, note: `${row.ticker}: sent, ${st.confirmationStatus ?? "seen"}, not finalized yet` };
    const tx = await rpc.getTransaction(row.tx);
    if (!tx) return { row, changed: false, note: `${row.ticker}: finalized, but the RPC has not given the transaction yet` };
    if (tx.transaction?.signatures?.[0] !== row.tx) throw new LaunchError(`the RPC answered for another transaction than ${row.tx.slice(0, 12)}…`);
    const spent = (row.spentLamports ?? 0) + spentOf(tx);
    if (st.err || tx.meta?.err) {
      return { row: { ...row, status: "failed", spentLamports: spent, settledAt: ISO_SECONDS(nowMs), retry: true, reason: `the launch failed on chain: ${errText(st.err ?? tx.meta.err)}` }, changed: true,
        note: `${row.ticker}: the launch failed on chain; it may be tried again with the same mint` };
    }
    const payer = tx.transaction?.message?.accountKeys?.[0];
    const proof = venue.prove(tx, { wallet: payer });
    if (!proof.ok) {
      return { row: { ...row, status: "failed", spentLamports: spent, settledAt: ISO_SECONDS(nowMs), retry: false, reason: `the transaction is not a launch the venue proves (${proof.clause}): a person must look` }, changed: true,
        note: `${row.ticker}: the sent transaction does not prove as a launch (${proof.clause})` };
    }
    const done = { ...row, status: "launched", mintPublic: proof.launch.mint, spentLamports: spent, settledAt: ISO_SECONDS(nowMs), launchedAt: proof.launch.time };
    delete done.retry; delete done.reason;
    return { row: done, changed: true, note: `${row.ticker}: launched, ${sol(spentOf(tx))} spent` };
  }
  const height = await rpc.getBlockHeight({ commitment: "finalized" });
  if (Number.isSafeInteger(height) && height > row.lastValidBlockHeight) {
    return { row: { ...row, status: "failed", settledAt: ISO_SECONDS(nowMs), retry: true, reason: "expired: the transaction never landed" }, changed: true,
      note: `${row.ticker}: the transaction never landed and its blockhash expired; it may be tried again with the same mint` };
  }
  return { row, changed: false, note: `${row.ticker}: not seen yet; waiting until its blockhash expires` };
}

/**
 * Is this mint on chain already? { state: "none" } (no account: send), { state: "launched", tx, proof }
 * (the coin exists and its create is the wallet's launch: recover it), { state: "foreign" } (the
 * address holds an account the launch did not make: never send), { state: "unknown" } (the coin exists
 * but its create was not found: a person must look).
 */
export async function mintOnChain({ rpc, venue, wallet, mint }) {
  const [acc] = (await rpc.getMultipleAccounts([mint], { commitment: "confirmed" })) ?? [null];
  if (!acc) return { state: "none" };
  if (acc.owner !== TOKEN_2022_PROGRAM) return { state: "foreign", detail: "the mint's address already holds an account the launch did not make (someone funded it)" };
  // The coin exists: its create is the oldest successful transaction naming the mint.
  let before, oldest = [];
  for (let page = 0; page < 10; page++) {
    const list = await rpc.getSignaturesForAddress(mint, { before, limit: 1000, commitment: "confirmed" });
    if (!Array.isArray(list) || !list.length) break;
    oldest = list;
    if (list.length < 1000) break;
    before = list.at(-1).signature;
  }
  for (const s of [...oldest].reverse().filter((x) => !x.err).slice(0, 5)) {
    const tx = await rpc.getTransaction(s.signature, { commitment: "confirmed" });
    const proof = tx ? venue.prove(tx, { wallet }) : null;
    if (proof?.ok && proof.launch.mint === mint) return { state: "launched", tx, proof };
  }
  return { state: "unknown", detail: "the coin exists, but its launch transaction was not found" };
}

/* ── the phases ────────────────────────────────────────────────────────────────────────── */

const readJson = (io, rel, fallback) => {
  const text = io.readText(rel);
  if (text === null || text === undefined) return fallback;
  try { return JSON.parse(text); } catch { throw new LaunchError(`${rel} is not valid JSON`); }
};
const json2 = (v) => `${JSON.stringify(v, null, 2)}\n`;
const json1 = (v) => `${JSON.stringify(v, null, 1)}\n`;
const inFlight = (ledger) => ledger.launches.filter((r) => r.status === "prepared" || r.status === "sending");
const replaceRow = (ledger, row) => { ledger.launches = ledger.launches.map((r) => (r.postId === row.postId ? row : r)); };
const saveLedger = (io, ledger) => io.writeText(FILES.ledger, ledgerText(ledger));
const postAgeMs = (row, trending, nowMs) => {
  const p = (trending?.posts ?? []).find((x) => String(x?.id) === row.postId);
  const t = Date.parse(p?.postedAt ?? row.cat?.proof?.date ?? "");
  return Number.isFinite(t) ? nowMs - t : Infinity;
};
function selectionContext(io, ledger, nowMs) {
  return {
    nowMs, ledger,
    trending: readJson(io, FILES.trending, { posts: [], candidates: [] }),
    approvals: approvalsOf(readJson(io, FILES.approvals, { approve: [] })),
    watch: readJson(io, FILES.watch, { figures: [] }),
    adoptables: readJson(io, FILES.adoptables, { cats: [] }),
    planned: readJson(io, FILES.planned, { cats: [] }),
  };
}

/**
 * PREPARE (no key). Returns { mode, changed, pending, deploy, prepared, notes }: `pending` when the
 * send or record phase has work (a row in flight or launched but not recorded, or, in dry mode, a cat
 * to simulate); `deploy` when a prepared row's metadata is not served yet (the workflow then deploys
 * the site).
 */
export async function prepare({ io, env = {}, rpc, fetchImpl, now = Date.now, log = () => {}, scrub = (t) => t }) {
  const mode = launchMode(env);
  const out = { mode, changed: false, pending: false, deploy: false, prepared: null };
  if (mode === "off") { log("Launcher: off (LAUNCH_ENABLED is neither on nor dry); nothing done."); return out; }
  const nowMs = now();
  const caps = launchCaps(env);
  for (const n of caps.notes) log(`::warning title=Launcher::${n}`);
  const ledger = validateLedger(readJson(io, FILES.ledger, null));

  // 1. Rows sent earlier: settled by their signature.
  for (const row of ledger.launches.filter((r) => r.status === "sending")) {
    try {
      const s = await settleSending(row, { rpc, nowMs });
      log(`Launcher: ${s.note}.`);
      if (s.changed) { replaceRow(ledger, s.row); out.changed = true; }
    } catch (e) { log(`::warning title=Launcher::could not settle ${row.ticker} yet (${scrub(e.message)}); the send phase tries again.`); }
  }
  const ctx = selectionContext(io, ledger, nowMs);

  if (mode === "on" && !inFlight(ledger).length) {
    // 2. A failed row that may be tried again takes the next turn, with the same post (so the same mint).
    const again = ledger.launches.find((r) => r.status === "failed" && r.retry && r.attempts < MAX_ATTEMPTS);
    if (again) {
      const next = { ...again };
      for (const k of ["tx", "mintPublic", "lastValidBlockHeight", "settledAt", "retry"]) delete next[k];
      if (postAgeMs(again, ctx.trending, nowMs) > MAX_POST_AGE_HOURS * HOUR_MS) {
        replaceRow(ledger, { ...again, retry: false, reason: `${again.reason} (not tried again: the post is older than ${MAX_POST_AGE_HOURS} hours)`.slice(0, 300) });
      } else {
        next.status = "prepared";
        replaceRow(ledger, next);
        log(`Launcher: ${again.ticker} is prepared again (attempt ${again.attempts + 1} of ${MAX_ATTEMPTS}; last time: ${again.reason}).`);
      }
      out.changed = true;
    }
  }

  // 3. The prepared row's metadata file, written if it is missing (a crash between the two writes).
  for (const row of ledger.launches.filter((r) => r.status === "prepared")) {
    const text = metadataText(coinMetadata(row));
    if (io.readText(row.metadataPath) !== text) { io.writeText(row.metadataPath, text); out.changed = true; }
  }

  // 4. Nothing in flight: at most one new cat.
  if (!inFlight(ledger).length) {
    const stats = dayStats(ledger, nowMs, caps);
    if (stats.count >= caps.maxPerDay) log(`Launcher: ${stats.count} launch(es) in the last 24 hours; LAUNCH_MAX_PER_DAY is ${caps.maxPerDay}, so no new cat now.`);
    else {
      const pick = selectCandidate(ctx);
      for (const s of pick.skipped) log(`Launcher: post ${s.id} skipped: ${s.why}.`);
      if (!pick.row) log("Launcher: no trending cat to launch now.");
      else if (mode === "dry") {
        log(`Launcher (dry run): would prepare ${pick.row.coinName} (${pick.row.ticker}) from ${pick.row.url} (${pick.row.policy}); nothing written.`);
        out.pending = true;
      } else {
        io.writeText(pick.row.metadataPath, metadataText(coinMetadata(pick.row)));
        ledger.launches.unshift(pick.row);
        out.changed = true;
        out.prepared = pick.row.postId;
        log(`Launcher: prepared ${pick.row.coinName} (${pick.row.ticker}) from ${pick.row.url} (${pick.row.policy}); its metadata is ${metadataUri(pick.row.postId)}.`);
      }
    }
  }

  if (out.changed) saveLedger(io, ledger);
  const prepared = ledger.launches.find((r) => r.status === "prepared");
  if (prepared && mode === "on") {
    out.deploy = !(await metadataServed({ fetchImpl, uri: metadataUri(prepared.postId), text: metadataText(coinMetadata(prepared)), bust: nowMs }));
    if (out.deploy) log(`Launcher: ${metadataUri(prepared.postId)} is not served yet; the site is to be deployed.`);
  }
  out.pending ||= inFlight(ledger).length > 0 || ledger.launches.some((r) => r.status === "launched" && !r.recordedAt);
  return out;
}

/**
 * SEND (the key). Returns { mode, outcome, launched, code }: code 1 when a person must look (the
 * wallet is not listed, the metadata file was edited, the RPC failed), else 0.
 */
export async function send({ io, env = {}, rpc, fetchImpl, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {},
  metadataWaitMs = METADATA_WAIT_MS, metadataPollMs = METADATA_POLL_MS, confirmWaitMs = CONFIRM_WAIT_MS, confirmPollMs = CONFIRM_POLL_MS, scrub = (t) => t }) {
  const mode = launchMode(env);
  const out = { mode, outcome: "nothing", launched: false, code: 0 };
  if (mode === "off") { log("Launcher: off (LAUNCH_ENABLED is neither on nor dry); nothing done."); out.outcome = "off"; return out; }
  const wallet = walletFromEnv(env.LAUNCH_WALLET_KEY);
  const nowMs = now();
  const unlisted = walletProblem(wallet.publicKey, readJson(io, FILES.wallets, { launchers: [] }), nowMs);
  if (unlisted) {
    log(`::error title=Launcher::${unlisted}. Nothing was sent.`);
    for (const line of walletInstructions(wallet.publicKey, nowMs)) log(line);
    return { ...out, outcome: "wallet_not_listed", code: 1 };
  }
  const caps = launchCaps(env);
  for (const n of caps.notes) log(`::warning title=Launcher::${n}`);
  const ledger = validateLedger(readJson(io, FILES.ledger, null));

  // 1. Rows sent earlier.
  let settledAny = false;
  for (const row of ledger.launches.filter((r) => r.status === "sending")) {
    const s = await settleSending(row, { rpc, nowMs });
    log(`Launcher: ${s.note}.`);
    if (s.changed) { replaceRow(ledger, s.row); settledAny = true; if (s.row.status === "launched") out.launched = true; }
  }
  if (settledAny) saveLedger(io, ledger);
  if (ledger.launches.some((r) => r.status === "sending")) { out.outcome = "sending"; return out; }

  // 2. The prepared row (in dry mode with none, the cat prepare would pick, in memory only).
  const ctx = selectionContext(io, ledger, nowMs);
  let row = ledger.launches.find((r) => r.status === "prepared") ?? null;
  const virtual = !row && mode === "dry";
  if (virtual) {
    if (dayStats(ledger, nowMs, caps).count < caps.maxPerDay) row = selectCandidate(ctx).row;
  }
  if (!row) { log("Launcher: nothing prepared to send."); return out; }
  const venue = venueById(row.venue);
  const dry = mode === "dry" ? "(dry run) " : "";
  // A prepared row that cannot go out (dry mode writes nothing).
  const fail = (reason, retry, extra = {}) => {
    const next = { ...row, ...extra, status: "failed", reason: String(reason).slice(0, 300), retry, settledAt: ISO_SECONDS(now()) };
    if (mode === "on" && !virtual) { replaceRow(ledger, next); saveLedger(io, ledger); }
    row = next;
  };

  // 3. Is the coin on chain already (a launch never recorded, or an address someone else took)?
  const mint = deriveMintKeypair(wallet, row.postId);
  const found = await mintOnChain({ rpc, venue, wallet: wallet.publicKey, mint: mint.publicKey });
  if (found.state === "launched") {
    log(`Launcher: ${dry}${row.ticker} is on chain already (${found.proof.launch.tx.slice(0, 12)}…): recorded as launched.`);
    if (mode === "on") {
      const done = { ...row, status: "launched", tx: found.proof.launch.tx, mintPublic: found.proof.launch.mint, spentLamports: (row.spentLamports ?? 0) + spentOf(found.tx),
        settledAt: ISO_SECONDS(now()), launchedAt: found.proof.launch.time, sentAt: row.sentAt ?? found.proof.launch.time, attempts: Math.max(1, row.attempts) };
      delete done.retry; delete done.reason;
      replaceRow(ledger, done); saveLedger(io, ledger);
      out.launched = true;
    }
    return { ...out, outcome: "recovered" };
  }
  if (found.state === "foreign") { log(`::warning title=Launcher::${row.ticker}: ${found.detail}; it is never sent.`); fail(found.detail, false); return { ...out, outcome: "foreign" }; }
  if (found.state === "unknown") { log(`::error title=Launcher::${row.ticker}: ${found.detail}. Nothing was sent; a person must look.`); return { ...out, outcome: "unknown", code: 1 }; }

  // 4. Too old now?
  if (postAgeMs(row, ctx.trending, nowMs) > MAX_POST_AGE_HOURS * HOUR_MS) {
    log(`Launcher: ${row.ticker}'s post is older than ${MAX_POST_AGE_HOURS} hours now; it is not launched.`);
    fail(`the post is older than ${MAX_POST_AGE_HOURS} hours`, false);
    return { ...out, outcome: "stale" };
  }

  // 5. The metadata: the committed file, served by the site at the coin's uri.
  const uri = metadataUri(row.postId);
  const text = metadataText(coinMetadata(row));
  if (virtual) log(`Launcher: ${dry}its metadata would be ${uri}.`);
  else {
    if (io.readText(row.metadataPath) !== text) {
      log(`::error title=Launcher::${row.metadataPath} is not the metadata ${row.ticker}'s row gives (edited, or missing); nothing was sent. Run the prepare phase again.`);
      return { ...out, outcome: "metadata_mismatch", code: 1 };
    }
    if (!(await waitForMetadata({ fetchImpl, uri, text, now, sleep, waitMs: metadataWaitMs, pollMs: metadataPollMs }))) {
      log(`Launcher: ${dry}${uri} is not served yet (waited ${Math.round(metadataWaitMs / 60_000)} min); the next run tries again.`);
      return { ...out, outcome: "metadata_not_served" };
    }
  }

  // 6. The day's count, then build, sign and simulate.
  const stats = dayStats(ledger, nowMs, caps);
  if (stats.count >= caps.maxPerDay) { log(`Launcher: ${stats.count} launch(es) in the last 24 hours (LAUNCH_MAX_PER_DAY ${caps.maxPerDay}); ${row.ticker} waits.`); return { ...out, outcome: "cap" }; }
  const balance = await rpc.getBalance(wallet.publicKey);
  if (!Number.isSafeInteger(balance)) throw new LaunchError("the RPC gave no balance for the wallet");
  if (balance <= caps.minBalanceLamports) {
    log(`::warning title=Launcher::the wallet holds ${sol(balance)}, at or under LAUNCH_MIN_BALANCE_SOL (${sol(caps.minBalanceLamports)}); ${row.ticker} waits until it is funded.`);
    return { ...out, outcome: "cap" };
  }
  const bh = await rpc.getLatestBlockhash();
  if (!bh?.blockhash || !Number.isSafeInteger(bh.lastValidBlockHeight)) throw new LaunchError("the RPC gave no blockhash");
  const built = await venue.build({ wallet: wallet.publicKey, mint: mint.publicKey, name: row.coinName, symbol: row.ticker, uri, recentBlockhash: bh.blockhash,
    computeUnitPriceMicroLamports: caps.priorityMicroLamports }, { fetchImpl, rpc });
  const signed = venue.sign(built, wallet, mint);
  const signature = signatureOf(signed);
  const sim = await rpc.simulateTransaction(signed, { addresses: [wallet.publicKey] });
  const after = sim?.accounts?.[0]?.lamports;
  if (!sim || sim.err !== null || !Number.isSafeInteger(after)) {
    const why = !sim ? "no answer" : sim.err !== null ? errText(sim.err) : "no balance after it";
    log(`::warning title=Launcher::${dry}${row.ticker}: the simulation did not pass (${why}); nothing was sent.`);
    fail(`the simulation did not pass: ${why}`, true, { attempts: Math.min(MAX_ATTEMPTS, row.attempts + 1) });
    return { ...out, outcome: "simulation_failed" };
  }
  const loss = balance - after + feeUpperBound(signed);
  const capped = capProblem({ stats, caps, lossLamports: loss, balanceLamports: balance });
  const figures = `about ${sol(loss)} (cap ${sol(caps.maxLamportsPerLaunch)}), the last 24 hours ${sol(stats.lamports)} of ${sol(caps.maxLamportsPerDay)}, balance ${sol(balance)} (floor ${sol(caps.minBalanceLamports)})`;
  if (capped) { log(`Launcher: ${dry}${row.ticker} is not sent: ${capped}.`); return { ...out, outcome: "cap" }; }
  if (mode === "dry") {
    log(`Launcher (dry run): ${row.coinName} (${row.ticker}) from ${row.url} simulates cleanly on ${venue.label}: ${figures}. Nothing was sent.`);
    return { ...out, outcome: "dry" };
  }

  // 7. Written "sending" BEFORE it goes out (the workflow commits it even if what follows fails).
  row = { ...row, status: "sending", tx: signature, sentAt: ISO_SECONDS(now()), lastValidBlockHeight: bh.lastValidBlockHeight, attempts: row.attempts + 1 };
  for (const k of ["retry", "reason", "settledAt", "mintPublic"]) delete row[k];
  replaceRow(ledger, row); saveLedger(io, ledger);
  try {
    const sig = await rpc.sendTransaction(signed);
    if (sig !== signature) log(`::warning title=Launcher::the RPC named the transaction ${String(sig).slice(0, 12)}…, not ${signature.slice(0, 12)}…`);
  } catch (e) {
    const why = scrub(String(e?.message ?? e));                    // what reaches the log and the ledger (committed) never carries a secret
    if (e instanceof RpcError && e.code !== null) {
      // The node answered with an error: its preflight refused the transaction, so nothing went out.
      log(`::warning title=Launcher::${row.ticker}: the RPC refused the launch (${why}); nothing went out.`);
      row = { ...row, status: "failed", retry: true, reason: `the RPC refused it: ${why}`.slice(0, 300), settledAt: ISO_SECONDS(now()) };
      delete row.tx; delete row.lastValidBlockHeight;
      replaceRow(ledger, row); saveLedger(io, ledger);
      return { ...out, outcome: "refused" };
    }
    log(`::warning title=Launcher::${row.ticker}: no clear answer from the RPC (${why}); the row stays "sending" and is settled by its signature later.`);
    return { ...out, outcome: "sending", code: 1 };
  }
  row = { ...row, mintPublic: mint.publicKey };                    // sent: the address is public from here on
  replaceRow(ledger, row); saveLedger(io, ledger);
  log(`Launcher: sent ${row.coinName} (${row.ticker}) on ${venue.label}: https://solscan.io/tx/${signature} (${figures}).`);

  // 8. Confirm (bounded); an unsettled row is settled by a later run.
  const deadline = now() + confirmWaitMs;
  for (let tries = Math.max(1, Math.floor(confirmWaitMs / confirmPollMs)); ; tries--) {
    await sleep(confirmPollMs);
    const s = await settleSending(row, { rpc, nowMs: now() });
    if (s.changed) {
      replaceRow(ledger, s.row); saveLedger(io, ledger);
      log(`Launcher: ${s.note}.`);
      if (s.row.status === "launched") { out.launched = true; log(`Launcher: ${s.row.coinName} (${s.row.ticker}) is launched: its mint is ${s.row.mintPublic}.`); }
      return { ...out, outcome: s.row.status };
    }
    if (tries <= 1 || now() + confirmPollMs > deadline) { log(`Launcher: ${s.note}; a later run settles it.`); return { ...out, outcome: "sending" }; }
  }
}

/**
 * RECORD (no key, no network). For each launched row not recorded yet, the cat moves into the
 * sanctuary (see the header). Returns { mode, recorded: [tickers], problems: [text] }.
 */
export function record({ io, env = {}, now = Date.now, log = () => {} }) {
  const mode = launchMode(env);
  const out = { mode, recorded: [], problems: [] };
  if (mode === "off") { log("Launcher: off (LAUNCH_ENABLED is neither on nor dry); nothing done."); return out; }
  const ledger = validateLedger(readJson(io, FILES.ledger, null));
  const todo = ledger.launches.filter((r) => r.status === "launched" && !r.recordedAt);
  if (!todo.length) { log("Launcher: no launched cat to record."); return out; }
  const nowMs = now();
  const files = {
    adoptables: readJson(io, FILES.adoptables, { cats: [] }),
    planned: readJson(io, FILES.planned, { cats: [] }),
    announced: readJson(io, FILES.announced, { cats: {} }),
    launches: readJson(io, FILES.launches, { launches: [] }),
    collection: readJson(io, FILES.collection, { cats: [] }),
    photos: readJson(io, FILES.realPhotos, { cats: {} }),
    meshy: readJson(io, FILES.meshy, { cats: {} }),
    watch: readJson(io, FILES.watch, null),
  };
  const before = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, JSON.stringify(v)]));
  const plannedTickers = new Set((files.planned.cats ?? []).map((c) => c.ticker));
  const proved = new Set((files.collection.cats ?? []).map((c) => c.tx));
  for (const row of todo) {
    const venue = venueById(row.venue);
    const T = row.ticker;
    const launch = { mint: row.mintPublic, tx: row.tx, launchpad: venue.launchpad, at: row.launchedAt };
    // The cat, with its launch (the whole file must still validate).
    const cats = files.adoptables.cats ?? [];
    const existing = cats.find((c) => c.ticker === T || c.id === row.cat.id);
    if (existing && !(existing.launch?.mint === launch.mint && existing.launch?.tx === launch.tx)) {
      const p = `${T}: the adoptable ticker or id is taken by another cat; ${row.coinName} was launched (${row.tx.slice(0, 12)}…) but is not in the sanctuary: a person must add it`;
      out.problems.push(p); log(`::error title=Launcher::${p}`); continue;
    }
    if (!existing) {
      const next = { ...files.adoptables, cats: [...cats, { ...row.cat, launch }] };
      const v = validateAdoptables(next, { taken: plannedTickers });
      if (v.refused.length) {
        const p = `${T}: data/adoptables.json would not validate (${v.refused.map((x) => x.detail).join("; ").slice(0, 200)}); nothing was recorded for it`;
        out.problems.push(p); log(`::error title=Launcher::${p}`); continue;
      }
      files.adoptables = next;
    }
    // Held from the announcer (its X post is scripts/post-updates.mjs's launch post).
    files.announced.cats ??= {};
    if (!files.announced.cats[T]) files.announced.cats[T] = { status: "held", reason: PAUSED_REASON };
    // Listed for the Collection, which proves it first (proved rows of the launcher's are dropped: the list holds at most 200).
    const rows = (files.launches.launches ?? []).filter((l) => !(typeof l.note === "string" && l.note.startsWith("Sanctuary launcher:") && proved.has(l.tx)));
    if (!rows.some((l) => l.tx === row.tx) && !proved.has(row.tx)) rows.push({ tx: row.tx, note: `Sanctuary launcher: ${T}` });
    if (rows.length <= 200) files.launches = { ...files.launches, launches: rows };
    else log(`::warning title=Launcher::data/launches.json holds 200 rows; ${T}'s launch is left to the Collection's wallet scan.`);
    // A 3D model of its own, from the post's picture.
    files.meshy.cats ??= {};
    if (!files.meshy.cats[T]) {
      const order = Math.max(0, ...Object.values(files.meshy.cats).map((q) => (Number.isFinite(q?.order) ? q.order : 0))) + 1;
      const look = row.cat.look.startsWith(`${row.cat.name}, drawn from the picture`) ? DEFAULT_REFERENCE : row.cat.look;
      files.meshy.cats[T] = { action: "rebuild", priority: 1, why: "A trending cat the sanctuary launched: it has no model of its own yet (the garden draws the shared model in its coat).",
        styleImage: row.image, referencePrompt: look, order };
    }
    // Its real photo, hotlinked from the post (never copied), unless the owner ruled it out.
    files.photos.cats ??= {};
    const photo = { url: row.image, handle: row.cat.proof.handle, post: row.url, alt: `${row.name}: the photo from @${row.cat.proof.handle}'s post` };
    if (!files.photos.cats[T] && !(T in (files.photos.none ?? {})) && realPhotoOf(photo)) files.photos.cats[T] = { realPhoto: photo, source: "proof" };
    replaceRow(ledger, { ...row, recordedAt: ISO_SECONDS(nowMs) });
    out.recorded.push(T);
    log(`Launcher: ${row.name} (${T}) moves into the sanctuary; its X post waits for the Collection to prove ${row.tx.slice(0, 12)}….`);
  }
  // The watch list lets go of the figures that live in the sanctuary now (the trend watch no longer looks for them).
  if (out.recorded.length && isObj(files.watch) && Array.isArray(files.watch.figures)) {
    const names = [...(files.planned.cats ?? []), ...(files.adoptables.cats ?? [])].flatMap((c) => [c?.name, c?.coinName, c?.ticker, c?.launchTicker]).filter((x) => typeof x === "string");
    const home = new Set([...figuresAtHome(files.watch, names), ...todo.filter((r) => out.recorded.includes(r.ticker) && r.figure).map((r) => r.figure)]);
    if (home.size) {
      files.watch = { ...files.watch, figures: files.watch.figures.filter((f) => !home.has(f?.name)) };
      log(`Launcher: ${[...home].join(", ")} ${home.size === 1 ? "leaves" : "leave"} the watch list (data/cat-watch.json): in the sanctuary now.`);
    }
  }
  // Each file only if it changed; the ledger last, so a crash before it only repeats this phase.
  const write = [["adoptables", FILES.adoptables, json2], ["announced", FILES.announced, json2], ["launches", FILES.launches, json2], ["photos", FILES.realPhotos, json2], ["meshy", FILES.meshy, json1], ["watch", FILES.watch, watchText]];
  for (const [k, rel, fmt] of write) if (JSON.stringify(files[k]) !== before[k]) io.writeText(rel, fmt(files[k]));
  if (out.recorded.length) saveLedger(io, ledger);
  return out;
}
