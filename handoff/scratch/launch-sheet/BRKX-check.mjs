const { checkProposal, checkFields, checkTerms, displaySafe, TICKER } = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in BRK.Bx. Not affiliated with Berkshire Hathaway or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(process.argv[2]);
const stockTerms = { stock: ["BRK", "BRKB", "BRK.B", "BRK.Bx", "BRKBX", "BRKX", "Berkshire", "Hathaway", "Berkshire Hathaway", "Berkshire Hathaway xStock", "xStock", "Backed",
  "Warren", "Buffett", "Charlie Munger", "Munger", "Greg Abel", "Ajit Jain", "Oracle", "Oracle of Omaha", "Omaha", "GEICO", "Gecko", "Dairy Queen", "Blizzard", "See's", "See's Candies",
  "Duracell", "BNSF", "Jazwares", "Squishmallows", "Squishmallow", "Squish", "Cam the Cat", "Cam", "Jack the Black Cat", "Hello Kitty", "Garfield", "Alleghany", "Fruit of the Loom",
  "Coca-Cola", "Cherry Coke", "Super-Cat", "Super Cat", "Kraken", "Class B", "Snowball"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOCHI","MOG"]);
const out = [];
for (const c of coins) {
  const description = c.body + " " + DISC;
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.symbol)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens || []);
  const same = arr.filter((x) => String(x.symbol).toLowerCase() === c.symbol.toLowerCase());
  out.push({ name: c.name, symbol: c.symbol, nameLen: c.name.length, symbolLen: c.symbol.length, bodyLen: c.body.length, descLen: description.length,
    tickerRe: TICKER.test(c.symbol), memeBanned: banned.has(c.symbol),
    checkProposal: checkProposal({ name: c.name, symbol: c.symbol, tagline: c.body }),
    displaySafe: displaySafe({ name: c.name, symbol: c.symbol }),
    checkFields_fullDescription: checkFields({ description }),
    checkFields_disclosureOnly: checkFields({ description: DISC }),
    checkTerms_stock: checkTerms({ name: c.name, symbol: c.symbol, description: c.body }, stockTerms),
    jupiter: { status: r.status, results: arr.length, sameSymbol: same.length, sameSymbolVerified: same.filter((x) => x.isVerified).length,
      sample: same.slice(0, 5).map((x) => `${x.symbol}/${x.name}/v=${x.isVerified}/mcap=${Math.round(x.mcap || 0)}`) },
    description });
}
console.log(JSON.stringify(out, null, 1));
