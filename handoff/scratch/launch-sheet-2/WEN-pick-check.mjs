const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in WEN. Not affiliated with The Wendy's Company, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["WEN", "WENx", "Wendy", "Wendys", "Wendy's", "The Wendy's Company", "Dave", "Dave Thomas", "Thomas", "Kirk Tanner", "Tanner", "Frosty", "Frost", "Purr", "Purrrma", "Purrma", "Purrrma Frost", "Purrma Frost", "Frosty Frights", "Frights", "Baconator", "Biggie", "Junior", "Jr", "Dave's", "Pretzel", "Where's the beef", "beef", "Fresh", "never frozen", "square", "pigtails", "freckles", "Chilly", "Gilly", "Coldsnap", "Meltin", "Yummy", "Ice Patch", "Boo", "Boo Books", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Dublin", "Ohio", "Quality", "Quality is our recipe", "hamburger", "Hamburgers", "Hot and juicy", "Tim Hortons", "Arby's", "Nelson Peltz", "Peltz", "Trian", "Todd Penegor", "Penegor", "Ken Cook", "Pete Suerken", "Suerken", "Burger King", "flame", "flame-grilled", "Whopper", "Frescolate", "Spicy Nuggs", "Nuggs", "Krabby Patty", "Krabby"] };
const coins = JSON.parse(fs.readFileSync("WEN-coins.json", "utf8"));
const known = new Set(["WEN","WENDY","WENDYS","POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","FROSTY","PURRMA","MANEKI","MIHARU","CATI","BILLY","SC","MOTHER","ZAZU","KITTENWIF","CHEDDAR","CATCOIN","TOSHI","KEYCAT","MEOWKA","GRUMPYCAT","NYANCAT","LILBUB","MARU","PUSHEEN","GARFIELD","SMUDGE","JINX","MOODENG"]);
const out = { disclosure: { text: DISC, checkFields: R.checkFields({ description: DISC }), checkTerms_stock: R.checkTerms({ disclosure: DISC }, stockTerms) }, coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /WEN|WNDY|FROST|PURR/.test(c.ticker), knownCatMeme: known.has(c.ticker), endsWithDisclosure: desc.endsWith(DISC),
    mentionsCatSanctuary: /Cat Sanctuary/.test(c.blurb) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurbOnly = R.checkFields({ blurb: c.blurb });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jup = { status: r.status, results: arr.length, top: arr.slice(0, 10).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })),
      symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })) };
    o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  } catch (e) { o.jupError = String(e); }
  o.description = desc;
  out.coins.push(o);
}
console.log(JSON.stringify(out, null, 1));
