const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in MCDx. Not affiliated with McDonald's or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Snowdrop the Garden Cat", ticker: "SNOWDROP", blurb: "Snowdrop, a sleek white cat with pale green eyes and a pink nose, naps in an empty cardboard box by the herb bed and purrs whenever someone says her name." },
  { name: "Meringue the Porch Cat", ticker: "MERINGUE", blurb: "Meringue, a soft all-white cat with sky-blue eyes, waits on the warm porch step every evening and slowly blinks at the fireflies as they rise from the grass." },
  { name: "Milkweed the Meadow Cat", ticker: "MILKWEED", blurb: "Milkweed, a fluffy white cat with one blue eye and one gold eye, pounces on drifting seed fluff in the long grass, then flops in the sun like a fallen cloud." },
];
const stockTerms = { stock: ["MCD", "MCDX", "MCDx", "McDonald's", "McDonalds", "McDonald", "Mc", "Mac", "Big Mac", "xStock", "xStocks", "Backed",
  "Happy Meal", "Happy", "Meal", "Happy Set", "McFlurry", "McNugget", "Nugget", "Nuggets", "Ronald", "Grimace", "Hamburglar", "Birdie", "Fry Kids", "Mayor McCheese",
  "Golden Arches", "Arches", "CosMc", "lovin", "Kempczinski", "Hello Kitty", "Hello", "Kitty", "Kitty White", "Mimmy", "Sanrio", "Godzilla", "Kaiju", "Chococat",
  "Cinnamoroll", "My Melody", "Melody", "Kuromi", "Pompompurin", "Keroppi", "Badtz-Maru", "Garfield", "Doraemon", "Chiikawa", "Hachiware", "Sumikko", "Neko",
  "Lion King", "Simba", "Mufasa", "Nala", "bow", "ribbon", "Snowbell", "Duchess", "Marie", "Aristocats"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","SNOW","WHITE","MCD","MAC"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkFields_disclosureOnly = R.checkFields({ description: DISC });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
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
