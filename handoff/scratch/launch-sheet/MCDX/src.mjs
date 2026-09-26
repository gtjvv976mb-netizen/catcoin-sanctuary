const u = "https://www.today.com/food/restaurants/mcdonalds-hello-kitty-godzilla-happy-meal-toys-rcna592162";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
const t = await r.text();
console.log(r.status, t.length, (t.match(/"datePublished"\s*:\s*"([^"]+)"/)||[])[1]);
const text = t.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<[^>]+>/g," ").replace(/&#x27;|&#39;|&rsquo;/g,"'").replace(/&amp;/g,"&").replace(/\s+/g," ");
for (const k of ["cute meets kaiju","cosplaying right into","Aug. 18","participating","white"]) { const i = text.toLowerCase().indexOf(k.toLowerCase()); console.log(k, "=>", i<0?"NOT FOUND":text.slice(Math.max(0,i-120), i+160)); }
