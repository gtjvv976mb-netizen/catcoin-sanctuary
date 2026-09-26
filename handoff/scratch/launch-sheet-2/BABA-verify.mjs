const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
import fs from "fs";
const DISC = "A cat coin priced in BABA. Not affiliated with Alibaba Group, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(fs.readFileSync("BABA-coins.json","utf8"));
const stockTerms = { stock: ["BABA","Baba","Alibaba","Alibaba Group","Ali","Tmall","Tianmao","Tian Mao","Sky Cat","Skycat","Taobao","Jack Ma","Daniel Zhang","Eddie Wu","Joseph Tsai","Deng","Xiaoping","Hello Kitty","Kitty White","Sanrio","Alifish","Cainiao","Ant Group","Fliggy","Genie","AliExpress","Lazada","Qwen","Singles Day","Double Eleven","Red Cat","Alipay","Sesame","Backpack","Sunrise","Wormhole","Mao","Nine Lives","lucky","fortune","auspicious"] };
const memes = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","NYAN","MOG","MANEKI","WIF","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","HOBBES","TABBY","KITTEN","MOCHI","GME","CHILLCAT","SC"];
const out = { disclosureAlone: R.checkFields({ description: DISC }), coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, descLen: desc.length, endsWithDisc: desc.endsWith(DISC),
    tickerFormat: R.TICKER.test(c.ticker), tickerHasRoot: /BABA|ALI|TMAL|TIAN|SKY|MAO/.test(c.ticker), meme: memes.includes(c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDesc = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_fullDesc = R.checkFields({ name: c.name, symbol: c.ticker, description: desc });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jup = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })) };
    o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified);
    o.jup.nearby = arr.slice(0,5).map(t => `${t.symbol}|${t.name}|${t.isVerified}`);
  } catch (e) { o.jupErr = String(e); }
  o.description = desc;
  out.coins.push(o);
}
console.log(JSON.stringify(out, null, 1));
