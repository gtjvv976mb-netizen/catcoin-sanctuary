const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in USO. Not affiliated with United States Oil Fund, LP, USCF, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(fs.readFileSync("USO-coins.json", "utf8"));
const looks = {
  NIGHTGLOSS: "Normal four-legged shorthair with a solid glossy jet-black coat, a faint iridescent sheen in sunlight and gold eyes. It wears nothing. Business-based look (crude oil means a glossy black cat).",
  AMBERDROP: "Normal four-legged tortoiseshell cat, mostly glossy black with warm honey-gold patches and green-gold eyes. It wears nothing. Business-based look (the black and amber tones of crude).",
  UMBERSWIRL: "Normal four-legged classic (blotched) tabby with a dark umber-brown base, bold black swirl markings and copper eyes. It wears nothing. Business-based look (dark crude swirls).",
};
const stockTerms = { stock: ["USO", "USOx", "United States Oil Fund", "United Sates Oil Fund", "United States Oil", "United States", "United", "States", "Sates", "Oil", "Oil Fund", "Fund", "LP",
  "USCF", "USCF Investments", "United States Commodity Funds", "Commodity Funds", "Marygold", "Marygold Companies", "Tiger Financial", "Tiger", "John Love", "Nicholas Gerber", "Gerber", "Stuart Crumbaugh", "Crumbaugh",
  "Invest In What's Real", "Real Spiel", "The Original Oil ETF", "ETF", "Crude", "Light Sweet", "Sweet Crude", "WTI", "Brent", "Cushing", "Oklahoma", "NYMEX", "Futures", "Barrel", "Petroleum", "Petro", "Oilfield", "Oiler", "Slick", "Gusher", "Pipeline", "Refinery", "Derrick", "Wildcat", "Texas Tea", "Black Gold",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Caterpillar", "United Service Organizations", "Jawsome", "Future Proof", "Hello Kitty", "Garfield", "Amber Group"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","GIGACAT","MOGCAT","BILLY","SCF","CHILLCAT","LUCE","MUMU","BOOK","MOTHER","CATI","ZEREBRO"]);
const out = { disclosureOnly_checkFields: R.checkFields({ description: DISC }), disclosureOnly_checkTerms: R.checkTerms({ description: DISC }, stockTerms), coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, endsWithDisc: desc.endsWith(DISC),
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /USO|^US|OIL|CRUDE|USCF|WTI|BRENT|PETRO/.test(c.ticker), memeTickerClash: memeTickers.has(c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: looks[c.ticker] });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: looks[c.ticker] }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  o.jup = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
  o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  o.jup.sample = arr.slice(0, 5).map(t => `${t.symbol}|${t.name}|v=${t.isVerified}`);
  o.description = desc;
  out.coins.push(o);
}
// root probes
out.rootProbe = {};
for (const q of ["AMBER", "NIGHTGLOS", "UMBER"]) {
  const arr = await (await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`)).json();
  out.rootProbe[q] = (Array.isArray(arr) ? arr : []).filter(t => t.isVerified).map(t => `${t.symbol}|${t.name}`).slice(0, 10);
}
// mint on chain
const RPC = "https://api.mainnet-beta.solana.com";
const a = (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["USNv3NkKA27Dh4nsHJDPhW4VoEcTQmjoZyJt2dqdwFu", { encoding: "jsonParsed" }] }) })).json()).result;
const info = a?.value?.data?.parsed?.info;
out.mint = { slot: a?.context?.slot, owner: a?.value?.owner, mintAuthority: info?.mintAuthority, freezeAuthority: info?.freezeAuthority, decimals: info?.decimals,
  extensions: (info?.extensions ?? []).map(e => e.extension), transferFeeConfig: (info?.extensions ?? []).find(e => e.extension === "transferFeeConfig")?.state ?? null,
  permanentDelegate: (info?.extensions ?? []).find(e => e.extension === "permanentDelegate")?.state, pausable: (info?.extensions ?? []).find(e => e.extension === "pausableConfig")?.state,
  transferHook: (info?.extensions ?? []).find(e => e.extension === "transferHook")?.state };
const jm = await (await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=USNv3NkKA27Dh4nsHJDPhW4VoEcTQmjoZyJt2dqdwFu`)).json();
out.mintJup = (Array.isArray(jm) ? jm : []).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, tags: t.tags, tokenProgram: t.tokenProgram }));
console.log(JSON.stringify(out, null, 1));
