const H={headers:{"user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}};
const u="https://knowyourmeme.com/memes/oo-ee-a-e-a-cat-remixes";
const r=await fetch(u,H); const h=await r.text(); console.log(u, r.status, h.length);
const t=h.replace(/<script[\s\S]*?<\/script>/g," ").replace(/<style[\s\S]*?<\/style>/g," ").replace(/<[^>]+>/g," ").replace(/&[a-z#0-9]+;/g," ").replace(/\s+/g," ");
const i=t.indexOf("About"); console.log(t.slice(t.indexOf("About",i+10)>0?i:0, i+4000));
for (const m of t.matchAll(/[^.]{0,300}\b(white|gr[ae]y|tabby|black|orange|fur|coat|Ethel|breed|kitten)\b[^.]{0,300}\./gi)) console.log("-", m[0].trim().slice(0,600));
for (const m of h.matchAll(/<img[^>]+(alt|data-src)="[^"]*"[^>]*>/g)) if(/cat|oiia|spin/i.test(m[0])) console.log("IMG", m[0].slice(0,300));
