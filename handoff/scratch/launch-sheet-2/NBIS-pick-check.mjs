const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in NBIS. Not affiliated with Nebius Group N.V., Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["NBIS", "NBISX", "Nebius", "Nebius Group", "Nebius AI", "Nebius AI Cloud", "Nebius AI Studio", "AI Studio", "Token Factory", "Arkady", "Volozh", "Arkady Volozh", "John Boynton", "Boynton",
  "Avride", "TripleTen", "Toloka", "ClickHouse", "Yandex", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Flux", "tiger", "tigress", "Persian", "cloud", "GPU", "neural", "nebula", "Nasdaq", "Amsterdam"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","KEYCAT","MOG","MOGCAT","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SC","SIGMA","CHILLCAT","CATI","PUSS","NUB","TOSHI","BOOP","ZACK","WIFMAS","LOCKIN","GINGER","SIMON","MUMU","LUCE","BILLY","GIKO","SNOWBALL","TIGER","GRASS","EMBER"]);
const coins = JSON.parse(process.argv[2]);
const extraQueries = JSON.parse(process.argv[3] ?? "[]");
const jup = async (q) => {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  return { status: r.status, n: arr.length, arr };
};
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /^NB|NBIS|NEB/.test(c.ticker), memeClash: MEME.has(c.ticker),
    endsWithDisclaimer: desc.endsWith(DISC) };
  out.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkFields_description = R.checkFields({ description: desc });
  out.checkFields_look = R.checkFields({ look: c.look ?? "" });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look ?? "" }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const { status, n, arr } = await jup(c.ticker);
    out.jupStatus = status; out.jupResults = n;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    out.jupVerifiedSymbolMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
const prefix = {};
for (const q of extraQueries) {
  try { const { status, n, arr } = await jup(q); prefix[q] = { status, n, verified: arr.filter(t => t.isVerified).map(t => ({ symbol: t.symbol, name: t.name, id: t.id })).slice(0, 6), exactSymbol: arr.filter(t => String(t.symbol).toUpperCase() === q).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })).slice(0, 6) }; }
  catch (e) { prefix[q] = { error: String(e) }; }
}
let mint = null;
try {
  const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["NBiSF3UaVUFtRzHwAfxyHsBCAZWGEKnMpewAE4oh7BG", { encoding: "jsonParsed" }] }) });
  const jj = await rpc.json(); const v = jj?.result?.value; const info = v?.data?.parsed?.info;
  mint = { owner: v?.owner, decimals: info?.decimals, freezeAuthority: info?.freezeAuthority, mintAuthority: info?.mintAuthority,
    extensions: (info?.extensions ?? []).map(e => ({ ext: e.extension, state: e.extension === "tokenMetadata" ? { name: e.state.name, symbol: e.state.symbol } : e.state })),
    hasTransferFee: (info?.extensions ?? []).some(e => e.extension === "transferFeeConfig") };
} catch (e) { mint = { error: String(e) }; }
console.log(JSON.stringify({ disclaimerAlone: R.checkFields({ description: DISC }), results, prefix, mint }, null, 1));
