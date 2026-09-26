import fs from "node:fs"; import { rpc } from "./rpc.mjs";
const W = process.argv[3]; const N = Number(process.argv[4] ?? 12);
const sigs = await rpc("getSignaturesForAddress", [W, { limit: 40, commitment: "confirmed" }]);
const out = { wallet: W, readAt: new Date().toISOString(), txs: [] };
for (const s of sigs.slice(0, N)) {
  const tx = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 1, commitment: "confirmed" }]);
  if (!tx) continue;
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey);
  const ixs = [...tx.transaction.message.instructions, ...(tx.meta.innerInstructions ?? []).flatMap((g) => g.instructions)];
  const summary = ixs.map((i) => i.parsed ? { program: i.program, type: i.parsed.type, info: i.parsed.info } : { programId: i.programId, data: (i.data ?? "").slice(0, 24) });
  const memos = summary.filter((x) => x.program === "spl-memo").map((x) => x.info ?? x);
  const tokenDeltas = (tx.meta.postTokenBalances ?? []).map((p) => { const pre = (tx.meta.preTokenBalances ?? []).find((q) => q.accountIndex === p.accountIndex); return { owner: p.owner, mint: p.mint, delta: (BigInt(p.uiTokenAmount.amount) - BigInt(pre?.uiTokenAmount.amount ?? "0")).toString() }; }).filter((x) => x.delta !== "0");
  out.txs.push({ signature: s.signature, blockTime: s.blockTime, feePayer: keys[0], err: tx.meta.err, programs: [...new Set(summary.map((x) => x.program ?? x.programId))], types: summary.map((x) => x.type).filter(Boolean), tokenDeltas, logs: (tx.meta.logMessages ?? []).filter((l) => /Instruction:|Program log: (?!Instruction)/.test(l)).slice(0, 12) });
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
for (const t of out.txs) console.log(t.signature.slice(0, 10), t.feePayer.slice(0, 8), t.programs.join(","), t.types.join(","), JSON.stringify(t.tokenDeltas).slice(0, 300));
