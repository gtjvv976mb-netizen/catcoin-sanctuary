import fs from "node:fs";
for (const [u, f] of [["https://developer-blogs.nvidia.com/wp-content/uploads/2016/07/cute.jpg","nvdax-cute.jpg"],["https://developer-blogs.nvidia.com/wp-content/uploads/2016/07/DIY-Cat-Deter.png","nvdax-yard.png"]]) {
  const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
  fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); console.log(u, r.status);
}
