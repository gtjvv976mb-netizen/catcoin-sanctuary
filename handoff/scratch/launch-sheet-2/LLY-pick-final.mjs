import fs from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const DISC = "A cat coin priced in LLY. Not affiliated with Eli Lilly and Company, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const stockTerms = { stock: ["LLY", "LLYx", "Lilly", "Eli Lilly", "Eli", "Lily", "Lilies", "Eli Lilly and Company", "Backpack", "Backpack Securities", "Sunrise", "Wormhole",
  "Ricks", "David Ricks", "Elanco", "Mounjaro", "Zepbound", "Tirzepatide", "Verzenio", "Trulicity", "Taltz", "Jardiance", "Humalog", "Humulin", "Cyramza", "Olumiant",
  "Emgality", "Kisunla", "Orforglipron", "Retatrutide", "Prozac", "Cialis", "Pulvule", "Pulvules", "Fel-O-Vax", "Indianapolis", "Hoosier", "Greencastle", "Lafayette",
  "insulin", "GLP-1", "weight loss", "diabetes", "obesity", "cure", "cures", "treat", "treatment", "therapy", "heal", "healing", "medicine", "drug", "drugs", "pill", "pills",
  "red script", "Sage Therapeutics", "Supernus", "Prozac capsule"] };
const memeTickers = new Set(["POPCAT", "MEW", "MICHI", "GRUMPY", "KITTY", "CAT", "CATS", "NYAN", "KITTEN", "TABBY", "KEYCAT", "MOG", "MANEKI", "HOBBES", "WIF", "BONK", "SC", "CATWIF",
  "PURR", "MEOW", "SIMON", "NUB", "MOCHI", "TOSHI", "GIGA", "CATI", "SIGMA", "BOB", "MIU", "MEOWCAT", "PUSS", "NEKO", "GIKO", "SNOWBALL", "BOOK", "LUCY", "HAKI"]);
const planned = [];
try { for (const r of JSON.parse(fs.readFileSync(`${DIR}/launch-sheet/launch-sheet.json`, "utf8"))) planned.push({ src: "launch-sheet.json", ticker: r.ticker, name: r.name }); } catch {}
for (const f of fs.readdirSync(`${DIR}/launch-sheet-2`)) {
  if (!/-pick\.json$/.test(f) || f.startsWith("LLY")) continue;
  try { const j = JSON.parse(fs.readFileSync(`${DIR}/launch-sheet-2/${f}`, "utf8")); const p = j.pick ?? j; planned.push({ src: f, ticker: p.ticker, name: p.name }); } catch {}
}
const draftsWithSameTicker = (t) => fs.readdirSync(`${DIR}/launch-sheet-2`).filter((f) => /-coins\d*\.json$/.test(f) && !f.startsWith("LLY")).filter((f) => fs.readFileSync(`${DIR}/launch-sheet-2/${f}`, "utf8").includes(`"${t}"`));
const jup = async (q) => {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  return { status: r.status, arr };
};
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, description: desc };
  o.tickerFormat = R.TICKER.test(c.ticker);
  o.tickerHasRoot = /LLY|LIL|ELI/.test(c.ticker);
  o.endsWithDisclosure = desc.endsWith(DISC);
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkFields_fullDescription = R.checkFields({ description: desc });
  o.checkFields_blurbOnly = R.checkFields({ description: c.blurb });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, description: c.blurb }, stockTerms);
  o.checkTerms_stock_fullDescription = R.checkTerms({ description: desc }, stockTerms);
  o.memeTicker = memeTickers.has(c.ticker);
  o.plannedDuplicate = planned.filter((p) => p.ticker === c.ticker || (p.name && p.name.toLowerCase() === c.name.toLowerCase()));
  o.otherDraftsWithTicker = draftsWithSameTicker(c.ticker);
  try {
    const { status, arr } = await jup(c.ticker);
    o.jupStatus = status; o.jupResults = arr.length;
    o.jupSymbolMatches = arr.filter((t) => String(t.symbol).toUpperCase() === c.ticker).map((t) => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    o.jupVerifiedSymbolMatch = o.jupSymbolMatches.some((t) => t.isVerified === true);
    o.jupTop = arr.slice(0, 5).map((t) => `${t.symbol} / ${t.name} / verified=${t.isVerified}`);
    const first = c.name.split(" ")[0];
    const n = await jup(first);
    o.jupNameQuery = { q: first, results: n.arr.length, verifiedSymbolOrName: n.arr.filter((t) => t.isVerified && (String(t.symbol).toUpperCase() === first.toUpperCase() || String(t.name).toLowerCase().startsWith(first.toLowerCase()))).map((t) => `${t.symbol} / ${t.name}`) };
  } catch (e) { o.jupError = String(e); }
  results.push(o);
}
// mint read
const RPC = "https://api.mainnet-beta.solana.com";
let mint = null;
try {
  const a = (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["LLYuwZ33keFihgwoxXsBawy31AiRFLFSva32TYq5TvD", { encoding: "jsonParsed" }] }) })).json()).result;
  const info = a?.value?.data?.parsed?.info;
  mint = { slot: a?.context?.slot, owner: a?.value?.owner, extensions: (info?.extensions ?? []).map((e) => e.extension), transferFeeConfig: (info?.extensions ?? []).find((e) => e.extension === "transferFeeConfig")?.state ?? null,
    pausable: (info?.extensions ?? []).find((e) => e.extension === "pausableConfig")?.state ?? null, transferHook: (info?.extensions ?? []).find((e) => e.extension === "transferHook")?.state ?? null };
} catch (e) { mint = { error: String(e) }; }
const wiki = null;
console.log(JSON.stringify({ plannedCount: planned.length, disclosureOnly: R.checkFields({ description: DISC }), results, mint, wiki }, null, 1));
