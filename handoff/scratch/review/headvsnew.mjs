/* The agent's live sell of a Token-2022 cat coin, asked and checked the HEAD way (direct only)
   and the working-tree way (solHop), on the same minute's Jupiter. Structural check only
   (the probe wallet holds none of the coin, so nothing is simulated). Nothing is signed. */
import fs from "node:fs";
import * as NEW from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import * as OLD from "./head/src/lib/jupiter-swap.mjs";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
const T = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const wallet = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
const newJup = NEW.createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_300 });
const oldJup = OLD.createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_300 });
const COINS = { ZCAT: "HcRLc9VDgjLeK154xDawfb1dmVJ98DoSqcwTHGqiDeJR", LEVERCAT: "AGi2s9zPRPHs3zEDPhPTroumTEXK5ufymYSfEFndCSSW" };
const [sym, settle, amountRaw] = [process.env.COIN ?? "ZCAT", process.env.SETTLE ?? "USDC", process.env.AMT ?? "1000000000"];
const tok = COINS[sym], s = settle === "USDC" ? USDC : USDT;
const pairs = new Set([`${s}>${tok}`, `${tok}>${s}`]);
const saved = { capturedAt: new Date().toISOString(), coin: sym, settle, amountRaw };
async function flow(name, M, jup, solHop) {
  const row = { flow: name };
  try {
    const raw = await jup.quote({ inputMint: tok, outputMint: s, amountRaw, slippageBps: 100, priority: "live", ...(solHop ? { solHop: true } : {}) });
    row.route = raw.routePlan.map((h) => `${h.swapInfo.label}:${h.swapInfo.inputMint.slice(0, 4)}>${h.swapInfo.outputMint.slice(0, 4)}@${h.bps}`).join(" | ");
    const q = M.checkQuote(raw, { inputMint: tok, outputMint: s, amountRaw, slippageBps: 100, slippageCapBps: 100, maxPriceImpactPct: 100, ...(solHop ? { solHop: true } : {}) });
    const built = await jup.swapTransaction({ quote: raw, wallet, priorityFeeLamports: 50_000, priority: "live", ...(solHop ? { sharedAccounts: q.intermediate !== null } : {}) });
    saved[name] = { quote: raw, swapTransaction: built.swapTransaction };
    const tables = await M.loadLookupTables(rpc, M.lookupTableKeysOf(built.swapTransaction));
    const c = M.checkSwapTransaction({ txBase64: built.swapTransaction, wallet, inputMint: tok, outputMint: s, inputProgram: T22, outputProgram: T, amountRaw, quote: raw, slippageCapBps: 100, lookupTables: tables, maxPriorityFeeLamports: 50_000, allowedPairs: pairs, ...(solHop ? { solHop: true } : {}) });
    row.result = `passed (${c.route.name})`;
  } catch (e) { row.result = `refused ${e.clause ?? e.code}: ${e.message}`; }
  console.log(JSON.stringify(row));
}
await flow("HEAD (direct only)", OLD, oldJup, false);
await flow("working tree (solHop)", NEW, newJup, true);
fs.writeFileSync(`headvsnew-${sym}-${settle}-${Date.now()}.json`, JSON.stringify(saved, null, 1));
