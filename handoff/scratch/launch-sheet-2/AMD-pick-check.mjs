import fs from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in AMD. Not affiliated with Advanced Micro Devices, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet-2/AMD-coins.json", "utf8"));
const stockTerms = { stock: ["AMD","Advanced Micro Devices","Advanced Micro","Micro Devices","Lisa Su","Jaguar","Bobcat","Bob cat","Puma","Lynx","Catalyst","Radeon","Ryzen","EPYC","Opteron","Athlon","Instinct","Threadripper","Xilinx","ATI","Zen","Brazos","Trinity","Hondo","Piledriver","Steamroller","Kabini","Temash","Beema","Mullins","Llano","Carrizo","Amuse","Stability","PS4","PlayStation","Xbox","Sony","Microsoft","Cray","Pensando","Versal","Backpack","Backpack Securities","Sunrise","Wormhole","Santa Clara"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","MOG","MANEKI","HOBBES","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","WIF","BONK","SC","CATI","MOTHER","BOOK","GME","KEYCAT","MAGA","PUSS","SIGMA","BOPCAT","TABBY","CATCOIN"]);
const out = { disclosureOnly: R.checkFields({ description: DISC }), results: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const r = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerRegex: R.TICKER.test(c.ticker), hasStockRoot: /AMD/.test(c.ticker), catMeme: MEME.has(c.ticker),
    endsWithDisclosure: desc.endsWith("No intrinsic value; not financial advice."),
    checkProposal: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb }),
    checkFields_blurb_look: R.checkFields({ name: c.name, symbol: c.ticker, blurb: c.blurb }),
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
        verifiedSymbols: arr.filter(t => t.isVerified).map(t => t.symbol) };
    } catch (e) { r[`jup_${q}`] = { error: String(e) }; }
  }
  out.results.push(r);
}
console.log(JSON.stringify(out, null, 1));
