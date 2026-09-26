const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in FLWS. Not affiliated with 1-800-Flowers, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const DISC_LEGAL = "A cat coin priced in FLWS. Not affiliated with 1-800-FLOWERS.COM, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["FLWS", "FLW", "1-800-Flowers", "1800flowers", "1-800-FLOWERS.COM", "800-Flowers", "Flowers", "Fabulous Feline", "Fabulous", "Purrfect", "Purrfect Party Cat", "Cure-All Kitty", "Magical Fairy Cat", "Seaside Mermaid Cat", "Luau Kitty", "Purrfect Potions", "Caroling Cat", "a-DOG-able", "adogable", "Hello Kitty", "Harry & David", "Cheryl's", "Shari's Berries", "PersonalizationMall", "Things Remembered", "1-800-Baskets", "Celebrations Passport", "Celebrations", "Petal Talk", "Jim McCann", "McCann", "Chris McCann", "Villagomez", "Kittenish", "Jessie James Decker", "Pete the Cat", "Backpack", "Backpack Securities", "Sunrise", "Jericho", "Carnation Milk"] };
const banned = new Set(["FLWS","POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","ROAR","HODL","SNOW","WHITE"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasFlwRoot: /FLW|FLOWER/.test(c.ticker) };
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
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), disclosureLegalName: R.checkFields({ description: DISC_LEGAL }), results }, null, 1));
