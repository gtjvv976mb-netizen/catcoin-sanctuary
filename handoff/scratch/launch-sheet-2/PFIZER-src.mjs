import fs from "fs";
const oe = await fetch("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=1ZqInv0bfdA&format=json");
console.log("oembed", oe.status, await oe.text());
for (const f of ["maxresdefault","hqdefault","hq1","hq2","hq3"]) {
  const r = await fetch(`https://i.ytimg.com/vi/1ZqInv0bfdA/${f}.jpg`);
  const b = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(`PFIZER-src-${f}.jpg`, b);
  console.log(f, r.status, b.length);
}
const p = await fetch("https://www.pfizer.co.jp/pfizer/company/external-communication/2024-01-24");
const t = await p.text();
const i = t.indexOf("AMR猫");
console.log("pfizer.co.jp", p.status, i, i>=0 ? t.slice(Math.max(0,i-300), i+200).replace(/<[^>]+>/g," ").replace(/\s+/g," ") : "");
