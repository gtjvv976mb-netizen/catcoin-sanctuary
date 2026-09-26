const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["BULL151gUXcFV5wXEUqu9Am2L7Qt4bTJRLRuAUjkcspC", { encoding: "jsonParsed" }] }) });
const jj = await rpc.json();
const info = jj?.result?.value?.data?.parsed?.info;
console.log(JSON.stringify({ owner: jj?.result?.value?.owner, decimals: info?.decimals, extensions: info?.extensions?.map(e => ({ e: e.extension, s: ["transferFeeConfig","transferHook","permanentDelegate","pausableConfig","defaultAccountState","scaledUiAmountConfig"].includes(e.extension) ? e.state : undefined })) }, null, 1));
