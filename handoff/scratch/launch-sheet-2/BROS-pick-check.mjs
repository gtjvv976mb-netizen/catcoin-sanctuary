const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in BROS. Not affiliated with Dutch Bros, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["BROS", "BRO", "Dutch Bros", "Dutch Bros Inc", "Dutch", "Bros", "Dutch Bros Coffee", "Dutch Brothers", "Broista", "Broistas", "Dutch Pup", "Dutch Buddy", "Dutch Luxury", "Dutch at Home", "Dutch Mafia", "Dutch Bros Records", "Laser Cat", "Laser", "Tiger's Blood", "Tigers Blood", "Rad Tiger", "Tiger", "Tuxedo", "Rebel", "Blue Rebel", "Golden Eagle", "Annihilator", "Kicker", "Caramelizer", "Soft Top", "Starry Night", "Vampire Slayer", "Astronaut", "Cotton Candy", "Windmill", "Boersma", "Travis Boersma", "Travis", "Dane Boersma", "Christine Barone", "Christine", "Barone", "Grants Pass", "Oregon", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Coffee", "Espresso", "Latte", "Mocha", "Frost", "Brew", "Drive-Thru", "Records", "Sticker of the Month", "SOTM", "Dutch Bros Rewards"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","MOG","MANEKI","HOBBES","WIF","CATWIF","MEOW","PURR","SIMON","GIKO","NUB","SNOWBALL","ROAR","ROARING","SC","CHAT","MOCHI","MANEKI","SIGMA","MOTHER","MAGA","CWIF","TOSHI","BOOCAT","GME","KEYCAT","SPX","SHIB","BONK","WEN","PONKE","MYRO","HAMMY","LOCKIN","BENTO","CATDOG","MANEKINEKO","BILLY","NEIRO","TABBY","BRISTLE","NUBCAT","PUSS"]);
// all tickers in other sheets
const others = [];
for (const dir of ["launch-sheet", "launch-sheet-2"]) {
  const d = `/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/${dir}`;
  for (const f of fs.readdirSync(d)) if (/pick.*\.json$|launch-sheet\.json$/.test(f) && !f.startsWith("BROS")) {
    try { const t = fs.readFileSync(`${d}/${f}`, "utf8"); for (const m of t.matchAll(/"ticker"\s*:\s*"([A-Z0-9]+)"/g)) others.push([m[1], `${dir}/${f}`]); } catch {}
  }
}
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    asciiOnly: /^[\x20-\x7E]*$/.test(desc + c.name), tickerFormat: R.TICKER.test(c.ticker),
    tickerHasStockRoot: /BRO|DUTCH/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC), memeTicker: memeTickers.has(c.ticker),
    dupElsewhere: others.filter(([t]) => t === c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb = R.checkFields({ blurb: c.blurb });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look ?? "" }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  for (const q of [c.ticker, ...(c.extraQueries ?? [])]) {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    (o.jup ??= {})[q] = { status: r.status, results: arr.length,
      all: arr.slice(0, 8).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, holders: t.holderCount, mcap: Math.round(t.mcap ?? 0) })),
      symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
    o.jup[q].verifiedMatch = o.jup[q].symbolMatches.some(t => t.isVerified === true);
  }
  o.description = desc;
  results.push(o);
}
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), othersCount: others.length, results }, null, 1));
