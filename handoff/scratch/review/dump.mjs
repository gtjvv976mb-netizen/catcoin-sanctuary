import fs from "node:fs";
import { VersionedTransaction, TransactionMessage } from "@solana/web3.js";
import { createJupiterClient, loadLookupTables, lookupTableKeysOf, JUPITER_PROGRAM } from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const jup = createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_300 });
const FX = JSON.parse(fs.readFileSync("/home/user/Cat-Intelligence-Agency/fixtures/xstock-pools/jupiter-gldx-swap.json"));
const wallet = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
const [inputMint, outputMint, amountRaw] = [process.env.IN ?? FX.stockMint, process.env.OUT ?? FX.tokenMint, process.env.AMT ?? "1000000"];
const raw = await jup.quote({ inputMint, outputMint, amountRaw, slippageBps: 300, priority: "live" });
const built = await jup.swapTransaction({ quote: raw, wallet, priorityFeeLamports: 50_000, priority: "live", sharedAccounts: true });
fs.writeFileSync("dump-shared-" + (process.env.TAG ?? "gldx") + ".json", JSON.stringify({ capturedAt: new Date().toISOString(), quote: raw, swap: built }, null, 1));
const tables = await loadLookupTables(rpc, lookupTableKeysOf(built.swapTransaction));
const tx = VersionedTransaction.deserialize(Buffer.from(built.swapTransaction, "base64"));
const msg = TransactionMessage.decompile(tx.message, { addressLookupTableAccounts: [...tables.values()] });
for (const ix of msg.instructions) {
  console.log(ix.programId.toBase58(), Buffer.from(ix.data).toString("hex").slice(0, 80));
  if (ix.programId.toBase58() === JUPITER_PROGRAM) ix.keys.forEach((k, i) => console.log("  ", i, k.pubkey.toBase58(), k.isSigner ? "S" : "-", k.isWritable ? "W" : "-"));
}
