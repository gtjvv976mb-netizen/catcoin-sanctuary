import fs from "node:fs";
import { VersionedTransaction } from "@solana/web3.js";
const RPC = "https://api.mainnet-beta.solana.com";
const rpc = async (method, params) => { const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error)); return j.result; };
const CATS = ["MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5","7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr","4N4DnNo3qpPks9aQCkcWkzoir8tnvT6diS4TnnZibonk","3joMReCCSESngJEpFLoKR2dNcChjSRCDtybQet5uSpse","GRUmPYbiTpq9ZPy5LAqBMMze7kErf5dEX2i9qYfwoSmR","6Rwcmkz9yiYVM5EzyMcr4JsQPGEAWhcUvLvfBperYnUt","3TWgDvYBL2YPET2LxnWAwsMeoA8aL4DutNuwat2pKCjC"];
const SET = ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"];
const all = [...SET, ...CATS];
const acc = await rpc("getMultipleAccounts", [all, { encoding: "base64", commitment: "confirmed" }]);
const tokens = [];
for (const [i, mint] of all.entries()) {
  const j = (await (await fetch(`https://api.jup.ag/tokens/v2/search?query=${mint}`)).json()).find((x) => x.id === mint);
  const a = acc.value[i];
  tokens.push({ mint, symbol: j.symbol, name: j.name, jupiter: { decimals: j.decimals, tokenProgram: j.tokenProgram, isVerified: j.isVerified, tags: j.tags, liquidityUsd: Math.round(j.liquidity), holderCount: j.holderCount }, rpc: { owner: a.owner, lamports: a.lamports, dataLength: Buffer.from(a.data[0], "base64").length, data: a.data } });
  await new Promise((r) => setTimeout(r, 1200));
}
const readAt = new Date().toISOString();
fs.writeFileSync("fixtures/agent/cats-verified.json", JSON.stringify({ readAt, rpc: RPC, rpcMethod: "getMultipleAccounts (base64, confirmed)", slot: acc.context.slot, jupiter: "https://api.jup.ag/tokens/v2/search?query=<mint>", tokens }, null, 1));
console.log("slot", acc.context.slot, readAt);
for (const t of tokens) console.log(t.symbol, t.jupiter.decimals, t.rpc.owner.slice(0,6), t.jupiter.tags.join("|"), t.jupiter.liquidityUsd);
// swap fixture: 10 USDC -> POPCAT and back
const user = "J5sCaGHaVmUGsoYTsLnvoX71air9ffpaFnE959kudPt6", USDC = SET[0], TOKEN = CATS[1];
const q = async (i, o, amt) => (await fetch(`https://api.jup.ag/swap/v1/quote?inputMint=${i}&outputMint=${o}&amount=${amt}&slippageBps=100&onlyDirectRoutes=true&instructionVersion=V2`)).json();
const sw = async (quoteResponse) => (await fetch("https://api.jup.ag/swap/v1/swap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quoteResponse, userPublicKey: user, wrapAndUnwrapSol: false, dynamicComputeUnitLimit: true, prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 50000, priorityLevel: "medium" } } }) })).json();
const quoteBuy = await q(USDC, TOKEN, 10_000_000); console.log("buy", quoteBuy.outAmount, quoteBuy.routePlan?.[0]?.swapInfo?.label, quoteBuy.error);
const swapBuy = await sw(quoteBuy);
const quoteSell = await q(TOKEN, USDC, quoteBuy.outAmount); console.log("sell", quoteSell.outAmount, quoteSell.routePlan?.[0]?.swapInfo?.label);
const swapSell = await sw(quoteSell);
const luts = new Set();
for (const s of [swapBuy, swapSell]) for (const l of VersionedTransaction.deserialize(Buffer.from(s.swapTransaction, "base64")).message.addressTableLookups) luts.add(l.accountKey.toBase58());
const la = await rpc("getMultipleAccounts", [[...luts], { encoding: "base64", commitment: "confirmed" }]);
fs.writeFileSync("fixtures/agent/jupiter-usdc-popcat-swap.json", JSON.stringify({ note: "Live Jupiter answers for 10 USDC -> POPCAT and the POPCAT back to USDC, built for a throwaway public key (its secret was never kept), exactly as src/lib/jupiter-swap.mjs asks: onlyDirectRoutes, instructionVersion V2, 100 bps, no SOL wrapping, a 50,000-lamport priority cap. The lookup tables are this RPC's read of the ones the transactions name.", capturedAt: new Date().toISOString(), sources: { quote: "GET https://api.jup.ag/swap/v1/quote", swap: "POST https://api.jup.ag/swap/v1/swap", accounts: `POST ${RPC} getMultipleAccounts (base64, confirmed)` }, user, settlementMint: USDC, tokenMint: TOKEN, quoteBuy, swapBuy, quoteSell, swapSell, accountsSlot: la.context.slot, lookupTables: [...luts].map((address, i) => ({ address, owner: la.value[i].owner, lamports: la.value[i].lamports, data: la.value[i].data })) }, null, 1));
console.log("luts", luts.size);
