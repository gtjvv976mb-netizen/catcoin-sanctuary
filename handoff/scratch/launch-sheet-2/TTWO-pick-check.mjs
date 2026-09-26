const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in TTWO. Not affiliated with Take-Two Interactive Software, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["TTWO", "TTW", "Take-Two", "Take Two", "TakeTwo", "Take2", "Take-Two Interactive", "Take-Two Interactive Software", "T2", "Interactive", "Rockstar", "Rockstar Games", "2K", "2K Games", "Zynga", "Peak", "Peak Games", "Toon Blast", "Toon", "Blast", "Toy Blast", "Cooper", "Cooper Cat", "Bruno", "Bruno Bear", "Wally", "Wally Wolf", "Toon gang", "Grand Theft Auto", "GTA", "Vice City", "Vice", "Leonida", "Lucia", "Jason", "Grotti", "Cheetah", "Panther", "Borderlands", "Gearbox", "BioShock", "Civilization", "Red Dead", "Mafia", "XCOM", "NBA 2K", "WWE 2K", "Strauss", "Zelnick", "Strauss Zelnick", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Match Factory", "FarmVille", "Words With Friends", "Wizard of Oz", "Cowardly Lion", "Nordeus", "Rollic", "NaturalMotion", "Small Giant", "Socialpoint", "Private Division", "skateboard", "red shorts", "red trousers", "trousers", "gloves", "cape", "match-3", "cubes"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","KEYCAT","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SC","SIGMA","MUMU","CHILLCAT","CATI","PUSS","NUB","TOSHI","BOOP","WIFMAS","LOCKIN","SIMON","GIKO","BOOK","SNOWBALL","BOBCAT","CHEESE","GIGA","SMOL","SMOLCAT","GARF","GARFIELD","MOCHI","MITTENS","SILVER","GREY"]);
const pairs = JSON.parse(fs.readFileSync("../stockcats/stonkfun-pairs.json", "utf8")).data.pairs;
const pairSyms = new Set(pairs.map(p => String(p.symbol).toUpperCase()));
const coins = [
  { tag: "draft1", name: "Savepoint the Silver Cat", ticker: "SAVEPAW", blurb: "Savepoint, a smoky silver-grey cat with a white muzzle and bib, naps on the same warm stone daily so he never loses his place." },
  { tag: "draft2", name: "Joypad the Mitten Cat", ticker: "JOYPAD", blurb: "Joypad, a pale silver cat with four snow-white mitten paws and a white chest, bats a pinecone along the garden path for hours." },
  { tag: "draft3", name: "Highscore the Grey Cat", ticker: "HIGHSCORE", blurb: "Highscore, a grey-and-white cat with a white chin and dark grey brow marks, hops stone to stone to beat yesterday's best run." },
  { tag: "pick (draft1, light grey, save-point line)", name: "Savepoint the Silver Cat", ticker: "SAVEPAW", blurb: "Savepoint, a light silver-grey cat with a white muzzle and bib, naps on the same warm stone daily, right where he left off." },
];
const jup = async (q) => {
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    const m = arr.filter(t => String(t.symbol).toUpperCase() === q);
    return { status: r.status, results: arr.length, symbolMatches: m.map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })), verifiedSymbolMatch: m.some(t => t.isVerified === true) };
  } catch (e) { return { error: String(e) }; }
};
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { tag: c.tag, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /TTW|TAKE|T2|2K|GTA|ZNGA/.test(c.ticker), tickerIsAStonkFunPairSymbol: pairSyms.has(c.ticker), memeClash: MEME.has(c.ticker),
    endsWithDisclosure: desc.endsWith(DISC) };
  out.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkFields_blurbAsDescription = R.checkFields({ description: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  out.jup = await jup(c.ticker);
  out.description = desc;
  results.push(out);
}
const rpc = async (method, params) => (await (await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
let chain = {};
try {
  const acc = await rpc("getAccountInfo", ["TTWofwAge91oFhZs7kpQdyrVRkmevgM88xijGvQFbKo", { encoding: "jsonParsed" }]);
  const exts = acc?.value?.data?.parsed?.info?.extensions ?? [];
  chain = { owner: acc?.value?.owner, extensions: exts.map(e => e.extension), transferFeeConfig: exts.find(e => e.extension === "transferFeeConfig")?.state ?? null,
    pausable: exts.find(e => e.extension === "pausableConfig")?.state, permanentDelegate: exts.find(e => e.extension === "permanentDelegate")?.state, transferHook: exts.find(e => e.extension === "transferHook")?.state };
} catch (e) { chain = { error: String(e) }; }
console.log(JSON.stringify({ disclosureAlone: R.checkFields({ description: DISC }), pair: pairs.find(p => p.symbol === "TTWO"), chain, results }, null, 1));
