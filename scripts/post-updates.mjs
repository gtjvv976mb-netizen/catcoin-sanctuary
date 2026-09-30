/**
 * POST THE SANCTUARY'S OWN LAUNCHES, ADOPTIONS AND SITE UPDATES ON X (@catcosanctuary).
 *
 * Runs after scripts/announce.mjs in the Announce workflow (every 20 minutes) and posts at most
 * ONE thing a run:
 *   0. a coin the sanctuary's automatic launcher launched (data/sanctuary-launches.json, written by
 *      scripts/launch.mjs): a row "launched" and recorded in the sanctuary, whose cat in
 *      data/adoptables.json carries that very mint and transaction as its `launch`, and whose mint is
 *      in data/collection.json as validated (the hourly check proved it on chain; never on the
 *      launcher's word alone), and whose cat the announcer lists as launched by the page's own rule
 *      (listCats: assets/ui/adoptables.js provedLaunch). The post (draftLaunch) names the cat, one
 *      lore line, that the sanctuary launched it on its launchpad (PumpFun or StonkFun, from its
 *      launch's launchpad), the card link and, when the post still fits with it, the coin's fan-tribute
 *      line (FAN_TRIBUTE: unofficial, not affiliated with the character's or the cat's owners); never the mint or any address, never the @handle of
 *      the post the cat was found in. State: launchesPosted { TICKER: { … } };
 *   1. an adoption not posted yet (data/adoptions.json: a coin a visitor launched from a sanctuary
 *      cat's own Adopt kit, the earliest per cat). The post is drafted here: the cat (and its owner,
 *      when a company or a show), the coin's name and ticker as the cat's kit gives them, the launchpad, "launched by a visitor from its kit", that the
 *      sanctuary did not launch it, and the cat's card link, with the cat's lore picture and in-game
 *      look as the announcer posts a cat;
 *   2. otherwise the next update in data/updates.json that the owner approved and that is queued,
 *      in file order, with its image if it names one.
 *
 * It posts only if at least minGapMinutes (data/updates.json) have passed since its own last post
 * and at least 15 minutes since the announcer's (the newest posted cat in data/announced.json, or
 * data/release-queue.json lastReleaseAt), so the account never posts twice in a row in a hurry.
 *
 * Every draft must be <= 280 characters and pass the announcer's checks (checkPost: the content
 * rules and no price talk), carry at most one link, and that link the site's own, and name no
 * Solana address (announce.mjs guardDraft, the last line before X). A draft that fails is "held"
 * and never posted. The rules refuse "$" before a letter and the word "pump" (so "pump.fun" too),
 * so a ticker is written without its "$" and pump.fun is named "PumpFun".
 *
 * State lives in data/updates.json: each update's status, adoptionsPosted { key: { … } } for the
 * adoptions and launchesPosted { key: { … } } for the sanctuary's launches. An item is marked "posting" (and the file saved) before its post goes out, and "posted"
 * with the post id after, so a crash can cost a post but never double one. A failed post is
 * "failed" and tried again on a later run, at most 3 tries; a 401 (the keys) or 429 (the rate) is no
 * fault of the post and does not use a try. One try a run: any failure ends the run.
 *
 * Without the four X secrets the run logs that and changes nothing. With dryRun: true in
 * data/announce-config.json (or --dry-run) it only logs what it would post.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { credsFromEnv, uploadImage, createPost, XError } from "./lib/x-api.mjs";
import { SITE, HASHTAGS, INGAME_LINE, LIMIT, DEFAULT_CONFIG, cardLink, checkPost, weightedLength, listCats, postImages, ingameShot, readJson, guardDraft, provedCollection } from "./announce.mjs";
import { kitsOf, adoptionProblem, ownMints } from "./lib/adoptions.mjs";
import { nameKey } from "../assets/ui/adoptables.js";
import { isAddress } from "../assets/collection.js";

export const DEFAULT_GAP_MINUTES = 180;
/** Minutes to leave after the announcer's last post. */
export const AFTER_ANNOUNCER_MINUTES = 15;
export const MAX_ATTEMPTS = 3;
/** How a post names each launchpad (data/adoptions.json launchpad -> the name the rules let through). */
export const LAUNCHPADS = Object.freeze({ "pump.fun": "PumpFun", stonkfun: "StonkFun" });
/** What an update may name without the brand rule refusing it: the site and the two launchpads. */
export const UPDATE_CITED = Object.freeze([SITE, ...Object.values(LAUNCHPADS)]);
/** An update's picture: a png, jpg or webp under assets/. */
export const IMAGE_PATH = /^assets\/[\w./-]+\.(png|jpe?g|webp)$/i;
/* The coin is named by the cat's own kit (its name and ticker), never by the stranger's text: the
   adoption matched the kit, and a stranger's words ("Balloon.Cat", an extra word) never reach a post. */
// Our own words, but still nothing X would make a link, a mention, a cashtag or a hashtag of (. @ $ # / :).
// A dot only before a space or at the end ("Mr. Bigglesworth"; never "Balloon.Cat", which X links).
const KIT_NAME = /^[\p{L}\p{N}](?:[\p{L}\p{N} '’&!·,-]|\.(?=\s|$)){0,31}$/u;
const KIT_TICKER = /^[A-Za-z0-9]{2,10}$/;
/** The categories whose owner is an organisation or a show, named in a post; a person's cat is not tied to its owner. */
export const OWNER_NAMED = Object.freeze(["company", "tv-movie", "crypto"]);

/** The post's links: at most one, and only the site's own. */
function linkViolations(text) {
  const links = text.match(/https?:\/\/\S+/g) || [];
  const out = links.filter((l) => !l.startsWith(SITE)).map((l) => ({ rule: "link", term: l, field: "post" }));
  if (links.length > 1) out.push({ rule: "links", term: String(links.length), field: "post" });
  return out;
}

/** Every check an update's text must pass: length, the content rules, no price talk, one site link. */
export function checkUpdate(text, cited = UPDATE_CITED) {
  const t = String(text ?? "");
  const { violations } = checkPost(t, cited);
  if (!t.trim()) violations.push({ rule: "empty", term: "", field: "post" });
  violations.push(...linkViolations(t));
  return { ok: violations.length === 0, violations };
}

/** An adoption row the poster may use: data/adoptions.json's own check (scripts/lib/adoptions.mjs), a launchpad it can name. */
export const validAdoption = (a) => !!a && adoptionProblem(a) === null && !!LAUNCHPADS[a.launchpad];

const sentences = (s) => String(s ?? "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=[A-Z"'(])/).filter(Boolean);
/** "State Street (SPDR S&P 500 ETF Trust)" -> "State Street", as the announcer names a company. */
const companyShort = (c) => (c ? c.replace(/\s*\(.*\)\s*$/, "").replace(/,?\s+(Inc|Ltd|Corp|Corporation|Co|plc|PLC|N\.V|S\.A|SE|AG|Holdings|Group)\.?$/g, "").trim() : null);

/**
 * Draft an adoption's post. `cat` is the announcer's cat (listCats), `kit` the cat's Adopt kit
 * ({ name, ticker }: scripts/lib/adoptions.mjs kitsOf), `category` its category (an owner is named
 * only for OWNER_NAMED ones), `caption` its lore line (data/lore.json), `ingame` whether its in-game
 * shot exists, `first` whether this is the first adoption. Returns { ok, text, violations }.
 */
export function draftAdoption(a, cat, { kit = null, category = null, caption = null, ingame = false, first = false } = {}) {
  const pad = LAUNCHPADS[a?.launchpad];
  const bad = [];
  if (!KIT_NAME.test(kit?.name ?? "")) bad.push({ rule: "kit_name", term: String(kit?.name ?? "").slice(0, 40), field: "name" });
  if (!KIT_TICKER.test(kit?.ticker ?? "")) bad.push({ rule: "kit_ticker", term: String(kit?.ticker ?? "").slice(0, 16), field: "symbol" });
  if (!pad) bad.push({ rule: "launchpad", term: String(a?.launchpad), field: "launchpad" });
  if (bad.length) return { ok: false, text: null, violations: bad };

  const link = cardLink(cat.id);
  const company = companyShort(cat.company);
  // An organisation or a show, briefly; never a person, a handle or a long description.
  const namable = cat.adoptable ? OWNER_NAMED.includes(category) && !!company && !company.includes("@") && company.length <= 30 : !!cat.symbol;
  const owner = namable ? (cat.adoptable ? `, the cat of ${company},` : `, the cat for ${cat.symbol},`) : "";
  // The cat's own names and its card are citations, as in the announcer.
  const cited = [cat.name, kit.name, kit.ticker, company, cat.company, cat.symbol, link, SITE, pad];
  const hook = first ? "🎉 FIRST ADOPTION! 🎉" : "🎉 ADOPTED! 🎉";
  // Longest first; the shortest always fits, so an adoption is never held for its length.
  const coins = [...new Set([
    `😻 ${cat.name}${owner} now has a coin: ${kit.name} (${kit.ticker}), launched on ${pad} by a visitor from its kit`,
    `😻 ${cat.name} now has a coin: ${kit.name} (${kit.ticker}), launched on ${pad} by a visitor from its kit`,
    `😻 ${cat.name} was adopted: ${kit.name} (${kit.ticker}) on ${pad}`,
  ])];
  const notOurs = "🏡 We didn't launch it and don't run it";
  const lores = [...(caption ? [`📸 ${caption}`] : []), ...sentences(cat.story).slice(0, 1).map((s) => `📜 ${s}`), ""];
  let violations = [];
  for (const coin of coins) {
    for (const lore of lores) {
      for (const [tags, game] of [[HASHTAGS, ingame], [HASHTAGS.slice(0, 1), ingame], [HASHTAGS, false], [HASHTAGS.slice(0, 1), false]]) {
        const look = game ? INGAME_LINE : null;
        const fixed = [hook, coin, look, notOurs, link, tags.join(" ")].filter(Boolean);
        const room = LIMIT - weightedLength(fixed.join("\n")) - 1;
        if (lore && weightedLength(lore) > room) continue;    // a lore line goes in whole or not at all; a shorter one, or none, comes later
        const text = [hook, coin, lore, look, notOurs, link, tags.join(" ")].filter(Boolean).join("\n");
        const r = checkUpdate(text, cited);
        if (r.ok) return { ok: true, text, violations: [] };
        violations = r.violations;
      }
    }
  }
  return { ok: false, text: null, violations };
}

/** A run of 32 or more base58 letters: what an address or a signature looks like. Never in a launch post. */
export const ADDRESS_LIKE = /[1-9A-HJ-NP-Za-km-z]{32,}/;

/**
 * The fan-tribute line every sanctuary coin carries (the end of its metadata description, and its launch
 * post's when it fits): the owner's words, fixed. A drawn or fictional cat belongs to its character's
 * owners; a real pet (the trend watch's reading kind "real") to its people. The line says the coin is NOT
 * official, which the content rules' endorsement list ("affiliated", "endorsed") cannot tell from a claim
 * that it is: so this exact text is a citation (like the site's own link), and only this text.
 */
export const FAN_TRIBUTE = Object.freeze({
  character: "Unofficial fan tribute from the Catcoin Sanctuary. Not affiliated with or endorsed by the character's owners.",
  real: "Unofficial fan tribute from the Catcoin Sanctuary. Not affiliated with or endorsed by the cat's owners.",
});
/** The fan-tribute line for a cat of this reading kind ("real": a pet; anything else: a character). */
export const fanTribute = (kind) => (kind === "real" ? FAN_TRIBUTE.real : FAN_TRIBUTE.character);

/**
 * Draft the post for a coin the sanctuary launched itself. `cat` is the announcer's cat (listCats:
 * its id is the card's key), `coinName` and `ticker` the coin's, `lore` its one lore line, `launchpad`
 * the adoptable's launch.launchpad; `cited` names more words the post may use as citations (a
 * watch-list figure's aliases). The cat's name, the coin's name and ticker, the card link, the site and
 * the launchpad are citations; the rest meets every rule. Never an address (ADDRESS_LIKE), a mention,
 * a hashtag of ours in the names, or the found post's author. Longest first; the shortest names the
 * cat, the sanctuary's launch and the card. `tribute` (fanTribute) goes under the lore line when some
 * version of the post (longest first, the card link always kept) fits the length and every rule with
 * it; when none does, the post is exactly as it would be without it. Returns
 * { ok, text, violations }. The launcher drafts it BEFORE launching (scripts/lib/launcher.mjs) and does
 * not launch a cat whose post would be held.
 */
export function draftLaunch(cat, { coinName, ticker, lore = null, launchpad = "pump.fun", cited: also = [], tribute = null } = {}) {
  const pad = LAUNCHPADS[launchpad];
  const bad = [];
  if (!KIT_NAME.test(cat?.name ?? "")) bad.push({ rule: "kit_name", term: String(cat?.name ?? "").slice(0, 40), field: "name" });
  if (!KIT_NAME.test(coinName ?? "")) bad.push({ rule: "kit_name", term: String(coinName ?? "").slice(0, 40), field: "coinName" });
  if (!KIT_TICKER.test(ticker ?? "")) bad.push({ rule: "kit_ticker", term: String(ticker ?? "").slice(0, 16), field: "symbol" });
  if (!pad) bad.push({ rule: "launchpad", term: String(launchpad), field: "launchpad" });
  if (lore !== null && (typeof lore !== "string" || !lore.trim() || /[@#$]|https?:|www\./i.test(lore))) bad.push({ rule: "lore", term: String(lore).slice(0, 40), field: "lore" });
  if (typeof cat?.id !== "string" || !cat.id) bad.push({ rule: "card", term: String(cat?.id), field: "id" });
  if (tribute !== null && !Object.values(FAN_TRIBUTE).includes(tribute)) bad.push({ rule: "tribute", term: String(tribute).slice(0, 40), field: "tribute" });
  if (bad.length) return { ok: false, text: null, violations: bad };

  const link = cardLink(cat.id);
  const cited = [cat.name, coinName, ticker, link, SITE, pad, ...also];
  const hook = "🚀 NEW SANCTUARY COIN 🚀";
  const named = nameKey(cat.name) === nameKey(coinName) ? `${cat.name} (${ticker})` : `${cat.name}: ${coinName} (${ticker})`;
  const coins = [...new Set([`😻 ${named}, launched by the sanctuary on ${pad}`, `😻 ${cat.name}, launched by the sanctuary on ${pad}`])];
  const mintLine = "🔍 Its one real mint is on its card 👇";
  const lores = [...(lore ? [`📜 ${lore.trim()}`] : []), ""];
  const check = (lines, citing) => {
    const text = lines.filter(Boolean).join("\n");
    const r = checkUpdate(text, citing);
    if (ADDRESS_LIKE.test(text)) r.violations.push({ rule: "address", term: text.match(ADDRESS_LIKE)[0].slice(0, 12), field: "post" });
    if (text.includes("@")) r.violations.push({ rule: "mention", term: "@", field: "post" });
    return { text, violations: r.violations };
  };
  // Longest first: both names, the lore, the mint line and both hashtags, then fewer (the card link always).
  const first = (line, citing) => {
    let violations = [];
    for (const coin of coins) {
      for (const loreLine of lores) {
        for (const [tags, where] of [[HASHTAGS, mintLine], [HASHTAGS.slice(0, 1), mintLine], [HASHTAGS, null], [HASHTAGS.slice(0, 1), null]]) {
          const r = check([hook, coin, loreLine, line, where, link, tags.join(" ")], citing);
          if (!r.violations.length) return { ok: true, text: r.text, violations: [] };
          violations = r.violations;
        }
      }
    }
    return { ok: false, text: null, violations };
  };
  // With the fan-tribute line when some version of the post fits every rule with it; else the post as it would be without.
  if (tribute) { const t = first(tribute, [...cited, tribute]); if (t.ok) return t; }
  return first(null, cited);
}

const retryable = (s) => !s || s.status === "queued" || (s.status === "failed" && (s.attempts ?? 0) < MAX_ATTEMPTS);

/**
 * The sanctuary's own launches that may be announced (data/sanctuary-launches.json rows), earliest
 * first: "launched" and recorded, the cat in `adoptables` (data/adoptables.json's cats) carrying that
 * very mint and transaction as its launch, the mint `proved` (in data/collection.json as validated),
 * the announcer's cat `launched` by the page's own rule (listCats: assets/ui/adoptables.js
 * provedLaunch, that mint, tx and launchpad under the cat's coin name and ticker), not held for
 * review, and not posted (or retryable). [{ kind: "launch", id: TICKER, launch, cat }].
 */
export function launchItems(updates, launches, { cats, adoptables = [], proved = new Set(), heldKeys = new Set() }) {
  const byKey = new Map(cats.map((c) => [c.key, c]));
  const done = updates.launchesPosted || {};
  return (Array.isArray(launches) ? launches : [])
    .filter((r) => r?.status === "launched" && typeof r.recordedAt === "string" && typeof r.ticker === "string" && isAddress(r.mintPublic) && proved.has(r.mintPublic))
    .filter((r) => { const a = adoptables.find((c) => c?.ticker === r.ticker); return a?.launch?.mint === r.mintPublic && a.launch.tx === r.tx && byKey.get(r.ticker)?.sanctuary && byKey.get(r.ticker)?.launched; })
    .filter((r) => !heldKeys.has(r.ticker) && retryable(done[r.ticker]))
    .sort((a, b) => Date.parse(a.launchedAt ?? a.recordedAt) - Date.parse(b.launchedAt ?? b.recordedAt))
    .map((r) => ({ kind: "launch", id: r.ticker, launch: r, cat: byKey.get(r.ticker) }));
}

/**
 * What may go out, in order: the sanctuary's own launches (launchItems), then adoptions not posted yet
 * (earliest launch first), then approved, queued updates in file order. An adoption of a cat the
 * sanctuary does not have, of a cat the sanctuary launches itself (listCats `sanctuary`: it is not
 * adoptable, as the site shows it), or of a mint the owner launched (data/collection.json, or an
 * adoptable's `launch` field), is not one.
 */
export function candidates(updates, adoptions, { cats, kits = null, ownMints = new Set(), ownWallets = new Set(), heldKeys = new Set(), launches = [], adoptables = [], proved = new Set() }) {
  const byKey = new Map(cats.map((c) => [c.key, c]));
  const done = updates.adoptionsPosted || {};
  const ours = launchItems(updates, launches, { cats, adoptables, proved, heldKeys });
  // Not the owner's own launch or wallet, and not a cat the announcer holds for its content (paused adoptables are fine).
  // With the kits: the coin carries its cat's kit name and ticker, as the site checks it (assets/residents.js).
  const ofKit = (a) => { const k = kits?.get(a.key); return !kits || (!!k && nameKey(a.name) === nameKey(k.name) && a.symbol.trim().toUpperCase() === k.ticker); };
  const real = (adoptions?.adoptions || []).filter((a) => validAdoption(a) && !ownMints.has(a.mint) && !ownWallets.has(a.creator) && byKey.has(a.key) && !byKey.get(a.key).sanctuary && !heldKeys.has(a.key) && ofKit(a))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const out = [...ours, ...real.filter((a) => retryable(done[a.key]))
    .map((a) => ({ kind: "adoption", id: a.key, adoption: a, cat: byKey.get(a.key), first: a === real[0] }))];
  for (const p of updates.posts || []) {
    if (p?.approved === true && typeof p.id === "string" && retryable({ ...p, status: p.status ?? "queued" })) out.push({ kind: "update", id: p.id, post: p });
  }
  return out;
}

/** When the announcer last posted (ms), or null: the newest posted cat, or the last release. */
export function lastAnnouncerPost(announced, queue) {
  const times = Object.values(announced?.cats || {}).filter((s) => s?.status === "posted" || s?.status === "posting").map((s) => Date.parse(s.at ?? ""));
  times.push(Date.parse(queue?.lastReleaseAt ?? ""));
  const ok = times.filter(Number.isFinite);
  return ok.length ? Math.max(...ok) : null;
}

/** Why this run must not post yet, or null when it may. */
export function waitReason({ updates, announced, queue, nowMs }) {
  const gap = Math.max(0, Number(updates?.minGapMinutes ?? DEFAULT_GAP_MINUTES));
  const last = Date.parse(updates?.lastPostedAt ?? "");
  if (Number.isFinite(last) && nowMs - last < gap * 60_000) return `last update posted ${updates.lastPostedAt}; the next after ${gap} minutes`;
  const ann = lastAnnouncerPost(announced, queue);
  if (ann != null && nowMs - ann < AFTER_ANNOUNCER_MINUTES * 60_000) return `the announcer posted at ${new Date(ann).toISOString()}; waiting ${AFTER_ANNOUNCER_MINUTES} minutes after it`;
  return null;
}

function writeJson(file, value) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(tmp, file);
}
const mimeOf = (f) => (/\.png$/i.test(f) ? "image/png" : /\.webp$/i.test(f) ? "image/webp" : "image/jpeg");

/**
 * One run. The root folder, the environment, fetch and the clock are injectable. Returns
 * { mode, waited, posted: { kind, id, tweet } | null, held, failed, drafts }.
 */
export async function run({ root, env = process.env, fetchImpl = fetch, now = () => new Date(), log = console.log, force = {} } = {}) {
  const data = (f) => path.join(root, "data", f);
  const config = { ...DEFAULT_CONFIG, ...readJson(data("announce-config.json"), {}), ...force };
  const creds = credsFromEnv(env);
  const mode = config.dryRun ? "dryRun" : creds ? "post" : "none";
  const summary = { mode, waited: null, posted: null, held: [], failed: [], drafts: [] };
  if (mode === "none") { log("Updates: no X secrets; nothing posted, nothing recorded."); return summary; }

  const updates = readJson(data("updates.json"), null);
  if (!updates) { log("Updates: no data/updates.json; nothing to post."); return summary; }
  updates.posts ||= [];
  updates.adoptionsPosted ||= {};
  const nowMs = now().getTime();
  const stamp = () => now().toISOString();
  const save = () => { if (mode === "post") writeJson(data("updates.json"), updates); };

  summary.waited = waitReason({ updates, announced: readJson(data("announced.json"), { cats: {} }), queue: readJson(data("release-queue.json"), {}), nowMs });
  if (summary.waited) { log(`Updates: not yet (${summary.waited}).`); return summary; }

  const collection = readJson(data("collection.json"), { cats: [] });
  // Cats as the page shows them (validated collection); the raw file still marks every owner mint as ours below.
  const provedCats = provedCollection(path.join(root, "data"), nowMs).cats;
  const cats = listCats(readJson(data("planned.json"), { stocks: [], cats: [] }), { cats: provedCats }, readJson(data("adoptables.json"), { cats: [] }));
  const captions = readJson(data("lore.json"), {}).cats || {};
  const planned = readJson(data("planned.json"), { cats: [] }), adoptables = readJson(data("adoptables.json"), { cats: [] });
  const kits = new Map(kitsOf({ planned, adoptables }).map((k) => [k.key, k]));
  const category = new Map((adoptables.cats || []).map((c) => [c.ticker, c.category]));
  const announced = readJson(data("announced.json"), { cats: {} });
  const heldKeys = new Set(Object.entries(announced.cats || {}).filter(([, v]) => ["held", "needs_review"].includes(v?.status) && v.reason !== "adoptable cat: announcing paused").map(([k]) => k));
  const walletsFile = readJson(data("wallets.json"), { launchers: [] });
  const ownWallets = new Set((walletsFile.launchers || []).map((w) => w.address));
  // A sanctuary launch is announced only once the hourly check has proved its mint (the collection as the page validates it).
  const proved = new Set(provedCats.map((c) => c.mint));
  const ledger = readJson(data("sanctuary-launches.json"), { launches: [] });
  const list = candidates(updates, readJson(data("adoptions.json"), { adoptions: [] }), { cats, kits, ownMints: new Set(ownMints({ collection, adoptables })), ownWallets, heldKeys,
    launches: ledger.launches || [], adoptables: adoptables.cats || [], proved });
  log(`Updates: ${mode} mode; ${list.filter((c) => c.kind === "launch").length} launch(es), ${list.filter((c) => c.kind === "adoption").length} adoption(s) and ${list.filter((c) => c.kind === "update").length} update(s) waiting.`);

  // The record an item's state lives in: the update itself, or its adoptionsPosted or launchesPosted row.
  const recOf = (item) => (item.kind === "update" ? item.post
    : item.kind === "launch" ? ((updates.launchesPosted ||= {})[item.id] ||= { postId: item.launch.postId })
      : (updates.adoptionsPosted[item.id] ||= { mint: item.adoption.mint }));
  const launchpadOf = (key) => (adoptables.cats || []).find((c) => c.ticker === key)?.launch?.launchpad;
  for (const item of list) {
    // The last line before X (announce.mjs guardDraft): no address in a post.
    const d = guardDraft(item.kind === "update"
      ? { ...checkUpdate(item.post.text), text: item.post.text }
      : item.kind === "launch"
        ? draftLaunch(item.cat, { coinName: item.launch.coinName, ticker: item.launch.ticker, lore: item.launch.lore ?? null, launchpad: launchpadOf(item.id), tribute: fanTribute(item.launch.kind) })
        : draftAdoption(item.adoption, item.cat, { kit: kits.get(item.cat.key), category: category.get(item.cat.key), caption: captions[item.cat.key] ?? null, ingame: fs.existsSync(path.join(root, ingameShot(item.cat.key))), first: item.first }));
    summary.drafts.push({ kind: item.kind, id: item.id, ok: d.ok, text: d.text, length: d.text ? weightedLength(d.text) : null, violations: d.violations });
    if (!d.ok) {
      summary.held.push(item.id);
      log(`::warning::Updates: ${item.kind} ${item.id} held for review (${d.violations.map((v) => `${v.rule}: ${v.term}`).join("; ")}).`);
      if (mode === "post") { Object.assign(recOf(item), { status: "held", at: stamp(), violations: d.violations }); save(); }
      continue;
    }
    const images = item.kind !== "update" ? postImages(item.cat, { image: item.cat.portrait }, root)
      : item.post.image && IMAGE_PATH.test(item.post.image) && !item.post.image.includes("..") && fs.existsSync(path.join(root, item.post.image)) ? [path.join(root, item.post.image)] : [];
    if (item.kind === "update" && item.post.image && !images.length) log(`::warning::Updates: ${item.id}'s image ${item.post.image} is missing or not a png, jpg or webp under assets/; posting without it.`);
    if (mode === "dryRun") {
      log(`Updates (dry run): would post ${item.kind} ${item.id} (${weightedLength(d.text)}/${LIMIT}, ${images.length} image(s)):\n${d.text}`);
      break;
    }

    // Posting: recorded before it goes out, so a crash never posts it twice.
    const rec = recOf(item);
    const tries = (rec.attempts ?? 0) + 1;
    Object.assign(rec, { status: "posting", at: stamp(), attempts: tries });
    delete rec.error; delete rec.violations;
    save();
    try {
      const media = [];
      for (const img of images) {
        try { media.push(await uploadImage(fs.readFileSync(img), mimeOf(img), creds, fetchImpl)); }
        catch (e) { log(`::warning::Updates: ${path.basename(img)} did not upload (${e.message}); posting without it.`); }
      }
      const tweet = await createPost({ text: d.text, mediaIds: media }, creds, fetchImpl);
      Object.assign(rec, { status: "posted", postedAt: stamp(), tweet });
      delete rec.at;
      updates.lastPostedAt = rec.postedAt;
      save();
      summary.posted = { kind: item.kind, id: item.id, tweet };
      log(`Updates: posted ${item.kind} ${item.id}: https://x.com/catcosanctuary/status/${tweet}`);
    } catch (e) {
      const status = e instanceof XError ? e.status : null;
      // A 401 (the keys) or 429 (the rate) says nothing about the post: it keeps its tries.
      Object.assign(rec, { status: "failed", at: stamp(), attempts: [401, 429].includes(status) ? tries - 1 : tries,
        error: `${e.message}${e.body ? ` ${JSON.stringify(e.body).slice(0, 300)}` : ""}` });
      save();
      summary.failed.push(item.id);
      log(`::warning::Updates: ${item.kind} ${item.id} not posted (${e.message}).`);
      if ([401, 403, 429].includes(status)) log("::warning::X refused the credentials or the rate; stopping this run.");
    }
    break;                                                  // one try a run
  }
  if (!summary.posted && !summary.failed.length && mode === "post") log("Updates: nothing to post.");
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  run({ root, force: process.argv.includes("--dry-run") ? { dryRun: true } : {} }).catch((e) => { console.error(e); process.exitCode = 1; });
}
