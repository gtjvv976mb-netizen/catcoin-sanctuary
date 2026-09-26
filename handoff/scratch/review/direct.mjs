/* Live probe of DIRECT routes (the xStock venue's ask, and the agent's old ask) through the
   changed checkSwapTransaction, with Jupiter's default build and with shared accounts forced. */
import fs from "node:fs";
import { createJupiterClient, checkQuote, checkSwapTransaction, loadLookupTables, lookupTableKeysOf } from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
const T = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const jup = createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_300 });
const wallet = process.env.WALLET ?? "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
const FX = JSON.parse(fs.readFileSync("/home/user/Cat-Intelligence-Agency/fixtures/xstock-pools/jupiter-gldx-swap.json"));
const cases = JSON.parse(process.env.CASES ?? "null") ?? [
  { name: "USDC>POPCAT direct", inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", outputMint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", inP: T, outP: T, amountRaw: "25000000", slip: 100 },
  { name: "GLDx>token direct (xStock fixture pair)", inputMint: FX.stockMint, outputMint: FX.tokenMint, inP: T22, outP: T22, amountRaw: "1000000", slip: 300 },
];
async function run(c, shared) {
  const row = { case: c.name, forceShared: shared };
  try {
    const raw = await jup.quote({ inputMint: c.inputMint, outputMint: c.outputMint, amountRaw: c.amountRaw, slippageBps: c.slip, priority: "live" });
    row.route = raw.routePlan.map((h) => `${h.swapInfo.label}@${h.bps}`).join("|");
    checkQuote(raw, { inputMint: c.inputMint, outputMint: c.outputMint, amountRaw: c.amountRaw, slippageBps: c.slip, slippageCapBps: c.slip, maxPriceImpactPct: 100 });
    const built = await jup.swapTransaction({ quote: raw, wallet, priorityFeeLamports: 50_000, priority: "live", sharedAccounts: shared });
    const tables = await loadLookupTables(rpc, lookupTableKeysOf(built.swapTransaction));
    const checked = checkSwapTransaction({ txBase64: built.swapTransaction, wallet, inputMint: c.inputMint, outputMint: c.outputMint, inputProgram: c.inP, outputProgram: c.outP, amountRaw: c.amountRaw, quote: raw, slippageCapBps: c.slip, lookupTables: tables, maxPriorityFeeLamports: 50_000 });
    row.variant = checked.route.name; row.id = checked.route.id; row.steps = checked.route.routeSteps; row.last = checked.route.lastStep; row.result = "passed";
  } catch (e) { row.result = `${e.clause ?? e.code ?? e.name}: ${e.message}`; }
  console.log(JSON.stringify(row));
}
for (const c of cases) { await run(c, false); await run(c, true); }
