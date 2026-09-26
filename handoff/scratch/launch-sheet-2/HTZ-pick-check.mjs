const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in HTZ. Not affiliated with Hertz Global Holdings, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["HTZ","Hertz","Hertz Global Holdings","Hertz Global","Hertz Corporation","The Hertz Corporation","Hz","HTZx",
  "Dollar","Dollar Rent A Car","Thrifty","Thrifty Car Rental","Firefly","Firefly Car Rental","Hertz Car Sales","Gold Plus","Gold Plus Rewards","Gold Squad","Golden Retriever","Golden","Gold","Yellow",
  "Horatio","Gil West","Stephen Scherr","Scherr","John Hertz","Jamie Lee Curtis","Arnold Palmer","Palmer","Simpson","Carl Icahn","Icahn","Common Sensei","Mikey Day",
  "Backpack","Backpack Securities","Sunrise","Wormhole","Tesla","Polestar","Shelby","Mustang","Jaguar","Panther","Pink Panther","Panther Black","Hello Kitty","Garfield","Yellow Cab",
  "Rent-a-Racer","ExpressRent","Ultimate Choice","Estero","Uber","Avis","Enterprise","Bobcat","Budget","National","Alamo","Sixt"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","KEYCAT","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SC","GIGA","MIAO","NUB","SIGMA","BCAT","SIMON","GIKO","SNOWBALL","ROAR","HODL"]);
const coins = [
 { pick: false, variant: "draft", name: "Glint the Silver-Sedan Cat", ticker: "GLINTPAW", blurb: "Glint, a sleek silver-grey shorthair with a glossy just-washed coat and copper eyes, sunbathes on the warm stones by the garden gate.", look: "Normal four-legged shorthair, solid silver-grey with a glossy coat and copper eyes. Wears nothing. The look is taken from a freshly washed silver car in a rental fleet." },
 { pick: true, variant: "fixed: placed explicitly in the sanctuary garden", name: "Glint the Silver-Sedan Cat", ticker: "GLINTPAW", blurb: "Glint, a sleek silver-grey shorthair with a glossy just-washed coat and copper eyes, sunbathes on warm stones in the sanctuary garden.", look: "Normal four-legged shorthair, solid silver-grey with a glossy coat and copper eyes. Wears nothing. The look is taken from a freshly washed silver car in a rental fleet." },
 { pick: false, variant: "draft", name: "Lane the Road-Stripe Tabby Cat", ticker: "LANETAIL", blurb: "Lane, an asphalt-grey tabby with cream stripes like fresh road markings and leaf-green eyes, trots the garden path like an open road.", look: "Normal four-legged tabby, dark asphalt-grey with cream stripes and leaf-green eyes. Wears nothing. The look is taken from road trips and lane markings." },
 { pick: false, variant: "draft", name: "Curbside the Tuxedo Cat", ticker: "CURBPAW", blurb: "Curbside, a neat black-and-white tuxedo cat with white paws and pale green eyes, waits by the garden gate to greet every new arrival.", look: "Normal four-legged tuxedo cat, black with a white chest and white paws, and pale green eyes. Wears nothing. The look is taken from waiting at the airport curb for a pickup." },
];
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { pick: c.pick, variant: c.variant, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /HTZ|HERTZ|HERT|HZ/.test(c.ticker), memeClash: memeTickers.has(c.ticker),
    endsWithDisclaimer: desc.endsWith(DISC) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  for (const q of [c.ticker]) {
    try {
      const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`);
      const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
      o.jupStatus = r.status; o.jupResults = arr.length;
      o.jupSymbolMatches = arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
      o.jupVerifiedSymbolMatch = o.jupSymbolMatches.some(t => t.isVerified === true);
      o.jupVerifiedInResults = arr.filter(t => t.isVerified).map(t => t.symbol);
    } catch (e) { o.jupError = String(e); }
  }
  o.description = desc;
  results.push(o);
}
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), discLen: DISC.length, results }, null, 1));
