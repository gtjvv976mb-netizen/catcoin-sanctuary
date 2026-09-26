const r = await fetch("https://defidevcorp.com/");
const h = await r.text();
console.log("status", r.status, "len", h.length);
console.log("title:", (h.match(/<title>([^<]*)<\/title>/i)||[])[1]);
const desc = h.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i); console.log("desc:", desc && desc[1]);
const text = h.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ");
for (const kw of ["treasury","validator","Solana","SOL per share","accumulat"]) { const i = text.search(new RegExp(kw,"i")); console.log(kw, "=>", i<0?"(none)":text.slice(Math.max(0,i-120), i+160)); }
const cat = text.match(/\b(cat|cats|kitten|kitty|feline|mascot|meow|lion|tiger|panther|jaguar|leopard)\b/gi); console.log("cat hits:", cat);
console.log("imgs:", [...new Set([...h.matchAll(/(?:src|href)="([^"]+\.(?:png|webp|jpg|svg))"/gi)].map(m=>m[1]))].slice(0,20));
