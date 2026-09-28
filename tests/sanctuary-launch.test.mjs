/* An adoptable cat the sanctuary launched itself (its optional `launch` field in data/adoptables.json,
   written by the automatic launcher): the rules for the field (assets/ui/adoptables.js), the one rule
   for "launched" the page and the X bots share (assets/ui/adoptables.js provedLaunch: the proved
   entry with that mint, tx and launchpad, carrying the cat's own coin name and ticker), the page
   (assets/residents.js, assets/ui/data.js, assets/ui/card.js: "Launched by the sanctuary" only then,
   "Launching…" until then, one card per coin, no Adopt button) and the X announcer
   (scripts/announce.mjs listCats: the coin is the cat's, never a cat of its own; a pump.fun coin no
   adoptable claims is never listed). The launch is one built and signed offline by
   scripts/lib/pump.mjs with a throwaway key. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { ROOT, DATA_NOW, pumpLaunch, PUMPFUN, PUMP_COIN } from "./helpers.mjs";
import { installDom, Element } from "./minidom.mjs";
import { proveLaunchPump } from "../scripts/lib/chain.mjs";
import { loadResidents, adoptableResident } from "../assets/residents.js";
import { validateAdoptables, adoptableProblem, launchProblem, provedLaunch } from "../assets/ui/adoptables.js";
import { normalize, isLaunched } from "../assets/ui/data.js";
import { createCard, badgeFor, tickerLabel } from "../assets/ui/card.js";
import { canAdopt } from "../assets/ui/adopt.js";
import { listCats } from "../scripts/announce.mjs";

const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };
const BASE = pathToFileURL(`${ROOT}/`);
const ADOPT = read("data/adoptables.json");
const PLANNED = read("data/planned.json");

/** The site as shipped, with some data files swapped (a value is served as JSON; 404 answers not found). */
function siteWith(over = {}) {
  return async (url) => {
    const rel = path.relative(ROOT, fileURLToPath(url)).split(path.sep).join("/");
    if (rel in over) return over[rel] === 404 ? new Response("not found", { status: 404 }) : new Response(JSON.stringify(over[rel]), { status: 200 });
    const file = path.join(ROOT, rel);
    return fs.existsSync(file) ? new Response(fs.readFileSync(file), { status: 200 }) : new Response("not found", { status: 404 });
  };
}

/** The cats the tests launch: the first two shipped adoptables the page shows (not held back by the release queue). */
const baseline = await quiet(() => loadResidents({ base: BASE, nowMs: DATA_NOW, fetchImpl: siteWith() }));
const shown = ADOPT.cats.filter((c) => baseline.some((r) => r.id === c.ticker && r.kind === "adoptable"));
const [CAT, OTHER] = shown;
const coinOf = (c) => ({ name: c.coinName || c.name, symbol: c.launchTicker || c.ticker, uri: PUMP_COIN.uri });

/** A launch proved exactly as the builder proves it, and written the way the builder writes it. */
function proved(L) {
  const { launch: x } = proveLaunchPump(L.tx, { wallet: L.wallet });
  return { mint: x.mint, name: x.name, symbol: x.symbol, pair: x.pair, pool: x.pool, payer: x.payer, tx: x.tx, time: x.time, launchpad: x.launchpad };
}
/* CAT's own coin (its coin name and ticker), OTHER's own coin, and a coin under a stranger's name (Gull Gadot). */
const L = pumpLaunch({ coin: coinOf(CAT) });
const ENTRY = proved(L);
const LO = pumpLaunch({ postId: "1971234567890123457", coin: coinOf(OTHER) });
const ENTRY_O = proved(LO);
const LG = pumpLaunch({ postId: "1971234567890123458" });
const ENTRY_G = proved(LG);
const WALLETS = { launchers: [...read("data/wallets.json").launchers, { address: L.wallet, since: "2026-09-01", label: "Auto launcher" }] };
const LAUNCH = Object.freeze({ mint: L.mint, tx: L.signature, launchpad: "pump.fun", at: ENTRY.time });
const launchOf = (Lx, e) => ({ mint: Lx.mint, tx: Lx.signature, launchpad: "pump.fun", at: e.time });
/** The shipped adoptables with launch fields set: { TICKER: launch }. */
const withLaunches = (by) => ({ ...ADOPT, cats: ADOPT.cats.map((c) => (by[c.ticker] ? { ...c, launch: by[c.ticker] } : c)) });
const withLaunch = (launch = LAUNCH, key = CAT.ticker) => withLaunches({ [key]: launch });

const raw = ({ adoptables = withLaunch(), cats = [ENTRY], extra = {} } = {}) => quiet(() => loadResidents({ base: BASE, nowMs: DATA_NOW, fetchImpl: siteWith({
  "data/adoptables.json": adoptables, "data/collection.json": { cats }, "data/wallets.json": WALLETS, ...extra,
}) }));
const residents = async (o) => (await raw(o)).map(normalize).filter(Boolean);

function renderCard(r) {
  const root = new Element("aside");
  const card = createCard({ root, onClose() {}, onInset() {} });
  card.open(r, { focus: false });
  return { root, text: root.textContent, links: root.querySelectorAll("a").map((a) => a.href), kicker: root.querySelector("p.card-kicker")?.textContent, foot: root.querySelector("p.card-disclaimer")?.textContent };
}
let removeDom;
test.before(() => { removeDom = installDom(); });
test.after(() => removeDom?.());

test("the launch field: optional, closed, base58 mint and tx, a known launchpad, an exact ISO time", () => {
  assert.ok(CAT && OTHER, "two shipped adoptables the page shows");
  assert.equal(adoptableProblem({ ...CAT, launch: LAUNCH }), null);
  assert.equal(adoptableProblem({ ...CAT, launch: { ...LAUNCH, launchpad: "stonkfun" } }), null);
  assert.equal(launchProblem(LAUNCH), null);
  const bad = (patch) => launchProblem({ ...LAUNCH, ...patch });
  assert.match(bad({ mint: "0xdeadbeef" }), /base58/);
  assert.match(bad({ mint: L.signature }), /base58/);          // a signature where a mint belongs
  assert.match(bad({ tx: L.mint }), /base58/);                 // a mint where a signature belongs
  assert.match(bad({ tx: "javascript:alert(1)" }), /base58/);
  for (const launchpad of ["raydium", "Pump.fun", "", undefined]) assert.match(bad({ launchpad }), /launchpad/, String(launchpad));
  for (const at of ["2026-09-25", "2026-09-25T01:33:20.000Z", "2026-02-30T00:00:00Z", "Sep 25 2026", "", 1790300000]) assert.match(bad({ at }), /at must be/, String(at));
  assert.match(bad({ extra: 1 }), /launch must be/);
  assert.match(launchProblem(null), /launch must be/);
  assert.match(adoptableProblem({ ...CAT, launch: "EbBE6V3wta2HtsdAPsxoJwaYtGUuxdsLRLTZ8btTpump" }), /launch must be/);
});

test("proved: the adoptable shows as launched by the sanctuary, priced in its coin's pair (SOL), with its coin's links; the coin's bare token card is dropped (one card per coin)", async () => {
  const bare = await residents({ adoptables: ADOPT });
  assert.ok(bare.some((r) => r.id === L.mint), "without the launch field, the proved coin shows as a bare token card");
  const list = await residents();
  assert.equal(list.length, bare.length - 1);
  assert.equal(list.filter((r) => r.id === L.mint || r.token.mint === L.mint).length, 1);
  const r = list.find((x) => x.id === CAT.ticker);
  assert.equal(r.kind, "adoptable");
  assert.ok(isLaunched(r));
  assert.deepEqual(r.sanctuaryLaunch, { status: "launched", launchpad: "pump.fun" });
  assert.deepEqual(r.token, { status: "launched", mint: L.mint, launchedAt: ENTRY.time, tx: L.signature });
  assert.deepEqual(r.explorer, { token: `https://solscan.io/token/${L.mint}`, tx: `https://solscan.io/tx/${L.signature}`, stonkfun: null, pumpfun: `https://pump.fun/coin/${L.mint}` });
  assert.deepEqual(r.pair, { symbol: "SOL", mint: "So11111111111111111111111111111111111111112" }, "the proved coin's pair, not the adoptable's planned STONK");
  assert.deepEqual([r.coinName, r.launchTicker], [ENTRY.name, ENTRY.symbol], "the coin's own name and symbol");
  assert.equal(r.adoption, null);
  assert.equal(canAdopt(r), false);
});

test("the launched card: the Launched badge, the coin's own $TICKER and name, \"priced in SOL\", \"Launched by the sanctuary\", its pump.fun and Solscan pages, and no Adopt button", async () => {
  const r = (await residents()).find((x) => x.id === CAT.ticker);
  const c = renderCard(r);
  assert.equal(badgeFor(r).textContent, "Launched");
  assert.equal(tickerLabel(r), `$${ENTRY.symbol}`);
  assert.equal(ENTRY.symbol, CAT.launchTicker || CAT.ticker, "the coin carries the cat's own ticker");
  assert.match(c.kicker, / · priced in SOL$/, "the proved coin's pair (F)");
  assert.ok(c.text.includes(`Launched by the sanctuary on pump.fun on `), c.text);
  assert.ok(c.text.includes(`${ENTRY.name} $${ENTRY.symbol}`), "the coin row: its own name and symbol");
  assert.ok(c.text.includes(`${L.mint.slice(0, 4)}…${L.mint.slice(-4)}`));
  for (const href of [`https://pump.fun/coin/${L.mint}`, `https://solscan.io/token/${L.mint}`, `https://solscan.io/tx/${L.signature}`]) assert.ok(c.links.includes(href), href);
  assert.ok(!c.links.some((h) => /stonkfun\.xyz\/token/.test(h)));
  assert.ok(!/Not launched yet|adopt it now|Planned ticker|priced in STONK/.test(c.text), "a pre-launch line on a launched cat");
  assert.equal(c.root.querySelector("button.btn-adopt"), null);
  assert.match(c.foot, /Launched by the sanctuary\. Not financial advice\.$/);
});

test("not proved yet: \"Launching…\", never launched on the launcher's word alone, no mint shown, no Adopt button, and no bare card for the coin its launch names: the wrong tx, launchpad, name or ticker is not proof", async () => {
  for (const [what, o] of [
    ["not in the collection", { cats: [] }],
    ["another transaction", { cats: [{ ...ENTRY, tx: PUMPFUN.answer.params[0] }] }],
    ["another launchpad", { adoptables: withLaunch({ ...LAUNCH, launchpad: "stonkfun" }) }],
    ["another coin name", { cats: [{ ...ENTRY, name: "Gull Gadot" }] }],
    ["another ticker", { cats: [{ ...ENTRY, symbol: "GULLGADOT" }] }],
  ]) {
    const list = await residents(o);
    const r = list.find((x) => x.id === CAT.ticker);
    assert.equal(isLaunched(r), false, what);
    assert.equal(r.sanctuaryLaunch.status, "pending", what);
    assert.equal(canAdopt(r), false, what);
    const c = renderCard(r);
    assert.equal(badgeFor(r).textContent, "Launching…", what);
    assert.ok(c.text.includes("Launching on "), what);
    assert.ok(!c.text.includes(L.mint.slice(0, 4) + "…"), `${what}: a mint on an unproved launch`);
    assert.ok(!c.links.some((h) => h.includes(L.mint)), what);
    assert.equal(c.root.querySelector("button.btn-adopt"), null, what);
    assert.ok(!list.some((x) => x.id === L.mint), `${what}: a bare, buyable card for the coin the cat's launch names (G)`);
  }
});

test("a wrong launch row: a cat whose launch names another cat's coin is never shown as launched with it, and the coin is not passed off under the wrong cat (B)", async () => {
  // CAT's launch field names OTHER's proved coin (OTHER's name and ticker).
  const list = await residents({ adoptables: withLaunch(launchOf(LO, ENTRY_O)), cats: [ENTRY_O] });
  const a = list.find((x) => x.id === CAT.ticker), b = list.find((x) => x.id === OTHER.ticker);
  assert.equal(a.sanctuaryLaunch.status, "pending");
  assert.equal(isLaunched(a), false);
  assert.ok(!renderCard(a).text.includes(`$${ENTRY_O.symbol}`), "the other cat's coin on this cat's card");
  assert.equal(isLaunched(b), false);
  // A coin under a stranger's name (Gull Gadot) is no cat's, whatever a launch field says.
  const g = (await residents({ adoptables: withLaunch(launchOf(LG, ENTRY_G)), cats: [ENTRY_G] })).find((x) => x.id === CAT.ticker);
  assert.equal(g.sanctuaryLaunch.status, "pending");
});

test("two cats naming one launch mint: both cats stay; the coin goes to the cat whose name and ticker it carries, the other stays \"Launching…\", one card for the coin (B)", async () => {
  const both = withLaunches({ [CAT.ticker]: launchOf(LO, ENTRY_O), [OTHER.ticker]: launchOf(LO, ENTRY_O) });
  const v = validateAdoptables(both);
  assert.deepEqual(v.refused, [], "no cat is dropped");
  assert.equal(v.cats.length, ADOPT.cats.length);
  const list = await residents({ adoptables: both, cats: [ENTRY_O] });
  const a = list.find((x) => x.id === CAT.ticker), b = list.find((x) => x.id === OTHER.ticker);
  assert.ok(a && b, "both cats are on the page");
  assert.equal(a.sanctuaryLaunch.status, "pending");
  assert.equal(b.sanctuaryLaunch.status, "launched");
  assert.equal(b.token.mint, LO.mint);
  assert.equal(list.filter((x) => x.id === LO.mint || x.token.mint === LO.mint).length, 1);
  const cats = listCats(PLANNED, { cats: [ENTRY_O] }, both);
  assert.deepEqual([cats.find((x) => x.key === CAT.ticker).launched, cats.find((x) => x.key === OTHER.ticker).launched], [false, true], "the announcer agrees");
  // Even two cats with the same name and ticker cannot both take one coin: the first in the file does.
  const twin = { ...OTHER, id: `${OTHER.id}-twin`, ticker: "TWINCAT", launchTicker: OTHER.launchTicker || OTHER.ticker, portrait: null, portraitStatus: "pending", lore: null, launch: launchOf(LO, ENTRY_O) };
  const twins = { ...ADOPT, cats: [...both.cats, twin] };
  assert.equal(validateAdoptables(twins).cats.length, ADOPT.cats.length + 1, "the twin is a valid cat");
  const tl = await residents({ adoptables: twins, cats: [ENTRY_O] });
  assert.ok(tl.some((x) => x.id === "TWINCAT"));
  assert.equal(tl.filter((x) => isLaunched(x) && x.token.mint === LO.mint).length, 1);
  assert.equal(listCats(PLANNED, { cats: [ENTRY_O] }, twins).filter((x) => x.launched && x.adoptable).length, 1);
});

test("a stranger's coin from the kit never adopts a cat the sanctuary launched or is launching", async () => {
  const row = { key: CAT.ticker, mint: "7Yk3fQeW9sPzD4nV2mXcR8tLbH6uJgA1oKqE5iNwTy3p", name: CAT.coinName || CAT.name, symbol: CAT.launchTicker || CAT.ticker,
    launchpad: "pump.fun", creator: "LGfWJwhiBVYhgK2opEaLvXtWydBnMdEdtvLC6FfpYTw", createdAt: "2026-09-27T08:34:07Z", foundAt: "2026-09-27T09:16:32Z", evidence: ["name", "ticker", "description"] };
  const control = (await residents({ adoptables: ADOPT, extra: { "data/adoptions.json": { adoptions: [row] } } })).find((x) => x.id === CAT.ticker);
  assert.equal(control.adoption?.mint, row.mint, "the row adopts the cat when it has no launch");
  for (const cats of [[ENTRY], []]) {
    const r = (await residents({ cats, extra: { "data/adoptions.json": { adoptions: [row] } } })).find((x) => x.id === CAT.ticker);
    assert.equal(r.adoption, null);
  }
});

test("provedLaunch / adoptableResident: launched only on an exact match of mint, tx and launchpad, carrying the cat's own ticker (case aside) and coin name (case, accents and punctuation aside)", () => {
  const c = { ...CAT, launch: LAUNCH };
  assert.equal(provedLaunch(c, [ENTRY]), ENTRY);
  assert.equal(adoptableResident(c, [ENTRY]).sanctuaryLaunch.status, "launched");
  assert.equal(adoptableResident(c, [ENTRY]).pair.symbol, "SOL");
  const name = ENTRY.name;
  for (const [what, e, ok] of [
    ["another mint", { ...ENTRY, mint: ENTRY.pool }, false],
    ["StonkFun's (no launchpad)", { ...ENTRY, launchpad: undefined }, false],
    ["another tx", { ...ENTRY, tx: PUMPFUN.answer.params[0] }, false],
    ["another ticker", { ...ENTRY, symbol: `${ENTRY.symbol}X` }, false],
    ["another name", { ...ENTRY, name: `${name} Inu` }, false],
    ["the ticker in lower case", { ...ENTRY, symbol: ENTRY.symbol.toLowerCase() }, true],
    ["the name in capitals, with punctuation", { ...ENTRY, name: `${name.toUpperCase()}!` }, true],
  ]) assert.equal(adoptableResident(c, [e]).sanctuaryLaunch.status, ok ? "launched" : "pending", what);
  assert.equal(provedLaunch(c, [null, {}, { mint: L.mint }]), null, "malformed entries are no proof");
  assert.equal(provedLaunch(CAT, [ENTRY]), null);
  assert.equal(adoptableResident(CAT, [ENTRY]).sanctuaryLaunch, undefined);
  assert.equal(adoptableResident(CAT, [ENTRY]).token.status, "planned");
});

test("announce listCats: the launched coin is the adoptable's, listed once under its ticker, never again as a cat of its own; launched by the page's own rule (C)", () => {
  const cats = listCats(PLANNED, { cats: [ENTRY] }, withLaunch());
  assert.ok(!cats.some((x) => x.key === L.mint || x.id === L.mint), "the coin is listed as a cat of its own");
  const cat = cats.find((x) => x.key === CAT.ticker);
  assert.equal(cat.launched, true);
  assert.equal(cat.sanctuary, true);
  const pending = listCats(PLANNED, { cats: [] }, withLaunch()).find((x) => x.key === CAT.ticker);
  assert.deepEqual([pending.launched, pending.sanctuary], [false, true]);
  assert.equal(listCats(PLANNED, { cats: [] }, ADOPT).find((x) => x.key === CAT.ticker).sanctuary, undefined);
});

test("the page and the announcer agree: a retry's other tx, a launchpad typo, another name or ticker is \"Launching…\" on both, and the coin is listed on neither (C)", async () => {
  for (const [what, launch, entry] of [
    ["retry: same mint, other tx", { ...LAUNCH, tx: PUMPFUN.answer.params[0] }, ENTRY],
    ["launchpad typo", { ...LAUNCH, launchpad: "stonkfun" }, ENTRY],
    ["another name", LAUNCH, { ...ENTRY, name: "Gull Gadot" }],
    ["another ticker", LAUNCH, { ...ENTRY, symbol: "GULLGADOT" }],
    ["proved", LAUNCH, ENTRY],
  ]) {
    const adoptables = withLaunch(launch);
    const page = await residents({ adoptables, cats: [entry] });
    const a = listCats(PLANNED, { cats: [entry] }, adoptables).find((c) => c.key === CAT.ticker);
    const r = page.find((x) => x.id === CAT.ticker);
    assert.equal(a.launched, isLaunched(r), what);
    assert.equal(a.launched, what === "proved", what);
    assert.ok(!page.some((x) => x.id === L.mint), `${what}: page`);
    assert.ok(!listCats(PLANNED, { cats: [entry] }, adoptables).some((c) => c.key === L.mint), `${what}: announcer`);
  }
});

test("a proved pump.fun coin no adoptable claims is never listed by the announcer (it is held, never drafted as a stranger's \"cat of SOL\") (D)", () => {
  const cats = listCats(PLANNED, { cats: [ENTRY_G] }, ADOPT);
  assert.ok(!cats.some((x) => x.key === LG.mint || x.id === LG.mint || x.ticker === ENTRY_G.symbol));
  // A StonkFun coin no cat has is listed by its mint, as before.
  const stonk = { ...ENTRY_G, launchpad: undefined, pair: { symbol: "GMEx", mint: "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc" } };
  delete stonk.launchpad;
  assert.deepEqual(listCats(PLANNED, { cats: [stonk] }, ADOPT).filter((x) => x.key === stonk.mint).map((x) => [x.launched, x.byMint]), [[true, true]]);
});

test("an unclaimed pump.fun coin's bare card: its own pair (SOL), its pump.fun page, pump.fun's disclaimer, and no stock-cat copy (G)", async () => {
  const list = await residents({ adoptables: ADOPT, cats: [ENTRY_G] });
  const r = list.find((x) => x.id === LG.mint);
  assert.ok(r && isLaunched(r));
  const c = renderCard(r);
  assert.equal(c.kicker, "Cat coin · priced in SOL");
  assert.ok(c.links.includes(`https://pump.fun/coin/${LG.mint}`), "its pump.fun page");
  assert.ok(c.text.includes("Its pump.fun page"));
  assert.ok(!c.links.some((h) => h.includes("stonkfun.xyz")));
  assert.ok(!/The real cat behind|StonkFun/.test(c.text), c.text);
  assert.equal(c.foot, "The coin is not affiliated with pump.fun. It has no intrinsic value and is not financial advice.");
  // with the adoptables unreadable (an optional file) the coin still gets its own card, the same way
  const alone = (await residents({ adoptables: 404, cats: [ENTRY_G] })).find((x) => x.id === LG.mint);
  assert.equal(renderCard(alone).foot, c.foot);
});
