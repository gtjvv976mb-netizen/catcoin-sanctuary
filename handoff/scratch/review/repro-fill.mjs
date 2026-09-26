import { fillFromTransaction } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
const W = "J5sCaGHaVmUGsoYTsLnvoX71air9ffpaFnE959kudPt6", USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", KITTY = "KiTTYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const R = 1_488_440, P = 650_240, fee = 55_000;          // 165-byte and 0-byte rent minimums, read live 2026-09-25
const bal = (mint, amount) => ({ mint, owner: W, uiTokenAmount: { amount: String(amount), decimals: 6 } });
// a two-hop buy that landed: wallet's KITTY account address had P lamports before (outsider's transfer)
const meta = { err: null, fee, preBalances: [10_000_000, 2_039_280, P, 3_411_177], postBalances: [10_000_000 - fee - (R - P), 2_039_280, R, 3_411_177],
  preTokenBalances: [{ accountIndex: 1, ...bal(USDC, 100_000_000) }], postTokenBalances: [{ accountIndex: 1, ...bal(USDC, 85_000_000) }, { accountIndex: 2, ...bal(KITTY, 777) }] };
try { console.log(fillFromTransaction({ meta, slot: 1 }, { wallet: W, mint: KITTY, side: "buy", quoteMint: USDC, quoteDecimals: 6 })); }
catch (e) { console.log("fill reader:", e.clause, "—", e.message); }
