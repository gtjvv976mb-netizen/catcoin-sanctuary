#!/usr/bin/env node
/**
 * BUILDS data/traits.json: every resident cat's character (assets/world/traits.js), so the garden
 * can make each cat move like itself: a lazy loaf cat lazy, a yarn kitten bouncy, a proud cat
 * strutting with its tail up, a shy one creeping low.
 *
 *   node scripts/build-traits.mjs            write data/traits.json (only if it changed)
 *   node scripts/build-traits.mjs --check    exit 1 if data/traits.json is out of date
 *   node scripts/build-traits.mjs --table    print a table of some cats and how they move
 *
 * The residents are the page's own (assets/residents.js loadResidents over the files in data/):
 * the planned cats, the adoptable cats and the famous coins, keyed by resident id (a famous coin
 * by its id, e.g. "hosico-cat"). Each is read from its story (data/planned.json, adoptables.json),
 * lore and profile (famous.json), lore caption (lore.json) and look sheets (its look plus the
 * research's exactLook in data/research/exact-looks.json, which the page never loads), then any
 * hand override in TRAIT_OVERRIDES is applied. Memorial cats (adoptables.json `memorial`) are
 * marked "memorial" and "gentle".
 *
 * Every value that is not an ordinary cat's carries a `why`: the words it was read from (quoted),
 * a reason ("kitten", "chunky", "big cat") or "hand" (see why.hand for the note). Review the file,
 * fix a wrong value with an override, and run this again whenever a cat is added or its words
 * change. Nothing here is random: the same words always give the same traits.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadResidents } from "../assets/residents.js";
import { deriveTraits, styleOf, TRAIT_KEYS } from "../assets/world/traits.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "data/traits.json";
const NOTE = "Each cat's character, read from its story, lore, caption and look sheets by assets/world/traits.js (and TRAIT_OVERRIDES), for how it moves in the garden. Numbers are 0..1, 0.5 = an ordinary adult cat. `why` gives the words behind every other value (\"hand\": see why.hand). Built by scripts/build-traits.mjs; do not edit by hand.";

const readJson = (root, rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));

/** The residents as the page loads them, read from `root`'s data files. */
export async function residentsOf(root = ROOT, nowMs = Math.max(Date.parse("2026-09-25T18:00:00Z"), Date.now())) {
  const fetchImpl = async (url) => {
    try { return new Response(fs.readFileSync(fileURLToPath(url)), { status: 200 }); } catch { return new Response("", { status: 404 }); }
  };
  const warn = console.warn;
  console.warn = () => {};
  try { return await loadResidents({ fetchImpl, base: pathToFileURL(root + path.sep), nowMs }); } finally { console.warn = warn; }
}

/** { note, cats: { id: traits with why } } for every resident, in the page's order. */
export async function buildTraits(root = ROOT) {
  const residents = await residentsOf(root);
  const captions = readJson(root, "data/lore.json").cats || {};
  const exact = readJson(root, "data/research/exact-looks.json").cats || {};
  const cats = {};
  for (const r of residents) {
    const caption = captions[r.ticker] ?? captions[r.id];
    const exactLook = (exact[r.ticker] ?? exact[r.id])?.exactLook || "";
    const t = deriveTraits(r, { caption, exactLook });
    const row = {};
    for (const k of [...TRAIT_KEYS, "age", "build", "legs", "size", "species", "scale", "flags", "signature", "avoid"]) if (t[k] !== undefined) row[k] = t[k];
    row.why = t.why;
    cats[r.id] = row;
  }
  return { note: NOTE, cats };
}

/** The file's text: one cat per line, so a review diff shows each cat's change on its own. */
export function formatTraits({ note, cats }) {
  const rows = Object.entries(cats).map(([id, row]) => `    ${JSON.stringify(id)}: ${JSON.stringify(row)}`);
  return `{\n  "note": ${JSON.stringify(note)},\n  "cats": {\n${rows.join(",\n")}\n  }\n}\n`;
}

/** A few cats of every kind, for the owner: their character in words and how they move. */
export const TABLE_CATS = ["JOCKCAT", "INGOTLOAF", "SKEINKIT", "MEREDITCAT", "CROOKSHNK", "CZELDA", "maneki", "michi", "CHOCOCACAT", "GRREAT", "NYANKOSEN", "tsuki", "MISTO", "PATCHPAW", "GENKITTY", "NERMALCAT", "AMRCAT", "HUBBUB", "TUBBSCAT", "TALLYSPOT"];

/** The traits in a few words ("sleepy, proud; chunky kitten"). */
export function describe(t) {
  const hi = { energy: "lively", sleepy: "sleepy", playful: "playful", bold: "bold", social: "affectionate", grumpy: "grumpy", proud: "proud", grace: "graceful", curious: "curious", hunter: "hunter", vocal: "chatty", foodie: "foodie" };
  const lo = { energy: "lazy", bold: "shy", social: "aloof", grace: "clumsy", playful: "serious" };
  const words = TRAIT_KEYS.map((k) => [k, t[k] - 0.5]).filter(([, d]) => Math.abs(d) >= 0.2).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([k, d]) => (d > 0 ? hi[k] : lo[k])).filter(Boolean).slice(0, 4);
  const body = [t.age !== "adult" && t.age, t.build !== "normal" && t.build, t.legs === "short" && "short legs", t.size !== "medium" && t.size, ...t.flags.filter((f) => f !== "gentle")].filter(Boolean);
  return [words.join(", ") || "ordinary", body.join(" "), t.signature && `sig ${t.signature}`].filter(Boolean).join("; ");
}

export function table({ cats }, ids = TABLE_CATS) {
  const pad = (s, n) => String(s).padEnd(n).slice(0, n);
  const lines = [`${pad("cat", 11)} ${pad("character", 66)} tempo stride lift  bob  sway crch  tail  head  sitT loafT scale`];
  for (const id of ids) {
    const t = cats[id];
    if (!t) continue;
    const s = styleOf(t);
    const f = (v) => pad(v.toFixed(2), 5);
    lines.push(`${pad(id, 11)} ${pad(describe(t), 66)} ${f(s.tempo)} ${f(s.stride)}  ${f(s.lift)}${f(s.bob)}${f(s.sway)}${f(s.crouch)}${f(s.tail)} ${f(s.head)} ${f(s.sitTall)}${f(s.loafTuck)}${f(s.scale)}`);
  }
  return lines.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const built = await buildTraits();
  const text = formatTraits(built);
  const file = path.join(ROOT, OUT);
  const old = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (process.argv.includes("--table")) console.log(table(built));
  else if (process.argv.includes("--check")) {
    if (old !== text) { console.error(`${OUT} is out of date: run node scripts/build-traits.mjs`); process.exit(1); }
    console.log(`${OUT} is up to date (${Object.keys(built.cats).length} cats)`);
  } else if (old === text) console.log(`${OUT} unchanged (${Object.keys(built.cats).length} cats, ${text.length} bytes)`);
  else { fs.writeFileSync(file, text); console.log(`wrote ${OUT}: ${Object.keys(built.cats).length} cats, ${text.length} bytes`); }
}
