const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in URA. Not affiliated with Global X, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["URA", "Uranium", "Global X", "GlobalX", "Global X ETFs", "Global X Uranium ETF", "Global X Management", "Mirae", "Mirae Asset", "TIGER", "Tiger ETF", "Smart Tiger", "Ryan O'Connor", "O'Connor", "Luis Berruga", "Berruga", "Park Hyeon-joo", "Hyeon-joo", "Solactive", "Nuclear", "Beyond Ordinary", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Cameco", "Kazatomprom", "NexGen", "Uranium Energy", "Denison", "Yellowcake", "Radioactive", "Radiation", "Atomic", "Atom", "Reactor", "Fission", "Isotope", "Glow", "Glowing", "Chernobyl", "Fukushima", "Biden", "Willow"] };
const coins = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const looks = {
  LICHENPAW: "A normal four-legged shorthair house cat with a solid pale green-grey coat (a soft grey with a sage cast) and lime-green eyes. Wears nothing. The colour follows the uranium theme, with no brand involved.",
  WILLOWPAW: "A pale green-grey tabby with slate-green stripes and yellow eyes. The look comes from the uranium business.",
  SPRIGPAW: "A pale green-grey and white bicolour cat with a white bib, four white paws and pale gold eyes. The look comes from the uranium business."
};
const knownCatMemes = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","SC","MIU","MANEKI","CHEESE","MOGCOIN","BOBBY","SIGMA","GME","TIGER","URANIUM","NUKE","WILLOW","LICHEN","SPRIG"]);
async function jup(q) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  return { status: r.status, n: arr.length, arr };
}
const out = { sanity: null, disclosureOnly: R.checkFields({ description: DISC }), disclosureTerms: R.checkTerms({ disclaimer: DISC }, stockTerms), coins: [] };
const b = await jup("BONK"); out.sanity = { status: b.status, n: b.n, verifiedBonk: b.arr.some(t => t.symbol === "Bonk" || t.symbol === "BONK" && t.isVerified) };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, endsWithDisclaimer: desc.endsWith(DISC),
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /URA|GLX|GLOBX|NUC|ATOM|TIGR|MIRAE/.test(c.ticker), tickerIsKnownCatMeme: knownCatMemes.has(c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_look = R.checkFields({ look: looks[c.ticker] });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: looks[c.ticker] }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  const word = c.name.split(" ")[0];
  for (const q of [c.ticker, word.toUpperCase()]) {
    const j = await jup(q);
    const m = j.arr.filter(t => String(t.symbol).toUpperCase() === q);
    o[`jup_${q}`] = { status: j.status, results: j.n, exactSymbolMatches: m.map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id, holders: t.holderCount, mcap: t.mcap })), verifiedMatch: m.some(t => t.isVerified === true),
      verifiedAny: j.arr.filter(t => t.isVerified).map(t => `${t.symbol}/${t.name}`) };
  }
  o.description = desc;
  out.coins.push(o);
}
console.log(JSON.stringify(out, null, 1));
