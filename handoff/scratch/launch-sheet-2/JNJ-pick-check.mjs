import fs from "node:fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const SP = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const pairs = JSON.parse(fs.readFileSync(`${SP}/stockcats/stonkfun-pairs.json`, "utf8")).data.pairs;
const pair = pairs.find((p) => p.symbol === "JNJ");
const DISC = `A cat coin priced in ${pair.symbol}. Not affiliated with Johnson & Johnson, Backpack Securities or StonkFun. No intrinsic value; not financial advice.`;
const stockTerms = { stock: ["JNJ", "J&J", "JandJ", "JJ", "Johnson", "Johnson & Johnson", "Johnson and Johnson", "Janssen", "Ethicon", "DePuy", "Synthes", "Acuvue", "Abiomed", "Shockwave", "Auris", "Monarch", "Velys", "Ottava",
  "Kenvue", "Band-Aid", "BandAid", "Band Aid", "Tylenol", "Neutrogena", "Listerine", "Aveeno", "Zyrtec", "Motrin", "Benadryl", "No More Tears", "Stelara", "Darzalex", "Tremfya", "Xarelto", "Carvykti", "Rybrevant", "Spravato",
  "Hello Kitty", "Kitty", "Sanrio", "Kilmer", "Fred Kilmer", "Frederick Kilmer", "Joyce Kilmer", "Tom Rutgers", "Tom", "Rutgers", "Red Cross", "Red Cross Messenger", "Messenger", "Robert Wood Johnson", "Duato", "Joaquin Duato", "Gorsky",
  "New Brunswick", "Credo", "Our Credo", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "talc", "baby powder", "Iris Grossman", "Grossman", "alligator"] };
const CAT_MEME = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","MEOW","PURR","SIMON","GIKO","BOOK","NUB","SNOWBALL","MANEKI","CHEEMS","KEYCAT","BRAIN","SIGMA","SC","ZEUS","MOCHI","LUCE","TIKI","CWIF","MIAO","MUMU","PUSS","GARF","FELIX","MOTHER","NEKO","GME","HAT","MIGGLES","SMOL","CATDOG","ROAR","SPX"]);
const coins = [
  { tag: "draft1", name: "Jowls the Grey Tomcat", ticker: "JOWLS", blurb: "Jowls, a big round-cheeked grey tomcat with sleepy half-shut eyes and a thick ruff, sits as still as an old photo on the garden wall." },
  { tag: "draft2", name: "Sepia the Plush Grey Cat", ticker: "SEPIAPAW", blurb: "Sepia, a heavy-set plush grey shorthair with wide jowls and faint ghost stripes on his cheeks, naps on the potting-shed shelf." },
  { tag: "draft3", name: "Pestle the Shelf Cat", ticker: "PESTLE", blurb: "Pestle, a stocky slate-grey tomcat with a broad face and a deep ruffled chest, keeps watch over the stone mortars in the greenhouse." },
  { tag: "pick", name: "Jowls the Big Grey Cat", ticker: "JOWLS", blurb: "Jowls, a heavy round-cheeked grey shorthair with sleepy half-shut eyes and a thick chest ruff, sits as still as an old photo on the garden wall.",
    look: "A normal four-legged, big, heavy-set grey shorthair house cat: broad head, round heavy jowls, small wide-set ears, sleepy half-shut amber eyes, full whisker pads, a thick dense coat and a deep, slightly darker ruff on the chest. Solid grey, no markings. Wears nothing." },
];
const jup = async (q) => { const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`); const j = await r.json(); return { status: r.status, arr: Array.isArray(j) ? j : (j.tokens ?? []) }; };
const out = { pair, disclosure: DISC, disclosureOnly_checkFields: R.checkFields({ description: DISC }), coins: [] };
for (const c of coins) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { tag: c.tag, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /JNJ|JANDJ|^JJ/.test(c.ticker), endsWithDisclosure: desc.endsWith(DISC), catMemeTicker: CAT_MEME.has(c.ticker) };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  if (c.look) o.checkFields_look = R.checkFields({ look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, ...(c.look ? { look: c.look } : {}) }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  const j = await jup(c.ticker);
  o.jup = { status: j.status, results: j.arr.length, symbolMatches: j.arr.filter((t) => String(t.symbol).toUpperCase() === c.ticker).map((t) => ({ name: t.name, isVerified: t.isVerified, id: t.id })) };
  o.jup.verifiedMatch = o.jup.symbolMatches.some((t) => t.isVerified === true);
  o.description = desc;
  out.coins.push(o);
}
const jn = await jup("Jowls");
out.jupNameJowls = { status: jn.status, results: jn.arr.map((t) => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })) };
try {
  const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [pair.mint, { encoding: "jsonParsed" }] }) });
  const j = await r.json(); const v = j.result?.value;
  out.rpc = { status: r.status, owner: v?.owner, extensions: (v?.data?.parsed?.info?.extensions ?? []).map((e) => e.extension), transferFeeConfig: (v?.data?.parsed?.info?.extensions ?? []).find((e) => e.extension === "transferFeeConfig") ?? null,
    paused: (v?.data?.parsed?.info?.extensions ?? []).find((e) => e.extension === "pausableConfig")?.state?.paused };
} catch (e) { out.rpc = { error: String(e) }; }
console.log(JSON.stringify(out, null, 1));
