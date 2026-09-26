const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in QUBT. Not affiliated with Quantum Computing Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["QUBT", "QUB", "QCi", "QCI", "Quantum", "Quantum Computing", "Quantum Computing Inc", "Qubit", "Qubits", "Photon", "Photons", "Photonic", "Photonics",
  "Dirac", "Dirac-1", "Dirac-3", "Qatalyst", "Mukai", "NeuraWave", "uQRNG", "QRNG", "Entangled", "Entanglement", "Entropy", "Ising", "Vibrometer", "InstaTune",
  "Yuping Huang", "Yuping", "Huang", "Prem Kumar", "Kumar", "Moore", "Dianat", "Liscouski", "Robert Liscouski", "McGann", "William McGann",
  "NHanced", "NuCrypt", "uCrypt", "Freedom Photonics", "EM4", "Optogration", "Luminar", "Luminar Semiconductor", "Tempe", "Lithium Niobate", "Niobate", "TFLN",
  "Schrodinger", "Schroedinger", "Schrödinger", "Hello Kitty", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Firefly", "Quantum Cat", "QCAT"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","KEYCAT","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SC","SIGMA","MUMU","CHILLCAT","CATI","PUSS","NUB","TOSHI","BOOP","ZACK","WIFMAS","LOCKIN","SIMON","GIKO","BOOK","SNOWBALL","LYNX","BOBCAT","CHEESE","MOODENG","GIGA","SMOL","SMOLCAT","GARF","GARFIELD","MOCHI","MAXI","BOBO","QCAT","SCHRODI"]);
const pairs = JSON.parse(fs.readFileSync("../stockcats/stonkfun-pairs.json", "utf8")).data.pairs;
const pairSyms = new Set(pairs.map(p => String(p.symbol).toUpperCase()));
const coins = JSON.parse(fs.readFileSync("QUBT-coins.json", "utf8"));
const jup = async (q) => {
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    return { status: r.status, results: arr.length,
      symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === q).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })),
      verifiedSymbolMatch: arr.some(t => String(t.symbol).toUpperCase() === q && t.isVerified === true),
      verifiedAny: arr.filter(t => t.isVerified).map(t => `${t.symbol} / ${t.name}`).slice(0, 8) };
  } catch (e) { return { error: String(e) }; }
};
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const base = c.ticker.replace(/PAW$/, "");
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /QUB|QCI|QUANT/.test(c.ticker), tickerIsAStonkFunPairSymbol: pairSyms.has(c.ticker), memeClash: MEME.has(c.ticker) || MEME.has(base),
    endsWithDisclosure: desc.endsWith(DISC), coat: c.coat };
  out.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  out[`jup_${c.ticker}`] = await jup(c.ticker);
  out[`jup_${base}`] = await jup(base);
  out.description = desc;
  results.push(out);
}
const rpc = async (method, params) => (await (await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
let chain = {};
try {
  const acc = await rpc("getAccountInfo", ["QUBTAD8C9bMU9LvmMNgKPhrmBGbHvxpu6vfWQtThxxw", { encoding: "jsonParsed" }]);
  const exts = acc?.value?.data?.parsed?.info?.extensions ?? [];
  chain = { owner: acc?.value?.owner, freezeAuthority: acc?.value?.data?.parsed?.info?.freezeAuthority, mintAuthority: acc?.value?.data?.parsed?.info?.mintAuthority,
    extensions: exts.map(e => e.extension), transferFeeConfig: exts.find(e => e.extension === "transferFeeConfig")?.state ?? null,
    permanentDelegate: exts.find(e => e.extension === "permanentDelegate")?.state, pausable: exts.find(e => e.extension === "pausableConfig")?.state,
    transferHook: exts.find(e => e.extension === "transferHook")?.state };
} catch (e) { chain = { error: String(e) }; }
let jupPair = null;
try { const r = await fetch("https://lite-api.jup.ag/tokens/v2/search?query=QUBTAD8C9bMU9LvmMNgKPhrmBGbHvxpu6vfWQtThxxw"); const a = await r.json(); jupPair = (Array.isArray(a) ? a : a.tokens ?? []).map(t => ({ id: t.id, symbol: t.symbol, name: t.name, tags: t.tags, isVerified: t.isVerified, tokenProgram: t.tokenProgram })); } catch (e) { jupPair = String(e); }
let src = {};
try { const r = await fetch("https://quantumcomputinginc.com/company"); const t = await r.text(); src = { status: r.status, light: /harness the quantum nature of light/.test(t), catHits: (t.replace(/<[^>]+>/g, " ").match(/\b(cat|cats|kitten|feline|mascot|schr[oö]dinger)\b/gi) ?? []) }; } catch (e) { src = { error: String(e) }; }
console.log(JSON.stringify({ disclosureAlone: R.checkFields({ description: DISC }), pair: pairs.find(p => p.symbol === "QUBT"), jupPair, chain, src, results }, null, 1));
