// Find each mint's creation transaction and decode it. READ-ONLY (getSignaturesForAddress, getTransaction).
import fs from "node:fs";
import { createRequire } from "node:module";
import { rpc } from "./rpc.mjs";
const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json");
const bs58 = require("bs58"); const b58 = bs58.default ?? bs58;
const OUT = process.argv[2];
const MINTS = JSON.parse(process.argv[3]); // [{mint,label}]
const LAUNCHLAB = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
const DISC_INIT_T22 = "25be7ede2c9aab11";
const KNOWN = {
  "ComputeBudget111111111111111111111111111111": "ComputeBudget",
  "11111111111111111111111111111111": "System",
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr": "Memo",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "SPL Token",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb": "Token-2022",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL": "AssociatedToken",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUc5azmHV2FKDk": "Jupiter v6",
  [LAUNCHLAB]: "LaunchLab",
};
function rd(buf) { let o = 0; return {
  u8: () => buf[o++], u16: () => { const v = buf.readUInt16LE(o); o += 2; return v; }, u32: () => { const v = buf.readUInt32LE(o); o += 4; return v; },
  u64: () => { const v = buf.readBigUInt64LE(o); o += 8; return v.toString(); },
  str: () => { const n = buf.readUInt32LE(o); o += 4; const s = buf.subarray(o, o + n).toString("utf8"); o += n; return s; },
  rest: () => buf.subarray(o), get off() { return o; } }; }
function decodeInit(hex) {
  const b = Buffer.from(hex, "hex"); const r = rd(b.subarray(8));
  const out = { decimals: r.u8(), name: r.str(), symbol: r.str(), uri: r.str() };
  out.curveVariant = r.u8();
  if (out.curveVariant === 0) { out.supply = r.u64(); out.totalSellA = r.u64(); out.totalFundRaisingB = r.u64(); out.migrateType = r.u8(); }
  out.vesting = { totalLocked: r.u64(), cliff: r.u64(), unlock: r.u64() };
  out.ammFeeOn = r.u8();
  const rest = r.rest();
  out.transferFeeTag = rest.length ? rest[0] : null;
  if (out.transferFeeTag === 1) out.transferFee = { bps: rest.readUInt16LE(1), maximumFee: rest.readBigUInt64LE(3).toString() };
  out.trailingBytesHex = rest.toString("hex"); out.trailingLen = rest.length;
  return out;
}
function cbDecode(hex) { const b = Buffer.from(hex, "hex"); const t = b[0];
  if (t === 2) return { op: "SetComputeUnitLimit", units: b.readUInt32LE(1) };
  if (t === 3) return { op: "SetComputeUnitPrice", microLamports: b.readBigUInt64LE(1).toString() };
  if (t === 1) return { op: "RequestHeapFrame", bytes: b.readUInt32LE(1) };
  if (t === 4) return { op: "SetLoadedAccountsDataSizeLimit", bytes: b.readUInt32LE(1) };
  return { op: "cb?" + t }; }
function sysDecode(hex, accts) { const b = Buffer.from(hex, "hex"); const t = b.readUInt32LE(0);
  if (t === 2) return { op: "Transfer", lamports: b.readBigUInt64LE(4).toString(), from: accts[0], to: accts[1] };
  return { op: "system#" + t }; }
const results = [];
for (const { mint, label } of MINTS) {
  let before; let oldest = null; let count = 0;
  for (let page = 0; page < 8; page++) {
    const sigs = await rpc("getSignaturesForAddress", [mint, { limit: 1000, ...(before ? { before } : {}), commitment: "confirmed" }]);
    if (!sigs.length) break; count += sigs.length; oldest = sigs[sigs.length - 1]; before = oldest.signature;
    if (sigs.length < 1000) break;
  }
  if (!oldest) { results.push({ mint, label, error: "no signatures" }); continue; }
  const tx = await rpc("getTransaction", [oldest.signature, { encoding: "json", maxSupportedTransactionVersion: 1, commitment: "confirmed" }]);
  const msg = tx.transaction.message;
  const keys = [...msg.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
  const nSig = msg.header.numRequiredSignatures;
  const signers = msg.accountKeys.slice(0, nSig);
  const ixs = msg.instructions.map((ix) => {
    const program = keys[ix.programIdIndex]; const hex = Buffer.from(b58.decode(ix.data)).toString("hex");
    const accts = ix.accounts.map((i) => keys[i]);
    const o = { program, programName: KNOWN[program] ?? null, dataHex: hex.length > 400 ? hex.slice(0, 400) + "…" : hex, accounts: accts };
    if (program === "ComputeBudget111111111111111111111111111111") o.decoded = cbDecode(hex);
    if (program === "11111111111111111111111111111111") o.decoded = sysDecode(hex, accts);
    if (program === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr") o.decoded = { memo: Buffer.from(hex, "hex").toString("utf8") };
    if (program === LAUNCHLAB && hex.startsWith(DISC_INIT_T22)) {
      o.decoded = decodeInit(hex);
      const names = ["payer","creator","global_config","platform_config","authority","pool_state","base_mint","quote_mint","base_vault","quote_vault","base_token_program","quote_token_program","system_program","event_authority","program"];
      o.namedAccounts = accts.map((a, i) => ({ name: names[i] ?? `extra_${i}`, pubkey: a, isSigner: signers.includes(a), isWritable: (() => { const idx = keys.indexOf(a); const h = msg.header; const nStatic = msg.accountKeys.length; if (idx < nSig) return idx < nSig - h.numReadonlySignedAccounts; if (idx < nStatic) return idx < nStatic - h.numReadonlyUnsignedAccounts; return idx < nStatic + (tx.meta.loadedAddresses?.writable?.length ?? 0); })() }));
    }
    return o;
  });
  const inner = (tx.meta.innerInstructions ?? []).flatMap((g) => g.instructions.map((ix) => ({ outer: g.index, program: keys[ix.programIdIndex], programName: KNOWN[keys[ix.programIdIndex]] ?? null })));
  const logs = tx.meta.logMessages ?? [];
  results.push({ label, mint, signature: oldest.signature, slot: tx.slot, blockTime: tx.blockTime, signaturesScanned: count,
    version: tx.version, feePayer: msg.accountKeys[0], signers, fee: tx.meta.fee, err: tx.meta.err, computeUnitsConsumed: tx.meta.computeUnitsConsumed,
    payerLamportsDelta: tx.meta.postBalances[0] - tx.meta.preBalances[0], addressTableLookups: msg.addressTableLookups ?? [],
    instructions: ixs, innerProgramsSeen: [...new Set(inner.map((x) => x.programName ?? x.program))],
    logsHead: logs.filter((l) => /Instruction:|Program log: (?!Instruction)/.test(l)).slice(0, 30) });
  fs.writeFileSync(OUT, JSON.stringify({ readAt: new Date().toISOString(), rpc: "https://api.mainnet-beta.solana.com", results }, null, 1));
  console.error("done", label, oldest.signature.slice(0, 12), "sigs", count);
}
