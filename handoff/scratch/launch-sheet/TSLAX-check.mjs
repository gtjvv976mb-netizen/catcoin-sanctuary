const { checkProposal, checkFields, checkTerms, displaySafe } = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in TSLAx. Not affiliated with Tesla, Inc. or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Snowcurl the Garden Cat", symbol: "SNOWCURL", body: "Snowcurl is a sleek white cat with her tail held high and curled at the tip. On hot days she finds cool shade, lifts a paw to wash her face and waits, calm." },
  { name: "Mallow the Cloud Cat", symbol: "MALLOWCAT", body: "Mallow is a soft, glossy white cat, smooth as a marshmallow. She perches on the garden wall, tail up in a hook, and greets you with a slow, sleepy blink." },
  { name: "Coolpaw the Patient Cat", symbol: "COOLPAW", body: "Coolpaw is a calm white shorthair who never frets. By the fountain she sits, one paw raised to her whiskers and tail curled high, waiting for you to come home." },
];
const stockTerms = { stock: ["TSLA", "TSLAX", "TSLAx", "Tesla", "Tesla Inc", "Elon", "Musk", "Schrodinger", "Pet Mode", "Dog Mode", "balloon cat", "balloon dog", "balloon", "Cyberhog", "Cybertruck", "Cybercab", "Cheetah Stance", "cheetah", "Plaid", "Ludicrous", "Cat Quest", "Optimus", "Taco", "Macak", "Nikola", "Grok", "Backed", "xStock", "roaring kitty"] };
for (const c of coins) {
  const description = c.body + " " + DISC;
  console.log("==", c.name, c.symbol, "| name len", c.name.length, "| body len", c.body.length, "| desc len", description.length);
  console.log(" checkProposal(tagline=body):", JSON.stringify(checkProposal({ name: c.name, symbol: c.symbol, tagline: c.body })));
  console.log(" displaySafe:", JSON.stringify(displaySafe({ name: c.name, symbol: c.symbol })));
  console.log(" checkFields(full description incl. disclosure):", JSON.stringify(checkFields({ description })));
  console.log(" checkTerms(stock words, name/symbol/body):", JSON.stringify(checkTerms({ name: c.name, symbol: c.symbol, description: c.body }, stockTerms)));
  console.log(" DESC:", description);
}
