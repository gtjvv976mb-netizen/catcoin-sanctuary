/* ADOPT A CAT: a hand-off. The Adopt panel gives a visitor a cat's LAUNCH KIT (its token name,
   ticker, description, website and X link, each with a copy button; its logo and an optional
   banner to download) and sends them to StonkFun or pump.fun in a new tab, where THEY decide the
   final details and launch the coin themselves, as its creator. This site never signs or sends
   anything, holds no keys and takes no fee.

   Neither launchpad reads the kit from the address (checked 2026-09-26 in their shipped code:
   pump.fun/create reads only ?mayhem=true, StonkFun's /launch reads no query at all), so the flow
   is copy-and-open: the buttons open the plain create pages. GetStonked (data/launchpads.json) is
   a third launchpad: Raydium's curve priced in a tokenized stock; no prefill is known for it either.

   The kit pictures are built by scripts/build-kits.py into assets/kits/<T>/ and listed in
   assets/kits/kits.json: { cats: { <T>: { token, banner, bannerPlain, tokenSha256, photo } } },
   photo being { url, handle, post } for the real photo in the cat's X proof post (hotlinked from
   pbs.twimg.com with its credit, never copied here) or null. */

/** The site's own address, from the page it runs on (the kit's Website is this cat's card here). */
export const siteBase = () => {
  const o = globalThis.location?.origin;
  return o && /^https?:/.test(o) ? `${o}/` : "/";
};
export const STONKFUN_LAUNCH = "https://www.stonkfun.xyz/launch";
export const STONKFUN_RESTRICTED = "https://www.stonkfun.xyz/restricted";
export const PUMP_CREATE = "https://pump.fun/create";
/** Field limits both launch forms enforce. */
export const NAME_MAX = 32;
export const TICKER_MAX = 10;
export const HAND_OFF_NOTE = "You decide the final details on the launchpad. You'll be the coin's creator. Launching costs a small network fee. Memecoins can go to zero.";

const cut = (s, n) => (s.length > n ? s.slice(0, n).trimEnd() : s);

/** The cat's lore without the card's own coin line ("A cat coin priced in …", "Not affiliated …"). */
export function loreText(r) {
  const d = String(r.description || "").replace(/\s+/g, " ").trim();
  const i = d.search(/\s(A cat coin priced in|Not affiliated with|No intrinsic value)/);
  return (i > 0 ? d.slice(0, i) : d).trim();
}

/** Who the coin must say it is not affiliated with. */
export const ownerOf = (r) => r.owner || r.company || r.stock || (r.pair?.symbol ? `the company behind ${r.pair.symbol}` : "the cat's owner");

/** The cat's card on this site: the kit's Website. */
export const cardUrl = (r, site = siteBase()) => `${site}#cat=${encodeURIComponent(r.ticker)}`;

/** The kit's X link: the proof post when it is on X, else blank. */
export const xLink = (r) => (r.proof?.kind === "x" && /^https:\/\/(www\.)?(x|twitter)\.com\//.test(r.proof.url || "") ? r.proof.url : "");

/** The launch kit's words: { name, ticker, description, website, x, quote: { symbol, mint } }. */
export function launchKit(r, { site } = {}) {
  const proof = r.proof?.url ? `Proof: ${r.proof.url}` : "";
  const description = [loreText(r), proof, `Not affiliated with ${ownerOf(r)}. A memecoin with no intrinsic value; not financial advice.`].filter(Boolean).join("\n\n");
  return {
    name: cut(r.coinName || r.name || "", NAME_MAX),
    ticker: cut(String(r.ticker || "").toUpperCase(), TICKER_MAX),
    description,
    website: cardUrl(r, site),
    x: xLink(r),
    quote: { symbol: r.pair?.symbol || "STONK", mint: r.pair?.mint || "" },
  };
}

/** Can this cat be adopted here? A cat with a ticker that has not launched and is not an example. */
export const canAdopt = (r) => !!r && !!r.ticker && !r.example && r.kind !== "famous" && r.token?.status !== "launched";

let kitsPromise = null;
/** assets/kits/kits.json, read once ({ cats: {} } when it cannot be read). */
export function loadKits(fetchImpl = (...a) => globalThis.fetch(...a)) {
  kitsPromise ??= fetchImpl(new URL("../kits/kits.json", import.meta.url))
    .then((res) => (res.ok ? res.json() : null))
    .then((j) => (j && typeof j.cats === "object" ? j : { cats: {} }))
    .catch(() => ({ cats: {} }));
  return kitsPromise;
}

let padsPromise = null;
/** data/launchpads.json, read once: extra launchpads (today GetStonked), each { label, url, template }. */
export function loadLaunchpads(fetchImpl = (...a) => globalThis.fetch(...a)) {
  padsPromise ??= fetchImpl(new URL("../../data/launchpads.json", import.meta.url))
    .then((res) => (res.ok ? res.json() : null))
    .then((j) => (j && typeof j === "object" ? j : {}))
    .catch(() => ({}));
  return padsPromise;
}

const FIELDS = ["name", "ticker", "description", "website", "x", "logo", "banner"];
/** Fill {name} {ticker} {description} {website} {x} {logo} {banner} in a template (encode for a URL). */
export function fillTemplate(tpl, values, encode = false) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (FIELDS.includes(k) ? (encode ? encodeURIComponent(values[k] ?? "") : values[k] ?? "") : m));
}
/** The GetStonked entry as the panel may use it: a button only for an https url. */
export function getStonked(pads) {
  const g = pads?.getstonked;
  if (!g || typeof g !== "object") return null;
  const url = typeof g.url === "string" && /^https:\/\/[^\s]+$/.test(g.url) ? g.url : "";
  return { label: typeof g.label === "string" && g.label ? g.label : "Launch on GetStonked", url, template: typeof g.template === "string" ? g.template : "" };
}

/** A kit entry as the panel may use it: local paths under assets/kits/<T>/ and an https pbs.twimg.com photo. */
export function kitFiles(kits, ticker) {
  const k = kits?.cats?.[ticker];
  if (!k) return null;
  const local = (p) => (typeof p === "string" && p === `assets/kits/${ticker}/${p.split("/").pop()}` && /\.png$/.test(p) ? p : null);
  const ph = k.photo;
  const photo = ph && /^https:\/\/pbs\.twimg\.com\//.test(ph.url || "") ? { url: ph.url, handle: String(ph.handle || "").replace(/^@/, ""), post: /^https:\/\//.test(ph.post || "") ? ph.post : "" } : null;
  return { token: local(k.token), banner: local(k.banner), bannerPlain: local(k.bannerPlain), photo };
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
function outLink(href, text, cls) {
  const a = el("a", cls, text);
  a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
  return a;
}
function download(href, text, name) {
  const a = el("a", "btn btn-kit", text);
  a.href = href;
  a.setAttribute("download", name);
  return a;
}
function copyBtn(value, what) {
  const b = el("button", "card-copy", "Copy");
  b.type = "button";
  b.setAttribute("aria-label", `Copy the ${what}`);
  b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(value); b.textContent = "Copied"; } catch { b.textContent = "Select it"; }
    setTimeout(() => { b.textContent = "Copy"; }, 1600);
  });
  return b;
}
function pic(src, alt, w, h, cls) {
  const i = el("img", cls);
  i.src = src; i.alt = alt; i.width = w; i.height = h; i.loading = "lazy"; i.decoding = "async";
  return i;
}
function sec(title, id) {
  const s = el("section", "card-sec adopt-sec");
  const h = el("h3", null, title);
  h.id = id;
  s.setAttribute("aria-labelledby", id);
  s.append(h);
  return s;
}

/**
 * The Adopt panel for cat r, with its kit files (kitFiles(kits, r.ticker), or null).
 * @param {object} r
 * @param {{ files?: object|null, onBack?: () => void }} [o]
 */
export function adoptPanel(r, { files = null, onBack, site, pads = null } = {}) {
  const kit = launchKit(r, { site });
  const here = /^https?:/.test(globalThis.location?.href || "") ? globalThis.location.href : null;
  const abs = (p) => (!p ? "" : here ? new URL(p, here).href : p);
  let includeBanner = true, bannerSrc = files?.banner || files?.bannerPlain || "";
  const T = kit.ticker;
  const wrap = el("div", "adopt-panel");
  wrap.setAttribute("aria-label", `Adopt ${r.name}`);

  const top = el("div", "adopt-top");
  const back = el("button", "adopt-back", "← Back to the cat");
  back.type = "button";
  back.addEventListener("click", () => onBack?.());
  top.append(back, el("h3", "adopt-title", `Adopt ${r.name}`));
  wrap.append(top);
  wrap.append(el("p", "adopt-lede", "Launch this cat's coin yourself. Copy its launch kit, open a launchpad, and paste. Nothing here signs, sends or charges anything."));
  wrap.append(el("p", "adopt-note", HAND_OFF_NOTE));

  /* 1. The words. */
  const words = sec("Launch kit", "adopt-kit");
  const dl = el("dl", "adopt-dl");
  const row = (label, value, what, { long = false, blank = "" } = {}) => {
    const dt = el("dt", null, label);
    const dd = el("dd", long ? "adopt-long" : null);
    if (value) { dd.append(el(long ? "pre" : "span", long ? "adopt-desc" : "mono adopt-val", value), " ", copyBtn(value, what)); }
    else dd.append(el("span", "card-none", blank));
    dl.append(dt, dd);
  };
  row("Token name", kit.name, "token name");
  row("Ticker", kit.ticker, "ticker");
  row("Description", kit.description, "description", { long: true });
  row("Website", kit.website, "website");
  row("X", kit.x, "X link", { blank: "Blank: this cat has no proof post on X." });
  words.append(dl);
  wrap.append(words);

  /* 2. The logo: the real photo from the proof post (credited, hotlinked), or our portrait. */
  const logo = sec("Logo", "adopt-logo");
  const portraitChoice = el("div", "adopt-choice");
  if (files?.token) {
    portraitChoice.append(pic(files.token, `${r.name}: Sanctuary portrait, 1024 × 1024`, 120, 120, "adopt-token"));
    const side = el("div");
    side.append(download(files.token, "Download portrait (PNG, 1024 × 1024)", `${T}-token.png`));
    side.append(el("p", "card-note", "Our own art of this cat: free to use as your coin's logo."));
    portraitChoice.append(side);
  }
  if (files?.photo) {
    const ph = el("div", "adopt-choice adopt-photo");
    const img = pic(files.photo.url, `${r.name}: the photo from @${files.photo.handle}'s post`, 120, 120, "adopt-token");
    img.setAttribute("referrerpolicy", "no-referrer");
    img.addEventListener("error", () => img.remove(), { once: true });
    const side = el("div");
    side.append(el("p", "adopt-credit", `Photo: @${files.photo.handle}`));
    side.append(outLink(files.photo.url, "Open original to save ↗", "btn btn-kit"));
    side.append(el("p", "card-note", "This photo belongs to its owner. Ask for their permission before using it as your coin's logo."));
    ph.append(img, side);
    logo.append(ph);
    if (files.token) logo.append(el("p", "adopt-or", "Use our Sanctuary portrait instead"), portraitChoice);
  } else if (files?.token) {
    logo.append(el("p", "card-note adopt-fallback", r.proof?.kind === "x" ? "This cat's proof post has no photo, so its logo is our Sanctuary portrait." : "This cat has no proof post on X with a photo, so its logo is our Sanctuary portrait."));
    logo.append(portraitChoice);
  } else logo.append(el("p", "card-none", "Logo coming soon: this cat's portrait is still being drawn."));
  wrap.append(logo);

  /* 3. The banner: optional, branded or plain. */
  if (files?.banner || files?.bannerPlain) {
    const bn = sec("Banner (optional)", "adopt-banner");
    const lab = el("label", "adopt-toggle");
    const on = el("input");
    on.type = "checkbox"; on.checked = true; on.className = "adopt-include";
    lab.append(on, " Include banner");
    bn.append(lab);
    const box = el("div", "adopt-banner-box");
    const kinds = [files.banner && { id: "sanctuary", label: "Sanctuary style", src: files.banner, file: `${T}-banner.png` }, files.bannerPlain && { id: "plain", label: "Plain (just the cat and its name)", src: files.bannerPlain, file: `${T}-banner-plain.png` }].filter(Boolean);
    const radios = el("div", "adopt-kinds");
    radios.setAttribute("role", "radiogroup");
    radios.setAttribute("aria-label", "Banner style");
    const preview = el("div", "adopt-banner-view");
    const show = (k) => {
      bannerSrc = k.src;
      preview.replaceChildren(pic(k.src, `${r.name}: ${k.label} banner, 1500 × 500`, 1500, 500, "adopt-banner-img"), download(k.src, "Download banner (PNG, 1500 × 500)", k.file));
      for (const b of radios.children) b.setAttribute("aria-checked", String(b.dataset.kind === k.id));
    };
    for (const k of kinds) {
      const b = el("button", "adopt-kind", k.label);
      b.type = "button";
      b.setAttribute("role", "radio");
      b.dataset.kind = k.id;
      b.addEventListener("click", () => show(k));
      radios.append(b);
    }
    box.append(radios, preview);
    show(kinds[0]);
    bn.append(box, el("p", "card-note", "Nothing needs a banner to launch. The bottom-left corner is left clear for your profile picture on X."));
    on.addEventListener("click", () => { box.hidden = !on.checked; includeBanner = on.checked; });
    wrap.append(bn);
  }

  /* 4. The launchpads. */
  const go = sec("Launch it", "adopt-go");
  const sf = el("div", "adopt-pad");
  sf.append(el("p", "adopt-pad-name", "StonkFun"));
  const q = el("p", "adopt-quote");
  q.append("Pick the quote token ", el("b", "mono", kit.quote.symbol));
  if (kit.quote.mint) q.append(" · mint ", el("span", "mono adopt-mint", kit.quote.mint), " ", copyBtn(kit.quote.mint, `${kit.quote.symbol} mint address`));
  sf.append(q);
  sf.append(el("p", "card-note", "StonkFun's form has no description field: the name, ticker, logo, website and X are what it keeps. Search the quote token by its mint to be sure you pick the right one."));
  const terms = el("p", "card-note adopt-terms");
  terms.append("StonkFun has its own Terms of Service (at the foot of every StonkFun page): you must be 18 or older, and it is not offered in ", outLink(STONKFUN_RESTRICTED, "restricted regions ↗"), ", including the US, Canada and the UK under its terms.");
  sf.append(terms);
  sf.append(outLink(STONKFUN_LAUNCH, "Launch on StonkFun ↗", "btn btn-buy adopt-stonkfun"));
  const pf = el("div", "adopt-pad");
  pf.append(el("p", "adopt-pad-name", "pump.fun"));
  const pq = el("p", "adopt-quote");
  pq.append("Pair it with ", el("b", "mono", "SOL"), " (the default).");
  pf.append(pq);
  pf.append(outLink(PUMP_CREATE, "Launch on pump.fun ↗", "btn btn-buy adopt-pump"));
  go.append(sf);
  const gs = getStonked(pads);
  if (gs) {
    const g = el("div", "adopt-pad adopt-getstonked");
    g.append(el("p", "adopt-pad-name", "GetStonked"));
    const xs = /x$/i.test(kit.quote.symbol) ? kit.quote.symbol : "";
    const gq = el("p", "adopt-quote");
    if (xs) { gq.append("Suggested stock pair ", el("b", "mono", xs)); if (kit.quote.mint) gq.append(" · mint ", el("span", "mono adopt-mint", kit.quote.mint)); }
    else gq.append("Pick the tokenized stock (xStock) you want it priced in: this cat has no company xStock.");
    g.append(gq);
    g.append(el("p", "card-note", "GetStonked template: every field of the kit in one copy, ready to paste."));
    const values = () => ({ name: kit.name, ticker: kit.ticker, description: kit.description, website: kit.website, x: kit.x, logo: abs(files?.token), banner: includeBanner ? abs(bannerSrc) : "" });
    const text = () => {
      const v = values();
      if (gs.template) return fillTemplate(gs.template, v);
      return [`Name: ${v.name}`, `Ticker: ${v.ticker}`, `Description: ${v.description}`, `Website: ${v.website}`, `X: ${v.x}`, `Logo: ${v.logo}`, ...(v.banner ? [`Banner: ${v.banner}`] : []), ...(xs ? [`Stock pair: ${xs}${kit.quote.mint ? ` (${kit.quote.mint})` : ""}`] : [])].join("\n");
    };
    const b = el("button", "card-copy adopt-gs-copy", "Copy GetStonked template");
    b.type = "button";
    b.setAttribute("aria-label", "Copy the GetStonked template");
    b.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(text()); b.textContent = "Copied"; } catch { b.textContent = "Select it"; }
      setTimeout(() => { b.textContent = "Copy GetStonked template"; }, 1600);
    });
    g.append(b);
    g.getText = text;
    if (gs.url) {
      const a = outLink(fillTemplate(gs.url, values(), true), `${gs.label} ↗`, "btn btn-buy adopt-getstonked-go");
      a.addEventListener("click", () => { a.href = fillTemplate(gs.url, values(), true); });
      g.append(a);
    }
    go.append(g);
  }
  go.append(pf);
  go.append(el("p", "card-note", "Neither launchpad can be filled in from here, so copy each field above into its form. This site gets nothing from your launch."));
  wrap.append(go);
  return wrap;
}
