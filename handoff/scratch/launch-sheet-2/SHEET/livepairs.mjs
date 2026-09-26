import fs from "node:fs";
const r = await fetch("https://stonkfun.xyz/api/public/v1/pairs");
const j = await r.json();
fs.writeFileSync("pairs-live.json", JSON.stringify(j));
const live = j.data?.pairs ?? j.pairs ?? j.data ?? [];
const byMint = Object.fromEntries(live.map((p) => [p.mint, p]));
const sheet = JSON.parse(fs.readFileSync("../launch-sheet.json"));
const out = { fetchedAt: new Date().toISOString(), status: r.status, livePairs: live.length, checked: 0, missing: [], changed: [] };
for (const c of sheet) for (const p of c.pairChoices) {
  out.checked++;
  const l = byMint[p.mint];
  if (!l) { out.missing.push([c.ticker, p.mint]); continue; }
  for (const k of ["symbol", "category", "launchable", "launchLabReady", "tokenProgram", "symbolAmbiguous", "decimals"]) if (l[k] !== p[k]) out.changed.push([c.ticker, k, p[k], l[k]]);
}
fs.writeFileSync("livepairs.out.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 3000));
