const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const base = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const DISC = "A cat coin priced in LMT. Not affiliated with Lockheed Martin, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["LMT","LM","Lockheed","Lockheed Martin","Martin","Backpack","Backpack Securities","Sunrise","Wormhole","PANTERA","Pantera","panther","panthera","Sniper","Sniper XR","TIGER Eyes","Tiger","Tiger Eyes","F-35","F35","F-16","Lightning","Lightning II","Skunk Works","Skunk","Taiclet","Jim Taiclet","Black Cats","Panther Tamer","LANTIRN","IRST","jet","pod","missile","military","defense","defence","aerospace","Red Cat","Hello Kitty","target","targeting","Norway","Norwegian","RNoAF","Caterpillar","stealth","leopard","jaguar","puma","cougar","lynx","Nellis","Hellfire","weapon","combat","air force","USAF","pilot","Orion","Aegis","Javelin","HIMARS","PAC-3","THAAD","Sikorsky","Black Hawk","Blackhawk","Hercules","Raptor","Starliner","Ukraine","Korean","F-15K","fighter","bomb","Zona Militar"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","KEYCAT","MOG","MANEKI","HOBBES","WIF","CATWIF","PURR","MEOW","SC","MUMU","CHILLCAT","CATI","PUSS","NUB","TOSHI","BOOP","ZACK","GIKO","SNOWBALL","BOBCAT","SMOLCAT","GARF","GARFIELD","MOCHI","MAXI","PANTHER","PANTERA","TIGER","BLACKCAT","CATGPT","MANEKINEKO","MANEKI","SCF","MIU","MIAO","GUMMY","HAMMY","LUCE","WAT","CHEEMS","PNUT","MOODENG","GME"]);
const pairs = JSON.parse(fs.readFileSync(`${base}/stockcats/stonkfun-pairs.json`, "utf8")).data.pairs;
const pairSyms = new Set(pairs.map(p => String(p.symbol).toUpperCase()));
const pair = pairs.find(p => p.symbol === "LMT");
const cands = [
 { tag:"draft1-VELVETPAW", name:"Velvet the Shadow-Spot Cat", ticker:"VELVETPAW", blurb:"Velvet, a sleek glossy-black shorthair whose coat shows faint darker rosettes in bright sun, watches the lily pond with round golden eyes." },
 { tag:"draft2-SOOTTAIL", name:"Soot the Long-Tailed Black Cat", ticker:"SOOTTAIL", blurb:"Soot, a lean long-legged black cat with a rope-long tail, a glossy coat and pale green-gold eyes, stretches along the warm stone path at noon." },
 { tag:"draft3-CINDERPAW", name:"Cinder the Sun-Glint Black Cat", ticker:"CINDERPAW", blurb:"Cinder, a sturdy coal-black cat whose fur glints faint rust-brown in the sun, dozes under the fern fronds with copper eyes half closed." },
];
const jup = async (q) => {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  const sm = arr.filter(t => String(t.symbol).toUpperCase() === q.toUpperCase());
  return { status: r.status, results: arr.length, symbolMatches: sm.map(t => ({ symbol: t.symbol, name: t.name, verified: t.isVerified === true || (t.tags ?? []).includes("verified"), id: t.id })),
    verifiedSymbolMatch: sm.some(t => t.isVerified === true || (t.tags ?? []).includes("verified")),
    verifiedAnyInResults: arr.filter(t => t.isVerified === true || (t.tags ?? []).includes("verified")).map(t => `${t.symbol} / ${t.name}`) };
};
const results = [];
for (const c of cands) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { tag: c.tag, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, descOK: desc.length <= 280, nameOK: c.name.length <= 32,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /LMT|^LM|LOCK|MART|PANT|TIGER/.test(c.ticker), tickerIsStonkFunPairSymbol: pairSyms.has(c.ticker), wellKnownCatMeme: MEME.has(c.ticker), endsWithDisclosure: desc.endsWith(DISC) };
  o.checkProposal_name_ticker_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_fullDescription = R.checkFields({ description: desc });
  o.checkFields_blurbOnly = R.checkFields({ blurb: c.blurb });
  o.checkTerms_stock_name_ticker_blurb = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try { o.jupiter = await jup(c.ticker); } catch (e) { o.jupiter = { error: String(e) }; }
  o.description = desc;
  results.push(o);
}
const rpc = async (method, params) => (await (await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
let chain = {};
try {
  const acc = await rpc("getAccountInfo", [pair.mint, { encoding: "jsonParsed" }]);
  const info = acc?.value?.data?.parsed?.info ?? {}; const exts = info.extensions ?? [];
  chain = { owner: acc?.value?.owner, freezeAuthority: info.freezeAuthority, mintAuthority: info.mintAuthority, extensions: exts.map(e => e.extension),
    transferFeeConfig: exts.find(e => e.extension === "transferFeeConfig")?.state ?? null, pausable: exts.find(e => e.extension === "pausableConfig")?.state,
    permanentDelegate: exts.find(e => e.extension === "permanentDelegate")?.state, transferHook: exts.find(e => e.extension === "transferHook")?.state };
} catch (e) { chain = { error: String(e) }; }
console.log(JSON.stringify({ disclosureAlone: R.checkFields({ description: DISC }), pair, chain, results }, null, 1));
