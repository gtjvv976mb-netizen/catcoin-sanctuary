import fs from "node:fs";
const c = JSON.parse(fs.readFileSync(new URL("./census.json", import.meta.url)));
const R = c.cats;
const n = (f) => R.filter(f).length;
const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PNnkS9dQ4Mc8Lv";
const TOK = "TokenkegQfeZyiNwAJbNbGKPFXCWuBSf8Ss623VQ5DA";
console.log("total", R.length, "verified", n(r=>r.verified), "verified null", n(r=>r.verified==null), "fromDex (program null)", n(r=>r.program==null));
console.log("programs", Object.entries(R.reduce((a,r)=>(a[r.program]=(a[r.program]??0)+1,a),{})));
const safe = r => r.mintAuthorityDisabled===true && r.freezeAuthorityDisabled===true;
for (const L of [0, 1e3, 5e3, 1e4, 2e4, 2.5e4, 5e4, 1e5, 2.5e5, 5e5, 1e6]) {
  const liq = r => (r.liquidityUsd??0) >= L;
  console.log(`liq>=${L}`.padEnd(14), "all", n(liq), "safe", n(r=>liq(r)&&safe(r)), "ver+safe", n(r=>liq(r)&&safe(r)&&r.verified), "ver+safe+tok", n(r=>liq(r)&&safe(r)&&r.verified&&r.program===TOK), "ver+safe+t22", n(r=>liq(r)&&safe(r)&&r.verified&&r.program===T22), "unver", n(r=>liq(r)&&!r.verified));
}
