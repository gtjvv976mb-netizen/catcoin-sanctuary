const H={headers:{"user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}};
for (const [id,f] of [["ZHgyQGoeaB0","RDDT-src2.jpg"],["teqoSg-123s","RDDT-src3.jpg"]]) {
const r=await fetch(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`,H);
const b=Buffer.from(await r.arrayBuffer()); (await import("fs")).writeFileSync(f,b); console.log(r.status,b.length);}
