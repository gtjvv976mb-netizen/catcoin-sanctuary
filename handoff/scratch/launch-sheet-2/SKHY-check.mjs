const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in SKHY. Not affiliated with SK hynix, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(process.argv[2]);
const extra = (process.argv[3] ?? "").split(",").filter(Boolean);
const stockTerms = { stock: ["SKHY", "SKHYV", "SKHYNIX", "SK hynix", "hynix", "SK", "SK Group", "SK Square", "Solidigm", "Backpack", "Backpack Securities", "Sunrise", "Wormhole",
  "Chik", "Chilk", "Hanyang", "Hanyangi", "Haru", "Habimi", "Song Ha-young", "Hayoung", "Kwak Noh-jung", "Kwak", "Chey Tae-won", "Chey", "Icheon", "Semicraft", "HBM", "DDR5", "SOCAMM", "fromis", "Hitactic"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","SKHY","SKHYV","HYNIX","KEYCAT","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","MOGCAT","SC","NUB","PEPE","GINGER"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerStartsSK: c.ticker.startsWith("SK") };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkFields_fullDescription = R.checkFields({ name: c.name, symbol: c.ticker, description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.memeBanned = banned.has(c.ticker);
  out.jup = await jup(c.ticker);
  out.description = desc;
  results.push(out);
}
async function jup(t) {
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${t}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    const m = arr.filter(x => String(x.symbol).toUpperCase() === t).map(x => ({ symbol: x.symbol, name: x.name, isVerified: x.isVerified, id: x.id }));
    return { status: r.status, results: arr.length, symbolMatches: m.length, verifiedMatch: m.some(x => x.isVerified === true), matches: m.slice(0, 5) };
  } catch (e) { return { error: String(e) }; }
}
const alt = {}; for (const t of extra) alt[t] = await jup(t);
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), results, alt }, null, 1));
