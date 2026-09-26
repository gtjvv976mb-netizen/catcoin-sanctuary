const H={headers:{"user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}};
for (const u of ["https://knowyourmeme.com/search?q=oiiai","https://knowyourmeme.com/search?q=oo+ee+a+e+a+cat"]) {
  const r=await fetch(u,H); const h=await r.text(); console.log(u, r.status, h.length);
  const s=new Set([...h.matchAll(/href="(\/(memes|editorials)[^"]+)"/g)].map(m=>m[1]).filter(x=>/oiia|oo-ee|spinning|cat/i.test(x)));
  console.log([...s].slice(0,20).join("\n"));
}
