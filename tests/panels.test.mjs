/* The About and Socials panels, and data/socials.json: only https links on known hosts show,
   empty ones stay hidden, and both panels are modal dialogs the page opens from its own pills. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers.mjs";
import { installDom, Element } from "./minidom.mjs";
import { checkSocials, socialLinks, safeSocialUrl, isMint, createPanels, SOCIAL_HOSTS } from "../assets/ui/panels.js";

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const SOCIALS = JSON.parse(read("data/socials.json"));

test("data/socials.json is valid: https only, allowed hosts, the $CATSANC ticker", () => {
  assert.deepEqual(checkSocials(SOCIALS), []);
  assert.equal(SOCIALS.ticker, "$CATSANC");
  for (const l of SOCIALS.links) if (l.url) {
    const u = new URL(l.url);
    assert.equal(u.protocol, "https:", l.id);
    assert.ok(SOCIAL_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`)), `${l.id}: ${u.hostname}`);
  }
  const ids = SOCIALS.links.map((l) => l.id);
  for (const id of ["website", "x", "telegram"]) assert.ok(ids.includes(id), `socials.json lists ${id}`);
  assert.equal(SOCIALS.links.find((l) => l.id === "website").url, "https://catcoinsanctuary.com/");
});

test("social links: only https on an allowed host; empty ones are hidden", () => {
  assert.equal(safeSocialUrl("https://x.com/catcosanctuary"), "https://x.com/catcosanctuary");
  assert.equal(safeSocialUrl("https://t.me/+x58u0_NhAAZlMTZl"), "https://t.me/+x58u0_NhAAZlMTZl", "a Telegram invite link");
  assert.equal(safeSocialUrl("https://dexscreener.com/solana/abc"), "https://dexscreener.com/solana/abc");
  for (const bad of ["", "   ", "http://x.com/a", "javascript:alert(1)", "https://evil.example/x.com", "https://x.com.evil.example/", "https://user:pw@x.com/", "https://x.com:8443/", "//x.com/a", "data:text/html,hi", 42, null]) {
    assert.equal(safeSocialUrl(bad), null, String(bad));
  }
  const cfg = { links: [
    { id: "website", label: "Website", url: "https://catcoinsanctuary.com/" },
    { id: "x", label: "X", url: "" },
    { id: "bad", label: "Bad", url: "http://pump.fun/coin" },
  ] };
  assert.deepEqual(socialLinks(cfg).map((l) => l.id), ["website"]);
  assert.ok(checkSocials(cfg).some((p) => /not an https address/.test(p)), "an http link is reported");
  assert.ok(checkSocials({ links: [{ id: "a", label: "A", url: "" }, { id: "a", label: "B", url: "" }] }).some((p) => /repeats/.test(p)));
  assert.ok(checkSocials({ links: [], contract: "not-a-mint" }).length);
  assert.ok(checkSocials({ links: [], ticker: "SANC" }).length, "a ticker without $");
  assert.ok(isMint("45ByChvJhwVFBP9pzZDvsByfoepRnmRMRNhXE6SD2Wjc"));
  assert.ok(!isMint("0OIl"));
});

function dialog() {
  const d = new Element("dialog");
  d.open = false;
  d.showModal = () => { d.open = true; };
  d.close = () => { d.open = false; };
  return d;
}
const links = (root) => root.querySelectorAll("a").map((a) => ({ href: a.href, target: a.target, rel: a.rel, text: a.textContent }));

test("the About and Socials panels: modal dialogs with a title, a close button and the right content", () => {
  const remove = installDom();
  globalThis.location = { host: "catcoinsanctuary.com" };
  try {
    const about = dialog(), socials = dialog();
    let disclaimers = 0;
    const p = createPanels({ about, socials, config: SOCIALS, onDisclaimers: () => disclaimers++ });
    p.openAbout();
    assert.ok(about.open, "About opens as a modal dialog");
    assert.equal(about.getAttribute("aria-labelledby"), "about-title");
    assert.match(about.textContent, /A home for adoptable cats/);
    assert.match(about.textContent, /companies, personalities, shows, movies and crypto projects/);
    assert.match(about.textContent, /real, verified lore \(X posts and sources\)/);
    assert.match(about.textContent, /under \$50k/);
    assert.match(about.textContent, /Hall of Fame: legendary cat coins that already exist/);
    assert.match(about.textContent, /\$CATSANC/);
    assert.match(about.textContent, /StonkFun/);
    assert.ok(!/\$SANCTUARY/.test(about.textContent));
    assert.equal(links(about).length, 0, "About has no outbound links");
    const close = about.querySelector("button.finder-close");
    assert.match(close.getAttribute("aria-label"), /Close About/);
    close.click();
    assert.ok(!about.open, "the close button closes it");
    p.openAbout();
    about.querySelector("button.panel-link").click();
    assert.equal(disclaimers, 1, "the disclaimers button opens the disclaimers");
    assert.ok(!about.open);

    p.openSocials();
    assert.ok(socials.open);
    const shown = links(socials);
    assert.deepEqual(shown.map((l) => l.href), SOCIALS.links.filter((l) => l.url).map((l) => l.url), "every filled-in link, in order, and no empty one");
    for (const l of shown) { assert.equal(l.target, "_blank"); assert.equal(l.rel, "noopener noreferrer"); }
    assert.ok(shown.some((l) => l.href === "https://x.com/catcosanctuary"));
    assert.ok(shown.some((l) => l.href === "https://t.me/+x58u0_NhAAZlMTZl"));

    // A config with a bad link keeps it off the page.
    p.setConfig({ links: [{ id: "website", label: "Website", url: "https://catcoinsanctuary.com/" }, { id: "x", label: "X", url: "https://evil.example/" }] });
    assert.deepEqual(links(socials).map((l) => l.href), ["https://catcoinsanctuary.com/"]);
  } finally { delete globalThis.location; remove(); }
});

test("the page has About and Socials pills that open dialogs", () => {
  const html = read("index.html");
  assert.match(html, /<button class="pill" id="about-open" type="button" aria-haspopup="dialog"/);
  assert.match(html, /<button class="pill" id="socials-open" type="button" aria-haspopup="dialog"/);
  assert.match(html, /<dialog class="finder panel" id="about" aria-labelledby="about-title"><\/dialog>/);
  assert.match(html, /<dialog class="finder panel" id="socials" aria-labelledby="socials-title"><\/dialog>/);
  const main = read("assets/ui/main.js");
  assert.match(main, /fetch\("data\/socials\.json"\)/);
});
