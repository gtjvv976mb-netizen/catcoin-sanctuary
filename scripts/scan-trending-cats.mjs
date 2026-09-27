#!/usr/bin/env node
/**
 * THE RESEARCH TEAM'S TREND WATCH: cats trending on X right now (real cats, cartoon cats, cats from
 * fiction), found early, so the sanctuary can be the first to give each one a coin and a home.
 *
 *   node scripts/scan-trending-cats.mjs [--dry-run]
 *
 * 1. X's own trending lists (worldwide, the US, Japan and the account's "for you" trends; whichever
 *    the plan allows): a trend that is a cat (its name, or X files it under pets / animals) is
 *    searched on its own, up to TREND_SEARCHES a run. Then X recent search (searchRecent; an X plan
 *    whose keys may search) for cat posts with a picture or video, no retweets or replies, and no
 *    coin talk (a post already shilling a ticker is late, not early).
 * 2. A post qualifies when it is at most MAX_AGE_HOURS old and has at least MIN_LIKES likes or
 *    MIN_VIEWS views; it is ranked by engagement per hour (likes + 2 x reposts + views / 100).
 * 3. The best new ones (at most PER_RUN a run) are read: is it about one particular cat, the cat's
 *    name, real / cartoon / fiction, a coin name and ticker in the sanctuary's style, one line of lore,
 *    and whether it is sensitive (a cat that died or is ill, a tragedy, a child, anything a coin would
 *    be in poor taste for). X-only mode (the default, no Anthropic key): scripts/lib/read-cat-post.mjs
 *    reads the post's words by rules (readBy "rules"). With ANTHROPIC_API_KEY set, Claude reads the
 *    words, the author and the picture instead (readBy "claude").
 * 4. Its ticker is looked up on DexScreener: coins that already use it are recorded next to it, for the
 *    record only. A taken ticker does not rule a cat out; an accurate name and ticker matter more.
 *
 * data/trending-cats.json keeps every post it has read (so none is read twice) with its figures and
 * Claude's reading, newest first; "candidates" are the ones fit to launch: about one cat, not
 * sensitive, with a name and ticker. Launching stays a person's decision: the file is
 * the shortlist, each with its kit ready (name, ticker, lore, proof post, picture).
 *
 * Secrets: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (search) and, optionally,
 * ANTHROPIC_API_KEY. Without the X keys nothing is searched; without the Anthropic key it runs X-only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { credsFromEnv, searchRecent, getTrends, getPersonalizedTrends, XError } from "./lib/x-api.mjs";
import { checkFields } from "./lib/content-rules/content-rules.mjs";
import { detectCat } from "./lib/content-rules/catdetect.mjs";
import { readPostByRules } from "./lib/read-cat-post.mjs";

export const QUERY = '(cat OR cats OR kitten OR kitty OR "my cat" OR 猫 OR ねこ OR gato) has:media -is:retweet -is:reply -"$" -pump -memecoin -solana -"contract address" -airdrop -giveaway';
export const MAX_AGE_HOURS = 48;
export const MIN_LIKES = 20_000;
export const MIN_VIEWS = 1_000_000;
export const PER_RUN = 5;
export const KEEP = 400;
export const MODEL = "claude-opus-5";
export const TREND_PLACES = [1, 23424977, 23424856]; // worldwide, the US, Japan
export const TREND_SEARCHES = 3;
const NO_COIN_TALK = '-is:retweet -is:reply -"$" -pump -memecoin -solana -"contract address" -airdrop -giveaway';
const CATTISH = /\b(?:cats?|kitt(?:y|ies|en|ens)|meow\w*|purr\w*|neko|nyan|gato|chat(?:on|te)|katze|kucing|pusa)\b|猫|ねこ|ネコ|にゃ/i;

/** The cat trends among X's trending lists: [{ name, count, where }], at most TREND_SEARCHES, busiest first. */
export async function catTrends(creds, fetchImpl = fetch) {
  const found = new Map();
  const add = (name, count, where) => {
    const n = String(name || "").replace(/["\u0000-\u001f]/g, "").trim().slice(0, 60);
    if (n && !found.has(n.toLowerCase())) found.set(n.toLowerCase(), { name: n, count: Number(count) || 0, where });
  };
  for (const woeid of TREND_PLACES) {
    try { for (const t of (await getTrends(woeid, creds, fetchImpl))?.data || []) if (CATTISH.test(t.trend_name) || detectCat({ name: t.trend_name }).isCat) add(t.trend_name, t.tweet_count, woeid); }
    catch { /* not in this plan, or X is down: the plain search still runs */ }
  }
  try {
    for (const t of (await getPersonalizedTrends(creds, fetchImpl))?.data || []) {
      if (CATTISH.test(t.trend_name) || /\b(?:pets?|animals?|cats?)\b/i.test(t.category || "")) add(t.trend_name, postCount(t.post_count), "for-you");
    }
  } catch { /* same */ }
  return [...found.values()].sort((a, b) => b.count - a.count).slice(0, TREND_SEARCHES);
}

/** X's "12.5K posts" as a number (12500). */
export function postCount(v) {
  const m = String(v ?? "").replace(/,/g, "").match(/([\d.]+)\s*([KkMm])?/);
  return m ? Math.round(parseFloat(m[1]) * (/k/i.test(m[2] || "") ? 1e3 : /m/i.test(m[2] || "") ? 1e6 : 1)) || 0 : 0;
}

/** Several search answers as one: posts once each, their users and media together. */
export function mergeAnswers(answers) {
  const data = new Map(), users = new Map(), media = new Map();
  for (const a of answers) {
    for (const t of a?.data || []) if (!data.has(t.id)) data.set(t.id, t);
    for (const u of a?.includes?.users || []) users.set(u.id, u);
    for (const m of a?.includes?.media || []) media.set(m.media_key, m);
  }
  return { data: [...data.values()], includes: { users: [...users.values()], media: [...media.values()] } };
}
const TICKER = /^[A-Z0-9]{2,10}$/;

/** Engagement per hour since the post: likes + 2 x reposts + views / 100. */
export function heat(m, ageHours) {
  return Math.round(((m.like_count || 0) + 2 * (m.retweet_count || 0) + (m.impression_count || 0) / 100) / Math.max(1, ageHours));
}

/** The qualifying posts of one search answer, hottest first: { id, url, text, author, postedAt, likes, views, reposts, heat, media }. */
export function qualify(answer, nowMs) {
  const users = new Map((answer?.includes?.users || []).map((u) => [u.id, u]));
  const media = new Map((answer?.includes?.media || []).map((m) => [m.media_key, m]));
  const out = [];
  for (const t of answer?.data || []) {
    const m = t.public_metrics || {};
    const age = (nowMs - Date.parse(t.created_at)) / 3_600_000;
    if (!(age >= 0 && age <= MAX_AGE_HOURS)) continue;
    if ((m.like_count || 0) < MIN_LIKES && (m.impression_count || 0) < MIN_VIEWS) continue;
    if (t.possibly_sensitive) continue;
    const pics = (t.attachments?.media_keys || []).map((k) => media.get(k)).filter(Boolean)
      .map((x) => ({ type: x.type, url: x.url || x.preview_image_url || null })).filter((x) => x.url && /^https:\/\/pbs\.twimg\.com\//.test(x.url));
    if (!pics.length) continue;
    const u = users.get(t.author_id);
    const handle = u?.username || "i";
    out.push({ id: t.id, url: `https://x.com/${handle}/status/${t.id}`, text: String(t.text || "").slice(0, 600), author: { handle, name: u?.name || null, followers: u?.public_metrics?.followers_count ?? null },
      postedAt: new Date(Date.parse(t.created_at)).toISOString().replace(/\.\d{3}Z$/, "Z"), likes: m.like_count || 0, views: m.impression_count || 0, reposts: m.retweet_count || 0, heat: heat(m, age), media: pics.slice(0, 2) });
  }
  return out.sort((a, b) => b.heat - a.heat);
}

/** What Claude is asked to return for a post. */
export const READING = {
  type: "object",
  additionalProperties: false,
  required: ["aboutOneCat", "catName", "kind", "coinName", "ticker", "lore", "sensitive", "why"],
  properties: {
    aboutOneCat: { type: "boolean", description: "The post is about one particular cat (a real pet, a cartoon cat or a cat from fiction), not cats in general, a product, or a joke with no cat at its centre." },
    catName: { type: ["string", "null"], description: "The cat's own name as the post or its author gives it; null if it has none." },
    kind: { type: "string", enum: ["real", "cartoon", "fiction", "none"] },
    coinName: { type: ["string", "null"], description: "A short, catchy coin name for the cat (at most 32 characters, letters, digits and spaces), usually its name." },
    ticker: { type: ["string", "null"], description: "A memeable ticker: 2 to 10 capital letters or digits, no $." },
    lore: { type: ["string", "null"], description: "One sentence (at most 200 characters) of what the cat is doing or why people love it, only from the post; no prices, no promises." },
    sensitive: { type: "boolean", description: "True if a coin would be in poor taste: the cat died, is ill or hurt, a tragedy or cruelty, a child is involved, politics, or anything upsetting." },
    why: { type: "string", description: "One short sentence explaining the reading." },
  },
};

const PROMPT = `You are the research team of Catcoin Sanctuary, a site that gives famous cats a memecoin and a home in a 3D garden.
Read this X post that is trending right now and say whether it is about one particular cat that could become a fun, harmless cat coin.
Only use what the post and its picture show. Never invent a name. Mark anything sad, cruel, medical, political or involving children as sensitive.`;

/** Claude's reading of one post, checked; null when it could not be read. `client` is an Anthropic client. */
export async function readPost(post, client) {
  const content = [
    ...post.media.filter((m) => m.type === "photo" || m.url).slice(0, 1).map((m) => ({ type: "image", source: { type: "url", url: m.url } })),
    { type: "text", text: `Post by @${post.author.handle}${post.author.name ? ` (${post.author.name})` : ""}, ${post.likes} likes, ${post.views} views:\n\n${post.text}` },
  ];
  let res;
  try {
    res = await client.messages.create({
      model: MODEL, max_tokens: 2000, system: PROMPT,
      output_config: { effort: "low", format: { type: "json_schema", schema: READING } },
      messages: [{ role: "user", content }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.APIConnectionError) return null;
    throw e;
  }
  if (res.stop_reason === "refusal") return { aboutOneCat: false, catName: null, kind: "none", coinName: null, ticker: null, lore: null, sensitive: true, why: "declined to read it" };
  const text = res.content.find((b) => b.type === "text")?.text;
  let r;
  try { r = JSON.parse(text); } catch { return null; }
  return cleanReading(r);
}

/** A reading made safe to store and show: lengths, the ticker's shape, no price talk or links in the lore. */
export function cleanReading(r) {
  const s = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁩]/g, " ").replace(/\s+/g, " ").trim().slice(0, n) : null);
  const ticker = s(r?.ticker, 12)?.replace(/^\$+/, "").toUpperCase() ?? null;
  const lore = s(r?.lore, 200);
  const loreOk = lore && checkFields({ lore }).violations.every((v) => !["link", "price", "sexual", "hate", "slur"].includes(v.rule)) && !/\$|https?:|www\./i.test(lore);
  return {
    aboutOneCat: r?.aboutOneCat === true, catName: s(r?.catName, 40) || null, kind: ["real", "cartoon", "fiction"].includes(r?.kind) ? r.kind : "none",
    coinName: s(r?.coinName, 32) || null, ticker: ticker && TICKER.test(ticker) ? ticker : null, lore: loreOk ? lore : null,
    sensitive: r?.sensitive !== false, why: s(r?.why, 200) || "", readBy: r?.readBy === "rules" ? "rules" : "claude",
  };
}

/** Coins already using this ticker on Solana (DexScreener search): [{ mint, name, symbol, url }]. */
export async function tickerTaken(ticker, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(ticker)}`);
    if (!res.ok) return null;
    const pairs = (await res.json())?.pairs || [];
    return [...new Map(pairs.filter((p) => p.chainId === "solana" && String(p.baseToken?.symbol).toUpperCase() === ticker)
      .map((p) => [p.baseToken.address, { mint: p.baseToken.address, name: String(p.baseToken.name).slice(0, 40), symbol: ticker, url: p.url }])).values()];
  } catch { return null; }
}

/** Is this reading a launch candidate? */
export const isCandidate = (p) => p.reading && p.reading.aboutOneCat && !p.reading.sensitive && p.reading.kind !== "none" && p.reading.catName && p.reading.coinName && p.reading.ticker && p.reading.lore && !p.known;

/**
 * One run. `data` is { trending (data/trending-cats.json), names (the sanctuary's cat names and tickers, lower-case) };
 * `client` an Anthropic client, or null for X-only mode (the post's words read by rules). Returns the new file content.
 */
export async function scan({ data, creds, client, fetchImpl = fetch, nowMs = Date.now(), log = () => {} }) {
  const prev = data.trending?.posts || [];
  const seen = new Set(prev.map((p) => p.id));
  const trends = await catTrends(creds, fetchImpl);
  const byTrend = new Map();
  const trendAnswers = [];
  for (const tr of trends) {
    try {
      const a = await searchRecent(`"${tr.name}" has:media ${NO_COIN_TALK}`, creds, fetchImpl);
      for (const t of a?.data || []) if (!byTrend.has(t.id)) byTrend.set(t.id, tr.name);
      trendAnswers.push(a);
    } catch { /* the plain search below still runs */ }
  }
  let answer;
  try { answer = mergeAnswers([...trendAnswers, await searchRecent(QUERY, creds, fetchImpl)]); }
  catch (e) {
    log(`X search refused (${e instanceof XError ? `HTTP ${e.status}` : e.message}); keeping the last list. Search needs an X plan whose keys may search (Basic or above).`);
    return { ...data.trending, checkedAt: new Date(nowMs).toISOString(), trends, searchError: e instanceof XError ? e.status : "unreachable" };
  }
  // A post found through a cat trend is a cat post already; the rest must say cat.
  const fresh = qualify(answer, nowMs).map((p) => (byTrend.has(p.id) ? { ...p, trend: byTrend.get(p.id) } : p))
    .filter((p) => !seen.has(p.id) && (p.trend || detectCat({ name: p.text }).isCat || /猫|ねこ|gato/.test(p.text)))
    .sort((a, b) => (b.trend ? 1 : 0) - (a.trend ? 1 : 0) || b.heat - a.heat);
  log(`Trend watch: ${trends.length ? `cat trends on X: ${trends.map((t) => t.name).join(", ")}; ` : "no cat trend on X's lists; "}${answer?.data?.length ?? 0} posts searched, ${fresh.length} new ones trending.`);
  const read = [];
  for (const p of fresh.slice(0, PER_RUN)) {
    const reading = client ? await readPost(p, client) : cleanReading(readPostByRules(p));
    const known = !!reading?.catName && (data.names.has(reading.catName.toLowerCase()) || (reading.ticker && data.names.has(reading.ticker.toLowerCase())));
    const taken = reading?.ticker ? await tickerTaken(reading.ticker, fetchImpl) : null;
    const row = { ...p, readAt: reading ? new Date(nowMs).toISOString() : null, reading, known, taken };
    row.status = isCandidate(row) ? "candidate" : reading ? "passed" : "unread";
    read.push(row);
    log(`  ${row.status}: ${p.url} (${p.likes} likes, ${p.views} views)${reading ? ` -> ${reading.catName ?? "no name"} ${reading.ticker ?? ""} ${reading.why}` : ""}`);
  }
  // An unread post is tried again next run (it stays out of `seen` by not being stored).
  const posts = [...read.filter((r) => r.status !== "unread"), ...prev].sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt)).slice(0, KEEP);
  return {
    note: "Written by scripts/scan-trending-cats.mjs: cats trending on X, read by rules (X-only) or by Claude (readBy). candidates = about one cat, not sensitive, not already in the sanctuary (taken = Solana coins already using the ticker, for the record). Launching is a person's decision.",
    checkedAt: new Date(nowMs).toISOString(), trends, searchError: null,
    candidates: posts.filter((p) => p.status === "candidate").map((p) => p.id),
    posts,
  };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(root, f), "utf8")); } catch { return d; } };
  const creds = credsFromEnv(process.env);
  if (!creds) { console.log("Trend watch: no X secrets; nothing searched."); return; }
  const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  if (!client) console.log("Trend watch: X-only mode (no ANTHROPIC_API_KEY): posts are read by rules.");
  const names = new Set([...read("data/planned.json", { cats: [] }).cats, ...read("data/adoptables.json", { cats: [] }).cats]
    .flatMap((c) => [c.name, c.coinName, c.ticker, c.launchTicker]).filter(Boolean).map((s) => String(s).toLowerCase()));
  const next = await scan({ data: { trending: read("data/trending-cats.json", { posts: [] }), names }, creds, client, log: console.log });
  if (process.argv.includes("--dry-run")) { console.log(JSON.stringify(next.candidates)); return; }
  fs.writeFileSync(path.join(root, "data/trending-cats.json"), `${JSON.stringify(next, null, 1)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((e) => { console.error(e); process.exitCode = 1; });
