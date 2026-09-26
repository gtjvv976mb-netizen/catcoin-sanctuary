const u="https://redditinc.com/news/announcing-the-winners-of-the-internet-awards-redditors-vote-on-the-best-of-the-internet";
const r=await fetch(u,{headers:{"user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}});
const h=await r.text();
console.log(r.status, h.length);
const t=h.replace(/<script[\s\S]*?<\/script>/g," ").replace(/<style[\s\S]*?<\/style>/g," ").replace(/<[^>]+>/g," ").replace(/&[a-z#0-9]+;/g," ").replace(/\s+/g," ");
for (const m of t.matchAll(/[^.]{0,400}(OIIA|Spinning|cat\b|Cat\b)[^.]{0,400}\./g)) console.log("-", m[0].trim());
for (const m of h.matchAll(/<img[^>]+>/g)) console.log("IMG", m[0].slice(0,300));
