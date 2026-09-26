const u = "https://daoinsights.com/works/alibabas-zoo-unites-29-businesses/";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (research script)" } });
const h = await r.text();
const t = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&#8217;|&rsquo;/g, "'").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
console.log("status", r.status, "len", t.length);
console.log("TITLE ::", (h.match(/<title>([^<]*)<\/title>/i) || [])[1]);
console.log("DATE ::", (h.match(/"datePublished":"([^"]+)"/) || [])[1]);
for (const k of ["black cat", "Tmall", "sleek", "white", "auspicious"]) {
  const re = new RegExp(k, "gi"); let m, n = 0;
  while ((m = re.exec(t)) && n < 3) { console.log(k, "::", t.slice(Math.max(0, m.index - 200), m.index + 250)); n++; }
}
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["BABANGA4JE7Kkam4nTrALAwAVgsNJUuFJnnkF7S16BZp", { encoding: "jsonParsed" }] }) });
const jj = await rpc.json(); const v = jj?.result?.value; const info = v?.data?.parsed?.info;
console.log("owner", v?.owner);
for (const e of info?.extensions ?? []) console.log("ext", e.extension, e.extension === "tokenMetadata" ? JSON.stringify({ name: e.state.name, symbol: e.state.symbol }) : JSON.stringify(e.state));
console.log("hasTransferFee", (info?.extensions ?? []).some(e => e.extension === "transferFeeConfig"), "freezeAuthority", info?.freezeAuthority, "decimals", info?.decimals);
