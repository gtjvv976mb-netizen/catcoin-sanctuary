const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = { inputMint: "CB8afe6zJDGoCoSHx2iJACqemTUjgpvKKLTa86qMpump", outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", amount: "200000000000", slippageBps: "100", swapMode: "ExactIn", instructionVersion: "V2" };
for (const [k, x] of Object.entries({
  "direct, no maxAccounts": { onlyDirectRoutes: "true", restrictIntermediateTokens: "true" },
  "hop, no maxAccounts": { onlyDirectRoutes: "false", restrictIntermediateTokens: "true" },
  "hop, maxAccounts 24 (working tree)": { onlyDirectRoutes: "false", restrictIntermediateTokens: "true", maxAccounts: "24" },
  "hop, maxAccounts 28": { onlyDirectRoutes: "false", restrictIntermediateTokens: "true", maxAccounts: "28" },
  "hop, maxAccounts 32": { onlyDirectRoutes: "false", restrictIntermediateTokens: "true", maxAccounts: "32" },
})) { await sleep(1500); const r = await fetch(`https://lite-api.jup.ag/swap/v1/quote?${new URLSearchParams({ ...base, ...x })}`); const j = await r.json(); console.log(new Date().toISOString(), k, r.ok ? j.routePlan.map((h) => h.swapInfo.label).join(">") : `${r.status} ${j.errorCode}`); }
