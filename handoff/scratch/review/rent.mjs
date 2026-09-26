const RPC = "https://api.mainnet-beta.solana.com";
async function call(method, params) { const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); return (await r.json()); }
for (const n of [0, 165, 170]) { console.log(n, JSON.stringify(await call("getMinimumBalanceForRentExemption", [n]))); await new Promise(r=>setTimeout(r,1200)); }
console.log(JSON.stringify(await call("getVersion", [])));
