const u = "https://www.1800flowers.com/florist-designed-fabulous-feline-147205";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "accept": "text/html" } });
const t = await r.text();
console.log("status", r.status, "len", t.length);
const title = t.match(/<title[^>]*>([^<]*)/i); console.log("title ::", title && title[1]);
const clean = t.replace(/\\u002F/g, "/").replace(/\\"/g, '"');
for (const k of ["shortDescription", "longDescription", "carnation", "basket", "kitten", "whisker", "eyes", "ears", "bow", "collar", "pink", "white", "og:image", "\"image\""]) {
  const re = new RegExp(k, "gi"); let m, n = 0; const seen = new Set();
  while ((m = re.exec(clean)) && n < 3) { const s = clean.slice(Math.max(0, m.index - 120), m.index + 320).replace(/\s+/g, " "); const key = s.slice(100, 200); if (seen.has(key)) continue; seen.add(key); console.log(k, "::", s); n++; }
}
