const mint="NKEda5nHhNGgjrE9nDdMvaEmkmJ96qqxzBVZEcKmjSg";
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [mint, { encoding: "jsonParsed" }] }) });
const j = await rpc.json(); const p = j?.result?.value?.data?.parsed?.info;
console.log(JSON.stringify({ owner: j?.result?.value?.owner, decimals:p?.decimals, extensions: (p?.extensions ?? []).map(e => ({ extension: e.extension, state: ["transferFeeConfig","transferHook","scaledUiAmountConfig","pausableConfig","permanentDelegate","defaultAccountState"].includes(e.extension) ? e.state : undefined })) }, null, 1));
