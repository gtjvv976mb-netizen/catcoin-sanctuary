/**
 * ANNOUNCE NEW CATS ON X (@catcosanctuary).
 *
 * Compares the cats in data/planned.json (and adopted cats in data/collection.json that were not
 * planned) with data/announced.json. Every cat with no entry there is new; for each, a post is
 * drafted: who the cat is and whose stock it stands for, one line of its lore, the proof credit,
 * its card link (https://catcoinsanctuary.com/#cat=<id>, the site's own deep link, assets/ui/main.js),
 * "Not launched yet — adopt it soon", and two hashtags. With a proof, a second post replies to the
 * first with why the cat looks the way it does and the proof's link.
 *
 * Every draft must be <= 280 characters and pass the agency's content rules
 * (scripts/lib/content-rules, vendored) plus a no-price-talk rule; a draft that fails is held as
 * "needs_review" and never posted.
 *
 * data/announce-config.json:
 *   dryRun          true: only write data/announce-queue.json as a preview; nothing is recorded.
 *   perRun          at most this many cats per run (default 3).
 *   announceBacklog true: the cats marked "backlog" (the ones that existed before announcing
 *                   began) are announced too, backlogPerRun (1-2) a run, after any new cats.
 *   backlogPerRun   1 or 2.
 *   spacingMinutes  minutes between two cats' posts inside one run (default 15).
 *   thread          true: the proof reply is posted too.
 *
 * Posting needs X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (OAuth 1.0a user context).
 * Without them the run does not fail: the drafts go to data/announce-queue.json with one-click
 * x.com/intent/post links, and the cats are recorded as "queued" so the next run moves on.
 *
 * A cat is marked "posting" (and the file saved) before its first post goes out, and "posted"
 * with the post ids after; a cat in any state but "failed" is never picked again, so a crash
 * mid-post can cost an announcement but never double one.
 *
 * RELEASES (data/release-queue.json). While the initial roster lasts (any cat still "backlog",
 * unrecorded or retryable), each run (every 20 minutes) posts from it as above. Once it is empty,
 * the run releases one NEW cat an hour: the first entry of the release queue that the owner
 * approved, that is not held, and that is ready (a proof, a portrait on disk and a launch kit in
 * assets/kits/kits.json), if at least releaseEveryMinutes (default 60, less a few minutes of cron
 * slack) have passed since lastReleaseAt. The cat is posted on X FIRST; only when the post
 * succeeds is it marked released (releasedAt, tweet id) in the queue and in data/releases.json,
 * which the site reads: a queued cat that is not released is hidden on the site. If X fails, the
 * cat stays queued and is tried again next run.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkFields } from "./lib/content-rules/content-rules.mjs";
import { writeNextCat } from "./lib/next-cat.mjs";
import { credsFromEnv, uploadImage, createPost, whoAmI, XError } from "./lib/x-api.mjs";

export const SITE = "https://catcoinsanctuary.com/";
export const HASHTAGS = ["#catcoin", "#CatsOfX"];
const LORE_CAPTIONS = (() => { try { return JSON.parse(fs.readFileSync(new URL("../data/lore.json", import.meta.url), "utf8")).cats || {}; } catch { return {}; } })();
export const LIMIT = 280;
/** The line a post carries when its in-game shot is attached. */
export const INGAME_LINE = "🎮 + its in-game look in the garden 🌿";
export const DEFAULT_CONFIG = Object.freeze({ dryRun: true, perRun: 3, announceBacklog: true, backlogPerRun: 1, spacingMinutes: 15, thread: true });
const MAX_ATTEMPTS = 3;

/** The site's deep link to a cat's card (assets/ui/main.js: `#cat=${encodeURIComponent(id)}`). */
// ?v= makes X fetch the current preview image instead of an old cached one.
export const PREVIEW_VERSION = "3";
export const cardLink = (id) => `${SITE}?v=${PREVIEW_VERSION}#cat=${encodeURIComponent(id)}`;

/** X's weighted length: most Latin text and punctuation counts 1, everything else (emoji, CJK) 2.
 *  URLs are counted at their full length, which is never less than X's 23. */
export function weightedLength(text) {
  let n = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0);
    n += (c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037)) ? 1 : 2;
  }
  return n;
}

/** No price talk, no promises: the site's own rule for anything said about a coin. */
const PRICE_TALK = /\b(price|prices|pump|pumps|pumping|moon|mooning|buy|buying|sell|selling|mcap|market cap|marketcap|lambo|gains|invest|investment|investing|presale|airdrop|to the moon|ape in|\d+x|x\d+)\b|\$\s?\d|\$[A-Za-z]/i;

/** Every rule a draft must pass. `cited` are the names the post credits (the company, its stock
 *  symbol, the proof's author and handle) and the links it carries: those are what a citation
 *  is, so they are taken out before the rest of the text meets the brand, person and link rules.
 *  Everything else, the cat's name and lore included, meets every rule. */
export function checkPost(text, cited = []) {
  let rest = text;
  for (const c of [...cited].filter(Boolean).sort((a, b) => b.length - a.length)) rest = rest.split(c).join(" ");
  rest = rest.replace(/#\w+/g, (h) => h.slice(1));
  const { violations } = checkFields({ post: rest });
  const price = text.match(PRICE_TALK);
  if (price) violations.push({ rule: "price_talk", term: price[0], field: "post" });
  const len = weightedLength(text);
  if (len > LIMIT) violations.push({ rule: "length", term: String(len), field: "post" });
  return { ok: violations.length === 0, violations };
}

const sentences = (s) => String(s ?? "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=[A-Z"'(])/).filter(Boolean);
const clip = (s, max) => {
  if (s.length <= max) return s;
  const cut = s.slice(0, Math.max(0, max - 1)).replace(/[\s,;:.-]+\S*$/, "");
  return cut ? `${cut}…` : "";
};
const shortName = (name) => String(name).split(/\s+the\s+/i)[0].trim();

/** Every cat the sanctuary has: planned ones by ticker, adopted-but-unplanned ones by mint. */
export function listCats(planned, collection = { cats: [] }, adoptables = { cats: [] }) {
  const stocks = new Map((planned.stocks || []).map((s) => [s.pair.mint, s]));
  const out = [];
  const tickers = new Set();
  for (const c of planned.cats || []) {
    tickers.add(`${c.pair.mint} ${c.ticker.toUpperCase()}`);
    const s = stocks.get(c.pair.mint);
    out.push({ key: c.ticker, id: c.ticker, name: c.name, ticker: c.ticker, symbol: c.pair.symbol, company: s?.company ?? null,
      story: c.story, why: c.whyLook, proof: c.proof ?? null, portrait: c.portrait ?? null, launched: false });
  }
  // Adoptable cats (verified lore from companies, people, shows); the lore picture is the post image.
  for (const c of adoptables.cats || []) {
    out.push({ key: c.ticker, id: c.ticker, name: c.name, ticker: c.ticker, symbol: c.pair?.symbol ?? "STONK", company: c.owner ?? null,
      story: c.story, why: null, proof: c.proof ?? null, portrait: c.lore ?? `assets/lore/${c.ticker}.webp`, launched: false, adoptable: true });
  }
  for (const e of collection.cats || []) {
    const launchedPlanned = tickers.has(`${e.pair?.mint} ${String(e.symbol).toUpperCase()}`);
    if (launchedPlanned) continue;       // the planned cat, already listed (and announced) under its ticker
    const s = stocks.get(e.pair?.mint);
    out.push({ key: e.mint, id: e.mint, name: e.name, ticker: e.symbol, symbol: e.pair?.symbol ?? null, company: s?.company ?? null,
      story: null, why: null, proof: null, portrait: null, launched: true });
  }
  return out;
}

/** The company as a post names it: "State Street (SPDR S&P 500 ETF Trust)" -> "State Street". */
const companyShort = (c) => (c ? c.replace(/\s*\(.*\)\s*$/, "").replace(/,?\s+(Inc|Ltd|Corp|Corporation|Co|plc|PLC|N\.V|S\.A|SE|AG|Holdings|Group)\.?$/g, "").trim() : null);

/** The credit line for a cat's proof. */
export function proofCredit(p) {
  if (!p) return null;
  if (p.kind === "x" && p.handle) return `👀 As seen in @${p.handle}'s post`;
  if (p.author) return `📰 Inspired by ${p.author}`;
  return null;
}

/** Draft one cat's thread. Returns { ok, posts: [{ text, image?, link? }], violations }. */
export function draft(cat, { thread = true, ingame = false } = {}) {
  const link = cardLink(cat.id);
  const company = companyShort(cat.company);
  const owner = cat.adoptable ? (company || cat.name) : company ? `${company}'s ${cat.symbol}` : cat.symbol;
  const cited = [cat.adoptable ? cat.name : null, company, cat.company, cat.symbol, cat.proof?.author, cat.proof?.handle && `@${cat.proof.handle}`, cat.proof?.url, link, SITE];
  const status = cat.launched ? "🎉 Adopted! Its owner has launched it 🚀" : "🔓 No coin yet: be the first to adopt it 👇";
  const credit = proofCredit(cat.proof);
  const caption = LORE_CAPTIONS[cat.key];
  const lores = [...(caption ? [`📸 ${caption}`] : []), ...sentences(cat.story).slice(0, 1).map((s) => `📜 ${s}`), ""];
  // Rotate hyped openers so the feed doesn't repeat itself (stable per cat).
  const n = [...String(cat.id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const openers = [
    `🚨 NEW CAT ALERT 🚨\n😻 ${cat.name} just moved into the Sanctuary!\n👑 The cat of ${owner}`,
    `🐱✨ Say hi to ${cat.name}!\n👑 The famous cat of ${owner}`,
    `🏡🔥 A legend just moved in: ${cat.name}!\n👑 The cat of ${owner}`,
    `🎉 Fresh lore just dropped! 🎉\n😺 Meet ${cat.name}, the cat of ${owner}`,
  ];
  const hooks = [openers[n % openers.length], cat.adoptable ? `🐾 Meet ${cat.name}, the newest cat in the sanctuary!` : `🐾 Meet ${shortName(cat.name)}, the cat for ${cat.symbol}!`];
  let first = null, violations = [];
  outer:
  for (const hook of hooks) {
    for (const lore of lores) {
      for (const [tags, game] of [[HASHTAGS, ingame], [HASHTAGS.slice(0, 1), ingame], [HASHTAGS, false], [HASHTAGS.slice(0, 1), false]]) {
        const look = game ? INGAME_LINE : null;
        const fixed = [hook, credit, look, status, link, tags.join(" ")].filter(Boolean);
        const room = LIMIT - weightedLength(fixed.join("\n")) - 1;
        const loreLine = lore ? clip(lore, room) : "";
        const text = [hook, loreLine, credit, look, status, link, tags.join(" ")].filter(Boolean).join("\n");
        const r = checkPost(text, cited);
        if (r.ok) { first = text; break outer; }
        violations = r.violations;
      }
    }
  }
  if (!first) return { ok: false, posts: [], violations };
  const posts = [{ text: first, image: cat.portrait || null, link }];
  if (thread && cat.proof?.url) {
    const lead = `🔎 The real story: `;
    const tail = `\n🔗 ${cat.proof.url}`;
    const why = clip(sentences(cat.why).find((s) => !/^No (real )?cat link/i.test(s)) || sentences(cat.why)[0] || "", LIMIT - weightedLength(lead + tail));
    const text = (why ? lead + why : `🔎 Proof it's real 👇`) + tail;
    const r = checkPost(text, cited);
    if (r.ok) posts.push({ text, link: cat.proof.url, quote: /^https:\/\/(?:x|twitter)\.com\/\w+\/status\/(\d+)/.exec(cat.proof.url)?.[1] ?? null });
    else if (weightedLength(`🔎 Proof it's real 👇${tail}`) <= LIMIT && checkPost(`🔎 Proof it's real 👇${tail}`, cited).ok) posts.push({ text: `🔎 Proof it's real 👇${tail}`, link: cat.proof.url });
  }
  return { ok: true, posts, violations: [] };
}

export const intentLink = (text) => `https://x.com/intent/post?text=${encodeURIComponent(text)}`;

/** Which cats this run takes: new ones first (in planned order), then retries, then the backlog.
 *  Cats in the release queue (`queued`, a Set of keys) are never taken here: they go out one an hour. */
export function pick(cats, state, config, queued = new Set()) {
  cats = cats.filter((c) => !queued.has(c.key));
  const perRun = Math.max(0, Math.floor(config.perRun ?? DEFAULT_CONFIG.perRun));
  const backlogPerRun = Math.min(2, Math.max(0, Math.floor(config.backlogPerRun ?? DEFAULT_CONFIG.backlogPerRun)));
  const s = (c) => state.cats[c.key];
  const fresh = cats.filter((c) => !s(c));
  const retry = cats.filter((c) => s(c)?.status === "failed" && (s(c).attempts ?? 0) < MAX_ATTEMPTS);
  const backlog = config.announceBacklog ? cats.filter((c) => s(c)?.status === "backlog").slice(0, backlogPerRun) : [];
  return [...fresh, ...retry, ...backlog].slice(0, perRun);
}

export const RELEASE_SLACK_MINUTES = 5;

/** A cat's in-game shot (scripts/capture-ingame.mjs), relative to the root. */
export const ingameShot = (key) => `assets/ingame/${key}.jpg`;

/** The images a cat's post carries, as paths on disk: the lore photo (or portrait) first, the in-game shot second. */
export function postImages(cat, post, root) {
  const lore = path.join(root, `assets/lore/${cat.key}.webp`);
  const first = fs.existsSync(lore) ? lore : post?.image && path.join(root, post.image);
  const game = path.join(root, ingameShot(cat.key));
  return [first, game].filter((f) => f && fs.existsSync(f));
}

/** Is a cat complete and ready to release: a proof, a portrait on disk, a launch kit, and its in-game
 *  shot (assets/ingame/<KEY>.jpg; make it with `node scripts/capture-ingame.mjs KEY`)? */
export function readiness(cat, { root, kits = {} }) {
  const missing = [];
  if (!cat?.proof?.url) missing.push("proof");
  const pic = cat?.portrait && path.join(root, cat.portrait);
  const lore = cat && path.join(root, `assets/lore/${cat.key}.webp`);
  if (!((pic && fs.existsSync(pic)) || (lore && fs.existsSync(lore)))) missing.push("portrait");
  if (!kits[cat?.key]?.token) missing.push("kit");
  if (!(cat && fs.existsSync(path.join(root, ingameShot(cat.key))))) missing.push("ingame");
  return missing;
}

/** Is the initial roster still going: a cat in the backlog, unrecorded (and not queued) or retryable? */
export function rosterLeft(cats, state, queued = new Set()) {
  return cats.filter((c) => !queued.has(c.key)).filter((c) => {
    const s = state.cats[c.key];
    return !s || s.status === "backlog" || (s.status === "failed" && (s.attempts ?? 0) < MAX_ATTEMPTS);
  }).length;
}

/** The next cat to release from the queue, or { cat: null, why }. */
export function pickRelease(cats, state, queue, config, { root, kits, nowMs }) {
  const every = Math.max(1, config.releaseEveryMinutes ?? 60);
  if (queue.lastReleaseAt && nowMs - Date.parse(queue.lastReleaseAt) < (every - RELEASE_SLACK_MINUTES) * 60_000) return { cat: null, why: `last release ${queue.lastReleaseAt}; next after ${every} minutes` };
  const byKey = new Map(cats.map((c) => [c.key, c]));
  for (const q of queue.cats || []) {
    if (q.status === "released" || q.approved !== true) continue;
    const s = state.cats[q.key]?.status;
    if (["held", "needs_review", "posting", "posted"].includes(s)) continue;
    if (s === "failed" && (state.cats[q.key].attempts ?? 0) >= MAX_ATTEMPTS) continue;
    const cat = byKey.get(q.key);
    if (!cat) continue;
    if (readiness(cat, { root, kits }).length) continue;
    return { cat, entry: q };
  }
  return { cat: null, why: "no approved, ready cat in the release queue" };
}

/** data/releases.json: what the site reads (hidden: queued, not released; released: newest first). */
export function releasesFile(queue, now) {
  const released = (queue.cats || []).filter((q) => q.status === "released" && q.releasedAt)
    .sort((a, b) => Date.parse(b.releasedAt) - Date.parse(a.releasedAt))
    .map((q) => ({ key: q.key, name: q.name ?? null, releasedAt: q.releasedAt, tweet: q.tweet ?? null }));
  return {
    note: "Written by scripts/announce.mjs from data/release-queue.json. hidden: queued cats the site must not show yet. released: newest first.",
    updated: now, lastReleaseAt: queue.lastReleaseAt ?? null,
    hidden: (queue.cats || []).filter((q) => q.status !== "released").map((q) => q.key),
    released: released.slice(0, 20),
  };
}

export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { if (e.code === "ENOENT") return fallback; throw e; }
}
function writeJson(file, value) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

/**
 * One run. Everything outside is injectable: the root folder, the environment, fetch, the clock
 * and sleep. Returns a summary { mode, drafts, posted, queued, held, failed }.
 */
export async function run({ root, env = process.env, fetchImpl = fetch, now = () => new Date(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = console.log, force = {} } = {}) {
  const data = (f) => path.join(root, "data", f);
  const config = { ...DEFAULT_CONFIG, ...readJson(data("announce-config.json"), {}), ...force };
  const state = readJson(data("announced.json"), { cats: {} });
  state.cats ||= {};
  const cats = listCats(readJson(data("planned.json"), { stocks: [], cats: [] }), readJson(data("collection.json"), { cats: [] }), readJson(data("adoptables.json"), { cats: [] }));
  const creds = credsFromEnv(env);
  const mode = config.dryRun ? "dryRun" : creds ? "post" : "queue";
  const stamp = () => now().toISOString();
  const saveState = () => writeJson(data("announced.json"), state);
  const summary = { mode, drafts: [], posted: [], queued: [], held: [], failed: [] };

  // Which account do the keys belong to? Logs a handle (never a secret) so a 401 can be traced.
  if (mode === "post" && env.GITHUB_ACTIONS) {
    try {
      const me = await whoAmI(creds);
      log(`Announce: the X keys are for @${me?.data?.username ?? "?"}.`);
    } catch (e) { log(`::warning::Announce: X refused the keys when asked who they belong to (${e.message}). Check that all four secrets come from the same app and were regenerated consumer keys first, then access token.`); }
  }

  const queue = readJson(data("release-queue.json"), { cats: [] });
  queue.cats ||= [];
  const queued = new Set(queue.cats.filter((q) => q.status !== "released").map((q) => q.key));
  const kits = readJson(path.join(root, "assets/kits/kits.json"), { cats: {} }).cats || {};
  let chosen = pick(cats, state, config, queued);
  let release = null;
  const left = rosterLeft(cats, state, queued);
  if (!left) {
    const r = pickRelease(cats, state, queue, config, { root, kits, nowMs: now().getTime() });
    if (r.cat) { release = r.entry; chosen = [r.cat]; }
    log(`Announce: the initial roster is done; hourly releases. ${r.cat ? `Releasing ${r.cat.key}.` : r.why}`);
  }
  log(`Announce: ${mode} mode; ${cats.filter((c) => !state.cats[c.key] && !queued.has(c.key)).length} new, ${cats.filter((c) => state.cats[c.key]?.status === "backlog").length} in the backlog, ${queued.size} in the release queue; taking ${chosen.length}.`);

  for (const [i, cat] of chosen.entries()) {
    const prev = state.cats[cat.key];
    const d = draft(cat, { thread: config.thread, ingame: fs.existsSync(path.join(root, ingameShot(cat.key))) });
    const entry = { key: cat.key, name: cat.name, card: cardLink(cat.id), from: prev?.status ?? "new", ok: d.ok, violations: d.violations,
      posts: d.posts.map((p) => ({ text: p.text, length: weightedLength(p.text), image: p.image ?? null, intent: intentLink(p.text) })) };
    summary.drafts.push(entry);
    if (!d.ok) {
      summary.held.push(cat.key);
      log(`::warning::${cat.key}: draft held for review (${d.violations.map((v) => `${v.rule}: ${v.term}`).join("; ")}).`);
      if (mode !== "dryRun") { state.cats[cat.key] = { status: "needs_review", at: stamp(), violations: d.violations }; saveState(); }
      continue;
    }
    if (mode === "dryRun") continue;
    if (mode === "queue") {
      state.cats[cat.key] = { status: "queued", at: stamp() };
      summary.queued.push(cat.key);
      continue;
    }
    // Posting. Space the cats out: a batch of new cats goes out one by one.
    if (summary.posted.length || summary.failed.length) await sleep(Math.max(0, config.spacingMinutes) * 60_000);
    state.cats[cat.key] = { status: "posting", at: stamp(), attempts: (prev?.attempts ?? 0) + 1 };
    saveState();
    const ids = [];
    try {
      const [p1, p2] = d.posts;
      // Lore/real photo first, the in-game look second; a failed upload leaves the post with whatever did upload.
      // A media-upload refusal (the free X tier and some app setups reject it) must not stop the text post;
      // if the keys themselves are wrong, the post below fails with the same 401 and the run stops there.
      const media = [];
      for (const img of postImages(cat, p1, root)) {
        try { media.push(await uploadImage(fs.readFileSync(img), /\.png$/i.test(img) ? "image/png" : /\.webp$/i.test(img) ? "image/webp" : "image/jpeg", creds, fetchImpl)); }
        catch (e) { log(`::warning::${cat.key}: ${path.basename(img)} did not upload (${e.message}); posting without it.`); }
      }
      ids.push(await createPost({ text: p1.text, mediaIds: media }, creds, fetchImpl));
      state.cats[cat.key] = { status: "posted", at: stamp(), ids: [...ids], attempts: state.cats[cat.key].attempts };
      saveState();
      if (p2) {
        try { ids.push(await createPost({ text: p2.text, replyTo: ids[0] }, creds, fetchImpl)); state.cats[cat.key].ids = [...ids]; saveState(); }
        catch (e) { log(`::warning::${cat.key}: the proof reply did not post (${e.message}).`); }
      }
      summary.posted.push({ key: cat.key, ids });
      // Only now, with the post out, does the cat launch on the site.
      if (release && release.key === cat.key) {
        Object.assign(release, { status: "released", name: cat.name, releasedAt: stamp(), tweet: ids[0] });
        queue.lastReleaseAt = release.releasedAt;
        writeJson(data("release-queue.json"), queue);
        summary.released = cat.key;
        log(`Released ${cat.key} on the site.`);
      }
      log(`Posted ${cat.key}: https://x.com/catcosanctuary/status/${ids[0]}`);
    } catch (e) {
      if (ids.length) continue;                         // the first post is out: it stays "posted"
      state.cats[cat.key] = { status: "failed", at: stamp(), attempts: state.cats[cat.key].attempts, error: `${e.message}${e.body ? ` ${JSON.stringify(e.body).slice(0, 300)}` : ""}` };
      saveState();
      summary.failed.push(cat.key);
      log(`::warning::${cat.key}: not posted (${e.message}).`);
      if (e instanceof XError && [401, 403, 429].includes(e.status)) { log("::warning::X refused the credentials or the rate; stopping this run."); break; }
    }
  }

  // The queue file: the drafts to post by hand (queue mode, appended) or the preview (dry run).
  const qFile = data("announce-queue.json");
  const old = readJson(qFile, { drafts: [] });
  const note = mode === "dryRun"
    ? "Dry run (data/announce-config.json has dryRun: true): the next posts, drafted but not posted or recorded. Set dryRun to false to announce."
    : "No X API secrets, so these drafts wait here. Open each intent link to post it (attach the image by hand), then delete the entry.";
  const keep = mode === "queue" ? (old.drafts || []).filter((d) => d.mode === "queue" && !summary.drafts.some((n) => n.key === d.key)) : [];
  const fresh = mode === "post" ? [] : summary.drafts.filter((d) => d.ok).map((d) => ({ ...d, mode, ...(mode === "queue" ? { drafted: stamp() } : {}) }));
  const drafts = mode === "post" ? (old.drafts || []).filter((d) => !summary.posted.some((p) => p.key === d.key)) : [...keep, ...fresh];
  const newNote = mode === "post" ? old.note ?? note : note;
  if (newNote !== old.note || JSON.stringify(drafts) !== JSON.stringify(old.drafts ?? [])) writeJson(qFile, { note: newNote, updated: stamp(), drafts });
  if (mode !== "dryRun") saveState();
  // "Who's that cat?": the next cat after this run (data/next-cat.json, scripts/lib/next-cat.mjs).
  if (mode !== "dryRun") try { writeNextCat(root, { now: now(), state }); } catch (e) { log(`::warning::data/next-cat.json not refreshed (${e.message}).`); }
  const rel = releasesFile(queue, stamp());
  const oldRel = readJson(data("releases.json"), {});
  if (JSON.stringify({ ...oldRel, updated: 0 }) !== JSON.stringify({ ...rel, updated: 0 })) writeJson(data("releases.json"), rel);
  log(`Announce: ${summary.posted.length} posted, ${summary.queued.length} queued, ${summary.held.length} held, ${summary.failed.length} failed.`);
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const force = {};
  if (process.argv.includes("--dry-run")) force.dryRun = true;
  if (process.argv.includes("--no-spacing")) force.spacingMinutes = 0;
  run({ root, force }).catch((e) => { console.error(e); process.exitCode = 1; });
}
