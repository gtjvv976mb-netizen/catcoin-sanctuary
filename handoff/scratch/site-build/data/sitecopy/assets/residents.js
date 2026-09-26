/* THE RESIDENTS: the cats the page shows, read from data/collection.json and checked with the
   same rules the builder uses (assets/collection.js), against the wallets in data/wallets.json.
   Both files are fetched from this site, by relative URL; nothing else is called.

   loadResidents() resolves to an array of
     { id, name, ticker, pair, arrived, mint, example, look: { coat, model: "cat" | "ginger", tint, swatch },
       pairMint, pool, tx, time, links: { token, tx, stonkfun } }
   newest first. When no token has launched yet (no valid entry), it resolves to the example
   cats instead: every one has example: true, "—" for its ticker, pair and date, no mint and no
   links, and must be shown as an example, not a token. If a file cannot be fetched at all, it
   rejects, so the page can say the list could not be loaded rather than show examples. */

import { validateCollection, validateWallets, links, lookFor, COATS } from "./collection.js";

/** The prototype's eight example cats. Not tokens. */
export const EXAMPLE_CATS = Object.freeze(COATS.map((c, i) => Object.freeze({
  id: `example-${i + 1}`,
  name: c.coat,
  ticker: "—",
  pair: "—",
  arrived: "—",
  mint: null,
  example: true,
  look: Object.freeze({ ...c }),
  pairMint: null, pool: null, tx: null, time: null, links: null,
})));

/** One validated collection entry as the page shows it. */
export function toResident(entry) {
  return {
    id: entry.mint,
    name: entry.name,
    ticker: entry.symbol,
    pair: entry.pair.symbol,
    arrived: entry.time.slice(0, 10),
    mint: entry.mint,
    example: false,
    look: entry.look ? { ...entry.look } : lookFor(entry),
    pairMint: entry.pair.mint,
    pool: entry.pool,
    tx: entry.tx,
    time: entry.time,
    links: links(entry),
  };
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
  const [collection, wallets] = await Promise.all([
    getJson(fetchImpl, new URL("data/collection.json", base)),
    getJson(fetchImpl, new URL("data/wallets.json", base)),
  ]);
  const { cats, refused } = validateCollection(collection, { wallets: validateWallets(wallets), nowMs });
  if (refused.length && typeof console !== "undefined") console.warn(`${refused.length} collection ${refused.length === 1 ? "entry was" : "entries were"} left out`, refused);
  return cats.length ? cats.map(toResident) : EXAMPLE_CATS.map((c) => ({ ...c, look: { ...c.look } }));
}
