// READ-ONLY: (1) is PoolState.epoch a usable "new pools" filter? (2) can a Token-2022 getProgramAccounts find a mint by its metadata URI?
import fs from "node:fs"; import { createRequire } from "node:module";
import { rpc, log, OUT } from "./rpc.mjs";
const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json");
const { PublicKey } = require("@solana/web3.js"); const bs58 = require("bs58");
const LL = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj", PLATFORM = "4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7";
const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const r = {};
process.on("exit", () => fs.writeFileSync(OUT + "_probe-chain4.out.json", JSON.stringify({ r, log }, null, 1)));
const k = (b, o) => new PublicKey(b.subarray(o, o + 32)).toBase58();
const le8 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return bs58.encode(b); };
const slot = await rpc("getSlot", [{ commitment: "finalized" }]);
r.slot = slot; r.epochFromSlot = Math.floor(slot / 432000); r.slotInEpoch = slot % 432000;
// (1) epoch histogram over all StonkFun-standard pools (8 bytes each)
let t0 = Date.now();
const all = await rpc("getProgramAccounts", [LL, { encoding: "base64", commitment: "finalized", dataSlice: { offset: 8, length: 8 },
  filters: [{ dataSize: 429 }, { memcmp: { offset: 173, bytes: PLATFORM } }] }]);
if (Array.isArray(all)) {
  const h = {}; for (const x of all) { const e = Buffer.from(x.account.data[0], "base64").readBigUInt64LE(0).toString(); h[e] = (h[e] ?? 0) + 1; }
  r.epochHistogram = { count: all.length, ms: Date.now() - t0, byEpoch: Object.entries(h).sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, 25), distinct: Object.keys(h).length };
} else r.epochHistogram = { error: all };
// (1b) the same sweep narrowed to the current epoch, base+quote+creator only
t0 = Date.now();
const cur = await rpc("getProgramAccounts", [LL, { encoding: "base64", commitment: "finalized", dataSlice: { offset: 205, length: 160 },
  filters: [{ dataSize: 429 }, { memcmp: { offset: 173, bytes: PLATFORM } }, { memcmp: { offset: 8, bytes: le8(r.epochFromSlot) } }] }], { save: "gpa-standard-current-epoch" });
r.currentEpochSweep = Array.isArray(cur) ? { count: cur.length, ms: Date.now() - t0, bytes: JSON.stringify(cur).length,
  sample: cur.slice(0, 3).map(x => { const b = Buffer.from(x.account.data[0], "base64"); return { pool: x.pubkey, baseMint: k(b, 0), quote: k(b, 32), creator: k(b, 128) }; }) } : { error: cur, ms: Date.now() - t0 };
// (2) Token-2022 scan by metadata: name "test" at 306, uri at 314+4+6 for the known NONSOL mint
const uri = "https://gateway.irys.xyz/5mEHd2DkHhiqL9cEX5CEj5HszoxCKQhFF6aCdUXAsGDF";
t0 = Date.now();
const md = await rpc("getProgramAccounts", [T22, { encoding: "base64", commitment: "confirmed", dataSlice: { offset: 0, length: 0 },
  filters: [{ memcmp: { offset: 234, bytes: bs58.encode(Buffer.from([19, 0])) } }, { memcmp: { offset: 306, bytes: bs58.encode(Buffer.from("test")) } }, { memcmp: { offset: 324, bytes: bs58.encode(Buffer.from(uri)) } }] }]);
r.token2022MetadataScan = Array.isArray(md) ? { count: md.length, ms: Date.now() - t0, pubkeys: md.map(x => x.pubkey) } : { error: md, ms: Date.now() - t0 };
console.log(JSON.stringify(r, null, 1));
