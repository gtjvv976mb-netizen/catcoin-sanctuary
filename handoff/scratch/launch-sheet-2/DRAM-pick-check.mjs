const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in DRAM. Not affiliated with Roundhill Investments, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["DRAM","DRAMx","RAM","Roundhill","Roundhill Investments","Roundhill Memory ETF","Memory ETF","Memory","Backpack","Backpack Securities","Sunrise","Wormhole","Dave Mazza","Mazza","Micron","Samsung","SK Hynix","Hynix","SanDisk","Kioxia","HBM","NAND","DIMM"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","KEYCAT","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SC","GIGA","MIAO","NUB","SIGMA","BCAT","SNEK"]);
const coins = [
 { pick: false, name: "Pinrow the Jet-Black Cat", ticker: "PINROW", blurb: "Pinrow, a glossy jet-black shorthair with silver whiskers and gold eyes, lies long and flat on the warm stones of the garden path.", look: "" },
 { pick: true, name: "Pinrow the Copper-Eyed Cat", ticker: "PINROW", blurb: "Pinrow, a glossy jet-black shorthair with silver whiskers and copper eyes, lies long and flat along the top of the garden wall.",
   look: "Glossy jet-black shorthair with silver whiskers and copper eyes; a normal four-legged house cat that wears nothing. Taken from what the fund holds: data-storage chips, which are glossy black packages edged with rows of silver pins and wired with copper." },
 { pick: false, name: "Bundle the Calico Cat", ticker: "BUNDLEPAW", blurb: "Bundle, a tidy calico with neat patches of black, ginger and white, gathers one of every garden treat into a single pile by the fence." },
 { pick: false, name: "Bitsy the Dotted Cat", ticker: "BITSPOT", blurb: "Bitsy, a white shorthair with neat rows of small black dots down her back and green eyes, lines up pebbles by the pond, row by row." },
];
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { pick: c.pick, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /DRAM|RAM|ROUND|HILL|RNDH/.test(c.ticker), memeClash: memeTickers.has(c.ticker),
    endsWithDisclaimer: desc.endsWith(DISC) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look || "" });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look || "" }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jupStatus = r.status; o.jupResults = arr.length;
    o.jupSymbolMatches = arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    o.jupVerifiedSymbolMatch = o.jupSymbolMatches.some(t => t.isVerified === true);
    o.jupAnyVerifiedInResults = arr.filter(t => t.isVerified).map(t => t.symbol);
  } catch (e) { o.jupError = String(e); }
  o.description = desc;
  results.push(o);
}
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), discLen: DISC.length, results }, null, 1));
