/* An adoptable cat the sanctuary launched itself (its optional `launch` field in data/adoptables.json,
   written by the automatic launcher): the rules for the field (assets/ui/adoptables.js), the page
   (assets/residents.js, assets/ui/data.js, assets/ui/card.js: "Launched by the sanctuary" only once
   data/collection.json has proved that mint, "Launching…" until then, one card per cat, no Adopt
   button) and the X announcer (scripts/announce.mjs listCats: the coin is the cat's, never a cat of
   its own). The launch is one built and signed offline by scripts/lib/pump.mjs with a throwaway key. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { ROOT, DATA_NOW, pumpLaunch, PUMPFUN } from "./helpers.mjs";
import { installDom, Element } from "./minidom.mjs";
import { proveLaunchPump } from "../scripts/lib/chain.mjs";
import { loadResidents, adoptableResident } from "../assets/residents.js";
import { validateAdoptables, adoptableProblem, launchProblem } from "../assets/ui/adoptables.js";
import { normalize, isLaunched } from "../assets/ui/data.js";
import { createCard, badgeFor, tickerLabel } from "../assets/ui/card.js";
import { canAdopt } from "../assets/ui/adopt.js";
import { listCats } from "../scripts/announce.mjs";

const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };
const BASE = pathToFileURL(`${ROOT}/`);
const ADOPT = read("data/adoptables.json");
const PLANNED = read("data/planned.json");

/* The launch: proved exactly as the builder proves it, and written the way the builder writes it. */
const L = pumpLaunch();
const ENTRY = (() => {
  const { launch: x } = proveLaunchPump(L.tx, { wallet: L.wallet });
  return { mint: x.mint, name: x.name, symbol: x.symbol, pair: x.pair, pool: x.pool, payer: x.payer, tx: x.tx, time: x.time, launchpad: x.launchpad };
})();
const WALLETS = { launchers: [...read("data/wallets.json").launchers, { address: L.wallet, since: "2026-09-01", label: "Auto launcher" }] };
const LAUNCH = Object.freeze({ mint: L.mint, tx: L.signature, launchpad: "pump.fun", at: ENTRY.time });

/** The cat the tests launch: the first shipped adoptable the page shows (not held back by the release queue). */
const baseline = await quiet(() => loadResidents({ base: BASE, nowMs: DATA_NOW, fetchImpl: siteWith() }));
const CAT = ADOPT.cats.find((c) => baseline.some((r) => r.id === c.ticker && r.kind === "adoptable"));
const withLaunch = (launch = LAUNCH, key = CAT.ticker) => ({ ...ADOPT, cats: ADOPT.cats.map((c) => (c.ticker === key ? { ...c, launch } : c)) });

/** The site as shipped, with some data files swapped (a value is served as JSON). */
function siteWith(over = {}) {
  return async (url) => {
    const rel = path.relative(ROOT, fileURLToPath(url)).split(path.sep).join("/");
    if (rel in over) return new Response(JSON.stringify(over[rel]), { status: 200 });
    const file = path.join(ROOT, rel);
    return fs.existsSync(file) ? new Response(fs.readFileSync(file), { status: 200 }) : new Response("not found", { status: 404 });
  };
}
const raw = ({ adoptables = withLaunch(), cats = [ENTRY], extra = {} } = {}) => quiet(() => loadResidents({ base: BASE, nowMs: DATA_NOW, fetchImpl: siteWith({
  "data/adoptables.json": adoptables, "data/collection.json": { cats }, "data/wallets.json": WALLETS, ...extra,
}) }));
const residents = async (o) => (await raw(o)).map(normalize).filter(Boolean);

function renderCard(r) {
  const root = new Element("aside");
  const card = createCard({ root, onClose() {}, onInset() {} });
  card.open(r, { focus: false });
  return { root, text: root.textContent, links: root.querySelectorAll("a").map((a) => a.href) };
}
let removeDom;
test.before(() => { removeDom = installDom(); });
test.after(() => removeDom?.());

test("the launch field: optional, closed, base58 mint and tx, a known launchpad, an exact ISO time; one mint launches one cat", () => {
  assert.ok(CAT, "a shipped adoptable the page shows");
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
  const other = ADOPT.cats.find((c) => c !== CAT);
  const v = validateAdoptables({ cats: [{ ...CAT, launch: LAUNCH }, { ...other, launch: LAUNCH }] });
  assert.equal(v.cats.length, 1);
  assert.match(v.refused[0].detail, /launch mint used twice/);
});

test("proved: the adoptable shows as launched by the sanctuary, with its coin's links; the coin's bare token card is dropped (one card per cat)", async () => {
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
  assert.equal(r.adoption, null);
  assert.equal(canAdopt(r), false);
});

test("the launched card: the Launched badge, $TICKER, \"Launched by the sanctuary\", its pump.fun and Solscan pages, and no Adopt button", async () => {
  const r = (await residents()).find((x) => x.id === CAT.ticker);
  const c = renderCard(r);
  assert.equal(badgeFor(r).textContent, "Launched");
  assert.equal(tickerLabel(r), `$${CAT.launchTicker || CAT.ticker}`);
  assert.ok(c.text.includes(`Launched by the sanctuary on pump.fun on `), c.text);
  assert.ok(c.text.includes(`$${CAT.launchTicker || CAT.ticker}`));
  assert.ok(c.text.includes(`${L.mint.slice(0, 4)}…${L.mint.slice(-4)}`));
  for (const href of [`https://pump.fun/coin/${L.mint}`, `https://solscan.io/token/${L.mint}`, `https://solscan.io/tx/${L.signature}`]) assert.ok(c.links.includes(href), href);
  assert.ok(!c.links.some((h) => /stonkfun\.xyz\/token/.test(h)));
  assert.ok(!/Not launched yet|adopt it now|Planned ticker/.test(c.text), "a pre-launch line on a launched cat");
  assert.equal(c.root.querySelector("button.btn-adopt"), null);
  assert.match(c.root.querySelector("p.card-disclaimer").textContent, /Launched by the sanctuary\. Not financial advice\.$/);
});

test("not proved yet: \"Launching…\", never launched on the launcher's word alone, no mint shown, no Adopt button; the wrong tx or launchpad is not proof", async () => {
  for (const [what, o] of [
    ["not in the collection", { cats: [] }],
    ["another transaction", { cats: [{ ...ENTRY, tx: PUMPFUN.answer.params[0] }] }],
    ["another launchpad", { adoptables: withLaunch({ ...LAUNCH, launchpad: "stonkfun" }) }],
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
  }
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

test("adoptableResident: launched only on an exact match of mint, tx and launchpad in the proved list", () => {
  const c = { ...CAT, launch: LAUNCH };
  assert.equal(adoptableResident(c, [ENTRY]).sanctuaryLaunch.status, "launched");
  assert.equal(adoptableResident(c, [{ ...ENTRY, mint: ENTRY.pool }]).sanctuaryLaunch.status, "pending");
  assert.equal(adoptableResident(c, [{ ...ENTRY, launchpad: undefined }]).sanctuaryLaunch.status, "pending");
  assert.equal(adoptableResident(CAT, [ENTRY]).sanctuaryLaunch, undefined);
  assert.equal(adoptableResident(CAT, [ENTRY]).token.status, "planned");
});

test("announce listCats: the launched coin is the adoptable's, listed once under its ticker, never again as a cat of its own", () => {
  const plain = listCats(PLANNED, { cats: [ENTRY] }, ADOPT);
  assert.ok(plain.some((x) => x.key === L.mint), "without the launch field, an unclaimed coin is listed by its mint");
  const cats = listCats(PLANNED, { cats: [ENTRY] }, withLaunch());
  assert.equal(cats.length, plain.length - 1);
  assert.ok(!cats.some((x) => x.key === L.mint || x.id === L.mint), "the coin is listed as a cat of its own");
  const cat = cats.find((x) => x.key === CAT.ticker);
  assert.equal(cat.launched, true);
  assert.equal(cat.sanctuary, true);
  const pending = listCats(PLANNED, { cats: [] }, withLaunch()).find((x) => x.key === CAT.ticker);
  assert.deepEqual([pending.launched, pending.sanctuary], [false, true]);
  assert.equal(listCats(PLANNED, { cats: [] }, ADOPT).find((x) => x.key === CAT.ticker).sanctuary, undefined);
});
