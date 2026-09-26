import fs from "fs";
const urls = [
 ["JNJ-src.jpg","https://jnj-production-jnj.s3.us-east-1.amazonaws.com/brightspot/b1/f2/4eb97bb469a632abaad6d8172525/heritage-halloween-tom-rutgers-cat-590x400.jpg"],
 ["JNJ-src2.jpg","https://jnj-content-lab2.brightspotcdn.com/dims4/default/1f67c82/2147483647/strip/true/crop/534x400+28+0/resize/1005x753!/quality/90/?url=https%3A%2F%2Fjnj-production-jnj.s3.us-east-1.amazonaws.com%2Fbrightspot%2Fb1%2Ff2%2F4eb97bb469a632abaad6d8172525%2Fheritage-halloween-tom-rutgers-cat-590x400.jpg"],
];
for (const [f,u] of urls) {
  try { const r = await fetch(u, {headers:{"user-agent":"Mozilla/5.0"}}); const b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(f,b); console.log(f, r.status, r.headers.get("content-type"), b.length); } catch(e) { console.log(f, "ERR", String(e)); }
}
