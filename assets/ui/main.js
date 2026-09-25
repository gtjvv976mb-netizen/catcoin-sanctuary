/* The page: the 3D world fills the window; a light overlay sits on top (the wordmark, "Find a
   cat", a legend for the badges, and a one-line footer that opens the disclaimers). Choosing a
   cat, in the world or from the list, opens its card and eases the camera over to it.
   Without WebGL (or if the world fails to start) the list becomes the page, and cards still open. */

import { getResidents, isLaunched } from "./data.js";
import { createCard, badgeFor, tickerLabel } from "./card.js";
import { createFinder } from "./finder.js";

const $ = (id) => document.getElementById(id);
const canvas = $("world");
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const params = new URLSearchParams(location.search);
const debug = params.has("debug");
const live = $("announce");
const say = (text) => { live.textContent = ""; setTimeout(() => { live.textContent = text; }, 30); };

/* ── The cats ─────────────────────────────────────────────────────────── */

let residents = [];
let loadError = null;
try { residents = await getResidents(); } catch (e) { loadError = e; console.warn("Could not read the residents", e); }
const byId = new Map(residents.map((r) => [r.id, r]));
const launched = residents.filter(isLaunched).length;
$("count").textContent = residents.length ? String(residents.length) : "";
$("find").setAttribute("aria-label", `Find a cat: ${residents.length} cats, ${launched} launched`);
// The legend explains the gold coin only once there is one to see.
$("legend-launched").hidden = launched === 0;

/* ── Footer: one line; the full disclaimers open under it ──────────────── */

const footToggle = $("foot-toggle"), footMore = $("foot-more");
footToggle.addEventListener("click", () => {
  const open = footToggle.getAttribute("aria-expanded") !== "true";
  footToggle.setAttribute("aria-expanded", String(open));
  footMore.hidden = !open;
});

/* ── The card, the list, the tags over the cats ────────────────────────── */

let world = null;
let returnFocus = null;
const card = createCard({
  root: $("card"),
  onClose: () => { world?.choose(null); pin.hidden = true; history.replaceState(null, "", location.pathname + location.search); restoreFocus(); },
  onInset: (right, bottom) => world?.setInset(right, bottom),
});
function restoreFocus() {
  const t = returnFocus && document.contains(returnFocus) ? returnFocus : (world ? canvas : $("find"));
  returnFocus = null;
  t?.focus?.({ preventScroll: true });
}

function show(id, { from = null } = {}) {
  const r = byId.get(id);
  if (!r) return;
  returnFocus = from || document.activeElement;
  card.open(r);
  world?.choose(id);
  tag.hidden = true;
  say(`${r.name}${r.ticker ? (isLaunched(r) ? `, $${r.ticker}` : `, planned ticker ${r.ticker}`) : ""}. ${r.example ? "An example cat, not a token." : isLaunched(r) ? "Launched." : "Not launched yet."}`);
  history.replaceState(null, "", `#cat=${encodeURIComponent(id)}`);
}
function hideCard() {
  if (!card.isOpen) return;
  card.close();
  world?.choose(null);
  pin.hidden = true;
  history.replaceState(null, "", location.pathname + location.search);
  restoreFocus();
}

const finder = createFinder({ root: $("finder"), residents, onChoose: (id) => show(id, { from: $("find") }) });
$("find").addEventListener("click", () => finder.open());

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && card.isOpen && !$("finder").open) { e.preventDefault(); hideCard(); }
  else if ((e.key === "/" || (e.key === "f" && !e.metaKey && !e.ctrlKey)) && document.activeElement === canvas) { e.preventDefault(); finder.open(); }
});

// A hovered cat gets a small label with its name, its ticker (a cashtag only once it has
// launched) and its badge; the chosen one keeps a pin over its head, which also says what it is doing.
const tag = $("tag"), pin = $("pin");
function fillTag(el, r, { doing = false } = {}) {
  el.replaceChildren();
  const b = document.createElement("b");
  b.textContent = r.name;
  el.append(b);
  const line = document.createElement("span");
  line.className = "tag-line";
  if (r.ticker) { const t = document.createElement("span"); t.className = "mono"; t.textContent = tickerLabel(r); line.append(t); }
  line.append(badgeFor(r));
  el.append(line);
  if (doing) { const d = document.createElement("span"); d.className = "tag-doing"; el.append(d); }
}
let tagFor = null;
function placeAt(el, x, y) {
  const w = innerWidth;
  el.style.transform = `translate(${Math.max(70, Math.min(w - 70, x)).toFixed(1)}px, ${Math.max(60, y).toFixed(1)}px) translate(-50%, calc(-100% - 8px))`;
}
let pinFor = null, pinDoing = "";

/* ── The hint: how to move about; it fades once someone does ───────────── */

const hint = $("hint");
if (matchMedia("(pointer: coarse)").matches) hint.textContent = "Drag to look around · pinch to zoom · tap a cat";
const hideHint = () => hint.classList.add("gone");
canvas.addEventListener("pointerdown", hideHint, { once: true });
canvas.addEventListener("keydown", hideHint, { once: true });
setTimeout(hideHint, 14000);

/* ── The world, or the list without it ─────────────────────────────────── */

function webglOk() {
  try { return !!(window.WebGL2RenderingContext && document.createElement("canvas").getContext("webgl2")); } catch { return false; }
}

function fallback(message) {
  document.body.classList.add("no-webgl");
  canvas.hidden = true;
  $("loading").hidden = true;
  hint.hidden = true;
  const main = $("fallback");
  main.hidden = false;
  const note = document.createElement("p");
  note.className = "fallback-note";
  note.textContent = message;
  const list = document.createElement("div");
  list.className = "fallback-list";
  main.replaceChildren(note, list);
  const legend = document.querySelector(".legend");
  if (legend) { main.append(legend); const t = legend.querySelector("#legend-launched .legend-text"); if (t) t.textContent = "a token on Solana"; }
  createFinder({ root: list, residents, inline: true, onChoose: (id) => show(id) });
  $("find").hidden = true;
}

if (loadError || !residents.length) {
  fallback(loadError ? "The list of cats could not be read just now. Please try again later." : "No cats have moved in yet.");
} else if (!webglOk()) {
  fallback("This browser can't draw the 3D garden, so here is every cat as a list. Choose one to see its card.");
} else {
  try {
    const { startWorld } = await import("../world/world.js");
    world = await startWorld({
      canvas, residents, reduce, debug, adaptive: !(debug && params.has("noadapt")),
      onPick: (id) => {
        if (id) show(id, { from: canvas });
        else if (card.isOpen && !matchMedia("(max-width: 640px)").matches) hideCard();
      },
      onHover: (r, x, y) => {
        if (!r) { tag.hidden = true; tagFor = null; return; }
        if (tagFor !== r.id) { fillTag(tag, r); tagFor = r.id; }
        tag.hidden = false;
        placeAt(tag, x, y);
      },
      onTrack: (r, x, y, visible, doing) => {
        if (!card.isOpen) { pin.hidden = true; return; }
        if (pinFor !== r.id) { fillTag(pin, r, { doing: true }); pinFor = r.id; pinDoing = null; }
        if (doing !== pinDoing) {
          pinDoing = doing;
          const d = pin.querySelector(".tag-doing");
          if (d) d.textContent = doing || "";
          card.setDoing(doing);
        }
        // (Not while the phone's sheet covers the garden: the pin would sit on the top bar.)
        pin.hidden = !visible || card.isTall;
        if (!pin.hidden) placeAt(pin, x, y);
      },
    });
    document.body.classList.add("ready");
    $("loading").hidden = true;
    canvas.addEventListener("world:lost", () => $("loading").hidden = false);
    canvas.addEventListener("world:restored", () => $("loading").hidden = true);
    if (debug) window.__world = world;
  } catch (e) {
    console.warn(e);
    world = null;
    fallback("The 3D garden could not start here, so here is every cat as a list. Choose one to see its card.");
  }
}

// A link straight to a cat: #cat=<id>
{
  const m = /^#cat=(.+)$/.exec(location.hash);
  if (m) { const id = decodeURIComponent(m[1]); if (byId.has(id)) show(id, { from: world ? canvas : null }); }
}
