/**
 * BUILDING AND SIGNING A SOLANA TRANSACTION, with no dependencies (node:crypto only). Stage 1 of
 * the launcher: everything here is pure (no network, no files) and is proved in
 * tests/launcher-tx.test.mjs against a real mainnet transaction and against the repo's own,
 * independent verifier (scripts/lib/chain.mjs messageBytes and signaturesVerify).
 *
 *   · keypairFromSecret: a wallet from its secret, as the Solana CLI (a JSON byte array) or
 *     Phantom (base58) exports it: 64 bytes, the Ed25519 seed then the public key, or the 32-byte
 *     seed alone as raw bytes (32 bytes given as text are refused: that is what a public address
 *     looks like). A 64-byte secret whose second half is not the public key of its first half, an
 *     all-zero seed, and (when the caller names it) a key for another wallet are refused. The
 *     secret never appears in an error, in toString, in JSON or in util.inspect.
 *   · deriveMintKeypair: the new coin's mint, derived from the wallet's seed and the trending
 *     post's id (HMAC-SHA256). The same post always gives the same mint, so a retry can only ever
 *     fail on "account already in use", never make a second coin; a post id is plain ASCII, so no
 *     two spellings of one id can give two mints.
 *   · the legacy wire format: compact-u16, message compile (keys deduplicated, payer first, then
 *     writable signers, readonly signers, writable non-signers, readonly non-signers, each group in
 *     first-seen order, as @solana/web3.js's Message.compile orders them), message decode,
 *     signing in the order of the message's signer accounts, and the serialized transaction.
 *   · the associated token account and ComputeBudget instructions.
 */
import { createHmac, createPrivateKey, createPublicKey, sign as ed25519Sign, verify as ed25519Verify, timingSafeEqual } from "node:crypto";
import { base58Decode, base58Encode, isAddress } from "../../assets/collection.js";
import { pda, isOnCurve, COMPUTE_BUDGET_PROGRAM, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, ATA_PROGRAM } from "./chain.mjs";

export { pda, isOnCurve };

/** The most bytes a serialized transaction may have (Solana's PACKET_DATA_SIZE: 1280 − 48). */
export const PACKET_DATA_SIZE = 1232;
/** The most compute units a transaction may ask for. */
export const MAX_COMPUTE_UNIT_LIMIT = 1_400_000;
/** The most compute units the runtime grants one instruction when a transaction sets no limit (builtins get less). */
export const DEFAULT_INSTRUCTION_COMPUTE_UNIT_LIMIT = 200_000;

/** The priority fee, in lamports, of `units` compute units at `microLamports` each: ceil(units × price / 1,000,000), as the runtime charges it. */
export function priorityFeeLamports(units, microLamports) {
  return (BigInt(units) * BigInt(microLamports) + 999_999n) / 1_000_000n;
}

const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex"); // + the 32-byte seed
const SPKI_ED25519 = Buffer.from("302a300506032b6570032100", "hex");        // + the 32-byte public key
const INSPECT = Symbol.for("nodejs.util.inspect.custom");

/* ── keypairs ─────────────────────────────────────────────────────────────────────────── */

/** The keypairs this module made. Only these are read for a seed: their getter hands out a copy, never the caller's bytes. */
const ISSUED = new WeakSet();

/** Whether every byte is zero (without stopping at the first that is not). */
const allZero = (bytes) => bytes.reduce((acc, b) => acc | b, 0) === 0;

/** A keypair from a 32-byte seed. The seed is copied; the caller may wipe its own. */
function keypairFromSeed(seed) {
  const der = Buffer.concat([PKCS8_ED25519, seed]);
  let privateKey;
  try { privateKey = createPrivateKey({ key: der, format: "der", type: "pkcs8" }); } finally { der.fill(0); }
  const publicBytes = Uint8Array.from(createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(-32));
  const publicKey = base58Encode(publicBytes);
  const own = Uint8Array.from(seed);
  const shown = `Keypair(${publicKey})`;
  const kp = {};
  Object.defineProperties(kp, {
    publicKey: { value: publicKey, enumerable: true },
    /** The 32 public-key bytes (a copy). */
    publicKeyBytes: { get: () => Uint8Array.from(publicBytes) },
    /** The 32-byte Ed25519 seed (a copy): the secret. Not enumerable, never shown. */
    seed: { get: () => Uint8Array.from(own) },
    /** The 64-byte Ed25519 signature of `bytes`. */
    sign: {
      value: (bytes) => {
        if (!(bytes instanceof Uint8Array)) throw new TypeError("sign takes bytes (a Uint8Array)");
        return new Uint8Array(ed25519Sign(null, Buffer.from(bytes), privateKey));
      },
    },
    toJSON: { value: () => ({ publicKey }) },
    toString: { value: () => shown },
    [INSPECT]: { value: () => shown },
  });
  Object.freeze(kp);
  ISSUED.add(kp);
  return kp;
}

/** The bytes of a secret given as bytes, base58 text or a JSON byte array (always a fresh copy). No error names the input. */
function secretBytes(secret) {
  if (secret instanceof Uint8Array) return Uint8Array.from(secret);
  if (typeof secret !== "string") throw new TypeError("a secret key is bytes, base58 text or a JSON array of bytes");
  const text = secret.trim();
  if (text.startsWith("[")) {
    let list;
    try { list = JSON.parse(text); } catch { list = null; } // the parser's message would quote the input
    if (!Array.isArray(list) || !list.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)) {
      throw new TypeError("a secret key given as JSON must be an array of byte values");
    }
    return Uint8Array.from(list);
  }
  const bytes = base58Decode(text, 128);
  if (!bytes) throw new TypeError("a secret key given as text must be base58");
  return bytes;
}

/**
 * A keypair { publicKey (base58), seed (Uint8Array, not enumerable), sign(bytes) } from a secret:
 * a 64-byte secret key (seed then public key) as bytes, base58 or a JSON byte array, or a 32-byte
 * seed as raw bytes. 32 bytes given as text are refused: the Solana CLI and Phantom export 64, and
 * 32 bytes of base58 are what a pasted public address looks like (whose "keypair" anyone could
 * make). With `publicKey`, the secret must be that wallet's. Throws, without quoting the secret,
 * when it is malformed, its halves do not match, its seed is all zeros or it is another wallet's.
 */
export function keypairFromSecret(secret, { publicKey: expected } = {}) {
  if (expected !== undefined && !isAddress(expected)) throw new TypeError("the expected public key is not a base58 address");
  const raw = secretBytes(secret);
  try {
    if (raw.length !== 64 && raw.length !== 32) {
      throw new RangeError(`a secret key is 64 bytes (the seed, then the public key) or a 32-byte seed; this one is ${raw.length} bytes`);
    }
    if (raw.length === 32 && typeof secret === "string") {
      throw new TypeError("32 bytes given as text look like a public address, not a secret key: give the 64-byte secret key (as the Solana CLI or Phantom exports it), or the 32-byte seed as raw bytes");
    }
    if (allZero(raw.subarray(0, 32))) throw new RangeError("the seed is all zeros: a key anyone can compute");
    const kp = keypairFromSeed(raw.subarray(0, 32));
    if (raw.length === 64 && !timingSafeEqual(Buffer.from(raw.subarray(32)), Buffer.from(kp.publicKeyBytes))) {
      throw new Error("the secret key's second half is not the public key of its first half (a corrupt or mismatched secret)");
    }
    if (expected !== undefined && kp.publicKey !== expected) throw new Error(`the secret key is not the expected wallet ${expected}'s`);
    return kp;
  } finally {
    raw.fill(0);
  }
}

/** The prefix of the message HMAC'd to derive a post's mint; changing it would change every mint. */
export const MINT_DERIVATION_PREFIX = "catcoin-sanctuary:mint:";

/**
 * A post id: 1-128 ASCII letters, digits, "_", "-" or ":" (an X status id, a Reddit id, a
 * "source:id"). Nothing else, so one id has one spelling (no space, no other Unicode normal form)
 * and two ids never reach the HMAC as the same bytes (as lone surrogates do: UTF-8 makes each U+FFFD).
 */
export const POST_ID = /^[A-Za-z0-9_:-]{1,128}$/;

/**
 * The mint keypair for a trending post: its seed is HMAC-SHA256(key = the wallet's 32-byte seed,
 * "catcoin-sanctuary:mint:" + postId). Deterministic per (wallet, post) and different across
 * both. `wallet` is the seed bytes (never modified) or a keypair from keypairFromSecret (no other
 * object is read). An all-zero seed and a post id that is not POST_ID are refused.
 */
export function deriveMintKeypair(wallet, postId) {
  const issued = ISSUED.has(wallet);
  if (!issued && !(wallet instanceof Uint8Array)) throw new TypeError("deriveMintKeypair needs the wallet's 32-byte seed (bytes) or a keypair from keypairFromSecret");
  const key = issued ? wallet.seed : wallet; // an issued keypair's getter hands out a fresh copy, wiped below; the caller's bytes are left alone
  try {
    if (key.length !== 32) throw new TypeError("deriveMintKeypair needs the wallet's 32-byte seed (or its keypair)");
    if (allZero(key)) throw new RangeError("the wallet's seed is all zeros: anyone could compute every mint's secret");
    if (typeof postId !== "string" || !POST_ID.test(postId)) throw new TypeError('a post id is 1-128 ASCII letters, digits, "_", "-" or ":"');
    const seed = createHmac("sha256", key).update(MINT_DERIVATION_PREFIX + postId, "utf8").digest();
    try { return keypairFromSeed(seed); } finally { seed.fill(0); }
  } finally {
    if (issued) key.fill(0);
  }
}

/** Whether `signature` (64 bytes) is `publicKey`'s (base58) Ed25519 signature of `message`. */
export function verifyEd25519(publicKey, message, signature) {
  const key = base58Decode(publicKey);
  if (!key || key.length !== 32 || !(signature instanceof Uint8Array) || signature.length !== 64) return false;
  try {
    const pub = createPublicKey({ key: Buffer.concat([SPKI_ED25519, key]), format: "der", type: "spki" });
    return ed25519Verify(null, Buffer.from(message), pub, Buffer.from(signature));
  } catch { return false; }
}

/* ── compact-u16 (Solana's short_vec) ──────────────────────────────────────────────────── */

/** The compact-u16 bytes of `n` (0..65535): seven bits a byte, low first, the high bit set while more follow. */
export function encodeCompactU16(n) {
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) throw new RangeError(`compact-u16 holds 0..65535, not ${n}`);
  const out = [];
  for (;;) {
    const b = n & 0x7f;
    n >>= 7;
    if (n === 0) { out.push(b); return out; }
    out.push(b | 0x80);
  }
}

/** { value, size } of the compact-u16 at `offset`. Refuses what Solana refuses: a zero continuation byte (an alias), a third byte that continues, a value past 65535, a truncated number. */
export function decodeCompactU16(bytes, offset = 0) {
  let value = 0;
  for (let i = 0; i < 3; i++) {
    if (offset + i >= bytes.length) throw new RangeError("a compact-u16 runs past the end");
    const b = bytes[offset + i];
    if (b === 0 && i > 0) throw new RangeError("a compact-u16 with a redundant zero byte (an alias)");
    if (i === 2 && b & 0x80) throw new RangeError("a compact-u16 longer than three bytes");
    value |= (b & 0x7f) << (7 * i);
    if (value > 0xffff) throw new RangeError("a compact-u16 past 65535");
    if (!(b & 0x80)) return { value, size: i + 1 };
  }
  throw new RangeError("a compact-u16 longer than three bytes"); // not reached: the third byte cannot continue
}

/* ── legacy messages ───────────────────────────────────────────────────────────────────── */

const addressBytes = (address, what) => {
  if (!isAddress(address)) throw new TypeError(`${what} is not a base58 address`);
  return base58Decode(address);
};

/** The wire bytes of a compiled legacy message { header, accountKeys, recentBlockhash, instructions: [{ programIdIndex, accounts, data }] }. */
export function encodeLegacyMessage({ header, accountKeys, recentBlockhash, instructions }) {
  const parts = [Buffer.from([header.numRequiredSignatures, header.numReadonlySignedAccounts, header.numReadonlyUnsignedAccounts])];
  parts.push(Buffer.from(encodeCompactU16(accountKeys.length)));
  accountKeys.forEach((k, i) => parts.push(Buffer.from(addressBytes(k, `account key ${i}`))));
  parts.push(Buffer.from(addressBytes(recentBlockhash, "the recent blockhash")));
  parts.push(Buffer.from(encodeCompactU16(instructions.length)));
  for (const ix of instructions) {
    parts.push(Buffer.from([ix.programIdIndex]), Buffer.from(encodeCompactU16(ix.accounts.length)), Buffer.from(ix.accounts));
    parts.push(Buffer.from(encodeCompactU16(ix.data.length)), Buffer.from(ix.data));
  }
  return new Uint8Array(Buffer.concat(parts));
}

/**
 * Compile instructions [{ programId, keys: [{ pubkey, isSigner, isWritable }], data }] into a
 * legacy message paid by `payer`. Every key appears once with the union of its flags; the payer
 * is first; the order is writable signers, readonly signers, writable non-signers, readonly
 * non-signers, each in first-seen order (the payer, then each program id before its accounts), as
 * @solana/web3.js's Message.compile orders them; with keyOrder "sorted", each group is sorted by
 * its base58 text in UTF-16 code-unit order instead (the payer still first), which reproduces the
 * four recorded StonkFun launch messages the tests rebuild. That is not guaranteed to be web3.js's
 * legacy Transaction.compileMessage order, which sorts with a locale compare (there "a" < "B";
 * here "B" < "a"). Solana accepts any order.
 * Returns { header, accountKeys, recentBlockhash, instructions (compiled), bytes }.
 */
export function compileLegacyMessage({ payer, recentBlockhash, instructions, keyOrder = "first-seen" } = {}) {
  if (keyOrder !== "first-seen" && keyOrder !== "sorted") throw new TypeError('keyOrder is "first-seen" or "sorted"');
  addressBytes(payer, "the payer");
  addressBytes(recentBlockhash, "the recent blockhash");
  if (!Array.isArray(instructions) || instructions.length === 0) throw new TypeError("a message needs at least one instruction");
  const metas = new Map();
  const touch = (key) => { if (!metas.has(key)) metas.set(key, { isSigner: false, isWritable: false }); return metas.get(key); };
  Object.assign(touch(payer), { isSigner: true, isWritable: true });
  instructions.forEach((ix, n) => {
    addressBytes(ix?.programId, `instruction ${n}'s program`);
    if (!Array.isArray(ix.keys) || !(ix.data instanceof Uint8Array)) throw new TypeError(`instruction ${n} needs keys (an array) and data (a Uint8Array)`);
    touch(ix.programId);
    ix.keys.forEach((k, j) => {
      addressBytes(k?.pubkey, `instruction ${n}'s account ${j}`);
      if (typeof k.isSigner !== "boolean" || typeof k.isWritable !== "boolean") throw new TypeError(`instruction ${n}'s account ${j} needs boolean isSigner and isWritable`);
      const m = touch(k.pubkey);
      m.isSigner ||= k.isSigner;
      m.isWritable ||= k.isWritable;
    });
  });
  const entries = [...metas];
  const byText = (a, b) => (a === payer ? -1 : b === payer ? 1 : a < b ? -1 : a > b ? 1 : 0);
  const group = (signer, writable) => {
    const keys = entries.filter(([, m]) => m.isSigner === signer && m.isWritable === writable).map(([k]) => k);
    return keyOrder === "sorted" ? keys.sort(byText) : keys;
  };
  const [ws, rs, wn, rn] = [group(true, true), group(true, false), group(false, true), group(false, false)];
  const accountKeys = [...ws, ...rs, ...wn, ...rn];
  if (accountKeys.length > 256) throw new RangeError(`${accountKeys.length} accounts; a legacy message indexes at most 256`);
  const header = { numRequiredSignatures: ws.length + rs.length, numReadonlySignedAccounts: rs.length, numReadonlyUnsignedAccounts: rn.length };
  const index = new Map(accountKeys.map((k, i) => [k, i]));
  const compiled = instructions.map((ix) => ({
    programIdIndex: index.get(ix.programId),
    accounts: ix.keys.map((k) => index.get(k.pubkey)),
    data: Uint8Array.from(ix.data),
  }));
  const message = { header, accountKeys, recentBlockhash, instructions: compiled };
  return { ...message, bytes: encodeLegacyMessage(message) };
}

/** Whether account `i` of a message with this header and `n` keys is writable (the message's own flags). */
export function isWritableIndex(header, n, i) {
  return i < header.numRequiredSignatures
    ? i < header.numRequiredSignatures - header.numReadonlySignedAccounts
    : i < n - header.numReadonlyUnsignedAccounts;
}

/**
 * Decode legacy message bytes, refusing what Solana's sanitizer refuses: a versioned message, a
 * header that does not fit the keys (a readonly payer, too many readonly accounts), an index out of
 * range, the payer as a program, a duplicate key, bytes past the end.
 * Returns { header, accountKeys, recentBlockhash, instructions: [{ programIdIndex, accounts, data }] }.
 */
export function decodeLegacyMessage(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("a message is bytes (a Uint8Array)");
  let o = 0;
  const need = (n) => { if (o + n > bytes.length) throw new RangeError(`the message ends at ${bytes.length}; ${n} more bytes were needed at ${o}`); };
  const u8 = () => { need(1); return bytes[o++]; };
  const len = () => { const { value, size } = decodeCompactU16(bytes, o); o += size; return value; };
  const key = () => { need(32); const k = base58Encode(bytes.subarray(o, o + 32)); o += 32; return k; };
  if (bytes.length > 0 && bytes[0] & 0x80) throw new TypeError("a versioned message, not a legacy one");
  const header = { numRequiredSignatures: u8(), numReadonlySignedAccounts: u8(), numReadonlyUnsignedAccounts: u8() };
  const nKeys = len();
  const accountKeys = Array.from({ length: nKeys }, key);
  if (new Set(accountKeys).size !== nKeys) throw new TypeError("a key appears twice in the message");
  if (header.numRequiredSignatures < 1 || header.numReadonlySignedAccounts >= header.numRequiredSignatures
    || header.numRequiredSignatures + header.numReadonlyUnsignedAccounts > nKeys) throw new TypeError("a header that does not fit the message's keys");
  const recentBlockhash = key();
  const instructions = Array.from({ length: len() }, () => {
    const programIdIndex = u8();
    const accounts = Array.from({ length: len() }, u8);
    const n = len();
    need(n);
    const data = Uint8Array.from(bytes.subarray(o, o + n)); o += n;
    if (programIdIndex === 0 || programIdIndex >= nKeys || accounts.some((i) => i >= nKeys)) throw new RangeError("an instruction names an account the message does not have");
    return { programIdIndex, accounts, data };
  });
  if (o !== bytes.length) throw new RangeError(`${bytes.length - o} bytes after the message`);
  return { header, accountKeys, recentBlockhash, instructions };
}

/** A decoded message's instructions as [{ programId, keys: [{ pubkey, isSigner, isWritable }], data }], with the message's own flags. */
export function decompileInstructions({ header, accountKeys, instructions }) {
  const meta = (i) => ({ pubkey: accountKeys[i], isSigner: i < header.numRequiredSignatures, isWritable: isWritableIndex(header, accountKeys.length, i) });
  return instructions.map((ix) => ({ programId: accountKeys[ix.programIdIndex], keys: ix.accounts.map(meta), data: ix.data }));
}

/* ── signing and the wire transaction ─────────────────────────────────────────────────── */

const messageOf = (m) => (m instanceof Uint8Array ? m : m?.bytes instanceof Uint8Array ? m.bytes : null);

/**
 * Sign legacy message bytes with `signers` (keypairs: { publicKey, sign }). Returns the 64-byte
 * signatures in the order of the message's signer accounts. Every required signer must be given,
 * and no other; each signature is verified before it is returned.
 */
export function signTransaction(messageBytes, signers) {
  const msg = messageOf(messageBytes);
  if (!msg) throw new TypeError("signTransaction takes the message bytes");
  const { header, accountKeys } = decodeLegacyMessage(msg);
  const required = accountKeys.slice(0, header.numRequiredSignatures);
  if (!Array.isArray(signers)) throw new TypeError("signers is an array of keypairs");
  const byKey = new Map();
  for (const s of signers) {
    if (!s || !isAddress(s.publicKey) || typeof s.sign !== "function") throw new TypeError("a signer is a keypair { publicKey, sign }");
    if (byKey.has(s.publicKey)) throw new Error(`${s.publicKey} is given twice`);
    if (!required.includes(s.publicKey)) throw new Error(`${s.publicKey} is not a signer of this message`);
    byKey.set(s.publicKey, s);
  }
  const missing = required.filter((k) => !byKey.has(k));
  if (missing.length) throw new Error(`no keypair for the required signer${missing.length > 1 ? "s" : ""} ${missing.join(", ")}`);
  return required.map((k) => {
    const sig = byKey.get(k).sign(msg);
    if (!verifyEd25519(k, msg, sig)) throw new Error(`the keypair for ${k} made a signature that does not verify`);
    return sig;
  });
}

/** The wire transaction: compact-u16 signature count, the 64-byte signatures, the message. Refuses the wrong number of signatures and more than 1,232 bytes. */
export function serializeTransaction(message, signatures) {
  const msg = messageOf(message);
  if (!msg) throw new TypeError("serializeTransaction takes the message (bytes or a compiled message)");
  const { header } = decodeLegacyMessage(msg);
  if (!Array.isArray(signatures) || signatures.length !== header.numRequiredSignatures) {
    throw new Error(`the message needs ${header.numRequiredSignatures} signatures`);
  }
  if (!signatures.every((s) => s instanceof Uint8Array && s.length === 64)) throw new TypeError("a signature is 64 bytes");
  const out = Buffer.concat([Buffer.from(encodeCompactU16(signatures.length)), ...signatures.map((s) => Buffer.from(s)), Buffer.from(msg)]);
  if (out.length > PACKET_DATA_SIZE) throw new RangeError(`the transaction is ${out.length} bytes; Solana takes at most ${PACKET_DATA_SIZE}`);
  return new Uint8Array(out);
}

/** { signatures, messageBytes, message } of a serialized legacy transaction. */
export function decodeTransaction(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("a transaction is bytes (a Uint8Array)");
  const { value: n, size } = decodeCompactU16(bytes, 0);
  if (size + 64 * n > bytes.length) throw new RangeError("the signatures run past the end");
  const signatures = Array.from({ length: n }, (_, i) => Uint8Array.from(bytes.subarray(size + 64 * i, size + 64 * (i + 1))));
  const messageBytes = Uint8Array.from(bytes.subarray(size + 64 * n));
  const message = decodeLegacyMessage(messageBytes);
  if (message.header.numRequiredSignatures !== n) throw new Error("the signature count does not match the message's header");
  return { signatures, messageBytes, message };
}

/** A serialized legacy transaction in the shape getTransaction (encoding json) answers with, less meta: what chain.mjs reads. */
export function transactionToJson(bytes) {
  const { signatures, message } = decodeTransaction(bytes);
  return {
    version: "legacy",
    transaction: {
      signatures: signatures.map(base58Encode),
      message: {
        header: { ...message.header },
        accountKeys: [...message.accountKeys],
        recentBlockhash: message.recentBlockhash,
        instructions: message.instructions.map((ix) => ({ programIdIndex: ix.programIdIndex, accounts: [...ix.accounts], data: base58Encode(ix.data) })),
      },
    },
  };
}

/* ── accounts and ComputeBudget ───────────────────────────────────────────────────────── */

/** The associated token account of `owner` for `mint` under `tokenProgram` (the classic token program or Token-2022, named explicitly). */
export function ata(owner, mint, tokenProgram) {
  addressBytes(owner, "the owner");
  addressBytes(mint, "the mint");
  if (tokenProgram !== TOKEN_PROGRAM && tokenProgram !== TOKEN_2022_PROGRAM) throw new TypeError("the token program must be the classic token program or Token-2022");
  return pda([owner, tokenProgram, mint], ATA_PROGRAM);
}

/** ComputeBudget SetComputeUnitLimit: [2, u32 LE], no accounts (the 5-byte form chain.mjs accepts). */
export function setComputeUnitLimit(units) {
  if (!Number.isInteger(units) || units < 1 || units > MAX_COMPUTE_UNIT_LIMIT) throw new RangeError(`a compute-unit limit is 1..${MAX_COMPUTE_UNIT_LIMIT}`);
  const data = Buffer.alloc(5);
  data[0] = 2;
  data.writeUInt32LE(units, 1);
  return { programId: COMPUTE_BUDGET_PROGRAM, keys: [], data: new Uint8Array(data) };
}

/** ComputeBudget SetComputeUnitPrice: [3, u64 LE] micro-lamports per compute unit, no accounts (the 9-byte form chain.mjs accepts). */
export function setComputeUnitPrice(microLamports) {
  const v = typeof microLamports === "bigint" ? microLamports : Number.isSafeInteger(microLamports) ? BigInt(microLamports) : -1n;
  if (v < 0n || v > 0xffffffffffffffffn) throw new RangeError("a compute-unit price is a whole number of micro-lamports, 0 or more");
  const data = Buffer.alloc(9);
  data[0] = 3;
  data.writeBigUInt64LE(v, 1);
  return { programId: COMPUTE_BUDGET_PROGRAM, keys: [], data: new Uint8Array(data) };
}
