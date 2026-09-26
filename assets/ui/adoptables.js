/* THE ADOPTABLE CATS (data/adoptables.json): famous real, fictional and viral cats that have no
   sanctuary coin yet. Each one is a fan tribute: it is not affiliated with its owner (a person, a
   company, a show), it has a verified X post as proof, and it waits for someone to adopt it (launch
   it on StonkFun). This module is the one set of rules for the file, used by the builder
   (scripts/build-adoptables.mjs), the page (assets/residents.js) and the tests.

   data/adoptables.json: { note, checked, cats: [cat] }, where a cat is
     { id, ticker, name, coinName, owner, category, story, look, coat: { base, second, pattern, eyes },
       pair: { symbol, mint },
       proof: { kind: "x", url, author, handle, date, dateType: "posted", text, note, image: null },
       sources: [{ label, url }],
       existingCoin: { symbol, contract, mcapUsd } | null,
       memorial: boolean, tribute, sensitivity, portrait: "assets/portraits/<TICKER>.jpg" | null,
       portraitStatus: "ready" | "pending", confidence: "high" | "medium",
       lore: { image: "assets/lore/<TICKER>.webp", caption } | null (optional: the picture of the moment
       that made the cat famous, shown on its card with the caption) } */

export const ADOPTABLE_CATEGORIES = Object.freeze(["celebrity", "tv-movie", "company", "viral", "crypto"]);
export const CATEGORY_LABELS = Object.freeze({ celebrity: "Celebrity cat", "tv-movie": "TV & movie cat", company: "Company cat", viral: "Viral cat", crypto: "Crypto cat" });
export const CATEGORY_CHIPS = Object.freeze({ celebrity: "Celebrity", "tv-movie": "TV & movies", company: "Company", viral: "Viral", crypto: "Crypto" });
/** The pairs an adoptable cat may be priced in: StonkFun's own STONK, or one of its stock pairs (checked by the builder). */
export const STONK_PAIR = Object.freeze({ symbol: "STONK", mint: "6GmAFSYs4gk3FDao5FzzySQpPZaWsa4rUJHacpMpUNgx" });

const TICKER = /^[A-Z0-9]{2,10}$/;
const ID = /^[a-z0-9][a-z0-9-]{1,40}$/;
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const X_STATUS = /^https:\/\/(x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/\d{5,25}$/;
const FIELDS = ["id", "ticker", "name", "coinName", "owner", "category", "story", "look", "coat", "pair", "proof", "sources", "existingCoin", "memorial", "tribute", "sensitivity", "portrait", "portraitStatus", "confidence", "lore"];
const COAT_KEYS = ["base", "second", "pattern", "eyes"];
/* Words that must never reach a card: price talk and promises. */
const PRICE_TALK = /\b(moon|100x|1000x|guaranteed|price target|pump it|to the moon|financial advice(?! ))\b/i;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v, min, max) => typeof v === "string" && v.trim() === v && v.length >= min && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const https = (v) => { try { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; } };

/** The fan-tribute line every adoptable cat carries. */
export const tributeLine = (owner) => `Fan tribute, not affiliated with or endorsed by ${owner}.`;

/** "A small coin already exists: $X, ~$Yk — not affiliated", or null. */
export function existingCoinLine(c) {
  if (!c) return null;
  const size = c.mcapUsd > 0 ? `~$${c.mcapUsd >= 1_000_000 ? `${(c.mcapUsd / 1_000_000).toFixed(1)}M` : `${Math.max(1, Math.round(c.mcapUsd / 1000))}k`}` : "no live market";
  return `A small coin already exists: $${c.symbol}, ${size} — not affiliated.`;
}

/** Where a cat's lore picture lives. */
export const lorePath = (ticker) => `assets/lore/${ticker}.webp`;

/** What is wrong with a cat's lore picture ({ image, caption }, null or absent is fine), or null. */
export function loreProblem(lore, ticker) {
  if (lore === undefined || lore === null) return null;
  if (!isObj(lore) || Object.keys(lore).some((k) => k !== "image" && k !== "caption")) return "lore must be { image, caption } or null";
  if (lore.image !== lorePath(ticker)) return `lore image must be ${lorePath(ticker)}`;
  if (!text(lore.caption, 10, 200)) return "lore caption must be 10 to 200 characters";
  if (PRICE_TALK.test(lore.caption)) return "lore caption talks about price";
  return null;
}

/** data/lore.json ({ note, cats: { TICKER: caption } }) as { TICKER: caption }, keeping only good rows. */
export function validateLore(data) {
  const out = {};
  if (!isObj(data) || !isObj(data.cats)) return out;
  for (const [t, cap] of Object.entries(data.cats)) if (TICKER.test(t) && loreProblem({ image: lorePath(t), caption: cap }, t) === null) out[t] = cap;
  return out;
}

/** One real photo ({ url, handle, post, alt }) as a card may use it, or null: the image must be an
    https pbs.twimg.com address (hotlinked, never hosted here), the post an https X link. */
export function realPhotoOf(p) {
  if (!isObj(p)) return null;
  const url = typeof p.url === "string" ? p.url : "";
  const post = typeof p.post === "string" ? p.post : "";
  const handle = typeof p.handle === "string" ? p.handle.replace(/^@/, "") : "";
  if (!/^https:\/\/pbs\.twimg\.com\/[^\s"'<>]+$/.test(url)) return null;
  if (!/^https:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d+/.test(post)) return null;
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  const alt = typeof p.alt === "string" && p.alt.trim() ? p.alt.trim().slice(0, 300) : `A photo from @${handle}'s post`;
  return { url, handle, post, alt };
}

/** data/real-photos.json ({ note, cats: { KEY: { realPhoto, source } } }) as { KEY: { ...realPhoto, source } }. */
export function validateRealPhotos(data) {
  const out = {};
  if (!isObj(data) || !isObj(data.cats)) return out;
  for (const [k, v] of Object.entries(data.cats)) {
    const ph = isObj(v) ? realPhotoOf(v.realPhoto) : null;
    if (ph) out[k] = { ...ph, source: v.source === "search" ? "search" : "proof" };
  }
  return out;
}

/** What is wrong with one adoptable cat, or null. */
export function adoptableProblem(c) {
  if (!isObj(c)) return "not an object";
  const extra = Object.keys(c).filter((k) => !FIELDS.includes(k));
  if (extra.length) return `unknown field ${extra[0]}`;
  if (!ID.test(c.id ?? "")) return "id must be lower-case letters, digits and dashes";
  if (!TICKER.test(c.ticker ?? "")) return "ticker must be 2 to 10 capital letters or digits";
  if (!text(c.name, 2, 60) || !text(c.coinName, 2, 60)) return "name and coinName must be 2 to 60 characters";
  if (!text(c.owner, 2, 120)) return "owner is missing";
  if (!ADOPTABLE_CATEGORIES.includes(c.category)) return `category must be one of ${ADOPTABLE_CATEGORIES.join(", ")}`;
  if (!text(c.story, 40, 900)) return "story must be 40 to 900 characters";
  if (PRICE_TALK.test(c.story)) return "story talks about price";
  if (!text(c.look, 20, 600)) return "look must be 20 to 600 characters";
  if (!isObj(c.coat) || Object.keys(c.coat).some((k) => !COAT_KEYS.includes(k)) || !COAT_KEYS.every((k) => typeof c.coat[k] === "string")) return "coat must be { base, second, pattern, eyes }";
  if (!isObj(c.pair) || typeof c.pair.symbol !== "string" || !B58.test(c.pair.mint ?? "")) return "pair must be { symbol, mint }";
  const p = c.proof;
  if (!isObj(p) || p.kind !== "x") return "proof must be an X post";
  const m = X_STATUS.exec(p.url ?? "");
  if (!m) return "proof url must be an x.com status link";
  if (typeof p.handle !== "string" || p.handle.toLowerCase() !== m[2].toLowerCase()) return "proof handle must be the post's author";
  if (!DATE.test(p.date ?? "")) return "proof date must be YYYY-MM-DD";
  if (!text(p.text, 10, 600)) return "proof text must be the post's words";
  if (!Array.isArray(c.sources) || c.sources.length > 6 || c.sources.some((s) => !isObj(s) || !text(s.label, 2, 140) || !https(s.url))) return "sources must be up to 6 https { label, url }";
  if (c.existingCoin !== null) {
    const e = c.existingCoin;
    if (!isObj(e) || !text(e.symbol, 1, 24) || typeof e.contract !== "string" || typeof e.mcapUsd !== "number" || e.mcapUsd < 0) return "existingCoin must be { symbol, contract, mcapUsd } or null";
  }
  if (typeof c.memorial !== "boolean") return "memorial must be true or false";
  if (c.tribute !== tributeLine(c.owner)) return `tribute must read "${tributeLine(c.owner)}"`;
  if (!text(c.sensitivity, 0, 300)) return "sensitivity must be a short note";
  if (c.portraitStatus === "ready" ? c.portrait !== `assets/portraits/${c.ticker}.jpg` : !(c.portraitStatus === "pending" && c.portrait === null)) return "portrait must be assets/portraits/<TICKER>.jpg when ready, null when pending";
  if (!["high", "medium"].includes(c.confidence)) return "confidence must be high or medium";
  const lp = loreProblem(c.lore, c.ticker);
  if (lp) return lp;
  return null;
}

/** The file, checked: { cats, refused: [{ index, detail }] }. `taken` is a set of tickers already used elsewhere (the planned cats). */
export function validateAdoptables(data, { taken = new Set() } = {}) {
  if (!isObj(data) || !Array.isArray(data.cats)) return { cats: [], refused: [{ index: null, detail: "adoptables must be { cats: [...] }" }] };
  const cats = [], refused = [];
  data.cats.forEach((c, index) => {
    const p = adoptableProblem(c);
    if (p) return refused.push({ index, detail: `${c?.ticker ?? index}: ${p}` });
    if (taken.has(c.ticker) || cats.some((x) => x.ticker === c.ticker)) return refused.push({ index, detail: `${c.ticker}: ticker used twice` });
    if (cats.some((x) => x.id === c.id)) return refused.push({ index, detail: `${c.id}: id used twice` });
    cats.push(c);
  });
  return { cats, refused };
}

/** An adoptable cat as a resident (the shape assets/ui/data.js reads). */
export function adoptableCard(c) {
  return {
    ...c, id: c.ticker, kind: "adoptable", planned: false, company: c.owner, stock: "", description: c.story,
    token: { status: "planned" }, buy: [], explorer: null,
  };
}
