const u = "https://herald.wales/south-wales/cardiff-south-wales/squishmallows-cam-the-cat-set-to-bring-squish-fun-to-cardiff/";
const H = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" };
const t = await (await fetch(u, { headers: H })).text();
const imgs = [...new Set([...t.matchAll(/(?:og:image"\s+content="|src=")(https:[^"]+?\.(?:jpe?g|png|webp))/g)].map((m) => m[1]))];
console.log(imgs.filter((i) => /cam|squish|uploads\/2024\/08/i.test(i)).join("\n"));
const og = t.match(/og:image"\s+content="([^"]+)"/)?.[1]; console.log("OG", og);
if (og) { const b = Buffer.from(await (await fetch(og, { headers: H })).arrayBuffer()); (await import("node:fs")).writeFileSync("BRKX-cam.jpg", b); console.log("saved", b.length); }
