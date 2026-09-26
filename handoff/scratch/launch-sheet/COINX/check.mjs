import { readFileSync, writeFileSync } from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/COINX";
const R = "/home/user/Cat-Intelligence-Agency";
const { checkProposal, checkFields, checkTerms, TICKER } = await import(R + "/bots/lib/content-rules.mjs");
const { verifiedIndex, tickerFree } = await import(R + "/bots/cashcat/tickers.mjs");
const { copycatOf } = await import(R + "/bots/popcat/established.mjs");
const { stockCatRefusals, STOCK_PAIRS, pairTerms } = await import(R + "/src/lib/stockcats.mjs");
const cands = JSON.parse(readFileSync(process.argv[2] ?? DIR + "/candidates.json", "utf8"));
const DISC = "A cat coin priced in COINx. Not affiliated with Coinbase or StonkFun. No intrinsic value; not financial advice.";
const STOCK_TERMS = ["COIN", "COINx", "COINX", "Coinbase", "Coinbase xStock", "xStock", "Backed", "Mister Miggles", "Miggles", "Mr Miggles", "Miggs", "Toshi", "Satoshi", "Mochi", "Brian Armstrong", "Armstrong", "Base", "Onchain", "Keyboard Cat", "KEYCAT", "Jack Begert"];
let verified = null, vIdx = null;
try {
  const r = await fetch("https://lite-api.jup.ag/tokens/v2/tag?query=verified");
  verified = await r.json(); vIdx = verifiedIndex(verified);
  writeFileSync(DIR + "/jup-verified-count.json", JSON.stringify({ status: r.status, count: verified.length, fetchedAt: new Date().toISOString() }));
} catch (e) { console.log("verified list error", e.message); }
const pair = STOCK_PAIRS.find((p) => p.symbol === "COINx");
const notes = [{ mint: pair.mint, people: ["Brian Armstrong"], mascots: ["Mister Miggles", "Mr. Miggles", "Toshi", "Mochi", "Keyboard Cat"], brands: ["Coinbase", "Base", "Coinbase Wallet"], catFacts: [{ text: "Coinbase campaign cat", source: "https://x.com/coinbase/status/1813651794930925634", readAt: "2026-09-25" }], searchedAt: "2026-09-25", method: "web + X syndication" }];
const out = [];
for (const c of cands) {
  const tagline = c.description.endsWith(" " + DISC) ? c.description.slice(0, -DISC.length - 1) : null;
  const q = await fetch("https://lite-api.jup.ag/tokens/v2/search?query=" + encodeURIComponent(c.ticker));
  const raw = await q.text();
  writeFileSync(`${DIR}/jup-search-${c.ticker}.json`, raw);
  let arr = []; try { arr = JSON.parse(raw); } catch {}
  const exact = arr.filter((t) => String(t.symbol).toUpperCase() === c.ticker.toUpperCase());
  const res = {
    ticker: c.ticker,
    lengths: { name: c.name.length, ticker: c.ticker.length, description: c.description.length, tagline: tagline?.length },
    tickerFormat: TICKER.test(c.ticker),
    disclosureVerbatimAtEnd: !!tagline,
    checkProposal: checkProposal({ name: c.name, symbol: c.ticker, tagline }),
    checkFieldsFullDescription: checkFields({ description: c.description }),
    checkFieldsDisclosureOnly: checkFields({ description: DISC }),
    checkTermsStockWords: checkTerms({ name: c.name, symbol: c.ticker, tagline, description: tagline }, { pair_term: STOCK_TERMS }),
    tickerContainsCOIN: /COIN/.test(c.ticker),
    jupiterSearch: { status: q.status, results: arr.length, exactSymbol: exact.map((t) => ({ symbol: t.symbol, name: t.name, id: t.id, isVerified: t.isVerified, tags: t.tags })), verifiedExact: exact.filter((t) => t.isVerified).length },
    tickerFree: tickerFree(vIdx, { name: c.name, symbol: c.ticker }),
    copycatOf: copycatOf({ name: c.name, symbol: c.ticker }) ?? null,
    stockCatRefusals: stockCatRefusals({ name: c.name, symbol: c.ticker, tagline, kitten: "greytabby", background: Object.keys((await import(R + "/bots/cashcat/logo-layout.mjs")).BACKGROUNDS)[0], pairMint: pair.mint }, pair, { notes, verifiedIndex: vIdx }),
  };
  out.push(res);
}
writeFileSync(DIR + "/check-results.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
