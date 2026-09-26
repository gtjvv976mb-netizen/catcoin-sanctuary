const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in IBM. Not affiliated with IBM, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["IBM", "IBMx", "International Business Machines", "International Business", "Business Machines", "Big Blue", "Blue",
  "Watson", "watsonx", "Red Hat", "Shadowman", "Informix", "IDS", "Cheetah", "DB2", "Arvind Krishna", "Arvind", "Krishna", "Think", "ThinkPad", "Deep Blue", "Blue Brain",
  "Markram", "Almaden", "Modha", "SyNAPSE", "TrueNorth", "NorthPole", "Granite", "Qiskit", "Heron", "Condor", "Eagle", "Osprey", "Nighthawk", "Starling", "Loon",
  "Telum", "Spyre", "Kyndryl", "HashiCorp", "Lotus", "Cognos", "Tivoli", "WebSphere", "Selectric", "Rometty", "Gerstner", "Palmisano", "Armonk", "Cortex",
  "Tabulating", "Computing-Tabulating-Recording", "Hollerith", "Watson Sr", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Hello Kitty", "Kitty", "Dash", "DoorDash"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","MANEKINEKO","PEPE","GARF","KEYBOARD","MAXWELL","HUHCAT","SMUGCAT","GRUMP","BONGO","CHEEMS"]);
const coins = [
  { name: "Dash the Golden-Spotted Cat", ticker: "DASHSPOT", blurb: "Dash, a lean, long-legged golden shorthair with round black spots and dark tear-lines under honey-gold eyes, sprints the lawn end to end, then naps." },
  { name: "Ponder the Tawny Spotted Cat", ticker: "PONDERPAW", blurb: "Ponder, a tawny spotted cat with a cream belly and a black-ringed, white-tipped tail, sits on the sundial for hours guessing where the next moth lands." },
  { name: "Tally the Sand-Spotted Cat", ticker: "TALLYPAW", blurb: "Tally, a sandy-gold cat dotted with small black spots, dark tear-marks and small round ears, counts the pond's goldfish each morning and never misses one." },
  { name: "Tally the Sand-Spotted Cat", ticker: "TALLYSPOT", blurb: "Tally, a sandy-gold cat dotted with small black spots, dark tear-marks and small round ears, counts the pond's goldfish each morning and never misses one." },
];
const out = { discLen: DISC.length, disclosureOnly: R.checkFields({ description: DISC }), results: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasIBM: /IBM/.test(c.ticker), doubleSpace: /  /.test(desc), endsWithDisc: desc.endsWith(DISC), memeTicker: memeTickers.has(c.ticker) };
  o.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_all = R.checkFields({ name: c.name, symbol: c.ticker, description: desc });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jupStatus = r.status; o.jupResults = arr.length;
    o.jupSymbolMatches = arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    o.jupVerifiedSymbolMatch = o.jupSymbolMatches.some(t => t.isVerified === true);
    o.jupVerifiedAnyResult = arr.filter(t => t.isVerified).map(t => `${t.symbol}|${t.name}`);
  } catch (e) { o.jupError = String(e); }
  o.description = desc;
  out.results.push(o);
}
console.log(JSON.stringify(out, null, 1));
