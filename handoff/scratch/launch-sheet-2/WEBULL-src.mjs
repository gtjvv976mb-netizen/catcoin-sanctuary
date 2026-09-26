const r = await fetch("https://en.wikipedia.org/w/index.php?title=Webull&action=raw", { headers: { "user-agent": "cia-research/1.0 (cat-sanctuary research)" } });
const t = await r.text();
console.log("status", r.status, "len", t.length);
const lead = t.split(/\n==/)[0];
console.log(lead.replace(/\{\{Infobox[\s\S]*?\n\}\}/, "[infobox]").slice(0, 2500));
for (const m of t.matchAll(/[^.\n]*(commission|mobile|app\b|chart|paper trading|options|crypto|overnight|24|platform|customers|headquarter|green|red)[^.\n]*\./gi)) console.log("-", m[0].trim().slice(0, 300));
console.log("cat-ish:", (t.match(/\b(cat|cats|kitten|kitty|feline|lion|tiger|panther|mascot|bull)\b/gi) || []).join(","));
