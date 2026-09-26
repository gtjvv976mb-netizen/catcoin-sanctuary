/* The same two asks on api.jup.ag, the host the extension uses (keyless, 0.5/s). */
import * as NEW from "/home/user/Cat-Intelligence-Agency/src/lib/jupiter-swap.mjs";
import * as OLD from "./head/src/lib/jupiter-swap.mjs";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const nj = NEW.createJupiterClient(), oj = OLD.createJupiterClient();
for (const [tok, amt] of [["CB8afe6zJDGoCoSHx2iJACqemTUjgpvKKLTa86qMpump", "1700000000000"], ["5pYB12kEhfhSFXJjZ7JtyqDpt6uUqhsF6iu6Ee9spump", "100000000000"]]) {
  for (const [label, J, x] of [["HEAD", oj, {}], ["working tree", nj, { solHop: true }]]) {
    try { const q = await J.quote({ inputMint: tok, outputMint: USDC, amountRaw: amt, slippageBps: 100, priority: "live", ...x }); console.log(tok.slice(0, 6), "sell", label, "->", q.routePlan.map((h) => h.swapInfo.label).join(">"), "out", q.outAmount); }
    catch (e) { console.log(tok.slice(0, 6), "sell", label, "->", `jupiter_${e.code}: ${e.message}`); }
  }
}
