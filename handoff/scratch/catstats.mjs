// catstats.mjs - sourced performance statistics for Solana cat coins.
// Every number is derived from fetched API data. Raw responses are cached in ./raw
// (with URL + fetch time) so a re-run after a rate-limit does not refetch.
// Usage: node catstats.mjs   -> writes catstats.json next to this file, prints markdown.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(DIR, 'raw');
fs.mkdirSync(RAW, { recursive: true });

// primary: which daily-close series drives the metrics. All coins use the on-chain GeckoTerminal daily OHLCV of their
// deepest pool (coin = base token). CoinGecko market_chart is fetched too and compared day by day: for MEW, POPCAT,
// BONK and WIF it sits far above both the SOL pool and an independent USDC pool for 2026-01-09..2026-03-26, so it is
// kept only as a cross-check (its metrics are in coins[].coingeckoSeriesMetrics). CoinGecko supplies ATH/ath_date.
const DAY = 86400000;
const COINS = [
  { sym: 'MEW', mint: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5', cg: 'cat-in-a-dogs-world', cat: true, primary: 'gt' },
  { sym: 'POPCAT', mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', cg: 'popcat', cat: true, primary: 'gt' },
  { sym: 'KITTY', mint: '4N4DnNo3qpPks9aQCkcWkzoir8tnvT6diS4TnnZibonk', cg: null, cat: true, primary: 'gt' },
  { sym: 'GRUMPY', mint: 'GRUmPYbiTpq9ZPy5LAqBMMze7kErf5dEX2i9qYfwoSmR', cg: 'grumpy-cat-coin', cat: true, primary: 'gt' },
  { sym: 'KWIF', mint: '6Rwcmkz9yiYVM5EzyMcr4JsQPGEAWhcUvLvfBperYnUt', cg: 'kitten-wif-hat', cat: true, primary: 'gt' },
  { sym: 'KHAI', mint: '3TWgDvYBL2YPET2LxnWAwsMeoA8aL4DutNuwat2pKCjC', cg: 'kitten-haimer', cat: true, primary: 'gt' },
  { sym: 'SOL', mint: 'So11111111111111111111111111111111111111112', cg: 'solana', cat: false, primary: 'gt' },
  { sym: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', cg: 'bonk', cat: false, primary: 'gt' },
  { sym: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', cg: 'dogwifcoin', cat: false, primary: 'gt' },
];

const sources = [];
const lastCall = { cg: 0, gt: 0, jup: 0 };
const GAP = { cg: 3000, gt: 2500, jup: 500 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(kind, key, url) {
  const file = path.join(RAW, key.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.json');
  if (fs.existsSync(file)) {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    sources.push({ url: c.url, fetchedAt: c.fetchedAt, status: c.status, cached: true });
    return c.body;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const wait = lastCall[kind] + GAP[kind] - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall[kind] = Date.now();
    const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(45000) });
    const fetchedAt = new Date().toISOString();
    if (res.status === 429 && attempt === 0) {
      console.error(`429 on ${url}; waiting 65 s then retrying once`);
      await sleep(65000);
      continue;
    }
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { _nonJSON: text.slice(0, 500) }; }
    if (res.ok) fs.writeFileSync(file, JSON.stringify({ url, fetchedAt, status: res.status, body }));
    sources.push({ url, fetchedAt, status: res.status });
    if (!res.ok) { console.error(`HTTP ${res.status} ${url}`); return null; }
    return body;
  }
  return null;
}

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

// ---- series builders: Map closeDate(YYYY-MM-DD) -> close price (USD) ----
// CoinGecko daily point at 00:00 UTC of day D+1 is treated as the close of day D.
function cgSeries(chart) {
  const m = new Map();
  let latest = null;
  for (const [ms, p] of chart.prices) {
    const off = ms % DAY;
    if (off < 15 * 60000) m.set(iso(ms - off - DAY), p); // within 15 min after midnight
    latest = { ms, price: p };
  }
  return { closes: m, latest };
}
// GeckoTerminal daily candle with open-time D: its close is the close of day D.
function gtSeries(lists, todayISO) {
  const m = new Map();
  let maxHigh = null;
  let latest = null;
  for (const [ts, o, h, l, c] of lists) {
    const d = iso(ts * 1000);
    if (!latest || ts * 1000 > latest.ms) latest = { ms: ts * 1000, price: c, date: d };
    if (!maxHigh || h > maxHigh.price) maxHigh = { price: h, date: d };
    if (d >= todayISO) continue; // incomplete current day
    m.set(d, c);
  }
  return { closes: m, maxHigh, latest };
}
// forward-fill missing days (days with no trades in the pool) up to endISO
function fillDaily(closes, endISO) {
  const dates = [...closes.keys()].sort();
  const out = new Map();
  let filled = 0;
  if (!dates.length) return { series: out, filled };
  let t = Date.parse(dates[0]);
  const end = Date.parse(endISO);
  let prev = null;
  for (; t <= end; t += DAY) {
    const d = iso(t);
    if (closes.has(d)) prev = closes.get(d); else filled++;
    if (prev != null) out.set(d, prev);
  }
  return { series: out, filled };
}

// ---- metrics ----
let Y1_START = null; // common start of the ~1y window (earliest date every multi-year series covers)
function windowSlice(series, endISO, days) {
  let startISO = iso(Date.parse(endISO) - days * DAY);
  if (days === 365 && Y1_START && Y1_START > startISO) startISO = Y1_START;
  const pts = [...series.entries()].filter(([d]) => d >= startISO && d <= endISO).sort();
  return { startISO, pts, full: !!(pts.length && pts[0][0] === iso(Date.parse(endISO) - days * DAY)) };
}
function ret(series, endISO, days) {
  const w = windowSlice(series, endISO, days);
  if (w.pts.length < 2) return null;
  const [d0, p0] = w.pts[0];
  const [d1, p1] = w.pts[w.pts.length - 1];
  return { ret: p1 / p0 - 1, from: d0, to: d1, fullWindow: w.full };
}
function riskStats(series, endISO, days) {
  const w = windowSlice(series, endISO, days);
  const p = w.pts;
  if (p.length < 3) return null;
  const simple = [], logs = [];
  let worst = null, best = null, up = 0;
  for (let i = 1; i < p.length; i++) {
    const r = p[i][1] / p[i - 1][1] - 1;
    simple.push(r); logs.push(Math.log(p[i][1] / p[i - 1][1]));
    if (r > 0) up++;
    if (!worst || r < worst.ret) worst = { ret: r, date: p[i][0] };
    if (!best || r > best.ret) best = { ret: r, date: p[i][0] };
  }
  const n = logs.length;
  const mean = logs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(logs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  let peak = p[0], mdd = { dd: 0 };
  for (const pt of p) {
    if (pt[1] > peak[1]) peak = pt;
    const dd = pt[1] / peak[1] - 1;
    if (dd < mdd.dd) mdd = { dd, peakDate: peak[0], troughDate: pt[0] };
  }
  return {
    from: p[0][0], to: p[p.length - 1][0], nReturns: n, fullWindow: w.full,
    annVol: sd * Math.sqrt(365), upShare: up / n, worstDay: worst, bestDay: best, maxDrawdown: mdd,
  };
}
function relToSol(series, solSeries, endISO, days) {
  const r = ret(series, endISO, days);
  if (!r) return null;
  const s0 = solSeries.get(r.from), s1 = solSeries.get(r.to);
  if (s0 == null || s1 == null) return null;
  const solRet = s1 / s0 - 1;
  return { from: r.from, to: r.to, coinRet: r.ret, solRet, relInSol: (1 + r.ret) / (1 + solRet) - 1, diffPct: r.ret - solRet };
}

// ---- main ----
const runStartedAt = new Date().toISOString();
const todayISO = iso(Date.now());
const endISO = iso(Date.parse(todayISO) - DAY); // last complete UTC day
const out = { runStartedAt, windowEnd: endISO, notes: [], coins: {} };

// 1) Jupiter (current price, liquidity, mcap, holders, 24h stats)
for (const c of COINS) {
  const url = `https://lite-api.jup.ag/tokens/v2/search?query=${c.mint}`;
  const j = await getJSON('jup', `jup_${c.sym}`, url);
  const t = Array.isArray(j) ? j.find((x) => x.id === c.mint) : null;
  c.jup = t ? {
    source: url, name: t.name, symbol: t.symbol, usdPrice: t.usdPrice, mcap: t.mcap, fdv: t.fdv,
    liquidity: t.liquidity, holderCount: t.holderCount, updatedAt: t.updatedAt,
    priceChange24h: t.stats24h?.priceChange ?? null,
    volume24h: t.stats24h ? (t.stats24h.buyVolume || 0) + (t.stats24h.sellVolume || 0) : null,
    organicScoreLabel: t.organicScoreLabel ?? null, isVerified: t.isVerified ?? null,
    topHoldersPct: t.audit?.topHoldersPercentage ?? null, firstPoolCreatedAt: t.firstPool?.createdAt ?? null,
  } : null;
}

// 2) CoinGecko coin info (ATH, current price, mcap) + 365d daily chart
for (const c of COINS.filter((x) => x.cg)) {
  const infoUrl = `https://api.coingecko.com/api/v3/coins/${c.cg}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
  const info = await getJSON('cg', `cg_info_${c.cg}`, infoUrl);
  const chartUrl = `https://api.coingecko.com/api/v3/coins/${c.cg}/market_chart?vs_currency=usd&days=365`;
  const chart = await getJSON('cg', `cg_chart_${c.cg}`, chartUrl);
  if (info?.market_data) {
    const md = info.market_data;
    const platformMint = info.platforms?.solana || info.detail_platforms?.solana?.contract_address || null;
    c.cgInfo = {
      source: infoUrl, name: info.name, platformSolana: platformMint,
      mintMatches: c.sym === 'SOL' ? null : platformMint === c.mint,
      currentPrice: md.current_price?.usd, ath: md.ath?.usd, athDate: md.ath_date?.usd,
      athChangePctCG: md.ath_change_percentage?.usd, marketCap: md.market_cap?.usd, lastUpdated: md.last_updated,
      fromAth: md.current_price?.usd / md.ath?.usd - 1,
    };
  } else out.notes.push(`CoinGecko coin info missing for ${c.sym}`);
  if (chart?.prices) {
    const s = cgSeries(chart);
    c.cgChart = { url: chartUrl, closes: s.closes, latest: s.latest,
      zeroMcapZeroVolPoints: chart.prices.filter((_, i) => !chart.market_caps[i]?.[1] && !chart.total_volumes[i]?.[1]).length };
  } else out.notes.push(`CoinGecko market_chart missing for ${c.sym}`);
}

// 3) GeckoTerminal: most-liquid pool where the coin is the base token, daily OHLCV (paginated)
for (const c of COINS.filter((x) => x.gt !== false)) {
  const poolsUrl = `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${c.mint}/pools`;
  const pools = await getJSON('gt', `gt_pools_${c.sym}`, poolsUrl);
  const cand = (pools?.data || []).filter((p) => p.relationships.base_token.data.id === `solana_${c.mint}`)
    .sort((a, b) => Number(b.attributes.reserve_in_usd) - Number(a.attributes.reserve_in_usd));
  if (!cand.length) { out.notes.push(`No GeckoTerminal pool for ${c.sym}`); continue; }
  const pool = cand[0].attributes;
  const created = Date.parse(pool.pool_created_at);
  const lists = [];
  let before = null;
  for (let page = 0; page < 6; page++) {
    const u = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool.address}/ohlcv/day?limit=1000&currency=usd&token=${c.mint}` + (before ? `&before_timestamp=${before}` : '');
    const o = await getJSON('gt', `gt_ohlcv_${c.sym}_${before || 'latest'}`, u);
    const l = o?.data?.attributes?.ohlcv_list || [];
    const fresh = l.filter((x) => !lists.some((y) => y[0] === x[0]));
    if (!fresh.length) break;
    lists.push(...fresh);
    const oldest = Math.min(...l.map((x) => x[0])) * 1000;
    if (oldest <= created + DAY) break;
    before = oldest / 1000;
  }
  const s = gtSeries(lists, todayISO);
  const maxClose = [...s.closes.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
  c.gtData = {
    url: `https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool.address}/ohlcv/day?limit=1000&currency=usd&token=${c.mint}`,
    pool: { address: pool.address, name: pool.name, dex: cand[0].relationships.dex.data.id, createdAt: pool.pool_created_at, reserveUsd: Number(pool.reserve_in_usd) },
    closes: s.closes, latest: s.latest, candles: lists.length,
    firstCandle: iso(Math.min(...lists.map((x) => x[0])) * 1000),
    fullPoolHistory: Math.min(...lists.map((x) => x[0])) * 1000 <= created + DAY,
    peakHigh: s.maxHigh, peakClose: { price: maxClose[1], date: maxClose[0] },
  };
}

// 3b) choose primary daily-close series; cross-check CoinGecko vs GeckoTerminal
const TOL = 0.15; // CG close more than 15% away from the on-chain pool close on the same date -> treated as a data error
for (const c of COINS) {
  const cg = c.cgChart?.closes, gt = c.gtData?.closes;
  let cmp = null;
  if (cg && gt) {
    const diffs = [], flagged = [];
    for (const [d, p] of cg) if (gt.has(d)) {
      const r = p / gt.get(d) - 1; diffs.push(Math.abs(r));
      if (Math.abs(r) > TOL) flagged.push({ date: d, cg: p, gt: gt.get(d), diff: r });
    }
    diffs.sort((a, b) => a - b);
    cmp = { overlapDays: diffs.length, medianAbsDiff: diffs[Math.floor(diffs.length / 2)] ?? null, daysOver15pct: flagged.length, flagged };
  }
  c.crossCheck = cmp;
  if (c.primary === 'cg' && cg) {
    c.rawCloses = new Map(cg);
    c.replaced = [];
    if (cmp) for (const f of cmp.flagged) { c.rawCloses.set(f.date, f.gt); c.replaced.push(f); }
    c.priceSource = { kind: 'CoinGecko market_chart daily (00:00 UTC point = prior day close)', url: c.cgChart.url,
      correction: c.replaced.length ? `${c.replaced.length} CG closes >15% off the GeckoTerminal pool close replaced by the pool close (${c.gtData.url})` : 'none' };
    c.latest = c.cgChart.latest;
  } else if (gt) {
    c.rawCloses = gt;
    c.priceSource = { kind: 'GeckoTerminal pool OHLCV daily close', url: c.gtData.url, pool: c.gtData.pool };
    c.latest = c.gtData.latest;
  }
  c.fromAth = {
    coingecko: c.cgInfo ? { ath: c.cgInfo.ath, athDate: c.cgInfo.athDate, current: c.cgInfo.currentPrice, fromAth: c.cgInfo.fromAth } : null,
    poolHistory: c.gtData?.fullPoolHistory ? {
      pool: c.gtData.pool.address, since: c.gtData.firstCandle, current: c.gtData.latest.price,
      peakHigh: c.gtData.peakHigh, fromPeakHigh: c.gtData.latest.price / c.gtData.peakHigh.price - 1,
      peakClose: c.gtData.peakClose, fromPeakClose: c.gtData.latest.price / c.gtData.peakClose.price - 1,
    } : null,
  };
}

// 3c) independent check of the CoinGecko discrepancy: POPCAT/USDC pool (USD-quoted, no SOL->USD conversion)
{
  const pc = COINS.find((c) => c.sym === 'POPCAT');
  const pool = 'HBS7a3br8GMMWuqVa7VB3SMFa7xVi1tSFdoF5w4ZZ3kS';
  const u = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/ohlcv/day?limit=1000&currency=usd&token=${pc.mint}&before_timestamp=1774483200`;
  const o = await getJSON('gt', 'gt_xcheck_POPCAT_USDC_1774483200', u);
  const usdc = gtSeries(o?.data?.attributes?.ohlcv_list || [], todayISO).closes;
  const dates = (pc.crossCheck?.flagged || []).map((f) => f.date).filter((d) => usdc.has(d));
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  out.independentCheck = {
    what: 'POPCAT closes on the CoinGecko-flagged dates, USDC pool vs SOL pool vs CoinGecko', url: u, pool,
    datesCompared: dates.length,
    medianAbsDiffUsdcPoolVsSolPool: med(dates.map((d) => Math.abs(usdc.get(d) / pc.gtData.closes.get(d) - 1))),
    medianAbsDiffUsdcPoolVsCoinGecko: med(dates.map((d) => Math.abs(usdc.get(d) / pc.cgChart.closes.get(d) - 1))),
    example: dates.includes('2026-03-01') ? { date: '2026-03-01', coingecko: pc.cgChart.closes.get('2026-03-01'), solPool: pc.gtData.closes.get('2026-03-01'), usdcPool: usdc.get('2026-03-01') } : null,
  };
}

// 4) metrics
const bySym = Object.fromEntries(COINS.map((c) => [c.sym, c]));
for (const c of COINS) {
  if (!c.rawCloses) continue;
  const { series, filled } = fillDaily(c.rawCloses, endISO);
  c.series = series;
  const dates = [...series.keys()];
  c.dataWindow = { first: dates[0], last: dates[dates.length - 1], days: dates.length, forwardFilledDays: filled };
}
{
  const target = iso(Date.parse(endISO) - 365 * DAY);
  // only coins whose pool predates the window (their start is set by the API history limit, not by the listing date)
  const firsts = COINS.filter((c) => c.dataWindow && (!c.gtData || c.gtData.pool.createdAt.slice(0, 10) < target)).map((c) => c.dataWindow.first);
  Y1_START = firsts.reduce((a, b) => (b > a ? b : a), target);
  out.oneYearWindow = { requestedStart: target, commonStart: Y1_START, end: endISO,
    reason: 'GeckoTerminal public API returns HTTP 401 for daily candles older than ~1 year, so the 1y window starts at the first date all long-history series share; coins listed later start at their first candle.' };
}
const sol = bySym.SOL.series;
function cgAlt(c) {
  if (!c.cgChart) return null;
  const { series } = fillDaily(c.cgChart.closes, endISO);
  const r = {};
  for (const d of [7, 30, 90, 365]) r[`${d}d`] = ret(series, endISO, d);
  const k = riskStats(series, endISO, 365);
  return { note: 'Same metrics on the raw CoinGecko market_chart series (not used for headline numbers)', returns: r,
    annVol365: k?.annVol, maxDrawdown365: k?.maxDrawdown, worstDay: k?.worstDay, bestDay: k?.bestDay };
}
for (const c of COINS) {
  if (!c.series) continue;
  const o = {
    symbol: c.sym, mint: c.mint, coingeckoId: c.cg, primarySeries: c.primary, priceSource: c.priceSource,
    gtPool: c.gtData?.pool || null, cgVsGtCrossCheck: c.crossCheck, cgChartZeroMcapZeroVolPoints: c.cgChart?.zeroMcapZeroVolPoints ?? null,
    dataWindow: c.dataWindow, latestPricePoint: c.latest ? { at: new Date(c.latest.ms).toISOString(), price: c.latest.price } : null,
    returns: {}, risk365: riskStats(c.series, endISO, 365), risk90: riskStats(c.series, endISO, 90),
    fromAth: c.fromAth, coingecko: c.cgInfo || null, jupiter: c.jup, coingeckoSeriesMetrics: cgAlt(c),
  };
  for (const d of [7, 30, 90, 365]) o.returns[`${d}d`] = ret(c.series, endISO, d);
  if (c.sym !== 'SOL') o.relToSol = { '90d': relToSol(c.series, sol, endISO, 90), '365d': relToSol(c.series, sol, endISO, 365) };
  out.coins[c.sym] = o;
}

// 5) equal-weight buy-and-hold basket MEW + POPCAT (no rebalancing)
out.basket = {};
for (const days of [90, 365]) {
  const a = windowSlice(bySym.MEW.series, endISO, days).pts;
  const b = new Map(windowSlice(bySym.POPCAT.series, endISO, days).pts);
  const dates = a.map(([d]) => d).filter((d) => b.has(d));
  const a0 = bySym.MEW.series.get(dates[0]), b0 = b.get(dates[0]);
  const path = new Map(dates.map((d) => [d, 0.5 * bySym.MEW.series.get(d) / a0 + 0.5 * b.get(d) / b0]));
  const r = riskStats(path, endISO, days);
  const s0 = sol.get(dates[0]), s1 = sol.get(dates[dates.length - 1]);
  const v1 = path.get(dates[dates.length - 1]);
  out.basket[`${days}d`] = { from: dates[0], to: dates[dates.length - 1], ret: v1 - 1, solRet: s1 / s0 - 1,
    relInSol: v1 / (s1 / s0) - 1, maxDrawdown: r.maxDrawdown, annVol: r.annVol,
    method: '50/50 MEW+POPCAT at window start, buy-and-hold, no rebalancing, same GeckoTerminal daily closes as the single-coin stats' };
}

// 6) repo callouts
const calloutsPath = '/home/user/Cat-Intelligence-Agency/site/assets/callouts.json';
try {
  const cj = JSON.parse(fs.readFileSync(calloutsPath, 'utf8'));
  out.repoCallouts = { path: calloutsPath, callouts: (cj.callouts || []).length, picks: (cj.picks || []).length };
} catch (e) { out.repoCallouts = { path: calloutsPath, error: String(e) }; }

out.sources = sources;
out.runFinishedAt = new Date().toISOString();
fs.writeFileSync(path.join(DIR, 'catstats.json'), JSON.stringify(out, null, 2));

// ---- markdown summary ----
const pct = (x, dp = 1) => (x == null || !isFinite(x) ? 'n/a' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(dp)}%`);
const usd = (x) => (x == null ? 'n/a' : x >= 1e9 ? `$${(x / 1e9).toFixed(2)}B` : x >= 1e6 ? `$${(x / 1e6).toFixed(2)}M` : x >= 1e3 ? `$${(x / 1e3).toFixed(1)}K` : `$${x.toFixed(0)}`);
const rr = (r) => (r ? pct(r.ret) : 'n/a');
const L = [];
L.push(`Window end (last complete UTC close): ${endISO}; 1y window common start: ${Y1_START}\n`);
L.push('| Coin | 7d | 30d | 90d | 365d | 365d from | 90d vs SOL | 365d vs SOL | source |');
L.push('|---|---|---|---|---|---|---|---|---|');
for (const [s, o] of Object.entries(out.coins)) {
  L.push(`| ${s} | ${rr(o.returns['7d'])} | ${rr(o.returns['30d'])} | ${rr(o.returns['90d'])} | ${rr(o.returns['365d'])} | ${o.returns['365d']?.from} | ${o.relToSol ? pct(o.relToSol['90d']?.relInSol) : '-'} | ${o.relToSol ? pct(o.relToSol['365d']?.relInSol) : '-'} | ${o.primarySeries} |`);
}
for (const [k, b] of Object.entries(out.basket)) L.push(`| MEW+POPCAT 50/50 ${k} (${b.from}..${b.to}) | ret ${pct(b.ret)} | vs SOL ${pct(b.relInSol)} | maxDD ${pct(b.maxDrawdown.dd)} | vol ${pct(b.annVol, 0)} | | | | |`);
L.push('\n| Coin | Ann. vol 365d | Ann. vol 90d | Max DD 365d | From CG ATH (ATH, date) | From pool peak close (peak, date) | Up days | Worst day | Best day | ffill days |');
L.push('|---|---|---|---|---|---|---|---|---|---|');
for (const [s, o] of Object.entries(out.coins)) {
  const r = o.risk365, r9 = o.risk90, a = o.fromAth.coingecko, g = o.fromAth.poolHistory;
  L.push(`| ${s} | ${pct(r.annVol, 0)} | ${pct(r9.annVol, 0)} | ${pct(r.maxDrawdown.dd)} (${r.maxDrawdown.peakDate}->${r.maxDrawdown.troughDate}) | ${a ? `${pct(a.fromAth)} (${a.ath.toPrecision(4)}, ${a.athDate.slice(0, 10)})` : 'n/a'} | ${g ? `${pct(g.fromPeakClose)} (${g.peakClose.price.toPrecision(4)}, ${g.peakClose.date}; since ${g.since})` : 'n/a'} | ${pct(r.upShare, 0)} | ${pct(r.worstDay.ret)} ${r.worstDay.date} | ${pct(r.bestDay.ret)} ${r.bestDay.date} | ${o.dataWindow.forwardFilledDays} |`);
}
L.push('\n| Coin | CG vs GT overlap days | median abs diff | days >15% off | replaced |');
L.push('|---|---|---|---|---|');
for (const [s, o] of Object.entries(out.coins)) {
  const x = o.cgVsGtCrossCheck;
  const fl = x?.flagged || [];
  L.push(`| ${s} | ${x?.overlapDays ?? '-'} | ${x ? pct(x.medianAbsDiff, 2) : '-'} | ${x ? `${fl.length}${fl.length ? ` (${fl[0].date}..${fl[fl.length - 1].date}, max ${pct(Math.max(...fl.map((f) => Math.abs(f.diff))), 0)})` : ''}` : '-'} | ${o.primarySeries === 'cg' && x ? fl.length : 0} |`);
}
L.push('\n| Coin | Jup price | Mcap (Jup) | Liquidity (Jup) | Holders (Jup) | 24h vol (Jup) | 24h chg |');
L.push('|---|---|---|---|---|---|---|');
for (const [s, o] of Object.entries(out.coins)) {
  const j = o.jupiter || {};
  L.push(`| ${s} | ${j.usdPrice?.toPrecision(4)} | ${usd(j.mcap)} | ${usd(j.liquidity)} | ${j.holderCount?.toLocaleString('en-US')} | ${usd(j.volume24h)} | ${pct((j.priceChange24h ?? NaN) / 100)} |`);
}
L.push(`\nIndependent check: ${JSON.stringify(out.independentCheck)}`);
L.push(`\nRepo callouts.json: ${JSON.stringify(out.repoCallouts)}`);
L.push(`Notes: ${JSON.stringify(out.notes)}`);
console.log(L.join('\n'));
