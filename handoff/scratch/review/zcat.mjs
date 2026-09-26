import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
import { describeMint, parseMintExtensions, assertTradeableExtensions } from "/home/user/Cat-Intelligence-Agency/vendor/executor/token2022.mjs";
import { normalizeAgentSpec } from "/home/user/Cat-Intelligence-Agency/src/lib/agent-strategy.mjs";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const mint = "HcRLc9VDgjLeK154xDawfb1dmVJ98DoSqcwTHGqiDeJR";
const r = await rpc.getMultipleAccounts([mint]);
const a = r.accounts[0];
const d = describeMint(a, mint);
console.log("describeMint", { program: d.program, decimals: d.decimals, initialized: d.initialized, paused: d.paused, mintAuthority: d.mintAuthority, freezeAuthority: d.freezeAuthority });
try { assertTradeableExtensions(parseMintExtensions(Buffer.from(a.data[0], "base64")), mint); console.log("extensions: tradeable"); } catch (e) { console.log("extensions refused", e.message); }
const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${mint}`); const listed = (await res.json()).find((t) => t.id === mint);
console.log("jupiter list", listed?.name, listed?.symbol);
try {
  const spec = normalizeAgentSpec({ name: "t", strategy: "t", custom: [{ mint, symbol: "ZCAT", name: listed.name, jupiterSymbol: listed.symbol, decimals: d.decimals, program: d.program, verifiedAt: Date.now() }], universe: [mint] });
  console.log("normalizeAgentSpec accepts it; custom:", JSON.stringify(spec.custom?.map((c) => [c.symbol, c.program])));
} catch (e) { console.log("normalizeAgentSpec refused", e.clause, e.message); }
