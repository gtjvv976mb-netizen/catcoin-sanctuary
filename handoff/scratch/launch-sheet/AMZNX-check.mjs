const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in AMZNx. Not affiliated with Amazon or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Sunmane the Garden Cat", ticker: "SUNMANE", blurb: "Sunmane, a sturdy tawny-gold cat with a fluffy ruff like a little mane, naps in the warmest patch of the garden and pads his rounds at dusk." },
  { name: "Honeyruff the House Cat", ticker: "HONEYRUFF", blurb: "Honeyruff, a round honey-coloured cat with a cream chin and a thick soft neck ruff, loafs on the sunny wall and blinks slowly at every passing bee." },
  { name: "Tuft the Toffee Cat", ticker: "TOFFEETUFT", blurb: "Tuft, a sandy toffee-coloured cat with a pale belly and a dark tip on her tail, flicks it like a feather to tease the moths in the long grass." },
];
const stockTerms = { stock: ["AMZN", "AMZNX", "AMZNx", "Amazon", "Amazon xStock", "xStock", "xStocks", "Backed", "MGM", "Metro-Goldwyn-Mayer", "Leo", "Leo the Lion", "Amazon MGM Studios", "Prime", "Prime Video", "Alexa", "Kindle", "Echo", "Bezos", "Jassy", "Hello Kitty", "Whiskas", "Ember", "Kuiper", "AmazonHelp", "Amazon Leo", "roar", "Smile"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","LION","LEO","ROAR","MANE","GOLDEN"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkFields_disclosureOnly = R.checkFields({ description: DISC });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
console.log(JSON.stringify(results, null, 1));
