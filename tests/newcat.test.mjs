/* The "New cat just moved in!" highlight: which cat it picks, once per visitor, and its lore line. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers.mjs";
import { pickHighlight, teaser, MAX_AGE_DAYS } from "../assets/ui/newcat.js";

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
