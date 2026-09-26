const u = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=AMC_Theatres&redirects=1";
const r = await fetch(u, { headers: { "user-agent": "cat-sanctuary-research/1.0 (research script)" } });
const j = await r.json();
const p = Object.values(j.query.pages)[0];
const t = p.extract.replace(/\s+/g, " ");
console.log("status", r.status, "title", p.title, "len", t.length);
console.log("LEAD ::", t.slice(0, 700));
for (const k of ["popcorn", "concession", "recliner", "food and beverage", "IMAX", "Dolby", "screens", "largest"]) {
  const re = new RegExp(k, "gi"); let m, n = 0;
  while ((m = re.exec(t)) && n < 2) { console.log(k, "::", t.slice(Math.max(0, m.index - 150), m.index + 200)); n++; }
}
console.log("cat-ish:", (t.match(/\b(cat|cats|kitten|kitty|feline|lion|tiger|panther|mascot)\b/gi) || []).join(","));
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["AMC1qwR9KhiyrQBRPrxnfo4JfMeMZqEBvt5tgTytNNoc", { encoding: "jsonParsed" }] }) });
const jj = await rpc.json();
const info = jj?.result?.value?.data?.parsed?.info;
console.log("owner", jj?.result?.value?.owner, "extensions", JSON.stringify(info?.extensions?.map(e => ({ e: e.extension, s: e.extension === "transferFeeConfig" ? e.state : undefined }))));
