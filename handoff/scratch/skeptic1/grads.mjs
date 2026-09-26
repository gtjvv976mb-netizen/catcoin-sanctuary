// Skeptic 1: independent re-derivation of source B (graduated listing, one day) from raw files only
// (plus sample.json's list of sampled signatures / tx file names, cross-checked against raw tx files).
import fs from "node:fs";
import crypto from "node:crypto";
import { detectCat } from "/home/user/Cat-Intelligence-Agency/bots/lib/catdetect.mjs";
const M = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/milestones/";
const RAW = M + "raw/";
const files = fs.readdirSync(RAW).sort();
const J = (f) => JSON.parse(fs.readFileSync(RAW + f, "utf8"));
const SOL = "11111111111111111111111111111111";
const iso = (t) => new Date(t).toISOString();

// ---- graduated listing (sorted by created DESC, complete=true): every raw page with a 200 array body
const gcFiles = files.filter((f) => f.includes("_gradCreated_off"));
const G = new Map(); let rowsSeen = 0, firstOkFetch = null, lastOkFetch = null;
for (const f of gcFiles) {
  const j = J(f);
  if (j.status !== 200 || !Array.isArray(j.body)) continue;
  if (!/complete=true/.test(j.url) || !/sort=created_timestamp/.test(j.url)) throw new Error("unexpected url " + j.url);
  if (!firstOkFetch || j.fetchedAt < firstOkFetch) firstOkFetch = j.fetchedAt;
  if (!lastOkFetch || j.fetchedAt > lastOkFetch) lastOkFetch = j.fetchedAt;
  for (const c of j.body) { rowsSeen++; if (!G.has(c.mint)) G.set(c.mint, c); }
}
const Gs = [...G.values()];
console.log("gradCreated raw files", gcFiles.length, "rows", rowsSeen, "unique", Gs.length, "complete", Gs.filter((c) => c.complete).length, "fetched", firstOkFetch, lastOkFetch);
const W0 = Math.min(...Gs.map((c) => c.created_timestamp)), TG = Date.parse(firstOkFetch);
console.log("window", iso(W0), "->", firstOkFetch, ((TG - W0) / 3600e3).toFixed(2), "h; max created", iso(Math.max(...Gs.map((c) => c.created_timestamp))));

// ---- on-chain launches: getSignaturesForAddress pages on the mint authority
const sigFiles = files.filter((f) => /_rpc_mintauth_p\d{3}_/.test(f));
const sigs = new Map(); let badPages = 0;
for (const f of sigFiles) { const j = J(f); const r = j.body?.result; if (!Array.isArray(r)) { badPages++; continue; } for (const s of r) sigs.set(s.signature, { t: s.blockTime, ok: s.err == null }); }
const S = [...sigs.values()];
console.log("sig files", sigFiles.length, "bad", badPages, "unique sigs", S.length, "ok", S.filter((s) => s.ok).length, "oldest", iso(Math.min(...S.map((s) => s.t)) * 1000));
const okIn = (a, b) => S.filter((s) => s.ok && s.t * 1000 >= a && s.t * 1000 <= b).length;
const okWin = okIn(W0, TG);
// overlap check with the newest-first listing
const acFiles = files.filter((f) => f.includes("_allCreated_off"));
const AC = new Map(); for (const f of acFiles) { const j = J(f); if (j.status === 200 && Array.isArray(j.body)) for (const c of j.body) if (!AC.has(c.mint)) AC.set(c.mint, c); }
const acT = [...AC.values()].map((c) => c.created_timestamp);
const acLo = Math.min(...acT), acHi = Math.max(...acT);
const ov = okIn(acLo, acHi);
const adj = AC.size / ov;
const Lw = Math.round(okWin * adj);
console.log("ok sigs in window", okWin, "listing coins", AC.size, "ok sigs in listing window", ov, "ratio", adj.toFixed(4), "adjusted launches", Lw, "| unadjusted all sigs", S.filter((s) => s.t * 1000 >= W0 && s.t * 1000 <= TG).length);

// ---- cat share: decode the sampled create txs myself from raw getTransaction responses
const DISC = crypto.createHash("sha256").update("event:CreateEvent").digest().subarray(0, 8);
const ALPH = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b58 = (buf) => { let n = BigInt("0x" + (Buffer.from(buf).toString("hex") || "0")), s = ""; while (n > 0n) { s = ALPH[Number(n % 58n)] + s; n /= 58n; } for (const b of buf) { if (b === 0) s = "1" + s; else break; } return s; };
function decode(tx) {
  for (const l of tx?.meta?.logMessages ?? []) {
    if (!l.startsWith("Program data: ")) continue;
    const b = Buffer.from(l.slice(14), "base64"); if (!b.subarray(0, 8).equals(DISC)) continue;
    let o = 8; const str = () => { const n = b.readUInt32LE(o); o += 4; const s = b.subarray(o, o + n).toString("utf8"); o += n; return s; };
    try { const name = str(), symbol = str(), uri = str(); return { name, symbol, uri, mint: b58(b.subarray(o, o + 32)) }; } catch { }
  }
  return null;
}
const sample = JSON.parse(fs.readFileSync(M + "graduates/sample.json", "utf8")).rows;
// hour strata from my own sig set, in the sampling window used by sample_launches (sample.log: 34740 ok sigs, 25 hours)
let decMismatch = 0, sigMismatch = 0, hourNMismatch = 0; const Srows = [];
const hourN = {}; for (const s of S) if (s.ok && s.t * 1000 >= W0 && s.t * 1000 <= TG) { const h = Math.floor(s.t / 3600); hourN[h] = (hourN[h] ?? 0) + 1; }
for (const r of sample) {
  const j = J(r.txFile);
  if (j.request?.params?.[0] !== r.sig) sigMismatch++;
  const d = decode(j.body?.result);
  if ((d?.mint ?? null) !== (r.mint ?? null) || (d && (d.name !== r.name || d.symbol !== r.symbol))) decMismatch++;
  if (hourN[r.hour] !== r.hourN) hourNMismatch++;
  if (!d) continue;
  if (r.t * 1000 < W0 || r.t * 1000 > TG) continue;
  Srows.push({ ...r, name: d.name, symbol: d.symbol, nt: detectCat({ name: d.name, symbol: d.symbol }).isCat, hourN: hourN[r.hour] });
}
console.log("sample rows", sample.length, "decoded in window", Srows.length, "sig mismatches", sigMismatch, "decode mismatches", decMismatch, "hourN mismatches", hourNMismatch, "raw cats", Srows.filter((r) => r.nt).length);
const strata = new Map(); for (const r of Srows) { if (!strata.has(r.hour)) strata.set(r.hour, []); strata.get(r.hour).push(r); }
const Ntot = [...strata.keys()].reduce((a, h) => a + hourN[h], 0);
let p = 0, v = 0; for (const [h, rs] of strata) { const ph = rs.filter((r) => r.nt).length / rs.length, w = hourN[h] / Ntot; p += w * ph; v += w * w * ph * (1 - ph) / (rs.length - 1); }
const pSe = Math.sqrt(v);
console.log("strata", strata.size, "Ntot", Ntot, "weighted cat share", (100 * p).toFixed(2), "% se", (100 * pSe).toFixed(2), "unweighted", (100 * Srows.filter((r) => r.nt).length / Srows.length).toFixed(2), "%");
// first half vs second half of day
const byH = [...strata.entries()].sort((a, b) => a[0] - b[0]);
const half = (arr) => { let x = 0, n = 0; for (const [, rs] of arr) { x += rs.filter((r) => r.nt).length; n += rs.length; } return `${x}/${n} = ${(100 * x / n).toFixed(1)}%`; };
console.log("cat share first 12 strata", half(byH.slice(0, 12)), "last 13", half(byH.slice(12)));
const Nc = Lw * p;

// ---- GeckoTerminal pools (raw /pools/multi responses): pool created time
const gtFiles = files.filter((f) => f.includes("_gtmulti_"));
const pools = new Map();
for (const f of gtFiles) { const j = J(f); for (const d of j.body?.data ?? []) pools.set(d.attributes.address, d.attributes); }
console.log("gt files", gtFiles.length, "pools", pools.size);

// ---- spot checks: recompute ratio from raw GT ohlcv files named in spotcheck.json
const spot = JSON.parse(fs.readFileSync(M + "graduates/spotcheck.json", "utf8"));
const spotBy = new Map(); let spotDiff = 0;
for (const s of spot) {
  let ratio = null;
  if (s.file && fs.existsSync(RAW + s.file)) {
    const j = J(s.file); const list = j.body?.data?.attributes?.ohlcv_list ?? [];
    const c = G.get(s.mint); const supply = Number(c.total_supply) / 10 ** (c.base_decimals ?? 6);
    let hi = 0; for (const k of list) if (k[2] > hi) hi = k[2];
    ratio = hi ? c.ath_market_cap / (hi * supply) : null;
  }
  if ((ratio == null) !== (s.ratio == null) || (ratio != null && Math.abs(ratio - s.ratio) > 1e-6)) spotDiff++;
  spotBy.set(s.mint, ratio);
}
console.log("spotchecks", spot.length, "recomputed differing", spotDiff);

// ---- per graduate
const rows = Gs.map((c) => {
  const pool = c.pump_swap_pool || c.pool_address; const g = pools.get(pool);
  const quote = c.quote_mint ?? SOL;
  const vq = (c.virtual_quote_reserves ?? c.virtual_sol_reserves) / 10 ** (c.quote_decimals ?? 9);
  const nt = detectCat({ name: c.name ?? "", symbol: c.symbol ?? "" }).isCat;
  const gradMin = g?.pool_created_at ? (Date.parse(g.pool_created_at) - c.created_timestamp) / 60e3 : null;
  const sr = spotBy.has(c.mint) ? spotBy.get(c.mint) : undefined;
  const spotOk = sr != null && sr >= 0.8 && sr <= 1.25;
  const flags = [];
  if (c.ath_market_cap_timestamp && c.ath_market_cap_timestamp < c.created_timestamp - 1000) flags.push("athBeforeCreate");
  if (c.ath_market_cap < 0.98 * (c.usd_market_cap ?? 0)) flags.push("athBelowNow");
  if (c.ath_market_cap < 30000) flags.push("never30k");
  if (quote === SOL && vq < 30 && c.ath_market_cap >= 30000 && !spotOk) flags.push("reservesInconsistent");
  if (sr != null && (sr < 0.8 || sr > 1.25)) flags.push("spotMismatch");
  return { mint: c.mint, sym: c.symbol, name: c.name, nt, ath: c.ath_market_cap, created: c.created_timestamp, quote, vq, mcapQ: c.market_cap, mcapUsd: c.usd_market_cap,
    mayhem: c.mayhem_state ?? null, gradMin, instant: gradMin != null && gradMin <= 1, flags, hasPool: !!g };
});
const fl = {}; for (const r of rows) for (const f of r.flags) fl[f] = (fl[f] ?? 0) + 1;
console.log("flags", fl, "no GT pool", rows.filter((r) => !r.hasPool).length, "instant", rows.filter((r) => r.instant).length);
console.log("mayhem values", [...new Set(rows.map((r) => JSON.stringify(r.mayhem)))].slice(0, 6), "never30k with mayhem", rows.filter((r) => r.flags.includes("never30k") && r.mayhem).length);

// ---- graduation rates
const wilson = (x, n, z = 1.96) => { const q = x / n, d = 1 + z * z / n, c = (q + z * z / (2 * n)) / d, h = z * Math.sqrt(q * (1 - q) / n + z * z / (4 * n * n)) / d; return [c - h, c + h]; };
const P2 = (x) => (100 * x).toFixed(2) + "%";
function rate(label, f) {
  const g = rows.filter(f), gc = g.filter((r) => r.nt).length;
  const rc = gc / Nc, ra = g.length / Lw;
  const relSe = Math.sqrt(1 / gc + (pSe / p) ** 2);
  const lift = (gc / g.length) / p, liftSe = Math.sqrt((1 - gc / g.length) / gc + (pSe / p) ** 2);
  // alternative: cats vs non-cats
  const rn = (g.length - gc) / (Lw - Nc);
  console.log(`${label.padEnd(26)} all ${g.length}/${Lw} ${P2(ra)} | cats ${gc}/${Math.round(Nc)} ${P2(rc)} (${P2(rc * Math.exp(-1.96 * relSe))}-${P2(rc * Math.exp(1.96 * relSe))}) | cats/all ${lift.toFixed(2)} (${(lift * Math.exp(-1.96 * liftSe)).toFixed(2)}-${(lift * Math.exp(1.96 * liftSe)).toFixed(2)}) | noncat rate ${P2(rn)} cats/noncats ${(rc / rn).toFixed(2)} | cat share of grads ${P2(gc / g.length)}`);
  return { g: g.length, gc };
}
console.log("\nGRADUATION");
const all = rate("complete=true", () => true);
const real = rate("real (ath>=30k)", (r) => !r.flags.includes("never30k"));
const org = rate("real, not instant", (r) => !r.flags.includes("never30k") && !r.instant && r.gradMin != null);
rate("real, not instant (null ok)", (r) => !r.flags.includes("never30k") && !r.instant);
// mayhem share among graduates
const nev = rows.filter((r) => r.flags.includes("never30k"));
console.log("never30k", nev.length, "cats", nev.filter((r) => r.nt).length, "of cat grads", rows.filter((r) => r.nt).length, P2(nev.filter((r) => r.nt).length / rows.filter((r) => r.nt).length), "| all", P2(nev.length / rows.length));

// ---- peaks (trusted = no flags), per launch
const T = [3e4, 5e4, 1e5, 2e5, 5e5, 1e6];
const trusted = (r) => r.flags.length === 0;
function peaks(label, f) {
  console.log(`\n${label}`);
  for (const t of T) {
    const xa = rows.filter((r) => f(r) && r.ath >= t).length, xc = rows.filter((r) => f(r) && r.nt && r.ath >= t).length;
    const pc = xc / Nc, pa = xa / Lw, ratio = pc / pa;
    const seInd = xc && xa ? Math.sqrt(1 / xc + 1 / xa + (pSe / p) ** 2) : null;               // drafter's (treats cats and all as independent)
    const seSub = xc && xa ? Math.sqrt((1 - xc / xa) / xc + (pSe / p) ** 2) : null;             // cats are a subset of all: binomial share of the xa coins
    const xn = xa - xc, pn = xn / (Lw - Nc);
    console.log(`>=${t}`.padEnd(10), `cats ${xc} ${P2(pc)} (1 in ${Math.round(1 / pc)})`.padEnd(30), `all ${xa} ${P2(pa)}`.padEnd(18), "cats/all", ratio.toFixed(2),
      seInd ? `indep CI ${(ratio * Math.exp(-1.96 * seInd)).toFixed(2)}-${(ratio * Math.exp(1.96 * seInd)).toFixed(2)}` : "", seSub ? `subset CI ${(ratio * Math.exp(-1.96 * seSub)).toFixed(2)}-${(ratio * Math.exp(1.96 * seSub)).toFixed(2)}` : "",
      `| cats/noncats ${(pc / pn).toFixed(2)}`);
  }
}
peaks("TRUSTED peaks", trusted);
peaks("TRUSTED, not instant (organic)", (r) => trusted(r) && !r.instant);
peaks("RAW complete=true (no filter)", () => true);
console.log("\ncat trusted >=50k:", rows.filter((r) => trusted(r) && r.nt && r.ath >= 5e4).map((r) => `${r.sym}:${Math.round(r.ath / 1e3)}k${r.instant ? "(i)" : ""}`).join(" "));
console.log("cat organic >=50k:", rows.filter((r) => trusted(r) && !r.instant && r.nt && r.ath >= 5e4).map((r) => `${r.sym}:${Math.round(r.ath / 1e3)}k gradMin=${r.gradMin?.toFixed(1)}`).join(" "));
// graduation market cap in SOL: coins that are complete and whose curve ended; market_cap field is in quote units
const solReal = rows.filter((r) => r.quote === SOL && !r.flags.includes("never30k"));
fs.writeFileSync(new URL("./grad_rows.json", import.meta.url), JSON.stringify({ rows, Lw, p, pSe }));
// 1 h censoring
const old = rows.filter((r) => TG - r.created >= 12 * 3600e3 && r.gradMin != null);
console.log("\ncensoring: basis", old.length, ">1h", old.filter((r) => r.gradMin > 60).length, P2(old.filter((r) => r.gradMin > 60).length / old.length), ">3h", old.filter((r) => r.gradMin > 180).length, P2(old.filter((r) => r.gradMin > 180).length / old.length));
