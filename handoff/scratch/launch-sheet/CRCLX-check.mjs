const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in CRCLx. Not affiliated with Circle or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Doughball the Bowler Cat", ticker: "DOUGHBALL", blurb: "Doughball, a plump black-and-white cat in a tiny brown felt bowler hat, waddles between the herb beds and naps in any sunny flowerpot big enough to hold him." },
  { name: "Tuppence the Tweed Cat", ticker: "TUPPENCE", blurb: "Tuppence, a tubby silver tabby in a flat tweed cap, strolls the garden path each morning, then settles on the warm bench to watch the bees go by." },
  { name: "Porridge the Sun Hat Cat", ticker: "PORRIDGE", blurb: "Porridge, a chubby oat-coloured cat with a white bib and a wide straw sun hat, dozes in the pumpkin patch and wakes only when a treat bag rustles." },
];
const stockTerms = { stock: ["CRCL", "CRCLX", "CRCLx", "Circle", "Circle Internet", "Circle Internet Group", "Circle xStock", "xStock", "xStocks", "Backed", "USDC", "USD Coin", "EURC", "Arc", "Jeremy Allaire", "Allaire", "Fat Cat Bat Rat", "Fat Cat", "Bat Rat", "Cat Bat Hat", "FatCatBatRatWifHat", "Wif", "WifHat", "UpSideDownCat", "USDCat", "ARCAT", "Argus Cat", "Argus", "BEANCAT", "Bean Cat", "CashCat", "COOL", "Chelsea", "Stable", "Stablecoin"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","USDC","CRCL","CRCLX","ARCAT","BEANCAT","CASHCAT","COOL","FATCAT","WIF"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified ?? false, tags: t.tags, id: t.id }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true || (t.tags||[]).includes("verified"));
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), results }, null, 1));
