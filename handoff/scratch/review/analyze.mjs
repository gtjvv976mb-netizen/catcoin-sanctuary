import fs from "node:fs";
import bs58pkg from "/home/user/Cat-Intelligence-Agency/node_modules/bs58/index.js";
import { fillFromTransaction, associatedTokenAddress, WSOL } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
const bs58 = bs58pkg.default ?? bs58pkg;
const JUP = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", CB = "ComputeBudget111111111111111111111111111111", ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const TK = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const rows = JSON.parse(fs.readFileSync(process.argv[2] || "hops.json", "utf8"));
const stats = {};
for (const { signature, tx } of rows) {
  if (!tx) continue;
  const m = tx.transaction.message;
  const keys = [...m.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
  const ixs = m.instructions.map((ix) => ({ program: keys[ix.programIdIndex], keys: ix.accounts.map((i) => keys[i]), data: Buffer.from(bs58.decode(ix.data)) }));
  const jups = ixs.filter((i) => i.program === JUP);
  const others = ixs.filter((i) => ![JUP, CB, ATA].includes(i.program));
  const shared = jups.length === 1 && jups[0].data.subarray(0, 8).toString("hex") === "d19853937cfed8e9";
  const key = `${jups.length}jup shared=${shared} others=${others.length}`;
  stats[key] = (stats[key] ?? 0) + 1;
  if (!shared || others.length) continue;
  const r = jups[0];
  const inMint = r.keys[6], outMint = r.keys[7], wallet = keys[0];
  const settle = [USDC, USDT].includes(inMint) ? inMint : [USDC, USDT].includes(outMint) ? outMint : null;
  const d = r.data; const last = d.subarray(d.length - 4);
  const lastIdx = `${last[2]}->${last[3]}`;
  const walletSol = associatedTokenAddress(wallet, WSOL, TK);
  const payerDelta = BigInt(tx.meta.preBalances[0]) - BigInt(tx.meta.postBalances[0]);
  let created = []; for (let i = 1; i < keys.length; i++) if (tx.meta.preBalances[i] === 0 && tx.meta.postBalances[i] > 0) created.push(`${keys[i].slice(0,6)}:${tx.meta.postBalances[i]}`);
  const lamportChanges = keys.map((k, i) => [k, tx.meta.postBalances[i] - tx.meta.preBalances[i]]).filter(([, dd]) => dd !== 0);
  let fill = "n/a";
  if (settle) {
    const side = inMint === settle ? "buy" : "sell";
    const mint = side === "buy" ? outMint : inMint;
    try { const f = fillFromTransaction(tx, { wallet, mint, side, quoteMint: settle, quoteDecimals: 6 }); fill = `ok ${side} qty=${f.qtyRaw} settle=${f.quoteInRaw ?? f.quoteOutRaw}`; }
    catch (e) { fill = `THROWS ${e.clause}: ${e.message.slice(0, 160)}`; }
  }
  console.log(signature.slice(0, 10), `in=${inMint.slice(0,5)} out=${outMint.slice(0,5)} settle=${settle ? settle.slice(0,4) : "-"} last=${lastIdx} steps=${d.readUInt32LE(31)} id=${d[8]} walletSolNamed=${keys.includes(walletSol)} payerDelta=${payerDelta} fee=${tx.meta.fee} created=[${created.join(",")}] ${fill}`);
}
console.log(stats);
