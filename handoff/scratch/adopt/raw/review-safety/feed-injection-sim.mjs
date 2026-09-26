// READ-ONLY probe (review of SPEC N4 / section 4.7): can ANY wallet add a non-launch entry to the
// "launch-only" curve-rule signature feed? Builds unsigned legacy txs that merely mention the SPYx
// curve-rule address, and runs simulateTransaction with sigVerify:false + replaceRecentBlockhash:true.
// Nothing is signed or sent. Payer = the owner's PUBLIC address (simulation only).
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json");
const { PublicKey, Transaction, SystemProgram } = require("@solana/web3.js");
const RPC = "https://api.mainnet-beta.solana.com";
const RULE = new PublicKey("QYZp1YzqEHU67ngXphF9LAkxkxWGvpWEv3rXh4yDbWA");
const PAYER = new PublicKey("3J57tqAJqRmSBn1ZYDu9JpMMyTfBHdcGGwECiPQeiji3");
let last = 0;
async function rpc(method, params) {
  const wait = Math.max(0, last + 700 - Date.now()); if (wait) await new Promise(r => setTimeout(r, wait)); last = Date.now();
  if (method === "simulateTransaction" && params[1]?.sigVerify !== false) throw new Error("sigVerify must be false");
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  return r.json();
}
const out = { probedAt: new Date().toISOString(), rule: RULE.toBase58(), payer: PAYER.toBase58(), cases: {} };
out.ruleOwner = (await rpc("getAccountInfo", [RULE.toBase58(), { encoding: "base64", dataSlice: { offset: 0, length: 0 } }])).result?.value?.owner;
const bh = (await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])).result.value.blockhash;
function wire(ixs) {
  const tx = new Transaction({ feePayer: PAYER, recentBlockhash: bh }); tx.add(...ixs);
  const msg = tx.compileMessage();
  return { b64: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"), keys: msg.accountKeys.map(k => k.toBase58()) };
}
// (a) 1-lamport credit to the rule account (writable)
const a = wire([SystemProgram.transfer({ fromPubkey: PAYER, toPubkey: RULE, lamports: 1 })]);
// (b) rule only as an extra READ-ONLY account on a 0-lamport self-transfer
const ixB = SystemProgram.transfer({ fromPubkey: PAYER, toPubkey: PAYER, lamports: 0 });
ixB.keys.push({ pubkey: RULE, isSigner: false, isWritable: false });
const b = wire([ixB]);
for (const [name, w] of Object.entries({ a_credit_1_lamport: a, b_readonly_mention: b })) {
  const s = await rpc("simulateTransaction", [w.b64, { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed" }]);
  out.cases[name] = { accountKeys: w.keys, ruleInAccountKeys: w.keys.includes(RULE.toBase58()), simErr: s.result?.value ? s.result.value.err : s.error, rpcError: s.error ?? null, unitsConsumed: s.result?.value?.unitsConsumed, logs: s.result?.value?.logs };
}
fs.writeFileSync(new URL("./feed-injection-sim.out.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
