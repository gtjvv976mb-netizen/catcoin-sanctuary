import { writeFileSync } from "node:fs";
const tickers = process.argv.slice(2);
for (const t of tickers) {
  const url = `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(t)}`;
  const r = await fetch(url);
  const txt = await r.text();
  writeFileSync(`jup-search-${t}.json`, txt);
  let j; try { j = JSON.parse(txt); } catch { console.log(t, "status", r.status, "non-JSON", txt.slice(0,200)); continue; }
  const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  const exact = arr.filter(x => String(x.symbol ?? "").toUpperCase() === t.toUpperCase());
  console.log(t, "status", r.status, "results", arr.length, "exactSymbol", JSON.stringify(exact.map(x => ({symbol:x.symbol,name:x.name,id:x.id,isVerified:x.isVerified}))), "sample", JSON.stringify(arr.slice(0,5).map(x=>[x.symbol,x.name,x.isVerified])));
}
