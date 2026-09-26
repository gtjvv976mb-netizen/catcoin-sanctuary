import fs from "node:fs";
const c = JSON.parse(fs.readFileSync(new URL("./census.json", import.meta.url)));
const R = c.cats;
const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const safe = r => r.mintAuthorityDisabled===true && r.freezeAuthorityDisabled===true;
const U = R.filter(r => !r.verified && (r.liquidityUsd??0) >= 1e4 && !(r.mcapUsd!=null && r.liquidityUsd > r.mcapUsd));
console.log("unverified >=10k, liq<=mcap (or mcap null):", U.length, " of which mcap null:", U.filter(r=>r.mcapUsd==null).length, " safe:", U.filter(safe).length);
console.log(" with vol24h>=10k:", U.filter(r=>(r.vol24h??0)>=1e4).length, " holders>=1000:", U.filter(r=>(r.holders??0)>=1000).length, " organic>=50:", U.filter(r=>(r.organicScore??0)>=50).length);
for (const r of U.sort((a,b)=>(b.vol24h??0)-(a.vol24h??0)).slice(0,40)) console.log(r.symbol.padEnd(12),(r.name??"").slice(0,22).padEnd(23), String(Math.round(r.liquidityUsd)).padStart(10), "mcap", String(Math.round(r.mcapUsd??-1)).padStart(11), "h", String(r.holders??"-").padStart(6), "org", String(r.organicScore?.toFixed?.(1)??"-").padStart(5), "vol", String(Math.round(r.vol24h??-1)).padStart(9), "top", String(r.topHoldersPct?.toFixed?.(0)??"-").padStart(3), r.program===T22?"T22":r.program?"tok":"?", (r.firstPoolAt??"").slice(0,10), safe(r)?"safe":"auth?", r.tags.join("/").slice(0,30), r.via.slice(0,2).join(","));
