const body = { jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["RUMsPfFZFnN1ZmGANwP7FNMJMjKH4m9RiMePrtVtLe7", { encoding: "jsonParsed" }] };
for (const u of ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"]) {
  try {
    const r = await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json(); const info = j?.result?.value?.data?.parsed?.info;
    console.log(u, r.status, JSON.stringify({ owner: j?.result?.value?.owner, extensions: info?.extensions?.map(e => ({ extension: e.extension, state: e.extension === "tokenMetadata" ? { name: e.state?.name, symbol: e.state?.symbol } : e.state })), mintAuthority: info?.mintAuthority, freezeAuthority: info?.freezeAuthority, err: j.error }, null, 1));
    if (info) break;
  } catch (e) { console.log(u, String(e)); }
}
