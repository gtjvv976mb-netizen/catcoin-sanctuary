import fs from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in IONQ. Not affiliated with IonQ, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(fs.readFileSync(new URL("./IONQ-coins.json", import.meta.url), "utf8"));
const stockTerms = { stock: ["IONQ","IonQ","IonQ Inc","Ion","Ions","Ion Q","Niccolo de Masi","Niccolo","de Masi","Masi","Peter Chapman","Chapman","Chris Monroe","Monroe","Jungsang Kim","Jungsang","Walking Cat","Walking Cat Architecture","Walking","Schrodinger","Schroedinger","Peter Shor","Shor","Harmony","Aria","Forte","Tempo","Superion","Backpack","Backpack Securities","Sunrise","Wormhole","College Park","Hexagon","Quantum","Qubit","Cat State","Harper"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","MOG","MANEKI","HOBBES","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","WIF","BONK","SC","CATI","MOTHER","BOOK","GME","KEYCAT","PUSS","SIGMA","BOPCAT","TABBY","CATCOIN","KITTEN","SCHRODI","SCHRO"]);
const pair = JSON.parse(fs.readFileSync(new URL("../stockcats/stonkfun-pairs.json", import.meta.url), "utf8")).data.pairs.find(p => p.symbol === "IONQ");
const jup = async (q) => { const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`); const j = await res.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []); return { status: res.status, arr }; };
const out = { pair, disclosureOnly: R.checkFields({ description: DISC }), results: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const r = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerRegex: R.TICKER.test(c.ticker), hasStockRoot: /IONQ|ION/.test(c.ticker), catMeme: MEME.has(c.ticker),
    endsWithDisclosure: desc.endsWith("A cat coin priced in IONQ. Not affiliated with IonQ, Backpack Securities or StonkFun. No intrinsic value; not financial advice."),
    checkProposal_nameTickerBlurb: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb }),
    checkFields_fullDescription: R.checkFields({ description: desc }),
    checkProposal_fullDescriptionAsTagline: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc }),
    checkTerms_stock: R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, stockTerms),
    displaySafe: R.displaySafe({ name: c.name, symbol: c.ticker }), description: desc, coat: c.coat };
  for (const q of [c.ticker, c.name.split(" ")[0], c.name]) {
    try { const { status, arr } = await jup(q);
      r[`jup:${q}`] = { status, results: arr.length,
        tickerSymbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })),
        firstWordSymbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.name.split(" ")[0].toUpperCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })),
        verifiedInResults: arr.filter(t => t.isVerified).map(t => `${t.symbol}:${t.name}`) };
    } catch (e) { r[`jup:${q}`] = { error: String(e) }; }
  }
  out.results.push(r);
}
console.log(JSON.stringify(out, null, 1));
