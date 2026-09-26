// Skeptic 1: independent re-derivation of rows A and B, graduation and instant-buyout figures.
// Reads only saved raw files (themes/raw/graduates, cohort snapshots, milestones/graduates rpc_sigs + sample).
// Uses the saved classifier (themes/classifier/themes.mjs v4). No network.
import fs from "node:fs";
import path from "node:path";
import { classifyTheme, THEMES, VERSION } from "../themes/classifier/themes.mjs";

const SP = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const RAW = `${SP}/themes/raw/graduates`;
const H = 3600e3, SOL = "11111111111111111111111111111111";
const iso = (t) => new Date(t).toISOString();
const out = { classifier: VERSION };
const th = (name, symbol) => classifyTheme({ name: name ?? "", symbol: symbol ?? "" }).theme;
const jl = (f) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
function wilson(k, n, z = 1.96) { if (!n) return [null, null]; const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [c - h, c + h]; }

/* ---------- raw listing pages: scan the raw dir directly (not the manifest) ---------- */
const files = fs.readdirSync(RAW).sort();
function listing(kind) {
  const pages = files.filter((f) => f.includes(`_${kind}_off`));
  // for each offset keep the LAST successful fetch (what a retry loop would keep) and also collect union of all
  const byOff = new Map(), all = new Map(); let rows = 0;
  for (const f of pages) {
    const j = JSON.parse(fs.readFileSync(`${RAW}/${f}`));
    if (!Array.isArray(j.body)) continue;
    const off = +f.match(/off(\d+)/)[1];
    byOff.set(off, { f, j });
    for (const c of j.body) { rows++; if (!all.has(c.mint)) all.set(c.mint, { ...c, _fetchedAt: j.fetchedAt, _file: f }); }
  }
  return { pages: pages.length, okOffsets: [...byOff.keys()].sort((a, b) => a - b), rows, all };
}
const NEW = listing("newest"), GRAD = listing("graduated");
// the 12:10 newest run only (there is also an 12:10:06 file gw0001 at off 0)
out.listings = { newest: { pageFiles: NEW.pages, okOffsets: NEW.okOffsets.length, rows: NEW.rows, unique: NEW.all.size },
  graduated: { pageFiles: GRAD.pages, okOffsets: GRAD.okOffsets.length, rows: GRAD.rows, unique: GRAD.all.size } };
// sanity: all graduated-listing coins complete?
const gradCoins = [...GRAD.all.values()];
out.listings.graduated.notComplete = gradCoins.filter((c) => c.complete !== true).length;
const gFetch = gradCoins.map((c) => c._fetchedAt).sort();
const T_G = Date.parse(gFetch[0]);

/* ---------- GT pool creation times from raw gtmulti files ---------- */
const poolCreated = new Map();
for (const f of files.filter((f) => f.includes("_gtmulti_"))) {
  const j = JSON.parse(fs.readFileSync(`${RAW}/${f}`));
  const data = j.body?.data ?? [];
  for (const p of data) { const a = p.attributes?.address ?? p.id?.replace(/^solana_/, ""); if (a && p.attributes?.pool_created_at) poolCreated.set(a, p.attributes.pool_created_at); }
}
out.gtPoolsFromRaw = poolCreated.size;

/* ---------- graduates ---------- */
const G = gradCoins.map((c) => {
  const pool = c.pump_swap_pool || c.pool_address;
  const pc = poolCreated.get(pool);
  const gradMin = pc ? (Date.parse(pc) - c.created_timestamp) / 60e3 : null;
  return { mint: c.mint, name: c.name ?? "", symbol: c.symbol ?? "", created: c.created_timestamp, ath: c.ath_market_cap, mcapQuote: c.market_cap, quote: c.quote_mint ?? SOL,
    theme: th(c.name, c.symbol), pool, gradMin, instant: gradMin != null && gradMin <= 1, real: c.ath_market_cap >= 30e3 };
});
const Gm = new Map(G.map((g) => [g.mint, g]));
const real = G.filter((g) => g.real), realPT = real.filter((g) => g.gradMin != null);
const inst = realPT.filter((g) => g.instant);
const floor = realPT.filter((g) => g.quote === SOL && g.mcapQuote <= 25);
out.graduates = { n: G.length, missingPoolTime: G.filter((g) => g.gradMin == null).length, real: real.length, realWithPoolTime: realPT.length, instant: inst.length,
  instantShare: inst.length / realPT.length, floorDumped: floor.length,
  gradMinOver60: G.filter((g) => g.gradMin != null && g.gradMin > 60).length, gradMinKnown: G.filter((g) => g.gradMin != null).length,
  realGradMinOver60: realPT.filter((g) => g.gradMin > 60).length,
  negativeGradMin: G.filter((g) => g.gradMin != null && g.gradMin < 0).length };
// quote mints of graduates (floor rule only applies to SOL quote)
const qc = {}; for (const g of G) qc[g.quote] = (qc[g.quote] ?? 0) + 1; out.graduates.quoteMints = qc;
out.instantByTheme = {};
for (const t of THEMES) { const r = realPT.filter((g) => g.theme === t); const k = r.filter((g) => g.instant).length; out.instantByTheme[t] = `${k}/${r.length}` + (r.length ? ` = ${(100 * k / r.length).toFixed(1)}%` : ""); }
// name sharing among graduates: case-insensitive name|symbol, and name only
const cnt = (key) => { const m = new Map(); for (const g of G) { const k = key(g); m.set(k, (m.get(k) ?? 0) + 1); } return G.filter((g) => m.get(key(g)) > 1).length; };
out.graduates.shareNameSymbolWithAnother = cnt((g) => `${g.name.trim().toLowerCase()}|${g.symbol.trim().toLowerCase()}`);
out.graduates.shareNameOnlyWithAnother = cnt((g) => g.name.trim().toLowerCase());
out.graduates.shareSymbolOnlyWithAnother = cnt((g) => g.symbol.trim().toLowerCase());

/* ---------- Row A: 1 h re-reads ---------- */
const LSNAP = `${RAW}/2026-09-25T12-28-33-000Z_launches_snapshot.jsonl`, PSNAP = `${RAW}/2026-09-25T12-28-33-000Z_peaks_snapshot.jsonl`;
const L = jl(LSNAP), P = jl(PSNAP);
const Lm = new Map(); let dupL = 0; for (const c of L) { if (Lm.has(c.mint)) dupL++; else Lm.set(c.mint, c); }
const p1all = P.filter((p) => p.ageH === 1);
const P1 = new Map(); let dupP = 0; for (const p of p1all) { if (P1.has(p.mint)) dupP++; else P1.set(p.mint, p); }
const spot = JSON.parse(fs.readFileSync(`${SP}/themes/graduates/spotcheck_1h.json`));
const spotBy = new Map((Array.isArray(spot) ? spot : spot.rows ?? []).map((s) => [s.mint, s]));
const rowsA = [], exA = { notInLaunches: 0, gone: 0, nullAth: 0, athBeforeCreate: 0, over5MUnconfirmed: [], over5MConfirmed: [] };
const ages = [];
for (const p of P1.values()) {
  const c = Lm.get(p.mint);
  if (!c) { exA.notInLaunches++; continue; }
  if (p.gone) { exA.gone++; continue; }
  if (p.athUsd == null) { exA.nullAth++; continue; }
  if (p.athAt && p.athAt < c.created - 1000) { exA.athBeforeCreate++; continue; }
  ages.push((p.at - c.created) / 60e3);
  let ath = p.athUsd;
  if (ath > 5e6) { const s = spotBy.get(p.mint); if (!s || s.gtPeakUsd == null) { exA.over5MUnconfirmed.push([c.name, Math.round(ath)]); continue; } exA.over5MConfirmed.push([c.name, Math.round(ath), Math.round(s.gtPeakUsd)]); ath = s.gtPeakUsd; }
  const g = Gm.get(p.mint);
  rowsA.push({ mint: p.mint, name: c.name ?? "", symbol: c.symbol ?? "", created: c.created, theme: th(c.name, c.symbol), ath, instant: g?.instant ?? false, rawAth: p.athUsd });
}
ages.sort((a, b) => a - b);
const q = (a, p) => a[Math.floor(p * (a.length - 1))];
out.rowA = { ageH1RowsTotal: p1all.length, uniqueMints: P1.size, dupP, dupL, used: rowsA.length, excluded: exA,
  createdWindow: [iso(Math.min(...rowsA.map((r) => r.created))), iso(Math.max(...rowsA.map((r) => r.created)))],
  readAgeMin: { min: ages[0].toFixed(2), p01: q(ages, 0.01).toFixed(2), p50: q(ages, 0.5).toFixed(2), p99: q(ages, 0.99).toFixed(2), max: ages.at(-1).toFixed(2), over68: ages.filter((a) => a > 68).length, over70: ages.filter((a) => a > 70).length, under60: ages.filter((a) => a < 60).length } };
const MS = [10e3, 20e3, 50e3, 100e3];
function tableA(rows) { const o = {}; for (const t of [...THEMES, "ALL"]) { const a = t === "ALL" ? rows : rows.filter((r) => r.theme === t); o[t] = { n: a.length }; for (const m of MS) o[t][m / 1e3 + "k"] = a.filter((r) => r.ath >= m).length; } return o; }
out.rowA.all = tableA(rowsA);
out.rowA.exclInstant = tableA(rowsA.filter((r) => !r.instant));
const fo = new Map(); for (const r of [...rowsA].sort((a, b) => a.created - b.created)) { const k = `${r.name.trim().toLowerCase()}|${r.symbol.trim().toLowerCase()}`; if (!fo.has(k)) fo.set(k, r); }
out.rowA.firstOfName = tableA([...fo.values()]);
// sensitivity: use raw pump.fun ath (no >5M rule), and no exclusions
out.rowA.rawAthNoSpotRule = tableA(P1.size ? [...P1.values()].filter((p) => Lm.has(p.mint) && !p.gone && p.athUsd != null).map((p) => { const c = Lm.get(p.mint); return { theme: th(c.name, c.symbol), ath: p.athUsd }; }) : []);
// cat vs rest at 10k
{ const cat = out.rowA.all.cat, all = out.rowA.all.ALL; out.rowA.catVsRest10k = `${cat["10k"]}/${cat.n} vs rest ${all["10k"] - cat["10k"]}/${all.n - cat.n} = ${(100 * (all["10k"] - cat["10k"]) / (all.n - cat.n)).toFixed(2)}%`;
  out.rowA.wilson = Object.fromEntries(["cat", "dog", "other-animal", "brand"].map((t) => [t, MS.slice(0, 3).map((m) => wilson(out.rowA.all[t][m / 1e3 + "k"], out.rowA.all[t].n).map((x) => (100 * x).toFixed(1)).join("-"))])); }
// names: MIAU, Spidey cat, ansem, backpack
const nm = (rows, re) => rows.filter((r) => re.test(`${r.name} ${r.symbol}`));
const miau = nm(rowsA, /\bmiau\b/i), spidey = nm(rowsA, /spidey\s*cat/i);
out.rowA.miau = { launchesInA: miau.length, hit10k: miau.filter((r) => r.ath >= 10e3).length, exactNameMIAU: rowsA.filter((r) => r.name.trim().toLowerCase() === "miau").length,
  exactHit: rowsA.filter((r) => r.name.trim().toLowerCase() === "miau" && r.ath >= 10e3).length, themes: [...new Set(miau.map((r) => r.theme))] };
out.rowA.spidey = { launchesInA: spidey.length, hit10k: spidey.filter((r) => r.ath >= 10e3).length, themes: [...new Set(spidey.map((r) => r.theme))] };

/* ---------- launch universe (cohort snapshot U newest listing), per-theme counts ---------- */
const U = new Map();
for (const c of L) if (!U.has(c.mint)) U.set(c.mint, { name: c.name ?? "", symbol: c.symbol ?? "", created: c.created });
for (const c of NEW.all.values()) if (!U.has(c.mint)) U.set(c.mint, { name: c.name ?? "", symbol: c.symbol ?? "", created: c.created_timestamp });
const Uc = [...U.values()]; for (const u of Uc) u.theme = th(u.name, u.symbol);
const uc = {}; for (const t of THEMES) uc[t] = Uc.filter((u) => u.theme === t).length;
const uts = Uc.map((u) => u.created).sort((a, b) => a - b);
out.universe = { n: Uc.length, window: [iso(uts[0]), iso(uts.at(-1))], hours: ((uts.at(-1) - uts[0]) / H).toFixed(3), byTheme: uc,
  ansem: Uc.filter((u) => /ansem/i.test(`${u.name} ${u.symbol}`)).length, ansemExactWord: Uc.filter((u) => /\bansem\b/i.test(`${u.name} ${u.symbol}`)).length,
  backpack: Uc.filter((u) => /backpack/i.test(`${u.name} ${u.symbol}`)).length, backpackExactWord: Uc.filter((u) => /\bbackpack\b/i.test(`${u.name} ${u.symbol}`)).length,
  miau: Uc.filter((u) => /\bmiau\b/i.test(`${u.name} ${u.symbol}`)).length };

/* ---------- cohort completeness vs on-chain creates ---------- */
const sigsJ = JSON.parse(fs.readFileSync(`${SP}/milestones/graduates/rpc_sigs.json`));
const sigs = sigsJ.sigs.filter((s) => s.ok).map((s) => s.t * 1000);
const sigMin = Math.min(...sigs), sigMax = Math.max(...sigs);
const lo = Math.max(uts[0], sigMin), hi = Math.min(uts.at(-1), sigMax);
out.cohortVsChain = { overlap: [iso(lo), iso(hi)], chain: sigs.filter((t) => t >= lo && t <= hi).length, cohort: L.filter((c) => c.created >= lo && c.created <= hi).length };
// per 10-minute bucket
out.cohortVsChain.buckets = [];
for (let b = Math.floor(lo / 600e3) * 600e3; b < hi; b += 600e3) { const a = Math.max(b, lo), z = Math.min(b + 600e3, hi); out.cohortVsChain.buckets.push(`${iso(a).slice(11, 16)} chain ${sigs.filter((t) => t >= a && t < z).length} cohort ${L.filter((c) => c.created >= a && c.created < z).length}`); }
// sigs uniqueness
out.cohortVsChain.sigUnique = new Set(sigsJ.sigs.map((s) => s.sig)).size + "/" + sigsJ.sigs.length;

/* ---------- Row B: 24 h ---------- */
const sampleJ = JSON.parse(fs.readFileSync(`${SP}/milestones/graduates/sample.json`));
const prior = JSON.parse(fs.readFileSync(`${SP}/milestones/graduates/results.json`));
const ratio = prior.launches.overlapCheck.ratio;
const gts = G.map((g) => g.created).sort((a, b) => a - b);
const W0 = Math.ceil(Math.max(gts[0], sigMin) / H) * H, W1 = Math.min(sigMax, T_G, Date.parse(sampleJ.window[1]));
const inW = (t) => t >= W0 && t <= W1;
const chainW = sigs.filter(inW).length, LB = chainW * ratio;
const S = sampleJ.rows.filter((r) => r.mint && inW(r.t * 1000));
const sampleNoMint = sampleJ.rows.filter((r) => !r.mint && inW(r.t * 1000)).length;
const byHour = new Map(); for (const r of S) { const h = Math.floor(r.t * 1000 / H); if (!byHour.has(h)) byHour.set(h, []); byHour.get(h).push(r); }
// check r.hour field equals floor(t/H)
const hourMismatch = S.filter((r) => r.hour !== Math.floor(r.t * 1000 / H)).length;
const Nh = new Map(); for (const h of byHour.keys()) Nh.set(h, sigs.filter((t) => t >= Math.max(h * H, W0) && t <= Math.min((h + 1) * H - 1, W1)).length);
const Ntot = [...Nh.values()].reduce((a, b) => a + b, 0);
for (const r of S) { r.w = Nh.get(Math.floor(r.t * 1000 / H)) / Ntot / byHour.get(Math.floor(r.t * 1000 / H)).length; r.theme = th(r.name, r.symbol); }
const sw = S.reduce((a, r) => a + r.w, 0), sw2 = S.reduce((a, r) => a + r.w * r.w, 0), nEff = sw * sw / sw2;
// unweighted share too
const GB = G.filter((g) => inW(g.created));
out.rowB = { window: [iso(W0), iso(W1)], hours: ((W1 - W0) / H).toFixed(3), chainCreates: chainW, ratio, LB: Math.round(LB), sampleN: S.length, sampleNoMint, strata: byHour.size, hourMismatch, nEff: nEff.toFixed(1),
  sumNhVsChain: `${Ntot} vs ${chainW}`, graduatesInWindow: GB.length, realInWindow: GB.filter((g) => g.real).length, byTheme: {} };
const MSB = [30e3, 100e3, 200e3, 500e3, 1e6, 10e6, 100e6, 1e9];
for (const t of [...THEMES, "ALL"]) {
  const p = t === "ALL" ? 1 : S.filter((r) => r.theme === t).reduce((a, r) => a + r.w, 0) / sw;
  const pu = t === "ALL" ? 1 : S.filter((r) => r.theme === t).length / S.length;
  const est = LB * p;
  const o = { sampleK: t === "ALL" ? S.length : S.filter((r) => r.theme === t).length, share: +(100 * p).toFixed(2), shareUnweighted: +(100 * pu).toFixed(2), estLaunches: Math.round(est), complete: GB.filter((g) => t === "ALL" || g.theme === t).length };
  for (const m of MSB) { const k = GB.filter((g) => (t === "ALL" || g.theme === t) && g.ath >= m).length; o[m >= 1e6 ? m / 1e6 + "M" : m / 1e3 + "k"] = `${k} (${est ? (100 * k / est).toFixed(2) : "-"}%)`; }
  const kx = GB.filter((g) => (t === "ALL" || g.theme === t) && !g.instant && g.gradMin != null && g.ath >= 100e3).length;
  o["100k_exclInstant"] = `${kx} (${est ? (100 * kx / est).toFixed(2) : "-"}%)`;
  const kx1 = GB.filter((g) => (t === "ALL" || g.theme === t) && !g.instant && g.gradMin != null && g.ath >= 1e6).length;
  o["1M_exclInstant"] = kx1;
  out.rowB.byTheme[t] = o;
}
out.rowB.allCompleteRate = (100 * GB.length / LB).toFixed(2) + "%";
out.rowB.realRate = (100 * GB.filter((g) => g.real).length / LB).toFixed(2) + "%";
// top of B: coins >= $10M
out.rowB.over10M = GB.filter((g) => g.ath >= 10e6).sort((a, b) => b.ath - a.ath).map((g) => `${g.name} (${g.symbol}) ${iso(g.created).slice(0, 16)} ath $${(g.ath / 1e6).toFixed(1)}M theme ${g.theme} instant ${g.instant}`);

fs.writeFileSync(`${SP}/themes_skeptic1/rederive.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
