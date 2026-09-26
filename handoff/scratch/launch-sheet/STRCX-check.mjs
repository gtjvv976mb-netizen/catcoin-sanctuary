const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in STRCx. Not affiliated with Strategy Inc. or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Firstbowl the Cream Cat", ticker: "FIRSTBOWL", blurb: "Firstbowl, a chunky cream-and-white shorthair, is always first to the row of garden food bowls, sitting politely with her tail tucked round her paws." },
  { name: "Everloop the Sleepy Cat", ticker: "EVERLOOP", blurb: "Everloop, a round silver tabby, curls into a perfect ring with her nose tucked in her tail and naps in the garden as if the afternoon will never end." },
  { name: "Rung the Ladder Cat", ticker: "LADDERCAT", blurb: "Rung, a brown tabby with white socks, climbs the old garden ladder each month and tries a new rung, a bit higher or lower, until the view is just right." },
];
const stockTerms = { stock: ["STRC", "STRCX", "STRCx", "Strategy PP Variable xStock", "Strategy", "Strategy Inc", "MicroStrategy", "Micro Strategy", "xStock", "xStocks", "Backed",
  "Stretch", "Stretch your income", "Stretch Preferred", "Variable Rate Series A", "MSTR", "MSTRX", "STRK", "STRF", "STRD", "STRE", "Strike", "Strife", "Stride", "Stream",
  "Saylor", "Michael Saylor", "Phong Le", "Maxi", "honey badger", "badger", "Auto", "Hank", "PetsofMSTR", "bitcoin", "BTC", "sats", "satoshi", "orange pill", "laser eyes",
  "Bitcoin Infinity Day", "Share the Bounty", "piggy", "Uncle Sam", "dead cat bounce", "labrador"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","STRC","STRCX","STR","STRAT","STRETCH"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkFields_blurbOnly = R.checkFields({ description: c.blurb });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker);
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
  const j = await r.json();
  const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  out.jupStatus = r.status; out.jupResults = arr.length;
  out.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified }));
  out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  out.description = desc;
  results.push(out);
}
console.log(JSON.stringify(results, null, 1));
