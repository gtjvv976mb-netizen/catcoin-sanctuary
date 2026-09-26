import { associatedTokenAddress } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
const RPC = "https://api.mainnet-beta.solana.com";
const call = async (m, p) => (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) })).json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mint = process.argv[2];
const big = await call("getTokenLargestAccounts", [mint]);
if (big.error) { console.log(big.error); process.exit(0); }
for (const a of big.result.value.slice(5, 20)) {
  await sleep(800);
  const info = await call("getAccountInfo", [a.address, { encoding: "jsonParsed" }]);
  const owner = info.result?.value?.data?.parsed?.info?.owner;
  await sleep(800);
  const o = await call("getAccountInfo", [owner, { encoding: "base64" }]);
  const sys = o.result?.value?.owner === "11111111111111111111111111111111";
  const isAta = associatedTokenAddress(owner, mint) === a.address;
  console.log(a.address, a.uiAmount, "owner", owner, "system", sys, "lamports", o.result?.value?.lamports, "ata", isAta);
}
