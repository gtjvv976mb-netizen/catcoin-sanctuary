#!/usr/bin/env node
/**
 * THE RESEARCH TEAM'S TREND WATCH: cats trending on X right now (real cats, cartoon cats, cats from
 * fiction), found early, so the sanctuary can be the first to give each one a coin and a home.
 *
 *   node scripts/scan-trending-cats.mjs [--dry-run]
 *
 * The read budget allows about one X search an hour, so each run makes AT MOST ONE post search, of
 * PER_SEARCH posts, through one "lens", the first that applies:
 *   1. "trend": X's own trending lists (worldwide, the US, Japan and the account's "for you" trends;
 *      whichever the plan allows; not post reads): a trend that is a cat (its name, or X files it under
 *      pets / animals), not a sanctuary cat, and not searched in the last TREND_COOLDOWN_HOURS is searched
 *      on its own; one never searched before goes first, then the busiest (up to MAX_TRENDS are kept).
 *   2. "emerging": a cat's name spreading: every post any search returns is combed for names given the
 *      clear ways ("my cat Mochi", "meet Mochi", "Mochi the cat", "#MochiTheCat", "#MochiCat"; not "Best
 *      cat ever" or "#LazyCat"; state.names, 72 hours kept). A name at least two different accounts gave
 *      in the last NAME_WINDOW_HOURS, not a sanctuary cat, not followed up in the last FOLLOW_UP_HOURS, is
 *      searched ("Mochi" with a cat word) to catch it before it peaks. What a name's own follow-up finds
 *      never keeps it spreading; after a follow-up it is searched again only once another search finds
 *      a new account giving it.
 *   3. Otherwise the ROTATION, its place kept in state.nextLens: "big", "viral", "big", "figures".
 *      "big": the cat posts (replies too, with or without a picture, coin talk allowed: a big account
 *      saying "catcoin" is the signal) of the big accounts in data/cat-watch.json, by recency, the
 *      handles in chunks of at most MAX_QUERY characters, one chunk a turn (state.bigChunk): the
 *      topAccounts (the ones that move memecoins) every other big turn, the famous people and
 *      companies of bigAccounts sharing the turns between.
 *      "viral": QUERY, cat posts with a picture or video, no retweets or replies, no coin talk (a post
 *      already shilling a ticker is late, not early). "figures": the famous cat characters and cat
 *      memes in data/cat-watch.json that are not in the sanctuary yet, by name, in chunks
 *      (state.figureChunk). A lens whose list is empty is skipped.
 *   The rotation keeps at least every other run (so the big accounts at least every fourth): after a
 *   trend or emerging run (state.lastLens) only a trend never searched before may go ahead of it.
 * A post qualifies (stage) when it is not marked sensitive, has a picture, and is either "viral" (at
 * most MAX_AGE_HOURS old, MIN_LIKES likes or MIN_VIEWS views) or, failing that, "rising" (at most
 * RISING_MAX_AGE_HOURS old, RISING_MIN_LIKES likes at RISING_LIKES_PER_HOUR or RISING_VIEWS_PER_HOUR
 * views; per hour since posting, counted as at least RISING_MIN_HOURS). On any lens, a post a big
 * account (a watched one, or any account with BIG_FOLLOWERS followers) made in the last MAX_AGE_HOURS that
 * mentions a cat qualifies ("big-account"), picture or not. A long post is read whole (note_tweet). Posts are ranked by engagement per hour (likes + 2 x
 * reposts + views / 100).
 *
 * The best new ones (at most PER_RUN a run) are read: is it about one particular cat, the cat's name,
 * real / cartoon / fiction, a coin name and ticker in the sanctuary's style, one line of lore, and
 * whether it is sensitive (a cat that died or is ill, a tragedy, a child, anything a coin would be in
 * poor taste for). X-only mode (the default, no Anthropic key): scripts/lib/read-cat-post.mjs reads the
 * post's words by rules (readBy "rules"). With ANTHROPIC_API_KEY set, Claude reads the words, the author
 * and the picture instead (readBy "claude"). Then the lens may name the cat (reading.nameFrom): on the
 * figures lens a watch-list figure the post names ("figure"; it replaces the reading's own name only
 * when that name is the figure's, so "my cat Mochi watching Tom and Jerry" stays Mochi); on the trend
 * lens, when the reading found no name, the figure the trend names or the trend's own name when it has a
 * cat's name's shape ("#PuddingTheCat" is Pudding, "Doja Cat" and "Cat Stevens" are nobody; see
 * nameFromTrend); on the emerging lens the name followed up, when the post writes it. Read by rules, a
 * trend post must itself mention a cat or say the name; read by Claude, a lent name never overrules
 * Claude saying the post is not about one cat. A figure's name of several everyday words ("Grumpy
 * Cat", "Top Cat") counts only written with its capitals, not "my grumpy cat". Its ticker is looked up
 * on DexScreener: coins that already use it are recorded next to it, for the record only. A taken
 * ticker does not rule a cat out; an accurate name and ticker matter more.
 *
 * data/trending-cats.json keeps every post it has read (so none is read twice) with its figures, lens,
 * stage and reading, newest first; "candidates" are the ones fit to launch: about one cat, not
 * sensitive, with a name and ticker, not already in the sanctuary (by the name the post gives or the one
 * lent); "signals" are posts by watched big accounts about a cat with no cat's name in them and nothing
 * sensitive, for a person to look at. Launching stays a person's decision: the file is the shortlist,
 * each with its kit ready (name, ticker, lore, proof post, picture). "state" carries the rotation, the
 * last lens, the chunks, when each trend and name was searched, and the names being tracked.
 *
 * X post reads are budgeted (X counts every post a search returns against the plan's monthly cap, which
 * the announcer shares): at most READ_BUDGET a month (repository variable TRENDWATCH_MONTHLY_READS),
 * paced evenly across the days, PER_SEARCH posts per search (TRENDWATCH_PER_SEARCH, 10 to 100). When
 * today's share cannot pay for a search the run searches nothing and keeps the last list; the count is
 * kept in data/trending-cats.json ("reads").
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
import { readPostByRules, namesIn, describes, tickerFor, loreFrom, NOT_NAMES, SENSITIVE, CARTOON, FICTION } from "./lib/read-cat-post.mjs";

export const QUERY = '(cat OR cats OR kitten OR kitty OR "my cat" OR 猫 OR ねこ OR gato) has:media -is:retweet -is:reply -"$" -pump -memecoin -solana -"contract address" -airdrop -giveaway';
export const MAX_AGE_HOURS = 48;
export const MIN_LIKES = 20_000;
export const MIN_VIEWS = 1_000_000;
export const RISING_MAX_AGE_HOURS = 12;      // "rising": young and climbing fast, found before it is viral
export const RISING_MIN_LIKES = 1_000;
export const RISING_LIKES_PER_HOUR = 500;
export const RISING_VIEWS_PER_HOUR = 50_000;
export const RISING_MIN_HOURS = 0.25;         // a younger post's rate is counted over 15 minutes, so a few early views are no rush
export const PER_RUN = 5;
export const KEEP = 400;
export const MODEL = "claude-opus-5";
export const TREND_PLACES = [1, 23424977, 23424856]; // worldwide, the US, Japan
export const TREND_SEARCHES = 2;     // kept for compatibility: a run searches at most one trend now (see chooseLens)
export const MAX_TRENDS = 20;        // cat trends kept a run (busiest first), so a small new one is not crowded out by two big ones
export const READ_BUDGET = 10_000;   // posts a month, leaving room for the announcer on a small plan
export const PER_SEARCH = 10;        // posts per search (X's minimum is 10, its maximum 100)
export const TREND_PER_SEARCH = 10;  // kept for compatibility: a trend search now asks for PER_SEARCH like every lens
export const EVERY_MINUTES = 60;     // how often it searches (the workflow wakes every 20 minutes)
export const ROTATION = ["big", "viral", "big", "figures"];  // the lenses taken in turn when no trend or name needs a search
export const TREND_COOLDOWN_HOURS = 6;   // a cat trend is searched again after this long
export const FOLLOW_UP_HOURS = 12;       // an emerging name is searched again after this long
export const NAME_WINDOW_HOURS = 48;     // a name is emerging when 2+ accounts gave it within this window
export const NAME_KEEP_HOURS = 72;       // name sightings older than this are forgotten
export const MAX_NAMES = 300;            // names tracked at most (the least recently seen go first)
export const MAX_SIGHTINGS = 20;         // sightings (and so authors and posts) kept per name
export const MAX_SIGNALS = 50;
export const MAX_QUERY = 512;            // X's query length limit on the Basic plan
export const BIG_FOLLOWERS = 1_000_000;  // an account this big counts as a big account on any lens, listed or not
export const BIG_TERMS = "(cat OR cats OR kitten OR kitty OR meow OR catcoin OR 猫 OR 🐱 OR 🐈)";
export const EMERGING_TERMS = "(cat OR cats OR kitten OR kitty OR meow)";
export const FIGURE_CAT_TERMS = "(cat OR cats OR kitten OR kitty)";  // with a figure whose name people share (needsCatWord)
const LENSES = ["trend", "emerging", ...new Set(ROTATION)];

/** The read budget for the day of nowMs: { day, month, dayCap, monthCap, dayUsed, monthUsed, left }. */
export function readBudget(reads, nowMs, monthly = READ_BUDGET) {
  const d = new Date(nowMs), day = d.toISOString().slice(0, 10), month = day.slice(0, 7);
  const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const monthUsed = reads?.month === month ? Number(reads.monthUsed) || 0 : 0;
  const dayUsed = reads?.day === day ? Number(reads.dayUsed) || 0 : 0;
  const dayCap = Math.floor(monthly / days);
  return { day, month, dayCap, monthCap: monthly, dayUsed, monthUsed, left: Math.max(0, Math.min(dayCap - dayUsed, monthly - monthUsed)) };
}
const NO_COIN_TALK = '-is:retweet -is:reply -"$" -pump -memecoin -solana -"contract address" -airdrop -giveaway';
const CATTISH = /\b(?:cats?|kitt(?:y|ies|en|ens)|meow\w*|purr\w*|neko|nyan|gato|chat(?:on|te)|katze|kucing|pusa)\b|猫|ねこ|ネコ|にゃ/i;

/** The cat trends among X's trending lists: [{ name, count, where }], at most MAX_TRENDS, busiest first. */
export async function catTrends(creds, fetchImpl = fetch) {  // trend lists are not post reads
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
  return [...found.values()].sort((a, b) => b.count - a.count).slice(0, MAX_TRENDS);
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

/** How far a post of these figures and this age has come: "viral", "rising" or null. Viral beats rising. */
export function stageOf(m, ageHours) {
  const likes = m?.like_count || 0, views = m?.impression_count || 0;
  if (!(ageHours >= 0 && ageHours <= MAX_AGE_HOURS)) return null;
  if (likes >= MIN_LIKES || views >= MIN_VIEWS) return "viral";
  const hours = Math.max(RISING_MIN_HOURS, ageHours);  // per hour since posting, counted as at least 15 minutes
  if (ageHours <= RISING_MAX_AGE_HOURS && ((likes >= RISING_MIN_LIKES && likes / hours >= RISING_LIKES_PER_HOUR) || views / hours >= RISING_VIEWS_PER_HOUR)) return "rising";
  return null;
}

/** A post's whole text: a long post's (over 280 characters) is in note_tweet, its `text` only the start. */
export const postText = (t) => String((typeof t?.note_tweet?.text === "string" && t.note_tweet.text) || t?.text || "");

const CAT_SIGNS = /猫|ねこ|ネコ|にゃ|[🐱🐈😺😸😹😻😼😽🙀😿😾]/u;
/** Does a post's text mention a cat (a cat word, catcoin, 猫, a cat emoji)? Links and @handles do not count. */
export function mentionsCat(text) {
  const t = String(text || "").replace(/https?:\/\/\S+/g, " ").replace(/@\w+/g, " ");
  return detectCat({ name: t }).isCat || CAT_SIGNS.test(t);
}

/**
 * The qualifying posts of one search answer, hottest first: { id, url, text, author, postedAt, likes, views, reposts, heat, media, stage }
 * and bigAccount (the handle) when a big account wrote it: one on the watch lists, or any account with at least
 * BIG_FOLLOWERS followers. A big account's post from the last MAX_AGE_HOURS that mentions a cat qualifies on any lens,
 * with or without a picture (stage "big-account"): the account's reach is the signal.
 */
export function qualify(answer, nowMs, { lens = null, bigAccounts = [] } = {}) {
  const users = new Map((answer?.includes?.users || []).map((u) => [u.id, u]));
  const media = new Map((answer?.includes?.media || []).map((m) => [m.media_key, m]));
  const big = new Map(bigAccounts.map((h) => [String(h).toLowerCase(), String(h)]));
  const out = [];
  for (const t of answer?.data || []) {
    const m = t.public_metrics || {};
    const age = (nowMs - Date.parse(t.created_at)) / 3_600_000;
    if (!(age >= 0 && age <= MAX_AGE_HOURS)) continue;
    if (t.possibly_sensitive) continue;
    const text = postText(t);
    const pics = (t.attachments?.media_keys || []).map((k) => media.get(k)).filter(Boolean)
      .map((x) => ({ type: x.type, url: x.url || x.preview_image_url || null })).filter((x) => x.url && /^https:\/\/pbs\.twimg\.com\//.test(x.url));
    const u = users.get(t.author_id);
    const handle = u?.username || "i";
    const followers = u?.public_metrics?.followers_count;
    const bigAccount = big.get(handle.toLowerCase()) || (Number.isFinite(followers) && followers >= BIG_FOLLOWERS && handle !== "i" ? handle : null);
    let stage;
    if (bigAccount && mentionsCat(text)) stage = "big-account";  // the account's reach is the signal
    else {
      stage = stageOf(m, age);
      if (!stage || !pics.length) continue;
    }
    out.push({ id: t.id, url: `https://x.com/${handle}/status/${t.id}`, text: text.slice(0, 600), author: { handle, name: u?.name || null, followers: u?.public_metrics?.followers_count ?? null },
      postedAt: new Date(Date.parse(t.created_at)).toISOString().replace(/\.\d{3}Z$/, "Z"), likes: m.like_count || 0, views: m.impression_count || 0, reposts: m.retweet_count || 0, heat: heat(m, age), media: pics.slice(0, 2),
      stage, ...(bigAccount ? { bigAccount } : {}) });
  }
  return out.sort((a, b) => b.heat - a.heat);
}

/* ---------- the watch lists (data/cat-watch.json) ---------- */

const FIGURE_KINDS = ["cartoon", "fiction", "real", "meme"];
const READING_KIND = { cartoon: "cartoon", fiction: "fiction", real: "real", meme: "cartoon" };
const text1 = (v, n) => (typeof v === "string" ? v.replace(/["\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n) : "");

/**
 * data/cat-watch.json made safe to use: { topAccounts: [handles], bigAccounts: [every watched handle, top ones first], figures: [{ name, aliases, kind, ticker, matchOnlyAliases, needsCatWord, terms }] }.
 * A missing or broken file gives empty lists. A figure whose name or alias is in `known` (the sanctuary's names, lower case)
 * is left out: that cat is home already. `terms` are what a figure is searched and matched by: its name and aliases, or
 * only its aliases when matchOnlyAliases (a figure with matchOnlyAliases and no alias is left out). A term found inside a
 * sanctuary cat's name, or inside that name with "cat" after it, is dropped too ("Tom Cat" is in Talking Tom's old name,
 * "Talking Tom Cat"), and a figure left with no term is left out.
 */
export function watchList(raw, known = new Set()) {
  const handles = new Map();  // once each, as first written; topAccounts first
  const listed = (key) => (Array.isArray(raw?.[key]) ? raw[key] : []).map((v) => String(v ?? "").trim().replace(/^@/, "")).filter((h) => /^\w{1,15}$/.test(h));
  const topAccounts = [];
  for (const h of listed("topAccounts")) if (!handles.has(h.toLowerCase())) { handles.set(h.toLowerCase(), h); topAccounts.push(h); }
  for (const h of listed("bigAccounts")) if (!handles.has(h.toLowerCase())) handles.set(h.toLowerCase(), h);
  const bigAccounts = [...handles.values()];  // every watched handle, top ones first
  const homes = [...known].filter((k) => /\p{L}/u.test(k)).flatMap((k) => [k, `${k} cat`]);
  const atHome = (term) => homes.some((k) => k.match(termRe(term).re));
  const figures = [];
  const taken = new Set();
  for (const f of Array.isArray(raw?.figures) ? raw.figures : []) {
    const name = text1(f?.name, 40);
    if (!name || taken.has(name.toLowerCase())) continue;
    const aliases = [...new Set((Array.isArray(f.aliases) ? f.aliases : []).map((a) => text1(a, 60)).filter(Boolean))];
    const matchOnlyAliases = f.matchOnlyAliases === true;
    if (matchOnlyAliases && !aliases.length) continue;
    if ([name, ...aliases].some((n) => known.has(n.toLowerCase()))) continue;
    const ticker = String(f.ticker ?? "").replace(/^\$+/, "").toUpperCase();
    const terms = [...new Map((matchOnlyAliases ? aliases : [name, ...aliases]).map((t) => [t.toLowerCase(), t])).values()].filter((t) => !atHome(t));
    if (!terms.length) continue;
    taken.add(name.toLowerCase());
    figures.push({ name, aliases, kind: FIGURE_KINDS.includes(f.kind) ? f.kind : "real", ticker: TICKER.test(ticker) ? ticker : null, matchOnlyAliases, needsCatWord: f.needsCatWord === true, terms });
  }
  return { topAccounts, bigAccounts, figures };
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const termRes = new Map();
/**
 * How a figure's term is found: `re` matches it case-insensitively, as whole words (a hyphenated word is one), any spacing, "and" also as "&";
 * `caps` (a phrase only) says which of its words must be written with a capital (see saysTerm).
 */
function termRe(term) {
  if (!termRes.has(term)) {
    const words = term.trim().split(/\s+/);
    const body = words.map((w) => (/^(?:and|&)$/i.test(w) ? "(?:and|&)" : esc(w))).join("\\s+");
    // A hyphen joins words: "Same-nyan cat" (a sanctuary cat) does not say "Nyan Cat".
    termRes.set(term, { re: new RegExp(`(?<![\\p{L}\\p{N}-])${body}(?![\\p{L}\\p{N}-])`, "giu"), caps: words.length > 1 ? words.map((w) => /^\p{Lu}/u.test(w)) : null });
  }
  return termRes.get(term);
}
/**
 * Does a text name this term? One word matches in any case ("floppa"). A phrase is mostly everyday words ("grumpy cat",
 * "top cat", "polite cat" are how people describe their own cat), so it matches only as the figure's name is written:
 * its capitalised words capitalised ("Grumpy Cat", "GRUMPY CAT", "#GrumpyCat"; not "my grumpy cat").
 */
function saysTerm(text, term) {
  const { re, caps } = termRe(term);
  for (const m of text.matchAll(re)) {
    if (!caps) return true;
    const got = m[0].split(/\s+/);
    if (caps.every((c, i) => !c || /^\p{Lu}/u.test(got[i] || ""))) return true;
  }
  return false;
}
/** A text with its CamelCase hashtags split ("#GrumpyCat" is "#Grumpy Cat") and &amp; as &. */
const readable = (text) => String(text || "").replace(/&amp;/g, "&")
  .replace(/#(\w+)/g, (_, w) => `#${w.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")}`);

/**
 * The watch-list figure a text names, or null: the longest term that matches (saysTerm) wins. A figure with needsCatWord
 * also needs the text to mention a cat, unless the matching term itself is a cat word ("Garfield the cat").
 */
export function figureIn(text, figures = []) {
  const t = readable(text);
  let best = null;
  for (const f of figures) {
    for (const term of f.terms || []) {
      if (!saysTerm(t, term)) continue;
      if (f.needsCatWord && !mentionsCat(term) && !mentionsCat(t)) continue;
      if (!best || term.length > best.term.length) best = { figure: f, term };
    }
  }
  return best?.figure ?? null;
}

/** X queries of at most `max` characters built from `items`, split into as few, as even chunks as fit. */
export function chunked(items, build, max = MAX_QUERY) {
  for (let k = 1; k <= items.length; k++) {
    const size = Math.ceil(items.length / k);
    const qs = [];
    for (let i = 0; i < items.length; i += size) qs.push(build(items.slice(i, i + size)));
    if (qs.every((q) => q.length <= max)) return qs;
  }
  return items.map((i) => build([i])).filter((q) => q.length <= max);
}

const bigQuery = (hs) => `(${hs.map((h) => `from:${h}`).join(" OR ")}) ${BIG_TERMS} -is:retweet`;
/**
 * The big-account lens's queries, one a turn: their cat posts (replies allowed, no media needed, no coin-talk filter).
 * With top accounts, their queries take every other turn and the other watched accounts share the rest, a chunk
 * each: top, rest 1, top, rest 2, ... So the accounts that move memecoins are searched most often.
 */
export function bigQueries(handles = [], top = []) {
  const tops = new Set(top.map((h) => h.toLowerCase()));
  const rest = handles.filter((h) => !tops.has(h.toLowerCase()));
  const tq = top.length ? chunked(top, bigQuery) : [], rq = rest.length ? chunked(rest, bigQuery) : [];
  if (!tq.length || !rq.length) return [...tq, ...rq];
  return rq.flatMap((q, i) => [tq[i % tq.length], q]);
}
/** A figure's term in a query: quoted; for a figure whose name people share (needsCatWord), with a cat word too. */
const figureTerm = (f, t) => (f.needsCatWord && !mentionsCat(t) ? `("${t}" ${FIGURE_CAT_TERMS})` : `"${t}"`);
/** The figures lens's queries: posts naming a watched figure, with a picture, no coin talk. */
export const figureQueries = (figures = []) => chunked(figures, (fs) => `(${fs.flatMap((f) => f.terms.map((t) => figureTerm(f, t))).join(" OR ")}) has:media ${NO_COIN_TALK}`);
/** The emerging lens's query for one name. */
export const emergingQuery = (name) => `"${name}" ${EMERGING_TERMS} has:media ${NO_COIN_TALK}`;
/** The trend lens's query for one trend. */
export const trendQuery = (trend) => `"${trend}" has:media ${NO_COIN_TALK}`;

/* ---------- naming a cat from the lens ---------- */

// Words that make a trend (or a tracked name) a day, a club or a greeting, not one cat.
const NOT_A_CAT_NAME = new Set(`day days week weekend national international world global of in on at to for from by with and or
club love lovers lover fans fan appreciation twitter tweet x caturday caturdays meme memes vibes challenge trend trending viral official
hello hi hey everyone everybody someone somebody anyone anybody nobody people guys friends adopt adoption shelter`.split(/\s+/));

/**
 * The cat's name a trend gives, or null. "#" is dropped and CamelCase split ("#PuddingTheCat" is "Pudding The Cat"). What
 * is left must be one to three words of letters, none of them one of read-cat-post's NOT_NAMES or a day / club / greeting
 * word, and the trend must have a cat's name's shape:
 *   - "X the Cat" / "#XTheCat" (or Kitten, Kitty): X, the clearest shape ("Pudding the Cat" is Pudding);
 *   - one hashtag "#XCat" / "#XKitten": X, when it is one word that names rather than describes (#MochiKitten is Mochi,
 *     #SleepyCat is nothing);
 *   - anything else, "X Cat" written apart or a trend with no cat word, only when X is a name already tracked (`tracked`,
 *     lower case: someone wrote "my cat X", "meet X" or "#XTheCat" in the last 72 hours).
 * A leading "Cat" is never stripped: "Cat Stevens", "Cat Power", "Kitty Pryde" are people. So "Doja Cat", "Grumpy Cat",
 * "Dancing Cat", "Kentucky Wildcats", "Moo Deng" and "Cat Pudding" give null: the cat word goes only when what remains is
 * plainly a name. (A trend that is a watch-list figure, like Grumpy Cat, is named after the figure by the scan instead.)
 * A trend that is a sanctuary cat's name (`known`, lower case), whole or without its cat word, is given as that name
 * ("Hello Kitty"; "#TalkingTomCat" is Talking Tom), so the scan knows the cat is home already.
 */
export function nameFromTrend(trend, known = new Set(), tracked = new Set()) {
  const raw = String(trend || "").trim();
  const oneTag = /^#[^\s#]+$/.test(raw);
  const t = raw.replace(/^#+/, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").replace(/[_\s]+/g, " ").trim();
  if (!t) return null;
  if (known.has(t.toLowerCase())) return t;
  const words = t.split(" ");
  const catWord = (w) => /^(?:cat|kitty|kitten)$/i.test(w || "");
  let rest = words, shape = "bare";
  if (words.length >= 3 && catWord(words.at(-1)) && /^the$/i.test(words.at(-2))) { rest = words.slice(0, -2); shape = "the"; }
  else if (words.length >= 2 && catWord(words.at(-1))) { rest = words.slice(0, -1); shape = oneTag ? "tag" : "apart"; }
  const name = rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  if (rest.length && known.has(name.toLowerCase())) return name;
  if (!rest.length || rest.length > 3) return null;
  if (!rest.every((w) => /^\p{Script=Latin}{2,20}$/u.test(w) && !NOT_NAMES.has(w.toLowerCase()) && !NOT_A_CAT_NAME.has(w.toLowerCase()))) return null;
  if (shape === "the") return name;
  if (shape === "tag" && rest.length === 1 && !describes(rest[0])) return name;
  return tracked.has(name.toLowerCase()) && !describes(name) ? name : null;
}

/**
 * A reading with a name borrowed from the lens: { name, from ("figure", "trend", "emerging"), kind?, ticker?, override? }.
 * Without `override` the reading's own name wins. The borrowed name is the cat's and coin's name, the ticker the figure's or
 * tickerFor(name), kind the figure's (a meme reads as cartoon), else the reading's, else (rules only) cartoon / fiction from
 * the post's words, else real. The post's words still decide sensitive. About one cat only when not sensitive and a lore
 * line exists, and, when Claude read the post, only when Claude said so: a borrowed name never overrules Claude's verdict
 * (nor its kind "none"). The rules' reading only looks for a name, so its "no" is just "no name found".
 */
export function nameReading(reading, text, borrow) {
  if (!reading || !borrow?.name || (reading.catName && !borrow.override)) return reading;
  const t = String(text || "");
  const judged = reading.readBy !== "rules";  // Claude judged whether the post is about one cat
  const sensitive = reading.sensitive !== false || SENSITIVE.test(t);
  const kind = READING_KIND[borrow.kind] || (reading.kind !== "none" ? reading.kind : judged ? "none" : CARTOON.test(t) ? "cartoon" : FICTION.test(t) ? "fiction" : "real");
  const r = cleanReading({ ...reading, catName: borrow.name, coinName: borrow.name, ticker: borrow.ticker || tickerFor(borrow.name), kind,
    lore: reading.lore || loreFrom(t, borrow.name), sensitive, why: `${reading.why ? `${reading.why}; ` : ""}name from the ${borrow.from}` });
  return { ...r, aboutOneCat: (judged ? reading.aboutOneCat === true : true) && !r.sensitive && !!r.lore, nameFrom: borrow.from };
}

/** Is `name` (a reading's cat name) the figure itself: its name, an alias, or one of their own words ("Floppa" for Big Floppa)? */
export function isFigureName(name, figure) {
  const n = String(name || "").trim().toLowerCase();
  if (!n || !figure) return false;
  const all = [figure.name, ...(figure.aliases || [])].map((x) => x.toLowerCase());
  const words = new Set(all.flatMap((x) => x.split(/\s+/)).filter((w) => !/^(?:the|and|&|cat|cats|kitty|kitten|mr\.?)$/.test(w)));
  return all.includes(n) || words.has(n);
}

/* ---------- name tracking (the emerging lens) ---------- */

/**
 * Record every cat name the posts of a search answer give (qualifying or not) in `names` (state.names); returns it. Each
 * sighting keeps when the post was made (at), when it was found (seen) and through which search (`via`: the lens, or
 * "emerging:<key>" for a name's own follow-up, which never counts toward that name spreading).
 */
export function trackNames(names, answer, nowMs, via = null) {
  const users = new Map((answer?.includes?.users || []).map((u) => [u.id, u]));
  const seen = new Date(nowMs).toISOString();
  for (const t of answer?.data || []) {
    const posted = Date.parse(t.created_at);
    const at = Number.isFinite(posted) ? Math.min(posted, nowMs) : nowMs;
    if (nowMs - at > NAME_KEEP_HOURS * 3_600_000) continue;
    const author = users.get(t.author_id)?.username || `id:${t.author_id ?? "?"}`;
    const likes = t.public_metrics?.like_count || 0;
    for (const name of namesIn(postText(t))) {
      const key = name.toLowerCase();
      if (NOT_A_CAT_NAME.has(key)) continue;
      if (!Object.hasOwn(names, key)) names[key] = { name, sightings: [] };  // own keys only: a cat called Constructor is no prototype
      const e = names[key];
      if (!Array.isArray(e.sightings)) e.sightings = [];
      const s = e.sightings.find((x) => x.post === String(t.id));
      if (s) s.likes = likes;
      else e.sightings.push({ at: new Date(at).toISOString(), author, post: String(t.id), likes, seen, ...(via ? { via } : {}) });
    }
  }
  return names;
}

/**
 * state.names kept small: sightings older than NAME_KEEP_HOURS dropped, MAX_SIGHTINGS newest kept per name, at most
 * MAX_NAMES names (the least recently seen dropped), most recent first. Each name shows firstSeen, lastSeen, its authors
 * and posts (newest first) and its likes in total.
 */
export function pruneNames(names, nowMs) {
  const out = [];
  for (const [key, e] of Object.entries(names || {})) {
    const sightings = (Array.isArray(e?.sightings) ? e.sightings : [])
      .filter((s) => s && nowMs - Date.parse(s.at) <= NAME_KEEP_HOURS * 3_600_000)
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, MAX_SIGHTINGS);
    if (!sightings.length) continue;
    out.push([key, { name: String(e.name || key), firstSeen: sightings.at(-1).at, lastSeen: sightings[0].at,
      authors: [...new Set(sightings.map((s) => s.author))].slice(0, MAX_SIGHTINGS), posts: sightings.map((s) => s.post),
      likes: sightings.reduce((n, s) => n + (Number(s.likes) || 0), 0), sightings }]);
  }
  return Object.fromEntries(out.sort((a, b) => Date.parse(b[1].lastSeen) - Date.parse(a[1].lastSeen)).slice(0, MAX_NAMES));
}

/**
 * The names spreading now: at least two different accounts gave them in the last NAME_WINDOW_HOURS, not a sanctuary cat
 * (`known`, lower case), not one of NOT_NAMES or a describing word. A name's own follow-up search finds it by design, so
 * what that search found never counts for it: only what the other searches found. A name already followed up
 * (`followedUp`, state.followedUp) is spreading again only when an account that had not given it before was found giving
 * it since. [{ key, name, authors, lastSeen }], most accounts first, then most recent.
 */
export function emergingNames(names, { known = new Set(), nowMs, followedUp = {} }) {
  const out = [];
  for (const [key, e] of Object.entries(names || {})) {
    if (known.has(key) || NOT_NAMES.has(key) || NOT_A_CAT_NAME.has(key) || describes(key)) continue;
    const counted = (e.sightings || []).filter((s) => s && s.via !== `emerging:${key}`);
    const recent = counted.filter((s) => nowMs - Date.parse(s.at) <= NAME_WINDOW_HOURS * 3_600_000);
    const authors = new Set(recent.map((s) => s.author)).size;
    if (authors < 2) continue;
    const since = Object.hasOwn(followedUp || {}, key) ? Date.parse(followedUp[key]) : NaN;
    if (Number.isFinite(since)) {
      const found = (s) => Date.parse(s.seen || s.at);
      const before = new Set(counted.filter((s) => found(s) <= since).map((s) => s.author));
      if (!recent.some((s) => found(s) > since && !before.has(s.author))) continue;
    }
    out.push({ key, name: e.name, authors, lastSeen: e.lastSeen });
  }
  return out.sort((a, b) => b.authors - a.authors || Date.parse(b.lastSeen) - Date.parse(a.lastSeen));
}

/* ---------- the lens ---------- */

/** The run state from data/trending-cats.json, checked and pruned (a copy). */
export function loadState(raw, nowMs) {
  const idx = (v, n) => (Number.isInteger(v) && v >= 0 ? v % n : 0);
  const recent = (map, hours) => Object.fromEntries(Object.entries(map && typeof map === "object" ? map : {})
    .filter(([, at]) => typeof at === "string" && nowMs - Date.parse(at) <= hours * 3_600_000));
  return {
    nextLens: idx(raw?.nextLens, ROTATION.length), bigChunk: idx(raw?.bigChunk, 1e6), figureChunk: idx(raw?.figureChunk, 1e6),
    lastLens: LENSES.includes(raw?.lastLens) ? raw.lastLens : null,
    trendSearchedAt: recent(raw?.trendSearchedAt, 24), followedUp: recent(raw?.followedUp, NAME_KEEP_HOURS),
    names: pruneNames(structuredClone(raw?.names || {}), nowMs),
  };
}

/** Is this trend a sanctuary cat (`known`, lower case), by its name or the name it gives ("#TalkingTomCat")? */
const trendAtHome = (trend, known) => known.has(trend.toLowerCase()) || known.has(String(nameFromTrend(trend, known) || "").toLowerCase());

/**
 * This run's lens and its one query: { lens, query, sort, ... }. Priority: a cat trend not searched in the last
 * TREND_COOLDOWN_HOURS (one never searched first, then the busiest; a sanctuary cat's trend is not searched), then an
 * emerging name not followed up in the last FOLLOW_UP_HOURS, then the ROTATION from state.nextLens, skipping a lens
 * whose watch list is empty ("viral" is always there). The rotation (and so the big accounts) keeps at least every
 * other run: after a trend or emerging run (state.lastLens), only a trend never searched before may go ahead of it.
 */
export function chooseLens({ trends = [], state, watch, known = new Set(), nowMs }) {
  const within = (map, key, hours) => Object.hasOwn(map, key) && typeof map[key] === "string" && nowMs - Date.parse(map[key]) < hours * 3_600_000;
  const rotationsTurn = state.lastLens === "trend" || state.lastLens === "emerging";
  const open = trends.filter((tr) => !trendAtHome(tr.name, known) && !within(state.trendSearchedAt, tr.name.toLowerCase(), TREND_COOLDOWN_HOURS));
  const tr = open.find((x) => !Object.hasOwn(state.trendSearchedAt, x.name.toLowerCase())) || (rotationsTurn ? null : open[0]);
  if (tr) return { lens: "trend", trend: tr.name, query: trendQuery(tr.name), sort: "relevancy" };
  if (!rotationsTurn) {
    for (const e of emergingNames(state.names, { known, nowMs, followedUp: state.followedUp })) {
      if (!within(state.followedUp, e.key, FOLLOW_UP_HOURS)) return { lens: "emerging", name: e.name, key: e.key, query: emergingQuery(e.name), sort: "relevancy" };
    }
  }
  const lists = { big: bigQueries(watch.bigAccounts, watch.topAccounts || []), figures: figureQueries(watch.figures) };
  for (let i = 0; i < ROTATION.length; i++) {
    const at = (state.nextLens + i) % ROTATION.length, lens = ROTATION[at];
    if (lens === "viral") return { lens, rotation: at, query: QUERY, sort: "relevancy" };
    const qs = lists[lens];
    if (!qs.length) continue;
    const chunk = state[lens === "big" ? "bigChunk" : "figureChunk"] % qs.length;
    return { lens, rotation: at, chunk, chunks: qs.length, query: qs[chunk], sort: lens === "big" ? "recency" : "relevancy" };  // a big account's newest posts first
  }
  return { lens: "viral", rotation: 1, query: QUERY, sort: "relevancy" };
}

/** Record that the lens had its turn: the trend or name searched now, or the rotation (and chunk) moved on. */
function advance(pick, state, nowMs) {
  const now = new Date(nowMs).toISOString();
  state.lastLens = pick.lens;
  if (pick.lens === "trend") state.trendSearchedAt[pick.trend.toLowerCase()] = now;
  else if (pick.lens === "emerging") state.followedUp[pick.key] = now;
  else {
    state.nextLens = (pick.rotation + 1) % ROTATION.length;
    if (pick.lens === "big") state.bigChunk = (pick.chunk + 1) % pick.chunks;
    if (pick.lens === "figures") state.figureChunk = (pick.chunk + 1) % pick.chunks;
  }
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
 * One run. `data` is { trending (data/trending-cats.json), names (the sanctuary's cat names and tickers, lower-case),
 * watch (data/cat-watch.json; missing: empty lists) }; `client` an Anthropic client, or null for X-only mode (the post's
 * words read by rules). At most one X post search (see chooseLens). Returns the new file content.
 */
export async function scan({ data, creds, client, fetchImpl = fetch, nowMs = Date.now(), log = () => {}, monthlyReads = READ_BUDGET, perSearch = PER_SEARCH }) {
  const prev = data.trending?.posts || [];
  const seen = new Set(prev.map((p) => p.id));
  const known = data.names || new Set();
  const budget = readBudget(data.trending?.reads, nowMs, monthlyReads);
  const perPlain = Math.min(100, Math.max(10, Math.round(perSearch)));
  const reads = { day: budget.day, dayUsed: budget.dayUsed, month: budget.month, monthUsed: budget.monthUsed, monthCap: budget.monthCap, dayCap: budget.dayCap };
  const spend = (a) => { const n = a?.data?.length || 0; reads.dayUsed += n; reads.monthUsed += n; };
  const left = () => Math.min(reads.dayCap - reads.dayUsed, reads.monthCap - reads.monthUsed);
  if (left() < perPlain) {
    log(`Trend watch: today's X read budget is spent (${reads.dayUsed}/${reads.dayCap} today, ${reads.monthUsed}/${reads.monthCap} this month); nothing searched.`);
    return { ...data.trending, checkedAt: new Date(nowMs).toISOString(), lens: null, query: null, reads, searchError: null };
  }
  const watch = watchList(data.watch, known);
  const state = loadState(data.trending?.state, nowMs);
  const trends = await catTrends(creds, fetchImpl);
  const pick = chooseLens({ trends, state, watch, known, nowMs });
  let answer;
  try { answer = await searchRecent(pick.query, creds, fetchImpl, { maxResults: perPlain, sort: pick.sort }); spend(answer); advance(pick, state, nowMs); }
  catch (e) {
    // X busy or down (429, 5xx, unreachable): the same search is tried next run. A refused query (other 4xx) moves on.
    if (e instanceof XError && e.status >= 400 && e.status < 500 && e.status !== 429) advance(pick, state, nowMs);
    log(`X search refused (${e instanceof XError ? `HTTP ${e.status}` : e.message}; lens ${pick.lens}); keeping the last list. Search needs an X plan whose keys may search (Basic or above).`);
    return { ...data.trending, checkedAt: new Date(nowMs).toISOString(), lens: pick.lens, query: pick.query, trends, reads, searchError: e instanceof XError ? e.status : "unreachable", state };
  }
  state.names = pruneNames(trackNames(state.names, answer, nowMs, pick.lens === "emerging" ? `emerging:${pick.key}` : pick.lens), nowMs);

  // The lens's own clue to the cat: the trend, the name followed up, or the figure a post names.
  const trendFigure = pick.lens === "trend" ? figureIn(pick.trend, watch.figures) : null;
  const trendName = pick.lens === "trend" ? nameFromTrend(pick.trend, known, new Set(Object.keys(state.names))) : null;
  const saysName = (text, name) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(name)}(?![\\p{L}\\p{N}])`, "u").test(text);  // as written: a capitalised name, not "mochi" the food
  const decorate = (p) => {
    const q = { ...p, lens: pick.lens };
    if (pick.lens === "trend") { q.trend = pick.trend; if (trendFigure) q.figure = trendFigure.name; }
    if (pick.lens === "emerging") q.emerging = pick.name;
    if (pick.lens === "figures") { const f = figureIn(p.text, watch.figures); if (f) q.figure = f.name; }
    return q;
  };
  // The name the lens lends a post's reading, or null. The figures lens's figure replaces the reading's own name only when
  // that name is the figure's ("Floppa" is Big Floppa); a different cat keeps its own name ("my cat Mochi is watching Tom
  // and Jerry" is Mochi), p.figure still saying what it mentions. On the trend lens, when the rules read the post (they
  // cannot see the picture or judge the post), the post must itself mention a cat or say the name it would borrow.
  const borrowFor = (p, reading) => {
    const fig = p.figure && watch.figures.find((f) => f.name === p.figure);
    const speaks = (name) => reading?.readBy !== "rules" || mentionsCat(p.text) || saysName(p.text, name) || (fig && figureIn(p.text, [fig]));
    if (fig && (pick.lens !== "trend" || speaks(fig.name))) {
      return { name: fig.name, from: "figure", kind: fig.kind, ticker: fig.ticker, override: pick.lens === "figures" && (!reading?.catName || isFigureName(reading.catName, fig)) };
    }
    if (pick.lens === "trend" && trendName && speaks(trendName)) return { name: trendName, from: "trend" };
    if (pick.lens === "emerging" && saysName(p.text, pick.name)) return { name: pick.name, from: "emerging" };
    return null;
  };
  const atHome = (r) => !!r?.catName && (known.has(r.catName.toLowerCase()) || (!!r.ticker && known.has(r.ticker.toLowerCase())));
  // A post found through a cat trend, a name followed up with a cat word, a watched figure or a big account's cat post
  // is a cat post already; the rest must say cat.
  const fresh = qualify(answer, nowMs, { lens: pick.lens, bigAccounts: watch.bigAccounts }).map(decorate)
    .filter((p) => !seen.has(p.id) && (p.trend || p.emerging || p.figure || p.stage === "big-account" || detectCat({ name: p.text }).isCat || /猫|ねこ|gato/.test(p.text)))
    .sort((a, b) => (b.trend ? 1 : 0) - (a.trend ? 1 : 0) || b.heat - a.heat);
  const what = pick.lens === "trend" ? `cat trend "${pick.trend}"` : pick.lens === "emerging" ? `emerging name "${pick.name}"` : pick.chunks ? `${pick.lens} (chunk ${pick.chunk + 1} of ${pick.chunks})` : pick.lens;
  log(`Trend watch: lens ${what}; ${trends.length ? `cat trends on X: ${trends.map((t) => t.name).join(", ")}; ` : "no cat trend on X's lists; "}${answer?.data?.length ?? 0} posts searched, ${fresh.length} new ones qualify (X reads: ${reads.dayUsed}/${reads.dayCap} today, ${reads.monthUsed}/${reads.monthCap} this month).`);
  const read = [];
  for (const p of fresh.slice(0, PER_RUN)) {
    const own = client ? await readPost(p, client) : cleanReading(readPostByRules(p));
    const reading = nameReading(own, p.text, own ? borrowFor(p, own) : null);
    const home = atHome(reading) || (reading !== own && atHome(own));  // either the cat the post names or the one lent is at home
    const taken = reading?.ticker ? await tickerTaken(reading.ticker, fetchImpl) : null;
    const row = { ...p, readAt: reading ? new Date(nowMs).toISOString() : null, reading, known: home, taken };
    // A big account's cat post with no cat's name in it is a signal: not a candidate, but a person should see it (never a sensitive one).
    row.status = isCandidate(row) ? "candidate" : !reading ? "unread" : row.bigAccount && !reading.catName && !reading.sensitive ? "signal" : "passed";
    read.push(row);
    log(`  ${row.status} (${p.stage}${p.bigAccount ? ` @${p.bigAccount}` : ""}): ${p.url} (${p.likes} likes, ${p.views} views)${reading ? ` -> ${reading.catName ?? "no name"} ${reading.ticker ?? ""} ${reading.why}` : ""}`);
  }
  // An unread post is tried again next run (it stays out of `seen` by not being stored).
  const posts = [...read.filter((r) => r.status !== "unread"), ...prev].sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt)).slice(0, KEEP);
  return {
    note: "Written by scripts/scan-trending-cats.mjs: cats on X, found early. Each run searches X once through one lens: \"trend\" (a cat trend on X's lists), \"emerging\" (a cat's name two or more accounts gave in the last 48 hours), else in turn \"big\" (big accounts' cat posts, data/cat-watch.json), \"viral\", \"big\", \"figures\" (famous cat characters and memes not in the sanctuary yet); the turn goes to the rotation at least every other run. stage: viral (20k likes or 1M views in 48 h), rising (in 12 h: 1k likes at 500 an hour, or 50k views an hour) or big-account (any cat post of a watched account). Posts are read by rules (X-only) or by Claude (readBy); reading.nameFrom says when the lens named the cat (figure, trend, emerging). candidates = about one cat, not sensitive, not already in the sanctuary (taken = Solana coins already using the ticker, for the record). signals = big accounts' cat posts with no cat's name and nothing sensitive, for a person to look at. state = the rotation, when each trend and name was searched, the names being tracked. Launching is a person's decision.",
    checkedAt: new Date(nowMs).toISOString(), lens: pick.lens, query: pick.query, trends, reads, searchError: null,
    candidates: posts.filter((p) => p.status === "candidate").map((p) => p.id),
    signals: posts.filter((p) => p.status === "signal").map((p) => p.id).slice(0, MAX_SIGNALS),
    posts,
    state,
  };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(root, f), "utf8")); } catch { return d; } };
  const creds = credsFromEnv(process.env);
  const last = Date.parse(read("data/trending-cats.json", {}).checkedAt);
  const every = Math.max(20, Number(process.env.TRENDWATCH_EVERY_MINUTES) || EVERY_MINUTES);
  if (Date.now() - last < (every - 2) * 60_000 && !process.argv.includes("--now")) { console.log(`Trend watch: last searched ${Math.round((Date.now() - last) / 60_000)} min ago; searches every ${every} min.`); return; }
  if (!creds) { console.log("Trend watch: no X secrets; nothing searched."); return; }
  const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  if (!client) console.log("Trend watch: X-only mode (no ANTHROPIC_API_KEY): posts are read by rules.");
  const names = new Set([...read("data/planned.json", { cats: [] }).cats, ...read("data/adoptables.json", { cats: [] }).cats]
    .flatMap((c) => [c.name, c.coinName, c.ticker, c.launchTicker]).filter(Boolean).map((s) => String(s).toLowerCase()));
  const watch = read("data/cat-watch.json", { topAccounts: [], bigAccounts: [], figures: [] });  // missing: no big or figures lens
  const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  const next = await scan({ data: { trending: read("data/trending-cats.json", { posts: [] }), names, watch }, creds, client, log: console.log,
    monthlyReads: num(process.env.TRENDWATCH_MONTHLY_READS, READ_BUDGET), perSearch: num(process.env.TRENDWATCH_PER_SEARCH, PER_SEARCH) });
  if (process.argv.includes("--dry-run")) { console.log(JSON.stringify(next.candidates)); return; }
  fs.writeFileSync(path.join(root, "data/trending-cats.json"), `${JSON.stringify(next, null, 1)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((e) => { console.error(e); process.exitCode = 1; });
