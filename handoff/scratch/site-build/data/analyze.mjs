import fs from "node:fs";
import { createRequire } from "node:module"; const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json"); const bs58 = require("bs58");
const txs = JSON.parse(fs.readFileSync("raw-txs.json", "utf8"));
for (const t of txs) {
  const r = t.result; const m = r.transaction.message;
  const keys = [...m.accountKeys, ...(r.meta.loadedAddresses?.writable ?? []), ...(r.meta.loadedAddresses?.readonly ?? [])];
  console.log("\n==", t.kind, t.signature.slice(0, 10), "v", r.version, "header", JSON.stringify(m.header), "static", m.accountKeys.length, "loaded", JSON.stringify(r.meta.loadedAddresses ? [r.meta.loadedAddresses.writable.length, r.meta.loadedAddresses.readonly.length] : null), "ALT", JSON.stringify(m.addressTableLookups ?? null));
  console.log(" feePayer", m.accountKeys[0], "sigs", r.transaction.signatures.length, "fee", r.meta.fee, "blockTime", r.blockTime, "slot", r.slot);
  m.instructions.forEach((ix, i) => {
    const d = Buffer.from(bs58.decode(ix.data));
    console.log(`  ix${i} prog=${keys[ix.programIdIndex]} accts=${ix.accounts.length} data=${d.subarray(0, 8).toString("hex")} len=${d.length} stackHeight=${ix.stackHeight}`);
  });
  for (const inner of r.meta.innerInstructions) {
    console.log(`  inner of ix${inner.index}: ` + inner.instructions.map((ix) => keys[ix.programIdIndex].slice(0, 6) + ":" + Buffer.from(bs58.decode(ix.data)).subarray(0, 8).toString("hex")).join(" "));
  }
  console.log("  logs:", r.meta.logMessages.filter((l) => /Instruction:/.test(l)).join(" | "));
}
