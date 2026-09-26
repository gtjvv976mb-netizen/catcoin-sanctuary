const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in HIMS. Not affiliated with Hims & Hers Health, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["HIMS", "HIMSx", "Hims", "Hers", "Hims & Hers", "Hims and Hers", "Hims & Hers Health", "forhers", "wearehims", "wearehers", "Andrew Dudum", "Dudum", "Jack Abraham", "Hilary Coles", "Golden Child",
  "Quentin Lacornerie", "Lacornerie", "Mo Elshenawy", "Elshenawy", "Apostrophe", "YoDerm", "MedisourceRx", "Medisource", "Eucalyptus", "Juniper", "Pilot", "Zava", "Atomic",
  "Sick of the System", "Wegovy", "Ozempic", "Novo Nordisk", "semaglutide", "GLP-1", "minoxidil", "finasteride", "Muscle Cat", "Musclecat", "Collagen", "Fortify", "Target",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Brawny", "Hoist"] };
const cands = JSON.parse(process.argv[2]);
const out = [];
for (const c of cands) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /HIM|HER|HH/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
  o.checkTerms_disclaimer_only = R.checkTerms({ disclaimer: DISC }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  o.jup = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, symbol: t.symbol, isVerified: t.isVerified, id: t.id })) };
  o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  o.jup.nearSymbols = arr.slice(0, 8).map(t => `${t.symbol}${t.isVerified ? "(verified)" : ""}`);
  o.description = desc;
  out.push(o);
}
console.log(JSON.stringify(out, null, 1));
