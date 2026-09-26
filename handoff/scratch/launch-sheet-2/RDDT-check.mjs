const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in RDDT. Not affiliated with Reddit, Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["Reddit", "Reddit Inc", "RDDT", "RDDTx", "Snoo", "Snoos", "orangered", "upvote", "upvotes", "downvote", "karma", "subreddit", "redditor", "redditors", "AMA", "Ask Me Anything", "front page", "Steve Huffman", "Huffman", "spez", "Alexis Ohanian", "Ohanian", "Aaron Swartz", "Swartz", "Cool Cats", "Cool Cat", "Aku", "Micah Johnson", "Bread Cat", "Grumpy Cat", "Tardar Sauce", "OIIA", "OIIAI", "Oo Ee A E A", "Spinning Cat", "Ethel", "Roaring Kitty", "Keith Gill", "wallstreetbets", "r/aww", "r/cats", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Dubsmash", "Condé Nast", "Advance"] };
const banned = new Set(["OIIA","OIIAI","OIACAT","OIIACAT","SPINCAT","SPINNING","ETHEL","SNOO","RDDT","KARMA","UPVOTE","COOLCAT","COOL","BREADCAT","POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","ROAR","ROARING","AMC","APE","HODL"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasStockRoot: /RDDT|REDDIT|REDD|SNOO/.test(c.ticker) };
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
