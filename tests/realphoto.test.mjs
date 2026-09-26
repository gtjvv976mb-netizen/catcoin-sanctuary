/* The real photos (data/real-photos.json): every cat card with one shows it at the top of its body,
   hotlinked from pbs.twimg.com and credited "📸 Real photo · @handle" with a link to the X post;
   our own picture sits under it as "🎮 In-game look" and takes its place if the photo fails.
   No image from X is ever hosted in this repository. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, DATA_NOW } from "./helpers.mjs";
import { installDom, Element } from "./minidom.mjs";
import { loadResidents } from "../assets/residents.js";
import { normalize } from "../assets/ui/data.js";
import { createCard, realPhotoFigure } from "../assets/ui/card.js";
import { validateRealPhotos, realPhotoOf } from "../assets/ui/adoptables.js";

installDom();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const PHOTOS = JSON.parse(read("data/real-photos.json"));
const BASE = new URL(`file://${ROOT}/`);
const localFetch = async (url) => {
  try { return new Response(fs.readFileSync(new URL(url).pathname), { status: 200 }); } catch { return new Response("", { status: 404 }); }
};
const residents = async () => (await loadResidents({ fetchImpl: localFetch, base: BASE, nowMs: DATA_NOW })).map(normalize).filter(Boolean);
const fire = (el, type) => { for (const fn of el.listeners[type] ?? []) fn({}); };

test("data/real-photos.json: only the four fields, pbs.twimg.com images, X post links, no cat both listed and left out", () => {
  const entries = Object.entries(PHOTOS.cats);
  assert.ok(entries.length >= 50, `${entries.length} real photos`);
  for (const [k, v] of entries) {
    assert.deepEqual(Object.keys(v.realPhoto).sort(), ["alt", "handle", "post", "url"], k);
    assert.match(v.realPhoto.url, /^https:\/\/pbs\.twimg\.com\//, k);
    assert.match(v.realPhoto.post, /^https:\/\/(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d+/, k);
    assert.ok(["proof", "search"].includes(v.source), k);
    assert.ok(realPhotoOf(v.realPhoto), `${k} passes the card's check`);
    assert.ok(!(k in (PHOTOS.none || {})), `${k} is not also in none`);
  }
  assert.equal(Object.keys(validateRealPhotos(PHOTOS)).length, entries.length);
});

test("realPhotoOf refuses images not on pbs.twimg.com and posts not on X", () => {
  const ok = { url: "https://pbs.twimg.com/media/abc.jpg", handle: "@cat", post: "https://x.com/cat/status/1", alt: "" };
  assert.deepEqual(realPhotoOf(ok), { url: ok.url, handle: "cat", post: ok.post, alt: "A photo from @cat's post" });
  for (const bad of [{ ...ok, url: "http://pbs.twimg.com/a.jpg" }, { ...ok, url: "https://pbs.twimg.com.evil.example/a.jpg" }, { ...ok, url: "assets/x.jpg" },
    { ...ok, post: "https://evil.example/cat/status/1" }, { ...ok, handle: "bad handle" }, null]) assert.equal(realPhotoOf(bad), null);
});

test("no image from X is hosted in the repo: nothing under assets/ or data/ came from twimg", () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = [...walk(path.join(ROOT, "assets")), ...walk(path.join(ROOT, "data"))];
  for (const f of files) assert.doesNotMatch(path.basename(f), /twimg|^[A-Za-z0-9_-]{15}\.(jpe?g|png)$/i, `${f} looks like a copied X image`);
  // Every real photo is an absolute pbs.twimg.com address, never a local copy.
  for (const v of Object.values(PHOTOS.cats)) assert.ok(!fs.existsSync(path.join(ROOT, new URL(v.realPhoto.url).pathname)));
});

test("the real-photo block: at the top of the card body, credited and linked; our picture below as the in-game look", async () => {
  const list = await residents();
  const withPhoto = list.filter((r) => r.realPhoto);
  assert.ok(withPhoto.length >= 50, `${withPhoto.length} cards with a real photo`);
  const kinds = new Set(withPhoto.map((r) => r.kind || (r.planned ? "planned" : "token")));
  for (const k of ["adoptable", "famous"]) assert.ok(kinds.has(k), `a ${k} card has a real photo`);
  const root = new Element("aside");
  const card = createCard({ root, onClose() {}, onInset() {} });
  for (const r of withPhoto) {
    card.open(r, { focus: false });
    const body = root.querySelector("div.card-body");
    const first = body.children[0];
    assert.ok(first.classList.contains("card-real-photo"), `${r.id}: the real photo comes first`);
    const img = first.querySelector("img.card-real-photo-img");
    assert.equal(img.src, r.realPhoto.url);
    assert.match(img.src, /^https:\/\/pbs\.twimg\.com\//);
    const cap = first.querySelector("figcaption.card-real-photo-caption");
    assert.equal(cap.textContent, `📸 Real photo · @${r.realPhoto.handle}`);
    const a = cap.querySelector("a.card-real-photo-link");
    assert.equal(a.href, r.realPhoto.post);
    assert.equal(a.target, "_blank");
    assert.match(a.rel, /noopener/);
    if (r.kind !== "famous") {
      assert.equal(root.querySelector("img.card-portrait"), null, `${r.id}: our picture is not in the head`);
      if (r.portrait) {
        const game = body.children[1];
        assert.ok(game.classList.contains("card-ingame"), `${r.id}: the in-game look follows`);
        assert.equal(game.querySelector("img.card-ingame-img").src, r.portrait);
        assert.equal(game.querySelector("figcaption").textContent, "🎮 In-game look");
      }
    }
    if (r.realPhoto.source === "search") assert.ok(root.querySelector("p.card-photo-source"), `${r.id}: names its photo source`);
  }
  // A cat without a real photo keeps its portrait in the head and says nothing about a photo.
  const plain = list.find((r) => !r.realPhoto && r.portrait && r.kind !== "famous");
  card.open(plain, { focus: false });
  assert.equal(root.querySelector("figure.card-real-photo"), null);
  assert.equal(root.querySelector("figure.card-ingame"), null);
  assert.ok(root.querySelector("img.card-portrait"));
});

test("fallback: when the real photo fails to load, our picture takes its place", async () => {
  const list = await residents();
  const r = list.find((x) => x.realPhoto && x.portrait && x.kind === "adoptable");
  const root = new Element("aside");
  const card = createCard({ root, onClose() {}, onInset() {} });
  card.open(r, { focus: false });
  const body = root.querySelector("div.card-body");
  fire(root.querySelector("img.card-real-photo-img"), "error");
  assert.equal(root.querySelector("figure.card-real-photo"), null, "the broken photo is gone");
  assert.ok(body.children[0].classList.contains("card-ingame"), "our picture is at the top");
  assert.equal(root.querySelectorAll("figure.card-ingame").length, 1);
  // With no picture of ours, the broken photo simply goes.
  const holder = new Element("div");
  const fig = realPhotoFigure({ url: "https://pbs.twimg.com/media/x.jpg", handle: "cat", post: "https://x.com/cat/status/1", alt: "A cat" });
  holder.append(fig);
  fire(fig.querySelector("img"), "error");
  assert.equal(holder.children.length, 0);
});

test("build-kits reads the reviewed real photos, so the Adopt panel logo matches the card", () => {
  const kits = JSON.parse(read("assets/kits/kits.json")).cats;
  for (const [t, k] of Object.entries(kits)) {
    if (PHOTOS.cats[t]) assert.equal(k.photo?.url, PHOTOS.cats[t].realPhoto.url, t);
    if (PHOTOS.none?.[t]) assert.equal(k.photo, null, `${t} has no real photo in its kit`);
  }
});
