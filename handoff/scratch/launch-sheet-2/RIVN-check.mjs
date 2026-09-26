const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in RIVN. Not affiliated with Rivian Automotive, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["RIVN", "RIV", "Rivian", "Rivian Automotive", "Rivn", "R1S", "R1T", "R2", "R3", "R3X", "EDV", "Gear Guard", "GearGuard", "Yeti",
  "RJ Scaringe", "Scaringe", "RJ", "Pepper", "Nash", "Avi", "Pamela", "Hamish", "Lucky", "Gizmo", "Backpack", "Backpack Securities", "Sunrise", "Wormhole",
  "Electric Adventure Vehicle", "Adventure", "Adventurous", "Keep the World Adventurous Forever", "Launch Green", "Compass Yellow", "Rivian Blue", "Limestone",
  "Forest Green", "Glacier White", "El Cap Granite", "Granite", "Midnight", "Red Canyon", "Storm Blue", "LA Silver", "Camp Kitchen", "Treehouse", "Normal Illinois",
  "Amazon", "Volkswagen", "Mainstream Motors", "Pet Comfort", "Pet Mode"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","RIVN","RIV","PEPPER","SOOT","BLACKCAT","NEKO","CHEEMS"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasRivRoot: c.ticker.includes("RIV") };
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
let mint = {};
try {
  const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["RcZmt84VMJv9bDhKqmw1uWDahYrUT468VwAChTnfD8p", { encoding: "jsonParsed" }] }) });
  const jj = await rpc.json(); const info = jj?.result?.value?.data?.parsed?.info;
  mint = { owner: jj?.result?.value?.owner, extensions: info?.extensions?.map(e => ({ e: e.extension, s: ["transferFeeConfig","transferHook","pausableConfig","defaultAccountState","permanentDelegate"].includes(e.extension) ? e.state : undefined })) };
} catch (e) { mint = { error: String(e) }; }
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), mint, results }, null, 1));
