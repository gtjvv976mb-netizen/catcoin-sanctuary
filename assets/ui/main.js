/* The page: the 3D world fills the window; a light overlay sits on top (the wordmark, "Find a
   cat", a legend for the badges, and a one-line footer that opens the disclaimers). Choosing a
   cat, in the world or from the list, opens its card and eases the camera over to it.
   Without WebGL (or if the world fails to start) the list becomes the page, and cards still open. */

import { getResidents, isLaunched, isFamous } from "./data.js";
import { createCard, badgeFor, tickerLabel } from "./card.js";
import { createFinder } from "./finder.js";
import { createPanels } from "./panels.js";

const $ = (id) => document.getElementById(id);
const canvas = $("world");
const params = new URLSearchParams(location.search);
// The garden is always alive (owner's choice): many phones turn on "reduce motion" with battery saver,
// which froze every cat. A visitor who needs stillness can open the page with ?still.
const reduce = { matches: params.has("still"), addEventListener() {} };
const debug = params.has("debug");
const live = $("announce");
const say = (text) => { live.textContent = ""; setTimeout(() => { live.textContent = text; }, 30); };

/* ── The loading screen: a paw-print bar driven by what has really loaded, and rotating tips ── */

const TIPS = [
  "Tip: press F in the garden to find any cat by name.",
  "A little gold coin over a cat's head means it has launched on Solana.",
  "The Hall of Fame is out by the fountain: famous cat coins, here as inspiration.",
  "Every card shows the post or page that proves the cat's lore.",
  "Drag to look around, scroll or pinch to zoom, and click a cat to meet it.",
  "$CATSANC is the sanctuary's own coin. Only an address on our own socials is ours.",
  "Adoptable cats are not tokens until they launch. Nothing here is financial advice.",
];
const loader = (() => {
  const box = $("loading"), bar = $("loading-bar"), fill = $("loading-fill"), walker = $("loading-walker"), text = $("loading-text"), tip = $("loading-tip");
  let shown = 0, t = 0, timer = 0, fade = 0;
  const setTip = () => {
    tip.classList.add("is-out");
    clearTimeout(fade);
    fade = setTimeout(() => { t = (t + 1) % TIPS.length; tip.textContent = TIPS[t]; tip.classList.remove("is-out"); }, 260);
  };
  const start = () => { clearInterval(timer); timer = setInterval(setTip, 3600); };
  start();
  return {
    /** Move the bar forward (never back) to p percent, with an optional line of what is happening. */
    set(p, msg) {
      shown = Math.max(shown, Math.min(100, p));
      fill.style.transform = `scaleX(${(shown / 100).toFixed(3)})`;
      walker.style.left = `${shown.toFixed(1)}%`;
      bar.setAttribute("aria-valuenow", String(Math.round(shown)));
      if (msg && text.textContent !== msg) text.textContent = msg;
    },
    done() {
      this.set(100, "Welcome to the sanctuary!");
      clearInterval(timer);
      box.setAttribute("aria-busy", "false");
      box.classList.add("is-done");
      setTimeout(() => { if (box.classList.contains("is-done")) box.hidden = true; }, 700);
    },
    show(msg) {
      box.hidden = false;
      box.classList.remove("is-done");
      box.setAttribute("aria-busy", "true");
      text.textContent = msg;
      start();
    },
    hide() { clearInterval(timer); box.hidden = true; },
  };
})();
loader.set(4, "The cats are waking up…");

/* ── The cats ─────────────────────────────────────────────────────────── */

let residents = [];
let loadError = null;
try { residents = await getResidents(); } catch (e) { loadError = e; console.warn("Could not read the residents", e); }
loader.set(12, "Counting whiskers…");
const byId = new Map(residents.map((r) => [r.id, r]));
const launched = residents.filter(isLaunched).length;
$("count").textContent = residents.length ? String(residents.length) : "";
const famousN = residents.filter(isFamous).length;
$("find").setAttribute("aria-label", `Find a cat: ${residents.length} cats, ${launched} launched${famousN ? `, ${famousN} in the Hall of Fame` : ""}`);
$("legend-famous").hidden = famousN === 0;
$("hall-open").hidden = famousN === 0;
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
  say(isFamous(r) ? `${r.name}, $${r.ticker}. Hall of Fame: already a coin, here as inspiration, not made by the sanctuary.` : `${r.name}${r.ticker ? (isLaunched(r) ? `, $${r.ticker}` : `, planned ticker ${r.ticker}`) : ""}. ${r.example ? "An example cat, not a token." : isLaunched(r) ? "Launched." : "Not launched yet."}`);
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
$("hall-open").addEventListener("click", () => finder.open({ filter: "hall" }));
$("adopt-open").addEventListener("click", () => finder.open({ filter: "adoptable" }));

/* ── About and Socials (links from data/socials.json) ─────────────────── */
const panels = createPanels({
  about: $("about"), socials: $("socials"),
  onDisclaimers: () => { if (footToggle.getAttribute("aria-expanded") !== "true") footToggle.click(); footToggle.focus(); },
});
$("about-open").addEventListener("click", () => panels.openAbout());
$("socials-open").addEventListener("click", () => panels.openSocials());
fetch("data/socials.json").then((r) => (r.ok ? r.json() : null)).then((j) => j && panels.setConfig(j)).catch(() => {});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && card.isOpen && !document.querySelector("dialog[open]")) { e.preventDefault(); hideCard(); }
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
  loader.hide();
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
  $("hall-open").hidden = true;
}

if (loadError || !residents.length) {
  fallback(loadError ? "The list of cats could not be read just now. Please try again later." : "No cats have moved in yet.");
} else if (!webglOk()) {
  fallback("This browser can't draw the 3D garden, so here is every cat as a list. Choose one to see its card.");
} else {
  try {
    // Every model and texture the world loads goes through three.js's default loading manager,
    // so its count of files is the bar's real progress.
    const THREE = await import("three");
    loader.set(20, "Planting the garden…");
    const LINES = ["Planting the garden…", "Fluffing the cushions…", "Polishing the coins…", "Filling the fountain…", "Calling the cats in…"];
    const mgr = THREE.DefaultLoadingManager;
    mgr.onProgress = (url, loaded, total) => loader.set(20 + 75 * (loaded / Math.max(total, 1)), LINES[Math.min(LINES.length - 1, Math.floor((loaded / Math.max(total, 1)) * LINES.length))]);
    const { startWorld } = await import("../world/world.js");
    world = await startWorld({
      canvas, residents, reduce, debug, adaptive: !(debug && params.has("noadapt")), quality: params.get("q"),
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
    mgr.onProgress = undefined;
    document.body.classList.add("ready");
    loader.done();
    // A lost GPU context: a friendly note, then the page is rebuilt at a lighter tier (world.js
    // lowers it for this session). After three losses, the list of cats instead of the 3D garden.
    canvas.addEventListener("world:lost", (e) => {
      if ((e.detail?.losses || 0) >= 3 && e.detail?.tier === "low") { world = null; fallback("The 3D garden kept running out of graphics memory here, so here is every cat as a list. Choose one to see its card."); return; }
      loader.show("The garden ran out of graphics memory, so it's coming back a little lighter…");
    });
    canvas.addEventListener("world:rebuild", () => { if (world) location.reload(); });
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

/* ── "New cat just moved in!": the newest released cat (data/releases.json), once per visitor ── */
{
  const { createNewCat } = await import("./newcat.js");
  const goTo = (r, then) => {
    if (byId.has(r.id)) { show(r.id); then?.(); return; }
    // Released after this page loaded: reload so the garden has it, straight to its card.
    location.hash = `#cat=${encodeURIComponent(r.id)}`;
    location.reload();
  };
  const newcat = createNewCat({
    root: $("newcat"),
    lookup: async (key) => {
      if (byId.has(key)) return byId.get(key);
      try { const { loadResidents } = await import("../residents.js"); return (await loadResidents()).find((r) => r.id === key) || null; } catch { return null; }
    },
    onMeet: (r) => goTo(r),
    onAdopt: (r) => goTo(r, () => card.adopt()),
  });
  if (!location.hash.startsWith("#cat=")) setTimeout(() => newcat.check(), 1200);
}
