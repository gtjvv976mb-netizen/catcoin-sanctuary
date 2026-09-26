// Refutation attempt: run the WORKING TREE's own ask, build and checks (as agent-runner swap() does)
// on a USDC -> LMEOW buy. First the working tree's solHop ask as is; then the same checks on the
// direct PumpSwap route that an un-capped ask returns. Nothing is signed.
import fs from "node:fs";
import { PublicKey } from "@solana/web3.js";
import * as NEW from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
import { associatedTokenAddress } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
const T = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOK = process.env.TOK ?? "CB8afe6zJDGoCoSHx2iJACqemTUjgpvKKLTa86qMpump";
const wallet = process.env.WALLET ?? "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
const PAMM = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const J = NEW.createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_300 });
const amountRaw = "25000000";
const out = { at: new Date().toISOString(), wallet, token: TOK };
const uva = PublicKey.findProgramAddressSync([Buffer.from("user_volume_accumulator"), new PublicKey(wallet).toBuffer()], new PublicKey(PAMM))[0].toBase58();
out.userVolumeAccumulatorPda = uva;
try { const q = await J.quote({ inputMint: USDC, outputMint: TOK, amountRaw, slippageBps: 100, priority: "live", solHop: true }); out.workingTreeAsk = q.routePlan.map((h) => h.swapInfo.label).join(">"); }
catch (e) { out.workingTreeAsk = `${e.code ?? e.clause}: ${e.message}`; }
console.log("working-tree solHop ask:", out.workingTreeAsk);
await sleep(1500);
// The "fixed" ask: same as the working tree's but without maxAccounts.
const query = { inputMint: USDC, outputMint: TOK, amount: amountRaw, slippageBps: "100", swapMode: "ExactIn", onlyDirectRoutes: "false", restrictIntermediateTokens: "true", instructionVersion: "V2" };
const raw = await (await fetch(`https://lite-api.jup.ag/swap/v1/quote?${new URLSearchParams(query)}`)).json();
out.uncappedRoute = raw.routePlan?.map((h) => `${h.swapInfo.label} ${h.swapInfo.inputMint.slice(0, 4)}>${h.swapInfo.outputMint.slice(0, 4)}`).join(" | ");
console.log("uncapped route:", out.uncappedRoute);
const q = NEW.checkQuote(raw, { inputMint: USDC, outputMint: TOK, amountRaw, slippageBps: 100, slippageCapBps: 100, maxPriceImpactPct: 2, solHop: true });
console.log("checkQuote passed; intermediate", q.intermediate, "impact", q.impactPct);
await sleep(1500);
const built = await J.swapTransaction({ quote: raw, wallet, priorityFeeLamports: 50_000, priority: "live", sharedAccounts: q.intermediate !== null });
const txBase64 = built.swapTransaction;
const tables = await NEW.loadLookupTables(rpc, NEW.lookupTableKeysOf(txBase64));
const checked = NEW.checkSwapTransaction({ txBase64, wallet, inputMint: USDC, outputMint: TOK, inputProgram: T, outputProgram: T22, amountRaw, quote: raw, slippageCapBps: 100, lookupTables: tables, maxPriorityFeeLamports: 50_000, solHop: true });
console.log("checkSwapTransaction passed:", checked.route.name ?? "", "shared", checked.route.shared, "prio", checked.priorityFeeLamports, "writable", checked.writableAddresses.length, "names UVA:", checked.writableAddresses.includes(uva));
const tokenAta = associatedTokenAddress(wallet, TOK, T22), usdcAta = associatedTokenAddress(wallet, USDC, T);
const writable = await rpc.getMultipleAccounts(checked.writableAddresses);
NEW.checkWritableCustody({ wallet, writableAddresses: checked.writableAddresses, accounts: writable.accounts ?? [], allowed: [usdcAta, tokenAta] });
console.log("custody passed");
const addresses = [wallet, tokenAta, usdcAta, checked.walletIntermediateAta, uva];
const pre = await rpc.getMultipleAccounts(addresses);
const sim = await rpc.simulateTransaction(txBase64, { addresses });
out.simErr = sim.err ?? null;
if (sim.err) { console.log("sim err", JSON.stringify(sim.err), sim.logs?.slice(-5)); fs.writeFileSync(`repro-${Date.now()}.json`, JSON.stringify(out, null, 1)); process.exit(0); }
const post = sim.accounts;
const spend = BigInt(pre.accounts[0].lamports) - BigInt(post[0].lamports);
out.spend = String(spend);
out.accounts = addresses.map((a, i) => ({ a, preLamports: pre.accounts[i]?.lamports ?? null, postLamports: post[i]?.lamports ?? null, postOwner: post[i]?.owner ?? null }));
console.log(JSON.stringify(out.accounts, null, 1));
try { NEW.checkIntermediateLeft({ address: checked.walletIntermediateAta, before: pre.accounts[3] ?? null, after: post[3] ?? null }); console.log("checkIntermediateLeft passed"); } catch (e) { console.log("checkIntermediateLeft:", e.clause, e.message); }
const rentLamports = [1, 2].reduce((sum, i) => (!pre.accounts[i] && post[i] ? sum + BigInt(post[i].lamports ?? 0) : sum), 0n);
out.rentLamportsCounted = String(rentLamports);
try { NEW.checkNativeSpend({ spentLamports: spend, signatures: checked.signatures, priorityFeeLamports: checked.priorityFeeLamports, rentLamports }); out.checkNativeSpend = "passed"; }
catch (e) { out.checkNativeSpend = `${e.clause}: ${e.message}`; }
console.log("spend", String(spend), "checkNativeSpend:", out.checkNativeSpend);
out.headEngineGuardCap = 2_000_000 + 4_200_000; out.headEngineGuardPasses = spend <= 6_200_000n;
fs.writeFileSync(`repro-${Date.now()}.json`, JSON.stringify({ ...out, quote: raw, swapTransaction: txBase64 }, null, 1));
