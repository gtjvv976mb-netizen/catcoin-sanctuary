import fs from "node:fs";
for (const q of process.argv.slice(2)) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`); const t = await r.text();
  fs.writeFileSync(`jup-search-${q.replace(/[^A-Za-z0-9]/g,"_")}.json`, t);
  const j = JSON.parse(t); const arr = Array.isArray(j) ? j : (j.tokens || []);
  const same = arr.filter((x) => String(x.symbol).toLowerCase() === q.toLowerCase());
  console.log(q, r.status, "results", arr.length, "same", same.length, "sameVerified", same.filter(x=>x.isVerified===true).length, "| verified any:", arr.filter(x=>x.isVerified===true).map(x=>x.symbol+"/"+x.name).join("; "));
}
