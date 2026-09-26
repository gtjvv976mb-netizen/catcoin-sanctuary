const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in FWDI. Not affiliated with Forward Industries, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["FWDI","FWD","Forward","Forward Industries","Forward Industries, Inc","Forward US","FORD","Koszegi","Intelligent Product Solutions","IPS","Kablooe",
  "Kyle Samani","Samani","Michael Pruitt","Pruitt","Terence Wise","Multicoin","Galaxy","Jump Crypto","Solana","SOL","Sanctum","fwdSOL","Quantum Purple","Backpack","Backpack Securities",
  "Sunrise","Wormhole","Superstate","DoubleZero","Brazier","Ryan Navi","Saurabh Sharma","Sangita Shah","Michael Ashe","SkyAI","Brera","PURR","Nasdaq","Russell","C/M Capital"] };
const memeTickers = new Set(["FWDI","FWD","FORD","SOL","POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","CATDOG","CHEEMS","BILLY","MOTHER","SC","GME","PEPE","CATE","WEN","MANEKI","TOSHI","KEYCAT","CATI","SMOG","LUCE"]);
const pick = {
  name: "Satchel the Ginger-Point Cat", ticker: "CASENAP",
  blurb: "Satchel, a small cream cat with a ginger face, ears, paws and tail and blue eyes, naps in an old carrying case by the greenhouse door.",
  look: "A normal four-legged, small, short-haired house cat: cream body with ginger points (face mask, ears, paws and tail) and blue eyes, wearing nothing. It naps inside an open, soft-sided carrying case by the greenhouse door, a nod to the company's carrying-case business (discontinued, per its FY2025 10-K).",
  coat: { base: "#F3E7D3", second: "#D97E3A", pattern: "point", eyes: "#79B4E3" },
};
const drafts = JSON.parse(fs.readFileSync("FWDI-coins.json", "utf8"));
async function jup(t) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${t}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  const m = arr.filter(x => String(x.symbol).toUpperCase() === t).map(x => ({ symbol: x.symbol, name: x.name, isVerified: x.isVerified, id: x.id }));
  return { status: r.status, results: arr.length, symbolMatches: m, verifiedMatch: m.some(x => x.isVerified === true) };
}
async function check(c) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, descOk: desc.length <= 280, nameOk: c.name.length <= 32,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /FWD|FORWARD|FORD|SOL/.test(c.ticker), memeTicker: memeTickers.has(c.ticker), endsWithDisclosure: desc.endsWith(DISC) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  if (c.look) o.checkFields_look = R.checkFields({ look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look ?? "" }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  o.jup = await jup(c.ticker);
  o.description = desc;
  return o;
}
const out = { disclosureOnly: R.checkFields({ description: DISC }), disclosureLen: DISC.length, pick: await check(pick), drafts: [] };
for (const d of drafts) out.drafts.push(await check(d));
out.pickCoat = pick.coat; out.pickLook = pick.look;
console.log(JSON.stringify(out, null, 1));
