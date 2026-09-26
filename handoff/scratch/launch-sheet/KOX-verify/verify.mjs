import { writeFileSync } from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const D = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/KOX-verify";
const DISC = "A cat coin priced in KOx. Not affiliated with The Coca-Cola Company or StonkFun. No intrinsic value; not financial advice.";
const coins = [
 { name: "Sherbet the Garden Kitten", ticker: "SHERBET", description: "Sherbet is a tiny fluffy cream-and-ginger kitten with round copper eyes. She bats at bubbles in the birdbath, sneezes when they burst, then naps in the moss. A cat coin priced in KOx. Not affiliated with The Coca-Cola Company or StonkFun. No intrinsic value; not financial advice." },
 { name: "Tumble the Kitten", ticker: "TUMBLES", description: "Tumble is a small silver tabby kitten with four white socks. Wherever she naps in the garden, more kittens pile in beside her until the flower bed purrs. A cat coin priced in KOx. Not affiliated with The Coca-Cola Company or StonkFun. No intrinsic value; not financial advice." },
 { name: "Tiptop the Kitten", ticker: "TIPTOPS", description: "Tiptop is a little black kitten with a white star on her chest. She climbs to the top of every cuddle pile and garden wall, then squeaks to be lifted down. A cat coin priced in KOx. Not affiliated with The Coca-Cola Company or StonkFun. No intrinsic value; not financial advice." },
];
const stockTerms = { stock: ["KO", "KOX", "KOx", "Coca-Cola", "Coca Cola", "Coca", "Cola", "Coke", "Diet Coke", "Diet", "xStock", "xStocks", "Backed",
  "Sprite", "Fanta", "Dasani", "Minute Maid", "Powerade", "Smartwater", "Vitaminwater", "Fresca", "Tab", "Barqs", "Barq's", "Fairlife", "Topo Chico", "Costa",
  "Simply", "Gold Peak", "Honest", "Innocent", "BodyArmor", "Schweppes", "Qoo", "Georgia", "Kochakaden", "Fuze", "Aquarius", "Ciel", "Mello Yello", "Pibb", "Surge", "Thums Up", "Limca", "Maaza", "Glaceau", "Peace Tea", "Ayataka",
  "Get A Taste", "Open Happiness", "Happiness", "Taste the Feeling", "Real Magic", "Real Thing", "Holidays Are Coming", "polar bear", "Santa", "Dynamic Ribbon", "Contour", "Share a Coke", "Kittens",
  "Taylor", "Swift", "Taylor Swift", "Tay", "Swiftie", "Olivia", "Benson", "Olivia Benson", "Meredith", "Meredith Grey", "Benjamin Button", "Button", "1989", "Scottish Fold", "Hargitay",
  "Quincey", "James Quincey", "Braun", "Henrique Braun", "Pemberton", "Candler", "Simba", "Hello Kitty", "Sanrio", "Kuromi", "Fisher Cats"] };
const MEME = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","KITTENS","TABBY","MOG","MANEKI","SCF","BONK","WIF","PUSS","NEKO","MEOW","PURR","CATWIF","MIAO","SIGMA"];
const out = [];
async function jup(q, tag) {
  const url = `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`;
  const res = await fetch(url); const text = await res.text();
  const file = `${D}/KOX-jup-${tag}.json`; writeFileSync(file, text);
  let arr = []; try { const j = JSON.parse(text); arr = Array.isArray(j) ? j : (j.tokens ?? []); } catch {}
  return { url, status: res.status, results: arr.length, rawFile: file, arr };
}
for (const c of coins) {
  const i = c.description.indexOf(DISC);
  const blurb = c.description.slice(0, i).trim();
  const r = { name: c.name, ticker: c.ticker };
  r.lengths = { name: c.name.length, ticker: c.ticker.length, description: c.description.length, blurb: blurb.length };
  r.lengthOk = c.name.length <= 32 && c.ticker.length <= 10 && c.description.length <= 280;
  r.endsWithDisclosure = c.description.endsWith(DISC);
  r.tickerFormat = R.TICKER.test(c.ticker);
  r.tickerVsRoot = { containsKO: /KO/i.test(c.ticker), startsWithK: c.ticker.startsWith("K"), containsCOLA: /COLA|COKE/i.test(c.ticker) };
  r.memeTicker = MEME.includes(c.ticker);
  r.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: blurb });
  r.checkFields_nameSymbolBlurb = R.checkFields({ name: c.name, symbol: c.ticker, tagline: blurb });
  r.checkFields_fullDescription = R.checkFields({ description: c.description });
  r.checkFields_disclosureOnly = R.checkFields({ description: DISC });
  r.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  r.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: blurb }, stockTerms);
  const j = await jup(c.ticker, c.ticker);
  r.jupiter = { url: j.url, status: j.status, results: j.results, rawFile: j.rawFile,
    all: j.arr.map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified ?? null })),
    symbolMatches: j.arr.filter(t => String(t.symbol).toLowerCase() === c.ticker.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })) };
  r.jupiter.verifiedCollision = r.jupiter.symbolMatches.some(t => t.isVerified === true);
  const base = c.name.split(" ")[0];
  const jn = await jup(base, `name-${base}`);
  r.jupiterNameSearch = { query: base, status: jn.status, results: jn.results, rawFile: jn.rawFile,
    verified: jn.arr.filter(t => t.isVerified).map(t => ({ symbol: t.symbol, name: t.name })),
    exactSymbolBase: jn.arr.filter(t => String(t.symbol).toLowerCase() === base.toLowerCase()).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })) };
  out.push(r);
}
writeFileSync(`${D}/KOX-verify.out.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
