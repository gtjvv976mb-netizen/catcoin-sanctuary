/* Reproduction: a cat coin whose USDC pool is on PumpSwap (Pump.fun Amm). HEAD's agent ask
   (direct only) finds it; the working tree's one-hop ask (maxAccounts 24) answers
   NO_ROUTES_FOUND, both ways. Plus which parameter causes it, and whether the agent would
   admit the coin at all. Nothing is signed. */
import fs from "node:fs";
import * as NEW from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import * as OLD from "./head/src/lib/jupiter-swap.mjs";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
import { describeMint, parseMintExtensions, assertTradeableExtensions } from "/home/user/Cat-Intelligence-Agency/vendor/executor/token2022.mjs";
import { normalizeAgentSpec } from "/home/user/Cat-Intelligence-Agency/src/lib/agent-strategy.mjs";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const nj = NEW.createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_300 });
const oj = OLD.createJupiterClient({ baseUrl: "https://lite-api.jup.ag/swap/v1", intervalMs: 1_300 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mints = (process.env.MINTS ?? "CB8afe6zJDGoCoSHx2iJACqemTUjgpvKKLTa86qMpump,5pYB12kEhfhSFXJjZ7JtyqDpt6uUqhsF6iu6Ee9spump").split(",");
const saved = { capturedAt: new Date().toISOString(), rows: [] };
const raw = async (query) => {
  await sleep(1_300);
  const r = await fetch(`https://lite-api.jup.ag/swap/v1/quote?${new URLSearchParams(query)}`);
  const j = await r.json();
  return r.ok ? `${j.routePlan.map((h) => h.swapInfo.label).join(">")} out=${j.outAmount}` : `${r.status} ${j.errorCode}`;
};
const acc = await rpc.getMultipleAccounts(mints);
for (const [i, mint] of mints.entries()) {
  const a = acc.accounts[i];
  const d = describeMint(a, mint);
  let ext = "classic"; if (d.program !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") { try { assertTradeableExtensions(parseMintExtensions(Buffer.from(a.data[0], "base64")), mint); ext = "Token-2022, tradeable"; } catch (e) { ext = e.message; } }
  await sleep(1_100);
  const listed = (await (await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${mint}`)).json()).find((t) => t.id === mint);
  let admitted;
  try { normalizeAgentSpec({ name: "t", strategy: "t", custom: [{ mint, symbol: listed.symbol.replace(/[^A-Za-z0-9$._-]/g, "").slice(0, 12) || "X", name: listed.name, jupiterSymbol: listed.symbol, decimals: d.decimals, program: d.program, verifiedAt: Date.now() }], universe: [mint] }); admitted = "admitted"; } catch (e) { admitted = `${e.clause}: ${e.message}`; }
  const row = { mint, name: listed?.name, symbol: listed?.symbol, program: d.program, extensions: ext, mintAuthority: d.mintAuthority, freezeAuthority: d.freezeAuthority, agentSpec: admitted };
  /* The sell a held position makes: what $25 of USDC buys, back to USDC. */
  let buyOut = null;
  try { buyOut = (await oj.quote({ inputMint: USDC, outputMint: mint, amountRaw: "25000000", slippageBps: 100, priority: "live" })).outAmount; } catch (e) { row.headBuy = `${e.code}: ${e.message}`; }
  const amt = buyOut ?? "1000000";
  for (const [label, J, x] of [["HEAD agent ask (direct only)", oj, {}], ["working-tree agent ask (solHop)", nj, { solHop: true }]]) {
    for (const [side, inputMint, outputMint, amountRaw] of [["buy", USDC, mint, "25000000"], ["sell", mint, USDC, amt]]) {
      try { const q = await J.quote({ inputMint, outputMint, amountRaw, slippageBps: 100, priority: "live", ...x }); row[`${label} ${side}`] = `${q.routePlan.map((h) => h.swapInfo.label).join(">")} impact=${(Number(q.priceImpactPct) * 100).toFixed(2)}%`; }
      catch (e) { row[`${label} ${side}`] = `jupiter_${e.code}: ${e.message}`; }
    }
  }
  const base = { inputMint: mint, outputMint: USDC, amount: amt, slippageBps: "100", swapMode: "ExactIn", instructionVersion: "V2" };
  row.diag_sell = {
    "onlyDirectRoutes=true (HEAD)": await raw({ ...base, onlyDirectRoutes: "true", restrictIntermediateTokens: "true" }),
    "onlyDirectRoutes=true, maxAccounts=24": await raw({ ...base, onlyDirectRoutes: "true", restrictIntermediateTokens: "true", maxAccounts: "24" }),
    "onlyDirectRoutes=false, restrict=true, no maxAccounts": await raw({ ...base, onlyDirectRoutes: "false", restrictIntermediateTokens: "true" }),
    "onlyDirectRoutes=false, restrict=true, maxAccounts=24 (working tree)": await raw({ ...base, onlyDirectRoutes: "false", restrictIntermediateTokens: "true", maxAccounts: "24" }),
    "onlyDirectRoutes=false, restrict=true, maxAccounts=32": await raw({ ...base, onlyDirectRoutes: "false", restrictIntermediateTokens: "true", maxAccounts: "32" }),
  };
  saved.rows.push(row);
  console.log(JSON.stringify(row, null, 1));
}
fs.writeFileSync(`pumpswap-repro-${Date.now()}.json`, JSON.stringify(saved, null, 1));
