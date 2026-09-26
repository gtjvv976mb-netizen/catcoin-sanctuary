const body = { jsonrpc:"2.0", id:1, method:"getAccountInfo", params:["BBosJLw8ZzoATiEyywiifx7AgmrD2Cm3XjFWbhbRhChy",{encoding:"jsonParsed"}] };
const r = await fetch("https://api.mainnet-beta.solana.com",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
const j = await r.json(); const v = j.result?.value;
console.log("status", r.status, "owner", v?.owner);
const info = v?.data?.parsed?.info; console.log("decimals", info?.decimals);
for (const e of info?.extensions ?? []) console.log(e.extension, JSON.stringify(e.state));
