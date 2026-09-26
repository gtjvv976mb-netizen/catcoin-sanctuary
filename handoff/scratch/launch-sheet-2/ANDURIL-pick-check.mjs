const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in ANDURIL. Not affiliated with Anduril Industries, PreStocks or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["ANDURIL", "Anduril", "Anduril Industries", "ANDU", "ANDUR", "ANDR", "PreStocks", "PreStock", "Prestocks", "Palmer", "Luckey", "Palmer Luckey", "Schimpf", "Brian Schimpf", "Trae", "Trae Stephens",
  "Lattice", "Sentry", "Ghost", "Anvil", "Roadrunner", "Barracuda", "Fury", "Copperhead", "Pulsar", "Omen", "Menace", "Wisp", "EagleEye", "Eagle Eye", "Thunder", "Spyglass", "Spark", "Arsenal", "Dive", "Seabed",
  "Lynx", "Team Lynx", "Rheinmetall", "XM30", "OMFV", "Mears", "Zach Mears", "Tolkien", "Narsil", "Flame of the West", "sword", "Zuckerberg", "Meta", "cat ears", "helmet", "Hello Kitty", "Red Cat", "warfighter", "military", "defense", "drone", "Army", "tactical", "Luckey"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","KEYCAT","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SC","SIGMA","MUMU","CHILLCAT","CATI","PUSS","NUB","TOSHI","BOOP","ZACK","WIFMAS","LOCKIN","SIMON","GIKO","BOOK","SNOWBALL","LYNX","BOBCAT","MANEKI","CHEESE","MOODENG","GIGA","SMOL","SMOLCAT","GARF","GARFIELD","MOCHI","MAXI","BOBO"]);
const pairs = JSON.parse(fs.readFileSync("../stockcats/stonkfun-pairs.json", "utf8")).data.pairs;
const pairSyms = new Set(pairs.map(p => String(p.symbol).toUpperCase()));
const coins = [
  { tag: "draft1", name: "Tassel the Tufted-Ear Cat", ticker: "TASSELCAT", blurb: "Tassel, a tawny-gold spotted shorthair with black-tipped ear tufts and a short bobbed tail, chases falling leaves along the garden wall." },
  { tag: "draft2", name: "Sleet the Frost-Grey Cat", ticker: "SLEETRUFF", blurb: "Sleet, a silver-grey cat with faint dark spots, a fluffy cheek ruff and big furry paws, pads across the frosty lawn without a sound." },
  { tag: "draft3", name: "Haybale the Bobtail Cat", ticker: "HAYBALE", blurb: "Haybale, a sandy-buff cat with dark-spotted legs, a white belly and a stubby black-tipped tail, naps on top of the garden gate at dusk." },
  { tag: "pick (draft3 + ear tufts)", name: "Haybale the Bobtail Cat", ticker: "HAYBALE", blurb: "Haybale, a sandy-buff cat with tufted ears, dark-spotted legs, a white belly and a stubby black-tipped tail, naps atop the garden gate at dusk." },
];
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { tag: c.tag, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /AND|ANDURIL|ANDU/.test(c.ticker), tickerIsAStonkFunPairSymbol: pairSyms.has(c.ticker), memeClash: MEME.has(c.ticker),
    endsWithDisclosure: desc.endsWith(DISC) };
  out.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkFields_blurbAsDescription = R.checkFields({ description: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  for (const q of [c.ticker, c.ticker.replace(/CAT$|RUFF$/, "")]) {
    try {
      const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`);
      const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
      out[`jup_${q}`] = { status: r.status, results: arr.length,
        symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === q).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })),
        verifiedAny: arr.filter(t => t.isVerified).map(t => `${t.symbol} / ${t.name}`) };
    } catch (e) { out[`jup_${q}`] = { error: String(e) }; }
  }
  out.description = desc;
  results.push(out);
}
// on-chain mint and epoch for the pair note
const rpc = async (method, params) => (await (await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
let chain = {};
try {
  const epoch = await rpc("getEpochInfo", []);
  const acc = await rpc("getAccountInfo", ["PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB", { encoding: "jsonParsed" }]);
  const exts = acc?.value?.data?.parsed?.info?.extensions ?? [];
  chain = { epoch: epoch?.epoch, slotIndex: epoch?.slotIndex, slotsInEpoch: epoch?.slotsInEpoch, owner: acc?.value?.owner,
    extensions: exts.map(e => e.extension), transferFeeConfig: exts.find(e => e.extension === "transferFeeConfig")?.state, pausable: exts.find(e => e.extension === "pausableConfig")?.state,
    transferHook: exts.find(e => e.extension === "transferHook")?.state };
} catch (e) { chain = { error: String(e) }; }
console.log(JSON.stringify({ disclosureAlone: R.checkFields({ description: DISC }), pair: pairs.find(p => p.symbol === "ANDURIL"), chain, results }, null, 1));
