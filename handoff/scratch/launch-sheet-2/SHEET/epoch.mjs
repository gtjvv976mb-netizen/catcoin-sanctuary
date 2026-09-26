const r = await fetch("https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getEpochInfo" }) });
const j = await r.json(); const e = j.result;
const left = e.slotsInEpoch - e.slotIndex;
console.log(JSON.stringify({ now: new Date().toISOString(), ...e, slotsLeft: left, etaAt400ms: new Date(Date.now() + left * 400).toISOString() }));
