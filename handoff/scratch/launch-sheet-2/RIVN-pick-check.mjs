const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in RIVN. Not affiliated with Rivian Automotive, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["RIVN", "RIV", "Rivian", "Rivian Automotive", "Rivn", "RIVNx", "R1S", "R1T", "R2", "R3", "R3X", "EDV", "Gear Guard", "GearGuard", "Yeti",
  "RJ Scaringe", "Scaringe", "Robert Scaringe", "RJ", "Pepper", "Nash", "Avi", "Pamela", "Hamish", "Lucky", "Gizmo", "Benny", "Leia", "Miso", "Churro", "Yuzu",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole",
  "Electric Adventure Vehicle", "Adventure", "Adventurous", "Keep the World Adventurous Forever", "Launch Green", "Compass Yellow", "Rivian Blue", "Limestone",
  "Forest Green", "Glacier White", "El Cap Granite", "Granite", "Midnight", "Red Canyon", "Storm Blue", "LA Silver", "Camp Kitchen", "Treehouse", "Normal Illinois",
  "Amazon", "Volkswagen", "Mainstream Motors", "Pet Comfort", "Pet Mode", "Rivian Adventure Network", "RAN", "Waypoints", "Also", "Tesla", "Lucid"] };
const MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","CATWIF","PURR","MEOW","SIMON","GIKO","NUB","SNOWBALL","NEKO","SOOT","BLACKCAT","MANEKI","CHEEMS","GME","KEYCAT","GIGACAT","MOTHER"]);
const coins = [
 { name: "Nightseat the Black Cat", ticker: "NIGHTSEAT",
   blurb: "Nightseat, a sleek black shorthair with gold-green eyes and an aqua patterned collar, always takes the highest perch in the garden.",
   look: "Follows the real cat in the pet-day photo: a slim, solid black shorthair with tall ears and gold-green eyes, wearing the light-aqua patterned collar the real cat wears. The high perch nods to the headrest it lies on." },
 { name: "Sparkwhisker the Black Cat", ticker: "SPARKPAW",
   blurb: "Sparkwhisker, a glossy black shorthair with yellow-gold eyes, naps by the warm garden lamp and wakes up fully charged.",
   look: "Follows the real cat: a solid glossy black shorthair with yellow-gold eyes. Fully charged is a generic nod to electric vehicles." },
 { name: "Coalpaw the Trail Cat", ticker: "COALPAW",
   blurb: "Coalpaw, a slim coal-black cat with tall ears and lemon-gold eyes, follows every muddy garden trail, then naps under the pines.",
   look: "Follows the real cat: a slim, solid coal-black cat with tall upright ears and lemon-gold eyes. Muddy trails are a generic nod to off-road outdoor vehicles." },
];
const out = { disclosureOnly_checkFields: R.checkFields({ description: DISC }), disclaimer_checkTerms: R.checkTerms({ disclaimer: DISC }, stockTerms), coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /RIV|RVN/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC), wellKnownCatMeme: MEME.has(c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, description: desc.replace(DISC, ""), look: c.look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  try {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
    const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
    o.jup = { status: r.status, results: arr.length, all: arr.map(t => `${t.symbol}|${t.isVerified}`), symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
    o.jup.verifiedMatch = o.jup.symbolMatches.some(t => t.isVerified === true);
  } catch (e) { o.jupError = String(e); }
  o.description = desc;
  out.coins.push(o);
}
try {
  const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["RcZmt84VMJv9bDhKqmw1uWDahYrUT468VwAChTnfD8p", { encoding: "jsonParsed" }] }) });
  const jj = await rpc.json(); const info = jj?.result?.value?.data?.parsed?.info;
  out.mint = { owner: jj?.result?.value?.owner, extensions: info?.extensions?.map(e => ({ e: e.extension, s: ["transferFeeConfig","transferHook","pausableConfig","defaultAccountState","permanentDelegate"].includes(e.extension) ? e.state : undefined })) };
} catch (e) { out.mint = { error: String(e) }; }
console.log(JSON.stringify(out, null, 1));
