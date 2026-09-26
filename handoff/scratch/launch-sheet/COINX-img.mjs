import { writeFileSync } from "node:fs";
const urls = { "coinx-p1.jpg": "https://pbs.twimg.com/media/GStfMGabEAApawq.jpg?name=small", "coinx-p2.jpg": "https://pbs.twimg.com/media/GStgqPJbYAAtMFT.jpg?name=small", "coinx-vid.jpg": "https://pbs.twimg.com/ext_tw_video_thumb/1813647956781993984/pu/img/diVykieTUwoM7wTo.jpg?name=small" };
for (const [f, u] of Object.entries(urls)) { const r = await fetch(u); const b = Buffer.from(await r.arrayBuffer()); writeFileSync(f, b); console.log(f, r.status, b.length); }
