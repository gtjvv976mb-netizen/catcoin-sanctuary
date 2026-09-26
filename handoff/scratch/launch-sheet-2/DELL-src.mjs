const r = await fetch("https://www.bbc.com/news/technology-56010156", {headers:{"user-agent":"Mozilla/5.0 cat-sanctuary-research/1.0"}});
const h = await r.text();
console.log("status", r.status, "len", h.length);
const m = h.match(/<meta[^>]+(og:description|og:image|og:title|description)[^>]*>/gi) || [];
m.forEach(x=>console.log("META", x));
const alts = [...h.matchAll(/alt="([^"]{3,300})"/g)].map(x=>x[1]); console.log("ALTS", JSON.stringify([...new Set(alts)], null, 1));
const imgs = [...h.matchAll(/https:\/\/ichef\.bbci\.co\.uk\/[^"\s]+?\.(?:jpg|png|webp)/g)].map(x=>x[0]); console.log("IMGS", [...new Set(imgs)].slice(0,12).join("\n"));
const text = h.replace(/<script[\s\S]*?<\/script>/g," ").replace(/<style[\s\S]*?<\/style>/g," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ");
for (const k of ["kitten","cat","white","eyes","fluffy","grey","blue","Dell","Reallusion"]) {
  const re = new RegExp(`[^.]{0,200}\\b${k}\\b[^.]{0,200}`, "gi"); const mm = text.match(re)||[];
  console.log(`\n## ${k}: ${mm.length}`); [...new Set(mm)].slice(0,4).forEach(s=>console.log(" -", s.trim()));
}
