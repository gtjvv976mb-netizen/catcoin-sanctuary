/* "Who's that cat?": the next cat to be posted or released, as the site may know it before the
   reveal (data/next-cat.json): an opaque id, its black silhouette (assets/teaser/<id>.png, made by
   scripts/build-teasers.mjs), a lore hint with no name in it, its category and when it is due.
   Never its name, ticker, owner or company. scripts/announce.mjs refreshes the file after each run
   that saved its state; the order is announce.mjs's own (pick, then the release queue). */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { checkFields } from "./content-rules/content-rules.mjs";
import { pick, rosterLeft, listCats, readJson, DEFAULT_CONFIG } from "../announce.mjs";

export const CATEGORIES = ["company", "celebrity", "tv-movie", "crypto", "viral"];
export const RUN_EVERY_MINUTES = 20; // .github/workflows/announce.yml: */20
const HINTS_FILE = "scripts/teaser-hints.json";
const HELD = ["held", "needs_review", "posting", "posted", "queued"];

/** The opaque id: a salted hash of the key, so neither the file nor the picture's name says who it is. */
export const teaserId = (key) => crypto.createHash("sha256").update(`catsanc-teaser-v1:${key}`).digest("hex").slice(0, 16);
export const silhouettePath = (key) => `assets/teaser/${teaserId(key)}.png`;

/** Every upcoming cat in posting order: this roster's picks (fresh, retries, backlog), then the approved release queue. */
export function upcoming(cats, state, queue, config = DEFAULT_CONFIG) {
  queue = { cats: [], ...queue };
  const queued = new Set(queue.cats.filter((q) => q.status !== "released").map((q) => q.key));
  const roster = pick(cats, state, { ...config, perRun: Infinity, backlogPerRun: 2, announceBacklog: config.announceBacklog }, queued);
  // pick() takes at most 2 from the backlog a run; the order past them is the same list's order.
  const rest = config.announceBacklog ? cats.filter((c) => !queued.has(c.key) && state.cats[c.key]?.status === "backlog" && !roster.includes(c)) : [];
  const byKey = new Map(cats.map((c) => [c.key, c]));
  const release = queue.cats.filter((q) => q.status !== "released" && q.approved === true && !HELD.includes(state.cats[q.key]?.status))
    .map((q) => byKey.get(q.key)).filter(Boolean);
  return [...roster, ...rest, ...release];
}

/** The words that would give a cat away: its name, ticker, owner or company, and its stock symbol. */
export function giveaways(cat) {
  const STOP = new Set(["the", "and", "cat", "cats", "of", "a", "an", "in", "on", "my", "for", "inc", "corp", "ltd", "co", "estate", "office", "family", "first", "city", "studio", "studios", "station", "game", "world", "house", "street", "anonymous", "worker", "japan", "istanbul", "london"]);
  const words = [cat.name, cat.company, cat.owner].join(" ").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/);
  return [...new Set([...words.filter((w) => w.length >= 3 && !STOP.has(w)), String(cat.ticker || cat.key).toLowerCase(), String(cat.symbol || "").toLowerCase()].filter((w) => w.length >= 3))];
}

/** Why a hint may not be shown: a giveaway word, or a content rule it breaks. [] when it is fine. */
export function hintProblems(hint, cat) {
  const flat = String(hint).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const out = giveaways(cat).filter((w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(flat)).map((w) => `names "${w}"`);
  for (const v of checkFields({ hint }).violations) out.push(`${v.rule}: ${v.term}`);
  if (/\$\s?\d|\$[a-z]/i.test(hint)) out.push("price talk");
  return out;
}

const GENERIC = "🐾 A brand-new face is padding up the garden path… 👀✨ Whiskers, lore and a whole lot of attitude. Can you guess who? 🤔";

/** The hint for a cat: its hand-written teaser line, else the generic one. Never one that names it. */
export function hintFor(cat, hints = {}) {
  const h = hints[cat.key];
  return h && !hintProblems(h, cat).length ? h : GENERIC;
}

/** When the next cat is due: the next scheduled run, or after the release spacing for a queued cat. */
export function expectedAt(nowMs, { release = false, lastReleaseAt = null, everyMinutes = 60 } = {}) {
  const slot = RUN_EVERY_MINUTES * 60_000;
  let t = Math.ceil((nowMs + 60_000) / slot) * slot;
  if (release && lastReleaseAt) t = Math.max(t, Math.ceil((Date.parse(lastReleaseAt) + everyMinutes * 60_000) / slot) * slot);
  return new Date(t).toISOString();
}

/** data/next-cat.json's contents, or { id: null } when nobody is waiting. */
export function nextCatFile({ cats, state, queue, config, hints = {}, adoptables = { cats: [] }, now = new Date(), root = null }) {
  const list = upcoming(cats, state, queue, config);
  const cat = list[0];
  if (!cat) return { id: null, silhouette: null, hint: null, category: null, expectedAt: null };
  const adopt = (adoptables.cats || []).find((a) => a.ticker === cat.key);
  const category = CATEGORIES.includes(adopt?.category) ? adopt.category : "company";
  const release = !rosterLeft(cats, state, new Set((queue?.cats || []).filter((q) => q.status !== "released").map((q) => q.key)));
  const sil = silhouettePath(cat.key);
  return {
    id: teaserId(cat.key),
    silhouette: !root || fs.existsSync(path.join(root, sil)) ? sil : null,
    hint: hintFor({ ...cat, owner: adopt?.owner }, hints),
    category,
    expectedAt: expectedAt(now.getTime(), { release, lastReleaseAt: queue?.lastReleaseAt, everyMinutes: config?.releaseEveryMinutes ?? 60 }),
  };
}

/** Reads everything under `root`, writes data/next-cat.json if it changed. Returns the file. */
export function writeNextCat(root, { now = new Date(), state = null } = {}) {
  const data = (f) => path.join(root, "data", f);
  const adoptables = readJson(data("adoptables.json"), { cats: [] });
  const cats = listCats(readJson(data("planned.json"), { stocks: [], cats: [] }), readJson(data("collection.json"), { cats: [] }), adoptables);
  state ||= readJson(data("announced.json"), { cats: {} });
  state.cats ||= {};
  const config = { ...DEFAULT_CONFIG, ...readJson(data("announce-config.json"), {}) };
  const hints = readJson(path.join(root, HINTS_FILE), { cats: {} }).cats || {};
  const next = nextCatFile({ cats, state, queue: readJson(data("release-queue.json"), { cats: [] }), config, hints, adoptables, now, root });
  const file = data("next-cat.json");
  const old = readJson(file, null);
  if (JSON.stringify(old) !== JSON.stringify(next)) fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  return next;
}
