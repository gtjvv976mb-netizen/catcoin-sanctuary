const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in RDDT. Not affiliated with Reddit, Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["Reddit", "Reddit Inc", "RDDT", "RDDTx", "RDD", "Snoo", "Snoos", "snoofi", "orangered", "upvote", "upvotes", "downvote", "karma", "subreddit", "redditor", "redditors", "AMA", "Ask Me Anything", "front page", "Steve Huffman", "Huffman", "spez", "Alexis Ohanian", "Ohanian", "Aaron Swartz", "Swartz", "Cool Cats", "Cool Cat", "Blue Cat", "Aku", "Micah Johnson", "Bread Cat", "Grumpy Cat", "Tardar Sauce", "OIIA", "OIIAI", "Oo Ee A E A", "Spinning Cat", "Spinning", "Spin", "Ethel", "Ai Dise Gratis", "Roaring Kitty", "Keith Gill", "wallstreetbets", "WSB", "r/aww", "r/cats", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Dubsmash", "Condé Nast", "Advance", "Internet Awards", "Top Shelf", "Collectible Avatars", "Polygon", "cat signal", "Internet Defense League"] };
const c = { name: "Hubbub the Stubby Tabby Cat", ticker: "HUBBUB",
  blurb: "Hubbub, a short-legged brown tabby with a cream bib and white toe tips, trots between the sanctuary garden benches to hear every lively chat.",
  look: "Normal four-legged house cat. Brown-grey mackerel tabby with a cream-white muzzle and bib, small white toe tips, short stubby legs, a round body and olive-green eyes. No clothing or collar. The theme is a lively chat among many voices, drawn from a discussion site without using any brand terms." };
const desc = `${c.blurb} ${DISC}`;
const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, endsWithDisclaimer: desc.endsWith(DISC),
  tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /RDDT|REDD|RDD|SNOO|KARMA|OIIA|ETHEL/.test(c.ticker) };
o.checkProposal_nameTickerBlurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
o.checkFields_description = R.checkFields({ description: desc });
o.checkFields_descriptionWithoutDisclaimer = R.checkFields({ description: c.blurb });
o.checkFields_look = R.checkFields({ look: c.look });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
o.checkTerms_disclaimerOnly = R.checkTerms({ disclaimer: DISC }, stockTerms);
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
for (const q of [c.ticker, "Hubbub", "Stubby Tabby"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  o[`jup_${q}`] = { status: r.status, results: arr.length,
    symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })),
    nameHits: arr.filter(t => /hubbub|stubby tabby/i.test(t.name)).map(t => `${t.symbol} | ${t.name} | v=${t.isVerified}`),
    verifiedMatch: arr.some(t => String(t.symbol).toUpperCase() === c.ticker && t.isVerified === true) };
}
o.description = desc;
console.log(JSON.stringify(o, null, 1));
