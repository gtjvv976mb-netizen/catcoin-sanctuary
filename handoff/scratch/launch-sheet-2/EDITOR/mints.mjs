import fs from "node:fs";
const SP = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad";
const PAIRS = JSON.parse(fs.readFileSync(`${SP}/stockcats/stonkfun-pairs.json`)).data.pairs;
const F = JSON.parse(fs.readFileSync("final.json"));
const rows = [];
for (const c of F) {
  const sym = c.disc.match(/^A cat coin priced in (\S+?)\./)[1];
  const ps = PAIRS.filter((p) => p.symbol === sym && ["backpack", "prestock", "tessera"].includes(p.category));
  for (const p of ps) rows.push({ k: c.k, sym, name: p.name, mint: p.mint, category: p.category, label: p.categoryLabel, launchable: p.launchable, launchLabReady: p.launchLabReady, tokenProgram: p.tokenProgram, symbolAmbiguous: p.symbolAmbiguous, others: PAIRS.filter((q) => q.symbol === sym && q.mint !== p.mint).map((q) => `${q.category}:${q.name}:${q.mint}`) });
}
const RPC = "https://api.mainnet-beta.solana.com";
const rpc = async (method, params) => (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json());
const epoch = (await rpc("getEpochInfo", [])).result;
for (let i = 0; i < rows.length; i += 50) {
  const chunk = rows.slice(i, i + 50);
  const r = await rpc("getMultipleAccounts", [chunk.map((x) => x.mint), { encoding: "jsonParsed" }]);
  r.result.value.forEach((a, j) => {
    const info = a?.data?.parsed?.info; const ex = info?.extensions ?? [];
    const fee = ex.find((e) => e.extension === "transferFeeConfig")?.state;
    const pause = ex.find((e) => e.extension === "pausableConfig")?.state;
    Object.assign(chunk[j], { owner: a?.owner, decimals: info?.decimals, freeze: !!info?.freezeAuthority, exts: ex.map((e) => e.extension),
      fee: fee ? { older: [fee.olderTransferFee.epoch, fee.olderTransferFee.transferFeeBasisPoints], newer: [fee.newerTransferFee.epoch, fee.newerTransferFee.transferFeeBasisPoints] } : null, paused: pause?.paused });
  });
}
fs.writeFileSync("mints.out.json", JSON.stringify({ epoch, rows }, null, 1));
console.log("epoch", epoch.epoch, epoch.slotIndex, epoch.slotsInEpoch);
for (const r of rows) console.log(r.k.padEnd(12), r.category.padEnd(8), r.launchable, r.launchLabReady, r.symbolAmbiguous, r.tokenProgram?.slice(0, 6), r.owner?.slice(0, 6), "fee:", JSON.stringify(r.fee), "paused:", r.paused, "freeze:", r.freeze, "pd:", r.exts?.includes("permanentDelegate"), r.others.length ? "OTHERS:" + r.others.join(" | ") : "");
