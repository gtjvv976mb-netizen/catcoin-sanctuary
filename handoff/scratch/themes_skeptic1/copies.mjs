import fs from "node:fs";
import { classifyTheme } from "../themes/classifier/themes.mjs";
const R = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/themes/raw/graduates";
const jl = (f) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(JSON.parse);
const L = new Map(jl(`${R}/2026-09-25T12-28-33-000Z_launches_snapshot.jsonl`).map((c) => [c.mint, c]));
const P = jl(`${R}/2026-09-25T12-28-33-000Z_peaks_snapshot.jsonl`).filter((p) => p.ageH === 1 && p.athUsd != null);
const rows = P.map((p) => { const c = L.get(p.mint); return { name: c.name, symbol: c.symbol, ath: p.athUsd, created: c.created, theme: classifyTheme({ name: c.name, symbol: c.symbol }).theme, word: classifyTheme({ name: c.name, symbol: c.symbol }).word }; });
for (const re of [/\bmiau\b/i, /ansem/i, /backpack/i, /spidey\s*cat/i]) { const a = rows.filter((r) => re.test(`${r.name} ${r.symbol}`)); console.log(re, "n", a.length, "10k", a.filter((r) => r.ath >= 1e4).length, "20k", a.filter((r) => r.ath >= 2e4).length); }
// name groups with >=5 copies in A: hit rate of copies vs singletons
const g = new Map(); for (const r of rows) { const k = `${r.name.trim().toLowerCase()}|${r.symbol.trim().toLowerCase()}`; if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
let cN = 0, cK = 0, sN = 0, sK = 0; for (const a of g.values()) { if (a.length >= 5) { cN += a.length; cK += a.filter((r) => r.ath >= 1e4).length; } else if (a.length === 1) { sN++; sK += a[0].ath >= 1e4; } }
console.log("A: names with >=5 copies:", cK + "/" + cN, (100 * cK / cN).toFixed(1) + "%", " singletons:", sK + "/" + sN, (100 * sK / sN).toFixed(1) + "%");
// Newcombe cat vs rest at 10k
function wilson(k, n, z = 1.96) { const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [c - h, c + h]; }
function newcombe(k1, n1, k2, n2) { const p1 = k1 / n1, p2 = k2 / n2, [l1, u1] = wilson(k1, n1), [l2, u2] = wilson(k2, n2), d = p1 - p2; return [d - Math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2), d + Math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2)].map((x) => (100 * x).toFixed(1)); }
console.log("cat vs rest 10k Newcombe diff CI (pts):", newcombe(33, 185, 193, 1903), " excl-instant:", newcombe(30, 182, 156, 1866));
