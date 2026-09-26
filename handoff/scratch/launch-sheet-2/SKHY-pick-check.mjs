const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in SKHY. Not affiliated with SK hynix, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["SKHY", "SKHYV", "SKHYNIX", "SK hynix", "hynix", "SK", "SK Group", "SK Square", "Solidigm", "Backpack", "Backpack Securities", "Sunrise", "Wormhole",
  "Chik", "Chilk", "Chilki", "Hanyang", "Hanyangi", "Hanyang-i", "Haru", "Habimi", "Song Ha-young", "Song Hayoung", "Hayoung", "Ha-young", "Kwak Noh-jung", "Kwak", "Chey Tae-won", "Chey", "Icheon", "Jukdang",
  "Semicraft", "Hitactic", "HBM", "DDR5", "SOCAMM", "fromis", "fromis_9", "Nasdaq", "Ssgoqual", "leopard cat", "Prionailurus", "sak", "salk"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","KEYCAT","MOG","MOGCAT","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SC","SIGMA","CHILLCAT","CATI","PUSS","NUB","TOSHI","BOOP","ZACK","WIFMAS","LOCKIN","GINGER","SIMON","MUMU","MANEKI","LUCE","BILLY"]);
const coins = JSON.parse(process.argv[2]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: /^[A-Z0-9]{2,10}$/.test(c.ticker), tickerHasStockRoot: /SKH|HYNIX|SKHY/.test(c.ticker) || c.ticker.startsWith("SK"), memeClash: MEME.has(c.ticker),
    endsWithDisclaimer: desc.endsWith(DISC) };
  out.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkFields_description = R.checkFields({ description: desc });
  out.checkTerms_stock_blurb = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    out.jupVerifiedSymbolMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
    out.jupVerifiedAny = arr.filter(t => t.isVerified).map(t => t.symbol).slice(0, 8);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
let mint = null;
try {
  const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["SKHYhSjuRWHgikq8eRKbtBbpABgJSkd7ytQV14i9EQ3", { encoding: "jsonParsed" }] }) });
  const jj = await rpc.json(); const v = jj?.result?.value; const info = v?.data?.parsed?.info;
  mint = { owner: v?.owner, decimals: info?.decimals, freezeAuthority: info?.freezeAuthority, mintAuthority: info?.mintAuthority,
    extensions: (info?.extensions ?? []).map(e => ({ ext: e.extension, state: e.extension === "tokenMetadata" ? { name: e.state.name, symbol: e.state.symbol } : e.state })),
    hasTransferFee: (info?.extensions ?? []).some(e => e.extension === "transferFeeConfig") };
} catch (e) { mint = { error: String(e) }; }
console.log(JSON.stringify({ disclaimerAlone: R.checkFields({ description: DISC }), results, mint }, null, 1));
