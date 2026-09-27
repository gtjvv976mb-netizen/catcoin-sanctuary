/* "Trending": three lists read from data/trending.json (scripts/build-trending.mjs writes it every
   20 minutes). Top movers: the Hall of Fame coins and the sanctuary's launched cats by 24 h volume.
   New on pump.fun: cat coins launched there in the last day, copycats of the sanctuary's cats
   flagged. Hot on X: the sanctuary's own posts by engagement.

   Every name and symbol here was typed by a stranger, so the page checks the file (checkTrending)
   and draws text only through textContent; links are built from checked addresses, never read. */

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const iso = (v) => (typeof v === "string" && ISO.test(v) ? v : null);
/** A stranger's text: no control or invisible characters, trimmed, at most `max` characters. */
export const clean = (v, max) => (typeof v === "string" ? [...v.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g, "").replace(/\s+/g, " ").trim()].slice(0, max).join("") : "");

/** data/trending.json checked: bad rows dropped, strings cleaned. Never throws; null for a file that is not one. */
export function checkTrending(j) {
  if (!j || typeof j !== "object") return null;
  const sec = (s, row) => ({ updatedAt: iso(s?.updatedAt), status: typeof s?.status === "string" ? clean(s.status, 20) : null, items: (Array.isArray(s?.items) ? s.items : []).map(row).filter(Boolean).slice(0, 60) });
  return {
    updatedAt: iso(j.updatedAt),
    activity: sec(j.activity, (r) => {
      const chain = /^[a-z]{3,12}$/.test(r?.chain ?? "") ? r.chain : null;
      if (!r || !chain || !MINT.test(r.pair ?? "") || !MINT.test(r.mint ?? "") || !clean(r.name, 40)) return null;
      return { id: clean(r.id, 40), kind: r.kind === "sanctuary" ? "sanctuary" : "famous", name: clean(r.name, 40), symbol: clean(r.symbol, 16), chain, pair: r.pair, mint: r.mint,
        marketCapUsd: num(r.marketCapUsd), volume24hUsd: num(r.volume24hUsd), change24hPct: num(r.change24hPct) };
    }),
    fresh: sec(j.fresh, (r) => {
      if (!r || !MINT.test(r.mint ?? "") || !iso(r.createdAt)) return null;
      return { mint: r.mint, name: clean(r.name, 40) || "(no name)", symbol: clean(r.symbol, 16), createdAt: r.createdAt, marketCapUsd: num(r.marketCapUsd),
        copycatOf: /^[A-Za-z0-9]{2,44}$/.test(r.copycatOf ?? "") ? r.copycatOf : null, count: Math.max(1, Math.min(999, Math.round(num(r.count) ?? 1))) };
    }),
    x: sec(j.x, (r) => {
      if (!r || !/^\d{5,25}$/.test(r.tweet ?? "") || !/^[A-Za-z0-9]{2,44}$/.test(r.key ?? "")) return null;
      const n = (k) => Math.max(0, Math.round(num(r[k]) ?? 0));
      return { key: r.key, name: clean(r.name, 40), tweet: r.tweet, postedAt: iso(r.postedAt), likes: n("likes"), reposts: n("reposts"), replies: n("replies"), quotes: n("quotes"), impressions: num(r.impressions) };
    }),
  };
}

export const usd = (v) => (v == null ? "—" : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`);
export const pct = (v) => (v == null ? "" : `${v > 0 ? "+" : ""}${v.toFixed(Math.abs(v) < 10 ? 1 : 0)}%`);
/** "5 min ago", "3 h ago", "2 d ago". */
export function ago(at, nowMs) {
  const m = Math.max(0, Math.round((nowMs - Date.parse(at)) / 60000));
  return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
}

function link(href, cls, text) {
  const a = el("a", cls, text);
  a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
  return a;
}

/**
 * @param {object} o
 * @param {HTMLDialogElement} o.dialog
 * @param {(root: HTMLDialogElement, title: string, id: string) => HTMLElement} o.shell  the panels' frame (panels.js)
 * @param {(id: string) => ({ name: string } | null)} o.catOf   a sanctuary cat by key, or null
 * @param {(id: string) => void} o.onOpenCat
 */
export function createTrending({ dialog, shell, catOf, onOpenCat, now = () => Date.now() }) {
  let data = null, tab = "activity";
  const TABS = [["activity", "Top movers"], ["fresh", "New on pump.fun"], ["x", "Hot on X"]];

  function catButton(key, label) {
    const b = el("button", "trend-cat", label);
    b.type = "button";
    b.addEventListener("click", () => { dialog.close(); onOpenCat(key); });
    return b;
  }

  function rows(list, draw) {
    const ol = el("ol", "trend-list");
    list.forEach((r, i) => { const li = el("li", "trend-row"); li.append(el("span", "trend-rank", String(i + 1)), ...draw(r)); ol.append(li); });
    return ol;
  }

  function section(body) {
    const nowMs = now();
    const s = data?.[tab];
    if (!s || !s.items.length) {
      const why = tab === "x" && s?.status && s.status !== "ok" ? "X figures are not available right now." : "Nothing here yet. The list refreshes every 20 minutes.";
      body.append(el("p", "panel-note", why));
      return;
    }
    if (tab === "activity") {
      body.append(rows(s.items, (r) => {
        const main = el("span", "trend-main");
        main.append(link(`https://dexscreener.com/${r.chain}/${r.pair}`, "trend-name", r.name), el("span", "trend-sym mono", r.symbol ? `$${r.symbol}` : ""));
        if (r.kind === "sanctuary" && catOf(r.id)) main.append(catButton(r.id, "See the cat"));
        const fig = el("span", "trend-fig");
        fig.append(el("span", null, `${usd(r.volume24hUsd)} vol`), el("span", `trend-pct ${r.change24hPct > 0 ? "up" : r.change24hPct < 0 ? "down" : ""}`, pct(r.change24hPct)));
        return [main, fig];
      }));
      body.append(el("p", "panel-small", "Ranked by 24 h trading volume (DexScreener). Hall of Fame coins are made by others, not the sanctuary."));
    } else if (tab === "fresh") {
      body.append(rows(s.items, (r) => {
        const main = el("span", "trend-main");
        main.append(link(`https://pump.fun/coin/${r.mint}`, "trend-name", r.name), el("span", "trend-sym mono", r.symbol ? `$${r.symbol}` : ""));
        if (r.count > 1) main.append(el("span", "trend-count", `\u00d7${r.count}`));
        const cat = r.copycatOf && catOf(r.copycatOf);
        if (cat) { main.append(el("span", "badge trend-copy", "Copycat")); main.append(catButton(r.copycatOf, `Not the real ${cat.name}`)); }
        const fig = el("span", "trend-fig");
        fig.append(el("span", null, usd(r.marketCapUsd)), el("span", "trend-when", ago(r.createdAt, nowMs)));
        return [main, fig];
      }));
      body.append(el("p", "panel-small", "Cat coins launched on pump.fun in the last day, by strangers. Not affiliated, not checked, often scams. A “Copycat” uses the name or ticker of a sanctuary cat before the real launch: only the mint on the cat's own card is real."));
    } else {
      body.append(rows(s.items, (r) => {
        const main = el("span", "trend-main");
        main.append(link(`https://x.com/catcosanctuary/status/${r.tweet}`, "trend-name", r.name || r.key));
        if (catOf(r.key)) main.append(catButton(r.key, "See the cat"));
        const fig = el("span", "trend-fig");
        fig.append(el("span", null, `♥ ${r.likes} · ↻ ${r.reposts}`), el("span", "trend-when", r.postedAt ? ago(r.postedAt, nowMs) : ""));
        return [main, fig];
      }));
      body.append(el("p", "panel-small", "The sanctuary's own posts on X, by likes, reposts and replies."));
    }
    if (s.updatedAt) body.append(el("p", "panel-small", `Updated ${ago(s.updatedAt, nowMs)}.`));
  }

  let body = null;
  function draw() {
    body ||= shell(dialog, "Trending", "trending-title"); // the frame once; each draw refills its body
    body.replaceChildren();
    const bar = el("div", "trend-tabs");
    bar.setAttribute("role", "tablist");
    for (const [id, label] of TABS) {
      const b = el("button", "trend-tab", label);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(id === tab));
      b.addEventListener("click", () => { tab = id; draw(); [...dialog.querySelectorAll(".trend-tab")].find((t) => t.getAttribute("aria-selected") === "true")?.focus?.(); });
      bar.append(b);
    }
    body.append(bar);
    section(body);
    body.append(el("p", "panel-small", "Market figures are for fun, not advice. Memecoins have no intrinsic value."));
  }

  return {
    open() { draw(); if (!dialog.open) dialog.showModal(); },
    setData(j) { data = checkTrending(j); if (dialog.open) draw(); },
  };
}
