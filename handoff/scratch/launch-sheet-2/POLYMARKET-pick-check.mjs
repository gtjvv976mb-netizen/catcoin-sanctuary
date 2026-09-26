const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in POLYMARKET. Not affiliated with Polymarket, PreStocks or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["POLYMARKET", "Polymarket", "Poly", "POLY", "PLMK", "PMKT", "Polymarket PreStocks", "PreStocks", "PreStock", "Prestocks", "pre-IPO",
  "Shayne", "Coplan", "Shayne Coplan", "Oracle", "The Oracle", "CASHCAT", "Cash Cat", "POPCAT", "HOBBES", "Keycat", "Shark Cat", "MEW", "TOSHI",
  "Roaring Kitty", "Kitty", "Big Cat", "Garfield", "Hello Kitty", "Copycat", "Kalshi", "Springfield", "Polycat", "LowPoly", "Trump", "Harris", "Kamala"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","KEYCAT","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW",
  "SC","SIGMA","MUMU","CHILLCAT","CATI","PUSS","NUB","TOSHI","BOOP","ZACK","WIFMAS","LOCKIN","SIMON","GIKO","SNOWBALL","CHEESE","GIGA","SMOLCAT","GARF","MOCHI","CASHCAT","POLYCAT","SHARKCAT","PAW","PAWS"]);
const pairs = JSON.parse(fs.readFileSync("../stockcats/stonkfun-pairs.json", "utf8")).data.pairs;
const pairSyms = new Set(pairs.map(p => String(p.symbol).toUpperCase()));
const coins = [
  { tag: "draft1", name: "Hunch the Cream Tabby", ticker: "HUNCHPAW", blurb: "Hunch, a fluffy cream-ginger tabby with a round face and big copper eyes, sits by the garden gate each morning and guesses which path visitors take." },
  { tag: "draft2", name: "Tossup the Cream Cat", ticker: "TOSSPAW", blurb: "Tossup, a pale-cream cat with a round face and wide copper eyes, sits between two flowerpots for ages deciding which to nap in, then naps in both." },
  { tag: "draft3", name: "Drizzle the Butterscotch Cat", ticker: "DRIZZPAW", blurb: "Drizzle, a round-faced butterscotch tabby with big copper eyes, tucks under the porch just before each rain shower and waits for the first drops." },
  { tag: "pick (draft1, set in the Cat Sanctuary)", name: "Hunch the Cream Tabby", ticker: "HUNCHPAW", blurb: "Hunch, a fluffy cream-ginger tabby with a round face and big copper eyes, sits by the Cat Sanctuary gate at dawn guessing which path visitors take." },
];
const jup = async (q) => {
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    return { status: r.status, results: arr.length,
      symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === q).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })),
      verifiedAny: arr.filter(t => t.isVerified).map(t => `${t.symbol} / ${t.name}`) };
  } catch (e) { return { error: String(e) }; }
};
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { tag: c.tag, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    descOk: desc.length <= 280, nameOk: c.name.length <= 32,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /POLY|PLMK|PMKT/.test(c.ticker), tickerIsAStonkFunPairSymbol: pairSyms.has(c.ticker), memeClash: MEME.has(c.ticker),
    endsWithDisclosure: desc.endsWith(DISC), mentionsSanctuary: /Cat Sanctuary/.test(c.blurb) };
  out.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  out[`jup_${c.ticker}`] = await jup(c.ticker);
  const root = c.ticker.replace(/PAW$/, "");
  out[`jup_${root}`] = await jup(root);
  out.description = desc;
  results.push(out);
}
const rpc = async (method, params) => (await (await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
let chain = {};
try {
  const epoch = await rpc("getEpochInfo", []);
  const acc = await rpc("getAccountInfo", ["Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP", { encoding: "jsonParsed" }]);
  const exts = acc?.value?.data?.parsed?.info?.extensions ?? [];
  chain = { epoch: epoch?.epoch, slotIndex: epoch?.slotIndex, slotsInEpoch: epoch?.slotsInEpoch, owner: acc?.value?.owner,
    extensions: exts.map(e => e.extension), transferFeeConfig: exts.find(e => e.extension === "transferFeeConfig")?.state,
    pausable: exts.find(e => e.extension === "pausableConfig")?.state, transferHook: exts.find(e => e.extension === "transferHook")?.state,
    defaultAccountState: exts.find(e => e.extension === "defaultAccountState")?.state };
} catch (e) { chain = { error: String(e) }; }
console.log(JSON.stringify({ disclosureAlone: R.checkFields({ description: DISC }), pair: pairs.filter(p => /poly/i.test(p.symbol + p.name)), chain, results }, null, 1));
