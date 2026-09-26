const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const DISC = "A cat coin priced in FLWS. Not affiliated with 1-800-Flowers, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["FLWS", "FLW", "1-800-Flowers", "1800flowers", "1-800-FLOWERS.COM", "800-Flowers", "Flowers", "Fabulous Feline", "Fabulous", "Feline", "Purrfect", "Purrfect Party Cat", "Cure-All Kitty", "Magical Fairy Cat", "Seaside Mermaid Cat", "Luau Kitty", "Purrfect Potions", "Caroling Cat", "a-DOG-able", "adogable", "Hello Kitty", "Kitty", "Harry & David", "Cheryl's", "Shari's Berries", "PersonalizationMall", "Things Remembered", "1-800-Baskets", "Celebrations Passport", "Celebrations", "Petal Talk", "Jim McCann", "McCann", "Chris McCann", "Villagomez", "Kittenish", "Jessie James Decker", "Pete the Cat", "Backpack", "Backpack Securities", "Sunrise", "Jericho", "Carnation Milk", "Mickey", "Minnie", "Lion Heart", "Tigers"] };
const coins = JSON.parse(fs.readFileSync("FLWS-coins.json", "utf8"));
const looks = {
  PETALPUFF: "A normal four-legged, fluffy, round-faced solid white house cat with a thick ruffled coat and gold eyes. Wears nothing. Follows the crisp white carnation body of the company's cat-shaped flower arrangement; pink and lavender blooms are the setting.",
  POSYPAWS: "A white cat lying in a handled woven basket among pink and purple blooms. Wears nothing.",
  LILACPOINT: "A cream-white lilac point cat with blue eyes. Wears nothing.",
};
const out = { disclaimer: DISC, disclaimerLen: DISC.length, disclaimerOnly_checkFields: R.checkFields({ description: DISC }), disclaimer_checkTerms: R.checkTerms({ disclaimer: DISC }, stockTerms), results: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, descOk: desc.length <= 280, nameOk: c.name.length <= 32,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /FLW|FLOWER|FLORA|FELINE|FAB/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_look = R.checkFields({ look: looks[c.ticker] });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: looks[c.ticker] }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  const q = async (query) => { const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(query)}`); const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []); return { status: r.status, arr }; };
  try {
    const { status, arr } = await q(c.ticker);
    o.jupTicker = { status, results: arr.length, all: arr.map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })), symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).map(t => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
    o.jupTicker.verifiedMatch = o.jupTicker.symbolMatches.some(t => t.isVerified === true);
    const word = c.name.split(" ")[0];
    const n = await q(word);
    o.jupNameWord = { query: word, status: n.status, results: n.arr.length, verified: n.arr.filter(t => t.isVerified).map(t => ({ symbol: t.symbol, name: t.name })), nameMatches: n.arr.filter(t => String(t.name).toLowerCase().includes(word.toLowerCase())).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })) };
  } catch (e) { o.jupError = String(e); }
  o.description = desc;
  out.results.push(o);
}
try {
  const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["FLWSojG1gB5VStYR3Sb4nQFRt43UBYkqih1j2CpVLqgd", { encoding: "jsonParsed" }] }) });
  const j = await r.json(); const info = j.result?.value?.data?.parsed?.info;
  out.rpc = { status: r.status, owner: j.result?.value?.owner, decimals: info?.decimals, extensions: (info?.extensions ?? []).map(e => e.extension), transferFee: (info?.extensions ?? []).find(e => /transferFee/i.test(e.extension)) ?? null, paused: (info?.extensions ?? []).find(e => e.extension === "pausableConfig")?.state?.paused, metaName: (info?.extensions ?? []).find(e => e.extension === "tokenMetadata")?.state?.name };
} catch (e) { out.rpcError = String(e); }
const pairs = JSON.parse(fs.readFileSync("../stockcats/stonkfun-pairs.json", "utf8"));
out.pair = pairs.data.pairs.filter(p => p.symbol === "FLWS");
console.log(JSON.stringify(out, null, 1));
