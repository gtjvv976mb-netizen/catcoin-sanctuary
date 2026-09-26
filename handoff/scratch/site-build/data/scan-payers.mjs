import fs from "node:fs";
import { createRequire } from "node:module"; const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json"); const bs58 = require("bs58");
const url = "https://api.mainnet-beta.solana.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rpc = async (method, params) => { for (let a = 0; a < 6; a++) { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); if (r.status === 429) { await sleep(2000 * (a + 1)); continue; } const j = await r.json(); if (j.error) { if (j.error.code === 429 || /too many/i.test(j.error.message)) { await sleep(2000 * (a + 1)); continue; } return { error: j.error }; } return { result: j.result }; } throw new Error("429"); };
const LL = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
const payers = JSON.parse(fs.readFileSync("raw-txs.json", "utf8")).map((t) => [t.kind, t.result.transaction.message.accountKeys[0]]);
const found = [];
for (const [kind, p] of payers) {
  const { result: sigs } = await rpc("getSignaturesForAddress", [p, { limit: 200 }]);
  const failed = sigs.filter((s) => s.err);
  console.log(kind, p, "sigs", sigs.length, "failed", failed.length, "span", sigs.at(-1)?.blockTime, sigs[0]?.blockTime);
  for (const s of failed.slice(0, 15)) {
    const { result: r, error } = await rpc("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
    await sleep(250);
    if (error || !r) { console.log("  ", s.signature.slice(0, 8), "v1/none"); continue; }
    const m = r.transaction.message;
    const keys = [...m.accountKeys, ...(r.meta.loadedAddresses?.writable ?? []), ...(r.meta.loadedAddresses?.readonly ?? [])];
    const discs = m.instructions.map((ix) => keys[ix.programIdIndex] === LL ? "LL:" + Buffer.from(bs58.decode(ix.data)).subarray(0, 8).toString("hex") : keys[ix.programIdIndex].slice(0, 6));
    console.log("  ", s.signature.slice(0, 8), r.version, discs.join(" "), JSON.stringify(r.meta.err));
    if (discs.includes("LL:25be7ede2c9aab11")) found.push({ signature: s.signature, readAt: new Date().toISOString(), result: r });
  }
  await sleep(300);
}
fs.writeFileSync("failed-init.json", JSON.stringify(found, null, 1));
console.log("found", found.length);
