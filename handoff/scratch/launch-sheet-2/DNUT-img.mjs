import fs from "fs";
const list = [["https://tinybeans.com/wp-content/uploads/2021/10/Krispy-Skreme-Halloween-Collection.jpg?w=1024","DNUT-src.jpg"],["https://tinybeans.com/wp-content/uploads/2021/10/Krispy-Skreme-Halloween-Doughnuts-e1634059559665.jpg?w=640","DNUT-src2.jpg"]];
for (const [u,f] of list) { const r = await fetch(u,{headers:{"user-agent":"Mozilla/5.0"}}); const b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(f,b); console.log(f, r.status, r.headers.get("content-type"), b.length); }
