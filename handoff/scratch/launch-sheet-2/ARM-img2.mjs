import fs from "fs";
const H = { "user-agent": "Mozilla/5.0 (cat-sanctuary-research)" };
const base = "https://community.arm.com/cfs-file/__key/communityserver-blogs-components-weblogfiles/00-00-00-20-66/";
const list = { "ARM-fig4.png": base + "6114.fig_2B00_4.png", "ARM-fig6.png": base + "3051.fig_2B00_6.png", "ARM-fig9.png": base + "5127.fig_2B00_9.png", "ARM-fig10.png": base + "1817.fig_2B00_10.png",
  "ARM-yt1.jpg": "https://i.ytimg.com/vi/gsyBMHJVhXA/hqdefault.jpg", "ARM-yt1max.jpg": "https://i.ytimg.com/vi/gsyBMHJVhXA/maxresdefault.jpg", "ARM-yt2.jpg": "https://i.ytimg.com/vi/V5NELTFI4NU/hqdefault.jpg" };
for (const [f, u] of Object.entries(list)) {
  try { const r = await fetch(u, { headers: H }); const b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(f, b); console.log(f, r.status, r.headers.get("content-type"), b.length); } catch (e) { console.log(f, "ERR", String(e)); }
}
for (const id of ["gsyBMHJVhXA", "V5NELTFI4NU"]) {
  try { const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`, { headers: H }); console.log(id, r.status, await r.text()); } catch (e) { console.log(id, "ERR", String(e)); }
}
