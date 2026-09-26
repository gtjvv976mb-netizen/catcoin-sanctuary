import fs from "node:fs";
import { detectCat } from "/home/user/Cat-Intelligence-Agency/bots/lib/catdetect.mjs";
const V = JSON.parse(fs.readFileSync(new URL("./verified.json", import.meta.url)));
const ch = new Map(JSON.parse(fs.readFileSync(new URL("./chainread.json", import.meta.url))).rows.map(r => [r.mint, r]));
const rt2 = new Map(JSON.parse(fs.readFileSync(new URL("./routes2.json", import.meta.url))).rows.map(r => [r.mint, r]));
const now = Date.parse("2026-09-25T10:21:52Z");
const vol = t => t.stats24h ? (t.stats24h.buyVolume ?? 0) + (t.stats24h.sellVolume ?? 0) : null;
const ageD = t => t.firstPool?.createdAt ? (now - Date.parse(t.firstPool.createdAt))/864e5 : null;
const cats = V.filter(t => detectCat({ name: t.name, symbol: t.symbol }).isCat);
function run(L, VOL, AGE, label) {
  const refused = {};
  const r = (k) => refused[k] = (refused[k]||0)+1;
  const pass = [];
  for (const t of cats) {
    if (t.liquidity == null) { r("unmeasured:liquidity"); continue; }
    if (t.liquidity < L) { r("liquidity"); continue; }
    if (vol(t) == null) { r("unmeasured:volume"); continue; }
    if (vol(t) < VOL) { r("volume"); continue; }
    if (AGE > 0 && ageD(t) == null) { r("unmeasured:age"); continue; }
    if (AGE > 0 && ageD(t) < AGE) { r("age"); continue; }
    if (t.mcap == null) { r("unmeasured:mcap"); continue; }
    if (t.liquidity > t.mcap) { r("liq>mcap"); continue; }
    pass.push(t);
  }
  pass.sort((a,b)=>b.liquidity-a.liquidity || (a.id<b.id?-1:1));
  const chainOk = pass.filter(t => { const c = ch.get(t.id); if (!c) { r("chain:unread"); return false; } if (c.why) { r("chain:"+(c.why.includes("TransferFee")?"TransferFeeConfig":c.why)); return false;} return true; });
  const board = chainOk.slice(0,10);
  const imp = board.map(t=>rt2.get(t.id)?.anyRoute);
  console.log(`${label}: jupiter-floors pass ${pass.length}, chain pass ${chainOk.length}, board ${board.length}: ${board.map((t,i)=>`${t.symbol}(${typeof imp[i]==="number"?imp[i].toFixed(2)+"%":"?"})`).join(" ")}  refused ${JSON.stringify(refused)}`);
}
run(25e3, 1e3, 30, "defaults 25k/1k/30d");
run(25e3, 1e3, 0, "25k/1k/no age");
run(1e4, 0, 0, "loosest 10k/0/0");
run(1e5, 1e4, 30, "strict 100k/10k/30d");
run(5e4, 1e3, 30, "50k/1k/30d");
// payload: mean bytes per token in verified list
console.log("verified list bytes", fs.statSync(new URL("./verified.json", import.meta.url)).size, "per token", Math.round(fs.statSync(new URL("./verified.json", import.meta.url)).size/V.length));
console.log("keys of a token", Object.keys(V[0]).join(","));
console.log("audit keys", Object.keys(cats[0].audit||{}).join(","), "firstPool", JSON.stringify(cats[0].firstPool), "stats24h keys", Object.keys(cats[0].stats24h||{}).join(","));
