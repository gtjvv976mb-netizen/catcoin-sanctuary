const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in PTN. Not affiliated with Palatin Technologies, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = [
 {name:"Mottle the Tortie Cat",ticker:"MOTTLE",blurb:"Mottle, a small tortoiseshell with black and ginger patches blended like soft brushstrokes and honey-gold eyes, sunbathes on warm stones.",look:"A small four-legged tortoiseshell house cat with blended black and ginger patches and honey-gold eyes. Based on the MC1R pigment switch between black and red coat colour. It wears nothing."},
 {name:"Umber the Deep-Brown Cat",ticker:"UMBERPAW",blurb:"Umber, a sleek shorthair with a deep umber-brown coat that looks almost black in the shade and warm copper eyes, naps under the fig tree.",look:"A sleek four-legged solid deep umber-brown shorthair that looks near-black in shade, with copper eyes. Based on melanin pigment (the melanocortin link). It wears nothing."},
 {name:"Sprig the Trim Tabby Cat",ticker:"SPRIGPAW",blurb:"Sprig, a lean, long-legged grey tabby with neat dark stripes and green eyes, eats small, slow suppers, then takes one lap of the garden.",look:"A lean, long-legged four-legged grey tabby house cat with neat dark stripes and green eyes. Based on the company's appetite and obesity (MC4R) focus, with no health claims. It wears nothing."},
];
const stockTerms = { stock: ["PTN","Palatin","Palatin Technologies","Vyleesi","bremelanotide","Cosette","Boehringer","Ingelheim","Carl Spana","Spana","PL9643","PL7737","PL8177","Backpack","Sunrise","melanocortin","MC1R","MC4R","pinwheel","pentagon","Hello Kitty","PalatinTech"] };
const memes = ["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","MOG","MANEKI","WIF","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","MOTTLE?"];
const out = { disclaimerOnly: R.checkFields({ d: DISC }), coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, tickerFmt: R.TICKER.test(c.ticker),
    proposal: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb }),
    lookFields: R.checkFields({ look: c.look }),
    stockTerms: R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb, look: c.look }, stockTerms),
    endsWith: desc.endsWith("A cat coin priced in PTN. Not affiliated with Palatin Technologies, Backpack Securities or StonkFun. No intrinsic value; not financial advice."),
    display: R.displaySafe({ name: c.name, symbol: c.ticker }) };
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(c.ticker)}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jup = { status: r.status, n: arr.length, sym: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ s: t.symbol, n: t.name, v: t.isVerified, id: t.id })) };
  } catch (e) { o.jupErr = String(e); }
  out.coins.push(o);
}
console.log(JSON.stringify(out, null, 1));
