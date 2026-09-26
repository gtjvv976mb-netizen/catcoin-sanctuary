const u="https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=The_Hertz_Corporation&format=json&exsectionformat=plain&redirects=1";
const r=await fetch(u,{headers:{"user-agent":"cat-sanctuary-research/1.0"}});
const j=await r.json(); const pg=Object.values(j.query.pages)[0];
console.log(r.status, pg.title, pg.extract.length);
console.log(pg.extract.slice(0,1800));
for (const m of pg.extract.matchAll(/[^.]{0,200}(fleet|airport|yellow|mascot|cat|electric|Tesla|livery|colou?r)[^.]{0,200}\./gi)) console.log("-", m[0].trim().replace(/\s+/g," "));
