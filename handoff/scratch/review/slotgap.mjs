import fs from "node:fs";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
const fx = JSON.parse(fs.readFileSync("/home/user/Cat-Intelligence-Agency/fixtures/agent/jupiter-usdc-mew-swap.json", "utf8"));
const tx = fx.swapBuy?.swapTransaction;
const wallet = fx.user;
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let differ = 0, n = 15;
for (let i = 0; i < n; i++) {
  const pre = await rpc.getMultipleAccounts([wallet]);
  const raw = await rpc.call("simulateTransaction", [tx, { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "processed", accounts: { encoding: "base64", addresses: [wallet] } }]);
  const wrapped = await rpc.simulateTransaction(tx, { addresses: [wallet] }).catch((e) => ({ error: e.message }));
  console.log(`read slot ${pre.slot}  sim slot ${raw?.context?.slot}  ${pre.slot === raw?.context?.slot ? "same" : "DIFFERENT"}  | rpc.mjs wrapper returns context? ${"context" in (wrapped ?? {})}`);
  if (pre.slot !== raw?.context?.slot) differ++;
  await sleep(1100);
}
console.log(`${differ}/${n} read/simulate pairs at different slots (${new Date().toISOString()})`);
