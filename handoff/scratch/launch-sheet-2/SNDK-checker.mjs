const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in SNDK. Not affiliated with Sandisk Corporation, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = [
 {name:"Stash the Cloud-White Cat",ticker:"STASHCAT",blurb:"Stash, a fluffy cloud-white longhair with a flat round face and faint silver ear tips, hides lost garden toys under the porch swing."},
 {name:"Keepsake the Silver-Tipped Cat",ticker:"KEEPSAKE",blurb:"Keepsake, a silver-tipped white longhair with dark-rimmed eyes, naps on a red blanket by the lamp and remembers every lap she knows."},
 {name:"Cache the Snowball Cat",ticker:"CACHEPAW",blurb:"Cache, a round snowball of white fur with a flat little face and pale grey ear tips, tucks treats in flowerpots and always finds them."},
];
const stockTerms = { stock: ["SNDK","SNDKx","Sandisk","SanDisk","Sandisk Corporation","Sand","Disk","Backpack","Backpack Securities","Sunrise","Wormhole","Extreme","Extreme Portable","Ultra","iXpand","Memory Man","Memory Zone","Space to Hold More","More More More","CALLEN","Liz","Pokemon","Mew","Mewtwo","David Goeckeler","Goeckeler","Western Digital","WD","My Passport","Kioxia","Maneki","maneki-neko","Snowball","Snowbell"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","MANEKI","BOOK","PUSSY","GARFIELD","SC","CHEEMS","SIGMA","SNOWCAT","KEYCAT","MOTHER","LUCE","WHITE"]);
const out = { disclosureOnly: R.checkFields({ description: DISC }), coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, endsWithDisclosure: desc.endsWith(DISC),
    tickerFormat: R.TICKER.test(c.ticker), tickerIsStockOrRoot: /SNDK|SANDISK|SAND|DISK/.test(c.ticker), memeTicker: memeTickers.has(c.ticker) };
  o.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_fullDescription = R.checkFields({ name: c.name, symbol: c.ticker, description: desc });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, description: desc }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jup = { status: r.status, results: arr.length,
      symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })),
      sample: arr.slice(0, 6).map(t => `${t.symbol}|${t.name}|${t.isVerified}`) };
    o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  } catch (e) { o.jupError = String(e); }
  o.description = desc;
  out.coins.push(o);
}
console.log(JSON.stringify(out, null, 1));
