const r = await fetch("https://api.mainnet-beta.solana.com", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:["WENAZ2WyPbmgvUcKfQ8hyMDfBQP9bZ65hsZ5KTFrRGZ",{encoding:"jsonParsed"}]})});
const j = await r.json();
const v = j.result?.value;
console.log(JSON.stringify({status:r.status, owner:v?.owner, extensions:v?.data?.parsed?.info?.extensions?.map(e=>({extension:e.extension, state:e.state}))}, null, 1));
