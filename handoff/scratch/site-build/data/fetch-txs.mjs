import fs from "node:fs";
const url = "https://api.mainnet-beta.solana.com";
const samples = JSON.parse(fs.readFileSync("/home/user/Cat-Intelligence-Agency/fixtures/bots/stonkfun/launch-samples.json", "utf8")).launches;
const pump = JSON.parse(fs.readFileSync("/home/user/Cat-Intelligence-Agency/fixtures/bots/pumpfun/create-v2-samples.json", "utf8")).samples;
const sigs = [...samples.map((s) => ["stonkfun", s.signature]), ...pump.slice(0, 2).map((s) => ["pumpfun", s.signature])];
const out = [];
for (const [kind, sig] of sigs) {
  const body = { jsonrpc: "2.0", id: 1, method: "getTransaction", params: [sig, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }] };
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  console.log(kind, sig.slice(0, 8), r.status, j.error ? JSON.stringify(j.error) : (j.result ? `v=${j.result.version} ixs=${j.result.transaction.message.instructions.length} alt=${(j.result.transaction.message.addressTableLookups||[]).length} err=${JSON.stringify(j.result.meta.err)} inner=${j.result.meta.innerInstructions.length}` : "null"));
  out.push({ kind, signature: sig, readAt: new Date().toISOString(), request: body, result: j.result ?? null });
  await new Promise((res) => setTimeout(res, 700));
}
fs.writeFileSync("raw-txs.json", JSON.stringify(out, null, 1));
