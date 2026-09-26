const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in INTCx. Not affiliated with Intel or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Bracken the Tabby Cat", ticker: "BRACKEN", blurb: "Bracken, a sturdy grey-brown striped tabby with a thick black-ringed tail, stalks moths through the ferns at dusk, then naps on the warm garden wall." },
  { name: "Tweed the Stripy Cat", ticker: "TWEED", blurb: "Tweed, a stocky tabby in a coat of fine dark stripes, sits in the sun with his bushy black-ringed tail wrapped round his paws, purring like a kettle." },
  { name: "Humbug the Garden Cat", ticker: "HUMBUG", blurb: "Humbug, a stout tabby striped like an old-fashioned sweet, has a fat tail ringed in black. He grumbles at the rain, then naps in the potting shed." },
];
const alts = ["TWEEDPAW", "BRACKENPAW", "HUMBUGPAW", "FERNSTRIPE"];
const stockTerms = { stock: ["INTC", "INTCX", "INTCx", "Intel", "Intel xStock", "xStock", "xStocks", "Backed", "Intel Inside", "Inside", "Core", "Core Ultra", "Pentium", "Celeron", "Xeon", "Atom", "Arc", "Evo", "vPro", "Optane", "Gaudi", "Altera", "Mobileye",
  "Update Cat", "UpdateMeow", "Update Meow", "NCSA", "National Cybersecurity Alliance", "Waffles", "Cole and Marmalade", "Marmalade", "Cole", "Audrey Plonk", "Plonk",
  "Wildcat", "Wildcat Lake", "Tiger Lake", "Panther Lake", "Panther", "Tiger", "Jaguar", "Jaguar Shores", "Lion", "Lion Cove", "Cougar", "Cougar Point", "Panther Point", "Tiger Point", "Bobcat", "Bobcat Peak", "Lake", "Cove", "Shores",
  "Bunny People", "Bunny", "Leopold", "Gelsinger", "Lip-Bu Tan", "Grove", "Noyce", "Moore", "tick tock", "Microsoft", "Morris"] };
const banned = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","INTC","INTEL","TIGER","PANTHER","JAGUAR","LION","WILDCAT","BOBCAT","COUGAR"]);
async function jup(t) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${t}`);
  const j = await r.json();
  const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  const m = arr.filter(x => String(x.symbol).toLowerCase() === t.toLowerCase()).map(x => ({ symbol: x.symbol, name: x.name, isVerified: x.isVerified, id: x.id }));
  return { status: r.status, results: arr.length, symbolMatches: m, verifiedMatch: m.some(x => x.isVerified === true) };
}
const results = [];
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, tickerLen: c.ticker.length, blurbLen: c.blurb.length, descLen: desc.length };
  out.checkProposal = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  out.checkFields_fullDescription = R.checkFields({ description: desc });
  out.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb }, stockTerms);
  out.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  out.tickerRegex = R.TICKER.test(c.ticker);
  out.memeBanned = banned.has(c.ticker);
  try { out.jup = await jup(c.ticker); } catch (e) { out.jupError = String(e); }
  out.description = desc;
  results.push(out);
}
const altRes = {};
for (const a of alts) { try { altRes[a] = await jup(a); } catch (e) { altRes[a] = String(e); } }
console.log(JSON.stringify({ disclosureOnly: R.checkFields({ description: DISC }), results, altRes }, null, 1));
