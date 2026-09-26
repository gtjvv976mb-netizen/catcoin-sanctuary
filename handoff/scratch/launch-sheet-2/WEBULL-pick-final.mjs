import fs from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in WEBULL. Not affiliated with Webull Corporation, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const pairs = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/stockcats/stonkfun-pairs.json","utf8")).data.pairs;
const pairSymbols = new Set(pairs.map(p => String(p.symbol).toUpperCase()));
const stockTerms = { stock: ["WEBULL","Webull","Webull Corporation","Webull Financial","Webull Pay","BULL","BULLW","BULLZ","bull","bulls","Wang Anquan","Anquan","Anthony Denier","Denier","Hunan Fumi","Fumi","Weibu","Xiaomi","SK Growth","SKGR","Tampa Bay Rays","Rays","Rowdies","DJ Kitty","Kitty","Hello Kitty","Raymond","Roaring Kitty","Roaring","Keith Gill","Gill","Tropicana","Brooklyn Nets","Nets","New York Liberty","Fast Lane","Backpack","Backpack Securities","Sunrise","Wormhole","Robinhood","Red Cat","CAT fee","St. Petersburg","Petersburg","Tampa","Webull Karate","investing cat","investing_cat","Stock For Life","orange cat"] };
const catMeme = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","ROAR","ROARING","HODL","TUXEDO","SMOKEY","MANEKINEKO","MIAO","SC","GME","KEYCAT","MUMU","NYANCAT","CHEESE","MOCHI","LUCE","ZEUS","SMOL","PWEASE","SIGMA","GIGA"]);
const out = { disclosureOnly: R.checkFields({ description: DISC }), results: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const r = { name: c.name, ticker: c.ticker, nameLen: c.name.length, descLen: desc.length, endsWithDisclosure: desc.endsWith(DISC),
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /BULL|WEB/.test(c.ticker), tickerIsPairSymbol: pairSymbols.has(c.ticker), catMemeTicker: catMeme.has(c.ticker) };
  r.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  r.checkFields_fullDescription = R.checkFields({ description: desc });
  r.checkFields_look = R.checkFields({ look: c.look ?? "" });
  r.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, description: desc.replace(DISC, ""), look: c.look ?? "" }, stockTerms);
  r.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  for (const q of [c.ticker, c.ticker.toLowerCase()]) {
    try {
      const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
      const j = await res.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
      const m = arr.filter(t => String(t.symbol).toUpperCase() === c.ticker);
      (r.jup ??= []).push({ query: q, status: res.status, results: arr.length, symbolMatches: m.map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })), verifiedSymbolMatch: m.some(t => t.isVerified === true), topSymbols: arr.slice(0,8).map(t=>t.symbol) });
    } catch (e) { (r.jup ??= []).push({ query: q, error: String(e) }); }
  }
  r.description = desc;
  out.results.push(r);
}
console.log(JSON.stringify(out, null, 1));
