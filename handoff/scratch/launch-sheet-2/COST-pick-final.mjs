const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in COST. Not affiliated with Costco Wholesale, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["COST", "Costco", "Costco Wholesale", "Costco Wholesale Corporation", "Wholesale", "Warehouse", "Price Club", "Price", "Sol Price", "Robert Price", "FedMart",
  "Kirkland", "Kirkland Signature", "Issaquah", "Sinegal", "Jim Sinegal", "James Sinegal", "Brotman", "Jeffrey Brotman", "Vachris", "Ron Vachris", "Jelinek", "Craig Jelinek", "Hamilton James",
  "Hello Kitty", "Kitty", "Sanrio", "Cinnamoroll", "Kuromi", "Squishmallow", "Squishmallows", "A-Sha", "Snoopy", "Jim Shore", "Costco Guys", "Big Justice",
  "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Executive Member", "Costco Connection"] };
const probe = { probe: ["Stacks", "STX", "Parton", "Dolly", "Parcel", "Stacker", "Cubs", "Cubbies", "Milk Carton"] };
const c = { name: "Carton the Cardboard-Tan Cat", ticker: "CARTONPAW",
  blurb: "Carton, a big broad-chested cat with a cardboard-tan coat, cream bib and cream paws, naps on a tall pile of brown boxes in the garden shed.",
  look: "From the business: bulk boxed goods stacked on pallets. A normal four-legged, big, sturdy house cat with a cardboard-tan coat, a cream bib, cream paws and honey-gold eyes. It wears nothing." };
const desc = `${c.blurb} ${DISC}`;
const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
  tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /COST|KIRK|WHOLE|WARE|PRICE/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC) };
o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
o.checkFields_description = R.checkFields({ description: desc });
o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
o.checkFields_disclaimerOnly = R.checkFields({ disclaimer: DISC });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, description: desc.replace(DISC, ""), look: c.look }, stockTerms);
o.checkTerms_probe = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, probe);
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${c.ticker}`);
const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
o.jup = { status: r.status, results: arr.length, all: arr.map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified ?? false })), symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === c.ticker).length };
o.jup.verifiedMatch = arr.some(t => String(t.symbol).toUpperCase() === c.ticker && t.isVerified === true);
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["CZEB3WNZuF2Yz1z2H81RcCk8T7fsw82KB33zqamASVsg", { encoding: "jsonParsed" }] }) });
const m = await rpc.json(); const info = m.result.value.data.parsed.info;
o.mint = { owner: m.result.value.owner, extensions: info.extensions.map(e => e.extension), transferFeeConfig: info.extensions.some(e => e.extension === "transferFeeConfig"),
  paused: info.extensions.find(e => e.extension === "pausableConfig")?.state?.paused, freezeAuthority: info.freezeAuthority, permanentDelegate: info.extensions.find(e => e.extension === "permanentDelegate")?.state?.delegate };
o.description = desc;
console.log(JSON.stringify(o, null, 1));
