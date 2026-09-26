import fs from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const DISC = "A cat coin priced in MRNA. Not affiliated with Moderna, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = [
 { name: "Courier the Ribbon Tabby", ticker: "NOTEPAW", blurb: "Courier, a silver tabby with looping ribbon-like swirls on each flank, carries folded notes from the potting shed to the pond and never drops one." },
 { name: "Pipette the White Cat", ticker: "PIPETTE", blurb: "Pipette, a crisp snow-white cat with pale blue eyes, keeps the greenhouse bench spotless and laps her water one careful drop at a time." },
 { name: "Suds the Cream Cat", ticker: "SUDSPAW", blurb: "Suds, a round cream-and-white cat with gold eyes, chases soap bubbles by the pond and cups each one so gently that it never pops." },
];
const stockTerms = { stock: ["MRNA","MRNAx","RNA","mRNA","Moderna","Moderna Inc","ModernaTX","Moderna Therapeutics","Spikevax","Spike","vax","mNEXSPIKE","mRESVIA","mNEXSPIKE","Backpack","Backpack Securities","Sunrise","Wormhole","Bancel","Stephane Bancel","Afeyan","Noubar Afeyan","Rossi","Derrick Rossi","Springer","Timothy Springer","Chien","Kenneth Chien","Langer","Robert Langer","Flagship","Flagship Pioneering","Cambridge","vaccine","messenger RNA","lipid nanoparticle","LNP"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","KEYCAT","MOG","MANEKI","HOBBES","WIF","BONK","SC","CATWIF","PURR","MEOW","SIMON","NUB","MOCHI","TOSHI","GIGA","MANEKI","CATI","SIGMA","BOB","MIU","MEOWCAT","PUSS","NEKO"]);
// other planned coins in the sanctuary
const planned = [];
try { for (const r of JSON.parse(fs.readFileSync(`${DIR}/launch-sheet/launch-sheet.json`, "utf8"))) planned.push({ src: "launch-sheet.json", ticker: r.ticker, name: r.name }); } catch {}
for (const f of fs.readdirSync(`${DIR}/launch-sheet-2`)) {
  if (!/-pick\.json$/.test(f) || f.startsWith("MRNA")) continue;
  try { const j = JSON.parse(fs.readFileSync(`${DIR}/launch-sheet-2/${f}`, "utf8")); const p = j.pick ?? j; planned.push({ src: f, ticker: p.ticker, name: p.name }); } catch {}
}
const draftsWithSameTicker = (t) => fs.readdirSync(`${DIR}/launch-sheet-2`).filter((f) => /-coins\d*\.json$/.test(f) && !f.startsWith("MRNA")).filter((f) => fs.readFileSync(`${DIR}/launch-sheet-2/${f}`, "utf8").includes(`"${t}"`));
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, descLen: desc.length, description: desc };
  o.tickerFormat = R.TICKER.test(c.ticker);
  o.tickerHasRoot = /MRNA|RNA|MODERN|MOD/.test(c.ticker);
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkFields_nameTickerBlurb = R.checkFields({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkFields_fullDescription = R.checkFields({ description: desc });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, description: c.blurb }, stockTerms);
  o.checkTerms_stock_fullDescription = R.checkTerms({ description: desc }, stockTerms);
  o.memeTicker = memeTickers.has(c.ticker);
  o.plannedDuplicate = planned.filter((p) => p.ticker === c.ticker || (p.name && p.name.toLowerCase() === c.name.toLowerCase()));
  o.otherDraftsWithTicker = draftsWithSameTicker(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jupStatus = r.status; o.jupResults = arr.length;
    o.jupSymbolMatches = arr.filter((t) => String(t.symbol).toUpperCase() === c.ticker).map((t) => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    o.jupVerifiedSymbolMatch = o.jupSymbolMatches.some((t) => t.isVerified === true);
  } catch (e) { o.jupError = String(e); }
  results.push(o);
}
console.log(JSON.stringify({ plannedCount: planned.length, disclosureOnly: R.checkFields({ description: DISC }), results }, null, 1));
