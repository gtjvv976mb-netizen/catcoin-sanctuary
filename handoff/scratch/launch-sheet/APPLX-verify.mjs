import { writeFileSync } from "node:fs";
const { checkProposal, checkFields, checkTerms, displaySafe, TICKER, normalize } = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const D = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet";
const DISC = "A cat coin priced in AAPLx. Not affiliated with Apple Inc. or StonkFun. No intrinsic value; not financial advice.";
const C = [
 { name: "Rosette the Garden Cat", ticker: "ROSETTE", description: "Rosette is a stocky golden-tan cat dappled with black rosette spots. She pads through the tall grass by the pond, then flops in the sun and purrs at the bees. A cat coin priced in AAPLx. Not affiliated with Apple Inc. or StonkFun. No intrinsic value; not financial advice." },
 { name: "Snowspot the Cloud Cat", ticker: "SNOWSPOT", description: "Snowspot is a fluffy smoke-grey cat freckled with dark rosettes. She wraps her long bushy tail round her nose like a scarf and dozes on the cool garden rocks. A cat coin priced in AAPLx. Not affiliated with Apple Inc. or StonkFun. No intrinsic value; not financial advice." },
 { name: "Clementine the Stripy Cat", ticker: "STRIPEY", description: "Clementine is a bright orange cat with bold black stripes and a white chin. She naps in the warm flower beds and trots over, tail high, whenever you call. A cat coin priced in AAPLx. Not affiliated with Apple Inc. or StonkFun. No intrinsic value; not financial advice." },
];
const stockTerms = { stock: ["AAPL","AAPLX","AAPLx","APPLX","APPL","Apple","Apple Inc","Apple xStock","iPhone","iPad","iMac","Mac","macOS","OS X","Mac OS","Cupertino","iCloud","Rosetta","Safari","Siri","Finder","Aqua",
  "Jaguar","Panther","Tiger","Leopard","Snow Leopard","Lion","Mountain Lion","Cheetah","Puma","Animoji","Memoji","Hello Kitty","Sanrio","Sunblink","Tim Cook","Steve Jobs","Jobs","Wozniak","Arcade","xStock","Backed","Think Different"] };
const memes = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOCHI","MOG","PUSS","MEOW","GINGER"];
const out = [];
for (const c of C) {
  const r = { name: c.name, ticker: c.ticker };
  r.endsWithDisclosure = c.description.endsWith(DISC);
  const body = c.description.slice(0, c.description.length - DISC.length).trim();
  r.lens = { name: c.name.length, ticker: c.ticker.length, description: c.description.length, body: body.length };
  r.tickerFormat = TICKER.test(c.ticker);
  r.checkProposal = checkProposal({ name: c.name, symbol: c.ticker, tagline: body });
  r.displaySafe = displaySafe({ name: c.name, symbol: c.ticker });
  r.checkFieldsFullDescription = checkFields({ description: c.description });
  r.checkFieldsBody = checkFields({ description: body });
  r.checkTerms = checkTerms({ name: c.name, symbol: c.ticker, description: body }, stockTerms);
  r.memeTicker = memes.includes(c.ticker);
  r.confusableWithRoot = /AAPL|APPL|APL/.test(c.ticker);
  const url = `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`;
  const res = await fetch(url); const text = await res.text();
  writeFileSync(`${D}/APPLX-jup-${c.ticker}.json`, text);
  let arr = []; try { const j = JSON.parse(text); arr = Array.isArray(j) ? j : (j.tokens || []); } catch {}
  const same = arr.filter((x) => String(x.symbol).toLowerCase() === c.ticker.toLowerCase());
  r.jupiter = { url, status: res.status, results: arr.length, sameSymbol: same.length, sameSymbolVerified: same.filter((x) => x.isVerified).length,
    symbols: arr.map((x) => `${x.symbol}${x.isVerified ? "(v)" : ""}`).join(",") };
  out.push(r);
}
writeFileSync(`${D}/APPLX-verify.out.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
