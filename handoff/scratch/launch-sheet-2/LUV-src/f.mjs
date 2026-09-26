import fs from "fs";
const r = await fetch("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=4jmUd2U5yAQ&format=json");
console.log(r.status, await r.text());
for (const q of ["maxresdefault","hqdefault","hq1","hq2","hq3"]) {
  const x = await fetch(`https://i.ytimg.com/vi/4jmUd2U5yAQ/${q}.jpg`);
  console.log(q, x.status);
  if (x.ok) fs.writeFileSync(`${q}.jpg`, Buffer.from(await x.arrayBuffer()));
}
