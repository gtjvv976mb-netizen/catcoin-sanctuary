/* Adopted cats (data/adoptions.json, read by assets/residents.js, checked again by assets/ui/data.js,
   drawn by assets/ui/card.js): a coin a stranger launched from a cat's kit. Its card says "Adopted",
   names the coin by its one checked mint, links only that mint's pages, offers no Adopt kit and warns
   that no other token is it. A bad file, or a bad row, adopts nothing; a cat the owner launched
   ignores any adoption. The cards are rendered with tests/minidom.mjs, through the page's own code. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { ROOT, DATA_NOW, GME_LAUNCHER, GME_LAUNCH } from "./helpers.mjs";
import { installDom, Element } from "./minidom.mjs";
import { loadResidents, adoptionsFor } from "../assets/residents.js";
import { normalize, dateText, isAdopted } from "../assets/ui/data.js";
import { createCard, badgeFor, tickerLabel } from "../assets/ui/card.js";
import { createFinder } from "../assets/ui/finder.js";
import { canAdopt } from "../assets/ui/adopt.js";

const BASE = pathToFileURL(`${ROOT}/`);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };

/** The site as shipped, with some data files swapped: a value is served as JSON (a string as is), 404 as a missing file. */
function siteWith(over = {}) {
  return async (url) => {
    const rel = path.relative(ROOT, fileURLToPath(url)).split(path.sep).join("/");
    if (rel in over) {
      const v = over[rel];
      if (v === 404) return new Response("not found", { status: 404 });
      return new Response(typeof v === "string" ? v : JSON.stringify(v), { status: 200 });
    }
    const file = path.join(ROOT, rel);
    return fs.existsSync(file) ? new Response(fs.readFileSync(file), { status: 200 }) : new Response("not found", { status: 404 });
  };
}
const raw = (over) => quiet(() => loadResidents({ fetchImpl: siteWith(over), base: BASE, nowMs: DATA_NOW }));
const residents = async (over) => (await raw(over)).map(normalize).filter(Boolean);

/** A card, rendered: its root, text, sections by id, links and buttons. */
function renderCard(r) {
  const root = new Element("aside");
  const card = createCard({ root, onClose() {}, onInset() {} });
  card.open(r, { focus: false });
  return {
    root, card,
    text: root.textContent,
    section: (id) => root.querySelectorAll("section").find((s) => s.getAttribute("aria-labelledby") === id)?.textContent ?? "",
    links: root.querySelectorAll("a").map((a) => ({ href: a.href, text: a.textContent, target: a.target, rel: a.rel })),
  };
}

let removeDom;
test.before(() => { removeDom = installDom(); });
test.after(() => removeDom?.());

/* The one real adoption: Catbus's kit (Nekobasu, CATBUS), launched on pump.fun by a stranger. */
const CATBUS = Object.freeze({
  key: "NEKOBUS", mint: "Hqge3as7GhF2JqVfTkpaj9BUq9tGAFSnpwWHBie5pump", name: "Nekobasu", symbol: "CATBUS", launchpad: "pump.fun",
  creator: "LGfWJwhiBVYhgK2opEaLvXtWydBnMdEdtvLC6FfpYTw", createdAt: "2026-09-27T08:34:07Z", foundAt: "2026-09-27T09:16:32Z",
  evidence: ["name", "ticker", "description", "proof-link"],
});
const file = (...rows) => ({ note: "test", adoptions: rows });
const OTHER_MINT = "7Yk3fQeW9sPzD4nV2mXcR8tLbH6uJgA1oKqE5iNwTy3p";
const LINE = (pad, at) => `Adopted by the community: launched from this cat's kit on ${pad} on ${dateText(at)}. The sanctuary did not launch it and does not run it.`;
const WARNING = "Only the mint shown here is this cat's adopted coin. Any other token with this name or ticker is not it.";

test("the shipped data/adoptions.json adopts Catbus (NEKOBUS) with the stranger's Nekobasu/CATBUS coin, and only strangers' coins", async () => {
  const shipped = JSON.parse(read("data/adoptions.json"));
  assert.ok(typeof shipped.note === "string" && shipped.note.length > 0);
  const row = shipped.adoptions.find((a) => a.key === "NEKOBUS");
  assert.deepEqual({ ...row, foundAt: CATBUS.foundAt }, { ...CATBUS });
  const list = await residents();
  const catbus = list.find((r) => r.id === "NEKOBUS");
  assert.deepEqual(catbus.adoption, { mint: CATBUS.mint, name: "Nekobasu", symbol: "CATBUS", launchpad: "pump.fun", createdAt: "2026-09-27T08:34:07Z" });
  const own = new Set(JSON.parse(read("data/collection.json")).cats.map((c) => c.mint));
  for (const r of list.filter(isAdopted)) {
    assert.ok(!own.has(r.adoption.mint), `${r.id}: the owner's own launch is not an adoption`);
    assert.notEqual(r.token.status, "launched", r.id);
  }
});

test("an adopted cat's card: the Adopted badge, the line, the coin's name, $SYMBOL and mint, its pump.fun and DexScreener pages, the new warning, and no Adopt kit", async () => {
  const list = await residents({ "data/adoptions.json": file(CATBUS) });
  const r = list.find((x) => x.id === "NEKOBUS");
  assert.equal(r.kind, "adoptable");
  assert.ok(isAdopted(r));
  const c = renderCard(r);
  assert.match(dateText(CATBUS.createdAt), /^27 Sept? 2026$/);
  // Head: $CATBUS and "Adopted", never "Not launched yet" or a planned ticker.
  const tick = c.root.querySelector("p.card-ticker");
  assert.equal(tick.querySelector("span.badge").className, "badge badge-adopted");
  assert.equal(tick.textContent, "$CATBUSAdopted");
  assert.equal(badgeFor(r).textContent, "Adopted");
  assert.equal(tickerLabel(r), "$CATBUS");
  assert.ok(!/Not launched yet|Planned ticker|adopt it now/.test(c.text), "a pre-launch line on an adopted cat");
  // The status: the line, the coin, the mint (short, full in its title and its copy button).
  const st = c.section("card-adopt");
  assert.equal(c.root.querySelector("p.card-adopted").textContent, LINE("pump.fun", CATBUS.createdAt));
  assert.ok(st.includes("CoinNekobasu $CATBUS"), st);
  assert.ok(st.includes("MintHqge…pump"), st);
  const ca = c.root.querySelector("span.card-ca");
  assert.equal(ca.title, CATBUS.mint);
  assert.equal(ca.querySelector("button.card-copy").getAttribute("aria-label"), `Copy the mint address ${CATBUS.mint}`);
  // Its pages, for its own mint only; nothing to buy from the sanctuary.
  const token = c.links.filter((l) => /pump\.fun|dexscreener|stonkfun|gmgn|fomo|solscan/.test(l.href));
  assert.deepEqual(token.map((l) => [l.href, l.text]), [
    [`https://pump.fun/coin/${CATBUS.mint}`, "On pump.fun ↗"],
    [`https://dexscreener.com/solana/${CATBUS.mint}`, "On DexScreener ↗"],
  ]);
  for (const l of c.links) { assert.equal(l.target, "_blank"); assert.equal(l.rel, "noopener noreferrer"); }
  assert.equal(c.root.querySelectorAll("a").filter((a) => a.classList.contains("btn-buy")).length, 0);
  // The warnings: the new one in place of "Any token called … before launch".
  assert.ok(st.includes(WARNING));
  assert.ok(!c.text.includes("Any token called"), "the pre-launch warning is still there");
  // Catbus's older, unrelated coin is still named; the adopted coin never is.
  assert.match(c.text, /A small coin already exists: \$Catbus, ~\$2k/);
  assert.ok(!/A small coin already exists: \$CATBUS/.test(c.text), "the adopted coin is named as a stranger's existing coin");
  assert.match(c.root.querySelector("p.card-disclaimer").textContent, /Not launched or run by the sanctuary and not financial advice\.$/);
  // No Adopt button and no kit.
  assert.equal(c.root.querySelector("button.btn-adopt"), null);
  assert.equal(canAdopt(r), false);
  await c.card.adopt({ kits: JSON.parse(read("assets/kits/kits.json")), pads: {} });
  assert.equal(c.root.querySelector("div.adopt-panel"), null, "the Adopt panel opened for an adopted cat");
});

test("a planned stock cat can be adopted too: its token section says so, with its StonkFun and DexScreener pages, and it has no Buy section", async () => {
  const p = (await raw({ "data/adoptions.json": 404 })).find((r) => r.planned && r.token.status === "planned");
  const row = { ...CATBUS, key: p.id, name: p.name, symbol: p.ticker.toLowerCase(), launchpad: "stonkfun", mint: OTHER_MINT, createdAt: "2026-09-26T10:00:00Z", evidence: ["ticker", "name", "card-link"] };
  const r = (await residents({ "data/adoptions.json": file(row) })).find((x) => x.id === p.id);
  assert.deepEqual(r.adoption, { mint: OTHER_MINT, name: p.name, symbol: p.ticker, launchpad: "stonkfun", createdAt: "2026-09-26T10:00:00Z" }, "the kit's own name and ticker are shown, not the stranger's text");
  const c = renderCard(r);
  assert.match(c.root.querySelector("p.card-kicker").textContent, /^Adopted cat coin · priced in /);
  assert.equal(c.root.querySelector("p.card-ticker").textContent, `$${p.ticker}Adopted`);
  const tk = c.section("card-token");
  assert.ok(tk.includes("StatusAdopted"), tk);
  assert.ok(tk.includes(LINE("StonkFun", row.createdAt)), tk);
  assert.ok(tk.includes(WARNING), tk);
  assert.ok(!/Planned ticker|No token exists|Not launched yet/.test(c.text));
  assert.equal(c.section("card-buy-h"), "", "a Buy section on an adopted cat");
  assert.deepEqual(c.links.filter((l) => /stonkfun|dexscreener|pump\.fun/.test(l.href)).map((l) => l.href), [
    `https://www.stonkfun.xyz/token/${OTHER_MINT}`, `https://dexscreener.com/solana/${OTHER_MINT}`,
  ]);
  assert.equal(c.root.querySelector("button.btn-adopt"), null);
  assert.match(c.root.querySelector("p.card-disclaimer").textContent, /not affiliated/i);
});

test("the list and the tags: an adopted cat's row shows $SYMBOL and \"Adopted\", and the intro counts it apart", async () => {
  const list = await residents({ "data/adoptions.json": file(CATBUS) });
  const root = new Element("div");
  createFinder({ root, residents: list, inline: true, onChoose() {} });
  const row = root.querySelectorAll("button.find-item").find((b) => b.dataset.id === "NEKOBUS");
  assert.equal(row.querySelector("span.badge").textContent, "Adopted");
  assert.match(row.querySelector("span.find-meta").textContent, /^\$CATBUS · /);
  assert.match(root.querySelector("p.finder-intro").textContent, /adoptable cats so far, each with real, verified lore and no coin yet\. 1 more was adopted: launched from its kit by the community, not by the sanctuary\./);
  // The screen-reader line in main.js says "Adopted" too (main.js runs only in a browser, so read it).
  assert.match(read("assets/ui/main.js"), /r\.adoption \? "Adopted: launched from its kit by the community, not by the sanctuary\."/);
});

test("a missing, unreadable or malformed adoptions file adopts nothing, and the cats still show", async () => {
  const shown = (await residents({ "data/adoptions.json": 404 })).length;
  for (const bad of [404, "not json", "null", [], { adoptions: "NEKOBUS" }, { adoptions: [null, 1, "x", []] }, {}]) {
    const list = await residents({ "data/adoptions.json": bad });
    assert.equal(list.length, shown, JSON.stringify(bad));
    assert.deepEqual(list.filter((r) => r.adoption), [], JSON.stringify(bad));
  }
  const throws = async (url) => { if (String(url).endsWith("data/adoptions.json")) throw new Error("offline"); return siteWith()(url); };
  const list = (await quiet(() => loadResidents({ fetchImpl: throws, base: BASE, nowMs: DATA_NOW }))).map(normalize);
  assert.equal(list.length, shown);
  assert.ok(!list.some((r) => r.adoption));
});

test("every check on a row: one bad field and the row adopts nothing", async () => {
  const cats = await raw({ "data/adoptions.json": 404 });
  const famous = cats.find((r) => r.kind === "famous");
  assert.deepEqual([...adoptionsFor(file(CATBUS), cats)], [["NEKOBUS", { mint: CATBUS.mint, name: "Nekobasu", symbol: "CATBUS", launchpad: "pump.fun", createdAt: CATBUS.createdAt }]]);
  const bad = {
    "unknown cat": { key: "NOSUCHCAT" }, "a famous coin": { key: famous.id }, "the key in lower case": { key: "nekobus" },
    "mint not base58": { mint: "Hqge3as7GhF2JqVfTkpaj9BUq9tGAFSnpwWHBie5pum0" }, "mint as a link": { mint: `https://pump.fun/coin/${CATBUS.mint}` },
    "creator missing": { creator: undefined }, "creator not base58": { creator: "not a wallet" },
    "unknown launchpad": { launchpad: "letsbonk" }, "launchpad in capitals": { launchpad: "Pump.fun" },
    "createdAt not ISO": { createdAt: "27 Sept 2026" }, "createdAt without zone": { createdAt: "2026-09-27T08:34:07" },
    "before the kits went live": { createdAt: "2026-09-24T23:59:59Z" }, "found before it was made": { foundAt: "2026-09-27T08:00:00Z" },
    "foundAt missing": { foundAt: null },
    "another ticker": { symbol: "NEKOBUS" }, "symbol not a string": { symbol: ["CATBUS"] },
    "another name": { name: "Catbus" }, "name not a string": { name: { toString: () => "Nekobasu" } },
    "name and ticker only": { evidence: ["name", "ticker"] }, "the same evidence twice": { evidence: ["name", "ticker", "ticker"] },
    "unknown evidence": { evidence: ["name", "ticker", "vibes"] }, "no ticker evidence": { evidence: ["name", "description", "image"] },
    "evidence not a list": { evidence: "name,ticker,description" },
    "a mint that is not a string": { mint: [CATBUS.mint] }, "a time that is not a string": { createdAt: [CATBUS.createdAt] },
    "extra words in another script": { name: "Nekobasu ХУЙ" },
  };
  for (const [why, change] of Object.entries(bad)) assert.equal(adoptionsFor(file({ ...CATBUS, ...change }), cats).size, 0, why);
  // Names compare on letters and digits alone, tickers case aside.
  assert.equal(adoptionsFor(file({ ...CATBUS, name: "NEKO-BASU!", symbol: "catbus" }), cats).size, 1);
  // Loaded the same way, a bad row leaves the cat as it was.
  const r = (await residents({ "data/adoptions.json": file({ ...CATBUS, launchpad: "letsbonk" }) })).find((x) => x.id === "NEKOBUS");
  assert.equal(r.adoption, null);
  assert.equal(badgeFor(r).textContent, "Not launched yet");
  assert.match(renderCard(r).text, /Not launched yet — adopt it now/);
});

test("one adoption per cat: the earliest launch takes it, a later one is a copycat, and one mint adopts one cat", async () => {
  const cats = await raw({ "data/adoptions.json": 404 });
  const later = { ...CATBUS, mint: OTHER_MINT, createdAt: "2026-09-27T12:00:00Z", foundAt: "2026-09-27T12:30:00Z" };
  for (const rows of [[later, CATBUS], [CATBUS, later]]) assert.equal(adoptionsFor(file(...rows), cats).get("NEKOBUS").mint, CATBUS.mint);
  const p = cats.find((r) => r.planned && r.token.status === "planned");
  const sameMint = { ...CATBUS, key: p.id, name: p.name, symbol: p.ticker, createdAt: "2026-09-27T09:00:00Z" };
  assert.deepEqual([...adoptionsFor(file(sameMint, CATBUS), cats).keys()], ["NEKOBUS"]);
});

/* The real GMEx StonkFun launch (tests/fixtures), its symbol set to a planned cat's ticker: the owner's own launch. */
const GME = Object.freeze({
  mint: "EcB7LMNFXdSbzY4DQ6Uc9AKXmb9DCKqAeoNmLvNp3HvL", name: "Roaring Kitty", symbol: "SAVEPAWS",
  pair: { symbol: "GMEx", mint: "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc" }, pool: "2un6cyq4X2fMdgevvUSpcueiX1ER2CxRjsPxNMNkHcFz",
  payer: GME_LAUNCHER, tx: GME_LAUNCH, time: "2026-09-24T20:57:15Z",
});
const OWNER_LAUNCHED = { "data/collection.json": { cats: [GME] }, "data/wallets.json": { launchers: [{ address: GME_LAUNCHER, since: "2026-09-01", label: "sample" }] } };

test("a cat the owner launched ignores any adoption, and the owner's own mint adopts nothing", async () => {
  const base = await residents({ ...OWNER_LAUNCHED, "data/adoptions.json": 404 });
  const launched = base.find((r) => r.id === "SAVEPAWS");
  assert.equal(launched.token.status, "launched");
  const onLaunched = { ...CATBUS, key: "SAVEPAWS", name: launched.plannedName || launched.name, symbol: "SAVEPAWS", mint: OTHER_MINT };
  const p = (await raw({ ...OWNER_LAUNCHED, "data/adoptions.json": 404 })).find((r) => r.planned && r.token.status === "planned");
  const ownMint = { ...CATBUS, key: p.id, name: p.name, symbol: p.ticker, mint: GME.mint };
  const list = await residents({ ...OWNER_LAUNCHED, "data/adoptions.json": file(onLaunched, ownMint, CATBUS) });
  const r = list.find((x) => x.id === "SAVEPAWS");
  assert.equal(r.adoption, null);
  assert.equal(list.find((x) => x.id === p.id).adoption, null, "the owner's own launch counted as an adoption");
  assert.equal(list.find((x) => x.id === "NEKOBUS").adoption.mint, CATBUS.mint, "a good row beside them still adopts its cat");
  const c = renderCard(r);
  assert.equal(badgeFor(r).textContent, "Launched");
  assert.ok(!/Adopted/.test(c.text));
  // Whatever the data says: a launched cat carrying an adoption is still only the owner's launch.
  const forced = normalize({ ...launched, adoption: { mint: OTHER_MINT, name: "X", symbol: "X", launchpad: "pump.fun", createdAt: "2026-09-26T00:00:00Z" } });
  assert.equal(forced.adoption, null);
  assert.equal(isAdopted(forced), false);
  assert.ok(!renderCard(forced).links.some((l) => l.href.includes(OTHER_MINT)));
});

test("the page's own checks on an adoption: a bad mint or launchpad drops it, and its words are drawn as text", async () => {
  const [base] = (await residents({ "data/adoptions.json": 404 })).filter((r) => r.kind === "adoptable");
  const good = { mint: CATBUS.mint, name: "Nekobasu", symbol: "$CATBUS", launchpad: "pump.fun", createdAt: CATBUS.createdAt };
  assert.equal(normalize({ ...base, adoption: good }).adoption.symbol, "CATBUS");
  for (const change of [{ mint: "javascript:alert(1)" }, { mint: `${CATBUS.mint}/../x` }, { launchpad: "evil.example" }, { createdAt: "soon" }, { name: "" }, { symbol: 7 }]) {
    const r = normalize({ ...base, adoption: { ...good, ...change } });
    assert.equal(r.adoption, null, JSON.stringify(change));
    assert.ok(!/Adopted/.test(renderCard(r).text), JSON.stringify(change));
  }
  const html = '<img src=x onerror="alert(1)">';
  const r = normalize({ ...base, adoption: { ...good, name: html } });
  const c = renderCard(r);
  assert.ok(c.section("card-adopt").includes(`${html} $CATBUS`), "the name is shown as written, as text");
  assert.equal(c.root.querySelectorAll("img").filter((i) => i.getAttribute("onerror") !== null || i.src === "x").length, 0);
  for (const s of c.root.querySelectorAll("section")) assert.ok([s, ...s.walk()].every((e) => e.html === undefined), "a section set as HTML");
});
