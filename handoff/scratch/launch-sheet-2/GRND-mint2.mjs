const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["GRNDYDpqwpCm6jVxpbh4xT5AM4r3p391qYsKTHqgaET2", { encoding: "jsonParsed" }] }) });
const j = await r.json(); const v = j.result?.value;
console.log("owner", v?.owner);
const info = v?.data?.parsed?.info;
console.log("extensions", (info?.extensions ?? []).map(e => e.extension).join(", "));
console.log("hasTransferFee", (info?.extensions ?? []).some(e => /transferFee/i.test(e.extension)));
console.log("freeze", info?.freezeAuthority, "decimals", info?.decimals);
