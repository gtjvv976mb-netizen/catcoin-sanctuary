const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in NIKE. Not affiliated with NIKE, Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["NIKE", "NKE", "NKEx", "Nike Inc", "Jordan", "Michael Jordan", "Air Jordan", "Jumpman", "Jordan Brand", "Black Cat", "Hello Kitty", "Kitty", "Sanrio",
  "Frank", "Frank the Tiger", "Tiger", "Tiger Woods", "Woods", "Onitsuka", "Onitsuka Tiger", "Blue Ribbon", "Blue Ribbon Sports", "Phil Knight", "Knight", "Elliott Hill", "Bowerman",
  "Swoosh", "Just Do It", "Air", "Presto", "Air Presto", "Dunk", "Air Force", "Cortez", "Waffle", "Victory", "Bulls", "Chicago", "Converse", "SNKRS", "Jordan 4", "Wieden", "Kennedy",
  "Giamatti", "Spicer", "Daphne", "Beaverton", "Oregon", "Panther", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Flyknit", "Zoom", "Vaporfly", "Air Max"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","NIKE","NKE","NKEX","JUMP","SWOOSH","TIGER","BLACKCAT"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasRoot: /NIKE|NKE/.test(c.ticker) };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
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
