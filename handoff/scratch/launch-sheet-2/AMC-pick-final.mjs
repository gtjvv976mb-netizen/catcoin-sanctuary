const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in AMC. Not affiliated with AMC Entertainment, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["AMC", "AMC Entertainment", "AMC Entertainment Holdings", "AMC Theatres", "AMC Theaters", "American Multi-Cinema", "Multi-Cinema", "AMCx",
  "Adam Aron", "Aron", "Hello Kitty", "Kitty", "Chococat", "Cinnamoroll", "Kuromi", "Keroppi", "Sanrio", "Roaring Kitty", "Roaring", "Keith Gill", "Gill", "DFV", "DeepFuckingValue",
  "APE", "apes", "AMC Stubs", "Stubs", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Dolby", "IMAX", "Odeon", "Carmike", "UCI", "Wanda", "Leawood",
  "Puss in Boots", "Nicole Kidman", "Kidman", "Garfield", "Flow", "CatVideoFest", "A Meme Coin", "Fandango", "Popcorn", "Kernel Season", "Kernel Seasons", "Orville", "Redenbacher", "Pop Secret", "Jolly Time", "Taylor Swift", "bow", "ribbon"] };
const c = { name: "Kernel the Butter-Patch Cat", ticker: "KERNELPAW",
  blurb: "Kernel, a fluffy cream-white cat with butter-yellow patches and honey-gold eyes, naps in a buttery patch of sun on the garden bench.",
  look: "A normal four-legged, fluffy, medium-longhair house cat. Cream-white with butter-yellow patches and honey-gold eyes. Wears nothing. Taken from the business, a movie-theater chain, and the buttered snack sold at its counters." };
const desc = `${c.blurb} ${DISC}`;
const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
  tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /AMC|THEAT|CINEMA|STUB/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC) };
o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
o.checkFields_description = R.checkFields({ description: desc });
o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, description: desc.replace(DISC, ""), look: c.look }, stockTerms);
o.checkTerms_disclaimer_only = R.checkTerms({ disclaimer: DISC }, stockTerms);
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
o.jup = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
const k = await (await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=5xRNjAf8LRY4QjwunrV9eRLpyknpYn7UkvbwtuGpGKNN`)).json();
const kk = (Array.isArray(k) ? k : []).map(t => ({ name: t.name, symbol: t.symbol, isVerified: t.isVerified, holderCount: t.holderCount, mcap: t.mcap, liquidity: t.liquidity, organicScore: t.organicScore, tags: t.tags, createdAt: t.createdAt ?? t.firstPool?.createdAt }));
o.kernelCatToken = kk;
o.description = desc;
console.log(JSON.stringify(o, null, 1));
