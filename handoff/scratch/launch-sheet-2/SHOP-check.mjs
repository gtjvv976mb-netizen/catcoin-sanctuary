const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in SHOP. Not affiliated with Shopify, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["SHOP", "SHOPx", "Shopify", "Shopify Inc", "Shopify Payments", "Shop Pay", "Shopify Pay", "Shop app", "Shopify Plus", "Shopify Capital", "Shopify Markets",
  "Shopify Fulfillment Network", "Arrive", "Snowdevil", "Oberlo", "Deliverr", "6 River Systems", "Burst", "Sidekick", "Polaris", "Hydrogen", "Oxygen", "Linkpop", "Handshake", "Shoppy",
  "Tobias Lutke", "Tobi Lutke", "Lutke", "Tobi", "Fiona McKean", "McKean", "Daniel Weinand", "Weinand", "Scott Lake", "Harley Finkelstein", "Finkelstein",
  "Sanrio", "Hello Kitty", "Pusheen", "Kitty Poo Club", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Stripe", "Kraft", "Ruby on Rails"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","ROAR","ROARING","SHOP","SHOPX","SHOPIFY","HODL"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasShopRoot: c.ticker.includes("SHOP") };
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
