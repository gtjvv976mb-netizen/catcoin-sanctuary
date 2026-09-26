const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in SPCXx. Not affiliated with SpaceX or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Snowloaf the Tabby Cat", ticker: "SNOWLOAF", blurb: "Snowloaf, a fluffy brown tabby with dark stripes and gold eyes, folds into a tight loaf on a warm round dish in the snow and naps there till spring." },
  { name: "Warmspot the Tuxedo Cat", ticker: "WARMSPOT", blurb: "Warmspot, a black-and-white tuxedo cat with a white stripe down her nose and a white chin, always finds the one warm spot in a snowy garden, and keeps it." },
  { name: "Muffler the Fluffy Cat", ticker: "MUFFLER", blurb: "Muffler, a long-haired black cat with a thick white ruff and a white muzzle, curls up with friends on a warm dish in the snow, snug as a winter scarf." },
  { name: "Frostwatch the Lookout Cat", ticker: "FROSTWATCH", blurb: "Frostwatch, a dark tabby with a white blaze, a white bib and green-gold eyes, sits up tall on the warm dish while the others nap, keeping watch on the snow." },
  { name: "Huddle the Tuxedo Cat", ticker: "HUDDLE", blurb: "x".repeat(20) },
  { name: "Toastloaf the Tabby Cat", ticker: "TOASTLOAF", blurb: "x".repeat(20) },
];
const stockTerms = { stock: ["SPCX", "SPCXX", "SPCXx", "SPACEX", "SpaceX", "Space Exploration", "Space Exploration Technologies", "Space", "Starlink", "Starbase", "Starship", "Falcon", "Dragon", "Merlin", "Raptor", "Crew Dragon", "xAI", "Grok", "Grok Imagine", "Elon", "Musk", "Schrodinger", "Gatsby", "Marvin", "Cat 5", "Cat5", "Snow Melt", "Stow", "Dislodge", "Aaron Taylor", "Tippen", "Backed", "xStock", "xStocks", "Kraken", "rocket", "Mars", "Aurora", "Rudi", "Hawthorne"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","TUXEDO","LOAF","SNOW","WARM","SPACE","SPACECAT","ORBIT"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id, mcap: t.mcap, holders: t.holderCount }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
console.log(JSON.stringify(results, null, 1));
