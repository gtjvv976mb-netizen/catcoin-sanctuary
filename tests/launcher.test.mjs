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
import { ROOT, DATA_NOW } from "./helpers.mjs";
import { base58Encode, validateCollection, validateWallets, isAddress } from "../assets/collection.js";
import { adoptableProblem, validateAdoptables, realPhotoOf, ADOPTABLE_CATEGORIES } from "../assets/ui/adoptables.js";
import { coatProblem } from "../assets/collection.js";
import { keypairFromSecret, deriveMintKeypair, transactionToJson, decodeTransaction, decompileInstructions } from "../scripts/lib/solana-tx.mjs";
import { decodeCreateV2, PUMP } from "../scripts/lib/pump.mjs";
import { proveLaunchPump, TOKEN_2022_PROGRAM, SYSTEM_PROGRAM } from "../scripts/lib/chain.mjs";
import { createRpc } from "../scripts/lib/rpc.mjs";
import { venueById, venueIds, chooseVenue, registerVenue, PUMP_SOL } from "../scripts/lib/venues.mjs";
import {
  prepare, send, record, launchMode, launchCaps, walletFromEnv, policyOf, selectCandidate, candidateRow, validateLedger, ledgerText, rowProblem,
  coinMetadata, metadataText, metadataUri, metadataPath, dayStats, capProblem, approvalsOf, figuresAtHome, watchText, signatureOf, feeUpperBound,
  FILES, LEDGER_NOTE, DEFAULT_CAPS, MAX_ATTEMPTS, SITE_ORIGIN, X_ACCOUNT, LAMPORTS_PER_SOL, CAP_RANGES,
} from "../scripts/lib/launcher.mjs";
import { main, fsStore, scrubber } from "../scripts/launch.mjs";
import { draftLaunch, checkUpdate, ADDRESS_LIKE, run as postUpdates } from "../scripts/post-updates.mjs";
import { cardLink, SITE, listCats } from "../scripts/announce.mjs";
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

/** A throwaway copy of the site's data (every data file, the 3D-model queue) with the launcher's wallet listed, and these trending posts. */
function site({ posts = [post("2100000000000000001")], wallet = null, approve = [], listWallet = true, ledger = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "launcher-"));
  fs.cpSync(path.join(ROOT, "data"), path.join(root, "data"), { recursive: true });
  fs.mkdirSync(path.join(root, "scripts"));
  fs.copyFileSync(path.join(ROOT, "scripts/meshy.queue.json"), path.join(root, "scripts/meshy.queue.json"));
  const w = (rel, v) => fs.writeFileSync(path.join(root, rel), typeof v === "string" ? v : `${JSON.stringify(v, null, 2)}\n`);
  w("data/trending-cats.json", trendingOf(posts));
  w("data/launch-approvals.json", { note: "test", approve });
  w("data/sanctuary-launches.json", ledger ?? { note: LEDGER_NOTE, launches: [] });
  w("data/cat-watch.json", watchText(WATCH));
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
 * chain), `refuse` (preflight refuses it), `drop` (the connection fails every time). Every call is recorded.
 */
function fakeSolana({ wallet, balance = 200_000_000, loss = 5_600_000, lastValid = 1150, height = 1000, time = NOW } = {}) {
  const s = { balance, loss, lastValid, height, land: "finalize", refuse: null, drop: false, simErr: null, onSend: null };
  const calls = [], txs = new Map(), statuses = new Map(), accounts = new Map(), history = new Map(), sent = [];
  async function fetchImpl(url, init) {
    const { id, method, params } = JSON.parse(init.body);
    calls.push({ method, params });
    const ok = (result) => new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), { status: 200 });
    const ctx = { slot: 450_000_000 };
    switch (method) {
      case "getBalance": return ok({ context: ctx, value: s.balance });
      case "getLatestBlockhash": return ok({ context: ctx, value: { blockhash: base58Encode(randomBytes(32)), lastValidBlockHeight: s.lastValid } });
      case "getBlockHeight": return ok(s.height);
      case "simulateTransaction":
        return ok({ context: ctx, value: s.simErr ? { err: s.simErr, logs: [], accounts: [null] }
          : { err: null, logs: [], unitsConsumed: 100_529, accounts: [{ lamports: s.balance - s.loss, owner: SYSTEM_PROGRAM, data: ["", "base64"], executable: false, rentEpoch: 0 }] } });
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
        txs.set(sig, { ...json, slot: 450_000_001, blockTime: Math.floor(time / 1000),
          meta: { err: failed ? { InstructionError: [2, { Custom: 6000 }] } : null, status: failed ? { Err: {} } : { Ok: null }, fee: 25_000,
            preBalances: [pre, ...json.transaction.message.accountKeys.slice(1).map(() => 0)], postBalances: [post, ...json.transaction.message.accountKeys.slice(1).map(() => 0)],
            innerInstructions: [], logMessages: [] } });
        statuses.set(sig, { slot: 450_000_001, confirmations: null, err: failed ? { InstructionError: [2, { Custom: 6000 }] } : null, confirmationStatus: "finalized" });
        s.balance = post;
        if (!failed) {
          const mint = json.transaction.message.accountKeys[1];
          accounts.set(mint, { owner: TOKEN_2022_PROGRAM, lamports: 2_702_560, data: ["", "base64"], executable: false, rentEpoch: 0 });
          history.set(mint, [{ signature: sig, err: null, blockTime: Math.floor(time / 1000), slot: 450_000_001 }, ...(history.get(mint) ?? [])]);
        }
        return ok(sig);
      }
      case "getSignatureStatuses": return ok({ context: ctx, value: params[0].map((x) => statuses.get(x) ?? null) });
      case "getTransaction": return ok(structuredClone(txs.get(params[0]) ?? null));
      case "getMultipleAccounts": return ok({ context: ctx, value: params[0].map((a) => accounts.get(a) ?? null) });
      case "getSignaturesForAddress": return ok(structuredClone(history.get(params[0]) ?? []));
      default: return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }), { status: 200 });
    }
  }
  const rpc = createRpc({ url: "https://rpc.example.test", fetchImpl, delayMs: 0, backoffMs: 0, retries: 1 });
  return { s, calls, sent, txs, accounts, fetchImpl, rpc, methods: () => calls.map((c) => c.method) };
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

const ON = (w, extra = {}) => ({ LAUNCH_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58, ...extra });
const quick = { metadataWaitMs: 60_000, metadataPollMs: 20_000, confirmWaitMs: 30_000, confirmPollMs: 3_000 };

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
  const adoptables = JSON.parse(readRoot("data/adoptables.json")), planned = JSON.parse(readRoot("data/planned.json"));
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

test("a candidate's row: its venue (pump.fun in SOL), its coin's metadata in pump.fun's shape, and the adoptable row it will get, valid", () => {
  const ctx = { nowMs: NOW, approvals: new Set(), watch: WATCH, ledger: { launches: [] }, adoptables: JSON.parse(readRoot("data/adoptables.json")), planned: JSON.parse(readRoot("data/planned.json")) };
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
    name: "Sir Gloopington", symbol: "GLOOP", description: "Gloopington stares down the camera from the top of the fridge. From the Catcoin Sanctuary.",
    image: "https://pbs.twimg.com/media/Gx2100000000000000201.jpg", showName: true, createdOn: "https://catcoinsanctuary.com",
    website: "https://catcoinsanctuary.com/#cat=GLOOP", twitter: "https://x.com/catcosanctuary",
  });
  assert.equal(metadataUri(row.postId), "https://catcoinsanctuary.com/coins/2100000000000000201.json");
  assert.ok(Buffer.byteLength(metadataUri(row.postId)) <= 200);
  assert.ok(checkUpdate(meta.description, ["Sir Gloopington", "Gloopington"]).ok, "the description passes the content rules");
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

/* ── the phases ───────────────────────────────────────────────────────────────────────── */

test("prepare: one cat, its metadata file and a prepared ledger row with no mint and no tx; the approvals untouched; the site is to be deployed", async () => {
  const w = throwaway();
  const t = site({ wallet: w.address, approve: ["2100000000000000555"] });
  const approvals = t.read(FILES.approvals);
  const sol = fakeSolana({ wallet: w.address }), web = fakeSite(t.root);
  const r = await prepare({ io: t.io, env: { LAUNCH_ENABLED: "on" }, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW });
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
  const r2 = await prepare({ io: t.io, env: { LAUNCH_ENABLED: "on" }, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW + 60_000 });
  assert.deepEqual([r2.changed, r2.pending], [false, true]);
  assert.equal(t.read(FILES.ledger), before);
  // Deployed: nothing to deploy.
  web.deployed = true;
  assert.equal((await prepare({ io: t.io, env: { LAUNCH_ENABLED: "on" }, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW })).deploy, false);
  // A crash between the two writes: the metadata file is written again.
  fs.rmSync(path.join(t.root, "coins/2100000000000000001.json"));
  assert.equal((await prepare({ io: t.io, env: { LAUNCH_ENABLED: "on" }, rpc: sol.rpc, fetchImpl: web.fetchImpl, now: () => NOW })).changed, true);
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
  // The simulation: the signed transaction, as sent, its own blockhash, signatures unchecked, the wallet's account after it.
  const sim = sol.calls.find((x) => x.method === "simulateTransaction");
  assert.deepEqual(sim.params[1], { encoding: "base64", sigVerify: false, replaceRecentBlockhash: false, commitment: "confirmed", accounts: { encoding: "base64", addresses: [w.address] } });
  const sends = sol.calls.filter((x) => x.method === "sendTransaction");
  assert.equal(sends.length, 1);
  assert.deepEqual(sends[0].params[1], { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 5 });
  assert.equal(sends[0].params[0], sim.params[0], "what was simulated is what was sent");
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
  const env = { LAUNCH_ENABLED: "dry", LAUNCH_WALLET_KEY: w.base58 };
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
  const p = await prepare({ io: t2.io, env: { LAUNCH_ENABLED: "on" }, rpc: sol2.rpc, fetchImpl: web2.fetchImpl, now: c.now });
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
  // Held from the announcer (its X post is the launch post), as every new adoptable is.
  assert.deepEqual(t.json(FILES.announced).cats.GLOOP, { status: "held", reason: "adoptable cat: announcing paused" });
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
  const snap = [FILES.adoptables, FILES.announced, FILES.launches, FILES.meshy, FILES.realPhotos, FILES.watch, FILES.ledger].map(t.read);
  assert.deepEqual(record({ io: t.io, env, now: c.now }).recorded, []);
  assert.deepEqual([FILES.adoptables, FILES.announced, FILES.launches, FILES.meshy, FILES.realPhotos, FILES.watch, FILES.ledger].map(t.read), snap);
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
  const ctx = { nowMs: NOW, approvals: new Set(), watch: WATCH, ledger: { launches: [] }, adoptables: JSON.parse(readRoot("data/adoptables.json")), planned: JSON.parse(readRoot("data/planned.json")) };
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

test("venues: a registry the other stages extend; pump.fun priced in SOL for every cat today", () => {
  assert.deepEqual(venueIds(), ["pump-sol"]);
  assert.equal(chooseVenue(post("2100000000000000601"), null).id, "pump-sol");
  assert.equal(venueById("pump-sol"), PUMP_SOL);
  assert.equal(venueById("stonkfun"), null);
  assert.deepEqual([PUMP_SOL.launchpad, PUMP_SOL.announceAs, PUMP_SOL.pair.symbol], ["pump.fun", "PumpFun", "SOL"]);
  assert.throws(() => registerVenue({ ...PUMP_SOL }), /registered already/);
  assert.throws(() => registerVenue({ ...PUMP_SOL, id: "x-test", launchpad: "raydium" }), /launchpad/);
  assert.throws(() => registerVenue({ ...PUMP_SOL, id: "x-test2", prove: null }), /prove must be a function/);
  assert.match(PUMP_SOL.textProblem({ name: "A".repeat(33), symbol: "AB", uri: metadataUri("2100000000000000601") }), /32 bytes/);
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
      const env = { LAUNCH_ENABLED: "on", LAUNCH_WALLET_KEY: key, SOLANA_RPC_URL: RPC_URL, GITHUB_OUTPUT: path.join(t.root, "out.txt") };
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
  const env = { LAUNCH_ENABLED: "on", LAUNCH_WALLET_KEY: w.base58, GITHUB_OUTPUT: out };
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

test("shipped: the ledger, the approvals and every coin's metadata are valid and canonical; every row's metadata file is there (exact while in flight)", () => {
  const ledgerRaw = readRoot(FILES.ledger);
  const ledger = validateLedger(JSON.parse(ledgerRaw));
  assert.equal(ledgerText(ledger), ledgerRaw);
  const approvals = JSON.parse(readRoot(FILES.approvals));
  assert.deepEqual(Object.keys(approvals).sort(), ["approve", "note"]);
  assert.ok(Array.isArray(approvals.approve) && approvals.approve.every((id) => /^\d{5,25}$/.test(id)), "post ids");
  assert.equal(readRoot(FILES.approvals), `${JSON.stringify(approvals, null, 2)}\n`);
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
    assert.equal(m.createdOn, SITE_ORIGIN); assert.equal(m.twitter, X_ACCOUNT); assert.equal(m.showName, true);
    assert.equal(m.website, `${SITE_ORIGIN}/#cat=${m.symbol}`);
    assert.match(m.image, /^https:\/\/pbs\.twimg\.com\//);
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
