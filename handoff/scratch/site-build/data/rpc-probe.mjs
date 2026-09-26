const url = "https://api.mainnet-beta.solana.com";
const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot", params: [] }) });
console.log(r.status, await r.text());
