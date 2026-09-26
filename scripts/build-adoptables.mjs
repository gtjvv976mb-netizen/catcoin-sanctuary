#!/usr/bin/env node
/**
 * BUILDS data/adoptables.json: the adoptable cats (famous real, fictional and viral cats with no
 * sanctuary coin yet) from the research file (a list sorted by strength, each with a story, verified
 * X posts, web sources, an existing coin if any, a suggested name and ticker, a look, a pair
 * suggestion, sensitivity notes and a confidence).
 *
 *   node scripts/build-adoptables.mjs <adoptables-research.json> [--top 25]
 *
 * It takes the strongest `--top` cats, skipping any with confidence "low" or a look that is not
 * settled ("verify with photos"). Every cat is checked by assets/ui/adoptables.js; a bad cat stops
 * the run. A ticker already used by a planned cat stops the run too. A cat's portrait is
 * assets/portraits/<TICKER>.jpg when that file exists; otherwise it is "pending" and the card draws
 * a silhouette in the cat's coat colours. Its lore picture is assets/lore/<TICKER>.webp with the caption
 * from data/lore.json, when both exist; otherwise lore is null. New cats are recorded in data/announced.json as "held"
 * (no auto-posting yet); an existing record is never changed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateAdoptables, tributeLine, STONK_PAIR, lorePath } from "../assets/ui/adoptables.js";
import { STOCK_PAIRS } from "../assets/collection.js";
import { coatFromLook } from "./lib/coat.mjs";

export class AdoptablesError extends Error { constructor(m) { super(m); this.name = "AdoptablesError"; } }
const serialize = (v) => `${JSON.stringify(v, null, 2)}\n`;

const CATEGORY = { celebrity: "celebrity", tvmovie: "tv-movie", "tv-movie": "tv-movie", company: "company", viral: "viral", crypto: "crypto" };
/* Cats that have died (checked against their sources). Their cards say "In loving memory". */
export const MEMORIAL = new Set(["maru", "bob", "lilbub", "kittypurry", "delilah", "gli", "tombili", "tama"]);
/* A ticker the research suggested that clashes with the cat's own existing coin gets another (re-checked free on Jupiter and StonkFun). */
/* A coat the look's words read wrongly (a colourpoint read as a tortie, a pink cartoon cat). */
export const COAT_OVERRIDES = { choupette: { base: "white", second: "cream", pattern: "point", eyes: "blue" }, cheshire: { base: "lilac", second: "", pattern: "tabby", eyes: "yellow" } };
export const TICKER_OVERRIDES = { gli: "GLICAT" };

/** Whether a research row may be taken: not low confidence, and its look settled. */
export const usable = (r) => r && r.confidence !== "low" && !/verify with photos/i.test(String(r.look ?? ""));

function pairOf(r) {
  const s = String(r.pairSuggestion ?? "STONK").toUpperCase();
  if (s === "STONK") return { ...STONK_PAIR };
  const p = STOCK_PAIRS.find((x) => x.symbol.toUpperCase() === s || x.stonkfun === s);
  if (!p) throw new AdoptablesError(`${r.id}: ${s} is not STONK or a sanctuary stock pair`);
  return { symbol: p.symbol, mint: p.mint };
}

/** One research row as a data/adoptables.json cat. */
/** The lore captions (data/lore.json: { cats: { TICKER: caption } }), or {}. */
export function loreCaptions(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, "data/lore.json"), "utf8")).cats ?? {}; } catch { return {}; }
}

export function adoptableFrom(r, { root, captions = loreCaptions(root) }) {
  const x = (r.proof?.x ?? [])[0];
  if (!x) throw new AdoptablesError(`${r.id}: no verified X post`);
  const ticker = TICKER_OVERRIDES[r.id] ?? r.suggestedTicker;
  const portraitFile = path.join(root, "assets/portraits", `${ticker}.jpg`);
  const hasPortrait = fs.existsSync(portraitFile);
  const owner = String(r.owner).trim();
  const e = r.existingCoin;
  const memorial = MEMORIAL.has(r.id);
  return {
    id: r.id,
    ticker,
    name: String(r.catName).trim(),
    coinName: String(r.suggestedName ?? r.catName).trim(),
    owner,
    category: CATEGORY[r.category] ?? r.category,
    story: String(r.story).trim(),
    look: String(r.look).trim(),
    coat: COAT_OVERRIDES[r.id] ?? coatFromLook(r.look),
    pair: pairOf(r),
    proof: {
      kind: "x", url: x.url.replace("://twitter.com/", "://x.com/"), author: x.handle.replace(/^@/, ""), handle: x.handle.replace(/^@/, ""),
      date: x.date, dateType: "posted", text: String(x.text).replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 600),
      note: `Verified ${String(x.verifiedVia ?? "").replace(/^api\.fxtwitter\.com /, "on ")}`.trim(), image: null,
    },
    sources: (r.proof?.web ?? []).slice(0, 6).map((w) => ({ label: String(w.title ?? w.url).trim().slice(0, 140), url: w.url })),
    existingCoin: e ? { symbol: String(e.symbol), contract: String(e.contract ?? ""), mcapUsd: Number(e.mcap) || 0 } : null,
    memorial,
    tribute: tributeLine(owner),
    sensitivity: memorial ? `In loving memory of ${String(r.catName).trim()}.` : "",
    portrait: hasPortrait ? `assets/portraits/${ticker}.jpg` : null,
    portraitStatus: hasPortrait ? "ready" : "pending",
    confidence: r.confidence,
    lore: fs.existsSync(path.join(root, lorePath(ticker))) && captions[ticker] ? { image: lorePath(ticker), caption: String(captions[ticker]).trim() } : null,
  };
}

export function buildAdoptables({ root, source, top = 25, checked = new Date().toISOString().slice(0, 10), log = () => {} }) {
  let rows;
  try { rows = JSON.parse(fs.readFileSync(source, "utf8")); } catch { throw new AdoptablesError(`${source} is not readable JSON`); }
  if (!Array.isArray(rows)) throw new AdoptablesError(`${source} is not a list`);
  const picked = [];
  const captions = loreCaptions(root);
  for (const r of rows) {
    if (picked.length >= top) break;
    if (!usable(r)) { log(`${r?.id}: skipped (${r?.confidence === "low" ? "low confidence" : "look not settled"}).`); continue; }
    picked.push(adoptableFrom(r, { root, captions }));
  }
  const planned = JSON.parse(fs.readFileSync(path.join(root, "data/planned.json"), "utf8"));
  const taken = new Set(planned.cats.map((c) => c.ticker));
  const data = {
    note: "Adoptable cats: famous real, fictional and viral cats with no sanctuary coin yet. Fan tributes, not affiliated with their owners. Built by scripts/build-adoptables.mjs; checked by assets/ui/adoptables.js.",
    checked,
    cats: picked,
  };
  const v = validateAdoptables(data, { taken });
  if (v.refused.length) throw new AdoptablesError(`data/adoptables.json would not validate (${v.refused[0].detail}); nothing was written`);
  fs.writeFileSync(path.join(root, "data/adoptables.json"), serialize(data));

  // New cats are held from announcing (X posting is paused).
  const annFile = path.join(root, "data/announced.json");
  const ann = JSON.parse(fs.readFileSync(annFile, "utf8"));
  const added = [];
  for (const c of picked) if (!ann.cats[c.ticker]) { ann.cats[c.ticker] = { status: "held", reason: "adoptable cat: announcing paused" }; added.push(c.ticker); }
  if (added.length) fs.writeFileSync(annFile, serialize(ann));
  return { data, heldAdded: added, pending: picked.filter((c) => c.portraitStatus === "pending").map((c) => c.ticker) };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const ti = args.indexOf("--top");
  const top = ti >= 0 ? Number(args.splice(ti, 2)[1]) : 25;
  if (!args[0]) { console.error("Name the research file: node scripts/build-adoptables.mjs <adoptables.json> [--top 25]"); process.exitCode = 2; return; }
  try {
    const r = buildAdoptables({ root, source: args[0], top, log: (m) => console.log(m) });
    console.log(`${r.data.cats.length} adoptable cats written to data/adoptables.json.`);
    if (r.heldAdded.length) console.log(`Held from announcing: ${r.heldAdded.join(", ")}.`);
    if (r.pending.length) console.log(`Portraits pending: ${r.pending.join(", ")}.`);
  } catch (e) {
    if (!(e instanceof AdoptablesError)) throw e;
    console.error(`The adoptable cats were not updated: ${e.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
