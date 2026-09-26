const u = "https://www.popsugar.com/fitness/lululemon-lunar-new-year-collection-2022-48693678";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" } });
const h = await r.text();
console.log("status", r.status, "len", h.length);
const t = h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
for (const re of [/tiger/gi, /print/gi, /red/gi]) {
  const seen = new Set();
  for (const m of t.matchAll(re)) { const s = t.slice(Math.max(0, m.index - 160), m.index + 160); if (![...seen].some(x => x.includes(s.slice(100, 180)))) { seen.add(s); } }
  console.log("==", re, [...seen].length); for (const s of [...seen].slice(0, 8)) console.log(" ..." + s + "...");
}
