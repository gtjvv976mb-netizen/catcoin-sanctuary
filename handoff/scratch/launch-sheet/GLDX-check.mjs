const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in GLDx. Not affiliated with SPDR Gold Trust, State Street, World Gold Council or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Ingot the Loaf Cat", ticker: "INGOTLOAF", blurb: "Ingot, a sleek honey-golden cat, tucks in her paws and loafs on the warm garden steps, shaped just like a little bar." },
  { name: "Nugget the Kitten", ticker: "NUGGETKIT", blurb: "Nugget, a tiny round golden-ginger kitten, naps in flower pots and pops out like a lucky find in a garden stream." },
  { name: "Karat the Gilded Tabby", ticker: "KARATTABBY", blurb: "Karat, a fluffy cream tabby with glittering golden-tipped fur, combs his long shining whiskers by the pond each dawn." },
];
const stockTerms = { stock: ["GLD", "GLDX", "GLDx", "GOLD", "Gold xStock", "SPDR", "SPDR Gold", "State Street", "World Gold", "World Gold Council", "World Gold Trust", "spider", "xStock", "Backed", "HSBC"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","NUGGET","INGOT","KARAT","GOLDCAT","GOLDEN"]);
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
