/**
 * PROVING A LAUNCH ON SOLANA: is this transaction a StonkFun launch on Raydium LaunchLab, paid
 * by this wallet, priced in one of the sanctuary's stock pairs (assets/collection.js STOCK_PAIRS:
 * the 24 xStocks, the Backpack stocks and funds, the PreStocks and the Tessera tokens of the
 * planned cats)? Node only (it hashes with node:crypto).
 *
 * The program ids, PDAs, discriminators and account layouts below were read off mainnet by the
 * Cat Intelligence Agency project and are copied from it with thanks: bots/lib/verified.mjs
 * (program ids, the StonkFun platform config, discriminators), bots/cashcat/stonkfun.mjs (the
 * PDAs, the initialize_with_token_2022 account order and data layout, the GlobalConfig layout)
 * and bots/lib/solana.mjs (the borsh reader). The LaunchLab IDL (raydium_launchpad 0.2.0, the
 * on-chain copy in E6wT2uNe…JK5Z) was re-read on 2026-09-25 for buy_exact_in, initialize and
 * initialize_v2. Every PDA is re-derived in tests/chain.test.mjs from six real StonkFun launches;
 * four of them are priced in a stock pair (GMEx, GOOGLx, the ANTHROPIC PreStock and the IREN
 * Backpack stock) and are proved end to end, and two (SOL, and a custom token) are refused.
 *
 * WHAT A LAUNCH LOOKS LIKE (every recorded real StonkFun launch, tests/fixtures/):
 *   · a legacy or v0 transaction that succeeded, signed by the payer and by the new mint;
 *   · ComputeBudget limit and price;
 *   · ONE top-level LaunchLab initialize_with_token_2022 with sixteen accounts: the fifteen
 *     the IDL names, then StonkFun's platform curve rule
 *        0 payer  1 creator  2 global_config  3 platform_config  4 authority = PDA["vault_auth_seed"]
 *        5 pool = PDA["pool", mint, quote]  6 mint (signer)  7 quote mint
 *        8 base vault = PDA["pool_vault", pool, mint]  9 quote vault = PDA["pool_vault", pool, quote]
 *        10 Token-2022  11 the quote's token program  12 system  13 event authority = PDA["__event_authority"]
 *        14 LaunchLab  15 curve rule = PDA["platform_curve_rule", platform, global_config]
 *   · optionally a dev buy, as StonkFun's own site sends it: two create-idempotent token
 *     accounts for the payer, then LaunchLab buy_exact_in on the new pool (fifteen named
 *     accounts, then the system program and two fee accounts the program checks itself);
 *   · a v0 transaction may load accounts from a lookup table; the RPC's json answer resolves
 *     them (meta.loadedAddresses), and a signer is never loaded from a table.
 * Anything else in the transaction is refused, and so is anything that cannot be decoded. So is
 * a launch on StonkFun's reward platform (a transfer-taxed coin; a real one, made from StonkFun's
 * site, is in tests/fixtures/stonkfun-reward-launch.json), and LaunchLab's initialize and
 * initialize_v2, which no recorded StonkFun launch has used.
 */
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { STOCK_PAIRS, base58Decode, base58Encode, isAddress, isSignature, blockTimeToIso } from "../../assets/collection.js";

/* ── pinned ids (bots/lib/verified.mjs, read off mainnet 2026-09-24) ─────────────────── */
export const LAUNCHLAB_PROGRAM = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
export const LAUNCHLAB_AUTHORITY = "WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh";
export const LAUNCHLAB_EVENT_AUTHORITY = "2DPAtwB8L12vrMRExbLuyGnC7n2J5LNoZQSejeQGpwkr";
/** StonkFun's standard platform config: its on-chain PlatformConfig reads name "StonkFun". */
export const STONKFUN_PLATFORM = "4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7";
/** StonkFun's reward (transfer-taxed) platform. Not a sanctuary launch: refused by name. */
export const STONKFUN_PLATFORM_REWARD = "6BwHHDg3u1854jC8PDLXvR4spTcLNaoBxLJNGC4nTESt";
export const PUMPFUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";

/** sha256("global:<name>")[0..8], equal to the live IDL's discriminators (a test recomputes them). */
export const IX = Object.freeze({
  initializeWithToken2022: "25be7ede2c9aab11",
  initialize: "afaf6d1f0d989bed",
  initializeV2: "4399af27da102620",
  buyExactIn: "faea0d7bd59c13ec",
});
/** sha256("account:GlobalConfig")[0..8]. */
export const GLOBAL_CONFIG_DISC = "95089ccaa0fcb0d9";

/* ── ed25519 and PDAs (no dependencies) ───────────────────────────────────────────────── */

const P = 2n ** 255n - 19n;
const mod = (a) => ((a % P) + P) % P;
function pow(b, e) { let r = 1n; b = mod(b); while (e > 0n) { if (e & 1n) r = (r * b) % P; b = (b * b) % P; e >>= 1n; } return r; }
const D = mod(-121665n * pow(121666n, P - 2n));

/**
 * Whether 32 bytes decompress to a point on ed25519, as curve25519-dalek's
 * CompressedEdwardsY::decompress decides (Solana's Pubkey::is_on_curve): y is read from 255
 * bits and reduced, and the point exists when (y² − 1) / (d·y² + 1) is a square.
 */
export function isOnCurve(bytes) {
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(i === 31 ? bytes[i] & 0x7f : bytes[i]);
  y = mod(y);
  const y2 = (y * y) % P;
  const w = mod((y2 - 1n) * pow(mod(D * y2 + 1n), P - 2n));
  return w === 0n || pow(w, (P - 1n) / 2n) === 1n;
}

const sha256 = (...parts) => createHash("sha256").update(Buffer.concat(parts.map((p) => Buffer.from(p)))).digest();
const seedBytes = (s) => (typeof s === "string" && s.startsWith("utf8:") ? Buffer.from(s.slice(5), "utf8") : Buffer.from(base58Decode(s)));

/** findProgramAddress. A seed is "utf8:<text>" or a base58 address. */
export function pda(seeds, programId) {
  const parts = seeds.map(seedBytes);
  const program = Buffer.from(base58Decode(programId));
  for (let bump = 255; bump >= 0; bump--) {
    const h = sha256(...parts, [bump], program, Buffer.from("ProgramDerivedAddress"));
    if (!isOnCurve(h)) return base58Encode(h);
  }
  throw new Error("no program address");
}

export const poolAddress = (mint, quote) => pda(["utf8:pool", mint, quote], LAUNCHLAB_PROGRAM);
export const vaultAddress = (pool, mint) => pda(["utf8:pool_vault", pool, mint], LAUNCHLAB_PROGRAM);
export const curveRuleAddress = (platform, globalConfig) => pda(["utf8:platform_curve_rule", platform, globalConfig], LAUNCHLAB_PROGRAM);

/* ── a bounds-checked borsh reader (after bots/lib/solana.mjs) ─────────────────────────── */

class DecodeError extends Error {}
function reader(buf, offset = 0) {
  let o = offset;
  const need = (n) => { if (o + n > buf.length) throw new DecodeError(`read past the end at ${o}+${n} of ${buf.length}`); };
  return {
    get offset() { return o; },
    u8() { need(1); return buf[o++]; },
    u16() { need(2); const v = buf.readUInt16LE(o); o += 2; return v; },
    u32() { need(4); const v = buf.readUInt32LE(o); o += 4; return v; },
    u64() { need(8); const v = buf.readBigUInt64LE(o); o += 8; return v; },
    key() { need(32); const v = base58Encode(buf.subarray(o, o + 32)); o += 32; return v; },
    str(max = 512) {
      const n = this.u32();
      if (n > max) throw new DecodeError(`a string of ${n} bytes`);
      need(n);
      const bytes = buf.subarray(o, o + n); o += n;
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); // refuses invalid UTF-8
      return text;
    },
    rest() { return buf.subarray(o); },
  };
}

/**
 * initialize_with_token_2022's data (after bots/cashcat/stonkfun.mjs decodeInitialize, with
 * every field checked): MintParams, CurveParams::Constant, VestingParams, AmmCreatorFeeOn and
 * Option<TransferFeeExtensionParams>. A None option is the tag 0 alone or, as some real
 * launches send it, the tag 0 and ten more bytes the program does not read; nothing else may follow.
 */
export function decodeInitialize(data) {
  const d = Buffer.from(data);
  if (d.subarray(0, 8).toString("hex") !== IX.initializeWithToken2022) throw new DecodeError("not initialize_with_token_2022");
  const r = reader(d, 8);
  const out = { decimals: r.u8(), name: r.str(200), symbol: r.str(200), uri: r.str(512) };
  const curve = r.u8();
  if (curve !== 0) throw new DecodeError(`curve variant ${curve} is not the constant curve`);
  out.supply = r.u64(); out.totalBaseSell = r.u64(); out.raise = r.u64();
  out.migrateType = r.u8();
  out.vesting = [r.u64(), r.u64(), r.u64()];
  out.ammFeeOn = r.u8();
  if (out.ammFeeOn > 1) throw new DecodeError(`amm_fee_on ${out.ammFeeOn}`);
  out.transferFee = r.u8();
  if (out.transferFee > 1) throw new DecodeError(`option tag ${out.transferFee}`);
  const rest = r.rest().length;
  if (out.transferFee === 0 && rest !== 0 && rest !== 10) throw new DecodeError(`${rest} bytes after the instruction`);
  if (out.transferFee === 1 && rest !== 10) throw new DecodeError(`${rest} bytes of transfer-fee parameters`);
  return out;
}

/* ── reading the RPC's json transaction ───────────────────────────────────────────────── */

function readTransaction(tx) {
  const msg = tx?.transaction?.message;
  const header = msg?.header;
  if (!msg || !header || !Array.isArray(msg.accountKeys) || !Array.isArray(msg.instructions) || !Array.isArray(tx.transaction.signatures)) {
    throw new DecodeError("not a json-encoded transaction");
  }
  const loaded = tx.meta?.loadedAddresses ?? { writable: [], readonly: [] };
  const keys = [...msg.accountKeys, ...(loaded.writable ?? []), ...(loaded.readonly ?? [])];
  if (!keys.every(isAddress)) throw new DecodeError("an account key is not an address");
  const lookups = (msg.addressTableLookups ?? []).reduce((n, l) => n + (l.writableIndexes?.length ?? 0) + (l.readonlyIndexes?.length ?? 0), 0);
  if (lookups !== keys.length - msg.accountKeys.length) throw new DecodeError("the lookup-table accounts do not match what the RPC loaded");
  const nSigners = header.numRequiredSignatures;
  if (!Number.isInteger(nSigners) || nSigners < 1 || nSigners > msg.accountKeys.length) throw new DecodeError("a bad header");
  if (tx.transaction.signatures.length !== nSigners || !tx.transaction.signatures.every(isSignature)) throw new DecodeError("the signatures do not match the header");
  const decodeIx = (ix) => {
    if (!Number.isInteger(ix.programIdIndex) || !keys[ix.programIdIndex] || !Array.isArray(ix.accounts) || !ix.accounts.every((i) => Number.isInteger(i) && keys[i])) {
      throw new DecodeError("an instruction names an account that is not in the transaction");
    }
    const data = ix.data === "" ? new Uint8Array(0) : base58Decode(ix.data, 2000); // a transaction is at most 1,232 bytes
    if (!data) throw new DecodeError("instruction data is not base58");
    return { program: keys[ix.programIdIndex], accounts: ix.accounts.map((i) => keys[i]), accountIndexes: ix.accounts, data: Buffer.from(data) };
  };
  return {
    signature: tx.transaction.signatures[0],
    feePayer: msg.accountKeys[0],
    isSigner: (address) => msg.accountKeys.slice(0, nSigners).includes(address),
    instructions: msg.instructions.map(decodeIx),
    inner: (tx.meta?.innerInstructions ?? []).flatMap((g) => (g.instructions ?? []).map(decodeIx)),
  };
}

const disc = (ix) => ix.data.subarray(0, 8).toString("hex");
const isLaunchIx = (ix) => ix.program === LAUNCHLAB_PROGRAM && [IX.initializeWithToken2022, IX.initialize, IX.initializeV2].includes(disc(ix));

/* ── the proof ───────────────────────────────────────────────────────────────────────── */

/**
 * Whether `tx` (a getTransaction answer, encoding json) is a StonkFun launch paid by `wallet`
 * and priced in one of `stocks` (by default the sanctuary's stock pairs). Returns { ok: true, launch } or { ok: false, clause, detail }.
 * `launch` is { mint, name, symbol, pair: { symbol, mint }, pool, payer, tx, time, globalConfig, uri }.
 * The clause "no_launch" means the transaction is simply not a launch (a transfer, a swap, a
 * pump.fun coin): the builder does not record those.
 */
export function proveLaunch(tx, { wallet, stocks = STOCK_PAIRS } = {}) {
  let launchLike = null; // does the transaction carry a LaunchLab launch at all? (null: could not tell)
  const no = (clause, detail) => ({ ok: false, clause, detail, launchLike });
  if (!tx || typeof tx !== "object" || !tx.meta) return no("unreadable", "no transaction, or no status");
  if (tx.version !== "legacy" && tx.version !== 0) return no("tx_version", `transaction version ${JSON.stringify(tx.version)}`);
  let t;
  try { t = readTransaction(tx); } catch (e) { return no("unreadable", e.message); }
  const launches = t.instructions.filter(isLaunchIx);
  launchLike = launches.length > 0 || t.inner.some(isLaunchIx);
  if (tx.meta.err !== null || (tx.meta.status && !("Ok" in tx.meta.status))) return no("failed", "the transaction failed on chain");
  if (t.feePayer !== wallet) return no("fee_payer", "the fee payer is not the listed wallet");

  if (launches.length === 0) {
    if (launchLike) return no("cpi_launch", "LaunchLab was called by another program; only a direct launch is read");
    return no("no_launch", t.instructions.some((ix) => ix.program === PUMPFUN_PROGRAM) ? "a pump.fun transaction, not a LaunchLab launch" : "not a launch");
  }
  if (launches.length > 1) return no("several_launches", "more than one launch in one transaction");
  const init = launches[0];
  if (disc(init) !== IX.initializeWithToken2022) return no("unrecorded_variant", "LaunchLab initialize / initialize_v2: no StonkFun launch has been recorded in that form");

  let args;
  try { args = decodeInitialize(init.data); } catch (e) { return no("decode", e.message); }

  const a = init.accounts;
  if (a.length !== 16) return no("accounts", `${a.length} accounts; every StonkFun launch has 16`);
  const [payer, creator, globalConfig, platform, authority, pool, mint, quote, baseVault, quoteVault, baseProgram, quoteProgram, system, eventAuthority, program, curveRule] = a;
  if (payer !== wallet) return no("payer", "the launch's payer is not the listed wallet");
  if (creator !== wallet) return no("creator", "the launch's creator is not the listed wallet");
  if (platform !== STONKFUN_PLATFORM) return no("platform", platform === STONKFUN_PLATFORM_REWARD ? "StonkFun's reward platform (a transfer-taxed coin), not its standard one" : "not StonkFun's platform");
  if (args.transferFee === 1) return no("transfer_fee", "a transfer-taxed coin, not a standard StonkFun launch");
  if (authority !== LAUNCHLAB_AUTHORITY || eventAuthority !== LAUNCHLAB_EVENT_AUTHORITY || program !== LAUNCHLAB_PROGRAM
    || system !== SYSTEM_PROGRAM || baseProgram !== TOKEN_2022_PROGRAM) return no("accounts", "a fixed LaunchLab account is not the one it must be");
  if (!t.isSigner(mint)) return no("accounts", "the new mint did not sign");
  if (new Set([mint, quote, pool, wallet]).size !== 4) return no("accounts", "the mint, quote, pool and wallet are not four accounts");
  if (pool !== poolAddress(mint, quote)) return no("accounts", "the pool is not PDA(pool, mint, quote)");
  if (baseVault !== vaultAddress(pool, mint) || quoteVault !== vaultAddress(pool, quote)) return no("accounts", "a vault is not PDA(pool_vault, pool, mint)");
  if (curveRule !== curveRuleAddress(platform, globalConfig)) return no("accounts", "the last account is not StonkFun's curve rule for this config");

  for (const ix of t.instructions) {
    if (ix === init) continue;
    const bad = otherInstructionProblem(ix, { wallet, mint, quote, quoteProgram, pool, globalConfig, platform });
    if (bad) return no("unexpected_instruction", bad);
  }

  const stock = stocks.find((s) => s.mint === quote);
  if (!stock) return no("quote_not_stock", "priced in a token that is not one of the sanctuary's stock pairs");
  if (quoteProgram !== TOKEN_2022_PROGRAM) return no("accounts", "every stock pair is a Token-2022 mint");
  if (!Number.isInteger(tx.blockTime) || tx.blockTime <= 0) return no("no_time", "the transaction has no block time");

  return {
    ok: true,
    launch: {
      mint, name: args.name, symbol: args.symbol, pair: { symbol: stock.symbol, mint: stock.mint },
      pool, payer: wallet, tx: t.signature, time: blockTimeToIso(tx.blockTime), globalConfig, uri: args.uri,
    },
  };
}

/** Why an instruction beside the launch is not one a StonkFun launch carries, or null. */
function otherInstructionProblem(ix, { wallet, mint, quote, quoteProgram, pool, globalConfig, platform }) {
  const d = ix.data;
  if (ix.program === COMPUTE_BUDGET_PROGRAM) {
    const ok = ix.accounts.length === 0 && ((d[0] === 3 && d.length === 9) || ([1, 2, 4].includes(d[0]) && d.length === 5));
    return ok ? null : "a compute-budget instruction of an unknown kind";
  }
  if (ix.program === ATA_PROGRAM) {
    // create (no data or 0) or create_idempotent (1): funder, account, owner, mint, system, token program
    const kind = d.length === 0 ? 0 : d.length === 1 ? d[0] : -1;
    const [funder, , owner, forMint, system, tokenProgram] = ix.accounts;
    if (![0, 1].includes(kind) || ix.accounts.length !== 6) return "a token-account instruction of an unknown kind";
    if (funder !== wallet || owner !== wallet || ![mint, quote].includes(forMint) || system !== SYSTEM_PROGRAM
      || tokenProgram !== (forMint === mint ? TOKEN_2022_PROGRAM : quoteProgram)) {
      return "a token account that is not the wallet's own, for this coin or its stock";
    }
    return null;
  }
  if (ix.program === LAUNCHLAB_PROGRAM && disc(ix) === IX.buyExactIn) {
    // the dev buy: buy_exact_in on the new pool, paid by the wallet
    const b = ix.accounts;
    if (d.length !== 32 || b.length < 15 || b.length > 18) return "a buy that cannot be decoded";
    const named = [wallet, LAUNCHLAB_AUTHORITY, globalConfig, platform, pool, null, null, vaultAddress(pool, mint), vaultAddress(pool, quote),
      mint, quote, TOKEN_2022_PROGRAM, quoteProgram, LAUNCHLAB_EVENT_AUTHORITY, LAUNCHLAB_PROGRAM];
    if (named.some((want, i) => want !== null && b[i] !== want)) return "a buy that is not the wallet's own buy of this coin";
    if (b.length > 15 && b[15] !== SYSTEM_PROGRAM) return "a buy with unknown extra accounts";
    return null;
  }
  return `an instruction for ${ix.program.slice(0, 8)}… that a StonkFun launch does not carry`;
}

/* ── the transaction's own signatures ─────────────────────────────────────────────────── */

/* The RPC is trusted to report the chain, but its answer is checked where that is cheap: the
   transaction must be the one asked for, and every required signature must verify over the
   message the answer describes. A provider that relabels a real launch as the owner's (a new fee
   payer) cannot also forge the owner's signature, so such an answer is caught here. */

const compactU16 = (n) => { const out = []; for (;;) { const b = n & 0x7f; n >>= 7; if (n) out.push(b | 0x80); else { out.push(b); return out; } } };

/** The bytes a json-encoded legacy or v0 transaction's signatures sign (its message), or null if they cannot be rebuilt. */
export function messageBytes(tx) {
  try {
    const m = tx.transaction.message, h = m.header, parts = [];
    const bytes = (b58, size) => { const b = base58Decode(b58); if (!b || b.length !== size) throw new DecodeError("a key is not 32 bytes"); return [...b]; };
    const u8 = (v) => { if (!Number.isInteger(v) || v < 0 || v > 255) throw new DecodeError("not a byte"); return v; };
    if (tx.version === 0) parts.push(0x80);
    else if (tx.version !== "legacy") return null;
    parts.push(u8(h.numRequiredSignatures), u8(h.numReadonlySignedAccounts), u8(h.numReadonlyUnsignedAccounts));
    parts.push(...compactU16(m.accountKeys.length));
    for (const k of m.accountKeys) parts.push(...bytes(k, 32));
    parts.push(...bytes(m.recentBlockhash, 32));
    parts.push(...compactU16(m.instructions.length));
    for (const ix of m.instructions) {
      const data = ix.data === "" ? [] : [...(base58Decode(ix.data, 2000) ?? (() => { throw new DecodeError("data"); })())];
      parts.push(u8(ix.programIdIndex), ...compactU16(ix.accounts.length), ...ix.accounts.map(u8), ...compactU16(data.length), ...data);
    }
    if (tx.version === 0) {
      const lookups = m.addressTableLookups ?? [];
      parts.push(...compactU16(lookups.length));
      for (const l of lookups) parts.push(...bytes(l.accountKey, 32), ...compactU16(l.writableIndexes.length), ...l.writableIndexes.map(u8), ...compactU16(l.readonlyIndexes.length), ...l.readonlyIndexes.map(u8));
    }
    return Buffer.from(parts);
  } catch { return null; }
}

const ED25519_SPKI = Buffer.from("302a300506032b6570032100", "hex");

/** Whether every required signature of a json-encoded transaction verifies (signature i by account key i). */
export function signaturesVerify(tx) {
  const msg = messageBytes(tx);
  const sigs = tx?.transaction?.signatures, keys = tx?.transaction?.message?.accountKeys;
  const n = tx?.transaction?.message?.header?.numRequiredSignatures;
  if (!msg || !Array.isArray(sigs) || !Array.isArray(keys) || !Number.isInteger(n) || n < 1 || sigs.length !== n || keys.length < n) return false;
  try {
    for (let i = 0; i < n; i++) {
      const sig = base58Decode(sigs[i]), key = base58Decode(keys[i]);
      if (!sig || sig.length !== 64 || !key || key.length !== 32) return false;
      const pub = createPublicKey({ key: Buffer.concat([ED25519_SPKI, Buffer.from(key)]), format: "der", type: "spki" });
      if (!verifySignature(null, msg, pub, Buffer.from(sig))) return false;
    }
    return true;
  } catch { return false; }
}

/* ── the two accounts read back after a launch is proved ──────────────────────────────── */

/**
 * A Token-2022 mint's TokenMetadata extension (type 19): { updateAuthority, mint, name, symbol, uri }.
 * Layout: the 82-byte mint, padding to 165, the account type (1 = mint), then TLV entries.
 */
export function readTokenMetadata(data) {
  const b = Buffer.from(data);
  if (b.length < 166 || b[165] !== 1) throw new DecodeError("not a Token-2022 mint with extensions");
  let o = 166;
  while (o + 4 <= b.length) {
    const type = b.readUInt16LE(o), len = b.readUInt16LE(o + 2);
    if (type === 0) break;
    if (o + 4 + len > b.length) throw new DecodeError("an extension runs past the end");
    if (type === 19) {
      const r = reader(b.subarray(o + 4, o + 4 + len));
      return { updateAuthority: r.key(), mint: r.key(), name: r.str(200), symbol: r.str(200), uri: r.str(512) };
    }
    o += 4 + len;
  }
  throw new DecodeError("the mint carries no token metadata");
}

/** GlobalConfig's quote mint (bots/cashcat/stonkfun.mjs decodeGlobalConfig): after the discriminator,
    epoch u64, curve_type u8, index u16, then eight u64 and the quote mint. */
export function readGlobalConfigQuote(data) {
  const b = Buffer.from(data);
  if (b.subarray(0, 8).toString("hex") !== GLOBAL_CONFIG_DISC) throw new DecodeError("not a LaunchLab GlobalConfig");
  const r = reader(b, 8);
  r.u64(); const curveType = r.u8(); r.u16();
  for (let i = 0; i < 8; i++) r.u64(); // migrate_fee … min_quote_fund_raising
  return { curveType, quoteMint: r.key() };
}

/**
 * Cross-check a proved launch against the chain as it is now: `mintAccount` and `configAccount`
 * are getMultipleAccounts answers (base64) for launch.mint and launch.globalConfig. The mint must
 * be a Token-2022 mint whose own metadata carries the same name and symbol the launch wrote, with
 * LaunchLab's authority as its update authority (so nobody can rename it later; true of all six
 * recorded launches), and the global config must be LaunchLab's, for the stock the launch was
 * priced in. (The builder stops, rather than refuses, when either account is missing: after a
 * finalized launch that can only be the RPC lagging, and the next run reads it again.)
 */
export function checkLaunchAccounts(launch, mintAccount, configAccount) {
  const no = (clause, detail) => ({ ok: false, clause, detail });
  const bytes = (acc) => Buffer.from(acc.data[0], "base64");
  if (!mintAccount || mintAccount.owner !== TOKEN_2022_PROGRAM || !Array.isArray(mintAccount.data)) return no("metadata", "the mint is not a Token-2022 account on chain");
  let meta;
  try { meta = readTokenMetadata(bytes(mintAccount)); } catch (e) { return no("metadata", e.message); }
  if (meta.mint !== launch.mint) return no("metadata", "the mint's metadata names another mint");
  if (meta.updateAuthority !== LAUNCHLAB_AUTHORITY) return no("metadata", "the mint's metadata is not held by LaunchLab");
  if (meta.name !== launch.name || meta.symbol !== launch.symbol) return no("metadata_mismatch", "the mint's metadata does not carry the name and symbol the launch wrote");
  if (!configAccount || configAccount.owner !== LAUNCHLAB_PROGRAM || !Array.isArray(configAccount.data)) return no("global_config", "the global config is not a LaunchLab account on chain");
  let config;
  try { config = readGlobalConfigQuote(bytes(configAccount)); } catch (e) { return no("global_config", e.message); }
  if (config.quoteMint !== launch.pair.mint) return no("global_config", "the global config is for another quote");
  return { ok: true };
}
