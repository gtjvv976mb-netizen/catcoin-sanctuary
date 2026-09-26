const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in COST. Not affiliated with Costco Wholesale, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["COST", "Costco", "Costco Wholesale", "Costco Wholesale Corporation", "Wholesale", "Warehouse", "Price Club", "Price", "Sol Price", "Robert Price", "FedMart",
  "Kirkland", "Kirkland Signature", "Issaquah", "Sinegal", "Jim Sinegal", "James Sinegal", "Brotman", "Jeffrey Brotman", "Vachris", "Ron Vachris", "Jelinek", "Craig Jelinek", "Hamilton James",
  "Hello Kitty", "Kitty", "Sanrio", "Cinnamoroll", "Kuromi", "Squishmallow", "Squishmallows", "A-Sha", "Snoopy", "Jim Shore", "Costco Guys", "Big Justice", "AJ",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Executive Member", "Costco Connection", "Stacks", "STX", "Parcel", "Stacker", "Cubs", "Cubbies"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","MANEKI","CHEESE","GME","SC","MOTHER","WEN","BOBO","FWOG","LUCE","MOODENG","PNUT","CHILLGUY","GIGA","KITTENWIF","NEIRO","HIGHER","TOBY","BILLY","HOPPY","MONEYCAT","CATGPT","CATI","CATDOG","CATE","OSAK","MANEKI","MIMI","SMOG","POPDOG","NAKAMOTO","ZEUS"]);
async function jup(q) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  return { status: r.status, results: arr.length, arr };
}
const cands = [
  { name: "Carton the Cardboard-Tan Cat", ticker: "CARTONPAW", blurb: "Carton, a big broad-chested cat with a cardboard-tan coat, cream bib and cream paws, naps on a tall pile of brown boxes in the garden shed.",
    look: "From the business: bulk boxed goods stacked on pallets. A normal four-legged, big, sturdy house cat with a cardboard-tan coat, a cream bib and cream paws, and amber eyes. It wears nothing." },
  { name: "Stacks the Cardboard-Tan Cat", ticker: "STACKPAW", blurb: "Stacks, a big broad-chested cat with a cardboard-tan coat, cream bib and cream paws, naps on a tall pile of brown boxes in the garden shed.", look: "From the business: bulk boxed goods stacked on pallets. A big, sturdy house cat with a cardboard-tan coat, a cream bib and cream paws, and amber eyes. It wears nothing." },
  { name: "Roastie the Golden-Crust Cat", ticker: "ROASTPAW", blurb: "Roastie, a plump shorthair with a glossy golden-brown coat and herb-green eyes, dozes in the warmest sunny patch beside the garden grill.", look: "From the business: rotisserie chickens are one of its main draws. A plump shorthair with a glossy, solid golden-brown coat that shades darker along the back, and herb-green eyes. It wears nothing." },
  { name: "Toastbun the Long Ginger Cat", ticker: "TOASTBUN", blurb: "Toastbun, a long, low ginger tabby with toasty bun-brown stripes and a cream belly, stretches the full length of the garden bench.", look: "From the business: the food-court hot dog, one of its most popular items. A long, low-bodied ginger tabby with toasted-brown stripes, a cream belly and gold eyes. It wears nothing." },
];
const out = { disclaimerOnly: { checkFields: R.checkFields({ disclaimer: DISC }), checkTerms: R.checkTerms({ disclaimer: DISC }, stockTerms) }, candidates: [] };
for (const c of cands) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /COST|KIRK|WHOLE|WARE|PRICE/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC), memeTicker: MEME.has(c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, description: desc.replace(DISC, ""), look: c.look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  const j = await jup(c.ticker);
  o.jup = { status: j.status, results: j.results, symbolMatches: j.arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
  o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  o.jup.otherHits = j.arr.slice(0, 5).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified }));
  o.description = desc;
  out.candidates.push(o);
}
for (const q of ["Stacks", "STX", "Carton", "CARTON"]) {
  const j = await jup(q);
  out["jupName_" + q] = { status: j.status, results: j.results, top: j.arr.slice(0, 6).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, mcap: Math.round(t.mcap ?? 0), id: t.id })) };
}
console.log(JSON.stringify(out, null, 1));
