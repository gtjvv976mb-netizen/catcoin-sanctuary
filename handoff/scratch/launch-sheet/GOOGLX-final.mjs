import fs from "node:fs";
const { checkProposal, checkFields, checkTerms, displaySafe, TICKER } = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in GOOGLx. Not affiliated with Alphabet Inc. or StonkFun. No intrinsic value; not financial advice.";
const name = "Porchlight the Dusk Cat", ticker = "PORCHLIGHT";
const body = "Porchlight is a solid black cat with a shiny coat and bright yellow eyes. When the garden lanterns glow, she sits on the porch step and slowly blinks hello.";
const description = body + " " + DISC;
const stockTerms = { stock: ["GOOGL","GOOG","GOOGLX","GOOGLx","GOOGLE","GOOGLEX","Alphabet","Momo","Lucky","Neko","Juliana","Chen","Magic Cat Academy","Doodle","Champion Island","panther","cheetah","lynx","felix","Pixel","Android","Nougat","Chrome","Gemini","YouTube","Waymo","DeepMind","Sundar","Pichai","Larry Page","Sergey","Brin","Jeff Dean","Andrew Ng","Backed","xStock","wand","witch","wizard","ghost","broom","Halloween","Kurian","Porat","Hassabis"] };
const r = { name, ticker, description,
  lengths: { name: name.length, ticker: ticker.length, description: description.length },
  tickerFormat: TICKER.test(ticker), endsWithDisclosure: description.endsWith(DISC),
  checkProposal: checkProposal({ name, symbol: ticker, tagline: body }),
  displaySafe: displaySafe({ name, symbol: ticker }),
  checkFieldsFull: checkFields({ name, symbol: ticker, description }),
  checkFieldsBody: checkFields({ name, symbol: ticker, description: body }),
  checkTermsStock: checkTerms({ name, symbol: ticker, description: body }, stockTerms) };
console.log(JSON.stringify(r, null, 1));
fs.writeFileSync("GOOGLX-final.out.json", JSON.stringify(r, null, 2));
