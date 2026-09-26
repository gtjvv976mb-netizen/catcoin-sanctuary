const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in PFIZER. Not affiliated with Pfizer, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["PFIZER", "Pfizer", "Pfizer Inc", "PFE", "PFEx", "PFZ", "Pfizer Japan", "Pfizer Animal Health", "Charles Pfizer", "Charles Erhart", "Erhart",
  "Albert Bourla", "Bourla", "AMR", "AMR Cat", "AMRcat", "Antimicrobial", "Zoetis", "Revolution", "Convenia", "Selamectin", "Cefovecin", "Viagra", "Lipitor", "Comirnaty",
  "Paxlovid", "BioNTech", "Wyeth", "Hospira", "Seagen", "Pharmacia", "Upjohn", "Viatris", "Xeljanz", "Eliquis", "Prevnar", "Ibrance", "Chantix", "Celebrex", "Zoloft",
  "Advil", "Centrum", "Helix", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Puma", "Jaguar", "Lions", "Hello Kitty", "Kitty", "Sanrio", "Garfield", "Pusheen",
  "Doraemon", "Tateda", "Kazuhiro Tateda", "Toho", "vaccine", "pill", "cure", "Chiikawa", "Hachiware", "Health Answers", "penicillin", "antibiotic", "medicine", "germ"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","HACHI","HACHIWARE","MOCHI","MANEKI","CHEESE","SC","MANLET","GME","LOAF","WAWA","SIGMA","GRUMPYCAT","TOSHI","NEIRO","PEPE","DOGE","SHIB","BILLY"]);
const look = "A normal four-legged, plump, round house cat. Cream-white coat with a charcoal-black cap of fur on the head, split between pink ears, charcoal patches on the back and hip, and a charcoal tail with a white tip that curls up like a question mark. Olive-gold eyes, small pink nose. Wears nothing.";
const coins = [
 { name: "Inkcap the Round Garden Cat", ticker: "INKCAP", blurb: "Inkcap, a round cream-white cat with a charcoal cap between pink ears, charcoal back patches and olive-gold eyes, dozes by the mushroom ring." },
 { name: "Brushtip the Patchback Cat", ticker: "BRUSHTIP", blurb: "Brushtip, a plump cream-white cat with charcoal patches, flicks a white-tipped charcoal tail like a paintbrush, painting lazy loops in the air." },
 { name: "Querytail the Curious Cat", ticker: "QUERYTAIL", blurb: "Querytail, a chubby cream-white cat with a charcoal cap and pink ears, curls a white-tipped charcoal tail into a question mark at every visitor." },
];
const out = { disclaimer: DISC, disclaimerOnly_checkFields: R.checkFields({ description: DISC }), look_checkFields: R.checkFields({ look }), look_checkTerms: R.checkTerms({ look }, stockTerms), results: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /PF|PFE|PFZ|FIZ|AMR|ZOET/.test(c.ticker), memeTickerClash: memeTickers.has(c.ticker),
    endsWithDisclaimer: desc.endsWith(DISC), description: desc };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  o.checkTerms_fullDescription = R.checkTerms({ description: desc }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jup = { status: r.status, results: arr.length, hits: arr.map(t => `${t.symbol}${t.isVerified ? "(verified)" : ""}`),
      symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
    o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  } catch (e) { o.jupError = String(e); }
  out.results.push(o);
}
console.log(JSON.stringify(out, null, 1));
