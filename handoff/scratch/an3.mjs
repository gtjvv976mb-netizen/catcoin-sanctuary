import fs from "node:fs";
const c = JSON.parse(fs.readFileSync(new URL("./census.json", import.meta.url)));
const R = c.cats; const now = Date.parse(c.at);
const TOK = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const safe = r => r.mintAuthorityDisabled===true && r.freezeAuthorityDisabled===true;
const B = R.filter(r => (r.liquidityUsd??0) >= 1e4 && safe(r) && r.verified);
// activity tiers
for (const V of [0, 100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000]) {
  const s = B.filter(r => (r.vol24h??0) >= V);
  console.log(`vol24h>=${V}`.padEnd(14), s.length, " liq>=25k:", s.filter(r=>r.liquidityUsd>=25e3).length, " liq>=50k:", s.filter(r=>r.liquidityUsd>=5e4).length, " organic>0:", s.filter(r=>r.organicScore>0).length);
}
// vol/liq turnover
console.log("\nturnover vol24h/liq among base, >=0.05:", B.filter(r=>(r.vol24h??0)/r.liquidityUsd>=0.05).length, ">=0.02:", B.filter(r=>(r.vol24h??0)/r.liquidityUsd>=0.02).length);
// unverified cluster
console.log("\nunverified >= $1M:");
for (const r of R.filter(r=>!r.verified && (r.liquidityUsd??0)>=1e6)) console.log(r.symbol.padEnd(12),(r.name??"").slice(0,22).padEnd(23), String(Math.round(r.liquidityUsd)).padStart(10), "mcap", String(Math.round(r.mcapUsd??-1)).padStart(10), "h", String(r.holders??"-").padStart(6), "org", String(r.organicScore?.toFixed?.(1)??"-").padStart(5), "vol", String(Math.round(r.vol24h??-1)).padStart(8), r.program===T22?"T22":r.program===TOK?"tok":"?", (r.firstPoolAt??"").slice(0,10), r.mintAuthorityDisabled, r.freezeAuthorityDisabled, r.via.slice(0,2).join(","));
// liq > mcap check
console.log("\nliq > mcap anywhere:", R.filter(r=>r.liquidityUsd!=null&&r.mcapUsd!=null&&r.liquidityUsd>r.mcapUsd).length, " among unverified >=1M:", R.filter(r=>!r.verified&&(r.liquidityUsd??0)>=1e6&&r.mcapUsd!=null&&r.liquidityUsd>r.mcapUsd).length, " among base:", B.filter(r=>r.liquidityUsd>r.mcapUsd).length);
console.log("liq/mcap > 0.5 in base:", B.filter(r=>r.liquidityUsd/r.mcapUsd>0.5).map(r=>r.symbol+":"+(r.liquidityUsd/r.mcapUsd).toFixed(2)).join(" "));
// verified but not safe
console.log("\nverified >=10k but NOT safe:", R.filter(r=>r.verified&&(r.liquidityUsd??0)>=1e4&&!safe(r)).map(r=>`${r.symbol} m${r.mintAuthorityDisabled} f${r.freezeAuthorityDisabled} ${Math.round(r.liquidityUsd)}`).join(" | "));
console.log("verified count", R.filter(r=>r.verified).length, "verified <10k", R.filter(r=>r.verified&&(r.liquidityUsd??0)<1e4).length);
// via sources for base
const via = {}; for (const r of B) for (const v of r.via) { const k=v.split(":")[0]; via[k]=(via[k]??0)+1; }
console.log("\nbase via:", via);
console.log("base reachable ONLY via search terms:", B.filter(r=>!r.via.includes("verified-list")).length);
console.log("base in verified-list:", B.filter(r=>r.via.includes("verified-list")).length);
