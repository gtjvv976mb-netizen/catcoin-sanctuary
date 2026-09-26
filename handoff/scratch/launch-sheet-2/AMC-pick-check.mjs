const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in AMC. Not affiliated with AMC Entertainment, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["AMC", "AMC Entertainment", "AMC Entertainment Holdings", "AMC Theatres", "AMC Theaters", "American Multi-Cinema", "Multi-Cinema", "AMCx",
  "Adam Aron", "Aron", "Hello Kitty", "Kitty", "Chococat", "Cinnamoroll", "Kuromi", "Keroppi", "Sanrio", "Roaring Kitty", "Roaring", "Keith Gill", "Gill", "DFV", "DeepFuckingValue",
  "APE", "apes", "AMC Stubs", "Stubs", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Dolby", "IMAX", "Odeon", "Carmike", "UCI", "Wanda", "Leawood",
  "Puss in Boots", "Nicole Kidman", "Kidman", "Garfield", "Flow", "CatVideoFest", "A Meme Coin", "Fandango", "Popcorn", "Kernel Season", "Kernel Seasons", "Orville", "Redenbacher", "Pop Secret", "Jolly Time", "Taylor Swift"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","KEYCAT","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SC","GIGA","MIAO","NUB","BCAT","SIMON","GIKO","SNOWBALL","ROAR","ROARING","HODL","APE","AMC","POPCORN","KERNEL"]);
const coins = [
 { pick: false, name: "Kernel the Butter-Patch Cat", ticker: "KERNELPAW", blurb: "Kernel, a fluffy cream-white cat with butter-yellow patches and honey-gold eyes, waits by the garden bench for anything that pops.", look: "" },
 { pick: true, name: "Kernel the Butter-Patch Cat", ticker: "KERNELPAW", blurb: "Kernel, a fluffy cream-white cat with butter-yellow patches and honey-gold eyes, curls up in a warm, buttery patch of sun on the garden bench.",
   look: "A normal four-legged, fluffy, medium-longhair house cat. Cream-white with butter-yellow patches (the colours of buttered popcorn) and honey-gold eyes. Wears nothing. Taken from the business, a movie-theater chain known for its popcorn." },
 { pick: false, name: "Matinee the Velvet-Black Cat", ticker: "MATINEE", blurb: "Matinee, a sleek jet-black shorthair with pale gold eyes, naps all afternoon in the darkest, softest corner of the garden shed." },
 { pick: false, name: "Reeltail the Silver Tabby Cat", ticker: "REELTAIL", blurb: "Reeltail, a silver tabby with a long tail ringed in black bands, sits on the warm garden wall watching the evening sky like a big screen." },
];
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { pick: c.pick, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /AMC|THEAT|CINEMA|STUB/.test(c.ticker), memeClash: memeTickers.has(c.ticker),
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
    o.jupAnyVerifiedInResults = arr.filter(t => t.isVerified).map(t => `${t.symbol} (${t.name})`);
  } catch (e) { o.jupError = String(e); }
  // also the ticker's root word alone, to see near-collisions
  results.push(o);
}
const extra = {};
for (const q of ["KERNEL", "KERNELCAT"]) {
  try { const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`); const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    extra[q] = { status: r.status, n: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === q).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
  } catch (e) { extra[q] = String(e); }
}
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), discLen: DISC.length, results, extra }, null, 1));
