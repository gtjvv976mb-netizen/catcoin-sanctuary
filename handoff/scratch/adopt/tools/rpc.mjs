// Minimal, gentle (<=2 req/s) Solana JSON-RPC reader. READ-ONLY methods only.
const RPC = "https://api.mainnet-beta.solana.com";
const ALLOWED = new Set(["getAccountInfo","getMultipleAccounts","getSignaturesForAddress","getTransaction","getProgramAccounts","getSlot","getBalance","getLatestBlockhash","simulateTransaction"]);
let last = 0;
export async function rpc(method, params) {
  if (!ALLOWED.has(method)) throw new Error("method not allowed: " + method);
  if (method === "simulateTransaction" && (params[1]?.sigVerify !== false)) throw new Error("simulate only with sigVerify:false");
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = Math.max(0, last + 600 - Date.now()); if (wait) await new Promise(r => setTimeout(r, wait));
    last = Date.now();
    const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 3000 * (attempt + 1))); continue; }
    const j = await res.json();
    if (j.error) { if (/429|Too many/i.test(JSON.stringify(j.error))) { await new Promise(r => setTimeout(r, 3000 * (attempt + 1))); continue; } throw new Error(method + ": " + JSON.stringify(j.error)); }
    return j.result;
  }
  throw new Error("rate limited: " + method);
}
