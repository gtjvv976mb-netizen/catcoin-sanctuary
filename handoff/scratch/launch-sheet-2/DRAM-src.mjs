const r = await fetch("https://www.roundhillinvestments.com/etf/dram/");
const h = await r.text();
console.log("status", r.status, "len", h.length);
const t = h.replace(/<script[\s\S]*?<\/script>/g," ").replace(/<style[\s\S]*?<\/style>/g," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ");
for (const k of ["Memory ETF","memory","Micron","Samsung","SK Hynix","SanDisk","Kioxia","DRAM","NAND","HBM"]) { const i=t.indexOf(k); if(i>=0) console.log(k,"::",t.slice(Math.max(0,i-120),i+200)); }
console.log("cat-ish:", (t.match(/\b(cat|cats|kitten|kitty|feline|lion|tiger|panther|mascot)\b/gi)||[]).join(","));
const rpc = await fetch("https://api.mainnet-beta.solana.com",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:["DRAMjSWR7HRfJKjRkvQWYL2bcaejaVhuxEcjf4pAY4Cw",{encoding:"jsonParsed"}]})});
const j = await rpc.json();
const info = j?.result?.value?.data?.parsed?.info;
console.log("owner", j?.result?.value?.owner, "extensions", JSON.stringify(info?.extensions?.map(e=>({e:e.extension, s: e.extension==="transferFeeConfig"? e.state : undefined}))));
