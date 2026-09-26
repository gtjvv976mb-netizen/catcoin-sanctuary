// REVIEW: build a real Jupiter hop for a funded wallet, simulate it on mainnet (sigVerify off),
// and run the agent's own checks and the engine-equivalent guard on the live bytes + simulation.
import fs from "node:fs";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
import { checkQuote, checkSwapTransaction, loadLookupTables, lookupTableKeysOf, checkWritableCustody, checkRouteMints, checkIntermediateLeft, checkNativeSpend, checkSafeAfter, tokenAccountDetails } from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import { associatedTokenAddress, tokenAmountOf, WSOL } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
const TK = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const [wallet, side, token, amountRaw] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const inputMint = side === "buy" ? USDC : token, outputMint = side === "buy" ? token : USDC;
const q = { inputMint, outputMint, amount: amountRaw, slippageBps: "100", swapMode: "ExactIn", onlyDirectRoutes: "false", restrictIntermediateTokens: "true", maxAccounts: "24", instructionVersion: "V2" };
const quote = await (await fetch(`https://lite-api.jup.ag/swap/v1/quote?${new URLSearchParams(q)}`)).json();
await sleep(1500);
console.log("route:", quote.routePlan?.map((h) => `${h.swapInfo.inputMint.slice(0,4)}>${h.swapInfo.outputMint.slice(0,4)} ${h.swapInfo.label} ${h.bps}`).join(" | "), "impact", quote.priceImpactPct);
const qc = checkQuote(quote, { inputMint, outputMint, amountRaw, slippageBps: 100, slippageCapBps: 100, maxPriceImpactPct: 100, solHop: true });
const built = await (await fetch("https://lite-api.jup.ag/swap/v1/swap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
  quoteResponse: quote, userPublicKey: wallet, wrapAndUnwrapSol: false, dynamicComputeUnitLimit: false, ...(qc.intermediate ? { useSharedAccounts: true } : {}),
  prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 50000, priorityLevel: "veryHigh", global: false } } }) })).json();
const txBase64 = built.swapTransaction;
const tables = await loadLookupTables(rpc, lookupTableKeysOf(txBase64));
const checked = checkSwapTransaction({ txBase64, wallet, inputMint, outputMint, inputProgram: TK, outputProgram: TK, amountRaw, quote, slippageCapBps: 100, lookupTables: tables, maxPriorityFeeLamports: 50_000, solHop: true });
console.log("checkSwapTransaction passed:", checked.route.name, "id", checked.route.id, "steps", checked.route.routeSteps, "created", checked.createdAtas.length, "prio", checked.priorityFeeLamports);
const tokenAta = associatedTokenAddress(wallet, token, TK), usdcAta = associatedTokenAddress(wallet, USDC, TK);
const writable = await rpc.getMultipleAccounts(checked.writableAddresses);
checkWritableCustody({ wallet, writableAddresses: checked.writableAddresses, accounts: writable.accounts, allowed: [usdcAta, tokenAta] });
if (checked.intermediate) checkRouteMints({ writableAddresses: checked.writableAddresses, accounts: writable.accounts, mints: [USDC, WSOL, token] });
console.log("custody + route mints passed");
const addresses = [wallet, tokenAta, usdcAta, checked.walletIntermediateAta];
const pre = await rpc.getMultipleAccounts(addresses);
const sim = await rpc.call("simulateTransaction", [txBase64, { encoding: "base64", sigVerify: false, replaceRecentBlockhash: false, commitment: "processed", accounts: { encoding: "base64", addresses } }]);
const v = sim.value;
console.log("sim err:", JSON.stringify(v.err), "units", v.unitsConsumed, "fee field:", v.fee ?? "(none)");
if (v.err) { console.log(v.logs?.slice(-6).join("\n")); process.exit(0); }
const post = v.accounts;
const spend = BigInt(pre.accounts[0].lamports) - BigInt(post[0].lamports);
const amt = (a, mint) => tokenAmountOf(a, { mint, owner: wallet }) ?? 0n;
console.log("wallet lamports pre", pre.accounts[0].lamports, "post", post[0].lamports, "spend", spend.toString(), "(expected fee", 5000n + checked.priorityFeeLamports, ")");
console.log("token delta", (amt(post[1], token) - amt(pre.accounts[1], token)).toString(), "minOut", qc.minOutRaw.toString());
console.log("usdc delta", (amt(post[2], USDC) - amt(pre.accounts[2], USDC)).toString());
console.log("wallet wSOL ATA pre", JSON.stringify(pre.accounts[3])?.slice(0, 80), "post", JSON.stringify(post[3])?.slice(0, 80));
checkIntermediateLeft({ address: checked.walletIntermediateAta, before: pre.accounts[3], after: post[3] });
const rent = [1, 2].reduce((s, i) => (!pre.accounts[i] && post[i] ? s + BigInt(post[i].lamports) : s), 0n);
checkNativeSpend({ spentLamports: spend, signatures: checked.signatures, priorityFeeLamports: checked.priorityFeeLamports, rentLamports: rent });
checkSafeAfter(post[1], { wallet, mint: token, label: "token" }); checkSafeAfter(post[2], { wallet, mint: USDC, label: "USDC" });
console.log("ALL CHECKS PASSED; rent allowed", rent.toString());
fs.writeFileSync(`live-${side}-${token.slice(0,4)}-${Date.now()}.json`, JSON.stringify({ at: new Date().toISOString(), wallet, quote, built, pre, sim: v }));
