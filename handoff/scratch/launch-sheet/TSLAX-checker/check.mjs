import { writeFileSync } from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const OUT = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/TSLAX-checker/";
const DISC = "A cat coin priced in TSLAx. Not affiliated with Tesla, Inc. or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(process.argv[2]);
const stockTerms = { stock: ["TSLA", "TSLAX", "TSLAx", "Tesla", "Tesla Inc", "Elon", "Musk", "Elon Musk", "Schrodinger", "Schroedinger", "Pet Mode", "Dog Mode", "Camp Mode", "balloon cat", "balloon dog", "balloon", "Cyberhog", "Cybertruck", "Cybercab", "Cheetah Stance", "cheetah", "tiger", "Plaid", "Ludicrous", "Cat Quest", "Optimus", "Taco", "Macak", "Nikola", "Grok", "Backed", "xStock", "roaring kitty", "catgirl", "Lil X", "Model S", "Model Y"] };
const COMMON_CAT = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","MOG","MANEKI","WIF","SCHRODI","SCHRO","BONGO","KEYCAT","HAPPYCAT","CATWIF","MOMO","PUSS","MEOW","TOSHI","HAPPY","GIGA","MIAO","PURR"];
function lev(a,b){const d=Array.from({length:a.length+1},(_, i)=>[i,...Array(b.length).fill(0)]);for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length];}
const report = [];
for (const c of coins) {
  const r = { name: c.name, ticker: c.ticker };
  r.lengths = { name: c.name.length, ticker: c.ticker.length, description: c.description.length, okName: c.name.length <= 32, okTicker: c.ticker.length >= 2 && c.ticker.length <= 10, okDesc: c.description.length <= 280 };
  r.tickerFormat = R.TICKER.test(c.ticker);
  r.disclosureExactAtEnd = c.description.endsWith(DISC);
  const body = r.disclosureExactAtEnd ? c.description.slice(0, -DISC.length).trim() : c.description;
  r.bodyLength = body.length;
  r.checkProposal_body = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: body });
  r.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.description });
  r.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  r.checkFields_all = R.checkFields({ name: c.name, symbol: c.ticker, description: c.description, look: c.look });
  r.checkFields_withoutDisclosure = R.checkFields({ name: c.name, symbol: c.ticker, description: body, look: c.look });
  r.checkFields_disclosureOnly = R.checkFields({ disclosure: DISC });
  r.checkTerms_stockWords = R.checkTerms({ name: c.name, symbol: c.ticker, description: body, look: c.look }, stockTerms);
  const t = c.ticker.toUpperCase();
  r.confusable = { containsTSLA: t.includes("TSLA"), startsWithTS: t.startsWith("TS"), levToTSLA: lev(t, "TSLA"), levToTSLAX: lev(t, "TSLAX"), commonCatTicker: COMMON_CAT.includes(t) };
  const url = `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`;
  const res = await fetch(url); const raw = await res.text();
  writeFileSync(OUT + `jup-${c.ticker}.json`, raw);
  let arr = []; try { const j = JSON.parse(raw); arr = Array.isArray(j) ? j : (j.tokens || []); } catch {}
  const same = arr.filter((x) => String(x.symbol).toLowerCase() === c.ticker.toLowerCase());
  r.jupiter = { url, status: res.status, results: arr.length, sameSymbol: same.length, sameSymbolVerified: same.filter((x) => x.isVerified).length,
    all: arr.map((x) => `${x.symbol} | ${x.name} | verified=${x.isVerified} | ${x.id}`) };
  report.push(r);
}
writeFileSync(OUT + "report.json", JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
