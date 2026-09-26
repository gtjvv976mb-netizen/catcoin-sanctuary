const u="https://redditinc.com/news/announcing-the-winners-of-the-internet-awards-redditors-vote-on-the-best-of-the-internet";
const r=await fetch(u,{headers:{"user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}});
const h=await r.text();
const t=h.replace(/<script[\s\S]*?<\/script>/g," ").replace(/<style[\s\S]*?<\/style>/g," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/\s+/g," ");
const i=t.indexOf("Internet Awards");
console.log(t.slice(i, i+6000));
console.log("OIIA idx", t.search(/OIIA/i));
