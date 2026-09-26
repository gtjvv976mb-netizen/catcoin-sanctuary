import fs from "node:fs";
import { detectCat } from "/home/user/Cat-Intelligence-Agency/bots/lib/catdetect.mjs";
const V = JSON.parse(fs.readFileSync(new URL("./verified.json", import.meta.url)));
const CH = JSON.parse(fs.readFileSync(new URL("./chainread.json", import.meta.url)));
const ch = new Map(CH.rows.map(r => [r.mint, r]));
const rt2 = new Map(JSON.parse(fs.readFileSync(new URL("./routes2.json", import.meta.url))).rows.map(r => [r.mint, r]));
const TOKEN="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", T22="TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const cats = V.filter(t => detectCat({ name: t.name, symbol: t.symbol }).isCat);
const vol = t => t.stats24h ? (t.stats24h.buyVolume ?? 0) + (t.stats24h.sellVolume ?? 0) : null;
const now = Date.parse("2026-09-25T10:21:52Z");
const ageD = t => t.firstPool?.createdAt ? (now - Date.parse(t.firstPool.createdAt))/864e5 : null;
console.log("chainread keys: rows", CH.rows.length, "why counts", CH.rows.reduce((m,r)=>{const k=(r.why??"pass").split(":")[0]+(r.why?.includes("TransferFee")?"/TransferFee":"");m[k]=(m[k]||0)+1;return m},{}));
console.log("chainread sample why", [...new Set(CH.rows.map(r=>r.why).filter(Boolean))]);
for (const L of [1e4, 2.5e4, 5e4, 1e5]) for (const VOL of [0, 1e3, 1e4]) {
  let s = cats.filter(t => t.audit?.mintAuthorityDisabled===true && t.audit?.freezeAuthorityDisabled===true && (t.liquidity??0)>=L && (vol(t)??0)>=VOL);
  const chainPass = s.filter(t=>ch.has(t.id) && !ch.get(t.id).why);
  const notRead = s.filter(t=>!ch.has(t.id)).length;
  console.log(`liq>=${L} vol>=${VOL}: jupiter-audit-clean ${s.length}, chain pass ${chainPass.length} (not read ${notRead}); t22 among pass ${chainPass.filter(t=>t.tokenProgram===T22).length}`);
}
// the 91: what does liq>=10k no audit filter give
console.log("---- all verified cats liq>=25k, vol>=1k, with chain why and route");
for (const t of cats.filter(t=>(t.liquidity??0)>=25e3 && (vol(t)??0)>=1e3).sort((a,b)=>b.liquidity-a.liquidity)) {
  const c = ch.get(t.id); const r = rt2.get(t.id);
  console.log(`${t.symbol.padEnd(10)} ${t.tokenProgram===T22?"T22":"SPL"} liq ${String(Math.round(t.liquidity)).padStart(9)} vol ${String(Math.round(vol(t))).padStart(8)} mcap ${String(Math.round(t.mcap??0)).padStart(10)} age ${ageD(t)?.toFixed(0).padStart(4)} audit m${t.audit?.mintAuthorityDisabled?1:0} f${t.audit?.freezeAuthorityDisabled?1:0} top ${t.audit?.topHoldersPercentage?.toFixed(1)} org ${t.organicScore?.toFixed(0)} chain ${c? (c.why??"pass"):"unread"} ext ${c?.ext?.join("+")} impact$25 ${r? (typeof r.anyRoute==="number"?r.anyRoute.toFixed(2):r.anyRoute):"-"}`);
}
