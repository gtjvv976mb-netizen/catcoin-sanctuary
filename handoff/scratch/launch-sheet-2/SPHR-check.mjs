const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in SPHR. Not affiliated with Sphere Entertainment Co., Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["SPHR", "Sphere", "Sphere Entertainment", "Sphere Entertainment Co", "Exosphere", "Sphere Studios", "Orbi", "Orb", "Globe", "MSG", "Madison Square Garden",
  "Dolan", "James Dolan", "Wizard of Oz", "Wizard", "Oz", "Cowardly Lion", "Cowardly", "Lion", "Courage", "Crown", "King", "Dorothy", "Scarecrow", "Tin Man", "Toto", "Munchkin",
  "Glinda", "Wicked", "Yellow Brick Road", "Emerald City", "Emerald", "Rainbow", "No Place Like Home", "Goose", "Flerken", "Marvel", "Captain Marvel", "The Marvels", "Autodesk",
  "Postcard from Earth", "Las Vegas", "Vegas", "Venetian", "Encore", "Wynn", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "UON Visuals", "Hello Kitty", "Garfield",
  "Mufasa", "Simba", "Aronofsky", "Warner", "Turner", "Holoplot", "Big Sky", "U2", "Phish", "Eagles"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","GOOSE","LION","SPHR","ORBI","OZ"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasSphrRoot: /SPHR|SPH/.test(c.ticker) };
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
