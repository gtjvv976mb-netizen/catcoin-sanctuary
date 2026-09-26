const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in LULU. Not affiliated with lululemon athletica, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["LULU", "LULUx", "lululemon", "lululemon athletica", "athletica", "lulu", "lemon", "lemon cat", "lululemoncat", "lululemonthekitty",
  "Chip Wilson", "Wilson", "Calvin McDonald", "McDonald", "Heidi O'Neill", "O'Neill", "ONeill", "Heidi", "Align", "Nulu", "Define", "Energy Bra", "Flow Y", "Big-Ass Bag",
  "Ivivva", "Geoff McFetridge", "McFetridge", "Hannah Frankson", "Frankson", "Mickey", "Minnie", "Disney", "Backpack", "Backpack Securities", "Sunrise", "Wormhole",
  "Lunar New Year", "Year of the Tiger", "tiger", "leopard", "Wella", "Hello Kitty", "Sanrio", "Garfield", "Pusheen", "Doraemon", "Scuba", "Swiftly", "Wunder", "Wunder Train", "Softstreme", "Pace Breaker", "ABC", "Everywhere Belt Bag", "omega"] };
const coins = [
 {"name":"Sunstretch the Red Tabby Cat","ticker":"SUNSTRETCH","blurb":"Sunstretch, a red-orange tabby with bold black stripes and copper eyes, starts each day with one long stretch on the warm garden path.",
  "look":"Ordinary four-legged house cat, red-orange mackerel tabby with bold near-black tiger-like stripes and copper eyes. Taken from the red tiger print; wears nothing."},
 {"name":"Russet the Striped Cat","ticker":"RUSSETLAP","blurb":"Russet, a deep rust-red tabby with dark brown stripes and green eyes, trots easy laps around the flower beds, then naps in the shade.",
  "look":"Ordinary house cat, deep rust-red tabby with dark brown stripes and green eyes. A darker take on the red tiger print; wears nothing."},
 {"name":"Wiggle the Ginger Tabby Cat","ticker":"WIGGLEPAW","blurb":"Wiggle, a ginger tabby with wide dark stripes and a cream chest, crouches and wiggles before every pounce at the swaying garden grass.",
  "look":"Ordinary house cat, ginger tabby with wide dark tiger-like stripes and a cream chest, with gold eyes; wears nothing."}];
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","MOG","MANEKI","HOBBES","WIF","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","BONK","GIGA","SC","MANEKI","PEPE","TABBY","MOCHI","CHEEMS","LUCE","MOTHER","SIGMA","TIGER","GINGER","STRIPES","KEYCAT","WOLF","SPX"]);
const jup = async (q) => { const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`); const j = await r.json(); return { status: r.status, arr: Array.isArray(j) ? j : (j.tokens ?? []) }; };
const out = { disclaimer: DISC, disclaimerLen: DISC.length, disclaimer_checkFields: R.checkFields({ disclaimer: DISC }), disclaimer_checkTerms: R.checkTerms({ disclaimer: DISC }, stockTerms), coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /LULU|LEMON|ATHL|ALIGN|NULU/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC), wellKnownCatMeme: MEME.has(c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
  o.checkTerms_stock_coinText = R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, stockTerms);
  o.checkTerms_stock_look = R.checkTerms({ look: c.look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const t = await jup(c.ticker);
    o.jupTicker = { status: t.status, results: t.arr.length, symbolMatches: t.arr.filter(x => String(x.symbol).toUpperCase() === c.ticker).map(x => ({ symbol: x.symbol, name: x.name, isVerified: x.isVerified, id: x.id, tags: x.tags })) };
    o.jupTicker.verifiedMatch = o.jupTicker.symbolMatches.some(x => x.isVerified === true);
    o.jupTicker.nearSymbols = t.arr.slice(0, 8).map(x => `${x.symbol}|${x.name}|v=${x.isVerified}`);
    const n = await jup(c.name.split(" ")[0]);
    o.jupFirstWord = { query: c.name.split(" ")[0], status: n.status, results: n.arr.length, verified: n.arr.filter(x => x.isVerified).map(x => `${x.symbol}|${x.name}`), top: n.arr.slice(0, 8).map(x => `${x.symbol}|${x.name}|v=${x.isVerified}`) };
  } catch (e) { o.jupError = String(e); }
  o.description = desc;
  out.coins.push(o);
}
try {
  const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["LULUmT9VMttkfAJE236LXJcYJ2tTP7nunrSWR5G1BdS", { encoding: "jsonParsed" }] }) });
  const j = await rpc.json(); const v = j.result.value; const info = v.data.parsed.info;
  out.mint = { owner: v.owner, decimals: info.decimals, freezeAuthority: info.freezeAuthority, mintAuthority: info.mintAuthority,
    extensions: info.extensions.map(e => e.extension), transferFeeConfig: info.extensions.find(e => e.extension === "transferFeeConfig")?.state ?? null,
    permanentDelegate: info.extensions.find(e => e.extension === "permanentDelegate")?.state ?? null,
    pausable: info.extensions.find(e => e.extension === "pausableConfig")?.state ?? null,
    transferHook: info.extensions.find(e => e.extension === "transferHook")?.state ?? null,
    metadata: (({ name, symbol }) => ({ name, symbol }))(info.extensions.find(e => e.extension === "tokenMetadata")?.state ?? {}) };
} catch (e) { out.mintError = String(e); }
console.log(JSON.stringify(out, null, 1));
