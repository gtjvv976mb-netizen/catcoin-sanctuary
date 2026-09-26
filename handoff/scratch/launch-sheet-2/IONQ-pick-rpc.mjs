const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["NQ5hSuXQZrbnrwcDVk2qN73njjd3E3v3badYHnj5thF", { encoding: "jsonParsed" }] }) });
const jj = await rpc.json();
const info = jj?.result?.value?.data?.parsed?.info;
const ex = info?.extensions ?? [];
console.log(JSON.stringify({ status: rpc.status, slot: jj?.result?.context?.slot, owner: jj?.result?.value?.owner, decimals: info?.decimals, extensionNames: ex.map(e => e.extension), transferFeeConfig: ex.find(e => e.extension === "transferFeeConfig") ?? null, pausable: ex.find(e=>e.extension==="pausableConfig")?.state, transferHook: ex.find(e=>e.extension==="transferHook")?.state, tokenMetadata: (({name,symbol})=>({name,symbol}))(ex.find(e=>e.extension==="tokenMetadata")?.state ?? {}) }, null, 1));
