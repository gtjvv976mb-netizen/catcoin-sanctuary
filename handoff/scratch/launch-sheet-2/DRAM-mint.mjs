const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["DRAMjSWR7HRfJKjRkvQWYL2bcaejaVhuxEcjf4pAY4Cw", { encoding: "jsonParsed" }] }) });
const j = await r.json(); const v = j.result?.value;
const exts = v?.data?.parsed?.info?.extensions ?? [];
console.log(r.status, v?.owner, JSON.stringify(exts.map(e => e.extension)), "transferFee:", exts.some(e => /transferFee/i.test(e.extension)));
const pa = exts.find(e => e.extension === "pausableConfig"); if (pa) console.log("pausable:", JSON.stringify(pa.state));
