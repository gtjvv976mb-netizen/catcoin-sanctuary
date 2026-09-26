/* The residents as the page shows them. assets/residents.js is the one source (its data is
   prepared ahead of time; nothing here calls another site). This file reads whatever it
   exports and checks every field before it reaches the page:

     { id, name, ticker, plannedName, stock, company, pair: { symbol, mint },
       description (the cat's story), look, whyLook, tribute, portrait, coat: { base, second, pattern, eyes },
       proof: { kind: "x" | "web", url, author, handle, date, dateType, text, note, image } | null,
       realCatName, who, basis, linkType, strength, realCatLink, checked, disclaimer,
       virality: [{ label, value, source, date, dateType, method }], links: [{ label, url, date, dateType }],
       token: { status: "planned" } | { status: "launched", mint, launchedAt, tx },
       buy: [{ label, url }], explorer: { token, tx, stonkfun } | null }

   Rules kept here, whatever the data says:
   - a link is shown only if it is https;
   - a virality figure is shown only with an https source and a date (otherwise the card says
     "Not measured");
   - a cat counts as launched only with a well-formed mint; otherwise it is "Not launched yet";
   - buy links (GMGN, FOMO) and explorer links are kept only for a launched cat, and only the exact
     page for its own mint (or, for the launch, its transaction) on the one host each label names;
     the page never builds a buy link;
   - the portrait must be a picture on this site (a relative path under assets/). */

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TX = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;

const str = (v, max = 200) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const para = (v, max = 2400) => (typeof v === "string" ? v.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

export function httpsUrl(v) {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}

/** A picture on this site: a relative path under assets/, no scheme, no "..". */
export function localPicture(v) {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/^\.\//, "").replace(/^\//, "");
  if (!/^assets\/[\w\-./]+\.(webp|png|jpe?g|avif|gif)$/i.test(s) || s.includes("..")) return null;
  return s;
}

/** "2026-08-31" (or a full timestamp) as "31 Aug 2026", "2013-08" as "Aug 2013", "2013" as is; other short strings kept as written. */
export function dateText(v) {
  const s = str(v, 40);
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s);
  if (!m) return s;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1));
  if (Number.isNaN(d.getTime()) || d.getUTCMonth() !== +m[2] - 1) return s;
  const opts = m[3] ? { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat("en-GB", opts).format(d);
}

const LINK_TYPES = new Set(["official_character", "official_post", "reported", "collaboration", "big_cat", "executive", "community", "partner", "none"]);
const STRENGTHS = new Set(["strong", "medium", "weak", "none"]);
const VIRALITY_DATES = new Set(["measured", "as_of", "published", "undated"]);

/* The one page each outbound token link may be: its host, and its path with the mint (or the
   launch signature) as the whole last part. Anything else is dropped, even if it names the mint. */
const TOKEN_PAGES = {
  GMGN: ["gmgn.ai", "/sol/token/"],
  FOMO: ["fomo.family", "/tokens/solana/"],
  token: ["solscan.io", "/token/"],
  tx: ["solscan.io", "/tx/"],
  stonkfun: ["www.stonkfun.xyz", "/token/"],
};
/** The exact https page for `needle` (a mint or a signature) that `kind` names, or null. */
function tokenPage(v, kind, needle) {
  const u = httpsUrl(v), page = TOKEN_PAGES[kind];
  if (!u || !page || !needle) return null;
  const url = new URL(u);
  return url.host === page[0] && url.pathname === `${page[1]}${needle}` && !url.search && !url.hash ? u : null;
}

const PROOF_X_HOSTS = new Set(["x.com", "twitter.com"]);
/** A cat's proof post or page, cleaned: an https URL (an X proof only on x.com/twitter.com), its words, and a local picture. */
export function normalizeProof(p) {
  if (!p || typeof p !== "object") return null;
  const url = httpsUrl(p.url);
  const kind = p.kind === "x" ? "x" : p.kind === "web" ? "web" : "";
  if (!url || !kind) return null;
  const onX = PROOF_X_HOSTS.has(new URL(url).hostname);
  if ((kind === "x") !== onX) return null;
  const handle = kind === "x" ? str(p.handle, 20).replace(/^@/, "") : "";
  if (kind === "x" && !/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  const text = para(p.text, 500);
  const image = localPicture(p.image);
  if (!text && !image) return null;
  return { kind, url, author: str(p.author, 60) || hostOf(url), handle, date: str(p.date, 40), dateType: str(p.dateType, 20).toLowerCase(), text, note: para(p.note, 400), image };
}

function normalizeNew(e) {
  const id = str(e.id, 120);
  if (!id) return null;
  const tokenIn = e.token && typeof e.token === "object" ? e.token : {};
  const mint = str(tokenIn.mint, 60);
  const launched = tokenIn.status === "launched" && B58.test(mint);
  const tx = launched && TX.test(str(tokenIn.tx, 100)) ? str(tokenIn.tx, 100) : "";
  const token = launched ? { status: "launched", mint, launchedAt: str(tokenIn.launchedAt, 40), tx } : { status: "planned" };
  const pairIn = e.pair && typeof e.pair === "object" ? e.pair : {};
  const pairMint = str(pairIn.mint, 60);
  const who = Array.isArray(e.who) ? e.who.map((w) => para(w, 1200)).filter(Boolean).join("\n\n") : para(e.who);
  const virality = (Array.isArray(e.virality) ? e.virality : []).slice(0, 12).map((v) => {
    const dateType = str(v?.dateType, 20).toLowerCase();
    return {
      label: str(v?.label, 140), value: str(v?.value, 140), source: httpsUrl(v?.source), date: str(v?.date, 40), dateType: VIRALITY_DATES.has(dateType) ? dateType : "",
      sourceLabel: str(v?.sourceLabel, 80), method: str(v?.method, 180),
    };
  }).filter((v) => (v.label || v.value) && v.source && v.date);
  const links = (Array.isArray(e.links) ? e.links : []).slice(0, 12).map((l) => ({ label: str(l?.label, 180), url: httpsUrl(l?.url), date: str(l?.date, 40), dateType: str(l?.dateType, 20).toLowerCase() })).filter((l) => l.url);
  const buy = launched
    ? (Array.isArray(e.buy) ? e.buy : []).slice(0, 4).map((b) => { const label = str(b?.label, 40); return { label, url: tokenPage(b?.url, label, mint) }; }).filter((b) => b.url && b.label)
    : [];
  const ex = launched && e.explorer && typeof e.explorer === "object" ? e.explorer : null;
  const explorer = ex ? { token: tokenPage(ex.token, "token", mint), tx: tokenPage(ex.tx, "tx", tx), stonkfun: tokenPage(ex.stonkfun, "stonkfun", mint) } : null;
  const coatIn = e.coat && typeof e.coat === "object" ? e.coat : {};
  const linkType = str(e.linkType, 24).toLowerCase();
  const strength = str(e.strength, 12).toLowerCase();
  return {
    id,
    name: str(e.name, 60) || "A cat",
    ticker: str(e.ticker, 20).replace(/^\$+/, ""),
    stock: str(e.stock, 120),
    company: str(e.company, 120),
    plannedName: str(e.plannedName, 60),
    disclaimer: para(e.disclaimer, 400),
    stonkfun: explorer?.stonkfun ?? null,
    explorer,
    realCatName: str(e.realCatName, 120),
    realCatLink: e.realCatLink === true,
    linkType: LINK_TYPES.has(linkType) ? linkType : "",
    strength: STRENGTHS.has(strength) ? strength : "",
    basis: para(e.basis, 600),
    checked: str(e.checked, 40),
    pair: { symbol: str(pairIn.symbol, 24), mint: B58.test(pairMint) ? pairMint : "" },
    description: para(e.description, 900),
    look: para(e.look, 600),
    whyLook: para(e.whyLook, 600),
    tribute: str(e.tribute, 200),
    proof: normalizeProof(e.proof),
    portrait: localPicture(e.portrait),
    coat: { base: str(coatIn.base, 40), second: str(coatIn.second, 40), pattern: str(coatIn.pattern, 40), eyes: str(coatIn.eyes, 40) },
    who, virality, links, token, buy,
    example: false,
  };
}

/** The earlier collection shape ({ name, ticker, pair, mint, example, look, … }), read the same way. */
function normalizeOld(e) {
  const hasMint = typeof e.mint === "string" && B58.test(e.mint);
  const look = e.look || null;
  const r = normalizeNew({
    id: e.id || e.mint,
    name: e.name,
    ticker: e.ticker && e.ticker !== "—" ? e.ticker : "",
    pair: { symbol: e.pair && e.pair !== "—" ? e.pair : "", mint: e.pairMint || "" },
    coat: look ? { base: look.swatch || look.tint, pattern: look.model === "ginger" ? "tabby" : look.coat === "Cream point" ? "point" : "solid" } : {},
    token: hasMint ? { status: "launched", mint: e.mint, launchedAt: e.time || e.arrived, tx: e.tx } : { status: "planned" },
  });
  return r && { ...r, example: !!e.example };
}

/* A famous cat coin: a coin that already exists, made by others. Its buy link is kept only when it
   is its GMGN page (Solana, Ethereum, Base, BNB Chain) or a DexScreener page on its chain, for
   its own contract; its logo only when it is a picture on this site. */
const GMGN_CHAIN = { solana: "sol", ethereum: "eth", base: "base", bsc: "bsc" };
const TIERS = new Set(["main"]);
const num = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
function famousBuy(b, chain, contract) {
  const url = httpsUrl(b?.url);
  if (!url) return null;
  const u = new URL(url);
  if (GMGN_CHAIN[chain]) return b.label === "GMGN" && u.host === "gmgn.ai" && u.pathname === `/${GMGN_CHAIN[chain]}/token/${contract}` && !u.search ? { label: "GMGN", url } : null;
  return b.label === "DexScreener" && u.host === "dexscreener.com" && u.pathname.startsWith(`/${chain}/`) && !u.search ? { label: "DexScreener", url } : null;
}
function normalizeFamous(e) {
  const id = str(e.id, 80);
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id)) return null;
  const chain = str(e.chain, 24).toLowerCase(), contract = str(e.contract, 140);
  if (!chain || !contract || /\s/.test(contract)) return null;
  const pairIn = e.pair && typeof e.pair === "object" ? e.pair : {};
  const pairUrl = httpsUrl(pairIn.url);
  const m = e.market && typeof e.market === "object" ? e.market : {};
  const coatIn = e.coat && typeof e.coat === "object" ? e.coat : {};
  const linksIn = e.links && typeof e.links === "object" ? e.links : {};
  const x = httpsUrl(linksIn.x);
  const viral = e.viral && typeof e.viral === "object" && para(e.viral.summary, 900) ? { summary: para(e.viral.summary, 900), url: httpsUrl(e.viral.url) } : null;
  const ls = e.loreSource && typeof e.loreSource === "object" ? e.loreSource : {};
  return {
    id, kind: "famous",
    name: str(e.name, 60) || "A cat", ticker: str(e.ticker ?? e.symbol, 24).replace(/^\$+/, ""),
    chain, contract,
    pairQuote: str(pairIn.quote, 24), pairDex: str(pairIn.dex, 40), pairUrl: pairUrl && new URL(pairUrl).host === "dexscreener.com" ? pairUrl : null,
    company: str(e.company, 120), stock: "", tier: TIERS.has(e.tier) ? e.tier : "main",
    logo: localPicture(e.logo), portrait: localPicture(e.logo),
    market: { marketCapUsd: num(m.marketCapUsd), liquidityUsd: num(m.liquidityUsd), volume24hUsd: num(m.volume24hUsd), measuredAt: str(m.measuredAt, 40), source: str(m.source, 20) },
    catName: str(e.catName, 120), who: para(e.who, 900), description: para(e.lore, 1200),
    loreSource: { kind: str(ls.kind, 20), label: str(ls.label, 80), url: httpsUrl(ls.url) },
    viral,
    x: x && ["x.com", "twitter.com"].includes(new URL(x).hostname) ? x : null,
    website: httpsUrl(linksIn.website),
    buyLink: famousBuy(e.buy, chain, contract),
    warnings: (Array.isArray(e.warnings) ? e.warnings : []).slice(0, 8).map((w) => para(w, 220)).filter(Boolean),
    coat: { base: str(coatIn.base, 40), second: str(coatIn.second, 40), pattern: str(coatIn.pattern, 40), eyes: str(coatIn.eyes, 40) },
    ownerPick: e.ownerPick === true,
    disclaimer: para(e.disclaimer, 400),
    // The fields every card has, empty for a famous coin.
    plannedName: "", pair: { symbol: "", mint: "" }, look: "", whyLook: "", tribute: "", proof: null, realCatName: "", realCatLink: false,
    linkType: "", strength: "", basis: "", checked: "", virality: [], links: [], token: { status: "famous" }, buy: [], explorer: null, stonkfun: null,
    example: false,
  };
}

export const isFamous = (r) => r?.kind === "famous";
export const isAdoptable = (r) => r?.kind === "adoptable";

/* An adoptable cat (data/adoptables.json, checked by assets/ui/adoptables.js): the common fields as
   a planned cat has them, plus its category, owner, sources, any coin that already exists, and the
   gentle notes its card shows. It is never launched here: the page shows it as "Not launched yet". */
const ADOPT_CATEGORIES = new Set(["celebrity", "tv-movie", "company", "viral", "crypto"]);
function normalizeAdoptable(e) {
  const r = normalizeNew({ ...e, token: { status: "planned" }, buy: [], explorer: null });
  if (!r || !ADOPT_CATEGORIES.has(e.category)) return null;
  const ec = e.existingCoin && typeof e.existingCoin === "object" ? e.existingCoin : null;
  return {
    ...r, kind: "adoptable",
    category: e.category, owner: str(e.owner, 120), company: str(e.owner, 120), coinName: str(e.coinName, 60),
    sources: (Array.isArray(e.sources) ? e.sources : []).slice(0, 6).map((s) => ({ label: str(s?.label, 140), url: httpsUrl(s?.url) })).filter((s) => s.url),
    existingCoin: ec && str(ec.symbol, 24) ? { symbol: str(ec.symbol, 24), mcapUsd: num(ec.mcapUsd) ?? 0 } : null,
    memorial: e.memorial === true, sensitivity: str(e.sensitivity, 300), portraitStatus: e.portraitStatus === "ready" && r.portrait ? "ready" : "pending",
  };
}

export function normalize(e) {
  if (!e || typeof e !== "object") return null;
  if (e.kind === "famous") return normalizeFamous(e);
  if (e.kind === "adoptable") return normalizeAdoptable(e);
  const old = !("token" in e) && ("example" in e || "look" in e || "arrived" in e);
  return old ? normalizeOld(e) : normalizeNew(e);
}

/** Every resident, checked; ids made unique. Rejects only when assets/residents.js cannot be read at all. */
export async function getResidents() {
  const R = await import("../residents.js");
  let list = R.RESIDENTS ?? R.residents ?? R.CATS ?? R.default ?? null;
  if (!list && typeof R.loadResidents === "function") list = await R.loadResidents();
  if (typeof list === "function") list = await list();
  if (list && !Array.isArray(list) && Array.isArray(list.cats)) list = list.cats;
  const seen = new Set();
  const out = [];
  for (const e of Array.isArray(list) ? list : []) {
    const r = normalize(e);
    if (!r || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export const isLaunched = (r) => r?.token?.status === "launched";
export const shortMint = (m) => (m && m.length > 10 ? `${m.slice(0, 4)}…${m.slice(-4)}` : m || "");
export const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return ""; } };

/* A coat's colour for the page's little cat faces (no three.js here). */
const NAMED = {
  black: "#1d1a1c", white: "#f7f3ec", cream: "#f1dcc0", ginger: "#e0823a", orange: "#e0823a", red: "#c8642c", grey: "#9a9aa2", gray: "#9a9aa2",
  silver: "#c9cbd0", blue: "#7f8aa0", brown: "#6b4a33", chocolate: "#5a3a28", lilac: "#b8aab4", fawn: "#d6b995", cinnamon: "#b9764a",
  golden: "#d9a64e", tan: "#c49a6c", smoke: "#6f6c77", tabby: "#a47a52", seal: "#4a3527", caramel: "#c48a4f", gold: "#d9a64e",
};
const FALLBACK = ["#f1dcc0", "#9a9aa2", "#1d1a1c", "#e0823a", "#f7f3ec", "#b9764a", "#6f6c77", "#d6b995"];
function hashOf(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function swatchOf(r, key = "base") {
  const v = String(r?.coat?.[key] || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v) || /^#[0-9a-f]{3}$/.test(v)) return v;
  for (const w of v.split(/[\s,/-]+/).reverse()) if (NAMED[w]) return NAMED[w];
  if (key !== "base") return null;
  return FALLBACK[hashOf(String(r?.id || "")) % FALLBACK.length];
}
