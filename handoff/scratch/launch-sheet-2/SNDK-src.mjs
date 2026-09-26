import fs from "fs";
const o = await fetch("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=zxQUNHfyLgw&format=json");
console.log(o.status, await o.text());
for (const [id,f] of [["zxQUNHfyLgw","SNDK-src.jpg"],["3U0ehWEHRts","SNDK-src2.jpg"]]) {
  const r = await fetch(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  console.log(id, r.status, r.headers.get("content-type"));
  fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
}
