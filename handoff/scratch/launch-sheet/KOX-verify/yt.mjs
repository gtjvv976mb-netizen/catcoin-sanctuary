import { writeFileSync } from "node:fs";
for (const id of ["okTokQgOo6I","B8--HRraGck","AYiuMVB14b0"]) {
  const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
  console.log(id, r.status, r.status === 200 ? JSON.stringify(await r.json()).slice(0, 300) : (await r.text()).slice(0,120));
  for (const f of ["maxresdefault","hqdefault"]) {
    const t = await fetch(`https://i.ytimg.com/vi/${id}/${f}.jpg`);
    if (t.ok) { writeFileSync(`yt-${id}-${f}.jpg`, Buffer.from(await t.arrayBuffer())); console.log(" saved", f); break; }
  }
}
