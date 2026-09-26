import fs from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet";
const { checkProposal, checkFields, checkTerms, displaySafe, TICKER } = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in VIDAx. Not affiliated with Vida Global or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(fs.readFileSync(DIR + "/VIDAX-candidates.json", "utf8"));
const EXISTING_CAT = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","MOG","SMOG","MANEKI","WIF","CWIF","NUB","MIGGLES","SC","KITTEN","PUSS","PURR","MEOW","NEKO","TOSHI","CHEESE"];
const stockTerms = { stock: ["VIDA", "VIDAx", "VIDAX", "Vida", "Vida Global", "Vida Global xStock", "Vida AI", "Vida AI Agent OS", "vida.io", "Agent OS", "Alice", "Lyle Pratt", "Pratt", "Brandon Robinson", "Noah Hayes", "Mark Lilien", "Lilien", "Jordan Gadapee", "Gadapee", "Backed", "xStock", "CTO"] };
let verifiedIdx = null;
try {
  const vr = await fetch("https://lite-api.jup.ag/tokens/v2/tag?query=verified");
  const vl = await vr.json();
  fs.writeFileSync(DIR + "/VIDAX-jup-verified-list-size.txt", String(vl.length));
  const { verifiedIndex } = await import("/home/user/Cat-Intelligence-Agency/bots/cashcat/tickers.mjs");
  verifiedIdx = verifiedIndex(vl);
} catch (e) { console.error("verified list error", e.message); }
let sc = null;
try { sc = await import("/home/user/Cat-Intelligence-Agency/src/lib/stockcats.mjs"); } catch (e) { console.error("stockcats import error", e.message); }
const out = [];
for (const c of coins) {
  const idx = c.description.indexOf(DISC);
  const body = idx >= 0 ? c.description.slice(0, idx).trim() : c.description;
  const raw = await (await fetch("https://lite-api.jup.ag/tokens/v2/search?query=" + encodeURIComponent(c.ticker))).json();
  fs.writeFileSync(`${DIR}/VIDAX-jup-${c.ticker}.json`, JSON.stringify(raw, null, 2));
  const arr = Array.isArray(raw) ? raw : [];
  const symMatch = arr.filter((t) => String(t.symbol).toUpperCase() === c.ticker.toUpperCase());
  let stockCat = null;
  if (sc) {
    const pair = sc.STOCK_PAIRS.find((p) => p.symbol === "VIDAx");
    const draft = sc.stockDraft({ name: c.name, symbol: c.ticker, tagline: body }, pair);
    stockCat = sc.stockCatRefusals(draft, pair, { verifiedIndex: verifiedIdx });
  }
  const r = {
    name: c.name, ticker: c.ticker,
    lengths: { name: c.name.length, ticker: c.ticker.length, description: c.description.length, body: body.length },
    tickerFormat: TICKER.test(c.ticker),
    disclosureExactAtEnd: c.description.endsWith(DISC),
    jupiter: { results: arr.length, symbolMatches: symMatch.map((t) => ({ symbol: t.symbol, name: t.name, id: t.id, isVerified: t.isVerified })), verifiedSymbolMatch: symMatch.some((t) => t.isVerified === true), resultSymbols: arr.map((t) => `${t.symbol}${t.isVerified ? "(verified)" : ""}`) },
    verifiedIndexSymbolHit: verifiedIdx ? verifiedIdx.symbols.get(c.ticker.toUpperCase()) ?? null : "index-unavailable",
    existingCatTicker: EXISTING_CAT.includes(c.ticker.toUpperCase()),
    containsVIDA: /VIDA/i.test(c.ticker),
    checkProposal: checkProposal({ name: c.name, symbol: c.ticker, tagline: body }),
    displaySafe: displaySafe({ name: c.name, symbol: c.ticker }),
    checkFieldsFullDescription: checkFields({ description: c.description }),
    checkFieldsLook: checkFields({ look: c.look }),
    checkTermsStock: checkTerms({ name: c.name, symbol: c.ticker, description: body, look: c.look }, stockTerms),
    stockCatRefusals: stockCat,
  };
  out.push(r);
  console.log(JSON.stringify(r, null, 1));
}
fs.writeFileSync(DIR + "/VIDAX-check.out.json", JSON.stringify(out, null, 2));
