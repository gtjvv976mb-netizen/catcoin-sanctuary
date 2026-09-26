const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in COINx. Not affiliated with Coinbase or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Harrumph the Pouty Cat", ticker: "HARRUMPH", blurb: "Harrumph, a fluffy grey long-haired cat with a flat face and a grumpy pout, glares at pigeons from the garden wall all morning, then climbs into a lap to purr." },
  { name: "Thistledown the Cloud Cat", ticker: "THISTLECAT", blurb: "Thistledown, a round puff of soft grey fur with a squashed little face and tufted ears, drifts between the lavender rows like a seed head on the breeze." },
  { name: "Bramble the Blep Cat", ticker: "BRAMBLECAT", blurb: "Bramble, a scruffy grey long-haired cat with a squashed face, blue-green eyes and the pink tip of his tongue always showing, naps under the blackberry canes." },
];
const stockTerms = { stock: ["COIN", "COINX", "COINx", "Coinbase", "Coinbase xStock", "Coinbase Global", "xStock", "xStocks", "Backed", "Mister Miggles", "Mr Miggles", "Miggles", "Miggle", "Wiggles", "Giggles", "MIGGLES", "Toshi", "Satoshi", "Mochi", "Brian Armstrong", "Armstrong", "Base", "Onchain", "Onchain Summer", "Keyboard Cat", "KEYCAT", "Begert", "Jack Begert", "Mister"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","TOSHI","MIGGLES","KEYCAT","COIN","COINX","BASE","MOCHI"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
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
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), results }, null, 1));
