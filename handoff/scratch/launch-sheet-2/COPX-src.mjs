const r = await fetch("https://www.globalxetfs.com/funds/copx/", { headers: { "user-agent": "Mozilla/5.0 (cat-sanctuary-research)" } });
const h = await r.text();
const t = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g,"&").replace(/&#39;|&rsquo;/g,"'").replace(/\s+/g, " ");
console.log("status", r.status, "len", t.length);
console.log("title ::", (h.match(/<title>([^<]*)/i) || [])[1]);
for (const k of ["seeks to provide", "copper mining", "Copper Miners", "Solactive", "Inception", "Net Assets", "Key Features", "Holdings"]) {
  const i = t.indexOf(k); if (i >= 0) console.log(k, "::", t.slice(Math.max(0, i - 120), i + 320));
}
console.log("cat-ish:", (t.match(/\b(cat|cats|kitten|kitty|feline|lion|tiger|panther|jaguar|leopard|puma|cheetah|mascot)\b/gi) || []).join(",") || "(none)");
