const url = "https://www.foxnews.com/lifestyle/stray-kitten-rescued-airport-adopted-safety-officer";
const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" } });
const h = await r.text();
console.log("status", r.status, "len", h.length);
const text = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const i = text.indexOf("Workers at Louisville");
console.log(text.slice(Math.max(0, i - 300), i + 3000));
for (const k of ["gray","grey","orange","ginger","black","white","tabby","calico","tuxedo","striped","stripes","brown","tan","fluffy","eyes","paws","coat","fur","color"]) {
  const re = new RegExp(`[^.]{0,200}\\b${k}\\b[^.]{0,200}`, "gi"); const m = text.match(re) || [];
  if (m.length) { console.log(`\n## ${k}: ${m.length}`); m.slice(0,3).forEach(s=>console.log(" -", s.trim().slice(0,300))); }
}
const imgs = [...h.matchAll(/https:\/\/[^"' ]+?\.(?:jpg|jpeg|png|webp)[^"' ]*/gi)].map(m=>m[0]);
console.log("\nIMAGES"); [...new Set(imgs)].slice(0,40).forEach(u=>console.log(u));
const og = h.match(/<meta[^>]+property="og:image"[^>]+>/gi); console.log("OG", og);
const caps = [...h.matchAll(/caption[^>]*>([\s\S]{0,300}?)</gi)].map(m=>m[1]); console.log("CAPS", caps.slice(0,10));
