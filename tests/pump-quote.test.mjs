/* The launcher, stage 4: a pump.fun launch priced in a coin (pump.fun's Custom Pairs), built by
   scripts/lib/pump.mjs as the official SDK builds it (@pump-fun/pump-sdk 2.0.0), allowed only for
   the coins data/pump-quotes.json lists, and proved by the Collection (scripts/lib/chain.mjs
   proveLaunchPump, assets/collection.js, scripts/build-collection.mjs). UNVERIFIED on chain: no real
   coin-priced create is recorded, so these tests prove the builder and the proof agree with each
   other and with the SDK's account order, not with a landed launch. No network, no real key. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  PUMP, PUMP_QUOTE_VERIFIED, QUOTE_LAUNCH_COMPUTE_UNIT_LIMIT, createV2Instruction, createV2Accounts, bondingCurve, associatedQuoteBondingCurve,
  buildLaunchTransaction, signLaunchTransaction, checkLaunchMessage, validatePumpQuotes, quoteProblem,
} from "../scripts/lib/pump.mjs";
import { proveLaunchPump, proveLaunch, checkPumpAccounts, signaturesVerify, BONDING_CURVE_DISC, BONDING_CURVE_QUOTE_OFFSET, STONKFUN_PLATFORM } from "../scripts/lib/chain.mjs";
import { keypairFromSecret, deriveMintKeypair, transactionToJson, decodeTransaction, decompileInstructions, compileLegacyMessage, ata, pda } from "../scripts/lib/solana-tx.mjs";
import { SYSTEM_PROGRAM, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, COMPUTE_BUDGET_PROGRAM } from "../scripts/lib/programs.mjs";
import { entryProblem, validateCollection, validateWallets, STOCK_PAIRS, SOL_PAIR, base58Decode, base58Encode } from "../assets/collection.js";
import { buildCollection, BuildError, serialize } from "../scripts/build-collection.mjs";
import { createRpc } from "../scripts/lib/rpc.mjs";
import { ROOT, PUMP_COIN, pumpLaunch, token2022MintData, tempSite, fakeRpc, recordedTransactions, recordedAccounts, readDataJson } from "./helpers.mjs";

const hexOf = (b) => Buffer.from(b).toString("hex");
const someAddress = () => base58Encode(randomBytes(32));
/** A made-up coin to price in (no real quote is listed: data/pump-quotes.json ships empty). */
const MEOW = Object.freeze({ symbol: "MEOW", mint: "MEoWkY1hD4n8vUe8vNQ4yLzVz9Hq1zVQf7mH3ZcVb2p", tokenProgram: TOKEN_2022_PROGRAM });
const PURR = Object.freeze({ symbol: "PURR", mint: "PuRRj4nYt8Pq3fGz9Hkq7W2bVx1yLmN5cD6eR8sT4uA", tokenProgram: TOKEN_PROGRAM });
const QUOTES = validatePumpQuotes({ quotes: [MEOW, PURR] }).quotes;

/** A coin-priced launch built and signed with throwaway keys, landed, with the two accounts the Collection reads back
    (the mint's metadata has no update authority, None: SYSTEM_PROGRAM, as create_v2 leaves it; see tests/helpers.mjs pumpLaunch). */
function quoteLaunch({ seedByte = 11, postId = "1971234567890123999", quote = MEOW, quotes = QUOTES, blockTime = 1790300000, curveQuote = quote.mint } = {}) {
  const wallet = keypairFromSecret(new Uint8Array(32).fill(seedByte));
  const mint = deriveMintKeypair(wallet, postId);
  const built = buildLaunchTransaction({ wallet, mint, ...PUMP_COIN, quote: { symbol: quote.symbol, mint: quote.mint }, quotes, recentBlockhash: base58Encode(Buffer.alloc(32, 9)) });
  const b64 = signLaunchTransaction(built, wallet, mint);
  const tx = transactionToJson(new Uint8Array(Buffer.from(b64, "base64")));
  Object.assign(tx, { slot: 450200000, blockTime, meta: { err: null, status: { Ok: null }, fee: 10000, innerInstructions: [], logMessages: [], preBalances: [], postBalances: [] } });
  const curve = bondingCurve(mint.publicKey);
  const curveData = Buffer.alloc(151);
  Buffer.from(BONDING_CURVE_DISC, "hex").copy(curveData, 0);
  Buffer.from(base58Decode(curveQuote)).copy(curveData, BONDING_CURVE_QUOTE_OFFSET);
  const accounts = new Map([
    [mint.publicKey, { owner: TOKEN_2022_PROGRAM, lamports: 1, executable: false, rentEpoch: 0, data: [token2022MintData({ mint: mint.publicKey, updateAuthority: SYSTEM_PROGRAM, ...PUMP_COIN }).toString("base64"), "base64"] }],
    [curve, { owner: PUMP.program, lamports: 1, executable: false, rentEpoch: 0, data: [curveData.toString("base64"), "base64"] }],
  ]);
  return { wallet: wallet.publicKey, mint: mint.publicKey, curve, tx, signature: tx.transaction.signatures[0], accounts, built, b64 };
}
const createOf = (tx) => tx.transaction.message.instructions.find((ix) => tx.transaction.message.accountKeys[ix.programIdIndex] === PUMP.program);

test("pump.fun's QuoteControl PDA re-derives from the SDK's seeds and is the account the research read on chain; the venue is marked unverified", () => {
  assert.equal(pda(["utf8:quote-control"], PUMP.program), PUMP.quoteControl);
  assert.equal(PUMP.quoteControl, "6z6GDdfb2AjR9ZhJmAUQ5cipJCVxQvLJhB2H8mCwTFBP");
  assert.equal(PUMP_QUOTE_VERIFIED, false, "no real coin-priced create is recorded");
  assert.deepEqual(QUOTES, [MEOW, PURR], "the made-up coins are well formed");
  assert.equal(BONDING_CURVE_QUOTE_OFFSET, 83, "the SDK IDL's BondingCurve: 8 + 5 × 8 + 1 + 32 + 1 + 1");
});

test("a coin-priced create_v2 is the SOL one plus the SDK's four remaining accounts (quote mint, the curve's quote account, the quote's program, QuoteControl), its data unchanged", () => {
  const user = keypairFromSecret(randomBytes(32)).publicKey, mint = someAddress();
  const sol = createV2Instruction({ mint, user, creator: user, ...PUMP_COIN });
  for (const quote of [MEOW, PURR]) {
    const ix = createV2Instruction({ mint, user, creator: user, ...PUMP_COIN, quote });
    assert.equal(ix.keys.length, 20);
    assert.deepEqual(ix.keys.slice(0, 16), sol.keys, "the sixteen are the SOL launch's");
    assert.deepEqual(ix.keys.slice(16), [
      { pubkey: quote.mint, isSigner: false, isWritable: false },
      { pubkey: ata(bondingCurve(mint), quote.mint, quote.tokenProgram), isSigner: false, isWritable: true },
      { pubkey: quote.tokenProgram, isSigner: false, isWritable: false },
      { pubkey: PUMP.quoteControl, isSigner: false, isWritable: false },
    ]);
    assert.equal(ix.keys[17].pubkey, associatedQuoteBondingCurve(mint, quote));
    assert.equal(hexOf(ix.data), hexOf(sol.data), "a quote changes no byte of the data");
    assert.deepEqual(createV2Accounts(mint, user, quote), ix.keys);
  }
  assert.notEqual(associatedQuoteBondingCurve(mint, MEOW), associatedQuoteBondingCurve(mint, { ...MEOW, tokenProgram: TOKEN_PROGRAM }), "the account depends on the quote's program");
  const refused = {
    "wrapped SOL": [{ ...MEOW, mint: SOL_PAIR.mint }, /SOL is not a quote/],
    "the zero key": [{ ...MEOW, mint: SYSTEM_PROGRAM }, /SOL is not a quote/],
    "another token program": [{ ...MEOW, tokenProgram: PUMP.program }, /token program/],
    "no program": [{ mint: MEOW.mint }, /token program/],
    "not an address": [{ ...MEOW, mint: "nope" }, /not a base58 address/],
    "the mint itself": [{ ...MEOW, mint }, /another coin/],
  };
  for (const [what, [quote, pattern]] of Object.entries(refused)) assert.throws(() => createV2Instruction({ mint, user, creator: user, ...PUMP_COIN, quote }), pattern, what);
  assert.throws(() => createV2Instruction({ mint, user, creator: user, ...PUMP_COIN, quote: MEOW, mayhemMode: true }), /6071/);
  assert.equal(quoteProblem(MEOW), null);
});

test("a coin-priced launch is built only for a coin data/pump-quotes.json lists, with more compute, and is checked from its bytes at sign time", () => {
  const L = quoteLaunch();
  assert.deepEqual(L.built.quote, MEOW);
  const { message } = decodeTransaction(new Uint8Array(Buffer.from(L.b64, "base64")));
  const ixs = decompileInstructions(message);
  assert.deepEqual(ixs.map((ix) => ix.programId), [COMPUTE_BUDGET_PROGRAM, COMPUTE_BUDGET_PROGRAM, PUMP.program]);
  assert.equal(Buffer.from(ixs[0].data).readUInt32LE(1), QUOTE_LAUNCH_COMPUTE_UNIT_LIMIT);
  assert.deepEqual(ixs[2].keys, createV2Accounts(L.mint, L.wallet, MEOW));
  assert.equal(signaturesVerify(L.tx), true);
  assert.doesNotThrow(() => checkLaunchMessage(L.built.messageBytes, { wallet: L.wallet, mint: L.mint, quote: MEOW }));
  assert.throws(() => checkLaunchMessage(L.built.messageBytes, { wallet: L.wallet, mint: L.mint }), /accounts are not the ones/, "a coin-priced launch is not a SOL one");
  assert.throws(() => checkLaunchMessage(L.built.messageBytes, { wallet: L.wallet, mint: L.mint, quote: PURR }), /accounts are not the ones/);
  const sol = pumpLaunch();
  assert.equal(proveLaunchPump(sol.tx, { wallet: sol.wallet, quotes: QUOTES }).ok, true, "a SOL launch is read as before");

  const wallet = keypairFromSecret(randomBytes(32)), mint = deriveMintKeypair(wallet, "7");
  const build = (over) => buildLaunchTransaction({ wallet, mint, ...PUMP_COIN, recentBlockhash: base58Encode(randomBytes(32)), ...over });
  assert.throws(() => build({ quote: { mint: MEOW.mint } }), /pump-quotes/, "no list: nothing is listed");
  assert.throws(() => build({ quote: { mint: someAddress() }, quotes: QUOTES }), /pump-quotes/);
  assert.throws(() => build({ quote: { mint: MEOW.mint, tokenProgram: TOKEN_PROGRAM }, quotes: QUOTES }), /token program is not the one/);
  assert.deepEqual(build({ quote: { mint: PURR.mint }, quotes: QUOTES }).quote, PURR, "the program comes from the list");
  assert.equal(build({}).quote, null);

  // swapped remaining accounts are never signed
  const ix = createV2Instruction({ mint: mint.publicKey, user: wallet.publicKey, creator: wallet.publicKey, ...PUMP_COIN, quote: MEOW });
  const built = build({ quote: MEOW, quotes: QUOTES });
  for (const i of [16, 17, 18, 19]) {
    const bad = { ...ix, keys: ix.keys.map((k, j) => (j === i ? { ...k, pubkey: someAddress() } : k)) };
    const msg = compileLegacyMessage({ payer: wallet.publicKey, recentBlockhash: base58Encode(randomBytes(32)), instructions: [bad] }).bytes;
    let calls = 0;
    const spy = (kp) => ({ publicKey: kp.publicKey, sign: (b) => { calls++; return kp.sign(b); } });
    assert.throws(() => signLaunchTransaction({ ...built, messageBytes: msg }, spy(wallet), spy(mint)), /accounts are not the ones/, `account ${i}`);
    assert.equal(calls, 0);
  }
});

test("the Collection proves a coin-priced pump.fun launch only when its coin is listed and every remaining account re-derives; the entry's pair is that coin", () => {
  const L = quoteLaunch();
  const r = proveLaunchPump(L.tx, { wallet: L.wallet, quotes: QUOTES });
  assert.equal(r.ok, true, r.detail);
  assert.deepEqual(r.launch, {
    mint: L.mint, name: PUMP_COIN.name, symbol: PUMP_COIN.symbol, pair: { symbol: "MEOW", mint: MEOW.mint }, pool: L.curve, payer: L.wallet,
    tx: L.signature, time: "2026-09-25T01:33:20Z", launchpad: "pump.fun", uri: PUMP_COIN.uri,
  });
  assert.deepEqual(checkPumpAccounts(r.launch, L.accounts.get(L.mint), L.accounts.get(L.curve)), { ok: true });
  assert.equal(proveLaunch(L.tx, { wallet: L.wallet }).clause, "no_launch", "LaunchLab's proof: not a LaunchLab launch");

  assert.equal(proveLaunchPump(L.tx, { wallet: L.wallet }).clause, "pump_quote_not_allowed", "shipped list: empty");
  assert.equal(proveLaunchPump(L.tx, { wallet: L.wallet, quotes: [PURR] }).clause, "pump_quote_not_allowed");
  assert.equal(proveLaunchPump(L.tx, { wallet: L.wallet, quotes: [{ ...MEOW, tokenProgram: TOKEN_PROGRAM }] }).clause, "pump_wrong_accounts", "listed under another program: the curve's quote account does not re-derive");
  assert.equal(proveLaunchPump(L.tx, { wallet: L.wallet, quotes: [{ ...MEOW, mint: "nope" }] }).clause, "pump_quote_not_allowed");
  assert.equal(proveLaunchPump(L.tx, { wallet: L.wallet, quotes: "MEOW" }).clause, "pump_quote_not_allowed");
  for (const [i, clause] of [[16, "pump_quote_not_allowed"], [17, "pump_wrong_accounts"], [18, "pump_wrong_accounts"], [19, "pump_wrong_accounts"]]) {
    const tx = structuredClone(L.tx), m = tx.transaction.message, c = createOf(tx);
    m.accountKeys.push(someAddress()); m.header.numReadonlyUnsignedAccounts += 1;
    c.accounts[i] = m.accountKeys.length - 1;
    assert.equal(proveLaunchPump(tx, { wallet: L.wallet, quotes: QUOTES }).clause, clause, `account ${i}`);
  }
  const three = structuredClone(L.tx);
  createOf(three).accounts.pop(); // no QuoteControl: not the form the builder makes
  assert.equal(proveLaunchPump(three, { wallet: L.wallet, quotes: QUOTES }).clause, "pump_not_sol");
  const mayhem = structuredClone(L.tx), mc = createOf(mayhem), d = Buffer.from(base58Decode(mc.data, 2000));
  d[d.length - 11] = 1; mc.data = base58Encode(d);
  assert.equal(proveLaunchPump(mayhem, { wallet: L.wallet, quotes: QUOTES }).clause, "pump_mayhem");
  const wrongWallet = quoteLaunch({ seedByte: 12 });
  assert.equal(proveLaunchPump(wrongWallet.tx, { wallet: L.wallet, quotes: QUOTES }).clause, "fee_payer");
});

test("the read-back of a coin-priced launch: its bonding curve must be priced in its quote; a SOL launch's read-back is unchanged", () => {
  const L = quoteLaunch();
  const { launch } = proveLaunchPump(L.tx, { wallet: L.wallet, quotes: QUOTES });
  const other = quoteLaunch({ curveQuote: PURR.mint });
  assert.match(checkPumpAccounts(launch, L.accounts.get(L.mint), other.accounts.get(other.curve)).detail, /not priced in the launch's quote/);
  const short = { ...L.accounts.get(L.curve), data: [Buffer.from(BONDING_CURVE_DISC, "hex").toString("base64"), "base64"] };
  assert.equal(checkPumpAccounts(launch, L.accounts.get(L.mint), short).clause, "bonding_curve");
  // a malformed curve answer is refused, never thrown, on the coin-priced path too; the mint's update authority must be None there as well
  for (const data of [[42], [], [null], [{}, "base64"]]) {
    let r;
    assert.doesNotThrow(() => { r = checkPumpAccounts(launch, L.accounts.get(L.mint), { owner: PUMP.program, data }); }, JSON.stringify(data));
    assert.equal(r.clause, "bonding_curve", JSON.stringify(data));
  }
  for (const key of [PUMP.mintAuthority, STONKFUN_PLATFORM, L.wallet]) {
    const mintWith = { ...L.accounts.get(L.mint), data: [token2022MintData({ mint: L.mint, updateAuthority: key, ...PUMP_COIN }).toString("base64"), "base64"] };
    assert.match(checkPumpAccounts(launch, mintWith, L.accounts.get(L.curve)).detail, /rename/, key);
  }
  const sol = pumpLaunch(), solProof = proveLaunchPump(sol.tx, { wallet: sol.wallet });
  assert.deepEqual(checkPumpAccounts(solProof.launch, sol.accounts.get(sol.mint), sol.accounts.get(sol.curve)), { ok: true }, "a SOL curve is not read for a quote");
});

/* (data/pump-quotes.json is the owner's, edited by hand: no test asserts its content (tests/venues-routing.test.mjs checks the owner's forms on fixtures), and this file,
   which gates the hourly Collection with the builder's own tests, never holds up the recording of a launch.) */
test("validatePumpQuotes' rules (one rule for the builder, the bots and the page: assets/collection.js)", () => {
  const refused = (quotes, pattern) => {
    const r = validatePumpQuotes({ quotes });
    assert.equal(r.refused.length, 1, pattern.source);
    assert.match(r.refused[0].detail, pattern);
  };
  refused([{ ...MEOW, decimals: 6 }], /unknown field decimals/);
  refused([{ ...MEOW, symbol: "<b>" }], /symbol/);
  refused([{ ...MEOW, symbol: "S".repeat(17) }], /symbol/);
  refused([{ ...MEOW, mint: SOL_PAIR.mint }], /SOL is not a quote/);
  refused([{ ...MEOW, tokenProgram: SYSTEM_PROGRAM }], /token program/);
  refused([{ ...MEOW, mint: STOCK_PAIRS.find((s) => s.symbol === "TSLAx").mint }], /stock pair/);
  refused([MEOW, { ...PURR, mint: MEOW.mint }], /listed twice/);
  refused([MEOW, { ...PURR, symbol: "MEOW" }], /listed twice/);
  refused(["MEOW"], /not an object/);
  for (const bad of [null, [], { quotes: {} }, { quotes: [], extra: 1 }, { note: 5, quotes: [] }]) assert.equal(validatePumpQuotes(bad).refused[0].index, null);
  assert.ok(QUOTES.every(Object.isFrozen));
  assert.deepEqual(validatePumpQuotes({ note: "x", quotes: [MEOW, PURR] }), { quotes: [MEOW, PURR], refused: [] });
});

test("the Collection's entry rules: a pump.fun entry may carry a listed coin as its pair, a StonkFun entry still only a stock pair; the fields stay closed", () => {
  const L = quoteLaunch();
  const { launch } = proveLaunchPump(L.tx, { wallet: L.wallet, quotes: QUOTES });
  const entry = { mint: launch.mint, name: launch.name, symbol: launch.symbol, pair: launch.pair, pool: launch.pool, payer: launch.payer, tx: launch.tx, time: launch.time, launchpad: "pump.fun" };
  const { launchers } = validateWallets({ launchers: [{ address: L.wallet, since: "2026-09-01", label: "Auto launcher" }] });
  const nowMs = Date.parse("2026-09-26T00:00:00Z");
  assert.equal(entryProblem(entry, { launchers, quotes: QUOTES, nowMs }), null);
  assert.equal(entryProblem(entry, { launchers, nowMs }).clause, "pair", "no list: refused");
  assert.equal(entryProblem({ ...entry, pair: { symbol: "PURR", mint: MEOW.mint } }, { launchers, quotes: QUOTES, nowMs }).clause, "pair");
  const stonk = { ...entry };
  delete stonk.launchpad;
  assert.equal(entryProblem(stonk, { launchers, quotes: QUOTES, nowMs }).clause, "pair", "a StonkFun entry is still priced in a stock pair only");
  assert.equal(entryProblem({ ...entry, quote: MEOW.mint }, { launchers, quotes: QUOTES, nowMs }).clause, "unknown_field");
  const wallets = { launchers: [{ address: L.wallet, since: "2026-09-01", label: "Auto launcher" }] };
  assert.deepEqual(validateCollection({ cats: [entry] }, { wallets, quotes: QUOTES, nowMs }).refused, []);
  assert.equal(validateCollection({ cats: [entry] }, { wallets, nowMs }).refused[0].clause, "pair");
  const sol = { ...entry, pair: { ...SOL_PAIR } };
  assert.equal(entryProblem(sol, { launchers, nowMs }), null, "SOL as before");
});

test("the collection builder lists a coin-priced launch when data/pump-quotes.json lists its coin, refuses it when not, and stops on a malformed list", async () => {
  const L = quoteLaunch();
  const site = () => {
    const root = tempSite({ wallets: { launchers: [{ address: L.wallet, since: "2026-09-01", label: "Auto launcher" }] } });
    const transactions = recordedTransactions();
    transactions.set(L.signature, { result: structuredClone(L.tx) });
    const accounts = recordedAccounts();
    for (const [k, v] of L.accounts) accounts.set(k, v);
    const hist = [{ signature: L.signature, slot: L.tx.slot, err: null, memo: null, blockTime: L.tx.blockTime, confirmationStatus: "finalized" }];
    const rpc = () => createRpc({ url: "https://rpc.example.test", fetchImpl: fakeRpc({ histories: { [L.wallet]: hist }, transactions, accounts }).fetchImpl, delayMs: 0, backoffMs: 0 });
    return { root, rpc };
  };
  const nowMs = Date.parse("2026-09-26T00:00:00Z");
  const listed = site();
  fs.writeFileSync(path.join(listed.root, "data/pump-quotes.json"), serialize({ note: "test", quotes: [MEOW] }));
  const r = await buildCollection({ root: listed.root, rpc: listed.rpc(), nowMs });
  assert.deepEqual(r.refused, []);
  assert.deepEqual(readDataJson(listed.root, "collection.json").cats, [{
    mint: L.mint, name: PUMP_COIN.name, symbol: PUMP_COIN.symbol, pair: { symbol: "MEOW", mint: MEOW.mint }, pool: L.curve, payer: L.wallet,
    tx: L.signature, time: "2026-09-25T01:33:20Z", launchpad: "pump.fun",
  }]);
  const again = await buildCollection({ root: listed.root, rpc: listed.rpc(), nowMs });
  assert.deepEqual(again.written, { collection: false, state: false });
  // the coin taken off the list while its cat is in the collection: the run stops, nothing is dropped
  fs.writeFileSync(path.join(listed.root, "data/pump-quotes.json"), serialize({ quotes: [] }));
  await assert.rejects(buildCollection({ root: listed.root, rpc: listed.rpc(), nowMs }), /no longer validates/);

  const unlisted = site();
  const u = await buildCollection({ root: unlisted.root, rpc: unlisted.rpc(), nowMs });
  assert.deepEqual(u.added, []);
  assert.deepEqual(u.refused.map((x) => x.clause), ["pump_quote_not_allowed"]);

  const malformed = site();
  fs.writeFileSync(path.join(malformed.root, "data/pump-quotes.json"), serialize({ quotes: [{ ...MEOW, mint: SOL_PAIR.mint }] }));
  await assert.rejects(buildCollection({ root: malformed.root, rpc: malformed.rpc(), nowMs }), (e) => e instanceof BuildError && /pump-quotes\.json: quote 1: SOL/.test(e.message));
});
