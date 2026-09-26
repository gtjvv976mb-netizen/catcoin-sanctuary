import fs from "node:fs";
import { detectCat } from "/home/user/Cat-Intelligence-Agency/bots/lib/catdetect.mjs";
const V = JSON.parse(fs.readFileSync(new URL("./verified.json", import.meta.url)));
const ch = new Map(JSON.parse(fs.readFileSync(new URL("./chainread.json", import.meta.url))).rows.map(r => [r.mint, r]));
const rt = new Map(JSON.parse(fs.readFileSync(new URL("./routes.json", import.meta.url))).rows.map(r => [r.mint, r]));
const r2 = JSON.parse(fs.readFileSync(new URL("./routes2.json", import.meta.url))).rows;
const cats = V.filter(t => detectCat({ name: t.name, symbol: t.symbol }).isCat);
const vol = t => t.stats24h ? (t.stats24h.buyVolume ?? 0) + (t.stats24h.sellVolume ?? 0) : null;
console.log("verified list", V.length, "cats by detectCat", cats.length, "missing stats24h", cats.filter(t=>!t.stats24h).length, "missing liquidity", cats.filter(t=>t.liquidity==null).length, "missing mcap", cats.filter(t=>t.mcap==null).length, "missing audit", cats.filter(t=>!t.audit).length);
for (const [L, VOL] of [[1e4, 0], [1e4, 1e3], [2.5e4, 0], [2.5e4, 1e3], [5e4, 1e3]]) {
  const a = cats.filter(t => (t.liquidity ?? 0) >= L);
  const b = a.filter(t => (vol(t) ?? 0) >= VOL);
  const c = b.filter(t => !(t.mcap != null && t.liquidity > t.mcap));
  const d = c.filter(t => ch.has(t.id) ? !ch.get(t.id).why : null);
  const unread = c.filter(t => !ch.has(t.id)).length;
  const e = d.filter(t => rt.get(t.id)?.buyStatus === 200);
  const f = e.filter(t => rt.get(t.id).buyImpactPct <= 2);
  console.log(`liq>=${L} vol>=${VOL}: floors ${b.length}, liq<=mcap ${c.length}, chain pass ${d.length} (not in my chain read ${unread}), direct USDC ${e.length}, <=2% at $25 ${f.length}: ${f.map(t=>t.symbol).join(",")}`);
}
const sol2 = r2.filter(x => /^[^ ]+:USDC>SOL [^ ]+:SOL>/.test(x.hops) && x.hops.split(" ").length === 2);
console.log("active 24: two-hop via SOL", sol2.length, "<=2%", sol2.filter(x=>x.anyRoute<=2).map(x=>x.symbol+" "+x.anyRoute.toFixed(2)).join(", "), "| 3-hop", r2.filter(x=>x.hops.split(" ").length===3).map(x=>x.symbol+" "+x.anyRoute.toFixed(2)).join(", "), "| direct", r2.filter(x=>x.hops.split(" ").length===1).map(x=>x.symbol+" "+x.anyRoute.toFixed(2)).join(", "));
