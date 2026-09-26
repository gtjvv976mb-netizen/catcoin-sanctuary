const r = await fetch("https://en.wikipedia.org/w/index.php?title=CoreWeave&action=raw", { headers: { "user-agent": "cat-sanctuary-research/1.0" } });
const t = await r.text();
console.log("status", r.status, "len", t.length);
const lead = t.replace(/\{\{Infobox[\s\S]*?\n\}\}/, "").slice(0, 2500);
console.log(lead);
for (const m of t.matchAll(/.{0,200}(GPU|data cent|cooling|mining|cryptocurrenc|Ethereum|power|megawatt).{0,200}/gi)) console.log("---\n" + m[0]);
