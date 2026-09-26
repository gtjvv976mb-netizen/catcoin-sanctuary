const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in HOODx. Not affiliated with Robinhood or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Pewter the Garden Tabby", ticker: "PEWTER", blurb: "Pewter, a silver-grey tabby with dark stripes on her cheeks, a white chin and a pink nose, naps on the warm garden steps and pads after the sun all afternoon." },
  { name: "Drizzle the Silver Tabby", ticker: "DRIZZLE", blurb: "Drizzle, a pale grey striped cat with a snowy muzzle and pink ears, watches the rain from under the rhubarb leaves, then tiptoes out to sniff the wet mint." },
  { name: "Tinsel the Twinkly Tabby", ticker: "TINSEL", blurb: "Tinsel, a sleek silver tabby with grey paws, a white chin and bright pink ears, chases glinting dewdrops across the lawn and purrs like a tiny kettle." },
];
const stockTerms = { stock: ["HOOD", "HOODX", "HOODx", "Robinhood", "Robinhood Markets", "Robinhood xStock", "xStock", "xStocks", "Backed", "Robin Hood", "Robin", "Sherwood", "feather",
  "Pixel Cat", "Robinhood Pixel Cat", "pixel", "Cash Cat", "CashCat", "CASHCAT", "ROBINCAT", "PIXELCAT", "Vlad", "Tenev", "Baiju", "Bhatt", "Legend", "Robinhood Gold", "Robinhood Chain",
  "Bitstamp", "Roaring Kitty", "Keith Gill", "Wink Cat", "WINK", "Cass", "Popcat", "MEW", "Pengu", "Pnut", "catpay", "referral", "Loading", "Something new is growing"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","MEOW","CASHCAT","ROBINCAT","PIXELCAT","WINK","HOOD","HOODX","HOODCAT","ROBIN"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkFields_disclosureOnly = R.checkFields({ description: DISC });
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
console.log(JSON.stringify(results, null, 1));
