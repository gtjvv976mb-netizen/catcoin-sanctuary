const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in DELL. Not affiliated with Dell Technologies, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["DELL","Dell","Dell Technologies","Dell Technologies Inc","Dell Inc","PCs Limited","Michael Dell","Michael","Susan Dell","Jeff Clarke","Round Rock",
  "EMC","VMware","Alienware","XPS","Inspiron","Latitude","Vostro","OptiPlex","Precision","PowerEdge","PowerStore","PowerScale","Wyse","Dell Pro","Dell Premium",
  "Dude","Dell Dude","Ben Curtis","Steven","Reallusion","Live Cam Avatar","Live Cam","Cam Avatar","Avatar","Webcam Central","Webcam","Rod Ponton","Ponton","lawyer",
  "not a cat","I'm not a cat","Zoom","Skype","filter","ChemBark","sad kitten","Backpack","Backpack Securities","Sunrise","Wormhole","Texas","court","attorney"] };
const c = { name: "Frostpuff the Fold-Eared Cat", ticker: "FROSTPUFF",
  blurb: "Frostpuff, a fluffy white cat with faint silver brow stripes, folded ears, a pink nose and big grey-green eyes, peeks out from the hedge.",
  look: "A normal four-legged, fluffy house cat that wears nothing: a white coat with faint silver-grey tabby stripes on the brow, small folded-down ears, grey-green eyes and a pink nose." };
const desc = `${c.blurb} ${DISC}`;
const o = { name: c.name, ticker: c.ticker, description: desc, look: c.look,
  lengths: { name: c.name.length, ticker: c.ticker.length, blurb: c.blurb.length, description: desc.length },
  withinLimits: c.name.length <= 32 && desc.length <= 280, endsWithDisclaimer: desc.endsWith(DISC),
  tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /DELL|DEL/.test(c.ticker) };
o.checkProposal_nameTickerBlurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
o.checkFields_description = R.checkFields({ description: desc });
o.checkFields_blurbOnly = R.checkFields({ blurb: c.blurb });
o.checkFields_look = R.checkFields({ look: c.look });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb, look: c.look }, stockTerms);
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`); const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
const sm = arr.filter((x) => String(x.symbol).toUpperCase() === c.ticker);
o.jupiter = { status: r.status, results: arr.length, symbolMatches: sm.length, verifiedMatch: sm.some((x) => x.isVerified === true) };
console.log(JSON.stringify(o, null, 1));
