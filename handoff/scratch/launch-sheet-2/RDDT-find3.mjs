const H={headers:{"user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}};
for (const u of ["https://knowyourmeme.com/memes/oo-ee-a-e-a-cat","https://knowyourmeme.com/memes/oiia-cat-spinning-cat"]) {
  try{const r=await fetch(u,H); const h=await r.text(); console.log(u, r.status, h.length, (h.match(/<title>[^<]*/)||[""])[0]);
   if(r.status===200){const t=h.replace(/<script[\s\S]*?<\/script>/g," ").replace(/<style[\s\S]*?<\/style>/g," ").replace(/<[^>]+>/g," ").replace(/&[a-z#0-9]+;/g," ").replace(/\s+/g," ");
    for (const m of t.matchAll(/[^.]{0,300}\b(white|gr[ae]y|tabby|black|orange|fur|coat|Ethel|spinning|spins)\b[^.]{0,300}\./gi)) console.log("-", m[0].trim().slice(0,600));}
  }catch(e){console.log(u,String(e))}
}
