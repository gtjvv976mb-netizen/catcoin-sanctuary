const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in SNDK. Not affiliated with Sandisk Corporation, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(process.argv[2]);
const stockTerms = { stock: ["SNDK", "SNDKx", "Sandisk", "SanDisk", "Sandisk Corporation", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Extreme", "Extreme Portable", "Memory Man", "Space to Hold More", "More More More", "CALLEN", "Liz", "Pokemon", "Mew", "Mewtwo", "David Goeckeler", "Goeckeler", "Western Digital", "Maneki", "maneki-neko"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","SNDK","SNDKX","SANDISK","KEYCAT","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","MANEKI","BOOK","NUB","SNOWBALL"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerStartsSNDK: /^SN?D?K/.test(c.ticker) && c.ticker.startsWith("SNDK") };
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
let mintInfo;
try {
  const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["SNDKbwMUQvZhnLnxLduradgLHG5KrPuKwpnrkkGRhfH", { encoding: "jsonParsed" }] }) });
  const j = await r.json(); const p = j?.result?.value?.data?.parsed?.info;
  mintInfo = { owner: j?.result?.value?.owner, extensions: (p?.extensions ?? []).map(e => ({ extension: e.extension, state: e.extension === "transferFeeConfig" ? e.state : undefined })) };
} catch (e) { mintInfo = { error: String(e) }; }
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), mintInfo, results }, null, 1));
