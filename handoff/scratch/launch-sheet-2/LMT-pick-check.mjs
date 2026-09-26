const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const base = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const DISC = "A cat coin priced in LMT. Not affiliated with Lockheed Martin, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["LMT", "LM", "Lockheed", "Lockheed Martin", "Martin", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "PANTERA", "Pantera", "panther", "panthera", "Sniper", "Sniper XR", "TIGER Eyes", "Tiger", "F-35", "F35", "F16", "Lightning", "Lightning II", "Skunk Works", "Skunk", "Taiclet", "Jim Taiclet", "Black Cats", "Panther Tamer", "LANTIRN", "jet", "pod", "missile", "military", "defense", "defence", "aerospace", "Red Cat", "Hello Kitty", "target", "targeting", "Norway", "Norwegian", "Caterpillar", "stealth", "leopard", "jaguar", "puma", "cougar", "lynx", "Nellis", "Hellfire", "weapon", "combat", "air force", "Orion", "Aegis", "Javelin", "HIMARS", "PAC-3", "THAAD", "Sikorsky", "Black Hawk", "Blackhawk", "Hercules", "Raptor", "Starliner"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","KEYCAT","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SC","SIGMA","MUMU","CHILLCAT","CATI","PUSS","NUB","TOSHI","BOOP","ZACK","WIFMAS","LOCKIN","SIMON","GIKO","BOOK","SNOWBALL","LYNX","BOBCAT","CHEESE","GIGA","SMOL","SMOLCAT","GARF","GARFIELD","MOCHI","MAXI","BOBO","PANTHER","PANTERA","TIGER","BLACKCAT","SOOT","INK","VELVET","CATGPT","MANEKINEKO","PEPE"]);
const pairs = JSON.parse(fs.readFileSync(`${base}/stockcats/stonkfun-pairs.json`, "utf8")).data.pairs;
const pairSyms = new Set(pairs.map(p => String(p.symbol).toUpperCase()));
const coins = JSON.parse(fs.readFileSync(`${base}/launch-sheet-2/LMT-coins.json`, "utf8")).map((c, i) => ({ tag: `draft${i + 1}`, ...c }));
const results = [];
const jup = async (q) => {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  return { status: r.status, results: arr.length,
    symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === q.toUpperCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })),
    verifiedAny: arr.filter(t => t.isVerified).map(t => `${t.symbol} / ${t.name}`) };
};
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { tag: c.tag, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /LMT|^LM|LOCK|MART/.test(c.ticker), tickerIsAStonkFunPairSymbol: pairSyms.has(c.ticker), memeClash: MEME.has(c.ticker),
    endsWithDisclosure: desc.endsWith(DISC) };
  out.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  const root = c.ticker.replace(/PAW$|TAIL$/, "");
  for (const q of [...new Set([c.ticker, root])]) { try { out[`jup_${q}`] = await jup(q); } catch (e) { out[`jup_${q}`] = { error: String(e) }; } }
  out.description = desc;
  results.push(out);
}
const rpc = async (method, params) => (await (await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
let chain = {};
try {
  const acc = await rpc("getAccountInfo", ["LMT3i1BHgixFqPUgcyteJhnEz2dpy9i3cYy4pi9BoeV", { encoding: "jsonParsed" }]);
  const info = acc?.value?.data?.parsed?.info ?? {};
  const exts = info.extensions ?? [];
  chain = { owner: acc?.value?.owner, decimals: info.decimals, mintAuthority: info.mintAuthority, freezeAuthority: info.freezeAuthority,
    extensions: exts.map(e => e.extension), transferFeeConfig: exts.find(e => e.extension === "transferFeeConfig")?.state ?? null,
    pausable: exts.find(e => e.extension === "pausableConfig")?.state, permanentDelegate: exts.find(e => e.extension === "permanentDelegate")?.state,
    transferHook: exts.find(e => e.extension === "transferHook")?.state, defaultAccountState: exts.find(e => e.extension === "defaultAccountState")?.state,
    tokenMetadata: (({ name, symbol }) => ({ name, symbol }))(exts.find(e => e.extension === "tokenMetadata")?.state ?? {}) };
} catch (e) { chain = { error: String(e) }; }
let lmtJup = null; try { lmtJup = (await jup("LMT3i1BHgixFqPUgcyteJhnEz2dpy9i3cYy4pi9BoeV")); } catch (e) { lmtJup = String(e); }
console.log(JSON.stringify({ disclosureAlone: R.checkFields({ description: DISC }), pair: pairs.find(p => p.symbol === "LMT"), chain, results }, null, 1));
