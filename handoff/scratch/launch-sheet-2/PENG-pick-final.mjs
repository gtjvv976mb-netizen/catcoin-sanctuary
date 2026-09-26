const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in PENG. Not affiliated with Penguin Solutions, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const stockTerms = { stock: ["PENG","Penguin","Penguins","Penguin Solutions","Penguin Computing","Penguin Edge","SGH","SMART Global","SMART Global Holdings","SMART Modular","SMART Modular Technologies","Smart","Stratus","Stratus Technologies","Cree","Cree LED","Wolfspeed","Kash Shaikh","Shaikh","Nate Olmstead","Olmstead","OriginAI","ClusterWare","ClusterWareAI","MemoryAI","ComputeAI","ztC","everRun","Zefr","ZDIMM","Scyld","Fremont","Backpack","Backpack Securities","Sunrise","Wormhole","Pudgy","PENGU","Tux","tuxedo","waddle","flipper","emperor","igloo","iceberg","arctic","antarctic","Pingu","Finn","PenguinsSavingPenguins","WeAre_Penguin","Nietzschean","ice","snow","frost","tux"] };
const c = { name: "Whirr the Blue-Grey Cat", ticker: "WHIRRPAW",
  blurb: "Whirr, a smoky blue-grey shorthair with bright green eyes, purrs a steady low hum and keeps one eye open over the garden all night long.",
  look: "A normal four-legged, sleek, medium-build shorthair house cat. Solid smoky blue-grey coat with no markings and bright green eyes. Wears nothing. Taken from the business (always-on AI and high-performance computing servers and fault-tolerant computing): a steel blue-grey coat like a server rack, green eyes like status lights, a steady humming purr." };
const desc = `${c.blurb} ${DISC}`;
const o = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length,
  tickerFormat: R.TICKER.test(c.ticker), tickerHasStockRoot: /PENG|PENGU|SGH|SMART|STRAT|CREE|TUX/.test(c.ticker), endsWithDisclaimer: desc.endsWith(DISC) };
o.checkProposal_blurb = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb });
o.checkProposal_fullDescription = R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc });
o.checkFields_description = R.checkFields({ description: desc });
o.checkFields_blurb_look = R.checkFields({ blurb: c.blurb, look: c.look });
o.checkFields_disclaimerOnly = R.checkFields({ disclaimer: DISC });
o.checkTerms_stock = R.checkTerms({ name: c.name, symbol: c.ticker, tagline: c.blurb, look: c.look }, stockTerms);
o.checkTerms_disclaimer_only = R.checkTerms({ disclaimer: DISC }, { stock: stockTerms.stock.filter(t => !["Penguin","Penguins","Penguin Solutions","Backpack","Backpack Securities"].includes(t)) });
o.displaySafe = R.displaySafe({ name: c.name, symbol: c.ticker });
o.jup = {};
for (const q of [c.ticker, "WHIRR"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`);
  const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []);
  const sm = arr.filter(t => String(t.symbol).toUpperCase() === q);
  o.jup[q] = { status: r.status, results: arr.length, verifiedAny: arr.filter(t => t.isVerified).map(t => t.symbol), symbolMatches: sm.map(t => ({ name: t.name, isVerified: t.isVerified, holders: t.holderCount, mcap: t.mcap })), verifiedMatch: sm.some(t => t.isVerified === true) };
}
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["PENGTDQeQSXEjKcYw3CTQi9qznxcTHXAA7LMfUNrxLV", { encoding: "jsonParsed" }] }) });
const rj = await rpc.json(); const v = rj.result?.value;
o.mint = { status: rpc.status, owner: v?.owner, extensions: (v?.data?.parsed?.info?.extensions ?? []).map(e => e.extension), transferFee: (v?.data?.parsed?.info?.extensions ?? []).find(e => /transferFee/i.test(e.extension)) ?? null, pausable: (v?.data?.parsed?.info?.extensions ?? []).find(e => e.extension === "pausableConfig")?.state, permanentDelegate: (v?.data?.parsed?.info?.extensions ?? []).find(e => e.extension === "permanentDelegate")?.state };
o.description = desc;
console.log(JSON.stringify(o, null, 1));
