const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in SPYx. Not affiliated with State Street or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Patchpaw the Calico", ticker: "PATCHPAW", description: "Patchpaw is a little calico whose coat is a quilt of many small patches, no two alike. She pads through every flower bed in the garden and sniffs each one. A cat coin priced in SPYx. Not affiliated with State Street or StonkFun. No intrinsic value; not financial advice." },
  { name: "Longnap the Tabby", ticker: "LONGNAP", description: "Longnap is a round silver tabby who picks one warm sunbeam each morning and stays curled up in it all day. She never checks a chart, only where the sun went. A cat coin priced in SPYx. Not affiliated with State Street or StonkFun. No intrinsic value; not financial advice." },
  { name: "Wicker the Basket Cat", ticker: "WICKERCAT", description: "Wicker is a plump cream-and-ginger cat who sleeps in a woven basket of yarn balls in every colour, and never lets a single one roll away. A cat coin priced in SPYx. Not affiliated with State Street or StonkFun. No intrinsic value; not financial advice." },
];
const stockTerms = { stock: ["SPY", "SPYX", "SPYx", "SPDR", "SP500", "S&P", "S&P 500", "Standard and Poors", "State Street", "SSGA", "spider", "xStock", "Backed", "Kraken", "Fearless Girl", "clipper"] };
const memeBanned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","CALICO","MOCHI","MOG","SIGMA"]);
const results = [];
for (const c of coins) {
  const out = { name: c.name, ticker: c.ticker };
  out.nameLen = c.name.length; out.tickerLen = c.ticker.length; out.descLen = c.description.length;
  out.endsWithDisclosure = c.description.endsWith(DISC);
  const story = c.description.slice(0, c.description.length - DISC.length).trim();
  out.storyLen = story.length;
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.tickerContainsSPY = /SPY|SPDR|SP5/i.test(c.ticker);
  out.memeBanned = memeBanned.has(c.ticker);
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: story });
  out.checkFields_full = R.checkFields({ name: c.name, symbol: c.ticker, description: c.description });
  out.checkFields_disclosureOnly = R.checkFields({ description: DISC });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, story }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const url = `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`;
    const r = await fetch(url);
    const txt = await r.text();
    const fs = await import("node:fs");
    fs.writeFileSync(`/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/SPYX-jup-${c.ticker}.raw.json`, txt);
    const j = JSON.parse(txt);
    const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolsSeen = arr.map(t => `${t.symbol}${t.isVerified ? "(V)" : ""}`);
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  results.push(out);
}
console.log(JSON.stringify(results, null, 1));
