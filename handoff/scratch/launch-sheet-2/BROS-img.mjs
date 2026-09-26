import fs from "fs";
const u = "https://www.dutchbros.com/ctf/tesk7a84db2g/2JkyEFQSAzPsVDN9BtJSIb/c1e2d3ce9982b05b6d72c6b9e71d76d2/DB-Social-SOTM-01-v1-slide_0.webp";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
const b = Buffer.from(await r.arrayBuffer());
console.log(r.status, r.headers.get("content-type"), b.length);
fs.writeFileSync("BROS-src.webp", b);
