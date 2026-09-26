import { detectCat } from "/home/user/Cat-Intelligence-Agency/bots/lib/catdetect.mjs";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const out = new Map();
for (const q of ["cat usdc", "cat usdt", "kitty usdc", "meow usdc", "neko usdc", "michi usdc", "mew usdc", "cats usdc", "catwif usdc", "popcat usdc", "wif cat usdc", "kitten usdc"]) {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
  const j = await r.json();
  for (const p of j.pairs ?? []) {
    if (p.chainId !== "solana") continue;
    if (![USDC, USDT].includes(p.quoteToken?.address)) continue;
    if (!detectCat({ name: p.baseToken.name, symbol: p.baseToken.symbol }).isCat) continue;
    const k = p.baseToken.address;
    const prev = out.get(k);
    const row = `${p.baseToken.symbol} "${p.baseToken.name}" ${p.dexId} q=${p.quoteToken.symbol} liqUsd=${Math.round(p.liquidity?.usd ?? 0)} pair=${p.pairAddress}`;
    if (!prev || (p.liquidity?.usd ?? 0) > prev.liq) out.set(k, { liq: p.liquidity?.usd ?? 0, row });
  }
  await new Promise((r) => setTimeout(r, 1100));
}
for (const [k, v] of [...out].sort((a, b) => b[1].liq - a[1].liq)) console.log(k, v.row);
