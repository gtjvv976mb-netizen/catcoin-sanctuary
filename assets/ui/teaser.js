/* "Who's that cat?": the next cat to move in, as a black silhouette on a sunburst card
   (data/next-cat.json, written by scripts/announce.mjs; never the cat's name). A small tab opens
   it, as does the easel by the porch. The reveal is the "New cat just moved in!" card (newcat.js). */

export const CHIPS = { company: "🏢 Company", celebrity: "🌟 Celebrity", "tv-movie": "🎬 TV-movie", crypto: "🪙 Crypto", viral: "🔥 Viral" };
export const FOLLOW = "https://x.com/catcosanctuary";

// The file, checked: an opaque id, a silhouette under assets/teaser/, a known category.
export function readNext(j) {
  if (!j || !/^[0-9a-f]{16}$/.test(j.id)) return null;
  return { id: j.id, silhouette: /^assets\/teaser\/[0-9a-f]{16}\.png$/.test(j.silhouette) ? j.silhouette : null,
    hint: typeof j.hint === "string" ? j.hint.slice(0, 240) : "", category: CHIPS[j.category] ? j.category : null, expectedAt: Date.parse(j.expectedAt) || null };
}

export function countdown(ms) {
  if (!(ms > 0)) return "any minute now 👀";
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), p = (n) => String(n).padStart(2, "0");
  return h ? `${h}h ${p(m)}m` : `${m}m ${p(s % 60)}s`;
}

export function createTeaser({ dialog, tab, onChange, fetchImpl = (...a) => globalThis.fetch(...a), now = () => Date.now(), pollMs = 4 * 60_000 }) {
  let next = null, tick = 0;
  const el = (t, c, x) => { const e = document.createElement(t); e.className = c; if (x != null) e.textContent = x; return e; };
  const left = () => countdown((next?.expectedAt ?? 0) - now());

  function render() {
    const close = el("button", "whos-close", "×");
    close.type = "button"; close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => dialog.close());
    const burst = el("div", "whos-burst");
    if (next.silhouette) { const img = el("img", "whos-sil"); img.src = next.silhouette; img.alt = "A mystery cat's black silhouette"; img.width = img.height = 300; burst.append(img); }
    else burst.append(el("span", "whos-q", "?"));
    const body = el("div", "whos-body");
    body.append(el("p", "whos-kicker", "Next cat moving in"), el("h2", "whos-title", "❓ Who's that cat?"));
    body.lastChild.id = "whos-title";
    if (next.category) body.append(el("span", `whos-chip whos-${next.category}`, CHIPS[next.category]));
    body.append(el("p", "whos-hint", next.hint));
    const count = el("p", "whos-count", "⏳ Moving in ");
    count.append(el("b", "whos-left", left()));
    const follow = el("a", "btn whos-follow", "Follow @catcosanctuary for the reveal");
    follow.href = FOLLOW; follow.target = "_blank"; follow.rel = "noopener";
    body.append(count, follow, el("p", "whos-reveal", "The reveal lands here: 🆕 New cat just moved in!"));
    dialog.replaceChildren(close, burst, body);
  }

  function open() {
    if (!next) return;
    render();
    if (!dialog.open) dialog.showModal();
    clearInterval(tick);
    tick = setInterval(() => { if (!dialog.open) return clearInterval(tick); const b = dialog.querySelector(".whos-left"); if (b) b.textContent = left(); }, 1000);
  }

  async function check() {
    try {
      const r = await fetchImpl(`data/next-cat.json?t=${Math.floor(now() / 60_000)}`, { cache: "no-cache", credentials: "same-origin" });
      const n = r.ok ? readNext(await r.json()) : null;
      if (n?.id === next?.id && n?.expectedAt === next?.expectedAt) return next;
      next = n;
    } catch { return next; }
    tab.hidden = !next;
    onChange?.(next);
    if (next && dialog.open) render();
    return next;
  }

  tab.addEventListener("click", open);
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  const timer = pollMs > 0 ? setInterval(() => { if (!document.hidden) check(); }, pollMs) : 0;
  return { check, open, stop: () => clearInterval(timer), get next() { return next; } };
}
