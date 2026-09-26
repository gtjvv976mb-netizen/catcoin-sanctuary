const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC_OLD = "A cat coin priced in DJT. Not affiliated with Trump Media & Technology Group, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const DISC_NEW = "A cat coin priced in DJT. Not affiliated with TMTG, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["DJT", "DJTx", "Trump", "Donald", "Donald Trump", "Donald J Trump", "Trump Media", "Trump Media & Technology Group", "TMTG", "Truth", "Truth Social", "TruthSocial", "Truth+", "TruthFi", "Truth.Fi",
  "Digital World", "DWAC", "Devin Nunes", "Nunes", "Kevin McGurn", "McGurn", "Boris Epshteyn", "Epshteyn", "Andy Litinsky", "Litinsky", "Wes Moss", "Moss",
  "MAGA", "Make America Great Again", "Springfield", "Haitian", "Haiti", "rifle", "duck", "ducks", "lion", "Mar-a-Lago", "Mar a Lago", "Palm Beach", "Sarasota", "Rumble", "Backpack", "Backpack Securities", "Sunrise", "Wormhole",
  "Orange Man", "Orange", "Don", "Donny", "Trumpet", "POTUS", "Patriot", "Patriots", "America", "American", "Eagle", "Freedom", "Truth+", "Rally", "Tariff", "Pet eating", "Eating the cats", "Jet", "Plane", "Hat", "Red hat",
  "Echo chamber", "Amazon Echo", "Alexa"] };
const coins = [
  { id: "draft1", name: "Marmalade the Town Crier Cat", ticker: "TOWNCRIER", blurb: "Marmalade, a lean ginger tabby with rust stripes and gold eyes, meows the morning gossip from the garden gate to all who pass.", disc: DISC_OLD },
  { id: "draft2", name: "Soapbox the Ginger Tabby", ticker: "SOAPPAW", blurb: "Soapbox, a fluffy ginger tabby with a cream chin and copper eyes, stands on an old crate to lecture the sparrows at length.", disc: DISC_OLD },
  { id: "draft3", name: "Echo the Noticeboard Cat", ticker: "PAWPOST", blurb: "Echo, a stocky ginger tabby with swirled stripes and green eyes, stamps a paw print on each note on the garden noticeboard.", disc: DISC_OLD },
  { id: "pick", name: "Tack the Noticeboard Cat", ticker: "PAWPOST", blurb: "Tack, a stocky ginger tabby with swirled stripes and green eyes, stamps a paw print on every note pinned to the Cat Sanctuary noticeboard.", disc: DISC_NEW,
    look: "A normal four-legged, stocky, short-haired house cat. Ginger (red) classic swirled tabby with darker rust stripes and green eyes. Wears nothing. Coat follows the ginger tabby cat in the AI image the research found; the noticeboard idea comes from the business, a platform for posting notes, with no brand." },
];
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","GINGER","MAGA","TRUMP","DJT","TRUTH","TMTG","MAGACAT","TRUMPCAT","CHILLCAT","SCHRODINGER","MANEKI","CATGIRL","MOCHI","CATDOG"]);
const out = { disclaimerOld: { checkFields: R.checkFields({ disclaimer: DISC_OLD }) }, disclaimerNew: { checkFields: R.checkFields({ disclaimer: DISC_NEW }) }, coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${c.disc}`;
  const o = { id: c.id, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, descOK: desc.length <= 280, nameOK: c.name.length <= 32,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /DJT|TRUMP|TMTG|TRUTH|MAGA|DON/.test(c.ticker), endsWithDisclaimer: desc.endsWith(c.disc), memeTicker: memeTickers.has(c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkFields_fullDescription = R.checkFields({ name: c.name, symbol: c.ticker, description: desc });
  o.checkFields_blurbOnly = R.checkFields({ blurb: c.blurb, ...(c.look ? { look: c.look } : {}) });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, ...(c.look ? { look: c.look } : {}) }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jup = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })) };
    o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
    o.jup.allSymbols = arr.map(t => `${t.symbol}${t.isVerified ? "(verified)" : ""}`);
  } catch (e) { o.jupError = String(e); }
  o.description = desc;
  out.coins.push(o);
}
console.log(JSON.stringify(out, null, 1));
