const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in NBIS. Not affiliated with Nebius Group N.V., Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse((await import("fs")).readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["NBIS", "NBISX", "Nebius", "Nebius Group", "Nebius AI", "Nebius AI Cloud", "Nebius AI Studio", "AI Studio", "Token Factory", "Arkady", "Volozh", "Arkady Volozh", "John Boynton", "Boynton",
  "Avride", "TripleTen", "Toloka", "ClickHouse", "Yandex", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Flux", "tiger", "Persian", "cloud", "GPU", "neural", "nebula"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","TIGER","NBIS","NEBIUS"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasRoot: /^NB/.test(c.ticker) || /NBIS|NEB/.test(c.ticker) };
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
const mint = "NBiSF3UaVUFtRzHwAfxyHsBCAZWGEKnMpewAE4oh7BG";
let mintInfo;
try {
  const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [mint, { encoding: "jsonParsed" }] }) });
  const j = await rpc.json(); const p = j?.result?.value?.data?.parsed?.info;
  mintInfo = { owner: j?.result?.value?.owner, decimals: p?.decimals, extensions: (p?.extensions ?? []).map(e => ({ extension: e.extension, state: ["transferFeeConfig","transferHook","scaledUiAmountConfig","pausableConfig","permanentDelegate","defaultAccountState"].includes(e.extension) ? e.state : undefined })) };
} catch (e) { mintInfo = { error: String(e) }; }
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), mintInfo, results }, null, 1));
