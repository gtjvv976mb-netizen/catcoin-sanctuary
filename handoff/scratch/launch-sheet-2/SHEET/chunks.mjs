import fs from "node:fs";
const html = fs.readFileSync("launch.html", "utf8");
const srcs = [...html.matchAll(/src="(\/_next\/[^"]+\.js)"/g)].map((m) => m[1]);
let all = "";
for (const s of srcs) { const r = await fetch("https://stonkfun.xyz" + s); all += "\n/*" + s + "*/\n" + (await r.text()); }
fs.writeFileSync("chunks.js", all);
console.log(srcs.length, all.length);
for (const re of [/.{0,300}2% fee.{0,400}/g, /.{0,200}Dev buy.{0,300}/gi, /.{0,200}[Hh]older rewards.{0,300}/g, /.{0,150}Pool fee.{0,300}/g]) {
  const m = all.match(re) || []; console.log("==", re, m.length); for (const x of m.slice(0, 4)) console.log(x.replace(/\s+/g, " ").slice(0, 700), "\n--");
}
