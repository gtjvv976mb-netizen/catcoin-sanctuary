const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in FLY. Not affiliated with Firefly Aerospace, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["FLY", "Firefly", "Firefly Aerospace", "Fire fly", "firefl", "Alpha", "Eclipse", "Blue Ghost", "Ghost", "Elytra", "SciTec", "Reaver", "Lightning", "Miranda", "Duckner", "duck", "ducky", "Jason Kim", "Markusic", "Tom Markusic", "Polyakov", "Max Polyakov", "Northrop", "Northrop Grumman", "Grumman", "Cedar Park", "Leander", "Ocula", "Victus", "Backpack", "Backpack Securities", "Sunrise", "Ghost Riders", "Noise of Summer", "To The Black", "DREAM", "glow", "glowing", "lightning bug", "glowworm", "blink", "lantern", "flicker", "ember", "spark", "flame", "fire"] };
const banned = new Set(["FLY","FIREFLY","POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","ROAR","ROARING","APE","HODL","MOONCAT","SPACECAT"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasFlyRoot: c.ticker.includes("FLY") };
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
