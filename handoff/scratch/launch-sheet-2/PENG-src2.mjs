const r = await fetch("https://en.wikipedia.org/w/index.php?title=Penguin_Solutions&action=raw", { headers: { "user-agent": "research-bot/1.0" } });
const t = (await r.text()).replace(/<ref[\s\S]*?(<\/ref>|\/>)/g,"").replace(/\s+/g," ");
for (const k of ["divest","sold","sale of","LED","Optimized","segment","brands"]) { let i=-1; while((i=t.indexOf(k,i+1))>=0) console.log("["+k+"] ::", t.slice(Math.max(0,i-160),i+200)); }
