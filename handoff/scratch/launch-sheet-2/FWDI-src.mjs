const u = "https://forwardindustries.com/about-us";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (cat-sanctuary-research)" } });
const h = await r.text();
const t = h.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&[a-z#0-9]+;/gi," ").replace(/\s+/g," ");
console.log("status", r.status, "len", t.length);
console.log(t.slice(0, 3000));
for (const k of ["treasury","staking","validator","carrying case","design","yield","SOL "]) { const i = t.toLowerCase().indexOf(k.toLowerCase()); if (i>=0) console.log(k, "::", t.slice(Math.max(0,i-200), i+250)); }
console.log("cat-ish:", (t.match(/\b(cat|cats|kitten|kitty|feline|lion|tiger|panther|jaguar|leopard|mascot|pet|pets)\b/gi) || []).join(","));
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["FWDtiB5fXHdVAewPqvHPL2dh4aBC1C6GacQbePoQXKjz", { encoding: "jsonParsed" }] }) });
const jj = await rpc.json(); const v = jj?.result?.value; const info = v?.data?.parsed?.info;
console.log("owner", v?.owner);
for (const e of info?.extensions ?? []) console.log("ext", e.extension, e.extension === "tokenMetadata" ? JSON.stringify({ name: e.state.name, symbol: e.state.symbol }) : JSON.stringify(e.state));
console.log("hasTransferFee", (info?.extensions ?? []).some(e => e.extension === "transferFeeConfig"), "freezeAuthority", info?.freezeAuthority, "decimals", info?.decimals);
