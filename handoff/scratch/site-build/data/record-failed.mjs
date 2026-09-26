import fs from "node:fs";
const url = "https://api.mainnet-beta.solana.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rpc(method, params) { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); const j = await r.json(); await sleep(400); return { method, params, readAt: new Date().toISOString(), ...(j.error ? { error: j.error } : { result: j.result }) }; }
const w = "45ByChvJhwVFBP9pzZDvsByfoepRnmRMRNhXE6SD2Wjc";
const page = await rpc("getSignaturesForAddress", [w, { limit: 1000, commitment: "finalized" }]);
const f = page.result.find((s) => s.err);
console.log(f);
const tx = await rpc("getTransaction", [f.signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "finalized" }]);
const rec = JSON.parse(fs.readFileSync("recorded.json", "utf8"));
rec.failed = { note: "A real failed transaction paid by the GMEx launcher's wallet (a swap that failed on chain), as its history listed it.", signature: f, transaction: tx };
// a real version-1 answer: ask for one with maxSupportedTransactionVersion 0 and keep the error the RPC gives.
const v1 = JSON.parse(fs.readFileSync("v1-sample.json", "utf8")).signature;
rec.v1 = await rpc("getTransaction", [v1, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "finalized" }]);
console.log(tx.result?.meta?.err, rec.v1.error);
fs.writeFileSync("recorded.json", JSON.stringify(rec));
