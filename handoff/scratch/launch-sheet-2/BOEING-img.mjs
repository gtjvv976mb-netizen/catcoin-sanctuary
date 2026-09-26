import fs from "fs";
const h = await (await fetch("https://www.foxnews.com/lifestyle/stray-kitten-rescued-airport-adopted-safety-officer", { headers: { "user-agent": "Mozilla/5.0 Chrome/124" } })).text();
const imgs = [...new Set([...h.matchAll(/https:\/\/[^"' ]*content\/uploads\/2020\/10\/[^"' ]+?\.(?:jpg|jpeg|png|webp)/gi)].map(m=>m[0]))];
console.log(imgs);
// figure captions near images
for (const m of h.matchAll(/<img[^>]+src="([^"]*2020\/10[^"]*)"[^>]*>/gi)) console.log("IMG", m[0].slice(0,400));
for (const m of h.matchAll(/<figcaption[\s\S]{0,600}?<\/figcaption>/gi)) console.log("CAP", m[0].replace(/<[^>]+>/g," ").replace(/\s+/g," "));
let n=0;
for (const u of imgs.filter(u=>!/\/\d+\/\d+\//.test(u))) {
  const r = await fetch(u); const b = Buffer.from(await r.arrayBuffer());
  const f = `BOEING-src${n++}.jpg`; fs.writeFileSync(f, b); console.log(f, r.status, b.length, u);
}
