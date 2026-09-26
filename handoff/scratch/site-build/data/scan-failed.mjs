import fs from "node:fs";
import { createRequire } from "node:module"; const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json"); const bs58 = require("bs58");
const url = "https://api.mainnet-beta.solana.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rpc = async (method, params) => { for (let a = 0; a < 6; a++) { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); if (r.status === 429) { await sleep(2000 * (a + 1)); continue; } const j = await r.json(); if (j.error) { if (j.error.code === 429 || /too many/i.test(j.error.message)) { await sleep(2000 * (a + 1)); continue; } return { error: j.error }; } return { result: j.result }; } throw new Error("429"); };
const LL = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
let before; const found = []; let fetched = 0; const tally = {};
for (let page = 0; page < 6 && found.length < 1; page++) {
  const { result: sigs } = await rpc("getSignaturesForAddress", [process.argv[2], { limit: 1000, ...(before ? { before } : {}) }]);
  before = sigs.at(-1).signature;
  for (const s of sigs) {
    if (!s.err || fetched >= 400) continue;
    fetched++;
    const { result: r, error } = await rpc("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
    await sleep(200);
    if (error || !r) { tally.v1 = (tally.v1 ?? 0) + 1; continue; }
    const m = r.transaction.message;
    const keys = [...m.accountKeys, ...(r.meta.loadedAddresses?.writable ?? []), ...(r.meta.loadedAddresses?.readonly ?? [])];
    const discs = m.instructions.map((ix) => keys[ix.programIdIndex] === LL ? "LL:" + Buffer.from(bs58.decode(ix.data)).subarray(0, 8).toString("hex") : keys[ix.programIdIndex].slice(0, 6));
    const k = discs.join(" "); tally[k] = (tally[k] ?? 0) + 1;
    if (discs.includes("LL:25be7ede2c9aab11")) { found.push({ signature: s.signature, err: r.meta.err, readAt: new Date().toISOString(), result: r }); console.log("FOUND", s.signature, JSON.stringify(r.meta.err)); break; }
  }
  if (fetched >= 400) break;
}
console.log(fetched, JSON.stringify(tally, null, 1).slice(0, 2500));
fs.writeFileSync("failed-init.json", JSON.stringify(found, null, 1));
