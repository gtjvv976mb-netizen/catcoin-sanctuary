const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const p = { name: "Umber the Deep-Brown Cat", ticker: "UMBERPAW",
  description: "Umber, a sleek shorthair with a deep umber-brown coat that looks almost black in the shade and warm copper eyes, naps under the fig tree. A cat coin priced in PTN. Not affiliated with Palatin Technologies, Backpack Securities or StonkFun. No intrinsic value; not financial advice.",
  look: "A sleek four-legged shorthair house cat with a solid deep umber-brown coat that looks near-black in shade, and warm copper eyes. It wears nothing." };
const DISC = "A cat coin priced in PTN. Not affiliated with Palatin Technologies, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const blurb = p.description.slice(0, p.description.length - DISC.length).trim();
const stockTerms = { stock: ["PTN","Palatin","Palatin Technologies","Vyleesi","bremelanotide","Cosette","Boehringer","Ingelheim","Carl Spana","Spana","PL9643","PL7737","PL8177","Backpack","Sunrise","melanocortin","MC1R","MC4R","pinwheel","pentagon","Hello Kitty","PalatinTech"] };
const out = {
  lens: { name: p.name.length, description: p.description.length, blurb: blurb.length },
  tickerFmt: R.TICKER.test(p.ticker), endsWithDisclosure: p.description.endsWith(DISC),
  checkProposal_blurb: R.checkProposal({ name: p.name, symbol: p.ticker, tagline: blurb }),
  checkProposal_fullDescription: R.checkProposal({ name: p.name, symbol: p.ticker, tagline: p.description }),
  checkFields_disclosureOnly: R.checkFields({ tagline: DISC }),
  checkFields_look: R.checkFields({ look: p.look }),
  checkTerms_stock: R.checkTerms({ name: p.name, symbol: p.ticker, blurb, look: p.look }, stockTerms),
  displaySafe: R.displaySafe({ name: p.name, symbol: p.ticker }),
};
const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${p.ticker}`); const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
out.jupiter = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === p.ticker).length, verifiedMatch: arr.some(t => String(t.symbol).toUpperCase() === p.ticker && t.isVerified) };
const r2 = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=UMBER`); const j2 = await r2.json(); const a2 = Array.isArray(j2) ? j2 : [];
out.jupiterUMBER = { status: r2.status, results: a2.length, verifiedSymbols: a2.filter(t => t.isVerified).map(t => t.symbol) };
console.log(JSON.stringify(out, null, 1));
