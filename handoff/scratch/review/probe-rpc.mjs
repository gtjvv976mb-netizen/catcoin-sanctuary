const RPC = "https://api.mainnet-beta.solana.com";
const call = async (method, params) => { const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); return (await r.json()); };
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const r = await call("getTokenLargestAccounts", [USDC]);
console.log(JSON.stringify(r).slice(0, 2000));
