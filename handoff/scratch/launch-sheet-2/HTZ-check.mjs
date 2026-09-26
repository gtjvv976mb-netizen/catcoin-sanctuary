const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in HTZ. Not affiliated with Hertz Global Holdings, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["HTZ", "Hertz", "Hertz Global Holdings", "Hertz Global", "Hertz Corporation", "The Hertz Corporation", "Hz", "HTZx",
  "Dollar", "Dollar Rent A Car", "Thrifty", "Thrifty Car Rental", "Firefly", "Firefly Car Rental", "Hertz Car Sales", "Gold Plus", "Gold Plus Rewards", "Gold Squad", "Golden Retriever", "Golden",
  "Horatio", "Gil West", "Stephen Scherr", "Scherr", "John Hertz", "Jamie Lee Curtis", "Arnold Palmer", "Palmer", "Simpson", "Carl Icahn", "Icahn", "Common Sensei", "Mikey Day",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Tesla", "Polestar", "Shelby", "Mustang", "Jaguar", "Panther", "Pink Panther", "Hello Kitty", "Garfield", "Yellow Cab",
  "Rent-a-Racer", "ExpressRent", "Ultimate Choice", "Estero", "Uber", "Avis", "Enterprise", "Bobcat"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","ROAR","ROARING","HTZ","HERTZ","HODL"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasAmcRoot: c.ticker.includes("AMC") };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
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
