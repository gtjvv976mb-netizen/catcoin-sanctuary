const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in NIKE. Not affiliated with NIKE, Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["NIKE", "NKE", "NKEx", "Nike Inc", "Jordan", "Michael Jordan", "MJ", "Air Jordan", "Jumpman", "Jordan Brand", "Black Cat", "Blackcat", "Hello Kitty", "Kitty", "Sanrio",
  "Frank", "Frank the Tiger", "Tiger", "Tiger Woods", "Woods", "Onitsuka", "Onitsuka Tiger", "Blue Ribbon", "Blue Ribbon Sports", "Phil Knight", "Knight", "Elliott Hill", "Bowerman",
  "Swoosh", "Just Do It", "Air", "Presto", "Air Presto", "Dunk", "Air Force", "Cortez", "Waffle", "Victory", "Bulls", "Chicago", "Converse", "SNKRS", "Jordan 4", "Wieden", "Kennedy",
  "Giamatti", "Spicer", "Daphne", "Beaverton", "Oregon", "Panther", "Black Panther", "Tinker", "Hatfield", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Flyknit", "Zoom", "Vaporfly", "Air Max",
  "Nubuck", "Pounce", "Black Friday", "Jumpman23", "Nike Golf", "Year of the Tiger", "Puma", "Jaguar", "Hurley", "Umbro", "Cole Haan", "ACG", "Pegasus", "Mercurial", "Kobe", "LeBron", "Kyrie"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","SC","GIKO","BOOK","NUB","SNOWBALL","NEKO","CATGPT","MEOWCAT","CHESHIRE","MOCHI","TOSHI","MIHARU","BILLY","WEN","PUSS","KITTENWIF","SOOT","CINDER","TREAD"]);
const drafts = [
 { name: "Cinder the Matte-Coat Cat", ticker: "CINDERLAP", blurb: "Cinder, a lean, long-legged jet-black shorthair with graphite-grey whisker tips and honey-gold eyes, runs dusk laps on the garden's cinder path.",
   look: "Lean, long-legged, athletic jet-black shorthair with a matte coat, graphite-grey whisker tips and honey-gold eyes. Normal four-legged cat, wears nothing.", roots: ["CINDER"] },
 { name: "Soot the Graphite-Smoke Cat", ticker: "SOOTSTEP", blurb: "Soot, a sleek black smoke cat whose velvety coat shows a graphite-grey undercoat when she stretches, hops from stepping stone to stepping stone.",
   look: "Sleek, medium-build black smoke cat: black tips over a graphite-grey undercoat, with green-gold eyes. Normal four-legged cat, wears nothing.", roots: ["SOOT"] },
 { name: "Tread the Soft-Step Cat", ticker: "TREADPAW", blurb: "Tread, a wiry jet-black shorthair with a soft matte coat, graphite-grey paw pads and gold eyes, pads silent circuits of the garden pond at dawn.",
   look: "Wiry, light-framed jet-black shorthair with a soft matte coat, graphite-grey paw pads and gold eyes. Normal four-legged cat, wears nothing.", roots: ["TREAD"] },
];
async function jup(q) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  const m = arr.filter(t => String(t.symbol).toUpperCase() === q.toUpperCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id, holders: t.holderCount, mcap: t.mcap }));
  return { status: r.status, results: arr.length, exactSymbolMatches: m, verifiedMatch: m.some(t => t.isVerified === true) };
}
const out = { disclosureOnly: R.checkFields({ description: DISC }), disclosureStockTerms: R.checkTerms({ disclaimer: DISC }, stockTerms), results: [] };
for (const c of drafts) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /NIKE|NKE|JORD|SWOOSH|AIR|JUMP/.test(c.ticker), memeTicker: memeTickers.has(c.ticker), endsWithDisclaimer: desc.endsWith(DISC) };
  o.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescriptionAsTagline = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_look = R.checkFields({ look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  o.jup = await jup(c.ticker);
  o.jupRoots = {}; for (const r of c.roots) o.jupRoots[r] = await jup(r);
  o.description = desc;
  out.results.push(o);
}
console.log(JSON.stringify(out, null, 1));
