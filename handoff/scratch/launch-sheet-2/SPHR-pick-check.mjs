const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in SPHR. Not affiliated with Sphere Entertainment Co., Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["SPHR", "Sphere", "Sphere Entertainment", "Sphere Entertainment Co", "Exosphere", "Sphere Studios", "Orbi", "Orb", "Globe", "MSG", "Madison Square Garden",
  "Dolan", "James Dolan", "Wizard of Oz", "Wizard", "Oz", "Cowardly Lion", "Cowardly", "Lion", "Leo", "Courage", "Brave", "Crown", "King", "Dorothy", "Scarecrow", "Tin Man", "Toto", "Munchkin",
  "Glinda", "Wicked", "Yellow Brick Road", "Emerald City", "Emerald", "Rainbow", "No Place Like Home", "Ruby Slippers", "Goose", "Flerken", "Marvel", "Captain Marvel", "The Marvels", "Autodesk",
  "Postcard from Earth", "Las Vegas", "Vegas", "Venetian", "Encore", "Wynn", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "UON Visuals", "Hello Kitty", "Garfield",
  "Mufasa", "Simba", "Aronofsky", "Warner", "Turner", "Holoplot", "Big Sky", "U2", "Phish", "Eagles", "Bert Lahr", "Lahr", "Judy Garland", "Garland", "Oz Lion", "Zeke"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","GOOSE","LION","SPHR","ORBI","OZ","GARFIELD","KEYCAT","MANEKI","SC","CHESHIRE","LUNA","TOSHI","MOCHI"]);
const cands = [
 { name: "Tousle the Curly-Ruff Cat", ticker: "TOUSLE",
   blurb: "Tousle, a tawny-gold cat with a thick curly russet ruff and honey eyes, lounges in the white garden flowers like it's her stage.",
   look: "A normal four-legged house cat. Solid tawny-gold coat, a thick curly russet ruff around the neck, honey-gold eyes. Wears nothing." },
 { name: "Dusky the Russet Ruff Cat", ticker: "DUSKRUFF",
   blurb: "Dusky, a fluffy ginger-tan cat with a deep russet ruff, cream chin and gold eyes, curls up under the lit arbor for the firefly show.",
   look: "Normal four-legged house cat. Fluffy semi-long solid ginger-tan coat, deep russet ruff, small cream chin, gold eyes. Wears nothing." },
];
const out = { disclosureOnly_checkFields: R.checkFields({ description: DISC }), disclosureOnly_checkTerms: R.checkTerms({ disclaimer: DISC }, stockTerms), results: [] };
for (const c of cands) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /SPH|SPHR|MSG|OZ|LION|ORB/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC), memeBanned: banned.has(c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, description: desc.replace(DISC, ""), look: c.look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  for (const q of [c.ticker]) {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jup = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, symbol: t.symbol, isVerified: t.isVerified, id: t.id })),
      anyVerified: arr.filter(t => t.isVerified).map(t => ({ name: t.name, symbol: t.symbol })) };
    o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  }
  o.description = desc;
  out.results.push(o);
}
console.log(JSON.stringify(out, null, 1));
