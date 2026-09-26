const u = "https://www.1800flowers.com/florist-designed-fabulous-feline-147205";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "accept": "text/html" } });
const t = await r.text();
const i = t.indexOf("One-sided arrangement");
console.log(r.status, t.slice(i, i + 600).replace(/<[^>]+>/g, " | "));
const imgs = [...new Set((t.match(/[^"' ]*147205[^"' ]*\.(?:jpg|jpeg|png|webp)[^"' ]*/gi) || []))].slice(0, 5);
console.log(imgs);
