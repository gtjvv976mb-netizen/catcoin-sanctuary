const H={headers:{"user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}};
for (const q of ["OIIA cat","spinning cat meme OIIA"]) {
  const r=await fetch("https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch="+encodeURIComponent(q),H);
  const j=await r.json(); console.log(q, j.query?.search?.slice(0,6).map(s=>s.title+" | "+s.snippet.replace(/<[^>]+>/g,"")));
}
for (const u of ["https://knowyourmeme.com/memes/oiiaoiia-cat-o-i-i-a-i-o-i-i-i-a-i","https://knowyourmeme.com/memes/spinning-cat","https://knowyourmeme.com/search?q=oiia"]) {
  try{const r=await fetch(u,H); const h=await r.text(); console.log(u, r.status, h.length, (h.match(/<title>[^<]*/)||[""])[0]);}catch(e){console.log(u,String(e))}
}
