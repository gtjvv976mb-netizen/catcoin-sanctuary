const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in URA. Not affiliated with Global X, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["URA", "Uranium", "Global X", "GlobalX", "Global X ETFs", "Global X Uranium ETF", "Global X Management", "Mirae", "Mirae Asset", "TIGER", "Tiger ETF", "Smart Tiger", "Ryan O'Connor", "O'Connor", "Luis Berruga", "Berruga", "Park Hyeon-joo", "Hyeon-joo", "Solactive", "Nuclear", "Beyond Ordinary", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Cameco", "Kazatomprom", "NexGen", "Uranium Energy", "Denison", "Yellowcake", "Radioactive", "Radiation", "Atomic", "Atom", "Reactor", "Fission", "Isotope", "Glow", "Glowing", "Chernobyl", "Fukushima", "Biden", "Willow"] };
const c = { name: "Lichen the Sage-Grey Cat", ticker: "LICHENPAW",
  blurb: "Lichen, a soft pale green-grey shorthair with bright lime-green eyes, curls up on the mossy garden rocks and purrs through every afternoon nap.",
  look: "A normal four-legged shorthair house cat with a solid pale green-grey coat (soft grey with a sage cast, a shade darker along the back) and lime-green eyes. Wears nothing." };
const desc = `${c.blurb} ${DISC}`;
const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, endsWithDisclaimer: desc.endsWith(DISC),
  tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /URA/.test(c.ticker) };
o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
o.checkFields_description = R.checkFields({ description: desc });
o.checkFields_look = R.checkFields({ look: c.look });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
o.checkTerms_disclaimer_only = R.checkTerms({ disclaimer: DISC }, stockTerms);
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
o.jup = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).length, verifiedMatch: arr.some(t => String(t.symbol).toUpperCase() === c.ticker && t.isVerified) };
o.description = desc; o.look = c.look;
console.log(JSON.stringify(o, null, 1));
