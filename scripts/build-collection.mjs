#!/usr/bin/env node
/**
 * BUILDS data/collection.json FROM SOLANA: every StonkFun launch paid by a wallet listed in
 * data/wallets.json, priced in one of the sanctuary's stock pairs (assets/collection.js
 * STOCK_PAIRS), becomes a resident token. The page matches it to its planned cat
 * (data/planned.json) by pair mint and ticker.
 *
 *   node scripts/build-collection.mjs            (the hourly workflow runs exactly this)
 *   SOLANA_RPC_URL=https://…  RPC_DELAY_MS=400   (both optional; the default is the public RPC, gently)
 *
 * For each listed wallet it pages getSignaturesForAddress back to the wallet's cursor (or, the
 * first time, back to its `since` date), reads each successful transaction oldest first
 * (getTransaction, json, maxSupportedTransactionVersion 0, finalized), and keeps only what
 * scripts/lib/chain.mjs proves is a launch: fee payer = the wallet, one direct LaunchLab
 * initialize_with_token_2022 on StonkFun's platform config, every LaunchLab account re-derived,
 * nothing in the transaction it cannot decode, the quote one of the stock pairs. It then reads
 * the new mint and the launch's global config back (getMultipleAccounts) and keeps the cat only
 * when the mint's own metadata carries the same name and symbol and the config is for that stock.
 *
 * It never drops a cat. The existing file must validate as a whole before anything is read
 * (a cat whose wallet was removed from wallets.json stops the run; give the wallet an `until`
 * date instead), the new file must validate as a whole and still hold every cat it held, and
 * both files are written atomically (a temporary file, then a rename), the collection first.
 * A run that fails part-way writes nothing, and the next run starts again from the same cursor;
 * a re-run with nothing new writes nothing.
 *
 * data/collection-state.json keeps, per wallet, the newest signature read (`newest`); the
 * launches refused with the reason (`refused`, newest first, the last 100); and transactions
 * that could not be read at all (`unread`, e.g. a version-1 transaction; the last 50). To read a
 * wallet again from its `since` date, delete its entry under `wallets`: cats are matched by mint,
 * so nothing is listed twice.
 *
 * LISTED LAUNCHES. Anyone can send a listed wallet cheap transactions, so a wallet's history can
 * be flooded. data/launches.json (optional) lists launch signatures by hand; every run proves each
 * one that is not in the collection yet, first and outside every budget, so a flood can delay the
 * wallet scan but never a listed launch. A listed launch is proved exactly like a scanned one.
 *
 * THE SCAN'S LIMITS. Reading stops after `readBudgetMs` (15 of the job's 20 minutes) or
 * MAX_TX_PER_RUN transactions, and the next run carries on from the cursor. A wallet with more
 * than MAX_PAGES pages of new signatures is not scanned that run (nothing is skipped: its cursor
 * stays), with a warning; listed launches still go through.
 *
 * THE RPC'S ANSWERS. A transaction must be the one asked for, and before a launch is listed every
 * signature it carries must verify over its message (scripts/lib/chain.mjs signaturesVerify), so
 * a provider cannot pass off another launch as the owner's. Either failure stops the run.
 *
 * UNREAD TRANSACTIONS. A transaction the RPC cannot give in version 0 (a version-1 transaction)
 * is kept in `unread` and read again on every run, so it is proved as soon as it can be read; the
 * run prints a workflow warning for it. It never fails the run: anyone can send such a
 * transaction naming the wallet, and a failed run would publish nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  validateCollection, validateWallets, entryProblem, compareEntries,
  isAddress, isSignature, parseTime, blockTimeToIso, textProblem, MAX_CATS,
} from "../assets/collection.js";
import { proveLaunch, checkLaunchAccounts, signaturesVerify } from "./lib/chain.mjs";
import { createRpc, PUBLIC_RPC, UNSUPPORTED_VERSION } from "./lib/rpc.mjs";

export const FILES = Object.freeze({
  wallets: "data/wallets.json",
  collection: "data/collection.json",
  state: "data/collection-state.json",
  launches: "data/launches.json",
});
export const PAGE = 1000;                 // getSignaturesForAddress's largest page
export const MAX_PAGES = 200;             // pages of new signatures read for one wallet in one run (200,000)
export const KEEP_SIGNATURES = 20_000;    // the oldest this many new signatures are kept for reading, oldest first
export const MAX_TX_PER_RUN = 5_000;      // transactions read per run; the next run carries on from the cursor
export const READ_BUDGET_MS = 15 * 60_000; // …and reading stops after this long (the job has 20 minutes)
export const MAX_LISTED = 200;            // launches data/launches.json may list
export const KEEP_REFUSED = 100;
export const KEEP_UNREAD = 50;

export class BuildError extends Error { constructor(message) { super(message); this.name = "BuildError"; } }

export const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

function readJson(root, rel, fallback) {
  let text;
  try { text = fs.readFileSync(path.join(root, rel), "utf8"); } catch (e) {
    if (e.code === "ENOENT" && fallback !== undefined) return { value: structuredClone(fallback), text: null };
    throw new BuildError(`${rel} could not be read (${e.code ?? e.message})`);
  }
  try { return { value: JSON.parse(text), text }; } catch { throw new BuildError(`${rel} is not valid JSON`); }
}

function writeAtomic(root, rel, text) {
  const file = path.join(root, rel);
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

const EMPTY_STATE = Object.freeze({ wallets: {}, refused: [], unread: [] });

/** data/collection-state.json, checked field by field; throws BuildError. */
export function validateState(state) {
  const bad = (why) => { throw new BuildError(`data/collection-state.json: ${why}`); };
  const obj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  if (!obj(state)) bad("not an object");
  const extra = Object.keys(state).filter((k) => !["wallets", "refused", "unread"].includes(k));
  if (extra.length) bad(`unknown field ${extra[0]}`);
  if (!obj(state.wallets)) bad("wallets must be an object");
  for (const [address, c] of Object.entries(state.wallets)) {
    if (!isAddress(address)) bad("a wallet key is not an address");
    if (!obj(c) || Object.keys(c).join() !== "newest" || !isSignature(c.newest)) bad(`the cursor for ${address} must be { newest: <signature> }`);
  }
  for (const list of ["refused", "unread"]) {
    if (!Array.isArray(state[list])) bad(`${list} must be a list`);
    for (const r of state[list]) {
      if (!obj(r) || Object.keys(r).some((k) => !["tx", "wallet", "clause", "detail", "time"].includes(k))) bad(`a ${list} row has an unknown field`);
      if (!isSignature(r.tx) || !isAddress(r.wallet) || !/^[a-z_]{2,32}$/.test(r.clause)) bad(`a ${list} row is malformed`);
      if (r.time !== null && parseTime(r.time, { dayAllowed: false }) === null) bad(`a ${list} row has a bad time`);
      if (r.detail !== undefined && textProblem(r.detail, { maxChars: 200 })) bad(`a ${list} row has a bad detail`);
    }
  }
  return {
    wallets: { ...state.wallets },
    refused: state.refused.map((r) => ({ ...r })),
    unread: state.unread.map((r) => ({ ...r })),
  };
}

/** data/launches.json: { launches: [{ tx, note? }] } → the signatures, in order. A missing file lists none. */
export function validateLaunches(data) {
  const bad = (why) => { throw new BuildError(`data/launches.json: ${why}`); };
  if (data === null || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.launches) || Object.keys(data).some((k) => !["note", "launches"].includes(k))) bad("must be { note?, launches: [{ tx, note? }] }");
  if (data.launches.length > MAX_LISTED) bad(`lists more than ${MAX_LISTED} launches`);
  const out = [];
  for (const l of data.launches) {
    if (l === null || typeof l !== "object" || Object.keys(l).some((k) => !["tx", "note"].includes(k))) bad("a row must be { tx, note? }");
    if (!isSignature(l.tx)) bad(`${String(l.tx).slice(0, 20)} is not a transaction signature`);
    if (l.note !== undefined && textProblem(l.note, { maxChars: 120 })) bad(`the note for ${l.tx.slice(0, 12)}… is not plain text`);
    if (!out.includes(l.tx)) out.push(l.tx);
  }
  return out;
}

/**
 * Signatures newer than the cursor (or, with none, back to `since`), oldest first: at most the
 * oldest KEEP_SIGNATURES of them (the rest are read on a later run). `overflow` when there are
 * more than MAX_PAGES pages of them: the wallet is not scanned this run.
 */
async function newSignatures(rpc, launcher, cursor, { maxPages = MAX_PAGES, keep = KEEP_SIGNATURES } = {}) {
  let out = [];
  let before = null;
  for (let page = 0; ; page++) {
    if (page >= maxPages) return { list: [], overflow: true };
    const list = await rpc.getSignaturesForAddress(launcher.address, { before, until: cursor, limit: PAGE });
    if (!Array.isArray(list)) throw new BuildError("getSignaturesForAddress answered in an unexpected shape");
    let reachedSince = false;
    for (const s of list) {
      if (!s || !isSignature(s.signature)) throw new BuildError("the wallet's history lists something that is not a signature");
      const blockTime = Number.isInteger(s.blockTime) ? s.blockTime : null;
      if (blockTime !== null && blockTime * 1000 < launcher.sinceMs) { reachedSince = true; break; }
      out.push({ signature: s.signature, blockTime, failed: s.err !== null && s.err !== undefined });
    }
    if (out.length > keep * 2) out = out.slice(-keep);   // newest first so far: keep the oldest
    if (reachedSince || list.length < PAGE) break;
    before = list.at(-1).signature;
  }
  return { list: out.slice(-keep).reverse(), overflow: false };
}

const byTimeDesc = (a, b) => (a.time ?? "") < (b.time ?? "") ? 1 : (a.time ?? "") > (b.time ?? "") ? -1 : 0;
function mergeLog(fresh, old, keep) {
  const seen = new Set(), out = [];
  for (const r of [...[...fresh].sort(byTimeDesc), ...old]) {
    if (seen.has(r.tx)) continue;
    seen.add(r.tx); out.push(r);
  }
  return out.slice(0, keep);
}

/**
 * One run. `rpc` is scripts/lib/rpc.mjs createRpc() (or anything with the same three reads).
 * Returns { written: { collection, state }, added, refused, unread, cats, read, overflow, warnings }.
 */
export async function buildCollection({ root, rpc, log = () => {}, nowMs = Date.now(), maxTxPerRun = MAX_TX_PER_RUN, readBudgetMs = READ_BUDGET_MS,
  maxPages = MAX_PAGES, clock = () => Date.now() }) {
  const wallets = validateWallets(readJson(root, FILES.wallets).value);
  if (wallets.refused.length) {
    const r = wallets.refused[0];
    throw new BuildError(`data/wallets.json: ${r.index === null ? "" : `launcher ${r.index + 1}: `}${r.detail}`);
  }
  const collectionFile = readJson(root, FILES.collection, { cats: [] });
  const before = validateCollection(collectionFile.value, { wallets, nowMs });
  if (before.refused.length) {
    const r = before.refused[0];
    throw new BuildError(`data/collection.json no longer validates (${r.index === null ? "" : `cat ${r.index + 1}: `}${r.detail}). `
      + "A cat is never dropped, so nothing was written. If a wallet was retired, keep it in data/wallets.json with an \"until\" date.");
  }
  const stateFile = readJson(root, FILES.state, EMPTY_STATE);
  const state = validateState(stateFile.value);
  const listed = validateLaunches(readJson(root, FILES.launches, { launches: [] }).value);

  const known = new Set(before.cats.map((c) => c.mint));
  const knownTx = new Set(before.cats.map((c) => c.tx));
  const added = [], refused = [], unread = [], resolved = new Set(), warnings = [], overflow = [];
  let budget = maxTxPerRun, read = 0;
  const deadline = clock() + readBudgetMs;
  const warn = (text) => { warnings.push(text); log(`::warning title=Collection::${text}`); };

  /** A transaction, read and checked to be the one asked for; undefined when the RPC cannot give it in version 0. */
  async function readTx(signature) {
    let tx;
    try { tx = await rpc.getTransaction(signature); } catch (e) {
      if (e.code !== UNSUPPORTED_VERSION) throw e;
      return undefined;
    }
    if (tx !== null && tx?.transaction?.signatures?.[0] !== signature) {
      throw new BuildError(`the RPC answered getTransaction(${signature.slice(0, 12)}…) with another transaction; nothing was written`);
    }
    return tx;
  }

  /** Proves `tx` for `wallet` and, if it is a new launch, reads it back and lists it. Records refusals in `row`'s log. */
  async function consider(tx, wallet, row) {
    const proof = proveLaunch(tx, { wallet });
    if (!proof.ok) {
      if (proof.launchLike) refused.push(row(proof.clause, proof.detail));
      else if (proof.clause === "unreadable" || proof.clause === "tx_version") unread.push(row(proof.clause, proof.detail));
      return proof;
    }
    if (known.has(proof.launch.mint)) return proof;
    if (!signaturesVerify(tx)) throw new BuildError(`the launch ${proof.launch.tx.slice(0, 12)}… as the RPC gave it does not carry valid signatures; nothing was written`);
    const L = proof.launch;
    const accounts = await rpc.getMultipleAccounts([L.mint, L.globalConfig]);
    if (!Array.isArray(accounts) || accounts.length !== 2) throw new BuildError("getMultipleAccounts answered in an unexpected shape");
    if (!accounts[0] || !accounts[1]) throw new BuildError(`the RPC did not return the new mint or its config for ${L.tx.slice(0, 12)}…; the next run tries again`);
    const check = checkLaunchAccounts(L, accounts[0], accounts[1]);
    const entry = { mint: L.mint, name: L.name, symbol: L.symbol, pair: L.pair, pool: L.pool, payer: L.payer, tx: L.tx, time: L.time };
    const problem = check.ok ? entryProblem(entry, { launchers: wallets.launchers, nowMs }) : check;
    if (problem) refused.push(row(problem.clause, problem.detail));
    // (A name read off the chain is never at the start of a log line, where it could pass for a workflow command.)
    else { added.push(entry); known.add(entry.mint); knownTx.add(entry.tx); log(`New cat: ${entry.name} (${entry.symbol}), paired with ${entry.pair.symbol}, moves in.`); }
    return proof;
  }
  const rowFor = (signature, wallet, time) => (clause, detail) => {
    const text = String(detail).slice(0, 200);
    return { tx: signature, wallet, clause, detail: textProblem(text, { maxChars: 200 }) ? clause.replace(/_/g, " ") : text, time };
  };

  /* 1. Listed launches (data/launches.json): each one not yet in the collection, and not refused before. */
  const refusedBefore = new Set(state.refused.map((r) => r.tx));
  for (const signature of listed) {
    if (knownTx.has(signature) || refusedBefore.has(signature)) continue;
    const tx = await readTx(signature);
    const payer = tx?.transaction?.message?.accountKeys?.[0];
    const launcher = wallets.launchers.find((l) => l.address === payer);
    const wallet = launcher?.address ?? (isAddress(payer) ? payer : wallets.launchers[0]?.address);
    if (!wallet) { log(`Listed launch ${signature.slice(0, 12)}…: no wallet is listed in data/wallets.json, so it cannot be proved.`); continue; }
    const time = Number.isInteger(tx?.blockTime) ? blockTimeToIso(tx.blockTime) : null;
    const row = rowFor(signature, wallet, time);
    if (tx === undefined) { unread.push(row("tx_version", "a transaction newer than version 0, which this builder does not read")); continue; }
    if (tx === null) { log(`Listed launch ${signature.slice(0, 12)}…: the RPC has no such finalized transaction yet; the next run tries again.`); continue; }
    if (!launcher) { refused.push(row("fee_payer", "the fee payer is not a wallet listed in data/wallets.json")); continue; }
    const proof = await consider(tx, wallet, row);
    if (!proof.ok && !proof.launchLike && proof.clause !== "unreadable" && proof.clause !== "tx_version") refused.push(row(proof.clause, proof.detail));
  }

  /* 2. Transactions that could not be read before (version 1): read again, in case they can be now. */
  for (const u of state.unread) {
    if (u.clause !== "tx_version" || knownTx.has(u.tx) || clock() > deadline) continue;
    const tx = await readTx(u.tx);
    if (tx === undefined || tx === null) continue;                 // still unreadable (or gone): kept
    resolved.add(u.tx);
    await consider(tx, u.wallet, rowFor(u.tx, u.wallet, u.time));
  }

  /* 3. Each listed wallet's new transactions, oldest first, within the run's budgets. */
  if (!wallets.launchers.length) log("No launcher wallet is listed in data/wallets.json yet, so there is nothing to read.");
  for (const launcher of wallets.launchers) {
    if (budget <= 0 || clock() > deadline) { log(`${launcher.label}: left for the next run (this run's reading is done).`); continue; }
    const { list: sigs, overflow: tooMany } = await newSignatures(rpc, launcher, state.wallets[launcher.address]?.newest ?? null, { maxPages });
    if (tooMany) {
      overflow.push(launcher.address);
      warn(`${launcher.label}: more than ${maxPages * PAGE} new transactions name this wallet, so it was not scanned this run (its cursor stays). Someone may be flooding it. List a launch's signature in data/launches.json to have it proved at once.`);
      continue;
    }
    let seen = 0;
    for (const s of sigs) {
      if (budget <= 0 || clock() > deadline) break;
      const time = s.blockTime === null ? null : blockTimeToIso(s.blockTime);
      const retired = launcher.untilMs !== null && s.blockTime !== null && s.blockTime * 1000 >= launcher.untilMs;
      if (!s.failed && !retired && !knownTx.has(s.signature)) {
        budget--; read++;
        const row = rowFor(s.signature, launcher.address, time);
        const tx = await readTx(s.signature);
        if (tx === null) throw new BuildError(`the RPC has no transaction for a finalized signature (${s.signature.slice(0, 12)}…); the next run tries again`);
        if (tx === undefined) unread.push(row("tx_version", "a transaction newer than version 0, which this builder does not read"));
        else await consider(tx, launcher.address, row);
      }
      state.wallets[launcher.address] = { newest: s.signature };
      seen++;
    }
    log(`${launcher.label}: ${seen} new ${seen === 1 ? "transaction" : "transactions"} looked at${seen < sigs.length ? `, ${sigs.length - seen} left for the next run` : ""}.`);
  }

  /* The new collection: every cat it had, plus the new ones. */
  const cats = [...before.cats, ...added].sort(compareEntries);
  if (cats.length > MAX_CATS) throw new BuildError(`the collection would hold ${cats.length} cats, more than ${MAX_CATS}; nothing was written`);
  const next = { cats };
  const after = validateCollection(next, { wallets, nowMs });
  if (after.refused.length || after.cats.length !== cats.length) throw new BuildError(`the new collection does not validate (${after.refused[0]?.detail ?? "a cat went missing"}); nothing was written`);
  const kept = new Set(after.cats.map((c) => c.mint));
  if (before.cats.some((c) => !kept.has(c.mint))) throw new BuildError("a cat would have been dropped; nothing was written");

  const nextState = {
    wallets: Object.fromEntries(Object.entries(state.wallets).sort(([a], [b]) => (a < b ? -1 : 1))),
    refused: mergeLog(refused, state.refused, KEEP_REFUSED),
    unread: mergeLog(unread, state.unread.filter((u) => !resolved.has(u.tx)), KEEP_UNREAD),
  };
  validateState(nextState);
  // Every run says so while a version-1 transaction naming a listed wallet is still unread: it may be a launch.
  const v1 = nextState.unread.filter((u) => u.clause === "tx_version");
  if (v1.length) warn(`${v1.length} version-1 ${v1.length === 1 ? "transaction names" : "transactions name"} a listed wallet and cannot be read yet (${v1.slice(0, 3).map((u) => `${u.tx.slice(0, 12)}…`).join(", ")}${v1.length > 3 ? ", …" : ""}); they are read again on every run. If one is a launch, see "Unread transactions" in the README.`);

  const collectionText = serialize(next), stateText = serialize(nextState);
  const written = { collection: collectionText !== collectionFile.text, state: stateText !== stateFile.text };
  if (written.collection) writeAtomic(root, FILES.collection, collectionText);
  if (written.state) writeAtomic(root, FILES.state, stateText);
  return { written, added, refused, unread, cats: cats.length, read, overflow, warnings };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const url = (process.env.SOLANA_RPC_URL ?? "").trim() || PUBLIC_RPC;
  const custom = url !== PUBLIC_RPC;
  const delayMs = Number(process.env.RPC_DELAY_MS) > 0 ? Number(process.env.RPC_DELAY_MS) : custom ? 100 : 400;
  try {
    const rpc = createRpc({ url, delayMs });
    console.log(`Reading Solana through ${custom ? "the RPC in SOLANA_RPC_URL" : "the public mainnet RPC"}, one call every ${delayMs} ms at most.`);
    const r = await buildCollection({ root, rpc, log: (m) => console.log(m) });
    console.log(`${r.read} ${r.read === 1 ? "transaction" : "transactions"} read, ${r.added.length} new ${r.added.length === 1 ? "cat" : "cats"}, `
      + `${r.refused.length} refused, ${r.unread.length} unread; ${r.cats} in the collection.`);
    for (const x of r.refused) console.log(`  refused ${x.tx.slice(0, 12)}… (${x.clause}): ${x.detail}`);
    console.log(r.written.collection || r.written.state
      ? `Wrote ${[r.written.collection && FILES.collection, r.written.state && FILES.state].filter(Boolean).join(" and ")}.`
      : "Nothing changed.");
  } catch (e) {
    console.error(`The collection was not updated: ${e.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
