const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in RDDT. Not affiliated with Reddit, Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["Reddit", "Reddit Inc", "RDDT", "RDDTx", "RDD", "Snoo", "Snoos", "snoofi", "orangered", "upvote", "upvotes", "downvote", "downvotes", "karma", "subreddit", "subreddits", "redditor", "redditors", "AMA", "Ask Me Anything", "front page", "frontpage", "Steve Huffman", "Huffman", "spez", "Alexis Ohanian", "Ohanian", "Aaron Swartz", "Swartz", "Cool Cats", "Cool Cat", "Blue Cat", "Aku", "Micah Johnson", "Bread Cat", "Grumpy Cat", "Tardar Sauce", "OIIA", "OIIAI", "Oo Ee A E A", "Spinning Cat", "Spinning", "Spin", "Spinner", "Ethel", "Ai Dise Gratis", "Roaring Kitty", "Keith Gill", "wallstreetbets", "WSB", "r/aww", "r/cats", "aww", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Dubsmash", "Condé Nast", "Advance", "Internet Awards", "Top Shelf", "Collectible Avatars", "Polygon", "cat signal", "Internet Defense League", "Cats On Catnip", "Golden Kitty"] };
const MEME = new Set(["POPCAT","MEW","MICHI","CATWIF","MOG","MANEKI","HOBBES","GIKO","NUB","SIMON","PURR","MEOW","KITTY","CAT","CATS","NYAN","GRUMPY","KEYCAT","LOCKIN","SC","CHILLCAT","WIFCAT","SPINCAT","OIIA","OIIAI","BOOK","ETHEL","MUMU","CATE","CATI","TOM","GARF","PUSS","KITTEN","TABBY","SNOWBALL","PEPE","BONK","WIF","MUNCHKIN","CHONK","MANEKINEKO","CATDOG","SMUDGE","GME","APE","HODL","ROAR","ROARING"]);
const coins = [
 {name:"Hubbub the Stubby Tabby Cat",ticker:"HUBBUB",blurb:"Hubbub, a short-legged brown tabby with a cream bib and white toe tips, trots between the garden benches to hear every lively chat.",
  look:"Normal four-legged house cat. Brown-grey mackerel tabby with a cream-white muzzle and bib, small white toe tips, short stubby legs, a round body and olive-green eyes. No clothing or collar. The theme is a lively chat among many voices, drawn from a discussion site without using any brand terms."},
 {name:"Socklet the Short-Legged Cat",ticker:"SOCKLET",blurb:"Socklet, a round, stubby-legged brown tabby with a pale chin and four white-tipped toes, pads along the garden path in tiny, busy steps.",
  look:"Normal four-legged house cat. Round brown-grey mackerel tabby on stubby legs, with a pale cream chin and chest, white-tipped toes on all four paws and olive-green eyes. No clothing. The name comes from the white toe tips."},
 {name:"Natter the Low-Slung Tabby Cat",ticker:"NATTER",blurb:"Natter, a plump brown tabby on short legs with a cream bib and olive eyes, naps by the garden notice board where all the chatter gets pinned.",
  look:"Normal four-legged house cat. Plump, low-slung brown-grey mackerel tabby with short legs, a cream-white bib and muzzle, white toe tips and olive-green eyes. No clothing. The notice board is a generic nod to a message board."},
];
const extra = process.argv[2] ? JSON.parse(process.argv[2]) : null;
if (extra) coins.push(extra);
const out = { disclaimer: DISC, disclaimerOnly_checkFields: R.checkFields({ description: DISC }), disclaimerOnly_checkTerms: R.checkTerms({ disclaimer: DISC }, stockTerms), results: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    nameOk: c.name.length <= 32, descOk: desc.length <= 280, endsWithDisclaimer: desc.endsWith(DISC),
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /RDDT|REDD|RDD|SNOO|KARMA|OIIA|ETHEL|UPVOT|SUB/.test(c.ticker), wellKnownCatMeme: MEME.has(c.ticker) };
  o.checkProposal_nameTickerBlurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_look = R.checkFields({ look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  o.jup = { status: r.status, results: arr.length,
    symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, holders: t.holderCount, id: t.id })),
    related: arr.slice(0, 8).map(t => `${t.symbol} | ${t.name} | v=${t.isVerified}`) };
  o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  o.description = desc;
  out.results.push(o);
}
console.log(JSON.stringify(out, null, 1));
