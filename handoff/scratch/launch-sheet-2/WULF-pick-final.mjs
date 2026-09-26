const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in WULF. Not affiliated with TeraWulf, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["WULF","WULFx","TeraWulf","TeraWulf Inc","Tera","Wulf","Wolf","Wolves","Beowulf","Beowulf Energy","Grendel","Paul Prager","Prager","Nazar Khan","Nazar","Khan","Lake Mariner","Mariner","Hawkeye","Justified","Chesapeake","Muskie","Nautilus","Somerset","Century","Century Aluminum","Aluminum","Hawesville","Morgantown","Hardin","Montana","Hunterbrook","Bitcoin","BTC","Satoshi","Marathon","Fluidstack","Google","Numa","Wheaties","Backpack","Backpack Securities","Sunrise","Wormhole","Kentucky","Niagara","Pennsylvania","New York","Nasdaq"],
  otherPairs: ["IREN","Iris","PENG","Penguin"], memeCluster: ["cat in vent","vent cat","ventcat"] };
const banned = new Set(["WULF","WOLF","TERA","POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","ROAR","CHEEMS","GME","VENT","VENTCAT","CIV"]);
const look = "A normal four-legged sleek graphite-grey shorthair cat with a solid coat that shows a slightly lighter grey sheen in the sun, and pale gold eyes. It wears nothing.";
const variants = [
  { name: "Warmnap the Graphite Cat", ticker: "WARMNAP", blurb: "Warmnap, a sleek graphite-grey shorthair with pale gold eyes, spends every afternoon stretched out on the warm air grate by the garden wall." },
  { name: "Warmnap the Graphite Cat", ticker: "WARMNAP", blurb: "Warmnap, a sleek graphite-grey shorthair with pale gold eyes, dozes on the warm air grate by the garden wall and stretches out in the toasty breeze." },
];
const out = { disclosureOnly_checkFields: R.checkFields({ description: DISC }), disclaimerLen: DISC.length, results: [] };
async function jup(q) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  const sm = arr.filter(t => String(t.symbol).toUpperCase() === q.toUpperCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, holders: t.holderCount, id: t.id }));
  return { status: r.status, results: arr.length, top: arr.slice(0, 6).map(t => `${t.symbol}|${t.name}|verified=${t.isVerified}|holders=${t.holderCount}`), symbolMatches: sm, verifiedMatch: sm.some(t => t.isVerified === true) };
}
for (const c of variants) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, descBytes: Buffer.byteLength(desc), endsWithDisclaimer: desc.endsWith(DISC),
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /WULF|WOLF|TERA|WLF/.test(c.ticker), memeBanned: banned.has(c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  o.description = desc;
  out.results.push(o);
}
out.jup = {};
for (const q of ["WARMNAP", "Warmnap", "WARMNAPS"]) out.jup[q] = await jup(q);
console.log(JSON.stringify(out, null, 1));
