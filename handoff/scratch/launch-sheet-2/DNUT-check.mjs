const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in DNUT. Not affiliated with Krispy Kreme, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["DNUT", "Krispy Kreme", "Krispy", "Kreme", "Krispy Skreme", "Skreme", "Kreme Filling", "Original Glazed", "Hot Now", "Hot Light", "Doughnut Theatre", "Insomnia Cookies", "Insomnia",
  "Abra Cat Dabra", "Abra", "Dabra", "Scaredy Cat", "Scaredy", "Black Cat Choco", "Black Thunder", "Mister Donut",
  "Hello Kitty", "Kitty", "Sanrio", "Kuromi", "Cinnamoroll", "Pochacco", "My Melody", "Pompompurin", "Cringer", "Battle Cat", "He-Man", "He Man", "Masters of the Universe", "Grayskull", "Skeletor",
  "Pokemon", "Pikachu", "Meowth", "Kit Kat", "KitKat",
  "Charlesworth", "Josh Charlesworth", "Alison Holder", "Holder", "Vernon Rudolph", "Rudolph", "JAB",
  "Donut", "Doughnut", "Dnut",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","DNUT","DONUT","KRISPY","KREME","GLAZED"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasDnutRoot: /DNUT|DONUT|KK|KRIS|KREM/.test(c.ticker) };
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
