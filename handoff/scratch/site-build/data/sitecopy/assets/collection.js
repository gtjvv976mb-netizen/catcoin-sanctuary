/* THE SANCTUARY'S COLLECTION: WHAT COUNTS AS A RESIDENT, CHECKED THE SAME WAY IN THE PAGE AND
   IN NODE (scripts/build-collection.mjs writes data/collection.json; assets/residents.js reads
   it). Pure: no imports, no network, no DOM. Nothing here decides that a launch happened; the
   builder proves that on Solana. This file only refuses a collection entry that is malformed,
   unsafe to show, or not paid by a listed wallet while that wallet was listed.

   data/collection.json   { "cats": [ entry, … ] }, newest first
   entry                  { mint, name, symbol, pair: { symbol, mint }, pool, payer, tx, time, look? }
                            mint, pool, payer, pair.mint: base58, 32 bytes; tx: base58, 64 bytes
                            time: the launch's block time, "YYYY-MM-DDTHH:MM:SSZ"
                            look: { coat, model: "cat" | "ginger", tint: "#rrggbb", swatch: "#rrggbb" }
   data/wallets.json      { "launchers": [ { address, since, label, until? } ] }
                            since / until: "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SSZ" (UTC); until is
                            exclusive and optional. To retire a wallet, give it an until date:
                            removing it would make its cats fail this check, and the builder
                            never drops a cat, so it stops instead. */

/* The 24 tokenised stocks a cat may be paired with. Copied from the Cat Intelligence Agency
   project, src/lib/config.mjs STONKFUN_XSTOCKS (XSTOCK_BUILTIN's fifteen plus nine more): each
   is the Solana address the official product page https://xstocks.com/us/products listed for
   that symbol (read 2026-09-24 and 2026-09-25; the rows are kept in
   tests/fixtures/xstocks-official-24.json and a test matches every one by mint), and StonkFun
   listed every one as launchable and LaunchLab-ready on 2026-09-25. */
export const XSTOCKS = Object.freeze([
  ["GLDx", "Gold xStock", "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re"],
  ["TSLAx", "Tesla xStock", "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB"],
  ["SPYx", "SP500 xStock", "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W"],
  ["AAPLx", "Apple xStock", "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp"],
  ["NVDAx", "NVIDIA xStock", "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh"],
  ["QQQx", "Nasdaq xStock", "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ"],
  ["MSTRx", "MicroStrategy xStock", "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ"],
  ["COINx", "Coinbase xStock", "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu"],
  ["HOODx", "Robinhood xStock", "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg"],
  ["CRCLx", "Circle xStock", "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1"],
  ["MSFTx", "Microsoft xStock", "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX"],
  ["GOOGLx", "Alphabet xStock", "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN"],
  ["METAx", "Meta xStock", "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu"],
  ["AMZNx", "Amazon xStock", "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg"],
  ["SPCXx", "SpaceX xStock", "Xs3oZwbHvqis4NYcf4YKWmEia2eC84wSiVrcYcTqpH8"],
  ["PLTRx", "Palantir xStock", "XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4"],
  ["GMEx", "Gamestop xStock", "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc"],
  ["STRCx", "Strategy PP Variable xStock", "Xs78JED6PFZxWc2wCEPspZW9kL3Se5J7L5TChKgsidH"],
  ["MCDx", "McDonald's xStock", "XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2"],
  ["BRK.Bx", "Berkshire Hathaway xStock", "Xs6B6zawENwAbWVi7w92rjazLuAr5Az59qgWKcNb45x"],
  ["KOx", "Coca-Cola xStock", "XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ"],
  ["INTCx", "Intel xStock", "XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM"],
  ["VIDAx", "Vida Global xStock", "XsfCC9VL4DamVGNgdJpfLXB3sBVa158Gbx8sh7NzmTk"],
  ["DFDVx", "DFDV xStock", "Xs2yquAgsHByNzx68WJC55WHjHBvG9JsMB7CWjTLyPy"],
].map(([symbol, name, mint]) => Object.freeze({ symbol, name, mint })));

/** The most cats the collection holds. The builder refuses to grow past it rather than drop one. */
export const MAX_CATS = 500;

/** Byte limits for text read off the chain, and character limits for text the owner types. */
export const LIMITS = Object.freeze({ nameBytes: 64, symbolBytes: 16, label: 48, coat: 24 });

/* The coats a cat may wear when its stock has no look of its own: the prototype's eight
   example coats (the cream model tinted, or the ginger tabby as it is). Plain coat names only. */
export const COATS = Object.freeze([
  { coat: "Ginger tabby", model: "ginger", tint: "#ffffff", swatch: "#e98a2e" },
  { coat: "Cream point", model: "cat", tint: "#ffffff", swatch: "#ecd2b0" },
  { coat: "Smoke", model: "cat", tint: "#9c9aa8", swatch: "#8f8c99" },
  { coat: "Midnight", model: "cat", tint: "#403845", swatch: "#3a3240" },
  { coat: "Honey", model: "cat", tint: "#e8b670", swatch: "#d9a35d" },
  { coat: "Ash", model: "cat", tint: "#c2bcb4", swatch: "#b3ada5" },
  { coat: "Cinnamon", model: "cat", tint: "#c98a5e", swatch: "#b97a4f" },
  { coat: "Snow", model: "cat", tint: "#fff6ee", swatch: "#f3ece4" },
].map((c) => Object.freeze(c)));

/* ── base58 ─────────────────────────────────────────────────────────────────────────── */

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));

/** The bytes a base58 string spells, or null for anything that is not base58 (or is longer than `maxChars`). */
export function base58Decode(text, maxChars = 128) {
  if (typeof text !== "string" || text.length === 0 || text.length > maxChars) return null;
  let n = 0n;
  for (const ch of text) {
    const v = INDEX.get(ch);
    if (v === undefined) return null;
    n = n * 58n + BigInt(v);
  }
  const body = [];
  while (n > 0n) { body.push(Number(n & 0xffn)); n >>= 8n; }
  let zeros = 0;
  while (zeros < text.length && text[zeros] === "1") zeros++;
  return Uint8Array.from([...new Array(zeros).fill(0), ...body.reverse()]);
}

export function base58Encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = "1" + out; }
  return out;
}

/** True when `text` is canonical base58 for exactly `size` bytes (32 for an address, 64 for a signature). */
export function isBase58(text, size) {
  const b = base58Decode(text);
  return !!b && b.length === size && base58Encode(b) === text;
}
export const isAddress = (t) => isBase58(t, 32);
export const isSignature = (t) => isBase58(t, 64);

/* ── plain text ─────────────────────────────────────────────────────────────────────── */

const HIDDEN = /[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Cs}\p{Zl}\p{Zp}]/u;      // controls, zero-width, bidi, private, unassigned
const ODD_SPACE = /[^\S ]|[   -   　]/u; // any space but a plain one
const MARKUP = /[<>]|&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i;
const LINK = /[a-z][a-z0-9+.-]*:\/\/|\b(javascript|data|vbscript|file|blob|mailto|tel|ipfs|ipns):|\bwww\.|\b[a-z0-9-]+\.(com|net|org|io|xyz|fun|app|me|gg|co|ai|dev|sol|link|site|online|tech|finance|money|lol|wtf)\b/i;
const STACKED_MARKS = /\p{M}{4,}/u;

/** Why `text` may not be shown as a plain name, or null when it may. */
export function textProblem(text, { maxBytes, maxChars } = {}) {
  if (typeof text !== "string") return "not text";
  if (text.length === 0) return "empty";
  if (text.trim() !== text) return "leading or trailing space";
  if (/ {2}/.test(text)) return "doubled space";
  if (HIDDEN.test(text)) return "a hidden or control character";
  if (ODD_SPACE.test(text)) return "a space that is not a plain space";
  if (STACKED_MARKS.test(text)) return "stacked combining marks";
  if (MARKUP.test(text)) return "markup";
  if (LINK.test(text)) return "a link";
  if (maxBytes && new TextEncoder().encode(text).length > maxBytes) return `longer than ${maxBytes} bytes`;
  if (maxChars && [...text].length > maxChars) return `longer than ${maxChars} characters`;
  return null;
}

/* ── time ───────────────────────────────────────────────────────────────────────────── */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** Milliseconds for a UTC day or instant written the way these files write them, or null. */
export function parseTime(text, { dayAllowed = true } = {}) {
  if (typeof text !== "string") return null;
  const day = DAY.test(text);
  if (!(INSTANT.test(text) || (dayAllowed && day))) return null;
  const ms = Date.parse(day ? `${text}T00:00:00Z` : text);
  if (!Number.isFinite(ms)) return null;
  const back = new Date(ms).toISOString();
  if ((day ? back.slice(0, 10) : back.replace(".000Z", "Z")) !== text) return null; // 2026-02-30 and the like
  return ms;
}

/** A block time (seconds) as an entry writes it. */
export const blockTimeToIso = (seconds) => new Date(seconds * 1000).toISOString().replace(".000Z", "Z");

/* ── shapes ─────────────────────────────────────────────────────────────────────────── */

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const extraKeys = (obj, allowed) => Object.keys(obj).filter((k) => !allowed.includes(k));

/** Why a look may not be used, or null. */
export function lookProblem(look) {
  if (!isObject(look)) return "not an object";
  const extra = extraKeys(look, ["coat", "model", "tint", "swatch"]);
  if (extra.length) return `unknown field ${extra[0]}`;
  const coat = textProblem(look.coat, { maxChars: LIMITS.coat });
  if (coat) return `coat: ${coat}`;
  if (look.model !== "cat" && look.model !== "ginger") return "model must be cat or ginger";
  for (const k of ["tint", "swatch"]) if (typeof look[k] !== "string" || !/^#[0-9a-f]{6}$/.test(look[k])) return `${k} must be #rrggbb in lower case`;
  return null;
}

/** The coat a cat wears when its stock has no look: the same one for the same mint, always. */
export function coatFor(mint) {
  const bytes = base58Decode(mint) ?? new TextEncoder().encode(String(mint));
  let h = 0x811c9dc5;                                   // FNV-1a, 32 bits
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return { ...COATS[h % COATS.length] };
}

/** An entry's look: the stock's own look when data/stock-looks.json has one, else the mint's coat. */
export function lookFor(entry, stockLooks = {}) {
  const own = isObject(stockLooks) ? stockLooks[entry?.pair?.symbol] : undefined;
  return own && !lookProblem(own) ? { coat: own.coat, model: own.model, tint: own.tint, swatch: own.swatch } : coatFor(entry.mint);
}

/**
 * data/stock-looks.json: { "<xStock symbol>": look }. Keys must be the 24 symbols. Returns
 * { looks, refused: [{ symbol, clause, detail }] }.
 */
export function validateStockLooks(data, { stocks = XSTOCKS } = {}) {
  const looks = {}, refused = [];
  if (!isObject(data)) return { looks, refused: [{ symbol: null, clause: "shape", detail: "stock-looks must be an object keyed by xStock symbol" }] };
  for (const [symbol, look] of Object.entries(data)) {
    if (!stocks.some((s) => s.symbol === symbol)) { refused.push({ symbol, clause: "not_xstock", detail: `${symbol} is not one of the 24 xStocks` }); continue; }
    const p = lookProblem(look);
    if (p) { refused.push({ symbol, clause: "look", detail: p }); continue; }
    looks[symbol] = { coat: look.coat, model: look.model, tint: look.tint, swatch: look.swatch };
  }
  return { looks, refused };
}

/**
 * data/wallets.json: { launchers: [{ address, since, label, until? }] }. Returns
 * { launchers: [{ address, label, since, until, sinceMs, untilMs }], refused: [{ index, clause, detail }] }.
 */
export function validateWallets(data) {
  const launchers = [], refused = [];
  if (!isObject(data) || !Array.isArray(data.launchers) || extraKeys(data, ["launchers"]).length) {
    return { launchers, refused: [{ index: null, clause: "shape", detail: "wallets must be { launchers: [...] }" }] };
  }
  data.launchers.forEach((w, index) => {
    const no = (clause, detail) => refused.push({ index, clause, detail });
    if (!isObject(w)) return no("shape", "not an object");
    const extra = extraKeys(w, ["address", "since", "label", "until"]);
    if (extra.length) return no("unknown_field", `unknown field ${extra[0]}`);
    if (!isAddress(w.address)) return no("address", "not a 32-byte base58 address");
    const sinceMs = parseTime(w.since);
    if (sinceMs === null) return no("since", "since must be YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ");
    let untilMs = null;
    if (w.until !== undefined) {
      untilMs = parseTime(w.until);
      if (untilMs === null || untilMs <= sinceMs) return no("until", "until must be a date after since");
    }
    const label = textProblem(w.label, { maxChars: LIMITS.label });
    if (label) return no("label", label);
    if (launchers.some((l) => l.address === w.address)) return no("duplicate", "this address is listed twice");
    launchers.push(Object.freeze({ address: w.address, label: w.label, since: w.since, until: w.until ?? null, sinceMs, untilMs }));
  });
  return { launchers, refused };
}

/** The listed wallet that paid, if it was listed at that moment. */
export function activeLauncher(launchers, payer, timeMs) {
  return launchers.find((l) => l.address === payer && timeMs >= l.sinceMs && (l.untilMs === null || timeMs < l.untilMs)) ?? null;
}

const ENTRY_FIELDS = ["mint", "name", "symbol", "pair", "pool", "payer", "tx", "time", "look"];

/** Why one entry may not be a resident, as { clause, detail }, or null. */
export function entryProblem(e, { launchers, stocks = XSTOCKS, nowMs = Date.now() }) {
  const no = (clause, detail) => ({ clause, detail });
  if (!isObject(e)) return no("shape", "not an object");
  const extra = extraKeys(e, ENTRY_FIELDS);
  if (extra.length) return no("unknown_field", `unknown field ${extra[0]}`);
  for (const k of ["mint", "pool", "payer"]) if (!isAddress(e[k])) return no(k, `${k} is not a 32-byte base58 address`);
  if (!isSignature(e.tx)) return no("tx", "tx is not a 64-byte base58 signature");
  const name = textProblem(e.name, { maxBytes: LIMITS.nameBytes });
  if (name) return no("name", `name: ${name}`);
  const symbol = textProblem(e.symbol, { maxBytes: LIMITS.symbolBytes });
  if (symbol) return no("symbol", `symbol: ${symbol}`);
  if (/\s/.test(e.symbol)) return no("symbol", "symbol: a space");
  if (!isObject(e.pair) || extraKeys(e.pair, ["symbol", "mint"]).length) return no("pair", "pair must be { symbol, mint }");
  const stock = stocks.find((s) => s.mint === e.pair.mint);
  if (!stock) return no("pair", "the pair is not one of the 24 xStocks");
  if (stock.symbol !== e.pair.symbol) return no("pair", `the pair's mint is ${stock.symbol}, not ${String(e.pair.symbol).slice(0, 12)}`);
  if (new Set([e.mint, e.pool, e.pair.mint]).size !== 3) return no("accounts", "mint, pool and pair must be different accounts");
  const timeMs = parseTime(e.time, { dayAllowed: false });
  if (timeMs === null) return no("time", "time must be YYYY-MM-DDTHH:MM:SSZ");
  if (timeMs > nowMs + 10 * 60_000) return no("time", "time is in the future");
  if (!activeLauncher(launchers, e.payer, timeMs)) return no("payer", "the payer is not a wallet listed in data/wallets.json at that time");
  if (e.look !== undefined) {
    const p = lookProblem(e.look);
    if (p) return no("look", `look: ${p}`);
  }
  return null;
}

/** Newest first; the same moment falls back to the mint, so the order never depends on input order. */
export const compareEntries = (a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : a.mint < b.mint ? -1 : a.mint > b.mint ? 1 : 0);

const copyEntry = (e) => ({
  mint: e.mint, name: e.name, symbol: e.symbol, pair: { symbol: e.pair.symbol, mint: e.pair.mint },
  pool: e.pool, payer: e.payer, tx: e.tx, time: e.time,
  ...(e.look !== undefined ? { look: { coat: e.look.coat, model: e.look.model, tint: e.look.tint, swatch: e.look.swatch } } : {}),
});

/**
 * The residents in a collection file. `wallets` is data/wallets.json as read (or its
 * validateWallets result). Returns { cats, refused: [{ index, mint, clause, detail }] }: `cats`
 * are clean copies, deduplicated by mint (and by transaction), newest first, at most `max`.
 */
export function validateCollection(data, { wallets, stocks = XSTOCKS, max = MAX_CATS, nowMs = Date.now() } = {}) {
  const launchers = Array.isArray(wallets?.launchers) && wallets.launchers.every((l) => typeof l.sinceMs === "number")
    ? wallets.launchers : validateWallets(wallets).launchers;
  const refused = [];
  if (!isObject(data) || !Array.isArray(data.cats) || extraKeys(data, ["cats"]).length) {
    return { cats: [], refused: [{ index: null, mint: null, clause: "shape", detail: "the collection must be { cats: [...] }" }] };
  }
  const good = [];
  data.cats.forEach((e, index) => {
    const p = entryProblem(e, { launchers, stocks, nowMs });
    if (p) refused.push({ index, mint: typeof e?.mint === "string" ? e.mint.slice(0, 44) : null, ...p });
    else good.push({ index, entry: copyEntry(e) });
  });
  good.sort((a, b) => compareEntries(a.entry, b.entry) || a.index - b.index);
  const mints = new Set(), txs = new Set(), cats = [];
  for (const { index, entry } of good) {
    if (mints.has(entry.mint)) { refused.push({ index, mint: entry.mint, clause: "duplicate", detail: "this mint is listed twice" }); continue; }
    if (txs.has(entry.tx)) { refused.push({ index, mint: entry.mint, clause: "duplicate", detail: "this transaction is listed twice" }); continue; }
    if (cats.length >= max) { refused.push({ index, mint: entry.mint, clause: "over_max", detail: `the collection holds at most ${max} cats` }); continue; }
    mints.add(entry.mint); txs.add(entry.tx); cats.push(entry);
  }
  return { cats, refused };
}

/** Public pages about a validated entry, or null. The StonkFun page form is the one the Cat
    Intelligence Agency project pinned (bots/lib/verified.mjs PAGES.stonkfunToken). */
export function links(entry) {
  if (!isObject(entry) || !isAddress(entry.mint) || !isSignature(entry.tx)) return null;
  return {
    token: `https://solscan.io/token/${entry.mint}`,
    tx: `https://solscan.io/tx/${entry.tx}`,
    stonkfun: `https://www.stonkfun.xyz/token/${entry.mint}`,
  };
}
