/**
 * Recurring posts on X about the Sanctuary itself (not about one cat): node scripts/promo.mjs
 *
 * Each run posts at most one post from data/promo-posts.json, in order, with its media from
 * assets/promo/media.json (a still or a short clip captured from the live site) and the site link.
 * data/promo-config.json: { enabled, everyMinutes, dryRun }. The workflow runs every 20 minutes;
 * this script posts only when everyMinutes have passed since its own last post, and never within
 * QUIET_MINUTES of any post the account made (the cat announcements included), so the two never
 * collide. After the last post it starts over from the first.
 *
 * Records what it posted in data/promo-state.json. Without the four X secrets it only logs.
 * Every post meets the content rules (scripts/lib/content-rules), a no-price-talk rule, at most
 * one cashtag, and X's 280 limit (a link counts 23).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkFields } from "./lib/content-rules/content-rules.mjs";
import { credsFromEnv, uploadImage, uploadVideo, createPost, whoAmI, getLatestOwnPostId, postTime } from "./lib/x-api.mjs";

export const LIMIT = 280;
export const URL_WEIGHT = 23;
export const QUIET_MINUTES = 10;
export const DEFAULT_CONFIG = Object.freeze({ enabled: true, everyMinutes: 120, dryRun: false });
/** The names and links a post may carry: the launchpads, the site's own handle and links. They are citations, not endorsements. */
export const CITED = ["StonkFun", "GetStonked", "pump.fun", "@catcosanctuary", "Telegram", "X post", "CATSANC"];
const URL_RE = /https?:\/\/\S+/g;
/** No price talk, no promises (the announcer's rule; "pump.fun" is a launchpad's name, not talk). */
const PRICE_TALK = /\b(price|prices|pump|pumps|pumping|moon|mooning|buy|buying|sell|selling|mcap|market cap|marketcap|lambo|gains|invest|investment|investing|presale|airdrop|to the moon|ape in|\d+x|x\d+|most successful|guaranteed?)\b|\$\s?\d/i;

/** X's weighted length: a link counts 23, Latin text 1, emoji and other scripts 2. */
export function weightedLength(text) {
  let n = 0;
  const rest = String(text).replace(URL_RE, () => { n += URL_WEIGHT; return ""; });
  for (const ch of rest) {
    const c = ch.codePointAt(0);
    n += (c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037)) ? 1 : c === 0xfe0f ? 0 : 2;
  }
  return n;
}

/** The text as posted: the post, a blank line, the site link. */
export const compose = (post, link) => `${post.text}\n\n${link}`;

/** Every rule a promo post must pass. Returns { ok, violations }. */
export function checkPromo(text) {
  const violations = [];
  let rest = text.replace(URL_RE, " ");
  for (const c of CITED) rest = rest.split(c).join(" ");
  rest = rest.replace(/[#$]\w+/g, " ");
  violations.push(...checkFields({ post: rest }).violations);
  const price = text.replace(/pump\.fun/gi, " ").match(PRICE_TALK);
  if (price) violations.push({ rule: "price_talk", term: price[0], field: "post" });
  const cashtags = text.match(/\$[A-Za-z]\w*/g) || [];
  if (cashtags.length > 1) violations.push({ rule: "cashtags", term: cashtags.join(" "), field: "post" });
  const len = weightedLength(text);
  if (len > LIMIT) violations.push({ rule: "length", term: String(len), field: "post" });
  return { ok: violations.length === 0, violations };
}

export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
const writeJson = (file, v) => fs.writeFileSync(file, JSON.stringify(v, null, 2) + "\n");

/** The next post in rotation: the one after the last posted, wrapping round. */
export function nextPost(posts, state) {
  if (!posts.length) return null;
  const i = posts.findIndex((p) => p.id === state.lastId);
  return posts[(i + 1) % posts.length];
}

/** The newest time any post went out from the account, as far as the repository records it. */
export function lastRecordedPost(announced, state) {
  const times = [state.lastPostedAt];
  for (const c of Object.values(announced?.cats || {})) if (c && (c.status === "posted" || c.status === "posting")) times.push(c.at);
  const ms = times.map((t) => Date.parse(t)).filter(Number.isFinite);
  return ms.length ? Math.max(...ms) : null;
}

export async function run({ root, env = process.env, fetchImpl = fetch, now = () => new Date(), log = console.log, force = {}, sleep } = {}) {
  const data = (f) => path.join(root, "data", f);
  const config = { ...DEFAULT_CONFIG, ...readJson(data("promo-config.json"), {}), ...force };
  const { link, posts = [] } = readJson(data("promo-posts.json"), {});
  const media = new Map((readJson(path.join(root, "assets/promo/media.json"), {}).media || []).map((m) => [m.id, m]));
  const state = readJson(data("promo-state.json"), { lastId: null, lastPostedAt: null, history: [] });
  state.history ||= [];
  const creds = credsFromEnv(env);
  const mode = config.dryRun ? "dryRun" : creds ? "post" : "log";
  const nowMs = now().getTime();
  const result = { mode, posted: null, skipped: null, post: null };
  const skip = (why) => { result.skipped = why; log(`Promo: skipped: ${why}`); return result; };

  if (!config.enabled) return skip("disabled in data/promo-config.json");
  const post = nextPost(posts, state);
  if (!post) return skip("no posts in data/promo-posts.json");
  const text = compose(post, link);
  const m = media.get(post.media);
  result.post = { id: post.id, text, length: weightedLength(text), media: m?.file ?? null };
  const check = checkPromo(text);
  if (!check.ok) return skip(`${post.id} breaks a rule (${check.violations.map((v) => `${v.rule}: ${v.term}`).join("; ")})`);

  if (mode !== "dryRun") {
    const every = Math.max(1, Number(config.everyMinutes) || DEFAULT_CONFIG.everyMinutes);
    const mine = Date.parse(state.lastPostedAt);
    if (Number.isFinite(mine) && nowMs - mine < every * 60_000) return skip(`the last promo went out ${Math.round((nowMs - mine) / 60_000)} min ago; every ${every} min`);
    const recorded = lastRecordedPost(readJson(data("announced.json"), {}), state);
    if (recorded && nowMs - recorded < QUIET_MINUTES * 60_000) return skip(`the account posted ${Math.round((nowMs - recorded) / 60_000)} min ago (recorded); waiting ${QUIET_MINUTES} min`);
  }
  if (mode === "log") { log(`Promo: no X secrets; would post ${post.id}:\n${text}`); return result; }
  if (mode === "dryRun") { log(`Promo (dryRun): next is ${post.id} [${m?.file ?? "no media"}] (${result.post.length}/280):\n${text}`); return result; }

  // The account's own newest post, from X: catches a post the repository has not recorded yet.
  try {
    const me = await whoAmI(creds, fetchImpl);
    const latest = me?.data?.id ? await getLatestOwnPostId(me.data.id, creds, fetchImpl) : null;
    if (latest && nowMs - postTime(latest).getTime() < QUIET_MINUTES * 60_000) return skip(`the account posted ${Math.round((nowMs - postTime(latest).getTime()) / 60_000)} min ago (on X); waiting ${QUIET_MINUTES} min`);
  } catch (e) { if (e.status === 401) throw e; log(`::warning::Promo: could not read the account's latest post (${e.message}); going by the recorded times.`); }

  let mediaIds = [];
  if (m) {
    const file = path.join(root, m.file);
    try {
      const bytes = fs.readFileSync(file);
      mediaIds = [m.type === "video" ? await uploadVideo(bytes, "video/mp4", creds, fetchImpl, sleep ? { sleep } : {}) : await uploadImage(bytes, "image/jpeg", creds, fetchImpl)];
    } catch (e) { if (e.status === 401) throw e; log(`::warning::Promo: ${m.file} did not upload (${e.message}); posting without it.`); }
  }
  const id = await createPost({ text, mediaIds }, creds, fetchImpl);
  const at = now().toISOString();
  state.lastId = post.id; state.lastPostedAt = at;
  state.history = [...state.history, { id: post.id, postId: id, at, media: m?.id ?? null }].slice(-100);
  writeJson(data("promo-state.json"), state);
  result.posted = id;
  log(`Promo: posted ${post.id} as https://x.com/i/status/${id}`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const force = process.argv.includes("--dry-run") ? { dryRun: true } : {};
  run({ root, force }).catch((e) => { console.error(`Promo failed: ${e.message}`, e.body ? JSON.stringify(e.body).slice(0, 500) : ""); process.exit(1); });
}
