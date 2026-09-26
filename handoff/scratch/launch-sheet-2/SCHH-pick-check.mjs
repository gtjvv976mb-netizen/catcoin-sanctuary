const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in SCHH. Not affiliated with Schwab Asset Management, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["SCHH", "SCHHx", "SCH", "SCHW", "Schwab", "Charles Schwab", "Schwab Asset Management", "Schwab U.S. REIT ETF", "Schwab US REIT", "REIT", "ETF",
  "Chuck", "Chuck Schwab", "Talk to Chuck", "Walt Bettinger", "Bettinger", "Rick Wurster", "Wurster", "Zeppy", "Zep", "thinkorswim", "TD Ameritrade", "Ameritrade",
  "Kevin Siemiawski", "Siemiawski", "Classy Cats", "classycatsinc", "Thor", "Loki", "Schwab4Good", "Operation Kindness", "Roaring Kitty", "Keith Gill",
  "Backpack", "Backpack Securities", "Sunrise", "StonkFun", "Marvel"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","CHILLCAT","KEYCAT","GME","LOCK","HAMMY","MANYU","NEIRO","SCF","ZEUS","SC","MUMU"]);
const cands = [
  { id: "orig", name: "Lintel the Peach-Patch Cat", ticker: "LINTELPAW", blurb: "Lintel, a slim grey tabby-and-white cat with a faint peach patch on one hip, stretches out across every doorstep in the garden." },
  { id: "fixed", name: "Lintel the Peach-Patch Cat", ticker: "LINTELPAW", blurb: "Lintel, a slim grey tabby-and-white cat with green-gold eyes and a faint peach hip patch, naps on the beam over the garden door." },
];
const out = { disclosure: DISC, disclosureLen: DISC.length, disclosure_checkFields: R.checkFields({ description: DISC }), results: [] };
for (const c of cands) {
  const desc = `${c.blurb} ${DISC}`;
  const r = { ...c, description: desc, nameLen: c.name.length, descLen: desc.length, blurbLen: c.blurb.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /SCH|REIT|ETF/.test(c.ticker), memeTicker: memeTickers.has(c.ticker),
    endsWithDisclosure: desc.endsWith(DISC) };
  r.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  r.checkFields_fullDescription = R.checkFields({ name: c.name, symbol: c.ticker, description: desc });
  r.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  r.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  r.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  out.results.push(r);
}
const jup = {};
for (const q of ["LINTELPAW", "LINTEL", "Lintel the Peach-Patch Cat"]) {
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
    const j = await res.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    jup[q] = { status: res.status, results: arr.length,
      symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === "LINTELPAW").map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })),
      nearSymbols: arr.slice(0, 8).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })) };
    jup[q].verifiedMatch = jup[q].symbolMatches.some(t => t.isVerified === true);
  } catch (e) { jup[q] = { error: String(e) }; }
}
out.jupiter = jup;
console.log(JSON.stringify(out, null, 1));
