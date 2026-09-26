/* The page: lists the residents, then brings the garden to life when the browser can draw
   it in 3D. Without WebGL (or if anything fails) the poster stays up and the list still works. */

import { loadResidents } from "../residents.js";

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const canvas = $("world");
const tag = $("tag");
const loading = $("loading");
const status = $("status");
const list = $("list");
const note = $("residents-note");
const live = $("announce");
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const params = new URLSearchParams(location.search);
const debug = params.has("debug");

let world = null;
let pending = null; // a card clicked before the garden was ready

/* ── Residents ─────────────────────────────────────────────────────────── */

let residents = [];
try {
  residents = await loadResidents();
} catch (e) {
  console.warn("Could not load the residents", e);
  note.textContent = "The list of residents could not be loaded just now. Please try again later.";
}
if (!Array.isArray(residents)) residents = [];

// For testing a crowded garden only (?debug&cats=30): more example cats, all marked as examples.
if (debug && params.get("cats")) {
  const want = Math.min(60, Number(params.get("cats")) || 0), base = residents.filter((r) => r.example);
  for (let i = residents.length; i < want && base.length; i++) {
    const b = base[i % base.length];
    residents.push({ ...b, id: `example-extra-${i}`, name: `${b.name} ${Math.floor(i / base.length) + 1}` });
  }
}

const real = residents.filter((r) => !r.example);
status.textContent = real.length ? `${real.length} ${real.length === 1 ? "resident" : "residents"}` : "No tokens yet · example cats";
if (real.length) note.textContent = "Every cat here is a token launched on StonkFun. Choose one to find it in the garden.";

for (const r of residents) {
  const li = document.createElement("li");
  li.className = "resident";
  li.style.setProperty("--coat", r.look?.swatch || "#d9c6ae");
  li.dataset.id = r.id;

  const pick = document.createElement("button");
  pick.type = "button";
  pick.className = "pick";
  pick.setAttribute("aria-pressed", "false");
  pick.setAttribute("aria-label", `Show ${r.name} in the garden`);
  const face = document.createElement("span");
  face.className = "face";
  face.setAttribute("aria-hidden", "true");
  face.innerHTML = "<i></i><i></i>";
  pick.append(face);

  const body = document.createElement("div");
  body.className = "body";
  const h = document.createElement("h3");
  h.textContent = r.name;
  body.append(h);
  if (r.example) {
    const s = document.createElement("span");
    s.className = "badge";
    s.textContent = "Example";
    body.append(s);
  }
  const dl = document.createElement("dl");
  const row = (k, v, mono = true) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); if (!mono) dd.className = "plain";
    if (v instanceof Node) dd.append(v); else dd.textContent = v ?? "—";
    dl.append(dt, dd);
  };
  if (r.example) row("Token", "Not a token", false);
  else row("Token", r.ticker || "—");
  row("Paired with", r.pair || "—");
  row("Moved in", r.arrived || "—");
  if (!r.example && r.mint) {
    // Where to check it: the token and its launch on a block explorer, and its StonkFun page.
    const span = document.createElement("span");
    const link = (href, text, title) => {
      if (!href || !/^https:\/\//.test(href)) return;
      if (span.childNodes.length) span.append(" · ");
      const a = document.createElement("a");
      a.href = href; a.rel = "noopener"; a.textContent = text; if (title) a.title = title;
      span.append(a);
    };
    const L = r.links || { token: `https://solscan.io/token/${encodeURIComponent(r.mint)}` };
    link(L.token, `${r.mint.slice(0, 4)}…${r.mint.slice(-4)}`, `Token ${r.mint} on Solscan`);
    link(L.tx, "launch", "The launch transaction on Solscan");
    link(L.stonkfun, "StonkFun", "This token on StonkFun");
    row("Check", span);
  }
  body.append(dl);
  li.append(pick, body);
  pick.addEventListener("click", () => chooseFromCard(r.id));
  list.append(li);
}

function markCard(id) {
  for (const b of list.querySelectorAll(".resident")) b.querySelector(".pick").setAttribute("aria-pressed", String(b.dataset.id === id));
}

function say(r) {
  if (!live) return;
  live.textContent = r ? `${r.name}. ${r.example ? "Example cat, not a token." : `${r.ticker}, paired with ${r.pair}.`}` : "";
}

function chooseFromCard(id) {
  markCard(id);
  const r = residents.find((x) => x.id === id);
  say(r);
  if (!world) { pending = id; return; }
  world.choose(id, { reveal: true });
  stage.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "center" });
}

/* ── The garden ────────────────────────────────────────────────────────── */

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
  } catch { return false; }
}

function fallback(msg) {
  loading.hidden = false;
  loading.textContent = msg;
  stage.dataset.ready = "false";
  canvas.hidden = true;
}

if (!webglOk()) {
  fallback("This browser can't show the 3D garden, so here is a picture of the cottage. Every resident is listed below.");
} else if (!residents.length) {
  fallback("The garden is quiet just now. The residents list below will fill up as cats move in.");
} else {
  try {
    const { startWorld } = await import("./world.js");
    world = await startWorld({
      canvas, stage, residents, reduce, tag, debug,
      onChoose: (r) => { markCard(r ? r.id : null); say(r); },
    });
    stage.dataset.ready = "true";
    loading.hidden = true;
    if (pending) world.choose(pending, { reveal: true });
    if (debug) window.__garden = world;
  } catch (e) {
    console.warn(e);
    fallback("The 3D garden could not load here, so here is a picture of the cottage. Every resident is listed below.");
  }
}
