const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in BOEING. Not affiliated with The Boeing Company, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const extra = (process.argv[3] ?? "").split(",").filter(Boolean);
const stockTerms = { stock: ["BOEING", "Boeing", "The Boeing Company", "Boeing Company", "BA", "Bo", "Bill Boeing", "William Boeing", "Ortberg", "Kelly Ortberg", "Calhoun", "Muilenburg", "McNerney", "Condit",
  "Dreamliner", "Jumbo", "Jumbo Jet", "747", "737", "757", "767", "777", "787", "MAX", "737 MAX", "Starliner", "Apache", "Chinook", "Osprey", "Stingray", "Condor", "Poseidon", "Pegasus", "Wedgetail",
  "Stratoliner", "Stratocruiser", "Stratofortress", "Stratotanker", "Stratojet", "Superfortress", "Flying Fortress", "Clipper", "Globemaster", "Super Hornet", "Hornet", "Strike Eagle", "Eagle",
  "Ghost Bat", "Loyal Wingman", "Wingman", "Phantom Works", "ScanEagle", "Insitu", "Orca", "Echo Voyager", "Jeppesen", "Aviall", "Spirit AeroSystems", "Air Force One",
  "Everett", "Renton", "Seattle", "Arlington", "Kitty Hawk", "Hello Kitty", "Sanrio", "EVA Air", "Lion Air", "Lion", "Tarco", "Louisville", "Muhammad Ali", "Wes England", "England", "RDU", "Raleigh",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","BA","BOEING","BO","JUMBO"]);
const results = [];
for (const c of [...coins, ...extra.map(t => ({ name: "Check the Cat", ticker: t, blurb: "ticker-only check for an alternate symbol." }))]) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasRoot: /BA|BOE|BOEING/.test(c.ticker) };
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
