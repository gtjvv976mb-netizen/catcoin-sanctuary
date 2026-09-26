const r = await fetch("https://palatin.com/", { headers: { "user-agent": "Mozilla/5.0 cia-research/1.0" } });
const t = await r.text();
console.log("status", r.status, "len", t.length);
const text = t.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
console.log(text.slice(0, 3000));
for (const m of text.matchAll(/[^.]*(melanocortin|pigment|eye|retina|obesity|inflammat|MC1R|MC4R|dry)[^.]*\./gi)) console.log("-", m[0].trim().slice(0, 300));
