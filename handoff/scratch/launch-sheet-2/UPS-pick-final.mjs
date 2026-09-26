const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in UPS. Not affiliated with United Parcel Service, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["UPS", "United Parcel Service", "United Parcel", "Parcel", "United", "American Messenger", "American Messenger Company", "Merchants Parcel Delivery",
  "Brown", "Big Brown", "Pullman", "Pullman Brown", "What can Brown do for you", "Worldport", "Louisville", "Sandy Springs", "Seattle",
  "Casey", "James Casey", "Jim Casey", "Claude Ryan", "Ryan", "Soderstrom", "Tome", "Carol Tome", "Abney", "Mail Boxes Etc", "The UPS Store", "UPS Store", "Ground Saver", "SurePost", "Blue Label Air", "MaxiCode", "ORION", "UPS Sans",
  "Yamato", "Kuroneko", "Takkyubin", "Allied", "Allied Van Lines", "Backpack", "Backpack Securities", "Sunrise", "Wormhole",
  "Bubble Wrap", "Sealed Air", "shield", "brown shield", "package car", "Next Day Air", "Worldwide Express", "Saver"] };
const c = { name: "Waybill the Label-Bib Cat", ticker: "WAYBILL",
  blurb: "Waybill, a slate-grey cat with a square white bib like a shipping label and four white socks, waits by the garden gate each morning.",
  look: "A normal four-legged shorthair house cat. Slate-grey and white bicolor with a square white chest patch like a shipping label, four white socks and honey-gold eyes. Wears nothing." };
const desc = `${c.blurb} ${DISC}`;
const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerFormat: R.TICKER.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC) };
o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkFields_description = R.checkFields({ description: desc });
o.checkFields_disclaimerOnly = R.checkFields({ description: DISC });
o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`); const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
o.jup = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).length, verifiedMatch: arr.some(t => String(t.symbol).toUpperCase() === c.ticker && t.isVerified === true) };
const r2 = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=Waybill`); const j2 = await r2.json();
o.jupNameSearch = (Array.isArray(j2) ? j2 : []).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified }));
o.description = desc;
console.log(JSON.stringify(o, null, 1));
