const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in MRNA. Not affiliated with Moderna, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(process.argv[2]);
const stockTerms = { stock: ["MRNA", "MRNAx", "RNA", "mRNA", "Moderna", "Moderna Inc", "ModernaTX", "Moderna Therapeutics", "Spikevax", "Spike", "vax", "mNEXSPIKE", "mRESVIA", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Bancel", "Stephane Bancel", "Afeyan", "Noubar Afeyan", "Rossi", "Derrick Rossi", "Springer", "Chien", "Langer", "Robert Langer", "Flagship", "Cambridge", "vaccine"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MRNA","MRNAX","MODERNA","KEYCAT","MOG","MANEKI","HOBBES","WIF","BONK","SC","CATWIF","PURR","MEOW","SIMON","NUB","MOCHI","TOSHI"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasRootOrMod: /MRNA|RNA|MOD/.test(c.ticker) };
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
