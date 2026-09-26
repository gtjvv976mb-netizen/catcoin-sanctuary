const url = "https://www.newsweek.com/viral-photo-shows-cats-huddled-500-elon-musk-developed-satellite-dish-stay-warm-1669550";
const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "accept": "text/html" } });
const h = await r.text();
console.log(r.status, h.length);
const text = h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
for (const k of ["five cats", "cats", "Aaron Taylor", "huddled", "warm", "tabby", "kittens"]) {
  let i = text.indexOf(k); let n = 0;
  while (i >= 0 && n < 3) { console.log("--", k, ":", text.slice(Math.max(0, i - 250), i + 300)); i = text.indexOf(k, i + 300); n++; }
}
const imgs = [...h.matchAll(/https?:\/\/[^"' ]+\.(?:jpg|jpeg|png|webp)[^"' ]*/g)].map(m => m[0]).filter(u => /d\.newsweek|twimg/.test(u));
console.log([...new Set(imgs)].slice(0, 10).join("\n"));
