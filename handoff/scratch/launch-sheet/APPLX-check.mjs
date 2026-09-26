const { checkProposal, checkFields, checkTerms, displaySafe, TICKER } = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in AAPLx. Not affiliated with Apple Inc. or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(process.argv[2]);
const stockTerms = { stock: ["AAPL", "AAPLX", "AAPLx", "APPLX", "APPL", "Apple", "Apple Inc", "Apple xStock", "iPhone", "iPad", "iMac", "Mac", "macOS", "OS X", "Mac OS", "Cupertino",
  "Jaguar", "Panther", "Tiger", "Leopard", "Snow Leopard", "Lion", "Mountain Lion", "Cheetah", "Puma", "Lynx", "Cougar", "Animoji", "Memoji", "Hello Kitty", "Sanrio", "Sunblink",
  "Tim Cook", "Steve Jobs", "Jobs", "Wozniak", "Arcade", "xStock", "Backed", "Siri", "Think Different", "one more thing"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOCHI","MOG"]);
for (const c of coins) {
  const description = c.body + " " + DISC;
  console.log("==", c.name, c.symbol, "| name len", c.name.length, "| symbol len", c.symbol.length, "| body len", c.body.length, "| desc len", description.length, "| TICKER re", TICKER.test(c.symbol), "| meme-banned", banned.has(c.symbol));
  console.log(" checkProposal(tagline=body):", JSON.stringify(checkProposal({ name: c.name, symbol: c.symbol, tagline: c.body })));
  console.log(" displaySafe:", JSON.stringify(displaySafe({ name: c.name, symbol: c.symbol })));
  console.log(" checkFields(full description incl. disclosure):", JSON.stringify(checkFields({ description })));
  console.log(" checkTerms(stock words, name/symbol/body):", JSON.stringify(checkTerms({ name: c.name, symbol: c.symbol, description: c.body }, stockTerms)));
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.symbol)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens || []);
  const same = arr.filter((x) => String(x.symbol).toLowerCase() === c.symbol.toLowerCase());
  console.log(" jupiter:", "status", r.status, "| results", arr.length, "| same-symbol", same.length, "| same-symbol verified", same.filter((x) => x.isVerified).length,
    same.slice(0, 5).map((x) => `${x.symbol}/${x.name}/v=${x.isVerified}/mcap=${Math.round(x.mcap||0)}`).join("; "));
  console.log(" DESC:", description);
}
