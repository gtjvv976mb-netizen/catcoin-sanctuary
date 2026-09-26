const url = "https://www.uscfinvestments.com/uso";
try {
const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
const t = await r.text();
console.log("status", r.status, "len", t.length);
const title = t.match(/<title[^>]*>([^<]*)<\/title>/i); console.log("title:", title && title[1].trim());
const txt = t.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&[a-z#0-9]+;/gi," ").replace(/\s+/g," ");
for (const m of txt.matchAll(/.{0,220}(crude|WTI|light, sweet|futures contract|investment objective).{0,220}/gi)) { console.log("-", m[0]); }
console.log("cat terms:", [...txt.matchAll(/\b(cat|cats|kitten|lion|tiger|panther|jaguar|mascot)\b/gi)].map(m=>m[0]));
} catch (e) { console.log("fetch error", String(e)); }
try {
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["USNv3NkKA27Dh4nsHJDPhW4VoEcTQmjoZyJt2dqdwFu", { encoding: "jsonParsed" }] }) });
const j = await rpc.json(); const info = j.result.value.data.parsed.info;
for (const e of info.extensions ?? []) if (e.extension !== "tokenMetadata") console.log(e.extension, JSON.stringify(e.state));
console.log("tokenMetadata", JSON.stringify({ name: info.extensions?.find(e=>e.extension==="tokenMetadata")?.state?.name, symbol: info.extensions?.find(e=>e.extension==="tokenMetadata")?.state?.symbol }));
console.log("freezeAuthority", info.freezeAuthority, "mintAuthority", info.mintAuthority, "decimals", info.decimals);
console.log("owner", j.result.value.owner, "hasTransferFeeConfig", (info.extensions??[]).some(e=>e.extension==="transferFeeConfig"));
} catch (e) { console.log("rpc error", String(e)); }
