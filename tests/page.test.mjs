/* The page itself, read as text: no path from data to HTML, and no call to another host at run
   time (outbound links are fine). Covers every script the page loads except the vendored
   three.js. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers.mjs";

function scripts(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "vendor") out.push(...scripts(rel)); } else if (/\.m?js$/.test(e.name)) out.push(rel);
  }
  return out;
}
const PAGE_SCRIPTS = scripts("assets");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const INDEX = read("index.html");
const inline = [...INDEX.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

test("the page's own scripts include residents.js and collection.js", () => {
  assert.ok(PAGE_SCRIPTS.includes("assets/residents.js"));
  assert.ok(PAGE_SCRIPTS.includes("assets/collection.js"));
});

test("no HTML injection path: no HTML sinks, and innerHTML only ever takes a fixed string", () => {
  for (const rel of PAGE_SCRIPTS) {
    const text = read(rel);
    for (const sink of [/\.outerHTML\s*=/, /insertAdjacentHTML\s*\(/, /document\.write(ln)?\s*\(/, /\bsrcdoc\b/, /new\s+DOMParser\b/, /createContextualFragment\s*\(/, /\beval\s*\(/, /new\s+Function\s*\(/, /setHTMLUnsafe\s*\(/]) {
      assert.ok(!sink.test(text), `${rel}: ${sink}`);
    }
    for (const m of text.matchAll(/\.innerHTML\s*(\+?=)\s*([^;\n]*)/g)) {
      const [, op, value] = m;
      assert.equal(op, "=", `${rel}: innerHTML +=`);
      assert.match(value.trim(), /^(['"])(?:(?!\1)[^\\$]|\\.)*\1$/, `${rel}: innerHTML is set from something other than a fixed string: ${value.slice(0, 60)}`);
    }
  }
  for (const s of inline) assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(s), "an inline script writes HTML");
});

test("no call to another host at run time: fetches and imports are relative, and the page's policy allows only its own origin", () => {
  for (const rel of PAGE_SCRIPTS) {
    const text = read(rel);
    assert.ok(!/\bfetch\s*\(\s*['"`]https?:/.test(text), `${rel} fetches another host`);
    assert.ok(!/\bimport\s*\(\s*['"`]https?:/.test(text) && !/\bfrom\s+['"`]https?:/.test(text), `${rel} imports from another host`);
    assert.ok(!/new\s+(WebSocket|EventSource)\s*\(/.test(text), `${rel} opens a socket`);
    assert.ok(!/navigator\.sendBeacon/.test(text), `${rel} sends a beacon`);
  }
  const csp = INDEX.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];
  assert.ok(csp, "index.html sets a Content-Security-Policy");
  const directive = (name) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? "";
  assert.match(directive("default-src"), /^default-src 'self'$/);
  for (const name of ["connect-src", "script-src", "img-src", "font-src", "style-src"]) {
    // The one exception: img-src shows the credited proof photo in the Adopt panel, hotlinked from X's image host (never copied here).
    const d = name === "img-src" ? directive(name).replace(/ https:\/\/pbs\.twimg\.com(?= |$)/, "") : directive(name);
    if (d) assert.ok(!/https?:|\*|wss?:/.test(d), `${name} allows another host: ${d}`);
  }
  for (const src of [...INDEX.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1])) {
    if (/^https?:/.test(src)) assert.ok(!/\.(m?js|css|woff2?|glb|json)(\?|$)/.test(src), `index.html loads ${src}`);
  }
});

test("the residents module fetches only the eight data files, relative to the site", () => {
  const text = read("assets/residents.js");
  const fetched = [...text.matchAll(/new URL\("([^"]+)", base\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(fetched, ["data/adoptables.json", "data/collection.json", "data/famous.json", "data/lore.json", "data/planned.json", "data/real-photos.json", "data/release-queue.json", "data/wallets.json"]);
});
