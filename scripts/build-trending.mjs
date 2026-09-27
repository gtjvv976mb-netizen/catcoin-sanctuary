#!/usr/bin/env node
/**
 * BUILDS data/trending.json, the site's "Trending" tab (assets/ui/trending.js), from free public
 * endpoints and the sanctuary's own X posts. The workflow runs it every 20 minutes.
 *
 *   node scripts/build-trending.mjs [--dry-run]
 *
 * - activity: the Hall of Fame coins (data/famous.json, tier "main") and the sanctuary's launched
 *   cats (data/collection.json), each read from DexScreener (tokens/v1, 30 addresses a call): its
 *   24 h volume over all its pairs, and its main pair's market cap and 24 h price change. Ranked by
 *   volume; the top 25.
 * - fresh: cat coins launched on pump.fun since the last run (its newest-first list, paged back to
 *   the last run, at most 30 minutes and MAX_PAGES pages), kept for a day; their market cap is read
 *   again from DexScreener each run. A coin whose ticker is a sanctuary cat's (key or launchTicker),
 *   or whose name is a sanctuary cat's coin name, is a copycat (unless it is the cat's own launch)
 *   and stays for 7 days, cat-themed or not.
 * - x: the sanctuary's own posts (data/announced.json, the last 14 days) by likes, reposts,
 *   replies and quotes (GET /2/tweets, one call for up to 100 posts), at most every
 *   X_EVERY_MINUTES: reads are metered on X's plans. Needs the four X secrets; without them, or if X
 *   refuses, the last figures stay and the status says why.
 * A source that does not answer leaves its list as it was. The file is checked
 * (assets/ui/trending.js checkTrending) and written only when something changed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkTrending, clean } from "../assets/ui/trending.js";
import { credsFromEnv, getPosts, XError } from "./lib/x-api.mjs";
import { detectCat } from "./lib/content-rules/catdetect.mjs";
import { checkFields } from "./lib/content-rules/content-rules.mjs";

export const DS_BATCH = 30;
export const PAGE = 50;
export const MAX_PAGES = 15;
export const FRESH_HOURS = 24;
export const COPYCAT_DAYS = 7;
export const X_EVERY_MINUTES = 180;
export const X_DAYS = 14;
const TOP = 25, FRESH_MAX = 60, KEEP_MAX = 400, X_TOP = 15;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(+v) ? +v : null);

async function getJson(fetchImpl, url, { tries = 3, wait = 1500 } = {}) {
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetchImpl(url, { headers: { accept: "application/json", "user-agent": "catcoinsanctuary.com trending" } });
      if (res.status === 429) { await sleep(wait * (t + 2) * 2); continue; }
      if (!res.ok) { await sleep(wait); continue; }
      return await res.json();
    } catch { await sleep(wait); }
  }
  return null;
}

/* ── Cat-themed names, and copycats of the sanctuary's cats ─────────────────────────────────── */

const CAT_EMOJI = /[\u{1F408}\u{1F431}\u{1F63A}-\u{1F640}]/u;
/** Is this coin cat-themed, by its name or ticker? (the Cat-Intelligence-Agency's detector, vendored) */
export const isCatCoin = (name, symbol) => detectCat({ name: String(name || ""), symbol: String(symbol || "") }).isCat || CAT_EMOJI.test(String(name || ""));

/* Crude or sexual names are left off the site (the content rules' sexual rule, and a short list of their own). */
const CRUDE = /\b(fuck|fck|shit|ass|asshole|dick|cock|cum|porn|nude|nsfw|hentai|milf|slut|whore|rape|nigg\w*|fag\w*|retard\w*)\b/i;
export const crude = (name, symbol) => CRUDE.test(`${name} ${symbol}`) || checkFields({ name: String(name || ""), symbol: String(symbol || "") }).violations.some((v) => ["sexual", "slur", "hate"].includes(v.rule));

const norm = (s) => String(s || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");

/** What a copycat is matched against: every sanctuary cat's tickers and coin name. */
export function catIndex({ planned = { cats: [] }, adoptables = { cats: [] }, collection = { cats: [] } }) {
  const tickers = new Map(), names = new Map(), ours = new Set((collection.cats || []).map((c) => c.mint)), watch = [];
  for (const c of planned.cats || []) if (c.ticker) tickers.set(c.ticker.toUpperCase(), c.ticker);
  for (const c of adoptables.cats || []) {
    tickers.set(c.ticker.toUpperCase(), c.ticker);
    if (c.launchTicker) tickers.set(c.launchTicker.toUpperCase(), c.ticker);
    // A cat's coin name only when it is distinctive enough not to catch every "Luna" or "Felix".
    if (norm(c.coinName).length >= 6 && norm(c.coinName) !== norm(c.name)) names.set(norm(c.coinName), c.ticker);
    const e = c.existingCoin;
    if (e?.contract && [c.ticker, c.launchTicker].includes(String(e.symbol).toUpperCase())) watch.push({ mint: e.contract, symbol: e.symbol, name: c.coinName, key: c.ticker });
  }
  return { tickers, names, ours, watch };
}

/** The sanctuary cat this coin copies (its key), or null. */
export function copycatOf(coin, idx) {
  if (idx.ours.has(coin.mint)) return null;
  return idx.tickers.get(String(coin.symbol || "").toUpperCase()) ?? idx.names.get(norm(coin.name)) ?? null;
}

/* ── Sources ─────────────────────────────────────────────────────────────────────────────── */

/** DexScreener's figures for many tokens: Map(mint -> { pair, marketCapUsd, volume24hUsd, change24hPct }). */
export async function dexFigures(fetchImpl, chain, coins, { pause = 300, pairOf = () => null } = {}) {
  const out = new Map();
  for (let i = 0; i < coins.length; i += DS_BATCH) {
    const part = coins.slice(i, i + DS_BATCH);
    const r = await getJson(fetchImpl, `https://api.dexscreener.com/tokens/v1/${chain}/${part.map((c) => encodeURIComponent(c.mint)).join(",")}`);
    if (Array.isArray(r)) for (const c of part) {
      const mine = r.filter((p) => String(p?.baseToken?.address).toLowerCase() === c.mint.toLowerCase());
      if (!mine.length) continue;
      const named = pairOf(c) && mine.find((p) => String(p.pairAddress).toLowerCase() === pairOf(c).toLowerCase());
      const top = named || mine.reduce((a, b) => ((num(b.liquidity?.usd) || 0) > (num(a.liquidity?.usd) || 0) ? b : a));
      out.set(c.mint, {
        pair: String(top.pairAddress), marketCapUsd: num(top.marketCap) ?? num(top.fdv),
        volume24hUsd: mine.reduce((s, p) => s + (num(p.volume?.h24) || 0), 0), change24hPct: num(top.priceChange?.h24),
        createdAtMs: Math.min(...mine.map((p) => num(p.pairCreatedAt) ?? Infinity)), name: top.baseToken?.name, symbol: top.baseToken?.symbol,
      });
    }
    if (pause) await sleep(pause);
  }
  return out;
}

/** Top movers: the Hall of Fame and the launched sanctuary cats, by 24 h volume. Null if DexScreener did not answer. */
export async function activity({ famous, collection, fetchImpl, pause }) {
  const coins = [
    ...(famous.coins || []).filter((c) => c.tier === "main").map((c) => ({ id: c.id, kind: "famous", name: c.name, symbol: c.symbol, chain: c.chain, mint: c.contract, pair: c.pair?.address })),
    ...(collection.cats || []).map((c) => ({ id: String(c.symbol || c.mint).toUpperCase(), kind: "sanctuary", name: c.name, symbol: c.symbol, chain: "solana", mint: c.mint, pair: c.pool })),
  ].filter((c) => c.mint && /^[a-z]+$/.test(c.chain || ""));
  const figures = new Map();
  for (const chain of new Set(coins.map((c) => c.chain))) {
    const f = await dexFigures(fetchImpl, chain, coins.filter((c) => c.chain === chain), { pause, pairOf: (c) => c.pair });
    for (const [k, v] of f) figures.set(`${chain}:${k}`, v);
  }
  if (!figures.size) return null;
  return coins.map((c) => ({ ...c, ...figures.get(`${c.chain}:${c.mint}`) })).filter((c) => figures.has(`${c.chain}:${c.mint}`))
    .sort((a, b) => (b.volume24hUsd || 0) - (a.volume24hUsd || 0)).slice(0, TOP)
    .map(({ id, kind, name, symbol, chain, mint, pair, marketCapUsd, volume24hUsd, change24hPct }) => ({ id, kind, name: clean(name, 40), symbol: clean(symbol, 16), chain, mint, pair,
      marketCapUsd: marketCapUsd == null ? null : Math.round(marketCapUsd), volume24hUsd: Math.round(volume24hUsd || 0), change24hPct: change24hPct == null ? null : Math.round(change24hPct * 10) / 10 }));
}

/** pump.fun's launches since `sinceMs`, newest first (its public list), or null if it did not answer. */
export async function pumpLaunches(fetchImpl, sinceMs, { pause = 400 } = {}) {
  const seen = new Map();
  let answered = false;
  for (let page = 0, offset = 0; page < MAX_PAGES; page++) {
    const r = await getJson(fetchImpl, `https://frontend-api-v3.pump.fun/coins?offset=${offset}&limit=${PAGE}&sort=created_timestamp&order=DESC&includeNsfw=false`);
    if (!Array.isArray(r)) break;
    answered = true;
    for (const c of r) if (c?.mint && num(c.created_timestamp) >= sinceMs) seen.set(c.mint, c);
    const oldest = Math.min(...r.map((c) => num(c?.created_timestamp) ?? Infinity));
    if (!r.length || oldest < sinceMs) break;
    offset += r.length;
    if (pause) await sleep(pause);
  }
  return answered ? [...seen.values()] : null;
}

/** New on pump.fun: last run's list, plus the cat coins and copycats launched since, their market caps read again. */
export async function fresh({ prev, idx, fetchImpl, nowMs, pause }) {
  const since = Math.max(Date.parse(prev?.updatedAt ?? 0) || 0, nowMs - 30 * 60_000) - 60_000;
  const launched = await pumpLaunches(fetchImpl, since, { pause });
  // Last run's coins, their copycat mark checked again (a cat's ticker may have changed since).
  const byMint = new Map((prev?.all || prev?.items || []).map(({ count, ...r }) => [r.mint, { ...r, copycatOf: copycatOf(r, idx) }]));
  for (const c of launched || []) {
    const copy = copycatOf({ mint: c.mint, name: c.name, symbol: c.symbol }, idx);
    if (!copy && (!isCatCoin(c.name, c.symbol) || crude(c.name, c.symbol))) continue;
    byMint.set(c.mint, { mint: c.mint, name: clean(c.name, 40), symbol: clean(c.symbol, 16), createdAt: iso(num(c.created_timestamp)),
      marketCapUsd: num(c.usd_market_cap) == null ? null : Math.round(num(c.usd_market_cap)), copycatOf: copy });
  }
  // A copycat recorded by hand (a cat's existingCoin that took its ticker) joins the list with its pair's start time.
  const watch = idx.watch.filter((w) => !byMint.has(w.mint));
  if (watch.length) {
    const f = await dexFigures(fetchImpl, "solana", watch, { pause });
    for (const w of watch) { const d = f.get(w.mint); if (d?.createdAtMs) byMint.set(w.mint, { mint: w.mint, name: clean(d.name || w.name, 40), symbol: clean(d.symbol || w.symbol, 16), createdAt: iso(d.createdAtMs), marketCapUsd: d.marketCapUsd == null ? null : Math.round(d.marketCapUsd), copycatOf: w.key }); }
  }
  const live = [...byMint.values()].filter((r) => nowMs - Date.parse(r.createdAt) <= (r.copycatOf ? COPYCAT_DAYS * 24 : FRESH_HOURS) * 3600_000);
  // Every copycat, and the newest KEEP_MAX other cat coins (thousands launch a day).
  const keep = [...live.filter((r) => r.copycatOf), ...live.filter((r) => !r.copycatOf).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, KEEP_MAX)];
  // The same name and ticker launched over and over (spam) is one row: the biggest, with how many there are.
  const groups = new Map();
  for (const r of keep) {
    const k = `${norm(r.name)}|${String(r.symbol).toUpperCase()}`;
    const g = groups.get(k);
    if (!g) { groups.set(k, { ...r, count: 1 }); continue; }
    g.count += 1;
    if ((r.marketCapUsd || 0) > (g.marketCapUsd || 0)) Object.assign(g, { ...r, count: g.count });
  }
  // Copycats first (they matter most), then the newest; the rows shown get today's market cap.
  const rows = [...groups.values()].sort((a, b) => (!!b.copycatOf - !!a.copycatOf) || Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, FRESH_MAX);
  const f = await dexFigures(fetchImpl, "solana", rows, { pause });
  const byKeep = new Map(keep.map((r) => [r.mint, r]));
  for (const r of rows) { const d = f.get(r.mint); if (d?.marketCapUsd != null) { r.marketCapUsd = Math.round(d.marketCapUsd); byKeep.get(r.mint).marketCapUsd = r.marketCapUsd; } }
  return { items: rows, all: keep, answered: launched !== null };
}

/** Hot on X: the sanctuary's posts of the last X_DAYS by engagement, or { status } when X was not asked or refused. */
export async function xPosts({ prev, announced, creds, fetchImpl, nowMs, names }) {
  if (!creds) return { status: "no-keys" };
  if (prev?.updatedAt && nowMs - Date.parse(prev.updatedAt) < X_EVERY_MINUTES * 60_000) return null; // not due yet
  const posts = Object.entries(announced.cats || {})
    .filter(([, v]) => v?.status === "posted" && v.ids?.[0] && nowMs - Date.parse(v.at) <= X_DAYS * 86_400_000)
    .sort((a, b) => Date.parse(b[1].at) - Date.parse(a[1].at)).slice(0, 100);
  if (!posts.length) return { status: "ok", items: [] };
  let data;
  try { data = await getPosts(posts.map(([, v]) => v.ids[0]), creds, fetchImpl); }
  catch (e) { return { status: e instanceof XError ? (e.status === 429 ? "limited" : "refused") : "unreachable" }; }
  const byId = new Map((data?.data || []).map((t) => [String(t.id), t.public_metrics || {}]));
  const items = posts.filter(([, v]) => byId.has(v.ids[0])).map(([key, v]) => {
    const m = byId.get(v.ids[0]);
    return { key, name: clean(names.get(key) || key, 40), tweet: v.ids[0], postedAt: iso(Date.parse(v.at)), likes: m.like_count || 0, reposts: m.retweet_count || 0,
      replies: m.reply_count || 0, quotes: m.quote_count || 0, impressions: num(m.impression_count) };
  });
  const score = (r) => r.likes + 2 * r.reposts + r.replies + r.quotes;
  return { status: "ok", items: items.sort((a, b) => score(b) - score(a) || Date.parse(b.postedAt) - Date.parse(a.postedAt)).slice(0, X_TOP) };
}

/** One build. `data` is every input file's content; returns the new data/trending.json. */
export async function buildTrending({ data, env = {}, fetchImpl = (...a) => globalThis.fetch(...a), nowMs = Date.now(), pause = 300 }) {
  const prev = data.trending || {};
  const at = iso(nowMs);
  const idx = catIndex(data);
  const names = new Map([...(data.planned.cats || []).map((c) => [c.ticker, c.name]), ...(data.adoptables.cats || []).map((c) => [c.ticker, c.name])]);
  const act = await activity({ famous: data.famous, collection: data.collection, fetchImpl, pause });
  const fr = await fresh({ prev: prev.fresh, idx, fetchImpl, nowMs, pause });
  const x = await xPosts({ prev: prev.x?.status === "ok" ? prev.x : null, announced: data.announced, creds: credsFromEnv(env), fetchImpl, nowMs, names });
  return {
    note: "Written by scripts/build-trending.mjs every 20 minutes; read by the Trending tab (assets/ui/trending.js). Names and tickers under fresh were typed by strangers.",
    updatedAt: at,
    activity: act ? { updatedAt: at, items: act } : prev.activity ?? { updatedAt: null, items: [] },
    fresh: fr.answered || fr.items.length ? { updatedAt: fr.answered ? at : prev.fresh?.updatedAt ?? null, items: fr.items, all: fr.all.map(({ mint, name, symbol, createdAt, marketCapUsd, copycatOf }) => ({ mint, name, symbol, createdAt, marketCapUsd, copycatOf })) } : prev.fresh ?? { updatedAt: null, items: [] },
    x: x === null ? prev.x : x.items ? { updatedAt: at, status: x.status, items: x.items } : { updatedAt: prev.x?.updatedAt ?? null, status: x.status, items: prev.x?.items ?? [] },
  };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(root, f), "utf8")); } catch { return d; } };
  const data = {
    famous: read("data/famous.json", { coins: [] }), collection: read("data/collection.json", { cats: [] }), planned: read("data/planned.json", { cats: [] }),
    adoptables: read("data/adoptables.json", { cats: [] }), announced: read("data/announced.json", { cats: {} }), trending: read("data/trending.json", {}),
  };
  const next = await buildTrending({ data, env: process.env });
  const checked = checkTrending(next);
  for (const k of ["activity", "fresh", "x"]) if ((next[k]?.items || []).length !== checked[k].items.length) {
    console.error(`data/trending.json not written: ${k} has rows the page would refuse.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Trending: ${next.activity.items.length} movers, ${next.fresh.items.length} new cat coins (${next.fresh.items.filter((r) => r.copycatOf).length} copycats), X ${next.x?.status ?? "not asked"} (${next.x?.items?.length ?? 0} posts).`);
  if (process.argv.includes("--dry-run")) return;
  fs.writeFileSync(path.join(root, "data/trending.json"), `${JSON.stringify(next, null, 1)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
