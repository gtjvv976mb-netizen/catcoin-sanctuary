const { checkProposal, checkFields, checkTerms } = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in SPYx. Not affiliated with State Street or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Patchpaw the Calico", symbol: "PATCHPAW", body: "Patchpaw is a little calico whose coat is a quilt of many small patches, no two alike. She pads through every flower bed in the garden and sniffs each one." },
  { name: "Longnap the Tabby", symbol: "LONGNAP", body: "Longnap is a round silver tabby who picks one warm sunbeam each morning and stays curled up in it all day. She never checks a chart, only where the sun went." },
  { name: "Wicker the Basket Cat", symbol: "WICKERCAT", body: "Wicker is a plump cream-and-ginger cat who sleeps in a woven basket of yarn balls in every colour, and never lets a single one roll away." },
];
const stockTerms = { stock: ["SPY", "SPYX", "SPYx", "SPDR", "SP500", "S&P", "State Street", "spider", "Standard and Poors", "Backed"] };
for (const c of coins) {
  const description = c.body + " " + DISC;
  console.log("==", c.name, c.symbol, "| name", c.name.length, "| desc", description.length);
  console.log(" checkProposal(tagline=body):", JSON.stringify(checkProposal({ name: c.name, symbol: c.symbol, tagline: c.body })));
  console.log(" checkFields(full description):", JSON.stringify(checkFields({ description })));
  console.log(" checkTerms(stock words, name/symbol/body):", JSON.stringify(checkTerms({ name: c.name, symbol: c.symbol, description: c.body }, stockTerms)));
  console.log(" DESC:", description);
}
