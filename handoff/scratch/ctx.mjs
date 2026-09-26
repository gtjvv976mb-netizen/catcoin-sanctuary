import { parseDexScreenerTokens, parseGeckoOhlcv, indicatorsFrom } from "/home/user/Cat-Intelligence-Agency/src/lib/agent-market.mjs";
import fs from "node:fs";
const ds = JSON.parse(fs.readFileSync("/home/user/Cat-Intelligence-Agency/fixtures/agent/dexscreener-tokens-cats.json"));
const gk = JSON.parse(fs.readFileSync("/home/user/Cat-Intelligence-Agency/fixtures/agent/geckoterminal-ohlcv-jup-15m.json"));
const parsed = parseDexScreenerTokens(ds.body, ds.mints);
const ind = indicatorsFrom(parseGeckoOhlcv(gk.body ?? gk));
const rows = ds.mints.map((m) => ({ mint: m, symbol: "POPCAT", priceUsd: parsed[m].priceUsd, change1hPct: parsed[m].change1hPct, change24hPct: parsed[m].change24hPct, volume24hUsd: parsed[m].volume24hUsd, liquidityUsd: parsed[m].liquidityUsd, indicators: ind, missing: [] }));
const one = JSON.stringify(rows[0], null, 1);
console.log("mints in fixture", ds.mints.length, "one row chars", one.length, "bars", ind.bars);
for (const n of [6, 10, 20, 30]) { const s = JSON.stringify({ market: Array(n).fill(rows[0]) }, null, 1); console.log(n, "chars", s.length, "~tokens", Math.round(s.length / 3.2)); }
