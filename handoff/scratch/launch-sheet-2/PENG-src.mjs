const r = await fetch("https://en.wikipedia.org/w/index.php?title=Penguin_Solutions&action=raw", { headers: { "user-agent": "research-bot/1.0" } });
const t = await r.text();
console.log("status", r.status, "len", t.length);
for (const k of ["industry","products","Products","memory","Memory","LED","high-performance","HPC","fault","Stratus","Cree","artificial intelligence","AI "]) { const i=t.indexOf(k); if(i>=0) console.log("["+k+"] ::", t.slice(Math.max(0,i-150),i+250).replace(/\s+/g," ")); }
console.log("cat-ish:", (t.match(/\b(cat|cats|kitten|kitty|feline|lion|tiger|panther|leopard|jaguar|cougar|lynx|mascot)\b/gi)||[]).join(",") || "(none)");
const rpc = await fetch("https://api.mainnet-beta.solana.com",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:["PENGTDQeQSXEjKcYw3CTQi9qznxcTHXAA7LMfUNrxLV",{encoding:"jsonParsed"}]})});
const j = await rpc.json();
const info = j?.result?.value?.data?.parsed?.info;
console.log("owner", j?.result?.value?.owner, "extensions", JSON.stringify(info?.extensions?.map(e=>({e:e.extension, s: /transferFee|pausable|permanentDelegate|defaultAccountState|transferHook/.test(e.extension)? e.state : undefined}))));
