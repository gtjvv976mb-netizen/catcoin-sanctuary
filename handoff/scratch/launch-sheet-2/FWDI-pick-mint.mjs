const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["FWDtiB5fXHdVAewPqvHPL2dh4aBC1C6GacQbePoQXKjz", { encoding: "jsonParsed" }] }) });
const j = await r.json(); const v = j.result?.value; const info = v?.data?.parsed?.info ?? {};
console.log(JSON.stringify({ status: r.status, owner: v?.owner, decimals: info.decimals, freezeAuthority: info.freezeAuthority, mintAuthority: info.mintAuthority,
  extensions: (info.extensions ?? []).map(e => ({ ext: e.extension, state: e.extension === "tokenMetadata" ? { name: e.state?.name, symbol: e.state?.symbol } : e.state })),
  hasTransferFee: (info.extensions ?? []).some(e => /transferFee/i.test(e.extension)) }, null, 1));
