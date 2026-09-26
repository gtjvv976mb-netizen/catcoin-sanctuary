const url = process.argv[2];
const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" } });
const html = await r.text();
console.log("STATUS", r.status, html.length);
const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g," ").replace(/&#39;|&rsquo;/g,"'").replace(/&quot;|&ldquo;|&rdquo;/g,'"').replace(/\s+/g, " ");
const re = new RegExp(process.argv[3] || "cat", "gi");
let m; const seen = new Set();
while ((m = re.exec(text))) { const s = Math.max(0, m.index - 300); const k = Math.floor(s/400); if (seen.has(k)) continue; seen.add(k); console.log("...", text.slice(s, m.index + 400), "\n"); }
const imgs = [...html.matchAll(/<img[^>]+>/gi)].map(x=>x[0]).filter(x=>/cat|pet|avatar|balloon/i.test(x));
console.log("IMGS", imgs.slice(0,20).join("\n"));
