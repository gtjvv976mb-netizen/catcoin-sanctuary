const r = await fetch("https://api.mainnet-beta.solana.com", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:["BArimz1PcKZr8PcPh3tcZ2dg4S7FJLk3cw6R5F8GsHKg",{encoding:"jsonParsed"}]})});
const j = await r.json(); const v = j.result?.value;
console.log(JSON.stringify({status:r.status, owner:v?.owner, type:v?.data?.parsed?.type, extensions:(v?.data?.parsed?.info?.extensions||[]).map(e=>({extension:e.extension, state:e.state}))}, null, 1));
