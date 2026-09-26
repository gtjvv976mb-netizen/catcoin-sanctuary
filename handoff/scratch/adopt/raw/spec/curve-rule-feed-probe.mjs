// READ-ONLY probe: is the StonkFun curve-rule PDA of a quote touched only by launches (initialize_with_token_2022)?
// If so, getSignaturesForAddress(curveRule) is a per-stock launch feed that a browser can read via publicnode.
// Methods: getSignaturesForAddress, getTransaction. <= ~1.5 req/s. Nothing signed or sent.
import fs from "node:fs";
const PUBLIC = "https://api.mainnet-beta.solana.com", PN = "https://solana-rpc.publicnode.com", ORIGIN = "https://catcoinsanctuary.com";
const RULE_SPYX = "QYZp1YzqEHU67ngXphF9LAkxkxWGvpWEv3rXh4yDbWA"; // PDA["platform_curve_rule", 4E876…, B7ctMM… (SPYx config)]
let last = 0;
async function call(url, method, params, origin) {
  const wait = Math.max(0, last + 700 - Date.now()); if (wait) await new Promise(r => setTimeout(r, wait)); last = Date.now();
  const headers = { "content-type": "application/json" }; if (origin) headers.Origin = origin;
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  return { status: r.status, acao: r.headers.get("access-control-allow-origin"), body: await r.json().catch(() => null) };
}
const out = { probedAt: new Date().toISOString(), rule: RULE_SPYX, sigs: null, txs: [], publicnode: {} };
const s = await call(PUBLIC, "getSignaturesForAddress", [RULE_SPYX, { limit: 25, commitment: "finalized" }]);
out.sigs = s.body.result.map(x => ({ sig: x.signature, slot: x.slot, txIndex: x.transactionIndex, err: x.err, memo: x.memo, blockTime: x.blockTime }));
const LL = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
for (const x of out.sigs.slice(0, 8)) {
  const t = await call(PUBLIC, "getTransaction", [x.sig, { maxSupportedTransactionVersion: 1, commitment: "finalized", encoding: "json" }]);
  const tx = t.body?.result; if (!tx) { out.txs.push({ sig: x.sig, missing: true, err: t.body?.error }); continue; }
  const logs = tx.meta?.logMessages || [];
  const llIx = logs.filter(l => /Program log: Instruction: /.test(l)).map(l => l.replace("Program log: Instruction: ", ""));
  const keys = tx.transaction.message.accountKeys; const staticKeys = Array.isArray(keys) ? keys : [];
  out.txs.push({ sig: x.sig, slot: tx.slot, version: tx.version, err: tx.meta?.err, feePayer: staticKeys[0], instructionsLogged: llIx.slice(0, 12), hasInitialize: llIx.includes("InitializeWithToken2022") });
}
// Same two reads from a browser Origin through publicnode
const pnSig = await call(PN, "getSignaturesForAddress", [RULE_SPYX, { limit: 5 }], ORIGIN);
out.publicnode.getSignaturesForAddress = { status: pnSig.status, acao: pnSig.acao, n: pnSig.body?.result?.length, error: pnSig.body?.error };
const pnTx = await call(PN, "getTransaction", [out.sigs[0].sig, { maxSupportedTransactionVersion: 1, commitment: "confirmed", encoding: "json" }], ORIGIN);
out.publicnode.getTransaction = { status: pnTx.status, acao: pnTx.acao, ok: !!pnTx.body?.result, slot: pnTx.body?.result?.slot, error: pnTx.body?.error };
fs.writeFileSync(new URL("./curve-rule-feed-probe.out.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ nSigs: out.sigs.length, errs: out.sigs.filter(x => x.err).length, span: [out.sigs.at(-1).blockTime, out.sigs[0].blockTime], txs: out.txs.map(t => ({ v: t.version, err: t.err, init: t.hasInitialize, ix: t.instructionsLogged })), publicnode: out.publicnode }, null, 1));
