const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in WULF. Not affiliated with TeraWulf, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["WULF","WULFx","TeraWulf","TeraWulf Inc","Tera","Wulf","Wolf","Wolves","Beowulf","Beowulf Energy","Grendel","Paul Prager","Prager","Nazar Khan","Nazar","Khan","Lake Mariner","Mariner","Hawkeye","Justified","Chesapeake","Muskie","Nautilus","Somerset","Century","Century Aluminum","Aluminum","Hawesville","Morgantown","Hardin","Montana","Hunterbrook","Bitcoin","BTC","Satoshi","Marathon","Fluidstack","Google","Numa","Wheaties","Backpack","Backpack Securities","Sunrise","Wormhole","Kentucky","Niagara","Pennsylvania","New York","Nasdaq"],
  otherPairs: ["IREN","Iris","PENG","Penguin"] };
const banned = new Set(["WULF","WOLF","TERA","POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","ROAR","MANEKI","CHEEMS","GME","VENT"]);
const look = "A normal four-legged sleek graphite-grey shorthair cat with a solid coat that shows a slightly lighter grey sheen in the sun, and pale gold eyes. It wears nothing.";
const variants = [
  { tag: "draft", name: "Vent the Graphite Cat", ticker: "WARMVENT", blurb: "Vent, a sleek graphite-grey shorthair with pale gold eyes, curls up on the warm garden vent where the air always hums, and purrs along in time." },
  { tag: "revised", name: "Vent the Graphite Cat", ticker: "WARMVENT", blurb: "Vent, a sleek graphite-grey shorthair with pale gold eyes, naps on the warm air vent by the garden wall and stretches out in the toasty breeze." },
  { tag: "altDigby", name: "Digby the Gold-Striped Cat", ticker: "DIGBYPAW", blurb: "Digby, a lean golden-ginger tabby with rust-orange stripes and green eyes, digs neat little holes in the flowerbeds, then sits back to admire each." },
  { tag: "altLake", name: "Lakeglass the Blue-Grey Cat", ticker: "LAKEGLASS", blurb: "Lakeglass, a stocky blue-grey cat with a white chest and paws and copper eyes, sits on the lakeside stones at dusk to watch the water go still." },
];
const out = { disclosureOnly_checkFields: R.checkFields({ description: DISC }), results: [] };
const jupCache = {};
async function jup(q) {
  if (jupCache[q]) return jupCache[q];
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  const sm = arr.filter(t => String(t.symbol).toUpperCase() === q.toUpperCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
  return (jupCache[q] = { status: r.status, results: arr.length, top: arr.slice(0, 5).map(t => `${t.symbol}|${t.name}|verified=${t.isVerified}`), symbolMatches: sm, verifiedMatch: sm.some(t => t.isVerified === true) });
}
for (const c of variants) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { tag: c.tag, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, descBytes: Buffer.byteLength(desc), endsWithDisclaimer: desc.endsWith(DISC),
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /WULF|WOLF|TERA|WLF/.test(c.ticker), memeBanned: banned.has(c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  o.jup = { [c.ticker]: await jup(c.ticker) };
  o.description = desc;
  out.results.push(o);
}
out.jupVENT = await jup("VENT");
console.log(JSON.stringify(out, null, 1));
