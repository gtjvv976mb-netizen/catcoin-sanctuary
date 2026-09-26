const u = "https://www.trutower.com/2014/09/26/new-garfield-mini-marilyn-stickers-blackberry-messenger/";
try {
  const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (research script)" } });
  const h = await r.text();
  const t = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&#8217;/g, "'").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
  console.log("status", r.status, "len", t.length, "title", (h.match(/<title>([^<]*)/i) || [])[1]);
  for (const k of ["orange feline", "Paws", "Garfield", "\\$1.99", "BBM Shop", "stripe", "tabby", "September"]) {
    const re = new RegExp(k, "gi"); let m, n = 0;
    while ((m = re.exec(t)) && n < 2) { console.log(k, "::", t.slice(Math.max(0, m.index - 200), m.index + 220)); n++; }
  }
  const imgs = [...h.matchAll(/<img[^>]+src="([^"]+)"/gi)].map(m => m[1]).filter(s => /garfield|sticker|bbm/i.test(s));
  console.log("imgs", imgs.slice(0, 10));
} catch (e) { console.log("ERR", String(e)); }
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["BBosJLw8ZzoATiEyywiifx7AgmrD2Cm3XjFWbhbRhChy", { encoding: "jsonParsed" }] }) });
const jj = await rpc.json();
const info = jj?.result?.value?.data?.parsed?.info;
console.log("owner", jj?.result?.value?.owner, "program", jj?.result?.value?.data?.program, "extensions", JSON.stringify(info?.extensions?.map(e => ({ e: e.extension, s: ["transferFeeConfig","transferHook","pausableConfig","permanentDelegate","defaultAccountState","scaledUiAmountConfig"].includes(e.extension) ? e.state : undefined }))));
