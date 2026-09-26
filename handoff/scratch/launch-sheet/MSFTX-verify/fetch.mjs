import { writeFileSync } from "node:fs";
const [url, pat, save] = process.argv.slice(2);
const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (research; cat-sanctuary launch sheet checker)" } });
const t = await r.text();
if (save) writeFileSync(save, t);
console.log("status", r.status, "len", t.length);
const txt = t.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const re = new RegExp(pat, "gi"); let m, n = 0;
while ((m = re.exec(txt)) && n < 15) { console.log("--", txt.slice(Math.max(0, m.index - 200), m.index + 300)); n++; re.lastIndex = m.index + 250; }
