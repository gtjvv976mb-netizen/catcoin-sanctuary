import * as OLD from "./head/src/lib/jupiter-swap.mjs";
import * as NEW from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
import { associatedTokenAddress } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
import fs from "node:fs";
const T = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", TOK = "CB8afe6zJDGoCoSHx2iJACqemTUjgpvKKLTa86qMpump";
const wallet = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const J = OLD.createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_300 });
const amountRaw = "25000000";
const raw = await J.quote({ inputMint: USDC, outputMint: TOK, amountRaw, slippageBps: 100, priority: "live" });
const built = await J.swapTransaction({ quote: raw, wallet, priorityFeeLamports: 50_000, priority: "live" });
const tables = await OLD.loadLookupTables(rpc, OLD.lookupTableKeysOf(built.swapTransaction));
const checked = OLD.checkSwapTransaction({ txBase64: built.swapTransaction, wallet, inputMint: USDC, outputMint: TOK, inputProgram: T, outputProgram: T22, amountRaw, quote: raw, slippageCapBps: 100, lookupTables: tables, maxPriorityFeeLamports: 50_000 });
const addresses = [wallet, ...checked.writableAddresses.filter((a) => a !== wallet)];
const pre = await rpc.getMultipleAccounts(addresses);
const sim = await rpc.simulateTransaction(built.swapTransaction, { addresses });
const tokenAta = associatedTokenAddress(wallet, TOK, T22);
const created = addresses.map((a, i) => ({ a, pre: pre.accounts[i], post: sim.accounts[i] })).filter((x) => !x.pre && x.post).map((x) => ({ address: x.a, owner: x.post.owner, lamports: x.post.lamports, isWalletTokenAta: x.a === tokenAta }));
const spend = BigInt(pre.accounts[0].lamports) - BigInt(sim.accounts[0].lamports);
console.log(JSON.stringify({ spend: String(spend), created }, null, 1));
const rent = BigInt(created.find((c) => c.isWalletTokenAta)?.lamports ?? 0);
try { NEW.checkNativeSpend({ spentLamports: spend, signatures: 1, priorityFeeLamports: checked.priorityFeeLamports, rentLamports: rent }); console.log("working-tree checkNativeSpend: passed"); }
catch (e) { console.log("working-tree checkNativeSpend:", e.clause, e.message); }
fs.writeFileSync(`headbuy-sim2-${Date.now()}.json`, JSON.stringify({ capturedAt: new Date().toISOString(), quote: raw, swapTransaction: built.swapTransaction, spend: String(spend), created }, null, 1));
