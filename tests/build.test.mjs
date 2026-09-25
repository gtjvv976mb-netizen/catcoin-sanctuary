/* The collection builder over real recorded wallet histories: the cursor, never dropping a cat,
   idempotent re-runs, refusals, and failures that write nothing. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildCollection, BuildError, serialize } from "../scripts/build-collection.mjs";
import { createRpc } from "../scripts/lib/rpc.mjs";
import { validateCollection, base58Encode } from "../assets/collection.js";
import {
  fakeRpc, tempSite, readData, readDataJson, history, recordedTransactions, recordedAccounts, launchTx, launchHistory, V1,
  GME_LAUNCHER, GOOGL_LAUNCHER, GME_LAUNCH, GOOGL_LAUNCH, ANTHROPIC_LAUNCHER, IREN_LAUNCHER, OWNER, ROOT,
} from "./helpers.mjs";

const NOW = Date.parse("2026-09-25T18:00:00Z");
const GOOGL_WALLET = { address: GOOGL_LAUNCHER, since: "2026-09-01", label: "GOOGLx launcher" };
const GME_WALLET = { address: GME_LAUNCHER, since: "2026-09-01", label: "GMEx launcher" };
const rpcFor = (fake) => createRpc({ url: "https://rpc.example.test", fetchImpl: fake.fetchImpl, delayMs: 0, backoffMs: 0 });
const run = (root, fake, extra = {}) => buildCollection({ root, rpc: rpcFor(fake), nowMs: NOW, ...extra });
const txCalls = (fake) => fake.calls.filter((c) => c.method === "getTransaction").map((c) => c.params[0]);
const snapshot = (root) => Object.fromEntries(fs.readdirSync(path.join(root, "data")).map((f) => [f, readData(root, f)]));

test("the real GOOGLx launcher's whole history yields exactly its one launch", async () => {
  const root = tempSite({ wallets: { launchers: [GOOGL_WALLET] } });
  const hist = history(GOOGL_LAUNCHER);
  const fake = fakeRpc({ histories: { [GOOGL_LAUNCHER]: hist } });
  const r = await run(root, fake);
  assert.deepEqual(r.added.map((c) => [c.name, c.symbol, c.pair.symbol, c.tx]), [["MedPad", "MEDPAD", "GOOGLx", GOOGL_LAUNCH]]);
  assert.deepEqual(r.refused, []);                     // the wallet's other transactions are not launches, so nothing to record
  assert.deepEqual(r.written, { collection: true, state: true });
  assert.equal(r.read, hist.filter((s) => !s.err).length);
  const collection = readDataJson(root, "collection.json");
  assert.equal(collection.cats.length, 1);
  assert.deepEqual(Object.keys(collection.cats[0]), ["mint", "name", "symbol", "pair", "pool", "payer", "tx", "time"]);
  assert.equal(validateCollection(collection, { wallets: readDataJson(root, "wallets.json"), nowMs: NOW }).refused.length, 0);
  const state = readDataJson(root, "collection-state.json");
  assert.deepEqual(state.wallets, { [GOOGL_LAUNCHER]: { newest: hist[0].signature } });
  assert.equal(readData(root, "collection.json"), serialize(collection));
});

test("a re-run with nothing new reads nothing and writes nothing (idempotent)", async () => {
  const root = tempSite({ wallets: { launchers: [GOOGL_WALLET] } });
  const histories = { [GOOGL_LAUNCHER]: history(GOOGL_LAUNCHER) };
  await run(root, fakeRpc({ histories }));
  const before = snapshot(root);
  const fake = fakeRpc({ histories });
  const r = await run(root, fake);
  assert.deepEqual(r.written, { collection: false, state: false });
  assert.deepEqual(txCalls(fake), []);
  assert.equal(fake.calls.filter((c) => c.method === "getSignaturesForAddress")[0].params[1].until, histories[GOOGL_LAUNCHER][0].signature);
  assert.deepEqual(snapshot(root), before);
});

test("the cursor: a second run reads only what is newer, and the launch arrives then", async () => {
  const root = tempSite({ wallets: { launchers: [GOOGL_WALLET] } });
  const full = history(GOOGL_LAUNCHER);
  const at = full.findIndex((s) => s.signature === GOOGL_LAUNCH);
  const then = full.slice(at + 1);                     // the history as it stood just before the launch
  const first = await run(root, fakeRpc({ histories: { [GOOGL_LAUNCHER]: then } }));
  assert.equal(first.added.length, 0);
  assert.equal(readDataJson(root, "collection-state.json").wallets[GOOGL_LAUNCHER].newest, then[0].signature);

  const fake = fakeRpc({ histories: { [GOOGL_LAUNCHER]: full } });
  const second = await run(root, fake);
  assert.deepEqual(new Set(txCalls(fake)), new Set(full.slice(0, at + 1).filter((s) => !s.err).map((s) => s.signature)));
  assert.deepEqual(second.added.map((c) => c.tx), [GOOGL_LAUNCH]);
  assert.equal(readDataJson(root, "collection-state.json").wallets[GOOGL_LAUNCHER].newest, full[0].signature);
});

test("a cat is never dropped: an existing cat stays, a new one joins, newest first", async () => {
  const root = tempSite({ wallets: { launchers: [GME_WALLET, GOOGL_WALLET] } });
  // First the GMEx launcher alone, from its recorded window.
  const gmeHist = history(GME_LAUNCHER);
  await run(root, fakeRpc({ histories: { [GME_LAUNCHER]: gmeHist } }));
  assert.deepEqual(readDataJson(root, "collection.json").cats.map((c) => c.symbol), ["1GME"]);
  // Then both: the GMEx wallet has nothing new; the GOOGLx wallet has its launch.
  const r = await run(root, fakeRpc({ histories: { [GME_LAUNCHER]: gmeHist, [GOOGL_LAUNCHER]: history(GOOGL_LAUNCHER) } }));
  assert.equal(r.added.length, 1);
  assert.deepEqual(readDataJson(root, "collection.json").cats.map((c) => c.symbol), ["MEDPAD", "1GME"]);
  // A wallet whose history the RPC no longer returns at all loses nothing either.
  const again = await run(root, fakeRpc({ histories: {} }));
  assert.equal(again.cats, 2);
  assert.deepEqual(readDataJson(root, "collection.json").cats.map((c) => c.symbol), ["MEDPAD", "1GME"]);
});

test("a collection that no longer validates stops the run and nothing is written", async () => {
  const root = tempSite({ wallets: { launchers: [GME_WALLET, GOOGL_WALLET] } });
  await run(root, fakeRpc({ histories: { [GME_LAUNCHER]: history(GME_LAUNCHER), [GOOGL_LAUNCHER]: history(GOOGL_LAUNCHER) } }));
  // The owner removes the GMEx wallet instead of giving it an until date.
  fs.writeFileSync(path.join(root, "data/wallets.json"), serialize({ launchers: [GOOGL_WALLET] }));
  const before = snapshot(root);
  await assert.rejects(run(root, fakeRpc({ histories: {} })), (e) => e instanceof BuildError && /never dropped/.test(e.message));
  assert.deepEqual(snapshot(root), before);
  // With an until date after the launch the cat stays, and the wallet is no longer read.
  fs.writeFileSync(path.join(root, "data/wallets.json"), serialize({ launchers: [{ ...GME_WALLET, until: "2026-09-25" }, GOOGL_WALLET] }));
  const r = await run(root, fakeRpc({ histories: {} }));
  assert.equal(r.cats, 2);
});

test("an RPC that keeps failing part-way writes nothing and leaves the cursor; the next run completes", async () => {
  const root = tempSite({ wallets: { launchers: [GOOGL_WALLET] } });
  const histories = { [GOOGL_LAUNCHER]: history(GOOGL_LAUNCHER) };
  const before = snapshot(root);
  const broken = fakeRpc({ histories, fail: (method, params) => (method === "getTransaction" && params[0] === GOOGL_LAUNCH ? 503 : null) });
  await assert.rejects(run(root, broken), /kept refusing/);
  assert.deepEqual(snapshot(root), before);
  const r = await run(root, fakeRpc({ histories }));
  assert.deepEqual(r.added.map((c) => c.tx), [GOOGL_LAUNCH]);
});

test("a transaction the RPC cannot give in version 0 is noted as unread, and the cursor moves past it", async () => {
  const root = tempSite({ wallets: { launchers: [GOOGL_WALLET] } });
  const v1sig = V1.answer.params[0];
  const hist = [{ signature: v1sig, slot: 1, err: null, memo: null, blockTime: 1790290000, confirmationStatus: "finalized" }, ...history(GOOGL_LAUNCHER)];
  const r = await run(root, fakeRpc({ histories: { [GOOGL_LAUNCHER]: hist } }));
  assert.deepEqual(r.unread.map((u) => [u.tx, u.clause]), [[v1sig, "tx_version"]]);
  assert.equal(r.added.length, 1);
  const state = readDataJson(root, "collection-state.json");
  assert.equal(state.wallets[GOOGL_LAUNCHER].newest, v1sig);
  assert.equal(state.unread[0].clause, "tx_version");
});

test("a real launch the wallet paid for but which is not a sanctuary launch is recorded as refused, with the reason", async () => {
  // The real 4wACyqyi… launch (priced in SOL, not a stock pair), listed as its payer's only transaction.
  const tx = launchTx("4wACyqyi");
  const payer = tx.transaction.message.accountKeys[0];
  const root = tempSite({ wallets: { launchers: [{ address: payer, since: "2026-09-01", label: "Someone" }] } });
  const hist = launchHistory("4wACyqyi");
  const r = await run(root, fakeRpc({ histories: { [payer]: hist } }));
  assert.equal(r.added.length, 0);
  assert.deepEqual(readDataJson(root, "collection-state.json").refused.map((x) => [x.tx, x.clause]), [[hist[0].signature, "quote_not_stock"]]);
  assert.equal(readDataJson(root, "collection.json").cats.length, 0);
});

test("real launches priced in a PreStock and a Backpack stock move in, read back from the chain, newest first", async () => {
  const root = tempSite({ wallets: { launchers: [
    { address: ANTHROPIC_LAUNCHER, since: "2026-09-24", label: "PreStock launcher" },
    { address: IREN_LAUNCHER, since: "2026-09-24", label: "Backpack launcher" },
  ] } });
  const fake = fakeRpc({ histories: { [ANTHROPIC_LAUNCHER]: launchHistory("4Q6JhGwz"), [IREN_LAUNCHER]: launchHistory("5egBA4T2") } });
  const r = await run(root, fake);
  assert.deepEqual(r.refused, []);
  const cats = readDataJson(root, "collection.json").cats;
  assert.deepEqual(cats.map((c) => [c.symbol, c.pair.symbol, c.time]), [["HLFINC", "ANTHROPIC", "2026-09-24T20:29:58Z"], ["IRUN", "IREN", "2026-09-24T20:29:25Z"]]);
  assert.equal(fake.calls.filter((c) => c.method === "getMultipleAccounts").length, 2);
});

test("the owner's wallet: another wallet's real launch is never counted for it, and its own history is read from its since date", async () => {
  // The owner's wallet listed; the history the RPC gives for it holds a real launch paid by someone else.
  const root = tempSite({ wallets: { launchers: [{ address: OWNER, since: "2026-09-24T00:00:00Z", label: "Owner" }] } });
  const r = await run(root, fakeRpc({ histories: { [OWNER]: launchHistory("592bMtm5") } }));
  assert.equal(r.added.length, 0);
  assert.deepEqual(r.refused.map((x) => x.clause), ["fee_payer"]);
  // Signatures older than since are not read at all.
  const late = tempSite({ wallets: { launchers: [{ address: OWNER, since: "2026-09-25T00:00:00Z", label: "Owner" }] } });
  const fake = fakeRpc({ histories: { [OWNER]: launchHistory("592bMtm5") } });
  const r2 = await run(late, fake);
  assert.equal(r2.read, 0);
  assert.deepEqual(txCalls(fake), []);
});

test("a mint whose metadata does not match is refused; a mint the RPC does not return stops the run", async () => {
  const histories = { [GOOGL_LAUNCHER]: history(GOOGL_LAUNCHER) };
  const GOOGL_MINT = "FMWVAjJz6vuDqenkkncQAk7AamxjzaRHXJe13M8ZRuQ5";
  const swapped = recordedAccounts();
  swapped.set(GOOGL_MINT, swapped.get("EcB7LMNFXdSbzY4DQ6Uc9AKXmb9DCKqAeoNmLvNp3HvL")); // another launch's mint under this address
  const root = tempSite({ wallets: { launchers: [GOOGL_WALLET] } });
  const r = await run(root, fakeRpc({ histories, accounts: swapped }));
  assert.equal(r.added.length, 0);
  assert.deepEqual(r.refused.map((x) => x.clause), ["metadata"]);

  const missing = recordedAccounts();
  missing.delete(GOOGL_MINT);
  const root2 = tempSite({ wallets: { launchers: [GOOGL_WALLET] } });
  const before = snapshot(root2);
  await assert.rejects(run(root2, fakeRpc({ histories, accounts: missing })), /tries again/);
  assert.deepEqual(snapshot(root2), before);
});

test("since and until bound what is read", async () => {
  const hist = history(GOOGL_LAUNCHER);
  const late = tempSite({ wallets: { launchers: [{ ...GOOGL_WALLET, since: "2026-09-25" }] } });
  const r1 = await run(late, fakeRpc({ histories: { [GOOGL_LAUNCHER]: hist } }));
  assert.equal(r1.added.length, 0);
  const retired = tempSite({ wallets: { launchers: [{ ...GOOGL_WALLET, until: "2026-09-24T20:00:00Z" }] } });
  const fake = fakeRpc({ histories: { [GOOGL_LAUNCHER]: hist } });
  const r2 = await run(retired, fake);
  assert.equal(r2.added.length, 0);
  assert.ok(!txCalls(fake).includes(GOOGL_LAUNCH));
  assert.equal(readDataJson(retired, "collection-state.json").wallets[GOOGL_LAUNCHER].newest, hist[0].signature);
});

test("a per-run budget: the rest is read on the next run", async () => {
  const root = tempSite({ wallets: { launchers: [GOOGL_WALLET] } });
  const histories = { [GOOGL_LAUNCHER]: history(GOOGL_LAUNCHER) };
  const r1 = await run(root, fakeRpc({ histories }), { maxTxPerRun: 2 });
  assert.equal(r1.read, 2);
  const r2 = await run(root, fakeRpc({ histories }), { maxTxPerRun: 100 });
  assert.equal(r1.read + r2.read, histories[GOOGL_LAUNCHER].filter((s) => !s.err).length);
  assert.equal(r1.added.length + r2.added.length, 1);
});

test("with no wallet listed, nothing is read and nothing is written", async () => {
  const root = tempSite({ state: { wallets: {}, refused: [], unread: [] } });
  const before = snapshot(root);
  const fake = fakeRpc();
  const r = await run(root, fake);
  assert.deepEqual(fake.calls, []);
  assert.deepEqual(r.written, { collection: false, state: false });
  assert.deepEqual(snapshot(root), before);
});

test("the shipped data files are canonical and valid, so the first scheduled run changes nothing", async () => {
  const site = { wallets: readDataJson(ROOT, "wallets.json"), collection: readDataJson(ROOT, "collection.json"), state: readDataJson(ROOT, "collection-state.json") };
  for (const f of ["wallets.json", "collection.json", "collection-state.json", "planned.json", "launches.json"]) assert.equal(readData(ROOT, f), serialize(readDataJson(ROOT, f)), f);
  const root = tempSite(site);
  fs.copyFileSync(path.join(ROOT, "data/launches.json"), path.join(root, "data/launches.json"));
  const fake = fakeRpc();
  const r = await run(root, fake, { nowMs: Date.now() });
  assert.deepEqual(r.written, { collection: false, state: false });
  // the one listed wallet is the owner's, read from its since date
  assert.deepEqual(fake.calls.map((c) => [c.method, c.params[0]]), [["getSignaturesForAddress", OWNER]]);
});

test("bad state or wallet files stop the run with a plain reason", async () => {
  const badState = tempSite({ wallets: { launchers: [GOOGL_WALLET] }, state: { wallets: { [GOOGL_LAUNCHER]: { newest: "nope" } }, refused: [], unread: [] } });
  await assert.rejects(run(badState, fakeRpc()), /collection-state\.json/);
  const badWallet = tempSite({ wallets: { launchers: [{ ...GOOGL_WALLET, address: "0x1234" }] } });
  await assert.rejects(run(badWallet, fakeRpc()), /wallets\.json: launcher 1/);
});

test("the RPC client refuses a non-https URL and retries a rate limit before giving up", async () => {
  assert.throws(() => createRpc({ url: "http://rpc.example.test" }), /https/);
  let n = 0;
  const flaky = async () => (++n < 3 ? new Response("{}", { status: 429 }) : new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: 7 }), { status: 200 }));
  const rpc = createRpc({ url: "https://rpc.example.test", fetchImpl: flaky, delayMs: 0, backoffMs: 0 });
  assert.equal(await rpc.call("getSlot", []), 7);
  assert.equal(n, 3);
  const always = createRpc({ url: "https://rpc.example.test", fetchImpl: async () => new Response("{}", { status: 429 }), delayMs: 0, backoffMs: 0, retries: 2 });
  await assert.rejects(always.call("getSlot", []), /kept refusing/);
});

test("the recorded transactions the builder replays are the real ones (json, version 0 or legacy)", () => {
  const all = recordedTransactions();
  for (const s of [GME_LAUNCH, GOOGL_LAUNCH]) assert.equal(all.get(s).result.transaction.signatures[0], s);
});

/* ── Floods, listed launches, time budgets, the RPC's answers, version-1 transactions ─────── */

const randomSignature = (() => { let n = 0; return () => { const b = Buffer.alloc(64); b.writeUInt32BE(++n, 0); b[63] = 7; return base58Encode(b); }; })();
/** A successful transfer someone else paid for that names `wallet`: what a flood is made of. */
function spamTx(signature, wallet, blockTime) {
  return { slot: 1, blockTime, version: "legacy", meta: { err: null, status: { Ok: null }, innerInstructions: [], loadedAddresses: { writable: [], readonly: [] } },
    transaction: { signatures: [signature], message: { header: { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 1 },
      accountKeys: ["9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", wallet, "11111111111111111111111111111111"], recentBlockhash: base58Encode(Buffer.alloc(32, 1)),
      instructions: [{ programIdIndex: 2, accounts: [0, 1], data: base58Encode(Buffer.from([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])) }] } } };
}
/** The GOOGLx launcher's real launch, with `n` spam transfers naming the wallet sent in the hour before it. */
function floodedHistory(n) {
  const launch = launchHistory("592bMtm5")[0];
  const transactions = recordedTransactions(), hist = [];
  for (let i = 0; i < n; i++) {
    const s = randomSignature(), t = launch.blockTime - 3600 + Math.floor((i * 3500) / n);
    transactions.set(s, { result: spamTx(s, GOOGL_LAUNCHER, t) });
    hist.push({ signature: s, slot: 1, err: null, memo: null, blockTime: t, confirmationStatus: "finalized" });
  }
  return { histories: { [GOOGL_LAUNCHER]: [launch, ...hist.reverse()] }, transactions };
}
const putLaunches = (root, launches) => fs.writeFileSync(path.join(root, "data/launches.json"), serialize({ launches }));

test("a flood of transactions naming the wallet does not hold up its launch: the run reads on by time, not a fixed 300", async () => {
  const root = tempSite({ wallets: { launchers: [GOOGL_WALLET] } });
  const { histories, transactions } = floodedHistory(1200);
  const r = await run(root, fakeRpc({ histories, transactions }));
  assert.deepEqual(r.added.map((c) => c.tx), [GOOGL_LAUNCH], "listed on the first run");
  assert.equal(r.read, 1201);
  assert.deepEqual(r.refused, []);
});

test("more new signatures than a run pages through: the wallet is skipped with a warning (cursor kept, nothing else stops), and a launch listed in data/launches.json is proved at once", async () => {
  const root = tempSite({ wallets: { launchers: [GOOGL_WALLET] } });
  const { histories, transactions } = floodedHistory(2100);
  putLaunches(root, [{ tx: GOOGL_LAUNCH, note: "MedPad" }]);
  const logs = [];
  const r = await run(root, fakeRpc({ histories, transactions }), { maxPages: 2, log: (m) => logs.push(m) });
  assert.deepEqual(r.overflow, [GOOGL_LAUNCHER]);
  assert.deepEqual(r.added.map((c) => c.tx), [GOOGL_LAUNCH]);
  assert.equal(r.read, 0, "the flooded wallet was not scanned");
  assert.equal(readDataJson(root, "collection-state.json").wallets[GOOGL_LAUNCHER], undefined, "its cursor did not move");
  assert.ok(logs.some((m) => m.startsWith("::warning title=Collection::") && /not scanned this run/.test(m)));
  // Once the flood can be paged through, the scan catches up; the listed launch is not listed twice.
  const r2 = await run(root, fakeRpc({ histories, transactions }));
  assert.equal(r2.added.length, 0);
  assert.equal(r2.read, 2100);
  assert.deepEqual(readDataJson(root, "collection.json").cats.map((c) => c.tx), [GOOGL_LAUNCH]);
});

test("listed launches: the file is checked; a listed launch another wallet paid for is refused once and not read again", async () => {
  const root = tempSite({ wallets: { launchers: [{ address: OWNER, since: "2026-09-24", label: "Owner" }] } });
  putLaunches(root, [{ tx: GOOGL_LAUNCH }]);
  const fake = fakeRpc();
  const r = await run(root, fake);
  assert.deepEqual(r.added, []);
  assert.deepEqual(r.refused.map((x) => [x.tx, x.clause]), [[GOOGL_LAUNCH, "fee_payer"]]);
  const again = fakeRpc();
  await run(root, again);
  assert.ok(!txCalls(again).includes(GOOGL_LAUNCH), "a refused listed launch is not read again");
  for (const bad of [{ launches: [{ tx: "not a signature" }] }, { launches: [{ tx: GOOGL_LAUNCH, url: "https://x" }] }, { launch: [] }]) {
    fs.writeFileSync(path.join(root, "data/launches.json"), serialize(bad));
    await assert.rejects(run(root, fakeRpc()), /launches\.json/);
  }
});

test("a time budget: reading stops when the run's time is up, and the next run carries on from the cursor", async () => {
  const root = tempSite({ wallets: { launchers: [GOOGL_WALLET] } });
  const histories = { [GOOGL_LAUNCHER]: history(GOOGL_LAUNCHER) };
  let t = 0;
  const clock = () => (t += 1000);
  const r1 = await run(root, fakeRpc({ histories }), { clock, readBudgetMs: 3500 });
  assert.ok(r1.read >= 1 && r1.read < histories[GOOGL_LAUNCHER].filter((s) => !s.err).length, `read ${r1.read}`);
  const r2 = await run(root, fakeRpc({ histories }));
  assert.equal(r1.read + r2.read, histories[GOOGL_LAUNCHER].filter((s) => !s.err).length);
  assert.equal(r1.added.length + r2.added.length, 1);
});

test("the RPC's answer must be the transaction asked for, and a launch's signatures must verify, or the run stops and writes nothing", async () => {
  // Asked for X, answered with a real launch.
  const X = randomSignature();
  const hostile = recordedTransactions();
  hostile.set(X, { result: launchTx("592bMtm5") });
  const root = tempSite({ wallets: { launchers: [GOOGL_WALLET] } });
  const before = snapshot(root);
  await assert.rejects(run(root, fakeRpc({ histories: { [GOOGL_LAUNCHER]: [{ signature: X, slot: 1, err: null, memo: null, blockTime: 1790280000, confirmationStatus: "finalized" }] }, transactions: hostile })), /another transaction/);
  assert.deepEqual(snapshot(root), before);
  // A real launch relabelled as paid by the owner: every structural check passes, the owner's signature does not.
  const tx = launchTx("592bMtm5");
  const payer = tx.transaction.message.accountKeys[0];
  tx.transaction.message.accountKeys = tx.transaction.message.accountKeys.map((k) => (k === payer ? OWNER : k));
  const relabelled = recordedTransactions();
  relabelled.set(GOOGL_LAUNCH, { result: tx });
  const owner = tempSite({ wallets: { launchers: [{ address: OWNER, since: "2026-09-24", label: "Owner" }] } });
  const ownerBefore = snapshot(owner);
  await assert.rejects(run(owner, fakeRpc({ histories: { [OWNER]: launchHistory("592bMtm5") }, transactions: relabelled })), /valid signatures/);
  assert.deepEqual(snapshot(owner), ownerBefore);
});

test("a version-1 transaction is kept, warned about on every run and read again; once it can be read it is proved", async () => {
  const root = tempSite({ wallets: { launchers: [GOOGL_WALLET] } });
  const histories = { [GOOGL_LAUNCHER]: history(GOOGL_LAUNCHER) };
  const asV1 = recordedTransactions();
  asV1.set(GOOGL_LAUNCH, { error: { code: -32015, message: "Transaction version (1) is not supported by the requesting client." } });
  const logs = [];
  const r1 = await run(root, fakeRpc({ histories, transactions: asV1 }), { log: (m) => logs.push(m) });
  assert.equal(r1.added.length, 0);
  assert.deepEqual(r1.unread.map((u) => [u.tx, u.clause]), [[GOOGL_LAUNCH, "tx_version"]]);
  assert.ok(logs.some((m) => m.startsWith("::warning title=Collection::1 version-1 transaction")));
  const logs2 = [];
  await run(root, fakeRpc({ histories, transactions: asV1 }), { log: (m) => logs2.push(m) });
  assert.ok(logs2.some((m) => /version-1/.test(m)), "still warned on the next run");
  // The RPC (or a newer builder) can read it now: the next run proves it, though the cursor is long past it.
  const r3 = await run(root, fakeRpc({ histories }));
  assert.deepEqual(r3.added.map((c) => c.tx), [GOOGL_LAUNCH]);
  assert.deepEqual(readDataJson(root, "collection-state.json").unread, []);
});
