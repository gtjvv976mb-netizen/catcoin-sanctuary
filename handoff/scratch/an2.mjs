import fs from "node:fs";
const c = JSON.parse(fs.readFileSync(new URL("./census.json", import.meta.url)));
const R = c.cats;
const n = (f) => R.filter(f).length;
const TOK = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const safe = r => r.mintAuthorityDisabled===true && r.freezeAuthorityDisabled===true;
const base = r => (r.liquidityUsd??0) >= 1e4 && safe(r) && r.verified;
const B = R.filter(base);
console.log("base (>=10k, ver, safe):", B.length, "tok", B.filter(r=>r.program===TOK).length, "t22", B.filter(r=>r.program===T22).length);
const q = (arr, p) => { const s=[...arr].sort((a,b)=>a-b); return s[Math.floor((s.length-1)*p)]; };
for (const k of ["liquidityUsd","mcapUsd","holders","organicScore","topHoldersPct","vol24h","price24hPct"]) {
  const v = B.map(r=>r[k]).filter(x=>x!=null);
  console.log(k.padEnd(14), "n", v.length, "nulls", B.length-v.length, "min", q(v,0), "p10", q(v,.1), "p25", q(v,.25), "med", q(v,.5), "p75", q(v,.75), "max", q(v,1));
}
const now = Date.parse(c.at);
const ages = B.map(r=>r.firstPoolAt? (now-Date.parse(r.firstPoolAt))/864e5 : null);
const av = ages.filter(x=>x!=null);
console.log("age days n", av.length, "nulls", ages.length-av.length, "min", q(av,0).toFixed(1), "p10", q(av,.1).toFixed(1), "med", q(av,.5).toFixed(1), "max", q(av,1).toFixed(1));
console.log("age<7d", av.filter(a=>a<7).length, "age<30d", av.filter(a=>a<30).length, "age<90d", av.filter(a=>a<90).length);
console.log("vol24h<1000", B.filter(r=>(r.vol24h??0)<1000).length, "vol24h<5000", B.filter(r=>(r.vol24h??0)<5000).length, "vol24h null", B.filter(r=>r.vol24h==null).length);
console.log("organic<10", B.filter(r=>(r.organicScore??0)<10).length, "organic<25", B.filter(r=>(r.organicScore??0)<25).length, "organic null", B.filter(r=>r.organicScore==null).length);
console.log("topHolders>50", B.filter(r=>(r.topHoldersPct??0)>50).length, ">40", B.filter(r=>(r.topHoldersPct??0)>40).length, ">30", B.filter(r=>(r.topHoldersPct??0)>30).length, "null", B.filter(r=>r.topHoldersPct==null).length);
console.log("holders<500", B.filter(r=>(r.holders??0)<500).length, "holders<1000", B.filter(r=>(r.holders??0)<1000).length);
console.log("tags", Object.entries(B.flatMap(r=>r.tags).reduce((a,t)=>(a[t]=(a[t]??0)+1,a),{})).sort((a,b)=>b[1]-a[1]));
console.log("\nbase list:");
for (const r of B) console.log(r.symbol.padEnd(12), (r.name??"").slice(0,22).padEnd(23), String(Math.round(r.liquidityUsd)).padStart(9), String(Math.round(r.vol24h??-1)).padStart(9), String(r.organicScore?.toFixed?.(1)??"-").padStart(6), String(r.holders??"-").padStart(8), String(r.topHoldersPct?.toFixed?.(1)??"-").padStart(6), r.program===T22?"T22":"tok", (r.firstPoolAt??"").slice(0,10), r.catWord, r.field);
