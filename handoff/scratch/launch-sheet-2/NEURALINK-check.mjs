const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in NEURALINK. Not affiliated with Neuralink, PreStocks or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["NEURALINK", "Neuralink", "Neuralink Corp", "Neural", "NEURA", "NEUR", "NRLK", "Link", "N1", "R1", "Telepathy", "Blindsight", "PRIME", "CONVOY", "PreStocks", "PreStock", "Prestocks",
  "Elon", "Musk", "Elon Musk", "Schrodinger", "Schrödinger", "Erwin", "Hodak", "Max Hodak", "Rapoport", "Seo", "Dongjin", "Merolla", "Sabes", "Tim Gardner", "Hanson", "Tolosa", "Birchall", "Jared",
  "Gatsby", "Marvin", "Gertrude", "Pager", "Pong", "MindPong", "Blue Belle", "Umbreon", "Arbaugh", "Noland", "xAI", "Grok", "Tesla", "SpaceX", "brain chip", "implant", "BCI"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MOGGY","MANEKI","WIF","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SCHRODI","SCHRO","NEURALINK","NEURAL","LINK"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length, tickerHasRoot: /NEUR|LINK/.test(c.ticker) };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, stockTerms);
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id, mcap: t.mcap }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
const ext = {};
for (const mint of ["PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S"]) {
  try {
    const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [mint, { encoding: "jsonParsed" }] }) });
    const j = await r.json(); const info = j.result?.value?.data?.parsed?.info;
    ext[mint] = { owner: j.result?.value?.owner, extensions: (info?.extensions ?? []).map(e => ({ extension: e.extension, state: e.extension === "transferFeeConfig" ? { older: e.state?.olderTransferFee, newer: e.state?.newerTransferFee } : undefined })) };
  } catch (e) { ext[mint] = { error: String(e) }; }
}
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), results, ext }, null, 1));
