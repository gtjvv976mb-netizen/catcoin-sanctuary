const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in PENG. Not affiliated with Penguin Solutions, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["PENG", "Penguin", "Penguins", "Penguin Solutions", "Penguin Computing", "Penguin Edge", "SGH", "SMART Global", "SMART Global Holdings", "SMART Modular", "SMART Modular Technologies", "Smart", "Stratus", "Stratus Technologies", "Cree", "Cree LED", "Wolfspeed", "Kash Shaikh", "Shaikh", "Nate Olmstead", "Olmstead", "OriginAI", "ClusterWare", "ClusterWareAI", "MemoryAI", "ComputeAI", "ztC", "everRun", "Zefr", "ZDIMM", "Scyld", "Fremont", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Pudgy", "PENGU", "Tux", "tuxedo", "waddle", "flipper", "emperor", "igloo", "iceberg", "arctic", "antarctic", "Pingu"] };
const banned = new Set(["PENG","PENGU","PENGUIN","SGH","TUX","POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","ROAR","ROARING","AMC","APE","HODL"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasPengRoot: c.ticker.includes("PENG") || c.ticker.includes("SGH") };
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
