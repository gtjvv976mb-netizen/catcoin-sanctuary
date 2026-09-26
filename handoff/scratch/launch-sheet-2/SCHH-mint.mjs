const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["SCHHJ3jRdSjeFEVAaLrnYdx3Brphn92Ys7z1qkiCtPX", { encoding: "jsonParsed" }] }) });
const j = await rpc.json(); const info = j.result.value.data.parsed.info;
for (const e of info.extensions) if (e.extension !== "tokenMetadata") console.log(e.extension, JSON.stringify(e.state));
console.log("tokenMetadata", JSON.stringify({ name: info.extensions.find(e=>e.extension==="tokenMetadata")?.state?.name, symbol: info.extensions.find(e=>e.extension==="tokenMetadata")?.state?.symbol }));
console.log("freezeAuthority", info.freezeAuthority, "mintAuthority", info.mintAuthority, "decimals", info.decimals);
