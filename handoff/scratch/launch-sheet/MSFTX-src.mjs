const url = process.argv[2];
const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (research; cat-sanctuary launch sheet)" } });
const t = await r.text();
console.log("status", r.status, "len", t.length);
const txt = t.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const re = new RegExp(process.argv[3], "gi");
let m, n = 0;
while ((m = re.exec(txt)) && n < 25) { console.log("--", txt.slice(Math.max(0, m.index - 250), m.index + 350)); n++; re.lastIndex = m.index + 300; }
