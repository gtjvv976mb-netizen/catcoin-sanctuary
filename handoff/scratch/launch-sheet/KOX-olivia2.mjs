const H = { headers: { "user-agent": "cat-sanctuary-research/1.0" } };
const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages|revisions&rvprop=content&rvslots=main&explaintext=1&titles=${encodeURIComponent("Olivia Benson (cat)")}&format=json&piprop=original`, H);
const j = await r.json();
const p = Object.values(j.query.pages)[0];
console.log("URL: https://en.wikipedia.org/wiki/Olivia_Benson_(cat)");
console.log("IMAGE:", JSON.stringify(p.original));
console.log("EXTRACT:\n", p.extract);
const wt = p.revisions?.[0]?.slots?.main?.["*"] ?? "";
for (const m of wt.matchAll(/[^\n]{0,200}(coat|fur|colou?r|white|grey|gray|cream|tabby|ears?|fold|Diet Coke|Coca)[^\n]{0,200}/gi)) console.log("WT>", m[0].slice(0, 400));
