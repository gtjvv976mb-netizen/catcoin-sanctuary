const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in KALSHI. Not affiliated with Kalshi, Tessera, PreStocks or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["KALSHI", "Kalshi", "KalshiEX", "KAL", "KLS", "KLSH", "tKalshi", "T-Kalshi", "Tessera", "PreStocks", "PreStock", "Prestocks",
  "Tarek", "Mansour", "Tarek Mansour", "Luana", "Lopes", "Lara", "Luana Lopes Lara", "Roaring Kitty", "Roaring", "Kitty", "Westside Market", "West Side Market", "Westside", "Free Groceries", "Groceries", "Grumpy"] };
const coins = [
  { name: "Milk Run Tabby", ticker: "MILKRUN", blurb: "A stocky brown-grey tabby with gold eyes and a stern frown pads through the sanctuary gate with a milk bottle and a warm loaf, then naps on a bench." },
  { name: "Squint the Sundial Tabby", ticker: "SUNSQUINT", blurb: "Squint, a broad brown-grey tabby with striped brows and gold eyes, frowns at the clouds from the sanctuary sundial each dawn, weighing rain or shine." },
  { name: "Breadloaf the Tabby", ticker: "BREADLOAF", blurb: "Breadloaf, a stout brown-grey tabby with dark stripes, a cream chin and a stern gold stare, sits tucked up like a loaf by the sanctuary bread oven." },
  { pick: true, name: "Squint the Sundial Tabby", ticker: "SUNSQUINT", blurb: "Squint, a stout brown-grey tabby with a striped brow and gold eyes, frowns at the clouds from the Cat Sanctuary sundial, weighing rain or shine." },
];
const out = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { pick: !!c.pick, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerFormat: R.TICKER.test(c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  o.description = desc;
  out.push(o);
}
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), out }, null, 1));
