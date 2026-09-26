#!/usr/bin/env node
/**
 * REFRESHES the market figures of the famous cat coins in data/famous.json, from free public
 * endpoints, and writes the file only when something changed and it still validates.
 *
 *   node scripts/refresh-famous.mjs [--dry-run]
 *
 * - DexScreener, https://api.dexscreener.com/tokens/v1/<chain>/<up to 30 addresses>: every pair of
 *   each coin. Liquidity is the coin's pair (the one data/famous.json names, else its deepest
 *   pair); 24 h volume is the sum over all its pairs; market cap is that pair's market cap (or its
 *   FDV when DexScreener gives no market cap).
 * - CoinGecko, https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=<up to 250 ids>:
 *   for a coin with a CoinGecko id, its circulating market cap replaces DexScreener's (CoinGecko
 *   counts circulating supply; DexScreener often counts all of it).
 * A coin neither source answers for keeps its last figures and the time they were read. Nothing
 * else changes: not a coin's tier (where it lives in the garden), its lore, links or warnings.
 * If the result would not validate (assets/collection.js validateFamous), nothing is written and
 * the run fails.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateFamous } from "../assets/collection.js";

export const DS_BATCH = 30;
export const CG_BATCH = 250;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(fetchImpl, url, { tries = 3, wait = 1500 } = {}) {
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetchImpl(url, { headers: { accept: "application/json" } });
      if (res.status === 429) { await sleep(wait * (t + 2) * 4); continue; }
      if (!res.ok) { await sleep(wait); continue; }
      return await res.json();
    } catch { await sleep(wait); }
  }
  return null;
}

/** The figures DexScreener gives for one coin from its pairs, or null. */
export function fromPairs(coin, pairs) {
  const mine = (pairs || []).filter((p) => p?.baseToken?.address?.toLowerCase() === coin.contract.toLowerCase());
  if (!mine.length) return null;
  const named = coin.pair?.address ? mine.find((p) => String(p.pairAddress).toLowerCase() === coin.pair.address.toLowerCase()) : null;
  const top = named || mine.reduce((a, b) => ((b.liquidity?.usd || 0) > (a.liquidity?.usd || 0) ? b : a));
  const num = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  const mcap = num(top.marketCap) ?? num(top.fdv);
  const liq = num(top.liquidity?.usd);
  const vol = mine.reduce((s, p) => s + (num(p.volume?.h24) || 0), 0);
  if (mcap === null && liq === null) return null;
  return { marketCapUsd: mcap, liquidityUsd: liq, volume24hUsd: vol };
}

/**
 * One refresh. `data` is data/famous.json's content; returns { data, updated: [id], kept: [id] }.
 * @param {object} o
 * @param {Function} [o.fetchImpl]
 * @param {number} [o.nowMs]
 * @param {number} [o.pause]  ms between requests (be gentle with free endpoints)
 */
export async function refreshFamous({ data, fetchImpl = (...a) => globalThis.fetch(...a), nowMs = Date.now(), pause = 350 }) {
  const coins = data.coins.map((c) => JSON.parse(JSON.stringify(c)));
  const ds = new Map();
  const byChain = new Map();
  for (const c of coins) { if (!byChain.has(c.chain)) byChain.set(c.chain, []); byChain.get(c.chain).push(c); }
  for (const [chain, list] of byChain) {
    for (let i = 0; i < list.length; i += DS_BATCH) {
      const part = list.slice(i, i + DS_BATCH);
      const r = await getJson(fetchImpl, `https://api.dexscreener.com/tokens/v1/${chain}/${part.map((c) => encodeURIComponent(c.contract)).join(",")}`);
      if (Array.isArray(r)) for (const c of part) { const f = fromPairs(c, r); if (f) ds.set(c.id, f); }
      if (pause) await sleep(pause);
    }
  }
  const cg = new Map();
  const ids = [...new Set(coins.map((c) => c.coingeckoId).filter(Boolean))];
  for (let i = 0; i < ids.length; i += CG_BATCH) {
    const part = ids.slice(i, i + CG_BATCH);
    const r = await getJson(fetchImpl, `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=250&ids=${part.map(encodeURIComponent).join(",")}`);
    if (Array.isArray(r)) for (const m of r) if (typeof m?.id === "string" && typeof m.market_cap === "number" && m.market_cap > 0) cg.set(m.id, { marketCapUsd: m.market_cap, volume24hUsd: typeof m.total_volume === "number" ? m.total_volume : null });
    if (pause) await sleep(pause);
  }
  const updated = [], kept = [];
  const at = iso(nowMs);
  for (const c of coins) {
    const d = ds.get(c.id), g = c.coingeckoId ? cg.get(c.coingeckoId) : null;
    if (!d && !g) { kept.push(c.id); continue; }
    const m = c.market;
    const next = {
      marketCapUsd: Math.round(g?.marketCapUsd ?? d?.marketCapUsd ?? m.marketCapUsd),
      liquidityUsd: Math.round(d?.liquidityUsd ?? m.liquidityUsd),
      volume24hUsd: Math.round(d?.volume24hUsd ?? g?.volume24hUsd ?? m.volume24hUsd),
      measuredAt: at,
      source: g ? "coingecko" : "dexscreener",
    };
    c.market = next;
    updated.push(c.id);
  }
  return { data: { ...data, refreshedAt: at, coins }, updated, kept };
}

/** data/famous.json as written: a few header fields, then one coin per line (small, and a refresh's diff reads by coin). */
export const serialize = (d) => `{\n "note": ${JSON.stringify(d.note)},\n "refreshedAt": ${JSON.stringify(d.refreshedAt)},\n "coins": [\n${d.coins.map((c) => `  ${JSON.stringify(c)}`).join(",\n")}\n ]\n}\n`;

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const file = path.join(root, "data/famous.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const r = await refreshFamous({ data });
  const check = validateFamous(r.data);
  if (check.refused.length) {
    console.error(`The famous coins were not updated: ${check.refused.length} would not validate (${check.refused[0].detail}).`);
    process.exitCode = 1;
    return;
  }
  console.log(`${r.updated.length} coins refreshed; ${r.kept.length} kept their last figures${r.kept.length ? ` (${r.kept.slice(0, 12).join(", ")}${r.kept.length > 12 ? ", …" : ""})` : ""}.`);
  if (process.argv.includes("--dry-run")) return;
  fs.writeFileSync(file, serialize(r.data));
  console.log("Wrote data/famous.json.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
