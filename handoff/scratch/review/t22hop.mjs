/* Token-2022 cat coins (tradeable extensions only) through the agent's live ask and check:
   a $25 USDC buy, and a sell of what that buy quotes. Structural check (no simulation: the
   probe wallet holds none of these coins). Nothing is signed. */
import fs from "node:fs";
import { createJupiterClient, checkQuote, checkSwapTransaction, loadLookupTables, lookupTableKeysOf } from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
import * as OLD from "./head/src/lib/jupiter-swap.mjs";
const T = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const jup = createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_300 });
const oldJup = OLD.createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_300 });
const wallet = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
const mints = process.argv.slice(2);
const saved = [];
async function one(tok, side, amountRaw, M = null) {
  const inputMint = side === "buy" ? USDC : tok, outputMint = side === "buy" ? tok : USDC;
  const inP = side === "buy" ? T : T22, outP = side === "buy" ? T22 : T;
  const row = { mint: tok.slice(0, 8), side, flow: M ? "HEAD direct" : "solHop" };
  let raw;
  try {
    const J = M ? oldJup : jup, C = M ?? { checkQuote, checkSwapTransaction };
    raw = await J.quote({ inputMint, outputMint, amountRaw, slippageBps: 100, priority: "live", ...(M ? {} : { solHop: true }) });
    row.route = raw.routePlan.map((h) => `${h.swapInfo.label}:${h.swapInfo.inputMint.slice(0, 4)}>${h.swapInfo.outputMint.slice(0, 4)}`).join(" | ");
    row.impactPct = (Math.abs(Number(raw.priceImpactPct)) * 100).toFixed(2);
    const q = C.checkQuote(raw, { inputMint, outputMint, amountRaw, slippageBps: 100, slippageCapBps: 100, maxPriceImpactPct: side === "buy" ? 2 : 100, ...(M ? {} : { solHop: true }) });
    const built = await J.swapTransaction({ quote: raw, wallet, priorityFeeLamports: 50_000, priority: "live", ...(M ? {} : { sharedAccounts: q.intermediate !== null }) });
    saved.push({ capturedAt: new Date().toISOString(), tok, side, flow: row.flow, quote: raw, swapTransaction: built.swapTransaction });
    const tables = await loadLookupTables(rpc, lookupTableKeysOf(built.swapTransaction));
    const c = C.checkSwapTransaction({ txBase64: built.swapTransaction, wallet, inputMint, outputMint, inputProgram: inP, outputProgram: outP, amountRaw, quote: raw, slippageCapBps: 100, lookupTables: tables, maxPriorityFeeLamports: 50_000, allowedPairs: new Set([`${USDC}>${tok}`, `${tok}>${USDC}`]), ...(M ? {} : { solHop: true }) });
    row.result = `passed (${c.route.name})`;
  } catch (e) { row.result = `${e.clause ?? e.code}: ${e.message.slice(0, 160)}`; }
  console.log(JSON.stringify(row));
  return raw;
}
for (const tok of mints) {
  const b = await one(tok, "buy", "25000000");
  const sellAmt = b?.outAmount ?? null;
  if (sellAmt) { await one(tok, "sell", sellAmt); await one(tok, "sell", sellAmt, OLD); }
}
fs.writeFileSync(`t22hop-${Date.now()}.json`, JSON.stringify(saved, null, 1));
