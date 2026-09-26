const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in USO. Not affiliated with United States Oil Fund, LP, USCF, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["USO", "US", "United States Oil Fund", "United Sates Oil Fund", "United States", "United", "States", "Sates", "Oil", "Oil Fund", "Fund", "LP",
  "USCF", "USCF Investments", "United States Commodity Funds", "Commodity", "Marygold", "Marygold Companies", "John Love", "Nicholas Gerber", "Gerber", "Stuart Crumbaugh", "Crumbaugh",
  "Invest In What's Real", "Real Spiel", "The Original Oil ETF", "ETF", "Crude", "Light Sweet", "Sweet Crude", "WTI", "Brent", "Cushing", "Oklahoma", "NYMEX", "ICE", "Futures", "Barrel", "Petroleum", "Petro", "Oilfield", "Oiler", "Slick", "Gusher", "Pipeline", "Refinery", "Derrick", "Wildcat", "Texas Tea", "Black Gold",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Caterpillar", "United Service Organizations", "Hello Kitty", "Garfield"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","USO","OIL","CRUDE","BARREL","WTI","BLACKCAT","BLACKGOLD","WILDCAT","INK","SOOT","ONYX","JET"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasRoot: /^US/.test(c.ticker) || c.ticker.includes("USO") || c.ticker.includes("OIL") };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.memeBanned = banned.has(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), results }, null, 1));
