const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in ANTHROPIC. Not affiliated with Anthropic or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Cotta the Terracotta Cat", ticker: "COTTAPAW", blurb: "Cotta, a sleek terracotta-orange cat with golden eyes, sits by the garden bench all day and gives a slow blink to anyone hard at work nearby." },
  { name: "Nudge the Ginger Cat", ticker: "NUDGEPAW", blurb: "Nudge, a brick-orange cat with round copper eyes, taps pebbles off the potting bench one paw at a time, then sits back looking very pleased." },
  { name: "Ember the Loaf Cat", ticker: "EMBERLOAF", blurb: "Ember, a solid ginger cat the colour of warm clay, curls into a tidy loaf on the sunny wall, twitches her tail in her dreams and purrs at every hello." },
];
const stockTerms = { stock: ["ANTHROPIC", "Anthropic", "Anthropic PBC", "Claude", "Clawd", "Claude Code", "Opus", "Sonnet", "Haiku", "Cowork", "Artifacts", "Constitutional", "Amodei", "Dario", "Daniela", "Dario Amodei", "Daniela Amodei", "Cat Wu", "Catherine Wu", "Rieseberg", "Felix Rieseberg", "buddy", "desk buddy", "chonk", "desk pet", "ESP32", "M5Stick", "PreStocks", "PreStock", "prestock", "pre-IPO", "MCP", "Mythos"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MANEKI","MOG","MOGGY","CATWIF","WIF","BONK","ANTHROPIC","ANTH","CLAUDE","CLAWD","BUDDY","CHONK"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, description: desc.replace(DISC, "") }, stockTerms);
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
const ext = {};
for (const mint of ["Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw"]) {
  try {
    const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [mint, { encoding: "jsonParsed" }] }) });
    const j = await r.json();
    const info = j.result?.value?.data?.parsed?.info;
    ext[mint] = { owner: j.result?.value?.owner, extensions: (info?.extensions ?? []).map(e => ({ extension: e.extension, state: e.extension === "transferFeeConfig" ? { older: e.state?.olderTransferFee, newer: e.state?.newerTransferFee } : undefined })) };
  } catch (e) { ext[mint] = { error: String(e) }; }
}
try { const r = await fetch("https://lite-api.jup.ag/tokens/v2/search?query=Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw"); const j = await r.json(); ext.jup = (Array.isArray(j)?j:[]).map(t=>({symbol:t.symbol,name:t.name,tags:t.tags,tokenProgram:t.tokenProgram,isVerified:t.isVerified})); } catch(e) { ext.jupErr = String(e); }
console.log(JSON.stringify({ results, ext }, null, 1));
try { const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getEpochInfo" }) }); console.log("EPOCH", JSON.stringify((await r.json()).result)); } catch (e) { console.log("EPOCHERR", String(e)); }
