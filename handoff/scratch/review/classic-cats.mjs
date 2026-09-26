/* Classic-token cat coins (catdetect) that HEAD could trade (a direct USDC route): does the
   working tree's ask/build/check still trade them, buy and sell? Structural check only. */
import fs from "node:fs";
import { detectCat } from "/home/user/Cat-Intelligence-Agency/bots/lib/catdetect.mjs";
import * as NEW from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import * as OLD from "./head/src/lib/jupiter-swap.mjs";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
const T = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const PRESET = new Set(["MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", "4N4DnNo3qpPks9aQCkcWkzoir8tnvT6diS4TnnZibonk", "GRUmPYbiTpq9ZPy5LAqBMMze7kErf5dEX2i9qYfwoSmR", "6Rwcmkz9yiYVM5EzyMcr4JsQPGEAWhcUvLvfBperYnUt", "3TWgDvYBL2YPET2LxnWAwsMeoA8aL4DutNuwat2pKCjC"]);
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const wallet = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
const nj = NEW.createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_200 });
const oj = OLD.createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_200 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const found = new Map();
for (const q of ["cat", "kitty", "meow", "michi", "catwif", "cats", "kitten", "neko", "wif cat", "cat coin"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  for (const t of await r.json()) if (t.tokenProgram === T && !PRESET.has(t.id) && detectCat({ name: t.name, symbol: t.symbol }).isCat && (t.isVerified || (t.liquidity ?? 0) > 100_000)) found.set(t.id, t.symbol);
  await sleep(1_100);
}
console.log("candidates", found.size);
const saved = [];
async function run(M, J, hop, tok, side, amountRaw) {
  const inputMint = side === "buy" ? USDC : tok, outputMint = side === "buy" ? tok : USDC;
  const x = hop ? { solHop: true } : {};
  let raw = null;
  try {
    raw = await J.quote({ inputMint, outputMint, amountRaw, slippageBps: 100, priority: "live", ...x });
    const route = raw.routePlan.map((h) => h.swapInfo.label).join(">");
    const q = M.checkQuote(raw, { inputMint, outputMint, amountRaw, slippageBps: 100, slippageCapBps: 100, maxPriceImpactPct: side === "buy" ? 2 : 100, ...x });
    const built = await J.swapTransaction({ quote: raw, wallet, priorityFeeLamports: 50_000, priority: "live", ...(hop ? { sharedAccounts: q.intermediate !== null } : {}) });
    saved.push({ at: new Date().toISOString(), tok, hop, side, quote: raw, swapTransaction: built.swapTransaction });
    const tables = await M.loadLookupTables(rpc, M.lookupTableKeysOf(built.swapTransaction));
    const c = M.checkSwapTransaction({ txBase64: built.swapTransaction, wallet, inputMint, outputMint, inputProgram: T, outputProgram: T, amountRaw, quote: raw, slippageCapBps: 100, lookupTables: tables, maxPriorityFeeLamports: 50_000, allowedPairs: new Set([`${USDC}>${tok}`, `${tok}>${USDC}`]), ...x });
    return { ok: true, text: `ok ${route} impact=${(Number(raw.priceImpactPct) * 100).toFixed(2)}% ${c.route.name}`, raw };
  } catch (e) { return { ok: false, text: `REFUSED ${e.clause ?? e.code}: ${e.message.slice(0, 150)}`, raw }; }
}
for (const [tok, sym] of found) {
  const hb = await run(OLD, oj, false, tok, "buy", "25000000");
  if (!hb.raw) { console.log(JSON.stringify({ sym, tok, HEADbuy: hb.text })); continue; }
  const wb = await run(NEW, nj, true, tok, "buy", "25000000");
  const amt = hb.raw.outAmount;
  const hs = await run(OLD, oj, false, tok, "sell", amt);
  const ws = await run(NEW, nj, true, tok, "sell", amt);
  console.log(JSON.stringify({ sym, tok, HEADbuy: hb.text, workingBuy: wb.text, HEADsell: hs.text, workingSell: ws.text }));
}
fs.writeFileSync(`classic-cats-${Date.now()}.json`, JSON.stringify(saved, null, 1));
