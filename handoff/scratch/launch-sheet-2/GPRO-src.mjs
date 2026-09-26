import fs from "fs";
for (const [id, f] of [["CjB_oVeq8Lo","GPRO-src.jpg"],["vYyUb_MI7to","GPRO-src2.jpg"]]) {
  const o = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
  console.log(id, o.status, await o.text());
  for (const q of ["maxresdefault","hqdefault"]) {
    const r = await fetch(`https://i.ytimg.com/vi/${id}/${q}.jpg`);
    if (r.ok) { fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); console.log("saved", f, q); break; } else console.log(q, r.status);
  }
}
