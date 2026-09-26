const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in USO. Not affiliated with United States Oil Fund, LP, USCF, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["USO", "USOx", "United States Oil Fund", "United Sates Oil Fund", "United States Oil", "United States", "United", "States", "Sates", "Oil", "Oil Fund", "Fund", "LP",
  "USCF", "USCF Investments", "United States Commodity Funds", "Commodity", "Marygold", "Marygold Companies", "Tiger Financial", "Tiger", "John Love", "Nicholas Gerber", "Gerber", "Stuart Crumbaugh", "Crumbaugh",
  "Invest In What's Real", "Real Spiel", "The Original Oil ETF", "ETF", "Crude", "Light Sweet", "Sweet Crude", "WTI", "Brent", "Cushing", "Oklahoma", "NYMEX", "Futures", "Barrel", "Petroleum", "Petro", "Oilfield", "Oiler", "Slick", "Gusher", "Pipeline", "Refinery", "Derrick", "Wildcat", "Texas Tea", "Black Gold",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Caterpillar", "United Service Organizations", "Jawsome", "Future Proof", "Hello Kitty", "Garfield", "Amber Group", "Trinket"] };
const c = { name: "Amberdrop the Tortie Cat", ticker: "AMBERDROP",
  blurb: "Amberdrop, a glossy black tortoiseshell shorthair with honey-gold patches and green-gold eyes, dozes in the sunny herb bed.",
  look: "A normal four-legged, sleek shorthair tortoiseshell house cat: mostly glossy jet-black with honey-gold patches, and green-gold eyes. It wears nothing. The look is taken from the business, not from any real cat." };
const desc = `${c.blurb} ${DISC}`;
const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, endsWithDisc: desc.endsWith(DISC),
  tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /USO|^US|OIL|CRUDE|USCF|WTI|BRENT|PETRO/.test(c.ticker) };
o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
o.checkFields_description = R.checkFields({ description: desc });
o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
o.checkTerms_disclaimer_only = R.checkTerms({ disclaimer: DISC }, stockTerms);
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
o.jup = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified })) };
o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
o.description = desc; o.look = c.look;
console.log(JSON.stringify(o, null, 1));
