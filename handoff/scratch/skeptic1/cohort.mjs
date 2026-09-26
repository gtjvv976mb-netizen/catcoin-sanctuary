// Skeptic 1: independent re-derivation of the forward-cohort (source A) funnel from the raw snapshot
// files and raw candle responses in milestones/raw. Does not read the drafter's derived files
// (coins_1h.jsonl, candles.jsonl, results.json).
import fs from "node:fs";
import { detectCat } from "/home/user/Cat-Intelligence-Agency/bots/lib/catdetect.mjs";
const RAW = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/milestones/raw/";
const rdl = (f) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(JSON.parse);
const L = rdl(RAW + "2026-09-25T12-17-20Z_cohort_launches_snapshot.jsonl");
const P = rdl(RAW + "2026-09-25T12-17-20Z_cohort_peaks_snapshot.jsonl");
const SNAP = Date.parse("2026-09-25T12:17:20Z");
const SOL = "11111111111111111111111111111111";

// uniqueness
const Lm = new Map(); let dupL = 0; for (const c of L) { if (Lm.has(c.mint)) dupL++; else Lm.set(c.mint, c); }
console.log("launch rows", L.length, "unique", Lm.size, "dup", dupL);

// recompute cat flags myself
let mismatchNT = 0, mismatchAll = 0; const descOnly = [];
for (const c of Lm.values()) {
  const nt = detectCat({ name: c.name ?? "", symbol: c.symbol ?? "" }).isCat;
  const all = detectCat({ name: c.name ?? "", symbol: c.symbol ?? "", description: c.description ?? "" }).isCat;
  if (nt !== c.catByNameOrTicker) mismatchNT++;
  if (all !== c.cat) mismatchAll++;
  c._nt = nt; c._all = all;
  if (all && !nt) descOnly.push(c.symbol);
}
console.log("cat flag mismatches: nameTicker", mismatchNT, "withDesc", mismatchAll, "descOnly", descOnly);
console.log("launches: cats(all)", [...Lm.values()].filter(c => c._all).length, "cats(NT)", [...Lm.values()].filter(c => c._nt).length, "of", Lm.size);

// 1h reads
const P1all = P.filter(p => p.ageH === 1);
const gone = P1all.filter(p => p.gone);
const P1m = new Map(); let dupP = 0; for (const p of P1all.filter(p => !p.gone)) { if (P1m.has(p.mint)) dupP++; else P1m.set(p.mint, p); }
console.log("1h reads", P1all.length, "gone", gone.length, "unique ok", P1m.size, "dup", dupP, "peak ageH values", [...new Set(P.map(p => p.ageH))]);
const eligible = [...Lm.values()].filter(c => SNAP - c.created >= 3600e3);
console.log("eligible (>=1h old at snapshot)", eligible.length, "with read", eligible.filter(c => P1m.has(c.mint)).length, "reads for non-eligible", [...P1m.keys()].filter(m => SNAP - Lm.get(m).created < 3600e3).length);
console.log("eligible missing read — gone?", eligible.filter(c => !P1m.has(c.mint)).length, "of which 404", eligible.filter(c => !P1m.has(c.mint) && gone.some(g => g.mint === c.mint)).length);

// raw candles, parsed from the raw response files
const candleFiles = fs.readdirSync(RAW).filter(f => f.includes("_coh_candles_"));
const cand = new Map(); // mint -> {status, body}
for (const f of candleFiles) {
  const j = JSON.parse(fs.readFileSync(RAW + f, "utf8"));
  const mint = j.url.match(/coins\/([^/]+)\/candles/)[1];
  const prev = cand.get(mint);
  if (!prev || (j.status === 200 && prev.status !== 200)) cand.set(mint, { status: j.status, body: j.body, f });
}
console.log("candle files", candleFiles.length, "mints", cand.size);

const rows = [...P1m.values()].map(p => {
  const c = Lm.get(p.mint);
  const ath = p.athUsd ?? 0;
  let check = ath >= 5000 ? "nocandle" : "below5k", cdPeak = null, ratio = null;
  const k = cand.get(p.mint);
  if (ath >= 5000 && k && k.status === 200 && Array.isArray(k.body) && k.body.length) {
    let mx = 0; for (const x of k.body) if (+x.timestamp <= p.at && +x.high > mx) mx = +x.high;
    cdPeak = mx * 1e9; ratio = ath / cdPeak; check = ratio <= 1.02 ? "pass" : "fail";
  }
  return { mint: p.mint, sym: String(c.symbol ?? "").trim().toUpperCase(), name: c.name, created: c.created, at: p.at, ageMin: (p.at - c.created) / 60e3,
    cat: c._all, nt: c._nt, control: c.control, quote: c.quote ?? p.quote, pquote: p.quote, complete: p.complete, mcap: p.mcapUsd, ath, athAt: p.athAt, check, cdPeak, ratio };
});
const chk = {}; for (const r of rows) chk[r.check] = (chk[r.check] ?? 0) + 1;
const ratios = rows.filter(r => r.ratio != null).map(r => r.ratio).sort((a, b) => a - b);
console.log("R1 checks", chk, "ratio min", ratios[0], "max", ratios.at(-1), "n", ratios.length, "within 2% (<=1.02 & >=0.98)", ratios.filter(x => x <= 1.02 && x >= 0.98).length);
console.log("quote mismatch launch vs peak", rows.filter(r => r.quote !== r.pquote).length);
const ages = rows.map(r => r.ageMin).sort((a, b) => a - b);
console.log("n", rows.length, "age min", ages[0].toFixed(2), "median", ages[Math.floor(ages.length / 2)].toFixed(2), "max", ages.at(-1).toFixed(2));
console.log("created", new Date(Math.min(...rows.map(r => r.created))).toISOString(), new Date(Math.max(...rows.map(r => r.created))).toISOString(),
  "read", new Date(Math.min(...rows.map(r => r.at))).toISOString(), new Date(Math.max(...rows.map(r => r.at))).toISOString());
console.log("ath null", rows.filter(r => r.ath === 0).length);

const T = [5e3, 1e4, 2e4, 3e4, 5e4, 1e5, 2e5, 5e5, 1e6, 1e7];
const wilson = (x, n, z = 1.96) => { const p = x / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
const rr = (x1, n1, x2, n2) => { if (!x1 || !x2) return null; const r = (x1 / n1) / (x2 / n2), se = Math.sqrt(1 / x1 - 1 / n1 + 1 / x2 - 1 / n2); return [r, r * Math.exp(-1.96 * se), r * Math.exp(1.96 * se)]; };
// cats vs all where cats are a subset of all: delta method with the covariance, i.e. compare cats vs non-cats and convert
const f2 = (x) => x == null ? "n/a" : x.toFixed(2);
const pc = (x, n) => (100 * x / n).toFixed(1) + "%";
const val = (r) => (r.check === "fail" ? r.cdPeak : r.ath);
function table(label, base, catF = r => r.cat) {
  const cats = base.filter(catF), non = base.filter(r => !catF(r)), ctl = base.filter(r => r.control), all = base;
  console.log(`\n== ${label}: cats ${cats.length} controls ${ctl.length} nonCats ${non.length} all ${all.length}`);
  for (const t of T) {
    const x = (a) => a.filter(r => val(r) >= t).length;
    const xc = x(cats), xn = x(non), xk = x(ctl), xa = x(all);
    const a = rr(xc, cats.length, xn, non.length), b = rr(xc, cats.length, xa, all.length), k = rr(xc, cats.length, xk, ctl.length);
    console.log(String(t).padEnd(9), `cats ${xc} ${pc(xc, cats.length)} [${wilson(xc, cats.length).map(v => (100 * v).toFixed(1)).join("-")}]`.padEnd(30), `ctl ${xk} ${pc(xk, ctl.length)}`.padEnd(16), `non ${xn} ${pc(xn, non.length)}`.padEnd(18), `all ${xa} ${pc(xa, all.length)}`.padEnd(18),
      "c/non", a ? `${f2(a[0])} (${f2(a[1])}-${f2(a[2])})` : "n/a", " c/all", b ? `${f2(b[0])} (${f2(b[1])}-${f2(b[2])})` : "n/a", " c/ctl", k ? `${f2(k[0])} (${f2(k[1])}-${f2(k[2])})` : "n/a");
  }
}
table("validated (cat incl. description)", rows);
table("validated (cat by name/ticker only)", rows, r => r.nt);
table("SOL-quoted only", rows.filter(r => r.quote === SOL));
// per ticker: best launch (drafter's method) and first launch (alternative)
function perTicker(pick) {
  const m = new Map();
  for (const r of [...rows].sort((a, b) => a.created - b.created)) {
    const o = m.get(r.sym);
    if (!o) m.set(r.sym, { ...r, n: 1 });
    else { o.n++; o.cat ||= r.cat; o.control ||= r.control; if (pick === "best" && val(r) > val(o)) { o.ath = val(r); o.check = "pass"; } }
  }
  return [...m.values()];
}
table("per ticker, best launch", perTicker("best"));
table("per ticker, first launch", perTicker("first"));

// repeats
const cnt = (arr) => { const m = {}; for (const r of arr) m[r.sym] = (m[r.sym] ?? 0) + 1; return m; };
const cc = cnt(rows.filter(r => r.cat)), nc = cnt(rows.filter(r => !r.cat));
console.log("\ncat distinct tickers", Object.keys(cc).length, Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 8));
console.log("noncat distinct tickers", Object.keys(nc).length, Object.entries(nc).sort((a, b) => b[1] - a[1]).slice(0, 5));
console.log("tickers both cat and noncat", Object.keys(cc).filter(k => nc[k]));
const miau = rows.filter(r => r.sym === "MIAU");
console.log("MIAU launches", miau.length, "quotes", [...new Set(miau.map(r => r.quote))], "MIAU>=10k", miau.filter(r => val(r) >= 1e4).length, "cat>=10k", rows.filter(r => r.cat && val(r) >= 1e4).length);
console.log("cats USDC-quoted", rows.filter(r => r.cat && r.quote !== SOL).length, "non-cats non-SOL", rows.filter(r => !r.cat && r.quote !== SOL).length);
console.log("cats >=10k by ticker", cnt(rows.filter(r => r.cat && val(r) >= 1e4)));
// within 10 s
for (const t of [5e3, 1e4]) {
  const f = (arr) => [arr.filter(r => val(r) >= t && r.athAt - r.created <= 10e3).length, arr.filter(r => val(r) >= t).length];
  console.log("ath within 10s of creation at", t, "cats", f(rows.filter(r => r.cat)), "noncats", f(rows.filter(r => !r.cat)));
}
console.log("cats >=100k", rows.filter(r => r.cat && val(r) >= 1e5).map(r => `${r.name}/${r.sym} ath ${Math.round(r.ath)} now ${Math.round(r.mcap)} complete ${r.complete}`));
// completion at 1 h
const comp = (arr, f = () => true) => arr.filter(r => r.complete && f(r)).length;
for (const [lab, arr] of [["cats", rows.filter(r => r.cat)], ["all", rows], ["controls", rows.filter(r => r.control)], ["noncats", rows.filter(r => !r.cat)]]) {
  const a = comp(arr), b = comp(arr, r => val(r) >= 3e4);
  console.log("complete at 1h", lab, a, "/", arr.length, pc(a, arr.length), wilson(a, arr.length).map(v => (100 * v).toFixed(1)).join("-"), "| real (ath>=30k)", b, pc(b, arr.length), wilson(b, arr.length).map(v => (100 * v).toFixed(1)).join("-"));
}
console.log("max ath on curve (not complete)", Math.max(...rows.filter(r => !r.complete).map(val)), "on-curve >71.6k", rows.filter(r => !r.complete && val(r) > 71.6e3).map(r => `${r.sym} ${Math.round(val(r))} cat=${r.cat}`));
console.log("R3 (>=10M within 48h)", rows.filter(r => r.ath >= 1e7).map(r => `${r.sym} ${Math.round(r.ath)} cat=${r.cat} control=${r.control}`));
// launch-level cat share in whole snapshot
console.log("snapshot launches", Lm.size, "cats", [...Lm.values()].filter(c => c._all).length, "created range", new Date(Math.min(...[...Lm.values()].map(c => c.created))).toISOString(), new Date(Math.max(...[...Lm.values()].map(c => c.created))).toISOString());
fs.writeFileSync(new URL("./cohort_rows.json", import.meta.url), JSON.stringify(rows));
