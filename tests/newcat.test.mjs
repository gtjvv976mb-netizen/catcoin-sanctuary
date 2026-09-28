/* The "New cat just moved in!" highlight: which cat it picks, once per visitor, and its lore line. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers.mjs";
import { pickHighlight, teaser, MAX_AGE_DAYS, createNewCat } from "../assets/ui/newcat.js";
import { installDom, Element } from "./minidom.mjs";
import { adoptableResident } from "../assets/residents.js";
import { normalize } from "../assets/ui/data.js";
import { canAdopt } from "../assets/ui/adopt.js";

const NOW = Date.parse("2026-10-01T12:00:00Z");
const FILE = { released: [{ key: "OLD", releasedAt: "2026-10-01T09:00:00Z" }, { key: "NEW", releasedAt: "2026-10-01T11:00:00Z" }] };

test("the newest released cat, unless this visitor has seen it or it is stale", () => {
  assert.equal(pickHighlight(FILE, new Set(), NOW).key, "NEW");
  assert.equal(pickHighlight(FILE, new Set(["NEW"]), NOW), null);
  assert.equal(pickHighlight(FILE, new Set(), NOW + (MAX_AGE_DAYS + 1) * 86_400_000), null);
  assert.equal(pickHighlight({}, new Set(), NOW), null);
  assert.equal(pickHighlight(null, new Set(), NOW), null);
});

test("the teaser is the lore caption, else the story's first sentence, one short line", () => {
  assert.equal(teaser({ lore: { caption: "Naps on the keyboard." }, description: "Long story. More." }), "Naps on the keyboard.");
  assert.equal(teaser({ description: "A calico. Loves boxes." }), "A calico.");
  assert.ok(teaser({ description: "x ".repeat(200) }).length <= 110);
});

test("the page has the highlight's box, its styles, and main.js wires it (no inline styles or scripts)", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /<aside class="newcat" id="newcat" aria-live="polite" hidden><\/aside>/);
  assert.doesNotMatch(html, /\sstyle=/);
  const css = fs.readFileSync(path.join(ROOT, "assets/site.css"), "utf8");
  assert.match(css, /\.newcat-adopt \{[^}]*#ff9f43, #ff6fa8/);
  const main = fs.readFileSync(path.join(ROOT, "assets/ui/main.js"), "utf8");
  assert.match(main, /createNewCat\(/);
  const js = fs.readFileSync(path.join(ROOT, "assets/ui/newcat.js"), "utf8");
  assert.match(js, /try \{[^}]*localStorage/);
  assert.doesNotMatch(js, /innerHTML/);
});

test("the banner offers \"Adopt this cat\" only for a cat that can be adopted: never one the sanctuary launched or is launching, one adopted or launched (E)", async () => {
  const remove = installDom();
  try {
    const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "data/adoptables.json"), "utf8")).cats[0];
    const launch = { mint: "EW98MVsJQEv5P83quwU1JxQFES6DtMSBCmArJJE8uS8S", tx: "3KaiwR4HQauPHZd95wURuffsEgGcxxJawGjXr8XLvLEUx5PbRBvQvo1gHb2QyiiYL5Na6LyhxsWdFyoouYjbmkcF", launchpad: "pump.fun", at: "2026-09-26T00:00:00Z" };
    const plain = normalize(adoptableResident(cat, []));
    const launching = normalize(adoptableResident({ ...cat, launch }, []));
    const adopted = { ...plain, adoption: { mint: launch.mint, name: cat.name, symbol: cat.ticker, launchpad: "pump.fun", createdAt: "2026-09-27T00:00:00Z" } };
    const launched = { ...plain, token: { status: "launched", mint: launch.mint } };
    for (const [what, r, offered] of [["adoptable", plain, true], ["launching", launching, false], ["adopted", adopted, false], ["launched", launched, false]]) {
      assert.equal(canAdopt(r), offered, what);
      const root = new Element("aside");
      let adopts = 0;
      const nc = createNewCat({ root, lookup: () => r, onMeet() {}, onAdopt() { adopts++; }, pollMs: 0, storage: null, now: () => NOW,
        fetchImpl: async () => new Response(JSON.stringify({ released: [{ key: r.id, releasedAt: new Date(NOW - 60_000).toISOString() }] })) });
      assert.equal(await nc.check(), r.id, what);
      const buttons = root.querySelectorAll("button").map((b) => b.textContent);
      assert.ok(buttons.includes(`Meet ${r.name.split(/\s+the\s+/i)[0]}`), what);
      assert.equal(buttons.includes("🐾 Adopt this cat"), offered, `${what}: ${buttons}`);
      if (offered) { root.querySelector("button.newcat-adopt").click(); assert.equal(adopts, 1); }
    }
  } finally { remove(); }
});
