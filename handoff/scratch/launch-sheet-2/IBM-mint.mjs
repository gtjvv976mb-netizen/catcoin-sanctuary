const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["BMKdM4yUxX12moFqVk195k7coMbaybd4RUKCUdm7D1Sk", { encoding: "jsonParsed" }] }) });
const j = await r.json(); const info = j.result?.value?.data?.parsed?.info;
console.log(r.status, j.result?.value?.owner, JSON.stringify((info?.extensions ?? []).map(e => ({ ext: e.extension, state: e.extension === "transferFeeConfig" ? e.state : undefined }))));
