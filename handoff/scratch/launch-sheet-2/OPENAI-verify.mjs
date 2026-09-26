const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in OPENAI. Not affiliated with OpenAI or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Parlor Puff the Portrait Cat", ticker: "PARLORPUFF", blurb: "Parlor Puff, a fluffy taupe tabby with a snowy ruff and big dark eyes, sits so still by the flower pots that visitors take her for a painting until she blinks." },
  { name: "Nextpaw the Guessing Cat", ticker: "NEXTPAW", blurb: "Nextpaw, a long-haired taupe tabby with a white bib and round dark eyes, always seems to know what you will say next and starts purring before you finish." },
  { name: "Mull the Thinking Cat", ticker: "MULLPAW", blurb: "Mull, a round, long-haired taupe tabby with a white ruff and snowy paws, answers every question with one slow blink after thinking it over for a long time." },
];
const stockTerms = { stock: ["OPENAI","OpenAI","Open AI","OAI","tOpenAI","T-OpenAI","GPT","ChatGPT","Chat GPT","Sora","DALL-E","DALLE","Dall","Codex","Altman","Sam Altman","Sam","Brockman","Greg Brockman","Sutskever","Ilya","Murati","Stargate","Strawberry","Orion","Simba","Mufasa","Disney","Tessera","PreStocks","PreStock","Pre Stocks","C2PA","Content Credentials","iGPT","Whisper","Operator","Atlas","o1","o3","Image GPT"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","MOG","MANEKI","CAT","CATS","NYAN","KITTY","GRUMPY","KEYCAT","WIF","BONK","CATWIF","MOTHER","PUFF","SIGMA","SC","CHESHIRE","MUMU","HAPPY","HAPPYCAT","CATE","TOSHI","BENJI","MEOW","MEOWCAT","PURR","SMOL","GLORP","CHEEMS","MANEKINEKO","MIHARU","BILLY","NUB","KITKAT"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { ticker: c.ticker, name: c.name, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, endsWithDisclosure: desc.endsWith(DISC) };
  o.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkFields_nameSymbolBlurb = R.checkFields({ name: c.name, symbol: c.ticker, blurb: c.blurb });
  o.checkFields_fullDescription = R.checkFields({ description: desc });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  o.tickerRegex = R.TICKER.test(c.ticker);
  o.memeClash = memeTickers.has(c.ticker);
  for (const q of [c.ticker]) {
    try {
      const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
      const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
      o.jup = { status: r.status, results: arr.length, all: arr.map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })), symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })) };
      o.jupVerifiedSymbolMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
    } catch (e) { o.jupError = String(e); }
  }
  results.push(o);
}
// Every disclosure term, one piece at a time (checkFields stops at one term per rule)
const discPieces = {};
for (const p of ["A cat coin priced in OPENAI.", "Not affiliated with OpenAI or StonkFun.", "OpenAI", "StonkFun", "No intrinsic value; not financial advice."]) discPieces[p] = R.checkFields({ piece: p }).violations;
// Name collision check for the pick
const nameSearch = {};
for (const q of ["Parlor Puff", "ParlorPuff", "Parlor"]) {
  try { const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`); const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    nameSearch[q] = arr.map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })); } catch (e) { nameSearch[q] = String(e); }
}
console.log(JSON.stringify({ results, discPieces, nameSearch }, null, 1));
