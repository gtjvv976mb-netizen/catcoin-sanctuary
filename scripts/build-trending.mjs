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
 *   again from DexScreener each run. A cat's adoption (below) is marked adoptedOf. Any other coin
 *   whose ticker is a sanctuary cat's (key or launchTicker), or whose name is a sanctuary cat's coin
 *   name, is a copycat (unless it is the cat's own launch). Both stay for 7 days, cat-themed or not,
 *   and are listed first.
 * - adoptions: every launch paged, cat-themed or not, is tested against the cats' Adopt kits
 *   (scripts/lib/adoptions.mjs); a cat's first launch from its kit is recorded in
 *   data/adoptions.json, which is checked and written only when it changed. A token picture is
 *   read (and hashed) only for a launch that carries a kit's name and ticker, briefly.
 * - x: the sanctuary's own posts (data/announced.json, the last 14 days) by likes, reposts,
 *   replies and quotes (GET /2/tweets, one call for up to 100 posts), at most every
 *   X_EVERY_MINUTES: reads are metered on X's plans. Needs the four X secrets; without them, or if X
 *   refuses, the last figures stay and the status says why.
 * A source that does not answer leaves its list as it was. The file is checked
 * (assets/ui/trending.js checkTrending) and written only when something changed.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkTrending, clean } from "../assets/ui/trending.js";
import { credsFromEnv, getPosts, XError } from "./lib/x-api.mjs";
import { detectCat } from "./lib/content-rules/catdetect.mjs";
import { checkFields } from "./lib/content-rules/content-rules.mjs";
import { kitsOf, ownMints, sameKit, matchAdoption, adoptionRecord, adoptionProblem, mergeAdoptions, checkAdoptions, NOTE as ADOPTIONS_NOTE } from "./lib/adoptions.mjs";

export const DS_BATCH = 30;
export const PAGE = 50;
export const MAX_PAGES = 15;
export const FRESH_HOURS = 24;
export const COPYCAT_DAYS = 7;
export const X_EVERY_MINUTES = 180;
export const X_DAYS = 14;
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const IMAGE_TIMEOUT_MS = 6000;
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

/** What a copycat is matched against: every sanctuary cat's tickers and coin name; `ours`, the sanctuary's own coins (ownMints,
 *  and every mint the launcher's ledger has sent: a sanctuary cat's own coin is never its copycat, recorded on its card yet or not);
 *  `pending`, the tickers the launcher is launching now (its mint not in the ledger yet). */
export function catIndex({ planned = { cats: [] }, adoptables = { cats: [] }, collection = { cats: [] }, launches = { launches: [] } }) {
  const tickers = new Map(), names = new Map(), ours = new Set(ownMints({ collection, adoptables })), pending = new Set();
  for (const r of launches?.launches || []) {
    if (typeof r?.mintPublic === "string") ours.add(r.mintPublic);
    else if ((r?.status === "prepared" || r?.status === "sending") && typeof r.ticker === "string") pending.add(r.ticker.toUpperCase());
  }
  for (const c of planned.cats || []) if (c.ticker) tickers.set(c.ticker.toUpperCase(), c.ticker);
  for (const c of adoptables.cats || []) {
    tickers.set(c.ticker.toUpperCase(), c.ticker);
    if (c.launchTicker) tickers.set(c.launchTicker.toUpperCase(), c.ticker);
    // A cat's coin name only when it is distinctive enough not to catch every "Luna" or "Felix".
    if (norm(c.coinName).length >= 6 && norm(c.coinName) !== norm(c.name)) names.set(norm(c.coinName), c.ticker);
  }
  return { tickers, names, ours, pending };
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

/**
 * pump.fun's launches since `sinceMs`, newest first (its public list), or null if it did not answer. The list
 * carries `reached`: true only when the walk read back past `sinceMs` (a page whose oldest real time is older);
 * a page that failed, or running out of `pages`, leaves it false (coins in between may be unread).
 */
export async function pumpLaunches(fetchImpl, sinceMs, { pause = 400, pages = MAX_PAGES } = {}) {
  const seen = new Map();
  let answered = false, reached = false;
  for (let page = 0, offset = 0; page < pages; page++) {
    const r = await getJson(fetchImpl, `https://frontend-api-v3.pump.fun/coins?offset=${offset}&limit=${PAGE}&sort=created_timestamp&order=DESC&includeNsfw=false`);
    if (!Array.isArray(r)) break;
    answered = true;
    for (const c of r) if (c?.mint && num(c.created_timestamp) >= sinceMs) seen.set(c.mint, c);
    const times = r.map((c) => num(c?.created_timestamp)).filter((t) => t > 0);
    if (times.length && Math.min(...times) < sinceMs) { reached = true; break; }
    if (!r.length) break;
    offset += r.length;
    if (pause) await sleep(pause);
  }
  return answered ? Object.assign([...seen.values()], { reached }) : null;
}

/** Pages the scan may read to catch up to its coverage mark after a gap (a late or failed run): about 2 hours of pump.fun. */
export const CATCH_UP_PAGES = 40;

/* ── Adoptions: launches from a cat's own Adopt kit ──────────────────────────────────────── */

/** The sha256 of a launch's picture, or null: https only, at most IMAGE_MAX_BYTES, given up after IMAGE_TIMEOUT_MS (IPFS gateways are slow). */
/** At most this many token pictures are read a run (IPFS gateways are slow). */
export const IMAGE_READS = 3;

export async function imageSha256(fetchImpl, url) {
  if (!/^https:\/\/\S+$/.test(String(url ?? ""))) return null;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS), headers: { "user-agent": "catcoinsanctuary.com trending" } });
    if (!res.ok || Number(res.headers?.get("content-length")) > IMAGE_MAX_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length && buf.length <= IMAGE_MAX_BYTES ? crypto.createHash("sha256").update(buf).digest("hex") : null;
  } catch { return null; }
}

/**
 * The launches that are a cat's adoption, as data/adoptions.json records (mergeAdoptions keeps the
 * earliest per cat). A picture is read only for a launch with a kit's name and ticker, and not for
 * a cat already `adopted`: a later launch of its kit is a copycat whatever it carries. A cat the
 * sanctuary launches itself has no kit (kitsOf), so a clone of its coin is a copycat, never its adoption.
 */
export async function adoptionsIn(launched, { kits, collectionMints, ownerWallets, adopted = new Set(), fetchImpl, foundAt, log = () => {} }) {
  const out = [], taken = new Set(adopted), shas = new Map();
  let reads = 0;
  // Oldest first, so the earliest launch of a kit is tried (and takes the cat) before its copies.
  for (const c of [...launched].sort((a, b) => Number(a.created_timestamp) - Number(b.created_timestamp))) {
    const same = sameKit(c, kits).filter((k) => !taken.has(k.key));
    if (!same.length) continue;
    const opts = { collectionMints, ownerWallets };
    let m = matchAdoption(c, kits, opts);
    // The picture only when nothing else in the launch matches its kit: once per image, IMAGE_READS a run.
    if (!m && same.some((k) => k.tokenSha256) && c.image_uri) {
      if (!shas.has(c.image_uri) && reads < IMAGE_READS) { reads += 1; shas.set(c.image_uri, await imageSha256(fetchImpl, c.image_uri)); }
      const sha = shas.get(c.image_uri);
      if (sha) m = matchAdoption({ ...c, imageSha256: sha }, kits, opts);
    }
    if (!m || taken.has(m.key)) continue;
    const rec = adoptionRecord(c, m, { launchpad: "pump.fun", foundAt });
    const problem = adoptionProblem(rec);
    if (problem) { log(`Not recorded as an adoption: ${problem}.`); continue; }
    out.push(rec);
    taken.add(m.key);
  }
  return out;
}

/* ── New on pump.fun ─────────────────────────────────────────────────────────────────────── */

/**
 * New on pump.fun: last run's list, plus the cat coins, adoptions and copycats launched since, their
 * market caps read again. `adopt` is { kits, collectionMints, ownerWallets, adoptions } (the records so far);
 * returns the records with any new adoption too.
 */
export async function fresh({ prev, idx, adopt, fetchImpl, nowMs, pause, log }) {
  // Read back to the coverage mark (every launch older than it was read by some run), catching up after a gap.
  const covered = Date.parse(prev?.coveredUntil ?? "") || 0;
  const since = (covered && covered > nowMs - 24 * 3600_000 ? covered : Math.max(Date.parse(prev?.updatedAt ?? 0) || 0, nowMs - 30 * 60_000)) - 60_000;
  const behind = nowMs - since > 31 * 60_000;
  const launched = await pumpLaunches(fetchImpl, since, { pause, pages: behind ? CATCH_UP_PAGES : MAX_PAGES });
  // The mark moves to now only when this read reached it; a page that failed keeps it (the next run reads the gap again).
  // A gap past even the catch-up read is let go, with a warning (no run can read it any more), and noted in `gaps`.
  let coveredUntil = prev?.coveredUntil ?? null, gap = null;
  if (launched?.reached) coveredUntil = iso(nowMs);
  else if (launched && launched.length >= (behind ? CATCH_UP_PAGES : MAX_PAGES) * PAGE) {
    gap = { from: iso(since), to: iso(Math.min(...launched.map((c) => num(c.created_timestamp)).filter((t) => t > 0))) };
    coveredUntil = iso(nowMs);
    log(`::warning::pump.fun's launches from ${gap.from} to ${gap.to} were not read (too many to catch up): adoptions in that window are not tracked.`);
  }
  // A coin the launcher is launching now (its ticker pending in the ledger) from a launcher wallet is the sanctuary's own from its first sighting.
  const owners = new Set(adopt.ownerWallets || []);
  for (const c of launched || []) if (owners.has(c.creator) && idx.pending?.has(String(c.symbol || "").toUpperCase())) idx.ours.add(c.mint);
  // Every launch against the kits, cat-themed or not: a cat's first launch from its own kit is its adoption.
  const found = await adoptionsIn(launched || [], { ...adopt, adopted: new Set(adopt.adoptions.map((a) => a.key)), fetchImpl, foundAt: iso(nowMs), log });
  const adoptions = mergeAdoptions(adopt.adoptions, found);
  const adoptedBy = new Map(adoptions.map((a) => [a.mint, a.key]));
  const mark = (r) => (adoptedBy.has(r.mint) ? { adoptedOf: adoptedBy.get(r.mint) } : { copycatOf: copycatOf(r, idx) });
  // Last run's coins, marked again (a cat's ticker may have changed since).
  const byMint = new Map((prev?.all || prev?.items || []).map(({ mint, name, symbol, createdAt, marketCapUsd }) => [mint, { mint, name, symbol, createdAt, marketCapUsd, ...mark({ mint, name, symbol }) }]));
  for (const c of launched || []) {
    const m = mark({ mint: c.mint, name: c.name, symbol: c.symbol });
    if (!m.adoptedOf && !m.copycatOf && (!isCatCoin(c.name, c.symbol) || crude(c.name, c.symbol))) continue;
    byMint.set(c.mint, { mint: c.mint, name: clean(c.name, 40), symbol: clean(c.symbol, 16), createdAt: iso(num(c.created_timestamp)),
      marketCapUsd: num(c.usd_market_cap) == null ? null : Math.round(num(c.usd_market_cap)), ...m });
  }
  // A recorded adoption on pump.fun is listed for its first week even if no run saw it launch.
  for (const a of adoptions) if (a.launchpad === "pump.fun" && !byMint.has(a.mint)) byMint.set(a.mint, { mint: a.mint, name: clean(a.name, 40), symbol: clean(a.symbol, 16), createdAt: a.createdAt, marketCapUsd: null, adoptedOf: a.key });
  const marked = (r) => !!(r.adoptedOf || r.copycatOf);
  const live = [...byMint.values()].filter((r) => nowMs - Date.parse(r.createdAt) <= (marked(r) ? COPYCAT_DAYS * 24 : FRESH_HOURS) * 3600_000);
  // Every adoption and copycat, and the newest KEEP_MAX other cat coins (thousands launch a day).
  const keep = [...live.filter(marked), ...live.filter((r) => !marked(r)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, KEEP_MAX)];
  // The same name and ticker launched over and over (spam) is one row: the biggest, with how many there are.
  // An adoption is always a row of its own: its kit's later launches are copycats. So is the sanctuary's
  // own coin (idx.ours): never counted among its copies.
  const groups = new Map();
  for (const r of keep) {
    const k = r.adoptedOf ? `adopted|${r.mint}` : idx.ours.has(r.mint) ? `own|${r.mint}` : `${norm(r.name)}|${String(r.symbol).toUpperCase()}`;
    const g = groups.get(k);
    if (!g) { groups.set(k, { ...r, count: 1 }); continue; }
    g.count += 1;
    if ((r.marketCapUsd || 0) > (g.marketCapUsd || 0)) Object.assign(g, { ...r, count: g.count });
  }
  // Adoptions, then copycats (they matter most), then the newest; the rows shown get today's market cap.
  const rank = (r) => (r.adoptedOf ? 2 : r.copycatOf ? 1 : 0);
  const rows = [...groups.values()].sort((a, b) => rank(b) - rank(a) || Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, FRESH_MAX);
  const f = await dexFigures(fetchImpl, "solana", rows, { pause });
  const byKeep = new Map(keep.map((r) => [r.mint, r]));
  for (const r of rows) { const d = f.get(r.mint); if (d?.marketCapUsd != null) { r.marketCapUsd = Math.round(d.marketCapUsd); byKeep.get(r.mint).marketCapUsd = r.marketCapUsd; } }
  return { items: rows, all: keep, answered: launched !== null, adoptions, coveredUntil, gap };
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

/**
 * One build. `data` is every input file's content (data.kits: assets/kits/kits.json; data.adoptions
 * and data.wallets may be missing); returns { trending, adoptions }: the new data/trending.json and
 * data/adoptions.json.
 */
export async function buildTrending({ data, env = {}, fetchImpl = (...a) => globalThis.fetch(...a), nowMs = Date.now(), pause = 300, log = () => {} }) {
  const prev = data.trending || {};
  const at = iso(nowMs);
  const idx = catIndex(data);
  const names = new Map([...(data.planned.cats || []).map((c) => [c.ticker, c.name]), ...(data.adoptables.cats || []).map((c) => [c.ticker, c.name])]);
  // A cat the launcher is sending or has launched has no kit any more: a coin under its name after that is a copycat, never its adoption.
  const launching = new Set((data.launches?.launches || []).filter((r) => r?.policy === "sanctuary" && (r.status === "sending" || r.status === "launched")).map((r) => r.ticker));
  const adopt = {
    kits: kitsOf({ planned: data.planned, adoptables: data.adoptables, kits: data.kits }).filter((k) => !launching.has(k.key)), collectionMints: ownMints(data),
    ownerWallets: (data.wallets?.launchers || []).map((w) => w.address), adoptions: data.adoptions?.adoptions || [],
  };
  const act = await activity({ famous: data.famous, collection: data.collection, fetchImpl, pause });
  const fr = await fresh({ prev: prev.fresh, idx, adopt, fetchImpl, nowMs, pause, log });
  const x = await xPosts({ prev: prev.x?.status === "ok" ? prev.x : null, announced: data.announced, creds: credsFromEnv(env), fetchImpl, nowMs, names });
  const row = ({ mint, name, symbol, createdAt, marketCapUsd, copycatOf, adoptedOf }) => ({ mint, name, symbol, createdAt, marketCapUsd, ...(adoptedOf ? { adoptedOf } : { copycatOf }) });
  return {
    trending: {
      note: "Written by scripts/build-trending.mjs every 20 minutes; read by the Trending tab (assets/ui/trending.js). Names and tickers under fresh were typed by strangers.",
      updatedAt: at,
      activity: act ? { updatedAt: at, items: act } : prev.activity ?? { updatedAt: null, items: [] },
      // coveredUntil: every pump.fun launch before it was read by some run (the launcher's live adoption check reads from there).
      fresh: fr.answered || fr.items.length
        ? { updatedAt: fr.answered ? at : prev.fresh?.updatedAt ?? null, coveredUntil: fr.coveredUntil, ...(fr.gap || prev.fresh?.gaps ? { gaps: [...(prev.fresh?.gaps ?? []), ...(fr.gap ? [fr.gap] : [])].slice(-10) } : {}), items: fr.items, all: fr.all.map(row) }
        : prev.fresh ?? { updatedAt: null, items: [] },
      x: x === null ? prev.x : x.items ? { updatedAt: at, status: x.status, items: x.items } : { updatedAt: prev.x?.updatedAt ?? null, status: x.status, items: prev.x?.items ?? [] },
    },
    adoptions: { note: typeof data.adoptions?.note === "string" && data.adoptions.note.trim() ? data.adoptions.note : ADOPTIONS_NOTE, adoptions: fr.adoptions },
  };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(root, f), "utf8")); } catch { return d; } };
  // The adoptions are a record: a file that is there but unreadable stops the run rather than being started again.
  let adoptions = { note: ADOPTIONS_NOTE, adoptions: [] };
  try { adoptions = JSON.parse(fs.readFileSync(path.join(root, "data/adoptions.json"), "utf8")); } catch (e) {
    if (e.code !== "ENOENT") { console.error("Nothing written: data/adoptions.json is not readable JSON."); process.exitCode = 1; return; }
  }
  const before = checkAdoptions(adoptions);
  if (before.length) { console.error(`Nothing written: data/adoptions.json does not pass its check (${before[0]}).`); process.exitCode = 1; return; }
  const data = {
    famous: read("data/famous.json", { coins: [] }), collection: read("data/collection.json", { cats: [] }), planned: read("data/planned.json", { cats: [] }),
    adoptables: read("data/adoptables.json", { cats: [] }), announced: read("data/announced.json", { cats: {} }), trending: read("data/trending.json", {}),
    kits: read("assets/kits/kits.json", null), wallets: read("data/wallets.json", { launchers: [] }), adoptions,
    launches: read("data/sanctuary-launches.json", { launches: [] }),
  };
  const { trending: next, adoptions: nextAdoptions } = await buildTrending({ data, env: process.env, log: (m) => console.log(m) });
  const checked = checkTrending(next);
  for (const k of ["activity", "fresh", "x"]) if ((next[k]?.items || []).length !== checked[k].items.length) {
    console.error(`data/trending.json not written: ${k} has rows the page would refuse.`);
    process.exitCode = 1;
    return;
  }
  const problems = checkAdoptions(nextAdoptions);
  if (problems.length) {
    console.error(`Nothing written: data/adoptions.json would not pass its check (${problems[0]}).`);
    process.exitCode = 1;
    return;
  }
  const added = nextAdoptions.adoptions.filter((a) => !adoptions.adoptions.some((b) => b.mint === a.mint));
  const rows = next.fresh.items;
  console.log(`Trending: ${next.activity.items.length} movers, ${rows.length} new cat coins (${rows.filter((r) => r.adoptedOf).length} adoptions, ${rows.filter((r) => r.copycatOf).length} copycats), X ${next.x?.status ?? "not asked"} (${next.x?.items?.length ?? 0} posts).`);
  for (const a of added) console.log(`New adoption: ${a.key} as ${a.name} ($${a.symbol}), ${a.mint}, launched ${a.createdAt} by ${a.creator} (${a.evidence.join(", ")}).`);
  if (process.argv.includes("--dry-run")) return;
  fs.writeFileSync(path.join(root, "data/trending.json"), `${JSON.stringify(next, null, 1)}\n`);
  if (JSON.stringify(nextAdoptions) !== JSON.stringify(adoptions)) fs.writeFileSync(path.join(root, "data/adoptions.json"), `${JSON.stringify(nextAdoptions, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
