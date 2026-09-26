const u = "https://herald.wales/south-wales/cardiff-south-wales/squishmallows-cam-the-cat-set-to-bring-squish-fun-to-cardiff/";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" } });
const t = await r.text(); (await import("node:fs")).writeFileSync("herald-cam.html", t);
console.log(r.status, t.match(/<title>([^<]+)/)?.[1], t.match(/article:published_time"\s+content="([^"]+)/)?.[1], t.match(/og:image"\s+content="([^"]+)/)?.[1]);
const { checkFields } = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const look = process.argv[2];
console.log(JSON.stringify(checkFields({ look })));
