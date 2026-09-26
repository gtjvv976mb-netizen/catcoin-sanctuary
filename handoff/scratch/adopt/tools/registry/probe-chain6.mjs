// READ-ONLY: pools whose epoch field is 1041 and that are still on the curve (status 0): did any trade succeed in epoch 1042?
import fs from "node:fs"; import { createRequire } from "node:module";
import { rpc, log, OUT } from "./rpc.mjs";
const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json");
const bs58 = require("bs58");
const LL = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj", PLATFORM = "4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7";
const r = {};
process.on("exit", () => fs.writeFileSync(OUT + "_probe-chain6.out.json", JSON.stringify({ r, log }, null, 1)));
const le8 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return bs58.encode(b); };
const EPOCH_LEN = 432000;
const g = await rpc("getProgramAccounts", [LL, { encoding: "base64", commitment: "finalized", dataSlice: { offset: 17, length: 52 },
  filters: [{ dataSize: 429 }, { memcmp: { offset: 173, bytes: PLATFORM } }, { memcmp: { offset: 8, bytes: le8(1041) } }, { memcmp: { offset: 17, bytes: bs58.encode(Buffer.from([0])) } }] }]);
const pools = g.map(x => { const b = Buffer.from(x.account.data[0], "base64"); return { pool: x.pubkey, status: b[0], realQuote: b.readBigUInt64LE(61 - 17) }; })
  .filter(x => x.realQuote > 0n).sort((a, b) => (b.realQuote > a.realQuote ? 1 : -1));
r.count = { status0_epoch1041: g.length, withQuote: pools.length };
const rows = [];
for (const p of pools.slice(0, 10)) {
  const s = await rpc("getSignaturesForAddress", [p.pool, { limit: 50, commitment: "finalized" }]);
  const ok = Array.isArray(s) ? s.find(x => !x.err) : null;
  rows.push({ pool: p.pool, realQuote: p.realQuote.toString(), newestAny: s?.[0] ? { slot: s[0].slot, epoch: Math.floor(s[0].slot / EPOCH_LEN) } : null,
    newestOk: ok ? { slot: ok.slot, epoch: Math.floor(ok.slot / EPOCH_LEN), sig: ok.signature, blockTime: new Date(ok.blockTime * 1000).toISOString() } : null });
}
r.rows = rows;
// re-read the one with the newest successful activity, full account, to see its epoch field now
const best = rows.filter(x => x.newestOk).sort((a, b) => b.newestOk.slot - a.newestOk.slot)[0];
if (best) {
  const a = await rpc("getAccountInfo", [best.pool, { encoding: "base64", commitment: "finalized" }], { save: "pool-epoch-check" });
  const b = Buffer.from(a.value.data[0], "base64");
  r.recheck = { pool: best.pool, epochFieldNow: b.readBigUInt64LE(8).toString(), status: b[17], newestOk: best.newestOk };
  const tx = await rpc("getTransaction", [best.newestOk.sig, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "finalized" }]);
  r.recheck.newestOkLogs = tx?.meta?.logMessages?.filter(l => /Instruction:/.test(l)).slice(0, 8) ?? tx;
}
console.log(JSON.stringify(r, null, 1));
