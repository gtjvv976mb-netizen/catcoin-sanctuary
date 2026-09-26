const url = "https://www.figure.ai/news/introducing-figure-03";
const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
const t = await r.text();
console.log("status", r.status, "len", t.length);
const title = t.match(/<title[^>]*>([^<]*)<\/title>/i); console.log("title:", title && title[1]);
const txt = t.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&#x27;|&rsquo;/g,"'").replace(/\s+/g," ");
for (const m of txt.matchAll(/[^.]{0,200}\b(soft|textile|fabric|foam|washable|cover|clothing|mesh|padding|home|household|laundry|dish|fold|tactile|fingertip|palm camera|gentle|safe|wireless|charg|dock)\w*\b[^.]{0,200}\./gi)) console.log("-", m[0].trim());
const d = t.match(/"datePublished"\s*:\s*"([^"]+)"/); console.log("datePublished:", d && d[1]);
for (const m of txt.matchAll(/(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 20\d\d/g)) { console.log("date:", m[0]); break; }
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd", { encoding: "jsonParsed" }] }) });
const j = await rpc.json(); const p = j?.result?.value?.data?.parsed?.info;
console.log(JSON.stringify({ owner: j?.result?.value?.owner, extensions: (p?.extensions ?? []).map(e => ({ extension: e.extension, state: ["transferFeeConfig","transferHook","scaledUiAmountConfig","pausableConfig","permanentDelegate"].includes(e.extension) ? e.state : undefined })) }, null, 1));
