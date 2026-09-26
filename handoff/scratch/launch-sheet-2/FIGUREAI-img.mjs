const r = await fetch("https://www.figure.ai/news/introducing-figure-03");
const h = await r.text();
console.log(r.status, h.length);
const og = [...h.matchAll(/<meta[^>]+(?:property|name)="(?:og:image|twitter:image)"[^>]+content="([^"]+)"/g)].map(m=>m[1]);
console.log("og", og);
const imgs = [...new Set([...h.matchAll(/(https?:\/\/[^"' )]+\.(?:jpg|jpeg|png|webp))/gi)].map(m=>m[1]))].slice(0,40);
console.log(imgs.join("\n"));
