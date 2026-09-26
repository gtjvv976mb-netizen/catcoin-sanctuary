const { checkProposal, checkFields, checkTerms, displaySafe, TICKER } = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in METAx. Not affiliated with Meta Platforms, Inc. or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(process.argv[2]);
const stockTerms = { stock: ["META", "METAX", "METAx", "MTA", "FB", "Meta", "Meta Platforms", "Meta xStock", "Facebook", "Instagram", "WhatsApp", "Messenger", "Threads", "Oculus",
  "Quest", "Horizon", "Llama", "Muse", "Muse Charm", "Jolly", "Pusheen", "Hello Kitty", "Sanrio", "HamCat", "Zuckerberg", "Zuck", "Mark", "Beast", "Puli", "LeCun", "Yann",
  "Make-A-Video", "Menlo Park", "metaverse", "Reels", "Ray-Ban", "Kirby", "Labubu", "Tamagotchi", "poke", "xStock", "Backed", "cats of instagram"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOCHI","MOG","META","METAX","FB"]);
for (const c of coins) {
  const description = c.body + " " + DISC;
  console.log("==", c.name, c.symbol, "| name len", c.name.length, "| symbol len", c.symbol.length, "| body len", c.body.length, "| desc len", description.length, "| TICKER re", TICKER.test(c.symbol), "| meme-banned", banned.has(c.symbol));
  console.log(" checkProposal(tagline=body):", JSON.stringify(checkProposal({ name: c.name, symbol: c.symbol, tagline: c.body })));
  console.log(" displaySafe:", JSON.stringify(displaySafe({ name: c.name, symbol: c.symbol })));
  console.log(" checkFields(full description incl. disclosure):", JSON.stringify(checkFields({ description })));
  console.log(" checkTerms(stock words, name/symbol/body):", JSON.stringify(checkTerms({ name: c.name, symbol: c.symbol, description: c.body }, stockTerms)));
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.symbol)}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens || []);
    const same = arr.filter((x) => String(x.symbol).toLowerCase() === c.symbol.toLowerCase());
    console.log(" jupiter:", "status", r.status, "| results", arr.length, "| same-symbol", same.length, "| same-symbol verified", same.filter((x) => x.isVerified).length,
      same.slice(0, 5).map((x) => `${x.symbol}/${x.name}/v=${x.isVerified}/mcap=${Math.round(x.mcap||0)}`).join("; "));
  } catch (e) { console.log(" jupiter ERR", e.message); }
  console.log(" DESC:", description);
}
