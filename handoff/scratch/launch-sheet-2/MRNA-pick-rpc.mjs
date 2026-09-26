for (const mint of ["MRNAzXzhNcaEXJPibHEn8cd4vyekCDiivTyEwswLUCT"]) {
  const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [mint, { encoding: "jsonParsed" }] }) });
  const j = await r.json();
  const v = j.result?.value;
  console.log(r.status, v?.owner, JSON.stringify((v?.data?.parsed?.info?.extensions ?? []).map((e) => ({ ext: e.extension, state: e.state })), null, 0));
}
