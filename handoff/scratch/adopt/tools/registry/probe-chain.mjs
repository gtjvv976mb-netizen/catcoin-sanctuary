// READ-ONLY on-chain probes for the adoption registry design.
import fs from "node:fs"; import { createRequire } from "node:module";
import { rpc, log, OUT } from "./rpc.mjs";
const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json");
const { PublicKey } = require("@solana/web3.js");
const LL = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
const PLATFORM = "4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7";
const SPYX = "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W";
const r = {};
process.on("exit", () => fs.writeFileSync(OUT + "_probe-chain.out.json", JSON.stringify({ r, log }, null, 1)));
const k = (b, o) => new PublicKey(b.subarray(o, o + 32)).toBase58();
// 1. decode a known pool (DQVN "test"/NONSOL on SPYx)
const POOL = "5J2KdXmhTsZYWp4873CpnMetZogdpUsK13ia73rwZQ2G";
const a = await rpc("getAccountInfo", [POOL, { encoding: "base64", commitment: "confirmed" }], { save: "pool-5J2Kd-account" });
const b = Buffer.from(a.value.data[0], "base64");
r.pool = { size: b.length, owner: a.value.owner, globalConfig: k(b, 141), platformConfig: k(b, 173), baseMint: k(b, 205), quoteMint: k(b, 237), creator: k(b, 333), status: b[17], supply: b.readBigUInt64LE(21).toString() };
// 2. getProgramAccounts: StonkFun-standard pools priced in SPYx, base mint only
let t0 = Date.now();
const g = await rpc("getProgramAccounts", [LL, { encoding: "base64", commitment: "confirmed", dataSlice: { offset: 205, length: 32 },
  filters: [{ dataSize: 429 }, { memcmp: { offset: 237, bytes: SPYX } }, { memcmp: { offset: 173, bytes: PLATFORM } }] }], { save: "gpa-spyx-standard-basemints" });
r.gpaSpyx = Array.isArray(g) ? { count: g.length, ms: Date.now() - t0, sample: g.slice(0, 2).map(x => ({ pool: x.pubkey, baseMint: k(Buffer.from(x.account.data[0], "base64"), 0) })) } : { error: g, ms: Date.now() - t0 };
// 2b. the same for a Backpack stock (MU) and a prestock (ANTHROPIC)
for (const [sym, mint] of [["MU", "MUxEsUKSMACyw5fZf68wxf5FLnZVhtU9CwH8uNNGay1"], ["ANTHROPIC", "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw"], ["TSLAx", "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB"]]) {
  t0 = Date.now();
  const x = await rpc("getProgramAccounts", [LL, { encoding: "base64", commitment: "confirmed", dataSlice: { offset: 205, length: 32 },
    filters: [{ dataSize: 429 }, { memcmp: { offset: 237, bytes: mint } }, { memcmp: { offset: 173, bytes: PLATFORM } }] }], { save: `gpa-${sym}-standard-basemints` });
  r["gpa" + sym] = Array.isArray(x) ? { count: x.length, ms: Date.now() - t0 } : { error: x, ms: Date.now() - t0 };
}
// 3. platform config history rate (read-only account in every initialize, and in buys?)
t0 = Date.now();
const sigs = await rpc("getSignaturesForAddress", [PLATFORM, { limit: 1000, commitment: "confirmed" }], { save: "sigs-platform-1000" });
if (Array.isArray(sigs)) {
  const times = sigs.map(s => s.blockTime).filter(Boolean);
  r.platformSigs = { n: sigs.length, newest: new Date(Math.max(...times) * 1000).toISOString(), oldest: new Date(Math.min(...times) * 1000).toISOString(), spanSec: Math.max(...times) - Math.min(...times), failed: sigs.filter(s => s.err).length, slotsDistinct: new Set(sigs.map(s => s.slot)).size, ms: Date.now() - t0 };
  // look at 4 of them: which instruction kinds touch the platform config?
  const kinds = {};
  for (const s of sigs.filter(s => !s.err).slice(0, 6)) {
    const tx = await rpc("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
    if (!tx || !tx.transaction) { kinds[s.signature.slice(0, 10)] = { error: tx }; continue; }
    const msg = tx.transaction.message; const keys = [...msg.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
    const ll = [...msg.instructions, ...(tx.meta.innerInstructions ?? []).flatMap(x => x.instructions)].filter(ix => keys[ix.programIdIndex] === LL);
    const bs58 = require("bs58"); const discs = ll.map(ix => Buffer.from(bs58.decode(ix.data)).subarray(0, 8).toString("hex"));
    const logs = (tx.meta.logMessages ?? []).filter(l => /Program log: Instruction:/.test(l));
    kinds[s.signature.slice(0, 10)] = { discs, logs: logs.slice(0, 6) };
  }
  r.platformSigKinds = kinds;
} else r.platformSigs = sigs;
fs.writeFileSync(OUT + "_probe-chain.out.json", JSON.stringify({ r, log }, null, 1));
console.log(JSON.stringify(r, null, 1));
