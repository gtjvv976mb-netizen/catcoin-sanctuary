import { writeFileSync } from "node:fs";
const D = process.argv[2];
const tickers = process.argv.slice(3);
const summary = {};
for (const t of tickers) {
  const url = `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(t)}`;
  const res = await fetch(url);
  const txt = await res.text();
  writeFileSync(`${D}/NVDAX-jup-${t}.json`, txt);
  let arr; try { arr = JSON.parse(txt); } catch { arr = null; }
  const list = Array.isArray(arr) ? arr : [];
  const same = list.filter((x) => String(x.symbol ?? "").toLowerCase() === t.toLowerCase());
  summary[t] = { http: res.status, results: list.length, sameSymbol: same.map((x) => ({ id: x.id, name: x.name, symbol: x.symbol, isVerified: x.isVerified ?? null, tags: x.tags })), verifiedSameSymbol: same.filter((x) => x.isVerified === true).length, verifiedAny: list.filter(x=>x.isVerified).map(x=>x.symbol) };
}
console.log(JSON.stringify(summary, null, 1));
writeFileSync(`${D}/NVDAX-jup-summary.json`, JSON.stringify(summary, null, 1));
