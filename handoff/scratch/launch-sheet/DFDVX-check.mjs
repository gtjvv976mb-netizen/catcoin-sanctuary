const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in DFDVx. Not affiliated with DeFi Development Corp. or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Latchkey the Vault Cat", ticker: "LATCHKEY", blurb: "Latchkey, a sturdy brown tabby with white socks, naps curled on a little iron-banded strongbox in the garden shed, its brass key tucked under her chin." },
  { name: "Stashpaw the Hoarding Cat", ticker: "STASHPAW", blurb: "Stashpaw, a sleek smoke-grey cat with pale green eyes, hides shiny buttons and bottle caps under the hedge and adds one more to the pile every morning." },
  { name: "Doorstop the Guard Cat", ticker: "DOORSTOP", blurb: "Doorstop, a hefty cream long-haired cat, flops across the little wooden cellar hatch at the end of the garden and will not budge, however nicely you ask." },
  { name: "Trinket the Hoarding Cat", ticker: "TRINKETPAW", blurb: "Trinket, a sleek smoke-grey cat with pale green eyes, hides shiny buttons and bottle caps under the hedge and adds one more to the pile every morning." },
];
const stockTerms = { stock: ["DFDV", "DFDVX", "DFDVx", "DeFi Development", "DeFi Development Corp", "DeFi Dev Corp", "DeFi Dev", "DeFi", "DevCorp", "xStock", "xStocks", "Backed", "Solana", "SOL", "CHAD", "DisclaimerCoin", "DONT", "Disclaimer", "Joseph Onorati", "Onorati", "Parker White", "SPS", "SOL Per Share", "Digital Asset Treasury", "DAT", "CTV", "BONK", "Kraken", "payday", "dividends", "Treasury Vehicle"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","DFDV","DFDVX","CHAD","DONT","SOL","BONK"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkFields_disclosureOnly = R.checkFields({ description: DISC });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id, mcap: t.mcap, holders: t.holderCount }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
console.log(JSON.stringify(results, null, 1));
