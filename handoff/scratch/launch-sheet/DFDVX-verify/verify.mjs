import { writeFileSync } from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/DFDVX-verify";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in DFDVx. Not affiliated with DeFi Development Corp. or StonkFun. No intrinsic value; not financial advice.";
const C = [
 { name: "Latchkey the Vault Cat", ticker: "LATCHKEY", description: "Latchkey, a sturdy brown tabby with white socks, naps curled on a little iron-banded strongbox in the garden shed, its brass key tucked under her chin. A cat coin priced in DFDVx. Not affiliated with DeFi Development Corp. or StonkFun. No intrinsic value; not financial advice.", look: "A sturdy brown mackerel-tabby house cat with four white socks, curled asleep on top of a small wooden strongbox with iron bands, an old brass key tucked under her chin." },
 { name: "Stashpaw the Hoarding Cat", ticker: "STASHPAW", description: "Stashpaw, a sleek smoke-grey cat with pale green eyes, hides shiny buttons and bottle caps under the hedge and adds one more to the pile every morning. A cat coin priced in DFDVx. Not affiliated with DeFi Development Corp. or StonkFun. No intrinsic value; not financial advice.", look: "A sleek short-haired smoke-grey house cat with pale green eyes, crouched under a hedge beside a small tidy pile of shiny buttons and bottle caps, one paw nudging a new one onto the heap." },
 { name: "Doorstop the Guard Cat", ticker: "DOORSTOP", description: "Doorstop, a hefty cream long-haired cat, flops across the little wooden cellar hatch at the end of the garden and will not budge, however nicely you ask. A cat coin priced in DFDVx. Not affiliated with DeFi Development Corp. or StonkFun. No intrinsic value; not financial advice.", look: "A big, heavy cream-coloured long-haired house cat with a fluffy tail, lying flat across a small wooden cellar hatch set in the grass, eyes half-closed and utterly unmovable." },
];
const extra = JSON.parse(process.env.EXTRA || "[]"); C.push(...extra);
const stockTerms = { stock: ["DFDV","DFDVX","DFDVx","DFDVSOL","dfdvSOL","DeFi Development","DeFi Development Corp","DeFi Dev Corp","DeFi Dev","DeFi","DevCorp","DDC","xStock","xStocks","Backed","Backed Finance","Solana","SOL","CHAD","DisclaimerCoin","DONT","Disclaimer","Joseph Onorati","Onorati","Parker White","Treasury Accelerator","SOL Per Share","SPS","CTV","BONK","Kraken","ZeroStack","Janover"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","MEOW","PURR","TABBY","MOCHI","MANEKI","GARFIELD","TOM","FELIX","SIMON"]);
async function jup(q) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const txt = await r.text();
  writeFileSync(`${DIR}/jup-${q.replace(/[^A-Za-z0-9]+/g,"_")}.json`, txt);
  let arr; try { const j = JSON.parse(txt); arr = Array.isArray(j) ? j : (j.tokens ?? []); } catch { arr = null; }
  return { status: r.status, arr };
}
const out = [];
const ctrl = await jup("POPCAT");
out.push({ control: "POPCAT", status: ctrl.status, n: ctrl.arr?.length, verifiedPOPCAT: ctrl.arr?.filter(t => String(t.symbol).toLowerCase()==="popcat" && t.isVerified===true).length });
for (const c of C) {
  const tagline = c.description.slice(0, c.description.indexOf(" A cat coin priced in"));
  const o = { name: c.name, ticker: c.ticker, lengths: { name: c.name.length, ticker: c.ticker.length, description: c.description.length, tagline: tagline.length } };
  o.withinLimits = c.name.length <= 32 && c.ticker.length >= 2 && c.ticker.length <= 10 && c.description.length <= 280;
  o.tickerFormat = R.TICKER.test(c.ticker);
  o.endsWithDisclosure = c.description.endsWith(DISC);
  o.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline });
  o.checkFields_description = R.checkFields({ description: c.description });
  o.checkFields_disclosure = R.checkFields({ description: DISC });
  o.checkFields_look = R.checkFields({ look: c.look });
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline, look: c.look }, stockTerms);
  o.memeTicker = MEME.has(c.ticker);
  o.confusableWithRoot = /DFDV|DFD|DDC/.test(c.ticker);
  const j = await jup(c.ticker);
  o.jup = { status: j.status, results: j.arr?.length, symbolMatches: (j.arr||[]).filter(t => String(t.symbol).toLowerCase()===c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })), allSymbols: (j.arr||[]).map(t => `${t.symbol}${t.isVerified?"(verified)":""}`) };
  o.jup.verifiedCollision = o.jup.symbolMatches.some(t => t.isVerified === true);
  const first = c.name.split(" ")[0];
  const jn = await jup(first);
  o.jupName = { query: first, results: jn.arr?.length, hits: (jn.arr||[]).slice(0,10).map(t => `${t.symbol} / ${t.name}${t.isVerified?" (verified)":""}`) };
  out.push(o);
}
writeFileSync(`${DIR}/verify.out.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
