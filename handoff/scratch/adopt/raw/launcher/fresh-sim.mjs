// READ-ONLY re-run of the CIA repo's StonkFun launcher (HEAD 5f573e5) against the live API and chain.
// Plans with bots/cashcat/stonkfun.mjs planStonkfunLaunch (live StonkFun API + public RPC reads),
// builds with src/lib/tx.mjs buildUnsignedTransaction (the extension's v0 path), checks with
// bots/lib/txcheck.mjs checkLaunchMessage, then simulateTransaction with sigVerify:false and
// replaceRecentBlockhash:true. NOTHING IS SIGNED OR SENT: the rpc wrapper refuses sendTransaction,
// the mint is a random 32-byte address with no key, and the payer is a third-party funded address.
import fs from "node:fs";
import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";
const REPO = "/home/user/Cat-Intelligence-Agency";
const { planStonkfunLaunch, initializeIx, poolState } = await import(`${REPO}/bots/cashcat/stonkfun.mjs`);
const { checkLaunchMessage, checkSimulation } = await import(`${REPO}/bots/lib/txcheck.mjs`);
const { buildUnsignedTransaction, toBase64 } = await import(`${REPO}/src/lib/tx.mjs`);
const { createHttp } = await import(`${REPO}/bots/lib/http.mjs`);
const { createRpc } = await import(`${REPO}/bots/lib/rpc.mjs`);
const { HOSTS } = await import(`${REPO}/bots/lib/verified.mjs`);
const { COMPUTE_LIMITS, MAX_LAUNCH_SPEND_LAMPORTS } = await import(`${REPO}/bots/cashcat/config.mjs`);
const { PRIORITY_FEE_LAMPORTS } = await import(`${REPO}/src/lib/cashcat-tab.mjs`);
const { STONKFUN_XSTOCKS } = await import(`${REPO}/src/lib/config.mjs`);

const OUT = new URL("./", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const fetchImpl = async (url, init) => {           // record every request and answer
  await sleep(700);                                  // stay well under 2 req/s
  const res = await fetch(url, init);
  const text = await res.text();
  const entry = { at: new Date().toISOString(), url: String(url), method: init?.method ?? "GET", status: res.status };
  if (init?.body) { const b = JSON.parse(init.body); if (b.method === "sendTransaction") throw new Error("REFUSED: this script never sends"); entry.rpcMethod = b.method; }
  entry.body = text.length > 20000 ? `${text.slice(0, 20000)}…(${text.length} bytes)` : text;
  log.push(entry);
  return new Response(text, { status: res.status, headers: res.headers });
};
const http = createHttp({ fetchImpl, allowedHosts: [...Object.values(HOSTS), "api.mainnet-beta.solana.com"] });
const rpc = createRpc({ http });
const PAYER = "FFWtrEQ4B4PKQoVuHYzZq8FabGkVatYzDpEVHsK5rrhF";   // the funded third-party payer the repo's fixtures used
const sheet = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet/launch-sheet.json", "utf8"));
const pairs = JSON.parse(fs.readFileSync("/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/stockcats/stonkfun-pairs.json", "utf8")).data.pairs;
const pre = pairs.find((p) => p.symbol === "ANTHROPIC");
const bp = pairs.find((p) => p.symbol === "MU");
const bpLegacy = pairs.find((p) => p.category === "backpack" && p.tokenProgram === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
// A StonkFun-style Arweave (Irys gateway) URI of the real length (the sampled ones are 69 chars)
const IRYS_URI = `https://gateway.irys.xyz/${"A".repeat(44)}`;
const scenarios = [
  { label: "xStock SPYx, sheet row 1", quoteChoice: "SPYx", quoteList: STONKFUN_XSTOCKS, coin: { name: sheet[0].name, symbol: sheet[0].ticker } },
  { label: "xStock TSLAx, sheet row 4", quoteChoice: "TSLAx", quoteList: STONKFUN_XSTOCKS, coin: { name: sheet[3].name, symbol: sheet[3].ticker } },
  { label: "prestock ANTHROPIC (outside the repo's list; passed as a one-row quoteList)", quoteChoice: pre.mint, quoteList: [{ symbol: pre.symbol, name: pre.name, mint: pre.mint }], coin: { name: "Test Prestock Cat", symbol: "TESTCAT" } },
  { label: "Backpack MU, Token-2022 (outside the repo's list)", quoteChoice: bp.mint, quoteList: [{ symbol: bp.symbol, name: bp.name, mint: bp.mint }], coin: { name: "Test Backpack Cat", symbol: "TESTCAT" } },
  ...(bpLegacy ? [{ label: `Backpack ${bpLegacy.symbol}, classic SPL Token (outside the repo's list)`, quoteChoice: bpLegacy.mint, quoteList: [{ symbol: bpLegacy.symbol, name: bpLegacy.name, mint: bpLegacy.mint }], coin: { name: "Test Backpack Cat", symbol: "TESTCAT" } }] : []),
];
const results = [];
for (const s of scenarios) {
  const r = { label: s.label, coin: s.coin };
  try {
    const plan = await planStonkfunLaunch({ http, rpc, quoteChoice: s.quoteChoice, quoteList: s.quoteList });
    r.plan = { quote: plan.quote, globalConfig: plan.globalConfig, curveRule: plan.curveRule, platformConfig: plan.platformConfig, raiseRaw: String(plan.raiseRaw), cpmmCreatorFeeOn: plan.cpmmCreatorFeeOn,
      platform: { feeRate: String(plan.platform.feeRate), creatorFeeRate: String(plan.platform.creatorFeeRate) }, marketCap: plan.marketCap, pricedAt: plan.pricedAt };
    const mint = new PublicKey(crypto.randomBytes(32)).toBase58();   // an address only: no key exists for it
    const coin = { ...s.coin, uri: IRYS_URI };
    const ix = initializeIx({ payer: PAYER, mint, quoteMint: plan.quote.mint, quoteTokenProgram: plan.quote.tokenProgram, globalConfig: plan.globalConfig, platformConfig: plan.platformConfig,
      curveRule: plan.curveRule, name: coin.name, symbol: coin.symbol, uri: coin.uri, raiseRaw: plan.raiseRaw, cpmmCreatorFeeOn: plan.cpmmCreatorFeeOn });
    const tx = buildUnsignedTransaction({ payer: PAYER, blockhash: "11111111111111111111111111111111", instructions: [ix], computeUnitLimit: COMPUTE_LIMITS.stonkfun, priorityFeeLamports: PRIORITY_FEE_LAMPORTS });
    checkLaunchMessage(tx.message, { wallet: PAYER, mint, venue: "stonkfun", plan, coin });
    r.preSignCheck = "passed";
    const b64 = toBase64(tx.serialize());
    r.txBytes = tx.serialize().length;
    r.mint = mint; r.pool = poolState(mint, plan.quote.mint);
    const before = await rpc.getBalance(PAYER);
    const sim = await rpc.simulate(b64, { sigVerify: false, replaceRecentBlockhash: true, accounts: [PAYER] });
    r.sim = { err: sim?.err ?? null, unitsConsumed: sim?.unitsConsumed ?? null, payerBefore: before, payerAfter: sim?.accounts?.[0]?.lamports ?? null,
      logsOfInterest: (sim?.logs ?? []).filter((l) => /Instruction:|Warning|error|fail|consumed .* of/i.test(l)) };
    try { r.simCheck = checkSimulation(sim, { walletBefore: before, walletAfter: sim?.accounts?.[0]?.lamports, maxSpendLamports: MAX_LAUNCH_SPEND_LAMPORTS.stonkfun, mustLog: "Instruction: InitializeWithToken2022" }); }
    catch (e) { r.simCheck = { refused: e.clause, message: e.message }; }
  } catch (e) {
    r.refused = { clause: e.clause ?? null, message: String(e.message ?? e) };
  }
  results.push(r);
}
fs.writeFileSync(new URL("./fresh-sim.requests.json", OUT), JSON.stringify(log, null, 1));
console.log(JSON.stringify({ ranAt: new Date().toISOString(), payer: PAYER, uri: IRYS_URI, results }, null, 1));
