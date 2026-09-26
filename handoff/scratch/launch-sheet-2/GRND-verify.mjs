const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in GRND. Not affiliated with Grindr Inc., Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = [
 {name:"Stripenose the Tuxedo Cat",ticker:"STRPNOSE",blurb:"Stripenose, a black tuxedo shorthair with a thin white nose stripe, white bib and olive-green eyes, greets every neighbour at the garden gate."},
 {name:"Whiskerbib the Tuxedo Cat",ticker:"WHSKRBIB",blurb:"Whiskerbib, a glossy black cat with a white chest bib, extra-long white whiskers and green-gold eyes, naps on the softest garden cushion."},
 {name:"Porchwave the Tuxedo Cat",ticker:"PORCHWAVE",blurb:"Porchwave, a shy, cuddly black-and-white tuxedo cat with a white-striped nose, sits on the garden step to say hello to anyone close by."},
];
const stockTerms = { stock: ["GRND","Grindr","Grindr Inc","Grind","Grinder","Grindr Unwrapped","Unwrapped","mask","George Arison","Arison","Joel Simkhai","Simkhai","Ruby","Erin","Johansen","Brighton","Elm Grove","Tinder","Madonna","Netflix","MISTR","Choupette","Lagerfeld","Baeksu","Catperson","Dogperson","Backpack","Sunrise","Wormhole","bottom","dates","dating","hookup","nearby","gay","queer","Hello Kitty","Kitty","Sylvester","Felix"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","MOG","MANEKI","HOBBES","WIF","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","TUXEDO","TUX","SYLVESTER","FELIX","GARFIELD","PUSSY","MANEKI","MIAO","MIAOU","KITKAT","SCF","BOOP","MOCHI","LUNA","KITTENS","WEN","SPOT","TOMCAT","CHILLCAT"]);
const out = { disclosureOnly: R.checkFields({ description: DISC }), coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFmt: /^[A-Z0-9]{2,10}$/.test(c.ticker), tickerRoot: /GRND|GRIND|GRNDR/.test(c.ticker), meme: memeTickers.has(c.ticker),
    endsWithDisclosure: desc.endsWith("No intrinsic value; not financial advice."),
    checkProposal: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb }),
    checkProposalFull: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc }),
    checkFieldsBlurbOnly: R.checkFields({ blurb: c.blurb }),
    displaySafe: R.displaySafe({ name: c.name, symbol: c.ticker }),
    checkTerms: R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb }, stockTerms) };
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jup = { status: r.status, n: arr.length, symMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })), sample: arr.slice(0,5).map(t=>`${t.symbol}|${t.name}|${t.isVerified}`) };
  } catch (e) { o.jupErr = String(e); }
  o.description = desc;
  out.coins.push(o);
}
console.log(JSON.stringify(out, null, 1));
