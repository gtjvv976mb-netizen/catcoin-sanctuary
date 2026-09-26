import { writeFileSync } from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/GLDX-verify";
const DISC = "A cat coin priced in GLDx. Not affiliated with SPDR Gold Trust, State Street, World Gold Council or StonkFun. No intrinsic value; not financial advice.";
const coins = [
 { name: "Ingot the Loaf Cat", ticker: "INGOTLOAF", description: "Ingot, a sleek honey-golden cat, tucks in her paws and loafs on the warm garden steps, shaped just like a little bar. A cat coin priced in GLDx. Not affiliated with SPDR Gold Trust, State Street, World Gold Council or StonkFun. No intrinsic value; not financial advice." },
 { name: "Nugget the Kitten", ticker: "NUGGETKIT", description: "Nugget, a tiny round golden-ginger kitten, naps in flower pots and pops out like a lucky find in a garden stream. A cat coin priced in GLDx. Not affiliated with SPDR Gold Trust, State Street, World Gold Council or StonkFun. No intrinsic value; not financial advice." },
 { name: "Karat the Gilded Tabby", ticker: "KARATTABBY", description: "Karat, a fluffy cream tabby with glittering golden-tipped fur, combs his long shining whiskers by the pond each dawn. A cat coin priced in GLDx. Not affiliated with SPDR Gold Trust, State Street, World Gold Council or StonkFun. No intrinsic value; not financial advice." },
];
const stockTerms = { stock: ["GLD", "GLDX", "GLDx", "GOLD", "Gold xStock", "SPDR", "SPDR Gold", "SPDR Gold Shares", "SPDR Gold Trust", "State Street", "SSGA", "World Gold", "World Gold Council", "World Gold Trust", "WGC", "spider", "xStock", "xStocks", "Backed", "Kraken"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","MANEKI","CATWIF","MOG","SIGMA","PURR","MEOW","TABBY","GLDCAT","GOLDCAT"]);
const jup = async (q) => {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const text = await r.text();
  writeFileSync(`${DIR}/jup-${q}.raw.json`, text);
  let arr = []; try { const j = JSON.parse(text); arr = Array.isArray(j) ? j : (j.tokens ?? []); } catch {}
  return { status: r.status, count: arr.length, arr };
};
const out = [];
for (const c of coins) {
  const idx = c.description.indexOf("A cat coin priced in");
  const blurb = c.description.slice(0, idx).trim();
  const o = { name: c.name, ticker: c.ticker, lens: { name: c.name.length, ticker: c.ticker.length, description: c.description.length, blurb: blurb.length } };
  o.lenOk = c.name.length <= 32 && c.ticker.length >= 2 && c.ticker.length <= 10 && c.description.length <= 280;
  o.tickerRegex = R.TICKER.test(c.ticker);
  o.endsWithDisclosure = c.description.endsWith(DISC);
  o.tickerContainsRoot = /GLD|GOLD/.test(c.ticker);
  o.memeTicker = memeTickers.has(c.ticker);
  o.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: blurb });
  o.checkFields_nameTickerBlurb = R.checkFields({ name: c.name, symbol: c.ticker, blurb });
  o.checkFields_fullDescription = R.checkFields({ description: c.description });
  o.checkFields_disclosureOnly = R.checkFields({ description: DISC });
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, blurb }, stockTerms);
  const j = await jup(c.ticker);
  o.jup = { status: j.status, count: j.count, symbolMatches: j.arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, id: t.id, isVerified: t.isVerified })) };
  o.jupVerifiedCollision = o.jup.symbolMatches.some(t => t.isVerified === true);
  out.push(o);
}
// context: the name words as tickers
const ctx = {};
for (const q of ["INGOT", "NUGGET", "KARAT", "LOAF"]) {
  const j = await jup(q);
  ctx[q] = { status: j.status, count: j.count, exact: j.arr.filter(t => String(t.symbol).toLowerCase() === q.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })) };
}
const res = { checkedAt: new Date().toISOString(), coins: out, nameWordTickers: ctx };
writeFileSync(`${DIR}/verify.out.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
