/* (1) What the associated-token program charges when the address was sent SOL first: a
   simulation of [an outsider's transfer to the wallet's future coin-account address, the
   idempotent create], beside the create alone. (2) How often a getMultipleAccounts and the
   simulateTransaction right after it answer from different slots. Nothing is signed or sent. */
import fs from "node:fs";
import { PublicKey, SystemProgram, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } from "@solana/web3.js";
import { associatedTokenAddress, createAtaIdempotentIx } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
const OUT = process.argv[2];
const RPC = "https://api.mainnet-beta.solana.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const raw = async (method, params) => { const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); const j = await r.json(); if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`); return j.result; };
const LMEOW = "CB8afe6zJDGoCoSHx2iJACqemTUjgpvKKLTa86qMpump", T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const WALLET = "g1NcQKARd9jh3ZV28UFZ3L6yzaQL798WbBDXf1Rchv7";
const OUTSIDER = "FJx61bqznoVfVDFoujYGgJoJsJq4DxDQ8K3YG5kgRm6G";   // another funded mainnet account: the one who sends SOL first
const ata = associatedTokenAddress(WALLET, LMEOW, T22);
const PREFUND = 650_240;   // the 0-byte rent minimum read below
const build = (ixs) => Buffer.from(new VersionedTransaction(new TransactionMessage({ payerKey: new PublicKey(WALLET), recentBlockhash: "11111111111111111111111111111111", instructions: ixs }).compileToV0Message()).serialize()).toString("base64");
const create = createAtaIdempotentIx({ payer: WALLET, ata, owner: WALLET, mint: LMEOW, tokenProgram: T22 });
const simW = async (b64, addresses) => raw("simulateTransaction", [b64, { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "processed", accounts: { encoding: "base64", addresses: [...addresses, OUTSIDER] } }]);
const sim = async (b64, addresses) => raw("simulateTransaction", [b64, { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "processed", accounts: { encoding: "base64", addresses } }]);
const out = { outsider: OUTSIDER, capturedAt: new Date().toISOString(), rpc: RPC, wallet: WALLET, mint: LMEOW, tokenProgram: T22, ata };
out.minimumBalance = {};
for (const n of [0, 165, 170]) { out.minimumBalance[n] = await raw("getMinimumBalanceForRentExemption", [n]); await sleep(300); }
out.pre = await raw("getMultipleAccounts", [[WALLET, ata, OUTSIDER], { encoding: "base64", commitment: "processed" }]);
await sleep(300);
const a = await sim(build([create]), [WALLET, ata]);
await sleep(300);
const b = await simW(build([SystemProgram.transfer({ fromPubkey: new PublicKey(OUTSIDER), toPubkey: new PublicKey(ata), lamports: PREFUND }), create]), [WALLET, ata]);
const pick = (s) => ({ slot: s.context.slot, err: s.value.err, fee: s.value.fee ?? null, accounts: s.value.accounts.map((x) => (x ? { owner: x.owner, lamports: x.lamports, dataLength: Buffer.from(x.data[0], "base64").length } : null)), logs: s.value.logs });
out.createAlone = pick(a);
out.prefundedThenCreate = { transferLamports: PREFUND, ...pick(b) };
/* (2) the slot pairs */
out.slotPairs = [];
for (let i = 0; i < 20; i++) {
  const p = await raw("getMultipleAccounts", [[WALLET], { encoding: "base64", commitment: "processed" }]);
  const s = await sim(build([ComputeBudgetProgram.setComputeUnitLimit({ units: 10_000 })]), [WALLET]);
  out.slotPairs.push({ at: new Date().toISOString(), readSlot: p.context.slot, simSlot: s.context.slot, readLamports: p.value[0].lamports, simLamports: s.value.accounts[0].lamports });
  await sleep(700);
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.minimumBalance), "pre", out.pre.value.map((x) => x?.lamports ?? null));
console.log("createAlone", JSON.stringify(out.createAlone.accounts), out.createAlone.err);
console.log("prefunded", JSON.stringify(out.prefundedThenCreate.accounts), out.prefundedThenCreate.err);
console.log("pairs differing", out.slotPairs.filter((x) => x.readSlot !== x.simSlot).length, "of", out.slotPairs.length, JSON.stringify(out.slotPairs.map((x) => x.simSlot - x.readSlot)));
