import { PublicKey } from "@solana/web3.js";
import { associatedTokenAddress } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
const RPC = "https://api.mainnet-beta.solana.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = async (method, params) => { await sleep(400); const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); return (await r.json()); };
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const LMEOW = "CB8afe6zJDGoCoSHx2iJACqemTUjgpvKKLTa86qMpump";
const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PE9fsHFGrWhmxD";
const PAMM = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
// recent USDC transfers: signatures for the USDC mint are too many; use a busy program's recent txs instead
const sigs = await call("getSignaturesForAddress", [PAMM, { limit: 40 }]);
const owners = new Set();
for (const s of sigs.result.slice(0, 25)) {
  const t = await call("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 0 }]);
  const pk = t.result?.transaction?.message?.accountKeys?.[0];
  if (pk) owners.add(pk);
}
console.log("payers", owners.size);
for (const o of owners) {
  const ata = associatedTokenAddress(o, USDC, "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const r = await call("getMultipleAccounts", [[o, ata, associatedTokenAddress(o, LMEOW, T22)], { encoding: "base64" }]);
  const [w, a, l] = r.result.value;
  const usdc = a ? Buffer.from(a.data[0], "base64").readBigUInt64LE(64) : 0n;
  const acc = PublicKey.findProgramAddressSync([Buffer.from("user_volume_accumulator"), new PublicKey(o).toBuffer()], new PublicKey(PAMM))[0].toBase58();
  const r2 = await call("getMultipleAccounts", [[acc], { encoding: "base64" }]);
  console.log(o, w?.owner, w?.lamports, "usdc", usdc.toString(), "lmeow", Boolean(l), "acc", Boolean(r2.result.value[0]));
}
