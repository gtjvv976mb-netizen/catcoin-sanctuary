const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in QQQx. Not affiliated with Invesco, Nasdaq or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Circuit Tabby", ticker: "CIRCTAB", blurb: "A charcoal tabby whose thin stripes glow soft green like circuit-board traces. It naps on the warmest stone in the garden and purrs with a faint, happy hum." },
  { name: "Basket Kitten", ticker: "BASKETKIT", blurb: "A ginger-and-cream kitten curled in a woven basket of a hundred little treasures. It drags it to the sunniest patch of garden and never picks a favourite." },
  { name: "Hundred Whisker Cat", ticker: "WHISK100", blurb: "A fluffy silver cat said to have a hundred white whiskers, one for each name in its basket. Every morning it counts them in the garden and loses track at forty." },
];
const stockTerms = { stock: ["QQQ", "QQQX", "QQQx", "Invesco", "Nasdaq", "Nasdaq-100", "NDX", "NDQ", "NAS100", "US100", "Ama Dablam", "xStock", "Cubes"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN"]);
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, descLen: desc.length, blurbLen: c.blurb.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status;
    out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  console.log(JSON.stringify(out, null, 1));
}
