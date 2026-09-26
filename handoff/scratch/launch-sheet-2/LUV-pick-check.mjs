import fs from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in LUV. Not affiliated with Southwest Airlines, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["LUV","Luv","Love","Lovely","Love Field","Southwest","Southwest Airlines","Southwest Airlines Co","SWA","Heart","Rapid Rewards","Wanna Get Away","Bags Fly Free","Canyon Blue","Herb Kelleher","Kelleher","Rollin King","Bob Jordan","Walter","Avery","Zuko","Matthew Prebish","Prebish","Way","Somali","Flying with Felines","Winged Cat","WingedCat","Flying Tigers","Meow Wolf","Backpack","Backpack Securities","Sunrise","Wormhole","Dallas","Airline","Airlines","Jet","Flight","Fly"] };
const MEMES = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","MOCHI","SMOL","SC","MIU","CHESHIRE","MANEKI","KEYCAT","WOOF","GME","TOSHI","BRETT","NEKO","CATI","CHILLCAT","ZEUS","PAWS","MEOWCAT"]);
const drafts = [
 { id:"EMBERWISP (fixed)", name:"Emberwisp the Ruddy Cat", ticker:"EMBERWISP", blurb:"Emberwisp, a ruddy-orange kitten with a softly ticked fluffy coat, tall ears and a cream chin, watches the garden sparrows." },
 { id:"EMBERWISP (draft)", name:"Emberwisp the Ruddy Cat", ticker:"EMBERWISP", blurb:"Emberwisp, a ruddy-orange kitten with a softly ticked fluffy coat, tall ears and a bushy fox-like tail, watches the garden sparrows." },
 { id:"INKSTACHE", name:"Inkstache the Bicolor Cat", ticker:"INKSTACHE", blurb:"Inkstache, a white cat with a black cap over its ears, a few black patches and a black moustache smudge under its nose, eyes beetles." },
 { id:"TASSELEAR", name:"Tassel the Tufted Tabby Cat", ticker:"TASSELEAR", blurb:"Tassel, a big fluffy brown tabby with a white muzzle and bib, a pink nose and long ear tufts, pads up to sniff each garden visitor." },
];
// Other planned coins (for clash checks)
const others = [];
for (const f of fs.readdirSync(".").filter(f => /-pick\.json$/.test(f) && !f.startsWith("LUV"))) {
  try { const j = JSON.parse(fs.readFileSync(f,"utf8")); for (const c of [].concat(j)) others.push({ from:f, name:c.name, ticker:c.ticker }); } catch {}
}
try { const s = JSON.parse(fs.readFileSync("../launch-sheet/launch-sheet.json","utf8")); const arr = Array.isArray(s) ? s : (s.coins ?? s.cats ?? s.rows ?? []); for (const c of arr) others.push({ from:"launch-sheet.json", name:c.name ?? c.coin?.name, ticker:c.ticker ?? c.coin?.ticker }); } catch (e) { others.push({ from:"launch-sheet.json", err:String(e.message) }); }
const out = { disclosureOnly: R.checkFields({ description: DISC }), othersCount: others.length, othersErr: others.filter(o=>o.err), results: [] };
for (const d of drafts) {
  const desc = `${d.blurb} ${DISC}`;
  const r = { id:d.id, name:d.name, ticker:d.ticker, nameLen:d.name.length, blurbLen:d.blurb.length, descLen:desc.length,
    tickerFormat: R.TICKER.test(d.ticker), tickerHasLuv: /LUV/.test(d.ticker), memeTicker: MEMES.has(d.ticker),
    endsWithDisclaimer: desc.endsWith(DISC),
    checkProposal_blurb: R.checkProposal({ name:d.name, symbol:d.ticker, tagline:d.blurb }),
    checkProposal_fullDesc: R.checkProposal({ name:d.name, symbol:d.ticker, tagline:desc }),
    checkFields_fullDesc: R.checkFields({ name:d.name, symbol:d.ticker, description:desc }),
    checkTerms_stock: R.checkTerms({ name:d.name, symbol:d.ticker, description:desc }, stockTerms),
    displaySafe: R.displaySafe({ name:d.name, symbol:d.ticker }),
    clashes: others.filter(o => (o.ticker && o.ticker === d.ticker) || (o.name && o.name.split(" ")[0].toLowerCase() === d.name.split(" ")[0].toLowerCase())) };
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(d.ticker)}`);
    const j = await res.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    r.jup = { status: res.status, results: arr.length, sample: arr.slice(0,5).map(t => ({ symbol:t.symbol, name:t.name, isVerified:t.isVerified })),
      symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === d.ticker).map(t => ({ symbol:t.symbol, name:t.name, isVerified:t.isVerified, id:t.id })) };
    r.jup.verifiedSymbolMatch = r.jup.symbolMatches.some(t => t.isVerified === true);
  } catch (e) { r.jupError = String(e); }
  r.description = desc;
  out.results.push(r);
}
console.log(JSON.stringify(out, null, 1));
