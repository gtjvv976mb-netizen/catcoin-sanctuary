import fs from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/BRKX-verify";
const R = "/home/user/Cat-Intelligence-Agency";
const { checkProposal, checkFields, checkTerms, displaySafe, TICKER } = await import(`${R}/bots/lib/content-rules.mjs`);
const { stockCatRefusals, STOCK_PAIRS, stockDraft, pairTerms } = await import(`${R}/src/lib/stockcats.mjs`);
const { verifiedIndex } = await import(`${R}/bots/cashcat/tickers.mjs`);
const { copycatOf } = await import(`${R}/bots/popcat/established.mjs`);

const DISC = "A cat coin priced in BRK.Bx. Not affiliated with Berkshire Hathaway or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(fs.readFileSync(`${DIR}/candidates.json`, "utf8"));
const pair = STOCK_PAIRS.find((p) => p.symbol === "BRK.Bx");

// Verified list (whole), saved raw
let vlist = null;
try {
  const r = await fetch("https://lite-api.jup.ag/tokens/v2/tag?query=verified");
  vlist = await r.json();
  fs.writeFileSync(`${DIR}/jup-verified-list.json`, JSON.stringify(vlist));
} catch (e) { console.error("verified list", e.message); }
const vindex = vlist ? verifiedIndex(vlist) : null;

// A research row for BRK.Bx built from notes/BRKX.md, so the pair_term rule knows its people, mascots and brands
const notes = [{ mint: pair.mint,
  people: ["Warren Buffett", "Buffett", "Charlie Munger", "Munger", "Greg Abel", "Ajit Jain"],
  mascots: ["Cam the Cat", "Cam", "Jack the Black Cat", "Squishmallows", "Hello Kitty", "Garfield", "Gecko"],
  brands: ["Berkshire", "Hathaway", "GEICO", "Dairy Queen", "Blizzard", "See's", "See's Candies", "Duracell", "BNSF", "Jazwares", "Alleghany", "Fruit of the Loom", "Brooks", "Acme Brick", "Oracle of Omaha", "Omaha", "Super-Cat", "Snowball"],
  catFacts: [{ text: "x", source: "notes/BRKX.md", readAt: "2026-09-25" }], searchedAt: "2026-09-25", method: "checker re-run" }];

const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOCHI","MOG","CATWIF","MANEKI"]);
const out = [];
for (const c of coins) {
  const description = c.description;
  const body = description.endsWith(" " + DISC) ? description.slice(0, -(DISC.length + 1)) : null;
  const q = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`);
  const raw = await q.text();
  fs.writeFileSync(`${DIR}/jup-search-${c.ticker}.json`, raw);
  let arr = []; try { const j = JSON.parse(raw); arr = Array.isArray(j) ? j : (j.tokens || []); } catch {}
  const same = arr.filter((x) => String(x.symbol).toLowerCase() === c.ticker.toLowerCase());
  const draft = stockDraft({ name: c.name, symbol: c.ticker, tagline: body ?? "" }, pair);
  out.push({
    name: c.name, ticker: c.ticker,
    lengths: { name: c.name.length, ticker: c.ticker.length, description: description.length, body: body?.length ?? null },
    limitsOk: c.name.length <= 32 && c.ticker.length <= 10 && description.length <= 280,
    tickerFormat: TICKER.test(c.ticker), memeTicker: banned.has(c.ticker), copycatOf: copycatOf({ name: c.name, symbol: c.ticker }) ?? null,
    disclosureExactAtEnd: body !== null,
    checkProposal: checkProposal({ name: c.name, symbol: c.ticker, tagline: body }),
    displaySafe: displaySafe({ name: c.name, symbol: c.ticker }),
    checkFields_fullDescription: checkFields({ description }),
    checkFields_disclosureOnly: checkFields({ description: DISC }),
    stockCatRefusals_withBRKrow: stockCatRefusals(draft, pair, { notes, verifiedIndex: vindex }).map((r) => r.message),
    stockCatRefusals_shippedNotes: stockCatRefusals(draft, pair, { verifiedIndex: vindex }).map((r) => r.message),
    checkTerms_pair_fullDescMinusDisclosure: checkTerms({ name: c.name, symbol: c.ticker, description: body }, { pair_term: pairTerms(pair, notes) }),
    jupiterSearch: { status: q.status, results: arr.length, sameSymbol: same.length, sameSymbolVerified: same.filter((x) => x.isVerified).length,
      sameSymbolRows: same.slice(0, 5).map((x) => `${x.symbol}|${x.name}|${x.id}|isVerified=${x.isVerified}`) },
    verifiedIndexSize: vindex?.size ?? null,
    inVerifiedIndexSymbol: vindex ? vindex.symbols.has(c.ticker.toUpperCase()) : null,
  });
}
fs.writeFileSync(`${DIR}/check.out.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
