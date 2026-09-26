import fs from "node:fs";
const DIR = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/";
const { checkProposal, checkFields, checkTerms, displaySafe, TICKER } = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in GOOGLx. Not affiliated with Alphabet Inc. or StonkFun. No intrinsic value; not financial advice.";
const cands = [
 { name: "Currant the Garden Cat", ticker: "CURRANT", description: "Currant is a sleek, solid black cat with a glossy coat. She naps in the shade of the berry bushes and pads out at dusk to greet everyone at the garden gate. A cat coin priced in GOOGLx. Not affiliated with Alphabet Inc. or StonkFun. No intrinsic value; not financial advice." },
 { name: "Licorice the Hammock Cat", ticker: "LICORICE", description: "Licorice is a solid black cat, soft as velvet from nose to tail. He claims the sunniest hammock in the garden, stretches out long and purrs until sundown. A cat coin priced in GOOGLx. Not affiliated with Alphabet Inc. or StonkFun. No intrinsic value; not financial advice." },
 { name: "Porchlight the Dusk Cat", ticker: "PORCHLIGHT", description: "Porchlight is a solid black cat with a shiny coat and two bright eyes. When the garden lanterns glow, she sits on the porch step and slowly blinks hello. A cat coin priced in GOOGLx. Not affiliated with Alphabet Inc. or StonkFun. No intrinsic value; not financial advice." },
];
const stockTerms = { stock: ["GOOGL","GOOG","GOOGLX","GOOGLx","GOOGLE","GOOGLEX","Alphabet","Momo","Lucky","Neko","Juliana","Chen","Magic Cat Academy","Doodle","Champion Island","panther","cheetah","lynx","felix","Pixel","Android","Nougat","Chrome","Gemini","YouTube","Waymo","DeepMind","Sundar","Pichai","Larry Page","Sergey","Brin","Jeff Dean","Andrew Ng","Backed","xStock","wand","witch","wizard","ghost","broom","Halloween","Kurian","Porat","Hassabis"] };
const MEME = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","MOG","MANEKI","PURR","MEOW","CATWIF","WIF","KITTEN","SC","BILLY","SIGMA","GIGA","PUSS","NEKO","TABBY","MOCHI","MOMO","LUCKY"];
const out = [];
for (const c of cands) {
  const body = c.description.slice(0, c.description.indexOf(DISC)).trim();
  const url = `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`;
  let raw, status;
  try { const r = await fetch(url); status = r.status; raw = await r.text(); } catch (e) { status = "ERR"; raw = String(e); }
  fs.writeFileSync(DIR + `GOOGLX-verify-jup-${c.ticker}.json`, raw);
  let arr = []; try { arr = JSON.parse(raw); } catch {}
  const same = (Array.isArray(arr) ? arr : []).filter(t => String(t.symbol ?? "").toLowerCase() === c.ticker.toLowerCase());
  const verifiedSame = same.filter(t => t.isVerified === true);
  const r = {
    name: c.name, ticker: c.ticker,
    lengths: { name: c.name.length, ticker: c.ticker.length, description: c.description.length, body: body.length },
    tickerFormat: TICKER.test(c.ticker),
    endsWithDisclosure: c.description.endsWith(DISC),
    containsGOOG: /goog/i.test(c.ticker), memeTicker: MEME.includes(c.ticker),
    checkProposal: checkProposal({ name: c.name, symbol: c.ticker, tagline: body }),
    checkProposalFullDesc: checkProposal({ name: c.name, symbol: c.ticker, tagline: c.description }),
    displaySafe: displaySafe({ name: c.name, symbol: c.ticker }),
    checkFieldsFull: checkFields({ name: c.name, symbol: c.ticker, description: c.description }),
    checkFieldsBody: checkFields({ name: c.name, symbol: c.ticker, description: body }),
    checkTermsStock: checkTerms({ name: c.name, symbol: c.ticker, description: body }, stockTerms),
    jupiter: { url, status, results: Array.isArray(arr) ? arr.length : null, sameSymbol: same.map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })), verifiedSame: verifiedSame.length },
  };
  out.push(r); console.log(JSON.stringify(r));
}
fs.writeFileSync(DIR + "GOOGLX-verify.out.json", JSON.stringify(out, null, 2));
