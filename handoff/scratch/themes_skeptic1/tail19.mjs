import fs from "node:fs";
import { classifyTheme } from "../themes/classifier/themes.mjs";
const SP = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const jl = (f) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(JSON.parse);
const L = jl(`${SP}/themes/raw/graduates/2026-09-25T12-28-33-000Z_launches_snapshot.jsonl`);
const Psnap = new Set(jl(`${SP}/themes/raw/graduates/2026-09-25T12-28-33-000Z_peaks_snapshot.jsonl`).filter((p) => p.ageH === 1).map((p) => p.mint));
const cur = new Map(); for (const p of jl(`${SP}/cohort/peaks.jsonl`)) if (p.ageH === 1 && !cur.has(p.mint)) cur.set(p.mint, p);
const cut = Date.parse("2026-09-25T11:28:15Z");
const miss = L.filter((c) => c.created <= cut && !Psnap.has(c.mint));
for (const c of miss) { const p = cur.get(c.mint); console.log(classifyTheme({ name: c.name, symbol: c.symbol }).theme.padEnd(14), (c.name || "").slice(0, 28).padEnd(30), p ? `later 1h read ath ${Math.round(p.athUsd ?? -1)} at +${((p.at - c.created) / 60e3).toFixed(1)} min` : "no read yet"); }
