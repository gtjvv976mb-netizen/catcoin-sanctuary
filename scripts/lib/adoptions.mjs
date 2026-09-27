/* ADOPTIONS: coins strangers launched from a sanctuary cat's own Adopt kit (assets/ui/adopt.js), kept
   in data/adoptions.json. scripts/build-trending.mjs tests every pump.fun launch it pages against
   the kits; the site and the X poster read the file.

   A launch is a cat's adoption when it came after the kits went live (KITS_LIVE), carries the kit's
   ticker and name (compared lower-case, letters and digits only), and at least one more piece of
   the kit: its description starts the cat's story, its X or website link is the cat's proof post
   or card, or its picture is the kit's token (assets/kits/kits.json tokenSha256). A cat has one
   adoption, the earliest; a later launch of the same kit is a copycat. The owner's own launches
   (data/collection.json, data/wallets.json) are never adoptions: an adoption is a stranger's coin,
   which the sanctuary neither launched nor owns. */
import { launchKit, loreText } from "../../assets/ui/adopt.js";
import { nameKey } from "../../assets/ui/adoptables.js";
import { clean } from "../../assets/ui/trending.js";

export const SITE = "https://catcoinsanctuary.com/";
/** When the Adopt kits went live: nothing launched before is an adoption. */
export const KITS_LIVE = "2026-09-25T00:00:00Z";
export const LAUNCHPADS = ["pump.fun", "stonkfun"];
/** The kinds of evidence, in the order a record lists them. name and ticker are always there. */
export const EVIDENCE = ["name", "ticker", "description", "proof-link", "card-link", "image"];
/** How much of the cat's story (letters and digits) a description must carry. */
export const STORY_START = 40;
export const NOTE = "Adoptions: coins strangers launched from a sanctuary cat's own Adopt kit, the earliest per cat. Written by scripts/build-trending.mjs; the sanctuary did not launch these coins and does not own them.";

const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const KEY = /^[A-Za-z0-9]{2,44}$/;
const SHA = /^[0-9a-f]{64}$/;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const norm = (s) => String(s ?? "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
/** A ticker as compared: exactly the kit's, letter case aside. A name: assets/ui/adoptables.js nameKey (any script). */
const tickerKey = (s) => String(s ?? "").trim().toUpperCase();

/** A link as compared: host without www., no trailing slash; an X post by its id, whatever the handle. Null if not a web link. */
export function linkKey(u) {
  let s = String(u ?? "").trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  let url;
  try { url = new URL(s); } catch { return null; }
  if (!/^https?:$/.test(url.protocol)) return null;
  const host = url.hostname.toLowerCase().replace(/^(www|mobile)\./, "");
  const pathname = url.pathname.replace(/\/+$/, "");
  if (host === "x.com" || host === "twitter.com") {
    const id = pathname.match(/\/status(?:es)?\/(\d{5,25})/)?.[1];
    return id ? `x.com/status/${id}` : `x.com${pathname}`.toLowerCase();
  }
  let hash = url.hash;
  try { hash = decodeURIComponent(hash); } catch { /* kept as written */ }
  return `${host}${pathname}${url.search}${hash}`.toLowerCase();
}

/**
 * Every cat's kit as the matcher needs it: [{ key, name, ticker, storyStart, proofUrl, cardUrl, tokenSha256 }].
 * `kits` is assets/kits/kits.json, when read (the token pictures' hashes).
 */
export function kitsOf({ planned = { cats: [] }, adoptables = { cats: [] }, kits = null } = {}) {
  const cats = [...(planned.cats || []), ...(adoptables.cats || []).map((c) => ({ ...c, description: c.story }))];
  return cats.filter((c) => c?.ticker).map((c) => {
    const kit = launchKit(c, { site: SITE });
    const story = norm(loreText(c)).slice(0, STORY_START);
    const sha = kits?.cats?.[c.ticker]?.tokenSha256;
    return { key: c.ticker, name: kit.name, ticker: kit.ticker, storyStart: story.length >= 24 ? story : null,
      proofUrl: c.proof?.url || null, cardUrl: kit.website, tokenSha256: SHA.test(sha ?? "") ? sha : null };
  });
}

/** The kits whose ticker and name this launch carries (almost always none, or one). */
export function sameKit(launch, kits) {
  const t = tickerKey(launch?.symbol), n = nameKey(launch?.name);
  return t && n ? kits.filter((k) => k.ticker === t && nameKey(k.name) === n) : [];
}

/** A launch's time in ms: pump.fun's created_timestamp, or an ISO createdAt. */
const launchedMs = (l) => (/^\d{10,16}$/.test(String(l?.created_timestamp ?? "")) ? Number(l.created_timestamp) : Date.parse(l?.createdAt ?? ""));

/**
 * Is this launch a cat's adoption? { key, evidence } or null. `launch` is pump.fun's row
 * ({ mint, name, symbol, description, twitter, website, creator, created_timestamp }), with
 * imageSha256 when its picture was read. Whether an earlier launch took the cat is mergeAdoptions's.
 */
export function matchAdoption(launch, kits, { collectionMints = [], ownerWallets = [] } = {}) {
  if (!launch || !MINT.test(launch.mint ?? "")) return null;
  if (new Set(collectionMints).has(launch.mint) || new Set(ownerWallets).has(launch.creator)) return null;
  if (!(launchedMs(launch) >= Date.parse(KITS_LIVE))) return null;
  const desc = norm(launch.description);
  const links = [launch.twitter, launch.website].map(linkKey).filter(Boolean);
  let best = null;
  for (const k of sameKit(launch, kits)) {
    const extra = [];
    if (k.storyStart && desc.includes(k.storyStart)) extra.push("description");
    if (k.proofUrl && links.includes(linkKey(k.proofUrl))) extra.push("proof-link");
    if (k.cardUrl && links.includes(linkKey(k.cardUrl))) extra.push("card-link");
    if (k.tokenSha256 && String(launch.imageSha256 ?? "").toLowerCase() === k.tokenSha256) extra.push("image");
    if (extra.length && (!best || extra.length > best.evidence.length - 2)) best = { key: k.key, evidence: ["name", "ticker", ...extra] };
  }
  return best;
}

/** A matched launch as a data/adoptions.json record. */
export function adoptionRecord(launch, match, { launchpad = "pump.fun", foundAt }) {
  return { key: match.key, mint: launch.mint, name: clean(launch.name, 60), symbol: clean(launch.symbol, 16), launchpad,
    creator: String(launch.creator ?? ""), createdAt: iso(launchedMs(launch)), foundAt, evidence: EVIDENCE.filter((e) => match.evidence.includes(e)) };
}

/** The records with the candidates added: one per cat, its earliest launch (a record already there wins a tie), and a mint once. */
export function mergeAdoptions(existing = [], candidates = []) {
  const byKey = new Map();
  for (const a of [...existing, ...candidates]) {
    const had = byKey.get(a.key);
    if (!had || Date.parse(a.createdAt) < Date.parse(had.createdAt)) byKey.set(a.key, a);
  }
  const seen = new Set();
  return [...byKey.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.key.localeCompare(b.key))
    .filter((a) => !seen.has(a.mint) && seen.add(a.mint));
}

/** What is wrong with one record, or null. */
export function adoptionProblem(a) {
  if (!a || typeof a !== "object") return "not an object";
  if (!KEY.test(a.key ?? "")) return "key must be a cat's key";
  if (!MINT.test(a.mint ?? "")) return `${a.key}: mint must be a Solana address`;
  // Typed by a stranger: no control or invisible characters (trending.js clean), as the site and the X poster show it.
  if (typeof a.name !== "string" || !a.name || a.name !== clean(a.name, 60)) return `${a.key}: name must be 1 to 60 plain characters`;
  if (typeof a.symbol !== "string" || !/^\S{1,16}$/.test(a.symbol) || a.symbol !== clean(a.symbol, 16)) return `${a.key}: symbol must be 1 to 16 plain characters, no spaces`;
  if (!LAUNCHPADS.includes(a.launchpad)) return `${a.key}: launchpad must be one of ${LAUNCHPADS.join(", ")}`;
  if (!MINT.test(a.creator ?? "")) return `${a.key}: creator must be a Solana address`;
  if (!ISO.test(a.createdAt ?? "") || !ISO.test(a.foundAt ?? "")) return `${a.key}: createdAt and foundAt must be ISO times (UTC)`;
  if (Date.parse(a.createdAt) < Date.parse(KITS_LIVE)) return `${a.key}: launched before the kits went live`;
  if (Date.parse(a.foundAt) < Date.parse(a.createdAt)) return `${a.key}: found before it was launched`;
  const ev = a.evidence;
  if (!Array.isArray(ev) || ev.some((e) => !EVIDENCE.includes(e)) || new Set(ev).size !== ev.length) return `${a.key}: evidence must be distinct items of ${EVIDENCE.join(", ")}`;
  if (!ev.includes("name") || !ev.includes("ticker") || ev.length < 3) return `${a.key}: evidence must be the name, the ticker and at least one more`;
  return null;
}

/** data/adoptions.json checked: a list of problems, empty when it is sound. `keys`: the cats' keys, when known. */
export function checkAdoptions(j, { keys = null } = {}) {
  if (!j || typeof j !== "object" || Array.isArray(j)) return ["not a JSON object"];
  const out = [];
  if (typeof j.note !== "string" || !j.note.trim()) out.push("note must say what the file is");
  if (!Array.isArray(j.adoptions)) return [...out, "adoptions must be a list"];
  const seenKeys = new Set(), seenMints = new Set();
  j.adoptions.forEach((a, i) => {
    const p = adoptionProblem(a);
    if (p) return out.push(`#${i}: ${p}`);
    if (keys && !new Set(keys).has(a.key)) out.push(`#${i}: ${a.key} is not a sanctuary cat`);
    if (seenKeys.has(a.key)) out.push(`#${i}: ${a.key} is adopted twice`);
    if (seenMints.has(a.mint)) out.push(`#${i}: ${a.mint} is listed twice`);
    seenKeys.add(a.key); seenMints.add(a.mint);
  });
  return out;
}
