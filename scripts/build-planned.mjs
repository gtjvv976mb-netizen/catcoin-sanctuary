#!/usr/bin/env node
/**
 * BUILDS data/planned.json: the sanctuary's planned cats, one per stock, from the launch sheets,
 * plus the sourced research on each stock's real cat (data/cats-info.json), and copies each
 * cat's portrait to assets/portraits/<TICKER>.jpg at 512 × 512.
 *
 *   node scripts/build-planned.mjs <launch-sheet.json> [<launch-sheet.json> …] [--allow-drop]
 *   PLANNED_SHEETS=<a.json>:<b.json> node scripts/build-planned.mjs
 *
 * Run it again whenever a sheet or the research changes; it writes only what changed. A sheet
 * that does not exist yet is skipped with a note. It never drops a cat that data/planned.json
 * already has unless --allow-drop is given, so running it with one sheet missing cannot empty
 * the garden by accident.
 *
 * A launch sheet is a JSON list of entries: { stonkfunSymbol, name, ticker, description, look,
 * story?, whyLook?, tribute?, coat?: { base, second, pattern, eyes }, image?, imageJpg512?, quoteMint? |
 * pairMint? }. The pair is the sheet's mint when it names one (it must be one of the stock pairs
 * in assets/collection.js, for that StonkFun symbol), else the stock pair with that StonkFun
 * symbol (for a symbol StonkFun lists twice, OPENAI and KALSHI, the category the research names).
 *
 * WHAT IS PUBLISHED. From a sheet: the cat's name, ticker, story (or its description), the
 * description as launched, the look (the text its portrait was drawn from), whyLook and the
 * portrait. A sheet's internal notes (basis, checks, form, image URLs and job ids) are not.
 * From the research, per stock pair: the company, who the real cat is (with its basis, link type
 * and strength), every link with its date, every virality figure with its source, date and
 * method, the day it was checked and the card's disclaimer. Nothing is added: a stock with no
 * virality figure has an empty list, and the page says "Not measured".
 *
 * The coat (for the 3D model) is the sheet's own coat when it has one, else read from the look's
 * words (scripts/lib/coat.mjs). Resizing a portrait that is not already a 512 px JPEG needs
 * python3 with Pillow; a sheet's ready-made 512 px JPEG is copied as it is.
 *
 * A CAT DRAWN LIKE A COMPANY'S CAT SAYS SO. A cat whose whyLook says its picture follows, copies or
 * "is the" cat of a company or a post (or whose sheet entry has a `tribute`) must carry the line
 * "Fan tribute to <Company>'s cat. Not affiliated with or endorsed by <Company>." in its
 * description; it is published as the cat's `tribute` and shown on its card. Without it the run
 * stops. A cat listed in data/held.json is still left out (with its portrait). A portrait file
 * whose cat is no longer planned is removed.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { STOCK_PAIRS, pairByMint, validatePlanned, TICKER, TRIBUTE } from "../assets/collection.js";
import { coatFromLook, coatFromSheet } from "./lib/coat.mjs";

export class PlannedError extends Error { constructor(message) { super(message); this.name = "PlannedError"; } }

export const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const PORTRAIT_SIZE = 512;
export const PORTRAIT_MAX_BYTES = 400_000;

function writeIfChanged(file, bytes) {
  let old = null;
  try { old = fs.readFileSync(file); } catch { /* new file */ }
  if (old && Buffer.compare(old, Buffer.from(bytes)) === 0) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, bytes);
  fs.renameSync(tmp, file);
  return true;
}

/** A JPEG's size and whether it carries metadata segments (EXIF/XMP APP1, comments), or null if it is not a JPEG. */
export function jpegInfo(buf) {
  const b = Buffer.from(buf);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let o = 2, width = null, height = null, metadata = false;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) return null;
    const marker = b[o + 1];
    if (marker === 0xd9 || marker === 0xda) break;                      // end, or start of scan
    const len = b.readUInt16BE(o + 2);
    if (len < 2 || o + 2 + len > b.length) return null;
    if (marker === 0xe1 || marker === 0xfe || (marker >= 0xe2 && marker <= 0xef && marker !== 0xee)) metadata = true;
    if ([0xc0, 0xc1, 0xc2].includes(marker) && len >= 7) { height = b.readUInt16BE(o + 5); width = b.readUInt16BE(o + 7); }
    o += 2 + len;
  }
  return width && height ? { width, height, metadata } : null;
}

/** A square 512 px JPEG made from `source` with Pillow (centre-cropped, no metadata). */
function resizeWithPillow(source) {
  const code = [
    "import sys, io",
    "from PIL import Image",
    "im = Image.open(sys.argv[1]); im.load(); im = im.convert('RGB')",
    "w, h = im.size; s = min(w, h)",
    "im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((512, 512), Image.LANCZOS)",
    "out = io.BytesIO(); im.save(out, 'JPEG', quality=86, optimize=True); sys.stdout.buffer.write(out.getvalue())",
  ].join("\n");
  const r = spawnSync("python3", ["-c", code, source], { maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) throw new PlannedError(`could not resize ${path.basename(source)} (python3 with Pillow is needed): ${String(r.stderr || r.error).slice(0, 200)}`);
  return r.stdout;
}

/** The bytes of a cat's 512 px portrait, from its sheet entry, or null when the sheet names no picture that exists. */
export function portraitBytes(entry) {
  for (const p of [entry.imageJpg512, entry.image]) {
    if (typeof p !== "string" || !p || !fs.existsSync(p)) continue;
    const bytes = fs.readFileSync(p);
    const info = jpegInfo(bytes);
    const out = info && info.width === PORTRAIT_SIZE && info.height === PORTRAIT_SIZE && !info.metadata ? bytes : resizeWithPillow(p);
    const check = jpegInfo(out);
    if (!check || check.width !== PORTRAIT_SIZE || check.height !== PORTRAIT_SIZE) throw new PlannedError(`${entry.ticker}: the portrait did not come out as a ${PORTRAIT_SIZE} px JPEG`);
    if (out.length > PORTRAIT_MAX_BYTES) throw new PlannedError(`${entry.ticker}: the portrait is ${out.length} bytes, more than ${PORTRAIT_MAX_BYTES}`);
    return out;
  }
  return null;
}

/** Words in a whyLook that say the picture reproduces a particular cat (a company's, a post's). */
const COPIES = /\b(follows|copies|copied|reproduces|traced from)\b|\b(she|he|it)\s+is\s+the\b/i;

/** Whether a cat's whyLook says its picture reproduces a particular existing cat. */
export const copiesACat = (whyLook) => COPIES.test(String(whyLook ?? ""));

/** The fan-tribute line in a sheet entry (its `tribute`, or the one in its description), or null. */
export function tributeOf(entry) {
  if (typeof entry.tribute === "string" && entry.tribute.trim()) return entry.tribute.trim();
  const m = /Fan tribute to (.{2,80}?)'s cat\. Not affiliated with or endorsed by \1\./.exec(String(entry.description ?? ""));
  return m ? m[0] : null;
}

/** data/held.json: { note?, held: [{ ticker, since, reason }] } → Map ticker → reason. A missing file holds nothing. */
export function readHeld(root) {
  const file = path.join(root, "data/held.json");
  if (!fs.existsSync(file)) return new Map();
  let data;
  try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch { throw new PlannedError("data/held.json is not valid JSON"); }
  const ok = data && typeof data === "object" && Array.isArray(data.held) && Object.keys(data).every((k) => ["note", "held"].includes(k));
  if (!ok) throw new PlannedError("data/held.json must be { note?, held: [{ ticker, since, reason }] }");
  const held = new Map();
  for (const h of data.held) {
    if (!h || typeof h !== "object" || Object.keys(h).some((k) => !["ticker", "since", "reason"].includes(k))) throw new PlannedError("a data/held.json row must be { ticker, since, reason }");
    if (typeof h.ticker !== "string" || !TICKER.test(h.ticker)) throw new PlannedError(`data/held.json: ${JSON.stringify(h.ticker)} is not a ticker`);
    if (typeof h.reason !== "string" || h.reason.trim().length < 10) throw new PlannedError(`data/held.json: ${h.ticker} needs a reason`);
    if (typeof h.since !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(h.since)) throw new PlannedError(`data/held.json: ${h.ticker}'s since must be YYYY-MM-DD`);
    held.set(h.ticker, h.reason.trim());
  }
  return held;
}

/** The stock pair a sheet entry is priced in. */
export function pairFor(entry, research) {
  const sym = entry.stonkfunSymbol;
  const named = entry.pairMint ?? entry.quoteMint;
  if (named !== undefined) {
    const row = pairByMint(named);
    if (!row) throw new PlannedError(`${entry.ticker}: its pair mint is not one of the sanctuary's stock pairs`);
    if (row.stonkfun !== sym) throw new PlannedError(`${entry.ticker}: its pair mint is ${row.stonkfun}'s, not ${sym}'s`);
    return row;
  }
  const rows = STOCK_PAIRS.filter((p) => p.stonkfun === sym);
  if (rows.length === 0) throw new PlannedError(`${entry.ticker}: ${sym} is not one of the sanctuary's stock pairs`);
  if (rows.length === 1) return rows[0];
  const want = research[sym]?.category ?? "prestock";
  const row = rows.find((p) => p.category === want);
  if (!row) throw new PlannedError(`${entry.ticker}: ${sym} is listed twice and the research names neither`);
  return row;
}

/** One stock pair's research row (data/planned.json `stocks`), from its data/cats-info.json entry. */
export function stockRow(pair, info) {
  const company = String(info.company ?? "").trim();
  return {
    pair: { symbol: pair.symbol, mint: pair.mint },
    stonkfun: pair.stonkfun,
    category: pair.category,
    company,
    realCat: {
      name: info.realCatName ?? null,
      who: String(info.who ?? "").trim(),
      basis: String(info.basis ?? "").trim(),
      linkType: info.linkType,
      strength: info.strength,
      linked: info.realCatLink === true,
    },
    links: (info.links ?? []).map((l) => ({ label: l.label, url: l.url, date: l.date, dateType: l.dateType, ...(l.opened !== undefined ? { opened: l.opened } : {}) })),
    virality: (info.virality ?? []).map((v) => ({ label: v.label, value: v.value, source: v.source, date: v.date, dateType: v.dateType, method: v.method })),
    checked: info.checked,
    disclaimer: String(info.disclaimer ?? "").trim()
      || `The coin is not affiliated with ${company} or StonkFun. It has no intrinsic value and is not financial advice.`,
  };
}

/** The story a sheet gives, or its description without the disclosure at its end. */
function storyOf(entry) {
  if (typeof entry.story === "string" && entry.story.trim()) return entry.story.trim();
  const d = String(entry.description ?? "").trim();
  const disclosure = String(entry.disclosure ?? "").trim();
  return disclosure && d.endsWith(disclosure) && d.length > disclosure.length ? d.slice(0, -disclosure.length).trim() : d;
}

/**
 * One run. `sheets` are paths; `root` is the site folder. Returns
 * { planned, written: { planned, portraits: [ticker] }, skipped: [path], cats, stocks }.
 */
export function buildPlanned({ root, sheets, allowDrop = false, nowMs = Date.now(), log = () => {} }) {
  const research = JSON.parse(fs.readFileSync(path.join(root, "data/cats-info.json"), "utf8"));
  const entries = [], skipped = [];
  for (const file of sheets) {
    if (!fs.existsSync(file)) { skipped.push(file); log(`${file}: not there yet, skipped.`); continue; }
    let list;
    try { list = JSON.parse(fs.readFileSync(file, "utf8")); } catch { throw new PlannedError(`${file} is not valid JSON`); }
    if (!Array.isArray(list)) throw new PlannedError(`${file} is not a list of entries`);
    log(`${file}: ${list.length} ${list.length === 1 ? "cat" : "cats"}.`);
    entries.push(...list);
  }

  const stocks = STOCK_PAIRS.filter((p) => research[p.stonkfun]).map((p) => stockRow(p, research[p.stonkfun]));
  const held = readHeld(root);
  const cats = [], portraits = new Map(), heldBack = [];
  for (const e of entries) {
    if (!e || typeof e !== "object") throw new PlannedError("a sheet entry is not an object");
    if (typeof e.ticker !== "string" || !TICKER.test(e.ticker)) throw new PlannedError(`a sheet entry has the ticker ${JSON.stringify(e.ticker)}, not 2 to 10 capital letters or digits`);
    if (cats.some((c) => c.ticker === e.ticker) || heldBack.includes(e.ticker)) throw new PlannedError(`${e.ticker} is in the sheets twice`);
    if (held.has(e.ticker)) { heldBack.push(e.ticker); log(`${e.ticker}: held back (data/held.json): ${held.get(e.ticker)}`); continue; }
    const tribute = tributeOf(e);
    if (tribute !== null && (!TRIBUTE.test(tribute) || !String(e.description ?? "").includes(tribute))) {
      throw new PlannedError(`${e.ticker}: its tribute must read "Fan tribute to <Company>'s cat. Not affiliated with or endorsed by <Company>." and appear in its description; nothing was written`);
    }
    if (copiesACat(e.whyLook) && tribute === null) {
      throw new PlannedError(`${e.ticker}: its whyLook says its picture follows or copies a particular cat ("${String(e.whyLook).slice(0, 90)}…"), so its description must say "Fan tribute to <Company>'s cat. Not affiliated with or endorsed by <Company>."; nothing was written`);
    }
    const pair = pairFor(e, research);
    const fromSheet = coatFromSheet(e.coat);
    const bytes = portraitBytes(e);
    if (bytes) portraits.set(e.ticker, bytes);
    else log(`${e.ticker}: no portrait yet.`);
    cats.push({
      ticker: e.ticker,
      name: String(e.name ?? "").trim(),
      pair: { symbol: pair.symbol, mint: pair.mint },
      story: storyOf(e),
      description: String(e.description ?? "").trim(),
      look: String(e.look ?? "").trim(),
      whyLook: String(e.whyLook ?? "").trim(),
      tribute,
      portrait: bytes ? `assets/portraits/${e.ticker}.jpg` : null,
      coat: fromSheet ?? coatFromLook(e.look),
      coatFrom: fromSheet ? "sheet" : "look",
    });
  }

  const planned = { stocks, cats };
  const check = validatePlanned(planned, { nowMs });
  if (check.refused.length) {
    const r = check.refused[0];
    const who = r.list === "cats" ? cats[r.index]?.ticker : r.list === "stocks" ? stocks[r.index]?.stonkfun : "";
    throw new PlannedError(`data/planned.json would not validate (${r.list ?? "file"} ${who ?? ""}: ${r.detail}); nothing was written`);
  }

  const file = path.join(root, "data/planned.json");
  let before = null;
  try { before = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* first run */ }
  const dropped = (before?.cats ?? []).map((c) => c.ticker).filter((t) => !cats.some((c) => c.ticker === t) && !held.has(t));
  if (dropped.length && !allowDrop) {
    throw new PlannedError(`this run would drop ${dropped.length} planned ${dropped.length === 1 ? "cat" : "cats"} (${dropped.slice(0, 5).join(", ")}${dropped.length > 5 ? ", …" : ""}); give every sheet, or --allow-drop; nothing was written`);
  }

  const written = { planned: false, portraits: [], removed: [] };
  for (const [ticker, bytes] of portraits) {
    if (writeIfChanged(path.join(root, "assets/portraits", `${ticker}.jpg`), bytes)) written.portraits.push(ticker);
  }
  // A portrait whose cat is not planned (held back, or dropped) is not published.
  const dir = path.join(root, "assets/portraits");
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      const m = /^([A-Z0-9]{2,10})\.jpg$/.exec(f);
      if (m && !cats.some((c) => c.ticker === m[1] && c.portrait)) { fs.rmSync(path.join(dir, f)); written.removed.push(m[1]); }
    }
  }
  written.planned = writeIfChanged(file, serialize(planned));
  return { planned, written, skipped, held: heldBack, cats: cats.length, stocks: stocks.length, dropped };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const allowDrop = args.includes("--allow-drop");
  const sheets = args.filter((a) => a !== "--allow-drop");
  if (!sheets.length && process.env.PLANNED_SHEETS) sheets.push(...process.env.PLANNED_SHEETS.split(":").filter(Boolean));
  if (!sheets.length) { console.error("Name the launch sheets: node scripts/build-planned.mjs <sheet.json> [<sheet.json> …]"); process.exitCode = 2; return; }
  try {
    const r = buildPlanned({ root, sheets, allowDrop, log: (m) => console.log(m) });
    console.log(`${r.cats} planned ${r.cats === 1 ? "cat" : "cats"}, research for ${r.stocks} stock pairs.`);
    if (r.dropped.length) console.log(`Dropped (--allow-drop): ${r.dropped.join(", ")}.`);
    console.log(r.written.planned ? "Wrote data/planned.json." : "data/planned.json is unchanged.");
    console.log(r.written.portraits.length ? `Wrote ${r.written.portraits.length} portraits.` : "No portrait changed.");
    if (r.held.length) console.log(`Held back (data/held.json): ${r.held.join(", ")}.`);
    if (r.written.removed.length) console.log(`Removed the portraits of cats that are not planned: ${r.written.removed.join(", ")}.`);
  } catch (e) {
    if (!(e instanceof PlannedError)) throw e;
    console.error(`The planned cats were not updated: ${e.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
