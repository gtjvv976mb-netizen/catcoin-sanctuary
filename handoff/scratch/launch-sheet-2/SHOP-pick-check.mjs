const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const fs = await import("fs");
const S = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const DISC = "A cat coin priced in SHOP. Not affiliated with Shopify, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["SHOP", "SHOPx", "Shopify", "Shopify Inc", "Shopify Payments", "Shop Pay", "Shopify Pay", "Shop app", "Shopify Plus", "Shopify Capital", "Shopify Markets",
  "Shopify Fulfillment Network", "Shopify POS", "Arrive", "Snowdevil", "Oberlo", "Deliverr", "6 River Systems", "Burst", "Sidekick", "Polaris", "Hydrogen", "Oxygen", "Linkpop", "Handshake", "Shoppy",
  "Tobias Lutke", "Tobi Lutke", "Lutke", "Tobi", "Fiona McKean", "McKean", "Daniel Weinand", "Weinand", "Scott Lake", "Harley Finkelstein", "Finkelstein",
  "Sanrio", "Hello Kitty", "Pusheen", "Kitty Poo Club", "Chad Kauffman", "Kauffman", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Stripe", "Kraft", "Ruby on Rails",
  /* look-alike worries for the picked name */ "Tinker Bell", "Tinkerbell", "Tink", "Till Payments", "Tillpoint", "Tillster"] };
const memeTickers = new Set(["POPCAT","MEW","MICHI","GRUMPY","KITTY","CAT","CATS","NYAN","KITTEN","TABBY","MOG","MANEKI","HOBBES","WIF","BONK","CATWIF","PURR","MEOW","SIMON","GIKO","BOOK","NUB","SNOWBALL","ROAR","ROARING","MIAO","MANEKI","SC","CWIF","KITTYCAT","GARFIELD","PUSS","TOM","LUCE","MUMU","NEIRO","PNUT","HAMSTER"]);
const verified = (() => { const a = JSON.parse(fs.readFileSync(`${S}/launch-sheet/EDITOR/jup-verified-list.json`, "utf8")); return Array.isArray(a) ? a : (a.tokens ?? a.data ?? []); })();
/* tickers already used anywhere in sheet 1 and sheet 2 picks */
const used = new Set();
const s1 = JSON.parse(fs.readFileSync(`${S}/launch-sheet/launch-sheet.json`, "utf8")); for (const c of (Array.isArray(s1) ? s1 : Object.values(s1).find(Array.isArray))) used.add(c.ticker);
for (const f of fs.readdirSync(`${S}/launch-sheet-2`).filter((f) => /-pick\.json$/.test(f) && !f.startsWith("SHOP"))) {
  try { const c = JSON.parse(fs.readFileSync(`${S}/launch-sheet-2/${f}`, "utf8")); for (const x of (Array.isArray(c) ? c : [c])) if (x.ticker) used.add(`${x.ticker}`); } catch {}
}
const cands = [
  { id: "draft1", name: "Parcel the Cardboard Tabby", ticker: "PARCELPAW", blurb: "Parcel, a cardboard-brown mackerel tabby with a cream chin and honey-gold eyes, naps in every empty box that turns up by the garden gate.",
    look: "A normal four-legged shorthair: a cardboard-brown mackerel tabby with darker brown stripes, a cream chin and honey-gold eyes. It wears nothing. The look comes from the parcels and shipping in the business." },
  { id: "draft2", name: "Tillbell the Tuxedo Cat", ticker: "TILLBELL", blurb: "Tillbell, a black-and-white tuxedo cat with white mittens and green-gold eyes, sits on the garden stall counter and chirps at each new visitor.",
    look: "A normal four-legged shorthair: a glossy black tuxedo cat with a white chest and white mittens, and green-gold eyes. It wears nothing. The look comes from point-of-sale checkout at a shop counter." },
  { id: "draft3", name: "Patchwork the Calico Cat", ticker: "PATCHPAW", blurb: "Patchwork, a calico with white paws and bold ginger and black patches, strolls between the little garden stalls as if every one of them were hers.",
    look: "A normal four-legged shorthair: a white calico with bold ginger and black patches, white paws and copper eyes. It wears nothing. The look comes from the business being many small merchants' stores stitched together." },
  { id: "pick", name: "Tillbell the Tuxedo Cat", ticker: "TILLBELL", blurb: "Tillbell, a black-and-white tuxedo cat with white mittens and green-gold eyes, sits on the garden stall counter and chirps at each new visitor.",
    look: "A normal four-legged shorthair house cat: glossy black with a white chest, a white chin and four white mittens (a tuxedo), and green-gold eyes. It wears nothing. The look comes from in-person checkout at a counter: a black card reader, a white paper receipt and the little bell by the till." },
];
const out = { disclosure: DISC, disclosureOnly_checkFields: R.checkFields({ description: DISC }), disclosureOnly_checkTerms: R.checkTerms({ disclosure: DISC }, stockTerms), results: [] };
const jupCache = {};
async function jup(q) {
  if (jupCache[q]) return jupCache[q];
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  return (jupCache[q] = { status: r.status, results: arr.length, arr });
}
for (const c of cands) {
  const desc = `${c.blurb} ${DISC}`;
  const o = { id: c.id, name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
    nameOK: c.name.length <= 32, descOK: desc.length <= 280, tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /SHOP|SHPF|SHPY/.test(c.ticker),
    knownCatMemeTicker: memeTickers.has(c.ticker), alreadyUsedInSheets: used.has(c.ticker), endsWithDisclaimer: desc.endsWith(DISC), description: desc };
  o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
  o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
  o.checkFields_description = R.checkFields({ description: desc });
  o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
  o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
  o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
  const j = await jup(c.ticker);
  const sm = j.arr.filter((t) => String(t.symbol).toUpperCase() === c.ticker);
  o.jup = { status: j.status, results: j.results, symbolMatches: sm.map((t) => ({ name: t.name, isVerified: t.isVerified, id: t.id })), verifiedMatch: sm.some((t) => t.isVerified === true) };
  o.cachedVerifiedListSymbolMatch = verified.filter((t) => String(t.symbol).toUpperCase() === c.ticker).map((t) => ({ name: t.name, id: t.id }));
  const first = c.name.split(" ")[0];
  const jn = await jup(first);
  o.jupNameSearch = { query: first, status: jn.status, results: jn.results, nameOrSymbolHits: jn.arr.filter((t) => new RegExp(first, "i").test(`${t.name} ${t.symbol}`)).map((t) => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })).slice(0, 8) };
  out.results.push(o);
}
out.verifiedListSize = verified.length;
out.usedTickerCount = used.size;
/* on-chain re-read of the SHOP mint */
try {
  const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["SH55hfaipFAbwT42nQYhRoM5o5t61QpkmJ6p62vXB3m", { encoding: "jsonParsed" }] }) });
  const jj = await rpc.json(); const v = jj.result.value; const info = v.data.parsed.info;
  out.mint = { owner: v.owner, extensions: info.extensions.map((e) => e.extension), transferFeeConfig: info.extensions.find((e) => e.extension === "transferFeeConfig")?.state ?? null,
    pausable: info.extensions.find((e) => e.extension === "pausableConfig")?.state ?? null, transferHook: info.extensions.find((e) => e.extension === "transferHook")?.state ?? null,
    permanentDelegate: info.extensions.find((e) => e.extension === "permanentDelegate")?.state ?? null,
    tokenMetadata: (({ name, symbol }) => ({ name, symbol }))(info.extensions.find((e) => e.extension === "tokenMetadata")?.state ?? {}),
    freezeAuthority: info.freezeAuthority, mintAuthority: info.mintAuthority, decimals: info.decimals };
} catch (e) { out.mintError = String(e); }
console.log(JSON.stringify(out, null, 1));
