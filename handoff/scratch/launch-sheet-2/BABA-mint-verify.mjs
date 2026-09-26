const body = { jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["BABANGA4JE7Kkam4nTrALAwAVgsNJUuFJnnkF7S16BZp", { encoding: "jsonParsed" }] };
const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const j = await r.json(); const v = j.result?.value;
console.log("status", r.status, "owner", v?.owner);
const info = v?.data?.parsed?.info;
console.log("freezeAuthority", info?.freezeAuthority, "mintAuthority", info?.mintAuthority, "decimals", info?.decimals);
for (const e of info?.extensions ?? []) console.log("ext", e.extension, JSON.stringify(e.state ?? {}).slice(0, 160));
console.log("hasTransferFeeConfig", (info?.extensions ?? []).some(e => /transferFee/i.test(e.extension)));
