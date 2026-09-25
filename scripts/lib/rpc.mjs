/**
 * A SMALL, GENTLE SOLANA JSON-RPC CLIENT FOR THE COLLECTION BUILDER. Reads only.
 *
 * The URL is SOLANA_RPC_URL (a secret in the workflow, since providers put a key in it), or the
 * public mainnet endpoint. The URL is never logged. Calls are spaced out (`delayMs`) and a
 * rate-limited or failing call is retried with a growing wait; after that the run stops, and the
 * next run starts again from the same cursor.
 */

export const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";
/** getTransaction's answer when the transaction is newer than maxSupportedTransactionVersion. */
export const UNSUPPORTED_VERSION = -32015;

export class RpcError extends Error {
  constructor(message, { code = null, method = null } = {}) { super(message); this.name = "RpcError"; this.code = code; this.method = method; }
}

export function createRpc({ url = PUBLIC_RPC, fetchImpl = globalThis.fetch, delayMs = 400, retries = 4, backoffMs = 2000, timeoutMs = 30_000,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), commitment = "finalized" } = {}) {
  let u;
  try { u = new URL(url); } catch { throw new RpcError("SOLANA_RPC_URL is not a URL"); }
  if (u.protocol !== "https:") throw new RpcError("SOLANA_RPC_URL must be an https URL");
  let last = 0, id = 0, calls = 0;

  async function call(method, params) {
    for (let attempt = 0; ; attempt++) {
      const wait = last + delayMs - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now(); calls++;
      let status = 0, body = null;
      try {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        status = res.status;
        body = status === 200 ? await res.json() : null;
      } catch { status = -1; }
      const limited = status === 429 || status >= 500 || status === -1 || body?.error?.code === 429 || body?.error?.code === -32429
        || (body?.error && /too many requests|rate limit/i.test(String(body.error.message)));
      if (limited) {
        if (attempt >= retries) throw new RpcError(`${method}: the RPC kept refusing (${status === -1 ? "no answer" : status})`, { method });
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      if (status !== 200 || !body || typeof body !== "object") throw new RpcError(`${method}: HTTP ${status}`, { method });
      if (body.error) throw new RpcError(`${method}: ${String(body.error.message ?? "error").slice(0, 200)}`, { code: body.error.code ?? null, method });
      return body.result;
    }
  }

  return Object.freeze({
    isPublic: u.origin === new URL(PUBLIC_RPC).origin,
    get calls() { return calls; },
    call,
    /** Newest first. `before` and `until` are signatures; `until` itself is not returned. */
    getSignaturesForAddress: (address, { before, until, limit = 1000 } = {}) =>
      call("getSignaturesForAddress", [address, { limit, commitment, ...(before ? { before } : {}), ...(until ? { until } : {}) }]),
    getTransaction: (signature) =>
      call("getTransaction", [signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment }]),
    getMultipleAccounts: async (addresses) =>
      (await call("getMultipleAccounts", [addresses, { encoding: "base64", commitment }]))?.value,
  });
}
