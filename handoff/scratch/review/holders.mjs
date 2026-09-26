import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
import { tokenAccountDetails } from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
for (const mint of process.argv.slice(2)) {
  const r = await rpc.call("getTokenLargestAccounts", [mint, { commitment: "confirmed" }]);
  const accts = (r?.value ?? []).slice(0, 12).map((x) => x.address);
  const read = await rpc.getMultipleAccounts(accts);
  const owners = read.accounts.map((a) => tokenAccountDetails(a)?.owner);
  const ow = await rpc.getMultipleAccounts(owners);
  owners.forEach((o, i) => console.log(mint.slice(0, 6), accts[i], "owner", o, "ownerProgram", ow.accounts[i]?.owner ?? "none", "sol", (ow.accounts[i]?.lamports ?? 0) / 1e9, "amount", String(tokenAccountDetails(read.accounts[i])?.amount)));
  await new Promise((r) => setTimeout(r, 2000));
}
