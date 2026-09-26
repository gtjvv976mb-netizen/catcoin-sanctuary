const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in CRWV. Not affiliated with CoreWeave, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const c = { name: "Cabletail the Charcoal Tabby", ticker: "CABLETAIL",
  blurb: "Cabletail, a lean charcoal tabby whose bold black stripes run like bundled cables, threads through the flower beds and never gets tangled.",
  look: "Normal four-legged house cat. Lean, short-haired charcoal-grey tabby with bold black mackerel stripes, a black-ringed tail, no white markings and warm gold eyes. Wears nothing." };
const stockTerms = { stock: ["CRWV","CoreWeave","Core Weave","Core","Weave","Weaver","Atlantic Crypto","Michael Intrator","Intrator","Brian Venturo","Venturo","Brannin McBee","McBee","Peter Salanki","Salanki","Nvidia","Blackwell","Hopper","Weights & Biases","wandb","Marimo","OpenPipe","Monolith","Conductor","Aston Martin","Aramco","Magnetar","OpenAI","Microsoft","Backpack","Backpack Securities","Sunrise","Wormhole"] };
const desc = `${c.blurb} ${DISC}`;
const out = { name: c.name, ticker: c.ticker, nameLen: c.name.length, blurbLen: c.blurb.length, descLen: desc.length, description: desc,
  tickerRegex: R.TICKER.test(c.ticker),
  checkProposal_name_symbol_blurb: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.blurb }),
  checkFields_look: R.checkFields({ look: c.look }),
  checkFields_fullDescription: R.checkFields({ description: desc }),
  checkProposal_fullDescriptionAsTagline: R.checkProposal({ name: c.name, symbol: c.ticker, tagline: desc }),
  checkTerms_stock: R.checkTerms({ name: c.name, symbol: c.ticker, blurb: c.blurb, look: c.look }, stockTerms),
  displaySafe: R.displaySafe({ name: c.name, symbol: c.ticker }) };
for (const q of ["CABLETAIL", "CRWV"]) {
  const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`); const arr = await res.json();
  out[`jup_${q}`] = { status: res.status, results: arr.length, all: arr.slice(0, 5).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, tags: t.tags, id: t.id })) };
}
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["CRWVJeR2yEZuDUKYfGuKCHvLz8ywn4LGvovHfy5WiFmi", { encoding: "jsonParsed" }] }) });
const v = (await rpc.json()).result.value; const info = v.data.parsed.info;
out.mint = { owner: v.owner, extensions: (info.extensions ?? []).map(e => e.extension), hasTransferFeeConfig: (info.extensions ?? []).some(e => e.extension === "transferFeeConfig"),
  pausable: info.extensions?.find(e => e.extension === "pausableConfig")?.state, freezeAuthority: info.freezeAuthority, checkedAt: new Date().toISOString() };
console.log(JSON.stringify(out, null, 1));
