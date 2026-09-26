import fs from "node:fs";
import { classifyTheme } from "../themes/classifier/themes.mjs";
const SP = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const jl = (f) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(JSON.parse);
const L = new Map(jl(`${SP}/themes/raw/graduates/2026-09-25T12-28-33-000Z_launches_snapshot.jsonl`).map((c) => [c.mint, c]));
const P = jl(`${SP}/themes/raw/graduates/2026-09-25T12-28-33-000Z_peaks_snapshot.jsonl`).filter((p) => p.ageH === 1 && p.athUsd != null);
const rows = P.map((p) => { const c = L.get(p.mint); const t = classifyTheme({ name: c.name, symbol: c.symbol }); return { name: c.name, theme: t.theme, word: t.word, ath: p.athUsd }; });
for (const th of ["other-animal", "cat", "dog", "celebrity", "crypto-finance"]) {
  const a = rows.filter((r) => r.theme === th); const w = {}; for (const r of a) { w[r.word] ??= [0, 0]; w[r.word][0]++; if (r.ath >= 1e4) w[r.word][1]++; }
  console.log(th, a.length, Object.entries(w).sort((x, y) => y[1][0] - x[1][0]).slice(0, 10).map(([k, v]) => `${k}:${v[0]}/${v[1]}hit`).join(" "));
  const nm = {}; for (const r of a) { const k = r.name.trim().toLowerCase(); nm[k] ??= [0, 0]; nm[k][0]++; if (r.ath >= 1e4) nm[k][1]++; }
  console.log("   top names:", Object.entries(nm).sort((x, y) => y[1][0] - x[1][0]).slice(0, 6).map(([k, v]) => `${k}:${v[0]}/${v[1]}`).join(" | "));
}
