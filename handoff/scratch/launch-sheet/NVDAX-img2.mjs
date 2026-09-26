import fs from "node:fs";
for (const [u, f] of [["https://developer-blogs.nvidia.com/wp-content/uploads/2016/07/cat1-2.jpeg","nvdax-fig1.jpeg"],["https://developer-blogs.nvidia.com/wp-content/uploads/2016/07/night-e1469671817282.jpg","nvdax-night.jpg"]]) {
  const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
  fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); console.log(u, r.status, r.headers.get("content-type"));
}
