// Read-only: one getMultipleAccounts on the public RPC for the 7 prestock mints and 3 Backpack mints,
// decoded with the CIA repo's vendor/executor/token2022.mjs describeMint and checked with
// src/lib/stockcats.mjs quoteRefusals against a pseudo-pair (so the xStock-issuer allow-list is applied).
import fs from "node:fs";
const REPO = "/home/user/Cat-Intelligence-Agency";
const { describeMint } = await import(`${REPO}/vendor/executor/token2022.mjs`);
const { quoteRefusals } = await import(`${REPO}/src/lib/stockcats.mjs`);
const pairs = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/stockcats/stonkfun-pairs.json", "utf8")).data.pairs;
const pick = [...pairs.filter((r) => r.category === "prestock"), ...pairs.filter((r) => r.category === "backpack").slice(0, 3)];
const body = { jsonrpc: "2.0", id: 1, method: "getMultipleAccounts", params: [pick.map((r) => r.mint), { encoding: "base64", commitment: "confirmed" }] };
const res = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const j = await res.json();
fs.writeFileSync(new URL("./rpc-quote-mints.json", import.meta.url), JSON.stringify({ readAt: new Date().toISOString(), request: body, status: res.status, response: j }, null, 1));
const out = pick.map((r, i) => {
  const a = j.result?.value?.[i];
  if (!a) return { symbol: r.symbol, category: r.category, missing: true };
  const d = describeMint({ owner: a.owner, data: Buffer.from(a.data[0], "base64") }, r.mint);
  const fee = d.transferFee ?? d.transferFeeConfig ?? null;
  return { symbol: r.symbol, category: r.category, mint: r.mint, owner: a.owner, extensions: d.extensionNames, mintAuthority: d.mintAuthority, freezeAuthority: d.freezeAuthority,
    permanentDelegate: d.permanentDelegate, transferHook: d.transferHookProgram, paused: d.paused, metadataSymbol: d.metadataSymbol, transferFee: fee,
    repoQuoteRefusals: quoteRefusals(d, { symbol: r.symbol }).map((x) => x.clause) };
});
console.log(JSON.stringify({ slot: j.result?.context?.slot, out }, (k, v) => (typeof v === "bigint" ? v.toString() : v), 1));
