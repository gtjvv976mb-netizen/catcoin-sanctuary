import fs from "node:fs";
const ch = JSON.parse(fs.readFileSync(new URL("./chainread.json", import.meta.url)));
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", WSOL = "So11111111111111111111111111111111111111112";
const rows = ch.rows.filter(r => !r.why && (r.vol ?? 0) >= 1000);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const q = async (inputMint, outputMint, amount, direct) => {
  const p = { inputMint, outputMint, amount: String(amount), slippageBps: "100", swapMode: "ExactIn", restrictIntermediateTokens: "true", instructionVersion: "V2" };
  if (direct) p.onlyDirectRoutes = "true";
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`https://api.jup.ag/swap/v1/quote?` + new URLSearchParams(p)); const t = await res.text(); await sleep(2300);
    if (res.status === 429) { await sleep(10000); continue; }
    let j = null; try { j = JSON.parse(t); } catch {}
    return { status: res.status, body: j };
  }
  return { status: 429, body: null };
};
const out = [];
for (const r of rows) {
  const t = await q(USDT, r.mint, 25_000_000, true);
  const m = await q(USDC, r.mint, 25_000_000, false);
  const hops = m.body?.routePlan?.map(x => `${x.swapInfo?.label}:${x.swapInfo?.inputMint===USDC?"USDC":x.swapInfo?.inputMint===WSOL?"SOL":x.swapInfo?.inputMint?.slice(0,4)}>${x.swapInfo?.outputMint===WSOL?"SOL":x.swapInfo?.outputMint===r.mint?r.symbol:x.swapInfo?.outputMint?.slice(0,4)}${x.percent!=null&&x.percent!==100?`(${x.percent}%)`:""}`).join(" ");
  const rec = { mint: r.mint, symbol: r.symbol, vol: r.vol, usdtDirect: t.status === 200 ? Number(t.body.priceImpactPct) * 100 : (t.body?.errorCode ?? t.status), anyRoute: m.status === 200 ? Number(m.body.priceImpactPct) * 100 : (m.body?.errorCode ?? m.status), hops };
  out.push(rec); console.log(JSON.stringify(rec));
}
fs.writeFileSync(new URL("./routes2.json", import.meta.url), JSON.stringify({ at: new Date().toISOString(), sizeUsd: 25, rows: out }, null, 1));
console.log("DONE");
