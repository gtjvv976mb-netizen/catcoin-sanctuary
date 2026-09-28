/* The adoptable cats: data/adoptables.json as shipped, the rules in assets/ui/adoptables.js, and
   scripts/build-adoptables.mjs. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./helpers.mjs";
import { validateAdoptables, adoptableProblem, existingCoinLine, tributeLine, ADOPTABLE_CATEGORIES, loreProblem, lorePath } from "../assets/ui/adoptables.js";
import { buildAdoptables, usable, AdoptablesError } from "../scripts/build-adoptables.mjs";
import { coatProblem } from "../assets/collection.js";

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const DATA = read("data/adoptables.json");
const PLANNED = read("data/planned.json");

test("shipped: every adoptable cat passes the rules, with a free ticker no planned cat uses", () => {
  const v = validateAdoptables(DATA, { taken: new Set(PLANNED.cats.map((c) => c.ticker)) });
  assert.deepEqual(v.refused, []);
  assert.equal(v.cats.length, DATA.cats.length);
  for (const c of DATA.cats) {
    assert.ok(ADOPTABLE_CATEGORIES.includes(c.category));
    assert.equal(coatProblem(c.coat), null, c.ticker);
    assert.ok(c.portrait === null || fs.existsSync(path.join(ROOT, c.portrait)), `${c.ticker}: portrait file`);
    if (c.lore) {
      const f = path.join(ROOT, c.lore.image);
      assert.ok(fs.existsSync(f), `${c.ticker}: lore file`);
      const b = fs.readFileSync(f);
      assert.equal(b.subarray(0, 4).toString(), "RIFF", `${c.ticker}: lore is a WebP`);
      assert.equal(b.subarray(8, 12).toString(), "WEBP", `${c.ticker}: lore is a WebP`);
      assert.ok(b.length <= 220_000, `${c.ticker}: lore picture is ${b.length} bytes (budget ~200 KB)`);
    }
  }
});

test("shipped: every lore caption in data/lore.json belongs to a cat and has its picture", () => {
  const lore = read("data/lore.json").cats;
  for (const [t, cap] of Object.entries(lore)) {
    assert.equal(loreProblem({ image: lorePath(t), caption: cap }, t), null, t);
    assert.ok(fs.existsSync(path.join(ROOT, lorePath(t))), `${t}: lore picture`);
  }
  for (const c of DATA.cats) if (lore[c.ticker]) assert.deepEqual(c.lore, { image: lorePath(c.ticker), caption: lore[c.ticker] }, c.ticker);
});

test("rules: a lore picture must be the cat's own file with a short caption", () => {
  assert.equal(loreProblem(null, "LARRY10"), null);
  assert.equal(loreProblem(undefined, "LARRY10"), null);
  assert.equal(loreProblem({ image: "assets/lore/LARRY10.webp", caption: "Larry on the Downing Street doorstep." }, "LARRY10"), null);
  assert.match(loreProblem({ image: "assets/lore/MARUBOX.webp", caption: "Larry on the Downing Street doorstep." }, "LARRY10"), /lore image/);
  assert.match(loreProblem({ image: "assets/lore/LARRY10.webp", caption: "short" }, "LARRY10"), /caption/);
  assert.match(loreProblem({ image: "assets/lore/LARRY10.webp", caption: "Larry goes to the moon, 100x soon." }, "LARRY10"), /price/);
  assert.match(loreProblem({ image: "assets/lore/LARRY10.webp", caption: "Larry on the doorstep.", extra: 1 }, "LARRY10"), /lore must be/);
  assert.match(adoptableProblem({ ...structuredClone(DATA.cats[0]), lore: { image: "x.webp", caption: "A caption that is long enough." } }), /lore image/);
});

test("shipped: every adoptable cat has an announce record (held until released, then backlog/posted)", () => {
  const ann = read("data/announced.json").cats;
  for (const c of DATA.cats) assert.ok(["held", "backlog", "posted", "queued", "failed"].includes(ann[c.ticker]?.status), c.ticker);
});

test("rules: a bad cat is refused", () => {
  const good = DATA.cats[0];
  assert.equal(adoptableProblem(good), null);
  const bad = (patch) => adoptableProblem({ ...structuredClone(good), ...patch });
  assert.match(bad({ category: "stock" }), /category/);
  assert.match(bad({ ticker: "bad ticker" }), /ticker/);
  assert.match(bad({ proof: { ...good.proof, url: "https://example.com/x/status/123456" } }), /x\.com/);
  assert.match(bad({ proof: { ...good.proof, handle: "someoneelse" } }), /author/);
  assert.match(bad({ tribute: "Official cat." }), /tribute/);
  assert.match(bad({ portrait: "assets/portraits/X.jpg", portraitStatus: "pending" }), /portrait/);
  assert.match(bad({ story: `${good.story} To the moon!` }), /price/);
  assert.match(bad({ extra: 1 }), /unknown field/);
  const dup = validateAdoptables({ cats: [good, good] });
  assert.equal(dup.cats.length, 1);
  assert.equal(validateAdoptables({ cats: [good] }, { taken: new Set([good.ticker]) }).cats.length, 0);
});

test("existing coin and tribute lines read as the card shows them", () => {
  assert.equal(existingCoinLine({ symbol: "MARU", mcapUsd: 7510 }), "A small coin already exists: $MARU, ~$8k — not affiliated.");
  assert.equal(existingCoinLine({ symbol: "GREY", mcapUsd: 0 }), "A small coin already exists: $GREY, no live market — not affiliated.");
  assert.equal(existingCoinLine(null), null);
  assert.equal(tributeLine("Taylor Swift"), "Fan tribute, not affiliated with or endorsed by Taylor Swift.");
});

test("build: takes the strongest cats, skips low confidence and unsettled looks, marks portraits pending, holds new cats", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-"));
  fs.mkdirSync(path.join(root, "data")); fs.mkdirSync(path.join(root, "assets/portraits"), { recursive: true });
  fs.writeFileSync(path.join(root, "data/planned.json"), JSON.stringify({ stocks: [], cats: [] }));
  fs.writeFileSync(path.join(root, "data/announced.json"), JSON.stringify({ cats: { LARRY10: { status: "posted" } } }));
  const row = (id, ticker, extra = {}) => ({
    id, catName: id, category: "viral", owner: "Someone", story: "A very well known cat whose story is long enough to show.",
    proof: { x: [{ url: `https://x.com/someone/status/1234567${id.length}`, handle: "@someone", date: "2024-01-02", text: "A post about the cat." }], web: [{ url: "https://example.org/cat", title: "A page" }] },
    existingCoin: null, suggestedName: id, suggestedTicker: ticker, look: "Orange tabby cat with white chest; green eyes.", pairSuggestion: "STONK", sensitivityNotes: "", confidence: "high", ...extra,
  });
  const src = path.join(root, "src.json");
  fs.writeFileSync(src, JSON.stringify([row("larry", "LARRY10"), row("low", "LOWCAT", { confidence: "low" }), row("unsure", "UNSURE", { look: "Tabby (verify with photos)" }), row("maru", "MARUBOX"), row("third", "THIRDCAT")]));
  fs.writeFileSync(path.join(root, "assets/portraits/MARUBOX.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
  fs.mkdirSync(path.join(root, "assets/lore"));
  fs.writeFileSync(path.join(root, "assets/lore/MARUBOX.webp"), Buffer.from("RIFF0000WEBP"));
  fs.writeFileSync(path.join(root, "assets/lore/LARRY10.webp"), Buffer.from("RIFF0000WEBP"));
  fs.writeFileSync(path.join(root, "data/lore.json"), JSON.stringify({ cats: { MARUBOX: "Maru squeezing into a box far too small for him." } }));
  const r = buildAdoptables({ root, source: src, top: 2, checked: "2026-09-26" });
  assert.deepEqual(r.data.cats.map((c) => c.ticker), ["LARRY10", "MARUBOX"]);
  assert.deepEqual(r.pending, ["LARRY10"]);
  assert.equal(r.data.cats[1].memorial, true);
  assert.equal(r.data.cats[1].portrait, "assets/portraits/MARUBOX.jpg");
  assert.deepEqual(r.data.cats[1].lore, { image: "assets/lore/MARUBOX.webp", caption: "Maru squeezing into a box far too small for him." });
  assert.equal(r.data.cats[0].lore, null, "a picture with no caption is not shown");
  const ann = JSON.parse(fs.readFileSync(path.join(root, "data/announced.json"), "utf8")).cats;
  assert.equal(ann.LARRY10.status, "posted", "an existing record is never changed");
  assert.equal(ann.MARUBOX.status, "held");
  assert.equal(usable({ confidence: "low", look: "x" }), false);
  fs.writeFileSync(path.join(root, "data/planned.json"), JSON.stringify({ stocks: [], cats: [{ ticker: "LARRY10" }] }));
  assert.throws(() => buildAdoptables({ root, source: src, top: 2 }), AdoptablesError);
});

test("build: a rebuild keeps the sanctuary's launches: a launch field survives, a changed name or ticker keeps the launched row, a cat the research dropped (or the launcher added) stays; an unreadable file stops it (K)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-launch-"));
  fs.mkdirSync(path.join(root, "data")); fs.mkdirSync(path.join(root, "assets/portraits"), { recursive: true });
  fs.writeFileSync(path.join(root, "data/planned.json"), JSON.stringify({ stocks: [], cats: [] }));
  fs.writeFileSync(path.join(root, "data/announced.json"), JSON.stringify({ cats: {} }));
  const row = (id, ticker, extra = {}) => ({
    id, catName: id, category: "viral", owner: "Someone", story: "A very well known cat whose story is long enough to show.",
    proof: { x: [{ url: `https://x.com/someone/status/1234567${id.length}`, handle: "@someone", date: "2024-01-02", text: "A post about the cat." }], web: [] },
    existingCoin: null, suggestedName: id, suggestedTicker: ticker, look: "Orange tabby cat with white chest; green eyes.", pairSuggestion: "STONK", confidence: "high", ...extra,
  });
  const src = path.join(root, "src.json");
  const put = (rows) => fs.writeFileSync(src, JSON.stringify(rows));
  const launch = (n) => ({ mint: `${"LaunchMint".padEnd(40, "x")}${n}`.replace(/[0OIl]/g, "9"), tx: String(n).repeat(88).slice(0, 88).replace(/0/g, "9"), launchpad: "pump.fun", at: "2026-09-28T10:00:00Z" });
  put([row("alpha", "ALPHACAT"), row("beta", "BETACAT"), row("gamma", "GAMMACAT")]);
  const first = buildAdoptables({ root, source: src, top: 3, checked: "2026-09-28" });
  // The launcher writes launch fields (and adds a cat of its own).
  const cur = structuredClone(first.data);
  cur.cats[0].launch = launch(1);
  cur.cats[1].launch = launch(2);
  const own = { ...structuredClone(cur.cats[2]), id: "delta", ticker: "DELTACAT", name: "delta", coinName: "delta", launch: launch(3) };
  cur.cats.push(own);
  fs.writeFileSync(path.join(root, "data/adoptables.json"), JSON.stringify(cur, null, 2));
  // The research renames beta's coin and drops gamma; alpha is unchanged.
  put([row("alpha", "ALPHACAT"), row("beta", "BETACAT", { suggestedName: "Beta the Great" })]);
  const logs = [];
  const r = buildAdoptables({ root, source: src, top: 3, checked: "2026-09-29", log: (m) => logs.push(m) });
  const written = JSON.parse(fs.readFileSync(path.join(root, "data/adoptables.json"), "utf8"));
  assert.deepEqual(written, r.data);
  assert.deepEqual(written.cats.map((c) => [c.ticker, c.launch?.mint ?? null]), [["ALPHACAT", launch(1).mint], ["BETACAT", launch(2).mint], ["DELTACAT", launch(3).mint]]);
  assert.equal(written.cats[1].coinName, "beta", "the coin exists on chain under its launched name: the launched row is kept");
  assert.ok(!written.cats.some((c) => c.ticker === "GAMMACAT"), "a dropped cat with no launch goes");
  assert.equal(logs.filter((m) => /launched by the sanctuary/.test(m)).length, 2);
  assert.deepEqual(validateAdoptables(written).refused, []);
  // Rebuilt again from the same research: nothing changes.
  buildAdoptables({ root, source: src, top: 3, checked: "2026-09-29" });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, "data/adoptables.json"), "utf8")), written);
  // A current file that cannot be read: nothing is written.
  fs.writeFileSync(path.join(root, "data/adoptables.json"), "{ not json");
  assert.throws(() => buildAdoptables({ root, source: src, top: 3 }), /launch fields would be lost/);
  assert.equal(fs.readFileSync(path.join(root, "data/adoptables.json"), "utf8"), "{ not json");
});
