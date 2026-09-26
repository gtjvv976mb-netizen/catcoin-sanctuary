// Build the launch exactly as an adopter's browser would (web3.js, no server), then SIMULATE ONLY
// (sigVerify:false, replaceRecentBlockhash:true). Nothing is signed or sent. The mint keypair is
// ephemeral and discarded; no user key is involved.
import fs from "node:fs"; import { createRequire } from "node:module"; import { rpc } from "./rpc.mjs";
const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json");
const { PublicKey, Keypair, Transaction, TransactionInstruction, ComputeBudgetProgram, SystemProgram } = require("@solana/web3.js");
const LL = new PublicKey("LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj");
const T22 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const PAYER = new PublicKey(process.argv[3] ?? "3J57tqAJqRmSBn1ZYDu9JpMMyTfBHdcGGwECiPQeiji3");
const QUOTE = new PublicKey(process.env.QUOTE); const QTP = new PublicKey(process.env.QTP);
const pricing = (await (await fetch(`https://www.stonkfun.xyz/api/public/v1/launchlab/pricing?quoteMint=${QUOTE.toBase58()}`)).json()).data;
const pda = (seeds) => PublicKey.findProgramAddressSync(seeds, LL)[0];
const u8 = (n) => Buffer.from([n]); const u64 = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return b; };
const str = (s) => { const d = Buffer.from(s, "utf8"); const l = Buffer.alloc(4); l.writeUInt32LE(d.length); return Buffer.concat([l, d]); };
function initIx({ payer, creator, mint, name, symbol, uri, supply, totalSellA, raise, withRule = true, ruleOverride }) {
  const cfg = new PublicKey(pricing.curve.configId), platform = new PublicKey(pricing.platform.standard);
  const pool = pda([Buffer.from("pool"), mint.toBuffer(), QUOTE.toBuffer()]);
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true }, { pubkey: creator, isSigner: false, isWritable: false },
    { pubkey: cfg, isSigner: false, isWritable: false }, { pubkey: platform, isSigner: false, isWritable: false },
    { pubkey: pda([Buffer.from("vault_auth_seed")]), isSigner: false, isWritable: false }, { pubkey: pool, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: true, isWritable: true }, { pubkey: QUOTE, isSigner: false, isWritable: false },
    { pubkey: pda([Buffer.from("pool_vault"), pool.toBuffer(), mint.toBuffer()]), isSigner: false, isWritable: true },
    { pubkey: pda([Buffer.from("pool_vault"), pool.toBuffer(), QUOTE.toBuffer()]), isSigner: false, isWritable: true },
    { pubkey: T22, isSigner: false, isWritable: false }, { pubkey: QTP, isSigner: false, isWritable: false }, // base = Token-2022; quote = the pair's own token program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: pda([Buffer.from("__event_authority")]), isSigner: false, isWritable: false }, { pubkey: LL, isSigner: false, isWritable: false },
  ];
  if (withRule) keys.push({ pubkey: new PublicKey(ruleOverride ?? pricing.curveRule.standard), isSigner: false, isWritable: false });
  const data = Buffer.concat([Buffer.from("25be7ede2c9aab11", "hex"), u8(pricing.curve.baseDecimals), str(name), str(symbol), str(uri),
    u8(0), u64(supply), u64(totalSellA), u64(raise), u8(1), u64(0), u64(0), u64(0), u8(pricing.curve.cpmmCreatorFeeOn), u8(0), Buffer.alloc(10)]);
  return { ix: new TransactionInstruction({ programId: LL, keys, data }), pool };
}
const bal = await rpc("getBalance", [PAYER.toBase58(), { commitment: "confirmed" }]);
const { value: { blockhash } } = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
const base = { name: "Sockfoot the Morning Cat", symbol: "SOCKFOOT", uri: "https://catcoinsanctuary.com/kits/TEST.json",
  supply: pricing.curve.supply, totalSellA: pricing.curve.totalSellA, raise: pricing.raise.raw };
const variants = [ { id: "A_correct_shape_" + process.env.SYM, note: "published shape, quote " + process.env.SYM + " (" + process.env.QTP + ")", args: {} } ];
const out = { simulatedAt: new Date().toISOString(), payer: PAYER.toBase58(), payerLamports: bal.value, pricing: { configId: pricing.curve.configId, platform: pricing.platform.standard, curveRule: pricing.curveRule.standard, raise: pricing.raise.raw, observedAt: pricing.prices.observedAt }, results: [] };
for (const v of variants) {
  const mint = Keypair.generate().publicKey; // ephemeral address only; its secret is never used
  const { ix, pool } = initIx({ payer: PAYER, creator: v.args.creator ?? PAYER, mint, ...base, ...v.args });
  const tx = new Transaction({ feePayer: PAYER, recentBlockhash: blockhash }).add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 })).add(ix);
  const wire = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const sim = await rpc("simulateTransaction", [wire.toString("base64"), { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed", accounts: { encoding: "base64", addresses: [PAYER.toBase58(), pool.toBase58()] } }]);
  const r = sim.value; const payerAfter = r.accounts?.[0]?.lamports ?? null;
  out.results.push({ id: v.id, note: v.note, mint: mint.toBase58(), pool: pool.toBase58(), txBytes: wire.length, err: r.err, unitsConsumed: r.unitsConsumed,
    payerBefore: bal.value, payerAfter, payerCostLamports: payerAfter == null ? null : bal.value - payerAfter,
    logs: (r.logs ?? []).filter((l) => /Instruction:|Error|error|failed|custom program|AnchorError|consumed \d+ of/.test(l)).slice(0, 40),
    transactionBase64: wire.toString("base64") });
  console.error(v.id, JSON.stringify(r.err), r.unitsConsumed);
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
