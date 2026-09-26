const { checkProposal, checkFields, checkTerms, displaySafe } = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in GOOGLx. Not affiliated with Alphabet Inc. or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Currant the Garden Cat", symbol: "CURRANT", body: "Currant is a sleek, solid black cat with a glossy coat. She naps in the shade of the berry bushes and pads out at dusk to greet everyone at the garden gate." },
  { name: "Licorice the Hammock Cat", symbol: "LICORICE", body: "Licorice is a solid black cat, soft as velvet from nose to tail. He claims the sunniest hammock in the garden, stretches out long and purrs until sundown." },
  { name: "Porchlight the Dusk Cat", symbol: "PORCHLIGHT", body: "Porchlight is a solid black cat with a shiny coat and two bright eyes. When the garden lanterns glow, she sits on the porch step and slowly blinks hello." },
];
const stockTerms = { stock: ["GOOGL", "GOOG", "GOOGLX", "GOOGLx", "GOOGLE", "Alphabet", "Momo", "Lucky", "Neko", "Sugar", "Captain Sugar", "Ripley", "Marshmallow", "Juliana", "Chen", "Magic Cat Academy", "Magic", "Academy", "Doodle", "Doodler", "Champion Island", "panther", "cheetah", "lynx", "felix", "Pixel", "Android", "Nougat", "Chrome", "Gemini", "YouTube", "Waymo", "DeepMind", "Google Brain", "Sundar", "Pichai", "Larry Page", "Sergey", "Brin", "Jeff Dean", "Andrew Ng", "Backed", "xStock", "wand", "witch", "wizard", "ghost", "broom", "Jinx", "Halloween"] };
const out = [];
for (const c of coins) {
  const description = c.body + " " + DISC;
  const r = {
    name: c.name, symbol: c.symbol, nameLen: c.name.length, bodyLen: c.body.length, descLen: description.length,
    checkProposal: checkProposal({ name: c.name, symbol: c.symbol, tagline: c.body }),
    displaySafe: displaySafe({ name: c.name, symbol: c.symbol }),
    checkFieldsFullDescription: checkFields({ description }),
    checkTermsStock: checkTerms({ name: c.name, symbol: c.symbol, description: c.body }, stockTerms),
    description,
  };
  out.push(r);
  console.log(JSON.stringify(r));
}
(await import("node:fs")).writeFileSync("GOOGLX-check.out.json", JSON.stringify(out, null, 2));
