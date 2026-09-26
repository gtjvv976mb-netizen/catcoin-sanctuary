const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in COST. Not affiliated with Costco Wholesale, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["COST","Costco","Costco Wholesale","Costco Wholesale Corporation","Wholesale","Warehouse","Price Club","Sol Price","Robert Price","FedMart",
  "Kirkland","Kirkland Signature","Issaquah","Sinegal","Jim Sinegal","James Sinegal","Brotman","Jeffrey Brotman","Vachris","Ron Vachris","Jelinek","Craig Jelinek","Hamilton James",
  "Hello Kitty","Kitty","Sanrio","Cinnamoroll","Kuromi","Squishmallow","Snoopy","Jim Shore","Costco Guys","Big Justice",
  "Backpack","Backpack Securities","Sunrise","Wormhole","Executive Member","Costco Connection"],
  cryptoBrand: ["Stacks","STX"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","MOG","MANEKI","HOBBES","WIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","CATGPT","CATI","MIMI","SMOG","MONEYCAT","CATWIF","KITTENWIF","BOOK","CATDOG","CATE","SC","MOTHER"]);
const cands = [
 { name:"Carton the Cardboard-Tan Cat", ticker:"CARTONPAW", blurb:"Carton, a big broad-chested cat with a cardboard-tan coat, cream bib and cream paws, naps on a tall pile of brown boxes in the garden shed.",
   look:"From the business: bulk boxed goods stacked on pallets. A normal four-legged, big, sturdy house cat with a cardboard-tan coat, a cream bib and cream paws, and honey-gold eyes. It wears nothing." },
 { name:"Stacks the Cardboard-Tan Cat", ticker:"STACKPAW", blurb:"Stacks, a big broad-chested cat with a cardboard-tan coat, cream bib and cream paws, naps on a tall pile of brown boxes in the garden shed.",
   look:"From the business: bulk boxed goods stacked on pallets. A big, sturdy house cat with a cardboard-tan coat, a cream bib and cream paws, and amber eyes. It wears nothing." },
 { name:"Roastie the Golden-Crust Cat", ticker:"ROASTPAW", blurb:"Roastie, a plump shorthair with a glossy golden-brown coat and herb-green eyes, dozes in the warmest sunny patch beside the garden grill.",
   look:"From the business: rotisserie chickens are one of its main draws. A plump shorthair with a glossy, solid golden-brown coat that shades darker along the back, and herb-green eyes. It wears nothing." },
 { name:"Toastbun the Long Ginger Cat", ticker:"TOASTBUN", blurb:"Toastbun, a long, low ginger tabby with toasty bun-brown stripes and a cream belly, stretches the full length of the garden bench.",
   look:"From the business: the food-court hot dog, one of its most popular items. A long, low-bodied ginger tabby with toasted-brown stripes, a cream belly and gold eyes. It wears nothing." },
];
async function jup(q){ const r=await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`); const j=await r.json(); const a=Array.isArray(j)?j:(j.tokens??[]); return {status:r.status,a}; }
const out = { disclaimer: DISC, disclaimerOnly: R.checkFields({ disclaimer: DISC }), candidates: [] };
for (const c of cands) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name:c.name, ticker:c.ticker, nameLen:c.name.length, blurbLen:c.blurb.length, descLen:desc.length, asciiOnly: /^[\x20-\x7E]+$/.test(desc+c.name),
    tickerFormat:R.TICKER.test(c.ticker), tickerHasStockRoot:/COST|KIRK|WHOL|WARE|PRICE|CSTC/.test(c.ticker), memeTicker:MEME.has(c.ticker), endsWithDisclaimer:desc.endsWith(DISC) };
  o.checkProposal_name_symbol_blurb = R.checkProposal({ name:c.name, symbol:c.ticker, tagline:c.blurb });
  o.checkProposal_fullDescriptionAsTagline = R.checkProposal({ name:c.name, symbol:c.ticker, tagline:desc });
  o.checkFields_look = R.checkFields({ look:c.look });
  o.checkFields_description = R.checkFields({ description:desc });
  o.checkTerms = R.checkTerms({ name:c.name, symbol:c.ticker, blurb:c.blurb, look:c.look }, stockTerms);
  o.displaySafe = R.displaySafe({ name:c.name, symbol:c.ticker });
  const j = await jup(c.ticker);
  const sm = j.a.filter(t => String(t.symbol).toUpperCase() === c.ticker);
  o.jupiter = { status:j.status, results:j.a.length, symbolMatches: sm.map(t=>({id:t.id,name:t.name,isVerified:t.isVerified??false})), verifiedMatch: sm.some(t=>t.isVerified===true),
    anyVerifiedInResults: j.a.filter(t=>t.isVerified).map(t=>t.symbol), top: j.a.slice(0,3).map(t=>`${t.symbol} | ${t.name}`) };
  out.candidates.push(o);
}
const rpc = await fetch("https://api.mainnet-beta.solana.com",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:["CZEB3WNZuF2Yz1z2H81RcCk8T7fsw82KB33zqamASVsg",{encoding:"jsonParsed"}]})});
const m = await rpc.json(); const v = m.result.value; const info = v.data.parsed.info;
out.mint = { owner:v.owner, decimals:info.decimals, extensions:info.extensions.map(e=>e.extension), transferFeeConfig:info.extensions.some(e=>e.extension==="transferFeeConfig"),
  paused: info.extensions.find(e=>e.extension==="pausableConfig")?.state?.paused, transferHookProgram: info.extensions.find(e=>e.extension==="transferHook")?.state?.programId,
  permanentDelegate: info.extensions.find(e=>e.extension==="permanentDelegate")?.state?.delegate, freezeAuthority:info.freezeAuthority, mintAuthority:info.mintAuthority };
console.log(JSON.stringify(out,null,1));
