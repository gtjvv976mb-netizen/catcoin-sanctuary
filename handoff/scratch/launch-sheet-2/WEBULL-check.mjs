const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in WEBULL. Not affiliated with Webull Corporation, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["WEBULL", "Webull", "Webull Corporation", "Webull Financial", "Webull Pay", "BULL", "BULLW", "BULLZ", "bull", "bulls",
  "Wang Anquan", "Anquan", "Anthony Denier", "Denier", "Hunan Fumi", "Fumi", "Weibu", "Xiaomi", "SK Growth", "SKGR",
  "Tampa Bay Rays", "Rays", "Rowdies", "DJ Kitty", "Kitty", "Hello Kitty", "Raymond", "Roaring Kitty", "Roaring", "Keith Gill", "Gill",
  "Tropicana", "Brooklyn Nets", "Nets", "New York Liberty", "Fast Lane", "Backpack", "Backpack Securities", "Sunrise", "Wormhole",
  "Robinhood", "Red Cat", "CAT fee", "St. Petersburg", "Petersburg", "Tampa"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","ROAR","ROARING","BULL","WEBULL","HODL","TUXEDO","SMOKEY"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasBullRoot: /BULL|WEB/.test(c.ticker) };
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
