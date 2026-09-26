/* THE CATS THE PAGE SHOWS: the planned cats (data/planned.json) and the tokens the builder proved
   on Solana (data/collection.json), checked with the same rules the builders use
   (assets/collection.js) and merged; then the famous cat coins (data/famous.json), coins that
   already exist, made by others. The data files are fetched from this site by relative URL;
   nothing else is called. If data/famous.json cannot be read, the stock cats still show.

   loadResidents() resolves to a list of cards, launched tokens first (newest first), then the
   planned cats in the sheets' order:

   {
     id,                   the planned cat's ticker ("PATCHPAW"), or the mint of a launched token
                           that has no planned cat
     name, ticker,         the cat's name and ticker (a launched token's own, as read on chain)
     plannedName,          the planned name when the launched token's name differs, else null
     planned,              true for a planned cat (launched or not), false for a launched token
                           that matches no planned cat
     stock,                the company or fund behind the pair ("Tesla, Inc.")
     pair: { symbol, name, mint, category, stonkfun },   the stock pair it is priced in
     description,          the cat's story ("" for a token with no planned cat)
     look, whyLook,        the words its portrait was drawn from, and why it looks that way
     proof,                the one X post or page that best links the cat to its company (or null)
     tribute,              "Fan tribute to <Company>'s cat. Not affiliated with or endorsed by <Company>."
                           when the cat is drawn to look like a company's cat, else null
     portrait,             "assets/portraits/<TICKER>.jpg", or null
     coat: { base, second, pattern, eyes },  for the 3D model (colour and pattern words)
     coatFrom,             "sheet" | "look" | "mint"
     realCatName, who,     who the stock's real cat is, as the research found it (sourced), or
                           that none was found
     basis, linkType, strength, realCatLink,
     links: [{ label, url, date, dateType, opened }],       the X posts and sites that link the cat to the stock
     virality: [{ label, value, source, date, method }],   empty: the card says "Not measured"
     checked,              the day the research was checked
     disclaimer,           not affiliated with the company or StonkFun; no intrinsic value; not financial advice
     token:                { status: "planned" }
                         | { status: "launched", mint, launchedAt, tx, pool, payer, name, symbol }
     buy: [{ label, url }],   GMGN and FOMO, only for a launched token (a mint exists); [] otherwise
     explorer:             null | { token, tx, stonkfun }   Solscan and StonkFun pages of a launched token
   }

   A famous coin's card (after the stock cats) is its data/famous.json row with kind: "famous":
   { id, kind: "famous", name, ticker (its symbol), chain, contract, pair: { quote, address, dex, url },
     company, tier, logo, market, coingeckoId, catName, who, lore, loreSource, viral, links: { x, website },
     buy: { label, url }, warnings, coat, ownerPick, disclaimer }.

   A launched token matches its planned cat when its pair mint is the cat's and its symbol is the
   cat's ticker (letter case aside); if one planned cat has several such launches, the first one
   takes it and the others show as tokens of their own. If a file cannot be fetched at all, it
   rejects, so the page can say the list could not be loaded rather than show a launched cat as
   not launched. Every text reaches the page as data; the page sets it with textContent. */

import { validateCollection, validateWallets, validatePlanned, validateFamous, links, buyLinks, coatFromMint, compareEntries, pairByMint } from "./collection.js";
import { validateAdoptables, adoptableCard } from "./ui/adoptables.js";

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
  const [plannedFile, collectionFile, walletsFile] = await Promise.all([
    getJson(fetchImpl, new URL("data/planned.json", base)),
    getJson(fetchImpl, new URL("data/collection.json", base)),
    getJson(fetchImpl, new URL("data/wallets.json", base)),
  ]);
  const planned = validatePlanned(plannedFile, { nowMs });
  const collection = validateCollection(collectionFile, { wallets: validateWallets(walletsFile), nowMs });
  const left = planned.refused.length + collection.refused.length;
  if (left && typeof console !== "undefined") console.warn(`${left} ${left === 1 ? "entry was" : "entries were"} left out`, planned.refused, collection.refused);
  const stock = mergeResidents({ planned, cats: collection.cats });
  // The famous cat coins: optional. A missing or unreadable file leaves the stock cats as they are.
  let famous = [];
  try {
    const f = validateFamous(await getJson(fetchImpl, new URL("data/famous.json", base)), { nowMs });
    if (f.refused.length && typeof console !== "undefined") console.warn(`${f.refused.length} famous coins were left out`, f.refused);
    famous = f.coins.map(famousCard);
  } catch (e) { if (typeof console !== "undefined") console.warn("The famous cat coins could not be read", e); }
  // The adoptable cats: optional too.
  let adoptable = [];
  try {
    const a = validateAdoptables(await getJson(fetchImpl, new URL("data/adoptables.json", base)), { taken: new Set(planned.cats.map((c) => c.ticker)) });
    if (a.refused.length && typeof console !== "undefined") console.warn(`${a.refused.length} adoptable cats were left out`, a.refused);
    adoptable = a.cats.map(adoptableCard);
  } catch (e) { if (typeof console !== "undefined") console.warn("The adoptable cats could not be read", e); }
  return [...stock, ...adoptable, ...famous];
}

/** A famous coin's card: its data/famous.json row, marked as famous. */
export function famousCard(c) {
  return { ...c, kind: "famous", ticker: c.symbol, planned: false, token: { status: "famous" } };
}
