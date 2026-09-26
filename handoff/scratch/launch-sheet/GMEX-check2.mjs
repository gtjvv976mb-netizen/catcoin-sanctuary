const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in GMEx. Not affiliated with GameStop or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Save Point the Tabby", ticker: "SAVEPAWS", blurb: "Save Point, a small brown striped tabby with a cream chest and muzzle, finds the warmest stone in the garden and naps on it until the sun moves on." },
  { name: "Player Two the Kitten", ticker: "PLAYERTWO", blurb: "Player Two, a brown striped tabby kitten with a cream-white bib, trots after anyone in the garden and taps their ankle with a soft paw: surely it is her turn." },
  { name: "Little Yowl the Tabby", ticker: "LILYOWL", blurb: "Little Yowl, a tiny brown striped tabby with a pale cream chest, has the biggest voice in the garden and uses it at dawn, at supper and when a leaf moves." },
];
const stockTerms = { stock: ["GME", "GMEX", "GMEx", "GameStop", "Gamestop xStock", "xStock", "xStocks", "Backed", "Roaring Kitty", "RoaringKitty", "Roaring", "Roar", "Keith Gill", "Keith", "Gill", "DeepFuckingValue", "DFV", "Ryan Cohen", "Cohen", "Cat Quest", "Taco Cats", "Taco", "Chewy", "EB Games", "Game Informer", "ThinkGeek", "Power Up", "PowerUp", "Power Up Rewards", "GameStop Pro", "Ape", "Apes", "Diamond Hands", "HODL", "Moon", "Stonk", "Stonks", "Rambo", "headband", "yarn", "Dumb Money", "Superstonk", "WallStreetBets", "WSB"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","ROAR","ROARING","RK","DFV","GME","GMEX","APE","APES","HODL"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkFields_disclosureOnly = R.checkFields({ description: DISC });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
console.log(JSON.stringify(results, null, 1));
