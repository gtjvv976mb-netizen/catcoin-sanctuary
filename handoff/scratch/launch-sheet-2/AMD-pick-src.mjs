const u = "https://ir.amd.com/news-events/press-releases/detail/251/amd-strategy-transformation-brings-agile-delivery-of-industry-leading-ip-to-the-market";
const r = await fetch(u); const t = await r.text();
const i = t.indexOf("successor to AMD");
console.log("source", r.status, t.length, JSON.stringify(t.slice(i - 40, i + 60)));
for (const rpc of ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"]) {
  try {
    const res = await fetch(rpc, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["AMD8XwJXgQ9WV45Wyj9yFLejxzf2J6VM1PJY8bJEjeES", { encoding: "jsonParsed" }] }) });
    const j = await res.json(); const v = j.result?.value;
    console.log("rpc", rpc, res.status, v?.owner, JSON.stringify(v?.data?.parsed?.info?.extensions?.map(e => ({ ext: e.extension, state: e.extension === "transferFeeConfig" ? e.state : undefined }))));
    const fee = v?.data?.parsed?.info?.extensions?.find(e => e.extension === "transferFeeConfig");
    console.log("transferFeeConfig", JSON.stringify(fee ?? null));
    break;
  } catch (e) { console.log("rpc err", rpc, String(e)); }
}
