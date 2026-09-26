const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in POLYMARKET. Not affiliated with Polymarket, PreStocks or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(process.argv[2]);
const stockTerms = { stock: ["POLYMARKET", "Polymarket", "Poly", "Polymarket PreStocks", "PreStocks", "PreStock", "Prestocks", "pre-IPO",
  "Shayne", "Coplan", "Shayne Coplan", "Oracle", "The Oracle", "CASHCAT", "Cash Cat", "POPCAT", "HOBBES", "Keycat", "Shark Cat", "MEW", "TOSHI",
  "Roaring Kitty", "Kitty", "Big Cat", "Garfield", "Hello Kitty", "Copycat", "Kalshi", "Springfield", "Polycat", "LowPoly"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MANEKI","MOG","MOGGY","CATWIF","WIF","BONK",
  "POLYMARKET","POLY","POLYCAT","CASHCAT","HOBBES","KEYCAT","TOSHI","SHARKCAT","SIGMA","BREAD","LOAF"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, description: c.blurb }, stockTerms);
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker);
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
const disclosureOnly = R.checkFields({ description: DISC });
const ext = {};
const mint = "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP";
try {
  const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [mint, { encoding: "jsonParsed" }] }) });
  const j = await r.json();
  const info = j.result?.value?.data?.parsed?.info;
  ext.owner = j.result?.value?.owner;
  ext.extensions = (info?.extensions ?? []).map(e => ({ extension: e.extension, state: e.extension === "transferFeeConfig" ? { older: e.state?.olderTransferFee, newer: e.state?.newerTransferFee } : undefined }));
  ext.error = j.error;
} catch (e) { ext.rpcErr = String(e); }
try { const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${mint}`); const j = await r.json(); ext.jup = (Array.isArray(j)?j:[]).map(t=>({symbol:t.symbol,name:t.name,tags:t.tags,tokenProgram:t.tokenProgram,isVerified:t.isVerified})); } catch(e) { ext.jupErr = String(e); }
try { const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getEpochInfo" }) }); ext.epoch = (await r.json()).result?.epoch; } catch (e) { ext.epochErr = String(e); }
console.log(JSON.stringify({ disclosureOnly, results, ext }, null, 1));
