import fs from "fs";
const url = "https://www.jnj.com/our-heritage/fred-kilmer-johnson-and-johnson-scientific-pioneer";
const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "accept": "text/html" } });
const t = await r.text();
fs.writeFileSync("JNJ-src.html", t);
console.log("status", r.status, "len", t.length, "final", r.url);
for (const k of ["Tom Rutgers", "three cats", "feline", "alligator"]) {
  let i = t.indexOf(k); console.log("\n##", k, i);
  if (i >= 0) console.log(t.slice(Math.max(0, i - 1200), i + 400).replace(/\s+/g, " "));
}
const imgs = [...t.matchAll(/(?:src|data-src|srcset|href)="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi)].map(m => m[1]);
console.log("\nIMAGES", [...new Set(imgs)].slice(0, 60).join("\n"));
