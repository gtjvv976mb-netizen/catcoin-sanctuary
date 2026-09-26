for (const mint of ["TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ", "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua"]) {
  const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [mint, { encoding: "jsonParsed" }] }) });
  const jj = await rpc.json(); const v = jj?.result?.value; const info = v?.data?.parsed?.info;
  console.log("mint", mint, "owner", v?.owner, "http", rpc.status, jj.error ? JSON.stringify(jj.error) : "");
  for (const e of info?.extensions ?? []) console.log("  ext", e.extension, e.extension === "tokenMetadata" ? JSON.stringify({ name: e.state.name, symbol: e.state.symbol }) : JSON.stringify(e.state).slice(0, 300));
  console.log("  hasTransferFee", (info?.extensions ?? []).some(e => e.extension === "transferFeeConfig"), "freezeAuthority", info?.freezeAuthority, "decimals", info?.decimals);
}
