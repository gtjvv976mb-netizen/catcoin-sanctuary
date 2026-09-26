import fs from "fs";
const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in IREN. Not affiliated with IREN Limited, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
const pick = {
  name: "Millrace the Blue-Grey Cat",
  ticker: "MILLRACE",
  blurb: "Millrace, a plush blue-grey tabby with rippling stripes and pale green eyes, sits by the mill stream watching the water turn the wooden wheel.",
};
const desc = `${pick.blurb} ${DISC}`;
const stockTerms = { stock: ["IREN", "IREN Limited", "IREN Ltd", "Iris", "Iris Energy", "Roberts", "Daniel Roberts", "William Roberts", "Warriors", "Golden State", "Microsoft", "Nvidia", "Mirantis", "Childress", "Canal Flats", "Sydney", "Backpack", "Backpack Securities", "Sunrise", "Wormhole", "Bitcoin", "CoreWeave", "Prince George", "Mackenzie", "Fisher County"] };
const out = { pick, description: desc, nameLen: pick.name.length, blurbLen: pick.blurb.length, descLen: desc.length,
  tickerFormat: R.TICKER.test(pick.ticker), tickerHasRoot: /IREN|IRIS/.test(pick.ticker), endsWithDisclosure: desc.endsWith(DISC) };
out.checkProposal = R.checkProposal({ name: pick.name, symbol: pick.ticker, tagline: pick.blurb });
out.checkProposal_fullDescription = R.checkProposal({ name: pick.name, symbol: pick.ticker, tagline: desc });
out.checkFields_blurbOnly = R.checkFields({ description: pick.blurb });
out.checkFields_disclosureOnly = R.checkFields({ description: DISC });
out.checkTerms_stock = R.checkTerms({ name: pick.name, symbol: pick.ticker, description: desc.replace(DISC, "") }, stockTerms);
out.displaySafe = R.displaySafe({ name: pick.name, symbol: pick.ticker });
const jq = async (q) => { const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`); const j = await r.json(); const arr = Array.isArray(j) ? j : (j.tokens ?? []); return { status: r.status, results: arr.length, arr }; };
for (const q of ["MILLRACE", "Millrace"]) {
  try { const { status, results, arr } = await jq(q);
    out["jup_" + q] = { status, results, symbolMatches: arr.filter(t => String(t.symbol).toUpperCase() === "MILLRACE").map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified, id: t.id })),
      nameMatches: arr.filter(t => /millrace/i.test(t.name)).map(t => ({ symbol: t.symbol, name: t.name, isVerified: t.isVerified })), verifiedAny: arr.filter(t => t.isVerified).map(t => t.symbol) };
  } catch (e) { out["jup_" + q] = { error: String(e) }; }
}
// uniqueness vs other picks + xStocks sheet
const dir = ".";
const clashes = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith("-pick.json") && !f.startsWith("IREN"))) {
  const s = fs.readFileSync(f, "utf8"); if (/MILLRACE|Millrace/i.test(s)) clashes.push(f);
}
const sheet = fs.readFileSync("../launch-sheet/launch-sheet.json", "utf8"); if (/millrace/i.test(sheet)) clashes.push("launch-sheet.json");
out.uniquenessClashes = clashes;
// on-chain mint re-read
try {
  const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["RENzhrJQgmAnfcLhU1U5XwAMc6TC15UA6jCbPBaasnj", { encoding: "jsonParsed" }] }) });
  const j = await rpc.json(); const v = j.result.value; const info = v.data.parsed.info;
  out.mint = { owner: v.owner, extensions: info.extensions.map(e => e.extension), hasTransferFee: info.extensions.some(e => /transferFee/i.test(e.extension)), paused: info.extensions.find(e => e.extension === "pausableConfig")?.state?.paused, freezeAuthority: info.freezeAuthority, mintAuthority: info.mintAuthority };
} catch (e) { out.mint = { error: String(e) }; }
const pairs = JSON.parse(fs.readFileSync("../stockcats/stonkfun-pairs.json", "utf8")).data.pairs;
out.pair = pairs.find(p => p.symbol === "IREN");
console.log(JSON.stringify(out, null, 1));
