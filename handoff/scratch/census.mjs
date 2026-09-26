import fs from "node:fs";
import { detectCat } from "/home/user/Cat-Intelligence-Agency/bots/lib/catdetect.mjs";
const SP = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => { for (let i = 0; i < 3; i++) { const r = await fetch(url); if (r.status === 429) { await sleep(3000); continue; } if (!r.ok) return null; return r.json(); } return null; };
const all = new Map(); const via = new Map();
const add = (t, src) => { if (!t?.id) return; if (!all.has(t.id)) all.set(t.id, t); (via.get(t.id) ?? via.set(t.id, new Set()).get(t.id)).add(src); };
// 1. every verified token
const verified = await get("https://lite-api.jup.ag/tokens/v2/tag?query=verified");
console.log("verified list:", verified?.length);
for (const t of verified ?? []) add(t, "verified-list");
// 2. categories
for (const c of ["toporganicscore", "toptraded", "toptrending"]) for (const i of ["5m", "1h", "6h", "24h"]) { const r = await get(`https://lite-api.jup.ag/tokens/v2/${c}/${i}?limit=100`); for (const t of r ?? []) add(t, `${c}/${i}`); await sleep(1100); }
const recent = await get("https://lite-api.jup.ag/tokens/v2/recent"); for (const t of recent ?? []) add(t, "recent");
// 3. search terms
const terms = ["cat","cats","kitty","kitten","meow","neko","nyan","purr","popcat","mew","michi","catwifhat","wifcat","catcoin","grumpy","tabby","feline","gato","kat","miau","manekineko","maneki","catnip","tomcat","bobcat","calico","siamese","persian","sphynx","garfield","keyboard cat","nyancat","hat cat","sad cat","banana cat","smudge","maxwell","floppa","bingus","chonk","catalina","kucing","mao","cheems cat","toshi","billy","mog","cate","catdog","pepecat","dogcat","catgirl","catsino","catfi","purrfect","meowcoin","catbread","cattoken","luna cat","moon cat","kitties","lil cat","big cat","fat cat","cool cat","based cat","mr cat","doge cat","sol cat","cat in a dogs world","simons cat","hello kitty","wif","cat sol","kitten haimer","pussy","puss","furr","whiskers","paws","ginger cat","black cat","orange cat","cat meme","memecat","catcoin sol"];
for (const q of terms) { const r = await get(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`); for (const t of r ?? []) add(t, `search:${q}`); await sleep(1100); }
// 4. DexScreener search
for (const q of ["cat","kitty","meow","popcat","mew","nyan","neko","purr","michi","kitten"]) {
  const r = await get(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
  for (const p of r?.pairs ?? []) if (p.chainId === "solana") { if (!all.has(p.baseToken.address)) all.set(p.baseToken.address, { id: p.baseToken.address, name: p.baseToken.name, symbol: p.baseToken.symbol, fromDex: true, liquidity: p.liquidity?.usd }); (via.get(p.baseToken.address) ?? via.set(p.baseToken.address, new Set()).get(p.baseToken.address)).add(`dexscreener:${q}`); }
  await sleep(1200);
}
const cats = [...all.values()].map((t) => ({ t, cat: detectCat({ name: t.name, symbol: t.symbol }) })).filter((x) => x.cat.isCat);
const rows = cats.map(({ t, cat }) => ({ mint: t.id, symbol: t.symbol, name: t.name, catWord: cat.word, field: cat.field, verified: t.isVerified ?? null, tags: t.tags ?? [], program: t.tokenProgram ?? null, decimals: t.decimals ?? null,
  liquidityUsd: t.liquidity ?? null, mcapUsd: t.mcap ?? null, holders: t.holderCount ?? null, organicScore: t.organicScore ?? null, mintAuthorityDisabled: t.audit?.mintAuthorityDisabled ?? null, freezeAuthorityDisabled: t.audit?.freezeAuthorityDisabled ?? null,
  topHoldersPct: t.audit?.topHoldersPercentage ?? null, firstPoolAt: t.firstPool?.createdAt ?? null, vol24h: t.stats24h ? (t.stats24h.buyVolume ?? 0) + (t.stats24h.sellVolume ?? 0) : null, price24hPct: t.stats24h?.priceChange ?? null, via: [...via.get(t.id)] }))
  .sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
fs.writeFileSync(`${SP}/census.json`, JSON.stringify({ at: new Date().toISOString(), seen: all.size, cats: rows }, null, 1));
const n = (f) => rows.filter(f).length;
console.log("tokens seen:", all.size, "cat coins:", rows.length);
for (const L of [1e3, 1e4, 2.5e4, 5e4, 1e5, 2.5e5, 1e6]) console.log(`liq >= $${L}:`, n((r) => (r.liquidityUsd ?? 0) >= L), " + no mint/freeze auth:", n((r) => (r.liquidityUsd ?? 0) >= L && r.mintAuthorityDisabled && r.freezeAuthorityDisabled), " + verified:", n((r) => (r.liquidityUsd ?? 0) >= L && r.mintAuthorityDisabled && r.freezeAuthorityDisabled && r.verified));
console.log("verified cats:", n((r) => r.verified));
for (const r of rows.slice(0, 60)) console.log(r.symbol.padEnd(12), (r.name ?? "").slice(0, 24).padEnd(25), String(Math.round(r.liquidityUsd ?? 0)).padStart(10), r.verified ? "V" : "-", r.mintAuthorityDisabled ? "m" : "M", r.freezeAuthorityDisabled ? "f" : "F", (r.program ?? "").slice(0, 6), r.firstPoolAt?.slice(0, 10) ?? "", r.catWord);
