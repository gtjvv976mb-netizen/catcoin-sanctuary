/* "Find a cat": a searchable list of every cat, the adoptable cats in the garden and the Hall of
   Fame coins on their plaza. It is the keyboard way to the cats (and, without WebGL, the whole
   page): type to narrow the list by name, ticker, stock or contract, filter by kind (adoptable
   cats, Hall of Fame, launched), choose one, and its card opens (and the camera goes to it). */

import { isLaunched, isFamous, isAdoptable } from "./data.js";
import { faceFor, silhouetteFor, badgeFor, tickerLabel, chainName, usdShort } from "./card.js";
import { ADOPTABLE_CATEGORIES, CATEGORY_CHIPS } from "./adoptables.js";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/**
 * @param {object} o
 * @param {HTMLElement} o.root         a <dialog> (overlay) or any element (inline, when there is no 3D)
 * @param {Array} o.residents
 * @param {(id: string) => void} o.onChoose
 * @param {boolean} [o.inline]
 */
export function createFinder({ root, residents, onChoose, inline = false }) {
  const launchedCount = residents.filter(isLaunched).length;
  const famousCount = residents.filter(isFamous).length;
  const stockCount = residents.length - famousCount;
  // Launched cats first, then the adoptable cats by name, then the Hall of Fame, biggest first.
  const sorted = residents.slice().sort((a, b) => (isLaunched(b) - isLaunched(a)) || (isFamous(a) - isFamous(b))
    || (isFamous(a) ? (b.market?.marketCapUsd || 0) - (a.market?.marketCapUsd || 0) : 0) || a.name.localeCompare(b.name));
  let filter = "all";

  root.replaceChildren();
  const head = el("div", "finder-head");
  const title = el(inline ? "h1" : "h2", "finder-title", inline ? "The cats of the sanctuary" : "Find a cat");
  title.id = "finder-title";
  head.append(title);
  if (!inline) {
    const close = el("button", "finder-close");
    close.type = "button";
    close.setAttribute("aria-label", "Close the list");
    close.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
    close.addEventListener("click", () => root.close?.());
    head.append(close);
  }
  const stockLine = `${stockCount} adoptable ${stockCount === 1 ? "cat" : "cats"} so far, each with real, verified lore and no coin yet. ${launchedCount ? `${launchedCount} launched as ${launchedCount === 1 ? "a token" : "tokens"}; the rest are` : "None has launched yet: every adoptable cat is"} not a token until it launches.`;
  const famousLine = famousCount ? ` And ${famousCount} in the Hall of Fame: legendary cat coins that already exist, made by others, here as inspiration and not affiliated with the sanctuary.` : "";
  const intro = el("p", "finder-intro", stockLine + famousLine);

  const search = el("div", "finder-search");
  const label = el("label", "sr-only", "Search by name, ticker, stock, chain or contract");
  label.htmlFor = "finder-q";
  const input = el("input");
  input.id = "finder-q";
  input.type = "search";
  input.placeholder = famousCount ? "Search by name, ticker, stock or contract" : "Search by name, ticker or stock";
  input.autocomplete = "off";
  input.spellcheck = false;
  search.append(label, input);

  const chips = el("div", "finder-chips");
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", "Show");
  const chipFor = (key, text) => {
    const b = el("button", "chip", text);
    b.type = "button";
    b.dataset.key = key;
    b.setAttribute("aria-pressed", String(key === filter));
    b.addEventListener("click", () => setFilter(key));
    return b;
  };
  chips.append(chipFor("all", "All"), chipFor("adoptable", "Adoptable cats"));
  // One chip per category of adoptable (famous) cat that is present.
  for (const cat of ADOPTABLE_CATEGORIES) if (residents.some((r) => isAdoptable(r) && r.category === cat)) chips.append(chipFor(`cat:${cat}`, CATEGORY_CHIPS[cat]));
  if (famousCount) chips.append(chipFor("hall", "Hall of Fame"));
  if (launchedCount) chips.append(chipFor("launched", "Launched"));

  const count = el("p", "finder-count");
  count.setAttribute("aria-live", "polite");
  const list = el("ul", "finder-list");
  list.setAttribute("aria-labelledby", "finder-title");

  const items = sorted.map((r) => {
    const li = el("li");
    const b = el("button", "find-item");
    b.type = "button";
    b.dataset.id = r.id;
    let thumb;
    if (isFamous(r) && r.logo) {
      thumb = el("img", "find-thumb find-logo");
      thumb.src = r.logo; thumb.alt = ""; thumb.width = 44; thumb.height = 44; thumb.loading = "lazy"; thumb.decoding = "async";
      thumb.addEventListener("error", () => thumb.replaceWith(faceFor(r, "face find-face")), { once: true });
    } else if (r.portrait) {
      thumb = el("img", "find-thumb");
      thumb.src = r.portrait; thumb.alt = ""; thumb.width = 44; thumb.height = 44; thumb.loading = "lazy"; thumb.decoding = "async";
      thumb.addEventListener("error", () => thumb.replaceWith(faceFor(r, "face find-face")), { once: true });
    } else if (isAdoptable(r)) thumb = silhouetteFor(r, "find-thumb card-silhouette");
    else thumb = faceFor(r, "face find-face");
    const text = el("span", "find-text");
    text.append(el("span", "find-name", r.name));
    const who = r.company || r.stock;
    const meta = isAdoptable(r) ? [tickerLabel(r), r.owner].filter(Boolean).join(" · ") : isFamous(r)
      ? [tickerLabel(r), usdShort(r.market?.marketCapUsd), "Already a coin"].filter(Boolean).join(" · ")
      : [tickerLabel(r), r.pair.symbol, who && who !== r.pair.symbol ? who : ""].filter(Boolean).join(" · ");
    if (meta) text.append(el("span", "find-meta", meta));
    b.append(thumb, text, badgeFor(r));
    b.addEventListener("click", () => { if (!inline) root.close?.(); onChoose(r.id); });
    li.append(b);
    list.append(li);
    return { r, li, hay: [r.name, r.ticker, r.stock, r.company, r.realCatName, r.pair.symbol, r.catName, r.owner, r.category, isFamous(r) ? `${r.chain} ${chainName(r.chain)} ${r.contract}` : "solana"].join(" ").toLowerCase() };
  });

  function setFilter(key) {
    filter = key;
    for (const c of chips.children) c.setAttribute("aria-pressed", String(c.dataset.key === key));
    draw();
  }

  function draw() {
    const q = input.value.trim().toLowerCase().replace(/^\$/, "");
    let n = 0;
    for (const it of items) {
      const r = it.r;
      const okF = filter === "all" || (filter === "launched" ? isLaunched(r) : filter === "hall" ? isFamous(r) : filter.startsWith("cat:") ? isAdoptable(r) && r.category === filter.slice(4) : !isFamous(r));
      const ok = okF && (!q || it.hay.includes(q));
      it.li.hidden = !ok;
      if (ok) n++;
    }
    count.textContent = n === items.length ? `Showing all ${n}` : n ? `Showing ${n} of ${items.length}` : "No cat matches that.";
  }
  input.addEventListener("input", draw);

  // Arrow keys move between the search box and the list.
  const visible = () => items.filter((it) => !it.li.hidden).map((it) => it.li.firstChild);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { const v = visible(); if (v[0]) { e.preventDefault(); v[0].focus(); } }
    else if (e.key === "Enter") { const v = visible(); if (v.length === 1) { e.preventDefault(); v[0].click(); } }
  });
  list.addEventListener("keydown", (e) => {
    const v = visible(), i = v.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === "ArrowDown" && v[i + 1]) { e.preventDefault(); v[i + 1].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); (v[i - 1] || input).focus(); }
    else if (e.key === "Home") { e.preventDefault(); v[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); v[v.length - 1].focus(); }
  });

  root.append(head, intro, search, chips, count, list);
  draw();

  return {
    /** Open the list; `filter` picks a chip first (e.g. "hall" for the Hall of Fame). */
    open({ filter: key } = {}) {
      if (key && [...chips.children].some((c) => c.dataset.key === key)) setFilter(key);
      if (inline) return;
      if (!root.open) root.showModal();
      input.focus();
      input.select();
    },
    get isOpen() { return inline || !!root.open; },
  };
}
