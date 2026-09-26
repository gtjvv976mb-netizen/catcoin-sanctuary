const u="https://www.si.com/fannation/sneakers/news/air-jordan-4-black-cat-is-ready-to-pounce-on-black-friday";
const r=await fetch(u,{headers:{"user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}});
const h=await r.text();
console.log(r.status, h.length);
const t=h.replace(/<script[\s\S]*?<\/script>/g," ").replace(/<style[\s\S]*?<\/style>/g," ").replace(/<[^>]+>/g," ").replace(/&[a-z#0-9]+;/g," ").replace(/\s+/g," ");
const i=t.search(/Black Cat/); 
for (const m of t.matchAll(/[^.]{0,300}(black|graphite|grey|gray|nubuck|suede|colorway|panther|cat)[^.]{0,300}\./gi)) console.log("-", m[0].trim());
