const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in TTWO. Not affiliated with Take-Two Interactive Software, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const extra = (process.argv[3] ?? "").split(",").filter(Boolean);
const stockTerms = { stock: ["TTWO", "TTW", "Take-Two", "Take Two", "TakeTwo", "Take2", "Take-Two Interactive", "Take-Two Interactive Software", "T2", "Interactive", "Rockstar", "Rockstar Games", "2K", "2K Games", "Zynga", "Peak", "Peak Games", "Toon Blast", "Toon", "Blast", "Toy Blast", "Cooper", "Cooper Cat", "Bruno", "Bruno Bear", "Wally", "Wally Wolf", "Toon gang", "Grand Theft Auto", "GTA", "Vice City", "Vice", "Leonida", "Lucia", "Grotti", "Cheetah", "Panther", "Borderlands", "Gearbox", "BioShock", "Civilization", "Red Dead", "Mafia", "XCOM", "Strauss", "Zelnick", "Strauss Zelnick", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Match Factory", "FarmVille", "Words With Friends", "Wizard of Oz", "Cowardly Lion", "Nordeus", "Rollic", "NaturalMotion", "Small Giant", "Socialpoint", "Private Division", "skateboard", "red shorts", "red trousers", "gloves", "cape"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","MOGCAT","NUB","PEPE","TTWO","TAKE","GTA","ZNGA","COOPER","MITTENS","GARFIELD","SIMON","GIKO"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasRoot: /^TT|TTWO|TAKE|T2|2K/.test(c.ticker) };
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
