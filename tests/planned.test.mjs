/* The planned cats: scripts/build-planned.mjs (sheets + research → data/planned.json and the
   portraits), the rules every planned cat and research row must pass, and the shipped files. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildPlanned, proofOf, isWebp, PlannedError, jpegInfo, serialize, stockRow, copiesACat, readHeld, tributeOf } from "../scripts/build-planned.mjs";
import { coatFromLook, coatFromSheet } from "../scripts/lib/coat.mjs";
import { validatePlanned, proofProblem, STOCK_PAIRS, coatProblem, pairByMint, tradeLinkProblem, TRIBUTE, tributeLine } from "../assets/collection.js";
import { ROOT, DATA_NOW } from "./helpers.mjs";

/* These tests read the shipped data: the real clock (tests/helpers.mjs DATA_NOW), not a frozen one. */
const NOW = DATA_NOW;
const PLANNED = JSON.parse(fs.readFileSync(path.join(ROOT, "data/planned.json"), "utf8"));
const INFO = JSON.parse(fs.readFileSync(path.join(ROOT, "data/cats-info.json"), "utf8"));
const HAS_PILLOW = spawnSync("python3", ["-c", "import PIL"]).status === 0;

/** A launch-sheet entry made from a shipped planned cat, with the internal fields a real sheet carries. */
function sheetEntry(ticker, extra = {}) {
  const c = PLANNED.cats.find((x) => x.ticker === ticker);
  return {
    order: 1, stock: "internal description of the stock", stonkfunSymbol: pairByMint(c.pair.mint).stonkfun, quoteMint: c.pair.mint,
    name: c.name, ticker: c.ticker, description: c.description, story: c.story, disclosure: "internal disclosure", look: c.look, whyLook: c.whyLook,
    basis: "INTERNAL NOTE: editor's reasoning", checks: "INTERNAL CHECKS", form: { website: "internal" }, notes: ["internal"],
    imageUrl: "https://d8j0ntlcm91z4.cloudfront.net/internal.png", imageJobId: "internal-job",
    imageJpg512: path.join(ROOT, c.portrait),
    ...(c.proof ? { proof: { ...c.proof, image: c.proof.image ? path.join(ROOT, c.proof.image) : null } } : {}),
    ...extra,
  };
}

function tempRoot(sheets) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "planned-"));
  fs.mkdirSync(path.join(root, "data"));
  fs.copyFileSync(path.join(ROOT, "data/cats-info.json"), path.join(root, "data/cats-info.json"));
  const paths = sheets.map((list, i) => {
    const p = path.join(root, `sheet-${i + 1}.json`);
    fs.writeFileSync(p, JSON.stringify(list));
    return p;
  });
  return { root, paths };
}
const readPlanned = (root) => JSON.parse(fs.readFileSync(path.join(root, "data/planned.json"), "utf8"));
const snapshot = (root) => {
  const out = {};
  for (const dir of ["data", "assets/portraits"]) {
    const d = path.join(root, dir);
    if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) out[`${dir}/${f}`] = fs.readFileSync(path.join(d, f)).toString("base64");
  }
  return out;
};

test("build: sheets + research make data/planned.json and the portraits; the sheets' internal notes are not published", () => {
  const { root, paths } = tempRoot([[sheetEntry("PATCHPAW"), sheetEntry("SAVEPAWS")]]);
  const r = buildPlanned({ root, sheets: paths, nowMs: NOW });
  assert.equal(r.cats, 2);
  assert.equal(r.stocks, 93);
  assert.deepEqual(r.written, { planned: true, portraits: ["PATCHPAW", "SAVEPAWS"], removed: [], proofImages: ["SAVEPAWS"], proofRemoved: [] });
  const out = readPlanned(root);
  assert.deepEqual(validatePlanned(out, { nowMs: NOW }).refused, []);
  assert.deepEqual(out.cats, PLANNED.cats.filter((c) => ["PATCHPAW", "SAVEPAWS"].includes(c.ticker)));
  assert.deepEqual(out.stocks, PLANNED.stocks);
  const text = fs.readFileSync(path.join(root, "data/planned.json"), "utf8");
  for (const secret of ["INTERNAL", "internal", "cloudfront", "imageJobId", "/tmp/"]) assert.ok(!text.includes(secret), secret);
  assert.equal(text, serialize(out));
  for (const t of ["PATCHPAW", "SAVEPAWS"]) {
    assert.deepEqual(fs.readFileSync(path.join(root, `assets/portraits/${t}.jpg`)), fs.readFileSync(path.join(ROOT, `assets/portraits/${t}.jpg`)));
  }
});

test("build: a re-run writes nothing; a sheet that is not there yet is skipped", () => {
  const { root, paths } = tempRoot([[sheetEntry("PATCHPAW")]]);
  buildPlanned({ root, sheets: paths, nowMs: NOW });
  const before = snapshot(root);
  const r = buildPlanned({ root, sheets: [...paths, path.join(root, "not-yet.json")], nowMs: NOW });
  assert.deepEqual(r.written, { planned: false, portraits: [], removed: [], proofImages: [], proofRemoved: [] });
  assert.deepEqual(r.skipped, [path.join(root, "not-yet.json")]);
  assert.deepEqual(snapshot(root), before);
});

test("build: it never drops a planned cat unless told to", () => {
  const { root, paths } = tempRoot([[sheetEntry("PATCHPAW"), sheetEntry("SAVEPAWS")], [sheetEntry("PATCHPAW")]]);
  buildPlanned({ root, sheets: [paths[0]], nowMs: NOW });
  const before = snapshot(root);
  assert.throws(() => buildPlanned({ root, sheets: [paths[1]], nowMs: NOW }), (e) => e instanceof PlannedError && /drop 1 planned cat \(SAVEPAWS\)/.test(e.message));
  assert.deepEqual(snapshot(root), before);
  const r = buildPlanned({ root, sheets: [paths[1]], allowDrop: true, nowMs: NOW });
  assert.deepEqual(r.dropped, ["SAVEPAWS"]);
  assert.ok(!fs.existsSync(path.join(root, "assets/portraits/SAVEPAWS.jpg")), "a dropped cat's portrait is removed");
  assert.deepEqual(readPlanned(root).cats.map((c) => c.ticker), ["PATCHPAW"]);
});

test("build: the pair is the sheet's mint (checked against the symbol), else the symbol's pair; OPENAI and KALSHI by the research's category", () => {
  const base = { ...sheetEntry("PATCHPAW"), ticker: "OAITEST", name: "Test Cat", imageJpg512: undefined, quoteMint: undefined, proof: undefined };
  const { root, paths } = tempRoot([[{ ...base, stonkfunSymbol: "OPENAI" }], [{ ...base, stonkfunSymbol: "OPENAI", pairMint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ" }],
    [{ ...base, stonkfunSymbol: "OPENAI", pairMint: "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc" }], [{ ...base, stonkfunSymbol: "DOGE" }], [{ ...base, stonkfunSymbol: "MU" }]]);
  buildPlanned({ root, sheets: [paths[0]], nowMs: NOW });
  assert.deepEqual(readPlanned(root).cats[0].pair, { symbol: "OPENAI", mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF" });
  assert.equal(readPlanned(root).cats[0].portrait, null);                 // no picture in the sheet: no portrait
  buildPlanned({ root, sheets: [paths[1]], nowMs: NOW });
  assert.deepEqual(readPlanned(root).cats[0].pair, { symbol: "tOpenAI", mint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ" });
  assert.throws(() => buildPlanned({ root, sheets: [paths[2]], nowMs: NOW }), /GMEX's, not OPENAI's/);
  assert.throws(() => buildPlanned({ root, sheets: [paths[3]], nowMs: NOW }), /DOGE is not one of the sanctuary's stock pairs/);
  buildPlanned({ root, sheets: [paths[4]], nowMs: NOW });
  assert.deepEqual(readPlanned(root).cats[0].pair, { symbol: "MU", mint: pairByMint("MUxEsUKSMACyw5fZf68wxf5FLnZVhtU9CwH8uNNGay1").mint });
});

test("build: bad sheets stop the run and write nothing", () => {
  const cases = [
    [[{ ...sheetEntry("PATCHPAW"), ticker: "patch paw" }], /ticker/],
    [[sheetEntry("PATCHPAW"), sheetEntry("PATCHPAW")], /twice/],
    [[{ ...sheetEntry("PATCHPAW"), name: "<img src=x onerror=alert(1)>" }], /would not validate.*name: markup/],
    [[{ ...sheetEntry("PATCHPAW"), story: "Visit <a href=x>here</a>" }], /would not validate.*story: markup/],
    [[{ ...sheetEntry("PATCHPAW"), look: "" }], /would not validate.*look: empty/],
    [[sheetEntry("PATCHPAW"), sheetEntry("WHISK100", { stonkfunSymbol: "SPYX", quoteMint: pairByMint("XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W").mint })], /already has a planned cat/],
  ];
  for (const [sheet, why] of cases) {
    const { root, paths } = tempRoot([sheet]);
    const before = snapshot(root);
    assert.throws(() => buildPlanned({ root, sheets: paths, nowMs: NOW }), why);
    assert.deepEqual(snapshot(root), before);
  }
});

test("build: a sheet's own coat wins over the look's words", () => {
  const { root, paths } = tempRoot([[sheetEntry("PATCHPAW", { coat: { base: "Orange", second: "white", pattern: "Mackerel tabby", eyes: "amber-gold" } })]]);
  buildPlanned({ root, sheets: paths, nowMs: NOW });
  const c = readPlanned(root).cats[0];
  assert.deepEqual([c.coat, c.coatFrom], [{ base: "ginger", second: "white", pattern: "tabby", eyes: "gold" }, "sheet"]);
});

test("build: a portrait that is not a 512 px JPEG is resized (Pillow) to one, with no metadata", { skip: !HAS_PILLOW && "python3 with Pillow is not installed" }, () => {
  const { root, paths: [png] } = tempRoot([[]]);
  const src = path.join(path.dirname(png), "big.png");
  const made = spawnSync("python3", ["-c", "import sys\nfrom PIL import Image\nImage.new('RGB', (900, 700), (200, 120, 60)).save(sys.argv[1])", src]);
  assert.equal(made.status, 0);
  fs.writeFileSync(png, JSON.stringify([sheetEntry("PATCHPAW", { imageJpg512: undefined, image: src })]));
  buildPlanned({ root, sheets: [png], nowMs: NOW });
  const info = jpegInfo(fs.readFileSync(path.join(root, "assets/portraits/PATCHPAW.jpg")));
  assert.deepEqual(info, { width: 512, height: 512, metadata: false });
});

test("rules: every research row and planned cat is checked field by field", () => {
  const ok = validatePlanned(PLANNED, { nowMs: NOW });
  assert.deepEqual(ok.refused, []);
  const stock = (i, f) => { const p = structuredClone(PLANNED); f(p.stocks[i]); return validatePlanned(p, { nowMs: NOW }).refused.find((r) => r.list === "stocks")?.detail ?? null; };
  const gme = PLANNED.stocks.findIndex((s) => s.stonkfun === "GMEX");
  assert.match(stock(gme, (s) => { s.links[0].url = "http://x.com/a"; }), /https/);
  assert.match(stock(gme, (s) => { s.links[0].url = "javascript:alert(1)"; }), /link/);
  assert.match(stock(gme, (s) => { delete s.virality[0].source; }), /virality/);
  assert.match(stock(gme, (s) => { s.virality[0].date = `${new Date(NOW).getUTCFullYear() + 2}-01-01`; }), /future/);
  assert.match(stock(gme, (s) => { s.virality[0].value = "<b>1M</b>"; }), /markup/);
  assert.match(stock(gme, (s) => { s.disclaimer = "The coin is not affiliated with GameStop Corp. or StonkFun."; }), /no intrinsic value/);
  assert.match(stock(gme, (s) => { s.disclaimer = "It has no intrinsic value and is not financial advice. Not affiliated with GameStop."; }), /StonkFun/);
  assert.match(stock(gme, (s) => { s.realCat.who = "<script>alert(1)</script>"; }), /markup/);
  assert.match(stock(gme, (s) => { s.buy = []; }), /unknown field buy/);
  assert.match(stock(gme, (s) => { s.category = "custom"; }), /category/);
  assert.match(stock(gme, (s) => { s.pair.mint = "So11111111111111111111111111111111111111112"; }), /stock pairs/);
  const cat = (f) => { const p = structuredClone(PLANNED); f(p.cats[0], p); return validatePlanned(p, { nowMs: NOW }).refused.find((r) => r.list === "cats") ?? null; };
  assert.match(cat((c) => { c.portrait = "../../etc/passwd"; }).detail, /portrait/);
  assert.match(cat((c) => { c.portrait = "https://evil.example/x.jpg"; }).detail, /portrait/);
  assert.match(cat((c) => { c.coat.base = "plaid"; }).detail, /coat/);
  assert.match(cat((c) => { c.ticker = "$PATCH"; }).detail, /ticker/);
  assert.match(cat((c) => { c.token = { status: "launched", mint: "EcB7LMNFXdSbzY4DQ6Uc9AKXmb9DCKqAeoNmLvNp3HvL" }; }).detail, /unknown field token/);
  assert.equal(cat((c, p) => { p.stocks = p.stocks.filter((s) => s.pair.mint !== c.pair.mint); }).clause, "no_research");
  assert.equal(cat((c, p) => { p.cats.push({ ...structuredClone(c), pair: { ...PLANNED.cats[1].pair } }); p.cats.splice(1, 1); }).clause, "duplicate");
  assert.equal(validatePlanned({ cats: [] }).refused[0].clause, "shape");
});

test("the shipped data/planned.json: valid, one research row per stock pair, every cat with its 512 px portrait", () => {
  assert.equal(fs.readFileSync(path.join(ROOT, "data/planned.json"), "utf8"), serialize(PLANNED));
  const v = validatePlanned(PLANNED, { nowMs: Date.now() });
  assert.deepEqual(v.refused, []);
  assert.equal(PLANNED.stocks.length, STOCK_PAIRS.length);
  const held = JSON.parse(fs.readFileSync(path.join(ROOT, "data/held.json"), "utf8")).held;
  assert.ok(PLANNED.cats.length + held.length >= 24, "launch sheet 1's 24 cats are planned or held back");
  for (const c of PLANNED.cats) {
    const bytes = fs.readFileSync(path.join(ROOT, c.portrait));
    assert.deepEqual(jpegInfo(bytes), { width: 512, height: 512, metadata: false }, c.ticker);
    assert.ok(bytes.length < 400_000, c.ticker);
    if (c.coatFrom === "look") assert.deepEqual(c.coat, coatFromLook(c.look), c.ticker);
  }
  const portraits = fs.readdirSync(path.join(ROOT, "assets/portraits")).sort();
  assert.deepEqual(portraits, PLANNED.cats.map((c) => `${c.ticker}.jpg`).sort(), "no portrait without a cat");
});

test("the shipped data/planned.json is up to date with the research in data/cats-info.json (else run scripts/build-planned.mjs)", () => {
  for (const s of PLANNED.stocks) {
    assert.deepEqual(s, stockRow(pairByMint(s.pair.mint), INFO[s.stonkfun]), s.stonkfun);
  }
});

test("coats from a look's words", () => {
  const cases = [
    ["A small calico house cat: patches of orange, black and white, bright green eyes.", { base: "white", second: "ginger", pattern: "calico", eyes: "green" }],
    ["A short-haired black-and-white tuxedo cat with pale eyes.", { base: "black", second: "white", pattern: "tuxedo", eyes: "" }],
    ["A slim colourpoint cat: a pale cream body with dark seal-brown points and bright blue eyes.", { base: "cream", second: "seal", pattern: "point", eyes: "blue" }],
    ["A round tortoiseshell cat, mottled black fur with amber patches, green eyes.", { base: "black", second: "amber", pattern: "tortie", eyes: "green" }],
    ["A fluffy all-white cat with odd eyes (one blue, one green).", { base: "white", second: "", pattern: "solid", eyes: "odd" }],
    ["A small ginger tabby kitten with a white chin. No clothes, no red-and-white colours.", { base: "ginger", second: "white", pattern: "tabby", eyes: "" }],
    ["A grey-and-white house cat with grey-green eyes.", { base: "grey", second: "white", pattern: "bicolour", eyes: "green" }],
  ];
  for (const [look, want] of cases) {
    const got = coatFromLook(look);
    assert.deepEqual(got, want, look);
    assert.equal(coatProblem(got), null);
  }
  assert.equal(coatFromSheet(null), null);
  assert.equal(coatFromSheet({ base: "plaid" }), null);
});

/* ── A cat drawn like a company's cat says so: a fan tribute, not affiliated ─────────────── */

const COPYING = "She is the grey tabby pixel cat that a company posted: dark bars on the cheeks, white chin.";
const TRIBUTE_LINE = tributeLine("Acme");

test("build: a cat whose whyLook says its picture follows or copies a company's cat must carry the fan-tribute line, or the run stops", () => {
  for (const why of [COPYING, "He copies the real cat in a company's blog post.", "She follows the white cat avatar in a car's update.", "The coin copies that cat."]) {
    const { root, paths } = tempRoot([[sheetEntry("PATCHPAW", { whyLook: why })]]);
    const before = snapshot(root);
    assert.throws(() => buildPlanned({ root, sheets: paths, nowMs: NOW }), (e) => e instanceof PlannedError && /Fan tribute to <Company>'s cat\. Not affiliated with or endorsed by <Company>\./.test(e.message), why);
    assert.deepEqual(snapshot(root), before);
  }
  // With the line in its description, the same cat is planned and carries the line as its tribute.
  const base = sheetEntry("PATCHPAW");
  const description = `${base.story} ${TRIBUTE_LINE} A cat coin priced in SPYx. Not affiliated with State Street or StonkFun. No intrinsic value; not financial advice.`;
  for (const extra of [{ whyLook: COPYING, description }, { whyLook: COPYING, description, tribute: TRIBUTE_LINE }]) {
    const { root, paths } = tempRoot([[sheetEntry("PATCHPAW", extra)]]);
    buildPlanned({ root, sheets: paths, nowMs: NOW });
    const cat = readPlanned(root).cats[0];
    assert.equal(cat.tribute, TRIBUTE_LINE);
    assert.ok(cat.description.includes(TRIBUTE_LINE));
  }
  // A tribute that is worded differently, names two companies, or is missing from the description stops the run.
  for (const extra of [
    { whyLook: COPYING, tribute: "A tribute to Acme's cat.", description },
    { whyLook: COPYING, tribute: "Fan tribute to Acme's cat. Not affiliated with or endorsed by Other.", description },
    { whyLook: COPYING, tribute: TRIBUTE_LINE },
  ]) {
    const { root, paths } = tempRoot([[sheetEntry("PATCHPAW", extra)]]);
    assert.throws(() => buildPlanned({ root, sheets: paths, nowMs: NOW }), PlannedError, JSON.stringify(extra));
  }
  assert.equal(copiesACat("No cat link was found. She is a honey-golden cat in the 'loaf' pose."), false);
  assert.equal(copiesACat("Only the coat and eye colour are used."), false);
  assert.equal(tributeOf({ description: "No tribute here." }), null);
  // Every shipped cat whose look follows a company's cat carries the line, in its description and as its tribute.
  for (const c of PLANNED.cats) {
    if (copiesACat(c.whyLook)) assert.match(c.tribute ?? "", TRIBUTE, c.ticker);
    if (c.tribute) assert.ok(c.description.includes(c.tribute), c.ticker);
  }
});

test("rules: a planned cat's tribute is the exact line, and its description carries it", () => {
  const c = structuredClone(PLANNED.cats[0]);
  const plan = (cat) => validatePlanned({ stocks: PLANNED.stocks, cats: [cat] }, { nowMs: NOW }).refused;
  assert.deepEqual(plan({ ...c, tribute: null }), []);
  assert.deepEqual(plan({ ...c, tribute: TRIBUTE_LINE, description: `${c.description} ${TRIBUTE_LINE}` }), []);
  assert.match(plan({ ...c, tribute: TRIBUTE_LINE })[0].detail, /description must carry/);
  assert.match(plan({ ...c, tribute: "Inspired by Acme.", description: `${c.description} Inspired by Acme.` })[0].detail, /tribute must read/);
});

test("build: a cat held in data/held.json is left out with its portrait, and is not counted as dropped", () => {
  const { root, paths } = tempRoot([[sheetEntry("PATCHPAW"), sheetEntry("SAVEPAWS", { whyLook: COPYING })]]);
  fs.writeFileSync(path.join(root, "data/held.json"), JSON.stringify({ held: [{ ticker: "SAVEPAWS", since: "2026-09-25", reason: "Its picture follows a company's cat." }] }));
  fs.mkdirSync(path.join(root, "assets/portraits"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "assets/portraits/SAVEPAWS.jpg"), path.join(root, "assets/portraits/SAVEPAWS.jpg"));
  const r = buildPlanned({ root, sheets: paths, nowMs: NOW });
  assert.deepEqual(readPlanned(root).cats.map((c) => c.ticker), ["PATCHPAW"]);
  assert.deepEqual(r.held, ["SAVEPAWS"]);
  assert.deepEqual(r.written.removed, ["SAVEPAWS"]);
  assert.ok(!fs.existsSync(path.join(root, "assets/portraits/SAVEPAWS.jpg")));
  assert.deepEqual(r.dropped, []);
  for (const bad of [{ held: [{ ticker: "savepaws", since: "2026-09-25", reason: "a long enough reason" }] }, { held: [{ ticker: "SAVEPAWS", reason: "a long enough reason" }] }, { hold: [] }]) {
    fs.writeFileSync(path.join(root, "data/held.json"), JSON.stringify(bad));
    assert.throws(() => readHeld(root), PlannedError);
  }
  // The owner ruled that the eight xStock cats look exactly like their companies' cats, as fan tributes.
  const shipped = readHeld(ROOT);
  assert.equal(shipped.size, 0);
  const companies = { MIGGLES: "Coinbase", PEWTER: "Robinhood", SNOWCURL: "Tesla", CAMTHECAT: "Berkshire Hathaway", COUCHCAP: "Meta", WARMSPOT: "SpaceX", SOCKFOOT: "NVIDIA", JELLIECAT: "Microsoft" };
  for (const [t, company] of Object.entries(companies)) {
    const cat = PLANNED.cats.find((c) => c.ticker === t);
    assert.ok(cat, `${t} is planned`);
    assert.ok(copiesACat(cat.whyLook), t);
    assert.equal(cat.tribute, tributeLine(company), t);
    assert.ok(cat.description.length <= 280 && cat.description.includes(cat.tribute), t);
  }
});

test("rules: research links are never trading pages; virality dates say what they are; an unconfirmed link is not the company's own", () => {
  const gme = PLANNED.stocks.findIndex((s) => s.stonkfun === "GMEX");
  const stock = (f) => { const p = structuredClone(PLANNED); f(p.stocks[gme]); return validatePlanned(p, { nowMs: NOW }).refused.find((r) => r.list === "stocks")?.detail ?? null; };
  for (const url of ["https://gmgn.ai/sol/token/EcB7LMNFXdSbzY4DQ6Uc9AKXmb9DCKqAeoNmLvNp3HvL", "https://pump.fun/coin/abc", "https://dexscreener.com/solana/abc", "https://www.birdeye.so/token/abc",
    "https://jup.ag/swap/SOL-abc", "https://raydium.io/swap", "https://fomo.family/tokens/solana/abc", "https://www.stonkfun.xyz/token/abc", "https://solscan.io/token/abc", "https://neo.bullx.io/terminal"]) {
    assert.match(stock((s) => { s.links[0].url = url; }) ?? "", /trading site|token or transaction page/, url);
    assert.match(stock((s) => { s.virality[0].source = url; }) ?? "", /trading site|token or transaction page/, url);
    assert.ok(tradeLinkProblem(url), url);
  }
  for (const url of ["https://www.coindesk.com/markets/2026/x", "https://www.stonkfun.xyz/developers", "https://solscan.io/", "https://x.com/a/status/1"]) assert.equal(tradeLinkProblem(url), null, url);
  assert.match(stock((s) => { delete s.virality[0].dateType; }), /dateType/);
  assert.match(stock((s) => { s.virality[0].dateType = "read"; }), /dateType/);
  assert.equal(stock((s) => { s.virality[0].dateType = "undated"; }), null);
  assert.match(stock((s) => { s.realCat.linkType = "official_post"; s.realCat.basis = "Reported official ad cat (unverified: the ad was not found)."; }), /not confirmed/);
  const crcl = PLANNED.stocks.find((s) => s.stonkfun === "CRCLX");
  assert.equal(crcl.realCat.linkType, "reported");
  for (const s of PLANNED.stocks) for (const v of s.virality) assert.ok(["measured", "as_of", "published", "undated"].includes(v.dateType), `${s.stonkfun}: ${v.label}`);
});

/* ── proof: the X post or page on each planned cat's card ───────────────────────────── */

const X_PROOF = { kind: "x", url: "https://x.com/Google/status/793168672571416576", author: "Google", handle: "Google", date: "2016-10-31", dateType: "posted", text: "Hi! I'm Momo.", note: "", image: null };
const WEB_PROOF = { kind: "web", url: "https://www.spdrgoldshares.com/", author: "World Gold Trust Services", handle: null, date: "2026-09-25", dateType: "opened", text: "Gold.", note: "", image: null };
const HOSTS = ["www.spdrgoldshares.com"];

test("proof: every shipped planned cat has a valid proof, X proofs are status posts by their handle, pictures exist and are small WebP", () => {
  assert.equal(PLANNED.cats.length, 24);
  for (const c of PLANNED.cats) {
    assert.ok(c.proof, `${c.ticker} has a proof`);
    const stock = PLANNED.stocks.find((s) => s.pair.mint === c.pair.mint);
    const hosts = stock.links.map((l) => new URL(l.url).hostname);
    assert.equal(proofProblem(c.proof, { ticker: c.ticker, hosts, nowMs: NOW }), null, c.ticker);
    if (c.proof.kind === "web") assert.ok(c.proof.note, `${c.ticker}: a web proof says why it is not an X post`);
    if (c.proof.image) {
      const b = fs.readFileSync(path.join(ROOT, c.proof.image));
      assert.ok(isWebp(b) && b.length <= 80_000, c.ticker);
    }
  }
  const files = fs.readdirSync(path.join(ROOT, "assets/proof"));
  assert.deepEqual(files.sort(), PLANNED.cats.filter((c) => c.proof.image).map((c) => `${c.ticker}.webp`).sort());
});

test("proof: the rules refuse what is not a real post or a recorded source", () => {
  const ok = (p, o = {}) => proofProblem(p, { ticker: "MOMOTHECAT", hosts: HOSTS, nowMs: NOW, ...o });
  assert.equal(ok(X_PROOF), null);
  assert.equal(ok({ ...X_PROOF, url: "https://twitter.com/Google/status/793168672571416576" }), null);
  assert.equal(ok(WEB_PROOF), null);
  assert.match(ok({ ...X_PROOF, url: "http://x.com/Google/status/793168672571416576" }), /https/);
  assert.match(ok({ ...X_PROOF, url: "https://x.com.evil.io/Google/status/793168672571416576" }), /x\.com or twitter\.com/);
  assert.match(ok({ ...X_PROOF, url: "https://x.com/Google" }), /status/);
  assert.match(ok({ ...X_PROOF, url: "https://x.com/Google/status/793168672571416576?s=20" }), /query/);
  assert.match(ok({ ...X_PROOF, handle: "NotGoogle" }), /not by its handle/);
  assert.match(ok({ ...X_PROOF, dateType: "opened" }), /posted/);
  assert.match(ok({ ...WEB_PROOF, url: "https://example.com/page" }), /host the research records/);
  assert.match(ok({ ...WEB_PROOF, url: "https://x.com/Google/status/1" }), /kind x/);
  assert.match(ok({ ...WEB_PROOF, kind: "blog" }), /kind/);
  assert.match(ok({ ...X_PROOF, date: "2099-01-01" }), /future/);
  assert.match(ok({ ...X_PROOF, date: "2016" }), /YYYY-MM-DD/);
  assert.match(ok({ ...X_PROOF, text: "" }), /empty only when/);
  assert.equal(ok({ ...X_PROOF, text: "", image: "assets/proof/MOMOTHECAT.webp" }), null);
  assert.match(ok({ ...X_PROOF, image: "https://pbs.twimg.com/a.jpg" }), /assets\/proof/);
  assert.match(ok({ ...X_PROOF, text: "<script>x</script>" }), /markup/);
  assert.match(ok({ ...X_PROOF, extra: 1 }), /unknown field/);
});

test("proof: a bad proof in a sheet stops the build and writes nothing", () => {
  const { root, paths } = tempRoot([[sheetEntry("PATCHPAW", { proof: { ...WEB_PROOF, url: "https://example.com/" } })]]);
  assert.throws(() => buildPlanned({ root, sheets: paths, nowMs: NOW }), (e) => e instanceof PlannedError && /host the research records/.test(e.message));
  assert.ok(!fs.existsSync(path.join(root, "data/planned.json")));
  const png = path.join(root, "x.png");
  fs.writeFileSync(png, Buffer.from("89504e470d0a1a0a", "hex"));
  assert.throws(() => proofOf({ ticker: "MOMOTHECAT", proof: { ...X_PROOF, image: png } }), /not a WebP/);
  assert.throws(() => proofOf({ ticker: "MOMOTHECAT", proof: { ...X_PROOF, image: "/nope.webp" } }), /does not exist/);
  assert.throws(() => proofOf({ ticker: "MOMOTHECAT", proof: { ...X_PROOF, secret: 1 } }), /unknown field/);
  assert.deepEqual(proofOf({ ticker: "A1", proof: { ...X_PROOF, handle: "@Google", text: "  a\n b " } }).proof.handle, "Google");
  assert.equal(proofOf({ ticker: "A1" }).proof, null);
});

test("proof: a proof picture whose cat has no proof picture any more is removed", () => {
  const { root, paths } = tempRoot([[sheetEntry("SAVEPAWS")]]);
  buildPlanned({ root, sheets: paths, nowMs: NOW });
  assert.ok(fs.existsSync(path.join(root, "assets/proof/SAVEPAWS.webp")));
  fs.writeFileSync(paths[0], JSON.stringify([sheetEntry("SAVEPAWS", { proof: { ...PLANNED.cats.find((c) => c.ticker === "SAVEPAWS").proof, image: null, text: "A picture." } })]));
  const r = buildPlanned({ root, sheets: paths, nowMs: NOW });
  assert.deepEqual(r.written.proofRemoved, ["SAVEPAWS"]);
  assert.ok(!fs.existsSync(path.join(root, "assets/proof/SAVEPAWS.webp")));
});
