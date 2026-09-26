const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in RBLX. Not affiliated with Roblox Corporation, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["RBLX", "RBLXx", "Roblox", "Roblox Corporation", "Roblox Corp", "Robux", "Rthro", "Bloxy", "Blox", "Builderman", "Baszucki", "David Baszucki", "Cassel",
  "Business Cat", "Sir Meows A Lot", "Meows", "DenisDaily", "Denis", "Tabbs", "Sergeant Tabbs", "Sergeant", "Medic Lily", "Lily", "Commander Laika", "Laika", "Blue Collar Cat",
  "Cats in Space", "Cuddly Cat", "Krazy Kitty", "Kitty", "Cheshire", "Nyan", "TPS", "TPS report", "right meow", "Mondays", "Hello Kitty", "Sanrio", "Cinnamoroll", "Rock Panda",
  "Adopt Me", "Exclusible", "nickjupiters", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Garfield", "Oof", "Cat Mascot", "Business", "office", "boss", "report", "Monday"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","BIZCAT","BUSINESS","BUSCAT","TPS","MEOWS","SIGMA","CHILLCAT","SCF","MANEKI","GME","KEYCAT","SMOG","CWIF","MUMU","NUB","TOONCAT","LILBUB","MARU","HELLOKITTY"]);
const coins = [
 { name: "Tartan the Yellow-Tie Cat", ticker: "TARTANPAW", blurb: "Tartan, a sleek jet-black cat with round lemon-yellow eyes, wears a yellow plaid necktie and sits up straight on the sunny garden bench.",
   look: "A normal four-legged, sleek, slim jet-black shorthair with no markings and round lemon-yellow eyes. Wears a yellow collar with a yellow plaid necktie and sits upright, as the reopened source item does." },
 { name: "Inkwell the Black Necktie Cat", ticker: "INKPAW", blurb: "Inkwell, a slim glossy-black shorthair with bright yellow eyes, a yellow collar and a plaid tie, keeps a calm watch over the garden gate.", look: "" },
 { name: "Mustard the Black Cat", ticker: "MUSTIE", blurb: "Mustard, a small black cat with golden eyes, naps in the warm grass by the pond with his yellow plaid tie tugged loose after a long day.", look: "" },
];
const out = { disclaimer_checkFields: R.checkFields({ disclaimer: DISC }), disclaimer_checkTerms: R.checkTerms({ disclaimer: DISC }, stockTerms), coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerFormat: R.TICKER.test(c.ticker),
    tickerHasStockRoot: /RBLX|ROBL|BLOX|ROBUX/.test(c.ticker), memeTicker: memeTickers.has(c.ticker), endsWithDisclaimer: desc.endsWith(DISC) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_look = R.checkFields({ look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  for (const q of [c.ticker]) {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jup = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })),
      sample: arr.slice(0, 5).map(t => `${t.symbol}|${t.name}|${t.isVerified}`) };
    o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  }
  o.description = desc;
  out.coins.push(o);
}
console.log(JSON.stringify(out, null, 1));
