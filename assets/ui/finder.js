/* "Find a cat": a searchable list of every cat in the garden. It is the keyboard way to the
   cats (and, without WebGL, the whole page): type to narrow the list by name, ticker or stock,
   choose one, and its card opens (and the camera goes to it). */

import { isLaunched } from "./data.js";
import { faceFor, badgeFor, tickerLabel } from "./card.js";

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
  const sorted = residents.slice().sort((a, b) => (isLaunched(b) - isLaunched(a)) || a.name.localeCompare(b.name));
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
  const intro = el("p", "finder-intro", `${residents.length} ${residents.length === 1 ? "cat" : "cats"} so far, each paired with one stock. ${launchedCount ? `${launchedCount} launched as ${launchedCount === 1 ? "a token" : "tokens"}; the rest are` : "None has launched yet: every cat is"} planned and not a token until it launches.`);

  const search = el("div", "finder-search");
  const label = el("label", "sr-only", "Search by name, ticker or stock");
  label.htmlFor = "finder-q";
  const input = el("input");
  input.id = "finder-q";
  input.type = "search";
  input.placeholder = "Search by name, ticker or stock";
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
    b.addEventListener("click", () => { filter = key; for (const c of chips.children) c.setAttribute("aria-pressed", String(c.dataset.key === key)); draw(); });
    return b;
  };
  chips.append(chipFor("all", "All"), chipFor("launched", "Launched"), chipFor("planned", "Not launched yet"));

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
    if (r.portrait) {
      thumb = el("img", "find-thumb");
      thumb.src = r.portrait; thumb.alt = ""; thumb.width = 44; thumb.height = 44; thumb.loading = "lazy"; thumb.decoding = "async";
      thumb.addEventListener("error", () => thumb.replaceWith(faceFor(r, "face find-face")), { once: true });
    } else thumb = faceFor(r, "face find-face");
    const text = el("span", "find-text");
    text.append(el("span", "find-name", r.name));
    const who = r.company || r.stock;
    const meta = [tickerLabel(r), r.pair.symbol, who && who !== r.pair.symbol ? who : ""].filter(Boolean).join(" · ");
    if (meta) text.append(el("span", "find-meta", meta));
    b.append(thumb, text, badgeFor(r));
    b.addEventListener("click", () => { if (!inline) root.close?.(); onChoose(r.id); });
    li.append(b);
    list.append(li);
    return { r, li, hay: [r.name, r.ticker, r.stock, r.company, r.realCatName, r.pair.symbol].join(" ").toLowerCase() };
  });

  function draw() {
    const q = input.value.trim().toLowerCase().replace(/^\$/, "");
    let n = 0;
    for (const it of items) {
      const okF = filter === "all" || (filter === "launched" ? isLaunched(it.r) : !isLaunched(it.r));
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
    open() {
      if (inline) return;
      if (!root.open) root.showModal();
      input.focus();
      input.select();
    },
    get isOpen() { return inline || !!root.open; },
  };
}
