const r = await fetch("https://www.allhallowsgeek.com/wendys-frosty-frights-are-back-with-12-new-collectible-toys/", {headers:{"user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}});
const h = await r.text();
console.log(r.status, h.length);
const t = h.replace(/<script[\s\S]*?<\/script>/g,"").replace(/<style[\s\S]*?<\/style>/g,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ");
const i = t.search(/Purr/i);
console.log(t.slice(Math.max(0,i-2500), i+1200));
const imgs=[...h.matchAll(/<img[^>]+>/g)].map(m=>m[0]).filter(s=>/purr|frost|fright|wendy/i.test(s)).slice(0,15);
console.log(imgs.join("\n"));
