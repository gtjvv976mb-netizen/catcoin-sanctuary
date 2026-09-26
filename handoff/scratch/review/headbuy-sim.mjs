/* HEAD's agent path for a $25 USDC -> LMEOW buy, end to end short of signing: quote (direct),
   build, check before signing, custody read, simulation on mainnet for a funded wallet, and
   the engine guard's arithmetic. */
import * as OLD from "./head/src/lib/jupiter-swap.mjs";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
import { associatedTokenAddress } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
const T = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", TOK = process.env.TOK ?? "CB8afe6zJDGoCoSHx2iJACqemTUjgpvKKLTa86qMpump";
const wallet = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const J = OLD.createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_300 });
const amountRaw = "25000000";
const raw = await J.quote({ inputMint: USDC, outputMint: TOK, amountRaw, slippageBps: 100, priority: "live" });
const q = OLD.checkQuote(raw, { inputMint: USDC, outputMint: TOK, amountRaw, slippageBps: 100, slippageCapBps: 100, maxPriceImpactPct: 2 });
const built = await J.swapTransaction({ quote: raw, wallet, priorityFeeLamports: 50_000, priority: "live" });
const tables = await OLD.loadLookupTables(rpc, OLD.lookupTableKeysOf(built.swapTransaction));
const checked = OLD.checkSwapTransaction({ txBase64: built.swapTransaction, wallet, inputMint: USDC, outputMint: TOK, inputProgram: T, outputProgram: T22, amountRaw, quote: raw, slippageCapBps: 100, lookupTables: tables, maxPriorityFeeLamports: 50_000, allowedPairs: new Set([`${USDC}>${TOK}`, `${TOK}>${USDC}`]) });
const tokenAta = associatedTokenAddress(wallet, TOK, T22), usdcAta = associatedTokenAddress(wallet, USDC, T);
const writable = await rpc.getMultipleAccounts(checked.writableAddresses);
OLD.checkWritableCustody({ wallet, writableAddresses: checked.writableAddresses, accounts: writable.accounts, allowed: [usdcAta, tokenAta] });
const addresses = [wallet, tokenAta, usdcAta];
const pre = await rpc.getMultipleAccounts(addresses);
const sim = await rpc.simulateTransaction(built.swapTransaction, { addresses });
if (sim.err) { console.log("sim err", JSON.stringify(sim.err), sim.logs?.slice(-5)); process.exit(0); }
const amt = (a) => (a ? OLD.tokenAccountDetails(a)?.amount ?? 0n : 0n);
const spend = BigInt(pre.accounts[0].lamports) - BigInt(sim.accounts[0].lamports);
const took = amt(pre.accounts[2]) - amt(sim.accounts[2]), got = amt(sim.accounts[1]) - amt(pre.accounts[1]);
console.log(JSON.stringify({ route: raw.routePlan.map((h) => h.swapInfo.label).join(">"), impactPct: q.impactPct.toFixed(3), tx: checked.route.name, prio: String(checked.priorityFeeLamports),
  simSpendLamports: String(spend), engineGuardAllows: String(2_000_000n + 4_200_000n), usdcTaken: String(took), exactInput: took === BigInt(amountRaw), tokenOut: String(got), minOut: String(q.minOutRaw), deliversFloor: got >= q.minOutRaw }));
OLD.checkSafeAfter(sim.accounts[1], { wallet, mint: TOK, label: "LMEOW" }); OLD.checkSafeAfter(sim.accounts[2], { wallet, mint: USDC, label: "USDC" });
console.log("HEAD path: every check before signing passed");
