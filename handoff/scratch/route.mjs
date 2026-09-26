import fs from "node:fs";
const ch = JSON.parse(fs.readFileSync(new URL("./chainread.json", import.meta.url)));
const c = JSON.parse(fs.readFileSync(new URL("./census.json", import.meta.url)));
const byMint = new Map(c.cats.map(r => [r.mint, r]));
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const rows = ch.rows.filter(r => !r.why);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const q = async (inputMint, outputMint, amount) => {
  const u = `https://api.jup.ag/swap/v1/quote?` + new URLSearchParams({ inputMint, outputMint, amount: String(amount), slippageBps: "100", swapMode: "ExactIn", onlyDirectRoutes: "true", restrictIntermediateTokens: "true", instructionVersion: "V2" });
  for (let i = 0; i < 3; i++) {
    const res = await fetch(u); const t = await res.text(); await sleep(2300);
    if (res.status === 429) { await sleep(10000); continue; }
    let j = null; try { j = JSON.parse(t); } catch {}
    return { status: res.status, body: j };
  }
  return { status: 429, body: null };
};
const out = [];
for (const r of rows) {
  const buy = await q(USDC, r.mint, 25_000_000);
  let rec = { mint: r.mint, symbol: r.symbol, liq: r.liq, vol: r.vol, buyStatus: buy.status, buyErr: buy.body?.errorCode ?? null };
  if (buy.status === 200 && buy.body?.outAmount) {
    rec.buyImpactPct = Number(buy.body.priceImpactPct) * 100; rec.buyAmm = buy.body.routePlan?.map(x => x.swapInfo?.label).join("+"); rec.out = buy.body.outAmount;
    const sell = await q(r.mint, USDC, buy.body.outAmount);
    rec.sellStatus = sell.status; rec.sellErr = sell.body?.errorCode ?? null;
    if (sell.status === 200 && sell.body?.outAmount) { rec.sellImpactPct = Number(sell.body.priceImpactPct) * 100; rec.backUsd = Number(sell.body.outAmount) / 1e6; rec.roundTripLossPct = (1 - rec.backUsd / 25) * 100; rec.sellAmm = sell.body.routePlan?.map(x => x.swapInfo?.label).join("+"); }
  }
  out.push(rec);
  console.log(JSON.stringify(rec));
}
fs.writeFileSync(new URL("./routes.json", import.meta.url), JSON.stringify({ at: new Date().toISOString(), sizeUsd: 25, rows: out }, null, 1));
console.log("DONE");
