import { writeFileSync } from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const S = await import("/home/user/Cat-Intelligence-Agency/src/lib/stockcats.mjs");
const T = await import("/home/user/Cat-Intelligence-Agency/bots/cashcat/tickers.mjs");
const DISC = "A cat coin priced in AMZNx. Not affiliated with Amazon or StonkFun. No intrinsic value; not financial advice.";
const cands = [
 { name: "Sunmane the Garden Cat", ticker: "SUNMANE", description: "Sunmane, a sturdy tawny-gold cat with a fluffy ruff like a little mane, naps in the warmest patch of the garden and pads his rounds at dusk. A cat coin priced in AMZNx. Not affiliated with Amazon or StonkFun. No intrinsic value; not financial advice." },
 { name: "Honeyruff the House Cat", ticker: "HONEYRUFF", description: "Honeyruff, a round honey-coloured cat with a cream chin and a thick soft neck ruff, loafs on the sunny wall and blinks slowly at every passing bee. A cat coin priced in AMZNx. Not affiliated with Amazon or StonkFun. No intrinsic value; not financial advice." },
 { name: "Tuft the Toffee Cat", ticker: "TOFFEETUFT", description: "Tuft, a sandy toffee-coloured cat with a pale belly and a dark tip on her tail, flicks it like a feather to tease the moths in the long grass. A cat coin priced in AMZNx. Not affiliated with Amazon or StonkFun. No intrinsic value; not financial advice." },
];
// Jupiter verified list (full) for tickerFree
const vr = await fetch("https://lite-api.jup.ag/tokens/v2/tag?query=verified");
const vtxt = await vr.text(); writeFileSync("jup-verified-list.json", vtxt);
const vlist = JSON.parse(vtxt);
const idx = T.verifiedIndex(vlist);
const pair = S.STOCK_PAIRS.find(p => p.symbol === "AMZNx");
const notesRow = { mint: pair.mint, people: ["Jeff Bezos", "Andy Jassy", "Bezos", "Jassy"], mascots: ["Leo the Lion", "Leo", "Hello Kitty"],
  brands: ["Amazon MGM Studios", "MGM", "Metro-Goldwyn-Mayer", "Prime", "Prime Video", "Alexa", "Kindle", "Echo", "Kuiper", "Amazon Leo", "AmazonHelp", "Whiskas", "Amazon Kids", "Ember", "Smile", "Amazon Pay"],
  catFacts: [{ text: "Leo the Lion logo used by Amazon MGM Studios", source: "https://en.wikipedia.org/wiki/Leo_the_Lion_(MGM)", readAt: "2026-09-25" }], searchedAt: "2026-09-25", method: "checker simulation from notes/AMZNX.md" };
const out = { pair: { symbol: pair.symbol, root: pair.root, stonkfun: pair.stonkfun, stonkfunName: pair.stonkfunName, name: pair.name, mint: pair.mint }, verifiedListSize: idx.size, results: [] };
const alnum = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const memeTickers = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","MOG","MANEKI","SIMON","LION","LEO","ROAR","MANE"];
for (const c of cands) {
  const story = c.description.slice(0, c.description.length - DISC.length).trim();
  const r = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, descLen: c.description.length, storyLen: story.length,
    endsWithDisclosure: c.description.endsWith(DISC), tickerRegex: R.TICKER.test(c.ticker) };
  r.checkProposal_story = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: story });
  r.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.description });
  r.checkFields_disclosureOnly = R.checkFields({ description: DISC });
  r.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  const draft = S.stockDraft({ name: c.name, symbol: c.ticker, tagline: story }, pair);
  r.stockCatRefusals = S.stockCatRefusals(draft, pair, { notes: [notesRow], verifiedIndex: idx });
  r.pairTermsUsed = S.pairTerms(pair, [notesRow]);
  r.tickerFree = T.tickerFree(idx, { name: c.name, symbol: c.ticker });
  const roots = [pair.root, pair.symbol, pair.stonkfun].map(alnum);
  r.tickerStartsEndsWithRoot = roots.some(o => alnum(c.ticker).startsWith(o) || alnum(c.ticker).endsWith(o));
  r.tickerHoldsAnyRoot3 = S.STOCK_PAIRS.map(p => alnum(p.root)).filter(x => x.length >= 3).filter(x => alnum(c.ticker).includes(x));
  r.memeTickerHit = memeTickers.filter(m => alnum(c.ticker) === m);
  r.verifiedSymbolExact = idx.symbols.get(c.ticker) ?? null;
  // near-miss verified symbols containing ticker or vice versa
  r.verifiedNear = vlist.filter(t => { const s = alnum(t.symbol); return s.length >= 4 && (s.includes(c.ticker) || c.ticker.includes(s)); }).map(t => `${t.symbol}|${t.name}`).slice(0, 20);
  out.results.push(r);
}
writeFileSync("check.out.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
