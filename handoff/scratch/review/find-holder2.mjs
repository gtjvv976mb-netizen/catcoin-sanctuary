import { associatedTokenAddress } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
const RPC = "https://api.mainnet-beta.solana.com";
const call = async (m, p) => (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) })).json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [pool, mint] = process.argv.slice(2);
const sigs = (await call("getSignaturesForAddress", [pool, { limit: 25 }])).result ?? [];
for (const s of sigs.filter((x) => !x.err)) {
  await sleep(900);
  const r = await call("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
  const tx = r.result; if (!tx) continue;
  const payer = tx.transaction.message.accountKeys[0];
  for (const b of tx.meta.postTokenBalances ?? []) {
    if (b.owner === payer && b.mint === mint && Number(b.uiTokenAmount.amount) > 0) {
      const keys = [...tx.transaction.message.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
      console.log(payer, b.uiTokenAmount.amount, "ata", keys[b.accountIndex] === associatedTokenAddress(payer, mint), "sol", tx.meta.postBalances[0] / 1e9);
    }
  }
}
