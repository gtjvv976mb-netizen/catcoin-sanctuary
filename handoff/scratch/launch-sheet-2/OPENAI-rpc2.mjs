const rpc = async (method, params) => (await (await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
const ep = await rpc("getEpochInfo", []);
const out = { epoch: ep?.epoch, slotIndex: ep?.slotIndex, slotsInEpoch: ep?.slotsInEpoch };
for (const mint of ["oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ", "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF"]) {
  const v = await rpc("getAccountInfo", [mint, { encoding: "jsonParsed" }]);
  const info = v?.value?.data?.parsed?.info;
  out[mint] = { owner: v?.value?.owner, ext: (info?.extensions ?? []).map(e => e.extension === "transferFeeConfig" ? { transferFeeConfig: { older: e.state.olderTransferFee.transferFeeBasisPoints + "bps@" + e.state.olderTransferFee.epoch, newer: e.state.newerTransferFee.transferFeeBasisPoints + "bps@" + e.state.newerTransferFee.epoch } } : e.extension === "pausableConfig" ? { pausableConfig: e.state } : e.extension === "defaultAccountState" ? { defaultAccountState: e.state } : e.extension) };
}
console.log(JSON.stringify(out, null, 1));
