import fs from "node:fs";
import { classifyTheme } from "../themes/classifier/themes.mjs";
const R = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/themes/raw/graduates";
const jl = (f) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(JSON.parse);
const L = new Map(jl(`${R}/2026-09-25T12-28-33-000Z_launches_snapshot.jsonl`).map((c) => [c.mint, c]));
const P = jl(`${R}/2026-09-25T12-28-33-000Z_peaks_snapshot.jsonl`).filter((p) => p.ageH === 1);
const nul = P.filter((p) => p.athUsd == null);
const t = {}; for (const p of nul) { const c = L.get(p.mint); const th = classifyTheme({ name: c.name, symbol: c.symbol }).theme; t[th] = (t[th] ?? 0) + 1; }
console.log("null-ath by theme", t, "mcapUsd max", Math.max(...nul.map((p) => p.mcapUsd ?? 0)).toFixed(0), "mcap>=10k", nul.filter((p) => p.mcapUsd >= 1e4).length);
console.log("created range", new Date(Math.min(...nul.map((p) => L.get(p.mint).created))).toISOString(), new Date(Math.max(...nul.map((p) => L.get(p.mint).created))).toISOString());
const a = P.find((p) => p.mint.startsWith("ATCMtc")); const c = L.get(a.mint); console.log("ATCMtc", c.name, c.symbol, classifyTheme({ name: c.name, symbol: c.symbol }).theme, a.athUsd, a.complete);
// later reads for ATCMtc and nulls in live peaks
const cur = jl("/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/cohort/peaks.jsonl");
console.log("ATCMtc later rows", cur.filter((p) => p.mint === a.mint).map((p) => `${p.ageH}:${Math.round(p.athUsd)}:${p.complete}`));
const nm = new Set(nul.map((p) => p.mint)); const later = cur.filter((p) => nm.has(p.mint) && p.ageH > 1);
console.log("null-ath coins re-read later", later.length, later.map((p) => `${p.ageH}:${p.athUsd}`).slice(0, 10));
