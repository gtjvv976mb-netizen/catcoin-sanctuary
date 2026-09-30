/* Adoptions (scripts/lib/adoptions.mjs): which launch is a cat's adoption, the earliest kept, the
   file's check, and the shipped data/adoptions.json. No test reaches the network. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers.mjs";
import { kitsOf, ownMints, sameKit, matchAdoption, adoptionRecord, mergeAdoptions, checkAdoptions, adoptionProblem, linkKey, KITS_LIVE, NOTE } from "../scripts/lib/adoptions.mjs";

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const MINT = (n) => `${"So1anaMint".padEnd(38, "x")}${String(n).padStart(4, "0")}`.replace(/[0OIl]/g, "9");
const WALLET = (n) => `${"Wa11etAddr".padEnd(38, "z")}${String(n).padStart(4, "0")}`.replace(/[0OIl]/g, "8");
const STORY = "The Catbus (Nekobasu) is the twelve-legged grinning bus-cat of Hayao Miyazaki's My Neighbor Totoro (1988).";
const PROOF = "https://x.com/Rainmaker1973/status/1833451037694308415";
const SHA = "ab".repeat(32);
const at = (s) => Date.parse(s);

const cats = () => ({
  planned: { cats: [{ ticker: "WARMSPOT", name: "Warm Spot", description: "Warm Spot naps in the one patch of sun that reaches the porch every afternoon. A cat coin priced in SPYx. Not affiliated with State Street.", proof: { kind: "web", url: "https://example.org/warm" } }] },
  adoptables: { cats: [{ ticker: "NEKOBUS", name: "Catbus", coinName: "Nekobasu", launchTicker: "CATBUS", story: STORY, proof: { kind: "x", url: PROOF } }] },
  kits: { cats: { NEKOBUS: { tokenSha256: SHA }, WARMSPOT: { tokenSha256: "not a hash" } } },
});
/** A pump.fun row for the Catbus kit, with only its name and ticker unless told more. */
const launch = (o = {}) => ({ mint: MINT(1), name: "Nekobasu", symbol: "CATBUS", creator: WALLET(1), created_timestamp: at("2026-09-27T08:34:07Z"), ...o });

test("the kits: each cat's name and ticker as the Adopt panel gives them, its story's start, proof post, card and token hash", () => {
  const kits = kitsOf(cats());
  const neko = kits.find((k) => k.key === "NEKOBUS"), warm = kits.find((k) => k.key === "WARMSPOT");
  assert.deepEqual(neko, { key: "NEKOBUS", name: "Nekobasu", ticker: "CATBUS", storyStart: "thecatbusnekobasuisthetwelveleggedgrinni", proofUrl: PROOF,
    cardUrl: "https://catcoinsanctuary.com/#cat=NEKOBUS", tokenSha256: SHA });
  assert.equal(warm.name, "Warm Spot", "a planned cat's kit is its own name");
  assert.equal(warm.storyStart, "warmspotnapsintheonepatchofsunthatreache", "the story without the card's coin line");
  assert.equal(warm.tokenSha256, null, "a hash that is not one is ignored");
  assert.equal(kitsOf({}).length, 0);
});

test("a cat the sanctuary launches itself (a launch field) has no kit: no launch, however much of the kit it repeats, is its adoption; its coin is the owner's own (A)", () => {
  const launched = { mint: MINT(7), tx: "5".repeat(88), launchpad: "pump.fun", at: "2026-09-27T08:30:00Z" };
  const c = cats();
  c.adoptables.cats[0] = { ...c.adoptables.cats[0], launch: launched };
  const kits = kitsOf(c);
  assert.deepEqual(kits.map((k) => k.key), ["WARMSPOT"]);
  const clone = launch({ mint: MINT(8), description: STORY, twitter: PROOF, website: "https://catcoinsanctuary.com/#cat=NEKOBUS", imageSha256: SHA });
  assert.equal(matchAdoption(clone, kits), null);
  assert.equal(matchAdoption(clone, kitsOf(cats()))?.key, "NEKOBUS", "control: the same launch adopts a cat with no launch field");
  assert.deepEqual(ownMints({ collection: { cats: [{ mint: MINT(1) }, { mint: MINT(7) }] }, adoptables: c.adoptables }), [MINT(1), MINT(7)]);
  assert.deepEqual(ownMints({ adoptables: c.adoptables }), [MINT(7)], "a launch field's mint before the Collection proves it");
  assert.deepEqual(ownMints({}), []);
});

test("an adoption: the kit's ticker and name, and at least one more piece of the kit", () => {
  const kits = kitsOf(cats());
  assert.equal(matchAdoption(launch(), kits), null, "the name and ticker alone make a copycat, not an adoption");
  assert.deepEqual(matchAdoption(launch({ description: `${STORY} More words.` }), kits), { key: "NEKOBUS", evidence: ["name", "ticker", "description"] });
  assert.deepEqual(matchAdoption(launch({ description: "the catbus, nekobasu, is the twelve legged grinning bus cat…" }), kits)?.evidence, ["name", "ticker", "description"], "compared as letters and digits");
  assert.equal(matchAdoption(launch({ description: "The Catbus (Nekobasu) is a bus." }), kits), null, "too little of the story");
  assert.deepEqual(matchAdoption(launch({ twitter: "https://twitter.com/rainmaker1973/status/1833451037694308415?s=20" }), kits)?.evidence, ["name", "ticker", "proof-link"]);
  assert.deepEqual(matchAdoption(launch({ website: "www.catcoinsanctuary.com/#cat=nekobus" }), kits)?.evidence, ["name", "ticker", "card-link"]);
  assert.equal(matchAdoption(launch({ website: "https://catcoinsanctuary.com/#cat=WARMSPOT" }), kits), null, "another cat's card");
  assert.deepEqual(matchAdoption(launch({ imageSha256: SHA }), kits)?.evidence, ["name", "ticker", "image"]);
  assert.deepEqual(matchAdoption(launch({ symbol: "catbus", name: "NEKO-BASU 🚌", description: STORY, twitter: PROOF, website: "https://catcoinsanctuary.com/#cat=NEKOBUS" }), kits)?.evidence,
    ["name", "ticker", "description", "proof-link", "card-link"], "ticker in any case, name as letters and digits");
  assert.equal(matchAdoption(launch({ symbol: "$CATBUS", description: STORY }), kits), null, "the ticker exactly as the kit's");
  for (const extra of ["Nekobasu ХУЙ", "Nekobasu 傻逼", "Nekobasu x"]) assert.equal(matchAdoption(launch({ name: extra, description: STORY }), kits), null, `extra words in any script: ${extra}`);
  const odd = launch({ name: " Neko\u202ebasu\n", description: STORY });
  assert.equal(adoptionRecord(odd, matchAdoption(odd, kits), { foundAt: "2026-09-27T09:00:00Z" }).name, "Nekobasu", "a stranger's name is recorded clean");
  assert.equal(matchAdoption(launch({ name: "Catbus", description: STORY }), kits), null, "not the kit's name");
  assert.equal(matchAdoption(launch({ symbol: "NEKOBUS", description: STORY }), kits), null, "not the kit's ticker");
  assert.deepEqual(matchAdoption({ mint: MINT(2), name: "Warm Spot", symbol: "warmspot", created_timestamp: at("2026-09-26T00:00:00Z"), website: "https://catcoinsanctuary.com/#cat=WARMSPOT" }, kits),
    { key: "WARMSPOT", evidence: ["name", "ticker", "card-link"] }, "a planned cat's kit too, cat-themed name or not");
  assert.deepEqual(sameKit(launch(), kits).map((k) => k.key), ["NEKOBUS"]);
});

test("not an adoption: launched before the kits went live, the owner's own launch, or no address", () => {
  const kits = kitsOf(cats());
  const full = { description: STORY, twitter: PROOF };
  assert.equal(matchAdoption(launch({ ...full, created_timestamp: at(KITS_LIVE) - 1000 }), kits), null, "before 2026-09-25");
  assert.ok(matchAdoption(launch({ ...full, created_timestamp: undefined, createdAt: "2026-09-25T00:00:00Z" }), kits), "an ISO time will do");
  assert.equal(matchAdoption(launch(full), kits, { collectionMints: [MINT(1)] }), null, "a mint in data/collection.json is the owner's");
  assert.equal(matchAdoption(launch(full), kits, { ownerWallets: [WALLET(1)] }), null, "launched from the owner's wallet");
  assert.equal(matchAdoption(launch({ ...full, mint: "not a mint" }), kits), null);
  assert.equal(matchAdoption(null, kits), null);
});

test("one adoption per cat, the earliest; a later launch of the same kit (a spam relaunch) stays a copycat", () => {
  const kits = kitsOf(cats());
  const rec = (n, created, foundAt = "2026-09-27T09:00:00Z") => {
    const l = launch({ mint: MINT(n), description: STORY, created_timestamp: at(created) });
    return adoptionRecord(l, matchAdoption(l, kits), { foundAt });
  };
  const first = rec(1, "2026-09-27T08:34:07Z");
  assert.deepEqual(first, { key: "NEKOBUS", mint: MINT(1), name: "Nekobasu", symbol: "CATBUS", launchpad: "pump.fun", creator: WALLET(1),
    createdAt: "2026-09-27T08:34:07Z", foundAt: "2026-09-27T09:00:00Z", evidence: ["name", "ticker", "description"] });
  const spam = rec(2, "2026-09-27T08:40:00Z");
  assert.deepEqual(mergeAdoptions([first], [spam]), [first], "the relaunch matches the kit but came later");
  assert.deepEqual(mergeAdoptions([], [spam, first]), [first], "the earliest, whatever order they were found in");
  const earlier = rec(3, "2026-09-26T12:00:00Z");
  assert.deepEqual(mergeAdoptions([first], [earlier]), [earlier], "an earlier launch found later takes the cat");
  assert.deepEqual(mergeAdoptions([first], [{ ...first, foundAt: "2026-09-27T10:00:00Z" }]), [first], "found again: the record stays as it was");
  const warm = { ...first, key: "WARMSPOT", mint: MINT(4), createdAt: "2026-09-26T00:00:00Z" };
  assert.deepEqual(mergeAdoptions([first], [warm]).map((a) => a.key), ["WARMSPOT", "NEKOBUS"], "one per cat, oldest first");
  assert.deepEqual(mergeAdoptions([first], [{ ...warm, mint: MINT(1) }]).map((a) => a.key), ["WARMSPOT"], "a mint is one cat's adoption at most");
});

test("the file's check: every field, the evidence, and no cat or mint twice", () => {
  const good = { key: "NEKOBUS", mint: MINT(1), name: "Nekobasu", symbol: "CATBUS", launchpad: "pump.fun", creator: WALLET(1),
    createdAt: "2026-09-27T08:34:07Z", foundAt: "2026-09-27T09:00:00Z", evidence: ["name", "ticker", "description"] };
  const file = (...adoptions) => ({ note: NOTE, adoptions });
  assert.deepEqual(checkAdoptions(file(good)), []);
  assert.deepEqual(checkAdoptions(file()), []);
  assert.deepEqual(checkAdoptions(null), ["not a JSON object"]);
  assert.deepEqual(checkAdoptions([]), ["not a JSON object"]);
  assert.match(checkAdoptions({ adoptions: [] }).join(), /note/);
  assert.match(checkAdoptions({ note: NOTE, adoptions: {} }).join(), /must be a list/);
  const bad = (o, re) => { const p = checkAdoptions(file({ ...good, ...o })); assert.equal(p.length, 1, JSON.stringify(o)); assert.match(p[0], re); };
  bad({ key: "../x" }, /key/);
  bad({ mint: "0OIl" + "x".repeat(40) }, /mint/);
  bad({ creator: "" }, /creator/);
  bad({ name: " " }, /name/);
  bad({ name: "Neko\u202ebasu" }, /name/);
  bad({ symbol: "CAT BUS" }, /symbol/);
  bad({ launchpad: "raydium" }, /launchpad/);
  bad({ createdAt: "2026-09-27 08:34" }, /ISO/);
  bad({ foundAt: undefined }, /ISO/);
  bad({ createdAt: "2026-09-24T23:59:59Z" }, /before the kits/);
  bad({ foundAt: "2026-09-27T08:00:00Z" }, /found before/);
  bad({ evidence: ["name", "ticker"] }, /at least one more/);
  bad({ evidence: ["name", "description", "image"] }, /the name, the ticker/);
  bad({ evidence: ["name", "ticker", "vibes"] }, /evidence/);
  bad({ evidence: ["name", "ticker", "image", "image"] }, /evidence/);
  bad({ evidence: "name,ticker,image" }, /evidence/);
  assert.match(checkAdoptions(file(good, { ...good, mint: MINT(2) })).join(), /NEKOBUS is adopted twice/);
  assert.match(checkAdoptions(file(good, { ...good, key: "WARMSPOT" })).join(), /listed twice/);
  assert.match(checkAdoptions(file(good), { keys: ["WARMSPOT"] }).join(), /not a sanctuary cat/);
  assert.equal(adoptionProblem(good), null);
  assert.equal(linkKey("javascript:alert(1)"), null);
  assert.equal(linkKey("https://x.com/a/status/123456/photo/1"), linkKey("twitter.com/B/status/123456"));
});

test("the shipped data/adoptions.json passes its check, and each adoption is a stranger's coin from the cat's own kit", () => {
  const j = read("data/adoptions.json");
  const planned = read("data/planned.json"), adoptables = read("data/adoptables.json"), collection = read("data/collection.json"), wallets = read("data/wallets.json");
  const keys = [...planned.cats, ...adoptables.cats].map((c) => c.ticker);
  assert.deepEqual(checkAdoptions(j, { keys }), []);
  const kits = kitsOf({ planned, adoptables, kits: read("assets/kits/kits.json") });
  const ours = new Set(collection.cats.map((c) => c.mint));
  for (const a of j.adoptions) {
    assert.ok(!ours.has(a.mint), `${a.key}: the owner's own launch is not an adoption`);
    assert.ok(!wallets.launchers.some((w) => w.address === a.creator), `${a.key}: launched from the owner's wallet`);
    assert.deepEqual(sameKit({ name: a.name, symbol: a.symbol }, kits).map((k) => k.key), [a.key], `${a.key}: its name and ticker are the cat's kit's`);
    const cat = adoptables.cats.find((c) => c.ticker === a.key);
    assert.notEqual(cat?.existingCoin?.contract, a.mint, `${a.key}: its adoption is not an unrelated existing coin`);
  }
  // The one today: Catbus, from its kit's name, ticker, story and proof post (as pump.fun shows it).
  const neko = j.adoptions.find((a) => a.key === "NEKOBUS");
  assert.equal(neko.mint, "Hqge3as7GhF2JqVfTkpaj9BUq9tGAFSnpwWHBie5pump");
  // Its launch as pump.fun served it on 2026-09-27 (a fixture: the cat's research may be reworded later).
  const row = { mint: neko.mint, name: "Nekobasu", symbol: "CATBUS", creator: neko.creator, created_timestamp: at(neko.createdAt),
    description: "The Catbus (Nekobasu) is the twelve-legged grinning bus-cat of Hayao Miyazaki's My Neighbor Totoro (1988); the Ghibli Museum has a ride-in Catbus.",
    twitter: "https://x.com/Rainmaker1973/status/1833451037694308415" };
  assert.deepEqual(matchAdoption(row, kits, { collectionMints: [...ours] })?.key, "NEKOBUS");
});
