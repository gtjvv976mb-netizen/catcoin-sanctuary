const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["FLYRq3en8r2Z69gN3KyAnDrvnitEJNkwPYY7favinHeD", { encoding: "jsonParsed" }] }) });
const j = await rpc.json(); const v = j.result.value; console.log("owner", v.owner); const info = v.data.parsed.info;
for (const e of info.extensions ?? []) if (e.extension !== "tokenMetadata") console.log(e.extension, JSON.stringify(e.state));
const md = (info.extensions ?? []).find(e=>e.extension==="tokenMetadata")?.state;
console.log("tokenMetadata", JSON.stringify({ name: md?.name, symbol: md?.symbol }));
console.log("hasTransferFeeConfig", (info.extensions ?? []).some(e => e.extension === "transferFeeConfig"));
console.log("freezeAuthority", info.freezeAuthority, "mintAuthority", info.mintAuthority, "decimals", info.decimals);
