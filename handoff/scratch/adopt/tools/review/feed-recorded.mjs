// REVIEW PROBE (read-only): sample recent launches from StonkFun curve-rule feeds of several stocks,
// classify each creation tx (dev buy or not, wrapper shape, fee payer == creator), and ask StonkFun
// whether it recorded each (/tokens/{mint}, /launches?creator=). Also: does publicnode return transactionIndex?
// Methods: getSignaturesForAddress, getTransaction. Nothing signed or sent.
import fs from "node:fs";
const PUBLIC = "https://api.mainnet-beta.solana.com", PN = "https://solana-rpc.publicnode.com";
let last = 0;
async function call(url, method, params, origin) {
  if (!["getSignaturesForAddress","getTransaction"].includes(method)) throw new Error("guard");
  for (let a = 0; a < 5; a++) {
    const w = Math.max(0, last + 700 - Date.now()); if (w) await new Promise(r => setTimeout(r, w)); last = Date.now();
    const headers = { "content-type": "application/json" }; if (origin) headers.Origin = origin;
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (r.status === 429) { await new Promise(r => setTimeout(r, 4000)); continue; }
    return await r.json();
  }
}
let lastApi = 0;
async function api(p) { const w = Math.max(0, lastApi + 400 - Date.now()); if (w) await new Promise(r => setTimeout(r, w)); lastApi = Date.now();
  const r = await fetch("https://www.stonkfun.xyz/api/public/v1" + p); return { status: r.status, body: await r.json().catch(() => null) }; }
const v91 = JSON.parse(fs.readFileSync(new URL("../../raw/review/verify-91.out.json", import.meta.url)));
const pick = ["SPYx", "NVDAx", "TSLAx", "OPENAI", "ANTHROPIC", "MU", "COIN", "HOOD"];
const rules = v91.rows.filter(r => r.pricing && pick.includes(r.stock)).map(r => ({ stock: r.stock, rule: r.pricing.rule }));
const out = { probedAt: new Date().toISOString(), rules, pnTxIndex: null, launches: [] };
const pn = await call(PN, "getSignaturesForAddress", [rules[0].rule, { limit: 5 }], "https://catcoinsanctuary.com");
out.pnTxIndex = (pn.result || []).map(x => ({ slot: x.slot, transactionIndex: x.transactionIndex, keys: Object.keys(x) }));
const LL = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
for (const { stock, rule } of rules) {
  const s = await call(PUBLIC, "getSignaturesForAddress", [rule, { limit: 12, commitment: "finalized" }]);
  for (const x of (s.result || []).filter(x => !x.err)) {
    const t = await call(PUBLIC, "getTransaction", [x.signature, { maxSupportedTransactionVersion: 1, commitment: "finalized", encoding: "jsonParsed" }]);
    const tx = t?.result; if (!tx) continue;
    const logs = tx.meta?.logMessages || [];
    const ixNames = logs.filter(l => l.startsWith("Program log: Instruction: ")).map(l => l.slice(26));
    const keys = tx.transaction.message.accountKeys.map(k => k.pubkey ?? k);
    const top = tx.transaction.message.instructions.map(i => i.programId);
    // find the init ix (top-level or inner) to get mint (#6) and creator (#1)
    let init = tx.transaction.message.instructions.find(i => i.programId === LL && i.accounts && i.accounts.length >= 16);
    if (!init) for (const inner of tx.meta?.innerInstructions || []) { const f = inner.instructions.find(i => i.programId === LL && i.accounts && i.accounts.length >= 16); if (f) { init = f; break; } }
    const mint = init?.accounts?.[6], creator = init?.accounts?.[1], pool = init?.accounts?.[5];
    const cb = tx.transaction.message.instructions.filter(i => i.programId === "ComputeBudget111111111111111111111111111111").map(i => i.data);
    out.launches.push({ stock, sig: x.signature, slot: x.slot, blockTime: x.blockTime, version: tx.version, feePayer: keys[0], creator, mint, pool, payerIsCreator: keys[0] === creator,
      hasBuy: ixNames.some(n => /Buy/i.test(n)), ixNames: ixNames.slice(0, 10), topPrograms: top, computeBudgetData: cb, numSigners: tx.transaction.signatures.length, fee: tx.meta.fee });
  }
}
for (const l of out.launches) {
  if (!l.mint) continue;
  const tk = await api(`/tokens/${l.mint}`);
  l.stonkfun = { status: tk.status, launchpad: tk.body?.data?.token?.launchpad, mode: tk.body?.data?.token?.mode, launchCreatedAt: tk.body?.data?.launch?.createdAt, tokenCreatedAt: tk.body?.data?.token?.createdAt, links: tk.body?.data?.token?.links, imageUrl: tk.body?.data?.token?.imageUrl };
  if (l.stonkfun.launchCreatedAt && l.blockTime) l.stonkfun.launchLagSec = Math.round(Date.parse(l.stonkfun.launchCreatedAt) / 1000 - l.blockTime);
  console.error(l.stock, l.sig.slice(0, 8), l.hasBuy, l.payerIsCreator, tk.status, l.stonkfun.launchLagSec);
}
fs.writeFileSync(new URL("../../raw/review/feed-recorded.out.json", import.meta.url), JSON.stringify(out, null, 1));
const s = out.launches;
console.log(JSON.stringify({ pnTxIndex: out.pnTxIndex.slice(0, 2), n: s.length,
  noBuy: s.filter(x => !x.hasBuy).map(x => ({ stock: x.stock, sig: x.sig.slice(0, 10), rec: x.stonkfun?.status, lag: x.stonkfun?.launchLagSec, cb: x.computeBudgetData, ix: x.ixNames, v: x.version })),
  recorded: s.filter(x => x.stonkfun?.status === 200).length, notRecorded: s.filter(x => x.stonkfun?.status !== 200).map(x => ({ stock: x.stock, sig: x.sig.slice(0, 10), st: x.stonkfun?.status, buy: x.hasBuy, age: Math.round(Date.now() / 1000 - x.blockTime) })),
  payerNeCreator: s.filter(x => !x.payerIsCreator).length, lags: s.filter(x => x.stonkfun?.launchLagSec != null).map(x => x.stonkfun.launchLagSec) }, null, 1));
