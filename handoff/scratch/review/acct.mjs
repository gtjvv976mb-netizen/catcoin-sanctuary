import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
import { tokenAccountDetails, jupiterProgramAuthority } from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import { associatedTokenAddress } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const addrs = process.argv.slice(2);
const r = await rpc.getMultipleAccounts(addrs);
r.accounts.forEach((a, i) => console.log(addrs[i], a ? { owner: a.owner, lamports: a.lamports, len: Buffer.from(a.data[0], "base64").length, token: tokenAccountDetails(a) } : null));
for (let id = 0; id < 8; id++) console.log("authority", id, jupiterProgramAuthority(id));
