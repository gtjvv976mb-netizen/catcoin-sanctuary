/* "New cat just moved in!": a small highlight card for the newest released cat (data/releases.json,
   written by scripts/announce.mjs once the cat's X post is out). Shown on a visit and when a new
   cat is released while the page is open (the file is polled every few minutes); dismissible, and
   shown once per cat per visitor (localStorage, where the browser allows it). */

export const SEEN_KEY = "catsanc:newcat-seen";
export const POLL_MS = 3 * 60_000;
export const MAX_AGE_DAYS = 14;

/** The newest released cat worth highlighting, or null: released within MAX_AGE_DAYS, not seen. */
export function pickHighlight(file, seen = new Set(), nowMs = Date.now()) {
  const list = Array.isArray(file?.released) ? file.released : [];
  const newest = list.filter((e) => e && typeof e.key === "string" && Date.parse(e.releasedAt))
    .sort((a, b) => Date.parse(b.releasedAt) - Date.parse(a.releasedAt))[0];
  if (!newest || seen.has(newest.key)) return null;
  if (nowMs - Date.parse(newest.releasedAt) > MAX_AGE_DAYS * 86_400_000) return null;
  return newest;
}

/** One line of lore: the lore caption, else the first sentence of the story, clipped. */
export function teaser(r) {
  const t = r?.lore?.caption || String(r?.description || r?.story || "").split(/(?<=[.!?])\s/)[0] || "";
  return t.length > 110 ? `${t.slice(0, 107).replace(/\s+\S*$/, "")}…` : t;
}

function readSeen(storage) {
  try { const v = JSON.parse(storage?.getItem(SEEN_KEY) || "[]"); return new Set(Array.isArray(v) ? v : []); } catch { return new Set(); }
}
function markSeen(storage, key) {
  try { const s = readSeen(storage); s.add(key); storage?.setItem(SEEN_KEY, JSON.stringify([...s].slice(-200))); } catch { /* private mode */ }
}

/**
 * @param {object} o
 * @param {HTMLElement} o.root            the empty <aside id="newcat">
 * @param {(key:string) => object|null|Promise<object|null>} o.lookup  the resident for a key
 * @param {(r:object) => void} o.onMeet   open its card and fly to it
 * @param {(r:object) => void} o.onAdopt  open its card's Adopt panel
 */
export function createNewCat({ root, lookup, onMeet, onAdopt, fetchImpl = (...a) => globalThis.fetch(...a), storage = safeStorage(), pollMs = POLL_MS, now = () => Date.now() }) {
  let shownKey = null;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function dismiss() {
    if (shownKey) markSeen(storage, shownKey);
    root.classList.add("newcat-leaving");
    setTimeout(() => { root.hidden = true; root.classList.remove("newcat-leaving"); root.replaceChildren(); }, 220);
  }

  function render(r) {
    const first = String(r.name || r.id).split(/\s+the\s+/i)[0];
    const close = el("button", "newcat-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss");
    close.addEventListener("click", dismiss);
    const kicker = el("p", "newcat-kicker", "🆕 New cat just moved in!");
    const pic = el("img", "newcat-portrait");
    pic.alt = "";
    pic.width = 84; pic.height = 84;
    pic.src = r.lore?.image || r.portrait || "assets/icons/favicon.svg";
    const name = el("h2", "newcat-name", r.name || r.id);
    const line = el("p", "newcat-teaser", teaser(r));
    const meet = el("button", "btn newcat-meet", `Meet ${first}`);
    meet.type = "button";
    meet.addEventListener("click", () => { markSeen(storage, r.id); root.hidden = true; onMeet(r); });
    const adopt = el("button", "btn newcat-adopt", "🐾 Adopt this cat");
    adopt.type = "button";
    adopt.addEventListener("click", () => { markSeen(storage, r.id); root.hidden = true; onAdopt(r); });
    const text = el("div", "newcat-text");
    text.append(kicker, name, line);
    const actions = el("div", "newcat-actions");
    actions.append(meet, adopt);
    root.replaceChildren(close, pic, text, actions);
    root.setAttribute("aria-label", `New cat: ${r.name || r.id}`);
    root.hidden = false;
  }

  async function check() {
    let file;
    try {
      const res = await fetchImpl(`data/releases.json?t=${Math.floor(now() / 60_000)}`, { cache: "no-cache", credentials: "same-origin" });
      if (!res.ok) return null;
      file = await res.json();
    } catch { return null; }
    const pick = pickHighlight(file, readSeen(storage), now());
    if (!pick || pick.key === shownKey) return null;
    const r = await lookup(pick.key);
    if (!r) return null;
    shownKey = pick.key;
    render(r);
    return pick.key;
  }

  const timer = pollMs > 0 ? setInterval(() => { if (!document.hidden) check(); }, pollMs) : 0;
  return { check, dismiss, stop: () => clearInterval(timer), get shown() { return shownKey; } };
}

function safeStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
