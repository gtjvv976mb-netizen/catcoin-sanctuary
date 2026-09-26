const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in CYPH. Not affiliated with Cypherpunk Technologies, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const coins = [
 { name: "Sootsilk the Smoke Cat", ticker: "SOOTSILK", blurb: "Sootsilk, a black smoke cat with copper eyes, looks plain black at rest, until a breeze parts her fur and a silver undercoat shows." },
 { name: "Duskmask the Point Cat", ticker: "DUSKMASK", blurb: "Duskmask, an ivory point cat with a slate-grey face mask, ears, paws and tail and ice-blue eyes, slips through the hedges unseen." },
 { name: "Jumble the Tortie Cat", ticker: "JUMBLEPAW", blurb: "Jumble, a tortoiseshell cat with scrambled black and deep-gold patches, buries shiny pebbles in a spot only she knows." },
 { name: "Goldruff the Tawny Cat", ticker: "GOLDRUFF", blurb: "Goldruff, a tawny golden shorthair with a cream chin and belly, a fluffy neck ruff and green eyes, keeps watch from the garden wall like a small lion." },
 { name: "Sandmane the Tawny Cat", ticker: "SANDMANE", blurb: "Sandmane, a sandy golden cat with a cream chin, a thick neck ruff and green eyes, dozes on the warm garden wall like a small lion." },
 { name: "Ruffle the Lion-Coat Cat", ticker: "RUFFLEPAW", blurb: "Ruffle, a tawny golden cat with a cream muzzle, a fluffy neck ruff and green eyes, surveys the garden from the top step like a small lion." },
];
const stockTerms = { stock: ["CYPH","Cyph","Cypherpunk","Cypherpunk Technologies","Cypher","Cipher","Punk","Leap","Leap Therapeutics","Zcash","ZEC","Zashi","Zebra","Zooko","Zodl","ZODL","Electric Coin","Winklevoss","Tyler","Cameron","Khing","Oei","McEvoy","Onsi","Douglas Onsi","Gemini","Nifty","Transmissions","Transmission","Shielded","Sapling","Orchard","Halo","Hush","Veil","Backpack","Backpack Securities","Sunrise","Wormhole","DATS","Interlocked","Entropy","NU7","Cyberpunk","Neon"] };
const banned = new Set(["CYPH","ZEC","ZODL","POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","LION","SIMBA","LEO","MUFASA","NALA","GARFIELD","TOSHI","KEYCAT","SC","MANEKI","PONKE"]);
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasRoot: /CYP|ZEC|PUNK|ZODL|LEAP/.test(c.ticker), endsWithDisclosure: desc.endsWith(DISC) };
  out.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  out.checkFields_fullDescription = R.checkFields({ name: c.name, symbol: c.ticker, description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, description: c.blurb }, stockTerms);
  out.memeBanned = banned.has(c.ticker);
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    out.jupStatus = r.status; out.jupResults = arr.length;
    out.jupSymbolMatches = arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id }));
    out.jupVerifiedMatch = out.jupSymbolMatches.some(t => t.isVerified === true);
    out.jupTop = arr.slice(0,5).map(t => `${t.symbol}|${t.name}|${t.isVerified}`);
  } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
for (const q of ["SOOT","LION"]) { try { const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`); const j = await r.json(); results.push({ sanity: q, status: r.status, n: (Array.isArray(j)?j:[]).length }); } catch (e) { results.push({ sanity: q, err: String(e) }); } }
console.log(JSON.stringify({ disclosureLen: DISC.length, disclosureOnly: R.checkFields({ description: DISC }), results }, null, 1));
