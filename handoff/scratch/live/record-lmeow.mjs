/* Records the LMEOW PumpSwap direct route, the one-hop ask that misses it, Jupiter's build for a
   funded wallet, and that build simulated on mainnet with every writable account read before and
   after. Nothing is signed or sent. */
import fs from "node:fs";
import { PublicKey, VersionedTransaction, TransactionMessage, AddressLookupTableAccount } from "@solana/web3.js";
import { associatedTokenAddress } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
const OUT = process.argv[2];
const RPC = "https://api.mainnet-beta.solana.com";
const JUP = "https://api.jup.ag/swap/v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = async (method, params) => { await sleep(300); const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); const j = await r.json(); if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`); return j.result; };
let lastJup = 0;
const jup = async (path, { query, body } = {}) => {
  const wait = lastJup + 2_200 - Date.now(); if (wait > 0) await sleep(wait); lastJup = Date.now();
  const url = `${JUP}${path}${query ? `?${new URLSearchParams(query)}` : ""}`;
  const r = await fetch(url, body ? { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body) } : { headers: { accept: "application/json" } });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, body: json ?? text, url };
};
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", LMEOW = "CB8afe6zJDGoCoSHx2iJACqemTUjgpvKKLTa86qMpump";
const TK = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", WSOL = "So11111111111111111111111111111111111111112";
const USER = "g1NcQKARd9jh3ZV28UFZ3L6yzaQL798WbBDXf1Rchv7";
const direct = (i, o, amount) => ({ inputMint: i, outputMint: o, amount: String(amount), slippageBps: "100", swapMode: "ExactIn", onlyDirectRoutes: "true", restrictIntermediateTokens: "true", instructionVersion: "V2" });
const hop = (i, o, amount) => ({ inputMint: i, outputMint: o, amount: String(amount), slippageBps: "100", swapMode: "ExactIn", onlyDirectRoutes: "false", restrictIntermediateTokens: "true", maxAccounts: "24", instructionVersion: "V2" });
const out = { capturedAt: new Date().toISOString(), user: USER, settlementMint: USDC, tokenMint: LMEOW, symbol: "LMEOW", query: {}, answers: {} };
const tok = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${LMEOW}`).then((r) => r.json());
out.token = (Array.isArray(tok) ? tok : []).find((t) => t.id === LMEOW) ?? null;
const amountIn = 10_000_000;
for (const [name, q] of [["buyDirect", direct(USDC, LMEOW, amountIn)], ["buyHop24", hop(USDC, LMEOW, amountIn)]]) { out.query[name] = q; out.answers[name] = (await jup("/quote", { query: q })); }
const qb = out.answers.buyDirect.body;
if (!qb?.outAmount) { console.log(JSON.stringify(out.answers, null, 1)); process.exit(1); }
const sellAmount = qb.outAmount;
for (const [name, q] of [["sellDirect", direct(LMEOW, USDC, sellAmount)], ["sellHop24", hop(LMEOW, USDC, sellAmount)]]) { out.query[name] = q; out.answers[name] = (await jup("/quote", { query: q })); }
/* Jupiter's build, the body the agent sends for a direct swap (no useSharedAccounts). */
const swapBody = { quoteResponse: qb, userPublicKey: USER, wrapAndUnwrapSol: false, dynamicComputeUnitLimit: false,
  prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 50_000, priorityLevel: "veryHigh", global: false } } };
const sw = await jup("/swap", { body: swapBody });
out.swapBody = { ...swapBody, quoteResponse: { "…": "answers.buyDirect.body" } };
out.swapBuy = sw.body;
const tx = VersionedTransaction.deserialize(Buffer.from(sw.body.swapTransaction, "base64"));
const altKeys = tx.message.addressTableLookups.map((l) => l.accountKey.toBase58());
const altRead = await call("getMultipleAccounts", [altKeys, { encoding: "base64" }]);
out.lookupTables = altKeys.map((a, i) => ({ address: a, owner: altRead.value[i].owner, data: altRead.value[i].data }));
const alts = altKeys.map((a, i) => new AddressLookupTableAccount({ key: new PublicKey(a), state: AddressLookupTableAccount.deserialize(Buffer.from(altRead.value[i].data[0], "base64")) }));
const msg = TransactionMessage.decompile(tx.message, { addressLookupTableAccounts: alts });
const writable = [...new Set(msg.instructions.flatMap((ix) => ix.keys.filter((k) => k.isWritable).map((k) => k.pubkey.toBase58())))];
const lmeowAta = associatedTokenAddress(USER, LMEOW, T22), usdcAta = associatedTokenAddress(USER, USDC, TK), wsolAta = associatedTokenAddress(USER, WSOL, TK);
const addresses = [USER, lmeowAta, usdcAta, wsolAta, ...writable.filter((a) => ![USER, lmeowAta, usdcAta, wsolAta].includes(a))];
out.simulation = { addresses, note: "" };
for (let attempt = 0; attempt < 6; attempt++) {
  const pre = await (async () => { const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getMultipleAccounts", params: [addresses, { encoding: "base64", commitment: "processed" }] }) }); return (await r.json()).result; })();
  const sim = await (async () => { const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "simulateTransaction", params: [sw.body.swapTransaction, { encoding: "base64", sigVerify: false, replaceRecentBlockhash: false, commitment: "processed", accounts: { encoding: "base64", addresses } }] }) }); return (await r.json()); })();
  out.simulation.attempts = (out.simulation.attempts ?? 0) + 1;
  if (sim.error) { out.simulation.error = sim.error; break; }
  if (pre.context.slot === sim.result.context.slot) {
    out.simulation.preSlot = pre.context.slot; out.simulation.simSlot = sim.result.context.slot;
    out.simulation.pre = pre.value; out.simulation.err = sim.result.value.err; out.simulation.post = sim.result.value.accounts;
    out.simulation.unitsConsumed = sim.result.value.unitsConsumed; out.simulation.logs = sim.result.value.logs; out.simulation.fee = sim.result.value.fee ?? null;
    out.simulation.preBalances = sim.result.value.preBalances ?? null; out.simulation.postBalances = sim.result.value.postBalances ?? null;
    break;
  }
  (out.simulation.unpinned ??= []).push({ preSlot: pre.context.slot, simSlot: sim.result.context.slot });
  await sleep(500);
}
const rent = await call("getAccountInfo", ["SysvarRent111111111111111111111111111111111", { encoding: "base64" }]);
out.rentSysvar = { slot: rent.context.slot, owner: rent.value.owner, data: rent.value.data };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log("answers", Object.fromEntries(Object.entries(out.answers).map(([k, v]) => [k, v.status + " " + (v.body?.errorCode ?? v.body?.routePlan?.map((h) => h.swapInfo.label).join(">"))])));
console.log("impact", qb.priceImpactPct, "sim err", out.simulation.err, "slots", out.simulation.preSlot, out.simulation.simSlot, "unpinned", JSON.stringify(out.simulation.unpinned ?? []));
const lam = (a) => (a ? a.lamports : null);
addresses.forEach((a, i) => { const p = out.simulation.pre?.[i], q = out.simulation.post?.[i]; if (lam(p) !== lam(q) || (!p) !== (!q)) console.log(i, a, p?.owner ?? null, lam(p), "->", q?.owner ?? null, lam(q), q ? Buffer.from(q.data[0], "base64").length : null); });
