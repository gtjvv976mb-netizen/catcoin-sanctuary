/* The launcher's creator fees (scripts/lib/pump-fees.mjs): claiming pump.fun and PumpSwap creator
   fees into the launcher wallet as native SOL, checking a claim from its bytes before it is signed,
   reading what waits to be claimed, and measuring what a confirmed claim brought in. Proved against
   the addresses read on mainnet for the launcher (2026-09-30) and one real confirmed claim
   (4UuLLE…, slot 451,816,484: pump.fun collect_creator_fee_v2 + CreateIdempotent + PumpSwap
   collect_coin_creator_fee + CloseAccount, a v0 transaction, embedded below). No network, and no
   real key: every wallet that signs here is made from crypto.randomBytes. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { base58Decode, base58Encode } from "../assets/collection.js";
import {
  keypairFromSecret, compileLegacyMessage, encodeLegacyMessage, decodeLegacyMessage, decompileInstructions, decodeTransaction, transactionToJson,
  serializeTransaction, setComputeUnitLimit, setComputeUnitPrice, verifyEd25519, isWritableIndex, pda, PACKET_DATA_SIZE,
} from "../scripts/lib/solana-tx.mjs";
import { PUMP, anchorDiscriminator } from "../scripts/lib/pump.mjs";
import { WRAPPED_SOL_MINT } from "../scripts/lib/launchlab.mjs";
import { PUMPFUN_PROGRAM, SYSTEM_PROGRAM, TOKEN_PROGRAM, ATA_PROGRAM, COMPUTE_BUDGET_PROGRAM } from "../scripts/lib/programs.mjs";
import {
  PUMP_AMM_PROGRAM, PUMP_AMM, WSOL_MINT, CLAIM_DISC, EVENT_IX_TAG, EVENT_DISC, AMM_ROUTES, CLAIM_COMPUTE_UNITS, CLAIM_DEFAULTS,
  MAX_CLAIM_COMPUTE_UNIT_LIMIT, MAX_CLAIM_PRIORITY_FEE_LAMPORTS, MIN_CLAIM_LAMPORTS,
  creatorVault, creatorVaultWsolAta, ammCreatorVaultAuthority, ammCreatorVaultAta, wsolAta,
  collectCreatorFeeAccounts, collectCreatorFeeInstruction, transferCreatorFeesToPumpInstruction, collectCoinCreatorFeeInstruction,
  createWsolAtaIdempotentInstruction, closeWsolAtaInstruction, claimInstructions,
  buildClaimTransaction, checkClaimMessage, signClaimTransaction, unsignedClaimTransaction,
  creatorVaultClaimable, ammVaultClaimable, readClaimState, claimPlan, readClaimEvents, measureClaim, launchLabCreatorFeeClaim, walletWsolAmount,
} from "../scripts/lib/pump-fees.mjs";

/* ── fixed addresses ─────────────────────────────────────────────────────────────────── */

/** The launcher wallet (data/wallets.json "Auto launcher") and its accounts, as read on mainnet 2026-09-30. */
const LAUNCHER = "HxhisqFBeZRJcBWkjnumk6HwWxFLGVVD6jfX23tXHzQh";
const L = Object.freeze({
  creatorVault: "9zbjzqczm7wvzxUiohHxX4xrb6fW6a8fLzt7YGgvtnXN",       // lamports 119,999,879; claimable 119,349,639
  creatorVaultWsolAta: "37SA57PkbRqg7Nc1EGqeNeLrsXtWanACoMv4697DJAfg",
  wsolAta: "GgHR7cZCfLJ4Thv9PkELUoKHpmZXCTjVanL2YfF3Kz9c",
  ammVaultAuthority: "9W9EWujBo5UFTHFayKiQhuyRQb9Se4jTVH9k7CLa8M4S",
  ammVaultAta: "3JudFTshXkfUi25fhsWTVH1P9AZ6kWNqWtCcyGh2eHiZ",
});
/** Raydium CPMM: its collect_creator_fee has pump.fun's very discriminator. */
const RAYDIUM_CPMM = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
const RENT_0 = 650_240; // getMinimumBalanceForRentExemption(0) on 2026-09-30

/**
 * A real confirmed claim (getTransaction, encoding json; the log messages and token balances left
 * out): creator 4awAFy… sweeps both its vaults, pump.fun's creator vault (255,016,078 lamports) and
 * its PumpSwap vault (4,420,614,720 lamports of WSOL), into its own WSOL account and unwraps it.
 */
const REAL = Object.freeze(JSON.parse(`{"slot":451816484,"blockTime":1790731730,"version":0,"transaction":{"signatures":["4UuLLEbarehLjGTkSa5FCpof82ELpH5anbd2UtUSnAeFD8Wcmuab4pDyimatkmhTQaMRKYHHbJR1UbCe2SUDNATv"],"message":{"header":{"numReadonlySignedAccounts":0,"numReadonlyUnsignedAccounts":9,"numRequiredSignatures":1},"accountKeys":["4awAFycdK9Za3f1uYjvZN3d1S5RBqWjEyEbyFx2dxtep","7cNcQqrkVkRudXABzVnik86Mk3zrGYzCRYNB1sAGPHdi","2LmbxzfQS9LQRJ49zHMbJLfBATKpy8HeJYnVFqw7GQDF","FLVWmyV33ySZLhRXB92XJbPZjmpnpZVUa4cUtcSAj5uh","137RhBJH9JNH9HK67XMbW7BcvVRVN9Kof3myEpStKsJT","6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P","So11111111111111111111111111111111111111112","TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL","11111111111111111111111111111111","Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1","pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA","2thmS88ZXdYRh66FTCTAJAvjWTYMqnb3erLKKMPXbfu6","GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR"],"recentBlockhash":"3bVEc1GSiqSqKZnTAaYkLFDwT477t6MZBCahfiDpn4MY","instructions":[{"programIdIndex":5,"accounts":[0,1,2,3,6,7,8,9,10,5],"data":"bdpoExJbbLb"},{"programIdIndex":8,"accounts":[0,1,0,6,9,7],"data":"2"},{"programIdIndex":11,"accounts":[6,7,0,12,4,1,13,11],"data":"ToNg27JNfmT"},{"programIdIndex":7,"accounts":[1,0,0],"data":"A"}],"addressTableLookups":[]}},"meta":{"err":null,"fee":5000,"preBalances":[318215760786,0,255666318,0,4422103160,9296912471,1847978562676,200653906,3388612899,1,168261611,1178687650,0,4641093],"postBalances":[322891386584,0,650240,0,1488440,9296912471,1847978562676,200653906,3388612899,1,168261611,1178687650,0,4641093],"loadedAddresses":{"readonly":[],"writable":[]},"innerInstructions":[{"index":0,"instructions":[{"programIdIndex":9,"accounts":[2,0],"data":"3Bxs4QeX5i6fmG6b","stackHeight":2},{"programIdIndex":5,"accounts":[10],"data":"2Mdmj2S19dqYeqcakNgLhD14td4iRgsrneAZ14BVy2exDqryQXJkpigrFEWxX34rfgNN2eBaJ2vtuUWfsdFSexTKsDdyK7WDArz2ZZV4PCDxiPcqXrMieFneoTvzA65XsyPu","stackHeight":2}]},{"index":1,"instructions":[{"programIdIndex":7,"accounts":[6],"data":"84eT","stackHeight":2},{"programIdIndex":9,"accounts":[0,1],"data":"111135fAZn8PZBEU8J8iUmUTdbmBE6po1LhhgEJXngDjhxmUTshDA8EHdXaMJUsXdMg3PE","stackHeight":2},{"programIdIndex":7,"accounts":[1],"data":"P","stackHeight":2},{"programIdIndex":7,"accounts":[1,6],"data":"6QidqCB9RbzqQK97Rdu7tr24Pvy11FFzwg9mpkXiTG35n","stackHeight":2}]},{"index":2,"instructions":[{"programIdIndex":7,"accounts":[4,6,1,12],"data":"gvNBG1eGJsCqW","stackHeight":2},{"programIdIndex":11,"accounts":[13],"data":"QMqFu4fYGGesZ4pQnTT7Pdcx2kWhKxuYXujZJWGN21Um6s7vx3mYNXMa8V95wzV4qajrupJHMMAxEjqah98yjUf2p2kXEgK1TyTdoWVWFmmU2KoKiNWBsR4p3gTNFeGFjL7JJYg8GTqwMvAvFbvFBGNtYVzkGg511TvCUFv5gXYL9Vr","stackHeight":2}]}]}}`));
const REAL_CREATOR = "4awAFycdK9Za3f1uYjvZN3d1S5RBqWjEyEbyFx2dxtep";
const REAL_CURVE_FEE = 255_016_078n;
const REAL_AMM_FEE = 4_420_614_720n;

/**
 * The CollectCreatorFeeEvent a simulated launcher claim logged on mainnet (2026-09-30, "Program data:",
 * the event without the self-CPI tag): creator = the launcher, creator_fee 119,349,639, quote = the zero key.
 */
const LAUNCHER_EVENT = Buffer.from("egJ/AQ6/DK+zY7xqAAAAAPv/+tbbZg+w08MEG8q7qvH3kg6HUC7d0CPW5DMkiuyihyEdBwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==", "base64");
const LAUNCHER_CLAIMABLE = 119_349_639n;

/* ── helpers ─────────────────────────────────────────────────────────────────────────── */

const fresh = () => keypairFromSecret(randomBytes(32));
const someAddress = () => base58Encode(randomBytes(32));
const blockhash = () => base58Encode(randomBytes(32));
const hexOf = (b) => Buffer.from(b).toString("hex");
const sha8 = (text) => createHash("sha256").update(text).digest().subarray(0, 8);
const clone = (o) => JSON.parse(JSON.stringify(o));
/** "address W S" for an account meta (W writable, S signer), to compare account lists at a glance. */
const fmt = (keys) => keys.map((k) => `${k.pubkey}${k.isWritable ? " W" : ""}${k.isSigner ? " S" : ""}`);
const m = (pubkey, w = false, s = false) => ({ pubkey, isSigner: s, isWritable: w });
/** A message for `payer` with the compute budget and `ixs`, compiled as the builder compiles (no checks). */
const rawMessage = (payer, ixs, { limit = 40_000, price = 50_000 } = {}) =>
  compileLegacyMessage({ payer, recentBlockhash: blockhash(), instructions: [setComputeUnitLimit(limit), setComputeUnitPrice(price), ...ixs] }).bytes;
/** Decode a message, let `fn` change the decoded form, re-encode it. */
function tweak(bytes, fn) {
  const msg = decodeLegacyMessage(bytes);
  fn(msg);
  return encodeLegacyMessage(msg);
}
const systemTransfer = (from, to, lamports) => {
  const data = Buffer.alloc(12); data.writeUInt32LE(2, 0); data.writeBigUInt64LE(BigInt(lamports), 4);
  return { programId: SYSTEM_PROGRAM, keys: [m(from, true, true), m(to, true)], data: new Uint8Array(data) };
};
/** A getTransaction-shaped answer (json, legacy) for a compiled message, with `meta` (its balances default to zeros). */
function jsonTx(messageBytes, meta = {}) {
  const n = decodeLegacyMessage(messageBytes).header.numRequiredSignatures;
  const tx = transactionToJson(serializeTransaction(messageBytes, Array.from({ length: n }, () => new Uint8Array(64))));
  const keys = tx.transaction.message.accountKeys.length;
  return { slot: 1, blockTime: 1_790_000_000, ...tx, meta: { err: null, fee: 5000, preBalances: Array(keys).fill(0), postBalances: Array(keys).fill(0), innerInstructions: [], loadedAddresses: { writable: [], readonly: [] }, ...meta } };
}
/** An event self-CPI's data: the tag, the event's discriminator and fields. */
const pumpEventData = ({ creator, amount, quoteMint = SYSTEM_PROGRAM, timestamp = 1_790_000_000n }) => {
  const d = Buffer.alloc(16 + 80);
  Buffer.from(EVENT_IX_TAG + EVENT_DISC.collectCreatorFee, "hex").copy(d, 0);
  d.writeBigInt64LE(timestamp, 16); Buffer.from(base58Decode(creator)).copy(d, 24); d.writeBigUInt64LE(BigInt(amount), 56); Buffer.from(base58Decode(quoteMint)).copy(d, 64);
  return d;
};
const ammEventData = ({ creator, amount, vaultAta, tokenAccount, timestamp = 1_790_000_000n }) => {
  const d = Buffer.alloc(16 + 112);
  Buffer.from(EVENT_IX_TAG + EVENT_DISC.collectCoinCreatorFee, "hex").copy(d, 0);
  d.writeBigInt64LE(timestamp, 16); Buffer.from(base58Decode(creator)).copy(d, 24); d.writeBigUInt64LE(BigInt(amount), 56);
  Buffer.from(base58Decode(vaultAta)).copy(d, 64); Buffer.from(base58Decode(tokenAccount)).copy(d, 96);
  return d;
};

/* ── discriminators and PDAs ─────────────────────────────────────────────────────────── */

test("every discriminator is sha256 of its Anchor name, and the event tag is Anchor's EVENT_IX_TAG", () => {
  assert.deepEqual(CLAIM_DISC, {
    collectCreatorFee: anchorDiscriminator("collect_creator_fee"),
    collectCreatorFeeV2: anchorDiscriminator("collect_creator_fee_v2"),
    transferCreatorFeesToPump: anchorDiscriminator("transfer_creator_fees_to_pump"),
    collectCoinCreatorFee: anchorDiscriminator("collect_coin_creator_fee"),
  });
  assert.deepEqual(Object.values(CLAIM_DISC), ["1416567bc61cdb84", "cf118af204221338", "8b348655e4e56cf1", "a039592ab58b2b42"]);
  assert.equal(EVENT_DISC.collectCreatorFee, hexOf(sha8("event:CollectCreatorFeeEvent")));
  assert.equal(EVENT_DISC.collectCoinCreatorFee, hexOf(sha8("event:CollectCoinCreatorFeeEvent")));
  assert.deepEqual(Object.values(EVENT_DISC), ["7a027f010ebf0caf", "e8f5c2eeeada3a59"]);
  const tag = Buffer.alloc(8); tag.writeBigUInt64LE(0x1d9acb512ea545e4n);
  assert.equal(EVENT_IX_TAG, hexOf(tag));
  assert.equal(EVENT_IX_TAG, hexOf(Buffer.from(sha8("anchor:event")).reverse()));
  assert.equal(LAUNCHER_EVENT.subarray(0, 8).toString("hex"), EVENT_DISC.collectCreatorFee, "the logged event starts with its discriminator");
});

test("every PDA re-derives to the address read on mainnet, for the launcher and for the real claim's creator", () => {
  assert.equal(PUMP_AMM.program, PUMP_AMM_PROGRAM);
  assert.equal(pda(["utf8:__event_authority"], PUMP_AMM_PROGRAM), PUMP_AMM.eventAuthority);
  assert.equal(PUMP_AMM.eventAuthority, "GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR");
  assert.equal(pda(["utf8:__event_authority"], PUMPFUN_PROGRAM), PUMP.eventAuthority);
  assert.equal(WSOL_MINT, WRAPPED_SOL_MINT);
  assert.equal(creatorVault(LAUNCHER), L.creatorVault);
  assert.equal(creatorVaultWsolAta(LAUNCHER), L.creatorVaultWsolAta);
  assert.equal(wsolAta(LAUNCHER), L.wsolAta);
  assert.equal(ammCreatorVaultAuthority(LAUNCHER), L.ammVaultAuthority);
  assert.equal(ammCreatorVaultAta(LAUNCHER), L.ammVaultAta);
  // the hyphen is pump.fun's, the underscore PumpSwap's: the other spelling under either program is another address
  assert.notEqual(pda(["utf8:creator_vault", LAUNCHER], PUMPFUN_PROGRAM), L.creatorVault);
  assert.notEqual(pda(["utf8:creator-vault", LAUNCHER], PUMP_AMM_PROGRAM), L.ammVaultAuthority);
  // the real claim names each of its creator's accounts: every one is what this module derives
  const k = REAL.transaction.message.accountKeys;
  assert.equal(k[0], REAL_CREATOR);
  assert.deepEqual([wsolAta(REAL_CREATOR), creatorVault(REAL_CREATOR), creatorVaultWsolAta(REAL_CREATOR), ammCreatorVaultAta(REAL_CREATOR), ammCreatorVaultAuthority(REAL_CREATOR)],
    [k[1], k[2], k[3], k[4], k[12]]);
  assert.throws(() => creatorVault("not an address"), /not a base58 address/);
});

/* ── the instructions ────────────────────────────────────────────────────────────────── */

test("each claim instruction is byte-exact: its program, its data and its accounts in the IDL's order, with the IDL's flags", () => {
  const v1 = collectCreatorFeeInstruction({ creator: LAUNCHER, version: 1 });
  assert.equal(v1.programId, PUMPFUN_PROGRAM);
  assert.equal(hexOf(v1.data), "1416567bc61cdb84");
  assert.deepEqual(fmt(v1.keys), [`${LAUNCHER} W`, `${L.creatorVault} W`, SYSTEM_PROGRAM, PUMP.eventAuthority, PUMPFUN_PROGRAM]);

  const v2 = collectCreatorFeeInstruction({ creator: LAUNCHER });
  assert.equal(v2.programId, PUMPFUN_PROGRAM);
  assert.equal(hexOf(v2.data), "cf118af204221338");
  assert.deepEqual(fmt(v2.keys), [
    `${LAUNCHER} W`, `${L.wsolAta} W`, `${L.creatorVault} W`, `${L.creatorVaultWsolAta} W`,
    WSOL_MINT, TOKEN_PROGRAM, ATA_PROGRAM, SYSTEM_PROGRAM, PUMP.eventAuthority, PUMPFUN_PROGRAM,
  ]);
  assert.deepEqual(collectCreatorFeeAccounts(LAUNCHER, 2), v2.keys);
  assert.equal(CLAIM_DEFAULTS.curveVersion, 2);

  const toPump = transferCreatorFeesToPumpInstruction({ coinCreator: LAUNCHER });
  assert.equal(toPump.programId, PUMP_AMM_PROGRAM);
  assert.equal(hexOf(toPump.data), "8b348655e4e56cf1");
  assert.deepEqual(fmt(toPump.keys), [
    WSOL_MINT, TOKEN_PROGRAM, SYSTEM_PROGRAM, ATA_PROGRAM, LAUNCHER,
    `${L.ammVaultAuthority} W`, `${L.ammVaultAta} W`, `${L.creatorVault} W`, PUMP_AMM.eventAuthority, PUMP_AMM_PROGRAM,
  ]);

  const amm = collectCoinCreatorFeeInstruction({ coinCreator: LAUNCHER });
  assert.equal(amm.programId, PUMP_AMM_PROGRAM);
  assert.equal(hexOf(amm.data), "a039592ab58b2b42");
  assert.deepEqual(fmt(amm.keys), [WSOL_MINT, TOKEN_PROGRAM, LAUNCHER, L.ammVaultAuthority, `${L.ammVaultAta} W`, `${L.wsolAta} W`, PUMP_AMM.eventAuthority, PUMP_AMM_PROGRAM]);

  const create = createWsolAtaIdempotentInstruction({ owner: LAUNCHER });
  assert.equal(create.programId, ATA_PROGRAM);
  assert.equal(hexOf(create.data), "01");
  assert.deepEqual(fmt(create.keys), [`${LAUNCHER} W S`, `${L.wsolAta} W`, LAUNCHER, WSOL_MINT, SYSTEM_PROGRAM, TOKEN_PROGRAM]);

  const close = closeWsolAtaInstruction({ owner: LAUNCHER });
  assert.equal(close.programId, TOKEN_PROGRAM);
  assert.equal(hexOf(close.data), "09");
  assert.deepEqual(fmt(close.keys), [`${L.wsolAta} W`, `${LAUNCHER} W`, `${LAUNCHER} S`]);

  assert.throws(() => collectCreatorFeeInstruction({ creator: LAUNCHER, version: 3 }), /version 1 or 2/);
  assert.throws(() => collectCoinCreatorFeeInstruction({}), /not a base58 address/);
});

test("the real mainnet claim (4UuLLE…) is rebuilt instruction for instruction from its creator alone, and passes the checker", () => {
  const msg = REAL.transaction.message;
  const keys = msg.accountKeys;
  const want = claimInstructions({ wallet: REAL_CREATOR, amm: "wsol", createWsolAta: true, curveVersion: 2 });
  assert.equal(msg.instructions.length, want.length);
  const writable = new Set([REAL_CREATOR, ...want.flatMap((ix) => ix.keys.filter((k) => k.isWritable).map((k) => k.pubkey))]);
  msg.instructions.forEach((ix, n) => {
    assert.equal(keys[ix.programIdIndex], want[n].programId, `instruction ${n}'s program`);
    assert.equal(hexOf(base58Decode(ix.data, 100)), hexOf(want[n].data), `instruction ${n}'s data`);
    assert.deepEqual(ix.accounts.map((i) => keys[i]), want[n].keys.map((k) => k.pubkey), `instruction ${n}'s accounts`);
  });
  keys.forEach((k, i) => {
    assert.equal(isWritableIndex(msg.header, keys.length, i), writable.has(k), `the writable flag of ${k}`);
  });
  // the same message in the legacy wire format is a claim the checker accepts (it names no compute budget)
  const legacy = encodeLegacyMessage({ header: msg.header, accountKeys: keys, recentBlockhash: msg.recentBlockhash, instructions: msg.instructions.map((ix) => ({ ...ix, data: base58Decode(ix.data, 100) })) });
  const shape = checkClaimMessage(legacy, { wallet: REAL_CREATOR });
  assert.deepEqual({ ...shape }, { curve: true, curveVersion: 2, amm: "wsol", createWsolAta: true, computeUnitLimit: null, computeUnitPriceMicroLamports: null, priorityFee: 0n });
  assert.throws(() => checkClaimMessage(legacy, { wallet: LAUNCHER }), /not the wallet/);
});

/* ── the transaction ─────────────────────────────────────────────────────────────────── */

test("buildClaimTransaction: every route builds, checks, has one signer, fits a packet, signs and verifies", () => {
  const routes = [
    [{}, { curve: true, curveVersion: 2, amm: null, createWsolAta: false }, ["curve"]],
    [{ curveVersion: 1 }, { curve: true, curveVersion: 1, amm: null, createWsolAta: false }, ["curve"]],
    [{ amm: "sweep" }, { curve: true, curveVersion: 2, amm: "sweep", createWsolAta: false }, ["toPump", "curve"]],
    [{ amm: "sweep", curveVersion: 1 }, { curve: true, curveVersion: 1, amm: "sweep", createWsolAta: false }, ["toPump", "curve"]],
    [{ amm: "wsol" }, { curve: true, curveVersion: 2, amm: "wsol", createWsolAta: true }, ["curve", "create", "amm", "close"]],
    [{ amm: "wsol", createWsolAta: false }, { curve: true, curveVersion: 2, amm: "wsol", createWsolAta: false }, ["curve", "amm", "close"]],
    [{ amm: "wsol", curve: false }, { curve: false, curveVersion: 2, amm: "wsol", createWsolAta: true }, ["create", "amm", "close"]],
    [{ amm: "wsol", curve: false, createWsolAta: false }, { curve: false, curveVersion: 2, amm: "wsol", createWsolAta: false }, ["amm", "close"]],
  ];
  const name = (ix) => (ix.programId === COMPUTE_BUDGET_PROGRAM ? "budget" : ix.programId === PUMPFUN_PROGRAM ? "curve" : ix.programId === ATA_PROGRAM ? "create"
    : ix.programId === TOKEN_PROGRAM ? "close" : hexOf(ix.data) === CLAIM_DISC.transferCreatorFeesToPump ? "toPump" : "amm");
  for (const [options, shape, order] of routes) {
    const wallet = fresh();
    const built = buildClaimTransaction({ wallet: wallet.publicKey, recentBlockhash: blockhash(), ...options });
    assert.ok(Object.isFrozen(built));
    const limit = CLAIM_COMPUTE_UNITS[options.amm ?? "curve"];
    assert.deepEqual({ ...built.shape }, { ...shape, computeUnitLimit: limit, computeUnitPriceMicroLamports: BigInt(CLAIM_DEFAULTS.computeUnitPriceMicroLamports),
      priorityFee: BigInt(Math.ceil(limit * CLAIM_DEFAULTS.computeUnitPriceMicroLamports / 1e6)) });
    assert.deepEqual(built.signers, [wallet.publicKey]);
    const decoded = decompileInstructions(decodeLegacyMessage(built.messageBytes));
    assert.deepEqual(decoded.map(name), ["budget", "budget", ...order], JSON.stringify(options));
    const b64 = signClaimTransaction(built, wallet);
    const raw = Buffer.from(b64, "base64");
    assert.ok(raw.length <= PACKET_DATA_SIZE, `${raw.length} bytes`);
    const tx = decodeTransaction(new Uint8Array(raw));
    assert.equal(tx.signatures.length, 1);
    assert.ok(verifyEd25519(wallet.publicKey, tx.messageBytes, tx.signatures[0]));
    assert.deepEqual(tx.messageBytes, built.messageBytes);
    const unsigned = decodeTransaction(new Uint8Array(Buffer.from(unsignedClaimTransaction(built), "base64")));
    assert.deepEqual(unsigned.signatures, [new Uint8Array(64)]);
    assert.deepEqual(unsigned.messageBytes, built.messageBytes);
  }
  assert.deepEqual(AMM_ROUTES, ["sweep", "wsol"]);
});

test("buildClaimTransaction refuses a claim of nothing, an unknown route and a compute budget past its caps", () => {
  const wallet = someAddress(), recentBlockhash = blockhash();
  assert.throws(() => buildClaimTransaction({ wallet, recentBlockhash, curve: false }), /claims something/);
  assert.throws(() => buildClaimTransaction({ wallet, recentBlockhash, amm: "sweep", curve: false }), /collects the curve vault too/);
  assert.throws(() => buildClaimTransaction({ wallet, recentBlockhash, amm: "swap" }), /amm is null/);
  assert.throws(() => buildClaimTransaction({ wallet, recentBlockhash, curve: "yes" }), /true or false/);
  assert.throws(() => buildClaimTransaction({ wallet, recentBlockhash, curveVersion: 3 }), /version 1 or 2/);
  assert.throws(() => buildClaimTransaction({ wallet: "nope", recentBlockhash }), /not a base58 address/);
  assert.throws(() => buildClaimTransaction({ wallet, recentBlockhash, computeUnitLimit: MAX_CLAIM_COMPUTE_UNIT_LIMIT + 1 }), /compute-unit limit/);
  assert.throws(() => buildClaimTransaction({ wallet, recentBlockhash, computeUnitLimit: 0 }), /compute-unit limit/);
  assert.throws(() => buildClaimTransaction({ wallet, recentBlockhash, computeUnitPriceMicroLamports: -1 }), /whole number/);
  assert.throws(() => buildClaimTransaction({ wallet, recentBlockhash, computeUnitPriceMicroLamports: 1.5 }), /whole number/);
  // 40,000 units at 2,500,001 micro-lamports = 100,001 lamports: one past the cap; 2,500,000 is exactly the cap
  assert.throws(() => buildClaimTransaction({ wallet, recentBlockhash, computeUnitPriceMicroLamports: 2_500_001 }), /priority fee of 100001 lamports/);
  assert.equal(buildClaimTransaction({ wallet, recentBlockhash, computeUnitPriceMicroLamports: 2_500_000 }).shape.priorityFee, MAX_CLAIM_PRIORITY_FEE_LAMPORTS);
});

test("checkClaimMessage refuses a claim with anything that moves the wallet's SOL or tokens elsewhere", () => {
  const w = someAddress(), stranger = someAddress();
  const ok = [collectCreatorFeeInstruction({ creator: w })];
  assert.equal(checkClaimMessage(rawMessage(w, ok), { wallet: w }).amm, null);
  // an extra SOL transfer out of the wallet, after or before the claim
  assert.throws(() => checkClaimMessage(rawMessage(w, [...ok, systemTransfer(w, stranger, 1)]), { wallet: w }), /11111111111111111111111111111111 .*does not carry/);
  assert.throws(() => checkClaimMessage(rawMessage(w, [systemTransfer(w, stranger, 1), ...ok]), { wallet: w }), /does not carry/);
  // a token transfer out of the wallet's WSOL account
  const tokenTransfer = { programId: TOKEN_PROGRAM, keys: [m(wsolAta(w), true), m(wsolAta(stranger), true), m(w, false, true)], data: Uint8Array.of(3, 1, 0, 0, 0, 0, 0, 0, 0) };
  assert.throws(() => checkClaimMessage(rawMessage(w, [...ok, tokenTransfer]), { wallet: w }), /does not carry/);
  // a pump.fun buy and a PumpSwap sell: the launcher never trades
  assert.throws(() => checkClaimMessage(rawMessage(w, [...ok, { ...ok[0], data: new Uint8Array(sha8("global:buy")) }]), { wallet: w }), /does not carry/);
  assert.throws(() => checkClaimMessage(rawMessage(w, [...ok, { programId: PUMP_AMM_PROGRAM, keys: ok[0].keys, data: new Uint8Array(sha8("global:sell")) }]), { wallet: w }), /does not carry/);
  // CloseAccount of the wallet's WSOL account to someone else, or of another account
  const wsol = claimInstructions({ wallet: w, amm: "wsol" });
  const closeTo = (keys) => [...wsol.slice(0, -1), { ...wsol.at(-1), keys }];
  assert.throws(() => checkClaimMessage(rawMessage(w, closeTo([m(wsolAta(w), true), m(stranger, true), m(w, false, true)])), { wallet: w }), /account 1 of close/);
  assert.throws(() => checkClaimMessage(rawMessage(w, closeTo([m(someAddress(), true), m(w, true), m(w, false, true)])), { wallet: w }), /account 0 of close/);
  // CreateIdempotent of someone else's WSOL account, paid by the wallet
  const createFor = createWsolAtaIdempotentInstruction({ owner: stranger });
  createFor.keys[0] = m(w, true, true);
  assert.throws(() => checkClaimMessage(rawMessage(w, [wsol[0], createFor, ...wsol.slice(2)]), { wallet: w }), /account 1 of createAta/);
  // the claim's data with a byte more
  assert.throws(() => checkClaimMessage(rawMessage(w, [{ ...ok[0], data: Uint8Array.of(...ok[0].data, 0) }]), { wallet: w }), /does not carry/);
});

test("checkClaimMessage refuses a wrong vault, a wrong creator, a wrong program and a wrong flag", () => {
  const w = someAddress();
  const v2 = collectCreatorFeeInstruction({ creator: w });
  const withKey = (ix, i, meta) => ({ ...ix, keys: ix.keys.map((k, j) => (j === i ? meta : k)) });
  // the creator vault of another creator
  assert.throws(() => checkClaimMessage(rawMessage(w, [withKey(v2, 2, m(creatorVault(someAddress()), true))]), { wallet: w }), /account 2 of curve2 is not the one derived/);
  assert.throws(() => checkClaimMessage(rawMessage(w, [withKey(collectCreatorFeeInstruction({ creator: w, version: 1 }), 1, m(someAddress(), true))]), { wallet: w }), /account 1 of curve1/);
  // PumpSwap's vault ATA swapped for another's
  const toPump = transferCreatorFeesToPumpInstruction({ coinCreator: w });
  assert.throws(() => checkClaimMessage(rawMessage(w, [withKey(toPump, 6, m(ammCreatorVaultAta(someAddress()), true)), v2]), { wallet: w }), /account 6 of toPump/);
  // a claim for another creator, paid by the wallet (it would pay the fee for a stranger's fees)
  assert.throws(() => checkClaimMessage(rawMessage(w, [collectCreatorFeeInstruction({ creator: someAddress() })]), { wallet: w }), /account 0 of curve2/);
  // Raydium CPMM's collect_creator_fee: the same discriminator as pump.fun's, another program
  assert.equal(hexOf(sha8("global:collect_creator_fee")), CLAIM_DISC.collectCreatorFee);
  const v1 = collectCreatorFeeInstruction({ creator: w, version: 1 });
  assert.throws(() => checkClaimMessage(rawMessage(w, [{ ...v1, programId: RAYDIUM_CPMM }]), { wallet: w }), new RegExp(`${RAYDIUM_CPMM} .*does not carry`));
  // PumpSwap's instruction sent to pump.fun
  assert.throws(() => checkClaimMessage(rawMessage(w, [{ ...toPump, programId: PUMPFUN_PROGRAM }, v2]), { wallet: w }), /does not carry/);
  // a flag flipped: the event authority writable, the vault read-only
  assert.throws(() => checkClaimMessage(rawMessage(w, [withKey(v2, 8, m(PUMP.eventAuthority, true))]), { wallet: w }), /account 8 of curve2 is writable/);
  assert.throws(() => checkClaimMessage(rawMessage(w, [withKey(v1, 1, m(creatorVault(w), false))]), { wallet: w }), /account 1 of curve1 is read-only/);
});

test("checkClaimMessage refuses the wrong shape, another signer or payer, a stray account, a writable program and a compute budget past its caps", () => {
  const w = someAddress(), stranger = someAddress();
  const v2 = collectCreatorFeeInstruction({ creator: w });
  const v1 = collectCreatorFeeInstruction({ creator: w, version: 1 });
  const toPump = transferCreatorFeesToPumpInstruction({ coinCreator: w });
  const [create, amm, close] = claimInstructions({ wallet: w, amm: "wsol", curve: false });
  const refuse = (ixs, re, opts) => assert.throws(() => checkClaimMessage(rawMessage(w, ixs, opts), { wallet: w }), re);
  refuse([toPump], /not a claim this module builds/);
  refuse([v2, toPump], /not a claim/);
  refuse([v2, v1], /not a claim/);
  refuse([v2, v2], /not a claim/);
  refuse([create, amm], /not a claim/);
  refuse([amm, close, v2], /not a claim/);
  refuse([close, amm], /not a claim/);
  refuse([], /not a claim/);
  // the payer is not the wallet; a second signer
  assert.throws(() => checkClaimMessage(rawMessage(stranger, [v2]), { wallet: w }), /one signer and fee payer is not the wallet/);
  const cosigned = { ...create, keys: [m(stranger, true, true), ...create.keys.slice(1)] };
  refuse([cosigned, amm, close], /one signer and fee payer/);
  // an account in the message that no instruction uses (writable: it would be locked for nothing)
  const compiled = compileLegacyMessage({ payer: w, recentBlockhash: blockhash(), instructions: [setComputeUnitLimit(40_000), v2, { programId: COMPUTE_BUDGET_PROGRAM, keys: [m(stranger, true)], data: Uint8Array.of(2, 1, 0, 0, 0) }] });
  const stray = encodeLegacyMessage({ ...compiled, instructions: compiled.instructions.slice(0, -1) });
  assert.throws(() => checkClaimMessage(stray, { wallet: w }), new RegExp(`${stranger} is in the message but in no instruction`));
  // a program id made writable (the header's read-only count lowered by one: the compute budget program becomes writable)
  const writableProgram = tweak(rawMessage(w, [v1]), (msg) => { msg.header.numReadonlyUnsignedAccounts -= 1; });
  assert.equal(decodeLegacyMessage(writableProgram).accountKeys[2], COMPUTE_BUDGET_PROGRAM);
  assert.throws(() => checkClaimMessage(writableProgram, { wallet: w }), /program ComputeBudget111111111111111111111111111111 is writable/);
  // the compute budget: past the priority-fee cap, past the unit cap, twice, or no limit with a high price
  refuse([v2], /priority fee of 400000 lamports/, { limit: 40_000, price: 10_000_000 });
  refuse([v2], /compute-unit limit of 300001/, { limit: MAX_CLAIM_COMPUTE_UNIT_LIMIT + 1, price: 0 });
  assert.throws(() => checkClaimMessage(compileLegacyMessage({ payer: w, recentBlockhash: blockhash(), instructions: [setComputeUnitLimit(40_000), setComputeUnitLimit(40_000), v2] }).bytes, { wallet: w }), /more than one compute-budget/);
  assert.throws(() => checkClaimMessage(compileLegacyMessage({ payer: w, recentBlockhash: blockhash(), instructions: [setComputeUnitPrice(1), setComputeUnitPrice(1), v2] }).bytes, { wallet: w }), /more than one compute-budget/);
  // no limit: 200,000 units per instruction are assumed (2 × 200,000 × 250,001 / 10^6 = 100,000.4 → 100,001 lamports)
  const noLimit = (price) => compileLegacyMessage({ payer: w, recentBlockhash: blockhash(), instructions: [setComputeUnitPrice(price), v2] }).bytes;
  assert.equal(checkClaimMessage(noLimit(250_000), { wallet: w }).priorityFee, 100_000n);
  assert.throws(() => checkClaimMessage(noLimit(250_001), { wallet: w }), /priority fee of 100001 lamports/);
  assert.throws(() => checkClaimMessage(rawMessage(w, [v2]), { wallet: "nope" }), /not a base58 address/);
});

test("signing re-checks the very bytes it signs: a built claim changed afterwards, or another wallet's key, is refused", () => {
  const wallet = fresh();
  const built = buildClaimTransaction({ wallet: wallet.publicKey, recentBlockhash: blockhash() });
  assert.throws(() => signClaimTransaction(built, fresh()), /not the claim's wallet/);
  assert.throws(() => signClaimTransaction({}, wallet), /takes what buildClaimTransaction returned/);
  // a stranger slipped into the message bytes in place of the creator vault (the frozen object's bytes are still mutable)
  const tampered = { ...built, messageBytes: Uint8Array.from(built.messageBytes) };
  const msg = decodeLegacyMessage(tampered.messageBytes);
  const at = msg.accountKeys.indexOf(creatorVault(wallet.publicKey));
  assert.equal(tampered.messageBytes[3], msg.accountKeys.length); // the 3-byte header, then the key count (one compact-u16 byte)
  tampered.messageBytes.set(randomBytes(32), 3 + 1 + 32 * at);
  assert.throws(() => signClaimTransaction(tampered, wallet), /not the one derived/);
  assert.throws(() => unsignedClaimTransaction(tampered), /not the one derived/);
  const other = buildClaimTransaction({ wallet: someAddress(), recentBlockhash: blockhash() });
  assert.throws(() => signClaimTransaction({ ...other, wallet: wallet.publicKey }, wallet), /not the wallet/);
});

/* ── what waits to be claimed ────────────────────────────────────────────────────────── */

/** A 165-byte classic-token account: `mint`, `owner`, `amount`, initialized. */
function tokenAccountData({ mint = WSOL_MINT, owner, amount, state = 1 }) {
  const d = Buffer.alloc(165);
  Buffer.from(base58Decode(mint)).copy(d, 0); Buffer.from(base58Decode(owner)).copy(d, 32); d.writeBigUInt64LE(BigInt(amount), 64); d[108] = state;
  return d.toString("base64");
}

test("creatorVaultClaimable and ammVaultClaimable read what waits, above rent, and refuse an account that is not what pump.fun makes", () => {
  const vault = { lamports: 119_999_879, owner: SYSTEM_PROGRAM, data: ["", "base64"], executable: false };
  assert.equal(creatorVaultClaimable(vault, RENT_0), LAUNCHER_CLAIMABLE);
  assert.equal(creatorVaultClaimable(vault, 650_240n), LAUNCHER_CLAIMABLE);
  assert.equal(creatorVaultClaimable({ ...vault, lamports: RENT_0 }, RENT_0), 0n);
  assert.equal(creatorVaultClaimable({ ...vault, lamports: 100 }, RENT_0), 0n);
  assert.equal(creatorVaultClaimable(null, RENT_0), 0n);
  assert.throws(() => creatorVaultClaimable({ ...vault, owner: TOKEN_PROGRAM }, RENT_0), /not a system account/);
  assert.throws(() => creatorVaultClaimable({ ...vault, data: ["AA==", "base64"] }, RENT_0), /not a system account/);
  assert.throws(() => creatorVaultClaimable(vault, -1), /rent-exempt minimum/);
  assert.throws(() => creatorVaultClaimable({ ...vault, lamports: 1.5 }, RENT_0), /whole number/);

  const ammAccount = (fields, owner = TOKEN_PROGRAM) => ({ lamports: 2_039_280 + 5_000_000, owner, data: [tokenAccountData(fields), "base64"] });
  assert.equal(ammVaultClaimable(ammAccount({ owner: L.ammVaultAuthority, amount: 5_000_000 }), LAUNCHER), 5_000_000n);
  assert.equal(ammVaultClaimable(null, LAUNCHER), 0n);
  assert.throws(() => ammVaultClaimable(ammAccount({ owner: someAddress(), amount: 1 }), LAUNCHER), /vault authority/);
  assert.throws(() => ammVaultClaimable(ammAccount({ owner: L.ammVaultAuthority, mint: someAddress(), amount: 1 }), LAUNCHER), /WSOL account/);
  assert.throws(() => ammVaultClaimable(ammAccount({ owner: L.ammVaultAuthority, amount: 1, state: 0 }), LAUNCHER), /initialized/);
  assert.throws(() => ammVaultClaimable(ammAccount({ owner: L.ammVaultAuthority, amount: 1 }, SYSTEM_PROGRAM), LAUNCHER), /not a token account/);
});

test("readClaimState asks for the three accounts and the rent, and claimPlan proposes the claim (sweep when the AMM vault holds WSOL)", async () => {
  const calls = [];
  const fakeRpc = (accounts, rent = RENT_0) => ({
    getMultipleAccounts: async (addresses) => { calls.push(["getMultipleAccounts", addresses]); return accounts; },
    call: async (method, params) => { calls.push([method, params]); return rent; },
  });
  const vault = { lamports: 119_999_879, owner: SYSTEM_PROGRAM, data: ["", "base64"] };
  const state = await readClaimState(fakeRpc([vault, null, null]), { wallet: LAUNCHER });
  assert.deepEqual(calls, [["getMultipleAccounts", [L.creatorVault, L.ammVaultAta, L.wsolAta]], ["getMinimumBalanceForRentExemption", [0]]]);
  assert.deepEqual({ ...state }, {
    wallet: LAUNCHER, creatorVault: L.creatorVault, rentExemptMinimum: 650_240n, curveClaimable: LAUNCHER_CLAIMABLE,
    ammVaultAta: L.ammVaultAta, ammVaultExists: false, ammClaimable: 0n, walletWsolAta: L.wsolAta, walletWsolAtaExists: false, walletWsolAmount: null, total: LAUNCHER_CLAIMABLE,
  });
  assert.deepEqual({ ...claimPlan(state) }, { curve: true, amm: null, createWsolAta: false });
  assert.equal(claimPlan(state, { minLamports: LAUNCHER_CLAIMABLE + 1n }), null);
  assert.equal(MIN_CLAIM_LAMPORTS, 1_000_000n);

  const amm = { lamports: 2_039_280 + 7_000_000, owner: TOKEN_PROGRAM, data: [tokenAccountData({ owner: L.ammVaultAuthority, amount: 7_000_000 }), "base64"] };
  const both = await readClaimState(fakeRpc([{ ...vault, lamports: RENT_0 }, amm, null]), { wallet: LAUNCHER });
  assert.equal(both.curveClaimable, 0n);
  assert.equal(both.ammClaimable, 7_000_000n);
  assert.equal(both.total, 7_000_000n);
  assert.deepEqual({ ...claimPlan(both) }, { curve: true, amm: "sweep", createWsolAta: false });
  const built = buildClaimTransaction({ wallet: LAUNCHER, recentBlockhash: blockhash(), ...claimPlan(both) });
  assert.equal(built.shape.amm, "sweep");

  await assert.rejects(readClaimState(fakeRpc([vault, null]), { wallet: LAUNCHER }), /three accounts/);
  await assert.rejects(readClaimState(fakeRpc([vault, null, null], null), { wallet: LAUNCHER }), /did not answer with a number/);
  assert.throws(() => claimPlan({}), /takes what readClaimState returned/);
});

/* ── what a confirmed claim brought in ───────────────────────────────────────────────── */

test("measureClaim reads the real mainnet claim: both events, what the creator received and what left both vaults agree", () => {
  const r = measureClaim(REAL, { wallet: REAL_CREATOR });
  assert.ok(Object.isFrozen(r));
  assert.equal(r.signature, REAL.transaction.signatures[0]);
  assert.equal(r.failed, false);
  assert.equal(r.feePayer, REAL_CREATOR);
  assert.equal(r.fee, 5000n);
  assert.equal(r.walletFee, 5000n);
  assert.deepEqual(r.events.map((e) => [e.program, e.amount, e.creator]), [["pump", REAL_CURVE_FEE, REAL_CREATOR], ["pump-amm", REAL_AMM_FEE, REAL_CREATOR]]);
  assert.equal(r.events[0].quoteMint, SYSTEM_PROGRAM, "a SOL curve's event names the zero key as its quote");
  assert.equal(r.events[1].tokenAccount, wsolAta(REAL_CREATOR));
  const total = REAL_CURVE_FEE + REAL_AMM_FEE;
  assert.equal(total, 4_675_630_798n);
  assert.equal(r.eventTotal, total);
  assert.equal(r.received, 322_891_386_584n - 318_215_760_786n + 5000n);
  assert.equal(r.received, total);
  assert.equal(r.fromVaults, total);
  assert.equal(r.claimed, total);
  assert.equal(r.net, total - 5000n);
  assert.equal(r.wsolAtaLamportsAfter, 0n, "the creator's WSOL account was closed: everything was unwrapped");

  // another wallet (the launcher) claimed nothing here; the events are still read, not counted
  const other = measureClaim(REAL, { wallet: LAUNCHER });
  assert.deepEqual([other.claimed, other.eventTotal, other.walletFee, other.events.length], [0n, 0n, 0n, 0]);
  assert.deepEqual(readClaimEvents(REAL, { wallet: LAUNCHER }).map((e) => e.forWallet), [false, false]);
});

test("measureClaim takes the smallest reading: an extra inflow, a forged or misplaced event, or a failed transaction cannot inflate the pot", () => {
  // an inflow to the creator beside the claim (someone sent it SOL): still the events' total
  const inflow = clone(REAL); inflow.meta.postBalances[0] += 1_000_000_000;
  assert.equal(measureClaim(inflow, { wallet: REAL_CREATOR }).claimed, REAL_CURVE_FEE + REAL_AMM_FEE);
  // an event that claims 10 SOL more than moved: still what moved
  const bigger = clone(REAL);
  const ev = bigger.meta.innerInstructions[0].instructions[1];
  const d = Buffer.from(base58Decode(ev.data, 2000)); d.writeBigUInt64LE(REAL_CURVE_FEE + 10_000_000_000n, 56); ev.data = base58Encode(d);
  const b = measureClaim(bigger, { wallet: REAL_CREATOR });
  assert.equal(b.eventTotal, REAL_CURVE_FEE + REAL_AMM_FEE + 10_000_000_000n);
  assert.equal(b.claimed, REAL_CURVE_FEE + REAL_AMM_FEE);
  // the AMM event not emitted through PumpSwap's event authority (anyone can CPI data at a program): not counted
  const misplaced = clone(REAL); misplaced.meta.innerInstructions[2].instructions[1].accounts = [12];
  assert.equal(measureClaim(misplaced, { wallet: REAL_CREATOR }).claimed, REAL_CURVE_FEE);
  // the pump.fun event under PumpSwap's program id: not counted either
  const wrongProgram = clone(REAL); Object.assign(wrongProgram.meta.innerInstructions[0].instructions[1], { programIdIndex: 11, accounts: [13] });
  assert.equal(measureClaim(wrongProgram, { wallet: REAL_CREATOR }).claimed, REAL_AMM_FEE);
  // the vault gave less than the events say (a deposit into it in the same transaction): what left the vaults
  const lessOut = clone(REAL); lessOut.meta.postBalances[2] += 1_000_000;
  assert.equal(measureClaim(lessOut, { wallet: REAL_CREATOR }).claimed, REAL_CURVE_FEE + REAL_AMM_FEE - 1_000_000n);
  // no inner instructions recorded: no event, nothing counted
  const noInner = clone(REAL); noInner.meta.innerInstructions = null;
  assert.equal(measureClaim(noInner, { wallet: REAL_CREATOR }).claimed, 0n);
  // failed on chain: nothing claimed, the fee still paid
  const failed = clone(REAL); failed.meta.err = { InstructionError: [2, { Custom: 3012 }] };
  const f = measureClaim(failed, { wallet: REAL_CREATOR });
  assert.deepEqual([f.failed, f.claimed, f.walletFee, f.net, f.events.length], [true, 0n, 5000n, -5000n, 0]);
  assert.deepEqual(readClaimEvents(failed, { wallet: REAL_CREATOR }), []);
  // unreadable answers
  assert.throws(() => measureClaim({ ...clone(REAL), version: 1 }, { wallet: REAL_CREATOR }), /version 1/);
  const short = clone(REAL); short.meta.preBalances.pop();
  assert.throws(() => measureClaim(short, { wallet: REAL_CREATOR }), /balances do not match/);
  assert.throws(() => measureClaim({ transaction: REAL.transaction }, { wallet: REAL_CREATOR }), /no status/);
  assert.throws(() => measureClaim(REAL, { wallet: "nope" }), /not a base58 address/);
});

test("measureClaim on the launcher's own claim (built here, with the event pump.fun logged in simulation): claimed, its fee and the net", () => {
  const built = buildClaimTransaction({ wallet: LAUNCHER, recentBlockhash: blockhash(), curveVersion: 1 });
  const keys = built.message.accountKeys;
  const at = (k) => keys.indexOf(k);
  const pre = Array(keys.length).fill(1), post = Array(keys.length).fill(1);
  const fee = 5000 + Number(built.shape.priorityFee); // 7,000: the base fee and 40,000 units at 50,000 micro-lamports
  pre[at(LAUNCHER)] = 294_498_840; post[at(LAUNCHER)] = 294_498_840 + Number(LAUNCHER_CLAIMABLE) - fee;
  pre[at(L.creatorVault)] = 119_999_879; post[at(L.creatorVault)] = RENT_0;
  const transferData = Buffer.alloc(12); transferData.writeUInt32LE(2); transferData.writeBigUInt64LE(LAUNCHER_CLAIMABLE, 4);
  const tx = jsonTx(built.messageBytes, {
    fee, preBalances: pre, postBalances: post,
    innerInstructions: [{ index: 2, instructions: [
      { programIdIndex: at(SYSTEM_PROGRAM), accounts: [at(L.creatorVault), at(LAUNCHER)], data: base58Encode(transferData), stackHeight: 2 },
      { programIdIndex: at(PUMPFUN_PROGRAM), accounts: [at(PUMP.eventAuthority)], data: base58Encode(Buffer.concat([Buffer.from(EVENT_IX_TAG, "hex"), LAUNCHER_EVENT])), stackHeight: 2 },
    ] }],
  });
  const r = measureClaim(tx, { wallet: LAUNCHER });
  assert.deepEqual([r.eventTotal, r.received, r.fromVaults, r.claimed], [LAUNCHER_CLAIMABLE, LAUNCHER_CLAIMABLE, LAUNCHER_CLAIMABLE, LAUNCHER_CLAIMABLE]);
  assert.equal(r.walletFee, 7000n);
  assert.equal(r.net, LAUNCHER_CLAIMABLE - 7000n);
  assert.equal(r.wsolAtaLamportsAfter, null, "a curve-only v1 claim does not name the WSOL account");
  assert.equal(r.events[0].timestamp > 1_700_000_000n, true);

  // the same event for a coin priced in another quote (tokens, not SOL): not counted
  const usdc = clone(tx);
  usdc.meta.innerInstructions[0].instructions[1].data = base58Encode(pumpEventData({ creator: LAUNCHER, amount: LAUNCHER_CLAIMABLE, quoteMint: someAddress() }));
  assert.equal(measureClaim(usdc, { wallet: LAUNCHER }).claimed, 0n);
  // WSOL as the quote is SOL
  const wsolQuote = clone(tx);
  wsolQuote.meta.innerInstructions[0].instructions[1].data = base58Encode(pumpEventData({ creator: LAUNCHER, amount: LAUNCHER_CLAIMABLE, quoteMint: WSOL_MINT }));
  assert.equal(measureClaim(wsolQuote, { wallet: LAUNCHER }).claimed, LAUNCHER_CLAIMABLE);
});

test("measureClaim on claims a stranger sent (they are permissionless): no fee is the wallet's, and WSOL left wrapped is reported", () => {
  const payer = someAddress();
  // a stranger collects the launcher's curve vault and pays the fee
  const msg = compileLegacyMessage({ payer, recentBlockhash: blockhash(), instructions: [collectCreatorFeeInstruction({ creator: LAUNCHER })] });
  const keys = msg.accountKeys, at = (k) => keys.indexOf(k);
  const pre = Array(keys.length).fill(0), post = Array(keys.length).fill(0);
  pre[at(LAUNCHER)] = 100; post[at(LAUNCHER)] = 100 + 3_000_000;
  pre[at(L.creatorVault)] = RENT_0 + 3_000_000; post[at(L.creatorVault)] = RENT_0;
  const tx = jsonTx(msg.bytes, { preBalances: pre, postBalances: post, innerInstructions: [{ index: 0, instructions: [
    { programIdIndex: at(PUMPFUN_PROGRAM), accounts: [at(PUMP.eventAuthority)], data: base58Encode(pumpEventData({ creator: LAUNCHER, amount: 3_000_000 })) },
  ] }] });
  const r = measureClaim(tx, { wallet: LAUNCHER });
  assert.deepEqual([r.feePayer, r.walletFee, r.claimed, r.net], [payer, 0n, 3_000_000n, 3_000_000n]);
  assert.equal(r.wsolAtaLamportsAfter, 0n, "collect_creator_fee_v2 names the WSOL account, which does not exist");

  // a stranger creates the launcher's WSOL account (paying its rent) and collects the AMM vault into it, without closing it
  const ammMsg = compileLegacyMessage({ payer, recentBlockhash: blockhash(), instructions: [
    { ...createWsolAtaIdempotentInstruction({ owner: LAUNCHER }), keys: [m(payer, true, true), ...createWsolAtaIdempotentInstruction({ owner: LAUNCHER }).keys.slice(1)] },
    collectCoinCreatorFeeInstruction({ coinCreator: LAUNCHER }),
  ] });
  const k2 = ammMsg.accountKeys, at2 = (k) => k2.indexOf(k);
  const pre2 = Array(k2.length).fill(0), post2 = Array(k2.length).fill(0);
  pre2[at2(payer)] = 10_000_000; post2[at2(payer)] = 10_000_000 - 2_039_280 - 5000;
  pre2[at2(L.wsolAta)] = 0; post2[at2(L.wsolAta)] = 2_039_280 + 4_000_000;
  pre2[at2(L.ammVaultAta)] = 2_039_280 + 4_000_000; post2[at2(L.ammVaultAta)] = 2_039_280;
  const event = ammEventData({ creator: LAUNCHER, amount: 4_000_000, vaultAta: L.ammVaultAta, tokenAccount: L.wsolAta });
  const amm = jsonTx(ammMsg.bytes, { preBalances: pre2, postBalances: post2, innerInstructions: [{ index: 1, instructions: [
    { programIdIndex: at2(PUMP_AMM_PROGRAM), accounts: [at2(PUMP_AMM.eventAuthority)], data: base58Encode(event) },
  ] }] });
  const a = measureClaim(amm, { wallet: LAUNCHER });
  assert.deepEqual([a.walletFee, a.eventTotal, a.received, a.fromVaults, a.claimed], [0n, 4_000_000n, 2_039_280n + 4_000_000n, 4_000_000n, 4_000_000n], "the stranger's rent is not counted");
  assert.equal(a.wsolAtaLamportsAfter, 2_039_280n + 4_000_000n, "the claim sits in the WSOL account until the launcher closes it");
  assert.equal(a.wsolAfter, null, "no token balances in the answer: the WSOL left there is not guessed from lamports");
  const withTokens = clone(amm);
  withTokens.meta.postTokenBalances = [{ accountIndex: at2(L.wsolAta), mint: WSOL_MINT, owner: LAUNCHER, uiTokenAmount: { amount: "4000000", decimals: 9 } }];
  assert.equal(measureClaim(withTokens, { wallet: LAUNCHER }).wsolAfter, 4_000_000n, "the WSOL left in the wallet's account: its token amount, not its lamports (rent included)");
  // later the launcher's own "wsol" claim unwraps that account: only the new AMM fees count, never the WSOL counted above again
  const own = buildClaimTransaction({ wallet: LAUNCHER, recentBlockhash: blockhash(), amm: "wsol", curve: false, createWsolAta: false });
  const k3 = own.message.accountKeys, at3 = (k) => k3.indexOf(k);
  const fee3 = 5000 + Number(own.shape.priorityFee);
  const pre3 = Array(k3.length).fill(0), post3 = Array(k3.length).fill(0);
  pre3[at3(LAUNCHER)] = 50_000_000; post3[at3(LAUNCHER)] = 50_000_000 + (2_039_280 + 4_000_000) + 1_000_000 - fee3;
  pre3[at3(L.wsolAta)] = 2_039_280 + 4_000_000; post3[at3(L.wsolAta)] = 0;
  pre3[at3(L.ammVaultAta)] = 2_039_280 + 1_000_000; post3[at3(L.ammVaultAta)] = 2_039_280;
  const later = jsonTx(own.messageBytes, { fee: fee3, preBalances: pre3, postBalances: post3, innerInstructions: [{ index: 2, instructions: [
    { programIdIndex: at3(PUMP_AMM_PROGRAM), accounts: [at3(PUMP_AMM.eventAuthority)], data: base58Encode(ammEventData({ creator: LAUNCHER, amount: 1_000_000, vaultAta: L.ammVaultAta, tokenAccount: L.wsolAta })) },
  ] }] });
  const o = measureClaim(later, { wallet: LAUNCHER });
  assert.deepEqual([o.eventTotal, o.received, o.fromVaults, o.claimed, o.walletFee, o.wsolAtaLamportsAfter], [1_000_000n, 1_000_000n, 1_000_000n, 1_000_000n, BigInt(fee3), 0n]);
  // the same event paid into a WSOL account that is not the launcher's own associated one: not counted
  const elsewhere = clone(amm);
  elsewhere.meta.innerInstructions[0].instructions[0].data = base58Encode(ammEventData({ creator: LAUNCHER, amount: 4_000_000, vaultAta: L.ammVaultAta, tokenAccount: someAddress() }));
  assert.equal(measureClaim(elsewhere, { wallet: LAUNCHER }).claimed, 0n);
});

test("walletWsolAmount: the WSOL waiting in the wallet's own WSOL account is its token amount, never its lamports less today's rent", () => {
  const acct = (fields, { owner = TOKEN_PROGRAM, lamports = 2_039_280 } = {}) => ({ lamports, owner, data: [tokenAccountData(fields), "base64"] });
  assert.equal(walletWsolAmount(acct({ owner: LAUNCHER, amount: 3_000_000_000 }, { lamports: 3_002_039_280 }), LAUNCHER), 3_000_000_000n);
  assert.equal(walletWsolAmount(acct({ owner: LAUNCHER, amount: 0 }, { lamports: 2_039_280 }), LAUNCHER), 0n, "an empty account made when rent was higher (2,039,280 against 1,488,440 now) holds no WSOL");
  assert.equal(walletWsolAmount({ lamports: 2_000_000, owner: SYSTEM_PROGRAM, data: ["", "base64"] }, LAUNCHER), null, "plain SOL someone sent to the account's address is no WSOL");
  assert.equal(walletWsolAmount(acct({ owner: someAddress(), amount: 5 }), LAUNCHER), null, "another owner's");
  assert.equal(walletWsolAmount(acct({ owner: LAUNCHER, mint: someAddress(), amount: 5 }), LAUNCHER), null, "another mint");
  assert.equal(walletWsolAmount(acct({ owner: LAUNCHER, amount: 5, state: 2 }), LAUNCHER), null, "frozen");
  assert.equal(walletWsolAmount(null, LAUNCHER), null);
});

/* ── LaunchLab ───────────────────────────────────────────────────────────────────────── */

test("LaunchLab (StonkFun) gives the launcher no creator fee to claim on chain: the documented placeholder returns null", () => {
  assert.equal(launchLabCreatorFeeClaim(), null);
  assert.equal(launchLabCreatorFeeClaim({ wallet: LAUNCHER }), null);
});
