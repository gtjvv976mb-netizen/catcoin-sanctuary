// For a creator wallet, find transactions NOT paid by the creator that increased its token balances (candidate fee forwards). READ-ONLY.
import fs from "node:fs"; import { rpc } from "./rpc.mjs";
const [, , OUT, CREATOR, MAX = "25"] = process.argv;
const sigs = await rpc("getSignaturesForAddress", [CREATOR, { limit: 100, commitment: "confirmed" }]);
const out = { creator: CREATOR, readAt: new Date().toISOString(), scanned: 0, sigCount: sigs.length, inflows: [] };
for (const s of sigs.slice(0, Number(MAX))) {
  const tx = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 1, commitment: "confirmed" }]); out.scanned++;
  if (!tx) continue; const payer = tx.transaction.message.accountKeys[0].pubkey; if (payer === CREATOR) continue;
  const deltas = (tx.meta.postTokenBalances ?? []).filter((p) => p.owner === CREATOR).map((p) => { const pre = (tx.meta.preTokenBalances ?? []).find((q) => q.accountIndex === p.accountIndex); return { mint: p.mint, delta: (BigInt(p.uiTokenAmount.amount) - BigInt(pre?.uiTokenAmount.amount ?? "0")).toString() }; }).filter((d) => d.delta !== "0");
  const idx = tx.transaction.message.accountKeys.findIndex((k) => k.pubkey === CREATOR); const solDelta = idx >= 0 ? tx.meta.postBalances[idx] - tx.meta.preBalances[idx] : 0;
  const memos = [...tx.transaction.message.instructions, ...(tx.meta.innerInstructions ?? []).flatMap((g) => g.instructions)].filter((i) => i.program === "spl-memo").map((i) => i.parsed);
  out.inflows.push({ signature: s.signature, blockTime: s.blockTime, feePayer: payer, solDelta, tokenDeltas: deltas, memos, programs: [...new Set(tx.transaction.message.instructions.map((i) => i.program ?? i.programId))] });
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
for (const i of out.inflows) console.log(new Date(i.blockTime * 1000).toISOString(), i.signature.slice(0, 10), "payer", i.feePayer.slice(0, 8), "sol", i.solDelta, JSON.stringify(i.tokenDeltas), JSON.stringify(i.memos), i.programs.join(","));
console.log("scanned", out.scanned, "of", out.sigCount);
