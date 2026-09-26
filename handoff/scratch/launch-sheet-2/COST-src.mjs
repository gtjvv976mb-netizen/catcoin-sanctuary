const r = await fetch("https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Costco&format=json&exsectionformat=plain", {headers:{"user-agent":"cat-sanctuary-research/1.0"}});
const j = await r.json(); const p = Object.values(j.query.pages)[0];
const t = p.extract;
console.log("status", r.status, "len", t.length);
console.log(t.slice(0, 2500));
for (const k of ["mascot","cat","warehouse","bulk","pallet","rotisserie","hot dog","membership","concrete","box","food court","sample"]) {
  const re = new RegExp(`[^.]*\\b${k}\\b[^.]*\\.`, "gi"); const m = t.match(re) || [];
  console.log(`\n## ${k}: ${m.length}`); m.slice(0,3).forEach(s=>console.log(" -", s.trim().slice(0,300)));
}
