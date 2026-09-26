const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in MRVL. Not affiliated with Marvell Technology, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["MRVL", "MRVLx", "MRV", "Marvell", "Marvel", "Marvell Technology", "Marvell Technology Group", "Marvell International", "Backpack", "Backpack Securities", "Backpack Exchange", "Sunrise", "Wormhole", "Wormhole Labs",
  "Matt Murphy", "Murphy", "Weili", "Weili Dai", "Sehat", "Sutardja", "Pantas", "Willem Meintjes", "Meintjes", "Raghib Hussain", "Hussain",
  "AlleyCat", "Alley Cat", "Alleycat3", "Alleycat5", "Alley", "Bobcat", "Lion", "Lion2", "Pomcat", "xCat", "Cheetah", "Tiger", "Puma", "Prestera", "Teralynx", "Lynx", "Innovium", "Armada", "Octeon", "ThunderX", "FastLinQ", "Yukon", "Nitrox", "Celestial", "Celestial AI", "Jaguar", "Cavium", "Inphi", "Aquantia", "Avera", "Hello Kitty", "CPSS", "Sunrise", "Kitty"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","KEYCAT","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SC","SIGMA","MUMU","CHILLCAT","CATI","PUSS","NUB","TOSHI","BOOP","ZACK","WIFMAS","LOCKIN","SIMON","GIKO","BOOK","SNOWBALL","LYNX","BOBCAT","CHEESE","MOODENG","GIGA","SMOL","SMOLCAT","GARF","GARFIELD","MOCHI","MAXI","BOBO","ALLEYCAT","STRAY","GRUMPYCAT","BILLY","HAPPYCAT","KEYBOARD","NUBCAT"]);
const pairs = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/stockcats/stonkfun-pairs.json", "utf8")).data.pairs;
const pairSyms = new Set(pairs.map(p => String(p.symbol).toUpperCase()));
const coins = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet-2/MRVL-coins.json", "utf8"));
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /MRV|MARV|MVL/.test(c.ticker), tickerIsAStonkFunPairSymbol: pairSyms.has(c.ticker), memeClash: MEME.has(c.ticker),
    endsWithDisclosure: desc.endsWith(DISC), hasOfficial: /official/i.test(desc) };
  out.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jup = { status: r.status, results: arr.length,
      symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })),
      verifiedAny: arr.filter(t => t.isVerified).map(t => `${t.symbol} / ${t.name}`) };
    out.jupVerifiedSymbolMatch = out.jup.symbolMatches.some(t => t.isVerified === true);
  } catch (e) { out.jup = { error: String(e) }; }
  out.description = desc;
  results.push(out);
}
const rpc = async (method, params) => (await (await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
let chain = {};
try {
  const acc = await rpc("getAccountInfo", ["MRVLSjkR2ceUBukujaD3xCyHP1H3B2SzpsNTZF546jo", { encoding: "jsonParsed" }]);
  const exts = acc?.value?.data?.parsed?.info?.extensions ?? [];
  chain = { owner: acc?.value?.owner, extensions: exts.map(e => e.extension), transferFeeConfig: exts.find(e => e.extension === "transferFeeConfig")?.state ?? null,
    pausable: exts.find(e => e.extension === "pausableConfig")?.state, permanentDelegate: exts.find(e => e.extension === "permanentDelegate")?.state,
    transferHook: exts.find(e => e.extension === "transferHook")?.state, defaultAccountState: exts.find(e => e.extension === "defaultAccountState")?.state };
} catch (e) { chain = { error: String(e) }; }
console.log(JSON.stringify({ disclosureAlone: R.checkFields({ description: DISC }), pair: pairs.find(p => p.symbol === "MRVL"), chain, results }, null, 1));
