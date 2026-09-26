/* THE SANCTUARY'S DATA RULES, CHECKED THE SAME WAY IN THE PAGE AND IN NODE. Pure: no imports,
   no network, no DOM.

   Two kinds of cat live in the garden:
   - a PLANNED cat (data/planned.json, written by scripts/build-planned.mjs from the launch
     sheets and the research in data/cats-info.json): a name, a story, a portrait and a coat,
     paired with one stock. It is not a token and shows as "Not launched yet". It has no mint
     and no buy link.
   - a RESIDENT token (data/collection.json, written by scripts/build-collection.mjs): a StonkFun
     launch that the builder proved on Solana, paid by a wallet in data/wallets.json while that
     wallet was listed, priced in one of the stock pairs below. assets/residents.js matches it
     to its planned cat by pair mint and ticker; a launch with no planned cat still shows.
   Nothing here decides that a launch happened; the builder proves that on chain. This file only
   refuses an entry that is malformed, unsafe to show, or not paid by a listed wallet.

   data/collection.json   { "cats": [ entry, … ] }, newest first
   entry                  { mint, name, symbol, pair: { symbol, mint }, pool, payer, tx, time }
                            mint, pool, payer, pair.mint: base58, 32 bytes; tx: base58, 64 bytes
                            time: the launch's block time, "YYYY-MM-DDTHH:MM:SSZ"
   data/wallets.json      { "launchers": [ { address, since, label, until? } ] }
                            since / until: "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SSZ" (UTC); until is
                            exclusive and optional. To retire a wallet, give it an until date:
                            removing it would make its cats fail this check, and the builder
                            never drops a cat, so it stops instead.
   data/planned.json      { "stocks": [ stock, … ], "cats": [ planned cat, … ] } (see validatePlanned)

   A third kind lives round them:
   - a FAMOUS cat coin (data/famous.json, see validateFamous): a cat coin that already exists on
     some chain, made by others, shown with its real token, its pair, its market figures (with the
     time they were read) and honest warnings. The sanctuary is not affiliated with any of them.
     Famous coins are Solana coins only (the owner's decision). Its only buy link is its GMGN
     page for its own contract. */

/* ── the stock pairs a cat may be priced in ─────────────────────────────────────────────

   One row per mint: [symbol, name, mint, category, StonkFun symbol].

   WHERE THIS LIST CAME FROM. StonkFun's public pair list,
   https://www.stonkfun.xyz/api/public/v1/pairs?launchable=true&launchLabReady=true (the endpoint
   its /developers page documents), read on 2026-09-25 at 12:39:26Z and again at 17:22Z with the
   same rows. Kept: every pair in StonkFun's categories xstock, backpack (Backpack Securities
   stocks and funds), prestock (PreStocks) and tessera (Tessera T-tokens) whose StonkFun symbol is
   one of the sanctuary's 91 planned stock cats, i.e. a symbol in the launch sheets or in the
   research list (data/cats-info.json). That is 93 mints: 24 xStocks, 60 Backpack stocks and
   funds, 7 PreStocks, and Tessera's second OPENAI and KALSHI mints (StonkFun lists both issuers
   under one symbol). Left out: the crypto tokens in the backpack category (DOGE, LINK, …), and
   every "custom", "currency", "solana", "leverage" and "collectible" pair. Every mint is a
   Token-2022 mint; the symbol and name are the ones each mint's own token metadata carries on
   chain (read 2026-09-25, slot 450418635). The rows StonkFun gave are kept in
   tests/fixtures/stonkfun-pairs.json and the mint accounts in tests/fixtures/pair-mints.json;
   a test matches every row against both, and the 24 xStocks against the official list at
   https://xstocks.com/us/products (tests/fixtures/xstocks-official-24.json). */
export const STOCK_PAIRS = Object.freeze([
  ["SPYx", "SP500 xStock", "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", "xstock", "SPYX"],
  ["NVDAx", "NVIDIA xStock", "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", "xstock", "NVDAX"],
  ["GOOGLx", "Alphabet xStock", "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", "xstock", "GOOGLX"],
  ["QQQx", "Nasdaq xStock", "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ", "xstock", "QQQX"],
  ["TSLAx", "Tesla xStock", "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", "xstock", "TSLAX"],
  ["CRCLx", "Circle xStock", "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1", "xstock", "CRCLX"],
  ["COINx", "Coinbase xStock", "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu", "xstock", "COINX"],
  ["MSTRx", "MicroStrategy xStock", "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ", "xstock", "MSTRX"],
  ["AMZNx", "Amazon.com xStock", "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg", "xstock", "AMZNX"],
  ["HOODx", "Robinhood xStock", "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg", "xstock", "HOODX"],
  ["SPCXx", "SpaceX xStock", "Xs3oZwbHvqis4NYcf4YKWmEia2eC84wSiVrcYcTqpH8", "xstock", "SPCXX"],
  ["AAPLx", "Apple xStock", "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", "xstock", "APPLX"],
  ["GLDx", "Gold xStock", "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re", "xstock", "GLDX"],
  ["METAx", "Meta xStock", "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu", "xstock", "METAX"],
  ["PLTRx", "Palantir xStock", "XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4", "xstock", "PLTRX"],
  ["MSFTx", "Microsoft xStock", "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX", "xstock", "MSFTX"],
  ["GMEx", "Gamestop xStock", "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc", "xstock", "GMEX"],
  ["STRCx", "Strategy PP Variable xStock", "Xs78JED6PFZxWc2wCEPspZW9kL3Se5J7L5TChKgsidH", "xstock", "STRCX"],
  ["MCDx", "McDonald's xStock", "XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2", "xstock", "MCDX"],
  ["BRK.Bx", "Berkshire Hathaway xStock", "Xs6B6zawENwAbWVi7w92rjazLuAr5Az59qgWKcNb45x", "xstock", "BRKX"],
  ["KOx", "Coca-Cola xStock", "XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ", "xstock", "KOX"],
  ["INTCx", "Intel xStock", "XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM", "xstock", "INTCX"],
  ["VIDAx", "Vida Global xStock", "XsfCC9VL4DamVGNgdJpfLXB3sBVa158Gbx8sh7NzmTk", "xstock", "VIDAX"],
  ["DFDVx", "DFDV xStock", "Xs2yquAgsHByNzx68WJC55WHjHBvG9JsMB7CWjTLyPy", "xstock", "DFDV"],
  ["MU", "Micron Technology - Backpack Securities", "MUxEsUKSMACyw5fZf68wxf5FLnZVhtU9CwH8uNNGay1", "backpack", "MU"],
  ["BOT", "RoboStrategy - Backpack Securities", "BoTx8y9ynfdxf5ZjWtCoBVkff52qKA82ysaLU8ZM6d8T", "backpack", "ROBOSTRATEGY"],
  ["SKHY", "SK Hynix - Backpack Securities", "SKHYhSjuRWHgikq8eRKbtBbpABgJSkd7ytQV14i9EQ3", "backpack", "SKHY"],
  ["SNDK", "Sandisk - Backpack Securities", "SNDKbwMUQvZhnLnxLduradgLHG5KrPuKwpnrkkGRhfH", "backpack", "SNDK"],
  ["DRAM", "Roundhill Memory ETF - Backpack Securities", "DRAMjSWR7HRfJKjRkvQWYL2bcaejaVhuxEcjf4pAY4Cw", "backpack", "DRAM"],
  ["TTWO", "Take-Two Interactive Software - Backpack Securities", "TTWofwAge91oFhZs7kpQdyrVRkmevgM88xijGvQFbKo", "backpack", "TTWO"],
  ["NBIS", "Nebius Group N.V. - Backpack Securities", "NBiSF3UaVUFtRzHwAfxyHsBCAZWGEKnMpewAE4oh7BG", "backpack", "NBIS"],
  ["MRNA", "Moderna - Backpack Securities", "MRNAzXzhNcaEXJPibHEn8cd4vyekCDiivTyEwswLUCT", "backpack", "MRNA"],
  ["LLY", "Eli Lilly and Company - Backpack Securities", "LLYuwZ33keFihgwoxXsBawy31AiRFLFSva32TYq5TvD", "backpack", "LLY"],
  ["MRVL", "Marvell Technology - Backpack Securities", "MRVLSjkR2ceUBukujaD3xCyHP1H3B2SzpsNTZF546jo", "backpack", "MRVL"],
  ["GPRO", "GoPro - Backpack Securities", "GPRR2u6NS5yBQHWGauoJ9HXgjrTH8dDsrBfTV5zAYvDH", "backpack", "GPRO"],
  ["AMC", "AMC Entertainment - Backpack Securities", "AMC1qwR9KhiyrQBRPrxnfo4JfMeMZqEBvt5tgTytNNoc", "backpack", "AMC"],
  ["NKE", "NIKE - Backpack Securities", "NKEda5nHhNGgjrE9nDdMvaEmkmJ96qqxzBVZEcKmjSg", "backpack", "NIKE"],
  ["SPHR", "Sphere Entertainment Co. - Backpack Securities", "SPHRp8cZaSQBTp1KMNP4V1X821SXhXWt4Q2yLdyHzju", "backpack", "SPHR"],
  ["HTZ", "Hertz Global Holdings, Inc Common Stock - Backpack Securities", "HTZsLG4zqaNvWMwXSLHH3GG5KyJpKwpBRsKVdMG6hvzP", "backpack", "HTZ"],
  ["RDDT", "Reddit - Backpack Securities", "RDDTGbhHwVXfyCvQMXzzowKjf5qrYBZAnehoXW83ooh", "backpack", "RDDT"],
  ["COST", "Costco Wholesale - Backpack Securities", "CZEB3WNZuF2Yz1z2H81RcCk8T7fsw82KB33zqamASVsg", "backpack", "COST"],
  ["DELL", "Dell Technologies - Backpack Securities", "DELL2aRKQz7DMq5DrKLtkn47ZCnbxXPZXrSGbkmd13wy", "backpack", "DELL"],
  ["DJT", "Trump Media & Technology Group Corp. Common Stock - Backpack Securities", "DJTu7vi8norVzdVAffgvb39VP7wjKeTsgaMBJrzfxvoF", "backpack", "DJT"],
  ["IBM", "International Business Machines - Backpack Securities", "BMKdM4yUxX12moFqVk195k7coMbaybd4RUKCUdm7D1Sk", "backpack", "IBM"],
  ["LMT", "Lockheed Martin - Backpack Securities", "LMT3i1BHgixFqPUgcyteJhnEz2dpy9i3cYy4pi9BoeV", "backpack", "LMT"],
  ["QUBT", "Quantum Computing - Backpack Securities", "QUBTAD8C9bMU9LvmMNgKPhrmBGbHvxpu6vfWQtThxxw", "backpack", "QUBT"],
  ["RBLX", "Roblox - Backpack Securities", "RBLXDGRD64AtRamHMFVcjqne3Ar7NLWtFtYNtsrf1cE", "backpack", "RBLX"],
  ["HIMS", "Hims & Hers Health - Backpack Securities", "HiMSSzzwkZkrXJ4PGVJRdtfLaANeAztjjcgk5Dxe7Lwx", "backpack", "HIMS"],
  ["LULU", "lululemon athletica inc. - Backpack Securities", "LULUmT9VMttkfAJE236LXJcYJ2tTP7nunrSWR5G1BdS", "backpack", "LULU"],
  ["PFE", "Pfizer - Backpack Securities", "PFER6ENqP8r8NF3CqVt4mFowxsin3V5MLidBNQFCC3x", "backpack", "PFIZER"],
  ["RIVN", "Rivian Automotive - Backpack Securities", "RcZmt84VMJv9bDhKqmw1uWDahYrUT468VwAChTnfD8p", "backpack", "RIVN"],
  ["SHOP", "Shopify - Backpack Securities", "SH55hfaipFAbwT42nQYhRoM5o5t61QpkmJ6p62vXB3m", "backpack", "SHOP"],
  ["SNAP", "Snap - Backpack Securities", "SNAPcESrvnH8yUdgeMF6xm1hym9b6hW6s8YeqeHdZFz", "backpack", "SNAP"],
  ["UPS", "United Parcel Service - Backpack Securities", "UPSqUeMHcWbkdg784XuBUEF9DtySSnW9ur5LAVdcuB9", "backpack", "UPS"],
  ["PENG", "Penguin Solutions - Backpack Securities", "PENGTDQeQSXEjKcYw3CTQi9qznxcTHXAA7LMfUNrxLV", "backpack", "PENG"],
  ["BA", "The Boeing Company - Backpack Securities", "BArimz1PcKZr8PcPh3tcZ2dg4S7FJLk3cw6R5F8GsHKg", "backpack", "BOEING"],
  ["AMBA", "Ambarella, Inc. Ordinary Shares - Backpack Securities", "AMBAHqGPjjtJaHPPSuvPu2mPCJdkGZpmhHQa5pkXbxrM", "backpack", "AMBA"],
  ["BULL", "Webull Corporation Class A Ordinary Shares - Backpack Securities", "BULL151gUXcFV5wXEUqu9Am2L7Qt4bTJRLRuAUjkcspC", "backpack", "WEBULL"],
  ["JNJ", "Johnson & Johnson - Backpack Securities", "JNJg1znKdF712Phe7L7z52AATAvEjEytBdN2w8Lnh1Y", "backpack", "JNJ"],
  ["BABA", "Alibaba Group Holding - Backpack Securities", "BABANGA4JE7Kkam4nTrALAwAVgsNJUuFJnnkF7S16BZp", "backpack", "BABA"],
  ["GRND", "Grindr - Backpack Securities", "GRNDYDpqwpCm6jVxpbh4xT5AM4r3p391qYsKTHqgaET2", "backpack", "GRND"],
  ["MGM", "MGM Resorts International - Backpack Securities", "MGMuubtUEirmkhfEQdmGUh4pr7HuUdMWcZXFtpPbVJD", "backpack", "MGM"],
  ["DNUT", "Krispy Kreme, Inc. Common Stock - Backpack Securities", "DNUTsCvKbKwu2RM72cUuW3TD9YpzArzACcqYQssjPLSk", "backpack", "DNUT"],
  ["WEN", "The Wendy's Company - Backpack Securities", "WENAZ2WyPbmgvUcKfQ8hyMDfBQP9bZ65hsZ5KTFrRGZ", "backpack", "WEN"],
  ["DKNG", "DraftKings - Backpack Securities", "DKNGQFNGQmoBdXSRGKJ8tTu7uPDasw5JDcfMmWniNfow", "backpack", "DKNG"],
  ["FLWS", "1-800-FLOWERS.COM - Backpack Securities", "FLWSojG1gB5VStYR3Sb4nQFRt43UBYkqih1j2CpVLqgd", "backpack", "FLWS"],
  ["SCHH", "Schwab U.S. REIT ETF - Backpack Securities", "SCHHJ3jRdSjeFEVAaLrnYdx3Brphn92Ys7z1qkiCtPX", "backpack", "SCHH"],
  ["PTN", "Palatin Technologies, Inc. Common Stock - Backpack Securities", "PTNzAfFAB4LvoUQEUUGrFMyUoRLExMYjH6CcfyQfsVP", "backpack", "PTN"],
  ["FLY", "Firefly Aerospace - Backpack Securities", "FLYRq3en8r2Z69gN3KyAnDrvnitEJNkwPYY7favinHeD", "backpack", "FLY"],
  ["BROS", "Dutch Bros - Backpack Securities", "BRVaZKg6J9iF2BEsdpsxJ9NyvN9PPxPZuoQUX2v8qqkk", "backpack", "BROS"],
  ["AMD", "Advanced Micro Devices - Backpack Securities", "AMD8XwJXgQ9WV45Wyj9yFLejxzf2J6VM1PJY8bJEjeES", "backpack", "AMD"],
  ["FWDI", "Forward Industries, Inc. - Backpack Securities", "FWDtiB5fXHdVAewPqvHPL2dh4aBC1C6GacQbePoQXKjz", "backpack", "FWDI"],
  ["LUV", "Southwest Airlines Co. - Backpack Securities", "LUV9GB51PNZNRyzzyYK3rtqFfvDvWtRiXZ34wVq2HrX", "backpack", "LUV"],
  ["WULF", "TeraWulf - Backpack Securities", "WULFeyfrj1VJKD9HhRTcW8R4g5HefUA11HDEdBv2WxD", "backpack", "WULF"],
  ["RUM", "RUM Group Inc. - Backpack Securities", "RUMsPfFZFnN1ZmGANwP7FNMJMjKH4m9RiMePrtVtLe7", "backpack", "RUM"],
  ["USO", "United States Oil Fund, LP - Backpack Securities", "USNv3NkKA27Dh4nsHJDPhW4VoEcTQmjoZyJt2dqdwFu", "backpack", "USO"],
  ["CYPH", "Cypherpunk Technologies - Backpack Securities", "CYPHuMmCL1GxJWa2tsPhLKykC7GrHJTCHwbXD4g5uawK", "backpack", "CYPH"],
  ["BB", "BlackBerry - Backpack Securities", "BBosJLw8ZzoATiEyywiifx7AgmrD2Cm3XjFWbhbRhChy", "backpack", "BB"],
  ["URA", "Global X Uranium ETF - Backpack Securities", "URARfsinxCRw4JpvQhuT4CxavdZXZEMjv9ZwWmWpwag", "backpack", "URA"],
  ["COPX", "Global X Copper Miners ETF - Backpack Securities", "CzLTZppPdZtTjyq3WGpHLstoc3GLhu7zH5Zg6xUa6Gv5", "backpack", "COPX"],
  ["IONQ", "IonQ - Backpack Securities", "NQ5hSuXQZrbnrwcDVk2qN73njjd3E3v3badYHnj5thF", "backpack", "IONQ"],
  ["ARM", "Arm Holdings - Backpack Securities", "ARMbSB1MBRQrY6PNMao1HdQ431VafC6JRJCsGZ2Yv3iJ", "backpack", "ARM"],
  ["CRWV", "CoreWeave - Backpack Securities", "CRWVJeR2yEZuDUKYfGuKCHvLz8ywn4LGvovHfy5WiFmi", "backpack", "CRWV"],
  ["IREN", "IREN - Backpack Securities", "RENzhrJQgmAnfcLhU1U5XwAMc6TC15UA6jCbPBaasnj", "backpack", "IREN"],
  ["ANTHROPIC", "Anthropic PreStocks", "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw", "prestock", "ANTHROPIC"],
  ["ANDURIL", "Anduril PreStocks", "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB", "prestock", "ANDURIL"],
  ["POLYMARKET", "Polymarket PreStocks", "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP", "prestock", "POLYMARKET"],
  ["KALSHI", "Kalshi PreStocks", "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua", "prestock", "KALSHI"],
  ["NEURALINK", "Neuralink PreStocks", "PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S", "prestock", "NEURALINK"],
  ["OPENAI", "OpenAI PreStocks", "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF", "prestock", "OPENAI"],
  ["FIGUREAI", "Figure AI PreStocks", "PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd", "prestock", "FIGUREAI"],
  ["tOpenAI", "T-OpenAI", "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ", "tessera", "OPENAI"],
  ["tKalshi", "T-Kalshi", "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ", "tessera", "KALSHI"],
].map(([symbol, name, mint, category, stonkfun]) => Object.freeze({ symbol, name, mint, category, stonkfun })));

/** The 24 xStocks among them. */
export const XSTOCKS = Object.freeze(STOCK_PAIRS.filter((p) => p.category === "xstock"));

/** The pair row for a mint, or null. */
export const pairByMint = (mint) => STOCK_PAIRS.find((p) => p.mint === mint) ?? null;

/** The most cats the collection holds. The builder refuses to grow past it rather than drop one. */
export const MAX_CATS = 500;

/** Byte limits for text read off the chain, and character limits for text the owner types. */
export const LIMITS = Object.freeze({ nameBytes: 64, symbolBytes: 16, label: 48 });

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

/** Why `text` may not be shown as a plain name (a token's name or symbol, a label), or null when it may. */
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

const TAG_LIKE = /<\s*[a-z!/?]|&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);|\b(javascript|vbscript|data):/i;

/**
 * Why `text` may not be shown as prose (a story, a research note, a label naming a source), or
 * null. Prose may carry punctuation, company names such as Amazon.com and plain line breaks, but
 * nothing tag-like, no entity, no script scheme and no hidden character. The page sets it with
 * textContent in any case.
 */
export function proseProblem(text, { maxChars = 2000, empty = false } = {}) {
  if (typeof text !== "string") return "not text";
  if (!empty && text.length === 0) return "empty";
  if (text.trim() !== text) return "leading or trailing space";
  if ([...text.replace(/\n/g, "")].some((ch) => HIDDEN.test(ch) || ODD_SPACE.test(ch))) return "a hidden or control character";
  if (STACKED_MARKS.test(text)) return "stacked combining marks";
  if (TAG_LIKE.test(text)) return "markup";
  if ([...text].length > maxChars) return `longer than ${maxChars} characters`;
  return null;
}

/** Why `url` may not be linked to, or null: https to a named host, no credentials, no spaces. */
export function httpsProblem(url) {
  if (typeof url !== "string" || url.length > 400 || /\s/.test(url)) return "not a URL";
  let u;
  try { u = new URL(url); } catch { return "not a URL"; }
  if (u.protocol !== "https:") return "not https";
  if (u.username || u.password) return "carries credentials";
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(u.hostname)) return "not a named host";
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

/** Why a source's date is not "YYYY", "YYYY-MM" or "YYYY-MM-DD", real and not after `nowMs`, or null. */
export function sourceDateProblem(text, nowMs = Date.now()) {
  if (typeof text !== "string" || !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(text)) return "not YYYY, YYYY-MM or YYYY-MM-DD";
  const full = text.length === 4 ? `${text}-01-01` : text.length === 7 ? `${text}-01` : text;
  const ms = parseTime(full);
  if (ms === null) return "not a real date";
  if (ms > nowMs + 86_400_000) return "in the future";
  return null;
}

/** A block time (seconds) as an entry writes it. */
export const blockTimeToIso = (seconds) => new Date(seconds * 1000).toISOString().replace(".000Z", "Z");

/* ── coats ──────────────────────────────────────────────────────────────────────────── */

/** The colour words a coat may use: the ones the garden's renderer and the page both know. */
export const COAT_COLOURS = Object.freeze([
  "black", "white", "cream", "ginger", "orange", "red", "grey", "silver", "blue", "brown", "chocolate", "lilac", "fawn",
  "cinnamon", "golden", "tan", "smoke", "seal", "caramel", "amber", "copper", "gold", "green", "yellow", "hazel", "odd",
]);
/** The patterns a coat may have. */
export const COAT_PATTERNS = Object.freeze(["solid", "tabby", "tuxedo", "calico", "tortie", "point", "spotted", "bicolour"]);

/** Why a coat { base, second, pattern, eyes } may not be used, or null. Colours are known words ("" for second and eyes when unknown). */
export function coatProblem(coat) {
  if (!isObject(coat)) return "not an object";
  const extra = extraKeys(coat, ["base", "second", "pattern", "eyes"]);
  if (extra.length) return `unknown field ${extra[0]}`;
  if (!COAT_COLOURS.includes(coat.base)) return "base is not a known colour";
  for (const k of ["second", "eyes"]) if (typeof coat[k] !== "string" || (coat[k] !== "" && !COAT_COLOURS.includes(coat[k]))) return `${k} is not a known colour`;
  if (!COAT_PATTERNS.includes(coat.pattern)) return "pattern is not a known pattern";
  return null;
}

/* The coats a launched token with no planned cat wears, picked by its mint. Plain house-cat coats. */
const MINT_COATS = Object.freeze([
  ["ginger", "", "tabby", "amber"], ["cream", "seal", "point", "blue"], ["smoke", "", "solid", "copper"],
  ["black", "white", "tuxedo", "green"], ["golden", "", "tabby", "green"], ["grey", "white", "bicolour", "yellow"],
  ["cinnamon", "", "solid", "hazel"], ["white", "ginger", "calico", "green"], ["black", "amber", "tortie", "copper"],
  ["silver", "", "tabby", "green"], ["brown", "", "tabby", "yellow"], ["white", "", "solid", "blue"],
].map(([base, second, pattern, eyes]) => Object.freeze({ base, second, pattern, eyes })));

/** The coat a launched token with no planned cat wears: the same one for the same mint, always. */
export function coatFromMint(mint) {
  const bytes = base58Decode(mint) ?? new TextEncoder().encode(String(mint));
  let h = 0x811c9dc5;                                   // FNV-1a, 32 bits
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return { ...MINT_COATS[h % MINT_COATS.length] };
}

/* ── shapes ─────────────────────────────────────────────────────────────────────────── */

function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function extraKeys(obj, allowed) { return Object.keys(obj).filter((k) => !allowed.includes(k)); }

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

const ENTRY_FIELDS = ["mint", "name", "symbol", "pair", "pool", "payer", "tx", "time"];

/** Why a pair { symbol, mint } is not one of the stock pairs, or null. */
export function pairProblem(pair, { stocks = STOCK_PAIRS } = {}) {
  if (!isObject(pair) || extraKeys(pair, ["symbol", "mint"]).length) return "pair must be { symbol, mint }";
  const stock = stocks.find((s) => s.mint === pair.mint);
  if (!stock) return "the pair is not one of the sanctuary's stock pairs";
  if (stock.symbol !== pair.symbol) return `the pair's mint is ${stock.symbol}, not ${String(pair.symbol).slice(0, 12)}`;
  return null;
}

/** Why one collection entry may not be a resident, as { clause, detail }, or null. */
export function entryProblem(e, { launchers, stocks = STOCK_PAIRS, nowMs = Date.now() }) {
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
  const pair = pairProblem(e.pair, { stocks });
  if (pair) return no("pair", pair);
  if (new Set([e.mint, e.pool, e.pair.mint]).size !== 3) return no("accounts", "mint, pool and pair must be different accounts");
  const timeMs = parseTime(e.time, { dayAllowed: false });
  if (timeMs === null) return no("time", "time must be YYYY-MM-DDTHH:MM:SSZ");
  if (timeMs > nowMs + 10 * 60_000) return no("time", "time is in the future");
  if (!activeLauncher(launchers, e.payer, timeMs)) return no("payer", "the payer is not a wallet listed in data/wallets.json at that time");
  return null;
}

/** Newest first; the same moment falls back to the mint, so the order never depends on input order. */
export const compareEntries = (a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : a.mint < b.mint ? -1 : a.mint > b.mint ? 1 : 0);

const copyEntry = (e) => ({
  mint: e.mint, name: e.name, symbol: e.symbol, pair: { symbol: e.pair.symbol, mint: e.pair.mint },
  pool: e.pool, payer: e.payer, tx: e.tx, time: e.time,
});

/**
 * The resident tokens in a collection file. `wallets` is data/wallets.json as read (or its
 * validateWallets result). Returns { cats, refused: [{ index, mint, clause, detail }] }: `cats`
 * are clean copies, deduplicated by mint (and by transaction), newest first, at most `max`.
 */
export function validateCollection(data, { wallets, stocks = STOCK_PAIRS, max = MAX_CATS, nowMs = Date.now() } = {}) {
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

/* ── links for a launched token ─────────────────────────────────────────────────────── */

/** Public pages about a validated entry, or null. The StonkFun page form is the one the Cat
    Intelligence Agency project pinned (bots/lib/verified.mjs PAGES.stonkfunToken); on 2026-09-25
    https://www.stonkfun.xyz/token/EcB7LMNF…3HvL opened the GMEx launch's page ("1GME / GMEX · StonkFun"). */
export function links(entry) {
  if (!isObject(entry) || !isAddress(entry.mint) || !isSignature(entry.tx)) return null;
  return {
    token: `https://solscan.io/token/${entry.mint}`,
    tx: `https://solscan.io/tx/${entry.tx}`,
    stonkfun: `https://www.stonkfun.xyz/token/${entry.mint}`,
  };
}

/**
 * Where a launched token can be bought: a mint only, so a planned cat has none. Checked on
 * 2026-09-25 (tests/fixtures/buy-links.json keeps what was seen):
 * - GMGN: https://gmgn.ai/sol/token/<mint>. In a browser, POPCAT's mint (7GCihgDB…W2hr) opened
 *   its page ("POPCAT $56.94M | GMGN.AI"), and so did a real StonkFun LaunchLab token priced in
 *   GMEx (EcB7LMNF…3HvL, "1GME $3.25K | GMGN.AI").
 * - FOMO (the fomo app by FOMO Labs, Inc.; official site https://fomo.family, the site its
 *   Google Play listing names): https://fomo.family/tokens/solana/<mint>. That is the path its
 *   own web app builds (route "tokens/:chain/:tokenAddress", chain "solana"), and the share card
 *   fomo renders for that path named POPCAT, and the GMEx StonkFun token, correctly. The page
 *   needs a fomo login: a visitor who is signed out lands on fomo.family's front page.
 */
export const BUY_SITES = Object.freeze([
  Object.freeze({ label: "GMGN", url: (mint) => `https://gmgn.ai/sol/token/${mint}` }),
  Object.freeze({ label: "FOMO", url: (mint) => `https://fomo.family/tokens/solana/${mint}` }),
]);

/** [{ label, url }] for a launched token's mint; [] for anything that is not a mint. */
export function buyLinks(mint) {
  if (!isAddress(mint)) return [];
  return BUY_SITES.map((s) => ({ label: s.label, url: s.url(mint) }));
}

/* ── data/planned.json ──────────────────────────────────────────────────────────────── */

export const TICKER = /^[A-Z0-9]{2,10}$/;
const WORD = /^[a-z_]{2,24}$/;
/** What every card's disclaimer must say. */
const DISCLAIMER_MUST = Object.freeze([["not affiliated", /not affiliated/i], ["StonkFun", /stonkfun/i], ["no intrinsic value", /no intrinsic value/i], ["not financial advice", /not financial advice/i]]);

/** Why a card's disclaimer is not enough, or null. */
export function disclaimerProblem(text) {
  const p = proseProblem(text, { maxChars: 400 });
  if (p) return p;
  const missing = DISCLAIMER_MUST.find(([, re]) => !re.test(text));
  return missing ? `it does not say "${missing[0]}"` : null;
}

/* Research links are sources (a post, an article, a page), never a place to trade a token: a
   planned cat has nothing to buy, and a link to someone else's coin for the same cat would be a
   buy link in all but name. Buy and explorer links come only from buyLinks() and links() below,
   for a launched token's own mint. */
const TRADE_HOSTS = Object.freeze([
  "gmgn.ai", "fomo.family", "pump.fun", "dexscreener.com", "birdeye.so", "jup.ag", "raydium.io", "photon-sol.tinyastro.io",
  "bullx.io", "axiom.trade", "geckoterminal.com", "letsbonk.fun", "bonk.fun", "moonshot.money", "defined.fi", "orca.so", "meteora.ag",
]);
/** Explorer and launchpad hosts whose token and transaction pages are trade pages in effect. */
const TOKEN_PAGE_HOSTS = Object.freeze({ "stonkfun.xyz": /^\/(token|coin|trade)\b/i, "solscan.io": /^\/(token|tx|account)\b/i, "solana.fm": /^\/(address|tx)\b/i, "explorer.solana.com": /^\/(address|tx)\b/i });

/** Why `url` may not be a research source because it is a trading, buy or token page, or null. */
export function tradeLinkProblem(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const on = (h) => host === h || host.endsWith(`.${h}`);
  if (TRADE_HOSTS.some(on)) return "a trading site, not a source";
  for (const [h, path] of Object.entries(TOKEN_PAGE_HOSTS)) if (on(h) && path.test(u.pathname)) return "a token or transaction page, not a source";
  return null;
}

/** What a virality figure's date means: the day it was counted, the date the source gives for it,
    the date the source was published, or (the source gives none) the day the source was read. */
export const VIRALITY_DATE_TYPES = Object.freeze(["measured", "as_of", "published", "undated"]);

function linkRowProblem(l, nowMs) {
  if (!isObject(l)) return "not an object";
  const extra = extraKeys(l, ["label", "url", "date", "dateType", "opened"]);
  if (extra.length) return `unknown field ${extra[0]}`;
  return proseProblem(l.label, { maxChars: 160 }) ?? httpsProblem(l.url) ?? tradeLinkProblem(l.url) ?? sourceDateProblem(l.date, nowMs)
    ?? (typeof l.dateType === "string" && WORD.test(l.dateType) ? null : "dateType")
    ?? (l.opened === undefined || (DAY.test(l.opened) && parseTime(l.opened) !== null) ? null : "opened must be YYYY-MM-DD");
}

function viralityRowProblem(v, nowMs) {
  if (!isObject(v)) return "not an object";
  const extra = extraKeys(v, ["label", "value", "source", "date", "dateType", "method"]);
  if (extra.length) return `unknown field ${extra[0]}`;
  return proseProblem(v.label, { maxChars: 160 }) ?? proseProblem(v.value, { maxChars: 60 }) ?? httpsProblem(v.source) ?? tradeLinkProblem(v.source)
    ?? sourceDateProblem(v.date, nowMs) ?? (VIRALITY_DATE_TYPES.includes(v.dateType) ? null : `dateType must be one of ${VIRALITY_DATE_TYPES.join(", ")}`)
    ?? proseProblem(v.method, { maxChars: 160 });
}

/** A link type that claims the company's own post or character. */
const OFFICIAL_LINK = /^official_/;
/** Words in a research row that say its link was not confirmed. */
const UNCONFIRMED = /\b(unverified|not verified|could not be (found|verified|confirmed)|was not found|never found|not confirmed)\b/i;

/** Why one stock's research row may not be shown, or null. */
function stockProblem(s, nowMs) {
  if (!isObject(s)) return "not an object";
  const extra = extraKeys(s, ["pair", "stonkfun", "category", "company", "realCat", "links", "virality", "checked", "disclaimer"]);
  if (extra.length) return `unknown field ${extra[0]}`;
  const pair = pairProblem(s.pair);
  if (pair) return pair;
  const row = pairByMint(s.pair.mint);
  if (s.stonkfun !== row.stonkfun || s.category !== row.category) return "stonkfun symbol or category does not match the pair";
  const company = proseProblem(s.company, { maxChars: 120 });
  if (company) return `company: ${company}`;
  const r = s.realCat;
  if (!isObject(r) || extraKeys(r, ["name", "who", "basis", "linkType", "strength", "linked"]).length) return "realCat must be { name, who, basis, linkType, strength, linked }";
  if (r.name !== null && proseProblem(r.name, { maxChars: 80 })) return "realCat.name";
  const who = proseProblem(r.who, { maxChars: 1200 });
  if (who) return `realCat.who: ${who}`;
  if (proseProblem(r.basis, { maxChars: 600 })) return "realCat.basis";
  if (!WORD.test(r.linkType) || !WORD.test(r.strength) || typeof r.linked !== "boolean") return "realCat.linkType, strength or linked";
  // "The company's own post" must be the company's own: an unconfirmed report is linkType "reported".
  if (OFFICIAL_LINK.test(r.linkType) && UNCONFIRMED.test(`${r.basis} ${r.who}`)) return `realCat.linkType ${r.linkType}, but the research says the link was not confirmed (use "reported")`;
  if (!Array.isArray(s.links) || s.links.length > 12) return "links must be a list of at most 12";
  for (const l of s.links) { const p = linkRowProblem(l, nowMs); if (p) return `a link: ${p}`; }
  if (!Array.isArray(s.virality) || s.virality.length > 12) return "virality must be a list of at most 12";
  for (const v of s.virality) { const p = viralityRowProblem(v, nowMs); if (p) return `a virality figure: ${p}`; }
  if (typeof s.checked !== "string" || !DAY.test(s.checked) || parseTime(s.checked) === null) return "checked must be YYYY-MM-DD";
  const d = disclaimerProblem(s.disclaimer);
  if (d) return `disclaimer: ${d}`;
  return null;
}

const CAT_FIELDS = ["ticker", "name", "pair", "story", "description", "look", "whyLook", "tribute", "portrait", "coat", "coatFrom", "proof"];

/* ── a planned cat's proof: the one post or page that best shows its link to the company ──

   { kind: "x" | "web", url, author, handle, date, dateType, text, note, image }
   An X proof is an https://x.com (or twitter.com) /<handle>/status/<id> post by `handle`, dated
   the day it was posted. A web proof is a page on a host the stock's research already records.
   `text` is quoted word for word from the post or page (it may be empty only for a picture-only
   post that has an image); `note` says plainly what the proof does and does not show. */
export const PROOF_FIELDS = Object.freeze(["kind", "url", "author", "handle", "date", "dateType", "text", "note", "image"]);
export const X_HOSTS = Object.freeze(["x.com", "twitter.com"]);
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const X_STATUS = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})$/;
const PROOF_DATE_TYPES = Object.freeze(["posted", "published", "updated", "opened"]);

/** Why a proof may not be shown, or null. `hosts` are the hosts the stock's research links to (for a web proof). */
export function proofProblem(p, { ticker, hosts = [], nowMs = Date.now() } = {}) {
  if (!isObject(p)) return "not an object";
  const extra = extraKeys(p, PROOF_FIELDS);
  if (extra.length) return `unknown field ${extra[0]}`;
  if (!["x", "web"].includes(p.kind)) return "kind must be x or web";
  const bad = httpsProblem(p.url);
  if (bad) return `url: ${bad}`;
  const u = new URL(p.url);
  if (u.search || u.hash) return "url must have no query or fragment";
  if (p.kind === "x") {
    if (!X_HOSTS.includes(u.hostname)) return "an X proof must be on x.com or twitter.com";
    const m = X_STATUS.exec(u.pathname);
    if (!m) return "an X proof must be a /<handle>/status/<id> post";
    if (typeof p.handle !== "string" || !HANDLE.test(p.handle)) return "handle must be an X handle without @";
    if (m[1].toLowerCase() !== p.handle.toLowerCase()) return "the post's URL is not by its handle";
    if (p.dateType !== "posted") return "an X proof's dateType must be posted";
  } else {
    if (X_HOSTS.includes(u.hostname)) return "a proof on X must have kind x";
    if (p.handle !== null) return "a web proof has no handle (null)";
    if (!hosts.includes(u.hostname)) return `a web proof must be on a host the research records (${u.hostname} is not)`;
    if (!PROOF_DATE_TYPES.includes(p.dateType) || p.dateType === "posted") return "a web proof's dateType must be published, updated or opened";
  }
  const name = textProblem(p.author, { maxChars: 60 });
  if (name) return `author: ${name}`;
  if (typeof p.date !== "string" || !DAY.test(p.date)) return "date must be YYYY-MM-DD";
  const d = sourceDateProblem(p.date, nowMs);
  if (d) return `date: ${d}`;
  if (p.image !== null && p.image !== `assets/proof/${ticker}.webp`) return "image must be assets/proof/<TICKER>.webp or null";
  const text = proseProblem(p.text, { maxChars: 400, empty: true });
  if (text) return `text: ${text}`;
  if (!p.text && p.image === null) return "text may be empty only when the proof has an image";
  const note = proseProblem(p.note, { maxChars: 300, empty: true });
  if (note) return `note: ${note}`;
  return null;
}

/** The line a cat drawn to look like a company's cat must carry, word for word. */
export const TRIBUTE = /^Fan tribute to (.{2,80})'s cat\. Not affiliated with or endorsed by \1\.$/;
export const tributeLine = (company) => `Fan tribute to ${company}'s cat. Not affiliated with or endorsed by ${company}.`;

/** Why one planned cat may not be shown, or null. */
function plannedCatProblem(c) {
  if (!isObject(c)) return "not an object";
  const extra = extraKeys(c, CAT_FIELDS);
  if (extra.length) return `unknown field ${extra[0]}`;
  if (typeof c.ticker !== "string" || !TICKER.test(c.ticker)) return "ticker must be 2 to 10 capital letters or digits";
  const name = textProblem(c.name, { maxChars: 32 });
  if (name) return `name: ${name}`;
  const pair = pairProblem(c.pair);
  if (pair) return pair;
  for (const [k, max] of [["story", 600], ["description", 600], ["look", 1200]]) { const p = proseProblem(c[k], { maxChars: max }); if (p) return `${k}: ${p}`; }
  const why = proseProblem(c.whyLook, { maxChars: 800, empty: true });
  if (why) return `whyLook: ${why}`;
  if (c.tribute !== undefined && c.tribute !== null) {
    if (typeof c.tribute !== "string" || !TRIBUTE.test(c.tribute)) return "tribute must read \"Fan tribute to <Company>'s cat. Not affiliated with or endorsed by <Company>.\"";
    if (!String(c.description).includes(c.tribute)) return "description must carry the tribute line";
  }
  if (c.portrait !== null && c.portrait !== `assets/portraits/${c.ticker}.jpg`) return "portrait must be assets/portraits/<TICKER>.jpg or null";
  const coat = coatProblem(c.coat);
  if (coat) return `coat: ${coat}`;
  if (!["sheet", "look"].includes(c.coatFrom)) return "coatFrom must be sheet or look";
  if (c.proof !== undefined && c.proof !== null && !isObject(c.proof)) return "proof must be an object or null";
  return null;
}

/**
 * data/planned.json: { stocks: [stock], cats: [planned cat] }.
 *   stock        { pair: { symbol, mint }, stonkfun, category, company,
 *                  realCat: { name, who, basis, linkType, strength, linked },
 *                  links: [{ label, url, date, dateType, opened }],
 *                  virality: [{ label, value, source, date, dateType, method }],
 *                  checked, disclaimer }                      one per pair mint: sourced research
 *   planned cat  { ticker, name, pair: { symbol, mint }, story, description, look, whyLook, tribute: string | null,
 *                  portrait: "assets/portraits/<TICKER>.jpg" | null, coat, coatFrom: "sheet" | "look",
                  proof?: { kind, url, author, handle, date, dateType, text, note, image } | null (see proofProblem) }
 * Returns { stocks, cats, refused: [{ list, index, clause, detail }] }: clean copies of what
 * passed. A cat whose pair has no research row is refused (its card could not say who it is or
 * carry its disclaimer), and so is a second cat with the same ticker or the same pair.
 */
export function validatePlanned(data, { nowMs = Date.now() } = {}) {
  const refused = [];
  if (!isObject(data) || !Array.isArray(data.stocks) || !Array.isArray(data.cats) || extraKeys(data, ["stocks", "cats"]).length) {
    return { stocks: [], cats: [], refused: [{ list: null, index: null, clause: "shape", detail: "planned must be { stocks: [...], cats: [...] }" }] };
  }
  const stocks = [];
  data.stocks.forEach((s, index) => {
    const p = stockProblem(s, nowMs);
    if (p) return refused.push({ list: "stocks", index, clause: "stock", detail: p });
    if (stocks.some((x) => x.pair.mint === s.pair.mint)) return refused.push({ list: "stocks", index, clause: "duplicate", detail: "this pair has two research rows" });
    stocks.push({
      pair: { symbol: s.pair.symbol, mint: s.pair.mint }, stonkfun: s.stonkfun, category: s.category, company: s.company,
      realCat: { name: s.realCat.name, who: s.realCat.who, basis: s.realCat.basis, linkType: s.realCat.linkType, strength: s.realCat.strength, linked: s.realCat.linked },
      links: s.links.map((l) => ({ label: l.label, url: l.url, date: l.date, dateType: l.dateType, ...(l.opened !== undefined ? { opened: l.opened } : {}) })),
      virality: s.virality.map((v) => ({ label: v.label, value: v.value, source: v.source, date: v.date, dateType: v.dateType, method: v.method })),
      checked: s.checked, disclaimer: s.disclaimer,
    });
  });
  const cats = [];
  data.cats.forEach((c, index) => {
    const p = plannedCatProblem(c);
    if (p) return refused.push({ list: "cats", index, clause: "cat", detail: p });
    if (!stocks.some((s) => s.pair.mint === c.pair.mint)) return refused.push({ list: "cats", index, clause: "no_research", detail: "its stock has no research row" });
    if (cats.some((x) => x.ticker === c.ticker)) return refused.push({ list: "cats", index, clause: "duplicate", detail: "this ticker is planned twice" });
    if (cats.some((x) => x.pair.mint === c.pair.mint)) return refused.push({ list: "cats", index, clause: "duplicate", detail: "this pair already has a planned cat" });
    if (c.proof != null) {
      const stock = stocks.find((s) => s.pair.mint === c.pair.mint);
      const hosts = stock.links.map((l) => new URL(l.url).hostname);
      const pp = proofProblem(c.proof, { ticker: c.ticker, hosts, nowMs });
      if (pp) return refused.push({ list: "cats", index, clause: "proof", detail: `proof: ${pp}` });
    }
    cats.push({
      ticker: c.ticker, name: c.name, pair: { symbol: c.pair.symbol, mint: c.pair.mint }, story: c.story, description: c.description,
      look: c.look, whyLook: c.whyLook, tribute: c.tribute ?? null, portrait: c.portrait, coat: { base: c.coat.base, second: c.coat.second, pattern: c.coat.pattern, eyes: c.coat.eyes },
      coatFrom: c.coatFrom,
      proof: c.proof == null ? null : Object.fromEntries(PROOF_FIELDS.map((k) => [k, c.proof[k]])),
    });
  });
  return { stocks, cats, refused };
}

/* ── data/famous.json: the famous cat coins ─────────────────────────────────────────── */

/** The chains a famous coin may be on (DexScreener's chain ids): Solana only, by the owner's
    decision of 2026-09-26. (The rules below still know other chains' address forms and GMGN's
    names for Ethereum, Base and BNB Chain, should that change.) */
export const FAMOUS_CHAINS = Object.freeze(["solana"]);
export const GMGN_CHAINS = Object.freeze({ solana: "sol", ethereum: "eth", base: "base", bsc: "bsc" });
/** data/famous.json is the Hall of Fame only (the owner's decision of 2026-09-26): legendary cat
    coins that already exist, Solana, tier "main", each with a researched profile. The sanctuary
    itself is for adoptable cats with no coin yet; the coins taken out then are kept in
    scripts/archive/famous-removed.json. The meadow tiers (ring1, ring2) are no longer used. */
export const FAMOUS_TIERS = Object.freeze(["main"]);
/** Where a coin lived under the old rule (kept for the archive), from its market cap when it was placed and whether a company or project stands behind its cat. */
export const TIER_RULE = Object.freeze({ mainMcap: 1_000_000, ring1Mcap: 100_000, minMcap: 20_000 });
export const tierFor = (mcap, company) => (company || mcap >= TIER_RULE.mainMcap ? "main" : mcap >= TIER_RULE.ring1Mcap ? "ring1" : "ring2");

const EVM = /^0x[0-9a-fA-F]{40}$/;
const FAMOUS_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const HEX = /^#[0-9a-f]{6}$/;
const FAMOUS_FIELDS = ["id", "name", "symbol", "chain", "contract", "pair", "company", "tier", "logo", "market", "coingeckoId", "catName", "who", "lore", "loreSource", "viral", "links", "buy", "warnings", "coat", "ownerPick", "disclaimer"];
const EVM_CHAINS = new Set(["ethereum", "base", "bsc", "robinhood", "hyperevm", "arc", "ink", "avalanche", "arbitrum", "cronos", "beam", "polygon", "worldchain", "unichain", "abstract", "zksync"]);

/** Why `contract` is not a plausible token address on `chain`, or null. */
export function contractProblem(chain, contract) {
  if (typeof contract !== "string" || contract.length < 3 || contract.length > 140 || /\s/.test(contract)) return "not an address";
  if (chain === "solana") return isAddress(contract) ? null : "not a Solana mint";
  if (EVM_CHAINS.has(chain)) return EVM.test(contract) ? null : "not a 0x address";
  if (chain === "hyperliquid") return /^0x[0-9a-fA-F]{32}$/.test(contract) ? null : "not a Hyperliquid token id";
  return /^[A-Za-z0-9:._-]+$/.test(contract) ? null : "not an address";
}

/** The one page a famous coin may be bought from: GMGN for its contract, or its DexScreener page. */
export function famousBuyLink(chain, contract, pairUrl = null) {
  if (GMGN_CHAINS[chain]) return { label: "GMGN", url: `https://gmgn.ai/${GMGN_CHAINS[chain]}/token/${contract}` };
  if (typeof pairUrl === "string" && pairUrl.startsWith(`https://dexscreener.com/${chain}/`)) return { label: "DexScreener", url: pairUrl };
  return { label: "DexScreener", url: `https://dexscreener.com/${chain}/${encodeURIComponent(contract)}` };
}

/** Why a famous coin's buy link is not the one famousBuyLink allows, or null. */
function famousBuyProblem(c) {
  if (!isObject(c.buy) || extraKeys(c.buy, ["label", "url"]).length) return "buy must be { label, url }";
  if (GMGN_CHAINS[c.chain]) return c.buy.label === "GMGN" && c.buy.url === `https://gmgn.ai/${GMGN_CHAINS[c.chain]}/token/${c.contract}` ? null : "buy must be the GMGN page for its contract";
  if (c.buy.label !== "DexScreener") return "buy must be its DexScreener page";
  const h = httpsProblem(c.buy.url);
  if (h) return `buy: ${h}`;
  const u = new URL(c.buy.url);
  if (u.hostname !== "dexscreener.com" || !u.pathname.startsWith(`/${c.chain}/`) || u.search || u.hash) return "buy must be a dexscreener.com page on its chain";
  return null;
}

/** Why a famous coin's colour ("#rrggbb" or a coat word) may not be used, or null. */
const famousColourOk = (v, empty) => (empty && v === "") || HEX.test(v) || COAT_COLOURS.includes(v);

/** Why one famous coin may not be shown, or null. */
export function famousProblem(c, { nowMs = Date.now() } = {}) {
  if (!isObject(c)) return "not an object";
  const extra = extraKeys(c, FAMOUS_FIELDS);
  if (extra.length) return `unknown field ${extra[0]}`;
  if (typeof c.id !== "string" || !FAMOUS_ID.test(c.id)) return "id must be lowercase letters, digits and dashes";
  const name = textProblem(c.name, { maxChars: 48 });
  if (name) return `name: ${name}`;
  const sym = textProblem(c.symbol, { maxChars: 24 });
  if (sym) return `symbol: ${sym}`;
  if (!FAMOUS_CHAINS.includes(c.chain)) return "chain is not one the sanctuary knows";
  const ca = contractProblem(c.chain, c.contract);
  if (ca) return `contract: ${ca}`;
  if (!isObject(c.pair) || extraKeys(c.pair, ["quote", "address", "dex", "url"]).length) return "pair must be { quote, address, dex, url }";
  if (c.pair.quote !== null && textProblem(c.pair.quote, { maxChars: 24 })) return "pair quote is not a plain symbol";
  if (c.pair.dex !== null && !/^[a-z0-9-]{2,40}$/.test(c.pair.dex)) return "pair dex is not a DEX id";
  if (c.pair.url !== null && (httpsProblem(c.pair.url) || new URL(c.pair.url).hostname !== "dexscreener.com")) return "pair url must be a dexscreener.com page";
  if (c.pair.address !== null && (typeof c.pair.address !== "string" || !/^[A-Za-z0-9:._-]{3,140}$/.test(c.pair.address))) return "pair address is not an address";
  if (c.company !== null && proseProblem(c.company, { maxChars: 80 })) return "company must be a short name or null";
  if (!FAMOUS_TIERS.includes(c.tier)) return "tier must be main (the Hall of Fame)";
  if (c.logo !== null && c.logo !== `assets/coins/${c.id}.webp`) return "logo must be assets/coins/<id>.webp or null";
  const m = c.market;
  if (!isObject(m) || extraKeys(m, ["marketCapUsd", "liquidityUsd", "volume24hUsd", "measuredAt", "source"]).length) return "market must be { marketCapUsd, liquidityUsd, volume24hUsd, measuredAt, source }";
  for (const k of ["marketCapUsd", "liquidityUsd", "volume24hUsd"]) if (typeof m[k] !== "number" || !Number.isFinite(m[k]) || m[k] < 0 || m[k] > 1e13) return `market.${k} must be a number of dollars`;
  const at = parseTime(m.measuredAt, { dayAllowed: false });
  if (at === null) return "market.measuredAt must be YYYY-MM-DDTHH:MM:SSZ";
  if (at > nowMs + 3_600_000) return "market.measuredAt is in the future";
  if (!["coingecko", "dexscreener", "research"].includes(m.source)) return "market.source must be coingecko, dexscreener or research";
  if (c.coingeckoId !== null && (typeof c.coingeckoId !== "string" || !/^[a-z0-9-]{2,80}$/.test(c.coingeckoId))) return "coingeckoId must be a CoinGecko id or null";
  if (c.catName !== null && proseProblem(c.catName, { maxChars: 120 })) return "catName must be short prose or null";
  for (const [k, max, empty] of [["who", 900, true], ["lore", 1200, false]]) { const p = proseProblem(c[k], { maxChars: max, empty }); if (p) return `${k}: ${p}`; }
  const ls = c.loreSource;
  if (!isObject(ls) || extraKeys(ls, ["kind", "label", "url"]).length || !["profile", "coin", "listing"].includes(ls.kind)) return "loreSource must be { kind: profile | coin | listing, label, url }";
  if (ls.kind !== "profile") return "a Hall of Fame coin needs a researched profile (loreSource.kind profile)";
  if (proseProblem(ls.label, { maxChars: 80 })) return "loreSource.label must be short prose";
  if (ls.url !== null && httpsProblem(ls.url)) return "loreSource.url must be https or null";
  if (c.viral !== null) {
    if (!isObject(c.viral) || extraKeys(c.viral, ["summary", "url"]).length) return "viral must be { summary, url } or null";
    const v = proseProblem(c.viral.summary, { maxChars: 900 });
    if (v) return `viral.summary: ${v}`;
    if (c.viral.url !== null && httpsProblem(c.viral.url)) return "viral.url must be https or null";
  }
  if (!isObject(c.links) || extraKeys(c.links, ["x", "website"]).length) return "links must be { x, website }";
  if (c.links.x !== null && (httpsProblem(c.links.x) || !X_HOSTS.includes(new URL(c.links.x).hostname))) return "links.x must be an x.com or twitter.com page";
  if (c.links.website !== null && (httpsProblem(c.links.website) || tradeLinkProblem(c.links.website))) return "links.website must be an https site that is not a trading page";
  const buy = famousBuyProblem(c);
  if (buy) return buy;
  if (!Array.isArray(c.warnings) || c.warnings.length > 8) return "warnings must be a list of up to 8";
  for (const w of c.warnings) { const p = proseProblem(w, { maxChars: 220 }); if (p) return `warning: ${p}`; }
  const coat = c.coat;
  if (!isObject(coat) || extraKeys(coat, ["base", "second", "pattern", "eyes"]).length) return "coat must be { base, second, pattern, eyes }";
  if (!famousColourOk(coat.base, false) || !famousColourOk(coat.second, true) || !famousColourOk(coat.eyes, true)) return "coat colours must be #rrggbb or coat words";
  if (!COAT_PATTERNS.includes(coat.pattern)) return "coat pattern is not a known pattern";
  if (typeof c.ownerPick !== "boolean") return "ownerPick must be true or false";
  const d = proseProblem(c.disclaimer, { maxChars: 400 });
  if (d) return `disclaimer: ${d}`;
  if (!/not affiliated/i.test(c.disclaimer) || !/not financial advice/i.test(c.disclaimer)) return "disclaimer must say not affiliated and not financial advice";
  return null;
}

/**
 * data/famous.json: { note, refreshedAt, coins: [coin] } (see famousProblem for a coin's fields).
 * Returns { coins, refused: [{ index, clause, detail }] }: clean copies of what passed. A second
 * coin with the same id, or the same chain and contract, is refused.
 */
export function validateFamous(data, { nowMs = Date.now() } = {}) {
  if (!isObject(data) || !Array.isArray(data.coins) || extraKeys(data, ["note", "refreshedAt", "coins"]).length) {
    return { coins: [], refused: [{ index: null, clause: "shape", detail: "famous must be { note, refreshedAt, coins: [...] }" }] };
  }
  const refused = [], coins = [], ids = new Set(), keys = new Set();
  data.coins.forEach((c, index) => {
    const p = famousProblem(c, { nowMs });
    if (p) return refused.push({ index, clause: "coin", detail: `${isObject(c) ? c.id : index}: ${p}` });
    const key = `${c.chain}:${c.contract.toLowerCase()}`;
    if (ids.has(c.id) || keys.has(key)) return refused.push({ index, clause: "duplicate", detail: `${c.id}: listed twice` });
    ids.add(c.id); keys.add(key);
    coins.push(JSON.parse(JSON.stringify(c)));
  });
  return { coins, refused };
}

/** Warnings a famous coin's card shows from its market figures as last read (they change with
    every refresh, so they are worked out here, not stored). */
export function marketWarnings(market, { nowMs = Date.now() } = {}) {
  if (!isObject(market)) return [];
  const usd = (v) => `$${Math.round(v).toLocaleString("en-US")}`;
  const out = [];
  if (market.volume24hUsd < 1000) out.push(`Almost no trading: ${usd(market.volume24hUsd)} traded in 24 hours.`);
  else if (market.volume24hUsd < 10000) out.push(`Thin trading: ${usd(market.volume24hUsd)} traded in 24 hours.`);
  if (market.liquidityUsd < 10000) out.push(`Very little liquidity: ${usd(market.liquidityUsd)} in its pool, so even a small trade moves the price a lot.`);
  if (market.marketCapUsd < TIER_RULE.minMcap) out.push(`Its market cap (${usd(market.marketCapUsd)}) is below the sanctuary's ${usd(TIER_RULE.minMcap)} floor.`);
  const at = parseTime(market.measuredAt, { dayAllowed: false });
  if (at !== null && nowMs - at > 3 * 86_400_000) out.push(`These figures are ${Math.floor((nowMs - at) / 86_400_000)} days old.`);
  return out;
}
