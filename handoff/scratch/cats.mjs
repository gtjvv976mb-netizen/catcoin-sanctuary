import { detectCat } from "/home/user/Cat-Intelligence-Agency/bots/lib/catdetect.mjs";
const terms = ["cat","popcat","mew","michi","kitty","kitten","meow","neko","nyan","purr","catwifhat","mog","billy","manekineko","gato","maneki","grumpy","catcoin","simon","toshi","cats","kat","tabby","hat cat","wif cat","sad cat","zerebro"];
const seen = new Map();
for (const t of terms) {
  const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(t)}`); const j = await r.json();
  for (const x of j) if (!seen.has(x.id)) seen.set(x.id, x);
  await new Promise(r=>setTimeout(r,400));
}
const rows = [...seen.values()].filter(x => detectCat({ name: x.name, symbol: x.symbol }).isCat ?? detectCat({ name: x.name, symbol: x.symbol }))
  .filter(x => x.isVerified).sort((a,b)=>(b.liquidity??0)-(a.liquidity??0));
for (const x of rows.slice(0,25)) console.log(x.id, x.symbol, JSON.stringify(x.name), x.decimals, x.tokenProgram.slice(0,6), Math.round(x.liquidity), Math.round(x.mcap), (x.tags||[]).join("|"), x.holderCount);
console.log(JSON.stringify(detectCat({name:"Popcat",symbol:"POPCAT"})));
