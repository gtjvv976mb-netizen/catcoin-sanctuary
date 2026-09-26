import fs from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/HOODX-verify";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in HOODx. Not affiliated with Robinhood or StonkFun. No intrinsic value; not financial advice.";
const coins = [
 { name: "Pewter the Garden Tabby", ticker: "PEWTER", description: "Pewter, a silver-grey tabby with dark stripes on her cheeks, a white chin and a pink nose, naps on the warm garden steps and pads after the sun all afternoon. A cat coin priced in HOODx. Not affiliated with Robinhood or StonkFun. No intrinsic value; not financial advice." },
 { name: "Drizzle the Silver Tabby", ticker: "DRIZZLE", description: "Drizzle, a pale grey striped cat with a snowy muzzle and pink ears, watches the rain from under the rhubarb leaves, then tiptoes out to sniff the wet mint. A cat coin priced in HOODx. Not affiliated with Robinhood or StonkFun. No intrinsic value; not financial advice." },
 { name: "Tinsel the Twinkly Tabby", ticker: "TINSEL", description: "Tinsel, a sleek silver tabby with grey paws, a white chin and bright pink ears, chases glinting dewdrops across the lawn and purrs like a tiny kettle. A cat coin priced in HOODx. Not affiliated with Robinhood or StonkFun. No intrinsic value; not financial advice." },
];
const stockTerms = { stock: ["HOOD","HOODX","HOODx","Robinhood","Robin Hood","Robin","Hood","Sherwood","Marian","Nottingham","archer","arrow","feather","bow","Robinhood Markets","xStock","xStocks","Backed",
 "Pixel Cat","pixel","Cash Cat","CashCat","ROBINCAT","PIXELCAT","Vlad","Tenev","Baiju","Bhatt","Legend","Robinhood Gold","Gold card","Robinhood Chain","Bitstamp","Roaring Kitty","Keith Gill","Kitty",
 "Wink","Cass","Popcat","MEW","Pengu","Pnut","catpay","meow","referral","refer","Loading","growing","Something new is growing","Snacks","Cortex","Strategies","Gold"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","MEOW","CASHCAT","ROBINCAT","PIXELCAT","WINK","SIGMA","MANEKI","BOOP","PURR","NEKO","MOCHI","TABBY","KITTEN","CHESHIRE","FELIX","GARFIELD","HOOD","HOODX","HOODCAT","ROBIN","CATWIF","MOG","LOAF","CWIF"]);
const out = [];
for (const c of coins) {
  const i = c.description.indexOf(" A cat coin priced in");
  const body = c.description.slice(0, i);
  const r = { name: c.name, ticker: c.ticker,
    lengths: { name: c.name.length, ticker: c.ticker.length, description: c.description.length, body: body.length },
    limitsOk: c.name.length <= 32 && c.ticker.length <= 10 && c.description.length <= 280,
    endsWithDisclosure: c.description.endsWith(DISC),
    tickerFormat: R.TICKER.test(c.ticker),
    confusableWithHOOD: /HOOD|H00D|ROBIN/i.test(c.ticker),
    memeTicker: memeTickers.has(c.ticker),
    checkProposal: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: body }),
    displaySafe: R.displaySafe({ name: c.name, symbol: c.ticker }),
    checkFields_body: R.checkFields({ name: c.name, symbol: c.ticker, description: body }),
    checkFields_disclosure: R.checkFields({ disclosure: DISC }),
    checkTerms_stock: R.checkTerms({ name: c.name, symbol: c.ticker, description: body }, stockTerms),
  };
  const url = `https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`;
  const res = await fetch(url); const txt = await res.text();
  fs.writeFileSync(`${DIR}/jup-${c.ticker}.raw.json`, txt);
  const j = JSON.parse(txt); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  const m = arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase());
  r.jupiter = { url, status: res.status, results: arr.length, symbolMatches: m.map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified ?? null, mcap: Math.round(t.mcap || 0), id: t.id })),
    verifiedSymbolMatch: m.some(t => t.isVerified === true), anyVerifiedInResults: arr.filter(t => t.isVerified === true).map(t => t.symbol + " / " + t.name) };
  out.push(r);
}
fs.writeFileSync(`${DIR}/check.out.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
