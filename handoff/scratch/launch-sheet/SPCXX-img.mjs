const url = "https://www.newsweek.com/viral-photo-shows-cats-huddled-500-elon-musk-developed-satellite-dish-stay-warm-1669550";
const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" } });
const h = await r.text();
const og = h.match(/property="og:image"\s+content="([^"]+)"/)?.[1] || h.match(/content="([^"]+)"\s+property="og:image"/)?.[1];
console.log("og:image", og);
const tw = [...h.matchAll(/twitter\.com\/[A-Za-z0-9_]+\/status\/\d+/g)].map(m=>m[0]);
console.log([...new Set(tw)]);
const cap = [...h.matchAll(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/g)].map(m=>m[1].replace(/<[^>]+>/g,"").trim());
console.log(cap);
if (og) { const ir = await fetch(og); const b = Buffer.from(await ir.arrayBuffer()); (await import("node:fs")).writeFileSync("SPCXX-newsweek.jpg", b); console.log("saved", ir.status, b.length, ir.headers.get("content-type")); }
