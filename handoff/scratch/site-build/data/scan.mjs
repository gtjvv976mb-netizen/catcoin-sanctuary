import fs from "node:fs";
import { createRequire } from "node:module"; const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json"); const bs58 = require("bs58");
const url = "https://api.mainnet-beta.solana.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rpc = async (method, params) => { for (let a = 0; a < 5; a++) { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); if (r.status === 429) { await sleep(2000 * (a + 1)); continue; } const j = await r.json(); if (j.error) { if (j.error.code === 429 || /too many/i.test(j.error.message)) { await sleep(2000 * (a + 1)); continue; } throw new Error(JSON.stringify(j.error)); } return j.result; } throw new Error("429 x5"); };
const XS = new Set(JSON.parse(fs.readFileSync("/home/user/Cat-Intelligence-Agency/fixtures/bots/stonkfun/2026-09-25/xstocks-official-24.json","utf8")).products.map(p => p.addresses?.solana ?? Object.values(p.addresses)[0]));
console.log("xstocks", XS.size);
const LL = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
const platform = process.argv[2]; const n = Number(process.argv[3] ?? 150);
const sigs = await rpc("getSignaturesForAddress", [platform, { limit: 1000 }]);
console.log("sigs", sigs.length, sigs[0]?.blockTime, sigs.at(-1)?.blockTime);
const tally = {}; const keep = [];
let seen = 0;
for (const s of sigs) {
  if (seen >= n) break;
  if (s.err) { tally.failed = (tally.failed ?? 0) + 1; continue; }
  seen++;
  let r; try { r = await rpc("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]); } catch (e) { if (!/-32015/.test(e.message)) throw e; r = await rpc("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 1, commitment: "confirmed" }]); if (!globalThis.v1) { globalThis.v1 = r; fs.writeFileSync("v1-sample.json", JSON.stringify({ signature: s.signature, r }, null, 1)); } }
  await sleep(250);
  if (!r) continue;
  const m = r.transaction.message;
  const keys = [...m.accountKeys, ...(r.meta.loadedAddresses?.writable ?? []), ...(r.meta.loadedAddresses?.readonly ?? [])];
  const top = m.instructions.map((ix) => { const d = Buffer.from(bs58.decode(ix.data)); return { prog: keys[ix.programIdIndex], disc: d.subarray(0, 8).toString("hex"), accts: ix.accounts.map((i) => keys[i]) }; });
  const inits = top.filter((t) => t.prog === LL && ["25be7ede2c9aab11", "afaf6d1f0d989bed", "4399af27da102620"].includes(t.disc));
  const innerInit = r.meta.innerInstructions.some((g) => g.instructions.some((ix) => keys[ix.programIdIndex] === LL && ["25be7ede2c9aab11", "afaf6d1f0d989bed", "4399af27da102620"].includes(Buffer.from(bs58.decode(ix.data)).subarray(0, 8).toString("hex"))));
  const shape = `v${r.version} alt=${(m.addressTableLookups ?? []).length > 0} ` + top.map((t) => (t.prog === LL ? "LL:" + t.disc.slice(0, 6) : t.prog.slice(0, 6) + (t.prog.startsWith("Compute") ? "" : ":" + t.disc.slice(0, 4)))).join(" ") + (innerInit ? " [CPI-init]" : "");
  const xq = inits.length ? XS.has(inits[0].accts[7]) : false;
  const key = (inits.length ? "init " : "other ") + (xq ? "XSTOCK " : "") + shape;
  tally[key] = (tally[key] ?? 0) + 1;
  if (xq || innerInit) keep.push({ signature: s.signature, shape, quote: inits[0]?.accts[7], payer: m.accountKeys[0], creator: inits[0]?.accts[1] });
}
console.log(JSON.stringify(tally, null, 1));
console.log(JSON.stringify(keep, null, 1));
fs.writeFileSync(`scan-${platform.slice(0, 6)}.json`, JSON.stringify({ tally, keep }, null, 1));
