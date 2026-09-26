// Is the sell's extra spend the transaction's, or the wallet's own activity between the reads?
// Simulate the SAME bytes twice back to back, reading the wallet right before each, and compare
// the simulation's own pre (via a no-op-free method: the node's fee field + post) with our pre.
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
import fs from "node:fs";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const [wallet, file] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// rebuild: fetch a fresh quote+swap as live-sim does
const TK = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", MEW = "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5";
const q = { inputMint: MEW, outputMint: USDC, amount: "1000000000", slippageBps: "100", swapMode: "ExactIn", onlyDirectRoutes: "false", restrictIntermediateTokens: "true", maxAccounts: "24", instructionVersion: "V2" };
const quote = await (await fetch(`https://lite-api.jup.ag/swap/v1/quote?${new URLSearchParams(q)}`)).json();
await sleep(1500);
const built = await (await fetch("https://lite-api.jup.ag/swap/v1/swap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
  quoteResponse: quote, userPublicKey: wallet, wrapAndUnwrapSol: false, dynamicComputeUnitLimit: false, useSharedAccounts: true,
  prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 50000, priorityLevel: "veryHigh", global: false } } }) })).json();
for (let i = 0; i < 3; i++) {
  const a = await rpc.call("getBalance", [wallet, { commitment: "processed" }]);
  const sim = await rpc.call("simulateTransaction", [built.swapTransaction, { encoding: "base64", sigVerify: false, replaceRecentBlockhash: false, commitment: "processed", accounts: { encoding: "base64", addresses: [wallet] } }]);
  const b = await rpc.call("getBalance", [wallet, { commitment: "processed" }]);
  console.log(`read before: slot ${a.context.slot} lamports ${a.value} | sim slot ${sim.context.slot} err ${JSON.stringify(sim.value.err)} post ${sim.value.accounts?.[0]?.lamports} | read after: slot ${b.context.slot} lamports ${b.value}`);
  console.log(`   before - simPost = ${a.value - (sim.value.accounts?.[0]?.lamports ?? 0)}; after - simPost = ${b.value - (sim.value.accounts?.[0]?.lamports ?? 0)}`);
  await sleep(2500);
}
