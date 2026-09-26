const u = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=Shopify&redirects=1";
const r = await fetch(u, { headers: { "user-agent": "cat-sanctuary-research/1.0 (research script)" } });
const j = await r.json();
const p = Object.values(j.query.pages)[0];
const t = p.extract.replace(/\s+/g, " ");
console.log("status", r.status, "title", p.title, "len", t.length);
console.log("LEAD ::", t.slice(0, 900));
for (const k of ["merchant", "point-of-sale", "shipping", "fulfil", "snowboard", "Snowdevil", "Shop Pay", "mascot", "logo", "bag"]) {
  const re = new RegExp(k, "gi"); let m, n = 0;
  while ((m = re.exec(t)) && n < 2) { console.log(k, "::", t.slice(Math.max(0, m.index - 150), m.index + 200)); n++; }
}
console.log("cat-ish:", (t.match(/\b(cat|cats|kitten|kitty|feline|lion|tiger|panther|mascot)\b/gi) || []).join(","));
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["SH55hfaipFAbwT42nQYhRoM5o5t61QpkmJ6p62vXB3m", { encoding: "jsonParsed" }] }) });
const jj = await rpc.json(); const v = jj?.result?.value; const info = v?.data?.parsed?.info;
console.log("MINT owner", v?.owner);
for (const e of info?.extensions ?? []) if (e.extension !== "tokenMetadata") console.log("ext", e.extension, JSON.stringify(e.state));
const md = info?.extensions?.find(e => e.extension === "tokenMetadata")?.state;
console.log("tokenMetadata", JSON.stringify({ name: md?.name, symbol: md?.symbol }), "freeze", info?.freezeAuthority, "mintAuth", info?.mintAuthority, "decimals", info?.decimals);
