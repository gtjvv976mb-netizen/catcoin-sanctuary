import { writeFileSync } from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/MSFTX-verify";
const DISC = "A cat coin priced in MSFTx. Not affiliated with Microsoft Corporation or StonkFun. No intrinsic value; not financial advice.";
const coins = JSON.parse(process.argv[2]);
const stockTerms = { stock: ["MSFT","MSFTX","MSFTx","MSF","Microsoft","Microsoft Corporation","Microsoft xStock","Micro","Soft","Windows","Window","Xbox","Office","Azure","Copilot","Bing","Surface","Outlook","Excel","Redmond","Cortana","Teams","LinkedIn","Skype",
 "GitHub","Octocat","Mona","Invertocat","Octodex","Octopuss","Simon Oxley","Oxley","Octopus","Tentacle","Links","Scribble","Clippy","Clippit","Office Assistant","Ninja Cat","Ninja","Unicorn","T-Rex",
 "Minecraft","Mojang","Jellie","Jelly","GoodTimesWithScar","Scar","Jeb","Creeper","Villager","Ocelot","Minecoin","Khajiit","Elsweyr","Elder Scrolls","Bethesda","ZeniMax",
 "Hello Kitty","Sanrio","Razzleberries","Jaguar","Cougar","Panther","Bobcat","Nadella","Satya","Bill Gates","Gates","xStock","xStocks","Backed","Grumpy","Grumpy Cat","Tardar"] };
const memeBanned = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOCHI","MOG","MANEKI","PUSS","MEOW","PURR","WIF","SMOG","BOOP","NEKO"];
const out = [];
for (const c of coins) {
  const desc = c.description;
  const o = { name: c.name, ticker: c.ticker };
  o.lengths = { name: c.name.length, ticker: c.ticker.length, description: desc.length, nameOk: c.name.length <= 32, tickerOk: c.ticker.length >= 2 && c.ticker.length <= 10, descOk: desc.length <= 280 };
  o.endsWithDisclosure = desc.endsWith(DISC);
  const body = desc.endsWith(DISC) ? desc.slice(0, desc.length - DISC.length).trim() : desc;
  o.bodyLen = body.length;
  o.tickerRegex = R.TICKER.test(c.ticker);
  o.tickerVsRoot = { equalsRoot: ["MSFT","MSFTX"].includes(c.ticker), containsMSFT: /MSFT|MSF|MSOFT|MICRO/.test(c.ticker) };
  o.memeBanned = memeBanned.includes(c.ticker);
  o.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: body });
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  o.checkFields_nameSymbolBodyLook = R.checkFields({ name: c.name, symbol: c.ticker, description_body: body, look: c.look });
  o.checkFields_fullDescription = R.checkFields({ description: desc });
  o.checkFields_disclosureOnly = R.checkFields({ disclosure: DISC });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, description_body: body, look: c.look }, stockTerms);
  for (const q of [c.ticker, ...(c.extraQueries || [])]) {
    try {
      const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
      const txt = await r.text();
      writeFileSync(`${DIR}/jup-${q}.json`, txt);
      const j = JSON.parse(txt); const arr = Array.isArray(j) ? j : (j.tokens || []);
      const same = arr.filter((x) => String(x.symbol).toLowerCase() === q.toLowerCase());
      (o.jupiter ??= []).push({ query: q, status: r.status, results: arr.length, allSymbols: arr.map(x => `${x.symbol}/${x.name}/v=${x.isVerified}`), sameSymbol: same.length, sameSymbolVerified: same.filter(x => x.isVerified === true).length, savedTo: `${DIR}/jup-${q}.json` });
    } catch (e) { (o.jupiter ??= []).push({ query: q, error: String(e) }); }
  }
  out.push(o);
}
console.log(JSON.stringify(out, null, 1));
