const url = "https://raw.githubusercontent.com/MarvellEmbeddedProcessors/linux-marvell/c8ae519736bba6de02ace596b438f14d168648ae/drivers/net/ethernet/mvebu_net/prestera/pci/mv_prestera_pci.h";
const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
const t = await r.text();
console.log("status", r.status, "len", t.length);
for (const line of t.split("\n")) if (/copyright|alleycat|bobcat|lion|cat|puma|cheetah|tiger/i.test(line)) console.log("|", line.trim());
const rpc = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["MRVLSjkR2ceUBukujaD3xCyHP1H3B2SzpsNTZF546jo", { encoding: "jsonParsed" }] }) });
const j = await rpc.json(); const p = j?.result?.value?.data?.parsed?.info;
console.log(JSON.stringify({ owner: j?.result?.value?.owner, extensions: (p?.extensions ?? []).map(e => ({ extension: e.extension, state: ["transferFeeConfig","transferHook","scaledUiAmountConfig","pausableConfig","permanentDelegate","defaultAccountState"].includes(e.extension) ? e.state : undefined })) }, null, 1));
