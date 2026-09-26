const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in MU. Not affiliated with Micron Technology, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["MU", "MUx", "Micron", "Micron Technology", "Crucial", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Sanjay", "Mehrotra", "Sanjay Mehrotra", "Lexar", "Boise", "Scoobi", "Dell"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","KEYCAT","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SC","GME","SIGMA","MUMU","CHILLCAT","CATI","PUSS","NUB","MANEKI","TOSHI","BOOP","ZACK","WIFMAS","LOCKIN"]);
const coins = [
  { name: "Memo the Pastel Calico", ticker: "MEMOPAW", blurb: "Memo, a plush white cat with a blue-grey cap over her ears and a peach dab on her brow, sits by the shed window and never forgets a face." },
  { name: "Wafer the Silver Cat", ticker: "WAFERPAW", blurb: "Wafer, a sleek silver-white cat whose coat throws a faint rainbow shimmer in the sun, sits still as glass on the round stone by the pond." },
  { name: "Stacker the Charcoal Cat", ticker: "BOXSTACK", blurb: "Stacker, a charcoal-grey cat with gold eyes, naps atop a tower of stacked boxes in the sanctuary shed and knows which one hides his mouse." },
  { name: "Recall the Grid Tabby", ticker: "RECALLCAT", blurb: "Recall, a grey mackerel tabby with ruler-straight stripes and green eyes, remembers where every garden treat is tucked and every kind face." },
];
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: /^[A-Z0-9]{2,10}$/.test(c.ticker), tickerHasMUroot: /MU|MICRON/.test(c.ticker), memeClash: MEME.has(c.ticker),
    endsWithDisclaimer: desc.endsWith(DISC) };
  out.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkFields_description = R.checkFields({ description: desc });
  out.checkTerms_stock_blurb = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    out.jupVerifiedSymbolMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
console.log(JSON.stringify({ disclaimerAlone: R.checkFields({ description: DISC }), results }, null, 1));
