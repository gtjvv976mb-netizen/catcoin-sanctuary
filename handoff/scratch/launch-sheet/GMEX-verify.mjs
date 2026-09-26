import { writeFileSync } from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const { CAT_WORDS } = await import("/home/user/Cat-Intelligence-Agency/bots/lib/catdetect.mjs");
const D = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet";
const DISC = "A cat coin priced in GMEx. Not affiliated with GameStop or StonkFun. No intrinsic value; not financial advice.";
const coins = [
 { name: "Save Point the Tabby", ticker: "SAVEPAWS", description: "Save Point, a small brown striped tabby with a cream chest and muzzle, finds the warmest stone in the garden and naps on it until the sun moves on. A cat coin priced in GMEx. Not affiliated with GameStop or StonkFun. No intrinsic value; not financial advice." },
 { name: "Player Two the Kitten", ticker: "PLAYERTWO", description: "Player Two, a brown striped tabby kitten with a cream-white bib, trots after anyone in the garden and taps their ankle with a soft paw: surely it is her turn. A cat coin priced in GMEx. Not affiliated with GameStop or StonkFun. No intrinsic value; not financial advice." },
 { name: "Little Yowl the Tabby", ticker: "LILYOWL", description: "Little Yowl, a tiny brown striped tabby with a pale cream chest, has the biggest voice in the garden and uses it at dawn, at supper and when a leaf moves. A cat coin priced in GMEx. Not affiliated with GameStop or StonkFun. No intrinsic value; not financial advice." },
];
const stockTerms = { stock: ["GME","GMEX","GMEx","GameStop","Game Stop","Gamestop xStock","xStock","xStocks","Backed","Roaring Kitty","RoaringKitty","Roaring","Roar","Kitty","Keith Gill","Keith","Gill","DeepFuckingValue","DFV","Ryan Cohen","Cohen","Cat Quest","Taco Cats","Chewy","EB Games","Game Informer","ThinkGeek","Kongregate","Power Up","PowerUp","GameStop Pro","Ape","Apes","Diamond Hands","HODL","Stonk","Stonks","Rambo","Headband","Dumb Money","Superstonk","WallStreetBets","WSB","Squeeze"] };
const MEME = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","SCF","BONK","WIF","PUSS","NEKO","MEOW","PURR"];
const out = [];
for (const c of coins) {
  const blurb = c.description.slice(0, c.description.indexOf(DISC)).trim();
  const r = { name: c.name, ticker: c.ticker };
  r.lengths = { name: c.name.length, ticker: c.ticker.length, description: c.description.length, blurb: blurb.length };
  r.lengthOk = c.name.length <= 32 && c.ticker.length <= 10 && c.description.length <= 280;
  r.endsWithDisclosure = c.description.endsWith(DISC);
  r.tickerFormat = R.TICKER.test(c.ticker);
  r.tickerVsRoot = { containsGME: /GME/i.test(c.ticker), startsWithG: c.ticker.startsWith("G") };
  r.memeTicker = MEME.includes(c.ticker);
  r.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: blurb });
  r.checkFields_nameSymbolBlurb = R.checkFields({ name: c.name, symbol: c.ticker, tagline: blurb });
  r.checkFields_fullDescription = R.checkFields({ description: c.description });
  r.checkFields_disclosureOnly = R.checkFields({ description: DISC });
  r.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  r.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: blurb }, stockTerms);
  const url = `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`;
  const res = await fetch(url); const text = await res.text();
  writeFileSync(`${D}/GMEX-jup-${c.ticker}.json`, text);
  let arr = []; try { const j = JSON.parse(text); arr = Array.isArray(j) ? j : (j.tokens ?? []); } catch {}
  r.jupiter = { url, status: res.status, results: arr.length, rawFile: `${D}/GMEX-jup-${c.ticker}.json`,
    all: arr.map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified ?? null, id: t.id })),
    symbolMatches: arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })) };
  r.jupiter.verifiedCollision = r.jupiter.symbolMatches.some(t => t.isVerified === true);
  out.push(r);
}
writeFileSync(`${D}/GMEX-verify.out.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
