/* The card that opens when a cat is chosen: who the cat is, how far it has travelled online,
   the post or page that links it to its stock, its token, and (only once it has launched) where
   to buy it. A side panel on wide screens, a bottom sheet on phones. Every line comes from
   assets/residents.js through assets/ui/data.js; nothing is made up here. When there is
   nothing to show, the card says so ("Not measured", "Not launched yet"). */

import { isLaunched, shortMint, hostOf, dateText, swatchOf } from "./data.js";

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
function link(href, text, cls) {
  const a = el("a", cls, text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

/** A little drawn cat face in the cat's coat colour (used when there is no portrait). */
export function faceFor(r, cls = "face") {
  const f = el("span", cls);
  f.setAttribute("aria-hidden", "true");
  f.style.setProperty("--coat", swatchOf(r));
  const second = swatchOf(r, "second");
  if (second) f.style.setProperty("--coat2", second);
  f.append(el("i"), el("i"));
  return f;
}

const LINK_TYPES = {
  official_character: "The company's own cat",
  official_post: "In the company's own post",
  reported: "Reported by crypto news, not verified",
  collaboration: "A collaboration",
  big_cat: "A big cat",
  executive: "An executive's cat",
  community: "Made by fans, not the company",
  partner: "A partner's cat",
};
const STRENGTH = { strong: "strong link", medium: "medium link", weak: "weak link" };
const DATE_TYPE = { posted: "posted ", published: "published ", updated: "updated ", opened: "read " };

/** How a virality figure's date reads: counted that day, as of the source's date, the day the source
    was published, or the day an undated source was read. */
function viralityWhen(v) {
  const d = dateText(v.date);
  switch (v.dateType) {
    case "measured": return `, counted ${d}`;
    case "as_of": return `, as of ${d}`;
    case "published": return `, published ${d}`;
    case "undated": return `, read ${d}; the source gives no date`;
    default: return `, ${d}`;
  }
}

/** The ticker as a card shows it: a cashtag only for a launched token. A planned cat's ticker is
    only a plan, and a token found under it elsewhere is not this cat. */
export function tickerLabel(r) {
  if (!r.ticker) return "";
  return isLaunched(r) ? `$${r.ticker}` : r.ticker;
}

export function badgeFor(r) {
  if (r.example) return el("span", "badge badge-example", "Example, not a token");
  return isLaunched(r) ? el("span", "badge badge-launched", "Launched") : el("span", "badge badge-planned", "Not launched yet");
}

/**
 * @param {object} o
 * @param {HTMLElement} o.root      the card element (hidden until a cat is chosen)
 * @param {() => void} o.onClose    the card was closed by its button
 * @param {(right: number, bottom: number) => void} [o.onInset]  how much of the view the card covers
 */
export function createCard({ root, onClose, onInset }) {
  let current = null;
  let doingEl = null;
  let lastDoing = "";

  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "false");
  root.setAttribute("aria-labelledby", "card-name");
  root.tabIndex = -1;
  root.hidden = true;

  const measure = () => {
    if (root.hidden) { onInset?.(0, 0); return; }
    const rc = root.getBoundingClientRect();
    const sheet = rc.width >= window.innerWidth - 2;
    if (sheet) onInset?.(0, Math.max(0, window.innerHeight - rc.top));
    else onInset?.(Math.max(0, window.innerWidth - rc.left), 0);
  };
  new ResizeObserver(measure).observe(root);
  addEventListener("resize", measure);

  function section(title, id) {
    const s = el("section", "card-sec");
    const h = el("h3", null, title);
    h.id = id;
    s.setAttribute("aria-labelledby", id);
    s.append(h);
    return s;
  }

  /* On a phone the card is a bottom sheet over the lower part of the garden. Its grip (a button)
     pulls it up to nearly full height and back; scrolling the card's text pulls it up too. */
  const isSheet = () => root.getBoundingClientRect().width >= window.innerWidth - 2;
  let grip = null;
  function setTall(on) {
    root.classList.toggle("card-tall", on);
    grip?.setAttribute("aria-expanded", String(on));
    grip?.setAttribute("aria-label", on ? "Show less of this card" : "Show more of this card");
  }

  function render(r) {
    root.replaceChildren();
    grip = el("button", "card-grip");
    grip.type = "button";
    grip.append(el("span", "card-grip-bar"));
    // A tap (or Enter) toggles; a drag up or down sets it.
    let dragFrom = null, dragged = false;
    grip.addEventListener("pointerdown", (e) => { dragFrom = e.clientY; dragged = false; });
    grip.addEventListener("pointerup", (e) => {
      if (dragFrom !== null && Math.abs(e.clientY - dragFrom) > 24) { dragged = true; setTall(e.clientY < dragFrom); }
      dragFrom = null;
    });
    grip.addEventListener("click", () => { if (dragged) { dragged = false; return; } setTall(!root.classList.contains("card-tall")); });
    const close = el("button", "card-close");
    close.type = "button";
    close.setAttribute("aria-label", "Close this cat's card");
    close.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
    close.addEventListener("click", () => { api.close(); onClose?.(); });

    /* Head: portrait, name, ticker, status, what it is doing right now. */
    const head = el("header", "card-head");
    let pic;
    if (r.portrait) {
      pic = el("img", "card-portrait");
      pic.src = r.portrait;
      pic.alt = `Portrait of ${r.name}`;
      pic.width = 112; pic.height = 112;
      pic.decoding = "async";
      pic.addEventListener("error", () => pic.replaceWith(faceFor(r, "face card-face")), { once: true });
    } else pic = faceFor(r, "face card-face");
    const titles = el("div", "card-titles");
    // What the coin is priced in, not the company: the company presents nothing here (see the foot).
    const kicker = r.example ? "An example cat" : `${isLaunched(r) ? "Cat coin" : "Planned cat coin"}${r.pair.symbol ? ` · priced in ${r.pair.symbol}` : ""}`;
    titles.append(el("p", "card-kicker", kicker));
    const h2 = el("h2", "card-name", r.name);
    h2.id = "card-name";
    titles.append(h2);
    const tick = el("p", "card-ticker");
    if (r.ticker && isLaunched(r)) tick.append(el("span", "mono", `$${r.ticker}`));
    else if (r.ticker) { const t = el("span", "card-planned-ticker"); t.append("Planned ticker ", el("span", "mono", r.ticker)); tick.append(t); }
    tick.append(badgeFor(r));
    titles.append(tick);
    doingEl = el("p", "card-doing");
    doingEl.setAttribute("aria-hidden", "true");
    titles.append(doingEl);
    lastDoing = "";
    head.append(pic, titles);

    const body = el("div", "card-body");
    body.addEventListener("scroll", () => { if (body.scrollTop > 24 && isSheet() && !root.classList.contains("card-tall")) setTall(true); }, { passive: true });

    /* 1. Who the cat is: its own story, then the stock's real cat as the research found it. */
    const who = section("Who the cat is", "card-who");
    if (r.description) who.append(el("p", "card-story", r.description));
    // A cat drawn to look like a company's cat says so plainly, right under its story.
    if (r.tribute) who.append(el("p", "card-tribute", r.tribute));
    const real = el("div", "card-real");
    const realHead = el("p", "card-real-head");
    realHead.append(el("span", "card-real-kicker", `The real cat behind ${r.pair.symbol || "its stock"}`));
    const realName = r.realCatLink ? (r.realCatName || "Not named") : "None found";
    realHead.append(el("b", "card-real-name", realName));
    const kind = [LINK_TYPES[r.linkType] || "", r.realCatLink && STRENGTH[r.strength] ? STRENGTH[r.strength] : ""].filter(Boolean).join(" · ");
    if (kind && r.realCatLink) realHead.append(el("span", "card-real-kind", kind));
    real.append(realHead);
    if (r.who) for (const p of r.who.split(/\n{2,}/)) real.append(el("p", null, p));
    else real.append(el("p", "card-none", "Nothing sourced yet."));
    who.append(real);
    body.append(who);

    /* 2. Virality: each figure with its source and date. */
    const vir = section("Virality", "card-vir");
    if (r.virality.length) {
      const ul = el("ul", "card-list");
      for (const v of r.virality) {
        const li = el("li");
        const fig = el("span", "card-fig");
        if (v.value) fig.append(el("b", null, v.value), " ");
        if (v.label) fig.append(v.label);
        li.append(fig);
        const src = el("span", "card-src");
        src.append(link(v.source, v.sourceLabel || hostOf(v.source)));
        src.append(viralityWhen(v));
        li.append(src);
        if (v.method) li.append(el("span", "card-method", v.method));
        ul.append(li);
      }
      vir.append(ul);
    } else {
      vir.append(el("p", "card-none", "Not measured."));
      vir.append(el("p", "card-note", "No view, like or share count was found for a post or page about this cat, so none is shown."));
    }
    body.append(vir);

    /* 3. The X post or site that links the cat to its stock. */
    const lk = section(r.realCatLink ? "The post or site that links it to the stock" : "Sources", "card-links");
    if (r.basis) lk.append(el("p", "card-basis", r.basis));
    if (r.links.length) {
      const ul = el("ul", "card-list card-links");
      for (const l of r.links) {
        const li = el("li");
        li.append(link(l.url, l.label || hostOf(l.url)));
        const when = l.date ? `${DATE_TYPE[l.dateType] ?? ""}${dateText(l.date)}` : "";
        li.append(el("span", "card-src", [hostOf(l.url), when].filter(Boolean).join(", ")));
        ul.append(li);
      }
      lk.append(ul);
    } else lk.append(el("p", "card-none", "No sourced link yet."));
    if (r.checked) lk.append(el("p", "card-note", `Every link was opened again on ${dateText(r.checked)}.`));
    body.append(lk);

    /* 4. The token created for it. */
    const tk = section("The token", "card-token");
    const dl = el("dl", "card-dl");
    const row = (k, v) => { const dt = el("dt", null, k); const dd = el("dd"); if (v instanceof Node) dd.append(v); else dd.textContent = v; dl.append(dt, dd); };
    if (r.example) row("Status", "An example cat. Not a token.");
    else if (isLaunched(r)) {
      const status = el("span");
      status.append(el("span", "badge badge-launched", "Launched"));
      if (r.token.launchedAt) status.append(` on ${dateText(r.token.launchedAt)}`);
      row("Status", status);
      const m = el("span");
      m.append(r.explorer?.token ? link(r.explorer.token, shortMint(r.token.mint), "mono") : el("span", "mono", shortMint(r.token.mint)), " ");
      const copy = el("button", "card-copy", "Copy");
      copy.type = "button";
      copy.setAttribute("aria-label", `Copy the mint address ${r.token.mint}`);
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(r.token.mint); copy.textContent = "Copied"; } catch { copy.textContent = "Select it"; }
        setTimeout(() => { copy.textContent = "Copy"; }, 1600);
      });
      m.append(copy);
      row("Mint", m);
      if (r.explorer?.tx) row("Launch", link(r.explorer.tx, "The launch on Solscan"));
      if (r.explorer?.stonkfun) row("StonkFun", link(r.explorer.stonkfun, "Its StonkFun page"));
      if (r.plannedName) row("Planned as", r.plannedName);
    } else {
      const st = el("span");
      st.append(el("span", "badge badge-planned", "Not launched yet"));
      row("Status", st);
    }
    if (r.ticker && isLaunched(r)) row("Ticker", el("span", "mono", `$${r.ticker}`));
    else if (r.ticker) row("Planned ticker", el("span", "mono", r.ticker));
    if (r.pair.symbol) {
      const pw = el("span");
      pw.append(el("span", "mono", r.pair.symbol));
      const co = r.company || r.stock;
      if (co && co !== r.pair.symbol) pw.append(` (${co})`);
      row("Paired with", pw);
    }
    tk.append(dl);
    if (!isLaunched(r) && !r.example) tk.append(el("p", "card-note", "No token exists for this cat yet. It becomes one when the sanctuary's keeper launches it on StonkFun and the hourly check finds that launch on Solana."));
    body.append(tk);

    /* 5. Where to buy it: GMGN and FOMO, only for a launched token (data.js keeps only links that name its mint). */
    const buy = section("Buy", "card-buy-h");
    if (isLaunched(r) && r.buy.length) {
      const wrap = el("div", "card-buy");
      for (const b of r.buy) wrap.append(link(b.url, `Buy on ${b.label}`, "btn btn-buy"));
      buy.append(wrap);
      if (r.buy.some((b) => b.label === "FOMO")) buy.append(el("p", "card-note", "FOMO asks you to sign in before it shows the token."));
    } else {
      buy.append(el("p", "card-none", "Nothing to buy yet."));
      buy.append(el("p", "card-note", "Links to the token on GMGN.ai and FOMO appear here once this cat has launched."));
      if (r.ticker && !r.example) buy.append(el("p", "card-note card-warn", `Any token called ${r.ticker} that you find before launch is not this cat. Only the mint shown on this card after launch is.`));
    }
    body.append(buy);

    // Always in view at the foot of the card, whatever is scrolled.
    const company = r.company || r.stock || (r.pair.symbol ? `the company behind ${r.pair.symbol}` : "any company");
    const foot = el("p", "card-disclaimer", r.disclaimer || `Not affiliated with ${company} or with StonkFun. A memecoin with no intrinsic value; not financial advice.`);

    root.append(grip, close, head, body, foot);
    setTall(false);
  }

  const api = {
    get id() { return current ? current.id : null; },
    get isOpen() { return !root.hidden; },
    /** On a phone: the sheet is pulled up over nearly all of the garden. */
    get isTall() { return !root.hidden && root.classList.contains("card-tall"); },
    open(r, { focus = true } = {}) {
      const same = current && current.id === r.id && !root.hidden;
      current = r;
      if (!same) render(r);
      root.hidden = false;
      root.classList.remove("leaving");
      root.querySelector(".card-body")?.scrollTo?.(0, 0);
      if (focus) root.focus({ preventScroll: true });
      requestAnimationFrame(measure);
    },
    close() {
      if (root.hidden) return;
      root.hidden = true;
      current = null;
      onInset?.(0, 0);
    },
    /** What the cat is doing now (shown under its name). */
    setDoing(text) {
      if (!doingEl || text === lastDoing) return;
      lastDoing = text || "";
      doingEl.textContent = lastDoing;
    },
  };
  return api;
}
