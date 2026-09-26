const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in KOx. Not affiliated with The Coca-Cola Company or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(process.argv[2]);
const stockTerms = { stock: ["KO", "KOX", "KOx", "Coca-Cola", "Coca Cola", "Coca", "Cola", "Coke", "Diet Coke", "Diet", "xStock", "xStocks", "Backed",
  "Sprite", "Fanta", "Dasani", "Minute Maid", "Powerade", "Smartwater", "Vitaminwater", "Fresca", "Tab", "Barqs", "Barq's", "Fairlife", "Topo Chico", "Costa",
  "Simply", "Gold Peak", "Honest", "Innocent", "BodyArmor", "Schweppes", "Qoo", "Georgia", "Kochakaden", "Fuze", "Aquarius", "Ciel", "Mello Yello", "Pibb", "Surge", "Thums Up", "Limca", "Maaza",
  "Get A Taste", "Open Happiness", "Happiness", "Taste the Feeling", "Real Magic", "Real Thing", "Holidays Are Coming", "polar bear", "Santa", "Dynamic Ribbon", "Contour",
  "Taylor", "Swift", "Taylor Swift", "Olivia", "Benson", "Olivia Benson", "Meredith", "Meredith Grey", "Benjamin Button", "Button", "1989", "Scottish Fold", "Hargitay",
  "Quincey", "James Quincey", "Braun", "Henrique Braun", "McMillin", "Pemberton", "Candler", "Simba", "Hello Kitty", "Sanrio", "Kuromi", "Fisher Cats"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","KITTENS","TABBY","KO","KOX","COLA","COKE","FIZZ"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length, discLen: DISC.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkFields_disclosureOnly = R.checkFields({ description: DISC });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker) || c.ticker.startsWith("KO");
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, mcap: Math.round(t.mcap || 0), id: t.id }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
console.log(JSON.stringify(results, null, 1));
