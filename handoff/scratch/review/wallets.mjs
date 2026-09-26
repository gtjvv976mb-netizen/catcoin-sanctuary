import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
import { associatedTokenAddress, WSOL } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
import { tokenAccountDetails } from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const T = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const MEW = "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", POPCAT = "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", KITTY = "4N4DnNo3qpPks9aQCkcWkzoir8tnvT6diS4TnnZibonk";
const cands = process.argv.slice(2);
for (const w of cands) {
  const addrs = [w, ...[USDC, USDT, WSOL, MEW, POPCAT, KITTY].map((m) => associatedTokenAddress(w, m, T))];
  const r = await rpc.getMultipleAccounts(addrs);
  const row = r.accounts.map((a, i) => i === 0 ? `sol=${a ? a.lamports / 1e9 : "none"} owner=${a?.owner}` : (a ? `${["USDC","USDT","WSOL","MEW","POPCAT","KITTY"][i-1]}=${tokenAccountDetails(a)?.amount}` : `${["USDC","USDT","WSOL","MEW","POPCAT","KITTY"][i-1]}=none`));
  console.log(w, row.join(" "));
  await new Promise((r) => setTimeout(r, 1200));
}
