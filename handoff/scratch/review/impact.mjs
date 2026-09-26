/* The 2% buy-impact cap on the agent's one-hop ask: Jupiter's reported priceImpactPct for a
   $25 buy, against the out-per-dollar of a $1 buy asked the same way the same minute. */
import fs from "node:fs";
import { createJupiterClient, checkQuote } from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOK = { GRUMPY: "GRUmPYbiTpq9ZPy5LAqBMMze7kErf5dEX2i9qYfwoSmR", KWIF: "6Rwcmkz9yiYVM5EzyMcr4JsQPGEAWhcUvLvfBperYnUt", KHAI: "3TWgDvYBL2YPET2LxnWAwsMeoA8aL4DutNuwat2pKCjC", KITTY: "4N4DnNo3qpPks9aQCkcWkzoir8tnvT6diS4TnnZibonk", MEW: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5" };
const jup = createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_200 });
const rounds = Number(process.env.ROUNDS ?? 2);
const saved = [];
for (let r = 0; r < rounds; r++) for (const [sym, t] of Object.entries(TOK)) {
  try {
    const small = await jup.quote({ inputMint: USDC, outputMint: t, amountRaw: "1000000", slippageBps: 100, priority: "live", solHop: true });
    const big = await jup.quote({ inputMint: USDC, outputMint: t, amountRaw: "25000000", slippageBps: 100, priority: "live", solHop: true });
    saved.push({ at: new Date().toISOString(), sym, small, big });
    const perSmall = Number(small.outAmount) / 1, perBig = Number(big.outAmount) / 25;
    const measured = (1 - perBig / perSmall) * 100;
    let verdict;
    try { checkQuote(big, { inputMint: USDC, outputMint: t, amountRaw: "25000000", slippageBps: 100, slippageCapBps: 100, maxPriceImpactPct: 2, solHop: true }); verdict = "ACCEPTED"; } catch (e) { verdict = e.clause; }
    console.log(JSON.stringify({ round: r, sym, route25: big.routePlan.map((h) => h.swapInfo.label).join(">"), route1: small.routePlan.map((h) => h.swapInfo.label).join(">"), reportedPct: (Number(big.priceImpactPct) * 100).toFixed(3), reportedPct1: (Number(small.priceImpactPct) * 100).toFixed(3), measuredVs1Pct: measured.toFixed(3), verdict }));
  } catch (e) { console.log(JSON.stringify({ sym, error: `${e.code ?? e.clause}: ${e.message}` })); }
}
fs.writeFileSync(`impact-${Date.now()}.json`, JSON.stringify(saved, null, 1));
