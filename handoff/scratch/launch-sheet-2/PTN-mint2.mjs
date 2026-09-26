const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["PTNzAfFAB4LvoUQEUUGrFMyUoRLExMYjH6CcfyQfsVP", { encoding: "jsonParsed" }] }) });
const j = await r.json(); const v = j.result?.value; const info = v?.data?.parsed?.info;
console.log("owner", v?.owner, "decimals", info?.decimals, "freeze", info?.freezeAuthority);
console.log("extensions", (info?.extensions ?? []).map(e => e.extension).join(", "));
console.log("transferFeeConfig", (info?.extensions ?? []).some(e => /transferFee/i.test(e.extension)));
