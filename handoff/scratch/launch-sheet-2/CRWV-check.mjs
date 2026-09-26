const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in CRWV. Not affiliated with CoreWeave, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["CRWV", "CoreWeave", "Core Weave", "Core", "Weave", "Weaver", "Atlantic Crypto", "Atlantic", "Michael Intrator", "Intrator", "Brian Venturo", "Venturo", "Brannin McBee", "Brannin", "McBee", "Peter Salanki", "Salanki", "Nvidia", "H100", "H200", "Hopper", "Weights & Biases", "Weights", "Biases", "W&B", "Marimo", "OpenPipe", "Monolith", "Conductor", "Aston Martin", "Aramco", "Livingston", "Plano", "Magnetar", "Blackstone", "Coatue", "Stability", "OpenAI", "Microsoft", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "CodeWeavers"] };
const banned = new Set(["CRWV","CORE","WEAVE","BOBCAT","JAGUAR","PUMA","LYNX","OCELOT","PANTHER","LEOPARD","SPOT","SPOTS","POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","ROAR","ROARING","AMC","APE","HODL"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasStockRoot: /CRWV|CORE|WEAVE/.test(c.ticker) };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.memeBanned = banned.has(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), results }, null, 1));
