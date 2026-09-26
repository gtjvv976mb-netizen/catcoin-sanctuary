const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["LUV9GB51PNZNRyzzyYK3rtqFfvDvWtRiXZ34wVq2HrX", { encoding: "jsonParsed" }] }) });
const jj = await rpc.json(); const v = jj?.result?.value; const info = v?.data?.parsed?.info;
console.log("owner", v?.owner);
for (const e of info?.extensions ?? []) console.log("ext", e.extension, e.extension === "tokenMetadata" ? JSON.stringify({ name: e.state.name, symbol: e.state.symbol }) : JSON.stringify(e.state));
console.log("hasTransferFee", (info?.extensions ?? []).some(e => e.extension === "transferFeeConfig"), "freezeAuthority", info?.freezeAuthority, "decimals", info?.decimals);
