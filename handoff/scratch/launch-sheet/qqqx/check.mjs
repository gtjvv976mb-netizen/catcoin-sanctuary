const cr = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
import fs from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/qqqx";
const DISC = "A cat coin priced in QQQx. Not affiliated with Invesco, Nasdaq or StonkFun. No intrinsic value; not financial advice.";
const cands = JSON.parse(fs.readFileSync(DIR + "/cands.json", "utf8"));
const stockTerms = ["QQQ","QQQX","QQQx","Invesco","Nasdaq","NDX","NDQ","NAS100","US100","Ama Dablam","xStock","Cubes","Nasdaq-100","Trust","Series"];
const MEMES = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","MOG","BONK","WIF","MANEKI","KITTEN","CATWIF","TOSHI","MOCHI"];
const out = [];
for (const c of cands) {
  const story = c.description.endsWith(DISC) ? c.description.slice(0, -DISC.length).trim() : null;
  const r = { name: c.name, ticker: c.ticker };
  r.endsWithDisclosure = story !== null;
  r.storyLen = story?.length;
  r.lengths = { name: c.name.length, ticker: c.ticker.length, description: c.description.length };
  r.lenOk = c.name.length <= 32 && c.ticker.length <= 10 && c.description.length <= 280;
  r.tickerFormat = cr.TICKER.test(c.ticker);
  r.checkProposal = cr.checkProposal({ name: c.name, symbol: c.ticker, tagline: story });
  r.checkFieldsLook = cr.checkFields({ look: c.look });
  r.checkFieldsFullDesc = cr.checkFields({ description: c.description });
  r.checkTermsStock = cr.checkTerms({ name: c.name, symbol: c.ticker, tagline: story, look: c.look }, { stock: stockTerms });
  r.displaySafe = cr.displaySafe({ name: c.name, symbol: c.ticker });
  r.qqqInTicker = /Q{2,}|NDX|NAS|INV/.test(c.ticker);
  r.memeTicker = MEMES.includes(c.ticker);
  // Jupiter
  const url = "https://lite-api.jup.ag/tokens/v2/search?query=" + encodeURIComponent(c.ticker);
  const res = await fetch(url); const txt = await res.text();
  fs.writeFileSync(`${DIR}/jup_${c.ticker}.json`, txt);
  let arr = []; try { arr = JSON.parse(txt); } catch {}
  r.jupiter = { status: res.status, count: arr.length,
    symbolMatches: arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ id: t.id, symbol: t.symbol, name: t.name, isVerified: t.isVerified })),
    firstSymbols: arr.slice(0, 10).map(t => `${t.symbol}${t.isVerified ? "(v)" : ""}`) };
  r.jupiterVerifiedClash = r.jupiter.symbolMatches.some(t => t.isVerified);
  out.push(r);
}
fs.writeFileSync(DIR + "/results.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
