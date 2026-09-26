const H={headers:{"user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}};
for (const u of ["https://knowyourmeme.com/memes/oiiaoiia-cat-o-i-i-a-i-o-i-i-i-a-i","https://knowyourmeme.com/memes/spinning-cat","https://news.google.com/rss/search?q=%22OIIA%22+cat&hl=en-US&gl=US&ceid=US:en"]) {
  try{const r=await fetch(u,H); const h=await r.text(); console.log(u, r.status, h.length, (h.match(/<title>[^<]*/)||[""])[0]);
   if(u.includes("google")) for (const m of h.matchAll(/<item><title>([^<]*)<\/title><link>([^<]*)/g)) console.log(" *", m[1], m[2].slice(0,120));
  }catch(e){console.log(u,String(e))}
}
