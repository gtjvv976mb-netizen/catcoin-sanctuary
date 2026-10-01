/**
 * THE SANCTUARY'S AUTOMATIC LAUNCHER: its whole logic, with no file system, network or clock of its
 * own (scripts/launch.mjs brings them: `io` reads and writes files by their repo path, `rpc` is
 * scripts/lib/rpc.mjs createRpc(), `fetchImpl` fetches the site, `now` and `sleep` keep time). Every
 * phase is idempotent and safe to run again after a crash at any point.
 *
 * WHAT IT LAUNCHES. Cats the trend watch found (data/trending-cats.json), newest post first, at most
 * one a run, only "watch-list cats": a reading named after a data/cat-watch.json figure
 * (reading.nameFrom "figure"), or a cartoon or fiction cat that a big account posted
 * (post.bigAccount) or an X trend named (nameFrom "trend"). Anything else (a real pet, even one named
 * after a figure, a name the rules guessed) waits for the owner: its post id in data/launch-approvals.json { approve: [ids] } lets it
 * through the watch-list rule, and every other rule still applies. A post that names no cat (a big
 * account's signal) launches when the owner names it there: { "post": "<id or link>", "name": "…" } (namingsOf). Never a sensitive cat, one the trend
 * watch marked known, one already in the sanctuary (data/planned.json, data/adoptables.json: names and
 * tickers, letter case aside), one in the ledger, a post older than MAX_POST_AGE_HOURS or without a
 * pbs.twimg.com picture, and never one whose coin text, metadata or X post would break the site's
 * content rules (the post is drafted before the launch: scripts/post-updates.mjs draftLaunch).
 *
 * AND THE SANCTUARY'S OWN CATS, after their X post (the owner's choice, 2026-09-30): when no trending
 * cat may launch, the adoptable cat the announcer released last (data/release-queue.json "released",
 * with the id of the sanctuary's own post) that has no coin yet (sanctuaryRow, policy "sanctuary"). It
 * launches from that post (its mint derived from the post id, like any other), on pump.fun in SOL,
 * named as its card names it, its coin's picture its portrait on the site; its row in
 * data/adoptables.json takes the launch (and the SOL pair) once launched. Never a cat with a coin
 * already (its own launch, a visitor's adoption in data/adoptions.json, a Collection entry under its name
 * or ticker, or a coin on pump.fun under its kit's name and ticker since the trend watch's coverage mark,
 * data/trending.json fresh.coveredUntil, read live right before the signature: a visitor who adopts
 * first wins; StonkFun and GetStonked adoptions are tracked by nothing yet, so they are not seen), one
 * with a sensitivity note other than "In loving memory of …", one whose story mentions a death while
 * its data does not mark it memorial (never guessed: the death may be another's), or one of low
 * confidence. A cat that died (memorial: true) is a tribute: its lore line "In loving memory of <name>."
 * A prepared cat follows its card until it is sent, and gives way to a trending cat that may launch;
 * it never takes the day's last launch (kept for a trending cat); and
 * the caps, the content rules and every check before and after the send are the same as a trending cat's.
 *
 * WHERE (scripts/lib/venues.mjs chooseVenue, the owner's rule in scripts/lib/venues-routing.mjs): by
 * default on pump.fun priced in SOL ("pump-sol"); a cat tied to a company with a stock pair (data/
 * cat-watch.json: a figure's "stock", or accountLinks for the big account that posted it) on StonkFun
 * priced in that stock ("stonkfun"), unless the pair already has a sanctuary cat (one cat per pair:
 * planned, proved, adoptable, or one of the launcher's own launches not in data/adoptables.json yet);
 * a cat tied to a coin data/pump-quotes.json lists on pump.fun priced in that coin ("pump-quote"),
 * only while the owner opts in (the repository variable LAUNCH_PUMP_QUOTE=on). The venue is chosen at
 * prepare and checked again at send: a StonkFun or coin-priced launch that fails at any step BEFORE it
 * is sent (its pair taken meanwhile, the opt-in withdrawn, StonkFun's pricing or config, the build,
 * the simulation, the per-launch cap) goes out on pump.fun in SOL for that run instead, and the row
 * says why (`fallback`); nothing ever falls back after a send. Every venue serves the same metadata,
 * and a cat is only prepared when its coin and its X post would pass on pump.fun in SOL too.
 *
 * HOW. The venue builds and signs the launch; the launcher never buys or sells anything (no dev buy,
 * no trading, on every venue). The coin's mint is derived from the wallet's seed and the
 * post id (scripts/lib/solana-tx.mjs deriveMintKeypair), so one post can only ever make one coin: a
 * retry sends the same mint again, and the chain refuses a second create. The mint address is never
 * written or printed before its transaction is sent (a known, unused address can be pre-funded by
 * anyone to block the create): the coin's metadata file is named by the post id
 * (coins/<postId>.json, served by the site), and the ledger row gets mintPublic only once it is sent.
 *
 * THE LEDGER, data/sanctuary-launches.json { note, launches: [row] }, newest first, at most
 * LEDGER_MAX rows (old finished rows are dropped first; none in flight ever is). A row:
 *   { postId, url, name, coinName, ticker, venue, policy, figure?, kind, lore, image, metadataPath, status,
 *     preparedAt, attempts, cat, and, as it goes: tx, sentAt, lastValidBlockHeight, mintPublic,
 *     spentLamports, settledAt, launchedAt, recordedAt, retry, reason, fallback }
 *   status "prepared" (its metadata written; no tx, no mint) → "sending" (tx = the signed
 *   transaction's signature and its blockhash's lastValidBlockHeight, written BEFORE it is sent) →
 *   "launched" (settled: finalized and proved by the venue; mintPublic, spentLamports from the
 *   transaction's own balances, launchedAt = its block time) or "failed" (reason; retry: may be
 *   prepared again with the SAME mint, at most MAX_ATTEMPTS sends). `venue` is the registered venue
 *   (its launchpad is the cat's launch.launchpad); `cat` is the adoptable row the cat gets once
 *   launched (data/adoptables.json, checked by assets/ui/adoptables.js before anything is prepared),
 *   `kind` the trend watch's reading kind ("real" is a pet; "cartoon" and "fiction" are characters),
 *   priced in the venue's pair (SOL, the stock pair, or the listed coin); `fallback` says why a
 *   StonkFun or coin-priced cat went out on pump.fun in SOL instead.
 *
 * THE PHASES (the workflow commits between them):
 *   prepare  settles "sending" rows by their signature (finalized: launched or failed; finalized with
 *            no error but not proved yet: still "sending", a person told; unknown after the blockhash
 *            expired: failed, retry) and saves that at once, prepares a retryable failed row again, or,
 *            with nothing in flight, the day's count not reached and room left under the Collection's
 *            MAX_CATS (collectionRoom), prepares ONE new cat: its metadata file and its ledger row.
 *            data/launch-approvals.json is only read (unreadable: no approvals, a warning). Then the photos
 *            of posts the owner hides in data/photo-hide.json (read the same way) move, whole, from
 *            data/real-photos.json `cats` to `hidden` (and back once no longer hidden), and a prepared row's coin picture
 *            follows that list (the site's own picture for a hidden post).
 *   send     (the only phase with the key) settles "sending" rows, then for the prepared row: looks for
 *            a launch of its post on chain (its mint's create in the wallet's own history, on every
 *            venue, or a create with its metadata uri in another launcher wallet's: a launch that
 *            happened but was never recorded is recovered; an address someone else touched fails for
 *            good), waits (bounded) until the site serves the committed metadata at its uri, builds
 *            (StonkFun: its pricing fetched now and its config read back) and SIMULATES the launch
 *            UNSIGNED (falling back to pump.fun in SOL as above; a simulation the RPC node could not
 *            run uses no attempt), and refuses unless
 *            the simulation succeeds, the wallet's loss is within LAUNCH_MAX_SOL_PER_LAUNCH, the last
 *            24 hours' spend plus this one is within LAUNCH_MAX_SOL_PER_DAY and the balance stays at or
 *            above LAUNCH_MIN_BALANCE_SOL, the balance counted WITHOUT the $CATSANC holders' SOL (the
 *            creator fees claimed for them and not paid out yet, and what every claim since the rewards
 *            ledger's cursor brought in: rewardsEarmark, from data/rewards/ledger.json; a ledger that is
 *            missing or does not read, or a history it cannot read in time, makes the launch wait).
 *            In dry mode it stops there, having signed nothing. Otherwise,
 *            the wallet still listed, it signs, writes the row "sending", sends, and confirms with
 *            bounded polling. Only a definite preflight or validation failure (REFUSAL_CODES: -32002,
 *            -32602) answered to the first and only post is a refusal (failed, nothing went out);
 *            any other error, or no answer, leaves the row "sending" with its tx, settled later by a
 *            chain check (its signature, or its blockhash's expiry). A row that ever went out is
 *            never closed as failed without that chain check.
 *   record   for each launched row not recorded yet: its tx in data/launches.json (the Collection proves
 *            it first), the cat in data/adoptables.json with its `launch` (which the announcer holds by
 *            rule: the X post is scripts/post-updates.mjs's, once the Collection has proved the mint;
 *            data/announced.json is the Announce workflow's alone and never written here), a 3D
 *            model queued in scripts/meshy.queue.json, its hotlinked real photo in data/real-photos.json
 *            credited to its post's author on the card (a post the owner hides in data/photo-hide.json: `hidden`),
 *            and its figure (and any other figure now in the sanctuary) off data/cat-watch.json, as the
 *            trend watch's own checks expect of a cat that moved in.
 *
 * MODE (LAUNCH_ENABLED): "on" launches; "dry" builds and simulates but writes nothing new and sends
 * nothing (it still settles rows already sent); anything else does nothing at all. LAUNCH_PUMP_QUOTE
 * "on" (a repository variable, never a secret) opts in to the unverified coin-priced pump.fun venue.
 */
import { validateWallets, activeLauncher, isAddress, isSignature, textProblem, httpsProblem, coatProblem, parseTime, base58Encode, TICKER, SOL_PAIR, STOCK_PAIRS, validatePumpQuotes, MAX_CATS } from "../../assets/collection.js";
import { adoptableProblem, validateAdoptables, tributeLine, ADOPTABLE_CATEGORIES, realPhotoOf, nameKey } from "../../assets/ui/adoptables.js";
import { keypairFromSecret, deriveMintKeypair, decodeCompactU16, decodeLegacyMessage, decompileInstructions, priorityFeeLamports, MAX_COMPUTE_UNIT_LIMIT, DEFAULT_INSTRUCTION_COMPUTE_UNIT_LIMIT } from "./solana-tx.mjs";
import { TOKEN_PROGRAM, TOKEN_2022_PROGRAM, COMPUTE_BUDGET_PROGRAM } from "./programs.mjs";
import { LAUNCH_DEFAULTS } from "./pump.mjs";
import { venueById, venueIds, chooseVenue, takenPairs, PUMP_SOL, PUMP_QUOTE } from "./venues.mjs";
import { coatFromLook } from "./coat.mjs";
import { tickerFor, loreFrom } from "./read-cat-post.mjs";
import { RpcError } from "./rpc.mjs";
import { draftLaunch, checkUpdate, fanTribute } from "../post-updates.mjs";
import { validateRewardsLedger, earmarkSignatures, earmarkLamports, rewardsMode, REWARDS_FILES } from "./rewards.mjs";
import { measureClaim } from "./pump-fees.mjs";
import { kitsOf, sameKit, KITS_LIVE } from "./adoptions.mjs";

/* ── constants ─────────────────────────────────────────────────────────────────────────── */

export const SITE_ORIGIN = "https://catcoinsanctuary.com";
export const X_ACCOUNT = "https://x.com/catcosanctuary";
/**
 * The coin image of a post the owner hides (data/photo-hide.json): the site's own picture, never that
 * photo (a stranger's photo can show faces, children or a home).
 */
export const SITE_IMAGE = `${SITE_ORIGIN}/assets/og-image.jpg`;
/** The sanctuary's X handle (its own posts are the posts its own cats launch from). */
export const OWN_HANDLE = "catcosanctuary";
/** A picture the site itself serves: a sanctuary cat's portrait or lore picture (its coin's image). */
export const SITE_PICTURE = /^https:\/\/catcoinsanctuary\.com\/assets\/(?:portraits|lore)\/[A-Za-z0-9_-]{1,40}\.(?:jpg|webp|png)$/;
export const FILES = Object.freeze({
  ledger: "data/sanctuary-launches.json",
  approvals: "data/launch-approvals.json",
  photoHide: "data/photo-hide.json",
  trending: "data/trending-cats.json",
  watch: "data/cat-watch.json",
  adoptables: "data/adoptables.json",
  planned: "data/planned.json",
  wallets: "data/wallets.json",
  launches: "data/launches.json",
  announced: "data/announced.json",
  realPhotos: "data/real-photos.json",
  collection: "data/collection.json",
  pumpQuotes: "data/pump-quotes.json",
  meshy: "scripts/meshy.queue.json",
  queue: "data/release-queue.json",
  adoptions: "data/adoptions.json",
  lore: "data/lore.json",
  pumpScan: "data/trending.json",
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

/** LAUNCH_PUMP_QUOTE: "on" (letter case aside, as LAUNCH_ENABLED) opts in to the unverified coin-priced pump.fun venue; anything else does not. */
export const pumpQuoteOptIn = (env = {}) => String(env.LAUNCH_PUMP_QUOTE ?? "").trim().toLowerCase() === "on";
/** The owner's open launch rule (LAUNCH_OPEN, on unless "off"): real pets in viral or rising posts, and any cat a big account names, launch without approval. */
export const openLaunches = (env = {}) => String(env.LAUNCH_OPEN ?? "").trim().toLowerCase() !== "off";

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
  `"since" must be at or before its first launch; retire it later with an "until" date, never by deleting the row. Keep the label "Auto launcher"`,
  `(or "Auto launcher 2" and so on): before a post is launched with one key, every other wallet so labelled is searched for a launch of it.`,
  `If that is not the wallet you meant, the repository secret LAUNCH_WALLET_KEY holds another wallet's key.`,
];

/* ── the coin's metadata (hosted by the site at coins/<postId>.json) ───────────────────── */

export const metadataPath = (postId) => `coins/${postId}.json`;
export const metadataUri = (postId) => `${SITE_ORIGIN}/coins/${postId}.json`;
export const cardUrl = (ticker) => `${SITE_ORIGIN}/#cat=${encodeURIComponent(ticker)}`;
/**
 * The most characters a coin's description is given. No venue limits it (the description lives only in
 * the off-chain metadata JSON: pump.fun's create_v2 and LaunchLab's initialize carry the name, the symbol
 * and the uri on chain, which launchTextProblem bounds); this is the launcher's own bound, well inside
 * what launchpad pages show.
 */
export const DESCRIPTION_MAX = 500;
/**
 * The coin's description: its lore line, the photo's credit when there is one and it fits ("Photo:
 * @handle on X.", `credit`), then the fan-tribute line (post-updates.mjs fanTribute: "…the character's
 * owners." or, for a real pet (reading kind "real"), "…the cat's owners."), which always closes it whole.
 * Over `max`, the credit goes first, then the lore is shortened (at a word, with "…"), never the tribute.
 */
export function descriptionOf(lore, kind = null, { credit = null, max = DESCRIPTION_MAX } = {}) {
  const tribute = fanTribute(kind);
  const line = String(lore ?? "").trim();
  const ended = /[.!?…]$/.test(line) ? line : `${line}.`;
  if (credit && `${ended} ${credit} ${tribute}`.length <= max) return `${ended} ${credit} ${tribute}`;
  if (`${ended} ${tribute}`.length <= max) return `${ended} ${tribute}`;
  const room = max - tribute.length - 2;                          // the lore, its "…" and the space
  if (room < 1) return tribute;
  const cut = line.slice(0, room + 1);
  const atWord = cut.lastIndexOf(" ") > room / 2 ? cut.slice(0, cut.lastIndexOf(" ")) : cut.slice(0, room);
  return `${atWord.replace(/[\s,;:.!?…-]+$/u, "")}… ${tribute}`;
}

/**
 * The picture a coin shows (its metadata's image): the post's photo (row.image), for every kind of cat,
 * unless the owner hides that post's photo (data/photo-hide.json): then SITE_IMAGE. It follows the hide
 * list while the row is prepared and is fixed once the coin is sent (its uri serves it for good).
 */
export const coinImageFor = ({ image, postId }, hidden = new Set()) => (hidden.has(String(postId)) ? SITE_IMAGE : image);
/** A row's coin image: its `coinImage`, or (a row from before it was kept) the post's photo. */
export const coinImageOf = (row) => row.coinImage ?? row.image;
/** The photo credit a coin's description carries ("Photo: @handle on X."), for its post's author. */
export const photoCredit = (handle) => `Photo: @${handle} on X.`;
/** A row's credit: only when its coin shows the post's photo and the row says the credit fits (`photoCredit`), else null. */
const creditOf = (row) => (row.photoCredit === true && coinImageOf(row) === row.image && X_POST_URL.test(row.url ?? "") ? photoCredit(X_POST_URL.exec(row.url)[1]) : null);

/** The metadata JSON a row's coin serves, in its venue's shape. */
export function coinMetadata(row) {
  const venue = venueById(row.venue);
  if (!venue) throw new LaunchError(`unknown venue ${row.venue}`);
  return venue.metadata({ name: row.coinName, symbol: row.ticker, description: descriptionOf(row.lore, row.kind, { credit: creditOf(row) }), image: coinImageOf(row), website: cardUrl(row.ticker), twitter: row.url, createdOn: SITE_ORIGIN });
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

export const LEDGER_NOTE = "The sanctuary's automatic launcher's ledger (scripts/launch.mjs, scripts/lib/launcher.mjs): one row per post it prepared (a trending post, or the sanctuary's own X post of one of its cats), newest first. prepared → sending (tx written before it is sent) → launched or failed. The mint (mintPublic) is written only once its transaction is sent. Written by the Launch workflow; do not edit by hand while a row is prepared or sending.";
export const STATUSES = Object.freeze(["prepared", "sending", "launched", "failed"]);
const ROW_FIELDS = ["postId", "url", "name", "coinName", "ticker", "venue", "policy", "figure", "kind", "lore", "image", "coinImage", "photoCredit", "metadataPath", "status", "preparedAt", "attempts", "cat",
  "tx", "sentAt", "lastValidBlockHeight", "mintPublic", "spentLamports", "settledAt", "launchedAt", "recordedAt", "retry", "reason", "fallback"];
/** Why a cat launched: a trending post by the owner's rules (policyOf), or "sanctuary": one of the sanctuary's own cats, after its X post (sanctuaryRow). */
export const POLICIES = Object.freeze(["figure", "trend", "big-account", "approved", "viral", "sanctuary"]);
/** The trend watch's reading kinds a launched cat may have (a row's `kind`: "real" is a pet, the others characters). */
export const KINDS = Object.freeze(["real", "cartoon", "fiction"]);
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
  if (r.kind !== undefined && !KINDS.includes(r.kind)) return `kind must be one of ${KINDS.join(", ")}`;
  if (typeof r.lore !== "string" || r.lore.length < 1 || r.lore.length > 200) return "lore must be one line";
  if (r.policy === "sanctuary" ? !SITE_PICTURE.test(r.image ?? "") : !PBS_IMAGE.test(r.image ?? "")) return r.policy === "sanctuary" ? "image must be the cat's picture on the site" : "image must be a pbs.twimg.com picture";
  if (r.policy === "sanctuary" && (X_POST_URL.exec(r.url ?? "")?.[1] !== OWN_HANDLE || r.photoCredit === true || r.cat?.launch !== undefined)) return "a sanctuary cat launches from the sanctuary's own post, with no photo credit and no launch yet";
  if (r.coinImage !== undefined && r.coinImage !== r.image && r.coinImage !== SITE_IMAGE) return "coinImage must be the post's picture, or the site's own";
  if (r.photoCredit !== undefined && typeof r.photoCredit !== "boolean") return "photoCredit must be true or false";
  if (r.metadataPath !== metadataPath(r.postId)) return "metadataPath must be coins/<postId>.json";
  if (!STATUSES.includes(r.status)) return "status is unknown";
  if (!isTime(r.preparedAt)) return "preparedAt must be YYYY-MM-DDTHH:MM:SSZ";
  if (!Number.isInteger(r.attempts) || r.attempts < 0 || r.attempts > MAX_ATTEMPTS) return `attempts must be 0..${MAX_ATTEMPTS}`;
  if (!isObj(r.cat) || r.cat.ticker !== r.ticker || adoptableProblem(r.cat)) return "cat must be the adoptable row the cat gets";
  if (venueById(r.venue).pairProblem(r.cat.pair)) return `the cat's pair is not one ${r.venue} launches in`;
  if (r.fallback !== undefined && (typeof r.fallback !== "string" || !r.fallback || r.fallback.length > 300 || r.venue !== PUMP_SOL.id)) return "fallback is why a launch went to pump.fun in SOL instead";
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

/** Room the launcher leaves under the Collection's MAX_CATS besides the planned cats': for coins it cannot foresee (an owner's own launch). */
export const COLLECTION_MARGIN = 10;
/**
 * How many more cats the launcher may add to data/collection.json. The Collection's builder stops
 * (and proves nothing new) once the file would hold more than MAX_CATS, so the launcher keeps under
 * it: MAX_CATS less the entries there, the launcher's own launches not there yet (sending, or
 * launched and not proved), the planned cats with no entry yet (their room is kept for them) and
 * COLLECTION_MARGIN. Null when data/collection.json or data/planned.json cannot be read.
 */
export function collectionRoom({ collection, planned, ledger }) {
  if (!Array.isArray(collection?.cats) || !Array.isArray(planned?.cats)) return null;
  const txs = new Set(collection.cats.map((e) => e?.tx));
  const keys = new Set(collection.cats.map((e) => `${e?.pair?.mint} ${String(e?.symbol ?? "").toUpperCase()}`));
  const ours = (ledger?.launches ?? []).filter((r) => (r.status === "sending" || r.status === "launched") && !txs.has(r.tx)).length;
  const plannedLeft = planned.cats.filter((c) => !keys.has(`${c?.pair?.mint} ${String(c?.ticker ?? "").toUpperCase()}`)).length;
  return MAX_CATS - collection.cats.length - ours - plannedLeft - COLLECTION_MARGIN;
}

/* ── choosing a cat ────────────────────────────────────────────────────────────────────── */

/**
 * data/launch-approvals.json { note, approve: [postIds] } as a Set of post ids (malformed entries left out, and so is
 * an id written as a JSON number past 2^53: its last digits are lost, so it would name another post).
 */
export function approvalsOf(data) {
  return new Set((Array.isArray(data?.approve) ? data.approve : []).map(approvedIdOf).filter((v) => v !== null));
}

/** An approve entry's post id: the id itself, or a naming's { post } (an id or a link to the post); else null. */
function approvedIdOf(v) {
  if (isObj(v)) v = v.post;
  if (typeof v !== "string" && !Number.isSafeInteger(v)) return null;
  const s = String(v).trim();
  const id = X_POST_ID.test(s) ? s : postIdOf(s);
  return id && X_POST_ID.test(id) ? id : null;
}

const NAMING_NAME = /^[\p{L}\p{N}][\p{L}\p{N} '’.&-]{0,38}[\p{L}\p{N}.]$/u;
const NAMING_KINDS = ["real", "cartoon", "fiction"];

/**
 * The owner's names for approved posts that name no cat themselves (a big account's "Meow 😽" under a cat's
 * picture, listed under the trend watch's signals): data/launch-approvals.json approve entries written
 * { "post": "<id or link>", "name": "Poole's Cat", "ticker"?: "POOLE", "kind"?: "real" | "cartoon" | "fiction",
 * "lore"?: "<one line about the cat>" }. A Map of post id -> { name, ticker, kind?, lore? }. An entry whose
 * name or ticker is unusable gives no naming (its post is still approved, and read as the trend watch read it).
 */
export function namingsOf(data) {
  const out = new Map();
  for (const v of Array.isArray(data?.approve) ? data.approve : []) {
    if (!isObj(v)) continue;
    const id = approvedIdOf(v), name = typeof v.name === "string" ? oneLine(v.name, 40) : "";
    if (!id || !NAMING_NAME.test(name)) continue;
    const ticker = typeof v.ticker === "string" && v.ticker.trim() ? v.ticker.trim().replace(/^\$+/, "").toUpperCase() : tickerFor(name);
    if (!ticker || !TICKER.test(ticker)) continue;
    const lore = typeof v.lore === "string" ? oneLine(v.lore, 200) : "";
    out.set(id, { name, ticker, ...(NAMING_KINDS.includes(v.kind) ? { kind: v.kind } : {}), ...(lore ? { lore } : {}) });
  }
  return out;
}

/**
 * A post as the owner named it (namingsOf): the cat's name, coin name and ticker are the owner's, its kind the
 * owner's (else the trend watch's, else a real cat), its lore the owner's (else the post's first sentence, else a
 * plain line). Whether it is sensitive stays the trend watch's reading. Without a naming, the post as it is.
 */
export function withNaming(post, naming) {
  if (!naming || !isObj(post)) return post;
  const r = isObj(post.reading) ? post.reading : {};
  const kind = naming.kind ?? (NAMING_KINDS.includes(r.kind) ? r.kind : "real");
  const lore = naming.lore ?? loreFrom(post.text, naming.name) ?? `${naming.name}, the cat everyone was talking about on X`;
  return { ...post, reading: { ...r, aboutOneCat: true, catName: naming.name, coinName: naming.name, ticker: naming.ticker, kind, lore: oneLine(lore, 200), nameFrom: "owner", readBy: "owner" } };
}

/**
 * data/photo-hide.json { note, hide: [postIds] }, edited by the owner: posts whose photo the site must not
 * show (on a card) or use (as a coin's picture). Read as data/launch-approvals.json is (readOwned): a file
 * that is not JSON, or not { hide: [...] }, hides nothing, with a warning; never an error. A missing file
 * hides nothing.
 */
export function photoHideOf(io, log = () => {}) {
  const data = readOwned(io, FILES.photoHide, { hide: [] }, log);
  if (!isObj(data) || !Array.isArray(data.hide)) {
    log(`::warning title=Launcher::${FILES.photoHide} must be { "hide": ["<post id>", ...] }; no photo is hidden until it is fixed.`);
    return new Set();
  }
  return approvalsOf({ approve: data.hide });
}

/** An X post's status id from any link to it (x.com or twitter.com, www., a query such as ?s=20), or null. */
export const postIdOf = (url) => /\/status\/(\d{5,25})/.exec(String(url ?? ""))?.[1] ?? null;
/** The real-photos entry's photo for a ledger row: the post's picture, hotlinked, credited to its author. */
const photoOfRow = (row) => ({ url: row.image, handle: row.cat.proof.handle, post: row.url, alt: `${row.name}: the photo from @${row.cat.proof.handle}'s post` });

/**
 * data/real-photos.json kept in line with the owner's hide list, without losing anything: a shown photo
 * (`cats`) whose post is hidden moves, whole, to `hidden` ({ T: { postId, entry } }: the page reads `cats`
 * only, so the card shows its portrait), and one whose post is no longer hidden moves back to `cats` from
 * there, exactly as it was. Returns { photos, hid: [tickers], restored: [tickers] }; `photos` is the same
 * object when nothing moved.
 */
export function applyPhotoHide(photos, hiddenIds) {
  const cats = isObj(photos?.cats) ? photos.cats : {}, kept = isObj(photos?.hidden) ? photos.hidden : {};
  const hid = Object.keys(cats).filter((T) => !(T in kept) && hiddenIds.has(postIdOf(cats[T]?.realPhoto?.post)));
  const restored = Object.keys(kept).filter((T) => !hiddenIds.has(String(kept[T]?.postId)) && !(T in cats) && isObj(kept[T]?.entry) && realPhotoOf(kept[T].entry.realPhoto));
  if (!hid.length && !restored.length) return { photos, hid, restored };
  const next = { ...photos, cats: { ...cats }, hidden: { ...kept } };
  for (const T of hid) { next.hidden[T] = { postId: postIdOf(cats[T].realPhoto.post), entry: cats[T] }; delete next.cats[T]; }
  for (const T of restored) { next.cats[T] = next.hidden[T].entry; delete next.hidden[T]; }
  if (!Object.keys(next.hidden).length) delete next.hidden;
  return { photos: next, hid, restored };
}

/** The watch-list figures (data/cat-watch.json), by name. */
const figuresOf = (watch) => new Map((Array.isArray(watch?.figures) ? watch.figures : []).filter((f) => isObj(f) && typeof f.name === "string").map((f) => [f.name, f]));

/**
 * Why the owner's policy lets this post launch on its own, or null (it waits for data/launch-approvals.json):
 * "figure" (named after a watch-list figure still on the list), "trend" or "big-account" (a cartoon or
 * fiction cat an X trend named or a big account posted), "approved" (the owner listed its id). A real
 * pet (reading kind "real") is only ever "approved": the owner sees a stranger's post before it launches,
 * even when it is named after a figure; unless the owner's open rule is on (ctx.open, openLaunches:
 * LAUNCH_OPEN), when a pet a big account names ("big-account") or one in a viral or rising post ("viral")
 * launches on its own too.
 */
export function policyOf(post, { approvals = new Set(), watch = null, open = false } = {}) {
  const r = post?.reading;
  if (r?.kind === "real") {
    if (approvals.has(String(post?.id))) return "approved";
    // The open rule (openLaunches): a pet a big account names, or one in a viral or rising post, without approval.
    if (open && typeof post?.bigAccount === "string" && post.bigAccount) return "big-account";
    if (open && (post?.stage === "viral" || post?.stage === "rising")) return "viral";
    return null;
  }
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
 * `ctx` = { nowMs, approvals, photoHide, watch, ledger, adoptables, planned }.
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
  const uri = metadataUri(String(post.id));
  // pump.fun in SOL is every route's fallback: the coin must launch there as named, wherever it is routed.
  const bad = PUMP_SOL.textProblem({ name: coinName, symbol: ticker, uri });
  if (bad) return no(`the coin cannot be launched as named: ${bad}`);
  const route = routeOf(post, ctx);
  let { venue, pair } = route, fallback;
  const there = venue === PUMP_SOL ? null : venue.textProblem({ name: coinName, symbol: ticker, uri });
  if (there) { fallback = `${venue.id}: the coin cannot be launched there as named (${there})`.slice(0, 300); venue = PUMP_SOL; pair = { ...SOL_PAIR }; }
  // The adoptable row, checked with the whole file (a free id and ticker), priced in the venue's pair.
  const cats = ctx.adoptables?.cats ?? [];
  const built = adoptableFor(post, { figure, pair, taken: { ids: new Set(cats.map((c) => c.id)) }, nowMs: ctx.nowMs });
  if (built.problem) return no(built.problem);
  const v = validateAdoptables({ cats: [...cats, built.cat] }, { taken: new Set((ctx.planned?.cats ?? []).map((c) => c.ticker)) });
  if (v.refused.some((x) => x.index === cats.length)) return no(`the adoptable row would be refused: ${v.refused.find((x) => x.index === cats.length).detail}`);
  const row = {
    postId: String(post.id), url: post.url, name, coinName, ticker, venue: venue.id, policy, ...(figure ? { figure: figure.name } : {}), kind: r.kind, lore, image,
    coinImage: coinImageFor({ image, postId: post.id }, ctx.photoHide),
    metadataPath: metadataPath(String(post.id)), status: "prepared", preparedAt: ISO_SECONDS(ctx.nowMs), attempts: 0, cat: built.cat, ...(fallback ? { fallback } : {}),
  };
  // The site's content rules: the metadata's description, and the X post, drafted now (a held post means no launch).
  const cited = [name, coinName, ticker, ...(figure ? [figure.name, ...(Array.isArray(figure.aliases) ? figure.aliases : [])] : [])];
  // The fan-tribute line is the owner's fixed text (it says the coin is NOT official): a citation; the lore meets every rule.
  const tributeCited = [...cited, fanTribute(row.kind)];
  // The photo's credit goes in the description when it fits and meets every rule (a handle is the stranger's own text).
  row.photoCredit = true;
  const credit = creditOf(row);
  if (!credit || !coinMetadata(row).description.includes(credit) || !checkUpdate(coinMetadata(row).description, tributeCited).ok) row.photoCredit = false;
  const meta = coinMetadata(row);
  const d = checkUpdate(meta.description, tributeCited);
  if (!d.ok) return no(`the coin's description breaks the content rules (${d.violations.map((x) => `${x.rule}: ${x.term}`).join("; ")})`);
  // The post names the launchpad: drafted for the venue's, and for pump.fun's (the fallback's).
  for (const launchpad of new Set([venue.launchpad, PUMP_SOL.launchpad])) {
    const post2 = draftLaunch({ id: ticker, name }, { coinName, ticker, lore, launchpad, cited, tribute: fanTribute(row.kind) });
    if (!post2.ok) return no(`its X post would be held (${post2.violations.map((x) => `${x.rule}: ${x.term}`).join("; ")})`);
  }
  if (rowProblem(row)) return no(`the ledger row would be malformed: ${rowProblem(row)}`);
  return { row, post, route: { venue: venue.id, pair: { ...pair }, reason: fallback ? "text" : route.reason } };
}

/**
 * The pairs of the launcher's own launches, which data/adoptables.json may not show yet (prepared,
 * sending, launched but not recorded or not proved) or which may still go out (a failed row that is
 * tried again keeps its pair): every row's but one failed for good, and `except`'s. Mints.
 */
export function pendingPairs(ledger, { except = null } = {}) {
  return (ledger?.launches ?? []).filter((r) => r?.postId !== except && !(r.status === "failed" && (!r.retry || r.attempts >= MAX_ATTEMPTS)))
    .map((r) => r.cat?.pair?.mint).filter((m) => typeof m === "string");
}

/**
 * Where a post launches (scripts/lib/venues.mjs chooseVenue, the owner's rule), from what the
 * launcher reads: the sanctuary's files (data/planned.json, data/collection.json, data/adoptables.json,
 * as the site reads them) and its own ledger's pairs for the one-cat-per-pair rule, the coins
 * data/pump-quotes.json lists, and the owner's opt-in. Returns chooseVenue's { venue, pair, reason, from? }.
 */
export function routeOf(post, ctx) {
  return chooseVenue(post, ctx.watch, { planned: ctx.planned, collection: ctx.collection, adoptables: ctx.adoptables, extraPairs: pendingPairs(ctx.ledger),
    pumpQuotes: ctx.pumpQuotes ?? [], pumpQuoteOptIn: ctx.pumpQuoteOptIn === true });
}

/** The newest post that may launch: { row, post, skipped } or { row: null, skipped: [{ id, why }] }. Candidates and approved posts only. */
export function selectCandidate(ctx) {
  const ids = new Set([...(Array.isArray(ctx.trending?.candidates) ? ctx.trending.candidates.map(String) : []), ...ctx.approvals]);
  const posts = (Array.isArray(ctx.trending?.posts) ? ctx.trending.posts : []).filter((p) => ids.has(String(p?.id)))
    .map((p) => withNaming(p, ctx.namings?.get(String(p?.id))))
    .sort((a, b) => (Date.parse(b.postedAt) || 0) - (Date.parse(a.postedAt) || 0));
  const skipped = [];
  for (const post of posts) {
    const c = candidateRow(post, ctx);
    if (c.row) return { row: c.row, post, route: c.route, skipped };
    skipped.push({ id: String(post.id), why: c.problem });
  }
  return { row: null, skipped };
}

/* ── the sanctuary's own cats, after their X post ──────────────────────────────────────── */

const PICTURE_PATH = /^assets\/(?:portraits|lore)\/[A-Za-z0-9_-]{1,40}\.(?:jpg|webp|png)$/;
/* A drawn cat's look (a cartoon, an anime or a game character, a mascot, a logo, a render): its tribute names the
   character's owners. Read in the look's lead clause only ("a real cat with a plush coat" is a real cat). */
const NOT_REAL_LOOK = /\bnot (?:a )?real (?:cats?|animals?)\b/i;
const REAL_LOOK = /\breal cats?\b/i;
const DRAWN_LOOK = /\b(?:cartoon|anime|manga|animated|illustrat\w*|drawn|character|mascot|sticker|pixel(?:-art)?|emoji|chibi|kawaii|logo|graphic|vector|CGI|3D|render(?:ed)?|doodles?|painting|digital|artwork|inscription|NFT|AI-generated)\b/i;
/** A sanctuary cat's kind, as the fan-tribute line reads it: a show's cat or a drawn one is a character, the rest real cats. */
export function kindOfAdoptable(c) {
  if (c?.category === "tv-movie") return "fiction";
  const look = String(c?.look ?? "");
  if (NOT_REAL_LOOK.test(look)) return "cartoon";
  const lead = look.split(/(?<=[.:;])\s/)[0];
  if (REAL_LOOK.test(lead)) return "real";
  return DRAWN_LOOK.test(lead) ? "cartoon" : "real";
}
/** A death in a cat's own words (its story or lore caption): its own, or another's ("Love, who died in 2022"). */
export const DIED = /\b(?:died|dies|death|passed away|funeral|obituary|memorial|in loving memory|rainbow bridge|euthan\w*|r\.?i\.?p)\b|\(\d{4}\s*[–-]\s*\d{4}\)/i;
const diedText = (c, captions = {}) => [c?.story, c?.lore?.caption, captions?.[c?.ticker]].some((t) => DIED.test(String(t ?? "")));
/** A cat that died, as its data says (its memorial flag, never guessed from its words): its coin is a tribute, its lore line "In loving memory of <name>." */
export const inMemoriam = (c) => c?.memorial === true;
const MEMORY_NOTE = /^In loving memory of /i;
const PAIR_NAME = /&|\band\b|\+/i;
/**
 * Why a sanctuary cat (its adoptable row) may not get a coin from the launcher at all, or null. A cat that
 * died is launched as a tribute (the owner's choice, 2026-09-30); a sensitivity note other than its
 * "In loving memory of …" (an illness, a controversy) never is.
 */
function ownEligibility(c, captions) {
  if (c.launch) return "it has a coin already";
  const note = String(c.sensitivity ?? "").trim();
  if (note && !MEMORY_NOTE.test(note)) return "a sensitivity note: never launched by the launcher";
  // A death in its words without the memorial flag may be another's ("Love, who died in 2022"; "after his 2019 death"): never guessed.
  // A pair ("Cole & Marmalade") keeps its own line: one of them may live on.
  if (c.memorial !== true && diedText(c, captions) && !PAIR_NAME.test(String(c.name ?? ""))) return "its story mentions a death but it is not marked memorial (set memorial, and its \"In loving memory of …\" note, if the cat died)";
  if (c.confidence === "low") return "low confidence";
  if (c.launchTicker !== undefined && c.launchTicker !== c.ticker) return `its kit launches as ${c.launchTicker}`;
  // An older, unrelated small coin the research found (the card says so, and still offers the cat) does not stop it; its ticker would.
  if (String(c.existingCoin?.symbol ?? "").toUpperCase() === c.ticker) return "an older coin has its ticker";
  return null;
}

/* A sentence ends at . ! ? or … before a space or the end, never after a title or an abbreviation ("Mr.", "Dr.", "St."). */
const ABBR = /(?:^|[^\p{L}])(?:Mr|Mrs|Ms|Dr|St|Mt|Jr|Sr|Sgt|Lt|Capt|Col|Gen|Prof|Rev|No|vs|etc|Inc|Co|Ltd)\.$/iu;
function firstSentence(t) {
  const re = /[.!?…](?=\s|$)/gu;
  for (let m; (m = re.exec(t));) { const s = t.slice(0, m.index + m[0].length); if (s.length >= 11 && !ABBR.test(s)) return s; }
  return t;
}
/** Quotes and brackets that close: a line cut mid-quote is not one. */
const balanced = (s) => (s.match(/"/g) ?? []).length % 2 === 0 && (s.match(/\(/g) ?? []).length === (s.match(/\)/g) ?? []).length;

/**
 * A sanctuary cat's lore lines (each at most 200 characters), best first: its lore caption, its story's
 * first sentence (cut at a word), and last a plain line naming it; the launcher takes the first one its
 * coin's description and launch post pass the content rules with.
 */
export function loreLinesOf(c, captions = {}) {
  const clean = (s) => oneLine(s, 400).replace(/https?:\/\/\S+|www\.\S+/gi, "").replace(/[@#$]/g, "").replace(/\s+/g, " ").trim();
  const out = [];
  for (const text of [captions[c?.ticker], c?.lore?.caption, c?.story]) {
    const t = clean(text);
    if (t.length < 10) continue;
    const first = firstSentence(t).trim();
    const cut = first.slice(0, 199);
    const line = first.length <= 200 ? first : `${(cut.lastIndexOf(" ") > 100 ? cut.slice(0, cut.lastIndexOf(" ")) : cut).replace(/[\s,;:.!?…-]+$/u, "")}…`;
    if (balanced(line)) out.push(line);
  }
  const name = clean(c?.name);
  if (name) out.push(`${name}, one of the Catcoin Sanctuary's cats.`);
  // A cat that died: a tribute, never its story told in the present tense. Only for one cat: a pair ("Cole & Marmalade")
  // may have lost only one of them, so it keeps its own lore line.
  if (name && inMemoriam(c)) out.unshift(`In loving memory of ${name}.`);
  return [...new Set(out)];
}

/**
 * The ledger row a sanctuary cat the announcer has posted on X would get, or { problem }. `entry` is its
 * data/release-queue.json row (released, with the tweet id of the sanctuary's post): the coin launches
 * from that post (its mint is derived from its id), on pump.fun in SOL, named as the cat's card names it
 * (coinName, ticker), its picture the cat's portrait on the site. Never a cat with a coin already (its
 * `launch`, an adoption by a visitor, an entry of the Collection's under its name or ticker; an older,
 * unrelated coin the research found only under the same ticker), one with a sensitivity note other than
 * "In loving memory of …", one whose story mentions a death while it is not marked memorial (a cat that
 * died, memorial: true, is a tribute), one of low confidence, or one whose kit launches under another ticker; and every rule a trending cat's coin keeps (its text on
 * pump.fun, its metadata's description and its launch post by the site's content rules, the whole
 * adoptables file still valid with the cat priced in SOL).
 */
export function sanctuaryRow(entry, ctx) {
  const no = (problem) => ({ problem });
  const key = String(entry?.key ?? "");
  if (entry?.status !== "released" || !X_POST_ID.test(String(entry?.tweet ?? ""))) return no("not posted on X yet");
  const postId = String(entry.tweet);
  const cats = ctx.adoptables?.cats ?? [];
  const i = cats.findIndex((c) => c?.ticker === key);
  if (i < 0) return no("not an adoptable cat");
  const c = cats[i];
  const ineligible = ownEligibility(c, ctx.captions);
  if (ineligible) return no(ineligible);
  if (!Array.isArray(ctx.adoptions?.adoptions)) return no(`${FILES.adoptions} cannot be read`);
  if (ctx.adoptions.adoptions.some((a) => a?.key === key)) return no("a visitor adopted it (data/adoptions.json)");
  const coinName = oneLine(c.coinName || c.name, 60), name = oneLine(c.name, 60), ticker = c.ticker;
  if ((ctx.collection?.cats ?? []).some((e) => String(e?.symbol ?? "").toUpperCase() === ticker || nameKey(e?.name) === nameKey(coinName))) return no("the Collection lists a coin under its name or ticker");
  for (const r of ctx.ledger?.launches ?? []) {
    if (r.postId === postId) return no("already in the ledger");
    if (r.ticker === ticker && !(r.status === "failed" && (!r.retry || r.attempts >= MAX_ATTEMPTS))) return no("already in the ledger");
  }
  const picture = [c.portrait, c.lore?.image].find((p) => typeof p === "string" && PICTURE_PATH.test(p) && ctx.exists?.(p));
  if (!picture) return no("no portrait on the site");
  const uri = metadataUri(postId);
  const bad = PUMP_SOL.textProblem({ name: coinName, symbol: ticker, uri });
  if (bad) return no(`the coin cannot be launched as named: ${bad}`);
  const cat = { ...structuredClone(c), pair: { ...SOL_PAIR } };
  const v = validateAdoptables({ cats: cats.map((x, j) => (j === i ? cat : x)) }, { taken: new Set((ctx.planned?.cats ?? []).map((p) => p.ticker)) });
  if (v.refused.some((x) => x.index === i)) return no(`the adoptable row would be refused: ${v.refused.find((x) => x.index === i).detail}`);
  const image = `${SITE_ORIGIN}/${picture}`;
  const kind = kindOfAdoptable(c);
  const cited = [name, coinName, ticker];
  const tributeCited = [...cited, fanTribute(kind)];
  // The first lore line its coin's description and its launch post (drafted now: a held post means no launch) pass the content rules with.
  let problem = "no lore line";
  for (const lore of loreLinesOf(c, ctx.captions)) {
    const row = {
      postId, url: `https://x.com/${OWN_HANDLE}/status/${postId}`, name, coinName, ticker, venue: PUMP_SOL.id, policy: "sanctuary", kind, lore, image,
      coinImage: image, photoCredit: false, metadataPath: metadataPath(postId), status: "prepared", preparedAt: ISO_SECONDS(ctx.nowMs), attempts: 0, cat,
    };
    const d = checkUpdate(coinMetadata(row).description, tributeCited);
    if (!d.ok) { problem = `the coin's description breaks the content rules (${d.violations.map((x) => `${x.rule}: ${x.term}`).join("; ")})`; continue; }
    const post = draftLaunch({ id: ticker, name }, { coinName, ticker, lore, launchpad: PUMP_SOL.launchpad, cited, tribute: fanTribute(kind) });
    if (!post.ok) { problem = `its launch post would be held (${post.violations.map((x) => `${x.rule}: ${x.term}`).join("; ")})`; continue; }
    if (rowProblem(row)) return no(`the ledger row would be malformed: ${rowProblem(row)}`);
    return { row, route: { venue: PUMP_SOL.id, pair: { ...SOL_PAIR }, reason: "a sanctuary cat, after its X post" } };
  }
  return no(problem);
}

/**
 * Why a prepared sanctuary cat may no longer launch, or null: its row in data/adoptables.json is gone or
 * has a coin, a visitor adopted it, or the Collection lists a coin under its name or ticker since it was
 * prepared. Checked again right before the send.
 */
export function ownProblemNow(row, ctx) {
  const c = (ctx.adoptables?.cats ?? []).find((x) => x?.ticker === row.ticker && x?.id === row.cat?.id);
  if (!c) return "its row in data/adoptables.json is gone";
  const ineligible = ownEligibility(c, ctx.captions);
  if (ineligible) return `${ineligible} (since it was prepared)`;
  if (nameKey(c.coinName || c.name) !== nameKey(row.coinName)) return "its card names its coin otherwise now";
  if ((ctx.adoptions?.adoptions ?? []).some((a) => a?.key === row.ticker)) return "a visitor adopted it";
  if ((ctx.collection?.cats ?? []).some((e) => String(e?.symbol ?? "").toUpperCase() === row.ticker || nameKey(e?.name) === nameKey(row.coinName))) return "the Collection lists a coin under its name or ticker";
  return null;
}

/** The row a prepared sanctuary cat would be prepared as now (its lore line and kind follow its card), or null when it could not be. */
export const ownRowNow = (row, ctx) => sanctuaryRow({ key: row.ticker, status: "released", tweet: row.postId }, { ...ctx, ledger: { launches: [] } }).row ?? null;
/** Hours a prepared sanctuary cat may wait to be sent before a person is told (::error). */
export const OWN_WAIT_ALERT_HOURS = 6;

/** Pages of pump.fun's newest launches the live adoption check reads at most (50 a page). */
export const PUMP_CHECK_PAGES = 40;
/** How far before the trend watch's coverage mark (data/trending.json fresh.coveredUntil) the live check reads back. */
export const PUMP_CHECK_MARGIN_MS = 15 * 60_000;
/** One page of pump.fun's list, as the trend watch reads it (3 tries, a longer wait after a 429), or null. */
async function pumpPage(fetchImpl, sleep, offset) {
  for (let t = 0; t < 3; t++) {
    try {
      const res = await fetchImpl(PUMP_LIST(offset), { headers: { accept: "application/json", "user-agent": "catcoinsanctuary.com launcher" }, signal: AbortSignal.timeout(20_000) });
      if (res.ok) { const j = await res.json(); if (Array.isArray(j)) return j; }
      await sleep(res.status === 429 ? 3000 * (t + 2) * 2 : 1500);
    } catch { await sleep(1500); }
  }
  return null;
}
const PUMP_LIST = (offset) => `https://frontend-api-v3.pump.fun/coins?offset=${offset}&limit=50&sort=created_timestamp&order=DESC&includeNsfw=false`;

/**
 * The live adoption check, right before a sanctuary cat's coin is signed: pump.fun's launches since `sinceMs`
 * carrying the cat's kit name and ticker (sameKit), not the sanctuary's own (its launcher wallets). Returns
 * { taken: [mints] }, or { unchecked: why } when pump.fun's list could not be read back to `sinceMs` (then
 * nothing is sent: the next run tries again). data/adoptions.json only knows what the trend watch's last scan
 * saw; a visitor who adopted since is found here, so the sanctuary never launches a second coin for a cat.
 */
export async function kitLaunchedSince({ fetchImpl, sleep = async () => {}, kit, sinceMs, owners = new Set(), pages = PUMP_CHECK_PAGES }) {
  const taken = new Set();
  for (let page = 0, offset = 0; page < pages; page++) {
    const list = await pumpPage(fetchImpl, sleep, offset);
    if (!list) return taken.size ? { taken: [...taken] } : { unchecked: "pump.fun's list of new coins did not answer" };
    for (const coin of list) {
      const t = Number(coin?.created_timestamp);
      // A coin with no real time is matched too (its time unknown): a kit's name and ticker there is never let through.
      if (!owners.has(coin?.creator) && sameKit(coin, [kit]).length && (!(t > 0) || t >= sinceMs)) taken.add(String(coin.mint));
    }
    // Only a real time proves the walk reached `sinceMs` (Number(null) is 0); pump.fun's list never ends within these pages.
    const times = list.map((c) => Number(c?.created_timestamp)).filter((t) => Number.isFinite(t) && t > 0);
    if (times.length && Math.min(...times) < sinceMs) return { taken: [...taken] };
    if (!list.length) break;
    offset += list.length;
    await sleep(400);
  }
  return taken.size ? { taken: [...taken] } : { unchecked: `pump.fun's list did not reach back to the trend watch's coverage mark within ${pages} pages` };
}

/** The sanctuary cat to launch next: the one the announcer posted last that may launch. { row, route, skipped } or { row: null, skipped }. */
export function selectSanctuary(ctx) {
  // Who adopted what must be known: an unreadable data/adoptions.json is never "nobody".
  if (!Array.isArray(ctx.adoptions?.adoptions)) return { row: null, skipped: [{ id: "*", why: `${FILES.adoptions} cannot be read` }] };
  const released = (Array.isArray(ctx.queue?.cats) ? ctx.queue.cats : []).filter((q) => q?.status === "released" && q.tweet)
    .sort((a, b) => (Date.parse(b.releasedAt) || 0) - (Date.parse(a.releasedAt) || 0));
  const skipped = [];
  for (const entry of released) {
    const s = sanctuaryRow(entry, ctx);
    if (s.row) return { row: s.row, route: s.route, skipped };
    skipped.push({ id: String(entry.key), why: s.problem });
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
 * Every quote list a row's launch may be proved with: data/pump-quotes.json's (`quotes`) and, for a
 * coin-priced row, also its own pair as the row saved it (under either token program), so a coin
 * taken off the list after the send still settles as the launch that was sent.
 */
function quoteListsFor(row, quotes = []) {
  const pair = row?.cat?.pair;
  if (row?.venue !== PUMP_QUOTE.id || !isAddress(pair?.mint)) return [quotes];
  const others = quotes.filter((q) => q?.mint !== pair.mint);
  return [quotes, ...[TOKEN_PROGRAM, TOKEN_2022_PROGRAM].map((tokenProgram) => [...others, { symbol: pair.symbol, mint: pair.mint, tokenProgram }])];
}
/** `venue`'s proof of `tx` for `row` with `wallet` as the payer: the first quote list that proves it, else the first refusal. */
function proveFor(venue, tx, { wallet, row, quotes }) {
  let first = null;
  for (const list of quoteListsFor(row, quotes)) {
    const p = venue.prove(tx, { wallet, quotes: list });
    if (p?.ok) return p;
    first ??= p;
  }
  return first ?? { ok: false, clause: "unreadable" };
}

/**
 * Settle a "sending" row by its signature: finalized and proved by its venue → "launched" (mint,
 * spend, block time); finalized with an error → "failed" (retry); unknown once the finalized block
 * height is past the blockhash's lastValidBlockHeight (it can never land) → "failed" (retry);
 * otherwise unchanged. A transaction finalized WITHOUT an error that the venue does not prove (no
 * block time yet, an unreadable answer, a coin taken off data/pump-quotes.json since) is a coin that
 * exists: the row stays "sending" (it keeps its name, its pair and its place in the day's count, and
 * no new cat is prepared) and `unproved` says a person must look if the proof never passes; it is
 * tried again every run. Returns { row, changed, note, unproved? }.
 */
export async function settleSending(row, { rpc, nowMs, quotes = [] }) {
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
    const proof = proveFor(venue, tx, { wallet: payer, row, quotes });
    if (!proof.ok) {
      return { row, changed: false, unproved: true,
        note: `${row.ticker}: its transaction is finalized with no error, but ${venue.label} does not prove it as a launch (${proof.clause}); it stays "sending" (its name, its pair and its place in the day's count held, no new cat prepared) and the proof is tried again every run: a person must look if it never passes` };
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

/** How many pages (1,000 signatures each) of a launcher wallet's history are read, back to the row's preparedAt, looking for its launch. */
export const WALLET_HISTORY_PAGES = 10;
/**
 * The label walletInstructions gives the launcher's own wallets in data/wallets.json. Before a row
 * is sent with one key, the history of every OTHER wallet so labelled (active since the row was
 * prepared) is searched for a launch of the same post: a send made with a key since rotated away,
 * whose record was lost, is recovered instead of launching the post a second time under a new mint.
 */
export const LAUNCHER_LABEL = /^auto launcher\b/i;

/** The other launcher wallets (LAUNCHER_LABEL) data/wallets.json lists that could have sent a row prepared at `sinceMs`, by `nowMs`. */
export function otherLauncherWallets(walletsFile, current, { sinceMs, nowMs }) {
  return validateWallets(walletsFile ?? {}).launchers
    .filter((l) => l.address !== current && LAUNCHER_LABEL.test(String(l.label ?? "").trim()) && l.sinceMs <= nowMs && (l.untilMs === null || l.untilMs > sinceMs))
    .map((l) => l.address);
}

/**
 * The launch in `wallet`'s own history (newest first, back to `sinceMs`) that `match`es, proved on
 * every venue with that wallet as its payer. A launcher wallet's history is short (its launches and
 * their fees), unlike a busy coin's, whose create can sit under thousands of trades. Returns
 * { found: { tx, proof, venue } }, { found: null } (read back to `sinceMs`: none), or { found: null,
 * incomplete: true } (a history too long to read, or a transaction the RPC did not give).
 */
async function launchInWallet({ rpc, wallet, venues, match, sinceMs, row, quotes }) {
  let before, missed = false;
  for (let page = 0; page < WALLET_HISTORY_PAGES; page++) {
    const list = await rpc.getSignaturesForAddress(wallet, { before, limit: 1000, commitment: "confirmed" });
    if (!Array.isArray(list) || !list.length) return { found: null, incomplete: missed };
    for (const s of list) {
      if (Number.isInteger(s?.blockTime) && s.blockTime * 1000 < sinceMs) return { found: null, incomplete: missed };
      if (!s || s.err || typeof s.signature !== "string") continue;
      const tx = await rpc.getTransaction(s.signature, { commitment: "confirmed" });
      if (!tx) { missed = true; continue; }
      for (const v of venues) {
        const proof = proveFor(v, tx, { wallet, row, quotes });
        if (proof.ok && match(proof.launch)) return { found: { tx, proof, venue: v } };
      }
    }
    if (list.length < 1000) return { found: null, incomplete: missed };
    before = list.at(-1).signature;
  }
  return { found: null, incomplete: true };
}

/**
 * Has this row's post been launched already? { state: "none" } (send), { state: "launched", tx,
 * proof, venue, wallet } (the coin exists and its create is a launch of the post: recover it),
 * { state: "foreign" } (the mint's address holds an account the launch did not make: never send),
 * { state: "unknown" } (it cannot be told: a person must look; nothing is sent).
 *   The mint derived from the current wallet: an account there is looked up in the WALLET's own
 *   history since the row was prepared (a create proved on `venue` or, failing that, on any other
 *   venue: a launch sent after a fallback whose commit was lost), never in the coin's own history,
 *   which trading can make too long to read.
 *   No account there: the other launcher wallets (`others`, otherLauncherWallets) are searched the
 *   same way for a launch whose uri is this post's metadata (every launch of a post carries it).
 */
export async function mintOnChain({ rpc, venue, wallet, mint, row, others = [], quotes = [] }) {
  const venues = [venue, ...venueIds().map(venueById).filter((v) => v !== venue)];
  const prepared = Date.parse(row?.preparedAt ?? "");
  const sinceMs = Number.isFinite(prepared) ? prepared - HOUR_MS : 0;
  const [acc] = (await rpc.getMultipleAccounts([mint], { commitment: "confirmed" })) ?? [null];
  if (acc) {
    if (acc.owner !== TOKEN_2022_PROGRAM) return { state: "foreign", detail: "the mint's address already holds an account the launch did not make (someone funded it)" };
    const r = await launchInWallet({ rpc, wallet, venues, sinceMs, row, quotes, match: (l) => l.mint === mint });
    if (r.found) return { state: "launched", ...r.found, wallet };
    return { state: "unknown", detail: "the coin exists, but its launch was not found in the wallet's history since the row was prepared" };
  }
  const uri = metadataUri(row.postId);
  for (const other of others) {
    const r = await launchInWallet({ rpc, wallet: other, venues, sinceMs, row, quotes, match: (l) => l.uri === uri });
    if (r.found) return { state: "launched", ...r.found, wallet: other };
    if (r.incomplete) return { state: "unknown", detail: `the history of the launcher wallet ${other} since the row was prepared could not be read to its end, so an earlier launch of this post by it cannot be ruled out` };
  }
  return { state: "none" };
}

/* ── the phases ────────────────────────────────────────────────────────────────────────── */

const readJson = (io, rel, fallback) => {
  const text = io.readText(rel);
  if (text === null || text === undefined) return fallback;
  try { return JSON.parse(text.replace(/^\uFEFF/, "")); } catch { throw new LaunchError(`${rel} is not valid JSON`); }
};
const json2 = (v) => `${JSON.stringify(v, null, 2)}\n`;
const json1 = (v) => `${JSON.stringify(v, null, 1)}\n`;
const inFlight = (ledger) => ledger.launches.filter((r) => r.status === "prepared" || r.status === "sending");
const replaceRow = (ledger, row) => { ledger.launches = ledger.launches.map((r) => (r.postId === row.postId ? row : r)); };
const saveLedger = (io, ledger) => io.writeText(FILES.ledger, ledgerText(ledger));
/** Whether a row's post is too old to launch: a trending post past MAX_POST_AGE_HOURS; a sanctuary cat's own post never is. */
const tooOld = (row, trending, nowMs) => row.policy !== "sanctuary" && postAgeMs(row, trending, nowMs) > MAX_POST_AGE_HOURS * HOUR_MS;
const postAgeMs = (row, trending, nowMs) => {
  const p = (trending?.posts ?? []).find((x) => String(x?.id) === row.postId);
  const t = Date.parse(p?.postedAt ?? row.cat?.proof?.date ?? "");
  return Number.isFinite(t) ? nowMs - t : Infinity;
};
/**
 * Why a row priced in a stock pair may not take it now, or null: another cat has that pair since the
 * row was prepared (a planned cat, a Collection entry, an adoptable, another of the launcher's own
 * launches), or the files that say so cannot be read. One cat per stock pair, checked again right
 * before the send. A row priced in anything else (SOL, a listed coin) has nothing to check.
 */
function pairProblemNow(row, ctx) {
  const mint = row.cat?.pair?.mint;
  if (!STOCK_MINTS.has(mint)) return null;
  if (![ctx.planned, ctx.collection, ctx.adoptables].every((f) => Array.isArray(f?.cats))) return "the stock pairs in use cannot be read";
  const used = takenPairs({ planned: ctx.planned, collection: ctx.collection, adoptables: ctx.adoptables, extra: pendingPairs(ctx.ledger, { except: row.postId }) });
  return used.has(mint) ? `its stock pair ${row.cat.pair.symbol} has a sanctuary cat now` : null;
}
const STOCK_MINTS = new Set(STOCK_PAIRS.map((p) => p.mint));

/** Where a row launches, for the log: its venue, its pair and why (the route's reason, or its fallback). */
const whereText = (row, route = null) => `on ${venueById(row.venue).label}, priced in ${row.cat.pair.symbol}${row.fallback ? ` (fallback: ${row.fallback})` : route?.reason ? ` (${route.reason})` : ""}`;

/**
 * data/pump-quotes.json's coins: `listed` (every valid row: what a coin-priced launch is proved with)
 * and `usable` (the same, or none at all when any row is refused: a list the Collection's builder
 * would stop on routes and builds nothing). A missing file lists none; so does one that is not JSON
 * (edited by hand: a warning, and no cat is priced in a coin; a coin-priced row already sent is still
 * proved with its own saved pair, settleSending).
 */
function quotesOf(io, log = () => {}) {
  const q = validatePumpQuotes(readOwned(io, FILES.pumpQuotes, { quotes: [] }, log));
  if (q.refused.length) log(`::warning title=Launcher::${FILES.pumpQuotes} is refused (${q.refused.map((x) => x.detail).join("; ").slice(0, 200)}); no cat is priced in a coin until it is fixed.`);
  return { listed: q.quotes, usable: q.refused.length ? [] : q.quotes };
}

/**
 * A file the owner edits by hand that only CHOOSING or ROUTING a cat reads (data/launch-approvals.json,
 * data/cat-watch.json, data/pump-quotes.json): unreadable, it is read as `fallback` (no approvals, no
 * figures, no coins) with a warning, so a typo there never stops the launcher from settling what it sent.
 */
export const readOwned = (io, rel, fallback, log = () => {}) => {
  try { return readJson(io, rel, fallback); } catch (e) { log(`::warning title=Launcher::${e.message}; it is read as empty until it is fixed.`); return fallback; }
};

/** What choosing and routing a cat reads. A sanctuary file that is missing is null (the pairs in use are then unknown: no stock pair is used). */
function selectionContext(io, ledger, nowMs, { env = {}, quotes = { usable: [] }, log = () => {} } = {}) {
  return {
    nowMs, ledger,
    trending: readJson(io, FILES.trending, { posts: [], candidates: [] }),
    ...(() => { const a = readOwned(io, FILES.approvals, { approve: [] }, log); return { approvals: approvalsOf(a), namings: namingsOf(a) }; })(),
    photoHide: photoHideOf(io, log),
    watch: readOwned(io, FILES.watch, { figures: [] }, log),
    adoptables: readJson(io, FILES.adoptables, null),
    planned: readJson(io, FILES.planned, null),
    collection: readJson(io, FILES.collection, null),
    pumpQuotes: quotes.usable,
    pumpQuoteOptIn: pumpQuoteOptIn(env),
    open: openLaunches(env),
    // The sanctuary's own cats (sanctuaryRow): the ones the announcer released, adoptions, lore captions, files on disk.
    queue: readOwned(io, FILES.queue, { cats: [] }, log),
    // Strict: unreadable or malformed is null (unknown), never "nobody adopted anything".
    adoptions: (() => {
      try { const a = readJson(io, FILES.adoptions, { adoptions: [] }); if (Array.isArray(a?.adoptions)) return a; } catch { /* below */ }
      log(`::warning title=Launcher::${FILES.adoptions} cannot be read; no sanctuary cat is launched until it is fixed.`);
      return null;
    })(),
    captions: (() => { const l = readOwned(io, FILES.lore, { cats: {} }, log); return isObj(l?.cats) ? l.cats : {}; })(),
    exists: (rel) => io.readText(rel) !== null,
  };
}

/**
 * PREPARE (no key). Returns { mode, changed, pending, deploy, prepared, photos? }: `pending` when the
 * send or record phase has work (a row in flight or launched but not recorded, or, in dry mode, a cat
 * to simulate); `deploy` when a prepared row's metadata is not served yet, or data/real-photos.json
 * just changed with data/photo-hide.json (`photos`: the tickers hidden or shown again): the workflow
 * then deploys the site.
 */
export async function prepare({ io, env = {}, rpc, fetchImpl, now = Date.now, log = () => {}, scrub = (t) => t }) {
  const mode = launchMode(env);
  const out = { mode, changed: false, pending: false, deploy: false, prepared: null };
  if (mode === "off") { log("Launcher: off (LAUNCH_ENABLED is neither on nor dry); nothing done."); return out; }
  const nowMs = now();
  const caps = launchCaps(env);
  for (const n of caps.notes) log(`::warning title=Launcher::${n}`);
  const ledger = validateLedger(readJson(io, FILES.ledger, null));
  const quotes = quotesOf(io, log);

  // 1. Rows sent earlier: settled by their signature, and saved at once (before any file the owner edits is read).
  for (const row of ledger.launches.filter((r) => r.status === "sending")) {
    try {
      const s = await settleSending(row, { rpc, nowMs, quotes: quotes.listed });
      log(s.unproved ? `::error title=Launcher::${s.note}.` : `Launcher: ${s.note}.`);
      if (s.changed) { replaceRow(ledger, s.row); out.changed = true; }
    } catch (e) { log(`::warning title=Launcher::could not settle ${row.ticker} yet (${scrub(e.message)}); the send phase tries again.`); }
  }
  if (out.changed) saveLedger(io, ledger);
  const ctx = selectionContext(io, ledger, nowMs, { env, quotes, log });

  if (mode === "on" && !inFlight(ledger).length) {
    // 2. A failed row that may be tried again takes the next turn, with the same post (so the same mint).
    const again = ledger.launches.find((r) => r.status === "failed" && r.retry && r.attempts < MAX_ATTEMPTS);
    if (again) {
      const next = { ...again };
      for (const k of ["tx", "mintPublic", "lastValidBlockHeight", "settledAt", "retry"]) delete next[k];
      // A trending post is tried again only while it is fresh; a sanctuary cat's own post has no age limit.
      if (tooOld(again, ctx.trending, nowMs)) {
        replaceRow(ledger, { ...again, retry: false, reason: `${again.reason} (not tried again: the post is older than ${MAX_POST_AGE_HOURS} hours)`.slice(0, 300) });
      } else {
        next.status = "prepared";
        replaceRow(ledger, next);
        log(`Launcher: ${again.ticker} is prepared again (attempt ${again.attempts + 1} of ${MAX_ATTEMPTS}; last time: ${again.reason}).`);
      }
      out.changed = true;
    }
  }

  // 3. The prepared row's metadata file, written if it is missing (a crash between the two writes). Its coin
  //    picture follows data/photo-hide.json until it is sent (then it is fixed for good).
  for (const row of ledger.launches.filter((r) => r.status === "prepared")) {
    const coinImage = coinImageFor(row, ctx.photoHide);
    if (mode === "on" && coinImage !== coinImageOf(row)) {
      replaceRow(ledger, { ...row, coinImage });
      out.changed = true;
      log(`Launcher: ${row.ticker}'s coin picture is now ${coinImage === SITE_IMAGE ? "the site's own (its post's photo is hidden in data/photo-hide.json)" : "its post's photo"}.`);
    }
  }
  // A sanctuary cat not sent yet follows its card: its lore line and kind as it would be prepared now (its metadata is
  // rewritten below and deployed before the send). One that may not launch any more is left to the send's check.
  for (const row of ledger.launches.filter((r) => r.status === "prepared" && r.policy === "sanctuary")) {
    const fresh = mode === "on" ? ownRowNow(row, ctx) : null;
    if (fresh && (fresh.lore !== row.lore || fresh.kind !== row.kind)) {
      replaceRow(ledger, { ...row, lore: fresh.lore, kind: fresh.kind });
      out.changed = true;
      log(`Launcher: ${row.ticker}'s lore line is now "${fresh.lore}" (its card changed since it was prepared).`);
    }
  }
  for (const row of ledger.launches.filter((r) => r.status === "prepared")) {
    const text = metadataText(coinMetadata(row));
    if (io.readText(row.metadataPath) !== text) { io.writeText(row.metadataPath, text); out.changed = true; }
  }

  // 3b. A sanctuary cat prepared but not sent (waiting on pump.fun's list, the deploy, the funds) gives way to a trending
  //     cat the rules let launch now: failed with a retry and no attempt used, it is prepared again once the slot is free.
  const held = inFlight(ledger);
  if (mode === "on" && held.length === 1 && held[0].policy === "sanctuary" && held[0].status === "prepared") {
    const waited = (nowMs - Date.parse(held[0].preparedAt)) / HOUR_MS;
    const room = collectionRoom(ctx);
    if (dayStats(ledger, nowMs, caps).count < caps.maxPerDay && room !== null && room >= 1 && selectCandidate(ctx).row) {
      replaceRow(ledger, { ...held[0], status: "failed", retry: true, reason: "gave way to a trending cat; prepared again once the slot is free", settledAt: ISO_SECONDS(nowMs) });
      out.changed = true;
      log(`Launcher: ${held[0].ticker} (a sanctuary cat, not sent yet) gives way to a trending cat; it is prepared again once the slot is free.`);
    } else if (waited > OWN_WAIT_ALERT_HOURS) {
      log(`::error title=Launcher::${held[0].ticker} has waited ${Math.round(waited)} hours to be sent (see the send step's warnings: pump.fun's list, the deploy, the funds).`);
    }
  }

  // 4. Nothing in flight: at most one new cat, while the day's count and the Collection's room allow it.
  if (!inFlight(ledger).length) {
    const stats = dayStats(ledger, nowMs, caps);
    const room = collectionRoom(ctx);
    if (stats.count >= caps.maxPerDay) log(`Launcher: ${stats.count} launch(es) in the last 24 hours; LAUNCH_MAX_PER_DAY is ${caps.maxPerDay}, so no new cat now.`);
    else if (room === null || room < 1) {
      log(`::warning title=Launcher::${room === null ? `${FILES.collection} or ${FILES.planned} cannot be read` : `${FILES.collection} is near its ${MAX_CATS} cats (the Collection's hard cap, past which it proves nothing new), with room kept for the planned cats and ${COLLECTION_MARGIN} more`}; no new cat is prepared.`);
    } else {
      let pick = selectCandidate(ctx);
      for (const s of pick.skipped) log(`Launcher: post ${s.id} skipped: ${s.why}.`);
      if (!pick.row && stats.count + 1 >= caps.maxPerDay) log(`Launcher: no trending cat to launch now; the day's last launch (LAUNCH_MAX_PER_DAY ${caps.maxPerDay}) is kept for one.`);
      else if (!pick.row) {
        // No trending cat: the sanctuary's own cat the announcer posted last that has no coin yet (never the day's last slot).
        log("Launcher: no trending cat to launch now; looking at the sanctuary's cats posted on X.");
        pick = selectSanctuary(ctx);
        const why = new Map();
        for (const s of pick.skipped) why.set(s.why, [...(why.get(s.why) ?? []), s.id]);
        for (const [w, ids] of why) log(`Launcher: ${ids.length} posted cat(s) skipped (${w}): ${ids.slice(0, 12).join(", ")}${ids.length > 12 ? ", …" : ""}.`);
      }
      if (!pick.row) log("Launcher: no cat to launch now.");
      else if (mode === "dry") {
        log(`Launcher (dry run): would prepare ${pick.row.coinName} (${pick.row.ticker}) from ${pick.row.url} (${pick.row.policy}), ${whereText(pick.row, pick.route)}; nothing written.`);
        out.pending = true;
      } else {
        io.writeText(pick.row.metadataPath, metadataText(coinMetadata(pick.row)));
        ledger.launches.unshift(pick.row);
        out.changed = true;
        out.prepared = pick.row.postId;
        log(`Launcher: prepared ${pick.row.coinName} (${pick.row.ticker}) from ${pick.row.url} (${pick.row.policy}), ${whereText(pick.row, pick.route)}; its metadata is ${metadataUri(pick.row.postId)}.`);
      }
    }
  }

  if (out.changed) saveLedger(io, ledger);

  // 5. Photos the owner hid (data/photo-hide.json) leave their cards; one no longer hidden comes back.
  if (mode === "on") {
    const photos = readOwned(io, FILES.realPhotos, null, log);    // unreadable: left as it is (a warning), never a stop
    const { photos: next, hid, restored } = isObj(photos) ? applyPhotoHide(photos, ctx.photoHide) : { hid: [], restored: [] };
    if (hid.length || restored.length) {
      io.writeText(FILES.realPhotos, json2(next));
      out.photos = [...hid, ...restored];
      out.deploy = true;
      if (hid.length) log(`Launcher: the photo of ${hid.join(", ")} is hidden (data/photo-hide.json): off ${hid.length === 1 ? "its card" : "their cards"} from the next deploy.`);
      if (restored.length) log(`Launcher: the photo of ${restored.join(", ")} is no longer hidden: back on ${restored.length === 1 ? "its card" : "their cards"} from the next deploy.`);
    }
  }

  const prepared = ledger.launches.find((r) => r.status === "prepared");
  if (prepared && mode === "on") {
    const unserved = !(await metadataServed({ fetchImpl, uri: metadataUri(prepared.postId), text: metadataText(coinMetadata(prepared)), bust: nowMs }));
    out.deploy ||= unserved;
    if (unserved) log(`Launcher: ${metadataUri(prepared.postId)} is not served yet; the site is to be deployed.`);
  }
  out.pending ||= inFlight(ledger).length > 0 || ledger.launches.some((r) => r.status === "launched" && !r.recordedAt);
  return out;
}

/** Pages of 1,000 wallet signatures past the rewards ledger's cursor the earmark lists at most: more, and the launch waits (the Rewards workflow counts them, a few thousand a run). */
export const EARMARK_MAX_PAGES = 50;
/** How long the earmark may spend reading the transactions past the cursor: longer, and the launch waits until the Rewards workflow has counted them. */
export const EARMARK_MS = 5 * 60_000;

/**
 * THE $CATSANC HOLDERS' SOL, which a launch must leave alone (scripts/lib/rewards.mjs, the holder
 * rewards): the wallet keeps the creator fees it claims for the holders until the Rewards workflow pays
 * them out. max(0, E − P − F) (the holders' share of every settled claim, less what was paid and the
 * payout fees), plus what each transaction the ledger has not settled for them yet claimed (measured
 * as the Rewards workflow will: pump-fees.mjs measureClaim, so a deposit or a refund is never held):
 * each claim it lists as still sending and, whenever the ledger has a cursor (whatever REWARDS_ENABLED
 * says: a stranger's claim while rewards are dry or off is the holders' too), each successful wallet
 * transaction newer than the cursor that it does not list. Only when neither rewards file exists and
 * REWARDS_ENABLED is off is there nothing to hold. Returns { lamports (BigInt), problem }: a ledger that
 * is missing (while data/rewards/state.json exists, or rewards are on or dry) or does not validate, a
 * read that fails, more than EARMARK_MAX_PAGES pages past the cursor, or more than EARMARK_MS spent
 * reading them is a problem, and then the launch waits (fail closed: the holders' SOL cannot be told
 * apart).
 */
export async function rewardsEarmark({ io, rpc, wallet, env = {}, now = Date.now }) {
  const text = io.readText(REWARDS_FILES.ledger);
  if (text === null || text === undefined) {
    const state = io.readText(REWARDS_FILES.state);
    const hasState = state !== null && state !== undefined, mode = rewardsMode(env);
    if (!hasState && mode === "off") return { lamports: 0n, problem: null };
    return { lamports: 0n, problem: `${REWARDS_FILES.ledger} is missing while ${hasState ? `${REWARDS_FILES.state} is there` : `REWARDS_ENABLED is ${mode}`}` };
  }
  let L;
  try { L = validateRewardsLedger(JSON.parse(text.replace(/^\uFEFF/, ""))); } catch (e) { return { lamports: 0n, problem: `${REWARDS_FILES.ledger} does not read (${String(e?.message ?? e).slice(0, 200)})` }; }
  const sending = L.claims.filter((r) => r.status === "sending").map((r) => r.sig);
  let sigs = sending;
  try {
    if (L.cursor) {
      const list = [];
      let before;
      for (let page = 0; ; page++) {
        if (page >= EARMARK_MAX_PAGES) return { lamports: 0n, problem: `more than ${EARMARK_MAX_PAGES * 1000} wallet transactions since the rewards ledger's cursor (the Rewards workflow is counting them)` };
        const got = await rpc.getSignaturesForAddress(wallet, { until: L.cursor, limit: 1000, commitment: "confirmed", ...(before ? { before } : {}) });
        if (!Array.isArray(got)) return { lamports: 0n, problem: "the wallet's history could not be read for the holders' earmark" };
        list.push(...got);
        if (got.length < 1000) break;
        before = got[got.length - 1].signature;
      }
      sigs = [...new Set([...earmarkSignatures(L, list.filter((s) => s && !s.err).map((s) => s.signature)), ...sending])];
    }
    const started = now();
    const deltas = [];
    for (const sig of sigs) {
      if (now() - started > EARMARK_MS) return { lamports: 0n, problem: `${sigs.length} wallet transactions since the rewards ledger's cursor take too long to read (the Rewards workflow is counting them)` };
      const tx = await rpc.getTransaction(sig, { commitment: "confirmed" });
      if (!tx) {
        if (sending.includes(sig)) continue;                  // a claim not landed yet: nothing of it is in the balance
        return { lamports: 0n, problem: `the wallet's transaction ${sig.slice(0, 12)}… could not be read for the holders' earmark` };
      }
      // What it claimed, as the Rewards workflow will count it (a deposit or a refund claims nothing).
      try { deltas.push(measureClaim(tx, { wallet }).claimed); continue; } catch { /* not readable as a claim: whatever it brought in is held (fail closed) */ }
      const keys = [...(tx.transaction?.message?.accountKeys ?? []), ...(tx.meta?.loadedAddresses?.writable ?? []), ...(tx.meta?.loadedAddresses?.readonly ?? [])];
      const i = keys.indexOf(wallet);
      if (i < 0) continue;
      const pre = tx.meta?.preBalances?.[i], post = tx.meta?.postBalances?.[i];
      if (!Number.isSafeInteger(pre) || !Number.isSafeInteger(post)) return { lamports: 0n, problem: `the wallet's transaction ${sig.slice(0, 12)}… gave no balances` };
      deltas.push(BigInt(post) - BigInt(pre));
    }
    const lamports = earmarkLamports(L, deltas);
    if (lamports > BigInt(Number.MAX_SAFE_INTEGER)) return { lamports, problem: "the holders' earmark is past what a balance can hold" };
    return { lamports, problem: null };
  } catch (e) {
    return { lamports: 0n, problem: `the holders' earmark could not be read (${String(e?.message ?? e).slice(0, 160)})` };
  }
}

/** Simulation errors that say nothing about the launch (the RPC node's view of the chain lagged): the row stays prepared and uses no attempt; the next run simulates again (within the post's 48 hours). */
export const TRANSIENT_SIMULATION = Object.freeze(["BlockhashNotFound", "AccountInUse"]);
/** A send refused as a copy of a transaction the chain already has: it went out. */
const ALREADY_PROCESSED = /already (?:been )?processed/i;
/**
 * The JSON-RPC error codes that prove a sendTransaction was never accepted: -32002
 * (SendTransactionPreflightFailure: the node simulated it and refused it before forwarding it) and
 * -32602 (invalid params: the transaction could not be decoded or sanitized). Nothing else is a refusal.
 */
export const REFUSAL_CODES = Object.freeze([-32002, -32602]);
/** Whether a sendTransaction error proves nothing went out: a REFUSAL_CODES answer to the first and only post, not "already processed". */
export function isRefusal(e) {
  return e instanceof RpcError && REFUSAL_CODES.includes(e.code) && e.posts === 1 && !ALREADY_PROCESSED.test(String(e.message));
}
/** A serialized transaction's message (base64 in, base64 out): what its signatures sign. */
function messageOf(base64) {
  const bytes = Buffer.from(base64, "base64");
  const { value: n, size } = decodeCompactU16(bytes, 0);
  return bytes.subarray(size + 64 * n).toString("base64");
}
/** The later of two times (YYYY-MM-DDTHH:MM:SSZ), either of which may be missing. */
const laterTime = (a, b) => [a, b].filter(isTime).sort((x, y) => Date.parse(y) - Date.parse(x))[0];

/**
 * SEND (the key). Returns { mode, outcome, launched, code }: code 1 when a person must look (the
 * wallet is not listed, the metadata file was edited, the RPC failed, a sent launch is not proved),
 * else 0. The launch is SIMULATED UNSIGNED (every signature slot zero-filled, sigVerify false) and
 * signed only once the simulation, the caps, the dry-mode stop and the wallet's listing have all
 * passed, right before it is written "sending" and sent: nothing signed ever leaves the runner but
 * through sendTransaction, in "on" mode.
 */
export async function send({ io, env = {}, rpc, fetchImpl, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {},
  metadataWaitMs = METADATA_WAIT_MS, metadataPollMs = METADATA_POLL_MS, confirmWaitMs = CONFIRM_WAIT_MS, confirmPollMs = CONFIRM_POLL_MS, scrub = (t) => t }) {
  const mode = launchMode(env);
  const out = { mode, outcome: "nothing", launched: false, code: 0 };
  if (mode === "off") { log("Launcher: off (LAUNCH_ENABLED is neither on nor dry); nothing done."); out.outcome = "off"; return out; }
  const wallet = walletFromEnv(env.LAUNCH_WALLET_KEY);
  const nowMs = now();
  const walletsFile = readJson(io, FILES.wallets, { launchers: [] });
  const unlisted = walletProblem(wallet.publicKey, walletsFile, nowMs);
  if (unlisted) {
    log(`::error title=Launcher::${unlisted}. Nothing was sent.`);
    for (const line of walletInstructions(wallet.publicKey, nowMs)) log(line);
    return { ...out, outcome: "wallet_not_listed", code: 1 };
  }
  const caps = launchCaps(env);
  for (const n of caps.notes) log(`::warning title=Launcher::${n}`);
  const ledger = validateLedger(readJson(io, FILES.ledger, null));
  const quotes = quotesOf(io, log);

  // 1. Rows sent earlier.
  let settledAny = false, unproved = false;
  for (const row of ledger.launches.filter((r) => r.status === "sending")) {
    const s = await settleSending(row, { rpc, nowMs, quotes: quotes.listed });
    log(s.unproved ? `::error title=Launcher::${s.note}.` : `Launcher: ${s.note}.`);
    if (s.unproved) unproved = true;
    if (s.changed) { replaceRow(ledger, s.row); settledAny = true; if (s.row.status === "launched") out.launched = true; }
  }
  if (settledAny) saveLedger(io, ledger);
  if (ledger.launches.some((r) => r.status === "sending")) {
    out.outcome = unproved ? "unproved" : "sending";
    if (unproved) out.code = 1;
    return out;
  }

  // 2. The prepared row (in dry mode with none, the cat prepare would pick, in memory only).
  const ctx = selectionContext(io, ledger, nowMs, { env, quotes, log });
  let row = ledger.launches.find((r) => r.status === "prepared") ?? null;
  const virtual = !row && mode === "dry";
  if (virtual) {
    const count = dayStats(ledger, nowMs, caps).count;
    if (count < caps.maxPerDay) row = selectCandidate(ctx).row ?? (count + 1 < caps.maxPerDay ? selectSanctuary(ctx).row : null);
  }
  if (!row) { log("Launcher: nothing prepared to send."); return out; }
  let venue = venueById(row.venue);
  const dry = mode === "dry" ? "(dry run) " : "";
  // A prepared row that cannot go out (dry mode writes nothing).
  const fail = (reason, retry, extra = {}) => {
    const next = { ...row, ...extra, status: "failed", reason: String(reason).slice(0, 300), retry, settledAt: ISO_SECONDS(now()) };
    if (mode === "on" && !virtual) { replaceRow(ledger, next); saveLedger(io, ledger); }
    row = next;
  };

  // 3. Is the post launched on chain already (a launch never recorded, by this wallet or by one of the
  //    launcher's earlier wallets, or an address someone else took)?
  const mint = deriveMintKeypair(wallet, row.postId);
  const prepared = Date.parse(row.preparedAt);
  const others = otherLauncherWallets(walletsFile, wallet.publicKey, { sinceMs: (Number.isFinite(prepared) ? prepared : nowMs) - HOUR_MS, nowMs });
  const found = await mintOnChain({ rpc, venue, wallet: wallet.publicKey, mint: mint.publicKey, row, others, quotes: quotes.listed });
  if (found.state === "launched") {
    log(`Launcher: ${dry}${row.ticker} is on chain already (${found.proof.launch.tx.slice(0, 12)}…, ${found.venue.label}${found.wallet !== wallet.publicKey ? `, sent by the launcher wallet ${found.wallet}` : ""}): recorded as launched.`);
    if (mode === "on") {
      // Recorded on the venue it launched on (a fallback whose "sending" commit was lost launched on pump.fun in SOL), priced in the pair it proved.
      const moved = found.venue !== venue ? { venue: found.venue.id, cat: { ...row.cat, pair: { symbol: found.proof.launch.pair.symbol, mint: found.proof.launch.pair.mint } },
        ...(found.venue === PUMP_SOL ? { fallback: row.fallback ?? `${row.venue}: recovered on chain as a launch on pump.fun in SOL` } : {}) } : {};
      // Its time in the rolling 24 hours is its own block time (a sentAt left from an earlier, failed attempt would drop it from the day's count early).
      const done = { ...row, ...moved, status: "launched", tx: found.proof.launch.tx, mintPublic: found.proof.launch.mint, spentLamports: (row.spentLamports ?? 0) + spentOf(found.tx),
        settledAt: ISO_SECONDS(now()), launchedAt: found.proof.launch.time, sentAt: laterTime(row.sentAt, found.proof.launch.time), attempts: Math.max(1, row.attempts) };
      delete done.retry; delete done.reason; delete done.lastValidBlockHeight;
      if (found.venue !== PUMP_SOL) delete done.fallback;
      replaceRow(ledger, done); saveLedger(io, ledger);
      out.launched = true;
    }
    return { ...out, outcome: "recovered" };
  }
  if (found.state === "foreign") { log(`::warning title=Launcher::${row.ticker}: ${found.detail}; it is never sent.`); fail(found.detail, false); return { ...out, outcome: "foreign" }; }
  if (found.state === "unknown") { log(`::error title=Launcher::${row.ticker}: ${found.detail}. Nothing was sent; a person must look.`); return { ...out, outcome: "unknown", code: 1 }; }

  // 4. Too old now? (A sanctuary cat's own post has no age limit; the cat must still be free: no coin since it was prepared.)
  if (tooOld(row, ctx.trending, nowMs)) {
    log(`Launcher: ${row.ticker}'s post is older than ${MAX_POST_AGE_HOURS} hours now; it is not launched.`);
    fail(`the post is older than ${MAX_POST_AGE_HOURS} hours`, false);
    return { ...out, outcome: "stale" };
  }
  if (row.policy === "sanctuary" && !Array.isArray(ctx.adoptions?.adoptions)) {
    log(`::warning title=Launcher::${row.ticker} waits: ${FILES.adoptions} cannot be read; nothing was sent.`);
    return { ...out, outcome: "adoption_unchecked" };
  }
  const taken = row.policy === "sanctuary" ? ownProblemNow(row, ctx) : null;
  if (taken) {
    log(`::warning title=Launcher::${row.ticker} is not launched: ${taken}.`);
    fail(taken, false);
    return { ...out, outcome: "taken" };
  }
  // Its card changed since it was prepared (a new lore line, a death marked): the prepare phase rewrites its metadata first.
  const fresh = row.policy === "sanctuary" && !virtual ? ownRowNow(row, ctx) : null;
  if (fresh && (fresh.lore !== row.lore || fresh.kind !== row.kind)) {
    log(`Launcher: ${row.ticker} waits: its card changed since it was prepared; the prepare phase rewrites its metadata, then it is sent.`);
    return { ...out, outcome: "card_changed" };
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

  // 6. The day's count, then build and simulate UNSIGNED.
  const stats = dayStats(ledger, nowMs, caps);
  if (stats.count >= caps.maxPerDay) { log(`Launcher: ${stats.count} launch(es) in the last 24 hours (LAUNCH_MAX_PER_DAY ${caps.maxPerDay}); ${row.ticker} waits.`); return { ...out, outcome: "cap" }; }
  const balance = await rpc.getBalance(wallet.publicKey);
  if (!Number.isSafeInteger(balance)) throw new LaunchError("the RPC gave no balance for the wallet");
  // The $CATSANC holders' SOL (the creator fees claimed for them, not paid out yet) is never the launcher's to spend:
  // every check below sees only what is left of the balance without it.
  const held = await rewardsEarmark({ io, rpc, wallet: wallet.publicKey, env, now });
  if (held.problem) {
    log(`::warning title=Launcher::${scrub(held.problem)}: the holders' SOL cannot be told apart from the launcher's, so ${row.ticker} waits.`);
    return { ...out, outcome: "earmark" };
  }
  const earmark = Number(held.lamports);
  const free = balance - earmark;
  if (earmark > 0) log(`Launcher: ${sol(earmark)} of the wallet's ${sol(balance)} belongs to the $CATSANC holders (${REWARDS_FILES.ledger}); a launch may use only the other ${sol(Math.max(0, free))}.`);
  if (free <= caps.minBalanceLamports) {
    log(`::warning title=Launcher::the wallet holds ${sol(balance)}${earmark > 0 ? `, ${sol(earmark)} of it the holders'` : ""}: ${sol(free)} is at or under LAUNCH_MIN_BALANCE_SOL (${sol(caps.minBalanceLamports)}); ${row.ticker} waits until it is funded.`);
    return { ...out, outcome: "cap" };
  }
  // A sanctuary cat: adopted on pump.fun since the trend watch's last scan? Read live, the last thing before the build and the signature.
  if (row.policy === "sanctuary") {
    const kit = kitsOf({ planned: ctx.planned ?? { cats: [] }, adoptables: ctx.adoptables ?? { cats: [] } }).find((k) => k.key === row.ticker);
    const scan = Date.parse(readOwned(io, FILES.pumpScan, null, log)?.fresh?.coveredUntil ?? "");
    const owners = new Set((walletsFile.launchers ?? []).map((w) => w?.address).filter(Boolean));
    const live = !kit ? { unchecked: "the cat has no kit to compare" } : !Number.isFinite(scan) ? { unchecked: `${FILES.pumpScan} gives no pump.fun coverage mark (fresh.coveredUntil) yet` }
      : await kitLaunchedSince({ fetchImpl, sleep, kit, sinceMs: Math.max(Date.parse(KITS_LIVE), scan - PUMP_CHECK_MARGIN_MS), owners });
    if (live.taken?.length) {
      const why = `a coin with its kit's name and ticker was launched on pump.fun (${live.taken[0]}): a visitor's adoption`;
      log(`::warning title=Launcher::${row.ticker} is not launched: ${why}.`);
      fail(why, false);
      return { ...out, outcome: "taken" };
    }
    if (live.unchecked) {
      log(`::warning title=Launcher::${dry}${row.ticker} waits: ${live.unchecked}; nothing was sent, the next run tries again.`);
      return { ...out, outcome: "adoption_unchecked" };
    }
  }
  const bh = await rpc.getLatestBlockhash();
  if (!bh?.blockhash || !Number.isSafeInteger(bh.lastValidBlockHeight)) throw new LaunchError("the RPC gave no blockhash");
  /**
   * Build `r` on its venue and simulate it UNSIGNED (the venue's sign-time checks run first; its
   * signature slots are zero-filled): { venue, built, unsigned, simProblem, transient, loss }.
   * Throws what the venue's build or checks refuse.
   */
  const attempt = async (r) => {
    const v = venueById(r.venue);
    const built = await v.build({ wallet: wallet.publicKey, mint: mint.publicKey, name: r.coinName, symbol: r.ticker, uri, pair: r.cat.pair, recentBlockhash: bh.blockhash,
      computeUnitPriceMicroLamports: caps.priorityMicroLamports }, { fetchImpl, rpc, nowMs: now(), quotes: ctx.pumpQuotes, pumpQuoteOptIn: ctx.pumpQuoteOptIn });
    const unsigned = v.unsigned(built);
    const sim = await rpc.simulateTransaction(unsigned, { addresses: [wallet.publicKey] });
    const after = sim?.accounts?.[0]?.lamports;
    const simProblem = !sim ? "no answer" : sim.err !== null ? errText(sim.err) : !Number.isSafeInteger(after) ? "no balance after it" : null;
    const transient = !!simProblem && (!sim || (typeof sim.err === "string" && TRANSIENT_SIMULATION.includes(sim.err)));
    return { venue: v, built, unsigned, simProblem, transient, loss: simProblem ? null : balance - after + feeUpperBound(unsigned) };
  };
  // A StonkFun or coin-priced launch that fails at any step before it is sent goes out on pump.fun in SOL
  // for this run instead: its pair taken since it was prepared (one cat per pair), StonkFun's pricing or
  // config, the opt-in or the coin's listing, the build, the signing checks, the simulation, or a cost over
  // the per-launch cap. Never after a send: from "sending" on, a row keeps its venue. A simulation the RPC
  // node could not run (TRANSIENT_SIMULATION) is no failure of the venue's: the row waits for the next run.
  const planned = row;
  let tried = null;
  if (venue !== PUMP_SOL) {
    let why = null;
    try {
      why = pairProblemNow(row, ctx);
      if (!why) {
        tried = await attempt(row);
        why = tried.transient ? null : tried.simProblem ? `the simulation did not pass (${tried.simProblem})`
          : tried.loss > caps.maxLamportsPerLaunch ? `it would cost ${sol(tried.loss)}, more than LAUNCH_MAX_SOL_PER_LAUNCH (${sol(caps.maxLamportsPerLaunch)})` : null;
      }
    } catch (e) { why = scrub(String(e?.message ?? e)).slice(0, 200); }
    if (why) {
      log(`::warning title=Launcher::${dry}${row.ticker}: ${venue.label} failed before anything was sent (${why}); it launches on pump.fun in SOL this run.`);
      row = { ...row, venue: PUMP_SOL.id, cat: { ...row.cat, pair: { ...SOL_PAIR } }, fallback: `${venue.id}: ${why}`.slice(0, 300) };
      venue = PUMP_SOL;
      tried = null;
    }
  }
  tried ??= await attempt(row);
  if (tried.simProblem) {
    const why = tried.simProblem;
    if (tried.transient) {
      // Nothing about the launch: the row stays prepared (on its own venue), no attempt used; bounded by the post's age.
      log(`::warning title=Launcher::${dry}${row.ticker}: the simulation could not be run (${why}: the RPC node's view of the chain, not the launch); nothing was sent and no attempt is used; the next run tries again.`);
      return { ...out, outcome: "simulation_failed" };
    }
    log(`::warning title=Launcher::${dry}${row.ticker}: the simulation did not pass (${why}); nothing was sent.`);
    // A fallback holds for this run only: the row keeps the venue it was prepared on, for its next try.
    row = planned;
    fail(`the simulation did not pass${venue !== venueById(planned.venue) ? " on pump.fun in SOL, after its own venue failed" : ""}: ${why}`, true, { attempts: Math.min(MAX_ATTEMPTS, row.attempts + 1) });
    return { ...out, outcome: "simulation_failed" };
  }
  const loss = tried.loss;
  const capped = capProblem({ stats, caps, lossLamports: loss, balanceLamports: free });
  const figures = `about ${sol(loss)} (cap ${sol(caps.maxLamportsPerLaunch)}), the last 24 hours ${sol(stats.lamports)} of ${sol(caps.maxLamportsPerDay)}, balance ${sol(balance)}${earmark > 0 ? ` (${sol(earmark)} of it the holders')` : ""} (floor ${sol(caps.minBalanceLamports)})`;
  if (capped) { log(`Launcher: ${dry}${row.ticker} is not sent: ${capped}.`); return { ...out, outcome: "cap" }; }
  if (mode === "dry") {
    log(`Launcher (dry run): ${row.coinName} (${row.ticker}) from ${row.url} simulates cleanly ${whereText(row)}: ${figures}. Nothing was signed or sent.`);
    return { ...out, outcome: "dry", venue: row.venue };
  }

  // 7. The wallet must still be an active launcher now (the metadata wait above may have taken minutes):
  //    a launch sent after its "until" could never be proved.
  const late = walletProblem(wallet.publicKey, walletsFile, now());
  if (late) {
    log(`::error title=Launcher::${late} now. Nothing was sent.`);
    return { ...out, outcome: "wallet_not_listed", code: 1 };
  }

  // 8. Signed only now, the very message simulated; written "sending" BEFORE it goes out (the workflow commits it even if what follows fails).
  const signed = tried.venue.sign(tried.built, wallet, mint);
  if (messageOf(signed) !== messageOf(tried.unsigned)) throw new LaunchError("the signed launch is not the transaction that was simulated; nothing was sent");
  const signature = signatureOf(signed);
  row = { ...row, status: "sending", tx: signature, sentAt: ISO_SECONDS(now()), lastValidBlockHeight: bh.lastValidBlockHeight, attempts: row.attempts + 1 };
  for (const k of ["retry", "reason", "settledAt", "mintPublic"]) delete row[k];
  replaceRow(ledger, row); saveLedger(io, ledger);
  try {
    const sig = await rpc.sendTransaction(signed);
    if (sig !== signature) log(`::warning title=Launcher::the RPC named the transaction ${String(sig).slice(0, 12)}…, not ${signature.slice(0, 12)}…`);
  } catch (e) {
    const why = scrub(String(e?.message ?? e));                    // what reaches the log and the ledger (committed) never carries a secret
    // A refusal is ONLY a definite preflight or validation failure (REFUSAL_CODES) the node answered to the FIRST and only
    // post of the transaction: it was never accepted, so nothing went out. Any other error (an internal error, say: the
    // node may have forwarded it before failing), an error answered to a repeated post (the first may have gone out before
    // its answer was lost), one saying the chain already has it, or no answer at all is no refusal: the row stays
    // "sending" with its tx and lastValidBlockHeight and is settled by a chain check (its signature, or its blockhash's expiry).
    if (isRefusal(e)) {
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
  log(`Launcher: sent ${row.coinName} (${row.ticker}) ${whereText(row)}: https://solscan.io/tx/${signature} (${figures}).`);

  // 9. Confirm (bounded); an unsettled row is settled by a later run.
  const deadline = now() + confirmWaitMs;
  for (let tries = Math.max(1, Math.floor(confirmWaitMs / confirmPollMs)); ; tries--) {
    await sleep(confirmPollMs);
    const s = await settleSending(row, { rpc, nowMs: now(), quotes: quotes.listed });
    if (s.changed) {
      replaceRow(ledger, s.row); saveLedger(io, ledger);
      log(`Launcher: ${s.note}.`);
      if (s.row.status === "launched") { out.launched = true; log(`Launcher: ${s.row.coinName} (${s.row.ticker}) is launched: its mint is ${s.row.mintPublic}.`); }
      return { ...out, outcome: s.row.status };
    }
    if (tries <= 1 || now() + confirmPollMs > deadline) {
      // Landed but still not proved when the wait ends (an answer with no block time yet, say): kept "sending", a person told.
      if (s.unproved) { log(`::error title=Launcher::${s.note}.`); return { ...out, outcome: "unproved", code: 1 }; }
      log(`Launcher: ${s.note}; a later run settles it.`);
      return { ...out, outcome: "sending" };
    }
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
    launches: readJson(io, FILES.launches, { launches: [] }),
    collection: readJson(io, FILES.collection, { cats: [] }),
    photos: readJson(io, FILES.realPhotos, { cats: {} }),
    meshy: readJson(io, FILES.meshy, { cats: {} }),
    photoHide: photoHideOf(io, log),                            // edited by hand: unreadable, nothing hidden (a warning)
    watch: readOwned(io, FILES.watch, null, log),                 // edited by hand: unreadable, left as it is (a warning)
  };
  const before = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v instanceof Set ? null : JSON.stringify(v)]));
  const plannedTickers = new Set((files.planned.cats ?? []).map((c) => c.ticker));
  const proved = new Set((files.collection.cats ?? []).map((c) => c.tx));
  for (const row of todo) {
    const venue = venueById(row.venue);
    const T = row.ticker;
    const launch = { mint: row.mintPublic, tx: row.tx, launchpad: venue.launchpad, at: row.launchedAt };
    // The cat, with its launch (the whole file must still validate).
    const cats = files.adoptables.cats ?? [];
    const existing = cats.find((c) => c.ticker === T || c.id === row.cat.id);
    const own = row.policy === "sanctuary";
    // A sanctuary cat is in the file already: its own row takes the launch, priced in the pair it launched in.
    if (own && existing && existing.id === row.cat.id && existing.ticker === T && !existing.launch
      && nameKey(existing.coinName || existing.name) === nameKey(row.coinName) && (existing.launchTicker || existing.ticker) === T) {
      const next = { ...files.adoptables, cats: cats.map((c) => (c === existing ? { ...existing, pair: { ...row.cat.pair }, launch } : c)) };
      const v = validateAdoptables(next, { taken: plannedTickers });
      if (v.refused.length) {
        const p = `${T}: data/adoptables.json would not validate (${v.refused.map((x) => x.detail).join("; ").slice(0, 200)}); nothing was recorded for it`;
        out.problems.push(p); log(`::error title=Launcher::${p}`); continue;
      }
      files.adoptables = next;
    } else if (own && !(existing?.launch?.mint === launch.mint && existing?.launch?.tx === launch.tx)) {
      const p = `${T}: the sanctuary cat ${row.cat.id} is not in data/adoptables.json as it was (its row, coin name or ticker), or has another coin; ${row.coinName} was launched (${row.tx.slice(0, 12)}…) but is not recorded: a person must add it`;
      out.problems.push(p); log(`::error title=Launcher::${p}`); continue;
    }
    if (!own && existing && !(existing.launch?.mint === launch.mint && existing.launch?.tx === launch.tx)) {
      const p = `${T}: the adoptable ticker or id is taken by another cat; ${row.coinName} was launched (${row.tx.slice(0, 12)}…) but is not in the sanctuary: a person must add it`;
      out.problems.push(p); log(`::error title=Launcher::${p}`); continue;
    }
    if (!own && !existing) {
      const next = { ...files.adoptables, cats: [...cats, { ...row.cat, launch }] };
      const v = validateAdoptables(next, { taken: plannedTickers });
      if (v.refused.length) {
        const p = `${T}: data/adoptables.json would not validate (${v.refused.map((x) => x.detail).join("; ").slice(0, 200)}); nothing was recorded for it`;
        out.problems.push(p); log(`::error title=Launcher::${p}`); continue;
      }
      files.adoptables = next;
    }
    // Held from the announcer by its own rule (scripts/announce.mjs holds every cat with a `launch`: its X post is
    // scripts/post-updates.mjs's launch post). data/announced.json is the Announce workflow's alone: never written here.
    // Listed for the Collection, which proves it first (proved rows of the launcher's are dropped: the list holds at most 200).
    const rows = (files.launches.launches ?? []).filter((l) => !(typeof l.note === "string" && l.note.startsWith("Sanctuary launcher:") && proved.has(l.tx)));
    if (!rows.some((l) => l.tx === row.tx) && !proved.has(row.tx)) rows.push({ tx: row.tx, note: `Sanctuary launcher: ${T}` });
    if (rows.length <= 200) files.launches = { ...files.launches, launches: rows };
    else log(`::warning title=Launcher::data/launches.json holds 200 rows; ${T}'s launch is left to the Collection's wallet scan.`);
    // A 3D model of its own, from the post's picture (a sanctuary cat has its model, its portrait and its card already).
    files.meshy.cats ??= {};
    if (!own && !files.meshy.cats[T]) {
      const order = Math.max(0, ...Object.values(files.meshy.cats).map((q) => (Number.isFinite(q?.order) ? q.order : 0))) + 1;
      const look = row.cat.look.startsWith(`${row.cat.name}, drawn from the picture`) ? DEFAULT_REFERENCE : row.cat.look;
      files.meshy.cats[T] = { action: "rebuild", priority: 1, why: "A trending cat the sanctuary launched: it has no model of its own yet (the garden draws the shared model in its coat).",
        styleImage: row.image, referencePrompt: look, order };
    }
    // Its real photo, hotlinked from the post (never copied) and credited to its author on the card, unless the owner
    // ruled it out (`none`) or hides the post (data/photo-hide.json: then it waits in `hidden`, and the card keeps its portrait).
    files.photos.cats ??= {};
    const photo = photoOfRow(row);
    if (!own && !(T in files.photos.cats) && !(T in (files.photos.none ?? {})) && !(T in (files.photos.hidden ?? {})) && realPhotoOf(photo)) {
      const entry = { realPhoto: photo, source: "proof" };
      if (files.photoHide.has(row.postId)) files.photos = { ...files.photos, hidden: { ...(files.photos.hidden ?? {}), [T]: { postId: row.postId, entry } } };
      else files.photos.cats[T] = entry;
    }
    replaceRow(ledger, { ...row, recordedAt: ISO_SECONDS(nowMs) });
    out.recorded.push(T);
    log(`Launcher: ${row.name} (${T}), launched ${whereText(row)}, ${own ? "has its coin on its card" : "moves into the sanctuary"}; its X post ("launched by the sanctuary on ${venue.announceAs}") waits for the Collection to prove ${row.tx.slice(0, 12)}….`);
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
  const write = [["adoptables", FILES.adoptables, json2], ["launches", FILES.launches, json2], ["photos", FILES.realPhotos, json2], ["meshy", FILES.meshy, json1], ["watch", FILES.watch, watchText]];
  for (const [k, rel, fmt] of write) if (JSON.stringify(files[k]) !== before[k]) io.writeText(rel, fmt(files[k]));
  if (out.recorded.length) saveLedger(io, ledger);
  return out;
}
