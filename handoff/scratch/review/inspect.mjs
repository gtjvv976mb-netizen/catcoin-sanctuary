import fs from "node:fs";
import { VersionedTransaction } from "@solana/web3.js";
const R = "/home/user/Cat-Intelligence-Agency/";
for (const file of ["fixtures/xstock-pools/jupiter-gldx-swap.json", "fixtures/agent/jupiter-usdc-popcat-swap.json", "fixtures/agent/jupiter-usdc-mew-swap.json", "fixtures/agent/jupiter-usdc-kitty-swap.json"]) {
  const f = JSON.parse(fs.readFileSync(R + file));
  console.log("==", file, Object.keys(f).join(","));
  for (const k of Object.keys(f)) {
    if (f[k]?.routePlan) console.log(" ", k, f[k].routePlan.map((h) => `${h.swapInfo.label}:${h.swapInfo.inputMint.slice(0,4)}->${h.swapInfo.outputMint.slice(0,4)} ${h.bps}`).join(" | "), "impact", f[k].priceImpactPct);
    if (f[k]?.swapTransaction) {
      const tx = VersionedTransaction.deserialize(Buffer.from(f[k].swapTransaction, "base64"));
      const keys = tx.message.staticAccountKeys.map((x) => x.toBase58());
      const ixs = tx.message.compiledInstructions.map((ix) => keys[ix.programIdIndex] ?? `lut#${ix.programIdIndex}`);
      const jup = tx.message.compiledInstructions.find((ix) => keys[ix.programIdIndex] === "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
      console.log(" ", k, "ixs", ixs.map((p) => p.slice(0, 6)).join(","), "jupdisc", Buffer.from(jup.data).subarray(0, 8).toString("hex"), "len", jup.data.length, "tail", Buffer.from(jup.data).subarray(-8).toString("hex"));
    }
  }
}
