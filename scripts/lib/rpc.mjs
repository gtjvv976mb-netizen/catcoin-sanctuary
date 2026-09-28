/**
 * A SMALL, GENTLE SOLANA JSON-RPC CLIENT FOR THE COLLECTION BUILDER AND THE LAUNCHER.
 *
 * The URL is SOLANA_RPC_URL (a secret in the workflow, since providers put a key in it), or the
 * public mainnet endpoint. The URL is never logged, and no error names it. Calls are spaced out
 * (`delayMs`) and a rate-limited or failing call is retried with a growing wait; after that the run
 * stops, and the next run starts again from the same cursor.
 *
 * The collection builder only reads (getSignaturesForAddress, getTransaction, getMultipleAccounts,
 * all "finalized"). The launcher (scripts/launch.mjs) also asks for a blockhash, a simulation, the
 * balance, signature statuses and the block height, and sends ONE signed transaction: a send that
 * times out or meets a 5xx is posted again with the very same bytes, which Solana deduplicates by
 * signature, so a retry can never make a second transaction. An answer with a JSON-RPC error (a
 * preflight refusal) is never retried: it throws an RpcError with the node's code, and with `posts`,
 * how many times the call was posted: an error answered to a repeated send may be about a copy that
 * already went out (the launcher then treats the send as sent, never as refused).
 */

export const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";
/** getTransaction's answer when the transaction is newer than maxSupportedTransactionVersion. */
export const UNSUPPORTED_VERSION = -32015;

export class RpcError extends Error {
  constructor(message, { code = null, method = null, posts = null } = {}) { super(message); this.name = "RpcError"; this.code = code; this.method = method; this.posts = posts; }
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
        if (attempt >= retries) throw new RpcError(`${method}: the RPC kept refusing (${status === -1 ? "no answer" : status})`, { method, posts: attempt + 1 });
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      if (status !== 200 || !body || typeof body !== "object") throw new RpcError(`${method}: HTTP ${status}`, { method, posts: attempt + 1 });
      if (body.error) throw new RpcError(`${method}: ${String(body.error.message ?? "error").slice(0, 200)}`, { code: body.error.code ?? null, method, posts: attempt + 1 });
      return body.result;
    }
  }

  return Object.freeze({
    isPublic: u.origin === new URL(PUBLIC_RPC).origin,
    get calls() { return calls; },
    call,
    /** Newest first. `before` and `until` are signatures; `until` itself is not returned. */
    getSignaturesForAddress: (address, { before, until, limit = 1000, commitment: c = commitment } = {}) =>
      call("getSignaturesForAddress", [address, { limit, commitment: c, ...(before ? { before } : {}), ...(until ? { until } : {}) }]),
    getTransaction: (signature, { commitment: c = commitment } = {}) =>
      call("getTransaction", [signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: c }]),
    getMultipleAccounts: async (addresses, { commitment: c = commitment } = {}) =>
      (await call("getMultipleAccounts", [addresses, { encoding: "base64", commitment: c }]))?.value,

    /* ── the launcher's calls ── */
    /** { blockhash, lastValidBlockHeight } ("confirmed" by default: a finalized blockhash leaves less time to land). */
    getLatestBlockhash: async ({ commitment: c = "confirmed" } = {}) => (await call("getLatestBlockhash", [{ commitment: c }]))?.value ?? null,
    /** The block height (the one lastValidBlockHeight is compared with). */
    getBlockHeight: ({ commitment: c = commitment } = {}) => call("getBlockHeight", [{ commitment: c }]),
    /** An address's lamports. */
    getBalance: async (address, { commitment: c = "confirmed" } = {}) => (await call("getBalance", [address, { commitment: c }]))?.value ?? null,
    /**
     * Simulate a signed transaction (base64) exactly as it would be sent: its own blockhash
     * (replaceRecentBlockhash false), signatures not checked (sigVerify false), and `addresses`'
     * accounts as they would be after it (base64). Returns the answer's value: { err, logs, accounts, unitsConsumed }.
     */
    simulateTransaction: async (base64, { addresses = [], commitment: c = "confirmed" } = {}) =>
      (await call("simulateTransaction", [base64, { encoding: "base64", sigVerify: false, replaceRecentBlockhash: false, commitment: c,
        accounts: { encoding: "base64", addresses } }]))?.value ?? null,
    /** Send a signed transaction (base64) with the node's own preflight; returns its signature. */
    sendTransaction: (base64, { maxRetries = 5, preflightCommitment = "confirmed" } = {}) =>
      call("sendTransaction", [base64, { encoding: "base64", skipPreflight: false, preflightCommitment, maxRetries }]),
    /** [status | null] for each signature, searched in the node's whole history. */
    getSignatureStatuses: async (signatures) =>
      (await call("getSignatureStatuses", [signatures, { searchTransactionHistory: true }]))?.value ?? null,
  });
}
