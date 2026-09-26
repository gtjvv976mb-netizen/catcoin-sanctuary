const RPC = "https://api.mainnet-beta.solana.com";
const call = async (method, params) => { const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); return r.json(); };
const s = await call("getAccountInfo", ["SysvarRent111111111111111111111111111111111", { encoding: "base64" }]);
const b = Buffer.from(s.result.value.data[0], "base64");
console.log(JSON.stringify(s.result.context), s.result.value.owner, b.length, b.toString("hex"));
console.log("lamportsPerByteYear", b.readBigUInt64LE(0), "threshold", b.readDoubleLE(8), "burn", b[16]);
for (const n of [0, 165, 170, 137]) console.log(n, JSON.stringify(await call("getMinimumBalanceForRentExemption", [n])));
