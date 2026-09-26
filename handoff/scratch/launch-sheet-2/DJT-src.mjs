const url = "https://www.salon.com/2024/09/10/shares-anti-haitian-cat-memes-ahead-of-first-presidential-debate/";
const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "accept": "text/html" } });
const h = await r.text();
console.log("status", r.status, "len", h.length);
const t = h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#8217;|&rsquo;/g, "'").replace(/&quot;|&#8220;|&#8221;/g, '"').replace(/\s+/g, " ");
for (const k of ["orange tabby", "tabby", "datePublished", "og:image"]) {
  let i = -1; let n = 0;
  const src = k.startsWith("og:") || k === "datePublished" ? h : t;
  while ((i = src.indexOf(k, i + 1)) !== -1 && n < 3) { console.log(`[${k}]`, src.slice(Math.max(0, i - 250), i + 300)); n++; }
}
const imgs = [...h.matchAll(/<img[^>]+(?:src|data-src)="([^"]+)"[^>]*>/g)].map(m => m[0]).filter(s => /cat|trump|ai/i.test(s)).slice(0, 10);
console.log(imgs.join("\n"));
