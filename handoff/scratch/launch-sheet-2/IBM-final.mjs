const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in IBM. Not affiliated with IBM, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["IBM", "IBMx", "International Business Machines", "International Business", "Business Machines", "Big Blue", "Blue",
  "Watson", "watsonx", "Red Hat", "Shadowman", "Informix", "IDS", "Cheetah", "DB2", "Arvind Krishna", "Arvind", "Krishna", "Think", "ThinkPad", "Deep Blue", "Blue Brain",
  "Markram", "Almaden", "Modha", "SyNAPSE", "TrueNorth", "NorthPole", "Granite", "Qiskit", "Heron", "Condor", "Eagle", "Osprey", "Nighthawk", "Starling", "Loon",
  "Telum", "Spyre", "Kyndryl", "HashiCorp", "Lotus", "Cognos", "Tivoli", "WebSphere", "Selectric", "Rometty", "Gerstner", "Palmisano", "Armonk", "Cortex",
  "Tabulating", "Hollerith", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Hello Kitty", "Kitty", "Dash", "DoorDash"] };
const c = { name: "Tally the Sand-Spotted Cat", ticker: process.argv[2] || "TALLYSPOT",
  blurb: "Tally, a lean sandy-gold cat with black spots, dark tear-marks and a white-tipped tail, counts the pond's goldfish each morning and never misses one." };
const desc = `${c.blurb} ${DISC}`;
const o = { ...c, description: desc, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerFormat: R.TICKER.test(c.ticker),
  tickerHasIBM: /IBM/.test(c.ticker), doubleSpace: /  /.test(desc), endsWithDisc: desc.endsWith(DISC) };
o.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
o.checkFields_all = R.checkFields({ name: c.name, symbol: c.ticker, description: desc });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, description: desc.slice(0, -DISC.length) }, stockTerms);
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
for (const q of [c.ticker, "TALLY", "TALLYPAW"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  o["jup_" + q] = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === q).map(t => ({ s: t.symbol, n: t.name, v: t.isVerified ?? null })),
    verifiedSymbolMatch: arr.some(t => String(t.symbol).toUpperCase() === q && t.isVerified === true), verifiedAny: arr.filter(t => t.isVerified).map(t => `${t.symbol}|${t.name}`) };
}
console.log(JSON.stringify(o, null, 1));
