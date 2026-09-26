const H={headers:{"user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}};
const r=await fetch("https://news.google.com/rss/search?q=%22OIIA%22+cat&hl=en-US&gl=US&ceid=US:en",H); const x=await r.text();
for (const m of x.matchAll(/<item><title>([^<]*)<\/title><link>([^<]*)<\/link>[\s\S]*?<description>([^<]*)/g)) if(/Know Your Meme|perfectcorp|edmnomad|Ethel|adoptapet/i.test(m[1])) console.log(m[1],"\n",m[2],"\n", m[3].slice(0,300));
const r2=await fetch("https://news.google.com/rss/search?q=Ethel+OIIA+cat&hl=en-US&gl=US&ceid=US:en",H); const x2=await r2.text();
for (const m of x2.matchAll(/<item><title>([^<]*)<\/title>/g)) console.log(" *", m[1]);
