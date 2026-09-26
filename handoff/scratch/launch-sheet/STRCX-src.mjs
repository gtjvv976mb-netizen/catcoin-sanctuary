const r = await fetch("https://www.kraken.com/xstocks/strcx", { headers: { "user-agent": "Mozilla/5.0" } });
const t = await r.text();
console.log(r.status, t.length);
const txt = t.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
for (const k of ["Perpetual", "Variable", "backed 1-1", "dividend", "monthly"]) { const i = txt.indexOf(k); console.log(k, i >= 0 ? txt.slice(Math.max(0, i - 120), i + 160) : "-"); }
