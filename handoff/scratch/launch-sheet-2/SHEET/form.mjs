const r = await fetch("https://stonkfun.xyz/launch", { headers: { "user-agent": "Mozilla/5.0" } });
const t = await r.text();
console.log(r.status, t.length);
const fs = await import("node:fs"); fs.writeFileSync("launch.html", t);
const txt = t.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, "\n").replace(/\n\s*\n+/g, "\n");
console.log(txt.slice(0, 3000));
