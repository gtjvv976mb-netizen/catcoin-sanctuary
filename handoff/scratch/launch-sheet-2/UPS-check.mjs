const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in UPS. Not affiliated with United Parcel Service, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const extra = (process.argv[3] ?? "").split(",").filter(Boolean);
const stockTerms = { stock: ["UPS", "United Parcel Service", "United Parcel", "Parcel", "United", "American Messenger", "American Messenger Company", "Merchants Parcel Delivery",
  "Brown", "Big Brown", "Pullman", "Pullman Brown", "What can Brown do for you", "Worldport", "Louisville", "Sandy Springs", "Seattle",
  "Casey", "James Casey", "Jim Casey", "Claude Ryan", "Ryan", "Soderstrom", "Tome", "Carol Tome", "Abney", "Mail Boxes Etc", "The UPS Store", "UPS Store", "Ground Saver", "SurePost", "Blue Label Air", "MaxiCode", "ORION", "UPS Sans",
  "Yamato", "Kuroneko", "Takkyubin", "Allied", "Allied Van Lines",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","UPS","KURONEKO","BROWN"]);
const results = [];
for (const c of [...coins, ...extra.map(t => ({ name: "Check the Cat", ticker: t, blurb: "ticker-only check for an alternate symbol." }))]) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasRoot: c.ticker.includes("UPS") };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.memeBanned = banned.has(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), results }, null, 1));
