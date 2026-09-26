const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in RUM. Not affiliated with RUM Group (Rumble), Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["RUM", "RUM Group", "RUM Group Inc", "Rumble", "Rumble Inc", "Rumble Viral", "Rumble Video", "rumblevideo", "rumbledotcom", "Rumble Cloud", "Rumble Wallet", "Rumble Studio", "Rumble Technology", "Rumbl", "Locals", "Quake", "Quake AI", "Chris Pavlovski", "Pavlovski", "Mittens", "Tether", "Northern Data", "CF Acquisition", "Cantor", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Periscope", "Meerkat", "play button", "Hearthstone", "Tallpaw", "Tallstar", "Warriors"] };
const cands = [
 { name: "Hearthbib the Fluffy Cat", ticker: "HEARTHBIB",
   blurb: "Hearthbib, a fluffy brown tabby with a white bib, white front legs and pale green eyes, stands up on her hind legs by the stone hearth.",
   look: "A normal four-legged, slim, fluffy semi-longhair house cat. Brown-grey tabby with dark stripes, a white muzzle blaze, white chest and bib, white front legs and paws, tufted ears and pale green-gold eyes. Stands up on her hind legs to look around. Wears nothing." },
 { name: "Tallpaw the Tabby Cat", ticker: "TALLPAW", blurb: "Tallpaw, a fluffy brown tabby with a white bib, white front legs and pale green eyes, rises on her hind legs to see over everyone.", look: "" },
 { name: "Stilts the Upright Cat", ticker: "STILTPAW", blurb: "Stilts, a slim brown tabby with a white nose blaze and white forepaws, stands straight up on her back legs when the tall grass rustles.", look: "" },
];
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","MOG","MANEKI","WIF","CATWIF","PURR","MEOW","MITTENS","SIMON","GIKO","NUB","SNOWBALL","KEYCAT","MUMU","SC","BILLY","SMOG","HAMMY","SLERF","WEN","CHAT","MOTHER","ZEUS"]);
const out = { disclaimer_checkFields: R.checkFields({ description: DISC }), disclaimer_checkTerms: R.checkTerms({ disclaimer: DISC }, stockTerms), results: [] };
for (const c of cands) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /RUM|RMBL|QUAKE/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC), memeTicker: memeTickers.has(c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, description: desc.replace(DISC, ""), look: c.look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  for (const q of [c.ticker, c.name.split(" ")[0]]) {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o["jup_" + q] = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })), sample: arr.slice(0, 5).map(t => `${t.symbol}|${t.name}|${t.isVerified}`) };
  }
  o.description = desc;
  out.results.push(o);
}
const m = await (await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=RUMsPfFZFnN1ZmGANwP7FNMJMjKH4m9RiMePrtVtLe7`)).json();
out.pairMint = (Array.isArray(m) ? m : []).map(t => ({ name: t.name, symbol: t.symbol, isVerified: t.isVerified, tokenProgram: t.tokenProgram, tags: t.tags, mintAuthority: t.mintAuthority, freezeAuthority: t.freezeAuthority, keys: Object.keys(t).filter(k => /fee|transfer|ext/i.test(k)) }));
console.log(JSON.stringify(out, null, 1));
