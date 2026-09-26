/* Adopt a cat (assets/ui/adopt.js, scripts/build-kits.py): the hand-off panel and the kit files.
   The panel only copies text, links files on this site and opens the launchpads' plain create
   pages in a new tab; it never signs or sends anything. The kit pictures are real files:
   a square PNG token logo of at most 2 MB and banners of exactly 1500 x 500. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, DATA_NOW } from "./helpers.mjs";
import { installDom, Element } from "./minidom.mjs";
import { loadResidents } from "../assets/residents.js";
import { normalize } from "../assets/ui/data.js";
import { createCard } from "../assets/ui/card.js";
import { adoptPanel, launchKit, kitFiles, canAdopt, cardUrl, getStonked, fillTemplate, HAND_OFF_NOTE, STONKFUN_LAUNCH, PUMP_CREATE, NAME_MAX, TICKER_MAX } from "../assets/ui/adopt.js";

installDom();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel));
const KITS = JSON.parse(read("assets/kits/kits.json"));
const PADS = JSON.parse(read("data/launchpads.json"));
const SITE = JSON.parse(read("data/socials.json")).links.find((l) => l.id === "website").url; // https://catcoinsanctuary.com/
const BASE = new URL(`file://${ROOT}/`);
const localFetch = async (url) => {
  const p = new URL(url).pathname;
  try { return new Response(fs.readFileSync(p), { status: 200 }); } catch { return new Response("", { status: 404 }); }
};
const residents = async () => (await loadResidents({ fetchImpl: localFetch, base: BASE, nowMs: DATA_NOW })).map(normalize).filter(Boolean);

/** Width, height and colour type of a PNG, from its IHDR. */
function pngInfo(buf) {
  assert.equal(buf.toString("hex", 0, 8), "89504e470d0a1a0a", "a PNG signature");
  assert.equal(buf.toString("latin1", 12, 16), "IHDR");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

test("every kit in assets/kits/kits.json: a square token PNG <= 2 MB, banners exactly 1500 x 500, local paths, a matching hash", async () => {
  const { createHash } = await import("node:crypto");
  const entries = Object.entries(KITS.cats);
  assert.ok(entries.length >= 20, `${entries.length} kits`);
  for (const [t, k] of entries) {
    assert.equal(k.token, `assets/kits/${t}/token.png`);
    const tok = read(k.token);
    const ti = pngInfo(tok);
    assert.equal(ti.w, ti.h, `${t}: token is square`);
    assert.equal(ti.w, 1024, `${t}: token is 1024`);
    assert.ok(tok.length <= 2 * 1024 * 1024, `${t}: token is ${tok.length} bytes`);
    assert.equal(createHash("sha256").update(tok).digest("hex"), k.tokenSha256, `${t}: tokenSha256`);
    for (const b of [k.banner, k.bannerPlain]) {
      assert.match(b, new RegExp(`^assets/kits/${t}/banner(-plain)?\\.png$`));
      const bi = pngInfo(read(b));
      assert.deepEqual([bi.w, bi.h], [1500, 500], `${b} is 1500 x 500`);
    }
    if (k.photo) {
      assert.match(k.photo.url, /^https:\/\/pbs\.twimg\.com\/(media|amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb)\//, `${t}: photo is hotlinked from X, not copied`);
      assert.match(k.photo.post, /^https:\/\/(x|twitter)\.com\/[A-Za-z0-9_]+\/status\/\d+/);
      assert.ok(k.photo.handle, `${t}: photo credit`);
    }
  }
});

test("the launch kit's words: name <= 32, ticker <= 10, lore + proof + not-affiliated line, website is the card URL, X is the proof post or blank", async () => {
  const list = await residents();
  const cats = list.filter(canAdopt);
  assert.ok(cats.some((r) => r.kind === "adoptable") && cats.some((r) => r.kind !== "adoptable"), "planned and adoptable cats can be adopted");
  for (const r of cats) {
    const k = launchKit(r, { site: SITE });
    assert.ok(k.name && k.name.length <= NAME_MAX, `${r.id}: name ${k.name}`);
    assert.ok(k.ticker && k.ticker.length <= TICKER_MAX, `${r.id}: ticker`);
    assert.equal(k.website, `https://catcoinsanctuary.com/#cat=${r.ticker}`);
    assert.equal(k.website, cardUrl(r, SITE));
    if (r.proof?.url) assert.ok(k.description.includes(`Proof: ${r.proof.url}`), `${r.id}: proof link`);
    assert.match(k.description, /Not affiliated with .+\. A memecoin with no intrinsic value; not financial advice\.$/);
    assert.ok(!/A cat coin priced in/.test(k.description), `${r.id}: the card's own coin line is left out`);
    assert.equal(k.x, r.proof?.kind === "x" ? r.proof.url : "");
    assert.ok(k.quote.symbol, `${r.id}: quote token`);
  }
  const larry = list.find((r) => r.id === "LARRY10");
  if (larry) assert.match(launchKit(larry).description, /Not affiliated with /);
});

test("a famous coin, a launched cat and an example cannot be adopted", () => {
  assert.equal(canAdopt({ kind: "famous", ticker: "X" }), false);
  assert.equal(canAdopt({ ticker: "X", token: { status: "launched" } }), false);
  assert.equal(canAdopt({ ticker: "X", example: true, token: { status: "planned" } }), false);
  assert.equal(canAdopt({ ticker: "X", token: { status: "planned" } }), true);
});

test("kitFiles keeps only this cat's local kit paths and an https pbs.twimg.com photo", () => {
  const kits = { cats: { AAA: { token: "assets/kits/AAA/token.png", banner: "https://evil.example/b.png", bannerPlain: "assets/kits/BBB/banner-plain.png", photo: { url: "https://evil.example/p.jpg", handle: "x", post: "https://x.com/a/status/1" } } } };
  assert.deepEqual(kitFiles(kits, "AAA"), { token: "assets/kits/AAA/token.png", banner: null, bannerPlain: null, photo: null });
  assert.equal(kitFiles(kits, "ZZZ"), null);
});

function panelFor(r, pads = PADS) {
  const root = new Element("div");
  root.append(adoptPanel(r, { files: kitFiles(KITS, r.ticker), site: SITE, pads }));
  return root;
}

test("the Adopt panel: copy buttons for every kit field, real downloads, both launchpads in a new tab, the hand-off note and StonkFun's terms before its button", async () => {
  const list = await residents();
  const withKit = list.filter((r) => canAdopt(r) && KITS.cats[r.ticker]);
  assert.ok(withKit.length >= 20);
  for (const r of withKit) {
    const root = panelFor(r);
    const text = root.textContent;
    const k = launchKit(r, { site: SITE });
    assert.ok(text.includes(HAND_OFF_NOTE), `${r.id}: hand-off note`);
    for (const label of ["Token name", "Ticker", "Description", "Website", "X"]) assert.ok(root.querySelectorAll("dt").some((d) => d.textContent === label), `${r.id}: ${label}`);
    const copies = root.querySelectorAll("button.card-copy").map((b) => b.getAttribute("aria-label"));
    for (const what of ["token name", "ticker", "description", "website"]) assert.ok(copies.includes(`Copy the ${what}`), `${r.id}: copy ${what}`);
    assert.equal(copies.includes("Copy the X link"), !!k.x);
    const anchors = root.querySelectorAll("a");
    const downloads = anchors.filter((a) => a.getAttribute("download"));
    const files = kitFiles(KITS, r.ticker);
    assert.ok(downloads.some((a) => a.href === files.token), `${r.id}: token download`);
    assert.ok(downloads.some((a) => a.href === files.banner), `${r.id}: banner download`);
    for (const a of downloads) assert.ok(fs.existsSync(path.join(ROOT, a.href)), `${a.href} exists`);
    const sf = anchors.find((a) => a.classList.contains("adopt-stonkfun"));
    const pf = anchors.find((a) => a.classList.contains("adopt-pump"));
    assert.equal(sf.href, STONKFUN_LAUNCH);
    assert.equal(pf.href, PUMP_CREATE);
    for (const a of [sf, pf]) { assert.equal(a.target, "_blank"); assert.match(a.rel, /noopener/); }
    // StonkFun: the quote token and its mint, and the terms before the button.
    const pad = sf.parentNode;
    assert.ok(pad.textContent.includes(r.pair.symbol || "STONK"));
    if (r.pair.mint) assert.ok(pad.textContent.includes(r.pair.mint), `${r.id}: quote mint`);
    const kids = pad.children;
    const termsAt = kids.findIndex((e) => e.classList.contains("adopt-terms"));
    assert.ok(termsAt >= 0 && termsAt < kids.indexOf(sf), `${r.id}: terms come before the StonkFun button`);
    assert.match(kids[termsAt].textContent, /18 or older/);
    assert.ok(pf.parentNode.textContent.includes("SOL"));
    const gs = anchors.find((a) => a.classList.contains("adopt-getstonked-go"));
    assert.equal(gs?.href, "https://getstonked.xyz/launch", `${r.id}: GetStonked button`);
    const pads = root.querySelectorAll("div.adopt-pad");
    assert.deepEqual(pads.map((d) => d.querySelector("p.adopt-pad-name").textContent), ["StonkFun", "GetStonked", "pump.fun"]);
    if (/x$/i.test(r.pair.symbol || "")) assert.match(pads[1].textContent, new RegExp(`Suggested stock pair ${r.pair.symbol}`));
    // The logo: the credited real photo when the proof post has one, else our portrait, said plainly.
    if (files.photo) {
      assert.ok(text.includes(`Photo: @${files.photo.handle}`));
      assert.ok(anchors.some((a) => a.href === files.photo.url && a.textContent === "Open original to save ↗"));
      assert.match(text, /This photo belongs to its owner\. Ask for their permission/);
      assert.match(text, /Use our Sanctuary portrait instead/);
      assert.ok(!downloads.some((a) => /twimg/.test(a.href)), "the photo is never offered as a download from this site");
    } else assert.match(text, /so its logo is our Sanctuary portrait/);
    // Nothing that signs or sends.
    assert.equal(root.querySelectorAll("form").length, 0);
  }
});

test("the banner is optional: 'Include banner' hides it, and a plain style is the second choice", () => {
  const t = Object.keys(KITS.cats)[0];
  const r = { name: "Test Cat", ticker: t, description: "A story.", pair: { symbol: "STONK", mint: "6GmAFSYs4gk3FDao5FzzySQpPZaWsa4rUJHacpMpUNgx" }, proof: null };
  const root = panelFor(r);
  const box = root.querySelector("div.adopt-banner-box");
  const on = root.querySelector("input.adopt-include");
  assert.equal(on.checked, true);
  assert.equal(box.hidden, false);
  on.checked = false; on.click();
  assert.equal(box.hidden, true, "unticked: the banner and its download are hidden");
  on.checked = true; on.click();
  assert.equal(box.hidden, false);
  const kinds = root.querySelectorAll("button.adopt-kind");
  assert.deepEqual(kinds.map((b) => b.dataset.kind), ["sanctuary", "plain"]);
  kinds[1].click();
  assert.ok(box.querySelectorAll("a").some((a) => a.href === KITS.cats[t].bannerPlain && a.getAttribute("download")));
  assert.ok(!launchKit(r).description.includes("banner"), "the copied words never mention the banner");
});

test("the card's 'Adopt this cat' button opens the panel, and Back returns to the card", async () => {
  const list = await residents();
  const r = list.find((x) => x.kind === "adoptable" && KITS.cats[x.ticker]) ?? list.find((x) => canAdopt(x) && KITS.cats[x.ticker]);
  const root = new Element("aside");
  const card = createCard({ root, onClose() {}, onInset() {} });
  card.open(r, { focus: false });
  const btn = root.querySelector("button.btn-adopt");
  assert.ok(btn, "the card has an Adopt button");
  await card.adopt({ kits: KITS });
  assert.ok(root.querySelector("div.adopt-panel"), "the panel is open");
  root.querySelector("button.adopt-back").click();
  assert.equal(root.querySelector("div.adopt-panel"), null);
  assert.ok(root.querySelector("button.btn-adopt"));
  // A famous coin's card has no Adopt button.
  const famous = list.find((x) => x.kind === "famous");
  if (famous) { card.open(famous, { focus: false }); assert.equal(root.querySelector("button.btn-adopt"), null); }
});

test("GetStonked: one config entry (data/launchpads.json); its template block always, its button only once an https url is set", () => {
  assert.deepEqual(Object.keys(PADS.getstonked).sort(), ["label", "template", "url"]);
  const t = Object.keys(KITS.cats)[0];
  const r = { name: "Test Cat", ticker: t, description: "A story.", pair: { symbol: "STONK", mint: "m" }, proof: { kind: "x", url: "https://x.com/a/status/1" } };
  const off = panelFor(r, { getstonked: { label: "Launch on GetStonked", url: "", template: "" } });
  const g = off.querySelector("div.adopt-getstonked");
  assert.ok(g.querySelector("button.adopt-gs-copy"), "the template copy button");
  assert.equal(off.querySelector("a.adopt-getstonked-go"), null, "no button while the url is empty");
  const txt = g.getText();
  for (const k of ["Name: Test Cat", `Ticker: ${t}`, "Description: ", `Website: ${SITE}#cat=${t}`, "X: https://x.com/a/status/1", `Logo: assets/kits/${t}/token.png`, "Banner: "]) assert.ok(txt.includes(k), k);
  const inc = off.querySelector("input.adopt-include");
  inc.checked = false; inc.click();
  assert.ok(!g.getText().includes("Banner"), "banner left out when unticked");
  const on = panelFor(r, { getstonked: { label: "Launch on GetStonked", url: "https://getstonked.example/new?n={name}&t={ticker}", template: "{name} / {ticker} / {banner}" } });
  const a = on.querySelector("a.adopt-getstonked-go");
  assert.equal(a.href, `https://getstonked.example/new?n=Test%20Cat&t=${t}`);
  assert.equal(a.target, "_blank");
  assert.equal(on.querySelector("div.adopt-getstonked").getText(), `Test Cat / ${t} / assets/kits/${t}/banner.png`);
  assert.equal(getStonked({ getstonked: { url: "javascript:alert(1)" } }).url, "");
  assert.equal(fillTemplate("{name}{nope}", { name: "a b" }, true), "a%20b{nope}");
});
