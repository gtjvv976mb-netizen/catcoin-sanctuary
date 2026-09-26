import fs from "node:fs";
import * as NEW from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import * as OLD from "./head/src/lib/jupiter-swap.mjs";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", T = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const file = process.argv[2];
const d = JSON.parse(fs.readFileSync(file));
const q = d.quote;
const prog = (m) => (process.env[`P_${m}`] ?? (m.startsWith("Xsv9") || m.startsWith("74sH") ? T22 : T));
const args = { txBase64: d.swap.swapTransaction, wallet: "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9", inputMint: q.inputMint, outputMint: q.outputMint, inputProgram: prog(q.inputMint), outputProgram: prog(q.outputMint), amountRaw: q.inAmount, quote: q, slippageCapBps: Number(q.slippageBps), maxPriorityFeeLamports: 50_000 };
args.lookupTables = await NEW.loadLookupTables(rpc, NEW.lookupTableKeysOf(args.txBase64));
for (const [name, M] of [["HEAD", OLD], ["working tree", NEW]]) {
  try { const c = M.checkSwapTransaction(args); console.log(name, "passed", c.route.name); } catch (e) { console.log(name, "refused", e.clause, e.message); }
}
