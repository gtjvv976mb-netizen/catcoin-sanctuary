const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in ROBOSTRATEGY. Not affiliated with RoboStrategy, Inc. or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(process.argv[2]);
const stockTerms = { stock: ["ROBOSTRATEGY", "RoboStrategy", "Robo Strategy", "Robo", "BOT", "Bots", "Robot", "Robots", "Robotics", "tBOT", "BOTx", "Backpack", "Backpack Securities", "Sunrise", "Wormhole",
  "Figure AI", "Figure", "Apptronik", "Dyna", "Dyna Robotics", "Standard Bots", "Path Robotics", "Dexmate", "Coco Robotics", "Maven Robotics", "REK", "GMI",
  "Mechanism Capital", "Mechanism", "Mech", "Mechs", "Andrew Kang", "Kang", "Nyan", "Nyan Heroes", "Heroes", "9 Lives Interactive", "FP Strategies", "Physical AI",
  "intelligence in motion", "Computershare", "humanoid", "embodied AI", "Nasdaq"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MANEKI","MOG","MOGGY","BOT","ROBO","ROBOT","BOTS","SIMON","WIF"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, description: desc.replace(DISC, "") }, stockTerms);
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker) || /BOT|ROBO|NYAN/.test(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id, mcap: t.mcap }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
const ext = {};
if (process.argv[3] === "ext") for (const mint of ["BoTx8y9ynfdxf5ZjWtCoBVkff52qKA82ysaLU8ZM6d8T"]) {
  try {
    const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [mint, { encoding: "jsonParsed" }] }) });
    const j = await r.json();
    const info = j.result?.value?.data?.parsed?.info;
    ext[mint] = { owner: j.result?.value?.owner, extensions: (info?.extensions ?? []).map(e => ({ extension: e.extension, state: ["transferFeeConfig","permanentDelegate","transferHook","defaultAccountState","pausableConfig","scaledUiAmountConfig"].includes(e.extension) ? e.state : undefined })) };
  } catch (e) { ext[mint] = { error: String(e) }; }
}
console.log(JSON.stringify({ results, ext }, null, 1));
