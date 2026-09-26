import fs from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in COPX. Not affiliated with Global X, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet-2/COPX-coins.json", "utf8"));
const stockTerms = { stock: ["COPX","COP","Copper","Copper Miners","Miners","Mining","Global X","GlobalX","Global X ETFs","Global X Copper Miners ETF","Global X Management","Mirae","Mirae Asset","TIGER","Tiger ETF","Smart Tiger","Ryan O'Connor","O'Connor","Luis Berruga","Berruga","Park Hyeon-joo","Hyeon-joo","Solactive","Beyond Ordinary","Backpack","Backpack Securities","Sunrise","Wormhole","Freeport","McMoRan","Southern Copper","Teck","Antofagasta","Glencore","BHP","Ivanhoe","First Quantum","Lundin","Zijin","Boliden","KGHM","Hudbay","Codelco","NYSE Arca"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","MOG","MANEKI","HOBBES","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","WIF","BONK","SC","CATI","MOTHER","BOOK","KEYCAT","PUSS","BOPCAT","TABBY","CATCOIN","KITTEN","TIGER","GINGER"]);
const out = { disclosureOnly: R.checkFields({ description: DISC }), results: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const r = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerRegex: R.TICKER.test(c.ticker), hasStockRoot: /COP/.test(c.ticker), catMeme: MEME.has(c.ticker),
    endsWithDisclosure: desc.endsWith("No intrinsic value; not financial advice."),
    checkProposal: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb }),
    checkFields_blurb: R.checkFields({ name: c.name, symbol: c.ticker, blurb: c.blurb }),
    checkFields_fullDescription: R.checkFields({ description: desc }),
    checkProposal_fullDescriptionAsTagline: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc }),
    checkTerms_stock: R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, stockTerms),
    displaySafe: R.displaySafe({ name: c.name, symbol: c.ticker }), description: desc };
  for (const q of [c.ticker, c.ticker.replace(/PAW$/, ""), c.name.split(" ")[0]]) {
    try {
      const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
      const j = await res.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
      r[`jup_${q}`] = { status: res.status, results: arr.length,
        exactTickerMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })),
        queryMatches: arr.filter(t => String(t.symbol).toUpperCase() === q.toUpperCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })),
        verifiedSymbols: arr.filter(t => t.isVerified).map(t => t.symbol) };
    } catch (e) { r[`jup_${q}`] = { error: String(e) }; }
  }
  out.results.push(r);
}
console.log(JSON.stringify(out, null, 1));
