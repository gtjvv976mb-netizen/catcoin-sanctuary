import { detectCat } from "/home/user/Cat-Intelligence-Agency/bots/lib/catdetect.mjs";
const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const seen = new Map();
for (const q of ["kitty", "kitten", "meow", "neko", "cats", "kat", "pussy", "catwif", "popcat", "catcoin", "michi", "cat pump"]) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`);
  const j = await r.json();
  for (const t of j) if (t.tokenProgram === T22 && !seen.has(t.id) && detectCat({ name: t.name, symbol: t.symbol }).isCat && (t.liquidity ?? 0) > 50_000) seen.set(t.id, `${t.symbol} ${t.name} liq=${Math.round(t.liquidity)}`);
  await new Promise((r) => setTimeout(r, 1100));
}
for (const [k, v] of seen) console.log(k, v);
