// Fetch recent txs touching Jupiter program authority wSOL ATAs; keep ones whose top-level shape
// matches the agent's (compute budget, ATA creates, exactly one shared_accounts_route_v2).
import fs from "node:fs";
const RPC = "https://api.mainnet-beta.solana.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(method, params) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (res.status === 429) { await sleep(3000); continue; }
    const j = await res.json();
    if (j.error) throw new Error(JSON.stringify(j.error));
    return j.result;
  }
  throw new Error("429s");
}
const addrs = process.argv.slice(2);
const out = [];
for (const a of addrs) {
  const sigs = await call("getSignaturesForAddress", [a, { limit: 60 }]);
  await sleep(1200);
  for (const s of sigs.filter((x) => !x.err).slice(0, 60)) {
    try {
      const tx = await call("getTransaction", [s.signature, { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]);
      out.push({ address: a, signature: s.signature, tx });
    } catch (e) { console.error(s.signature, e.message); }
    await sleep(700);
  }
}
fs.writeFileSync(process.env.OUT || "hops.json", JSON.stringify(out));
console.log("saved", out.length);
