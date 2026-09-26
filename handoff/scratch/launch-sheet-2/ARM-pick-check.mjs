import fs from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in ARM. Not affiliated with Arm Holdings, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(fs.readFileSync(new URL("./ARM-coins.json", import.meta.url), "utf8"));
const stockTerms = { stock: ["ARM","Arm","Arm Holdings","Arm Holdings plc","Holdings","Arms","Rene Haas","Haas","SoftBank","Masayoshi Son","Cortex","Neoverse","Mali","Immortalis","Ethos","Kleidi","Valhall","Panthor","Panther","Ice Cave","IceCave","Phoenix","RealtimeUK","Unity","Unite","Mengot","Cambridge","Acorn","RISC","Exynos","Samsung","Cheetah","Lion","Leopard","Lynx","Tiger","Tigress","Mousr","Garfield","Backpack","Backpack Securities","Sunrise","Wormhole","Stripe","OnlyMarms"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","MOG","MANEKI","HOBBES","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","WIF","BONK","SC","CATI","MOTHER","BOOK","GME","KEYCAT","MAGA","PUSS","SIGMA","BOPCAT","TABBY","CATCOIN","MANEKINEKO","GRUMPYCAT","SMUDGE","CHEEMS","MOCHI","OGGY","BONGO","KITTEN","KITTENS","TIGER"]);
const out = { disclosureOnly_checkFields: R.checkFields({ description: DISC }), results: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const r = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerRegex: R.TICKER.test(c.ticker), hasStockRoot: /ARM/.test(c.ticker), catMeme: MEME.has(c.ticker),
    endsWithDisclosure: desc.endsWith("No intrinsic value; not financial advice."),
    checkProposal_nameTickerBlurb: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb }),
    checkFields_fullDescription: R.checkFields({ description: desc }),
    checkProposal_fullDescriptionAsTagline: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc }),
    checkTerms_stock: R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, stockTerms),
    displaySafe: R.displaySafe({ name: c.name, symbol: c.ticker }), description: desc };
  for (const q of [c.ticker, c.name.split(" ")[0]]) {
    try {
      const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
      const j = await res.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
      r[`jup_${q}`] = { status: res.status, results: arr.length,
        symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })),
        verifiedSymbolMatch: arr.some(t => t.isVerified && String(t.symbol).toUpperCase() === c.ticker),
        sample: arr.slice(0, 5).map(t => `${t.symbol}/${t.name}/${t.isVerified}`) };
    } catch (e) { r[`jup_${q}`] = { error: String(e) }; }
  }
  out.results.push(r);
}
console.log(JSON.stringify(out, null, 1));
