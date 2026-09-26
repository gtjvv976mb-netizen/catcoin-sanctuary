/* Record one live scan of the scout exactly as the extension would run it (default spec: the six
   preset cats pinned, the default floors, $25 at 100 bps, settled in USDC), every request and
   answer kept, then the named cases. Nothing is signed or sent. */
import fs from "node:fs";
import path from "node:path";
const REPO = "/home/user/Cat-Intelligence-Agency";
const OUT = path.dirname(new URL(import.meta.url).pathname);
const { createScout } = await import(`${REPO}/src/lib/agent-scout.mjs`);
const { normalizeAgentSpec, scoutDialsKey, universeEntries } = await import(`${REPO}/src/lib/agent-strategy.mjs`);
const { createJupiterClient } = await import(`${REPO}/src/lib/jupiter-swap.mjs`);
const { createRpc } = await import(`${REPO}/src/lib/rpc.mjs`);
const { createHttp, HTTP_DEFAULTS } = await import(`${REPO}/bots/lib/http.mjs`);
const { HOSTS } = await import(`${REPO}/bots/lib/verified.mjs`);

const RPC_URL = "https://api.mainnet-beta.solana.com";
const log = { list: null, jupiter: [], rpc: [] };

/* The bots' http client, as the worker builds it (one retry), with json() re-done over request()
   so the raw bytes and headers are kept. */
const real = createHttp({ fetchImpl: (u, i) => fetch(u, i), allowedHosts: [HOSTS.jupiter], defaults: { ...HTTP_DEFAULTS, retries: 1 } });
const http = {
  async json(url, opts = {}) {
    const res = await real.request(url, { ...opts, headers: { accept: "application/json" } });
    const text = res.body.toString("utf8");
    log.list = { url, status: res.status, bytes: res.body.length, cacheControl: res.headers.get("cache-control"), date: res.headers.get("date"), at: new Date().toISOString(), text };
    return JSON.parse(text);
  },
};
const jupFetch = async (url, init = {}) => {
  const at = new Date().toISOString();
  const res = await fetch(url, init);
  const text = await res.text();
  log.jupiter.push({ at, method: init.method ?? "GET", url, status: res.status, ratelimitRemaining: res.headers.get("x-ratelimit-remaining"), body: (() => { try { return JSON.parse(text); } catch { return text; } })() });
  return { ok: res.ok, status: res.status, headers: res.headers, text: async () => text };
};
const jupiter = createJupiterClient({ fetchImpl: jupFetch });
const rpcReal = createRpc({ url: RPC_URL, fetchImpl: (u, i) => fetch(u, i), timeoutMs: 30_000 });
const rpc = {
  async getMultipleAccounts(addresses, opts) {
    const at = new Date().toISOString();
    const r = await rpcReal.getMultipleAccounts(addresses, opts);
    log.rpc.push({ at, method: "getMultipleAccounts", commitment: opts?.commitment ?? null, addresses, slot: r.slot, accounts: r.accounts });
    return r;
  },
};

const spec = normalizeAgentSpec({ scoutOn: true, ...(process.env.NOPINS ? { universe: [] } : {}) });
const scout = createScout({ http, jupiter, rpc: () => rpc });
const input = {
  dialsKey: scoutDialsKey(spec), settlementMint: spec.settlementMint, sizeUsd: spec.maxPositionUsd, slippageBps: spec.slippageBps,
  pins: universeEntries(spec).map((u) => ({ mint: u.mint, symbol: u.symbol })), incumbents: [],
  floors: { minLiquidityUsd: spec.scoutMinLiquidityUsd, minVolume24hUsd: spec.scoutMinVolume24hUsd, minAgeDays: spec.scoutMinAgeDays },
};
const started = Date.now();
const report = await scout.scan(input);
const took = Date.now() - started;
console.log(JSON.stringify({ ok: report.ok, clause: report.clause, funnel: report.funnel, refusedBy: report.refusedBy, took }, null, 1));
for (const a of report.admitted ?? []) console.log("ADMIT", a.symbol, a.route.via, a.route.buyImpactPct, a.route.roundTripLossPct);
for (const p of report.pinRoutes ?? []) console.log("PIN", p.symbol, p.ok, p.via ?? p.clause, p.buyImpactPct ?? "");
for (const x of report.refused ?? []) if (/route|round|impact|chain|mint|jupiter|freeze|budget/.test(x.clause)) console.log("REFUSED", x.symbol, x.clause, x.check ?? "", x.message.slice(0, 120));
fs.writeFileSync(path.join(OUT, "scan.json"), JSON.stringify({ input, report, took, log: { ...log, list: { ...log.list, text: undefined } } }, null, 1));
fs.writeFileSync(path.join(OUT, "list.json"), log.list.text);
console.log("jupiter requests", log.jupiter.length, "rpc", log.rpc.length, "list bytes", log.list.bytes);
