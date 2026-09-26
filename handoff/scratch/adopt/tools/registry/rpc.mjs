// Gentle READ-ONLY Solana JSON-RPC (<= 2 req/s). simulateTransaction only with sigVerify:false. sendTransaction refused.
import fs from "node:fs";
export const RPC = "https://api.mainnet-beta.solana.com";
export const OUT = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adopt/raw/registry/chain/";
const ALLOWED = new Set(["getAccountInfo","getMultipleAccounts","getSignaturesForAddress","getTransaction","getProgramAccounts","getSlot","getBalance","getLatestBlockhash","simulateTransaction","getBlock","getSignatureStatuses","getBlockTime"]);
let last = 0;
export const log = [];
export async function rpc(method, params, { save = null } = {}) {
  if (!ALLOWED.has(method)) throw new Error("method not allowed: " + method);
  if (method === "simulateTransaction" && params[1]?.sigVerify !== false) throw new Error("simulate only with sigVerify:false");
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = Math.max(0, last + 600 - Date.now()); if (wait) await new Promise(r => setTimeout(r, wait));
    last = Date.now();
    const t0 = Date.now();
    const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const text = await res.text();
    log.push({ at: new Date().toISOString(), method, status: res.status, ms: Date.now() - t0, bytes: text.length });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 4000 * (attempt + 1))); continue; }
    let j; try { j = JSON.parse(text); } catch { return { httpStatus: res.status, raw: text.slice(0, 500) }; }
    if (save) fs.writeFileSync(OUT + save + ".json", text);
    if (j.error && /429|Too many/i.test(JSON.stringify(j.error))) { await new Promise(r => setTimeout(r, 4000 * (attempt + 1))); continue; }
    return j.error ? { error: j.error, httpStatus: res.status } : j.result;
  }
  throw new Error("rate limited: " + method);
}
