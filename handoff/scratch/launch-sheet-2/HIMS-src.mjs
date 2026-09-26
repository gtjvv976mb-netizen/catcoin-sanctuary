const r = await fetch("https://en.wikipedia.org/w/index.php?title=Hims_%26_Hers_Health&action=raw", { headers: { "user-agent": "cia-research/1.0" } });
const t = await r.text();
console.log("status", r.status, "len", t.length);
const lead = t.split(/\n==/)[0];
console.log(lead.replace(/\{\{Infobox[\s\S]*?\n\}\}/, "[infobox]").slice(0, 3000));
for (const m of t.matchAll(/[^.\n]*(hair loss|erectile|weight|dermatolog|skin|mental health|pharmacy|compounded|telehealth|subscription|discreet|packag)[^.\n]*\./gi)) console.log("-", m[0].trim().slice(0, 300));
