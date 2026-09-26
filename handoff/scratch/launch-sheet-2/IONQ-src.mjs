const url = "https://ionq.com/walking-cat";
const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
const html = await r.text();
const text = html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&[a-z#0-9]+;/g," ").replace(/\s+/g," ");
console.log("status", r.status, "len", html.length);
const t = (html.match(/<title>([^<]*)<\/title>/i)||[])[1]; console.log("title:", t);
for (const kw of ["trapped","ion ","ions","laser","chip","move","walk","Cat:","factor","glow","light","atom"]) {
  let i = -1, n = 0;
  while ((i = text.indexOf(kw, i + 1)) !== -1 && n < 3) { console.log(`[${kw}]`, text.slice(Math.max(0,i-120), i+160)); n++; }
}
