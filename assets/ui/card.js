/* The card that opens when a cat is chosen: who the cat is, how far it has travelled online,
   the post or page that links it to its stock, its token, and (only once it has launched) where
   to buy it. A side panel on wide screens, a bottom sheet on phones. Every line comes from
   assets/residents.js through assets/ui/data.js; nothing is made up here. When there is
   nothing to show, the card says so ("Not measured", "Not launched yet"). */

import { isLaunched, isFamous, isAdoptable, shortMint, hostOf, dateText, swatchOf } from "./data.js";
import { marketWarnings } from "../collection.js";
import { CATEGORY_LABELS, existingCoinLine } from "./adoptables.js";
import { adoptPanel, canAdopt, kitFiles, loadKits, loadLaunchpads } from "./adopt.js";

/** Chains as a card names them. */
export const CHAIN_NAMES = {
  solana: "Solana", ethereum: "Ethereum", base: "Base", bsc: "BNB Chain", robinhood: "Robinhood Chain", ton: "TON", hyperevm: "HyperEVM",
  hyperliquid: "Hyperliquid", arc: "Arc", ink: "Ink", sui: "Sui", avalanche: "Avalanche", arbitrum: "Arbitrum", xrpl: "XRP Ledger",
  cronos: "Cronos", stacks: "Stacks", near: "NEAR", tron: "Tron", beam: "Beam", polygon: "Polygon", worldchain: "World Chain",
  unichain: "Unichain", abstract: "Abstract", zksync: "zkSync",
};
export const chainName = (c) => CHAIN_NAMES[c] || c;
export const TIER_NAMES = { main: "Hall of Fame" };
/** $57.3M, $812K, $4,210. */
export function usdShort(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "Not measured";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}M`;
  if (v >= 1e4) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

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

/** A clean placeholder for a cat whose portrait is still to come: a sitting-cat silhouette in its coat colours on the dusk sky. */
export function silhouetteFor(r, cls = "card-portrait card-silhouette") {
  const f = el("span", cls);
  f.setAttribute("role", "img");
  f.setAttribute("aria-label", `${r.name}: portrait coming soon`);
  const base = swatchOf(r), second = swatchOf(r, "second") || base;
  f.style.setProperty("--coat", base);
  f.style.setProperty("--coat2", second);
  f.innerHTML = '<svg viewBox="0 0 112 112" width="112" height="112" aria-hidden="true"><defs><linearGradient id="adopt-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2350"/><stop offset=".65" stop-color="#8a4f6e"/><stop offset="1" stop-color="#e59a6a"/></linearGradient></defs><rect width="112" height="112" rx="14" fill="url(#adopt-sky)"/><path d="M40 100c-6-18-4-34 6-44l-4-24 12 12h12l12-12-4 24c10 10 12 26 6 44z" class="sil-body" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/><path d="M50 100c-2-14 0-24 6-30 6 6 8 16 6 30z" class="sil-chest" opacity=".9"/><path d="M78 98c12 2 18-6 16-16" fill="none" class="sil-tail" stroke-width="6" stroke-linecap="round"/></svg>';
  return f;
}

/** The picture of the moment that made a cat famous, with its caption. */
export function loreFigure(r) {
  const fig = el("figure", "card-lore-pic");
  const img = el("img", "card-lore-img");
  img.src = r.lore.image; img.alt = r.lore.caption; img.width = 1200; img.height = 800; img.loading = "lazy"; img.decoding = "async";
  img.addEventListener("error", () => fig.remove(), { once: true });
  fig.append(img, el("figcaption", "card-lore-caption", r.lore.caption));
  return fig;
}

/** Our generated picture, lower on the card, labelled as the in-game look. */
export function inGameFigure(src, alt) {
  const fig = el("figure", "card-ingame");
  const img = el("img", "card-ingame-img");
  img.src = src; img.alt = alt; img.width = 112; img.height = 112; img.loading = "lazy"; img.decoding = "async";
  img.addEventListener("error", () => fig.remove(), { once: true });
  fig.append(img, el("figcaption", "card-ingame-caption", "🎮 In-game look"));
  return fig;
}

/**
 * The real photo from the cat's X post, at the top of its card: hotlinked from pbs.twimg.com
 * (never hosted here), captioned "📸 Real photo · @handle" with a link to the post. If the image
 * cannot load, our own picture (`fallback`, the in-game look) takes its place.
 */
export function realPhotoFigure(ph, fallback = null) {
  const fig = el("figure", "card-real-photo");
  const img = el("img", "card-real-photo-img");
  img.src = ph.url; img.alt = ph.alt; img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  img.addEventListener("error", () => { if (fallback) fig.replaceWith(fallback); else fig.remove(); }, { once: true });
  const cap = el("figcaption", "card-real-photo-caption", "📸 Real photo · ");
  const a = link(ph.post, `@${ph.handle}`, "card-real-photo-link");
  a.setAttribute("aria-label", `Real photo by @${ph.handle}: view the post on X (opens in a new tab)`);
  cap.append(a);
  fig.append(img, cap);
  return fig;
}

/** Puts the real photo at the top of a card body, with our picture just under it as the in-game look. */
function addTopPhoto(r, body, ours) {
  if (!r.realPhoto) return;
  const game = ours ? inGameFigure(ours.src, ours.alt) : null;
  const top = realPhotoFigure(r.realPhoto, game);
  body.prepend(...[top, game].filter(Boolean));
}

/** A note, under the proof, naming the post the real photo comes from when it is not the proof itself. */
function photoSourceNote(r) {
  if (r.realPhoto?.source !== "search") return null;
  const p = el("p", "card-note card-photo-source", "Photo source: ");
  p.append(link(r.realPhoto.post, `@${r.realPhoto.handle}'s post ↗`));
  return p;
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

/* The proof block's own styles live in assets/ui/proof.css, linked once from here. */
function linkProofStyles() {
  try {
    const head = document.head;
    if (!head || document.getElementById("proof-css")) return;
    const l = document.createElement("link");
    l.id = "proof-css";
    l.rel = "stylesheet";
    l.href = new URL("./proof.css", import.meta.url).href;
    head.append(l);
  } catch { /* no document head (tests): the block still renders, unstyled */ }
}

const PROOF_WHEN = { posted: "", published: "Published ", updated: "Updated ", opened: "Read " };

/**
 * The proof: the one X post or page that best links the cat to its company, drawn statically
 * like a post (no widget script, nothing loaded from X): a lettered circle, the author and
 * @handle, the date, the post's own words, the captured picture if there is one, and a link out.
 */
export function proofBlock(p) {
  const fig = el("figure", `proof proof-${p.kind}`);
  const top = el("div", "proof-top");
  const av = el("span", "proof-avatar", ([...(p.author || "?").replace(/^[^\p{L}\p{N}]+/u, "")][0] || "?").toUpperCase());
  av.setAttribute("aria-hidden", "true");
  const who = el("div", "proof-who");
  who.append(el("b", "proof-author", p.author));
  if (p.kind === "x" && p.handle) {
    const h = link(`${new URL(p.url).origin}/${p.handle}`, `@${p.handle}`, "proof-handle");
    h.title = `${p.author} on X`;
    who.append(h);
  } else who.append(el("span", "proof-handle", hostOf(p.url)));
  top.append(av, who);
  top.append(el("span", "proof-kind", p.kind === "x" ? "X post" : "Web page"));
  fig.append(top);
  if (p.text) {
    const q = el("blockquote", "proof-text", p.text);
    q.cite = p.url;
    fig.append(q);
  }
  if (p.image) {
    const img = el("img", "proof-img");
    img.src = p.image;
    img.alt = p.kind === "x" ? `The picture in ${p.author}'s post` : `A picture from ${p.author}'s page`;
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", () => img.remove(), { once: true });
    fig.append(img);
  }
  const foot = el("figcaption", "proof-foot");
  if (p.date) {
    const t = el("time", "proof-date", `${PROOF_WHEN[p.dateType] ?? ""}${dateText(p.date)}`);
    t.dateTime = p.date;
    foot.append(t);
  }
  fig.append(foot);
  /* The link out, as a clear button: the post on X, or the page that tells the story. */
  const go = link(p.url, p.kind === "x" ? "View post on X ↗" : "Read the story ↗", "proof-link");
  go.setAttribute("aria-label", p.kind === "x" ? `View ${p.author}'s post on X (opens in a new tab)` : `Read the story on ${hostOf(p.url)} (opens in a new tab)`);
  fig.append(go);
  if (p.note) fig.append(el("p", "proof-note", p.note));
  return fig;
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
  if (isFamous(r)) return `$${r.ticker}`;
  return isLaunched(r) ? `$${r.ticker}` : r.ticker;
}

export function badgeFor(r) {
  if (r.example) return el("span", "badge badge-example", "Example, not a token");
  if (isFamous(r)) return el("span", "badge badge-famous", "Hall of Fame");
  if (isAdoptable(r)) return el("span", "badge badge-planned", "Not launched yet");
  return isLaunched(r) ? el("span", "badge badge-launched", "Launched") : el("span", "badge badge-planned", "Not launched yet");
}

/**
 * @param {object} o
 * @param {HTMLElement} o.root      the card element (hidden until a cat is chosen)
 * @param {() => void} o.onClose    the card was closed by its button
 * @param {(right: number, bottom: number) => void} [o.onInset]  how much of the view the card covers
 */
export function createCard({ root, onClose, onInset }) {
  linkProofStyles();
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

  /* "Adopt this cat": swaps the card's body for the Adopt panel (assets/ui/adopt.js); its Back
     button brings the cat's card back. */
  function adoptButton(r, top = false) {
    const b = el("button", `btn btn-buy btn-adopt${top ? " btn-adopt-top" : ""}`, top ? "🐾 Adopt this cat" : "Adopt this cat");
    b.type = "button";
    b.addEventListener("click", () => api.adopt());
    return b;
  }

  /** The copy button for an address. */
  function copyButton(value, what) {
    const copy = el("button", "card-copy", "Copy");
    copy.type = "button";
    copy.setAttribute("aria-label", `Copy the ${what} ${value}`);
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(value); copy.textContent = "Copied"; } catch { copy.textContent = "Select it"; }
      setTimeout(() => { copy.textContent = "Copy"; }, 1600);
    });
    return copy;
  }

  /* A famous cat coin's card: its logo, who the cat is and its lore, its warnings, the coin (market
     figures with when they were read, chain, contract, pair), its X and website, its one buy link,
     and the "not affiliated" line. */
  function famousBody(r, head, body) {
    let pic;
    if (r.logo) {
      pic = el("img", "card-portrait card-logo");
      pic.src = r.logo;
      pic.alt = `${r.name} logo`;
      pic.width = 112; pic.height = 112;
      pic.decoding = "async";
      pic.addEventListener("error", () => pic.replaceWith(faceFor(r, "face card-face")), { once: true });
    } else pic = faceFor(r, "face card-face");
    const titles = el("div", "card-titles");
    titles.append(el("p", "card-kicker", `Hall of Fame · ${chainName(r.chain)}`));
    const h2 = el("h2", "card-name", r.name);
    h2.id = "card-name";
    titles.append(h2);
    const tick = el("p", "card-ticker");
    tick.append(el("span", "mono", `$${r.ticker}`), badgeFor(r));
    if (r.ownerPick) tick.append(el("span", "badge badge-pick", "Owner's pick"));
    titles.append(tick);
    doingEl = el("p", "card-doing");
    doingEl.setAttribute("aria-hidden", "true");
    titles.append(doingEl);
    lastDoing = "";
    head.append(pic, titles);

    // Why it is here: not adoptable, already a coin. Straight to its one buy link.
    const insp = el("div", "card-inspiration");
    insp.append(el("p", "card-inspiration-text", "Already a coin — here as inspiration"));
    if (r.buyLink) insp.append(link(r.buyLink.url, r.buyLink.label === "GMGN" ? "Buy on GMGN" : "View on DexScreener", "card-inspiration-link"));
    body.append(insp);

    const who = section("Who the cat is", "card-who");
    if (r.catName) who.append(el("p", "card-real-name card-cat-name", r.catName));
    if (r.who) who.append(el("p", "card-story", r.who));
    const researched = r.loreSource?.kind === "profile";
    if (!researched) who.append(el("p", "card-note card-unresearched", "Lore not researched yet. Below is only what the coin's own listing says about itself."));
    if (r.description) {
      if (r.who || !researched) who.append(el("h4", "card-sub", researched ? "Lore" : "In its own words"));
      who.append(el("p", r.who ? "card-lore" : "card-story", r.description));
    }
    if (r.lorePic && !r.realPhoto) who.append(loreFigure({ lore: r.lorePic }));
    if (r.loreSource?.label) {
      const src = el("p", "card-note");
      src.append("From: ");
      if (r.loreSource.url) src.append(link(r.loreSource.url, r.loreSource.label)); else src.append(r.loreSource.label);
      who.append(src);
    }
    if (r.company) who.append(el("p", "card-company", `Company or project: ${r.company}`));
    else who.append(el("p", "card-note card-stonk", "No company stands behind this cat, so in the sanctuary's lore it is paired with STONK on StonkFun. The coin itself already exists: its real token and pair are shown below."));
    body.append(who);

    const warns = [...r.warnings, ...marketWarnings(r.market)];
    const wn = section("Warnings", "card-warnings");
    if (warns.length) {
      const ul = el("ul", "card-list card-warn-list");
      for (const w of warns) ul.append(el("li", "card-warn", w));
      wn.append(ul);
    } else wn.append(el("p", "card-none", "No warnings recorded. Memecoins are still risky."));
    body.append(wn);

    if (r.viral) {
      const v = section("Virality", "card-vir");
      v.append(el("p", null, r.viral.summary));
      if (r.viral.url) v.append(link(r.viral.url, "The original post ↗", "card-link"));
      body.append(v);
    }

    const coin = section("The coin", "card-coin");
    const dl = el("dl", "card-dl");
    const row = (k, v) => { const dt = el("dt", null, k); const dd = el("dd"); if (v instanceof Node) dd.append(v); else dd.textContent = v; dl.append(dt, dd); };
    row("Market cap", usdShort(r.market.marketCapUsd));
    row("Liquidity", usdShort(r.market.liquidityUsd));
    row("24 h volume", usdShort(r.market.volume24hUsd));
    if (r.market.measuredAt) row("Measured", `${dateText(r.market.measuredAt)} (${r.market.source === "coingecko" ? "CoinGecko" : r.market.source === "dexscreener" ? "DexScreener" : "the sanctuary's research"})`);
    row("Chain", chainName(r.chain));
    const ca = el("span", "card-ca");
    ca.append(el("span", "mono", shortMint(r.contract)), " ", copyButton(r.contract, "contract address"));
    ca.title = r.contract;
    row("Contract", ca);
    if (r.pairQuote || r.pairUrl) {
      const pw = el("span");
      const label = `${r.ticker}/${r.pairQuote || "?"}${r.pairDex ? ` on ${r.pairDex}` : ""}`;
      if (r.pairUrl) pw.append(link(r.pairUrl, label)); else pw.append(label);
      row("Pair", pw);
    }
    coin.append(dl);
    body.append(coin);

    const lk = section("Links", "card-links");
    if (r.x || r.website) {
      const ul = el("ul", "card-list card-links");
      if (r.x) { const li = el("li"); li.append(link(r.x, `On X: ${hostOf(r.x) === "x.com" ? `@${new URL(r.x).pathname.split("/")[1]}` : r.x}`)); ul.append(li); }
      if (r.website) { const li = el("li"); li.append(link(r.website, `Website: ${hostOf(r.website)}`)); ul.append(li); }
      lk.append(ul);
    } else lk.append(el("p", "card-none", "No X account or website found."));
    body.append(lk);

    const buy = section("Buy", "card-buy-h");
    if (r.buyLink) {
      const wrap = el("div", "card-buy");
      wrap.append(link(r.buyLink.url, r.buyLink.label === "GMGN" ? "Buy on GMGN" : "View on DexScreener", "btn btn-buy"));
      buy.append(wrap);
      buy.append(el("p", "card-note", "Check the contract address above before you trade. The sanctuary did not make this coin and gets nothing from this link."));
    } else buy.append(el("p", "card-none", "No buy link."));
    body.append(buy);
    const photoSrc = photoSourceNote(r);
    if (photoSrc) who.append(photoSrc);
    addTopPhoto(r, body, r.lorePic ? { src: r.lorePic.image, alt: r.lorePic.caption } : null);
  }

  /* An adoptable cat: a fan tribute to a famous cat, with its X proof and sources, not launched yet. */
  function adoptableBody(r, head, body) {
    let pic;
    if (r.realPhoto) pic = null;
    else if (r.portrait) {
      pic = el("img", "card-portrait");
      pic.src = r.portrait; pic.alt = `Portrait of ${r.name}`; pic.width = 112; pic.height = 112; pic.decoding = "async";
      pic.addEventListener("error", () => pic.replaceWith(silhouetteFor(r)), { once: true });
    } else pic = silhouetteFor(r);
    const titles = el("div", "card-titles");
    const kick = el("p", "card-kicker");
    kick.append(el("span", `adopt-chip adopt-${r.category}`, CATEGORY_LABELS[r.category] || "Adoptable cat"), ` · priced in ${r.pair.symbol || "STONK"}`);
    titles.append(kick);
    const h2 = el("h2", "card-name", r.name);
    h2.id = "card-name";
    titles.append(h2);
    const tick = el("p", "card-ticker");
    const t = el("span", "card-planned-ticker"); t.append("Planned ticker ", el("span", "mono", r.ticker));
    tick.append(t, badgeFor(r));
    titles.append(tick);
    doingEl = el("p", "card-doing");
    doingEl.setAttribute("aria-hidden", "true");
    titles.append(doingEl);
    lastDoing = "";
    titles.append(adoptButton(r, true));
    head.append(...[pic, titles].filter(Boolean));

    const who = section("Who the cat is", "card-who");
    if (r.memorial) who.append(el("p", "adopt-memorial", r.sensitivity || `In loving memory of ${r.name}.`));
    const own = el("p", "adopt-owner");
    own.append(el("span", "card-real-kicker", "Owner"), " ", el("b", null, r.owner));
    who.append(own);
    if (r.description) who.append(el("p", "card-story", r.description));
    if (r.lore) who.append(loreFigure(r));
    if (r.tribute) who.append(el("p", "card-tribute", r.tribute));
    body.append(who);

    const pf = section("Proof", "card-proof");
    if (r.proof) pf.append(proofBlock(r.proof));
    else pf.append(el("p", "card-none", "No proof post recorded yet."));
    if (r.sources.length) {
      const ul = el("ul", "card-list adopt-sources");
      for (const s of r.sources) { const li = el("li"); li.append(link(s.url, `${s.label} ↗`)); ul.append(li); }
      pf.append(el("p", "card-real-kicker", "Sources"), ul);
    }
    body.append(pf);

    const st = section("Status", "card-adopt");
    st.append(el("p", "adopt-cta", "Not launched yet — adopt it now."));
    st.append(adoptButton(r));
    st.append(el("p", "card-note", `Nothing to buy yet. Any token called ${r.ticker} that you find before launch is not this cat.`));
    if (r.portraitStatus !== "ready") st.append(el("p", "card-none", "Portrait coming soon."));
    const coin = existingCoinLine(r.existingCoin);
    if (coin) st.append(el("p", "adopt-coin", coin));
    body.append(st);
    const src = photoSourceNote(r);
    if (src) pf.append(src);
    addTopPhoto(r, body, r.portrait ? { src: r.portrait, alt: `${r.name}: the in-game look` } : null);
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
    if (isFamous(r)) {
      const body = el("div", "card-body");
      body.addEventListener("scroll", () => { if (body.scrollTop > 24 && isSheet() && !root.classList.contains("card-tall")) setTall(true); }, { passive: true });
      famousBody(r, head, body);
      const foot = el("p", "card-disclaimer", r.disclaimer || `Not affiliated with ${r.name} or its team. Not financial advice.`);
      root.append(grip, close, head, body, foot);
      setTall(false);
      return;
    }
    if (isAdoptable(r)) {
      const body = el("div", "card-body");
      body.addEventListener("scroll", () => { if (body.scrollTop > 24 && isSheet() && !root.classList.contains("card-tall")) setTall(true); }, { passive: true });
      adoptableBody(r, head, body);
      const foot = el("p", "card-disclaimer", `${r.tribute} Not launched and not financial advice.`);
      root.append(grip, close, head, body, foot);
      setTall(false);
      return;
    }
    let pic;
    if (r.realPhoto) pic = null;
    else if (r.portrait) {
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
    if (!isLaunched(r) && !r.example && canAdopt(r)) titles.append(adoptButton(r, true));
    head.append(...[pic, titles].filter(Boolean));

    const body = el("div", "card-body");
    body.addEventListener("scroll", () => { if (body.scrollTop > 24 && isSheet() && !root.classList.contains("card-tall")) setTall(true); }, { passive: true });

    /* 1. Who the cat is: its own story, then the stock's real cat as the research found it. */
    const who = section("Who the cat is", "card-who");
    if (r.description) who.append(el("p", "card-story", r.description));
    if (r.lore) who.append(loreFigure(r));
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

    /* Proof: the X post (or, when there is none, the page) that links the cat to its company. */
    const pf = section("Proof", "card-proof");
    if (r.proof) pf.append(proofBlock(r.proof));
    else pf.append(el("p", "card-none", "No proof post recorded yet."));
    const photoSrc = photoSourceNote(r);
    if (photoSrc) pf.append(photoSrc);
    body.append(pf);

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
    if (!isLaunched(r) && !r.example) {
      tk.append(el("p", "card-note", "No token exists for this cat yet. Anyone can adopt it: launch its coin yourself on StonkFun or pump.fun with its launch kit."));
      if (canAdopt(r)) tk.append(adoptButton(r));
    }
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

    addTopPhoto(r, body, r.portrait ? { src: r.portrait, alt: `${r.name}: the in-game look` } : null);

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
    /** Show the Adopt panel for the open cat in place of its card's body. */
    async adopt({ kits, pads, site } = {}) {
      const r = current;
      if (!r || !canAdopt(r)) return;
      const [k, p] = await Promise.all([kits ?? loadKits(), pads ?? loadLaunchpads()]);
      if (current !== r) return;
      const body = root.querySelector(".card-body");
      if (!body) return;
      body.replaceChildren(adoptPanel(r, { files: kitFiles(k, r.ticker), pads: p, site, onBack: () => { render(r); root.querySelector(".btn-adopt")?.focus?.(); } }));
      body.scrollTo?.(0, 0);
      if (isSheet()) setTall(true);
      body.querySelector(".adopt-back")?.focus?.();
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
