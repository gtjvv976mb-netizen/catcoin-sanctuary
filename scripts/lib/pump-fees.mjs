/**
 * THE LAUNCHER'S CREATOR FEES: CLAIMED, CHECKED AND MEASURED. The launcher wallet is the creator of
 * the coins it launches on pump.fun (create_v2 writes the wallet as creator: pump.mjs), so pump.fun
 * pays it a creator fee on every trade of those coins. This module builds the one legacy transaction
 * that claims those fees into the wallet as native SOL, checks such a transaction from its bytes
 * before it is signed, reads how much there is to claim, and measures, from a confirmed
 * transaction, how much SOL a claim actually brought in (so the holders' pot is measured, never
 * assumed). No dependencies (node:crypto through solana-tx.mjs); the only network call is
 * readClaimState, through the RPC client it is given. Nothing here trades: no swap, no buy, no sell.
 *
 * WHERE THE FEES WAIT (pump.fun's IDLs, github.com/pump-fun/pump-public-docs cb188ce0, idl/pump.json
 * and idl/pump_amm.json, and docs/instructions/COLLECT_CREATOR_FEE.md; read 2026-09-30; every
 * address below re-derives in tests/pump-fees.test.mjs):
 *   · on the bonding curve: pump.fun's creator vault PDA["creator-vault", creator] (a hyphen), a
 *     system account with no data, ONE per creator (every coin that names the creator pays into it).
 *     Claimable = its lamports above the rent-exempt minimum of a 0-byte account (650,240 lamports on
 *     2026-09-30; read it, never hardcode it: it was 890,880 before). For the launcher
 *     HxhisqFBeZRJcBWkjnumk6HwWxFLGVVD6jfX23tXHzQh it is 9zbjzqczm7wvzxUiohHxX4xrb6fW6a8fLzt7YGgvtnXN.
 *   · on PumpSwap, once a coin graduates: the wrapped-SOL associated token account of the AMM's
 *     PDA["creator_vault", coin_creator] (an underscore, and the AMM program). It holds WSOL.
 *
 * THE INSTRUCTIONS (all permissionless: none needs the creator's signature, which was verified by
 * simulation on mainnet; here the wallet signs only because it pays the fee and, in the "wsol" route,
 * closes its own WSOL account):
 *   pump.fun collect_creator_fee_v2  cf118af204221338, no arguments, 10 accounts:
 *        0 creator (w)  1 creator_token_account (w) = ATA(creator, Tokenkeg, WSOL)  2 creator_vault (w)
 *        3 creator_vault_token_account (w) = ATA(creator_vault, Tokenkeg, WSOL)  4 quote_mint = WSOL
 *        5 quote_token_program = Tokenkeg  6 ATA program  7 system program  8 event_authority  9 pump.fun
 *      With WSOL as the quote it is a plain lamport transfer creator_vault → creator, leaving the vault
 *      rent-exempt; accounts 1 and 3 are not touched and need not exist. The default (the docs' and
 *      the SDK's current instruction, and the one in the real claim tests/pump-fees.test.mjs replays).
 *   pump.fun collect_creator_fee (legacy) 1416567bc61cdb84, no arguments, 5 accounts:
 *        0 creator (w)  1 creator_vault (w)  2 system program  3 event_authority  4 pump.fun
 *      Same effect for SOL coins (curveVersion 1).
 *   PumpSwap transfer_creator_fees_to_pump 8b348655e4e56cf1, no arguments, 10 accounts:
 *        0 WSOL  1 Tokenkeg  2 system program  3 ATA program  4 coin_creator
 *        5 coin_creator_vault_authority (w)  6 coin_creator_vault_ata (w)  7 pump.fun creator_vault (w)
 *        8 AMM event_authority  9 PumpSwap
 *      Moves the AMM vault's WSOL into the pump.fun creator vault as lamports; a collect after it then
 *      pays both as native SOL (route "sweep"). The AMM vault ATA must exist (else 3012).
 *   PumpSwap collect_coin_creator_fee a039592ab58b2b42, no arguments, 8 accounts:
 *        0 WSOL  1 Tokenkeg  2 coin_creator  3 coin_creator_vault_authority  4 coin_creator_vault_ata (w)
 *        5 coin_creator_token_account (w): an initialized WSOL account of the creator  6 AMM event_authority  7 PumpSwap
 *      Pays WSOL, so route "wsol" wraps it: the Associated Token program's CreateIdempotent ([1]:
 *      funder (ws), ata (w), owner, WSOL, system program, Tokenkeg) for the wallet's own WSOL account
 *      first, and Tokenkeg CloseAccount ([9]: account (w), destination (w), owner (s)) after it, with
 *      the wallet as destination and owner: the account's lamports (its rent back, and the WSOL) come
 *      home as SOL. This is pump.fun's own SDK flow, and the real claim the tests replay.
 *
 * THE TRANSACTION (buildClaimTransaction): legacy, one signer (the wallet, also the fee payer),
 * SetComputeUnitLimit and SetComputeUnitPrice, then exactly one of
 *   curve only   [collect]
 *   "sweep"      [transfer_creator_fees_to_pump, collect]
 *   "wsol"       [collect?, CreateIdempotent(wallet's WSOL ATA)?, collect_coin_creator_fee, CloseAccount(wallet's WSOL ATA → wallet)]
 * and nothing else. checkClaimMessage re-decodes the bytes and refuses anything else instruction by
 * instruction: a program id AND its discriminator (Raydium CPMM's collect_creator_fee has the very
 * same discriminator as pump.fun's), the exact bytes of the data, every account and its signer and
 * writable flags as derived for this wallet, no account the instructions do not use, one signer, and
 * the compute budget (at most MAX_CLAIM_COMPUTE_UNIT_LIMIT units, a priority fee of at most
 * MAX_CLAIM_PRIORITY_FEE_LAMPORTS). So nothing it passes can move the wallet's SOL or tokens anywhere
 * but back to the wallet: the only lamports the wallet can lose are the fee and, within the same
 * transaction, the rent of its own WSOL account, which CloseAccount returns.
 *
 * MEASURING (measureClaim): from a confirmed transaction (getTransaction, encoding json, legacy or
 * v0), the SOL claimed is the SMALLEST of three independent readings, so no single one can inflate
 * the pot:
 *   events      the claim events pump.fun and PumpSwap emit by self-CPI (Anchor's event_cpi: an inner
 *               instruction to the program itself, whose only account is its event_authority PDA,
 *               data e445a52e51cb9a1d + the event), which only the program can sign for. Counted: a
 *               CollectCreatorFeeEvent (7a027f010ebf0caf) whose creator is the wallet and whose quote
 *               is SOL (the zero key or WSOL), and a CollectCoinCreatorFeeEvent (e8f5c2eeeada3a59) whose
 *               coin_creator is the wallet, paid from its AMM vault into the wallet's own WSOL ATA.
 *               A "Program data:" log line is NOT read: any program can print one.
 *   received    what the wallet gained: its lamport change, plus the fee when it paid it, plus the
 *               lamport change of its own WSOL ATA (so WSOL unwrapped by CloseAccount is not counted
 *               twice, and WSOL a third party collected into that account is still counted).
 *   from vaults what left the two vaults: the pump.fun creator vault's and the AMM vault ATA's lamport
 *               decreases.
 * The claim's own fee is reported apart (walletFee) and so is net = claimed − walletFee: whether the
 * pot or the launcher bears the claim's fee is the caller's choice; charging it to the pot (net)
 * keeps the launch reserve whole.
 *
 * LAUNCHLAB / STONKFUN: nothing to claim on chain. See launchLabCreatorFeeClaim (returns null).
 */
import { base58Decode, base58Encode, isAddress } from "../../assets/collection.js";
import { SYSTEM_PROGRAM, TOKEN_PROGRAM, ATA_PROGRAM, COMPUTE_BUDGET_PROGRAM } from "./programs.mjs";
import {
  pda, ata, compileLegacyMessage, decodeLegacyMessage, decompileInstructions, isWritableIndex, setComputeUnitLimit, setComputeUnitPrice,
  signTransaction, serializeTransaction, priorityFeeLamports, MAX_COMPUTE_UNIT_LIMIT, DEFAULT_INSTRUCTION_COMPUTE_UNIT_LIMIT, PACKET_DATA_SIZE,
} from "./solana-tx.mjs";
import { PUMP } from "./pump.mjs";

/** PumpSwap (the Pump AMM), where pump.fun coins trade once they graduate. */
export const PUMP_AMM_PROGRAM = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
/** Wrapped SOL, the classic token program's native mint (every canonical PumpSwap pool's quote). */
export const WSOL_MINT = "So11111111111111111111111111111111111111112";
/** PumpSwap's fixed accounts. The PDA is pinned here and re-derived by the tests. */
export const PUMP_AMM = Object.freeze({
  program: PUMP_AMM_PROGRAM,
  eventAuthority: "GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR", // PDA["__event_authority"] of PumpSwap
});

/** sha256("global:<name>")[0..8] of each claim instruction (the tests recompute them). */
export const CLAIM_DISC = Object.freeze({
  collectCreatorFee: "1416567bc61cdb84",           // pump.fun (legacy, SOL only)
  collectCreatorFeeV2: "cf118af204221338",         // pump.fun
  transferCreatorFeesToPump: "8b348655e4e56cf1",   // PumpSwap
  collectCoinCreatorFee: "a039592ab58b2b42",       // PumpSwap
});
/** Anchor's EVENT_IX_TAG (the u64 0x1d9acb512ea545e4, little-endian): the first 8 bytes of an event self-CPI's data. */
export const EVENT_IX_TAG = "e445a52e51cb9a1d";
/** sha256("event:<Name>")[0..8] of the two claim events. */
export const EVENT_DISC = Object.freeze({
  collectCreatorFee: "7a027f010ebf0caf",     // { timestamp i64, creator, creator_fee u64, quote_mint }
  collectCoinCreatorFee: "e8f5c2eeeada3a59", // { timestamp i64, coin_creator, coin_creator_fee u64, coin_creator_vault_ata, coin_creator_token_account }
});
/** The Associated Token program's CreateIdempotent and the token program's CloseAccount (one-byte data). */
const ATA_CREATE_IDEMPOTENT = 1;
const TOKEN_CLOSE_ACCOUNT = 9;

/** The AMM routes a claim may take besides the bonding-curve vault: "sweep" (native SOL, no token account) or "wsol" (WSOL, unwrapped in the same transaction). */
export const AMM_ROUTES = Object.freeze(["sweep", "wsol"]);
/**
 * Compute-unit limits by route, generous over what was measured on mainnet (2026-09-30): a v1
 * collect used 14,757 units and a v2 collect 19,835 (simulated); "sweep" 52-58k (simulated on
 * graduated coins); the real "wsol" claim the tests replay (v2 + create + collect + close) about 50.5k.
 */
export const CLAIM_COMPUTE_UNITS = Object.freeze({ curve: 40_000, sweep: 120_000, wsol: 120_000 });
/** The claim's defaults: pump.fun's collect_creator_fee_v2, and a modest priority (a claim is not urgent). */
export const CLAIM_DEFAULTS = Object.freeze({ curveVersion: 2, computeUnitPriceMicroLamports: 50_000 });
/** The most compute units a claim may ask for. */
export const MAX_CLAIM_COMPUTE_UNIT_LIMIT = 300_000;
/** The most a claim may bid in priority fees (limit × price), in lamports: 0.0001 SOL. A guard against a slipped digit. */
export const MAX_CLAIM_PRIORITY_FEE_LAMPORTS = 100_000n;
/** Below this many claimable lamports, claimPlan proposes no claim (a claim costs 5,000 lamports plus its priority fee). */
export const MIN_CLAIM_LAMPORTS = 1_000_000n;

const address = (value, what) => {
  const a = typeof value === "string" ? value : value?.publicKey; // an address, or a keypair
  if (!isAddress(a)) throw new TypeError(`${what} is not a base58 address`);
  return a;
};
const meta = (pubkey, isWritable = false, isSigner = false) => ({ pubkey, isSigner, isWritable });
const hexBytes = (hex) => new Uint8Array(Buffer.from(hex, "hex"));
const max0 = (n) => (n > 0n ? n : 0n);

/* ── the PDAs ────────────────────────────────────────────────────────────────────────── */

/** A derived address, remembered (measuring a wallet's transactions derives the same few for every one of them). */
const DERIVED = new Map();
const derived = (kind, key, derive) => {
  const k = `${kind}:${key}`;
  let v = DERIVED.get(k);
  if (v === undefined) { v = derive(); if (DERIVED.size > 10_000) DERIVED.clear(); DERIVED.set(k, v); }
  return v;
};
/** pump.fun's creator vault of `creator`: PDA["creator-vault", creator] (a hyphen) of pump.fun. */
export const creatorVault = (creator) => { const c = address(creator, "the creator"); return derived("vault", c, () => pda(["utf8:creator-vault", c], PUMP.program)); };
/** The creator vault's WSOL associated token account (collect_creator_fee_v2's account 3; unused for SOL coins). */
export const creatorVaultWsolAta = (creator) => ata(creatorVault(creator), WSOL_MINT, TOKEN_PROGRAM);
/** PumpSwap's coin_creator_vault_authority of `coinCreator`: PDA["creator_vault", coin_creator] (an underscore) of PumpSwap. */
export const ammCreatorVaultAuthority = (coinCreator) => { const c = address(coinCreator, "the coin creator"); return derived("ammAuthority", c, () => pda(["utf8:creator_vault", c], PUMP_AMM.program)); };
/** PumpSwap's coin_creator_vault_ata: the WSOL associated token account of that authority, where AMM creator fees wait. */
export const ammCreatorVaultAta = (coinCreator) => { const c = address(coinCreator, "the coin creator"); return derived("ammAta", c, () => ata(ammCreatorVaultAuthority(c), WSOL_MINT, TOKEN_PROGRAM)); };
/** `owner`'s own WSOL associated token account (classic token program). */
export const wsolAta = (owner) => { const o = address(owner, "the owner"); return derived("wsol", o, () => ata(o, WSOL_MINT, TOKEN_PROGRAM)); };

/* ── the instructions ────────────────────────────────────────────────────────────────── */

/**
 * The account metas of pump.fun's creator-fee collect for `creator`, as the IDL lists them: version
 * 2 (collect_creator_fee_v2, 10 accounts, WSOL as the quote) or 1 (collect_creator_fee, 5).
 * The creator is writable and not a signer (the instruction is permissionless).
 */
export function collectCreatorFeeAccounts(creator, version = CLAIM_DEFAULTS.curveVersion) {
  creator = address(creator, "the creator");
  const vault = creatorVault(creator);
  if (version === 1) return [meta(creator, true), meta(vault, true), meta(SYSTEM_PROGRAM), meta(PUMP.eventAuthority), meta(PUMP.program)];
  if (version !== 2) throw new TypeError("collect_creator_fee is version 1 or 2");
  return [
    meta(creator, true), meta(wsolAta(creator), true), meta(vault, true), meta(creatorVaultWsolAta(creator), true),
    meta(WSOL_MINT), meta(TOKEN_PROGRAM), meta(ATA_PROGRAM), meta(SYSTEM_PROGRAM), meta(PUMP.eventAuthority), meta(PUMP.program),
  ];
}

/** pump.fun's creator-fee collect for `creator` (version 2 by default, or 1): { programId, keys, data }. Pays the vault's lamports above rent to the creator. */
export function collectCreatorFeeInstruction({ creator, version = CLAIM_DEFAULTS.curveVersion } = {}) {
  const keys = collectCreatorFeeAccounts(creator, version);
  return { programId: PUMP.program, keys, data: hexBytes(version === 1 ? CLAIM_DISC.collectCreatorFee : CLAIM_DISC.collectCreatorFeeV2) };
}

/** PumpSwap's transfer_creator_fees_to_pump for `coinCreator`: the AMM vault's WSOL into pump.fun's creator vault, as lamports. */
export function transferCreatorFeesToPumpInstruction({ coinCreator } = {}) {
  coinCreator = address(coinCreator, "the coin creator");
  return {
    programId: PUMP_AMM.program,
    keys: [
      meta(WSOL_MINT), meta(TOKEN_PROGRAM), meta(SYSTEM_PROGRAM), meta(ATA_PROGRAM), meta(coinCreator),
      meta(ammCreatorVaultAuthority(coinCreator), true), meta(ammCreatorVaultAta(coinCreator), true), meta(creatorVault(coinCreator), true),
      meta(PUMP_AMM.eventAuthority), meta(PUMP_AMM.program),
    ],
    data: hexBytes(CLAIM_DISC.transferCreatorFeesToPump),
  };
}

/** PumpSwap's collect_coin_creator_fee for `coinCreator`, paid into the coin creator's own WSOL associated token account (which must exist by then). */
export function collectCoinCreatorFeeInstruction({ coinCreator } = {}) {
  coinCreator = address(coinCreator, "the coin creator");
  return {
    programId: PUMP_AMM.program,
    keys: [
      meta(WSOL_MINT), meta(TOKEN_PROGRAM), meta(coinCreator), meta(ammCreatorVaultAuthority(coinCreator)),
      meta(ammCreatorVaultAta(coinCreator), true), meta(wsolAta(coinCreator), true), meta(PUMP_AMM.eventAuthority), meta(PUMP_AMM.program),
    ],
    data: hexBytes(CLAIM_DISC.collectCoinCreatorFee),
  };
}

/** The Associated Token program's CreateIdempotent of `owner`'s own WSOL account, funded by `owner` (a no-op when it exists). */
export function createWsolAtaIdempotentInstruction({ owner } = {}) {
  owner = address(owner, "the owner");
  return {
    programId: ATA_PROGRAM,
    keys: [meta(owner, true, true), meta(wsolAta(owner), true), meta(owner), meta(WSOL_MINT), meta(SYSTEM_PROGRAM), meta(TOKEN_PROGRAM)],
    data: Uint8Array.of(ATA_CREATE_IDEMPOTENT),
  };
}

/** Tokenkeg CloseAccount of `owner`'s own WSOL account, its lamports (rent and WSOL: the unwrap) to `owner`, signed by `owner`. */
export function closeWsolAtaInstruction({ owner } = {}) {
  owner = address(owner, "the owner");
  return { programId: TOKEN_PROGRAM, keys: [meta(wsolAta(owner), true), meta(owner, true), meta(owner, false, true)], data: Uint8Array.of(TOKEN_CLOSE_ACCOUNT) };
}

/**
 * The claim instructions for `wallet` (as creator), without the compute budget, in the order the
 * header gives: `curve` (the bonding-curve vault, true by default), `amm` (null, "sweep" or "wsol"),
 * `createWsolAta` (route "wsol" only: create the wallet's WSOL account first; true by default,
 * harmless when it exists), `curveVersion` (2 or 1). "sweep" always collects the curve vault too
 * (that is where it moves the AMM fees). Throws on a claim that claims nothing.
 */
export function claimInstructions({ wallet, curve = true, amm = null, createWsolAta = true, curveVersion = CLAIM_DEFAULTS.curveVersion } = {}) {
  wallet = address(wallet, "the wallet");
  if (typeof curve !== "boolean" || typeof createWsolAta !== "boolean") throw new TypeError("curve and createWsolAta are true or false");
  if (amm !== null && !AMM_ROUTES.includes(amm)) throw new TypeError(`amm is null, "sweep" or "wsol"`);
  if (amm === "sweep" && !curve) throw new Error('the "sweep" route moves the AMM fees into the curve vault, so it collects the curve vault too');
  if (amm === null && !curve) throw new Error("a claim claims something: the bonding-curve vault, the AMM vault, or both");
  const collect = curve ? [collectCreatorFeeInstruction({ creator: wallet, version: curveVersion })] : [];
  if (amm === "sweep") return [transferCreatorFeesToPumpInstruction({ coinCreator: wallet }), ...collect];
  if (amm === "wsol") {
    return [
      ...collect,
      ...(createWsolAta ? [createWsolAtaIdempotentInstruction({ owner: wallet })] : []),
      collectCoinCreatorFeeInstruction({ coinCreator: wallet }),
      closeWsolAtaInstruction({ owner: wallet }),
    ];
  }
  return collect;
}

/* ── the transaction ─────────────────────────────────────────────────────────────────── */

const priceOf = (p) => (typeof p === "bigint" ? p : Number.isSafeInteger(p) ? BigInt(p) : -1n);

/**
 * Build the claim: a legacy transaction paid and signed by `wallet` (the creator; an address or a
 * keypair, only the public key is read) holding SetComputeUnitLimit, SetComputeUnitPrice and
 * claimInstructions({ wallet, curve, amm, createWsolAta, curveVersion }), and nothing else. The
 * compute-unit limit defaults to CLAIM_COMPUTE_UNITS for the route. Returns a frozen
 * { messageBytes, signers ([wallet]), instructions, wallet, shape (checkClaimMessage's answer),
 * message }. Throws on anything checkClaimMessage or the fee guard refuses.
 */
export function buildClaimTransaction({
  wallet, recentBlockhash, curve = true, amm = null, createWsolAta = true, curveVersion = CLAIM_DEFAULTS.curveVersion,
  computeUnitLimit, computeUnitPriceMicroLamports = CLAIM_DEFAULTS.computeUnitPriceMicroLamports,
} = {}) {
  wallet = address(wallet, "the wallet");
  const claims = claimInstructions({ wallet, curve, amm, createWsolAta, curveVersion }); // the route is checked before its defaults are read
  computeUnitLimit ??= CLAIM_COMPUTE_UNITS[amm ?? "curve"];
  if (!Number.isInteger(computeUnitLimit) || computeUnitLimit < 1 || computeUnitLimit > MAX_CLAIM_COMPUTE_UNIT_LIMIT) {
    throw new RangeError(`a claim's compute-unit limit is 1..${MAX_CLAIM_COMPUTE_UNIT_LIMIT}`);
  }
  const price = priceOf(computeUnitPriceMicroLamports);
  if (price < 0n) throw new RangeError("a compute-unit price is a whole number of micro-lamports, 0 or more");
  const priorityFee = priorityFeeLamports(computeUnitLimit, price);
  if (priorityFee > MAX_CLAIM_PRIORITY_FEE_LAMPORTS) {
    throw new RangeError(`a priority fee of ${priorityFee} lamports is more than the ${MAX_CLAIM_PRIORITY_FEE_LAMPORTS} a claim allows`);
  }
  const instructions = [setComputeUnitLimit(computeUnitLimit), setComputeUnitPrice(price), ...claims];
  const message = compileLegacyMessage({ payer: wallet, recentBlockhash, instructions });
  const shape = checkClaimMessage(message.bytes, { wallet });
  return Object.freeze({ messageBytes: message.bytes, signers: [wallet], instructions, wallet, shape, message });
}

/** What a non-budget instruction of a claim is, by program id AND data (never the discriminator alone), or throws. */
function claimKind(ix) {
  const hex = Buffer.from(ix.data).toString("hex");
  if (ix.programId === PUMP.program && hex === CLAIM_DISC.collectCreatorFeeV2) return "curve2";
  if (ix.programId === PUMP.program && hex === CLAIM_DISC.collectCreatorFee) return "curve1";
  if (ix.programId === PUMP_AMM.program && hex === CLAIM_DISC.transferCreatorFeesToPump) return "toPump";
  if (ix.programId === PUMP_AMM.program && hex === CLAIM_DISC.collectCoinCreatorFee) return "ammCollect";
  if (ix.programId === ATA_PROGRAM && hex === "01") return "createAta";
  if (ix.programId === TOKEN_PROGRAM && hex === "09") return "close";
  throw new Error(`an instruction for ${ix.programId} (data ${hex.slice(0, 16)}${hex.length > 16 ? "…" : ""}) that a claim does not carry`);
}

/** The claim a sequence of kinds is: { curve, curveVersion, amm, createWsolAta }, or throws. */
function claimShape(kinds) {
  const k = [...kinds];
  const curveVersion = k.includes("curve1") ? 1 : 2;
  const takeCurve = () => (k[0] === "curve1" || k[0] === "curve2" ? (k.shift(), true) : false);
  let shape = null;
  if (k[0] === "toPump") {
    k.shift();
    if (takeCurve() && k.length === 0) shape = { curve: true, curveVersion, amm: "sweep", createWsolAta: false };
  } else {
    const curve = takeCurve();
    if (k.length === 0 && curve) shape = { curve, curveVersion, amm: null, createWsolAta: false };
    else {
      const createWsolAta = k[0] === "createAta" ? (k.shift(), true) : false;
      if (k.length === 2 && k[0] === "ammCollect" && k[1] === "close") shape = { curve, curveVersion: curve ? curveVersion : CLAIM_DEFAULTS.curveVersion, amm: "wsol", createWsolAta };
    }
  }
  if (!shape) throw new Error(`the instructions [${kinds.join(", ")}] are not a claim this module builds`);
  return shape;
}

/**
 * Check, from the bytes alone, that a message is a claim this module would build for `wallet`: one
 * signer, the wallet, who pays; at most one SetComputeUnitLimit and one SetComputeUnitPrice (no
 * accounts, the 5- and 9-byte forms), a limit of 1..MAX_CLAIM_COMPUTE_UNIT_LIMIT and a priority fee
 * of at most MAX_CLAIM_PRIORITY_FEE_LAMPORTS (with no limit, 200,000 units per instruction are
 * assumed, as the runtime grants); then exactly one of the claim shapes in the header, each
 * instruction equal, program id, data bytes, accounts and each account's signer and writable flags,
 * to the one claimInstructions derives for this wallet; no program id writable; no account key the
 * instructions do not use; at most PACKET_DATA_SIZE bytes once signed. Returns a frozen
 * { curve, curveVersion, amm, createWsolAta, computeUnitLimit, computeUnitPriceMicroLamports,
 * priorityFee }; throws with the reason otherwise.
 */
export function checkClaimMessage(messageBytes, { wallet } = {}) {
  if (!isAddress(wallet)) throw new TypeError("the wallet is not a base58 address");
  const msg = decodeLegacyMessage(messageBytes);
  if (msg.header.numRequiredSignatures !== 1 || msg.accountKeys[0] !== wallet) throw new Error("the one signer and fee payer is not the wallet");
  const size = 1 + 64 + messageBytes.length;
  if (size > PACKET_DATA_SIZE) throw new RangeError(`the claim would be ${size} bytes; Solana takes at most ${PACKET_DATA_SIZE}`);
  const all = decompileInstructions(msg);
  let limit = null, price = null;
  const claims = [];
  for (const ix of all) {
    const d = Buffer.from(ix.data);
    const budget = ix.programId === COMPUTE_BUDGET_PROGRAM && ix.keys.length === 0;
    if (budget && d[0] === 2 && d.length === 5) {
      if (limit !== null) throw new Error("more than one compute-budget instruction of a kind");
      limit = d.readUInt32LE(1);
    } else if (budget && d[0] === 3 && d.length === 9) {
      if (price !== null) throw new Error("more than one compute-budget instruction of a kind");
      price = d.readBigUInt64LE(1);
    } else {
      claims.push(ix);
    }
  }
  if (limit !== null && (limit < 1 || limit > MAX_CLAIM_COMPUTE_UNIT_LIMIT)) throw new Error(`a compute-unit limit of ${limit}; a claim asks for 1..${MAX_CLAIM_COMPUTE_UNIT_LIMIT}`);
  const units = limit ?? Math.min(MAX_COMPUTE_UNIT_LIMIT, DEFAULT_INSTRUCTION_COMPUTE_UNIT_LIMIT * msg.instructions.length);
  const priorityFee = priorityFeeLamports(units, price ?? 0n);
  if (priorityFee > MAX_CLAIM_PRIORITY_FEE_LAMPORTS) {
    throw new Error(`a priority fee of ${priorityFee} lamports is more than the ${MAX_CLAIM_PRIORITY_FEE_LAMPORTS} a claim allows`);
  }

  const shape = claimShape(claims.map(claimKind));
  const want = claimInstructions({ wallet, ...shape });
  const writable = new Set([wallet]);
  for (const ix of want) for (const k of ix.keys) if (k.isWritable) writable.add(k.pubkey);
  claims.forEach((ix, n) => {
    const w = want[n];
    if (ix.programId !== w.programId || Buffer.compare(Buffer.from(ix.data), Buffer.from(w.data)) !== 0) throw new Error(`instruction ${n + 1} of the claim is not the one derived for this wallet`);
    if (ix.keys.length !== w.keys.length) throw new Error(`${ix.programId}'s instruction has ${ix.keys.length} accounts; the claim's has ${w.keys.length}`);
    ix.keys.forEach((k, i) => {
      if (k.pubkey !== w.keys[i].pubkey) throw new Error(`account ${i} of ${claimKind(ix)} is not the one derived for this wallet`);
      if (k.isSigner !== (k.pubkey === wallet)) throw new Error(`account ${i} of ${claimKind(ix)} signs; only the wallet may`);
      if (k.isWritable !== writable.has(k.pubkey)) throw new Error(`account ${i} of ${claimKind(ix)} is ${k.isWritable ? "writable" : "read-only"}; the claim has it ${k.isWritable ? "read-only" : "writable"}`);
    });
  });
  const used = new Set([wallet]);
  for (const ix of all) {
    const p = msg.accountKeys.indexOf(ix.programId);
    if (isWritableIndex(msg.header, msg.accountKeys.length, p)) throw new Error(`the program ${ix.programId} is writable`);
    used.add(ix.programId);
    for (const k of ix.keys) used.add(k.pubkey);
  }
  const stray = msg.accountKeys.find((k) => !used.has(k));
  if (stray) throw new Error(`the account ${stray} is in the message but in no instruction`);
  return Object.freeze({ ...shape, computeUnitLimit: limit, computeUnitPriceMicroLamports: price, priorityFee });
}

/**
 * Sign a built claim with the wallet's keypair and return the serialized transaction, base64. The
 * message is copied once and that copy is re-checked from its bytes (checkClaimMessage, the fee
 * guard included), signed and serialized, so bytes that are not a plain claim are never signed.
 */
export function signClaimTransaction(built, walletKeypair) {
  if (!built || !(built.messageBytes instanceof Uint8Array)) throw new TypeError("signClaimTransaction takes what buildClaimTransaction returned");
  if (walletKeypair?.publicKey !== built.wallet) throw new Error("the keypair is not the claim's wallet");
  const messageBytes = Uint8Array.from(built.messageBytes);
  checkClaimMessage(messageBytes, { wallet: built.wallet });
  const signatures = signTransaction(messageBytes, [walletKeypair]);
  return Buffer.from(serializeTransaction(messageBytes, signatures)).toString("base64");
}

/** The same claim UNSIGNED (its signature slot zero-filled) after the same checks, base64: what is simulated (sigVerify false) before anything is signed. */
export function unsignedClaimTransaction(built) {
  if (!built || !(built.messageBytes instanceof Uint8Array)) throw new TypeError("unsignedClaimTransaction takes what buildClaimTransaction returned");
  const messageBytes = Uint8Array.from(built.messageBytes);
  checkClaimMessage(messageBytes, { wallet: built.wallet });
  return Buffer.from(serializeTransaction(messageBytes, [new Uint8Array(64)])).toString("base64");
}

/* ── how much waits to be claimed ────────────────────────────────────────────────────── */

const accountBytes = (account) => {
  if (!Array.isArray(account?.data) || typeof account.data[0] !== "string") throw new TypeError("an account's data is not [base64, \"base64\"]");
  return Buffer.from(account.data[0], "base64");
};
const lamportsOf = (account) => {
  const l = account?.lamports;
  if (!(Number.isSafeInteger(l) && l >= 0) && !(typeof l === "bigint" && l >= 0n)) throw new TypeError("an account's lamports are not a whole number");
  return BigInt(l);
};

/**
 * The lamports claimable from pump.fun's creator vault: `account` (a getMultipleAccounts answer,
 * base64; null when it does not exist) above `rentExemptMinimum` (getMinimumBalanceForRentExemption(0)),
 * as a BigInt, never below 0. The vault must be what pump.fun makes it: a system account with no data.
 */
export function creatorVaultClaimable(account, rentExemptMinimum) {
  const rent = typeof rentExemptMinimum === "bigint" ? rentExemptMinimum : Number.isSafeInteger(rentExemptMinimum) ? BigInt(rentExemptMinimum) : -1n;
  if (rent < 0n) throw new TypeError("the rent-exempt minimum is a whole number of lamports");
  if (account === null || account === undefined) return 0n;
  if (account.owner !== SYSTEM_PROGRAM || accountBytes(account).length !== 0) throw new Error("the creator vault is not a system account with no data");
  return max0(lamportsOf(account) - rent);
}

/**
 * The WSOL claimable from PumpSwap's coin_creator_vault_ata of `coinCreator` (a getMultipleAccounts
 * answer, base64; null when it does not exist: the creator has no graduated coin yet): the token
 * amount, as a BigInt. The account must be an initialized classic-token account for WSOL owned by
 * the vault authority.
 */
export function ammVaultClaimable(account, coinCreator) {
  if (account === null || account === undefined) return 0n;
  const d = accountBytes(account);
  if (account.owner !== TOKEN_PROGRAM || d.length < 165) throw new Error("the AMM creator vault is not a token account");
  if (base58Encode(d.subarray(0, 32)) !== WSOL_MINT || base58Encode(d.subarray(32, 64)) !== ammCreatorVaultAuthority(coinCreator) || d[108] !== 1) {
    throw new Error("the AMM creator vault is not an initialized WSOL account of the coin creator's vault authority");
  }
  return d.readBigUInt64LE(64);
}

/**
 * The WSOL in `wallet`'s own WSOL account (a getMultipleAccounts answer, base64): its token amount
 * (u64LE at 64) when the account is an initialized classic-token account for WSOL owned by `wallet`,
 * else null (it does not exist, or it is something else, such as plain SOL someone sent to its
 * address). Never its lamports less today's rent: an account keeps the rent of the day it was made.
 */
export function walletWsolAmount(account, wallet) {
  if (account === null || account === undefined) return null;
  let d;
  try { d = accountBytes(account); } catch { return null; }
  if (account.owner !== TOKEN_PROGRAM || d.length < 165 || d[108] !== 1) return null;
  if (base58Encode(d.subarray(0, 32)) !== WSOL_MINT || base58Encode(d.subarray(32, 64)) !== wallet) return null;
  return d.readBigUInt64LE(64);
}

/**
 * Read what `wallet` (a creator) can claim, through `rpc` (scripts/lib/rpc.mjs createRpc, or anything
 * with getMultipleAccounts and call): { wallet, creatorVault, rentExemptMinimum, curveClaimable,
 * ammVaultAta, ammVaultExists, ammClaimable, walletWsolAta, walletWsolAtaExists, walletWsolAmount
 * (walletWsolAmount: WSOL waiting in the wallet's own WSOL account, or null), total } (lamports as
 * BigInts). Two calls: getMultipleAccounts and getMinimumBalanceForRentExemption(0).
 */
export async function readClaimState(rpc, { wallet } = {}) {
  wallet = address(wallet, "the wallet");
  const vault = creatorVault(wallet), ammAta = ammCreatorVaultAta(wallet), own = wsolAta(wallet);
  const accounts = await rpc.getMultipleAccounts([vault, ammAta, own]);
  if (!Array.isArray(accounts) || accounts.length !== 3) throw new Error("getMultipleAccounts did not answer for the three accounts");
  const rent = await rpc.call("getMinimumBalanceForRentExemption", [0]);
  if (!Number.isSafeInteger(rent) || rent < 0) throw new Error("getMinimumBalanceForRentExemption did not answer with a number");
  const curveClaimable = creatorVaultClaimable(accounts[0], rent);
  const ammClaimable = ammVaultClaimable(accounts[1], wallet);
  return Object.freeze({
    wallet, creatorVault: vault, rentExemptMinimum: BigInt(rent), curveClaimable,
    ammVaultAta: ammAta, ammVaultExists: accounts[1] != null, ammClaimable,
    walletWsolAta: own, walletWsolAtaExists: accounts[2] != null, walletWsolAmount: walletWsolAmount(accounts[2], wallet),
    total: curveClaimable + ammClaimable,
  });
}

/**
 * The claim to make from a readClaimState answer: null when less than `minLamports` waits, else
 * buildClaimTransaction's options { curve: true, amm, createWsolAta: false } with amm "sweep"
 * (all native SOL, no token account) when the AMM vault holds WSOL, null otherwise.
 */
export function claimPlan(state, { minLamports = MIN_CLAIM_LAMPORTS } = {}) {
  if (!state || typeof state.total !== "bigint") throw new TypeError("claimPlan takes what readClaimState returned");
  if (state.total < BigInt(minLamports)) return null;
  return Object.freeze({ curve: true, amm: state.ammVaultExists && state.ammClaimable > 0n ? "sweep" : null, createWsolAta: false });
}

/* ── how much a confirmed claim brought in ───────────────────────────────────────────── */

/** The account keys of a getTransaction answer (encoding json): the static keys, then the loaded writable, then the loaded readonly. */
function transactionKeys(tx) {
  const msg = tx?.transaction?.message;
  if (!msg || !Array.isArray(msg.accountKeys) || !msg.accountKeys.every(isAddress)) throw new TypeError("not a json-encoded transaction");
  const loaded = tx.meta?.loadedAddresses ?? {};
  const keys = [...msg.accountKeys, ...(loaded.writable ?? []), ...(loaded.readonly ?? [])];
  if (!keys.every(isAddress)) throw new TypeError("a loaded account key is not an address");
  return keys;
}

const u64At = (d, o) => d.readBigUInt64LE(o);
const keyAt = (d, o) => base58Encode(d.subarray(o, o + 32));

/**
 * The creator-fee claim events in a confirmed transaction (a getTransaction answer, encoding json),
 * read only from the programs' own event self-CPIs (inner instructions to pump.fun or PumpSwap whose
 * one account is that program's event_authority and whose data is EVENT_IX_TAG + the event). Each is
 * { program: "pump" | "pump-amm", creator, amount (BigInt lamports), timestamp, forWallet } plus
 * quoteMint (pump) or vaultAta and tokenAccount (pump-amm). forWallet: it paid `wallet` in SOL (see
 * the header). A transaction the chain failed has none.
 */
export function readClaimEvents(tx, { wallet } = {}) {
  if (!isAddress(wallet)) throw new TypeError("the wallet is not a base58 address");
  if (!tx?.meta) throw new TypeError("no transaction, or no status");
  if (tx.meta.err !== null && tx.meta.err !== undefined) return [];
  const keys = transactionKeys(tx);
  const events = [];
  for (const group of tx.meta.innerInstructions ?? []) {
    for (const ix of group?.instructions ?? []) {
      const program = keys[ix?.programIdIndex];
      if (program !== PUMP.program && program !== PUMP_AMM.program) continue;
      const eventAuthority = program === PUMP.program ? PUMP.eventAuthority : PUMP_AMM.eventAuthority;
      if (!Array.isArray(ix.accounts) || ix.accounts.length !== 1 || keys[ix.accounts[0]] !== eventAuthority) continue;
      const raw = typeof ix.data === "string" && ix.data !== "" ? base58Decode(ix.data, 2000) : null;
      if (!raw) continue;
      const d = Buffer.from(raw);
      if (d.length < 16 || d.subarray(0, 8).toString("hex") !== EVENT_IX_TAG) continue;
      const disc = d.subarray(8, 16).toString("hex");
      if (program === PUMP.program && disc === EVENT_DISC.collectCreatorFee && d.length >= 16 + 80) {
        const e = { program: "pump", timestamp: d.readBigInt64LE(16), creator: keyAt(d, 24), amount: u64At(d, 56), quoteMint: keyAt(d, 64) };
        e.forWallet = e.creator === wallet && (e.quoteMint === SYSTEM_PROGRAM || e.quoteMint === WSOL_MINT);
        events.push(Object.freeze(e));
      } else if (program === PUMP_AMM.program && disc === EVENT_DISC.collectCoinCreatorFee && d.length >= 16 + 112) {
        const e = { program: "pump-amm", timestamp: d.readBigInt64LE(16), creator: keyAt(d, 24), amount: u64At(d, 56), vaultAta: keyAt(d, 64), tokenAccount: keyAt(d, 96) };
        e.forWallet = e.creator === wallet && e.vaultAta === ammCreatorVaultAta(wallet) && e.tokenAccount === wsolAta(wallet);
        events.push(Object.freeze(e));
      }
    }
  }
  return events;
}

/**
 * The SOL a confirmed transaction (a getTransaction answer, encoding json, legacy or v0) claimed for
 * `wallet`: the smallest of the events, what the wallet received and what left its vaults (see the
 * header). Returns a frozen { signature, slot, blockTime, failed, feePayer, fee, walletFee (the fee,
 * when the wallet paid it, else 0), events (this wallet's), eventTotal, received, fromVaults,
 * claimed, net (claimed − walletFee), wsolAtaLamportsAfter (the wallet's WSOL account's lamports after
 * the transaction when the transaction names it, else null), wsolAfter (the WSOL token amount left in
 * that account after it, from meta.postTokenBalances, else null: above 0, part of the claim is still
 * WSOL there) }, lamports as BigInts. A transaction that failed on chain claimed 0 (its fee is still
 * reported). Throws on an answer it cannot read.
 */
export function measureClaim(tx, { wallet } = {}) {
  if (!isAddress(wallet)) throw new TypeError("the wallet is not a base58 address");
  if (!tx || typeof tx !== "object" || !tx.meta) throw new TypeError("no transaction, or no status");
  if (tx.version !== undefined && tx.version !== "legacy" && tx.version !== 0) throw new TypeError(`transaction version ${JSON.stringify(tx.version)}`);
  const keys = transactionKeys(tx);
  const { preBalances, postBalances } = tx.meta;
  const whole = (a) => Array.isArray(a) && a.length === keys.length && a.every((n) => Number.isSafeInteger(n) && n >= 0);
  if (!whole(preBalances) || !whole(postBalances)) throw new TypeError("the balances do not match the transaction's accounts");
  if (!Number.isSafeInteger(tx.meta.fee) || tx.meta.fee < 0) throw new TypeError("the fee is not a whole number");
  const feePayer = keys[0];
  const fee = BigInt(tx.meta.fee);
  const walletFee = feePayer === wallet ? fee : 0n;
  const failed = tx.meta.err !== null && tx.meta.err !== undefined;
  const at = (a) => keys.indexOf(a);
  const delta = (a) => (at(a) < 0 ? 0n : BigInt(postBalances[at(a)]) - BigInt(preBalances[at(a)]));
  const ownWsol = wsolAta(wallet);
  const postWsol = at(ownWsol) < 0 ? null : (tx.meta.postTokenBalances ?? []).find((b) => b?.accountIndex === at(ownWsol) && b?.mint === WSOL_MINT);
  const wsolAmount = postWsol?.uiTokenAmount?.amount;
  const base = {
    signature: tx.transaction?.signatures?.[0] ?? null, slot: tx.slot ?? null, blockTime: tx.blockTime ?? null,
    failed, feePayer, fee, walletFee, wsolAtaLamportsAfter: at(ownWsol) < 0 ? null : BigInt(postBalances[at(ownWsol)]),
    wsolAfter: typeof wsolAmount === "string" && /^\d{1,20}$/.test(wsolAmount) ? BigInt(wsolAmount) : null,
  };
  if (failed) return Object.freeze({ ...base, events: [], eventTotal: 0n, received: 0n, fromVaults: 0n, claimed: 0n, net: -walletFee });
  const events = readClaimEvents(tx, { wallet }).filter((e) => e.forWallet);
  const eventTotal = events.reduce((s, e) => s + e.amount, 0n);
  const received = max0(delta(wallet) + walletFee + delta(ownWsol));
  const fromVaults = max0(-delta(creatorVault(wallet))) + max0(-delta(ammCreatorVaultAta(wallet)));
  const claimed = [eventTotal, received, fromVaults].reduce((a, b) => (b < a ? b : a));
  return Object.freeze({ ...base, events, eventTotal, received, fromVaults, claimed, net: claimed - walletFee });
}

/* ── Raydium LaunchLab (StonkFun) ────────────────────────────────────────────────────── */

/**
 * TODO(LaunchLab): no creator fee to claim, so this returns null (and nothing here builds one).
 * LaunchLab's own claim_creator_fee (1a618acb84ab8dfc: creator (ws, the creator MUST sign),
 * fee_vault_authority PDA["creator_fee_vault_auth_seed"], creator_fee_vault PDA[creator, quote_mint]
 * (w), recipient = ATA(creator, token_program, quote_mint) (w), quote_mint, token_program, system
 * program, ATA program; read from the on-chain IDL, raydium_launchpad 0.2.0) pays QUOTE TOKENS (the
 * xStock pairs), not SOL, and on 2026-09-30:
 *   · StonkFun's PlatformConfig 4E876q… sets creator_fee_rate = 0, and none of the 186 possible
 *     creator_fee_vaults (launcher and owner × 93 stock pairs) exists (a simulated claim fails 3012);
 *   · after graduation, the Raydium CPMM pool's creator fee goes to StonkFun's own wallet
 *     5CEbueQnq1Ym2uSSx2xXds3jQAqT1BDnkA59RZobSPAG (pool_creator), not to the coin's creator;
 *   · StonkFun says it forwards the creator's share off chain; which token, when and from where is
 *     unverified.
 * Turning xStock tokens into SOL for the holders would need a swap, which the launcher never makes.
 * If StonkFun ever pays a creator fee on chain, build it here, keep it out of the SOL pot unless it
 * pays SOL, and allowlist it in checkClaimMessage by program id and discriminator together.
 */
export function launchLabCreatorFeeClaim() {
  return null;
}
