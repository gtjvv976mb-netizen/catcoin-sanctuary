const H={headers:{"user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}};
const r=await fetch("https://i.kym-cdn.com/entries/icons/facebook/000/046/433/oiiaoiia.jpg",H);
const b=Buffer.from(await r.arrayBuffer()); (await import("fs")).writeFileSync("RDDT-src.jpg",b); console.log(r.status,b.length);
