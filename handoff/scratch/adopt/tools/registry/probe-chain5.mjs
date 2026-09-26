// READ-ONLY: is PoolState.epoch the creation epoch or the last-trade epoch?
// Take pools whose epoch field is old (1033) and see whether they traded in the current epoch.
import fs from "node:fs"; import { createRequire } from "node:module";
import { rpc, log, OUT } from "./rpc.mjs";
const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json");
const bs58 = require("bs58");
const LL = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj", PLATFORM = "4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7";
const r = {};
process.on("exit", () => fs.writeFileSync(OUT + "_probe-chain5.out.json", JSON.stringify({ r, log }, null, 1)));
const le8 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return bs58.encode(b); };
const EPOCH_LEN = 432000;
for (const ep of [1033, 1040]) {
  // real_quote (offset 61) lets us pick pools that have been bought into
  const g = await rpc("getProgramAccounts", [LL, { encoding: "base64", commitment: "finalized", dataSlice: { offset: 53, length: 16 },
    filters: [{ dataSize: 429 }, { memcmp: { offset: 173, bytes: PLATFORM } }, { memcmp: { offset: 8, bytes: le8(ep) } }] }]);
  if (!Array.isArray(g)) { r[ep] = { error: g }; continue; }
  const traded = g.map(x => ({ pool: x.pubkey, realQuote: Buffer.from(x.account.data[0], "base64").readBigUInt64LE(8) })).filter(x => x.realQuote > 0n)
    .sort((a, b) => (b.realQuote > a.realQuote ? 1 : -1)).slice(0, 6);
  const rows = [];
  for (const p of traded) {
    const s = await rpc("getSignaturesForAddress", [p.pool, { limit: 1, commitment: "finalized" }]);
    const newest = Array.isArray(s) && s[0] ? { slot: s[0].slot, epoch: Math.floor(s[0].slot / EPOCH_LEN), blockTime: new Date(s[0].blockTime * 1000).toISOString(), err: !!s[0].err } : s;
    rows.push({ pool: p.pool, realQuote: p.realQuote.toString(), newest });
  }
  r[ep] = { poolsWithThisEpoch: g.length, sample: rows };
}
console.log(JSON.stringify(r, null, 1));
