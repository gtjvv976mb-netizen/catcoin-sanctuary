// READ-ONLY: creation-tx lookup for a pool, tx index in block, mint metadata layout over 100 SPYx pools,
// and one all-standard-pools getProgramAccounts to size a single-call sweep.
import fs from "node:fs"; import { createRequire } from "node:module";
import { rpc, log, OUT } from "./rpc.mjs";
const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json");
const { PublicKey } = require("@solana/web3.js");
const LL = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj", PLATFORM = "4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7";
const LL_AUTH = "WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh";
const r = {};
process.on("exit", () => fs.writeFileSync(OUT + "_probe-chain2.out.json", JSON.stringify({ r, log }, null, 1)));
const k = (b, o) => new PublicKey(b.subarray(o, o + 32)).toBase58();
// 1. oldest signature of a young adopted pool = its creation
const POOL = "5J2KdXmhTsZYWp4873CpnMetZogdpUsK13ia73rwZQ2G";
const sigs = await rpc("getSignaturesForAddress", [POOL, { limit: 1000, commitment: "finalized" }], { save: "sigs-pool-5J2Kd" });
const oldest = sigs.at(-1);
r.poolHistory = { n: sigs.length, oldest, newest: sigs[0] };
const tx = await rpc("getTransaction", [oldest.signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "finalized" }], { save: "tx-pool-5J2Kd-creation" });
const keys = [...tx.transaction.message.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
r.creationTx = { slot: tx.slot, blockTime: tx.blockTime, version: tx.version, feePayer: keys[0], err: tx.meta.err,
  programs: tx.transaction.message.instructions.map(ix => keys[ix.programIdIndex]), logs: tx.meta.logMessages.filter(l => /Instruction:/.test(l)) };
// 2. position of that tx in its block
const blk = await rpc("getBlock", [tx.slot, { encoding: "json", transactionDetails: "signatures", rewards: false, maxSupportedTransactionVersion: 0, commitment: "finalized" }]);
if (blk && Array.isArray(blk.signatures)) {
  r.block = { slot: tx.slot, blockTime: blk.blockTime, nTx: blk.signatures.length, indexOfCreation: blk.signatures.indexOf(oldest.signature), blockhash: blk.blockhash, bytes: JSON.stringify(blk).length };
  fs.writeFileSync(OUT + "block-" + tx.slot + "-signatures.json", JSON.stringify({ slot: tx.slot, blockTime: blk.blockTime, signatures: blk.signatures }));
} else r.block = blk;
// 3. sanity: does getSignaturesForAddress list same-slot entries in a stable order? (show the slot/sig of the 5 oldest)
r.oldest5 = sigs.slice(-5).map(s => ({ slot: s.slot, sig: s.signature.slice(0, 12), err: !!s.err }));
// 4. 100 SPYx standard pools: read their mints, locate TokenMetadata TLV
const gpa = JSON.parse(fs.readFileSync(OUT + "gpa-spyx-standard-basemints.json", "utf8")).result;
const mints = gpa.slice(0, 100).map(x => k(Buffer.from(x.account.data[0], "base64"), 0));
const accs = await rpc("getMultipleAccounts", [mints, { encoding: "base64", commitment: "finalized" }], { save: "mints-spyx-100" });
const layouts = {}; const sample = []; let updAuthLL = 0, bytesTotal = 0;
accs.value.forEach((a, i) => {
  if (!a) { layouts.missing = (layouts.missing ?? 0) + 1; return; }
  const b = Buffer.from(a.data[0], "base64"); bytesTotal += b.length;
  let o = 166; const tlv = [];
  while (o + 4 <= b.length) { const t = b.readUInt16LE(o), len = b.readUInt16LE(o + 2); if (t === 0) break; tlv.push([t, o, len]); o += 4 + len; }
  const key = tlv.map(([t, off]) => `${t}@${off}`).join(",");
  layouts[key] = (layouts[key] ?? 0) + 1;
  const md = tlv.find(([t]) => t === 19);
  if (md) { const s = md[1] + 4; const ua = k(b, s); const rd = (p) => { const n = b.readUInt32LE(p); return [b.subarray(p + 4, p + 4 + n).toString("utf8"), p + 4 + n]; };
    let [name, p1] = rd(s + 64); let [symbol, p2] = rd(p1); let [uri] = rd(p2);
    if (ua === LL_AUTH) updAuthLL++;
    if (sample.length < 8) sample.push({ mint: mints[i], size: b.length, name, symbol, uri, nameLenOffset: s + 64 });
    else if (/cat|kitty|meow/i.test(name)) sample.push({ mint: mints[i], name, symbol, uri });
  }
});
r.mintLayouts = { n: accs.value.length, layouts, updateAuthorityIsLaunchLab: updAuthLL, avgBytes: Math.round(bytesTotal / accs.value.length), sample };
// 5. one call for every StonkFun-standard pool (base + quote slice) to size a single sweep
const t0 = Date.now();
const all = await rpc("getProgramAccounts", [LL, { encoding: "base64", commitment: "finalized", dataSlice: { offset: 205, length: 64 },
  filters: [{ dataSize: 429 }, { memcmp: { offset: 173, bytes: PLATFORM } }] }]);
if (Array.isArray(all)) {
  const byQuote = {}; for (const x of all) { const q = k(Buffer.from(x.account.data[0], "base64"), 32); byQuote[q] = (byQuote[q] ?? 0) + 1; }
  r.gpaAllStandard = { count: all.length, ms: Date.now() - t0, distinctQuotes: Object.keys(byQuote).length, top: Object.entries(byQuote).sort((a, b) => b[1] - a[1]).slice(0, 12), bytesJson: JSON.stringify(all).length };
  fs.writeFileSync(OUT + "gpa-all-standard-byquote.json", JSON.stringify(byQuote));
} else r.gpaAllStandard = { error: all, ms: Date.now() - t0 };
console.log(JSON.stringify(r, null, 1));
