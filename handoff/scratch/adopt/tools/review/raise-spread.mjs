// READ-ONLY: read total_quote_fund_raising (PoolState offset 69) of recorded launches per stock, to see
// whether StonkFun records pools whose raise differs from its live pricing (tolerance of the "raise" field).
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync(new URL("../../raw/review/feed-recorded.out.json", import.meta.url)));
const v = JSON.parse(fs.readFileSync(new URL("../../raw/review/verify-91.out.json", import.meta.url)));
const priceNow = Object.fromEntries(v.rows.filter(r => r.pricing).map(r => [r.stock, r.pricing.raw]));
const L = d.launches.filter(x => x.pool);
const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getMultipleAccounts", params: [L.map(x => x.pool), { encoding: "base64", dataSlice: { offset: 69, length: 8 } }] }) });
const j = await r.json();
const rows = L.map((x, i) => { const b = Buffer.from(j.result.value[i].data[0], "base64"); const raise = b.readBigUInt64LE(0).toString();
  return { stock: x.stock, sig: x.sig.slice(0, 10), recorded: x.stonkfun?.status === 200, lag: x.stonkfun?.launchLagSec, raise, pricingNow: priceNow[x.stock], ratio: priceNow[x.stock] ? Number(raise) / Number(priceNow[x.stock]) : null }; });
fs.writeFileSync(new URL("../../raw/review/raise-spread.out.json", import.meta.url), JSON.stringify(rows, null, 1));
const by = {}; for (const x of rows) (by[x.stock] ??= []).push(x.ratio?.toFixed(3));
console.log(JSON.stringify(by)); console.log("recorded with ratio outside 0.9..1.1:", rows.filter(x => x.recorded && (x.ratio < 0.9 || x.ratio > 1.1)).map(x => [x.stock, x.ratio?.toFixed(3), x.lag]));
