/**
 * A pump.fun coin's creator fees pointed, for good, at one recipient: pump.fun's Fees Program
 * (pfeeUx…), create_fee_sharing_config then update_fee_shares, in one transaction the coin's
 * creator signs right after its launch. The owner's rule (2026-10-02): a new coin's fees go to the
 * X account its lore came from, through UsePaid (usepaid.app), which reads the handle from the
 * coin's description ("Fees to @handle via UsePaid") and pays that account.
 *
 * The layout is the one pump.fun's own app sends (pump-fun/pump-public-docs, idl/pump_fees.json and
 * docs/instructions/CREATOR_FEE_SHARING.md, read 2026-10-02) and was checked byte for byte against a
 * UsePaid coin's real transaction (Mars3D, AoGw7mp6…, 2026-10-01: 3saF9Xnw…):
 *   SetComputeUnitLimit, SetComputeUnitPrice,
 *   create_fee_sharing_config (no data; the optional pool, AMM program and AMM event authority of a
 *     coin that has not graduated are passed as the Fees Program itself, Anchor's "none"),
 *   update_fee_shares ([{ address: recipient, share_bps: 10000 }]; the current shareholders, the
 *     creator alone, follow as remaining accounts). It revokes the config's admin: no one can change
 *     the shares again.
 * UsePaid's recipient, FfLpuH4…HGpv, is the shareholder of every UsePaid coin read on chain
 * (parafactual, Mars3D and seven others, 2026-10-02): a Fees Program social fee account
 * (["social-fee-pda", "322216527", 2]: UsePaid's GitHub account) that UsePaid claims.
 */
import { createHash } from "node:crypto";
import { isAddress, base58Decode as base58, base58Encode as base58enc } from "../../assets/collection.js";
import { PUMPFUN_PROGRAM, SYSTEM_PROGRAM, TOKEN_PROGRAM, ATA_PROGRAM, COMPUTE_BUDGET_PROGRAM } from "./programs.mjs";
import {
  pda, ata, compileLegacyMessage, decodeLegacyMessage, decompileInstructions, setComputeUnitLimit, setComputeUnitPrice,
  signTransaction, serializeTransaction, priorityFeeLamports, MAX_COMPUTE_UNIT_LIMIT, PACKET_DATA_SIZE,
} from "./solana-tx.mjs";
import { PUMP, bondingCurve } from "./pump.mjs";

export const PUMP_FEES = Object.freeze({
  program: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ",
  eventAuthority: "D6QxXDt6hhcCpto4HiZKkN2YQ2iZRF5R7S3caCHpUsML",  // PDA["__event_authority"] of the Fees Program
});
export const PUMP_AMM = Object.freeze({
  program: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
  eventAuthority: "GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR",  // PDA["__event_authority"] of the AMM
});
export const WSOL_MINT = "So11111111111111111111111111111111111111112";
/** UsePaid's recipient: the one shareholder of every UsePaid coin read on chain (see above). */
export const USEPAID_RECIPIENT = "FfLpuH4WPn2MR8Lqn1MpwQc1HtAPPqL3qvMWZjnFHGpv";
/** UsePaid's line in a coin's description, which names the X account it pays. */
export const usePaidLine = (handle) => `Fees to @${handle} via UsePaid`;
/** An X handle UsePaid can name: 1 to 15 letters, digits or underscores. */
export const X_HANDLE = /^\w{1,15}$/;

const disc = (name) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
export const CREATE_FEE_SHARING_CONFIG_DISC = disc("create_fee_sharing_config").toString("hex");  // c34e564c6f34fbd5
export const UPDATE_FEE_SHARES_DISC = disc("update_fee_shares").toString("hex");                    // bd0d8863bba4ed23
/** What the pair uses at most in compute units: 146,883 in the recorded transaction. */
export const FEE_ROUTE_COMPUTE_UNIT_LIMIT = 250_000;
/** The most the fee route may bid in priority fees, in lamports (as a launch: 0.005 SOL). */
export const MAX_FEE_ROUTE_PRIORITY_LAMPORTS = 5_000_000n;

export const sharingConfig = (mint) => pda(["utf8:sharing-config", mint], PUMP_FEES.program);
export const pumpCreatorVault = (config) => pda(["utf8:creator-vault", config], PUMPFUN_PROGRAM);
export const coinCreatorVaultAuthority = (config) => pda(["utf8:creator_vault", config], PUMP_AMM.program);
export const coinCreatorVaultAta = (config) => ata(coinCreatorVaultAuthority(config), WSOL_MINT, TOKEN_PROGRAM);

const r = (pubkey) => ({ pubkey, isSigner: false, isWritable: false });
const w = (pubkey) => ({ pubkey, isSigner: false, isWritable: true });
const sw = (pubkey) => ({ pubkey, isSigner: true, isWritable: true });

/** create_fee_sharing_config's thirteen accounts for a coin that has not graduated, `creator` paying. */
export function createFeeSharingConfigAccounts(mint, creator) {
  return [r(PUMP_FEES.eventAuthority), r(PUMP_FEES.program), sw(creator), r(PUMP.global), r(mint), w(sharingConfig(mint)), r(SYSTEM_PROGRAM),
    w(bondingCurve(mint)), r(PUMPFUN_PROGRAM), r(PUMP.eventAuthority), r(PUMP_FEES.program), r(PUMP_FEES.program), r(PUMP_FEES.program)];
}
/** update_fee_shares's eighteen accounts, then the current shareholders (the creator alone, as create_fee_sharing_config leaves it). */
export function updateFeeSharesAccounts(mint, creator) {
  const config = sharingConfig(mint);
  return [r(PUMP_FEES.eventAuthority), r(PUMP_FEES.program), sw(creator), r(PUMP.global), r(mint), w(config), w(bondingCurve(mint)), w(pumpCreatorVault(config)),
    r(SYSTEM_PROGRAM), r(PUMPFUN_PROGRAM), r(PUMP.eventAuthority), r(PUMP_AMM.program), r(PUMP_AMM.eventAuthority), r(WSOL_MINT), r(TOKEN_PROGRAM), r(ATA_PROGRAM),
    w(coinCreatorVaultAuthority(config)), w(coinCreatorVaultAta(config)), sw(creator)];
}
/** update_fee_shares's data: one shareholder, `recipient`, with all 10,000 basis points. */
export function updateFeeSharesData(recipient) {
  const b = Buffer.alloc(8 + 4 + 34);
  disc("update_fee_shares").copy(b, 0);
  b.writeUInt32LE(1, 8);
  Buffer.from(base58(recipient)).copy(b, 12);
  b.writeUInt16LE(10_000, 44);
  return b;
}

const address = (v, what) => { const a = typeof v === "string" ? v : v?.publicKey; if (!isAddress(a)) throw new TypeError(`${what} is not an address`); return a; };

/**
 * The fee route's transaction, unsigned: SetComputeUnitLimit, SetComputeUnitPrice, create_fee_sharing_config and
 * update_fee_shares giving `recipient` (UsePaid's, by default) every basis point of `mint`'s creator fees, the
 * coin's creator `wallet` paying and signing alone. Returns a frozen { messageBytes, signers, wallet, mint, recipient }.
 */
export function buildFeeRouteTransaction({ wallet, mint, recentBlockhash, recipient = USEPAID_RECIPIENT, computeUnitLimit = FEE_ROUTE_COMPUTE_UNIT_LIMIT, computeUnitPriceMicroLamports = 100_000 } = {}) {
  wallet = address(wallet, "the wallet"); mint = address(mint, "the mint"); recipient = address(recipient, "the recipient");
  if (recipient === wallet) throw new Error("the recipient is the creator: nothing to route");
  if (!Number.isInteger(computeUnitLimit) || computeUnitLimit < 1 || computeUnitLimit > MAX_COMPUTE_UNIT_LIMIT) throw new RangeError(`a compute-unit limit is 1..${MAX_COMPUTE_UNIT_LIMIT}`);
  const price = typeof computeUnitPriceMicroLamports === "bigint" ? computeUnitPriceMicroLamports : Number.isSafeInteger(computeUnitPriceMicroLamports) ? BigInt(computeUnitPriceMicroLamports) : -1n;
  if (price < 0n) throw new RangeError("a compute-unit price is a whole number of micro-lamports, 0 or more");
  if (priorityFeeLamports(computeUnitLimit, price) > MAX_FEE_ROUTE_PRIORITY_LAMPORTS) throw new RangeError("the fee route's priority fee is more than this launcher allows");
  const instructions = [
    setComputeUnitLimit(computeUnitLimit),
    setComputeUnitPrice(price),
    { programId: PUMP_FEES.program, keys: createFeeSharingConfigAccounts(mint, wallet), data: disc("create_fee_sharing_config") },
    { programId: PUMP_FEES.program, keys: updateFeeSharesAccounts(mint, wallet), data: updateFeeSharesData(recipient) },
  ];
  const message = compileLegacyMessage({ payer: wallet, recentBlockhash, instructions });
  const signers = message.accountKeys.slice(0, message.header.numRequiredSignatures);
  const size = 1 + 64 * signers.length + message.bytes.length;
  if (size > PACKET_DATA_SIZE) throw new RangeError(`the fee route would be ${size} bytes; Solana takes at most ${PACKET_DATA_SIZE}`);
  checkFeeRouteMessage(message.bytes, { wallet, mint, recipient });
  return Object.freeze({ messageBytes: message.bytes, signers, wallet, mint, recipient });
}

/**
 * Check, from the bytes alone, that a message is a fee route this module builds: paid and signed by `wallet` alone,
 * at most one SetComputeUnitLimit and one SetComputeUnitPrice (the fee guard as above), exactly one
 * create_fee_sharing_config then exactly one update_fee_shares for `mint`, with these accounts, giving `recipient`
 * all 10,000 basis points, and nothing else. Throws with the reason otherwise.
 */
export function checkFeeRouteMessage(messageBytes, { wallet, mint, recipient = USEPAID_RECIPIENT } = {}) {
  const msg = decodeLegacyMessage(messageBytes);
  const signers = msg.accountKeys.slice(0, msg.header.numRequiredSignatures);
  if (signers.length !== 1 || signers[0] !== wallet) throw new Error("the signer is not the wallet alone");
  let limit = null, price = null;
  const fees = [];
  for (const ix of decompileInstructions(msg)) {
    const d = Buffer.from(ix.data);
    const budget = ix.programId === COMPUTE_BUDGET_PROGRAM && ix.keys.length === 0;
    if (budget && d[0] === 2 && d.length === 5 && limit === null) limit = d.readUInt32LE(1);
    else if (budget && d[0] === 3 && d.length === 9 && price === null) price = d.readBigUInt64LE(1);
    else if (ix.programId === PUMP_FEES.program) fees.push(ix);
    else throw new Error(`an instruction for ${ix.programId} that a fee route does not carry`);
  }
  if (limit !== null && (limit < 1 || limit > MAX_COMPUTE_UNIT_LIMIT)) throw new Error(`a compute-unit limit of ${limit}`);
  if (priorityFeeLamports(limit ?? MAX_COMPUTE_UNIT_LIMIT, price ?? 0n) > MAX_FEE_ROUTE_PRIORITY_LAMPORTS) throw new Error("the fee route's priority fee is more than this launcher allows");
  const same = (keys, want) => keys.length === want.length && keys.every((k, i) => k.pubkey === want[i].pubkey && k.isSigner === want[i].isSigner && k.isWritable === want[i].isWritable);
  if (fees.length !== 2) throw new Error("not exactly create_fee_sharing_config then update_fee_shares");
  const [create, update] = fees;
  if (Buffer.from(create.data).toString("hex") !== CREATE_FEE_SHARING_CONFIG_DISC || !same(create.keys, createFeeSharingConfigAccounts(mint, wallet))) throw new Error("create_fee_sharing_config is not the one for this mint and wallet");
  if (!Buffer.from(update.data).equals(updateFeeSharesData(recipient)) || !same(update.keys, updateFeeSharesAccounts(mint, wallet))) throw new Error("update_fee_shares does not give the recipient every basis point of this mint");
  return true;
}

/** Sign a built fee route with the wallet's keypair (re-checked from a copy of its bytes first); base64. */
export function signFeeRouteTransaction(built, walletKeypair) {
  if (!built || !(built.messageBytes instanceof Uint8Array)) throw new TypeError("signFeeRouteTransaction takes what buildFeeRouteTransaction returned");
  if (walletKeypair?.publicKey !== built.wallet) throw new Error("the wallet keypair is not the fee route's wallet");
  const bytes = Uint8Array.from(built.messageBytes);
  checkFeeRouteMessage(bytes, built);
  return Buffer.from(serializeTransaction(bytes, signTransaction(bytes, [walletKeypair]))).toString("base64");
}
/** The same, unsigned (a zero signature), for a simulation. */
export function unsignedFeeRouteTransaction(built) {
  const bytes = Uint8Array.from(built.messageBytes);
  checkFeeRouteMessage(bytes, built);
  return Buffer.from(serializeTransaction(bytes, [new Uint8Array(64)])).toString("base64");
}

/**
 * A sharing config's account data, read: { mint, admin, adminRevoked, shareholders: [{ address, bps }] }, or null when it
 * is not one (too short, or a shareholder count past the 1,024-byte account).
 */
export function decodeSharingConfig(data) {
  const d = Buffer.from(data ?? []);
  if (d.length < 8 + 3 + 64 + 1 + 4) return null;
  let o = 11;
  const key = () => { const k = base58enc(d.subarray(o, o + 32)); o += 32; return k; };
  const mint = key(), admin = key();
  const adminRevoked = d[o++] === 1;
  const n = d.readUInt32LE(o); o += 4;
  if (n > 10 || o + 34 * n > d.length) return null;
  const shareholders = [];
  for (let i = 0; i < n; i++) { const a = key(); shareholders.push({ address: a, bps: d.readUInt16LE(o) }); o += 2; }
  return { mint, admin, adminRevoked, shareholders };
}

/** Whether a sharing config (decoded) gives `recipient` every basis point for good. */
export const routedTo = (config, recipient = USEPAID_RECIPIENT) => !!config && config.adminRevoked && config.shareholders.length === 1
  && config.shareholders[0].address === recipient && config.shareholders[0].bps === 10_000;
