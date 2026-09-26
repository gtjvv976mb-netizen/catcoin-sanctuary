import { writeFileSync } from "node:fs";
for (const q of ["Couch Captain", "Couch Captain Cat", "Pawse Button", "Pawse Button Tabby", "COUCH", "PAUSE"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`); const t = await r.text();
  writeFileSync(`METAX-jupname-${q.replace(/ /g, "_")}.json`, t);
  const a = JSON.parse(t); const arr = Array.isArray(a) ? a : (a.tokens || []);
  console.log(q, "|", r.status, "|", arr.length, "|", arr.slice(0, 12).map((x) => `${x.symbol}/${x.name}/v=${x.isVerified}/mc=${Math.round(x.mcap || 0)}`).join("; "));
}
