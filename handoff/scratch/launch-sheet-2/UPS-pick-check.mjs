const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in UPS. Not affiliated with United Parcel Service, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["UPS", "United Parcel Service", "United Parcel", "Parcel", "United", "American Messenger", "American Messenger Company", "Merchants Parcel Delivery",
  "Brown", "Big Brown", "Pullman", "Pullman Brown", "What can Brown do for you", "Worldport", "Louisville", "Sandy Springs", "Seattle",
  "Casey", "James Casey", "Jim Casey", "Claude Ryan", "Ryan", "Soderstrom", "Tome", "Carol Tome", "Abney", "Mail Boxes Etc", "The UPS Store", "UPS Store", "Ground Saver", "SurePost", "Blue Label Air", "MaxiCode", "ORION", "UPS Sans",
  "Yamato", "Kuroneko", "Takkyubin", "Allied", "Allied Van Lines", "Backpack", "Backpack Securities", "Sunrise", "Wormhole",
  "Bubble Wrap", "Sealed Air", "shield", "brown shield", "package car", "Next Day Air", "Worldwide Express", "Saver"] };
const coins = [
 { name: "Waybill the Label-Bib Cat", ticker: "WAYBILL",
   blurb: "Waybill, a slate-grey cat with a square white bib like a shipping label and four white socks, waits by the garden gate each morning.",
   look: "A normal four-legged shorthair. Slate-grey and white bicolor with a square white chest patch like a shipping label, four white socks and amber eyes. Wears nothing." },
 { name: "Barcode the Silver Mackerel Cat", ticker: "SCANPAW",
   blurb: "Barcode, a silver mackerel tabby with tight, even black stripes and a white chin, sits so still on the gatepost you could scan her.",
   look: "A normal four-legged shorthair. Silver mackerel tabby with tight, evenly spaced black stripes like a label barcode, a white chin and green eyes. Wears nothing." },
 { name: "Cushion the Bubble-Wrap Cat", ticker: "PUFFWRAP",
   blurb: "Cushion, a round, fluffy pale-silver longhair as soft and puffy as bubble wrap, curls up in any empty box left out in the garden.",
   look: "A normal four-legged longhair. Round and fluffy with a solid pale-silver coat, soft and puffy like packing bubble wrap, and pale blue eyes. Wears nothing." },
];
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","MANEKI","CATI","SC","MIHI","GME","KURO","KURONEKO"]);
const out = { disclosureOnly_checkFields: R.checkFields({ description: DISC }), disclosureOnly_checkTerms: R.checkTerms({ disclaimer: DISC }, stockTerms), results: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasRoot: /UPS|PARCEL|BROWN/.test(c.ticker), memeTicker: memeTickers.has(c.ticker), endsWithDisclaimer: desc.endsWith(DISC) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jup = { status: r.status, results: arr.length, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) , top: arr.slice(0,5).map(t=>({symbol:t.symbol,name:t.name,isVerified:t.isVerified}))};
    o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  } catch (e) { o.jupError = String(e); }
  o.description = desc;
  out.results.push(o);
}
try {
  const r = await fetch("https://api.mainnet-beta.solana.com", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:["UPSqUeMHcWbkdg784XuBUEF9DtySSnW9ur5LAVdcuB9",{encoding:"jsonParsed"}]})});
  const j = await r.json(); const v = j.result?.value; const info = v?.data?.parsed?.info;
  out.rpc = { status: r.status, owner: v?.owner, mintAuthority: info?.mintAuthority, freezeAuthority: info?.freezeAuthority, extensions: (info?.extensions||[]).map(e=>e.extension), hasTransferFee: (info?.extensions||[]).some(e=>/transferFee/i.test(e.extension)) };
} catch (e) { out.rpcError = String(e); }
console.log(JSON.stringify(out, null, 1));
