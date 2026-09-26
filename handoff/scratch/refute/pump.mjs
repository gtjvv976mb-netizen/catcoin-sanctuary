import fs from "node:fs";
import { createJupiterClient, checkQuote } from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const coins = { LMEOW: "CB8afe6zJDGoCoSHx2iJACqemTUjgpvKKLTa86qMpump", CATWIF: "5pYB12kEhfhSFXJjZ7JtyqDpt6uUqhsF6iu6Ee9spump" };
const out = { at: new Date().toISOString(), rows: [] };
for (const base of ["https://lite-api.jup.ag/swap/v1", "https://api.jup.ag/swap/v1"]) {
  const J = createJupiterClient({ baseUrl: base, intervalMs: 1_300 });
  for (const [sym, mint] of Object.entries(coins)) {
    for (const [side, i, o, amt] of [["buy", USDC, mint, "10000000"], ["sell", mint, USDC, "200000000000"]]) {
      for (const solHop of [false, true]) {
        let res;
        try {
          const q = await J.quote({ inputMint: i, outputMint: o, amountRaw: amt, slippageBps: 100, priority: "live", solHop });
          let chk; try { const c = checkQuote(q, { inputMint: i, outputMint: o, amountRaw: amt, slippageBps: 100, slippageCapBps: 100, maxPriceImpactPct: side === "buy" ? 2 : 100, solHop: true }); chk = `checkQuote ok interm=${c.intermediate}`; } catch (e) { chk = `checkQuote ${e.clause ?? e.code}: ${e.message}`; }
          res = `${q.routePlan.map((h) => h.swapInfo.label).join(">")} out=${q.outAmount} impact=${q.priceImpactPct} | ${chk}`;
        } catch (e) { res = `${e.code}: ${e.message}`; }
        const row = { base, sym, side, ask: solHop ? "working tree (solHop)" : "HEAD (direct)", res };
        out.rows.push(row); console.log(JSON.stringify(row));
      }
    }
  }
}
fs.writeFileSync(new URL(`./pump-${Date.now()}.json`, import.meta.url), JSON.stringify(out, null, 1));
