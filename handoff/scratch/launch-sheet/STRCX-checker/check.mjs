import { writeFileSync } from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/STRCX-checker";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in STRCx. Not affiliated with Strategy Inc. or StonkFun. No intrinsic value; not financial advice.";
const cands = [
 { name: "Firstbowl the Cream Cat", ticker: "FIRSTBOWL", description: "Firstbowl, a chunky cream-and-white shorthair, is always first to the row of garden food bowls, sitting politely with her tail tucked round her paws. A cat coin priced in STRCx. Not affiliated with Strategy Inc. or StonkFun. No intrinsic value; not financial advice." },
 { name: "Everloop the Sleepy Cat", ticker: "EVERLOOP", description: "Everloop, a round silver tabby, curls into a perfect ring with her nose tucked in her tail and naps in the garden as if the afternoon will never end. A cat coin priced in STRCx. Not affiliated with Strategy Inc. or StonkFun. No intrinsic value; not financial advice." },
 { name: "Rung the Ladder Cat", ticker: "LADDERCAT", description: "Rung, a brown tabby with white socks, climbs the old garden ladder each month and tries a new rung, a bit higher or lower, until the view is just right. A cat coin priced in STRCx. Not affiliated with Strategy Inc. or StonkFun. No intrinsic value; not financial advice." },
];
const stockTerms = { stock: ["STRC","STRCX","STRCx","Strategy PP Variable xStock","Strategy","Strategy Inc","MicroStrategy","xStock","xStocks","Backed",
 "Stretch","Stretch Preferred","Variable Rate Series A","Perpetual Stretch","MSTR","MSTRX","STRK","STRF","STRD","STRE","Strike","Strife","Stride","Stream",
 "Saylor","Michael Saylor","Phong Le","Maxi","honey badger","badger","Auto","Hank","PetsofMSTR","bitcoin","BTC","sats","satoshi","laser eyes","piggy","Uncle Sam","labrador","Kraken"] };
const memes = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOCHI","PURR","MEOW","NEKO","GIGACAT","CATWIF","WIF"]);
const out = [];
for (const c of cands) {
  const blurb = c.description.endsWith(DISC) ? c.description.slice(0, -DISC.length).trim() : null;
  const o = { ticker: c.ticker, name: c.name, nameLen: c.name.length, tickerLen: c.ticker.length, descLen: c.description.length, blurbLen: blurb?.length ?? null,
    endsWithDisclosure: c.description.endsWith(DISC) };
  o.checkProposal_blurbAsTagline = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: blurb });
  o.checkProposal_fullDescAsTagline = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.description });
  o.checkFields_fullDescription = R.checkFields({ description: c.description });
  o.checkFields_disclosureOnly = R.checkFields({ disclosure: DISC });
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, description: blurb }, stockTerms);
  o.tickerRegex = R.TICKER.test(c.ticker);
  o.memeTicker = memes.has(c.ticker) || /CAT$/.test(c.ticker) && memes.has(c.ticker.replace(/CAT$/, ""));
  o.containsStockRoot = /STRC|MSTR|STR/.test(c.ticker);
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`);
  const txt = await r.text();
  writeFileSync(`${DIR}/jup-${c.ticker}.json`, txt);
  const j = JSON.parse(txt); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  o.jupStatus = r.status; o.jupResults = arr.length;
  o.jupSymbolsReturned = arr.map(t => `${t.symbol}${t.isVerified ? "(v)" : ""}`);
  o.jupSymbolMatches = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
  o.jupVerifiedMatch = o.jupSymbolMatches.some(t => t.isVerified === true);
  out.push(o);
}
// control: a known verified ticker should show a verified match
const rc = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=POPCAT`); const tc = await rc.text(); writeFileSync(`${DIR}/jup-POPCAT-control.json`, tc);
const ac = JSON.parse(tc); out.push({ control: "POPCAT", status: rc.status, verifiedSymbolMatch: (Array.isArray(ac)?ac:[]).some(t => String(t.symbol).toLowerCase()==="popcat" && t.isVerified) });
writeFileSync(`${DIR}/results.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
