/* Live probe: the agent's exact ask, build and check, simulated on mainnet for a real funded
   wallet (read only, nothing signed). Replicates agent-runner.mjs swap() after the quote. */
import {
  createJupiterClient, checkQuote, checkSwapTransaction, loadLookupTables, lookupTableKeysOf, checkWritableCustody, checkSafeAfter,
  checkRouteMints, checkIntermediateLeft, checkNativeSpend, tokenAccountDetails,
} from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
import { associatedTokenAddress } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";

const T = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const TOK = { MEW: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", POPCAT: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", KITTY: "4N4DnNo3qpPks9aQCkcWkzoir8tnvT6diS4TnnZibonk", GRUMPY: "GRUmPYbiTpq9ZPy5LAqBMMze7kErf5dEX2i9qYfwoSmR" };
const wallet = process.env.WALLET ?? "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const jup = createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_300 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cases = (process.env.CASES ?? "USDC:POPCAT:buy,USDC:MEW:buy,USDC:MEW:sell,USDC:POPCAT:sell,USDT:POPCAT:buy,USDC:KITTY:buy").split(",");
const solHopEnv = process.env.DIRECT === "1" ? false : true;
const out = [];
for (const c of cases) {
  const [sym, tok, side] = c.split(":");
  const s = sym === "USDC" ? USDC : USDT, t = TOK[tok];
  const inputMint = side === "buy" ? s : t, outputMint = side === "buy" ? t : s;
  const amountRaw = side === "buy" ? "25000000" : (process.env[`SELL_${tok}`] ?? { MEW: "2000000000", POPCAT: "100000000000" }[tok]);
  const row = { case: c, solHop: solHopEnv };
  try {
    const raw = await jup.quote({ inputMint, outputMint, amountRaw, slippageBps: 100, priority: "live", solHop: solHopEnv });
    row.route = raw.routePlan.map((h) => `${h.swapInfo.label}:${h.swapInfo.inputMint.slice(0, 4)}>${h.swapInfo.outputMint.slice(0, 4)}@${h.bps}`).join(" | ");
    row.impact = raw.priceImpactPct;
    const q = checkQuote(raw, { inputMint, outputMint, amountRaw, slippageBps: 100, slippageCapBps: 100, maxPriceImpactPct: side === "buy" ? 2 : 100, solHop: true });
    const built = await jup.swapTransaction({ quote: raw, wallet, priorityFeeLamports: 50_000, priority: "live", sharedAccounts: q.intermediate !== null });
    const txBase64 = built.swapTransaction;
    const tables = await loadLookupTables(rpc, lookupTableKeysOf(txBase64));
    const pairs = new Set([`${s}>${t}`, `${t}>${s}`]);
    const checked = checkSwapTransaction({ txBase64, wallet, inputMint, outputMint, inputProgram: T, outputProgram: T, amountRaw, quote: raw, slippageCapBps: 100, lookupTables: tables, maxPriorityFeeLamports: 50_000, allowedPairs: pairs, solHop: true });
    row.variant = checked.route.name; row.id = checked.route.id; row.steps = checked.route.routeSteps; row.last = checked.route.lastStep; row.prio = String(checked.priorityFeeLamports); row.cu = checked.computeUnitLimit;
    const tokenAta = associatedTokenAddress(wallet, t, T), settlementAta = associatedTokenAddress(wallet, s, T);
    const writable = await rpc.getMultipleAccounts(checked.writableAddresses);
    checkWritableCustody({ wallet, writableAddresses: checked.writableAddresses, accounts: writable.accounts ?? [], allowed: [settlementAta, tokenAta] });
    if (checked.intermediate) checkRouteMints({ writableAddresses: checked.writableAddresses, accounts: writable.accounts ?? [], mints: [s, checked.intermediate, t] });
    const addresses = [wallet, tokenAta, settlementAta, checked.walletIntermediateAta];
    const pre = await rpc.getMultipleAccounts(addresses);
    const sim = await rpc.simulateTransaction(txBase64, { addresses });
    if (sim?.err) { row.simErr = JSON.stringify(sim.err); row.logs = (sim.logs ?? []).slice(-4); out.push(row); console.log(JSON.stringify(row)); continue; }
    const post = sim.accounts;
    const spend = BigInt(pre.accounts[0].lamports) - BigInt(post[0].lamports);
    const amt = (a, m) => (a ? tokenAccountDetails(a)?.amount ?? 0n : 0n);
    row.spend = String(spend); row.unitsConsumed = sim.unitsConsumed;
    row.tokenDelta = String(amt(post[1]) - amt(pre.accounts[1])); row.settlementDelta = String(amt(post[2]) - amt(pre.accounts[2]));
    row.minOut = String(q.minOutRaw);
    try { checkIntermediateLeft({ address: checked.walletIntermediateAta, before: pre.accounts[3] ?? null, after: post[3] ?? null }); row.intermediateLeft = "ok"; } catch (e) { row.intermediateLeft = `${e.clause}: ${e.message}`; }
    const rentLamports = [1, 2].reduce((sum, i) => (!pre.accounts[i] && post[i] ? sum + BigInt(post[i].lamports ?? 0) : sum), 0n);
    row.rent = String(rentLamports);
    try { checkNativeSpend({ spentLamports: spend, signatures: checked.signatures, priorityFeeLamports: checked.priorityFeeLamports, rentLamports }); row.nativeSpend = "ok"; } catch (e) { row.nativeSpend = `${e.clause}: ${e.message}`; }
    try { checkSafeAfter(post[1], { wallet, mint: t, label: tok }); checkSafeAfter(post[2], { wallet, mint: s, label: sym }); row.safeAfter = "ok"; } catch (e) { row.safeAfter = `${e.clause}: ${e.message}`; }
  } catch (e) { row.refused = `${e.clause ?? e.code ?? e.name}: ${e.message}`; }
  out.push(row);
  console.log(JSON.stringify(row));
  await sleep(1_200);
}
