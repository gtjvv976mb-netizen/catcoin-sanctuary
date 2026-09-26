/* POPCAT, the one preset coin with a direct USDC pool: the working tree's ask/build/check vs
   HEAD's, repeated, to see whether anything HEAD would trade the new path refuses. */
import fs from "node:fs";
import * as NEW from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import * as OLD from "./head/src/lib/jupiter-swap.mjs";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
const T = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", POPCAT = "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const wallet = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
const nj = NEW.createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_200 });
const oj = OLD.createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_200 });
const rounds = Number(process.env.ROUNDS ?? 5);
const saved = [];
async function run(M, J, hop, side, amountRaw) {
  const inputMint = side === "buy" ? USDC : POPCAT, outputMint = side === "buy" ? POPCAT : USDC;
  const x = hop ? { solHop: true } : {};
  try {
    const raw = await J.quote({ inputMint, outputMint, amountRaw, slippageBps: 100, priority: "live", ...x });
    const route = raw.routePlan.map((h) => h.swapInfo.label).join(">");
    const q = M.checkQuote(raw, { inputMint, outputMint, amountRaw, slippageBps: 100, slippageCapBps: 100, maxPriceImpactPct: side === "buy" ? 2 : 100, ...x });
    const built = await J.swapTransaction({ quote: raw, wallet, priorityFeeLamports: 50_000, priority: "live", ...(hop ? { sharedAccounts: q.intermediate !== null } : {}) });
    saved.push({ at: new Date().toISOString(), hop, side, quote: raw, swapTransaction: built.swapTransaction });
    const tables = await M.loadLookupTables(rpc, M.lookupTableKeysOf(built.swapTransaction));
    const c = M.checkSwapTransaction({ txBase64: built.swapTransaction, wallet, inputMint, outputMint, inputProgram: T, outputProgram: T, amountRaw, quote: raw, slippageCapBps: 100, lookupTables: tables, maxPriorityFeeLamports: 50_000, allowedPairs: new Set([`${USDC}>${POPCAT}`, `${POPCAT}>${USDC}`]), ...x });
    return `ok ${route} impact=${(Number(raw.priceImpactPct) * 100).toFixed(3)}% out=${raw.outAmount} ${c.route.name}`;
  } catch (e) { return `REFUSED ${e.clause ?? e.code}: ${e.message.slice(0, 140)}`; }
}
for (let i = 0; i < rounds; i++) {
  for (const [side, amt] of [["buy", "25000000"], ["sell", "400000000000"]]) {
    const a = await run(OLD, oj, false, side, amt);
    const b = await run(NEW, nj, true, side, amt);
    console.log(JSON.stringify({ round: i, side, HEAD: a, working: b }));
  }
}
fs.writeFileSync(`popcat-sample-${Date.now()}.json`, JSON.stringify(saved, null, 1));
