import { writeFileSync } from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const S = await import("/home/user/Cat-Intelligence-Agency/src/lib/stockcats.mjs");
const T = await import("/home/user/Cat-Intelligence-Agency/bots/cashcat/tickers.mjs");
const DISC = "A cat coin priced in SPCXx. Not affiliated with SpaceX or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(process.argv[2]);
const pair = S.STOCK_PAIRS.find((p) => p.symbol === "SPCXx");
// A local research row for SPCXx (the repo's STOCK_CAT_NOTES ships empty); names from notes/SPCXX.md.
const row = { mint: pair.mint, searchedAt: "2026-09-25", method: "notes/SPCXX.md cat research pass",
  people: ["Elon Musk", "Musk", "Elon", "Gwynne Shotwell", "Shotwell", "Aaron Taylor", "Schrodinger", "Schrödinger", "Marvin", "Gatsby"],
  mascots: ["Cat 5", "Cat5", "Dishy McFlatface", "Dishy", "Starman", "Aurora", "Kitten Woof"],
  brands: ["SpaceX", "Space Exploration Technologies", "Starlink", "Starshield", "Falcon", "Falcon 9", "Falcon Heavy", "Dragon", "Crew Dragon", "Starship", "Super Heavy", "Starbase", "Raptor", "Merlin", "xAI", "Grok", "Grok Imagine", "X"],
  catFacts: [] };
const notes = [row];
const stockTerms = { stock: [...new Set([...S.pairTerms(pair, notes), "SPCX", "SPCXx", "SPCXX", "xStock", "xStocks", "Backed", "Nasdaq", "Kraken", "Tippen", "Tippen22", "STOW", "dislodge", "Elonmusk", "Mars", "Martian", "rocket", "orbit", "satellite", "launchpad", "Hawthorne", "Boca Chica", "Tesla"])] };
let vlist = null, vidx = null;
try {
  const r = await fetch("https://lite-api.jup.ag/tokens/v2/tag?query=verified");
  vlist = await r.json(); vidx = T.verifiedIndex(vlist);
  writeFileSync(`${DIR}/SPCXX-checker-jup-verified-size.json`, JSON.stringify({ status: r.status, size: vidx.size }));
} catch (e) { console.error("verified list:", e); }
const memeBanned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","TUXEDO","SNOWCAT","LOAF","FLUFFY","MUFFIN"]);
const out = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length,
    endsWithDisclosure: desc.endsWith(DISC) };
  o.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescAsTagline = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_fullDescription = R.checkFields({ description: desc });
  o.checkFields_disclosureOnly = R.checkFields({ description: DISC });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  o.checkTerms_stock_look = R.checkTerms({ look: c.look ?? "" }, stockTerms);
  o.stockCatRefusals = S.stockCatRefusals(S.stockDraft({ name: c.name, symbol: c.ticker, tagline: c.blurb }, pair), pair, { notes, verifiedIndex: vidx });
  o.tickerRegex = R.TICKER.test(c.ticker);
  o.memeBanned = memeBanned.has(c.ticker);
  o.confusableWithRoot = /SPC|SPX|SPACE/i.test(c.ticker);
  o.inVerifiedIndex = vidx ? (vidx.symbols.get(c.ticker) ?? null) : "unavailable";
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const txt = await r.text();
    writeFileSync(`${DIR}/SPCXX-checker-jup-${c.ticker}.json`, txt);
    const j = JSON.parse(txt); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jupStatus = r.status; o.jupResults = arr.length;
    o.jupAll = arr.map((t) => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified }));
    o.jupSymbolMatches = arr.filter((t) => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map((t) => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    o.jupVerifiedCollision = o.jupSymbolMatches.some((t) => t.isVerified === true);
  } catch (e) { o.jupError = String(e); }
  o.description = desc;
  out.push(o);
}
console.log(JSON.stringify(out, null, 1));
