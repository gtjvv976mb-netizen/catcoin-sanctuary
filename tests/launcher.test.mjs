/* The sanctuary's automatic launcher (scripts/lib/launcher.mjs, scripts/launch.mjs, scripts/lib/venues.mjs):
   who it launches (the owner's policy and every exclusion), the caps and the balance floor on the
   simulated balance, dry mode, the metadata it hosts and waits for, the ledger (never the mint before
   the send), every crash point (the same post always gives the same mint, so a retry can never make
   a second coin), moving a launched cat into the sanctuary (adoptables, launches.json, the 3D-model
   queue, its real photo, the watch list) and its one X post, and the key never reaching a log line.
   No network and no real key: throwaway keys from crypto.randomBytes, a fake Solana and a fake site. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { ROOT, DATA_NOW, recordedAccounts } from "./helpers.mjs";
import { base58Encode, base58Decode, validateCollection, validateWallets, isAddress, SOL_PAIR, STOCK_PAIRS, validatePumpQuotes, MAX_CATS } from "../assets/collection.js";
import { adoptableProblem, validateAdoptables, realPhotoOf, ADOPTABLE_CATEGORIES } from "../assets/ui/adoptables.js";
import { coatProblem } from "../assets/collection.js";
import { keypairFromSecret, deriveMintKeypair, isMintNonce, transactionToJson, decodeTransaction, decompileInstructions } from "../scripts/lib/solana-tx.mjs";
import { decodeCreateV2, PUMP } from "../scripts/lib/pump.mjs";
import { proveLaunchPump, proveLaunch, TOKEN_2022_PROGRAM, SYSTEM_PROGRAM, LAUNCHLAB_PROGRAM } from "../scripts/lib/chain.mjs";
import { PRICING_URL, DEXSCREENER_TOKENS_URL, WRAPPED_SOL_MINT } from "../scripts/lib/launchlab.mjs";
import { VENUE_IDS } from "../scripts/lib/venues-routing.mjs";
import { createRpc } from "../scripts/lib/rpc.mjs";
import { venueById, venueIds, chooseVenue, registerVenue, PUMP_SOL, STONKFUN, PUMP_QUOTE } from "../scripts/lib/venues.mjs";
import {
  prepare, send, record, launchMode, launchCaps, pumpQuoteOptIn, pairedLaunches, routeOf, walletFromEnv, policyOf, selectCandidate, candidateRow, pendingPairs, validateLedger, ledgerText, rowProblem,
  coinMetadata, metadataText, metadataUri, metadataPath, dayStats, capProblem, approvalsOf, namingsOf, withNaming, openLaunches, figuresAtHome, watchText, signatureOf, feeUpperBound, takenNames, collectionRoom,
  otherLauncherWallets, walletInstructions, FILES, LEDGER_NOTE, DEFAULT_CAPS, MAX_ATTEMPTS, SITE_ORIGIN, X_ACCOUNT, LAMPORTS_PER_SOL, CAP_RANGES, COLLECTION_MARGIN, TRANSIENT_SIMULATION, readOwned,
  descriptionOf, DESCRIPTION_MAX, photoCredit, coinImageFor, photoHideOf, applyPhotoHide, SITE_IMAGE, postIdOf, rewardsEarmark,
  sanctuaryRow, selectSanctuary, loreLinesOf, kindOfAdoptable, OWN_HANDLE, SITE_PICTURE, ownProblemNow, kitLaunchedSince, pumpSearchSince, SEARCH_LEADERS, unreadWindows, DIED, OWN_WAIT_ALERT_HOURS,
} from "../scripts/lib/launcher.mjs";
import * as R from "../scripts/lib/rewards.mjs";
import { creatorVault, EVENT_IX_TAG, EVENT_DISC } from "../scripts/lib/pump-fees.mjs";
import { main, fsStore, scrubber } from "../scripts/launch.mjs";
import { draftLaunch, checkUpdate, ADDRESS_LIKE, FAN_TRIBUTE, fanTribute, run as postUpdates } from "../scripts/post-updates.mjs";
import { weightedLength, LIMIT } from "../scripts/announce.mjs";
import { cardLink, SITE, listCats, holdSanctuaryCats, provedCollection, sanctuaryCoins, run as announce } from "../scripts/announce.mjs";
import { loadResidents } from "../assets/residents.js";
import { buildAdoptables } from "../scripts/build-adoptables.mjs";
import { normalize, isLaunched } from "../assets/ui/data.js";

/* ── fixtures ─────────────────────────────────────────────────────────────────────────── */

// Before DATA_NOW, so the page's own validation (which uses the real clock) accepts the launch's time.
const NOW = Date.parse("2026-09-25T17:00:00Z");
const HOUR = 3_600_000;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const readRoot = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
/* The watch list the runs use: made-up figures, so no launch the real launcher makes (which moves a figure from
   data/cat-watch.json into data/adoptables.json) can ever change what these tests see. */
const FIGURE = { name: "Sir Gloopington", aliases: ["Gloopington"], kind: "meme", ticker: "GLOOP", category: "viral",
  look: "A real grey tabby cat with a round face, long white whiskers and a very serious stare.", coat: { base: "grey", second: "", pattern: "tabby", eyes: "green" } };
const WATCH = { note: "test", topAccounts: ["someaccount"], bigAccounts: ["otheraccount"], figures: [FIGURE, { name: "Plinko Cat", aliases: [], kind: "cartoon", ticker: "PLINKO" }] };
const RPC_URL = "https://rpc.example.test/v1/?api-key=RPCKEY9f8e7d6c5b4a";
/* The routes: the figure tied to a stock pair no planned cat has (tOpenAI: StonkFun's recorded pricing answer is for it), or to a
   made-up coin (MEOW) a test lists in data/pump-quotes.json. */
const STOCK = (({ symbol, mint }) => Object.freeze({ symbol, mint }))(STOCK_PAIRS.find((s) => s.symbol === "tOpenAI"));
const MEOW = Object.freeze({ symbol: "MEOW", mint: "MEoWkY1hD4n8vUe8vNQ4yLzVz9Hq1zVQf7mH3ZcVb2p", tokenProgram: TOKEN_2022_PROGRAM });
const MEOW_PAIR = Object.freeze({ symbol: MEOW.symbol, mint: MEOW.mint });
const QUOTES = validatePumpQuotes({ quotes: [MEOW] }).quotes;
const WATCH_TIED = { ...WATCH, figures: [{ ...FIGURE, stock: STOCK.symbol }, WATCH.figures[1]] };
const WATCH_COIN = { ...WATCH, figures: [{ ...FIGURE, pumpQuote: MEOW_PAIR }, WATCH.figures[1]] };
const PRICING = JSON.parse(readRoot("tests/fixtures/stonkfun-pricing.json"));

/** A throwaway wallet: its keypair and its secret as base58 (64 bytes), a JSON array (64) and the seed as a JSON array (32). */
function throwaway() {
  const seed = randomBytes(32);
  const kp = keypairFromSecret(Uint8Array.from(seed));
  const full = Buffer.concat([seed, Buffer.from(kp.publicKeyBytes)]);
  return { kp, address: kp.publicKey, base58: base58Encode(full), json64: JSON.stringify([...full]), json32: JSON.stringify([...seed]), seedHex: seed.toString("hex"), seedB58: base58Encode(seed) };
}

/** A trend-watch post in data/trending-cats.json's shape. Defaults: a watch-list figure (Sir Gloopington, of the test watch list), 2 hours old, read by Claude. */
function post(id, { h = 2, name = "Sir Gloopington", coin = name, ticker = "GLOOP", kind = "cartoon", nameFrom = "figure", figure = "Sir Gloopington", big = null, sensitive = false,
  known = false, media = true, lore = "Gloopington stares down the camera from the top of the fridge.", readBy = "claude", author = "floppafan", text = null, aboutOneCat = true } = {}) {
  return {
    id: String(id), url: `https://x.com/${author}/status/${id}`, text: text ?? `${name} is back on top of the fridge and everyone loves it today`,
    author: { handle: author, name: "A Fan", followers: 1200 }, postedAt: iso(NOW - h * HOUR), likes: 30_000, views: 2_000_000, reposts: 90, heat: 900,
    media: media ? [{ type: "photo", url: `https://pbs.twimg.com/media/Gx${id}.jpg` }] : [], stage: "viral", lens: nameFrom === "figure" ? "figures" : "viral",
    ...(figure ? { figure } : {}), ...(big ? { bigAccount: big } : {}), readAt: iso(NOW),
    reading: { aboutOneCat, catName: name, kind, coinName: coin, ticker, lore, sensitive, why: "a test post", readBy, ...(nameFrom ? { nameFrom } : {}) },
    known, taken: [], status: "candidate",
  };
}
const trendingOf = (posts) => ({ note: "test", candidates: posts.map((p) => p.id), posts });

/*
 * The fixtures' cat names and tickers are made up, but the real launcher moves trending cats into data/adoptables.json
 * (and their tickers into the 3D-model queue, the real photos, data/collection.json) for good, and one could carry a
 * fixture's name. The tests read the shipped data through fixtureFree, which leaves such a cat out, so what they assert
 * never depends on what the launcher has launched (they are the Launch workflow's own gate).
 */
const FIXTURE_NAMES = new Set(["sir gloopington", "gloopington", "gloop", "bramblewick", "bramble", "plinko cat", "plinko", "quillbert", "quill", "moon kitty", "moonk",
  "fresht", "other cat", "othercat", "zzz"]);
const fixtureNamed = (...names) => names.some((k) => typeof k === "string" && FIXTURE_NAMES.has(k.trim().toLowerCase()));
/** A shipped file's contents with every cat, entry or key named like a fixture left out (the file as it is otherwise). */
function fixtureFree(rel, v) {
  const byTicker = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => !fixtureNamed(k)));
  if (rel === FILES.adoptables) return { ...v, cats: v.cats.filter((c) => !fixtureNamed(c?.name, c?.coinName, c?.ticker, c?.launchTicker, c?.id)) };
  if (rel === FILES.collection) return { ...v, cats: v.cats.filter((e) => !fixtureNamed(e?.name, e?.symbol)) };
  if ([FILES.meshy, FILES.realPhotos, FILES.announced].includes(rel)) return { ...v, cats: byTicker(v.cats) };
  return v;
}
/** A shipped data file, parsed, as the tests read it (fixtureFree). */
const shipped = (rel) => fixtureFree(rel, JSON.parse(readRoot(rel)));

/** A throwaway copy of the site's data (every data file, the 3D-model queue) with the launcher's wallet listed, and these trending posts. */
function site({ posts = [post("2100000000000000001")], wallet = null, approve = [], listWallet = true, ledger = null, watch = WATCH, quotes = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "launcher-"));
  fs.cpSync(path.join(ROOT, "data"), path.join(root, "data"), { recursive: true });
  // No $CATSANC holder rewards (data/rewards: the live ledger's holders' SOL would change what the wallet may spend); a test writes its own.
  fs.rmSync(path.join(root, "data/rewards"), { recursive: true, force: true });
  fs.mkdirSync(path.join(root, "scripts"));
  fs.copyFileSync(path.join(ROOT, "scripts/meshy.queue.json"), path.join(root, "scripts/meshy.queue.json"));
  // No shipped cat named like a fixture (a file is rewritten, in its own layout, only when one is there).
  for (const [rel, fmt] of [[FILES.adoptables, 2], [FILES.collection, 2], [FILES.realPhotos, 2], [FILES.announced, 2], [FILES.meshy, 1]]) {
    const file = path.join(root, rel), v = JSON.parse(fs.readFileSync(file, "utf8")), kept = fixtureFree(rel, v);
    if (JSON.stringify(kept) !== JSON.stringify(v)) fs.writeFileSync(file, `${JSON.stringify(kept, null, fmt)}\n`);
  }
  const w = (rel, v) => fs.writeFileSync(path.join(root, rel), typeof v === "string" ? v : `${JSON.stringify(v, null, 2)}\n`);
  w("data/trending-cats.json", trendingOf(posts));
  w("data/launch-approvals.json", { note: "test", approve });
  // The owner's own hide list is left out: a test hides what it means to (and the shipped list may hide a live cat's photo).
  w(FILES.photoHide, { note: "test", hide: [] });
  w("data/sanctuary-launches.json", ledger ?? { note: LEDGER_NOTE, launches: [] });
  w("data/cat-watch.json", watchText(watch));
  if (quotes) w("data/pump-quotes.json", { note: "test", quotes });
  if (wallet && listWallet) {
    const ws = JSON.parse(readRoot("data/wallets.json"));
    ws.launchers.push({ address: wallet, since: "2026-09-01", label: "Auto launcher" });
    w("data/wallets.json", ws);
  }
  const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
  return { root, io: fsStore(root), read, json: (rel) => JSON.parse(read(rel)), exists: (rel) => fs.existsSync(path.join(root, rel)) };
}

/**
 * A fake Solana (a JSON-RPC endpoint): balances, blockhashes, a simulation that costs `loss`, and a send that lands the
 * transaction (finalized, block time `time`) unless told otherwise: land "never" (it is dropped), "error" (it fails on
 * chain), `refuse` (preflight refuses it), `drop` (the connection fails every time); `simErrOnce` and `lossOnce` change
 * the next simulation only; `time` is the block time a transaction lands with; `noTime` answers that many getTransaction
 * calls with no block time (as an RPC may, just after finalization). Every call is recorded, every simulated transaction kept.
 */
function fakeSolana({ wallet, balance = 200_000_000, loss = 5_600_000, lastValid = 1150, height = 1000, time = NOW } = {}) {
  const s = { balance, loss, lastValid, height, time, land: "finalize", refuse: null, drop: false, simErr: null, simErrOnce: null, lossOnce: null, onSend: null, noTime: 0 };
  const calls = [], txs = new Map(), statuses = new Map(), accounts = new Map(), history = new Map(), sent = [], simulated = [];
  async function fetchImpl(url, init) {
    const { id, method, params } = JSON.parse(init.body);
    calls.push({ method, params });
    const ok = (result) => new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), { status: 200 });
    const ctx = { slot: 450_000_000 };
    switch (method) {
      case "getBalance": return ok({ context: ctx, value: s.balance });
      case "getLatestBlockhash": return ok({ context: ctx, value: { blockhash: base58Encode(randomBytes(32)), lastValidBlockHeight: s.lastValid } });
      case "getBlockHeight": return ok(s.height);
      case "simulateTransaction": {
        simulated.push(params[0]);
        const simErr = s.simErr ?? s.simErrOnce, simLoss = s.lossOnce ?? s.loss;
        s.simErrOnce = null; s.lossOnce = null;
        return ok({ context: ctx, value: simErr ? { err: simErr, logs: [], accounts: [null] }
          : { err: null, logs: [], unitsConsumed: 100_529, accounts: [{ lamports: s.balance - simLoss, owner: SYSTEM_PROGRAM, data: ["", "base64"], executable: false, rentEpoch: 0 }] } });
      }
      case "sendTransaction": {
        if (s.drop) throw new TypeError("fetch failed");
        if (s.refuse) return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32002, message: s.refuse } }), { status: 200 });
        const bytes = Buffer.from(params[0], "base64");
        const json = transactionToJson(new Uint8Array(bytes));
        const sig = json.transaction.signatures[0];
        s.onSend?.(sig);
        sent.push({ sig, json });
        if (s.land === "never") return ok(sig);
        const failed = s.land === "error";
        const pre = s.balance, post = failed ? s.balance - 25_000 : s.balance - s.loss;
        txs.set(sig, { ...json, slot: 450_000_001, blockTime: Math.floor(s.time / 1000),
          meta: { err: failed ? { InstructionError: [2, { Custom: 6000 }] } : null, status: failed ? { Err: {} } : { Ok: null }, fee: 25_000,
            preBalances: [pre, ...json.transaction.message.accountKeys.slice(1).map(() => 0)], postBalances: [post, ...json.transaction.message.accountKeys.slice(1).map(() => 0)],
            innerInstructions: [], logMessages: [] } });
        statuses.set(sig, { slot: 450_000_001, confirmations: null, err: failed ? { InstructionError: [2, { Custom: 6000 }] } : null, confirmationStatus: "finalized" });
        s.balance = post;
        // The payer's own history (newest first) lists every transaction it paid for, landed or failed.
        const payer = json.transaction.message.accountKeys[0];
        history.set(payer, [{ signature: sig, err: failed ? { InstructionError: [2, { Custom: 6000 }] } : null, blockTime: Math.floor(s.time / 1000), slot: 450_000_001 }, ...(history.get(payer) ?? [])]);
        if (!failed) {
          const mint = json.transaction.message.accountKeys[1];
          accounts.set(mint, { owner: TOKEN_2022_PROGRAM, lamports: 2_702_560, data: ["", "base64"], executable: false, rentEpoch: 0 });
          history.set(mint, [{ signature: sig, err: null, blockTime: Math.floor(s.time / 1000), slot: 450_000_001 }, ...(history.get(mint) ?? [])]);
        }
        return ok(sig);
      }
      case "getSignatureStatuses": return ok({ context: ctx, value: params[0].map((x) => statuses.get(x) ?? null) });
      case "getTransaction": {
        const tx = structuredClone(txs.get(params[0]) ?? null);
        if (tx && s.noTime > 0) { tx.blockTime = null; s.noTime--; }
        return ok(tx);
      }
      case "getMultipleAccounts": return ok({ context: ctx, value: params[0].map((a) => accounts.get(a) ?? null) });
      case "getSignaturesForAddress": {                        // newest first, a page of `limit` after `before`, as a real node pages
        const list = history.get(params[0]) ?? [], { before, limit = 1000 } = params[1] ?? {};
        const from = before ? list.findIndex((x) => x.signature === before) + 1 : 0;
        return ok(before && from === 0 ? [] : structuredClone(list.slice(from, from + limit)));
      }
      default: return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }), { status: 200 });
    }
  }
  const rpc = createRpc({ url: "https://rpc.example.test", fetchImpl, delayMs: 0, backoffMs: 0, retries: 1 });
  return { s, calls, sent, simulated, txs, accounts, history, fetchImpl, rpc, methods: () => calls.map((c) => c.method) };
}

/** The site as GitHub Pages serves it once `deployed` (the files of `root`), and every URL asked. */
function fakeSite(root) {
  const asked = [];
  const f = { deployed: false, asked };
  f.fetchImpl = async (url) => {
    asked.push(url);
    const u = new URL(url);
    if (u.origin !== SITE_ORIGIN) throw new Error(`unexpected ${url}`);
    const file = path.join(root, u.pathname);
    if (!f.deployed || !fs.existsSync(file)) return new Response("not found", { status: 404 });
    return new Response(fs.readFileSync(file), { status: 200 });
  };
  return f;
}

/** A clock that sleep moves on. */
function clock(start = NOW) {
  const c = { t: start };
  c.now = () => c.t;
  c.sleep = async (ms) => { c.t += ms; };
  return c;
}

// (no mint suffix in these tests: a scan for "pump" takes minutes; the scan has its own tests below)
const ON = (w, extra = {}) => ({ LAUNCH_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58, LAUNCH_MINT_SUFFIX: "none", LAUNCH_CHARACTERS: "on", LAUNCH_PAIRS: "on", ...extra });
/** Whether a serialized transaction (base64) carries only zero-filled signature slots. */
const unsignedTx = (b64) => decodeTransaction(new Uint8Array(Buffer.from(b64, "base64"))).signatures.every((x) => x.every((b) => b === 0));
const quick = { metadataWaitMs: 60_000, metadataPollMs: 20_000, confirmWaitMs: 30_000, confirmPollMs: 3_000 };

/** The residents the page shows for a throwaway site (assets/residents.js, then assets/ui/data.js), its warnings silenced. */
async function pageOf(t) {
  const localFetch = async (url) => { try { return new Response(fs.readFileSync(new URL(url).pathname), { status: 200 }); } catch { return new Response("", { status: 404 }); } };
  const warn = console.warn; console.warn = () => {};
  try { return (await loadResidents({ base: new URL(`file://${t.root}/`), nowMs: DATA_NOW, fetchImpl: localFetch })).map(normalize).filter(Boolean); } finally { console.warn = warn; }
}

/** The launch post scripts/post-updates.mjs sends for a throwaway site a day on (its gaps cleared, a fake X), or null. */
async function launchPostOf(t) {
  const X = { X_API_KEY: "k", X_API_SECRET: "s", X_ACCESS_TOKEN: "t", X_ACCESS_SECRET: "a" };
  fs.writeFileSync(path.join(t.root, "data/announce-config.json"), JSON.stringify({ dryRun: false }));
  fs.writeFileSync(path.join(t.root, "data/updates.json"), JSON.stringify({ ...t.json("data/updates.json"), lastPostedAt: null }));
  fs.writeFileSync(path.join(t.root, "data/announced.json"), JSON.stringify({ cats: Object.fromEntries(Object.entries(t.json("data/announced.json").cats).map(([k, v]) => [k, { ...v, at: undefined }])) }));
  fs.writeFileSync(path.join(t.root, "data/release-queue.json"), JSON.stringify({ ...t.json("data/release-queue.json"), lastReleaseAt: null }));
  const tweets = [];
  const xFetch = async (url, init) => {
    if (url === "https://api.x.com/2/tweets") { tweets.push(JSON.parse(init.body).text); return new Response(JSON.stringify({ data: { id: String(900 + tweets.length) } }), { status: 201 }); }
    return new Response(JSON.stringify({ data: { id: "m1" } }), { status: 200 });
  };
  const r = await postUpdates({ root: t.root, env: X, fetchImpl: xFetch, now: () => new Date(Math.max(Date.now(), NOW) + 24 * HOUR), log: () => {} });
  return r.posted?.kind === "launch" ? tweets.at(-1) : null;
}

/** One Announce run (scripts/announce.mjs) for a throwaway site, posting to a fake X a day on: { summary, tweets }. */
async function announceOf(t) {
  const X = { X_API_KEY: "k", X_API_SECRET: "s", X_ACCESS_TOKEN: "t", X_ACCESS_SECRET: "a" };
  fs.writeFileSync(path.join(t.root, "data/announce-config.json"), JSON.stringify({ dryRun: false, spacingMinutes: 0 }));
  const tweets = [];
  const xFetch = async (url, init) => {
    if (url === "https://api.x.com/2/tweets") { tweets.push(JSON.parse(init.body).text); return new Response(JSON.stringify({ data: { id: String(900 + tweets.length) } }), { status: 201 }); }
    return new Response(JSON.stringify({ data: { id: "m1" } }), { status: 200 });
  };
  const summary = await announce({ root: t.root, env: X, fetchImpl: xFetch, now: () => new Date(Math.max(Date.now(), NOW) + 24 * HOUR), sleep: async () => {}, log: () => {} });
  return { summary, tweets };
}

/** prepare, deploy the site, send, record: one launch, as the workflow runs it. */
async function launchOnce(t, { env, sol, web, c = clock(), log = () => {} }) {
  const p = await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, log });
  web.deployed = true;
  const s = await send({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, log, ...quick });
  const r = record({ io: t.io, env, now: c.now, log });
  return { p, s, r };
}

/* ── configuration ────────────────────────────────────────────────────────────────────── */

test("mode: LAUNCH_ENABLED on launches, dry simulates, anything else is off", () => {
  assert.equal(launchMode({ LAUNCH_ENABLED: "on" }), "on");
  assert.equal(launchMode({ LAUNCH_ENABLED: " ON " }), "on", "the workflow's gate compares without letter case");
  assert.equal(launchMode({ LAUNCH_ENABLED: "dry" }), "dry");
  for (const v of [undefined, "", "off", "yes", "true", "1", "onn"]) assert.equal(launchMode({ LAUNCH_ENABLED: v }), "off", String(v));
});

test("caps: safe defaults, numbers read from the variables, clamped into their ranges", () => {
  const d = launchCaps({});
  assert.deepEqual([d.maxPerDay, d.maxLamportsPerLaunch, d.maxLamportsPerDay, d.minBalanceLamports], [3, 30_000_000, 100_000_000, 20_000_000]);
  assert.deepEqual(d.notes, []);
  assert.deepEqual(DEFAULT_CAPS, { maxPerDay: 3, maxSolPerLaunch: 0.03, maxSolPerDay: 0.1, minBalanceSol: 0.02 });
  const c = launchCaps({ LAUNCH_MAX_PER_DAY: "5", LAUNCH_MAX_SOL_PER_LAUNCH: "0.01", LAUNCH_MAX_SOL_PER_DAY: "0.05", LAUNCH_MIN_BALANCE_SOL: "0.5" });
  assert.deepEqual([c.maxPerDay, c.maxLamportsPerLaunch, c.maxLamportsPerDay, c.minBalanceLamports], [5, 10_000_000, 50_000_000, 500_000_000]);
  const big = launchCaps({ LAUNCH_MAX_PER_DAY: "500", LAUNCH_MAX_SOL_PER_LAUNCH: "7", LAUNCH_MAX_SOL_PER_DAY: "99", LAUNCH_MIN_BALANCE_SOL: "0" });
  assert.deepEqual([big.maxPerDay, big.maxLamportsPerLaunch, big.maxLamportsPerDay, big.minBalanceLamports],
    [CAP_RANGES.maxPerDay[1], CAP_RANGES.maxSolPerLaunch[1] * LAMPORTS_PER_SOL, CAP_RANGES.maxSolPerDay[1] * LAMPORTS_PER_SOL, CAP_RANGES.minBalanceSol[0] * LAMPORTS_PER_SOL]);
  assert.equal(big.notes.length, 4);
  const junk = launchCaps({ LAUNCH_MAX_PER_DAY: "lots", LAUNCH_MAX_SOL_PER_LAUNCH: "0x10" });
  assert.equal(junk.maxPerDay, 3);
  assert.equal(junk.maxLamportsPerLaunch, CAP_RANGES.maxSolPerLaunch[1] * LAMPORTS_PER_SOL, "0x10 is a number (16), clamped");
  assert.ok(junk.notes.some((n) => /LAUNCH_MAX_PER_DAY is not a number/.test(n)));
  assert.equal(launchCaps({ LAUNCH_MAX_PER_DAY: "2.9" }).maxPerDay, 2);
});

test("the wallet key: 64 bytes as base58 or JSON, or the 32-byte seed as JSON; nothing else, and no error quotes it", () => {
  const w = throwaway();
  for (const v of [w.base58, ` ${w.base58}\n`, w.json64, w.json32]) assert.equal(walletFromEnv(v).publicKey, w.address);
  const refused = [undefined, "", "   ", w.address, w.seedB58, "[1,2,3]", `[${w.json32.slice(1, -1)},999]`, "[not json", w.base58.slice(0, -2) + "11", JSON.stringify(new Array(32).fill(0))];
  for (const v of refused) {
    let err;
    try { walletFromEnv(v); } catch (e) { err = e; }
    assert.ok(err, String(v).slice(0, 12));
    for (const secret of [w.base58, w.seedHex, w.seedB58, w.json64.slice(1, 40)]) assert.ok(!err.message.includes(secret), "an error quotes the key");
  }
});

/* ── who launches ─────────────────────────────────────────────────────────────────────── */

test("policy: watch-list cats launch on their own (a listed figure; a cartoon or fiction cat a trend named or a big account posted); the rest wait for the owner", () => {
  const ctx = { approvals: new Set(), watch: WATCH };
  assert.equal(policyOf(post("2100000000000000001"), ctx), "figure");
  assert.equal(policyOf(post("2100000000000000002", { figure: "Not On The List" }), ctx), null, "a figure no longer on the watch list");
  assert.equal(policyOf(post("2100000000000000003", { nameFrom: "trend", figure: null }), ctx), "trend");
  assert.equal(policyOf(post("2100000000000000004", { nameFrom: "trend", figure: null, kind: "fiction" }), ctx), "trend");
  assert.equal(policyOf(post("2100000000000000005", { nameFrom: null, figure: null, big: "netflix" }), ctx), "big-account");
  assert.equal(policyOf(post("2100000000000000006", { nameFrom: "trend", figure: null, kind: "real" }), ctx), null, "a real cat a trend named is someone's pet");
  assert.equal(policyOf(post("2100000000000000007", { nameFrom: null, figure: null, kind: "real", big: "netflix" }), ctx), null, "a big account's own pet waits too");
  assert.equal(policyOf(post("2100000000000000008", { nameFrom: "emerging", figure: null }), ctx), null, "a name the rules picked up");
  assert.equal(policyOf(post("2100000000000000009", { nameFrom: null, figure: null }), ctx), null, "a cartoon cat with no watch-list reason");
  assert.equal(policyOf(post("2100000000000000009", { nameFrom: null, figure: null }), { ...ctx, approvals: new Set(["2100000000000000009"]) }), "approved");
  assert.deepEqual([...approvalsOf({ approve: ["2100000000000000009", " 21000000000000000010 ", "abc", 12, null] })], ["2100000000000000009", "21000000000000000010"]);
});

test("selection: newest post first, and every exclusion (sensitive, known, not a watch-list cat, too old, no picture, taken names, the ledger, content rules)", () => {
  const adoptables = shipped(FILES.adoptables), planned = JSON.parse(readRoot("data/planned.json"));
  const taken = adoptables.cats[0];
  const posts = [
    post("2100000000000000101", { h: 0.5, sensitive: true }),
    post("2100000000000000102", { h: 1, known: true }),
    post("2100000000000000103", { h: 1.5, name: "Quillbert", ticker: "QUILL", kind: "real", nameFrom: null, figure: null, readBy: "rules" }),
    post("2100000000000000104", { h: 2, media: false }),
    post("2100000000000000105", { h: 2.5, name: taken.name, ticker: "FRESHT" }),
    post("2100000000000000106", { h: 3, name: "Moon Kitty", ticker: "MOONK", nameFrom: "trend", figure: null }),
    post("2100000000000000107", { h: 3.5, lore: "Loved by @someone on the timeline today." }),
    post("2100000000000000108", { h: 4, aboutOneCat: false }),
    post("2100000000000000109", { h: 49 }),
    post("2100000000000000110", { h: 5, name: "Bramblewick", ticker: "BRAMBLE", nameFrom: "trend", figure: null, lore: "Bramblewick rides a skateboard across the kitchen floor." }),
    post("2100000000000000111", { h: 6 }),
  ];
  const ctx = { nowMs: NOW, approvals: new Set(), watch: WATCH, ledger: { launches: [] }, adoptables, planned, trending: trendingOf(posts) };
  const pick = selectCandidate(ctx);
  assert.equal(pick.row.postId, "2100000000000000110", "the newest post that passes every rule");
  const why = Object.fromEntries(pick.skipped.map((s) => [s.id, s.why]));
  assert.match(why["2100000000000000101"], /sensitive/);
  assert.match(why["2100000000000000102"], /already in the sanctuary/);
  assert.match(why["2100000000000000103"], /waits for the owner/);
  assert.match(why["2100000000000000104"], /no pbs\.twimg\.com picture/);
  assert.match(why["2100000000000000105"], /already a sanctuary cat/);
  assert.match(why["2100000000000000106"], /content rules|held|price/);
  assert.match(why["2100000000000000107"], /mention/);
  assert.match(why["2100000000000000108"], /not about one cat/);
  assert.equal(why["2100000000000000109"], undefined, "not reached: an older post never goes ahead of a newer one that passes");
  assert.equal(candidateRow(posts[8], ctx).problem, "older than 48 hours");
  // The owner's approval lets the real pet through (and nothing else changes).
  const approved = selectCandidate({ ...ctx, approvals: new Set(["2100000000000000103"]) });
  assert.equal(approved.row.postId, "2100000000000000103");
  assert.equal(approved.row.policy, "approved");
  assert.equal(approved.row.cat.category, "viral");
  assert.equal(approved.row.cat.owner, "A Fan", "a person's pet: its owner, as the post names them");
  // Already launched, or in flight: its post id and its names are taken.
  const row = pick.row;
  const again = selectCandidate({ ...ctx, ledger: { launches: [{ ...row, status: "launched" }] } });
  assert.notEqual(again.row?.postId, "2100000000000000110");
  assert.match(Object.fromEntries(again.skipped.map((s) => [s.id, s.why]))["2100000000000000110"], /already in the ledger/);
  const sameName = selectCandidate({ ...ctx, ledger: { launches: [{ ...row, postId: "2100000000000000999", url: "https://x.com/a/status/2100000000000000999", status: "prepared" }] } });
  assert.match(Object.fromEntries(sameName.skipped.map((s) => [s.id, s.why]))["2100000000000000110"], /already a sanctuary cat, or launched/);
  // A duplicate of a watch-list figure's post: the ticker taken by the older one's row.
  const dup = selectCandidate({ ...ctx, trending: trendingOf([posts[10]]), ledger: { launches: [{ ...row, name: "Sir Gloopington", coinName: "Sir Gloopington", ticker: "GLOOP", status: "launched" }] } });
  assert.equal(dup.row, null);
});

test("the owner names a signal (a big account's cat post with no cat's name): it launches under that name, approved; nothing else changes", () => {
  const id = "2100000000000000121";
  const signal = post(id, { name: null, coin: null, ticker: null, lore: null, kind: "none", nameFrom: null, figure: null, big: "NBA", aboutOneCat: false, author: "NBA",
    text: "An adorable surprise for a player at media day today, and the whole team loved it" });
  signal.stage = "big-account"; signal.status = "signal";
  const ctx = { nowMs: NOW, approvals: new Set(), namings: new Map(), watch: WATCH, ledger: { launches: [] }, adoptables: shipped(FILES.adoptables), planned: JSON.parse(readRoot("data/planned.json")),
    trending: { note: "test", candidates: [], posts: [signal] } };
  assert.equal(selectCandidate(ctx).row, null, "a signal is not a candidate");
  const file = { approve: [{ post: `https://x.com/NBA/status/${id}?s=20`, name: "Plinko Cat", ticker: "$plinko" }] };
  assert.deepEqual([...approvalsOf(file)], [id]);
  assert.deepEqual([...namingsOf(file)], [[id, { name: "Plinko Cat", ticker: "PLINKO" }]]);
  const named = selectCandidate({ ...ctx, approvals: approvalsOf(file), namings: namingsOf(file) });
  assert.ok(named.row, JSON.stringify(named.skipped));
  assert.deepEqual([named.row.postId, named.row.name, named.row.coinName, named.row.ticker, named.row.kind, named.row.policy], [id, "Plinko Cat", "Plinko Cat", "PLINKO", "real", "approved"]);
  assert.equal(named.row.lore, "An adorable surprise for a player at media day today, and the whole team loved it", "the post's first sentence");
  // Approved without a name: still waits (the post names no cat).
  assert.match(selectCandidate({ ...ctx, approvals: new Set([id]) }).skipped[0].why, /not about one cat/);
  // A sensitive post stays sensitive, whatever the owner names it.
  const sad = { ...signal, reading: { ...signal.reading, sensitive: true } };
  assert.match(selectCandidate({ ...ctx, trending: { ...ctx.trending, posts: [sad] }, approvals: approvalsOf(file), namings: namingsOf(file) }).skipped[0].why, /sensitive/);
  // Unusable names or tickers give no naming; the kind and lore are the owner's when given.
  assert.equal(namingsOf({ approve: [{ post: id, name: "" }, { post: id, name: "<b>x</b>" }, { post: id, name: "Ok Cat", ticker: "no way!" }, { post: "abc", name: "Ok Cat" }] }).size, 0);
  assert.deepEqual(namingsOf({ approve: [{ post: id, name: "Ok Cat", kind: "cartoon", lore: "  Ok Cat\nwaves.  " }] }).get(id), { name: "Ok Cat", ticker: "OKCAT", kind: "cartoon", lore: "Ok Cat waves." });
  assert.equal(withNaming(signal, null), signal);
});

test("a candidate's row: its venue (pump.fun in SOL), its coin's metadata in pump.fun's shape, and the adoptable row it will get, valid", () => {
  const ctx = { nowMs: NOW, approvals: new Set(), watch: WATCH, ledger: { launches: [] }, adoptables: shipped(FILES.adoptables), planned: JSON.parse(readRoot("data/planned.json")) };
  const p = post("2100000000000000201");
  const { row } = candidateRow(p, ctx);
  assert.equal(rowProblem(row), null);
  assert.equal(row.venue, "pump-sol");
  assert.equal(row.figure, "Sir Gloopington");
  assert.equal(row.metadataPath, "coins/2100000000000000201.json");
  assert.ok(!("mintPublic" in row) && !("tx" in row));
  const meta = coinMetadata(row);
  assert.deepEqual(Object.keys(meta), ["name", "symbol", "description", "image", "showName", "createdOn", "website", "twitter"]);
  assert.deepEqual(meta, {
    name: "Sir Gloopington", symbol: "GLOOP", description: `Gloopington stares down the camera from the top of the fridge. Photo: @floppafan on X. ${FAN_TRIBUTE.character}`,
    image: "https://pbs.twimg.com/media/Gx2100000000000000201.jpg", showName: true, createdOn: "https://catcoinsanctuary.com",
    website: "https://catcoinsanctuary.com/#cat=GLOOP", twitter: "https://x.com/floppafan/status/2100000000000000201",
  });
  assert.equal(metadataUri(row.postId), "https://catcoinsanctuary.com/coins/2100000000000000201.json");
  assert.ok(Buffer.byteLength(metadataUri(row.postId)) <= 200);
  assert.equal(row.kind, "cartoon");
  assert.deepEqual([row.coinImage, row.photoCredit], [row.image, true], "the post's photo is the coin's picture, credited to its author");
  assert.ok(meta.description.endsWith("Unofficial fan tribute from the Catcoin Sanctuary. Not affiliated with or endorsed by the character's owners."));
  assert.ok(checkUpdate(meta.description, ["Sir Gloopington", "Gloopington", FAN_TRIBUTE.character]).ok, "the description passes the content rules (the tribute line a citation)");
  assert.ok(!/https?:|www\.|\$/.test(meta.description));
  // The adoptable: the figure's look, coat and category, a pending portrait, the post as proof, priced in SOL.
  const cat = row.cat;
  assert.equal(adoptableProblem({ ...cat, launch: { mint: "11111111111111111111111111111112", tx: "1".repeat(64), launchpad: "pump.fun", at: "2026-09-25T17:00:00Z" } }), null);
  assert.equal(coatProblem(cat.coat), null);
  assert.deepEqual(cat.pair, { symbol: "SOL", mint: "So11111111111111111111111111111111111111112" });
  assert.equal(cat.look, FIGURE.look);
  assert.deepEqual(cat.coat, FIGURE.coat);
  assert.equal(cat.owner, "its owners");
  assert.equal(cat.tribute, "Fan tribute, not affiliated with or endorsed by its owners.");
  assert.deepEqual([cat.portrait, cat.portraitStatus, cat.proof.url, cat.proof.handle, cat.proof.date], [null, "pending", p.url, "floppafan", "2026-09-25"]);
  assert.ok(ADOPTABLE_CATEGORIES.includes(cat.category));
  // A cartoon cat named by a trend, with no figure: safe defaults that still validate.
  const t = candidateRow(post("2100000000000000202", { name: "Bramblewick", ticker: "BRAMBLE", nameFrom: "trend", figure: null, lore: "Bramblewick rides a skateboard across the kitchen floor." }), ctx);
  assert.equal(adoptableProblem(t.row.cat), null);
  assert.equal(coatProblem(t.row.cat.coat), null);
  assert.deepEqual([t.row.cat.owner, t.row.cat.category, t.row.policy], ["its creators", "tv-movie", "trend"]);
});

test("the X post: the cat's name, one lore line, 'launched by the sanctuary on PumpFun', the card link; no address, no mention, and it passes every rule", () => {
  const cat = { id: "FLOPPA", name: "Big Floppa" };
  const d = draftLaunch(cat, { coinName: "Big Floppa", ticker: "FLOPPA", lore: "Floppa stares down the camera from the top of the fridge.", launchpad: "pump.fun" });
  assert.ok(d.ok, JSON.stringify(d.violations));
  assert.ok(d.text.includes("Big Floppa (FLOPPA), launched by the sanctuary on PumpFun"));
  assert.ok(d.text.includes("📜 Floppa stares down the camera"));
  assert.ok(d.text.includes(cardLink("FLOPPA")));
  assert.equal(cardLink("FLOPPA"), "https://catcoinsanctuary.com/?v=3#cat=FLOPPA");
  assert.ok(!ADDRESS_LIKE.test(d.text) && !/[1-9A-HJ-NP-Za-km-z]{32,44}/.test(d.text), "no base58 address");
  assert.ok(!d.text.includes("@"));
  assert.ok(checkUpdate(d.text, ["Big Floppa", "FLOPPA", cardLink("FLOPPA"), SITE, "PumpFun"]).ok);
  // Refused: a mention or a link in the lore, a name X would turn into a link, an unknown launchpad, an address-like name.
  assert.equal(draftLaunch(cat, { coinName: "Big Floppa", ticker: "FLOPPA", lore: "Loved by @elonmusk today." }).ok, false);
  assert.equal(draftLaunch(cat, { coinName: "Floppa.fun", ticker: "FLOPPA", lore: null }).ok, false);
  assert.equal(draftLaunch(cat, { coinName: "Big Floppa", ticker: "FLOPPA", launchpad: "raydium" }).ok, false);
  assert.equal(draftLaunch({ id: "MOON", name: "Moon Kitty" }, { coinName: "Moon Kitty", ticker: "MOON" }).ok, false, "price talk in a name is never posted");
  const long = "AbcdefghijkmnopqrstuvwxyzABCDEFG";
  assert.equal(long.length, 32);
  assert.equal(draftLaunch({ id: "LONG", name: long }, { coinName: "Long", ticker: "LONG" }).ok, false, "an address-like run of letters");
});

test("the fan-tribute line: every coin's description ends with it, whole; a real pet's names the cat's owners; a long lore is shortened, never the line", () => {
  assert.equal(FAN_TRIBUTE.character, "Unofficial fan tribute from the Catcoin Sanctuary. Not affiliated with or endorsed by the character's owners.");
  assert.equal(FAN_TRIBUTE.real, "Unofficial fan tribute from the Catcoin Sanctuary. Not affiliated with or endorsed by the cat's owners.");
  for (const kind of ["cartoon", "fiction", undefined, null]) assert.equal(fanTribute(kind), FAN_TRIBUTE.character, String(kind));
  assert.equal(fanTribute("real"), FAN_TRIBUTE.real);
  assert.equal(descriptionOf("A cat on a fridge", "cartoon"), `A cat on a fridge. ${FAN_TRIBUTE.character}`);
  assert.equal(descriptionOf("A cat on a fridge!", "real"), `A cat on a fridge! ${FAN_TRIBUTE.real}`);
  // The photo's credit, between the lore and the tribute, only when it fits whole; it goes before the lore is cut.
  const credit = photoCredit("floppafan");
  assert.equal(credit, "Photo: @floppafan on X.");
  assert.equal(descriptionOf("A cat on a fridge", "real", { credit }), `A cat on a fridge. ${credit} ${FAN_TRIBUTE.real}`);
  assert.equal(descriptionOf("A cat on a fridge", "real", { credit, max: 130 }), `A cat on a fridge. ${FAN_TRIBUTE.real}`, "no room: the credit goes, the lore stays");
  // The longest lore the ledger allows (200 characters) fits whole.
  const lore200 = `${"Whiskers ".repeat(22)}naps`.slice(0, 200);
  assert.ok(descriptionOf(lore200, "real").startsWith(lore200) && descriptionOf(lore200, "real").length <= DESCRIPTION_MAX);
  // Over the bound, the lore is cut at a word with "…"; the tribute stays whole and last.
  for (const max of [160, 200, 131]) {
    const d = descriptionOf("Gloopington stares down the camera from the top of the fridge every single morning, then naps on the warm router.", "cartoon", { credit: photoCredit("floppafan"), max });
    assert.ok(d.length <= max, `${d.length} <= ${max}`);
    assert.ok(d.endsWith(` ${FAN_TRIBUTE.character}`), d);
    assert.match(d, /^Gloopington[^…]*… Unofficial/, d);
    assert.ok(!/\s…/.test(d), "cut at a word, no space before the ellipsis");
  }
  assert.equal(descriptionOf("Anything at all", "real", { max: 20 }), FAN_TRIBUTE.real, "no room for any lore: the tribute alone, never cut");
  // Every venue serves the same description (one metadata shape).
  const ctx = { nowMs: NOW, approvals: new Set(["2100000000000000301"]), watch: WATCH, ledger: { launches: [] }, adoptables: shipped(FILES.adoptables), planned: JSON.parse(readRoot("data/planned.json")) };
  const { row } = candidateRow(post("2100000000000000301", { name: "Quillbert", ticker: "QUILL", kind: "real", nameFrom: null, figure: null, lore: "Quillbert sleeps in the salad bowl." }), ctx);
  assert.equal(row.kind, "real");
  for (const v of venueIds()) assert.ok(coinMetadata({ ...row, venue: v }).description.endsWith(FAN_TRIBUTE.real), v);
  assert.equal(coinMetadata(row).description, `Quillbert sleeps in the salad bowl. Photo: @floppafan on X. ${FAN_TRIBUTE.real}`);
  // Only the owner's fixed line is let through: the lore still meets the endorsement rule.
  assert.equal(candidateRow(post("2100000000000000302", { lore: "The official cat of the fridge." }), ctx).row, undefined);
  assert.equal(rowProblem({ ...row, kind: "dog" }), "kind must be one of real, cartoon, fiction");
});

test("the X post carries the fan-tribute line when a version of it fits every rule with the card link (else the post is left as it is)", () => {
  const cat = { id: "MOCHI", name: "Mochi" };
  const d = draftLaunch(cat, { coinName: "Mochi", ticker: "MOCHI", lore: "Naps in a shoe.", tribute: FAN_TRIBUTE.real });
  assert.ok(d.ok, JSON.stringify(d.violations));
  const lines = d.text.split("\n");
  assert.ok(lines.includes(FAN_TRIBUTE.real), d.text);
  assert.equal(lines.at(-2), cardLink("MOCHI"), "the card link kept");
  assert.equal(lines[lines.indexOf(FAN_TRIBUTE.real) - 1], "📜 Naps in a shoe.", "under the lore line");
  assert.ok(weightedLength(d.text) <= LIMIT, `${weightedLength(d.text)} characters`);
  assert.ok(checkUpdate(d.text, ["Mochi", "MOCHI", cardLink("MOCHI"), SITE, "PumpFun", FAN_TRIBUTE.real]).ok);
  // Without a tribute, the post is what it always was.
  const plain = draftLaunch(cat, { coinName: "Mochi", ticker: "MOCHI", lore: "Naps in a shoe." });
  assert.ok(plain.ok && !plain.text.includes("Unofficial") && plain.text.includes("🔍 Its one real mint is on its card"));
  // Room is made as for any long post (fewer extras, then no lore line), never by dropping the card link: even the
  // longest names fit with it. (The line is left out only if no version of the post could carry it.)
  const long = { id: "WHISKERBOT", name: "Princess Whiskerbottom Longname" };
  const lore = "She sleeps on the warm router every afternoon and guards the fridge all night long, loudly.";
  const withT = draftLaunch(long, { coinName: "Whiskerbottom The Magnificent!", ticker: "WHISKERBOT", lore, tribute: FAN_TRIBUTE.character });
  assert.ok(withT.ok && withT.text.includes(FAN_TRIBUTE.character) && withT.text.includes(cardLink("WHISKERBOT")) && weightedLength(withT.text) <= LIMIT, withT.text);
  assert.ok(!draftLaunch(long, { coinName: "Whiskerbottom The Magnificent!", ticker: "WHISKERBOT", lore }).text.includes("Unofficial"), "without the line, the post as it always was");
  // Only the owner's own lines are a tribute.
  assert.equal(draftLaunch(cat, { coinName: "Mochi", ticker: "MOCHI", tribute: "Officially endorsed." }).ok, false);
});

/* ── the phases ───────────────────────────────────────────────────────────────────────── */

test("prepare: one cat, its metadata file and a prepared ledger row with no mint and no tx; the approvals untouched; the site is to be deployed", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address, approve: ["2100000000000000555"] });
  const approvals = t.read(FILES.approvals);
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root);
  const r = await prepare({ io: t.io, env: { LAUNCH_ENABLED: "on", LAUNCH_CHARACTERS: "on", LAUNCH_PAIRS: "on" }, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW });
  assert.deepEqual([r.changed, r.pending, r.deploy, r.prepared], [true, true, true, "2100000000000000001"]);
  assert.equal(t.read(FILES.approvals), approvals, "data/launch-approvals.json is only read");
  const ledger = t.json(FILES.ledger);
  assert.equal(ledgerText(validateLedger(ledger)), t.read(FILES.ledger), "canonical");
  assert.equal(ledger.launches.length, 1);
  const row = ledger.launches[0];
  assert.deepEqual([row.status, row.attempts, row.tx, row.mintPublic], ["prepared", 0, undefined, undefined]);
  assert.equal(t.read("coins/2100000000000000001.json"), metadataText(coinMetadata(row)));
  // The mint is nowhere yet: not in the ledger, not in the metadata file.
  const mint = deriveMintKeypair(w.kp, row.postId).publicKey;
  assert.ok(!t.read(FILES.ledger).includes(mint) && !t.read("coins/2100000000000000001.json").includes(mint));
  assert.ok(!sol.methods().some((m) => /send|simulate/i.test(m)), "prepare never simulates or sends");
  assert.ok(web.asked.every((u) => u.includes("?check=")), "the coin's own uri is never asked before it is deployed");
  // Again: nothing new (one cat in flight at a time).
  const before = t.read(FILES.ledger);
  const r2 = await prepare({ io: t.io, env: { LAUNCH_ENABLED: "on", LAUNCH_CHARACTERS: "on", LAUNCH_PAIRS: "on" }, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW + 60_000 });
  assert.deepEqual([r2.changed, r2.pending], [false, true]);
  assert.equal(t.read(FILES.ledger), before);
  // Deployed: nothing to deploy.
  web.deployed = true;
  assert.equal((await prepare({ io: t.io, env: { LAUNCH_ENABLED: "on", LAUNCH_CHARACTERS: "on", LAUNCH_PAIRS: "on" }, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW })).deploy, false);
  // A crash between the two writes: the metadata file is written again.
  fs.rmSync(path.join(t.root, "coins/2100000000000000001.json"));
  assert.equal((await prepare({ io: t.io, env: { LAUNCH_ENABLED: "on", LAUNCH_CHARACTERS: "on", LAUNCH_PAIRS: "on" }, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW })).changed, true);
  assert.equal(t.read("coins/2100000000000000001.json"), metadataText(coinMetadata(row)));
  // Off: nothing at all.
  const off = await prepare({ io: t.io, env: { LAUNCH_ENABLED: "no" }, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW });
  assert.deepEqual([off.mode, off.changed, off.pending], ["off", false, false]);
});

test("send: waits for the site to serve the committed metadata (bounded); until then nothing is simulated or sent", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  web.asked.length = 0;
  const r = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.equal(r.outcome, "metadata_not_served");
  assert.equal(r.code, 0);
  assert.ok(!sol.methods().some((m) => /sendTransaction|simulateTransaction/.test(m)));
  assert.equal(web.asked.length, 4, "every 20 s for a minute, then it gives up");
  assert.ok(web.asked.every((u) => u.includes("?check=")), "the uri itself is never asked (and never cached as missing) before it is served");
  // Served, but not the committed text (an old deploy, a CDN's copy): still waiting.
  const text = t.read("coins/2100000000000000001.json");
  const stale = async () => new Response(text.replace("Sir Gloopington", "Sir Gloopingtom"), { status: 200 });
  assert.equal((await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: stale, now: c.now, sleep: c.sleep, ...quick })).outcome, "metadata_not_served");
  web.deployed = true;
  // The committed file edited by hand: refused, a person must look.
  fs.writeFileSync(path.join(t.root, "coins/2100000000000000001.json"), text.replace("fridge", "fence"));
  const m = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.deepEqual([m.outcome, m.code], ["metadata_mismatch", 1]);
  assert.ok(!sol.methods().includes("sendTransaction"));
});

test("send: one launch end to end: simulated on the wallet's balance, written \"sending\" before it goes out, sent once, confirmed, the mint recorded only once sent", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  web.deployed = true;
  const mint = deriveMintKeypair(w.kp, "2100000000000000001").publicKey;
  let atSend = null;
  sol.s.onSend = (sig) => { atSend = { sig, ledger: t.read(FILES.ledger) }; };
  const logs = [];
  const r = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, log: (l) => logs.push(l), ...quick });
  assert.deepEqual([r.outcome, r.launched, r.code], ["launched", true, 0]);
  // The simulation: the transaction as sent but UNSIGNED (every signature slot zero-filled), its own blockhash, signatures
  // unchecked, the wallet's account after it. Nothing signed reaches the RPC but through sendTransaction.
  const sim = sol.calls.find((x) => x.method === "simulateTransaction");
  assert.deepEqual(sim.params[1], { encoding: "base64", sigVerify: false, replaceRecentBlockhash: false, commitment: "confirmed", accounts: { encoding: "base64", addresses: [w.address] } });
  const sends = sol.calls.filter((x) => x.method === "sendTransaction");
  assert.equal(sends.length, 1);
  assert.deepEqual(sends[0].params[1], { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 5 });
  const [simTx, sentTx] = [sim, sends[0]].map((x) => decodeTransaction(new Uint8Array(Buffer.from(x.params[0], "base64"))));
  assert.deepEqual(simTx.messageBytes, sentTx.messageBytes, "what was simulated is what was sent");
  assert.ok(unsignedTx(sim.params[0]), "the simulated copy carries no signature");
  assert.ok(sentTx.signatures.every((x) => x.some((b) => b !== 0)), "the sent one is signed");
  // At the moment it went out, the ledger already said "sending", with its signature and no mint.
  const then = JSON.parse(atSend.ledger).launches[0];
  assert.deepEqual([then.status, then.tx, then.mintPublic, then.attempts], ["sending", atSend.sig, undefined, 1]);
  assert.ok(Number.isInteger(then.lastValidBlockHeight) && then.sentAt);
  assert.ok(!atSend.ledger.includes(mint), "the mint is not written before the send");
  // The transaction: the venue's create_v2 for the derived mint, the wallet as payer and creator, nothing bought.
  const { json } = sol.sent[0];
  const proof = proveLaunchPump({ ...sol.txs.get(atSend.sig) }, { wallet: w.address });
  assert.ok(proof.ok, proof.detail);
  assert.equal(proof.launch.mint, mint);
  assert.equal(proof.launch.uri, "https://catcoinsanctuary.com/coins/2100000000000000001.json");
  assert.deepEqual([proof.launch.name, proof.launch.symbol], ["Sir Gloopington", "GLOOP"]);
  assert.ok(!json.transaction.message.accountKeys.some((k) => k === PUMP.program && false));
  // Launched: the mint, the spend from the transaction's own balances, the block time.
  const row = t.json(FILES.ledger).launches[0];
  assert.deepEqual([row.status, row.tx, row.mintPublic, row.spentLamports, row.launchedAt], ["launched", atSend.sig, mint, 5_600_000, iso(NOW)]);
  assert.equal(rowProblem(row), null);
  assert.ok(logs.some((l) => l.includes(`https://solscan.io/tx/${atSend.sig}`)));
  // Again: nothing more is sent.
  const again = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.equal(again.outcome, "nothing");
  assert.equal(sol.calls.filter((x) => x.method === "sendTransaction").length, 1);
});

test("caps and the balance floor, on the simulated balance: per launch, per day, the floor after the launch, and the day's count", async () => {
  const cases = [
    ["per launch", { loss: 31_000_000 }, {}, /LAUNCH_MAX_SOL_PER_LAUNCH/],
    ["the floor", { balance: 24_000_000, loss: 5_600_000 }, {}, /LAUNCH_MIN_BALANCE_SOL/],
    ["an empty wallet", { balance: 15_000_000 }, {}, /at or under LAUNCH_MIN_BALANCE_SOL/],
    ["per day", { loss: 5_600_000 }, { LAUNCH_MAX_SOL_PER_DAY: "0.004" }, /LAUNCH_MAX_SOL_PER_DAY/],
    ["a lower per-launch cap", { loss: 5_600_000 }, { LAUNCH_MAX_SOL_PER_LAUNCH: "0.005" }, /LAUNCH_MAX_SOL_PER_LAUNCH/],
  ];
  for (const [what, chain, env, why] of cases) {
    const w = throwaway();
    const t = site({ wallet: w.address });
    const sol = fakeSolana({ wallet: w.address, ...chain }), web = fakeSite(t.root), c = clock();
    await prepare({ io: t.io, env: ON(w, env), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
    web.deployed = true;
    const logs = [];
    const r = await send({ io: t.io, env: ON(w, env), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, log: (l) => logs.push(l), ...quick });
    assert.equal(r.outcome, "cap", what);
    assert.ok(logs.some((l) => why.test(l)), `${what}: ${logs.join(" | ")}`);
    assert.ok(!sol.methods().includes("sendTransaction"), what);
    assert.equal(t.json(FILES.ledger).launches[0].status, "prepared", `${what}: it waits, prepared`);
  }
  // The pure rule, and the last 24 hours as the ledger counts them.
  const caps = launchCaps({});
  const stats = { count: 0, lamports: 0 };
  assert.equal(capProblem({ stats, caps, lossLamports: 6_000_000, balanceLamports: 100_000_000 }), null);
  assert.match(capProblem({ stats: { count: 3, lamports: 0 }, caps, lossLamports: 1, balanceLamports: 1e9 }), /LAUNCH_MAX_PER_DAY/);
  assert.match(capProblem({ stats: { count: 1, lamports: 95_000_000 }, caps, lossLamports: 6_000_000, balanceLamports: 1e9 }), /LAUNCH_MAX_SOL_PER_DAY/);
  assert.match(capProblem({ stats, caps, lossLamports: 6_000_000, balanceLamports: 25_000_000 }), /LAUNCH_MIN_BALANCE_SOL/);
  const row = (status, h, spent, extra = {}) => ({ status, sentAt: iso(NOW - h * HOUR), spentLamports: spent, ...extra });
  assert.deepEqual(dayStats({ launches: [row("launched", 1, 5_000_000), row("launched", 23, 6_000_000), row("launched", 25, 7_000_000), row("failed", 2, 25_000), row("sending", 0.1, undefined), row("prepared", 3, 10_000)] }, NOW, caps),
    { count: 3, lamports: 5_000_000 + 6_000_000 + 25_000 + caps.maxLamportsPerLaunch + 10_000 }, "a row still sending counts the per-launch cap");
});

test("the $CATSANC holders' SOL (the rewards ledger's earmark) is never spent on a launch; a ledger that is missing or does not read, or a history it cannot read, makes the launch wait", async () => {
  const sigOf = () => base58Encode(randomBytes(64));
  /** A rewards ledger whose holders are owed `forHolders` lamports (one landed claim), with its cursor and any rows still sending. */
  const ledgerWith = (forHolders, { cursor = null, sending = [] } = {}) => {
    const L = R.emptyLedger();
    const g = sigOf();
    R.recordClaimSending(L, { sig: g, lastValidBlockHeight: 1, sharePct: 100, sentAt: iso(NOW - HOUR) });
    R.settleClaim(L, g, { claimed: BigInt(forHolders), walletFee: 0n, net: BigInt(forHolders) }, { settledAt: iso(NOW - HOUR) });
    for (const s of sending) R.recordClaimSending(L, { sig: s, lastValidBlockHeight: 1, sharePct: 100, sentAt: iso(NOW - HOUR) });
    if (cursor) R.advanceCursor(L, cursor);
    return R.ledgerText(L);
  };
  const attempt = async ({ rewardsLedger, rewardsState, env = {}, chain = {}, setup = () => {} }) => {
    const w = throwaway();
    const t = site({ wallet: w.address });
    if (rewardsLedger !== undefined || rewardsState !== undefined) fs.mkdirSync(path.join(t.root, "data/rewards"), { recursive: true });
    if (rewardsLedger !== undefined) fs.writeFileSync(path.join(t.root, R.REWARDS_FILES.ledger), rewardsLedger);
    if (rewardsState !== undefined) fs.writeFileSync(path.join(t.root, R.REWARDS_FILES.state), rewardsState);
    const sol = fakeSolana({ wallet: w.address, ...chain }), web = fakeSite(t.root), c = clock();
    setup(sol, w);
    await prepare({ io: t.io, env: ON(w, env), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
    web.deployed = true;
    const logs = [];
    const r = await send({ io: t.io, env: ON(w, env), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, log: (l) => logs.push(l), ...quick });
    return { r, logs, sol, all: logs.join("\n") };
  };
  // No rewards ledger, or one as shipped (nothing claimed, no cursor): nothing held back.
  const none = await attempt({});
  assert.equal(none.r.outcome, "launched", none.all);
  assert.ok(!none.all.includes("holders"), none.all);
  const empty = await attempt({ rewardsLedger: R.ledgerText(R.emptyLedger()), env: { REWARDS_ENABLED: "on" } });
  assert.equal(empty.r.outcome, "launched", empty.all);
  // 0.2 SOL in the wallet, 0.15 of it the holders': 0.05 free, the launch costs 0.0056, 0.0444 stays over the 0.02 floor.
  const ok = await attempt({ rewardsLedger: ledgerWith(150_000_000) });
  assert.equal(ok.r.outcome, "launched", ok.all);
  assert.ok(ok.logs.some((l) => /0\.15 SOL of the wallet's 0\.2 SOL belongs to the \$CATSANC holders/.test(l)), ok.all);
  // 0.185 SOL of it the holders': 0.015 free, at or under the floor: it waits, nothing is sent.
  const held = await attempt({ rewardsLedger: ledgerWith(185_000_000) });
  assert.equal(held.r.outcome, "cap", held.all);
  assert.ok(held.logs.some((l) => /0\.185 SOL of it the holders'.*at or under LAUNCH_MIN_BALANCE_SOL/.test(l)), held.all);
  assert.ok(!held.sol.methods().includes("sendTransaction"));
  // 0.176 of it the holders': 0.024 free, but 0.024 less the launch's 0.0056 falls under the floor after it.
  const after = await attempt({ rewardsLedger: ledgerWith(176_000_000) });
  assert.equal(after.r.outcome, "cap", after.all);
  assert.ok(after.logs.some((l) => /would fall under LAUNCH_MIN_BALANCE_SOL/.test(l)), after.all);
  // What a claim brought in since the ledger's cursor that the ledger does not list yet (a stranger's claim, or one whose record has not
  // reached main) is the holders' too, whatever REWARDS_ENABLED says; a claim the ledger lists as still sending as well. Each is measured
  // as the Rewards workflow will count it (measureClaim: pump.fun's claim event, what the wallet received, what left the vault).
  const cursor = sigOf(), unlisted = sigOf();
  const claimTx = (w, sig, lamports) => {
    const stranger = throwaway().address, vault = creatorVault(w.address);
    const event = Buffer.alloc(16 + 80);
    Buffer.from(EVENT_IX_TAG + EVENT_DISC.collectCreatorFee, "hex").copy(event, 0);
    event.writeBigInt64LE(1_790_000_000n, 16); Buffer.from(base58Decode(w.address)).copy(event, 24); event.writeBigUInt64LE(BigInt(lamports), 56); Buffer.from(base58Decode(SYSTEM_PROGRAM)).copy(event, 64);
    return { slot: 450_000_000, blockTime: Math.floor(NOW / 1000), transaction: { signatures: [sig], message: { accountKeys: [stranger, w.address, vault, PUMP.program, PUMP.eventAuthority] } },
      meta: { err: null, fee: 7000, preBalances: [10_000_000, 20_000_000, 650_240 + lamports, 1, 1], postBalances: [9_993_000, 20_000_000 + lamports, 650_240, 1, 1],
        innerInstructions: [{ index: 0, instructions: [{ programIdIndex: 3, accounts: [4], data: base58Encode(event) }] }], loadedAddresses: { writable: [], readonly: [] } } };
  };
  const arrived = (sol, w) => {
    sol.history.set(w.address, [{ signature: unlisted, err: null, blockTime: Math.floor(NOW / 1000), slot: 450_000_000 }]);
    sol.txs.set(unlisted, claimTx(w, unlisted, 160_000_000));
  };
  for (const REWARDS_ENABLED of ["on", "dry", "off"]) {
    const on = await attempt({ rewardsLedger: ledgerWith(20_000_000, { cursor }), env: { REWARDS_ENABLED }, setup: arrived });
    assert.equal(on.r.outcome, "cap", `${REWARDS_ENABLED}\n${on.all}`);
    assert.ok(on.logs.some((l) => /0\.18 SOL of the wallet's 0\.2 SOL belongs to the \$CATSANC holders/.test(l)), on.all);
    const until = on.sol.calls.find((x) => x.method === "getSignaturesForAddress" && x.params[1]?.until);
    assert.deepEqual(until.params[1], { limit: 1000, commitment: "confirmed", until: cursor });
  }
  const sending = await attempt({ rewardsLedger: ledgerWith(20_000_000, { sending: [unlisted] }), setup: arrived });
  assert.equal(sending.r.outcome, "cap", sending.all);
  // A deposit (the owner funding the wallet: a plain transfer in) claims nothing: it is never held back.
  const deposit = (sol, w) => {
    sol.history.set(w.address, [{ signature: unlisted, err: null, blockTime: Math.floor(NOW / 1000), slot: 450_000_000 }]);
    sol.txs.set(unlisted, { slot: 450_000_000, blockTime: Math.floor(NOW / 1000), transaction: { signatures: [unlisted], message: { accountKeys: [throwaway().address, w.address, SYSTEM_PROGRAM] } },
      meta: { err: null, fee: 5000, preBalances: [300_000_000, 40_000_000, 1], postBalances: [139_995_000, 200_000_000, 1], innerInstructions: [], loadedAddresses: { writable: [], readonly: [] } } });
  };
  const funded = await attempt({ rewardsLedger: ledgerWith(20_000_000, { cursor }), env: { REWARDS_ENABLED: "on" }, setup: deposit });
  assert.equal(funded.r.outcome, "launched", funded.all);
  assert.ok(funded.logs.some((l) => /0\.02 SOL of the wallet's 0\.2 SOL belongs to the \$CATSANC holders/.test(l)), funded.all);
  // Past the first page of 1,000 signatures: every page is read (a flood no longer stops launches by its count alone).
  const many = await attempt({ rewardsLedger: ledgerWith(20_000_000, { cursor }), env: { REWARDS_ENABLED: "on" }, setup: (sol, w) => {
    const junk = Array.from({ length: 1_500 }, () => ({ signature: sigOf(), err: { InstructionError: [0, "Custom"] }, blockTime: Math.floor(NOW / 1000), slot: 450_000_000 }));
    arrived(sol, w);
    sol.history.set(w.address, [...junk, ...sol.history.get(w.address)]);
  } });
  assert.equal(many.r.outcome, "cap", many.all);
  assert.equal(many.sol.calls.filter((x) => x.method === "getSignaturesForAddress" && x.params[1]?.until).length, 2, "two pages");
  assert.equal(many.sol.calls.filter((x) => x.method === "getTransaction").length, 1, "failed ones are never read");
  // A missing ledger: nothing is held only when neither rewards file exists and REWARDS_ENABLED is off.
  const noLedger = await attempt({ rewardsState: R.stateText(R.emptyState()) });
  assert.equal(noLedger.r.outcome, "earmark", noLedger.all);
  assert.ok(noLedger.logs.some((l) => /data\/rewards\/ledger\.json is missing while data\/rewards\/state\.json is there: the holders' SOL cannot be told apart/.test(l)), noLedger.all);
  for (const REWARDS_ENABLED of ["on", "dry"]) {
    const none = await attempt({ env: { REWARDS_ENABLED } });
    assert.equal(none.r.outcome, "earmark", none.all);
    assert.ok(none.logs.some((l) => new RegExp(`ledger\\.json is missing while REWARDS_ENABLED is ${REWARDS_ENABLED}`).test(l)), none.all);
  }
  // A ledger that does not read, or a history that cannot be read: the holders' SOL cannot be told apart, so nothing is sent.
  const broken = await attempt({ rewardsLedger: ledgerWith(10_000_000).replace('"E": "10000000"', '"E": "99000000"') });
  assert.equal(broken.r.outcome, "earmark", broken.all);
  assert.ok(broken.logs.some((l) => /data\/rewards\/ledger\.json does not read .*E is 99000000.*: the holders' SOL cannot be told apart/.test(l)), broken.all);
  assert.ok(!broken.sol.methods().includes("sendTransaction"));
  const unreadable = await attempt({ rewardsLedger: ledgerWith(10_000_000, { cursor }), env: { REWARDS_ENABLED: "on" }, setup: (sol, w) => { arrived(sol, w); sol.txs.delete(unlisted); } });
  assert.equal(unreadable.r.outcome, "earmark", unreadable.all);
  // The pure rule, from the rewards module: none without either rewards file while rewards are off.
  assert.deepEqual(await rewardsEarmark({ io: { readText: () => null }, rpc: null, wallet: throwaway().address }), { lamports: 0n, problem: null });
  assert.match((await rewardsEarmark({ io: { readText: () => null }, rpc: null, wallet: throwaway().address, env: { REWARDS_ENABLED: "dry" } })).problem, /missing/);
});

test("the day's count: after LAUNCH_MAX_PER_DAY launches in 24 hours, no new cat is prepared", async () => {
  const w = throwaway();
  const posts = ["2100000000000000301", "2100000000000000302"].map((id, i) => post(id, i === 0 ? {} : { h: 3, name: "Bramblewick", ticker: "BRAMBLE", nameFrom: "trend", figure: null, lore: "Bramblewick rides a skateboard across the kitchen floor." }));
  const t = site({ wallet: w.address, posts });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const env = ON(w, { LAUNCH_MAX_PER_DAY: "1" });
  const first = await launchOnce(t, { env, sol, web, c });
  assert.equal(first.s.outcome, "launched");
  const logs = [];
  const p = await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, log: (l) => logs.push(l) });
  assert.equal(p.prepared, null);
  assert.ok(logs.some((l) => /LAUNCH_MAX_PER_DAY is 1/.test(l)));
  // A day later, the next one.
  c.t += 25 * HOUR;
  const tomorrow = post("2100000000000000303", { h: 1, name: "Bramblewick", ticker: "BRAMBLE", nameFrom: "trend", figure: null, lore: "Bramblewick rides a skateboard across the kitchen floor." });
  fs.writeFileSync(path.join(t.root, FILES.trending), JSON.stringify(trendingOf([{ ...tomorrow, postedAt: iso(c.t - HOUR) }])));
  assert.equal((await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now })).prepared, "2100000000000000303");
});

test("dry mode: builds and simulates the cat prepare would pick, and never sends, writes or commits anything", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address });
  const before = { ledger: t.read(FILES.ledger), adopt: t.read(FILES.adoptables) };
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const env = { LAUNCH_ENABLED: "dry", LAUNCH_WALLET_KEY: w.base58, LAUNCH_CHARACTERS: "on", LAUNCH_PAIRS: "on" };
  const logs = [];
  const p = await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, log: (l) => logs.push(l) });
  assert.deepEqual([p.changed, p.pending, p.deploy, p.prepared], [false, true, false, null]);
  assert.ok(logs.some((l) => /dry run\): would prepare Sir Gloopington \(GLOOP\)/.test(l)));
  const s = await send({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, log: (l) => logs.push(l), ...quick });
  assert.equal(s.outcome, "dry");
  assert.ok(sol.methods().includes("simulateTransaction"), "it simulates");
  assert.ok(!sol.methods().includes("sendTransaction"), "it never sends");
  assert.ok(logs.some((l) => /simulates cleanly on pump\.fun/.test(l)));
  assert.equal(t.read(FILES.ledger), before.ledger);
  assert.equal(t.read(FILES.adoptables), before.adopt);
  assert.ok(!t.exists("coins/2100000000000000001.json"), "no metadata written");
  const mint = deriveMintKeypair(w.kp, "2100000000000000001").publicKey;
  assert.ok(!logs.some((l) => l.includes(mint)), "the mint is never printed before a send");
  assert.deepEqual(record({ io: t.io, env, now: c.now }).recorded, []);
  // A row prepared while "on" is simulated, not sent, and stays prepared.
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  web.deployed = true;
  const s2 = await send({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.equal(s2.outcome, "dry");
  assert.equal(t.json(FILES.ledger).launches[0].status, "prepared");
  assert.ok(!sol.methods().includes("sendTransaction"));
});

test("crash points: a transaction that never landed fails once its blockhash expired and is tried again with the SAME mint; one coin only", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const env = ON(w);
  await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  web.deployed = true;
  // The send goes out, but is never seen (dropped by the network).
  sol.s.land = "never";
  const s1 = await send({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.equal(s1.outcome, "sending");
  let row = t.json(FILES.ledger).launches[0];
  assert.equal(row.status, "sending");
  const firstSig = row.tx, mint = row.mintPublic;
  assert.equal(mint, deriveMintKeypair(w.kp, row.postId).publicKey, "written once sent");
  // Next run, blockhash still valid: it waits.
  assert.equal((await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now })).changed, false);
  assert.equal(t.json(FILES.ledger).launches[0].status, "sending");
  // Past its last valid block height: failed, may be retried; the run after prepares it again, same post.
  sol.s.height = sol.s.lastValid + 1;
  await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  row = t.json(FILES.ledger).launches[0];
  assert.deepEqual([row.status, row.retry, row.reason], ["prepared", undefined, "expired: the transaction never landed"]);
  assert.equal(row.mintPublic, undefined, "a prepared row carries no mint");
  // This time it lands: the same mint.
  sol.s.land = "finalize";
  sol.s.lastValid = sol.s.height + 150;
  const s2 = await send({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.equal(s2.outcome, "launched");
  row = t.json(FILES.ledger).launches[0];
  assert.equal(row.mintPublic, mint);
  assert.notEqual(row.tx, firstSig);
  assert.equal(row.attempts, 2);
  const creates = sol.sent.map((x) => decompileInstructions(decodeTransaction(Buffer.from(sol.calls.filter((k) => k.method === "sendTransaction")[sol.sent.indexOf(x)].params[0], "base64")).message)
    .find((ix) => ix.programId === PUMP.program)).map((ix) => ix.keys[0].pubkey);
  assert.deepEqual(creates, [mint, mint], "both sends create the one derived mint: a second coin is impossible");
  assert.equal(decodeCreateV2(decompileInstructions(decodeTransaction(Buffer.from(sol.calls.filter((k) => k.method === "sendTransaction")[1].params[0], "base64")).message).find((ix) => ix.programId === PUMP.program).data).name, "Sir Gloopington");
});

test("crash points: a launch that landed but was never recorded (the commit lost) is recovered from the chain, never sent twice", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const env = ON(w);
  await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  web.deployed = true;
  const prepared = t.read(FILES.ledger);
  await send({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  const sig = t.json(FILES.ledger).launches[0].tx;
  fs.writeFileSync(path.join(t.root, FILES.ledger), prepared);          // the job died before its commit: main still says "prepared"
  const r = await send({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.deepEqual([r.outcome, r.launched], ["recovered", true]);
  assert.equal(sol.calls.filter((x) => x.method === "sendTransaction").length, 1);
  const row = t.json(FILES.ledger).launches[0];
  assert.deepEqual([row.status, row.tx, row.mintPublic], ["launched", sig, deriveMintKeypair(w.kp, row.postId).publicKey]);
  // A "sending" row (committed before a crash) whose transaction landed: the next prepare settles it by its signature, no key needed.
  const t2 = site({ wallet: w.address, posts: [post("2100000000000000401")] });
  const sol2 = fakeSolana({ wallet: w.address }), web2 = fakeSite(t2.root);
  await prepare({ io: t2.io, env, rpc: sol2.rpc, fetchImpl: web2.fetchImpl, now: c.now });
  web2.deployed = true;
  // It went out, but the answer never came back (the runner lost its connection): no clear answer.
  const crash = { ...sol2.rpc, sendTransaction: async (...a) => { await sol2.rpc.sendTransaction(...a); throw new TypeError("the connection was reset"); } };
  const lost = await send({ io: t2.io, env, rpc: crash, fetchImpl: web2.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.deepEqual([lost.outcome, lost.code], ["sending", 1]);
  const sending = t2.json(FILES.ledger).launches[0];
  assert.deepEqual([sending.status, sending.mintPublic], ["sending", undefined], "committed as sending, the mint not yet written");
  const p = await prepare({ io: t2.io, env: { LAUNCH_ENABLED: "on", LAUNCH_CHARACTERS: "on", LAUNCH_PAIRS: "on" }, rpc: sol2.rpc, fetchImpl: web2.fetchImpl, now: c.now });
  assert.equal(p.changed, true);
  const settled = t2.json(FILES.ledger).launches[0];
  assert.deepEqual([settled.status, settled.mintPublic], ["launched", deriveMintKeypair(w.kp, "2100000000000000401").publicKey]);
});

test("crash points: a failed launch, a preflight refusal and an address someone funded", async () => {
  const w = throwaway();
  // Failed on chain: failed, retried with the same mint, at most MAX_ATTEMPTS sends.
  const t = site({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const env = ON(w);
  sol.s.land = "error";
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
    web.deployed = true;
    const r = await send({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
    assert.equal(r.outcome, "failed", `attempt ${i}`);
    const row = t.json(FILES.ledger).launches[0];
    assert.deepEqual([row.status, row.retry, row.attempts], ["failed", true, i]);
    assert.match(row.reason, /failed on chain/);
  }
  const done = await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  assert.equal(t.json(FILES.ledger).launches[0].status, "failed", "no attempt left");
  assert.equal(done.prepared, null, "and its post is not taken again");
  assert.equal(t.json(FILES.ledger).launches[0].spentLamports, 3 * 25_000, "the fees are counted");
  // Refused by the node's preflight: nothing went out; failed, may be tried again.
  const t2 = site({ wallet: w.address });
  const sol2 = fakeSolana({ wallet: w.address }), web2 = fakeSite(t2.root);
  await prepare({ io: t2.io, env, rpc: sol2.rpc, fetchImpl: web2.fetchImpl, now: c.now });
  web2.deployed = true;
  sol2.s.refuse = "Transaction simulation failed: Blockhash not found";
  const r2 = await send({ io: t2.io, env, rpc: sol2.rpc, fetchImpl: web2.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.equal(r2.outcome, "refused");
  const row2 = t2.json(FILES.ledger).launches[0];
  assert.deepEqual([row2.status, row2.retry, row2.tx, row2.mintPublic], ["failed", true, undefined, undefined]);
  // No clear answer: it stays "sending" and is settled by its signature later.
  const t3 = site({ wallet: w.address });
  const sol3 = fakeSolana({ wallet: w.address }), web3 = fakeSite(t3.root);
  await prepare({ io: t3.io, env, rpc: sol3.rpc, fetchImpl: web3.fetchImpl, now: c.now });
  web3.deployed = true;
  sol3.s.drop = true;
  const r3 = await send({ io: t3.io, env, rpc: sol3.rpc, fetchImpl: web3.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.deepEqual([r3.outcome, r3.code], ["sending", 1]);
  assert.equal(t3.json(FILES.ledger).launches[0].status, "sending");
  // Someone funded the derived address before the launch: it is never sent.
  const t4 = site({ wallet: w.address });
  const sol4 = fakeSolana({ wallet: w.address }), web4 = fakeSite(t4.root);
  await prepare({ io: t4.io, env, rpc: sol4.rpc, fetchImpl: web4.fetchImpl, now: c.now });
  web4.deployed = true;
  sol4.accounts.set(deriveMintKeypair(w.kp, "2100000000000000001").publicKey, { owner: SYSTEM_PROGRAM, lamports: 1, data: ["", "base64"], executable: false, rentEpoch: 0 });
  const r4 = await send({ io: t4.io, env, rpc: sol4.rpc, fetchImpl: web4.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.equal(r4.outcome, "foreign");
  const row4 = t4.json(FILES.ledger).launches[0];
  assert.deepEqual([row4.status, row4.retry], ["failed", false]);
  assert.ok(!sol4.methods().includes("sendTransaction"));
  // A simulation that fails: nothing sent, one attempt used.
  const t5 = site({ wallet: w.address });
  const sol5 = fakeSolana({ wallet: w.address }), web5 = fakeSite(t5.root);
  await prepare({ io: t5.io, env, rpc: sol5.rpc, fetchImpl: web5.fetchImpl, now: c.now });
  web5.deployed = true;
  sol5.s.simErr = { InstructionError: [2, { Custom: 1 }] };
  assert.equal((await send({ io: t5.io, env, rpc: sol5.rpc, fetchImpl: web5.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "simulation_failed");
  assert.deepEqual([t5.json(FILES.ledger).launches[0].status, t5.json(FILES.ledger).launches[0].attempts], ["failed", 1]);
  assert.ok(!sol5.methods().includes("sendTransaction"));
});

test("photos: every kind shows its post's photo, credited; data/photo-hide.json (read tolerantly) hides one: off its card, the site's own picture on its coin", () => {
  // The coin's picture: the post's photo for every kind, the site's own for a hidden post.
  assert.equal(SITE_IMAGE, "https://catcoinsanctuary.com/assets/og-image.jpg");
  assert.ok(fs.existsSync(path.join(ROOT, "assets/og-image.jpg")));
  const img = "https://pbs.twimg.com/media/Gx1.jpg";
  for (const kind of ["real", "cartoon", "fiction"]) assert.equal(coinImageFor({ kind, image: img, postId: "2100000000000000401" }), img, kind);
  assert.equal(coinImageFor({ image: img, postId: "2100000000000000401" }, new Set(["2100000000000000401"])), SITE_IMAGE);
  // The hide list, read as the approvals are: a typo hides nothing, with a warning, and never throws.
  const io = (text) => ({ readText: () => text });
  for (const [text, want, warned] of [[null, [], false], ['{ "hide": ["2100000000000000401", 5, "x"] }', ["2100000000000000401", "5"].filter((v) => /^\d{5,25}$/.test(v)), false],
    ["{ not json", [], true], ['{ "hide": "2100000000000000401" }', [], true], ['["2100000000000000401"]', [], true]]) {
    const logs = [];
    assert.deepEqual([...photoHideOf(io(text), (l) => logs.push(l))], want, text);
    assert.equal(logs.some((l) => /^::warning/.test(l)), warned, text);
  }
  // A shown photo whose post is hidden moves, whole, to `hidden`; unhidden, it comes back exactly as it was, for any cat
  // (not only a launched one: a hand-reviewed photo has no ledger row), and whatever form its post link takes.
  const photo = { url: img, handle: "floppafan", post: "https://x.com/floppafan/status/2100000000000000401", alt: "Quillbert: the photo from @floppafan's post" };
  const photos = { note: "n", checked: "2026-09-26", cats: { QUILL: { realPhoto: photo, source: "proof" }, OTHER: { realPhoto: { ...photo, post: "https://x.com/a/status/2100000000000000999" }, source: "search" } }, none: { ZZZ: "no photo" } };
  const hidden = applyPhotoHide(photos, new Set(["2100000000000000401"]));
  assert.deepEqual(hidden.hid, ["QUILL"]);
  assert.deepEqual(hidden.photos.hidden.QUILL, { postId: "2100000000000000401", entry: photos.cats.QUILL });
  assert.ok(!("QUILL" in hidden.photos.cats) && "OTHER" in hidden.photos.cats && hidden.photos.none.ZZZ === "no photo" && !("QUILL" in hidden.photos.none));
  assert.equal(applyPhotoHide(hidden.photos, new Set(["2100000000000000401"])).photos, hidden.photos, "nothing moves twice");
  const back = applyPhotoHide(hidden.photos, new Set());
  assert.deepEqual(back.restored, ["QUILL"]);
  assert.deepEqual(back.photos, photos, "unhidden: the file exactly as it was");
  // Every photo the site ships can be hidden and shown again without losing it (the review's probe).
  const shippedPhotos = JSON.parse(readRoot(FILES.realPhotos));
  // (the shipped file may already hide some: those stay hidden, so the probe hides them too and keeps them hidden after)
  const hiddenBefore = new Set(Object.values(shippedPhotos.hidden || {}).map((h) => String(h.postId)));
  const ids = new Set([...Object.values(shippedPhotos.cats).map((v) => postIdOf(v.realPhoto.post)), ...hiddenBefore]);
  const all = applyPhotoHide(shippedPhotos, ids);
  assert.deepEqual(Object.keys(all.photos.cats), []);
  assert.deepEqual(applyPhotoHide(all.photos, hiddenBefore).photos, shippedPhotos);
  // Any link form of the post: twitter.com, www., a query.
  for (const u of ["https://twitter.com/floppafan/status/2100000000000000401", "https://www.x.com/floppafan/status/2100000000000000401?s=20", "https://x.com/floppafan/status/2100000000000000401/photo/1"]) {
    assert.equal(postIdOf(u), "2100000000000000401", u);
    assert.deepEqual(applyPhotoHide({ cats: { QUILL: { realPhoto: { ...photo, post: u }, source: "proof" } } }, new Set(["2100000000000000401"])).hid, ["QUILL"], u);
  }
  // The row's own fields: the coin's picture is its post's or the site's; the credit a flag.
  const ctx = { nowMs: NOW, approvals: new Set(["2100000000000000401"]), watch: WATCH, ledger: { launches: [] }, adoptables: shipped(FILES.adoptables), planned: JSON.parse(readRoot("data/planned.json")) };
  const p = post("2100000000000000401", { name: "Quillbert", ticker: "QUILL", kind: "real", nameFrom: null, figure: null, lore: "Quillbert sleeps in the salad bowl." });
  const shown = candidateRow(p, ctx).row;
  assert.deepEqual([shown.coinImage, shown.photoCredit, coinMetadata(shown).image], [shown.image, true, shown.image]);
  const hid = candidateRow(p, { ...ctx, photoHide: new Set(["2100000000000000401"]) }).row;
  assert.deepEqual([hid.coinImage, coinMetadata(hid).image], [SITE_IMAGE, SITE_IMAGE]);
  assert.ok(!coinMetadata(hid).description.includes("Photo:"), "no credit for a photo the coin does not show");
  assert.equal(rowProblem(hid), null);
  assert.equal(rowProblem({ ...shown, coinImage: "https://pbs.twimg.com/media/other.jpg" }), "coinImage must be the post's picture, or the site's own");
  assert.equal(rowProblem({ ...shown, photoCredit: "yes" }), "photoCredit must be true or false");
  // A real pet waits for data/launch-approvals.json even when it is named after a watch-list figure.
  assert.equal(policyOf(post("2100000000000000402", { kind: "real" }), { approvals: new Set(), watch: WATCH }), null);
  assert.equal(policyOf(post("2100000000000000402", { kind: "real" }), { approvals: new Set(["2100000000000000402"]), watch: WATCH }), "approved");
});

test("the owner's open rule (LAUNCH_OPEN, on unless off): a real pet in a viral or rising post, or one a big account names, launches without approval", () => {
  assert.deepEqual([openLaunches({}), openLaunches({ LAUNCH_OPEN: "" }), openLaunches({ LAUNCH_OPEN: "on" }), openLaunches({ LAUNCH_OPEN: " OFF " })], [true, true, true, false]);
  const ctx = { approvals: new Set(), watch: WATCH, open: true };
  const pet = (id, extra = {}, stage = "viral") => ({ ...post(id, { kind: "real", nameFrom: null, figure: null, ...extra }), stage });
  assert.equal(policyOf(pet("2100000000000000411"), ctx), "viral");
  assert.equal(policyOf(pet("2100000000000000412", {}, "rising"), ctx), "viral");
  assert.equal(policyOf(pet("2100000000000000413", { big: "NBA" }, "big-account"), ctx), "big-account");
  assert.equal(policyOf(pet("2100000000000000414", {}, "big-account"), ctx), null, "no big account, not viral or rising");
  assert.equal(policyOf(pet("2100000000000000411"), { ...ctx, open: false }), null, "off: it waits for the owner again");
  assert.equal(policyOf(pet("2100000000000000411"), { ...ctx, approvals: new Set(["2100000000000000411"]) }), "approved", "an approval still reads as one");
  // Every other rule still applies: a sensitive pet never launches.
  const adoptables = shipped(FILES.adoptables), planned = JSON.parse(readRoot("data/planned.json"));
  const posts = [pet("2100000000000000415", { h: 1, name: "Quillbert", ticker: "QUILL", sensitive: true }), pet("2100000000000000416", { h: 2, name: "Bramblewick", ticker: "BRAMBLE", lore: "Bramblewick naps in the sink every afternoon." })];
  const pick = selectCandidate({ nowMs: NOW, approvals: new Set(), watch: WATCH, open: true, ledger: { launches: [] }, adoptables, planned, trending: trendingOf(posts) });
  assert.deepEqual([pick.row?.postId, pick.row?.policy, pick.row?.kind], ["2100000000000000416", "viral", "real"]);
  assert.match(pick.skipped[0].why, /sensitive/);
  assert.equal(rowProblem(pick.row), null);
});

test("a real pet, approved to launch: its photo shows on its card and on its coin, credited; the owner hides it later and it leaves the card; unhidden, it comes back", async () => {
  const w = throwaway();
  const id = "2100000000000000411";
  const t = site({ wallet: w.address, approve: [id], posts: [post(id, { name: "Quillbert", ticker: "QUILL", kind: "real", nameFrom: null, figure: null, lore: "Quillbert sleeps in the salad bowl." })] });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const { r } = await launchOnce(t, { env: ON(w), sol, web, c });
  assert.deepEqual(r.recorded, ["QUILL"]);
  const row = t.json(FILES.ledger).launches[0];
  assert.deepEqual([row.kind, row.policy, row.coinImage], ["real", "approved", row.image]);
  const meta = t.json(row.metadataPath);
  assert.equal(meta.image, row.image);
  assert.equal(meta.description, `Quillbert sleeps in the salad bowl. Photo: @floppafan on X. ${FAN_TRIBUTE.real}`);
  const ph = t.json(FILES.realPhotos).cats.QUILL;
  assert.deepEqual(ph, { realPhoto: { url: row.image, handle: "floppafan", post: row.url, alt: "Quillbert: the photo from @floppafan's post" }, source: "proof" });
  assert.equal((await pageOf(t)).find((x) => x.id === "QUILL")?.realPhoto?.url, row.image, "shown on its card");
  // Hidden by the owner: the next prepare takes it off the card (kept whole in `hidden`) and deploys; the coin keeps its picture (sent).
  fs.writeFileSync(path.join(t.root, FILES.photoHide), JSON.stringify({ note: "test", hide: [id] }));
  const logs = [];
  const p = await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, log: (l) => logs.push(l) });
  assert.deepEqual([p.photos, p.deploy], [["QUILL"], true]);
  const photos = t.json(FILES.realPhotos);
  assert.ok(!("QUILL" in photos.cats));
  assert.deepEqual(photos.hidden.QUILL, { postId: id, entry: ph });
  assert.equal((await pageOf(t)).find((x) => x.id === "QUILL")?.realPhoto ?? null, null, "off its card");
  assert.equal(t.json(row.metadataPath).image, row.image, "a launched coin's metadata is never rewritten");
  assert.ok(logs.some((l) => /QUILL is hidden/.test(l)));
  // Unhidden: back on its card.
  fs.writeFileSync(path.join(t.root, FILES.photoHide), JSON.stringify({ note: "test", hide: [] }));
  const p2 = await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  assert.deepEqual(p2.photos, ["QUILL"]);
  assert.deepEqual(t.json(FILES.realPhotos).cats.QUILL, ph);
  assert.ok(!("hidden" in t.json(FILES.realPhotos)));
  // A typo in the file hides nothing and stops nothing.
  fs.writeFileSync(path.join(t.root, FILES.photoHide), "{ hide: [");
  const warn = [];
  const p3 = await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, log: (l) => warn.push(l) });
  assert.equal(p3.photos, undefined);
  assert.ok(warn.some((l) => /^::warning.*photo-hide\.json/.test(l)));
});

test("a post hidden before it launches: its coin shows the site's own picture (no credit), and its photo waits in hidden, never on its card", async () => {
  const w = throwaway();
  const id = "2100000000000000421";
  const t = site({ wallet: w.address });
  fs.writeFileSync(path.join(t.root, "data/trending-cats.json"), JSON.stringify(trendingOf([post(id)])));
  fs.writeFileSync(path.join(t.root, FILES.photoHide), JSON.stringify({ note: "test", hide: [id] }));
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const { r } = await launchOnce(t, { env: ON(w), sol, web, c });
  assert.deepEqual(r.recorded, ["GLOOP"]);
  const row = t.json(FILES.ledger).launches[0];
  assert.equal(row.coinImage, SITE_IMAGE);
  const meta = t.json(row.metadataPath);
  assert.equal(meta.image, SITE_IMAGE);
  assert.equal(meta.description, `Gloopington stares down the camera from the top of the fridge. ${FAN_TRIBUTE.character}`);
  const photos = t.json(FILES.realPhotos);
  assert.ok(!("GLOOP" in photos.cats));
  assert.deepEqual(photos.hidden.GLOOP, { postId: id, entry: { realPhoto: { url: row.image, handle: "floppafan", post: row.url, alt: "Sir Gloopington: the photo from @floppafan's post" }, source: "proof" } });
});

test("a prepared coin's picture follows data/photo-hide.json until it is sent", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  let row = t.json(FILES.ledger).launches[0];
  assert.equal(t.json(row.metadataPath).image, row.image);
  fs.writeFileSync(path.join(t.root, FILES.photoHide), JSON.stringify({ note: "test", hide: [row.postId] }));
  const p = await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  row = t.json(FILES.ledger).launches[0];
  assert.deepEqual([row.status, row.coinImage, t.json(row.metadataPath).image, p.deploy], ["prepared", SITE_IMAGE, SITE_IMAGE, true]);
  assert.equal(t.read(row.metadataPath), metadataText(coinMetadata(row)));
  assert.ok(!t.json(row.metadataPath).description.includes("Photo:"));
});

test("the wallet must be an active launcher in data/wallets.json: otherwise nothing is sent, and its address and what to add are printed", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address, listWallet: false });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  web.deployed = true;
  const logs = [];
  const r = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, log: (l) => logs.push(l), ...quick });
  assert.deepEqual([r.outcome, r.code], ["wallet_not_listed", 1]);
  assert.equal(sol.calls.length, 0, "not one RPC call");
  const text = logs.join("\n");
  assert.ok(text.includes(w.address));
  assert.ok(text.includes(`{ "address": "${w.address}", "since": "2026-09-25", "label": "Auto launcher" }`));
  assert.match(text, /data\/wallets\.json/);
  // Retired, or not yet listed at the time: the same.
  const ws = JSON.parse(readRoot("data/wallets.json"));
  ws.launchers.push({ address: w.address, since: "2026-09-01", until: "2026-09-25T17:05:00Z", label: "Auto launcher" });
  fs.writeFileSync(path.join(t.root, FILES.wallets), JSON.stringify(ws));
  assert.equal((await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "wallet_not_listed", "retired in 5 minutes");
});

test("record: the launched cat moves into the sanctuary: a valid adoptable with its launch, held from the announcer, listed for the Collection, a 3D model queued, its real photo, off the watch list; once", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const env = ON(w);
  const announcedBefore = t.read(FILES.announced);
  const { r } = await launchOnce(t, { env, sol, web, c });
  assert.deepEqual(r.recorded, ["GLOOP"]);
  const row = t.json(FILES.ledger).launches[0];
  assert.ok(row.recordedAt);
  // The adoptable: the row prepared, plus its launch; the whole file validates.
  const adopt = t.json(FILES.adoptables);
  const planned = t.json(FILES.planned);
  const v = validateAdoptables(adopt, { taken: new Set(planned.cats.map((x) => x.ticker)) });
  assert.deepEqual(v.refused, []);
  const cat = adopt.cats.find((x) => x.ticker === "GLOOP");
  assert.equal(adoptableProblem(cat), null);
  assert.deepEqual(cat.launch, { mint: row.mintPublic, tx: row.tx, launchpad: "pump.fun", at: row.launchedAt });
  assert.equal(coatProblem(cat.coat), null);
  assert.equal(t.read(FILES.adoptables), `${JSON.stringify(adopt, null, 2)}\n`);
  // Held from the announcer (its X post is the launch post), as every new adoptable is: by the announcer's own rule. The
  // launcher never writes data/announced.json (the Announce workflow's alone), so their commits never race on it.
  assert.equal(t.read(FILES.announced), announcedBefore, "data/announced.json is not the launcher's to write");
  const ann = await announceOf(t);
  assert.ok(!ann.summary.drafts.some((d) => d.key === "GLOOP") && !ann.tweets.some((x) => x.includes("Gloopington")), "the announcer never posts the launcher's cat");
  assert.deepEqual(holdSanctuaryCats(listCats(t.json(FILES.planned), t.json(FILES.collection), t.json(FILES.adoptables)), { cats: {} }).cats.GLOOP, { status: "held", reason: "adoptable cat: announcing paused" });
  // Listed for the Collection, canonical, its note plain text.
  const launches = t.json(FILES.launches);
  assert.deepEqual(launches.launches.filter((l) => l.tx === row.tx), [{ tx: row.tx, note: "Sanctuary launcher: GLOOP" }]);
  assert.equal(t.read(FILES.launches), `${JSON.stringify(launches, null, 2)}\n`);
  // A 3D model of its own, in the queue's shape (tests/meshy.test.mjs), from the post's picture.
  const q = t.json(FILES.meshy);
  const m = q.cats.GLOOP;
  assert.deepEqual(Object.keys(m).sort(), ["action", "order", "priority", "referencePrompt", "styleImage", "why"]);
  assert.equal(m.action, "rebuild");
  assert.ok([1, 2, 3].includes(m.priority));
  assert.ok(m.referencePrompt.length > 20);
  assert.equal(m.styleImage, row.image);
  assert.equal(m.referencePrompt, FIGURE.look, "drawn from the figure's own look");
  assert.ok(m.order > Math.max(...Object.entries(q.cats).filter(([k]) => k !== "GLOOP").map(([, x]) => x.order ?? 0)));
  assert.equal(t.read(FILES.meshy), `${JSON.stringify(q, null, 1)}\n`);
  // Its real photo, hotlinked (tests/realphoto.test.mjs's rules).
  const ph = t.json(FILES.realPhotos).cats.GLOOP;
  assert.deepEqual(Object.keys(ph.realPhoto).sort(), ["alt", "handle", "post", "url"]);
  assert.equal(ph.source, "proof");
  assert.ok(realPhotoOf(ph.realPhoto));
  assert.match(ph.realPhoto.url, /^https:\/\/pbs\.twimg\.com\//);
  // Off the watch list: it lives in the sanctuary now; the rest stay, in the file's own layout.
  const watch = t.json(FILES.watch);
  assert.ok(!watch.figures.some((f) => f.name === "Sir Gloopington"));
  assert.equal(watch.figures.length, WATCH.figures.length - 1);
  assert.equal(t.read(FILES.watch), watchText(watch));
  // Once: a second record changes nothing.
  const snap = [FILES.adoptables, FILES.launches, FILES.meshy, FILES.realPhotos, FILES.watch, FILES.ledger].map(t.read);
  assert.deepEqual(record({ io: t.io, env, now: c.now }).recorded, []);
  assert.deepEqual([FILES.adoptables, FILES.launches, FILES.meshy, FILES.realPhotos, FILES.watch, FILES.ledger].map(t.read), snap);
  // Rebuilding the adoptables from the research file never drops a cat the sanctuary launched.
  const src = path.join(t.root, "source.json");
  fs.writeFileSync(src, "[]");
  const rebuilt = buildAdoptables({ root: t.root, source: src });
  assert.deepEqual(rebuilt.data.cats.map((x) => x.ticker).sort(), adopt.cats.filter((x) => x.launch).map((x) => x.ticker).sort(), "every launched cat stays, and only those (the source is empty)");
  assert.ok(rebuilt.data.cats.some((x) => x.ticker === "GLOOP"));
  fs.writeFileSync(path.join(t.root, FILES.adoptables), snap[0]);
  // A crash before the ledger was written: the next record finds the files done and only marks the row.
  const ledger = t.json(FILES.ledger);
  delete ledger.launches[0].recordedAt;
  fs.writeFileSync(path.join(t.root, FILES.ledger), JSON.stringify(ledger));
  assert.deepEqual(record({ io: t.io, env, now: c.now }).recorded, ["GLOOP"]);
  assert.equal(t.json(FILES.adoptables).cats.filter((x) => x.ticker === "GLOOP").length, 1);
});

test("the page and the X post after a launch: \"Launching…\" until the Collection proves the mint, then \"Launched by the sanctuary\"; posted once, only then, with no address", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  await launchOnce(t, { env: ON(w), sol, web, c });
  const row = t.json(FILES.ledger).launches[0];
  const localFetch = async (url) => { try { return new Response(fs.readFileSync(new URL(url).pathname), { status: 200 }); } catch { return new Response("", { status: 404 }); } };
  const residents = async () => (await loadResidents({ base: new URL(`file://${t.root}/`), nowMs: DATA_NOW, fetchImpl: localFetch })).map(normalize).filter(Boolean);
  const quiet = async (fn) => { const warn = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = warn; } };
  let r = (await quiet(residents)).find((x) => x.id === "GLOOP");
  assert.deepEqual([r.kind, r.sanctuaryLaunch?.status, isLaunched(r)], ["adoptable", "pending", false]);
  // The X post waits: the mint is not proved.
  const X = { X_API_KEY: "k", X_API_SECRET: "s", X_ACCESS_TOKEN: "t", X_ACCESS_SECRET: "a" };
  fs.writeFileSync(path.join(t.root, "data/announce-config.json"), JSON.stringify({ dryRun: false }));
  const updates = { ...t.json("data/updates.json"), lastPostedAt: null };
  fs.writeFileSync(path.join(t.root, "data/updates.json"), JSON.stringify(updates));
  fs.writeFileSync(path.join(t.root, "data/announced.json"), JSON.stringify({ cats: Object.fromEntries(Object.entries(t.json("data/announced.json").cats).map(([k, v]) => [k, { ...v, at: undefined }])) }));
  const tweets = [];
  const xFetch = async (url, init) => {
    if (url === "https://api.x.com/2/tweets") { tweets.push(JSON.parse(init.body).text); return new Response(JSON.stringify({ data: { id: String(900 + tweets.length) } }), { status: 201 }); }
    return new Response(JSON.stringify({ data: { id: "m1" } }), { status: 200 });
  };
  fs.writeFileSync(path.join(t.root, "data/release-queue.json"), JSON.stringify({ ...t.json("data/release-queue.json"), lastReleaseAt: null }));
  const later = Math.max(Date.now(), NOW) + 24 * HOUR;
  const first = await postUpdates({ root: t.root, env: X, fetchImpl: xFetch, now: () => new Date(later), log: () => {} });
  assert.notEqual(first.posted?.kind, "launch", "not before the Collection proved it");
  // The Collection proves it (as scripts/build-collection.mjs lists a pump.fun launch).
  const proof = proveLaunchPump(sol.txs.get(row.tx), { wallet: w.address });
  const L = proof.launch;
  const collection = t.json(FILES.collection);
  collection.cats.unshift({ mint: L.mint, name: L.name, symbol: L.symbol, pair: L.pair, pool: L.pool, payer: L.payer, tx: L.tx, time: L.time, launchpad: L.launchpad });
  fs.writeFileSync(path.join(t.root, FILES.collection), JSON.stringify(collection));
  assert.equal(validateCollection(collection, { wallets: validateWallets(t.json(FILES.wallets)), nowMs: DATA_NOW }).refused.length, 0);
  r = (await quiet(residents)).find((x) => x.id === "GLOOP");
  assert.deepEqual([r.sanctuaryLaunch.status, isLaunched(r), r.token.mint], ["launched", true, row.mintPublic]);
  assert.equal((await quiet(residents)).filter((x) => x.token?.mint === row.mintPublic).length, 1, "one card for the cat, not a bare token card too");
  // Now the launch post goes out, once, first in the queue.
  const t2 = later + 200 * 60_000;
  fs.writeFileSync(path.join(t.root, "data/updates.json"), JSON.stringify({ ...t.json("data/updates.json"), lastPostedAt: null }));
  const posted = await postUpdates({ root: t.root, env: X, fetchImpl: xFetch, now: () => new Date(t2), log: () => {} });
  assert.deepEqual([posted.posted?.kind, posted.posted?.id], ["launch", "GLOOP"]);
  const text = tweets.at(-1);
  assert.ok(text.includes("Sir Gloopington (GLOOP), launched by the sanctuary on PumpFun"), text);
  assert.ok(text.includes("https://catcoinsanctuary.com/?v=3#cat=GLOOP"));
  assert.ok(!text.includes(row.mintPublic) && !text.includes(row.tx) && !/[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text), "no address");
  assert.ok(!text.includes("@"), "never the post author's handle");
  assert.equal(t.json("data/updates.json").launchesPosted.GLOOP.status, "posted");
  fs.writeFileSync(path.join(t.root, "data/updates.json"), JSON.stringify({ ...t.json("data/updates.json"), lastPostedAt: null }));
  const again = await postUpdates({ root: t.root, env: X, fetchImpl: xFetch, now: () => new Date(t2 + 400 * 60_000), log: () => {} });
  assert.notEqual(again.posted?.kind, "launch", "posted once");
  // The announcer never lists the coin as a cat of its own.
  assert.ok(!listCats(t.json(FILES.planned), collection, t.json(FILES.adoptables)).some((x) => x.key === row.mintPublic));
});

/* ── the ledger, the venue, the chain helpers ─────────────────────────────────────────── */

test("the ledger: closed rows, never a mint or a tx on a prepared row, one row in flight, bounded", () => {
  const ctx = { nowMs: NOW, approvals: new Set(), watch: WATCH, ledger: { launches: [] }, adoptables: shipped(FILES.adoptables), planned: JSON.parse(readRoot("data/planned.json")) };
  const { row } = candidateRow(post("2100000000000000501"), ctx);
  const good = { note: LEDGER_NOTE, launches: [row] };
  assert.deepEqual(validateLedger(good).launches, [row]);
  assert.deepEqual(validateLedger(null).launches, []);
  const bad = (patch, re) => assert.throws(() => validateLedger({ launches: [{ ...row, ...patch }] }), re);
  bad({ mintPublic: "11111111111111111111111111111112" }, /a prepared row has no tx and no mint/);
  bad({ tx: "1".repeat(64) }, /a prepared row has no tx and no mint/);
  bad({ status: "sending" }, /a sending row has tx/);
  bad({ status: "launched" }, /a launched row has tx, mintPublic/);
  bad({ status: "failed" }, /a failed row has a reason/);
  bad({ extra: 1 }, /unknown field/);
  bad({ postId: "abc" }, /X status id/);
  bad({ url: "https://x.com/a/status/1234567" }, /url/);
  bad({ venue: "raydium" }, /venue/);
  bad({ metadataPath: "coins/../x.json" }, /metadataPath/);
  bad({ image: "https://example.com/x.jpg" }, /pbs\.twimg\.com/);
  bad({ recordedAt: "2026-09-25T17:00:00Z" }, /only a launched row is recorded/);
  assert.throws(() => validateLedger({ launches: [row, { ...row }] }), /listed twice/);
  assert.throws(() => validateLedger({ launches: [row, { ...row, postId: "2100000000000000502", url: "https://x.com/floppafan/status/2100000000000000502", metadataPath: "coins/2100000000000000502.json" }] }), /in flight/);
  assert.throws(() => validateLedger({ rows: [] }), /must be/);
  // Bounded: the oldest finished rows go first; a row in flight never does.
  const finished = Array.from({ length: 205 }, (_, i) => ({ ...row, postId: String(2200000000000000000n + BigInt(i)), url: `https://x.com/floppafan/status/${2200000000000000000n + BigInt(i)}`,
    metadataPath: `coins/${2200000000000000000n + BigInt(i)}.json`, status: "failed", retry: false, reason: "test", preparedAt: iso(NOW - (i + 1) * HOUR) }));
  const text = ledgerText({ note: LEDGER_NOTE, launches: [row, ...finished] });
  const kept = JSON.parse(text).launches;
  assert.equal(kept.length, 200);
  assert.equal(kept[0].postId, row.postId);
  assert.equal(kept.at(-1).postId, finished[198].postId, "the oldest went");
});

test("venues: pump.fun in SOL, StonkFun in a stock pair and pump.fun in a listed coin, registered once, the rule's ids; one metadata for all three", () => {
  assert.deepEqual(venueIds(), ["pump-sol", "stonkfun", "pump-quote"]);
  assert.deepEqual(venueIds(), [...VENUE_IDS], "the routing rule's venues are the registered ones");
  assert.equal(venueById("pump-sol"), PUMP_SOL);
  assert.equal(venueById("stonkfun"), STONKFUN);
  assert.equal(venueById("pump-quote"), PUMP_QUOTE);
  assert.equal(venueById("raydium"), null);
  assert.deepEqual([PUMP_SOL.launchpad, PUMP_SOL.announceAs, PUMP_SOL.pair.symbol], ["pump.fun", "PumpFun", "SOL"]);
  assert.deepEqual([STONKFUN.launchpad, STONKFUN.announceAs, STONKFUN.pair], ["stonkfun", "StonkFun", null]);
  assert.deepEqual([PUMP_QUOTE.launchpad, PUMP_QUOTE.announceAs, PUMP_QUOTE.pair], ["pump.fun", "PumpFun", null]);
  // The pairs each may launch in.
  assert.equal(PUMP_SOL.pairProblem({ ...SOL_PAIR }), null);
  assert.ok(PUMP_SOL.pairProblem(STOCK) && PUMP_SOL.pairProblem(MEOW_PAIR));
  assert.equal(STONKFUN.pairProblem(STOCK), null);
  assert.ok(STONKFUN.pairProblem({ ...SOL_PAIR }) && STONKFUN.pairProblem(MEOW_PAIR) && STONKFUN.pairProblem({ symbol: "STONK", mint: "6GmAFSYs4gk3FDao5FzzySQpPZaWsa4rUJHacpMpUNgx" }));
  assert.equal(PUMP_QUOTE.pairProblem(MEOW_PAIR), null);
  assert.ok(PUMP_QUOTE.pairProblem({ ...SOL_PAIR }) && PUMP_QUOTE.pairProblem(STOCK) && PUMP_QUOTE.pairProblem({ ...MEOW_PAIR, tokenProgram: TOKEN_2022_PROGRAM }));
  // The same metadata JSON on every venue, so a fallback to SOL before the send keeps the file its uri serves.
  const input = { name: "Sir Gloopington", symbol: "GLOOP", description: "A test. From the Catcoin Sanctuary.", image: "https://pbs.twimg.com/media/x.jpg", website: "https://catcoinsanctuary.com/#cat=GLOOP", twitter: X_ACCOUNT, createdOn: SITE_ORIGIN };
  for (const v of [STONKFUN, PUMP_QUOTE]) assert.equal(metadataText(v.metadata(input)), metadataText(PUMP_SOL.metadata(input)), v.id);
  // StonkFun's text limits are LaunchLab's (a ticker of 10 at most: the sanctuary's own limit).
  assert.equal(STONKFUN.textProblem({ name: "Sir Gloopington", symbol: "GLOOPINGTO", uri: metadataUri("2100000000000000601") }), null);
  assert.match(STONKFUN.textProblem({ name: "Sir Gloopington", symbol: "GLOOPINGTON", uri: metadataUri("2100000000000000601") }), /10 bytes/);
  assert.throws(() => registerVenue({ ...PUMP_SOL }), /registered already/);
  assert.throws(() => registerVenue({ ...PUMP_SOL, id: "x-test", launchpad: "raydium" }), /launchpad/);
  assert.throws(() => registerVenue({ ...PUMP_SOL, id: "x-test2", prove: null }), /prove must be a function/);
  assert.throws(() => registerVenue({ ...PUMP_SOL, id: "x-test3", pairProblem: undefined }), /pairProblem must be a function/);
  assert.match(PUMP_SOL.textProblem({ name: "A".repeat(33), symbol: "AB", uri: metadataUri("2100000000000000601") }), /32 bytes/);
  // chooseVenue: a registered venue and the pair it prices the cat in; fails closed to SOL when a file is missing.
  const files = { planned: JSON.parse(readRoot("data/planned.json")), collection: { cats: [] }, adoptables: { cats: [] } };
  const tied = post("2100000000000000602");
  assert.deepEqual(chooseVenue(tied, WATCH_TIED, files), { venue: STONKFUN, pair: STOCK, reason: "stock", from: "figure" });
  assert.deepEqual(chooseVenue(tied, WATCH_TIED, { ...files, extraPairs: [STOCK.mint] }), { venue: PUMP_SOL, pair: { ...SOL_PAIR }, reason: "pair_taken" });
  for (const missing of ["planned", "collection", "adoptables"]) {
    assert.deepEqual(chooseVenue(tied, WATCH_TIED, { ...files, [missing]: null }), { venue: PUMP_SOL, pair: { ...SOL_PAIR }, reason: "pairs_unknown" }, missing);
  }
  assert.deepEqual(chooseVenue(post("2100000000000000603"), WATCH, files), { venue: PUMP_SOL, pair: { ...SOL_PAIR }, reason: "default" });
  const coin = post("2100000000000000604");
  assert.deepEqual(chooseVenue(coin, WATCH_COIN, { ...files, pumpQuotes: QUOTES, pumpQuoteOptIn: true }), { venue: PUMP_QUOTE, pair: MEOW_PAIR, reason: "pump_quote", from: "figure" });
  assert.equal(chooseVenue(coin, WATCH_COIN, { ...files, pumpQuotes: QUOTES }).reason, "quote_unverified", "no opt-in: SOL");
  assert.equal(chooseVenue(coin, WATCH_COIN, { ...files, pumpQuoteOptIn: true }).reason, "quote_not_listed", "not listed: SOL");
  assert.equal(pumpQuoteOptIn({ LAUNCH_PUMP_QUOTE: "on" }), true);
  assert.equal(pumpQuoteOptIn({ LAUNCH_PUMP_QUOTE: " ON " }), true);
  for (const v of [undefined, "", "off", "yes", "true", "1"]) assert.equal(pumpQuoteOptIn({ LAUNCH_PUMP_QUOTE: v }), false, String(v));
});

test("LAUNCH_PAIRS off (the default): every coin launches on pump.fun in SOL, never paired with a stock or a coin", () => {
  assert.equal(pairedLaunches({ LAUNCH_PAIRS: "on" }), true);
  assert.equal(pairedLaunches({ LAUNCH_PAIRS: " On " }), true);
  for (const v of [undefined, "", "off", "yes", "true", "1"]) assert.equal(pairedLaunches({ LAUNCH_PAIRS: v }), false, String(v));
  const r = routeOf({ id: "1" }, { pairs: false });
  assert.equal(r.venue.id, "pump-sol");
  assert.equal(r.pair.symbol, "SOL");
  assert.match(r.reason, /LAUNCH_PAIRS/);
});

/* ── routing: StonkFun, a coin-priced pump.fun launch, and the fallback to pump.fun in SOL ─────────── */

test("routing a candidate: a figure tied to a free stock pair is prepared on StonkFun, priced in it; a pair any cat or any launch of the launcher's own holds, or unknown pairs, give pump.fun in SOL", () => {
  const ADOPT = shipped(FILES.adoptables), PLANNED = JSON.parse(readRoot("data/planned.json")), COLL = { cats: [] };
  const ctx = (extra = {}) => ({ nowMs: NOW, approvals: new Set(), watch: WATCH_TIED, ledger: { launches: [] }, adoptables: freed(ADOPT), planned: PLANNED, collection: COLL, ...extra });
  const p = post("2100000000000000801");
  const { row, route } = candidateRow(p, ctx());
  assert.equal(rowProblem(row), null);
  assert.deepEqual([row.venue, row.cat.pair, route.reason, row.fallback], ["stonkfun", STOCK, "stock", undefined]);
  assert.equal(adoptableProblem({ ...row.cat, launch: { mint: "11111111111111111111111111111112", tx: "1".repeat(64), launchpad: "stonkfun", at: "2026-09-25T17:00:00Z" } }), null);
  assert.equal(metadataText(coinMetadata(row)), metadataText(coinMetadata({ ...row, venue: "pump-sol" })), "the same metadata as its fallback's");
  const sol = (c) => { const r = candidateRow(p, c).row; return [r.venue, r.cat.pair.symbol]; };
  const OTHER = { postId: "2100000000000000899", name: "Other Cat", coinName: "Other Cat", ticker: "OTHERCAT", attempts: 1, cat: { pair: STOCK } };
  // One cat per stock pair: a planned cat, a proved launch, an adoptable, or a launch of the launcher's own that no file shows yet.
  const other = ADOPT.cats[0];
  assert.deepEqual(sol(ctx({ adoptables: { cats: [...freed(ADOPT).cats, { ...other, pair: STOCK }] } })), ["pump-sol", "SOL"]);
  assert.deepEqual(sol(ctx({ collection: { cats: [{ pair: STOCK }] } })), ["pump-sol", "SOL"]);
  assert.deepEqual(sol(ctx({ planned: { ...PLANNED, cats: [...PLANNED.cats, { ticker: "ZZZ", pair: STOCK }] } })), ["pump-sol", "SOL"]);
  for (const status of ["prepared", "sending", "launched"]) {
    assert.deepEqual(sol(ctx({ ledger: { launches: [{ ...OTHER, status }] } })), ["pump-sol", "SOL"], status);
  }
  assert.deepEqual(sol(ctx({ ledger: { launches: [{ ...OTHER, status: "failed", retry: true }] } })), ["pump-sol", "SOL"], "a row tried again keeps its pair");
  assert.deepEqual(sol(ctx({ ledger: { launches: [{ ...OTHER, status: "failed", retry: false }] } })), ["stonkfun", STOCK.symbol], "a row failed for good holds none");
  assert.deepEqual(sol(ctx({ ledger: { launches: [{ ...OTHER, status: "failed", retry: true, attempts: MAX_ATTEMPTS }] } })), ["stonkfun", STOCK.symbol], "nor one with no try left");
  assert.deepEqual(pendingPairs({ launches: [{ postId: "a", status: "sending", cat: { pair: STOCK } }, { postId: "b", status: "prepared", cat: { pair: { ...SOL_PAIR } } }] }, { except: "a" }), [SOL_PAIR.mint]);
  // A file that cannot be read: the pairs in use are unknown, so no stock pair is used.
  assert.deepEqual(sol(ctx({ collection: null })), ["pump-sol", "SOL"]);
  // Only a watch-list tie routes: the same cat untied, or tied to a symbol that is no stock pair, launches in SOL.
  assert.deepEqual(sol(ctx({ watch: WATCH })), ["pump-sol", "SOL"]);
  assert.deepEqual(sol(ctx({ watch: { ...WATCH, figures: [{ ...FIGURE, stock: "NOPE" }] } })), ["pump-sol", "SOL"]);
  // The ledger row keeps its venue and pair together.
  assert.match(rowProblem({ ...row, cat: { ...row.cat, pair: { ...SOL_PAIR } } }), /pair is not one stonkfun launches in/);
  assert.match(rowProblem({ ...row, venue: "pump-sol" }), /pair is not one pump-sol launches in/);
  assert.match(rowProblem({ ...row, fallback: "stonkfun: no" }), /fallback/, "a fallback only on pump.fun in SOL");
  assert.equal(rowProblem({ ...row, venue: "pump-sol", cat: { ...row.cat, pair: { ...SOL_PAIR } }, fallback: "stonkfun: StonkFun answered HTTP 503" }), null);
  // The X post is drafted for both launchpads: StonkFun, and PumpFun should it fall back.
  assert.ok(draftLaunch({ id: "GLOOP", name: "Sir Gloopington" }, { coinName: "Sir Gloopington", ticker: "GLOOP", lore: p.reading.lore, launchpad: "stonkfun" }).text.includes("launched by the sanctuary on StonkFun"));
});

test("routing a candidate to a coin: pump.fun priced in a coin data/pump-quotes.json lists, only with the owner's opt-in (LAUNCH_PUMP_QUOTE)", () => {
  const ctx = (extra = {}) => ({ nowMs: NOW, approvals: new Set(), watch: WATCH_COIN, ledger: { launches: [] }, adoptables: shipped(FILES.adoptables),
    planned: JSON.parse(readRoot("data/planned.json")), collection: { cats: [] }, pumpQuotes: QUOTES, pumpQuoteOptIn: true, ...extra });
  const p = post("2100000000000000811");
  const { row, route } = candidateRow(p, ctx());
  assert.equal(rowProblem(row), null);
  assert.deepEqual([row.venue, row.cat.pair, route.reason], ["pump-quote", MEOW_PAIR, "pump_quote"]);
  assert.deepEqual([candidateRow(p, ctx({ pumpQuoteOptIn: false })).row.venue, candidateRow(p, ctx({ pumpQuoteOptIn: false })).route.reason], ["pump-sol", "quote_unverified"]);
  assert.deepEqual([candidateRow(p, ctx({ pumpQuotes: [] })).row.venue, candidateRow(p, ctx({ pumpQuotes: [] })).route.reason], ["pump-sol", "quote_not_listed"]);
});

/** The site's stock pair for the StonkFun tests: tOpenAI, the one StonkFun's recorded pricing answer is for (no planned cat has it). */
function freed(adoptables) { return { ...adoptables, cats: adoptables.cats.filter((c) => c.pair?.mint !== STOCK.mint) }; }

/** A throwaway site whose watch-list figure is tied to the stock pair, with that pair free (whatever the shipped data holds). */
function stonkSite(opts = {}) {
  const t = site({ watch: WATCH_TIED, ...opts });
  const a = t.json(FILES.adoptables), c = t.json(FILES.collection);
  fs.writeFileSync(path.join(t.root, FILES.adoptables), `${JSON.stringify(freed(a), null, 2)}\n`);
  fs.writeFileSync(path.join(t.root, FILES.collection), `${JSON.stringify({ ...c, cats: c.cats.filter((e) => e.pair?.mint !== STOCK.mint) }, null, 2)}\n`);
  return t;
}

/**
 * StonkFun's pricing API as the launcher reaches it (its recorded tOpenAI answer, observed "now" by `clock`), in front of the
 * fake site; `status` other than 200 is an error answer. Every URL asked is kept. The fake Solana gets the GlobalConfig the answer
 * names: LaunchLab's, for this stock (GMEx's recorded config with its quote mint set to the stock's).
 */
function stonkfunApi(web, sol, c, { status = 200, config = true } = {}) {
  // DexScreener (the prices anchored before a StonkFun build) answers with the answer's own prices unless told
  // otherwise: dex "down" (HTTP 503), "none" (no pair), or a factor the quote's DexScreener price is scaled by.
  const api = { asked: [], dexAsked: [], status, dex: 1 };
  const answer = PRICING.answers.find((a) => a.body.data.quote.mint === STOCK.mint);
  const configId = answer.body.data.curve.configId;
  if (config) {
    const gmex = recordedAccounts().get("2TygvvGwVLxpJaGfQkFtGFzgvRMQmcFi6fM6iceLTTpu");
    const data = Buffer.from(gmex.data[0], "base64");
    Buffer.from(base58Decode(STOCK.mint)).copy(data, 83);
    sol.accounts.set(configId, { ...gmex, data: [data.toString("base64"), "base64"] });
  }
  api.fetchImpl = async (url, init) => {
    if (String(url).startsWith(DEXSCREENER_TOKENS_URL)) {
      api.dexAsked.push(String(url));
      if (api.dex === "down") return new Response("unavailable", { status: 503 });
      const mint = String(url).slice(DEXSCREENER_TOKENS_URL.length + 1);
      const isSol = mint === WRAPPED_SOL_MINT;
      const price = isSol ? answer.body.data.prices.solUsd : answer.body.data.prices.quoteUsd * (api.dex === "none" ? 1 : api.dex);
      const pairs = api.dex === "none" ? [] : [
        { chainId: "solana", pairAddress: "thin", baseToken: { address: mint }, priceUsd: String(price * 3), liquidity: { usd: 10 } },
        { chainId: "solana", pairAddress: "deep", baseToken: { address: mint }, priceUsd: String(price), liquidity: { usd: 5_000_000 } },
      ];
      return new Response(JSON.stringify(pairs), { status: 200 });
    }
    if (!String(url).startsWith(PRICING_URL)) return web.fetchImpl(url, init);
    api.asked.push(String(url));
    if (api.status !== 200) return new Response(JSON.stringify({ error: { code: "unavailable" } }), { status: api.status });
    const body = structuredClone(answer.body);
    body.data.prices.observedAt = new Date(c.now()).toISOString();
    return new Response(JSON.stringify(body), { status: 200 });
  };
  api.configId = configId;
  return api;
}

test("a StonkFun launch end to end: priced in its free stock pair, StonkFun's pricing fetched right before the build and its config read back, simulated, sent, proved as the Collection proves it; recorded with launchpad stonkfun; the card links StonkFun; the X post says StonkFun; the pair is then taken", async () => {
  const w = throwaway();
  const t = stonkSite({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const api = stonkfunApi(web, sol, c);
  const logs = [];
  const p = await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: api.fetchImpl, now: c.now, log: (l) => logs.push(l) });
  assert.equal(p.prepared, "2100000000000000001");
  assert.ok(logs.some((l) => l.includes("on StonkFun, priced in tOpenAI (stock)")), logs.join("\n"));
  assert.equal(api.asked.length, 0, "prepare never asks StonkFun: the pricing is fetched right before the build");
  let row = t.json(FILES.ledger).launches[0];
  assert.deepEqual([row.venue, row.cat.pair], ["stonkfun", STOCK]);
  web.deployed = true;
  const s = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: api.fetchImpl, now: c.now, sleep: c.sleep, log: (l) => logs.push(l), ...quick });
  assert.deepEqual([s.outcome, s.launched, s.code], ["launched", true, 0]);
  assert.deepEqual(api.asked, [`${PRICING_URL}?quoteMint=${STOCK.mint}`], "the pricing, once, for this stock");
  assert.deepEqual(api.dexAsked, [`${DEXSCREENER_TOKENS_URL}/${WRAPPED_SOL_MINT}`, `${DEXSCREENER_TOKENS_URL}/${STOCK.mint}`], "both prices anchored on DexScreener before the build");
  const methods = sol.methods();
  assert.ok(methods.indexOf("getMultipleAccounts") < methods.indexOf("simulateTransaction"));
  assert.ok(sol.calls.some((x) => x.method === "getMultipleAccounts" && x.params[0][0] === api.configId), "the config StonkFun named, read back before the build");
  assert.equal(sol.calls.filter((x) => x.method === "sendTransaction").length, 1);
  // What went out is a StonkFun launch the Collection proves: the wallet's, priced in the stock, no dev buy, nothing else.
  row = t.json(FILES.ledger).launches[0];
  const tx = sol.txs.get(row.tx);
  const proof = proveLaunch(structuredClone(tx), { wallet: w.address });
  assert.ok(proof.ok, proof.detail);
  assert.deepEqual([proof.launch.mint, proof.launch.pair, proof.launch.name, proof.launch.symbol, proof.launch.uri],
    [deriveMintKeypair(w.kp, row.postId).publicKey, STOCK, "Sir Gloopington", "GLOOP", metadataUri(row.postId)]);
  const programs = decompileInstructions(decodeTransaction(Buffer.from(sol.calls.find((x) => x.method === "sendTransaction").params[0], "base64")).message).map((ix) => ix.programId);
  assert.deepEqual(programs, ["ComputeBudget111111111111111111111111111111", "ComputeBudget111111111111111111111111111111", LAUNCHLAB_PROGRAM], "compute budget and the initialize: no buy, no token account, no transfer");
  assert.deepEqual([row.status, row.venue, row.cat.pair, row.fallback], ["launched", "stonkfun", STOCK, undefined]);
  // Recorded: the adoptable is priced in the stock and launched on StonkFun.
  const r = record({ io: t.io, env: ON(w), now: c.now, log: (l) => logs.push(l) });
  assert.deepEqual(r.recorded, ["GLOOP"]);
  const cat = t.json(FILES.adoptables).cats.find((x) => x.ticker === "GLOOP");
  assert.deepEqual([cat.pair, cat.launch.launchpad, cat.launch.mint, cat.launch.tx], [STOCK, "stonkfun", row.mintPublic, row.tx]);
  assert.ok(t.json(FILES.launches).launches.some((l) => l.tx === row.tx));
  // The Collection proves it (a StonkFun entry: no launchpad field); the page shows it launched on StonkFun, on the cat's own card.
  const L = proof.launch;
  const collection = t.json(FILES.collection);
  collection.cats.unshift({ mint: L.mint, name: L.name, symbol: L.symbol, pair: L.pair, pool: L.pool, payer: L.payer, tx: L.tx, time: L.time });
  fs.writeFileSync(path.join(t.root, FILES.collection), JSON.stringify(collection));
  assert.equal(validateCollection(collection, { wallets: validateWallets(t.json(FILES.wallets)), nowMs: DATA_NOW }).refused.length, 0);
  const all = await pageOf(t);
  const g = all.find((x) => x.id === "GLOOP");
  assert.deepEqual([g.kind, g.sanctuaryLaunch?.status, g.sanctuaryLaunch?.launchpad, isLaunched(g), g.token.mint, g.pair.symbol], ["adoptable", "launched", "stonkfun", true, row.mintPublic, "tOpenAI"]);
  assert.equal(g.explorer.stonkfun, `https://www.stonkfun.xyz/token/${row.mintPublic}`);
  assert.equal(g.explorer.pumpfun, undefined);
  assert.equal(all.filter((x) => x.token?.mint === row.mintPublic).length, 1, "one card, not a bare token card too");
  // The X post names StonkFun.
  const text = await launchPostOf(t);
  assert.ok(text.includes("Sir Gloopington (GLOOP), launched by the sanctuary on StonkFun"), text);
  assert.ok(!text.includes(row.mintPublic) && !/[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text), "no address");
  // One cat per stock pair: the next cat tied to the same stock launches in SOL.
  const next = candidateRow(post("2100000000000000002", { name: "Plinko Cat", ticker: "PLINKO", figure: "Plinko Cat", lore: "Plinko Cat drops through the pegs." }),
    { nowMs: c.now(), approvals: new Set(), watch: { ...WATCH_TIED, figures: [{ ...WATCH.figures[1], stock: STOCK.symbol }] }, ledger: t.json(FILES.ledger),
      adoptables: t.json(FILES.adoptables), planned: t.json(FILES.planned), collection: t.json(FILES.collection) });
  assert.deepEqual([next.row.venue, next.route.reason], ["pump-sol", "pair_taken"]);
});

test("the fallback, before the send only: StonkFun's pricing down, its prices not anchored on DexScreener (down, no pair, a quote price 20% off or scaled by 1e-6 or 1e6), its config wrong, its simulation failing, its pair taken since prepare: the cat goes out on pump.fun in SOL that run, and the row says why", async () => {
  const cases = [
    ["pricing", (h) => { h.api.status = 503; }, /StonkFun answered HTTP 503/, 1],
    ["DexScreener down", (h) => { h.api.dex = "down"; }, /DexScreener answered HTTP 503/, 1],
    ["DexScreener no pair", (h) => { h.api.dex = "none"; }, /DexScreener has no pair with a price/, 1],
    ["quote price 20% off", (h) => { h.api.dex = 1.2; }, /price .* is not within 15% of DexScreener's/, 1],
    ["quote price scaled by 1e-6", (h) => { h.api.dex = 1e-6; }, /price .* is not within 15% of DexScreener's/, 1],
    ["quote price scaled by 1e6", (h) => { h.api.dex = 1e6; }, /price .* is not within 15% of DexScreener's/, 1],
    ["config", (h) => { h.sol.accounts.delete(h.api.configId); }, /config for tOpenAI: the config is not a LaunchLab account/, 1],
    ["simulation", (h) => { h.sol.s.simErrOnce = { InstructionError: [2, { Custom: 6001 }] }; }, /the simulation did not pass \(\{"InstructionError"/, 1],
    ["cost", (h) => { h.sol.s.lossOnce = 40_000_000; }, /it would cost 0\.04\d* SOL, more than LAUNCH_MAX_SOL_PER_LAUNCH \(0\.03 SOL\)/, 1],
    ["pair", (h) => { const a = h.t.json(FILES.adoptables); a.cats[0] = { ...a.cats[0], pair: STOCK }; fs.writeFileSync(path.join(h.t.root, FILES.adoptables), JSON.stringify(a)); }, /its stock pair tOpenAI has a sanctuary cat now/, 0],
  ];
  for (const [what, breakIt, why, pricingAsks] of cases) {
    const w = throwaway();
    const t = stonkSite({ wallet: w.address });
    const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
    const api = stonkfunApi(web, sol, c);
    await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: api.fetchImpl, now: c.now });
    assert.equal(t.json(FILES.ledger).launches[0].venue, "stonkfun", what);
    web.deployed = true;
    breakIt({ t, sol, api });
    const logs = [];
    const s = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: api.fetchImpl, now: c.now, sleep: c.sleep, log: (l) => logs.push(l), ...quick });
    assert.deepEqual([s.outcome, s.launched], ["launched", true], `${what}: ${logs.join("\n")}`);
    assert.equal(api.asked.length, pricingAsks, what);
    assert.ok(logs.some((l) => /StonkFun failed before anything was sent .*; it launches on pump\.fun in SOL this run\./.test(l)), what);
    assert.equal(sol.calls.filter((x) => x.method === "sendTransaction").length, 1, `${what}: one send, on pump.fun`);
    const row = t.json(FILES.ledger).launches[0];
    assert.deepEqual([row.venue, row.cat.pair], ["pump-sol", { ...SOL_PAIR }], what);
    assert.match(row.fallback, /^stonkfun: /, what);
    assert.match(row.fallback, why, what);
    assert.equal(rowProblem(row), null, what);
    assert.ok(proveLaunchPump(structuredClone(sol.txs.get(row.tx)), { wallet: w.address }).ok, `${what}: a pump.fun launch in SOL`);
    // The same metadata file served all along; recorded as a pump.fun cat in SOL; its post says PumpFun.
    assert.equal(t.read(row.metadataPath), metadataText(coinMetadata(row)), what);
    record({ io: t.io, env: ON(w), now: c.now });
    const cat = t.json(FILES.adoptables).cats.find((x) => x.ticker === "GLOOP");
    assert.deepEqual([cat.pair, cat.launch.launchpad], [{ ...SOL_PAIR }, "pump.fun"], what);
  }
});

test("never a fallback after a send, and a fallback holds for its run only: a StonkFun launch that fails on chain or that the RPC refuses stays StonkFun; a SOL fallback whose own simulation fails leaves the row on StonkFun for its next try", async () => {
  // Failed on chain: the row is failed (tried again later, same mint), still StonkFun; nothing else was sent.
  for (const [what, breakIt] of [["on chain", (sol) => { sol.s.land = "error"; }], ["refused", (sol) => { sol.s.refuse = "Transaction simulation failed"; }]]) {
    const w = throwaway();
    const t = stonkSite({ wallet: w.address });
    const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
    const api = stonkfunApi(web, sol, c);
    await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: api.fetchImpl, now: c.now });
    web.deployed = true;
    breakIt(sol);
    await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: api.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
    const row = t.json(FILES.ledger).launches[0];
    assert.deepEqual([row.status, row.venue, row.cat.pair, row.retry, row.fallback], ["failed", "stonkfun", STOCK, true, undefined], what);
    assert.equal(sol.calls.filter((x) => x.method === "sendTransaction").length, 1, `${what}: sent once, never again on another venue`);
  }
  // Both simulations fail: nothing sent; the row keeps StonkFun, one attempt used.
  const w = throwaway();
  const t = stonkSite({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const api = stonkfunApi(web, sol, c);
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: api.fetchImpl, now: c.now });
  web.deployed = true;
  sol.s.simErr = { InstructionError: [0, "InsufficientFundsForRent"] };
  const s = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: api.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.equal(s.outcome, "simulation_failed");
  assert.equal(sol.calls.filter((x) => x.method === "simulateTransaction").length, 2, "StonkFun's, then pump.fun's in SOL");
  assert.ok(!sol.methods().includes("sendTransaction"));
  const row = t.json(FILES.ledger).launches[0];
  assert.deepEqual([row.status, row.venue, row.cat.pair, row.attempts, row.retry, row.fallback], ["failed", "stonkfun", STOCK, 1, true, undefined]);
  assert.match(row.reason, /on pump\.fun in SOL, after its own venue failed/);
  assert.equal(rowProblem(row), null);
});

test("dry mode on StonkFun: the pricing, the config and the simulation, nothing sent and nothing written; a lost commit after a fallback is recovered from the chain as the pump.fun launch it was", async () => {
  const w = throwaway();
  const t = stonkSite({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const api = stonkfunApi(web, sol, c);
  const dry = { LAUNCH_ENABLED: "dry", LAUNCH_WALLET_KEY: w.base58, LAUNCH_CHARACTERS: "on", LAUNCH_PAIRS: "on" };
  const logs = [];
  const d = await send({ io: t.io, env: dry, rpc: sol.rpc, fetchImpl: api.fetchImpl, now: c.now, sleep: c.sleep, log: (l) => logs.push(l), ...quick });
  assert.deepEqual([d.outcome, d.venue], ["dry", "stonkfun"]);
  assert.equal(api.asked.length, 1);
  assert.ok(logs.some((l) => l.includes("simulates cleanly on StonkFun, priced in tOpenAI")), logs.join("\n"));
  assert.ok(!sol.methods().includes("sendTransaction"));
  assert.deepEqual(t.json(FILES.ledger).launches, []);
  // Recovery: a StonkFun row fell back and went out on pump.fun in SOL, but the "sending" commit was lost.
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: api.fetchImpl, now: c.now });
  const prepared = t.read(FILES.ledger);
  web.deployed = true;
  api.status = 500;
  assert.equal((await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: api.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "launched");
  const sent = t.json(FILES.ledger).launches[0];
  fs.writeFileSync(path.join(t.root, FILES.ledger), prepared);
  assert.equal(t.json(FILES.ledger).launches[0].venue, "stonkfun");
  api.status = 200;
  const r = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: api.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.equal(r.outcome, "recovered");
  assert.equal(sol.calls.filter((x) => x.method === "sendTransaction").length, 1, "never sent twice");
  const row = t.json(FILES.ledger).launches[0];
  assert.deepEqual([row.status, row.venue, row.cat.pair, row.tx, row.mintPublic], ["launched", "pump-sol", { ...SOL_PAIR }, sent.tx, sent.mintPublic]);
  assert.match(row.fallback, /^stonkfun: recovered on chain as a launch on pump\.fun in SOL/);
  assert.equal(rowProblem(row), null);
});

test("a coin-priced pump.fun launch with the owner's opt-in: built for the listed coin, proved with the list, recorded priced in it, and shown launched by the page (which reads data/pump-quotes.json); the opt-in withdrawn before the send: SOL", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address, watch: WATCH_COIN, quotes: [MEOW] });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const env = ON(w, { LAUNCH_PUMP_QUOTE: "on" });
  await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  assert.deepEqual([t.json(FILES.ledger).launches[0].venue, t.json(FILES.ledger).launches[0].cat.pair], ["pump-quote", MEOW_PAIR]);
  web.deployed = true;
  const s = await send({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.equal(s.outcome, "launched");
  const row = t.json(FILES.ledger).launches[0];
  const tx = structuredClone(sol.txs.get(row.tx));
  assert.equal(proveLaunchPump(tx, { wallet: w.address }).clause, "pump_quote_not_allowed", "not a SOL launch");
  const proof = proveLaunchPump(tx, { wallet: w.address, quotes: QUOTES });
  assert.ok(proof.ok, proof.detail);
  assert.deepEqual([row.venue, proof.launch.pair], ["pump-quote", MEOW_PAIR]);
  record({ io: t.io, env, now: c.now });
  const cat = t.json(FILES.adoptables).cats.find((x) => x.ticker === "GLOOP");
  assert.deepEqual([cat.pair, cat.launch.launchpad], [MEOW_PAIR, "pump.fun"]);
  // The Collection lists it with its coin as the pair; the page shows it launched while data/pump-quotes.json lists the coin.
  const L = proof.launch;
  const collection = t.json(FILES.collection);
  collection.cats.unshift({ mint: L.mint, name: L.name, symbol: L.symbol, pair: L.pair, pool: L.pool, payer: L.payer, tx: L.tx, time: L.time, launchpad: L.launchpad });
  fs.writeFileSync(path.join(t.root, FILES.collection), JSON.stringify(collection));
  let g = (await pageOf(t)).find((x) => x.id === "GLOOP");
  assert.deepEqual([g.sanctuaryLaunch.status, isLaunched(g), g.pair.symbol, g.explorer.pumpfun], ["launched", true, "MEOW", `https://pump.fun/coin/${row.mintPublic}`]);
  assert.ok((await launchPostOf(t)).includes("launched by the sanctuary on PumpFun"));
  fs.rmSync(path.join(t.root, FILES.pumpQuotes));
  g = (await pageOf(t)).find((x) => x.id === "GLOOP");
  assert.deepEqual([g.sanctuaryLaunch.status, isLaunched(g)], ["pending", false], "no list: the page does not show a coin-priced coin");

  // The opt-in withdrawn between prepare and send: the cat goes out in SOL.
  const w2 = throwaway();
  const t2 = site({ wallet: w2.address, watch: WATCH_COIN, quotes: [MEOW] });
  const sol2 = fakeSolana({ wallet: w2.address }), web2 = fakeSite(t2.root), c2 = clock();
  await prepare({ io: t2.io, env: ON(w2, { LAUNCH_PUMP_QUOTE: "on" }), rpc: sol2.rpc, fetchImpl: web2.fetchImpl, now: c2.now });
  web2.deployed = true;
  assert.equal((await send({ io: t2.io, env: ON(w2), rpc: sol2.rpc, fetchImpl: web2.fetchImpl, now: c2.now, sleep: c2.sleep, ...quick })).outcome, "launched");
  const row2 = t2.json(FILES.ledger).launches[0];
  assert.deepEqual([row2.venue, row2.cat.pair], ["pump-sol", { ...SOL_PAIR }]);
  assert.match(row2.fallback, /^pump-quote: the owner has not opted in/);
  assert.ok(proveLaunchPump(structuredClone(sol2.txs.get(row2.tx)), { wallet: w2.address }).ok);
});

test("a signed launch's signature and fee bound, read from its bytes", async () => {
  const w = throwaway();
  const mint = deriveMintKeypair(w.kp, "2100000000000000701");
  const built = await PUMP_SOL.build({ wallet: w.address, mint: mint.publicKey, name: "Sir Gloopington", symbol: "GLOOP", uri: metadataUri("2100000000000000701"), recentBlockhash: base58Encode(randomBytes(32)) });
  const signed = PUMP_SOL.sign(built, w.kp, mint);
  assert.equal(signatureOf(signed), transactionToJson(new Uint8Array(Buffer.from(signed, "base64"))).transaction.signatures[0]);
  assert.equal(feeUpperBound(signed), 2 * 5_000 + 20_000, "two signatures, 200,000 units at 100,000 micro-lamports");
});

test("the launcher's RPC calls, as rpc.mjs asks them", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { const b = JSON.parse(init.body); calls.push([b.method, b.params]); return new Response(JSON.stringify({ jsonrpc: "2.0", id: b.id, result: b.method === "sendTransaction" ? "sig" : { value: 1 } }), { status: 200 }); };
  const rpc = createRpc({ url: "https://rpc.example.test", fetchImpl, delayMs: 0 });
  await rpc.getLatestBlockhash(); await rpc.getBalance("11111111111111111111111111111112"); await rpc.getBlockHeight();
  await rpc.simulateTransaction("AAA=", { addresses: ["W"] }); await rpc.sendTransaction("AAA="); await rpc.getSignatureStatuses(["s"]);
  await rpc.getTransaction("s", { commitment: "confirmed" }); await rpc.getMultipleAccounts(["m"], { commitment: "confirmed" }); await rpc.getSignaturesForAddress("m", { limit: 5, commitment: "confirmed" });
  assert.deepEqual(calls, [
    ["getLatestBlockhash", [{ commitment: "confirmed" }]],
    ["getBalance", ["11111111111111111111111111111112", { commitment: "confirmed" }]],
    ["getBlockHeight", [{ commitment: "finalized" }]],
    ["simulateTransaction", ["AAA=", { encoding: "base64", sigVerify: false, replaceRecentBlockhash: false, commitment: "confirmed", accounts: { encoding: "base64", addresses: ["W"] } }]],
    ["sendTransaction", ["AAA=", { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 5 }]],
    ["getSignatureStatuses", [["s"], { searchTransactionHistory: true }]],
    ["getTransaction", ["s", { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]],
    ["getMultipleAccounts", [["m"], { encoding: "base64", commitment: "confirmed" }]],
    ["getSignaturesForAddress", ["m", { limit: 5, commitment: "confirmed" }]],
  ]);
});

test("the watch list lets go of a figure once it lives in the sanctuary (so the trend watch's own checks stay true)", () => {
  assert.deepEqual(figuresAtHome(WATCH, ["Sir Gloopington", "Sir Gloopington", "GLOOP"]), ["Sir Gloopington"]);
  assert.deepEqual(figuresAtHome(WATCH, ["Gloopington Junior"]), ["Sir Gloopington"], "an alias inside a cat's name");
  assert.deepEqual(figuresAtHome(WATCH, ["Plinko"]), ["Plinko Cat"], "a figure's name with \"Cat\" after a cat's name");
  assert.deepEqual(figuresAtHome(WATCH, ["Quillbert", "QUILL"]), []);
  assert.deepEqual(figuresAtHome(WATCH, ["PLINKO"]), ["Plinko Cat"], "a figure's ticker taken");
  assert.deepEqual(figuresAtHome({ figures: [{ name: "Tom", aliases: ["Tom and Jerry"], matchOnlyAliases: true, ticker: "TOMCAT" }] }, ["Tom & Jerry"]), ["Tom"], "\"&\" is \"and\"");
  // The file's own layout: handles a few to a line, one figure a line.
  const layout = '{\n "note": "n",\n "topAccounts": [\n  "a", "b"\n ],\n "figures": [\n  { "name": "X Cat", "aliases": ["Y"], "coat": { "base": "grey", "second": "", "pattern": "solid", "eyes": "" } },\n  { "name": "Z" }\n ]\n}\n';
  assert.equal(watchText(JSON.parse(layout)), layout);
  // The shipped figures' launcher fields: optional, and valid when there.
  for (const f of WATCH.figures) {
    if (f.look !== undefined) assert.ok(typeof f.look === "string" && f.look.length >= 20 && f.look.length <= 600, f.name);
    if (f.coat !== undefined) assert.equal(coatProblem(f.coat), null, f.name);
    if (f.owner !== undefined) assert.ok(typeof f.owner === "string" && f.owner.length >= 2 && f.owner.length <= 120, f.name);
    if (f.category !== undefined) assert.ok(ADOPTABLE_CATEGORIES.includes(f.category), f.name);
  }
});

/* ── review fixes: money safety, robustness, the owner's hand-edited files ────────────────────────── */

/** A transaction's message (base64 in), as bytes: what its signatures sign. */
const messageBytesOf = (b64) => decodeTransaction(new Uint8Array(Buffer.from(b64, "base64"))).messageBytes;

test("nothing signed leaves the runner before the send: every simulation is of the launch UNSIGNED (a dry run, a cap refusal, pump.fun, StonkFun), and the ledger's tx is the signature of what was sent", async () => {
  const w = throwaway(), c = clock();
  // A dry run: simulated, never signed.
  const t = site({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root);
  const dry = await send({ io: t.io, env: { LAUNCH_ENABLED: "dry", LAUNCH_WALLET_KEY: w.base58, LAUNCH_CHARACTERS: "on", LAUNCH_PAIRS: "on" }, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.equal(dry.outcome, "dry");
  assert.equal(sol.simulated.length, 1);
  assert.ok(sol.simulated.every(unsignedTx), "a dry run hands the RPC no signature (a signed copy could be replayed by its operator)");
  // A cap refusal: simulated unsigned, nothing sent.
  const t2 = site({ wallet: w.address });
  const sol2 = fakeSolana({ wallet: w.address, loss: 31_000_000 }), web2 = fakeSite(t2.root);
  await prepare({ io: t2.io, env: ON(w), rpc: sol2.rpc, fetchImpl: web2.fetchImpl, now: c.now });
  web2.deployed = true;
  assert.equal((await send({ io: t2.io, env: ON(w), rpc: sol2.rpc, fetchImpl: web2.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "cap");
  assert.ok(sol2.simulated.length === 1 && sol2.simulated.every(unsignedTx), "a refused launch was never signed");
  assert.ok(!sol2.methods().includes("sendTransaction"));
  // StonkFun, sent: simulated unsigned; what was sent is that very message, signed, and the ledger's tx is its signature.
  const t3 = stonkSite({ wallet: w.address });
  const sol3 = fakeSolana({ wallet: w.address }), web3 = fakeSite(t3.root);
  const api = stonkfunApi(web3, sol3, c);
  await prepare({ io: t3.io, env: ON(w), rpc: sol3.rpc, fetchImpl: api.fetchImpl, now: c.now });
  web3.deployed = true;
  assert.equal((await send({ io: t3.io, env: ON(w), rpc: sol3.rpc, fetchImpl: api.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "launched");
  const sent = sol3.calls.find((x) => x.method === "sendTransaction").params[0];
  assert.ok(sol3.simulated.length === 1 && sol3.simulated.every(unsignedTx));
  assert.deepEqual(messageBytesOf(sol3.simulated[0]), messageBytesOf(sent), "what was simulated is what was sent");
  assert.ok(!unsignedTx(sent));
  assert.equal(t3.json(FILES.ledger).launches[0].tx, signatureOf(sent));
  // Each venue's unsigned form: the checks its signing makes, then zero-filled signature slots.
  const mint = deriveMintKeypair(w.kp, "2100000000000000701");
  const built = await PUMP_SOL.build({ wallet: w.address, mint: mint.publicKey, name: "Sir Gloopington", symbol: "GLOOP", uri: metadataUri("2100000000000000701"), recentBlockhash: base58Encode(randomBytes(32)) });
  const unsigned = PUMP_SOL.unsigned(built);
  assert.ok(unsignedTx(unsigned));
  assert.deepEqual(messageBytesOf(unsigned), messageBytesOf(PUMP_SOL.sign(built, w.kp, mint)));
  const other = throwaway().address;
  for (const v of [PUMP_SOL, PUMP_QUOTE]) assert.throws(() => v.unsigned({ ...built, wallet: other }), /wallet|payer|signer/i, `${v.id}: a message its signing would refuse`);
  for (const v of [PUMP_SOL, STONKFUN, PUMP_QUOTE]) assert.equal(typeof v.unsigned, "function", v.id);
  assert.throws(() => registerVenue({ ...PUMP_SOL, id: "x-test4", unsigned: undefined }), /unsigned must be a function/);
});

test("a send answered with an error only after the client posted it again (its first answer lost), or refused as already processed, went out: the row stays \"sending\" with its tx, holds its name and the day's count, and settles as launched; only an error answered to the first and only post is a refusal", async () => {
  const already = "Transaction simulation failed: This transaction has already been processed";
  for (const [what, answers] of [["already processed, after a lost answer", ["502", already]], ["any error, after a lost answer", ["502", "Transaction simulation failed: Blockhash not found"]], ["already processed, the first answer", [already]]]) {
    const w = throwaway();
    const t = site({ wallet: w.address });
    const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
    await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
    web.deployed = true;
    // The first post reaches the node and the launch lands; what the client hears back is `answers`, one per post.
    let posts = 0;
    const flaky = async (url, init) => {
      const b = JSON.parse(init.body);
      if (b.method !== "sendTransaction") return sol.fetchImpl(url, init);
      const answer = answers[posts++];
      if (posts === 1) await sol.fetchImpl(url, init);
      return answer === "502" ? new Response("bad gateway", { status: 502 }) : new Response(JSON.stringify({ jsonrpc: "2.0", id: b.id, error: { code: -32002, message: answer } }), { status: 200 });
    };
    const rpc = createRpc({ url: "https://rpc.example.test", fetchImpl: flaky, delayMs: 0, backoffMs: 0, retries: 1 });
    const r = await send({ io: t.io, env: ON(w), rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
    assert.deepEqual([r.outcome, r.code, posts], ["sending", 1, answers.length], what);
    const row = t.json(FILES.ledger).launches[0];
    assert.deepEqual([row.status, row.tx, Number.isSafeInteger(row.lastValidBlockHeight)], ["sending", sol.sent[0].sig, true], `${what}: never "refused, nothing went out"`);
    const ledger = validateLedger(t.json(FILES.ledger));
    assert.equal(dayStats(ledger, c.now(), launchCaps({})).count, 1, what);
    assert.ok(takenNames({ ledger }).has("gloop"), what);
    // Settled by its signature: launched; the post never goes out twice.
    await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
    assert.deepEqual([t.json(FILES.ledger).launches[0].status, sol.sent.length], ["launched", 1], what);
  }
});

test("only a definite preflight or validation failure (-32002, -32602) to the first post is a refusal: an internal error (-32603) to a post that went out and landed keeps the row \"sending\" and settles as launched; one that never landed is failed only by the chain check (its blockhash's expiry)", async () => {
  for (const [what, code, lands, expect] of [
    ["-32603 Internal error, landed", -32603, true, { first: "sending", settled: "launched" }],
    ["-32603 Internal error, never landed", -32603, false, { first: "sending", settled: "failed" }],
    ["-32000 server error, landed", -32000, true, { first: "sending", settled: "launched" }],
    ["-32002 preflight failure", -32002, false, { first: "refused" }],
    ["-32602 invalid params", -32602, false, { first: "refused" }],
  ]) {
    const w = throwaway();
    const t = site({ wallet: w.address });
    const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
    await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
    web.deployed = true;
    if (!lands) sol.s.land = "never";
    let posts = 0;
    const answering = async (url, init) => {
      const b = JSON.parse(init.body);
      if (b.method !== "sendTransaction") return sol.fetchImpl(url, init);
      posts++;
      if (code !== -32002 && code !== -32602) await sol.fetchImpl(url, init);   // it reached the node and went out
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: b.id, error: { code, message: code === -32603 ? "Internal error" : "some error" } }), { status: 200 });
    };
    const rpc = createRpc({ url: "https://rpc.example.test", fetchImpl: answering, delayMs: 0, backoffMs: 0, retries: 1 });
    const r = await send({ io: t.io, env: ON(w), rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
    assert.equal(posts, 1, what);
    const row = t.json(FILES.ledger).launches[0];
    if (expect.first === "refused") {
      assert.deepEqual([r.outcome, row.status, row.retry, row.tx], ["refused", "failed", true, undefined], what);
      continue;
    }
    assert.deepEqual([r.outcome, r.code, row.status, typeof row.tx, Number.isSafeInteger(row.lastValidBlockHeight)], ["sending", 1, "sending", "string", true], `${what}: never "refused, nothing went out"`);
    assert.ok(takenNames({ ledger: validateLedger(t.json(FILES.ledger)) }).has("gloop"), `${what}: the name is held`);
    // Days later (past the post's 48 hours): still settled only by the chain, never closed without a check.
    c.t += 72 * 3_600_000;
    if (!lands) sol.s.height = row.lastValidBlockHeight + 1;
    const statusCalls = sol.methods().filter((m) => m === "getSignatureStatuses").length;
    await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
    assert.ok(sol.methods().filter((m) => m === "getSignatureStatuses").length > statusCalls, `${what}: a chain check`);
    const settled = t.json(FILES.ledger).launches.find((x) => x.postId === row.postId);
    assert.equal(settled.status, expect.settled, what);
    assert.equal(sol.sent.length, 1, `${what}: the post never goes out twice`);
    if (!lands) assert.match(settled.reason, /expired/, what);
  }
});

test("the wallet's listing is checked again right before the send: a wallet whose \"until\" passed during the metadata wait sends nothing", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address, listWallet: false });
  const ws = JSON.parse(readRoot("data/wallets.json"));
  ws.launchers.push({ address: w.address, since: "2026-09-01", until: iso(NOW + 12 * 60_000), label: "Auto launcher" });
  fs.writeFileSync(path.join(t.root, FILES.wallets), JSON.stringify(ws));
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  // Listed now and in ten minutes; the site serves the metadata only 13 minutes on, after the wallet's "until".
  const slow = async (url, init) => { if (c.now() >= NOW + 13 * 60_000) web.deployed = true; return web.fetchImpl(url, init); };
  const logs = [];
  const r = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: slow, now: c.now, sleep: c.sleep, log: (l) => logs.push(l), metadataWaitMs: 15 * 60_000, metadataPollMs: 20_000, confirmWaitMs: 30_000, confirmPollMs: 3_000 });
  assert.deepEqual([r.outcome, r.code], ["wallet_not_listed", 1]);
  assert.ok(!sol.methods().includes("sendTransaction"), "never a launch the Collection could not prove");
  assert.ok(logs.some((l) => /not an active launcher/.test(l)));
  assert.equal(t.json(FILES.ledger).launches[0].status, "prepared");
});

test("a launch that landed but is not proved yet (no block time in the RPC's answer; its coin taken off data/pump-quotes.json since) stays \"sending\": its name, its pair and its place in the day's count held, a person told; proved on a later run", async () => {
  // No block time on the first answer: unproved, then launched.
  const w = throwaway();
  const t = site({ wallet: w.address, posts: [post("2100000000000000001"), post("2100000000000000002", { h: 3, name: "Plinko Cat", ticker: "PLINKO", figure: "Plinko Cat", lore: "Plinko Cat drops through the pegs." })] });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const env = ON(w, { LAUNCH_MAX_PER_DAY: "1" });
  await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  web.deployed = true;
  sol.s.noTime = 1_000;                                                   // no block time for as long as the send waits
  const logs = [];
  const r = await send({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, log: (l) => logs.push(l), ...quick });
  assert.deepEqual([r.outcome, r.code], ["unproved", 1]);
  assert.ok(logs.some((l) => /^::error.*does not prove it as a launch \(no_time\)/.test(l)), logs.join("\n"));
  let ledger = validateLedger(t.json(FILES.ledger));
  assert.equal(ledger.launches[0].status, "sending", "never \"failed for good\": the coin exists");
  assert.equal(dayStats(ledger, c.now(), launchCaps(env)).count, 1);
  assert.ok(takenNames({ ledger }).has("gloop"));
  // Still no block time on the next run: still "sending", no other cat; once the answer has it, launched. No second coin.
  const again = await send({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.deepEqual([again.outcome, again.code, t.json(FILES.ledger).launches[0].status], ["unproved", 1, "sending"]);
  sol.s.noTime = 0;
  const p = await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  ledger = t.json(FILES.ledger);
  assert.deepEqual([ledger.launches[0].status, ledger.launches[0].launchedAt, p.prepared, sol.sent.length], ["launched", iso(NOW), null, 1]);

  // One answer with no block time while the send waits: the next poll proves it, in the same run.
  const w1 = throwaway();
  const t1 = site({ wallet: w1.address });
  const sol1 = fakeSolana({ wallet: w1.address }), web1 = fakeSite(t1.root);
  await prepare({ io: t1.io, env: ON(w1), rpc: sol1.rpc, fetchImpl: web1.fetchImpl, now: c.now });
  web1.deployed = true;
  sol1.s.noTime = 1;
  assert.deepEqual(await send({ io: t1.io, env: ON(w1), rpc: sol1.rpc, fetchImpl: web1.fetchImpl, now: c.now, sleep: c.sleep, ...quick }).then((x) => [x.outcome, x.code]), ["launched", 0]);

  // A coin-priced row whose coin the owner took off the list while it was "sending": proved with the pair it saved.
  const w2 = throwaway();
  const t2 = site({ wallet: w2.address, watch: WATCH_COIN, quotes: [MEOW] });
  const sol2 = fakeSolana({ wallet: w2.address }), web2 = fakeSite(t2.root);
  const env2 = ON(w2, { LAUNCH_PUMP_QUOTE: "on" });
  await prepare({ io: t2.io, env: env2, rpc: sol2.rpc, fetchImpl: web2.fetchImpl, now: c.now });
  web2.deployed = true;
  const crash = { ...sol2.rpc, sendTransaction: async (...a) => { await sol2.rpc.sendTransaction(...a); throw new TypeError("the connection was reset"); } };
  assert.equal((await send({ io: t2.io, env: env2, rpc: crash, fetchImpl: web2.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "sending");
  fs.writeFileSync(path.join(t2.root, FILES.pumpQuotes), JSON.stringify({ note: "test", quotes: [] }));
  await prepare({ io: t2.io, env: env2, rpc: sol2.rpc, fetchImpl: web2.fetchImpl, now: c.now });
  const row2 = t2.json(FILES.ledger).launches[0];
  assert.deepEqual([row2.status, row2.venue, row2.cat.pair, row2.mintPublic], ["launched", "pump-quote", MEOW_PAIR, deriveMintKeypair(w2.kp, row2.postId).publicKey]);
});

test("a launch recovered from the chain counts in the rolling 24 hours from its own block time, never from an earlier attempt's sentAt", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address, posts: [post("2100000000000000901", { h: 1 }), post("2100000000000000902", { h: 2, name: "Plinko Cat", ticker: "PLINKO", figure: "Plinko Cat", lore: "Plinko Cat drops through the pegs." })] });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const env = ON(w, { LAUNCH_MAX_PER_DAY: "1" });
  await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  web.deployed = true;
  // Attempt 1 goes out at T0 and never lands; its blockhash expires; the row is prepared again (keeping that sentAt).
  sol.s.land = "never";
  assert.equal((await send({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "sending");
  const firstSent = t.json(FILES.ledger).launches[0].sentAt;
  sol.s.height = sol.s.lastValid + 1;
  c.t += 20 * HOUR;
  await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  assert.deepEqual([t.json(FILES.ledger).launches[0].status, t.json(FILES.ledger).launches[0].sentAt], ["prepared", firstSent]);
  // 20 hours on it lands, but the job dies before its commit: main still says "prepared".
  const prepared = t.read(FILES.ledger);
  sol.s.land = "finalize"; sol.s.lastValid = sol.s.height + 150; sol.s.time = c.t;
  const landed = c.t;
  assert.equal((await send({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "launched");
  fs.writeFileSync(path.join(t.root, FILES.ledger), prepared);
  assert.equal((await send({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "recovered");
  const row = t.json(FILES.ledger).launches[0];
  assert.deepEqual([row.status, row.sentAt, row.launchedAt], ["launched", iso(landed), iso(landed)]);
  // Five hours after the real launch, the day's count still holds it: no second launch under a cap of one a day.
  c.t = landed + 5 * HOUR;
  assert.equal(dayStats(validateLedger(t.json(FILES.ledger)), c.now(), launchCaps(env)).count, 1);
  assert.equal((await prepare({ io: t.io, env, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now })).prepared, null);
  assert.equal(sol.sent.length, 2, "the lost attempt and the launch; nothing more");
});

test("a key rotated after a send whose record was lost: the launcher's other wallets (labelled as the setup says) are searched for the post's launch, which is recovered, never launched twice; the owner's own wallets are never searched", async () => {
  const a = throwaway(), b = throwaway();
  const t = site({ wallet: a.address });
  const ws = t.json(FILES.wallets);
  ws.launchers.push({ address: b.address, since: "2026-09-01", label: "Auto launcher 2" });
  fs.writeFileSync(path.join(t.root, FILES.wallets), JSON.stringify(ws));
  const sol = fakeSolana({ wallet: a.address }), web = fakeSite(t.root), c = clock();
  await prepare({ io: t.io, env: ON(a), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  web.deployed = true;
  const prepared = t.read(FILES.ledger);
  assert.equal((await send({ io: t.io, env: ON(a), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "launched");
  const first = t.json(FILES.ledger).launches[0];
  fs.writeFileSync(path.join(t.root, FILES.ledger), prepared);          // the commit lost; then LAUNCH_WALLET_KEY holds wallet B's key
  const logs = [];
  const r = await send({ io: t.io, env: ON(b), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, log: (l) => logs.push(l), ...quick });
  assert.deepEqual([r.outcome, r.launched], ["recovered", true]);
  assert.equal(sol.sent.length, 1, "one coin for one post, whatever the key");
  const row = t.json(FILES.ledger).launches[0];
  assert.deepEqual([row.status, row.tx, row.mintPublic], ["launched", first.tx, first.mintPublic]);
  assert.ok(logs.some((l) => l.includes(`sent by the launcher wallet ${a.address}`)));
  // Which wallets are searched: the launcher's own (the label walletInstructions gives), active since the row was prepared.
  const owner = throwaway().address, old = throwaway().address;
  const list = { launchers: [{ address: owner, since: "2026-09-01", label: "Owner" }, { address: a.address, since: "2026-09-01", label: "Auto launcher" },
    { address: old, since: "2026-01-01", until: "2026-02-01", label: "Auto launcher (old)" }, { address: b.address, since: "2026-09-01", label: "Auto launcher 2" }] };
  assert.deepEqual(otherLauncherWallets(list, b.address, { sinceMs: NOW - HOUR, nowMs: NOW }), [a.address]);
  assert.ok(walletInstructions(a.address, NOW).join("\n").includes('"label": "Auto launcher"'));
});

test("a busy coin's unrecorded launch is found in the wallet's own short history, however many trades bury its create in the coin's", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  web.deployed = true;
  const prepared = t.read(FILES.ledger);
  assert.equal((await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "launched");
  const first = t.json(FILES.ledger).launches[0];
  fs.writeFileSync(path.join(t.root, FILES.ledger), prepared);
  // 12,000 trades since the create (more than ten pages of the coin's own history).
  const trades = Array.from({ length: 12_000 }, (_, i) => ({ signature: `trade${String(i).padStart(6, "0")}`, err: null, blockTime: Math.floor(NOW / 1000) + 60 + i, slot: 450_000_100 + i })).reverse();
  sol.history.set(first.mintPublic, [...trades, ...sol.history.get(first.mintPublic)]);
  const r = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick });
  assert.deepEqual([r.outcome, r.code], ["recovered", 0], "never stuck at \"unknown\" for good");
  assert.deepEqual([t.json(FILES.ledger).launches[0].status, t.json(FILES.ledger).launches[0].tx, sol.sent.length], ["launched", first.tx, 1]);
});

test("a simulation the RPC node could not run (BlockhashNotFound) is no failed attempt: the row stays prepared (on its own venue: no fallback) and launches on a later run", async () => {
  assert.deepEqual([...TRANSIENT_SIMULATION], ["BlockhashNotFound", "AccountInUse"]);
  const w = throwaway();
  const t = site({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  web.deployed = true;
  for (let i = 0; i < MAX_ATTEMPTS + 1; i++) {
    sol.s.simErrOnce = "BlockhashNotFound";
    assert.equal((await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "simulation_failed", `run ${i}`);
    assert.deepEqual([t.json(FILES.ledger).launches[0].status, t.json(FILES.ledger).launches[0].attempts], ["prepared", 0], `run ${i}`);
    await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  }
  assert.equal((await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "launched");
  // On StonkFun: no fallback to SOL for a node's lag; the row waits on StonkFun, nothing sent.
  const t2 = stonkSite({ wallet: w.address });
  const sol2 = fakeSolana({ wallet: w.address }), web2 = fakeSite(t2.root);
  const api = stonkfunApi(web2, sol2, c);
  await prepare({ io: t2.io, env: ON(w), rpc: sol2.rpc, fetchImpl: api.fetchImpl, now: c.now });
  web2.deployed = true;
  sol2.s.simErrOnce = "BlockhashNotFound";
  assert.equal((await send({ io: t2.io, env: ON(w), rpc: sol2.rpc, fetchImpl: api.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "simulation_failed");
  const row = t2.json(FILES.ledger).launches[0];
  assert.deepEqual([row.status, row.venue, row.attempts, row.fallback, sol2.simulated.length], ["prepared", "stonkfun", 0, undefined, 1]);
  assert.ok(!sol2.methods().includes("sendTransaction"));
});

test("a typo in a hand-edited file never loses a settled launch: prepare saves what it settled before it reads data/launch-approvals.json, which is then read as empty (a warning); an unreadable data/pump-quotes.json lists no coin for the launcher and the bots", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  web.deployed = true;
  const crash = { ...sol.rpc, sendTransaction: async (...a) => { await sol.rpc.sendTransaction(...a); throw new TypeError("the connection was reset"); } };
  assert.equal((await send({ io: t.io, env: ON(w), rpc: crash, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "sending");
  fs.writeFileSync(path.join(t.root, FILES.approvals), '{ "approve": ["2100000000000000777",], }\n');
  const logs = [];
  const p = await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, log: (l) => logs.push(l) });
  assert.equal(t.json(FILES.ledger).launches[0].status, "launched", "settled and saved");
  assert.ok(logs.some((l) => /^::warning.*data\/launch-approvals\.json is not valid JSON; it is read as empty/.test(l)), logs.join("\n"));
  assert.equal(p.pending, true, "the launched cat is still to be recorded");
  assert.deepEqual(record({ io: t.io, env: ON(w), now: c.now }).recorded, ["GLOOP"]);
  // data/pump-quotes.json broken too: the launcher reads it as listing no coin (a warning) and goes on.
  fs.writeFileSync(path.join(t.root, FILES.pumpQuotes), '{ "quotes": [ { "symbol": "MEOW", } ] ');
  logs.length = 0;
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, log: (l) => logs.push(l) });
  assert.ok(logs.some((l) => /^::warning.*data\/pump-quotes\.json is not valid JSON/.test(l)), logs.join("\n"));
  // The bots read the Collection as the page does: an unreadable optional list lists no coin, and nothing stops.
  assert.deepEqual(provedCollection(path.join(t.root, "data")).cats, validateCollection(t.json(FILES.collection), { wallets: validateWallets(t.json(FILES.wallets)), nowMs: Date.now() }).cats);
  const ann = await announceOf(t);
  assert.equal(ann.summary.mode, "post");
});

test("the announcer never posts the launcher's own coin by its mint, even when the Collection proves a StonkFun launch (no launchpad field) before the cat is recorded, or after its commit was lost", async () => {
  const w = throwaway();
  const t = stonkSite({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const api = stonkfunApi(web, sol, c);
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: api.fetchImpl, now: c.now });
  web.deployed = true;
  const prepared = t.read(FILES.ledger);
  assert.equal((await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: api.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "launched");
  const row = t.json(FILES.ledger).launches[0];
  // Not recorded yet (record runs in a later step, or a later run); the hourly Collection proves the coin first.
  const L = proveLaunch(structuredClone(sol.txs.get(row.tx)), { wallet: w.address }).launch;
  const collection = t.json(FILES.collection);
  collection.cats.unshift({ mint: L.mint, name: L.name, symbol: L.symbol, pair: L.pair, pool: L.pool, payer: L.payer, tx: L.tx, time: L.time });
  fs.writeFileSync(path.join(t.root, FILES.collection), JSON.stringify(collection));
  assert.ok(provedCollection(path.join(t.root, "data")).cats.some((e) => e.mint === L.mint), "the page's rule proves it");
  for (const [what, ledgerText] of [["the row launched, not recorded", t.read(FILES.ledger)], ["the send's commit lost (the row still prepared)", prepared]]) {
    fs.writeFileSync(path.join(t.root, FILES.ledger), ledgerText);
    const snapshot = t.read(FILES.announced);
    const ann = await announceOf(t);
    assert.ok(!ann.summary.drafts.some((d) => d.key === L.mint), `${what}: not listed by its mint`);
    assert.ok(!ann.tweets.some((x) => x.includes("Gloopington") || x.includes(L.mint)), `${what}: ${ann.tweets.join(" | ")}`);
    fs.writeFileSync(path.join(t.root, FILES.announced), snapshot);
  }
  // What holds it is the ledger (and data/launches.json's notes): the same entry with neither is listed by its mint, as a
  // stranger's StonkFun coin still is.
  const bare = listCats(t.json(FILES.planned), collection, t.json(FILES.adoptables), { sanctuaryCoin: sanctuaryCoins({ launches: [] }, { launches: [] }) });
  assert.ok(bare.some((x) => x.key === L.mint && x.byMint));
  assert.ok(sanctuaryCoins({ launches: [] }, { launches: [{ tx: L.tx, note: "Sanctuary launcher: GLOOP" }] })({ tx: L.tx }), "noted in data/launches.json");
});

test("the Collection's hard cap of MAX_CATS: no new cat is prepared once data/collection.json, the launcher's unproved launches and the planned cats' room would reach it", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address });
  const planned = t.json(FILES.planned), coll = t.json(FILES.collection);
  // The room: MAX_CATS less the entries, the planned cats with none yet (their room is kept) and a margin of 10.
  const keys = new Set(coll.cats.map((e) => `${e.pair?.mint} ${String(e.symbol).toUpperCase()}`));
  const room = MAX_CATS - coll.cats.length - planned.cats.filter((p) => !keys.has(`${p.pair.mint} ${p.ticker.toUpperCase()}`)).length - 10;
  assert.ok(room > 100, "plenty of room today");
  // Full: warned, nothing prepared. One place free: the cat is prepared.
  const filler = Array.from({ length: room }, (_, i) => ({ mint: `Filler${i}`, name: `Filler ${i}`, symbol: `FILL${i}`, pair: { ...SOL_PAIR }, tx: `fill${i}` }));
  fs.writeFileSync(path.join(t.root, FILES.collection), JSON.stringify({ ...coll, cats: [...coll.cats, ...filler] }));
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const logs = [];
  const p = await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, log: (l) => logs.push(l) });
  assert.equal(p.prepared, null);
  assert.ok(logs.some((l) => new RegExp(`^::warning.*near its ${MAX_CATS} cats`).test(l)), logs.join("\n"));
  fs.writeFileSync(path.join(t.root, FILES.collection), JSON.stringify({ ...coll, cats: [...coll.cats, ...filler.slice(1)] }));
  assert.equal((await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now })).prepared, "2100000000000000001");
  // The rule itself.
  assert.equal(COLLECTION_MARGIN, 10);
  assert.equal(collectionRoom({ collection: coll, planned, ledger: { launches: [] } }), room);
  assert.equal(collectionRoom({ collection: null, planned, ledger: { launches: [] } }), null, "unreadable: no new cat (fails closed)");
  assert.equal(collectionRoom({ collection: coll, planned, ledger: { launches: [{ status: "launched", tx: "x" }, { status: "sending", tx: "y" }, { status: "failed", tx: "z" }] } }), room - 2, "the launcher's own launches not proved yet count");
});

test("the fixtures never depend on the shipped data: a cat the real launcher moved in under a fixture's name or ticker is left out of every test site and every context the tests build", () => {
  const shippedAdoptables = JSON.parse(readRoot(FILES.adoptables));
  const base = shippedAdoptables.cats.find((x) => !x.launch) ?? shippedAdoptables.cats[0];
  const launched = { ...base, id: "bramblewick", ticker: "BRAMBLE", name: "Bramblewick", coinName: "Bramblewick", launch: { mint: "11111111111111111111111111111112", tx: "1".repeat(64), launchpad: "pump.fun", at: "2026-09-20T17:00:00Z" } };
  const withIt = { ...shippedAdoptables, cats: [...shippedAdoptables.cats, launched] };
  assert.deepEqual(fixtureFree(FILES.adoptables, withIt), fixtureFree(FILES.adoptables, shippedAdoptables));
  assert.ok(!fixtureFree(FILES.adoptables, withIt).cats.some((x) => x.ticker === "BRAMBLE"));
  assert.deepEqual(Object.keys(fixtureFree(FILES.meshy, { cats: { GLOOP: {}, ABC: {} } }).cats), ["ABC"]);
  assert.deepEqual(fixtureFree(FILES.collection, { cats: [{ symbol: "PLINKO" }, { symbol: "ABC" }] }).cats, [{ symbol: "ABC" }]);
  // What the selection test expects holds with the cat left out, and would not with it in.
  const planned = JSON.parse(readRoot(FILES.planned));
  const posts = [post("2100000000000000110", { h: 5, name: "Bramblewick", ticker: "BRAMBLE", nameFrom: "trend", figure: null, lore: "Bramblewick rides a skateboard across the kitchen floor." })];
  const ctx = (adoptables) => ({ nowMs: NOW, approvals: new Set(), watch: WATCH, ledger: { launches: [] }, adoptables, planned, trending: trendingOf(posts) });
  assert.equal(selectCandidate(ctx(fixtureFree(FILES.adoptables, withIt))).row?.postId, "2100000000000000110");
  assert.equal(selectCandidate(ctx(withIt)).row, null);
});

/* ── the CLI: outputs, and never the key or the RPC URL in a line ─────────────────────── */

test("the key and the RPC URL never appear in the output, whatever happens", async () => {
  const w = throwaway();
  const secrets = [w.base58, w.json64, w.seedHex, w.seedB58, "RPCKEY9f8e7d6c5b4a", RPC_URL];
  const scenarios = [
    ["listed, a full launch", { listWallet: true }, (sol) => sol],
    ["not listed", { listWallet: false }, (sol) => sol],
    ["an RPC that fails", { listWallet: true }, (sol) => { sol.s.drop = true; return sol; }],
    ["a preflight refusal quoting the request", { listWallet: true }, (sol) => { sol.s.refuse = `bad request ${w.base58} at ${RPC_URL}`; return sol; }],
  ];
  for (const [what, opts, tweak] of scenarios) {
    for (const key of [w.base58, w.json64, w.json32]) {
      const t = site({ wallet: w.address, ...opts });
      const sol = tweak(fakeSolana({ wallet: w.address })), web = fakeSite(t.root), c = clock();
      const out = [];
      const fetchImpl = async (url, init) => (url.startsWith("https://rpc.example.test") ? sol.fetchImpl(url, init) : web.fetchImpl(url, init));
      const env = { LAUNCH_ENABLED: "on", LAUNCH_WALLET_KEY: key, SOLANA_RPC_URL: RPC_URL, GITHUB_OUTPUT: path.join(t.root, "out.txt"), LAUNCH_MINT_SUFFIX: "none", LAUNCH_CHARACTERS: "on", LAUNCH_PAIRS: "on" };
      // Once through the real client built from SOLANA_RPC_URL; otherwise the same fake Solana without its pacing and back-off waits.
      const real = what === "listed, a full launch" && key === w.base58;
      const io = { env, root: t.root, fetchImpl, now: c.now, sleep: c.sleep, stdout: (l) => out.push(String(l)), stderr: (l) => out.push(String(l)), ...(real ? {} : { rpc: sol.rpc }) };
      assert.equal(await main(["prepare"], io), 0, what);
      web.deployed = true;
      await main(["send"], io);
      await main(["record"], io);
      const text = out.join("\n") + fs.readFileSync(env.GITHUB_OUTPUT, "utf8") + t.read(FILES.ledger);
      for (const s of [...secrets, key]) assert.ok(!text.includes(s), `${what}: the output shows a secret (${s.slice(0, 6)}…)`);
      assert.match(text, /through the RPC in SOLANA_RPC_URL/);
      if (what === "not listed") assert.ok(text.includes(w.address), "the public address is printed");
    }
  }
  // A key that is not a key: said plainly, never quoted.
  const t = site({ wallet: w.address });
  const out = [];
  const code = await main(["send"], { env: { LAUNCH_ENABLED: "on", LAUNCH_WALLET_KEY: `${w.base58}x` }, root: t.root, fetchImpl: async () => { throw new Error("no network"); }, stdout: (l) => out.push(l), stderr: (l) => out.push(l) });
  assert.equal(code, 1);
  assert.match(out.join("\n"), /LAUNCH_WALLET_KEY/);
  assert.ok(!out.join("\n").includes(w.base58));
  assert.equal(scrubber(["a-secret-value"])("x a-secret-value y"), "x *** y");
  assert.equal(scrubber(["0123456789abcdefghij"])("cut: 0123456789abcdef… and more"), "cut: ***… and more", "a secret cut short is still blanked");
  assert.equal(scrubber(["0123456789abcdefghij"])("short 0123456789a"), "short 0123456789a", "a piece shorter than 12 characters is no secret");
});

test("the CLI's outputs for the workflow: pending, deploy, launched, recorded", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  const out = path.join(t.root, "gh-output");
  const env = { LAUNCH_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58, GITHUB_OUTPUT: out, LAUNCH_MINT_SUFFIX: "none", LAUNCH_CHARACTERS: "on", LAUNCH_PAIRS: "on" };
  const io = { env, root: t.root, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, stdout: () => {}, stderr: () => {}, rpc: sol.rpc };
  assert.equal(await main(["prepare"], io), 0);
  assert.equal(fs.readFileSync(out, "utf8"), "pending=true\ndeploy=true\n");
  web.deployed = true;
  assert.equal(await main(["send"], io), 0);
  assert.equal(await main(["record"], io), 0);
  assert.equal(fs.readFileSync(out, "utf8"), "pending=true\ndeploy=true\nlaunched=true\nrecorded=true\n");
  assert.equal(await main(["nonsense"], io), 2);
});

/* ── the shipped files ────────────────────────────────────────────────────────────────── */

/**
 * The shape the README tells the owner to write data/launch-approvals.json in (checked on fixtures only: the shipped
 * file is the owner's, and npm test gates every Pages deploy; the launcher reads a file it cannot parse as empty, with a
 * warning, and ignores an extra key or a malformed id), never its layout. An object with an optional note and `approve`, a list of X status ids as strings (a JSON number
 * that long loses its last digits). Null, or the problem.
 */
function approvalsFileProblem(text) {
  let a;
  try { a = JSON.parse(text); } catch { return "not JSON"; }
  if (!a || typeof a !== "object" || Array.isArray(a)) return "not an object";
  if (Object.keys(a).some((k) => k !== "note" && k !== "approve")) return "a key other than note and approve";
  if (a.note !== undefined && typeof a.note !== "string") return "note is not text";
  if (!Array.isArray(a.approve) || !a.approve.every((id) => typeof id === "string" && /^\s*\d{5,25}\s*$/.test(id))) return "approve is not a list of post ids, as strings";
  return null;
}

test("the approvals the owner writes by hand (fixtures): the README's own form, literally, on one line or many, with or without a note, are read by the launcher", () => {
  const form = /`(\{ "approve": \["<post id>"\] \})`/.exec(readRoot("README.md"))?.[1];
  assert.ok(form, "the README shows how to approve a post");
  const id = "2100000000000000777";
  const note = "Posts the owner approves for the automatic launcher.";
  for (const text of [form.replace("<post id>", id), `{ "note": ${JSON.stringify(note)}, "approve": ["${id}"] }\n`, `{\n  "note": ${JSON.stringify(note)},\n  "approve": ["${id}", "2100000000000000778"]\n}\n`,
    `${JSON.stringify({ note, approve: [id] }, null, 2)}\n`, `{"approve":[]}`]) {
    assert.equal(approvalsFileProblem(text), null, text);
    assert.ok(text.includes(id) ? approvalsOf(JSON.parse(text)).has(id) : true, "and the launcher reads it");
  }
  for (const [text, why] of [["{ \"approve\": [2100000000000000777] }", /as strings/], ["{ \"approve\": \"2100000000000000777\" }", /list/], ["{ \"approve\": [\"x\"] }", /post ids/], ["{ \"aprove\": [] }", /key/]]) {
    assert.match(approvalsFileProblem(text), why, text);
  }
});

test("a typo, a BOM, an extra key or a number id in data/launch-approvals.json never stops the launcher: it reads what it can, or reads the file as empty with a warning (fixtures)", async () => {
  const id = "2100000000000000777";
  for (const [text, approved, warns] of [
    [`{ "approve": ["${id}"] }`, [id], false],                                      // the README's form, literally
    [`\uFEFF{ "approve": ["${id}"] }\n`, [id], false],                              // a BOM
    [`{ "note": "x", "approve": ["${id}"], "mine": true }`, [id], false],            // an extra key
    [`{ "approve": [${id}, "abc"] }`, [], false],                                  // a number (its digits lost) and a non-id: left out
    [`{ "approve": ["${id}",], }`, [], true],                                      // a typo: read as empty
    [`{ "aprove": ["${id}"] }`, [], false],                                        // a misspelt key: nothing approved
  ]) {
    const w = throwaway();
    const t = site({ wallet: w.address });
    fs.writeFileSync(path.join(t.root, FILES.approvals), text);
    const logs = [];
    assert.deepEqual([...approvalsOf(readOwned(t.io, FILES.approvals, { approve: [] }, (l) => logs.push(l)))], approved, text);
    assert.equal(logs.some((l) => /^::warning.*launch-approvals\.json is not valid JSON; it is read as empty/.test(l)), warns, text);
    const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root);
    await assert.doesNotReject(prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: clock().now }), text);
  }
});

test("record never stops on a data/cat-watch.json the owner broke: the cat is recorded, the file left as it is, a warning", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root), c = clock();
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now });
  web.deployed = true;
  assert.equal((await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c.now, sleep: c.sleep, ...quick })).outcome, "launched");
  const broken = '\uFEFF{ "figures": [ { "name": "Nyan Cat" }, ] }\n';
  fs.writeFileSync(path.join(t.root, FILES.watch), broken);
  const logs = [];
  assert.deepEqual(record({ io: t.io, env: ON(w), now: c.now, log: (l) => logs.push(l) }).recorded, ["GLOOP"]);
  assert.equal(t.read(FILES.watch), broken, "left as the owner wrote it");
  assert.ok(logs.some((l) => /^::warning.*cat-watch\.json is not valid JSON/.test(l)), logs.join("\n"));
});

test("shipped: the ledger and every coin's metadata are valid (the ledger and the coins canonical); every row's metadata file is there (exact while in flight)", () => {
  const ledgerRaw = readRoot(FILES.ledger);
  const ledger = validateLedger(JSON.parse(ledgerRaw));
  assert.equal(ledgerText(ledger), ledgerRaw);
  // The approvals are the owner's (edited by hand): only what the launcher needs, which always holds (read, or read as empty with a warning).
  const logs = [];
  const approvals = readOwned(fsStore(ROOT), FILES.approvals, { approve: [] }, (l) => logs.push(l));
  assert.ok(approvalsOf(approvals) instanceof Set && logs.every((l) => /^::warning.*read as empty/.test(l)));
  // So is the photo hide list: read, or read as hiding nothing with a warning.
  const hideLogs = [];
  assert.ok(photoHideOf(fsStore(ROOT), (l) => hideLogs.push(l)) instanceof Set && hideLogs.every((l) => /^::warning/.test(l)));
  // A row in flight is sent only with its exact metadata; a launched coin's file is never rewritten (its uri points to it for good).
  for (const row of ledger.launches) {
    if (row.status === "prepared" || row.status === "sending") assert.equal(readRoot(row.metadataPath), metadataText(coinMetadata(row)), row.postId);
    else assert.ok(fs.existsSync(path.join(ROOT, row.metadataPath)), `${row.postId}: its metadata file stays`);
  }
  for (const f of fs.readdirSync(path.join(ROOT, "coins"))) {
    if (f === "README.md") continue;
    assert.match(f, /^\d{5,25}\.json$/, f);
    const text = readRoot(`coins/${f}`), m = JSON.parse(text);
    assert.equal(text, metadataText(m), f);
    assert.deepEqual(Object.keys(m), ["name", "symbol", "description", "image", "showName", "createdOn", "website", "twitter"], f);
    assert.equal(m.createdOn, SITE_ORIGIN); assert.equal(m.showName, true);
    assert.ok(/^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{5,25}$/.test(m.twitter) && postIdOf(m.twitter) === f.slice(0, -5), `${f}: its X link is the cat's own post`);
    assert.equal(m.website, `${SITE_ORIGIN}/#cat=${m.symbol}`);
    // A sanctuary cat's coin (launched from the sanctuary's own post) shows its picture on the site.
    // Decided from the file itself (the ledger drops old finished rows; a coin's file stays for good): its X link is the sanctuary's own post of this id.
    const own = m.twitter === `https://x.com/${OWN_HANDLE}/status/${f.slice(0, -5)}`;
    assert.ok(/^https:\/\/pbs\.twimg\.com\//.test(m.image) || m.image === SITE_IMAGE || (own && SITE_PICTURE.test(m.image)),
      `${f}: the post's photo, the site's own for a hidden one, or a sanctuary cat's picture on the site`);
    assert.ok(Buffer.byteLength(metadataUri(f.slice(0, -5))) <= 200);
  }
  // The mint of a row not sent yet is never public.
  for (const row of ledger.launches.filter((r) => r.status === "prepared")) assert.equal(row.mintPublic, undefined);
  for (const row of ledger.launches.filter((r) => r.mintPublic)) assert.ok(isAddress(row.mintPublic));
  assert.equal(metadataPath("2100000000000000001"), "coins/2100000000000000001.json");
});

test("the launcher needs no dependency: its whole import graph is node's own modules and the repository's files, never the Anthropic SDK or the trend watch", () => {
  const seen = new Set(), bad = [];
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/gm)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (spec.startsWith("node:")) continue;
      if (!spec.startsWith(".")) { bad.push(`${path.relative(ROOT, file)} imports ${spec}`); continue; }
      walk(path.resolve(path.dirname(file), spec));
    }
  };
  walk(path.join(ROOT, "scripts/launch.mjs"));
  assert.deepEqual(bad, []);
  const files = [...seen].map((f) => path.relative(ROOT, f));
  assert.ok(files.includes("scripts/lib/launcher.mjs") && files.includes("scripts/lib/venues.mjs") && files.includes("scripts/lib/pump.mjs"));
  assert.ok(!files.includes("scripts/scan-trending-cats.mjs"), "the trend watch (which imports @anthropic-ai/sdk) is never loaded");
  assert.ok(!files.some((f) => f.includes("node_modules")));
});

/* ── the sanctuary's own cats, after their X post ─────────────────────────────────────── */

const OWN_TWEET = "2105999999999999001";
/** The ctx sanctuaryRow reads, for the shipped files (fixture-free), a release queue of `entries` and the files on disk under ROOT. */
const ownCtx = ({ entries = [], ledger = { launches: [] }, adoptables = shipped(FILES.adoptables), adoptions = { adoptions: [] }, collection = shipped(FILES.collection), exists = (rel) => fs.existsSync(path.join(ROOT, rel)) } = {}) => ({
  nowMs: NOW, ledger, adoptables, planned: shipped(FILES.planned), collection, adoptions, queue: { cats: entries }, captions: JSON.parse(readRoot("data/lore.json")).cats, exists,
});
const released = (key, tweet = OWN_TWEET, at = "2026-09-25T16:00:00Z") => ({ key, approved: true, shown: true, status: "released", name: key, releasedAt: at, tweet });
/** A shipped adoptable the launcher may launch once posted (no coin, not in memoriam, a portrait on disk): the first one, or the n-th. */
const ownCat = (n = 0) => shipped(FILES.adoptables).cats.filter((c) => sanctuaryRow(released(c.ticker), ownCtx({ entries: [released(c.ticker)] })).row)[n];

test("sanctuary cats: once posted on X, a cat with no coin launches from the sanctuary's own post, on pump.fun in SOL, named as its card names it, with its portrait on the site", () => {
  const c = ownCat();
  assert.ok(c, "a shipped cat the launcher may launch");
  const { row, route } = sanctuaryRow(released(c.ticker), ownCtx({ entries: [released(c.ticker)] }));
  assert.deepEqual([row.postId, row.url, row.policy, row.venue, row.ticker, row.coinName, row.cat.pair], [OWN_TWEET, `https://x.com/${OWN_HANDLE}/status/${OWN_TWEET}`, "sanctuary", "pump-sol", c.ticker, c.coinName || c.name, { ...SOL_PAIR }]);
  assert.equal(route.venue, "pump-sol");
  assert.match(row.image, new RegExp(`^${SITE_ORIGIN}/assets/(portraits|lore)/`));
  assert.deepEqual([row.coinImage, row.photoCredit, row.cat.launch, row.cat.id], [row.image, false, undefined, c.id]);
  assert.equal(rowProblem(row), null);
  const meta = coinMetadata(row);
  assert.deepEqual([meta.name, meta.symbol, meta.image, meta.twitter, meta.website], [row.coinName, c.ticker, row.image, row.url, `${SITE_ORIGIN}/#cat=${encodeURIComponent(c.ticker)}`]);
  assert.ok(meta.description.startsWith(row.lore.replace(/[.!?…]$/, "")), meta.description);
  // Not posted yet (queued, or released with no tweet id): nothing.
  for (const e of [{ ...released(c.ticker), status: undefined }, { ...released(c.ticker), tweet: undefined }]) assert.match(sanctuaryRow(e, ownCtx({ entries: [e] })).problem, /not posted on X yet/);
});

test("sanctuary cats: never one with a coin (its launch, a visitor's adoption, a Collection entry, a live ledger row), with a sensitivity note other than its memorial, of low confidence, with no portrait, or whose kit launches as another ticker", () => {
  const c = ownCat();
  const e = released(c.ticker);
  const cats = shipped(FILES.adoptables).cats;
  const withCat = (patch) => ({ ...shipped(FILES.adoptables), cats: cats.map((x) => (x.ticker === c.ticker ? { ...x, ...patch } : x)) });
  const why = (o) => sanctuaryRow(e, ownCtx({ entries: [e], ...o })).problem;
  assert.match(why({ adoptables: withCat({ launch: { mint: "24NGWC9iFkLtUrPEN6EAnYLNW3zHqSv9oDuNqcpuNmN9", tx: "3yffugUngPkXoyTorbs24MnPZYyi96YPt6dBbRSaNkcLKR1oHNCoQbiXvacMVQVUku85wwTbzN9P8Tywyqa8UFyH", launchpad: "pump.fun", at: "2026-09-29T17:07:25Z" } }) }), /has a coin already/);
  assert.equal(why({ adoptables: withCat({ memorial: true, sensitivity: `In loving memory of ${c.name}.` }) }), undefined, "a cat that died is a tribute (the owner's choice)");
  assert.match(why({ adoptables: withCat({ sensitivity: "Ill since 2024; the owners asked for privacy." }) }), /sensitivity note/);
  assert.match(why({ adoptables: withCat({ confidence: "low" }) }), /low confidence/);
  assert.match(why({ adoptables: withCat({ launchTicker: "OTHERTKR" }) }), /launches as OTHERTKR/);
  assert.match(why({ adoptables: withCat({ existingCoin: { symbol: c.ticker, contract: "x", mcapUsd: 10 } }) }), /older coin has its ticker/);
  assert.equal(why({ adoptables: withCat({ existingCoin: { symbol: "SOMEOLD", contract: "x", mcapUsd: 10 } }) }), undefined, "an older, unrelated coin under another ticker does not stop it (the card still offers the cat)");
  assert.match(why({ adoptions: { adoptions: [{ key: c.ticker }] } }), /visitor adopted it/);
  assert.match(why({ collection: { cats: [{ symbol: c.ticker.toLowerCase(), name: "whatever" }] } }), /Collection lists a coin/);
  assert.match(why({ collection: { cats: [{ symbol: "ZZZZ", name: c.coinName || c.name }] } }), /Collection lists a coin/);
  assert.match(why({ exists: () => false }), /no portrait/);
  assert.match(why({ entries: [], adoptables: { cats: cats.filter((x) => x.ticker !== c.ticker) } }), /not an adoptable cat/);
  const live = { postId: "2105999999999999002", ticker: c.ticker, status: "prepared", attempts: 0 };
  assert.match(why({ ledger: { launches: [live] } }), /already in the ledger/);
  assert.match(why({ ledger: { launches: [{ ...live, postId: OWN_TWEET, ticker: "ZZZZ" }] } }), /already in the ledger/);
  assert.match(why({ ledger: { launches: [{ ...live, status: "failed", retry: true, attempts: 1 }] } }), /already in the ledger/, "a failed row that is tried again keeps the cat");
  assert.equal(why({ ledger: { launches: [{ ...live, status: "failed", retry: false, attempts: 1 }] } }), undefined, "a row failed for good frees it");
});

test("sanctuary cats: the newest posted cat first, then the next", () => {
  const [a, b] = [ownCat(0), ownCat(1)];
  const entries = [released(a.ticker, "2105999999999999011", "2026-09-25T10:00:00Z"), released(b.ticker, "2105999999999999012", "2026-09-25T12:00:00Z")];
  const pick = selectSanctuary(ownCtx({ entries }));
  assert.deepEqual([pick.row.ticker, pick.row.postId], [b.ticker, "2105999999999999012"]);
  // The newest one taken: the next.
  const next = selectSanctuary(ownCtx({ entries, ledger: { launches: [pick.row] } }));
  assert.equal(next.row.ticker, a.ticker);
  assert.deepEqual(next.skipped.map((s) => s.id), [b.ticker]);
});

test("sanctuary cats: lore lines, best first (the caption, the story's first sentence, then a plain line), each one line of at most 200 characters with no mention, hashtag, $ or link; kinds", () => {
  const lines = loreLinesOf({ ticker: "ZZTEST", name: "Tester", story: `Tester met @someone at https://example.com and #cats for $5. ${"Then a very long sentence ".repeat(12)}.` }, { ZZTEST: "Tester on the windowsill." });
  assert.equal(lines[0], "Tester on the windowsill.");
  assert.ok(lines.every((l) => l.length <= 200 && !/[@#$]|https?:|www\./.test(l)), JSON.stringify(lines));
  assert.equal(lines.at(-1), "Tester, one of the Catcoin Sanctuary's cats.");
  const long = loreLinesOf({ ticker: "ZZ", name: "Z", story: "word ".repeat(80) });
  assert.ok(long[0].endsWith("…") && long[0].length <= 200, long[0]);
  assert.equal(kindOfAdoptable({ category: "tv-movie", look: "a real tabby" }), "fiction");
  assert.equal(kindOfAdoptable({ category: "viral", look: "A chubby cartoon cat" }), "cartoon");
  assert.equal(kindOfAdoptable({ category: "company", look: "A grey tabby with green eyes" }), "real");
});

test("sanctuary rows: only from the sanctuary's own post, with its picture on the site, no photo credit and no launch; a trending row keeps its pbs.twimg.com photo", () => {
  const c = ownCat();
  const { row } = sanctuaryRow(released(c.ticker), ownCtx({ entries: [released(c.ticker)] }));
  assert.equal(rowProblem(row), null);
  assert.match(rowProblem({ ...row, url: `https://x.com/someone/status/${OWN_TWEET}` }), /sanctuary's own post/);
  assert.match(rowProblem({ ...row, image: "https://pbs.twimg.com/media/abc.jpg", coinImage: "https://pbs.twimg.com/media/abc.jpg" }), /picture on the site/);
  assert.match(rowProblem({ ...row, image: `${SITE_ORIGIN}/assets/og-image.jpg`, coinImage: `${SITE_ORIGIN}/assets/og-image.jpg` }), /picture on the site/);
  assert.match(rowProblem({ ...row, photoCredit: true }), /no photo credit/);
  assert.match(rowProblem({ ...row, policy: "approved" }), /pbs\.twimg\.com/);
});

test("sanctuary cats end to end: with no trending cat, prepare takes the posted cat; it is sent from its own post's mint, recorded on its own row (the launch and the SOL pair, no new row, no model or photo queued), shown launched on its card, and its launch post goes out", async () => {
  const c = ownCat();
  const w = throwaway();
  const t = ownSite(c, { wallet: w.address, posts: [] });
  const sol = fakeSolana({ wallet: w.address }), web = pumpSite(t.root), c0 = clock(), logs = [];
  const before = t.json(FILES.adoptables).cats.length;
  const meshyBefore = t.json(FILES.meshy).cats?.[c.ticker] ?? null;
  const photosBefore = JSON.stringify(t.json(FILES.realPhotos).cats?.[c.ticker] ?? null);
  const { p, s, r } = await launchOnce(t, { env: ON(w), sol, web, c: c0, log: (l) => logs.push(l) });
  assert.equal(p.prepared, OWN_TWEET, logs.join("\n"));
  assert.ok(logs.some((l) => /looking at the sanctuary's cats posted on X/.test(l)));
  assert.deepEqual([s.outcome, s.launched], ["launched", true], logs.join("\n"));
  assert.deepEqual(r.recorded, [c.ticker], logs.join("\n"));
  const row = t.json(FILES.ledger).launches[0];
  assert.deepEqual([row.policy, row.status, row.postId, row.venue, row.mintPublic], ["sanctuary", "launched", OWN_TWEET, "pump-sol", deriveMintKeypair(w.kp, OWN_TWEET).publicKey]);
  const proof = proveLaunchPump(structuredClone(sol.txs.get(row.tx)), { wallet: w.address });
  assert.ok(proof.ok, proof.detail);
  assert.deepEqual([proof.launch.name, proof.launch.symbol, proof.launch.uri, proof.launch.pair], [c.coinName || c.name, c.ticker, metadataUri(OWN_TWEET), { ...SOL_PAIR }]);
  const after = t.json(FILES.adoptables).cats;
  assert.equal(after.length, before, "no new row: the cat's own row takes the launch");
  const cat = after.find((x) => x.ticker === c.ticker);
  assert.deepEqual([cat.id, cat.pair, cat.launch.mint, cat.launch.tx, cat.launch.launchpad, cat.portrait], [c.id, { ...SOL_PAIR }, row.mintPublic, row.tx, "pump.fun", c.portrait]);
  assert.equal(validateAdoptables(t.json(FILES.adoptables), { taken: new Set(t.json(FILES.planned).cats.map((x) => x.ticker)) }).refused.length, 0);
  assert.deepEqual(t.json(FILES.meshy).cats?.[c.ticker] ?? null, meshyBefore, "it has its model: nothing queued");
  assert.equal(JSON.stringify(t.json(FILES.realPhotos).cats?.[c.ticker] ?? null), photosBefore, "no stranger's photo: nothing added");
  assert.ok(t.json(FILES.launches).launches.some((l) => l.tx === row.tx));
  // A second run: nothing more for this cat (its coin is recorded), and never a second send.
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, log: () => {} });
  assert.equal(t.json(FILES.ledger).launches.filter((x) => x.ticker === c.ticker).length, 1);
  // The Collection proves it; the page shows it launched by the sanctuary on the cat's own card, and the launch post goes out.
  const L = proof.launch;
  const collection = t.json(FILES.collection);
  collection.cats.unshift({ mint: L.mint, name: L.name, symbol: L.symbol, pair: L.pair, pool: L.pool, payer: L.payer, tx: L.tx, time: L.time, launchpad: L.launchpad });
  fs.writeFileSync(path.join(t.root, FILES.collection), JSON.stringify(collection));
  const g = (await pageOf(t)).find((x) => x.id === c.ticker);
  assert.deepEqual([g.kind, g.sanctuaryLaunch?.status, isLaunched(g), g.token.mint], ["adoptable", "launched", true, row.mintPublic]);
  const text = await launchPostOf(t);
  assert.ok(text && text.includes("launched by the sanctuary on PumpFun"), text);
  assert.ok(!/[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text), "no address");
});

test("sanctuary cats: a failed launch is tried again with the same post (the same mint), whatever the post's age", async () => {
  const c = ownCat();
  const { row } = sanctuaryRow(released(c.ticker), ownCtx({ entries: [released(c.ticker)] }));
  const failed = { ...row, preparedAt: iso(NOW - 30 * 24 * HOUR), status: "failed", reason: "the simulation failed", retry: true, attempts: 1, settledAt: iso(NOW - 30 * 24 * HOUR) };
  const w = throwaway();
  const t = site({ wallet: w.address, posts: [], ledger: { note: LEDGER_NOTE, launches: [failed] } });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root);
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW, log: () => {} });
  const again = t.json(FILES.ledger).launches[0];
  assert.deepEqual([again.postId, again.status, again.attempts], [OWN_TWEET, "prepared", 1]);
});

/** A throwaway site where `c` is posted on X (released, with the sanctuary's tweet), its portrait on disk, and the trend watch's last pump.fun scan an hour ago. */
function ownSite(c, opts = {}) {
  const t = site(opts);
  fs.writeFileSync(path.join(t.root, "data/trending.json"), JSON.stringify({ ...t.json("data/trending.json"), fresh: { updatedAt: iso(NOW - HOUR), coveredUntil: iso(NOW - HOUR), items: [] } }));
  const queue = t.json("data/release-queue.json");
  queue.cats = [...queue.cats.filter((q) => q.key !== c.ticker), released(c.ticker)];
  fs.writeFileSync(path.join(t.root, "data/release-queue.json"), `${JSON.stringify(queue, null, 2)}\n`);
  fs.writeFileSync(path.join(t.root, "data/adoptions.json"), JSON.stringify({ note: "test", adoptions: [] }));
  const pic = [c.portrait, c.lore?.image].find((p) => typeof p === "string" && fs.existsSync(path.join(ROOT, p)));
  fs.mkdirSync(path.dirname(path.join(t.root, pic)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, pic), path.join(t.root, pic));
  return t;
}

test("sanctuary cats wait while a trending cat the rules let launch is there: the trending cat goes first", async () => {
  const c = ownCat();
  const w = throwaway();
  const t = ownSite(c, { wallet: w.address });
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root);
  const p = await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW, log: () => {} });
  assert.equal(p.prepared, "2100000000000000001");
  assert.equal(t.json(FILES.ledger).launches[0].policy, "figure");
});

test("sanctuary cats: adopted by a visitor (or given a coin) between prepare and send: never sent, failed for good", async () => {
  for (const change of ["adoption", "launch"]) {
    const c = ownCat();
    const w = throwaway();
    const t = ownSite(c, { wallet: w.address, posts: [] });
    const sol = fakeSolana({ wallet: w.address }), web = pumpSite(t.root), c0 = clock();
    const p = await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, log: () => {} });
    assert.equal(p.prepared, OWN_TWEET);
    if (change === "adoption") fs.writeFileSync(path.join(t.root, "data/adoptions.json"), JSON.stringify({ note: "test", adoptions: [{ key: c.ticker }] }));
    else {
      const a = t.json(FILES.adoptables);
      a.cats = a.cats.map((x) => (x.ticker === c.ticker ? { ...x, launch: { mint: "24NGWC9iFkLtUrPEN6EAnYLNW3zHqSv9oDuNqcpuNmN9", tx: "3yffugUngPkXoyTorbs24MnPZYyi96YPt6dBbRSaNkcLKR1oHNCoQbiXvacMVQVUku85wwTbzN9P8Tywyqa8UFyH", launchpad: "pump.fun", at: "2026-09-29T17:07:25Z" } } : x));
      fs.writeFileSync(path.join(t.root, FILES.adoptables), `${JSON.stringify(a, null, 2)}\n`);
    }
    web.deployed = true;
    const s = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, sleep: c0.sleep, log: () => {}, ...quick });
    assert.equal(s.outcome, "taken", change);
    assert.equal(sol.calls.filter((x) => x.method === "sendTransaction").length, 0, change);
    const row = t.json(FILES.ledger).launches[0];
    assert.deepEqual([row.status, row.retry], ["failed", false], change);
  }
});

/**
 * The fake site, and pump.fun's public list of new coins (newest first, 50 a page): `coins` ({ mint, name, symbol,
 * creator, created_timestamp }) and, unless `tail` is false, a day-old coin past them (the list goes on), or `down`
 * (it does not answer). Every page asked is recorded.
 */
function pumpSite(root, { coins = [], down = false, tail = true, search = false } = {}) {
  coins = tail ? [...coins, pumpCoin(9999, { name: "Old Coin", symbol: "OLD", at: NOW - 24 * HOUR })] : coins;
  const web = fakeSite(root);
  const site0 = web.fetchImpl;
  web.pumpAsked = [];
  web.searchAsked = [];
  web.fetchImpl = async (url, init) => {
    // pump.fun's search (with `search`): every coin whose name or ticker carries the term, newest first.
    if (search && String(url).startsWith("https://frontend-api-v3.pump.fun/coins/search-unrestricted?")) {
      const u = new URL(url), offset = Number(u.searchParams.get("offset")), term = u.searchParams.get("searchTerm").toUpperCase();
      web.searchAsked.push(term);
      const hits = coins.filter((c) => [c.name, c.symbol].some((x) => String(x).toUpperCase().includes(term))).sort((a, b) => b.created_timestamp - a.created_timestamp);
      return new Response(JSON.stringify(hits.slice(offset, offset + 50)), { status: 200 });
    }
    if (String(url).startsWith("https://frontend-api-v3.pump.fun/coins?")) {
      web.pumpAsked.push(url);
      if (down) return new Response("busy", { status: 503 });
      const offset = Number(new URL(url).searchParams.get("offset"));
      const list = [...coins].sort((a, b) => b.created_timestamp - a.created_timestamp).slice(offset, offset + 50);
      return new Response(JSON.stringify(list), { status: 200 });
    }
    return site0(url, init);
  };
  return web;
}
/** A pump.fun coin (its list's row). */
const pumpCoin = (i, { name = "Some Cat", symbol = "SOME", creator = "8xstrangerWa11etAddress1111111111111111111", at = NOW - 10 * 60_000 } = {}) =>
  ({ mint: `${String(i).padStart(4, "0")}pumpMint1111111111111111111111111111pump`, name, symbol, creator, created_timestamp: at });

/** One sanctuary cat prepared and deployed, then sent against pump.fun's list as `pump` says: { t, s, sol, web, row }. */
async function ownSend(pump = {}, { c = ownCat(), patch = null, env = {} } = {}) {
  const w = throwaway();
  const t = ownSite(c, { wallet: w.address, posts: [] });
  const sol = fakeSolana({ wallet: w.address }), web = pumpSite(t.root, typeof pump === "function" ? pump(c, w) : pump), c0 = clock();
  const p = await prepare({ io: t.io, env: ON(w, env), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, log: () => {} });
  assert.equal(p.prepared, OWN_TWEET);
  if (patch) patch(t, c);
  web.deployed = true;
  const logs = [];
  const s = await send({ io: t.io, env: ON(w, env), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, sleep: c0.sleep, log: (l) => logs.push(l), ...quick });
  return { t, s, sol, web, logs, c, row: t.json(FILES.ledger).launches[0] };
}

test("a pump.fun coin is a holder rewards coin unless LAUNCH_HOLDER_REWARDS is off: its creator fees go to its holders (the owner, 2026-10-02)", async () => {
  // The sent transaction's last byte is create_v2's is_holder_reward (pump.fun's HOLDER_REWARDS_README.md); the same accounts either way.
  const holderByte = (r) => { const b = Buffer.from(base58Decode(r.sol.sent[0].json.transaction.message.instructions.at(-1).data, 2000)); return b[b.length - 1]; };
  const on = await ownSend();
  assert.equal(on.s.outcome, "launched", on.logs.join("\n"));
  assert.equal(holderByte(on), 1, "holder rewards by default");
  const off = await ownSend({}, { env: { LAUNCH_HOLDER_REWARDS: " OFF " } });
  assert.equal(off.s.outcome, "launched", off.logs.join("\n"));
  assert.equal(holderByte(off), 0, "a regular coin when the owner turns it off");
  assert.deepEqual([launchCaps({}).holderRewards, launchCaps({ LAUNCH_HOLDER_REWARDS: "" }).holderRewards, launchCaps({ LAUNCH_HOLDER_REWARDS: "off" }).holderRewards], [true, true, false]);
});

test("sanctuary cats: a visitor's coin from the cat's kit on pump.fun since the last scan (not yet in data/adoptions.json) is found live before signing: never sent, failed for good", async () => {
  const r = await ownSend((c) => ({ coins: [pumpCoin(1), pumpCoin(2, { name: c.coinName || c.name, symbol: c.ticker }), pumpCoin(3, { at: NOW - 3 * HOUR })] }));
  assert.equal(r.s.outcome, "taken", r.logs.join("\n"));
  assert.equal(r.sol.calls.filter((x) => x.method === "sendTransaction").length, 0);
  assert.deepEqual([r.row.status, r.row.retry], ["failed", false]);
  assert.match(r.row.reason, /visitor's adoption/);
  assert.ok(r.web.pumpAsked.length >= 1);
  // (the wallet's balance is read after the live check, right before the build: a deposit meanwhile never understates the loss)
  assert.equal(r.sol.calls.filter((x) => x.method === "getBalance").length, 0, "the funds are read after the live check");
});

test("sanctuary cats: pump.fun's launches the trend watch never read (fresh.gaps) since the cat's post are read back over by the live check; past the list's reach the row waits until a person approves the post; a window before the post, or an approved post, changes nothing", async () => {
  const gaps = (list) => (t) => fs.writeFileSync(path.join(t.root, "data/trending.json"), JSON.stringify({ ...t.json("data/trending.json"), fresh: { updatedAt: iso(NOW - HOUR), coveredUntil: iso(NOW - HOUR), gaps: list, items: [] } }));
  // (a mark ten minutes old: the cat, posted an hour ago, is then read back to only over a gap that ends after its post)
  const recent = (list) => (t) => fs.writeFileSync(path.join(t.root, "data/trending.json"), JSON.stringify({ ...t.json("data/trending.json"), fresh: { updatedAt: iso(NOW - 10 * 60_000), coveredUntil: iso(NOW - 10 * 60_000), gaps: list, items: [] } }));
  // A gap that began long before the cat's post is read back over only from the post on (nobody adopts a cat before it is
  // posted): from the post an hour ago, inside the list's two hours, so it launches; a list of 40 minutes does not reach it.
  const fromPost = await ownSend({ coins: [pumpCoin(1, { at: NOW - 2 * HOUR })], tail: false }, { patch: recent([{ from: iso(NOW - 5 * HOUR), to: iso(NOW - 20 * 60_000) }]) });
  assert.equal(fromPost.s.outcome, "launched", fromPost.logs.join("\n"));
  const short = await ownSend({ coins: [pumpCoin(1, { at: NOW - 40 * 60_000 })], tail: false }, { patch: recent([{ from: iso(NOW - 5 * HOUR), to: iso(NOW - 20 * 60_000) }]) });
  assert.equal(short.s.outcome, "adoption_unchecked", short.logs.join("\n"));
  assert.ok(short.logs.some((l) => /launches from 2026-09-25T16:00:00Z to/.test(l)), "the window named from the post on: " + short.logs.join("\n"));
  assert.deepEqual(unreadWindows([{ from: iso(NOW - 5 * HOUR), to: iso(NOW) }], NOW - HOUR).map((g) => g.fromMs), [NOW - HOUR]);
  // pump.fun's list reaches two hours back and no further: enough for the mark less its margin, not for a window from three hours back.
  const reach = { coins: [pumpCoin(1, { at: NOW - 2 * HOUR })], tail: false };
  // (the cat was posted an hour before NOW: released())
  const before = await ownSend(reach, { patch: gaps([{ from: iso(NOW - 3 * HOUR), to: iso(NOW - 90 * 60_000) }]) });
  assert.equal(before.s.outcome, "launched", before.logs.join("\n"));
  // (past the list's reach: a mark ten minutes old, a gap over the post an hour ago, a list of 40 minutes)
  const over = await ownSend({ coins: [pumpCoin(1, { at: NOW - 40 * 60_000 })], tail: false }, { patch: recent([{ from: iso(NOW - 3 * HOUR), to: iso(NOW - 20 * 60_000) }]) });
  assert.equal(over.s.outcome, "adoption_unchecked", over.logs.join("\n"));
  assert.ok(over.logs.some((l) => /were never read by the trend watch.*approve post \d+ in data\/launch-approvals\.json/.test(l)), over.logs.join("\n"));
  assert.equal(over.sol.calls.filter((x) => x.method === "sendTransaction").length, 0);
  assert.deepEqual([over.row.status, over.row.attempts], ["prepared", 0]);
  // Within the list's reach: a visitor's coin from the cat's kit in the window after the post (older than the mark less its margin) is found.
  const found = await ownSend((c) => ({ coins: [pumpCoin(1, { at: NOW - 2 * HOUR }), pumpCoin(2, { name: c.coinName || c.name, symbol: c.ticker, at: NOW - 50 * 60_000 })] }), { patch: recent([{ from: iso(NOW - 2 * HOUR), to: iso(NOW - 20 * 60_000) }]) });
  assert.equal(found.s.outcome, "taken", found.logs.join("\n"));
  // A person approved the post (they looked on pump.fun themselves): the window is not waited on.
  const ok = await ownSend({ coins: [pumpCoin(1, { at: NOW - 40 * 60_000 })], tail: false }, { patch: (t) => { recent([{ from: iso(NOW - 3 * HOUR), to: iso(NOW - 20 * 60_000) }])(t); fs.writeFileSync(path.join(t.root, FILES.approvals), JSON.stringify({ note: "test", approve: [OWN_TWEET] })); } });
  assert.equal(ok.s.outcome, "launched", ok.logs.join("\n"));
  // A window with no readable time counts from the kits' first day: the check waits.
  const bad = await ownSend({ coins: [pumpCoin(1, { at: NOW - 40 * 60_000 })], tail: false }, { patch: recent([{ from: "?", to: "?" }]) });
  assert.equal(bad.s.outcome, "adoption_unchecked", bad.logs.join("\n"));
});

test("sanctuary cats: a row tried again keeps the reserved slot too: with only the day's last launch left it is not prepared again, and a prepared one waits at the send, nothing sent", async () => {
  const c = ownCat();
  const w = throwaway();
  const t = ownSite(c, { wallet: w.address, posts: [] });
  const sol = fakeSolana({ wallet: w.address }), web = pumpSite(t.root), c0 = clock();
  await prepare({ io: t.io, env: ON(w, { LAUNCH_MAX_PER_DAY: "2" }), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, log: () => {} });
  const l = t.json(FILES.ledger);
  l.launches[0] = { ...l.launches[0], status: "failed", retry: true, reason: "gave way to a trending cat; prepared again once the slot is free", settledAt: iso(NOW) };
  fs.writeFileSync(path.join(t.root, FILES.ledger), `${JSON.stringify(l, null, 2)}\n`);
  const logs = [];
  await prepare({ io: t.io, env: ON(w, { LAUNCH_MAX_PER_DAY: "1" }), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, log: (x) => logs.push(x) });
  assert.equal(t.json(FILES.ledger).launches[0].status, "failed", logs.join("\n"));
  assert.ok(logs.some((x) => /not prepared again yet: the day's last launch .* is kept for a trending cat/.test(x)), logs.join("\n"));
  await prepare({ io: t.io, env: ON(w, { LAUNCH_MAX_PER_DAY: "2" }), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, log: () => {} });
  assert.equal(t.json(FILES.ledger).launches[0].status, "prepared");
  web.deployed = true;
  const s = await send({ io: t.io, env: ON(w, { LAUNCH_MAX_PER_DAY: "1" }), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, sleep: c0.sleep, log: (x) => logs.push(x), ...quick });
  assert.equal(s.outcome, "cap", logs.join("\n"));
  assert.equal(sol.calls.filter((x) => x.method === "sendTransaction").length, 0);
  assert.equal(t.json(FILES.ledger).launches[0].status, "prepared");
});

test("sanctuary cats: a cat that could not be prepared as it was any more at the send (its portrait gone from the site) is never sent: failed for good, like one taken", async () => {
  const r = await ownSend({}, { patch: (t, c) => { const pic = [c.portrait, c.lore?.image].find((p) => typeof p === "string" && fs.existsSync(path.join(t.root, p))); fs.rmSync(path.join(t.root, pic)); } });
  assert.equal(r.s.outcome, "ineligible", r.logs.join("\n"));
  assert.equal(r.sol.calls.filter((x) => x.method === "sendTransaction").length, 0);
  assert.deepEqual([r.row.status, r.row.retry], ["failed", false]);
  assert.match(r.row.reason, /no portrait on the site/);
});

test("sanctuary cats: the live check reads pump.fun back to the trend watch's last scan (less a margin), pages as it must, and ignores the sanctuary's own wallets and older coins", async () => {
  // Older than the scan less its margin: the trend watch's scan saw it (and data/adoptions.json has what it found). Not this check's.
  const old = await ownSend((c) => ({ coins: [pumpCoin(1, { name: c.coinName || c.name, symbol: c.ticker, at: NOW - 2 * HOUR })] }));
  assert.equal(old.s.outcome, "launched", old.logs.join("\n"));
  // A launcher wallet's own coin with the kit's name: the sanctuary's, never an adoption.
  const mine = await ownSend((c, w) => ({ coins: [pumpCoin(1, { name: c.coinName || c.name, symbol: c.ticker, creator: w.address })] }));
  assert.equal(mine.s.outcome, "launched", mine.logs.join("\n"));
  // 120 newer coins: three pages read, the kit's coin on the third found.
  const many = await ownSend((c) => ({ coins: [...Array.from({ length: 120 }, (_, i) => pumpCoin(i + 10, { at: NOW - i * 1000 })), pumpCoin(9, { name: c.coinName || c.name, symbol: c.ticker, at: NOW - 200_000 })] }));
  assert.equal(many.s.outcome, "taken");
  assert.equal(many.web.pumpAsked.length, 3);
});

test("sanctuary cats: pump.fun not answering, or no time for the last scan: nothing sent, the row waits (no attempt used) and the next run tries again", async () => {
  const down = await ownSend({ down: true });
  assert.equal(down.s.outcome, "adoption_unchecked", down.logs.join("\n"));
  assert.equal(down.sol.calls.filter((x) => x.method === "sendTransaction").length, 0);
  assert.deepEqual([down.row.status, down.row.attempts], ["prepared", 0]);
  const noScan = await ownSend({}, { patch: (t) => fs.writeFileSync(path.join(t.root, "data/trending.json"), JSON.stringify({ note: "x" })) });
  assert.equal(noScan.s.outcome, "adoption_unchecked");
  assert.equal(noScan.row.status, "prepared");
  const pages = await kitLaunchedSince({ fetchImpl: pumpSite(os.tmpdir(), { coins: Array.from({ length: 200 }, (_, i) => pumpCoin(i, { at: NOW - i })) }).fetchImpl, kit: { key: "ZZ", name: "Zed", ticker: "ZED" }, sinceMs: NOW - 10 * HOUR, pages: 2 });
  assert.match(pages.unchecked, /did not reach back/);
  // An empty page mid-walk is asked again: answered the second time, the walk goes on and reaches back (2026-10-01).
  const flaky = pumpSite(os.tmpdir(), { coins: Array.from({ length: 120 }, (_, i) => pumpCoin(i, { at: NOW - i * 60_000 })) }).fetchImpl;
  let emptied = 0;
  const once = async (url, init) => { if (String(url).includes("offset=50&") && emptied++ === 0) return new Response("[]", { status: 200 }); return flaky(url, init); };
  const went = await kitLaunchedSince({ fetchImpl: once, kit: { key: "ZZ", name: "Zed", ticker: "ZED" }, sinceMs: NOW - 90 * 60_000 });
  assert.deepEqual([went.unchecked, emptied], [undefined, 2], JSON.stringify(went));
  // Still empty after the retries: unchecked, and the log says how far it got.
  const stuck = await kitLaunchedSince({ fetchImpl: async (url, init) => (String(url).includes("offset=50&") ? new Response("[]", { status: 200 }) : flaky(url, init)), kit: { key: "ZZ", name: "Zed", ticker: "ZED" }, sinceMs: NOW - 90 * 60_000 });
  assert.match(stuck.unchecked, /did not reach back .* \(1 page\(s\) read, back to 2026-09-25T16:11:00Z of the 2026-09-25T15:30:00Z needed; pump\.fun answered offset 50 with an empty list\)/);
  // An empty page (HTTP 200, []) is not the list's end: unchecked, never "nobody adopted it".
  const empty = await ownSend({ tail: false });
  assert.equal(empty.s.outcome, "adoption_unchecked");
  assert.equal(empty.sol.calls.filter((x) => x.method === "sendTransaction").length, 0);
});

test("sanctuary cats: data/adoptions.json unreadable is never \"nobody adopted anything\": no cat is prepared, and a prepared one waits", async () => {
  const c = ownCat();
  const e = released(c.ticker);
  assert.match(sanctuaryRow(e, ownCtx({ entries: [e], adoptions: null })).problem, /cannot be read/);
  assert.equal(selectSanctuary(ownCtx({ entries: [e], adoptions: { note: "x" } })).row, null);
  const w = throwaway();
  const t = ownSite(c, { wallet: w.address, posts: [] });
  fs.writeFileSync(path.join(t.root, "data/adoptions.json"), "{ not json");
  const sol = fakeSolana({ wallet: w.address }), web = pumpSite(t.root), logs = [];
  const p = await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW, log: (l) => logs.push(l) });
  assert.equal(p.prepared, null);
  assert.ok(logs.some((l) => /data\/adoptions\.json cannot be read/.test(l)));
  const r = await ownSend({}, { patch: (t2) => fs.writeFileSync(path.join(t2.root, "data/adoptions.json"), "{ not json") });
  assert.equal(r.s.outcome, "adoption_unchecked");
  assert.equal(r.row.status, "prepared");
});

test("sanctuary cats: a cat that died (memorial: true) is launched as a tribute (the owner's choice), its lore line \"In loving memory of <name>.\"; a death in its words without the flag is never guessed (it may be another's): not launched; a pair keeps its own line; a sensitivity note, a new coin name or ticker since it was prepared stops the send", async () => {
  const c = ownCat();
  const e = released(c.ticker);
  const cats = shipped(FILES.adoptables).cats;
  const withCat = (patch) => ({ ...shipped(FILES.adoptables), cats: cats.map((x) => (x.ticker === c.ticker ? { ...x, ...patch } : x)) });
  for (const story of ["She died on 16 August 2026, aged 17.", "Venus (2009–2026) had two faces.", "He passed away in his sleep.", "Crossed the rainbow bridge in 2021.", "A funeral was held at the station."])
    assert.match(sanctuaryRow(e, ownCtx({ entries: [e], adoptables: withCat({ memorial: false, story: `${c.name} was famous. ${story}` }) })).problem, /mentions a death but it is not marked memorial/, story);
  const flagged = sanctuaryRow(e, ownCtx({ entries: [e], adoptables: withCat({ memorial: true, sensitivity: `In loving memory of ${c.name}.` }) }));
  assert.equal(flagged.row.lore, `In loving memory of ${c.name}.`);
  assert.ok(coinMetadata(flagged.row).description.startsWith(`In loving memory of ${c.name}.`));
  assert.equal(loreLinesOf({ ticker: "ZZ", name: "Cole & Marmalade", memorial: false, story: "Cole died in 2021. Marmalade lives on." }).includes("In loving memory of Cole & Marmalade."), false, "a pair may have lost only one");
  // The shipped cats: those that died are marked memorial and launch as tributes; the living whose stories name another's death are not tributes.
  const shippedRow = (t) => sanctuaryRow(released(t), ownCtx({ entries: [released(t)] }));
  for (const t of ["VENUS2F", "OSCARRI", "EMPTANG", "KENCHAN"]) assert.equal(shippedRow(t).row?.lore, `In loving memory of ${cats.find((x) => x.ticker === t).name}.`, t);
  for (const t of ["AIZUSAKURA", "CHOUPETCAT"]) { const r = shippedRow(t); assert.ok(!r.row?.lore?.startsWith("In loving memory"), t); assert.match(r.problem ?? "", /not marked memorial/, t); }
  assert.ok(!shippedRow("COLEMARM").row?.lore?.startsWith("In loving memory"), "Cole & Marmalade: only Cole died");
  for (const text of ["He died.", "death", "In loving memory", "(1998-2014)"]) assert.ok(DIED.test(text), text);
  assert.equal(DIED.test("She dyed her hair"), false);
  // Changed after it was prepared: the send-time check refuses it.
  const { row } = sanctuaryRow(e, ownCtx({ entries: [e] }));
  const now = (patch) => ownProblemNow(row, { ...ownCtx({ entries: [e], adoptables: withCat(patch) }) });
  assert.equal(now({}), null);
  assert.equal(now({ memorial: true, sensitivity: `In loving memory of ${c.name}.` }), null);
  assert.match(now({ sensitivity: "Ill since 2024; the owners asked for privacy." }), /sensitivity/);
  assert.match(now({ story: `${c.name} was famous. ${c.name} died in 2025.` }), /not marked memorial/);
  assert.match(now({ coinName: "Something Else Entirely" }), /names its coin otherwise/);
  assert.match(now({ launchTicker: "OTHERT" }), /launches as OTHERT/);
});

test("sanctuary cats: the day's last launch is kept for a trending cat (a sanctuary cat never takes it)", async () => {
  const c = ownCat();
  const w = throwaway();
  const t = ownSite(c, { wallet: w.address, posts: [] });
  const sol = fakeSolana({ wallet: w.address }), web = pumpSite(t.root), logs = [];
  const p = await prepare({ io: t.io, env: ON(w, { LAUNCH_MAX_PER_DAY: "1" }), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW, log: (l) => logs.push(l) });
  assert.equal(p.prepared, null);
  assert.ok(logs.some((l) => /last launch .* is kept for one/.test(l)), logs.join("\n"));
  const p2 = await prepare({ io: t.io, env: ON(w, { LAUNCH_MAX_PER_DAY: "2" }), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW, log: () => {} });
  assert.equal(p2.prepared, OWN_TWEET);
});

test("sanctuary cats: lore lines never stop at a title (\"Mr.\", \"Dr.\") and never cut a quote; the kind reads the look's lead clause (a plush coat is a real cat's; a logo or a render is a character)", () => {
  assert.equal(loreLinesOf({ ticker: "ZZ", name: "BeeJay", story: 'BeeJay, "Mr. B" for short, was a 26-pound cat at the refuge. He was big.' })[0], 'BeeJay, "Mr. B" for short, was a 26-pound cat at the refuge.');
  assert.equal(loreLinesOf({ ticker: "ZZ", name: "Oscar", story: "Oscar lived with Dr. Dosa at the home. He was calm." })[0], "Oscar lived with Dr. Dosa at the home.");
  assert.ok(loreLinesOf({ ticker: "ZZ", name: "Q", story: 'Q said "hello. And then left' }).every((l) => (l.match(/"/g) ?? []).length % 2 === 0));
  const kind = (look, category = "viral") => kindOfAdoptable({ category, look });
  assert.equal(kind("Two real cats. Cole is a solid jet-black semi-longhair with a plush, fluffy coat"), "real");
  assert.equal(kind("A grey tabby with a plush coat and green eyes"), "real");
  assert.equal(kind("A black flat graphic logo cat, Yamato Transport's 2021 Kuroneko mark"), "cartoon");
  assert.equal(kind("A 3D-rendered cat, not a real cat"), "cartoon");
  assert.equal(kind("A real black cat. His avatar is drawn as a cartoon"), "real");
  assert.equal(kind("Anything at all", "tv-movie"), "fiction");
  assert.equal(kind("A glowing, airbrushed cosmic digital painting. A cat built from bubbles. Not a real animal, no fur pattern.", "crypto"), "cartoon");
});

test("sanctuary cats: record refuses a cat whose card names its coin otherwise now (a person must look), never writing a launch the page could not match", async () => {
  const c = ownCat();
  const w = throwaway();
  const t = ownSite(c, { wallet: w.address, posts: [] });
  const sol = fakeSolana({ wallet: w.address }), web = pumpSite(t.root), c0 = clock();
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, log: () => {} });
  web.deployed = true;
  const s = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, sleep: c0.sleep, log: () => {}, ...quick });
  assert.equal(s.outcome, "launched");
  const a = t.json(FILES.adoptables);
  a.cats = a.cats.map((x) => (x.ticker === c.ticker ? { ...x, coinName: "Renamed Since" } : x));
  fs.writeFileSync(path.join(t.root, FILES.adoptables), `${JSON.stringify(a, null, 2)}\n`);
  const r = record({ io: t.io, env: ON(w), now: c0.now, log: () => {} });
  assert.deepEqual(r.recorded, []);
  assert.match(r.problems[0], /not in data\/adoptables\.json as it was/);
  assert.equal(t.json(FILES.adoptables).cats.find((x) => x.ticker === c.ticker).launch, undefined);
});

test("shipped data after a sanctuary prepare: its coin file passes the shipped coins check (a sanctuary cat's picture on the site, from the sanctuary's own post)", async () => {
  const c = ownCat();
  const w = throwaway();
  const t = ownSite(c, { wallet: w.address, posts: [] });
  const sol = fakeSolana({ wallet: w.address }), web = pumpSite(t.root);
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW, log: () => {} });
  const ledger = validateLedger(t.json(FILES.ledger));
  const row = ledger.launches.find((r) => r.postId === OWN_TWEET);
  const m = JSON.parse(t.read(row.metadataPath));
  assert.equal(t.read(row.metadataPath), metadataText(m));
  assert.ok(SITE_PICTURE.test(m.image) && m.twitter === `https://x.com/${OWN_HANDLE}/status/${OWN_TWEET}` && postIdOf(m.twitter) === OWN_TWEET);
  assert.equal(m.website, `${SITE_ORIGIN}/#cat=${m.symbol}`);
  assert.ok(Buffer.byteLength(metadataUri(OWN_TWEET)) <= 200);
});

test("sanctuary cats: the live check reads past a short page (a filtered row), and a kit coin with no real time is never let through", async () => {
  // Page 1 has 49 rows (one filtered out), the kit's coin is on page 2: found.
  const short = await kitLaunchedSince({
    fetchImpl: async (url) => {
      const offset = Number(new URL(url).searchParams.get("offset"));
      const list = offset === 0 ? Array.from({ length: 49 }, (_, i) => pumpCoin(i, { at: NOW - i * 1000 }))
        : offset === 49 ? [pumpCoin(100, { name: "Zed", symbol: "ZED", at: NOW - 60_000 }), pumpCoin(101, { at: NOW - 24 * HOUR })] : [];
      return new Response(JSON.stringify(list), { status: 200 });
    }, kit: { key: "ZZ", name: "Zed", ticker: "ZED" }, sinceMs: NOW - HOUR,
  });
  assert.deepEqual(short.taken, [pumpCoin(100).mint]);
  // A row whose time is null (Number(null) is 0) neither ends the walk nor hides a kit coin.
  const nul = await kitLaunchedSince({ fetchImpl: pumpSite(os.tmpdir(), { coins: [{ ...pumpCoin(5, { name: "Zed", symbol: "ZED" }), created_timestamp: null }, pumpCoin(6)] }).fetchImpl,
    kit: { key: "ZZ", name: "Zed", ticker: "ZED" }, sinceMs: NOW - HOUR });
  assert.deepEqual(nul.taken, [pumpCoin(5).mint]);
});

test("sanctuary cats: past the end of pump.fun's list (about 1,000 coins) the live check asks pump.fun's search for the kit's ticker, once the search has found one of the walk's oldest coins by its ticker; a search that is down, behind, ignores the term or is out of order waits", async () => {
  const kit = { key: "ZZ", name: "Zed", ticker: "ZED" }, json = (x) => new Response(JSON.stringify(x), { status: 200 });
  const byTime = (a, b) => b.created_timestamp - a.created_timestamp;
  // The list: 150 coins a minute apart, then an empty page (its end), short of `sinceMs` four hours back.
  const listed = Array.from({ length: 150 }, (_, i) => pumpCoin(i, { name: `Coin ${i}`, symbol: `COIN${i}`, at: NOW - i * 60_000 }));
  const site = ({ extra = [], mode = "ok", leaders = [] } = {}) => {
    const asked = [];
    const fetchImpl = async (url) => {
      const u = new URL(url), offset = Number(u.searchParams.get("offset"));
      if (u.pathname === "/coins") return json(listed.slice(offset, offset + 50));
      if (u.pathname !== "/coins/search-unrestricted") return new Response("not found", { status: 404 });
      const term = u.searchParams.get("searchTerm").toUpperCase();
      asked.push(term);
      if (mode === "down") return new Response("busy", { status: 503 });
      let all = [...listed, ...extra].filter((c) => [c.name, c.symbol].some((x) => x.toUpperCase().includes(term))).sort(byTime);
      if (mode === "behind") all = all.filter((c) => c.created_timestamp < NOW - 3 * HOUR);
      if (mode === "ignored") all = [...listed, ...extra].sort(byTime);
      if (mode === "oldest first") all.reverse();
      return json([...leaders, ...all].slice(offset, offset + 50));
    };
    return { fetchImpl, asked };
  };
  const check = (opts, since = NOW - 4 * HOUR) => { const w = site(opts); return kitLaunchedSince({ fetchImpl: w.fetchImpl, kit, sinceMs: since }).then((r) => ({ ...r, asked: w.asked })); };
  // Nobody launched it: the search, shown to hold the walk's oldest coin (COIN100, by its ticker), finds no ZED (an empty
  // answer is asked twice more before it is believed, as the list's empty page).
  const none = await check();
  assert.deepEqual([none.taken, none.searched, none.asked], [[], true, ["COIN100", "ZED", "ZED", "ZED"]], JSON.stringify(none));
  // A visitor's coin three hours back, past the list's end: found by the search.
  const zed = pumpCoin(500, { name: "Zed", symbol: "ZED", at: NOW - 3 * HOUR });
  assert.deepEqual((await check({ extra: [zed] })).taken, [zed.mint]);
  // Before `sinceMs`, from a launcher wallet, or only the ticker (another name): not the kit's adoption.
  assert.deepEqual((await check({ extra: [{ ...zed, created_timestamp: NOW - 5 * HOUR }] })).taken, []);
  const mine = site({ extra: [zed] });
  assert.deepEqual((await kitLaunchedSince({ fetchImpl: mine.fetchImpl, kit, sinceMs: NOW - 4 * HOUR, owners: new Set([zed.creator]) })).taken, []);
  assert.deepEqual((await check({ extra: [{ ...zed, name: "Zed Two" }] })).taken, []);
  // The search's closest matches come first, out of time order: up to SEARCH_LEADERS of them, the rest newest first.
  const lead = Array.from({ length: SEARCH_LEADERS }, (_, i) => pumpCoin(600 + i, { name: "Zedd", symbol: "ZEDD", at: NOW - (100 + i) * HOUR }));
  assert.deepEqual((await check({ extra: [zed], leaders: lead })).taken, [zed.mint]);
  // Down, behind (the walk's oldest coins not in it yet), ignoring the term, or out of order: unchecked, nothing believed.
  assert.match((await check({ mode: "down" })).unchecked, /did not reach back .*empty list\), and pump.fun's search did not find any of the walk's oldest coins by ticker \(down or behind\)$/);
  assert.match((await check({ mode: "behind" })).unchecked, /search did not find any of the walk's oldest coins/);
  assert.match((await check({ mode: "ignored" })).unchecked, /search did not find any of the walk's oldest coins/);
  const many = Array.from({ length: 60 }, (_, i) => pumpCoin(700 + i, { name: "Zed", symbol: "ZED", at: NOW - (2 * HOUR + i * 60_000) }));
  const unordered = site({ extra: many, mode: "oldest first" });
  assert.match((await pumpSearchSince({ fetchImpl: unordered.fetchImpl, term: "ZED", sinceMs: NOW - 4 * HOUR })).unchecked, /was not newest first/);
  const tooMany = site({ extra: many, leaders: [...lead, pumpCoin(650, { name: "Zedd", symbol: "ZEDD", at: NOW - 200 * HOUR })] });
  assert.match((await pumpSearchSince({ fetchImpl: tooMany.fetchImpl, term: "ZED", sinceMs: NOW - 4 * HOUR })).unchecked, /search for "ZED" was not newest first/, "one leader too many");
  // More results back to `sinceMs` than its pages: unchecked.
  assert.match((await pumpSearchSince({ fetchImpl: site({ extra: many }).fetchImpl, term: "ZED", sinceMs: NOW - 4 * HOUR, pages: 1 })).unchecked, /gave more than 50 coins back to/);
  // The walk reaching `sinceMs` asks no search at all; neither does a walk that read nothing.
  assert.deepEqual((await check({}, NOW - 30 * 60_000)).asked, []);
  const blank = await kitLaunchedSince({ fetchImpl: async (url) => (new URL(url).pathname === "/coins" ? json([]) : site().fetchImpl(url)), kit, sinceMs: NOW - HOUR });
  assert.match(blank.unchecked, /0 page\(s\) read/);
});

test("sanctuary cats: a cat posted before a gap in the trend watch's reading, past the list's reach, launches once pump.fun's search shows no coin of its kit, and is never launched when it shows one", async () => {
  const recent = (list) => (t) => fs.writeFileSync(path.join(t.root, "data/trending.json"), JSON.stringify({ ...t.json("data/trending.json"), fresh: { updatedAt: iso(NOW - 10 * 60_000), coveredUntil: iso(NOW - 10 * 60_000), gaps: list, items: [] } }));
  const gap = recent([{ from: iso(NOW - 5 * HOUR), to: iso(NOW - 20 * 60_000) }]);
  const ok = await ownSend({ coins: [pumpCoin(1, { at: NOW - 40 * 60_000 })], tail: false, search: true }, { patch: gap });
  assert.equal(ok.s.outcome, "launched", ok.logs.join("\n"));
  assert.deepEqual(ok.web.searchAsked, ["SOME", ...Array(3).fill(ok.row.ticker)]);
  const taken = await ownSend((c) => ({ coins: [pumpCoin(1, { at: NOW - 40 * 60_000 }), pumpCoin(2, { name: c.coinName || c.name, symbol: c.ticker, at: NOW - 50 * 60_000 })], tail: false, search: true }), { patch: gap });
  assert.equal(taken.s.outcome, "taken", taken.logs.join("\n"));
  assert.equal(taken.sol.calls.filter((x) => x.method === "sendTransaction").length, 0);
});

test("sanctuary cats: a prepared cat that waits (pump.fun's list down) gives way to a trending cat that may launch, and is prepared again once the slot is free; one waiting for hours is an error a person sees", async () => {
  const c = ownCat();
  const w = throwaway();
  const t = ownSite(c, { wallet: w.address, posts: [] });
  const sol = fakeSolana({ wallet: w.address }), web = pumpSite(t.root, { down: true }), logs = [];
  assert.equal((await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW, log: () => {} })).prepared, OWN_TWEET);
  web.deployed = true;
  assert.equal((await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW, sleep: async () => {}, log: () => {}, ...quick })).outcome, "adoption_unchecked");
  // Hours later, still waiting: an error in the log.
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW + (OWN_WAIT_ALERT_HOURS + 1) * HOUR, log: (l) => logs.push(l) });
  assert.ok(logs.some((l) => /^::error title=Launcher::.* has waited \d+ hours/.test(l)), logs.join("\n"));
  // A watch-list cat starts trending: the sanctuary cat gives way (failed, a retry, no attempt used) and the trending cat is prepared.
  fs.writeFileSync(path.join(t.root, "data/trending-cats.json"), `${JSON.stringify(trendingOf([post("2100000000000000001", { h: 1 })]), null, 2)}\n`);
  const later = NOW + 8 * HOUR;
  const p = await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => later, log: () => {} });
  assert.equal(p.prepared, "2100000000000000001");
  const own = t.json(FILES.ledger).launches.find((r) => r.postId === OWN_TWEET);
  assert.deepEqual([own.status, own.retry, own.attempts], ["failed", true, 0]);
  assert.match(own.reason, /gave way to a trending cat/);
});

test("sanctuary cats: a prepared cat follows its card until it is sent (marked memorial since: its lore line and metadata become the tribute before the send; the send waits for that)", async () => {
  const c = ownCat();
  const w = throwaway();
  const t = ownSite(c, { wallet: w.address, posts: [] });
  const sol = fakeSolana({ wallet: w.address }), web = pumpSite(t.root), c0 = clock();
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, log: () => {} });
  const before = t.json(FILES.ledger).launches[0];
  assert.ok(!before.lore.startsWith("In loving memory"));
  const a = t.json(FILES.adoptables);
  a.cats = a.cats.map((x) => (x.ticker === c.ticker ? { ...x, memorial: true, sensitivity: `In loving memory of ${x.name}.` } : x));
  fs.writeFileSync(path.join(t.root, FILES.adoptables), `${JSON.stringify(a, null, 2)}\n`);
  web.deployed = true;
  // The send sees the change first: it waits, sending nothing.
  const s1 = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, sleep: c0.sleep, log: () => {}, ...quick });
  assert.equal(s1.outcome, "card_changed");
  assert.equal(sol.calls.filter((x) => x.method === "sendTransaction").length, 0);
  // The prepare rewrites the row and its metadata; the send then launches the tribute.
  const logs = [];
  await prepare({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, log: (l) => logs.push(l) });
  const row = t.json(FILES.ledger).launches[0];
  assert.equal(row.lore, `In loving memory of ${c.name}.`);
  assert.ok(JSON.parse(t.read(row.metadataPath)).description.startsWith(`In loving memory of ${c.name}.`));
  assert.ok(logs.some((l) => /lore line is now/.test(l)));
  const s2 = await send({ io: t.io, env: ON(w), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, sleep: c0.sleep, log: () => {}, ...quick });
  assert.equal(s2.outcome, "launched");
});

test("shipped coins check: a sanctuary coin's file passes on its own (its X link the sanctuary's own post of its id), even once the ledger has dropped its row", () => {
  const id = "2105999999999999777";
  const m = { image: `${SITE_ORIGIN}/assets/portraits/SGTTIBBS.jpg`, twitter: `https://x.com/${OWN_HANDLE}/status/${id}` };
  const ok = (meta, f) => /^https:\/\/pbs\.twimg\.com\//.test(meta.image) || meta.image === SITE_IMAGE || (meta.twitter === `https://x.com/${OWN_HANDLE}/status/${f.slice(0, -5)}` && SITE_PICTURE.test(meta.image));
  assert.ok(ok(m, `${id}.json`));
  assert.ok(!ok(m, "2105999999999999778.json"), "another post's id");
  assert.ok(!ok({ ...m, twitter: `https://x.com/someone/status/${id}` }, `${id}.json`), "a stranger's post");
  assert.ok(!ok({ ...m, image: `${SITE_ORIGIN}/assets/og-image.jpg` }, `${id}.json`) || SITE_IMAGE === `${SITE_ORIGIN}/assets/og-image.jpg`);
});

test("the mint address ends in LAUNCH_MINT_SUFFIX (\"pump\" unless set): the send scans for the smallest nonce, keeps it on the row, and sends that mint; a scan out of its minutes goes on next run; a dry run scans nothing", async () => {
  const d = launchCaps({});
  assert.deepEqual([d.mintSuffix, d.mintGrindMs], ["pump", 12 * 60_000]);
  assert.deepEqual([launchCaps({ LAUNCH_MINT_SUFFIX: "none" }).mintSuffix, launchCaps({ LAUNCH_MINT_SUFFIX: "OFF" }).mintSuffix, launchCaps({ LAUNCH_MINT_SUFFIX: " cat " }).mintSuffix, launchCaps({ LAUNCH_MINT_GRIND_MINUTES: "99" }).mintGrindMs], ["", "", "cat", 30 * 60_000]);
  // A repository variable nobody set reaches the workflow as "": that is "pump", never "none" (Blehmilly, 2026-10-01).
  assert.deepEqual([launchCaps({}).mintSuffix, launchCaps({ LAUNCH_MINT_SUFFIX: "" }).mintSuffix, launchCaps({ LAUNCH_MINT_SUFFIX: "  " }).mintSuffix], ["pump", "pump", "pump"]);
  const odd = launchCaps({ LAUNCH_MINT_SUFFIX: "pump!" });
  assert.equal(odd.mintSuffix, "pump");
  assert.ok(odd.notes.some((n) => /LAUNCH_MINT_SUFFIX/.test(n)), odd.notes.join("; "));

  const c = ownCat();
  const w = throwaway();
  const t = ownSite(c, { wallet: w.address, posts: [] });
  const sol = fakeSolana({ wallet: w.address }), web = pumpSite(t.root), c0 = clock(), logs = [];
  const p = await prepare({ io: t.io, env: ON(w, { LAUNCH_MINT_SUFFIX: "p" }), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, log: () => {} });
  assert.equal(p.prepared, OWN_TWEET);
  web.deployed = true;
  // A dry run: no scan, the row untouched.
  const dryRun = await send({ io: t.io, env: { ...ON(w, { LAUNCH_MINT_SUFFIX: "p" }), LAUNCH_ENABLED: "dry" }, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, sleep: c0.sleep, log: (l) => logs.push(l), ...quick });
  assert.equal(dryRun.outcome, "dry", logs.join("\n"));
  assert.ok(logs.some((l) => /will end in "p" when it is sent for real/.test(l)), logs.join("\n"));
  assert.equal(t.json(FILES.ledger).launches[0].mintNonce, undefined);
  // Out of its minutes (a budget of nothing, one thread, "pump"): the row remembers where the scan got to, nothing is sent.
  const grinding = await send({ io: t.io, env: ON(w, { LAUNCH_MINT_SUFFIX: "pump" }), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, sleep: c0.sleep, log: (l) => logs.push(l), ...quick, mintGrindMs: 0, mintGrindWorkers: 1 });
  assert.equal(grinding.outcome, "mint_grinding", logs.join("\n"));
  const waiting = t.json(FILES.ledger).launches[0];
  assert.deepEqual([waiting.status, waiting.mintNonce, waiting.mintGrind, waiting.attempts], ["prepared", undefined, { next: 4001 }, 0]);
  assert.equal(sol.calls.filter((x) => x.method === "sendTransaction").length, 0);
  assert.equal(rowProblem(waiting), null);
  // The next run goes on from there (with a suffix it finds at once) and sends the mint it found.
  const s = await send({ io: t.io, env: ON(w, { LAUNCH_MINT_SUFFIX: "p" }), rpc: sol.rpc, fetchImpl: web.fetchImpl, now: c0.now, sleep: c0.sleep, log: (l) => logs.push(l), ...quick, mintGrindWorkers: 2 });
  assert.equal(s.outcome, "launched", logs.join("\n"));
  const row = t.json(FILES.ledger).launches[0];
  assert.ok(isMintNonce(row.mintNonce) && row.mintNonce >= 4001, JSON.stringify(row.mintNonce));
  assert.equal(row.mintGrind, undefined);
  assert.ok(row.mintPublic.endsWith("p"), row.mintPublic);
  assert.equal(row.mintPublic, deriveMintKeypair(w.kp, row.postId, row.mintNonce).publicKey);
  assert.equal(rowProblem(row), null);
  assert.ok(logs.some((l) => /a mint address ending in "p" found \(nonce \d+, \d+ derivations/.test(l)), logs.join("\n"));
  assert.equal(rowProblem({ ...row, mintNonce: 0 }), "mintNonce must be a positive whole number");
  assert.equal(rowProblem({ ...row, mintGrind: { next: 0 } }), "mintGrind is where the mint scan got to ({ next })");
});
