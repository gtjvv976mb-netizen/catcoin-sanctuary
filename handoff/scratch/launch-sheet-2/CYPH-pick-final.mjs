const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in CYPH. Not affiliated with Cypherpunk Technologies, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const c = { name: "Goldruff the Tawny Cat", ticker: "GOLDRUFF", blurb: "Goldruff, a tawny golden cat with a cream chin and belly, a fluffy neck ruff and green eyes, watches the garden like a small lion." };
const desc = `${c.blurb} ${DISC}`;
const stockTerms = { stock: ["CYPH","Cyph","Cypherpunk","Cypherpunk Technologies","Cypher","Cipher","Punk","Leap","Leap Therapeutics","Zcash","ZEC","Zashi","Zebra","Zooko","Zodl","Electric Coin","Winklevoss","Tyler","Cameron","Khing","Oei","McEvoy","Onsi","Douglas Onsi","Gemini","Nifty","Transmissions","Transmission","Shielded","Sapling","Orchard","Halo","Hush","Veil","Backpack","Backpack Securities","Sunrise","Wormhole","DATS","Interlocked","Entropy","NU7","Cyberpunk","Neon"] };
const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerFormat: R.TICKER.test(c.ticker), endsWithDisclosure: desc.endsWith(DISC),
  checkProposal_nameTickerBlurb: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb }),
  checkProposal_fullDescription: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc }),
  checkFields_disclosureOnly: R.checkFields({ description: DISC }),
  displaySafe: R.displaySafe({ name: c.name, symbol: c.ticker }),
  checkTerms_stock: R.checkTerms({ name: c.name, symbol: c.ticker, description: c.blurb }, stockTerms) };
for (const q of [c.ticker, "GOLDRUF", "RUFF"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`); const j = await r.json(); const arr = Array.isArray(j) ? j : [];
  out["jup_" + q] = { status: r.status, n: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === q).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })) };
}
out.description = desc;
console.log(JSON.stringify(out, null, 1));
