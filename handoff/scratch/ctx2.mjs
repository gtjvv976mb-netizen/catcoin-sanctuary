import fs from "node:fs";
const c = JSON.parse(fs.readFileSync(new URL("./census.json", import.meta.url)));
const ch = JSON.parse(fs.readFileSync(new URL("./chainread.json", import.meta.url)));
const pass = new Set(ch.rows.filter(r => !r.why).map(r => r.mint));
const now = Date.parse(c.at);
const P = c.cats.filter(r => pass.has(r.mint)).sort((a, b) => (b.vol24h ?? 0) - (a.vol24h ?? 0));
const r4 = (n) => n == null ? null : Number(n.toPrecision(4));
const COLS = ["mint","symbol","priceUsd","chg1hPct","chg6hPct","chg24hPct","vol1hUsd","vol24hUsd","buys1h","sells1h","buys24h","sells24h","liqUsd","mcapUsd","buyImpactPct","roundTripPct","holders","top10PctJup","ageDays","held","focus"];
const row = (r) => [r.mint, r.symbol, r4(r.mcapUsd / 1e8), r4(r.price24hPct ?? 1.23), 2.31, r4(r.price24hPct ?? 4.56), Math.round((r.vol24h ?? 0) / 24), Math.round(r.vol24h ?? 0), 117, 145, 1186, 1109, Math.round(r.liquidityUsd), Math.round(r.mcapUsd), 0.499, 0.514, r.holders, r4(r.topHoldersPct), Math.round((now - Date.parse(r.firstPoolAt)) / 864e5), false, false];
for (const N of [10, 24, 30, 40, 64]) {
  const rows = P.slice(0, N).map(row);
  const text = "The board: every cat coin the scout admitted, one per line. Columns: " + COLS.join(",") + "\n" + rows.map((x) => JSON.stringify(x)).join("\n");
  const pretty = JSON.stringify(rows.map((x) => Object.fromEntries(COLS.map((k, i) => [k, x[i]]))), null, 1);
  console.log(`board ${N}: compact ${text.length} chars (~${Math.round(text.length / 3.2)} tok est), as indented objects ${pretty.length} chars (~${Math.round(pretty.length / 3.2)} tok est); per row compact ${Math.round(text.length / N)}`);
}
