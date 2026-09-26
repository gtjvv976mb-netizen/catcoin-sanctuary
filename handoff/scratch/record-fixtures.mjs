// Records fixtures/bots/stonkfun/2026-09-25/: copies the design step's raw reads (with their URLs
// and the times the answers carry) and makes the few live reads the plan still needs, gently.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const REPO = "/home/user/Cat-Intelligence-Agency";
const { Keypair } = createRequire(REPO + "/package.json")("@solana/web3.js");
const RAW = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launcher-design/raw";
const OUT = path.join(REPO, "fixtures/bots/stonkfun/2026-09-25");
const { STONKFUN_XSTOCKS } = await import(`${REPO}/src/lib/config.mjs`);
const { URLS, STONKFUN_PLATFORM_STANDARD, HOSTS } = await import(`${REPO}/bots/lib/verified.mjs`);
const { planStonkfunLaunch, initializeIx, curveRuleAddress } = await import(`${REPO}/bots/cashcat/stonkfun.mjs`);
const { createHttp } = await import(`${REPO}/bots/lib/http.mjs`);
const { createRpc, PUBLIC_RPC } = await import(`${REPO}/bots/lib/rpc.mjs`);
const { buildUnsignedTransaction, toBase64 } = await import(`${REPO}/src/lib/tx.mjs`);
const { checkLaunchMessage } = await import(`${REPO}/bots/lib/txcheck.mjs`);
const { COMPUTE_LIMITS } = await import(`${REPO}/bots/cashcat/config.mjs`);
const { PRIORITY_FEE_LAMPORTS } = await import(`${REPO}/src/lib/cashcat-tab.mjs`);
const { uriFor } = await import(`${REPO}/bots/cashcat/metadata.mjs`);

const argv = new Set(process.argv.slice(2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readRaw = (rel) => JSON.parse(fs.readFileSync(path.join(RAW, rel), "utf8"));
const mtime = (rel) => fs.statSync(path.join(RAW, rel)).mtime.toISOString();
const write = (rel, obj) => { const p = path.join(OUT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 1) + "\n"); console.log("wrote", rel, fs.statSync(p).size); };
fs.mkdirSync(OUT, { recursive: true });

/* ── A: the design step's live reads of 2026-09-25, copied with where and when ─────────── */
if (argv.has("copy")) {
  const stats = readRaw("stats.json");
  write("api-stats.json", { url: URLS.stonkfunStats, readAt: stats.meta.generatedAt, savedAt: mtime("stats.json"), note: "StonkFun's stats, read live 2026-09-25; readAt is the answer's own meta.generatedAt.", body: stats });
  const pairs = readRaw("pairs-ready.json");
  write("api-pairs-ready.json", { url: URLS.stonkfunPairs, readAt: pairs.meta.generatedAt, savedAt: mtime("pairs-ready.json"), note: "Every pair StonkFun listed as launchable and LaunchLab-ready, read live 2026-09-25; the whole answer, unedited.", body: pairs });
  const bySf = new Map(pairs.data.pairs.map((p) => [p.mint, p]));
  for (const x of STONKFUN_XSTOCKS) {
    const sf = bySf.get(x.mint);
    if (!sf) throw new Error(`${x.symbol} is not in the recorded pairs`);
    const rel = `pricing/${sf.symbol}.json`;
    const body = readRaw(rel);
    if (body.data.quote.mint !== x.mint) throw new Error(`${rel} is for another mint`);
    write(`pricing/${x.symbol}.json`, { url: URLS.stonkfunPricing(x.mint), readAt: body.meta?.generatedAt ?? body.data.prices.observedAt, savedAt: mtime(rel),
      note: `StonkFun's LaunchLab pricing for ${x.symbol} (StonkFun's ${sf.symbol}), read live 2026-09-25.`, body });
  }
  const products = readRaw("xstocks-products.json");
  const rows = STONKFUN_XSTOCKS.map((x) => { const p = products.find((q) => q?.addresses?.solana === x.mint); if (!p) throw new Error(`${x.symbol} not on the product list`); return p; });
  write("xstocks-official-24.json", { url: "https://xstocks.com/us/products", readAt: mtime("xstocks-products.html"),
    note: `The 24 rows, matched by Solana address, of the ${products.length} products in the page's embedded __NEXT_DATA__ products list, read live 2026-09-25 (readAt is when the page was saved). The extension never calls this host.`,
    products: rows });
}

/* ── B: live reads: the public RPC and StonkFun, a handful of calls, spaced out ─────────── */
let id = 0;
async function rpcCall(method, params) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(PUBLIC_RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
    if (res.status === 429) { await sleep(4000 * (i + 1)); continue; }
    const j = await res.json();
    await sleep(2000);
    if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
    return j.result;
  }
  throw new Error(`${method}: rate limited`);
}
const fixtureBody = (rel) => JSON.parse(fs.readFileSync(path.join(OUT, rel), "utf8")).body;

if (argv.has("accounts")) {
  const items = [{ address: STONKFUN_PLATFORM_STANDARD, label: "StonkFun standard platform config" }];
  for (const x of STONKFUN_XSTOCKS) {
    const pr = fixtureBody(`pricing/${x.symbol}.json`).data;
    const rule = curveRuleAddress(STONKFUN_PLATFORM_STANDARD, pr.curve.configId);
    if (rule !== pr.curveRule.standard) throw new Error(`${x.symbol}: pricing's curve rule is not the PDA`);
    items.push({ address: pr.curve.configId, label: `${x.symbol} GlobalConfig` }, { address: rule, label: `${x.symbol} curve rule (standard platform)` }, { address: x.mint, label: `${x.symbol} mint` });
  }
  const readAt = new Date().toISOString();
  const r = await rpcCall("getMultipleAccounts", [items.map((i) => i.address), { encoding: "base64", commitment: "confirmed" }]);
  write("accounts-xstocks.json", { url: PUBLIC_RPC, method: "getMultipleAccounts", params: { encoding: "base64", commitment: "confirmed" }, readAt, slot: r.context.slot,
    note: "StonkFun's standard platform config, and for each of the 24 xStocks its LaunchLab GlobalConfig (from its recorded pricing), its curve rule and its mint, in one base64 read.",
    accounts: items.map((it, i) => ({ ...it, owner: r.value[i]?.owner ?? null, lamports: r.value[i]?.lamports ?? null, dataBase64: r.value[i]?.data?.[0] ?? null })) });
}

if (argv.has("launched")) {
  const samples = JSON.parse(fs.readFileSync(path.join(REPO, "fixtures/bots/stonkfun/launch-samples.json"), "utf8")).launches;
  const mints = samples.map((l) => ({ address: l.accounts[6].pubkey, launch: l.signature, quote: l.accounts[7].pubkey }));
  const readAt = new Date().toISOString();
  const r = await rpcCall("getMultipleAccounts", [mints.map((m) => m.address), { encoding: "base64", commitment: "confirmed" }]);
  write("launched-mints.json", { url: PUBLIC_RPC, method: "getMultipleAccounts", params: { encoding: "base64", commitment: "confirmed" }, readAt, slot: r.context.slot,
    note: "The mints of the six real StonkFun launches in ../launch-samples.json, read in base64.",
    accounts: mints.map((m, i) => ({ ...m, owner: r.value[i]?.owner ?? null, lamports: r.value[i]?.lamports ?? null, dataBase64: r.value[i]?.data?.[0] ?? null })) });
}

async function stonkfunGet(url) {
  const readAt = new Date().toISOString();
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  await sleep(1500);
  return { url, readAt, status: res.status, body };
}
if (argv.has("tokens")) {
  const launches = readRaw("launches-newest.json");
  const pick = launches.data.launches.find((l) => l.mint === "F97bMicCsBgjkV24GdEUBVghmo9JjCcQTBnUvaqYGxWo");
  if (!pick) throw new Error("the picked launch is not in the recorded listing");
  const adopted = await stonkfunGet(URLS.stonkfunToken(pick.mint));
  write("api-token-adopted.json", { ...adopted, note: `A standard-mode launch paired with ${pick.quote.symbol}, picked from https://www.stonkfun.xyz/api/public/v1/launches (the newest 100, read ${launches.meta.generatedAt}), then read by mint.` });
  const unused = Keypair.generate().publicKey.toBase58();
  const nf = await stonkfunGet(URLS.stonkfunToken(unused));
  write("api-token-not-found.json", { ...nf, note: "A freshly generated address that no token has: what StonkFun answers for a mint it does not know." });
}

if (argv.has("simulate")) {
  const PAYER = "FFWtrEQ4B4PKQoVuHYzZq8FabGkVatYzDpEVHsK5rrhF";   // the funded third-party address the 2026-09-24 simulation used
  const MINT = "CashCatSimu1ationMint1111111111111111111111";      // an address with no account: nothing can sign for it, nothing is sent
  const stats = fixtureBody("api-stats.json"), pairs = fixtureBody("api-pairs-ready.json");
  for (const symbol of ["SPYx", "PLTRx"]) {
    const x = STONKFUN_XSTOCKS.find((s) => s.symbol === symbol);
    const pricing = fixtureBody(`pricing/${symbol}.json`);
    const fetchImpl = async (url) => {
      const body = url === URLS.stonkfunStats ? stats : url === URLS.stonkfunPairs ? pairs : url === URLS.stonkfunPricing(x.mint) ? pricing : null;
      if (!body && !url.startsWith(PUBLIC_RPC)) throw new Error(`no fixture for ${url}`);
      if (body) return new Response(JSON.stringify(body), { status: 200 });
      return fetch(url, arguments[1]);
    };
    const http = createHttp({ fetchImpl: (u, init) => (u.startsWith(PUBLIC_RPC) ? fetch(u, init) : fetchImpl(u)), allowedHosts: [HOSTS.stonkfun] });
    const rpc = createRpc({ http, url: PUBLIC_RPC });
    const plan = await planStonkfunLaunch({ http, rpc, quoteChoice: symbol, quoteList: STONKFUN_XSTOCKS });
    await sleep(2000);
    const coin = { name: "Sim Cat", symbol: "SIMCAT", uri: uriFor("stonkfun", `bafkrei${"a".repeat(52)}`) };
    const bh = await rpcCall("getLatestBlockhash", [{ commitment: "confirmed" }]);
    const tx = buildUnsignedTransaction({ payer: PAYER, blockhash: bh.value.blockhash, computeUnitLimit: COMPUTE_LIMITS.stonkfun, priorityFeeLamports: PRIORITY_FEE_LAMPORTS,
      instructions: [initializeIx({ payer: PAYER, mint: MINT, quoteMint: plan.quote.mint, quoteTokenProgram: plan.quote.tokenProgram, globalConfig: plan.globalConfig, curveRule: plan.curveRule, ...coin, raiseRaw: plan.raiseRaw, cpmmCreatorFeeOn: plan.cpmmCreatorFeeOn })] });
    checkLaunchMessage(tx.message, { wallet: PAYER, mint: MINT, venue: "stonkfun", coin, plan });
    const txBase64 = toBase64(tx.serialize());
    const before = await rpcCall("getBalance", [PAYER, { commitment: "confirmed" }]);
    const simulatedAt = new Date().toISOString();
    const params = { encoding: "base64", sigVerify: false, replaceRecentBlockhash: false, commitment: "confirmed", accounts: { encoding: "base64", addresses: [PAYER] } };
    const sim = await rpcCall("simulateTransaction", [txBase64, params]);
    const v = sim.value;
    write(`simulate-initialize-v0-${symbol}.json`, {
      note: `The extension's own v0 initialize_with_token_2022 for ${symbol}, built as src/lib/cashcat-tab.mjs builds a stock cat (src/lib/tx.mjs buildUnsignedTransaction, COMPUTE_LIMITS.stonkfun, PRIORITY_FEE_LAMPORTS, the placeholder URI) from the plan below — planned from this folder's recorded StonkFun answers and proved against the live chain — passed checkLaunchMessage with venue "stonkfun", then simulated on mainnet (sigVerify off) with a funded third-party payer and an unused mint. Nothing was signed or sent.`,
      endpoint: PUBLIC_RPC, method: "simulateTransaction", params, simulatedAt, slot: sim.context.slot, blockhash: bh.value.blockhash,
      payer: PAYER, mint: MINT, coin,
      plan: { quote: plan.quote, globalConfig: plan.globalConfig, platformConfig: plan.platformConfig, curveRule: plan.curveRule, raiseRaw: String(plan.raiseRaw), cpmmCreatorFeeOn: plan.cpmmCreatorFeeOn, pricedAt: plan.pricedAt },
      transactionBase64: txBase64,
      result: { err: v.err, unitsConsumed: v.unitsConsumed, payerBefore: before.value, payerAfter: v.accounts?.[0]?.lamports ?? null, logs: v.logs },
    });
    console.log(symbol, v.err, v.unitsConsumed, before.value - (v.accounts?.[0]?.lamports ?? 0));
  }
}
