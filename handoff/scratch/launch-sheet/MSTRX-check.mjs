const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in MSTRx. Not affiliated with Strategy Inc. (MicroStrategy) or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Trinket the Tortie Cat", ticker: "TRINKETCAT", blurb: "Trinket, a round fluffy tortoiseshell, adds one shiny pebble a day to her secret pile under the garden shed and has never given one back." },
  { name: "Coffer the Vault Cat", ticker: "COFFERCAT", blurb: "Coffer, a stocky slate-grey shorthair with copper eyes, sits square by the shed door all day like a little locked strongbox." },
  { name: "Tally the Tabby", ticker: "TALLYCAT", blurb: "Tally, a silver tabby with eye rings like tiny round glasses, counts every bird, bee and falling leaf in the garden and never loses count." },
];
const stockTerms = { stock: ["MSTR", "MSTRX", "MSTRx", "MicroStrategy", "Micro Strategy", "Strategy", "Strategy Inc", "MicroStrategy xStock", "xStock", "xStocks", "Backed",
  "Saylor", "Michael Saylor", "Phong Le", "Hank", "PetsofMSTR", "MSTRPetoftheWeek", "Big Boy Romeo", "Romeo", "Deetolai", "MiKe", "Mike",
  "STRK", "STRF", "STRD", "STRC", "STRE", "Strike", "Strife", "Stride", "Stretch", "Stream", "HyperIntelligence", "Intelligence Everywhere", "ModernAnalytics",
  "bitcoin", "BTC", "sats", "satoshi", "orange pill", "laser eyes", "Calacanis", "Speculative Cat", "dead cat bounce", "labrador", "lab"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MSTR","MSTRX","STR","STRAT"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker);
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
  const j = await r.json();
  const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  out.jupStatus = r.status; out.jupResults = arr.length;
  out.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified }));
  out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  out.description = desc;
  results.push(out);
}
console.log(JSON.stringify(results, null, 1));
