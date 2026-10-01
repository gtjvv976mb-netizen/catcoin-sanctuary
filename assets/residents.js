/* THE CATS THE PAGE SHOWS: the planned cats (data/planned.json) and the tokens the builder proved
   on Solana (data/collection.json), checked with the same rules the builders use
   (assets/collection.js) and merged; then the famous cat coins (data/famous.json), coins that
   already exist, made by others. The data files are fetched from this site by relative URL;
   nothing else is called. If data/famous.json cannot be read, the stock cats still show.

   loadResidents() resolves to a list of cards, launched tokens first (newest first), then the
   planned cats in the sheets' order:

   {
     id,  the planned cat's ticker ("JELLIECAT"), or the mint of a launched token
       that has no planned cat
     name, ticker,  the cat's name and ticker (a launched token's own, as read on chain)
     plannedName,  the planned name when the launched token's name differs, else null
     planned,  true for a planned cat (launched or not), false for a launched token
       that matches no planned cat
     stock,  the company or fund behind the pair ("Tesla, Inc.")
     pair: { symbol, name, mint, category, stonkfun },  the stock pair it is priced in
     description,  the cat's story ("" for a token with no planned cat)
     look, whyLook,  the words its portrait was drawn from, and why it looks that way
     proof,  the one X post or page that best links the cat to its company (or null)
     tribute,  "Fan tribute to <Company>'s cat. Not affiliated with or endorsed by <Company>."
       when the cat is drawn to look like a company's cat, else null
     portrait,  "assets/portraits/<TICKER>.jpg", or null
     coat: { base, second, pattern, eyes },  for the 3D model (colour and pattern words)
     coatFrom,  "sheet" | "look" | "mint"
     realCatName, who,  who the stock's real cat is, as the research found it (sourced), or
       that none was found
     basis, linkType, strength, realCatLink,
     links: [{ label, url, date, dateType, opened }],  the X posts and sites that link the cat to the stock
     virality: [{ label, value, source, date, method }],  empty: the card says "Not measured"
     checked,  the day the research was checked
     disclaimer,  not affiliated with the company or StonkFun; no intrinsic value; not financial advice
     token:  { status: "planned" }
       | { status: "launched", mint, launchedAt, tx, pool, payer, name, symbol }
     buy: [{ label, url }],  GMGN and FOMO, only for a launched token (a mint exists); [] otherwise
     explorer:  null | { token, tx, stonkfun | pumpfun }  Solscan and launchpad pages of a launched token
     adoption:  absent, or { mint, name, symbol, launchpad, createdAt }: a coin a stranger
       launched from the cat's kit (data/adoptions.json), never on a launched cat
     traits,  the cat's character, its row in data/traits.json (see assets/world/traits.js;
       a cat not listed there has none, and traitsOf reads it from its story)
   }
   An adoptable the sanctuary launched also has sanctuaryLaunch (see adoptableResident).

   A famous coin's card (after the stock cats) is its data/famous.json row (collection.js
   famousProblem) with kind: "famous" and ticker: its symbol.

   A launched token matches its planned cat when its pair mint is the cat's and its symbol is the
   cat's ticker (letter case aside); if one planned cat has several such launches, the first one
   takes it and the others show as tokens of their own. If a file cannot be fetched at all, it
   rejects, so the page can say the list could not be loaded rather than show a launched cat as
   not launched. Every text reaches the page as data; the page sets it with textContent. */

import { validateCollection, validateWallets, validatePlanned, validateFamous, validatePumpQuotes, links, buyLinks, coatFromMint, compareEntries, pairByMint } from "./collection.js";
import { validateAdoptables, adoptableCard, validateLore, lorePath, validateRealPhotos, nameKey, provedLaunch } from "./ui/adoptables.js";

const NO_RESEARCH = Object.freeze({
  company: "", realCat: { name: null, who: "", basis: "", linkType: "none", strength: "none", linked: false }, links: [], virality: [], checked: null, disclaimer: "",
});

function card(stockRow, pairMint) {
  const s = stockRow ?? NO_RESEARCH;
  const pair = pairByMint(pairMint);
  const company = s.company || pair?.name || "";
  return {
    stock: company,
    pair: pair ? { symbol: pair.symbol, name: pair.name, mint: pair.mint, category: pair.category, stonkfun: pair.stonkfun } : null,
    realCatName: s.realCat.name,
    who: s.realCat.who,
    basis: s.realCat.basis,
    linkType: s.realCat.linkType,
    strength: s.realCat.strength,
    realCatLink: s.realCat.linked,
    links: s.links.map((l) => ({ ...l })),
    virality: s.virality.map((v) => ({ ...v })),
    checked: s.checked,
    disclaimer: s.disclaimer
      || `The coin is not affiliated with ${company || "the company behind its stock"} or StonkFun. It has no intrinsic value and is not financial advice.`,
  };
}

function launchedToken(entry) {
  return {
    token: { status: "launched", mint: entry.mint, launchedAt: entry.time, tx: entry.tx, pool: entry.pool, payer: entry.payer, name: entry.name, symbol: entry.symbol },
    buy: buyLinks(entry.mint),
    explorer: links(entry),
  };
}

const NOT_LAUNCHED = () => ({ token: { status: "planned" }, buy: [], explorer: null });

/**
 * The cards, from validated data: `planned` is validatePlanned's result, `cats` is
 * validateCollection's (newest first).
 */
export function mergeResidents({ planned, cats }) {
  const research = new Map(planned.stocks.map((s) => [s.pair.mint, s]));
  const byKey = new Map(planned.cats.map((c) => [`${c.pair.mint} ${c.ticker}`, c]));
  const claimed = new Map(), unplanned = [];
  for (const e of [...cats].sort((a, b) => compareEntries(b, a))) {          // oldest first: the first launch takes the cat
    const c = byKey.get(`${e.pair.mint} ${e.symbol.toUpperCase()}`);
    if (c && !claimed.has(c.ticker)) claimed.set(c.ticker, e);
    else unplanned.push(e);
  }
  const plannedCard = (c) => {
    const e = claimed.get(c.ticker);
    return {
      id: c.ticker,
      name: e ? e.name : c.name,
      ticker: e ? e.symbol : c.ticker,
      plannedName: e && e.name !== c.name ? c.name : null,
      planned: true,
      ...card(research.get(c.pair.mint), c.pair.mint),
      description: c.story,
      look: c.look,
      whyLook: c.whyLook,
      tribute: c.tribute ?? null,
      proof: c.proof ? { ...c.proof } : null,
      portrait: c.portrait,
      coat: { ...c.coat },
      coatFrom: c.coatFrom,
      ...(e ? launchedToken(e) : NOT_LAUNCHED()),
    };
  };
  const tokenCard = (e) => ({
    id: e.mint,
    name: e.name,
    ticker: e.symbol,
    plannedName: null,
    planned: false,
    ...card(research.get(e.pair.mint), e.pair.mint),
    // pump.fun: priced in SOL, no stock behind it
    ...(e.launchpad && { pair: { ...e.pair }, disclaimer: "The coin is not affiliated with pump.fun. It has no intrinsic value and is not financial advice." }),
    description: "",
    look: "",
    whyLook: "",
    tribute: null,
    proof: null,
    portrait: null,
    coat: coatFromMint(e.mint),
    coatFrom: "mint",
    ...launchedToken(e),
  });
  const launched = [
    ...planned.cats.filter((c) => claimed.has(c.ticker)).map((c) => ({ at: claimed.get(c.ticker), card: plannedCard(c) })),
    ...unplanned.map((e) => ({ at: e, card: tokenCard(e) })),
  ].sort((a, b) => compareEntries(a.at, b.at)).map((x) => x.card);
  return [...launched, ...planned.cats.filter((c) => !claimed.has(c.ticker)).map(plannedCard)];
}

async function getJson(fetchImpl, url) {
  const res = await fetchImpl(url, { cache: "no-cache", credentials: "same-origin" });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

/**
 * @param {object} [o]
 * @param {Function} [o.fetchImpl]  fetch, for tests
 * @param {string|URL} [o.base]     where data/ lives; by default the folder above assets/
 * @param {number} [o.nowMs]
 */
export async function loadResidents({ fetchImpl = (...a) => globalThis.fetch(...a), base = new URL("../", import.meta.url), nowMs = Date.now() } = {}) {
  const [plannedFile, collectionFile, walletsFile, quotesFile] = await Promise.all([
    getJson(fetchImpl, new URL("data/planned.json", base)),
    getJson(fetchImpl, new URL("data/collection.json", base)),
    getJson(fetchImpl, new URL("data/wallets.json", base)),
    getJson(fetchImpl, new URL("data/pump-quotes.json", base)).catch(() => null), // optional
  ]);
  const planned = validatePlanned(plannedFile, { nowMs });
  const collection = validateCollection(collectionFile, { wallets: validateWallets(walletsFile), quotes: validatePumpQuotes(quotesFile).quotes, nowMs });
  const left = planned.refused.length + collection.refused.length;
  if (left && typeof console !== "undefined") console.warn(`${left} ${left === 1 ? "entry was" : "entries were"} left out`, planned.refused, collection.refused);
  let stock = mergeResidents({ planned, cats: collection.cats });
  // The lore pictures (data/lore.json): optional. A stock cat with a caption there gets its picture.
  let lore = {};
  try {
    lore = validateLore(await getJson(fetchImpl, new URL("data/lore.json", base)));
    for (const r of stock) if (!r.lore && lore[r.id]) r.lore = { image: lorePath(r.id), caption: lore[r.id] };
  } catch (e) { if (typeof console !== "undefined") console.warn("The lore pictures could not be read", e); }
  // The famous cat coins: optional. A missing or unreadable file leaves the stock cats as they are.
  let famous = [];
  try {
    const f = validateFamous(await getJson(fetchImpl, new URL("data/famous.json", base)), { nowMs });
    if (f.refused.length && typeof console !== "undefined") console.warn(`${f.refused.length} famous coins were left out`, f.refused);
    famous = f.coins.map(famousCard);
    // A Hall of Fame coin's lore picture is keyed by its symbol (its `lore` field is the researched text).
    for (const c of famous) if (lore[c.ticker]) c.lorePic = { image: lorePath(c.ticker), caption: lore[c.ticker] };
  } catch (e) { if (typeof console !== "undefined") console.warn("The famous cat coins could not be read", e); }
  // The adoptable cats: optional too.
  let adoptable = [];
  try {
    const a = validateAdoptables(await getJson(fetchImpl, new URL("data/adoptables.json", base)), { taken: new Set(planned.cats.map((c) => c.ticker)) });
    if (a.refused.length && typeof console !== "undefined") console.warn(`${a.refused.length} adoptable cats were left out`, a.refused);
    // One coin, one cat; a coin a launch names has no bare card.
    const used = new Set(stock.filter((r) => r.planned && r.token.mint).map((r) => r.token.mint));
    adoptable = a.cats.map((c) => { const r = adoptableResident(c, collection.cats.filter((e) => !used.has(e.mint))); used.add(r.token.mint); return r; });
    const named = new Set(a.cats.map((c) => c.launch?.mint));
    stock = stock.filter((r) => r.planned || !named.has(r.token.mint));
  } catch (e) { if (typeof console !== "undefined") console.warn("The adoptable cats could not be read", e); }
  // The adopted cats (data/adoptions.json): optional. A missing or bad file adopts nothing.
  try {
    const found = adoptionsFor(await getJson(fetchImpl, new URL("data/adoptions.json", base)), [...stock, ...adoptable], collectionFile.cats);
    for (const r of [...stock, ...adoptable]) if (found.has(r.id)) r.adoption = found.get(r.id);
  } catch { /* no adoptions */ }
  // The real photos (data/real-photos.json): optional. A cat listed there shows its real photo,
  // hotlinked from pbs.twimg.com with credit, at the top of its card.
  try {
    const photos = validateRealPhotos(await getJson(fetchImpl, new URL("data/real-photos.json", base)));
    for (const r of [...stock, ...adoptable, ...famous]) {
      const ph = photos[r.id] || photos[r.ticker];
      if (ph && !r.realPhoto) r.realPhoto = ph;
    }
  } catch (e) { if (typeof console !== "undefined") console.warn("The real photos could not be read", e); }
  // The cats' characters (data/traits.json, built by scripts/build-traits.mjs): optional. A cat
  // listed there, by id or ticker, gets r.traits; without the file every cat is read from its story.
  try {
    const t = await getJson(fetchImpl, new URL("data/traits.json", base));
    const rows = t && typeof t.cats === "object" && t.cats ? t.cats : {};
    const rowOf = (k) => (typeof k === "string" && Object.prototype.hasOwnProperty.call(rows, k) && rows[k] && typeof rows[k] === "object" && !Array.isArray(rows[k]) ? rows[k] : null);
    for (const r of [...stock, ...adoptable, ...famous]) {
      const row = rowOf(r.id) ?? rowOf(r.ticker);
      if (row && !r.traits) r.traits = row;
    }
  } catch { /* no traits file: the garden reads each cat's character from its words */ }
  // The release queue (data/release-queue.json): a queued cat is hidden until the announcer has
  // posted it on X and marked it released. Optional: a missing file hides nothing.
  let hidden = new Set();
  try {
    const q = await getJson(fetchImpl, new URL("data/release-queue.json", base));
    hidden = hiddenByQueue(q);
  } catch { /* no queue */ }
  return [...stock, ...adoptable, ...famous].filter((r) => !hidden.has(r.id) && !hidden.has(r.ticker));
}

/** An adoptable's card. One the sanctuary launched (c.launch) gets sanctuaryLaunch: { status, launchpad }:
 *  "launched" (in its coin's pair) only when provedLaunch finds its coin in `cats`, else "pending". */
export function adoptableResident(c, cats) {
  const r = adoptableCard(c), e = provedLaunch(c, cats);
  return c.launch ? { ...r, sanctuaryLaunch: { status: e ? "launched" : "pending", launchpad: c.launch.launchpad }, ...(e && { ...launchedToken(e), pair: { ...e.pair } }) } : r;
}

/* data/adoptions.json, checked again: a row needs a well-formed mint and creator, a known
   launchpad, ISO times after the kits went live, the kit's own name and ticker plus one more piece
   of evidence, and a cat here that the owner has not launched, with a mint not in `own` (the
   owner's launches). The earliest launch takes the cat; later ones are copycats. */
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/;
const EVIDENCE = ["name", "ticker", "description", "proof-link", "card-link", "image"];

/** Cat key -> { mint, name, symbol, launchpad, createdAt }. The name and ticker shown are the kit's own,
 *  never the stranger's text (they matched it, letter case, accents and punctuation aside). */
export function adoptionsFor(file, cats, own = []) {
  const byKey = new Map(cats.map((r) => [r.id, r])), out = new Map(), taken = new Set((Array.isArray(own) ? own : []).map((e) => e?.mint));
  const at = (v) => (typeof v === "string" && ISO.test(v) ? Date.parse(v) : NaN);
  const b58 = (v) => typeof v === "string" && B58.test(v);
  const rows = (Array.isArray(file?.adoptions) ? file.adoptions : []).filter((a) => {
    const r = byKey.get(a?.key), ev = a?.evidence;
    return r && r.token?.status !== "launched" && !r.sanctuaryLaunch && b58(a.mint) && b58(a.creator) && !taken.has(a.mint)
      && ["pump.fun", "stonkfun"].includes(a.launchpad) && at(a.createdAt) >= Date.parse("2026-09-25T00:00:00Z") && at(a.createdAt) <= at(a.foundAt)
      && typeof a.symbol === "string" && a.symbol.trim().toUpperCase() === (r.launchTicker || r.ticker) && nameKey(a.name) && nameKey(a.name) === nameKey(r.coinName || r.name)
      && Array.isArray(ev) && ev.every((x) => EVIDENCE.includes(x)) && ev.includes("name") && ev.includes("ticker") && new Set(ev).size > 2;
  }).sort((a, b) => at(a.createdAt) - at(b.createdAt));
  for (const a of rows) if (!out.has(a.key) && !taken.has(a.mint)) {
    taken.add(a.mint);
    const r = byKey.get(a.key);
    out.set(a.key, { mint: a.mint, name: r.coinName || r.name, symbol: r.launchTicker || r.ticker, launchpad: a.launchpad, createdAt: a.createdAt });
  }
  return out;
}

/** The keys the site must not show yet: queued in data/release-queue.json and not released
 *  (shown: true marks a cat the site already shows, queued only to order its X post). */
export function hiddenByQueue(q) {
  return new Set((Array.isArray(q?.cats) ? q.cats : []).filter((e) => e && typeof e.key === "string" && e.status !== "released" && e.shown !== true).map((e) => e.key));
}

/** A famous coin's card: its data/famous.json row, marked as famous. */
export function famousCard(c) {
  return { ...c, kind: "famous", ticker: c.symbol, planned: false, token: { status: "famous" } };
}
