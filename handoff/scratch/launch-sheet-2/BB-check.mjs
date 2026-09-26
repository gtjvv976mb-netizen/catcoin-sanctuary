const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in BB. Not affiliated with BlackBerry, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["BB", "BlackBerry", "Black Berry", "BlackBerry Limited", "Berry", "Bramble", "CrackBerry", "Research In Motion", "RIM", "BBM", "BlackBerry Messenger", "Messenger",
  "QNX", "Cylance", "Certicom", "Waterloo", "John Giamatteo", "Giamatteo", "John Chen", "Mike Lazaridis", "Lazaridis", "Jim Balsillie", "Balsillie",
  "Garfield", "Paws Inc", "Paws", "Odie", "Jon Arbuckle", "Arbuckle", "Jim Davis", "Nermal", "Pooky", "Lasagna", "Monday", "Mondays",
  "Angel Cat Sugar", "Yuko Shimizu", "Shimizu", "Hello Kitty", "Sanrio", "CosCat", "Cos Cat", "Melfin", "Mini Marilyn", "Authentic Brands",
  "Roaring Kitty", "Roaring", "Keith Gill", "Gill", "Jaguar", "Land Rover", "JLR",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole",
  "PlayBook", "Q5", "Q10", "Z10", "KEYone", "KEY2", "Priv", "Passport", "Bold", "Curve", "Torch", "Storm", "Pearl", "Classic", "Leap", "Athena", "Mercury"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","GARFIELD","GARF","ORANGE","GINGER","MARMALADE","BB","BBM","ROAR","ROARING"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasBBRoot: c.ticker.includes("BB") };
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
