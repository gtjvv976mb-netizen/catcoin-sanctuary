const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in AMBA. Not affiliated with Ambarella, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["AMBA", "AMBAx", "Ambarella", "Ambarella Inc", "Amba", "Amber", "Ambar", "Fermi", "Feng-Ming", "Fermi Wang", "Wang", "Les Kohn", "Kohn", "CVflow", "CV3", "CV2", "CV25", "S6LM", "Oculii", "VisLab", "Cooper", "GoPro", "Hero", "Dropcam", "Nest", "Garmin", "DJI", "Phantom", "Harmonic", "Axis", "Bosch", "Inceptio", "Alberto Broggi", "Broggi", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Santa Clara", "Canopy", "KeepTruckin", "Gauzy"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","ROAR","ROARING","MOTHER","SIGMA","GME","BENJI","CHEESE","LUCE","MUMU","SCF","CWIF","CATGPT","MANEKI","HAPPY","CHILLCAT","GLORP"]);
const drafts = JSON.parse(fs.readFileSync("AMBA-coins.json","utf8"));
const list = Array.isArray(drafts) ? drafts : (drafts.coins ?? []);
const out = { disclosureOnly: R.checkFields({ description: DISC }), disclosureTerms: R.checkTerms({ disclaimer: DISC }, stockTerms), coins: [] };
for (const c of list) {
  const desc = c.description ?? `${c.blurb} ${DISC}`;
  const blurb = desc.endsWith(DISC) ? desc.slice(0, desc.length - DISC.length).trim() : c.blurb;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: blurb.length, descLen: desc.length, descBytes: Buffer.byteLength(desc, "utf8"),
    nonAscii: [...desc + c.name].filter(ch => ch.charCodeAt(0) > 127),
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /AMBA|AMB|CVF/.test(c.ticker), memeTicker: memeTickers.has(c.ticker),
    endsWithDisclaimer: desc.endsWith(DISC) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb, look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: blurb, look: c.look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  o.jup = { status: r.status, results: arr.length, all: arr.slice(0,5).map(t => `${t.symbol}|${t.name}|v=${t.isVerified}`), symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
  o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  o.description = desc;
  out.coins.push(o);
}
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["AMBAHqGPjjtJaHPPSuvPu2mPCJdkGZpmhHQa5pkXbxrM", { encoding: "jsonParsed" }] }) });
const jj = await rpc.json(); const v = jj?.result?.value; const info = v?.data?.parsed?.info;
out.mint = { owner: v?.owner, decimals: info?.decimals, freezeAuthority: info?.freezeAuthority, mintAuthority: info?.mintAuthority,
  extensions: (info?.extensions ?? []).map(e => e.extension === "tokenMetadata" ? { extension: e.extension, name: e.state.name, symbol: e.state.symbol } : { extension: e.extension, state: e.state }),
  hasTransferFee: (info?.extensions ?? []).some(e => e.extension === "transferFeeConfig") };
console.log(JSON.stringify(out, null, 1));
