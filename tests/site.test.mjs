/* The site as a whole, read from the folder that is published: every file the page loads is on
   this site (nothing is fetched from another host), every file it names exists, the first view
   stays within its weight budget, every planned cat's card and list entry says "Not launched yet",
   and buy links (GMGN, FOMO) appear only on a launched cat's card, only for its own mint.
   The cards are rendered with a small stand-in DOM (tests/minidom.mjs), through the same code the
   page runs (assets/residents.js, assets/ui/data.js, assets/ui/card.js, assets/ui/finder.js). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import { ROOT, GME_LAUNCHER, GME_LAUNCH, DATA_NOW } from "./helpers.mjs";
import { installDom, Element } from "./minidom.mjs";
import { loadResidents } from "../assets/residents.js";
import { normalize } from "../assets/ui/data.js";
import { createCard, badgeFor } from "../assets/ui/card.js";
import { createFinder } from "../assets/ui/finder.js";
import { jpegInfo } from "../scripts/build-planned.mjs";

const SITE = "https://catcoinsanctuary.com/";
/* These tests read the shipped data: the real clock (tests/helpers.mjs DATA_NOW), not a frozen one. */
const NOW = DATA_NOW;
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(ROOT, rel)) && fs.statSync(path.join(ROOT, rel)).isFile();
const size = (rel) => fs.statSync(path.join(ROOT, rel)).size;
const INDEX = read("index.html");
const PLANNED = JSON.parse(read("data/planned.json"));

/* ── What the page loads ─────────────────────────────────────────────────────────────── */

const IMPORT_MAP = JSON.parse(INDEX.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;

/** A module specifier, resolved to a path in the site folder (or null for another host). */
function resolveModule(spec, fromRel) {
  if (/^[a-z]+:/i.test(spec) || spec.startsWith("//")) return null;
  let target = spec;
  if (!spec.startsWith(".") && !spec.startsWith("/")) {
    const key = Object.keys(IMPORT_MAP).filter((k) => (k.endsWith("/") ? spec.startsWith(k) : spec === k)).sort((a, b) => b.length - a.length)[0];
    assert.ok(key, `${fromRel} imports ${spec}, which the import map does not name`);
    target = IMPORT_MAP[key] + spec.slice(key.length);
    return path.posix.normalize(target.replace(/^\.\//, ""));
  }
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
}

/** Every module the page runs, from its entry script, with static and dynamic imports followed. */
function moduleGraph() {
  const entry = INDEX.match(/<script type="module" src="([^"]+)"><\/script>/)[1];
  const seen = new Set(), todo = [entry];
  while (todo.length) {
    const rel = todo.pop();
    if (seen.has(rel)) continue;
    assert.ok(exists(rel), `a module the page runs is missing: ${rel}`);
    seen.add(rel);
    const text = read(rel);
    const specs = [
      ...[...text.matchAll(/\b(?:import|export)\s[^'"`;]*?\bfrom\s*["']([^"']+)["']/g)].map((m) => m[1]),
      ...[...text.matchAll(/\bimport\s*["']([^"']+)["']/g)].map((m) => m[1]),
      ...[...text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]),
    ];
    for (const s of specs) {
      const r = resolveModule(s, rel);
      assert.ok(r, `${rel} imports from another host: ${s}`);
      todo.push(r);
    }
  }
  return [...seen].sort();
}

/** The files the page itself names in index.html (head links, scripts), relative to the site. */
function indexRefs() {
  const refs = [];
  for (const m of INDEX.matchAll(/<(link|script|img)\b([^>]*)>/g)) {
    const attrs = m[2];
    const rel = /\brel="([^"]+)"/.exec(attrs)?.[1] ?? "";
    const url = /\b(?:href|src)="([^"]+)"/.exec(attrs)?.[1];
    if (!url || rel === "canonical") continue;
    refs.push({ tag: m[1], rel, url });
  }
  for (const target of Object.values(IMPORT_MAP)) refs.push({ tag: "importmap", rel: "", url: target });
  return refs;
}

const CSS_URLS = [...read("assets/site.css").matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]);
const MODELS = ["assets/models/sanctuary.glb", ...["cat", "ginger"].flatMap((c) => ["sit", "walk", "loaf", "stretch", "sleep"].map((p) => `assets/models/${c}-${p}.glb`))];
const DATA = ["data/planned.json", "data/collection.json", "data/wallets.json"];

/** The first view: the page, its stylesheet and fonts, every module, the models and the data. Portraits load later, one card or list row at a time. */
function firstView() {
  const files = new Set(["index.html"]);
  for (const r of indexRefs()) if (!/^https?:/.test(r.url)) files.add(path.posix.normalize(r.url.replace(/^\.\//, "")));
  for (const u of CSS_URLS) files.add(path.posix.join("assets", u));
  for (const m of moduleGraph()) files.add(m);
  for (const f of [...MODELS, ...DATA]) files.add(f);
  return [...files].filter((f) => !f.endsWith("/")).sort();
}

/* ── Rendering a card as a visitor sees it ───────────────────────────────────────────── */

const localFetch = async (url) => {
  const file = fileURLToPath(url);
  assert.ok(file.startsWith(`${ROOT}${path.sep}data${path.sep}`), `the page asked for ${file}`);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file), { status: 200 }) : new Response("not found", { status: 404 });
};
const BASE = pathToFileURL(`${ROOT}/`);

/** The real GMEx StonkFun launch (tests/fixtures), its symbol set to a planned cat's ticker, as a launched sample. */
const GME = Object.freeze({
  mint: "EcB7LMNFXdSbzY4DQ6Uc9AKXmb9DCKqAeoNmLvNp3HvL", name: "Save Point the Tabby", symbol: "SAVEPAWS",
  pair: { symbol: "GMEx", mint: "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc" }, pool: "2un6cyq4X2fMdgevvUSpcueiX1ER2CxRjsPxNMNkHcFz",
  payer: GME_LAUNCHER, tx: GME_LAUNCH, time: "2026-09-24T20:57:15Z",
});

/** The residents as the page gets them: loaded by assets/residents.js, checked by assets/ui/data.js. */
async function residents({ collection } = {}) {
  const fetchImpl = collection
    ? async (url) => {
      const rel = new URL(url).pathname.split("/").slice(-2).join("/");
      if (rel === "data/collection.json") return new Response(JSON.stringify(collection), { status: 200 });
      if (rel === "data/wallets.json") return new Response(JSON.stringify({ launchers: [{ address: GME_LAUNCHER, since: "2026-09-01", label: "sample" }] }), { status: 200 });
      return localFetch(url);
    }
    : localFetch;
  const list = await loadResidents({ fetchImpl, base: BASE, nowMs: NOW });
  return list.map(normalize).filter(Boolean);
}

/** A card, rendered: its text, its links and its buy buttons. */
function renderCard(r) {
  const root = new Element("aside");
  const card = createCard({ root, onClose() {}, onInset() {} });
  card.open(r, { focus: false });
  const anchors = root.querySelectorAll("a");
  return {
    root,
    text: root.textContent,
    section: (id) => root.querySelectorAll("section").find((s) => s.getAttribute("aria-labelledby") === id)?.textContent ?? "",
    links: anchors.map((a) => ({ href: a.href, text: a.textContent, target: a.target, rel: a.rel, cls: a.className })),
    buy: anchors.filter((a) => a.classList.contains("btn-buy")).map((a) => ({ href: a.href, text: a.textContent })),
    disclaimer: root.querySelector("p.card-disclaimer")?.textContent ?? "",
  };
}

let removeDom;
test.before(() => { removeDom = installDom(); });
test.after(() => removeDom?.());

/* ── The tests ───────────────────────────────────────────────────────────────────────── */

test("nothing the page loads comes from another host", () => {
  for (const r of indexRefs()) assert.ok(!/^(https?:)?\/\//.test(r.url), `index.html loads ${r.url} from another host`);
  for (const u of CSS_URLS) assert.ok(!/^(https?:)?\/\/|^data:/.test(u), `site.css loads ${u}`);
  moduleGraph();                                                  // asserts every import is local
  // The only absolute URLs in the head are the page's own address, for sharing (never loaded by the page).
  for (const m of INDEX.matchAll(/<(?:meta|link)\b[^>]*\b(?:content|href)="(https?:\/\/[^"]+)"/g)) assert.ok(m[1].startsWith(SITE), `the head names ${m[1]}`);
  // In the page's own scripts, a web address is only ever an outbound link (buy and explorer pages) or a comment.
  const OUTBOUND = new Set(["gmgn.ai", "fomo.family", "solscan.io", "www.stonkfun.xyz"]);
  for (const rel of moduleGraph().filter((m) => !m.includes("/vendor/"))) {
    const code = read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
    for (const m of code.matchAll(/https?:\/\/([^/"'`\s$)]+)/g)) assert.ok(OUTBOUND.has(m[1]), `${rel} names ${m[0]}`);
  }
  // The models carry everything inside them (no external buffers or images).
  for (const rel of MODELS) {
    const b = fs.readFileSync(path.join(ROOT, rel));
    assert.equal(b.toString("latin1", 0, 4), "glTF", rel);
    const json = JSON.parse(b.toString("utf8", 20, 20 + b.readUInt32LE(12)));
    for (const x of [...(json.buffers ?? []), ...(json.images ?? [])]) assert.ok(x.uri === undefined || x.uri.startsWith("data:"), `${rel} points to ${x.uri}`);
  }
  // Portraits are pictures on this site.
  for (const c of PLANNED.cats) if (c.portrait) assert.match(c.portrait, /^assets\/portraits\/[A-Z0-9]{2,10}\.jpg$/, c.ticker);
});

test("the page's policy still matches its one inline script (the import map)", () => {
  const inline = INDEX.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1];
  const hash = createHash("sha256").update(inline).digest("base64");
  assert.ok(INDEX.includes(`'sha256-${hash}'`), "the Content-Security-Policy does not allow the import map");
  assert.equal([...INDEX.matchAll(/<script\b/g)].length, 2, "one import map and one module script");
});

test("every file the page names exists", () => {
  for (const r of indexRefs()) if (!/^https?:/.test(r.url)) {
    const rel = r.url.replace(/^\.\//, "");
    assert.ok(rel.endsWith("/") ? fs.existsSync(path.join(ROOT, rel)) : exists(rel), `index.html names ${r.url}, which is missing`);
  }
  for (const u of CSS_URLS) assert.ok(exists(path.posix.join("assets", u)), `site.css names ${u}, which is missing`);
  for (const f of [...MODELS, ...DATA, "CNAME", "favicon.ico", "assets/icons/favicon.svg", "assets/icons/apple-touch-icon.png", "assets/og-image.jpg"]) assert.ok(exists(f), `${f} is missing`);
  assert.equal(read("CNAME").trim(), "catcoinsanctuary.com");
  assert.ok(!exists("index.prototype.html"), "the prototype page is gone");
  for (const c of PLANNED.cats) {
    assert.ok(c.portrait, `${c.ticker} has a portrait`);
    const info = jpegInfo(fs.readFileSync(path.join(ROOT, c.portrait)));
    assert.deepEqual([info?.width, info?.height], [512, 512], `${c.portrait} is a 512 px JPEG`);
  }
});

test("the head: title, description, canonical address, sharing picture, icons", () => {
  const meta = (attr, name) => new RegExp(`<meta ${attr}="${name}" content="([^"]+)"`).exec(INDEX)?.[1];
  assert.match(INDEX, /<title>Catcoin Sanctuary<\/title>/);
  assert.ok((meta("name", "description") ?? "").length >= 50);
  assert.match(INDEX, /<link rel="canonical" href="https:\/\/catcoinsanctuary\.com\/">/);
  assert.equal(meta("property", "og:title"), "Catcoin Sanctuary");
  assert.equal(meta("property", "og:url"), SITE);
  assert.equal(meta("property", "og:image"), `${SITE}assets/og-image.jpg`);
  assert.equal(meta("name", "twitter:card"), "summary_large_image");
  assert.equal(meta("name", "twitter:image"), `${SITE}assets/og-image.jpg`);
  const og = jpegInfo(fs.readFileSync(path.join(ROOT, "assets/og-image.jpg")));
  assert.deepEqual([og.width, og.height], [1200, 630]);
  assert.equal(meta("property", "og:image:width"), "1200");
  assert.equal(meta("property", "og:image:height"), "630");
  assert.ok(size("assets/og-image.jpg") < 400_000);
  const ico = fs.readFileSync(path.join(ROOT, "favicon.ico"));
  assert.deepEqual([ico.readUInt16LE(0), ico.readUInt16LE(2)], [0, 1], "favicon.ico is an icon file");
  assert.match(read("assets/icons/favicon.svg"), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
});

test("page weight: the first view stays within budget", () => {
  const files = firstView();
  const total = files.reduce((n, f) => n + size(f), 0);
  const of = (re) => files.filter((f) => re.test(f)).reduce((n, f) => n + size(f), 0);
  const MB = 1024 * 1024;
  assert.ok(total <= 4 * MB, `the first view is ${(total / MB).toFixed(2)} MB (budget 4 MB): ${files.join(", ")}`);
  assert.ok(of(/\.glb$/) <= 2 * MB, "models over 2 MB");
  assert.ok(of(/^assets\/vendor\//) <= 1 * MB, "three.js over 1 MB");
  assert.ok(of(/^assets\/(ui|world)\/|^assets\/(residents|collection)\.js$/) <= 400 * 1024, "the page's own scripts over 400 KB");
  assert.ok(of(/^data\//) <= 1.5 * MB, "the data over 1.5 MB");
  assert.ok(of(/\.woff2$/) <= 150 * 1024, "fonts over 150 KB");
  assert.ok(size("index.html") + size("assets/site.css") <= 60 * 1024, "page and stylesheet over 60 KB");
  for (const c of PLANNED.cats) assert.ok(size(c.portrait) <= 400_000, `${c.portrait} is too heavy`);
});

/* Per card, from the data as shipped (whatever the hourly check has added by now): a cat with no
   proven launch says "Not launched yet" and has nothing to buy; a cat with one says "Launched" and
   links exactly GMGN and FOMO for its own mint. */
const COLLECTION = JSON.parse(read("data/collection.json"));
const TOKEN_HOSTS = /gmgn\.ai|fomo\.family|solscan\.io|stonkfun\.xyz|pump\.fun|dexscreener\.com|birdeye\.so|jup\.ag|raydium\.io|photon-sol|bullx\.io|axiom\.trade|geckoterminal\.com/;

test("every cat's card and list row, from the shipped data: planned cats say \"Not launched yet\" with nothing to buy; launched ones link GMGN and FOMO for their own mint", async () => {
  const list = await residents();
  const mints = new Set(COLLECTION.cats.map((c) => c.mint));
  for (const c of PLANNED.cats) assert.ok(list.some((r) => r.id === c.ticker), `${c.ticker} is in the garden`);
  for (const r of list) {
    const c = renderCard(r);
    if (r.token.status === "launched") {
      assert.ok(mints.has(r.token.mint), `${r.id}: launched with a mint the hourly check proved`);
      assert.deepEqual(c.buy, [
        { href: `https://gmgn.ai/sol/token/${r.token.mint}`, text: "Buy on GMGN" },
        { href: `https://fomo.family/tokens/solana/${r.token.mint}`, text: "Buy on FOMO" },
      ], r.id);
      assert.match(c.root.querySelector("p.card-ticker").textContent, /Launched/, r.id);
      assert.ok(!/Not launched yet/.test(c.text), r.id);
      for (const l of c.links.filter((a) => TOKEN_HOSTS.test(a.href))) assert.ok(l.href.endsWith(r.token.mint) || l.href.endsWith(r.token.tx), `${r.id}: ${l.href}`);
      assert.equal(badgeFor(r).textContent, "Launched");
    } else {
      assert.equal(r.token.status, "planned", r.id);
      assert.deepEqual(r.buy, [], r.id);
      assert.equal(r.explorer, null, r.id);
      assert.match(c.section("card-token"), /Not launched yet/, `${r.id}: the token section`);
      assert.match(c.root.querySelector("p.card-ticker").textContent, /Not launched yet/, `${r.id}: the badge under its name`);
      assert.deepEqual(c.buy, [], `${r.id} has a buy button`);
      assert.ok(!c.links.some((l) => TOKEN_HOSTS.test(l.href)), `${r.id} links to a token or trading page`);
      assert.match(c.section("card-buy-h"), /Nothing to buy yet/, r.id);
      assert.equal(badgeFor(r).textContent, "Not launched yet");
      // A planned ticker is not a cashtag, and the card warns about same-name tokens.
      assert.ok(!c.text.includes(`$${r.ticker}`), `${r.id}: shows $${r.ticker} before launch`);
      assert.match(c.root.querySelector("p.card-ticker").textContent, new RegExp(`Planned ticker ${r.ticker}`), r.id);
      assert.match(c.section("card-buy-h"), new RegExp(`Any token called ${r.ticker} that you find before launch is not this cat`), r.id);
    }
    // The header names what the coin is priced in, not the company.
    const kicker = c.root.querySelector("p.card-kicker").textContent, company = r.company || r.stock;
    assert.ok(company, `${r.id} names its company`);
    assert.ok(!kicker.includes(company), `${r.id}: the company heads the card`);
    assert.match(kicker, new RegExp(`priced in ${r.pair.symbol.replace(".", "\\.")}$`), r.id);
    assert.ok(c.section("card-token").includes(`${r.pair.symbol} (${company})`), `${r.id}: the company is named where the pair is`);
    // What the card says: who the cat is, its virality (or "Not measured"), its links, the token, the disclaimer.
    assert.ok(c.section("card-who").includes(r.who.slice(0, 40)), `${r.id}: who the cat is`);
    if (!r.virality.length) assert.match(c.section("card-vir"), /Not measured/, r.id);
    for (const v of r.virality) {
      assert.ok(c.section("card-vir").includes(v.value), `${r.id}: ${v.value}`);
      assert.ok(c.links.some((l) => l.href === v.source), `${r.id}: the source of ${v.value}`);
      assert.ok(["measured", "as_of", "published", "undated"].includes(v.dateType), `${r.id}: what the date of ${v.value} means`);
    }
    assert.ok(!/\b\d{4}-\d{2}\b/.test(c.section("card-vir")), `${r.id}: a raw date in the virality section`);
    for (const l of r.links) assert.ok(c.links.some((a) => a.href === l.url), `${r.id}: ${l.url}`);
    for (const a of c.links) {
      assert.match(a.href, /^https:\/\//, `${r.id}: ${a.href}`);
      assert.equal(a.target, "_blank");
      assert.equal(a.rel, "noopener noreferrer");
    }
    for (const must of [/not affiliated/i, /StonkFun/, /no intrinsic value/i, /not financial advice/i]) assert.match(c.disclaimer, must, `${r.id}: the disclaimer`);
  }
  // The list (and the page without WebGL) labels every cat the same way, and shows a cashtag only once launched.
  const root = new Element("div");
  createFinder({ root, residents: list, inline: true, onChoose() {} });
  const rows = root.querySelectorAll("button.find-item");
  assert.equal(rows.length, list.length);
  for (const b of rows) {
    const r = list.find((x) => x.id === b.dataset.id);
    assert.equal(b.querySelector("span.badge").textContent, r.token.status === "launched" ? "Launched" : "Not launched yet", b.dataset.id);
    assert.equal(b.querySelector("span.find-meta").textContent.includes(`$${r.ticker}`), r.token.status === "launched", b.dataset.id);
  }
  assert.match(root.querySelector("p.finder-intro").textContent, /so far, each paired with one stock/);
});

test("a cat drawn like a company's cat says so: its whyLook's company cat comes with the fan-tribute line on its card, and held cats ship no portrait", async () => {
  const held = JSON.parse(read("data/held.json")).held.map((h) => h.ticker);
  const list = await residents();
  for (const c of PLANNED.cats) {
    const follows = /\b(follows|copies|copied|reproduces|traced from)\b|\b(she|he|it)\s+is\s+the\b/i.test(c.whyLook);
    if (follows) assert.match(c.tribute ?? "", /^Fan tribute to (.+)'s cat\. Not affiliated with or endorsed by \1\.$/, `${c.ticker}: ${c.whyLook}`);
    assert.ok(!held.includes(c.ticker), `${c.ticker} is held back but planned`);
    const r = list.find((x) => x.id === c.ticker);
    const c2 = renderCard(r);
    const shown = c2.root.querySelector("p.card-tribute");
    if (c.tribute) assert.equal(shown?.textContent, c.tribute, `${c.ticker}: the card shows its tribute line`);
    else assert.ok(!shown, `${c.ticker}: a tribute line on a cat that follows no company's cat`);
  }
  for (const t of held) assert.ok(!exists(`assets/portraits/${t}.jpg`), `${t}'s portrait is published`);
});

test("buy links only on a launched cat: GMGN and FOMO for its own mint, and nowhere else", async () => {
  const list = await residents({ collection: { cats: [GME] } });
  const launched = list.filter((r) => r.token.status === "launched");
  assert.deepEqual(launched.map((r) => r.id), ["SAVEPAWS"], "the sample launch took its planned cat");
  const r = launched[0];
  const c = renderCard(r);
  assert.deepEqual(c.buy, [
    { href: `https://gmgn.ai/sol/token/${GME.mint}`, text: "Buy on GMGN" },
    { href: `https://fomo.family/tokens/solana/${GME.mint}`, text: "Buy on FOMO" },
  ]);
  assert.match(c.root.querySelector("p.card-ticker").textContent, /Launched/);
  assert.ok(!/Not launched yet/.test(c.text), "a launched card does not say it is not launched");
  assert.ok(c.links.some((l) => l.href === `https://solscan.io/token/${GME.mint}`));
  assert.ok(c.links.some((l) => l.href === `https://solscan.io/tx/${GME.tx}`));
  assert.ok(c.links.some((l) => l.href === `https://www.stonkfun.xyz/token/${GME.mint}`));
  for (const other of list.filter((x) => x !== r)) {
    assert.deepEqual(renderCard(other).buy, [], `${other.id} shows a buy link`);
    assert.equal(other.token.status, "planned");
  }
});

test("the page's checks hold whatever the data says", async () => {
  const [base] = await residents();
  const planted = { ...base, token: { status: "planned" }, buy: [{ label: "GMGN", url: `https://gmgn.ai/sol/token/${GME.mint}` }], explorer: { token: `https://solscan.io/token/${GME.mint}` } };
  assert.deepEqual(normalize(planted).buy, [], "a planned cat carrying a buy link");
  assert.equal(normalize(planted).explorer, null);
  assert.deepEqual(renderCard(normalize(planted)).buy, []);
  const badMint = normalize({ ...base, token: { status: "launched", mint: "not a mint" }, buy: [{ label: "GMGN", url: "https://gmgn.ai/sol/token/not a mint" }] });
  assert.equal(badMint.token.status, "planned", "a launch without a well-formed mint");
  assert.deepEqual(badMint.buy, []);
  const other = "So11111111111111111111111111111111111111112";
  const launched = normalize({
    ...base,
    token: { status: "launched", mint: GME.mint, tx: GME.tx },
    buy: [
      { label: "GMGN", url: `https://gmgn.ai/sol/token/${GME.mint}` },
      { label: "FOMO", url: `http://fomo.family/tokens/solana/${GME.mint}` },
      { label: "Elsewhere", url: `https://gmgn.ai/sol/token/${other}` },
    ],
    explorer: { token: `https://solscan.io/token/${other}`, tx: `https://solscan.io/tx/${GME.tx}`, stonkfun: `javascript:alert(1)//${GME.mint}` },
    virality: [{ label: "Views", value: "1", source: "https://x.com/a/status/1" }, { label: "Views", value: "2", source: "http://x.com/a/status/2", date: "2026-09-25" }, { label: "Views", value: "3", source: "https://x.com/a/status/3", date: "2026-09-25" }],
    links: [{ label: "a", url: "javascript:alert(1)" }, { label: "b", url: "https://example.org/", date: "2026-09-25" }],
    portrait: "https://example.org/cat.jpg",
  });
  assert.deepEqual(launched.buy.map((b) => b.url), [`https://gmgn.ai/sol/token/${GME.mint}`], "only an https link naming the cat's own mint");
  assert.deepEqual(launched.explorer, { token: null, tx: `https://solscan.io/tx/${GME.tx}`, stonkfun: null });
  assert.deepEqual(launched.virality.map((v) => v.value), ["3"], "a figure needs an https source and a date");
  assert.deepEqual(launched.links.map((l) => l.url), ["https://example.org/"]);
  assert.equal(launched.portrait, null, "a portrait from another host");
  // A buy or explorer link must be the exact page on the one host its label names: naming the mint somewhere is not enough.
  const foreign = normalize({
    ...base,
    token: { status: "launched", mint: GME.mint, tx: GME.tx },
    buy: [
      { label: "GMGN", url: `https://phish.example/?m=${GME.mint}` },
      { label: "GMGN", url: `https://gmgn.ai.phish.example/sol/token/${GME.mint}` },
      { label: "FOMO", url: `https://fomo.family/tokens/solana/${GME.mint}` },
      { label: "FOMO", url: `https://gmgn.ai/sol/token/${GME.mint}` },
    ],
    explorer: { token: `https://solscan.io.evil.example/token/${GME.mint}`, tx: `https://solscan.io/token/${GME.tx}`, stonkfun: `https://stonkfun.xyz/token/${GME.mint}` },
  });
  assert.deepEqual(foreign.buy, [{ label: "FOMO", url: `https://fomo.family/tokens/solana/${GME.mint}` }]);
  const more = normalize({ ...base, token: { status: "launched", mint: GME.mint, tx: GME.tx }, buy: [
    { label: "GMGN", url: `https://gmgn.ai/sol/token/${GME.mint}/../../x` }, { label: "GMGN", url: `https://gmgn.ai/sol/token/${GME.mint}?ref=x` },
    { label: "GMGN", url: `https://gmgn.ai/sol/token/x${GME.mint}` }, { label: "Elsewhere", url: `https://gmgn.ai/sol/token/${GME.mint}` },
  ] });
  assert.deepEqual(more.buy, [], "a path around the mint, a query, a longer last part, an unknown label");
  assert.deepEqual(foreign.explorer, { token: null, tx: null, stonkfun: null });
});

test("virality dates say what they are, and year-month dates read as words", async () => {
  const [base] = await residents();
  const r = normalize({ ...base, virality: [
    { label: "Views", value: "1", source: "https://x.com/a/status/1", date: "2026-09-25", dateType: "measured" },
    { label: "Likes", value: "more than 1 million", source: "https://knowyourmeme.com/x", date: "2013-08", dateType: "as_of" },
    { label: "Impressions", value: "5.1 million", source: "https://shortyawards.com/x", date: "2026-09-25", dateType: "undated" },
    { label: "Press", value: "TIME", source: "https://time.com/x", date: "2014-10-15", dateType: "published" },
  ] });
  const v = renderCard(r).section("card-vir");
  assert.match(v, /counted 25 Sept? 2026/);
  assert.match(v, /as of Aug 2013/);
  assert.match(v, /read 25 Sept? 2026; the source gives no date/);
  assert.match(v, /published 15 Oct 2014/);
  assert.ok(!v.includes("2013-08"));
});

test("every planned cat's card shows its proof: the post's author, handle, words and date, a picture on this site, and a link to the post", async () => {
  const list = await residents();
  const planned = list.filter((r) => PLANNED.cats.some((c) => c.ticker === r.id));
  assert.equal(planned.length, PLANNED.cats.length);
  for (const r of planned) {
    const c = PLANNED.cats.find((x) => x.ticker === r.id);
    const card = renderCard(r);
    const fig = card.root.querySelector("figure.proof");
    assert.ok(fig, `${r.id} shows a proof`);
    const text = fig.textContent;
    assert.ok(text.includes(c.proof.author), r.id);
    if (c.proof.kind === "x") assert.ok(text.includes(`@${c.proof.handle}`), r.id);
    if (c.proof.text) assert.ok(text.includes(c.proof.text), r.id);
    const a = fig.querySelectorAll("a").find((x) => x.className === "proof-link");
    assert.equal(a.href, c.proof.url);
    assert.equal(a.textContent, c.proof.kind === "x" ? "View post on X ↗" : "Read the story ↗");
    if (c.proof.kind === "x") {
      const h = fig.querySelectorAll("a").find((x) => x.className === "proof-handle");
      assert.equal(h.href, `${new URL(c.proof.url).origin}/${c.proof.handle}`, r.id);
      assert.equal(h.textContent, `@${c.proof.handle}`, r.id);
    }
    assert.equal(a.rel, "noopener noreferrer");
    const img = fig.querySelector("img");
    if (c.proof.image) assert.equal(img.src, c.proof.image); else assert.equal(img, null);
    assert.ok(card.section("card-proof").length > 0);
  }
  // No proof, or one that is not https, or an X proof off X: the card says so instead.
  const bare = { ...planned[0], proof: normalize({ ...planned[0], id: "t", proof: { kind: "x", url: "https://evil.example/Google/status/1", handle: "Google", author: "G", text: "hi" } }).proof };
  assert.equal(bare.proof, null);
  assert.match(renderCard(bare).section("card-proof"), /No proof post recorded yet/);
  assert.equal(normalize({ ...planned[0], id: "t", proof: { kind: "web", url: "http://example.com/", author: "G", text: "hi" } }).proof, null);
});
