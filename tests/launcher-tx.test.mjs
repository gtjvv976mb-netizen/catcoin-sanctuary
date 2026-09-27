/* The launcher, stage 1: building and signing a pump.fun launch offline (scripts/lib/solana-tx.mjs,
   scripts/lib/pump.mjs). Proved against the recorded real pump.fun launch
   (tests/fixtures/pumpfun-create.json), four recorded real legacy StonkFun launches and the repo's
   own verifier (scripts/lib/chain.mjs). No network, and no real private key: every wallet here is
   made from crypto.randomBytes, a constant filler seed, or RFC 8032's published test vector. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, createPrivateKey, createPublicKey, randomBytes, verify as ed25519Verify } from "node:crypto";
import { inspect } from "node:util";
import {
  keypairFromSecret, deriveMintKeypair, verifyEd25519, encodeCompactU16, decodeCompactU16, compileLegacyMessage, encodeLegacyMessage,
  decodeLegacyMessage, decompileInstructions, signTransaction, serializeTransaction, decodeTransaction, transactionToJson, ata, pda,
  setComputeUnitLimit, setComputeUnitPrice, MINT_DERIVATION_PREFIX, PACKET_DATA_SIZE,
} from "../scripts/lib/solana-tx.mjs";
import {
  PUMP, CREATE_V2_DISC, createV2Instruction, createV2Accounts, decodeCreateV2, buildLaunchTransaction, signLaunchTransaction, checkLaunchMessage,
  bondingCurve, associatedBondingCurve, mayhemState, mayhemTokenVault, anchorDiscriminator, launchTextProblem,
} from "../scripts/lib/pump.mjs";
import { signaturesVerify, messageBytes, COMPUTE_BUDGET_PROGRAM, SYSTEM_PROGRAM, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, ATA_PROGRAM } from "../scripts/lib/chain.mjs";
import { base58Decode, base58Encode } from "../assets/collection.js";
import { PUMPFUN, LAUNCHES } from "./helpers.mjs";

/* ── the recorded pump.fun launch (a v0 transaction: static keys, then loaded writable, then loaded readonly) ── */

const PTX = PUMPFUN.answer.result;
const PMSG = PTX.transaction.message;
const PKEYS = [...PMSG.accountKeys, ...PTX.meta.loadedAddresses.writable, ...PTX.meta.loadedAddresses.readonly];
/** The message's own signer / writable flags of account i (loaded accounts are never signers). */
function fixtureMeta(i) {
  const h = PMSG.header, nStatic = PMSG.accountKeys.length, nLoadedWritable = PTX.meta.loadedAddresses.writable.length;
  const isSigner = i < h.numRequiredSignatures;
  const isWritable = i < nStatic
    ? (isSigner ? i < h.numRequiredSignatures - h.numReadonlySignedAccounts : i < nStatic - h.numReadonlyUnsignedAccounts)
    : i < nStatic + nLoadedWritable;
  return { pubkey: PKEYS[i], isSigner, isWritable };
}
const hexOf = (b) => Buffer.from(b).toString("hex");
const PCREATE = PMSG.instructions.find((ix) => PKEYS[ix.programIdIndex] === PUMP.program && hexOf(base58Decode(ix.data, 2000)).startsWith(CREATE_V2_DISC));
const PCREATE_DATA = Buffer.from(base58Decode(PCREATE.data, 2000));
const PCREATE_ACCOUNTS = PCREATE.accounts.map((i) => PKEYS[i]);

/* ── throwaway keys ─────────────────────────────────────────────────────────────────────── */

const fresh = () => keypairFromSecret(randomBytes(32));
const someAddress = () => base58Encode(randomBytes(32));
const blockhash = () => base58Encode(randomBytes(32));
const URI = "https://ipfs.io/ipfs/QmbUFoY7PHPMCmkqKjerAnfseEKLszkdmqcd4SX4dGqJJd";
const COIN = { name: "Gull Gadot", symbol: "GULLGADOT", uri: URI };
const PKCS8 = Buffer.from("302e020100300506032b657004220420", "hex");
/** The public key of a seed, straight from node:crypto (JWK export, independent of the module's DER slicing). */
const nodePublicKey = (seed) => base58Encode(Buffer.from(createPublicKey(createPrivateKey({ key: Buffer.concat([PKCS8, seed]), format: "der", type: "pkcs8" })).export({ format: "jwk" }).x, "base64url"));

function launch({ wallet = fresh(), postId = "1971234567890123456", ...rest } = {}) {
  const mint = deriveMintKeypair(wallet.seed, postId);
  const built = buildLaunchTransaction({ wallet: wallet.publicKey, mint: mint.publicKey, ...COIN, recentBlockhash: blockhash(), ...rest });
  return { wallet, mint, built };
}

/* ── pump.fun's accounts, proved by the recorded launch ──────────────────────────────────── */

test("pump.fun's pinned accounts re-derive from the IDL's seeds, and create_v2's discriminator is sha256 of its Anchor name", () => {
  assert.equal(anchorDiscriminator("create_v2"), CREATE_V2_DISC);
  assert.equal(createHash("sha256").update("global:create_v2").digest().subarray(0, 8).toString("hex"), "d6904cec5f8b31b4");
  assert.equal(pda(["utf8:global"], PUMP.program), PUMP.global);
  assert.equal(PUMP.global, "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
  assert.equal(pda(["utf8:mint-authority"], PUMP.program), PUMP.mintAuthority);
  assert.equal(pda(["utf8:__event_authority"], PUMP.program), PUMP.eventAuthority);
  assert.equal(pda(["utf8:global-params"], PUMP.mayhemProgram), PUMP.mayhemGlobalParams);
  assert.equal(pda(["utf8:sol-vault"], PUMP.mayhemProgram), PUMP.mayhemSolVault);
  assert.deepEqual([PUMP.system, PUMP.token2022, PUMP.ataProgram, PUMP.computeBudget], [SYSTEM_PROGRAM, TOKEN_2022_PROGRAM, ATA_PROGRAM, COMPUTE_BUDGET_PROGRAM]);
});

test("the recorded launch's create_v2 is rebuilt byte for byte: its data and all sixteen account metas (pubkeys, signer and writable flags)", () => {
  assert.equal(PTX.transaction.signatures[0].slice(0, 6), "33Z62j");
  assert.equal(PCREATE_DATA.length, 149);
  assert.equal(hexOf(PCREATE_DATA.subarray(-11)), "00".repeat(11));
  const args = decodeCreateV2(PCREATE_DATA);
  assert.deepEqual(args, {
    name: "Gull Gadot", symbol: "GULLGADOT", uri: URI, creator: "BevqMZhvHq1T3io2eRL6ZmvzyHmH6wk6qh1e3oTgrdrM",
    isMayhemMode: false, isCashbackEnabled: false, creatorFeeBps: 0n, isHolderReward: false, trailingArgs: 3,
  });
  const [mint, user] = [PCREATE_ACCOUNTS[0], PCREATE_ACCOUNTS[5]];
  assert.equal(user, PMSG.accountKeys[0], "the user is the fee payer");
  assert.equal(args.creator, user, "the creator is the user");

  const ix = createV2Instruction({ mint, user, creator: args.creator, name: args.name, symbol: args.symbol, uri: args.uri });
  assert.equal(ix.programId, PUMP.program);
  assert.equal(hexOf(ix.data), hexOf(PCREATE_DATA));
  assert.deepEqual(ix.keys, PCREATE.accounts.map(fixtureMeta));

  // each derivation on its own, so a failure names the account
  assert.equal(PCREATE_ACCOUNTS[2], bondingCurve(mint));
  assert.equal(PCREATE_ACCOUNTS[3], associatedBondingCurve(mint));
  assert.equal(PCREATE_ACCOUNTS[3], ata(bondingCurve(mint), mint, TOKEN_2022_PROGRAM));
  assert.equal(PCREATE_ACCOUNTS[12], mayhemState(mint));
  assert.equal(PCREATE_ACCOUNTS[13], mayhemTokenVault(mint));
  assert.equal(PCREATE_ACCOUNTS[13], ata(PUMP.mayhemSolVault, mint, TOKEN_2022_PROGRAM));
  assert.deepEqual([1, 4, 9, 10, 11, 14, 15].map((i) => PCREATE_ACCOUNTS[i]),
    [PUMP.mintAuthority, PUMP.global, PUMP.mayhemProgram, PUMP.mayhemGlobalParams, PUMP.mayhemSolVault, PUMP.eventAuthority, PUMP.program]);
  assert.deepEqual(createV2Accounts(mint, user), ix.keys);
});

test("the recorded launch's ComputeBudget instructions are the byte layouts this module writes", () => {
  const cb = PMSG.instructions.filter((ix) => PKEYS[ix.programIdIndex] === COMPUTE_BUDGET_PROGRAM).map((ix) => hexOf(base58Decode(ix.data)));
  assert.deepEqual(cb, ["0220a10700", "031027000000000000"]); // a 500,000-unit limit, 10,000 micro-lamports
  assert.equal(hexOf(setComputeUnitLimit(500_000).data), cb[0]);
  assert.equal(hexOf(setComputeUnitPrice(10_000).data), cb[1]);
  assert.equal(hexOf(setComputeUnitPrice(10_000n).data), cb[1]);
  for (const ix of [setComputeUnitLimit(1), setComputeUnitPrice(0)]) {
    assert.equal(ix.programId, COMPUTE_BUDGET_PROGRAM);
    assert.deepEqual(ix.keys, []);
  }
  for (const bad of [0, 1_400_001, 1.5, "200000"]) assert.throws(() => setComputeUnitLimit(bad), RangeError);
  for (const bad of [-1, 1.5, 2n ** 64n, "1"]) assert.throws(() => setComputeUnitPrice(bad), RangeError);
});

/* ── the wire format ─────────────────────────────────────────────────────────────────────── */

test("compact-u16 is Solana's short_vec; aliases, a continuing third byte, overflow and truncation are refused", () => {
  const vectors = [[0, [0x00]], [1, [0x01]], [0x7f, [0x7f]], [0x80, [0x80, 0x01]], [0xff, [0xff, 0x01]], [0x100, [0x80, 0x02]],
    [0x3fff, [0xff, 0x7f]], [0x4000, [0x80, 0x80, 0x01]], [0x7fff, [0xff, 0xff, 0x01]], [0xffff, [0xff, 0xff, 0x03]]];
  for (const [n, bytes] of vectors) {
    assert.deepEqual(encodeCompactU16(n), bytes, `encode ${n}`);
    assert.deepEqual(decodeCompactU16(Uint8Array.from([9, ...bytes, 9]), 1), { value: n, size: bytes.length }, `decode ${n}`);
  }
  for (const bad of [-1, 0x10000, 1.5, "1"]) assert.throws(() => encodeCompactU16(bad), RangeError);
  for (const bad of [[0x80, 0x00], [0xff, 0x80, 0x00], [0x80], [], [0xff, 0xff, 0x04], [0x80, 0x80, 0x80], [0xff, 0xff, 0x83]]) {
    assert.throws(() => decodeCompactU16(Uint8Array.from(bad)), RangeError, JSON.stringify(bad));
  }
});

test("a legacy message compiles with the payer first, then writable signers, readonly signers, writable and readonly non-signers, each key once with its flags merged; it decodes back", () => {
  const [payer, cosigner, roSigner, w1, w2, r1, progA, progB] = Array.from({ length: 8 }, someAddress);
  const recentBlockhash = blockhash();
  const instructions = [
    { programId: progA, keys: [{ pubkey: r1, isSigner: false, isWritable: false }, { pubkey: roSigner, isSigner: true, isWritable: false }, { pubkey: w1, isSigner: false, isWritable: true }], data: Uint8Array.from([1, 2, 3]) },
    // w2 first read-only, then writable: merged to writable; cosigner first read-only non-signer, then a writable signer
    { programId: progB, keys: [{ pubkey: w2, isSigner: false, isWritable: false }, { pubkey: cosigner, isSigner: false, isWritable: false }, { pubkey: w2, isSigner: false, isWritable: true }, { pubkey: cosigner, isSigner: true, isWritable: true }, { pubkey: payer, isSigner: false, isWritable: false }], data: new Uint8Array(0) },
  ];
  const m = compileLegacyMessage({ payer, recentBlockhash, instructions });
  assert.deepEqual(m.accountKeys, [payer, cosigner, roSigner, w1, w2, progA, r1, progB]);
  assert.deepEqual(m.header, { numRequiredSignatures: 3, numReadonlySignedAccounts: 1, numReadonlyUnsignedAccounts: 3 });
  assert.deepEqual(m.instructions.map((ix) => [ix.programIdIndex, ix.accounts]), [[5, [6, 2, 3]], [7, [4, 1, 4, 1, 0]]]);

  const decoded = decodeLegacyMessage(m.bytes);
  assert.deepEqual(decoded, { header: m.header, accountKeys: m.accountKeys, recentBlockhash, instructions: m.instructions });
  assert.deepEqual(encodeLegacyMessage(decoded), m.bytes);
  const again = decompileInstructions(decoded);
  assert.deepEqual(again[0].keys.map((k) => [k.isSigner, k.isWritable]), [[false, false], [true, false], [false, true]]);
  assert.deepEqual(again[1].keys.map((k) => [k.isSigner, k.isWritable]), [[false, true], [true, true], [false, true], [true, true], [true, true]]);
  assert.deepEqual(compileLegacyMessage({ payer, recentBlockhash, instructions: again }).bytes, m.bytes);

  // chain.mjs's own encoder rebuilds the same bytes from the json shape
  const json = { version: "legacy", transaction: { signatures: [], message: { header: m.header, accountKeys: m.accountKeys, recentBlockhash, instructions: m.instructions.map((ix) => ({ ...ix, data: base58Encode(ix.data) })) } } };
  assert.equal(hexOf(messageBytes(json)), hexOf(m.bytes));

  // what Solana's sanitizer refuses is refused here
  assert.throws(() => decodeLegacyMessage(Uint8Array.from([0x80, ...m.bytes])), /versioned/);
  assert.throws(() => decodeLegacyMessage(Uint8Array.from([...m.bytes, 0])), /after the message/);
  assert.throws(() => decodeLegacyMessage(m.bytes.subarray(0, m.bytes.length - 1)), RangeError);
  const readonlyPayer = Uint8Array.from(m.bytes); readonlyPayer[1] = 3;
  assert.throws(() => decodeLegacyMessage(readonlyPayer), /header/);
  assert.throws(() => compileLegacyMessage({ payer, recentBlockhash, instructions: [] }), TypeError);
  assert.throws(() => compileLegacyMessage({ payer: "nope", recentBlockhash, instructions }), /payer/);
  assert.throws(() => compileLegacyMessage({ payer, recentBlockhash: "nope", instructions }), /blockhash/);
  assert.throws(() => compileLegacyMessage({ payer, recentBlockhash, instructions: [{ ...instructions[0], data: [1, 2] }] }), TypeError);
});

test("four real legacy StonkFun launch messages are recompiled byte for byte (keys sorted within their groups, as their builder did), and their real signatures verify over the result", () => {
  const legacy = LAUNCHES.answers.filter((a) => a.result.version === "legacy");
  assert.equal(legacy.length, 4);
  for (const a of legacy) {
    const real = new Uint8Array(messageBytes(a.result));
    const decoded = decodeLegacyMessage(real);
    const re = compileLegacyMessage({ payer: decoded.accountKeys[0], recentBlockhash: decoded.recentBlockhash, instructions: decompileInstructions(decoded), keyOrder: "sorted" });
    assert.equal(hexOf(re.bytes), hexOf(real), a.params[0].slice(0, 8));
    a.result.transaction.signatures.forEach((sig, i) => assert.equal(verifyEd25519(re.accountKeys[i], re.bytes, base58Decode(sig)), true, `${a.params[0].slice(0, 8)} signature ${i}`));
  }
});

/* ── a launch, end to end ──────────────────────────────────────────────────────────────────── */

test("a launch builds, signs and decodes back, and every signature verifies with the repo's own signaturesVerify", () => {
  const { wallet, mint, built } = launch({ computeUnitLimit: 180_000, computeUnitPriceMicroLamports: 50_000 });
  assert.ok(Object.isFrozen(built));
  assert.deepEqual(built.signers, [wallet.publicKey, mint.publicKey]);
  assert.deepEqual([built.wallet, built.mint], [wallet.publicKey, mint.publicKey]);

  const b64 = signLaunchTransaction(built, wallet, mint);
  const bytes = new Uint8Array(Buffer.from(b64, "base64"));
  assert.ok(bytes.length <= PACKET_DATA_SIZE, `${bytes.length} bytes`);
  const { signatures, messageBytes: msg, message } = decodeTransaction(bytes);
  assert.equal(hexOf(msg), hexOf(built.messageBytes));
  assert.equal(signatures.length, 2);
  assert.equal(verifyEd25519(wallet.publicKey, msg, signatures[0]), true);
  assert.equal(verifyEd25519(mint.publicKey, msg, signatures[1]), true);

  // the repo's independent reader: its message rebuild is the same bytes, and every signature verifies
  const json = transactionToJson(bytes);
  assert.equal(hexOf(messageBytes(json)), hexOf(built.messageBytes));
  assert.equal(signaturesVerify(json), true);
  const tampered = new Uint8Array(bytes); tampered[bytes.length - 1] ^= 1; // create_v2's last byte: is_holder_reward
  assert.equal(signaturesVerify(transactionToJson(tampered)), false);
  const swapped = structuredClone(json); swapped.transaction.signatures.reverse();
  assert.equal(signaturesVerify(swapped), false);

  // what it says, read back from the bytes
  const ixs = decompileInstructions(message);
  assert.deepEqual(ixs.map((ix) => ix.programId), [COMPUTE_BUDGET_PROGRAM, COMPUTE_BUDGET_PROGRAM, PUMP.program]);
  assert.equal(hexOf(ixs[0].data), hexOf(setComputeUnitLimit(180_000).data));
  assert.equal(hexOf(ixs[1].data), hexOf(setComputeUnitPrice(50_000).data));
  assert.deepEqual(ixs[2].keys, createV2Accounts(mint.publicKey, wallet.publicKey));
  assert.deepEqual(decodeCreateV2(ixs[2].data), { ...COIN, creator: wallet.publicKey, isMayhemMode: false, isCashbackEnabled: false, creatorFeeBps: 0n, isHolderReward: false, trailingArgs: 3 });
  assert.deepEqual(checkLaunchMessage(msg, { wallet: wallet.publicKey, mint: mint.publicKey }).name, COIN.name);
  assert.equal(message.accountKeys[0], wallet.publicKey, "the wallet pays");
});

test("the longest name, symbol and uri create_v2 takes still fit one packet; keypairs are accepted in place of addresses", () => {
  const wallet = fresh(), mint = deriveMintKeypair(wallet, "1");
  const uri = `https://a.example/${"p".repeat(200 - "https://a.example/".length)}`;
  assert.equal(uri.length, 200);
  const built = buildLaunchTransaction({ wallet, mint, name: "N".repeat(32), symbol: "S".repeat(13), uri, recentBlockhash: blockhash() });
  const bytes = Buffer.from(signLaunchTransaction(built, wallet, mint), "base64");
  assert.ok(bytes.length <= PACKET_DATA_SIZE, `${bytes.length} bytes`);
  assert.equal(signaturesVerify(transactionToJson(new Uint8Array(bytes))), true);
});

test("a launch holds only ComputeBudget and create_v2; bytes with anything else are refused and never signed", () => {
  const { wallet, mint, built } = launch();
  assert.deepEqual(built.instructions.map((ix) => ix.programId), [COMPUTE_BUDGET_PROGRAM, COMPUTE_BUDGET_PROGRAM, PUMP.program]);
  assert.equal(new Set(decompileInstructions(decodeLegacyMessage(built.messageBytes)).map((ix) => ix.programId)).size, 2);

  const attacker = fresh();
  const create = createV2Instruction({ mint: mint.publicKey, user: wallet.publicKey, creator: wallet.publicKey, ...COIN });
  const cb = [setComputeUnitLimit(200_000), setComputeUnitPrice(1_000)];
  const transfer = { programId: SYSTEM_PROGRAM, keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: true }, { pubkey: attacker.publicKey, isSigner: false, isWritable: true }], data: Uint8Array.from([2, 0, 0, 0, 0, 202, 154, 59, 0, 0, 0, 0]) };
  const buy = { programId: PUMP.program, keys: create.keys, data: Buffer.from(`${anchorDiscriminator("buy_v2")}${"00".repeat(16)}`, "hex") };
  const otherCreator = createV2Instruction({ mint: mint.publicKey, user: wallet.publicKey, creator: attacker.publicKey, ...COIN });
  const mayhem = createV2Instruction({ mint: mint.publicKey, user: wallet.publicKey, creator: wallet.publicKey, ...COIN, mayhemMode: true });
  const swappedVault = { ...create, keys: create.keys.map((k, i) => (i === 13 ? { ...k, pubkey: attacker.publicKey } : k)) };
  const holderReward = { ...create, data: Uint8Array.from([...create.data.subarray(0, -1), 1]) };
  const withAccount = { ...cb[0], keys: [{ pubkey: "jitodontfront111111111111111111nopainnogain", isSigner: false, isWritable: false }] };
  const coSigned = { ...create, keys: [...create.keys, { pubkey: attacker.publicKey, isSigner: true, isWritable: false }] };
  const writableAuthority = { ...create, keys: create.keys.map((k, i) => (i === 1 ? { ...k, isWritable: true } : k)) };
  const hostile = {
    "a SOL transfer": [[...cb, create, transfer], /instruction for 1111.* does not carry/],
    "a dev buy": [[...cb, create, buy], /instruction for 6EF8.* does not carry/],
    "another creator": [[...cb, otherCreator], /creator is not the wallet/],
    "mayhem mode": [[...cb, mayhem], /option/],
    "a holder-rewards coin": [[...cb, holderReward], /option/],
    "another mayhem token vault": [[...cb, swappedVault], /accounts are not the ones/],
    "a writable mint authority": [[...cb, writableAuthority], /accounts are not the ones/],
    "two creates": [[...cb, create, create], /more than one create_v2/],
    "two limits": [[cb[0], cb[0], create], /more than one compute-budget/],
    "a compute-budget instruction with an account": [[withAccount, create], /instruction for ComputeBudget.* does not carry/],
    "a third signer": [[...cb, coSigned], /signers are not/],
    "no create": [[...cb], /signers are not/],
  };
  for (const [what, [instructions, reason]] of Object.entries(hostile)) {
    const msg = compileLegacyMessage({ payer: wallet.publicKey, recentBlockhash: blockhash(), instructions }).bytes;
    let calls = 0;
    const spy = (kp) => ({ publicKey: kp.publicKey, sign: (b) => { calls++; return kp.sign(b); } });
    assert.throws(() => checkLaunchMessage(msg, { wallet: wallet.publicKey, mint: mint.publicKey }), reason, what);
    assert.throws(() => signLaunchTransaction({ ...built, messageBytes: msg }, spy(wallet), spy(mint)), reason, what);
    assert.equal(calls, 0, `${what}: nothing was signed`);
  }
  // and the plain launch passes the same check
  assert.doesNotThrow(() => checkLaunchMessage(compileLegacyMessage({ payer: wallet.publicKey, recentBlockhash: blockhash(), instructions: [...cb, create] }).bytes, { wallet: wallet.publicKey, mint: mint.publicKey }));
  // a launch is only signed by its own wallet and mint
  assert.throws(() => signLaunchTransaction(built, attacker, mint), /wallet/);
  assert.throws(() => signLaunchTransaction(built, wallet, attacker), /mint/);
  assert.throws(() => signLaunchTransaction(built, mint, wallet), /wallet/);
});

/* ── keys ───────────────────────────────────────────────────────────────────────────────── */

test("deriveMintKeypair is deterministic per (wallet, post) and differs across posts and wallets", () => {
  const w = fresh(), v = fresh();
  const a = deriveMintKeypair(w.seed, "1971234567890123456");
  assert.equal(deriveMintKeypair(w.seed, "1971234567890123456").publicKey, a.publicKey);
  assert.equal(deriveMintKeypair(w, "1971234567890123456").publicKey, a.publicKey, "a keypair in place of its seed");
  assert.deepEqual(deriveMintKeypair(w.seed, "1971234567890123456").seed, a.seed);
  const mints = new Set([a, deriveMintKeypair(w.seed, "1971234567890123457"), deriveMintKeypair(w.seed, "197123456789012345"),
    deriveMintKeypair(v.seed, "1971234567890123456"), deriveMintKeypair(v.seed, "1971234567890123457")].map((k) => k.publicKey));
  assert.equal(mints.size, 5);
  assert.ok(!mints.has(w.publicKey) && !mints.has(v.publicKey));

  // the scheme itself: HMAC-SHA256(key = the wallet's seed, "catcoin-sanctuary:mint:" + postId) is the mint's seed
  assert.equal(MINT_DERIVATION_PREFIX, "catcoin-sanctuary:mint:");
  const expected = createHmac("sha256", w.seed).update(`catcoin-sanctuary:mint:1971234567890123456`).digest();
  assert.equal(hexOf(a.seed), hexOf(expected));
  assert.equal(a.publicKey, nodePublicKey(expected));
  // pinned, so a change to the scheme (which would let a post get a second coin) cannot pass unnoticed
  assert.equal(deriveMintKeypair(new Uint8Array(32).fill(7), "1971234567890123456").publicKey, "43QbEiq2Um2MuKwtPFNrWW6TZEGCBps5Ygifq6xzezBX");

  for (const bad of ["", " 123", "123 ", "12\n3", "x".repeat(129), 123, null]) assert.throws(() => deriveMintKeypair(w.seed, bad), TypeError, JSON.stringify(bad));
  for (const bad of [new Uint8Array(31), new Uint8Array(64), "seed", null]) assert.throws(() => deriveMintKeypair(bad, "1"), TypeError);
});

test("keypairFromSecret takes a 64-byte base58 secret, a JSON byte array, bytes, or a 32-byte seed; the public key is node's own and signatures verify", () => {
  const seed = randomBytes(32);
  const kp = keypairFromSecret(seed);
  assert.equal(kp.publicKey, nodePublicKey(seed));
  const secret = Buffer.concat([seed, kp.publicKeyBytes]);
  const forms = [base58Encode(secret), `  ${base58Encode(secret)}\n`, JSON.stringify([...secret]), new Uint8Array(secret), base58Encode(seed), new Uint8Array(seed)];
  for (const f of forms) assert.equal(keypairFromSecret(f).publicKey, kp.publicKey);
  const input = new Uint8Array(secret);
  keypairFromSecret(input);
  assert.equal(hexOf(input), hexOf(secret), "the caller's bytes are left as they were");
  assert.equal(hexOf(kp.seed), hexOf(seed));

  const msg = randomBytes(100);
  const sig = kp.sign(new Uint8Array(msg));
  assert.equal(sig.length, 64);
  assert.equal(ed25519Verify(null, msg, createPublicKey(createPrivateKey({ key: Buffer.concat([PKCS8, seed]), format: "der", type: "pkcs8" })), Buffer.from(sig)), true);
  assert.equal(verifyEd25519(kp.publicKey, msg, sig), true);
  assert.equal(verifyEd25519(fresh().publicKey, msg, sig), false);
  assert.throws(() => kp.sign("text"), TypeError);

  // RFC 8032 section 7.1, test 1 (a published test vector, not anyone's key): the public key and the signature of the empty message
  const rfc = keypairFromSecret(new Uint8Array(Buffer.from("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60", "hex")));
  assert.equal(hexOf(rfc.publicKeyBytes), "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a");
  assert.equal(hexOf(rfc.sign(new Uint8Array(0))), "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b");
});

test("keypairFromSecret refuses a mismatched or malformed secret without ever quoting it, and a keypair never shows its seed", () => {
  const seed = randomBytes(32);
  const other = fresh();
  const mismatched = Buffer.concat([seed, other.publicKeyBytes]);
  const b58 = base58Encode(mismatched);
  const needles = [b58, base58Encode(seed), seed.toString("hex"), mismatched.toString("hex"), seed.toString("base64"), [...seed].join(","), [...seed].slice(0, 8).join(",")];
  const leaks = (text) => needles.filter((n) => text.includes(n));
  const refused = (input, pattern) => assert.throws(() => keypairFromSecret(input), (e) => {
    const shown = `${e.message}\n${e.stack}\n${inspect(e, { depth: 5, showHidden: true })}\n${String(e.cause ?? "")}`;
    assert.deepEqual(leaks(shown), [], "the error quotes the secret");
    assert.match(e.message, pattern);
    return true;
  });

  refused(b58, /public key/);
  refused(new Uint8Array(mismatched), /public key/);
  refused(JSON.stringify([...mismatched]), /public key/);
  refused(base58Encode(mismatched.subarray(0, 63)), /64 bytes/);
  refused(`${b58}0`, /base58/);                                 // "0" is not a base58 digit
  refused(`[${[...seed].join(",")},x]`, /JSON/);                // not JSON: the parser's own message would quote it
  refused(`[${[...seed].join(",")},256]`, /JSON/);
  refused(`[${[...seed].join(",")}]x`, /JSON/);
  refused(new Uint8Array(33), /64 bytes/);
  assert.throws(() => keypairFromSecret(12345), TypeError);
  assert.throws(() => keypairFromSecret(null), TypeError);

  const kp = keypairFromSecret(seed);
  for (const shown of [JSON.stringify(kp), String(kp), `${kp}`, inspect(kp), inspect(kp, { showHidden: true, depth: 5 }), inspect({ kp }), JSON.stringify({ kp })]) {
    assert.deepEqual(leaks(shown), [], shown);
    assert.ok(shown.includes(kp.publicKey));
  }
  assert.equal(JSON.stringify(kp), JSON.stringify({ publicKey: kp.publicKey }));
  assert.deepEqual(Object.keys(kp), ["publicKey"]);
  assert.deepEqual({ ...kp }, { publicKey: kp.publicKey });
  assert.ok(Object.isFrozen(kp));
  kp.seed.fill(0); // the getter hands out a copy
  assert.equal(hexOf(kp.seed), seed.toString("hex"));
});

/* ── what create_v2 and the builder refuse ─────────────────────────────────────────────────── */

test("create_v2's limits (in UTF-8 bytes) and its https uri are enforced, and so are its addresses, the compute budget and the fee guard", () => {
  const wallet = fresh(), mint = deriveMintKeypair(wallet.seed, "42");
  const base = { mint: mint.publicKey, user: wallet.publicKey, creator: wallet.publicKey, ...COIN };
  const ok = (over) => createV2Instruction({ ...base, ...over });
  assert.doesNotThrow(() => ok({ name: "N".repeat(32), symbol: "S".repeat(13), uri: `https://a.example/${"p".repeat(182)}` }));
  assert.doesNotThrow(() => ok({ name: "é".repeat(16) })); // 32 bytes
  const refused = {
    "a 33-byte name": { name: "N".repeat(33) },
    "a 17-character, 34-byte name": { name: "é".repeat(17) },
    "a 14-byte symbol": { symbol: "S".repeat(14) },
    "a 201-byte uri": { uri: `https://a.example/${"p".repeat(183)}` },
    "an http uri": { uri: "http://ipfs.io/ipfs/QmbUFoY7PHPMCmkqKjerAnfseEKLszkdmqcd4SX4dGqJJd" },
    "an ipfs: uri": { uri: "ipfs://QmbUFoY7PHPMCmkqKjerAnfseEKLszkdmqcd4SX4dGqJJd" },
    "a uri with a space": { uri: "https://ipfs.io/ipfs/Qm bUFo" },
    "a uri with credentials": { uri: "https://user:pw@ipfs.io/ipfs/Qm" },
    "a uri that is not a URL": { uri: "https://" },
    "no uri": { uri: undefined },
    "an empty name": { name: "" },
    "a name with a line break": { name: "Gull\nGadot" },
    "a name with a link": { name: "visit gull.com" },
    "a symbol with markup": { symbol: "<b>G</b>" },
    "no symbol": { symbol: undefined },
  };
  for (const [what, over] of Object.entries(refused)) {
    assert.throws(() => ok(over), RangeError, what);
    assert.ok(launchTextProblem({ ...COIN, ...over }), what);
  }
  assert.equal(launchTextProblem(COIN), null);
  assert.throws(() => ok({ creator: SYSTEM_PROGRAM }), /default/);
  assert.throws(() => ok({ creator: "nope" }), /creator/);
  assert.throws(() => ok({ mint: wallet.publicKey }), /two accounts/);
  assert.throws(() => ok({ user: "0OIl" }), /user/);
  assert.throws(() => ok({ mayhemMode: "yes" }), TypeError);
  assert.equal(decodeCreateV2(ok({ mayhemMode: true }).data).isMayhemMode, true);

  const build = (over) => buildLaunchTransaction({ wallet: wallet.publicKey, mint: mint.publicKey, ...COIN, recentBlockhash: blockhash(), ...over });
  assert.doesNotThrow(() => build({}));
  assert.doesNotThrow(() => build({ computeUnitLimit: 200_000, computeUnitPriceMicroLamports: 25_000_000 })); // exactly 0.005 SOL
  for (const over of [{ computeUnitLimit: 0 }, { computeUnitLimit: 1_400_001 }, { computeUnitLimit: 1.5 }, { computeUnitPriceMicroLamports: -1 }, { computeUnitPriceMicroLamports: 0.5 }]) {
    assert.throws(() => build(over), RangeError, JSON.stringify(over));
  }
  assert.throws(() => build({ computeUnitLimit: 200_000, computeUnitPriceMicroLamports: 25_000_001 }), /priority fee/);
  assert.throws(() => build({ computeUnitLimit: 1_400_000, computeUnitPriceMicroLamports: 10n ** 12n }), /priority fee/);
  assert.throws(() => build({ recentBlockhash: "nope" }), /blockhash/);
  assert.throws(() => build({ name: "N".repeat(33) }), /name/);
  assert.throws(() => build({ mint: "nope" }), /mint/);
});

test("decodeCreateV2 reads missing trailing arguments as the program does, and refuses a partial one, a bad bool or extra bytes", () => {
  const full = PCREATE_DATA;
  const head = full.subarray(0, full.length - 10); // through is_mayhem_mode
  assert.deepEqual(decodeCreateV2(head), { ...decodeCreateV2(full), trailingArgs: 0 });
  assert.equal(decodeCreateV2(full.subarray(0, full.length - 9)).trailingArgs, 1);
  assert.equal(decodeCreateV2(full.subarray(0, full.length - 1)).trailingArgs, 2);
  assert.throws(() => decodeCreateV2(full.subarray(0, full.length - 5)), RangeError);     // half a u64
  assert.throws(() => decodeCreateV2(Buffer.concat([full, Buffer.from([0])])), /after/);
  const badBool = Buffer.from(full); badBool[badBool.length - 11] = 2;
  assert.throws(() => decodeCreateV2(badBool), /bool/);
  const fee = Buffer.from(full); fee.writeBigUInt64LE(250n, fee.length - 9);
  assert.equal(decodeCreateV2(fee).creatorFeeBps, 250n);
  assert.throws(() => decodeCreateV2(Buffer.from(anchorDiscriminator("create"), "hex")), /not a pump.fun create_v2/);
  assert.throws(() => decodeCreateV2(full.subarray(0, 20)), RangeError);
});

test("signTransaction signs in the message's signer order and refuses a missing, extra or repeated signer; serializeTransaction refuses a wrong signature count", () => {
  const { wallet, mint, built } = launch();
  const sigs = signTransaction(built.messageBytes, [mint, wallet]); // given in the other order
  assert.equal(verifyEd25519(wallet.publicKey, built.messageBytes, sigs[0]), true);
  assert.equal(verifyEd25519(mint.publicKey, built.messageBytes, sigs[1]), true);
  assert.deepEqual(signTransaction(built.message, [wallet, mint]), sigs, "Ed25519 is deterministic; a compiled message works as well as its bytes");
  assert.throws(() => signTransaction(built.messageBytes, [wallet]), /no keypair for the required signer/);
  assert.throws(() => signTransaction(built.messageBytes, [wallet, mint, fresh()]), /not a signer/);
  assert.throws(() => signTransaction(built.messageBytes, [wallet, wallet, mint]), /twice/);
  assert.throws(() => signTransaction(built.messageBytes, [wallet, { publicKey: mint.publicKey, sign: () => new Uint8Array(64) }]), /does not verify/);
  assert.throws(() => serializeTransaction(built.messageBytes, sigs.slice(0, 1)), /needs 2 signatures/);
  assert.throws(() => serializeTransaction(built.messageBytes, [sigs[0], sigs[1].subarray(0, 63)]), TypeError);
  const tx = serializeTransaction(built.messageBytes, sigs);
  assert.equal(tx[0], 2);
  assert.throws(() => decodeTransaction(Uint8Array.from([1, ...tx.subarray(1, 65), ...built.messageBytes])), /signature count/);
});

test("ata() re-derives a token account under an explicitly named token program", () => {
  const owner = someAddress(), mint = someAddress();
  assert.equal(ata(owner, mint, TOKEN_2022_PROGRAM), pda([owner, TOKEN_2022_PROGRAM, mint], ATA_PROGRAM));
  assert.notEqual(ata(owner, mint, TOKEN_PROGRAM), ata(owner, mint, TOKEN_2022_PROGRAM));
  assert.throws(() => ata(owner, mint), TypeError);
  assert.throws(() => ata(owner, mint, mint), TypeError);
  assert.throws(() => ata("nope", mint, TOKEN_PROGRAM), /owner/);
});
