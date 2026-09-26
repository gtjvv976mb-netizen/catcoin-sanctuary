const r = await fetch("https://api.fxtwitter.com/Tippen22/status/1476985855981993984");
const j = await r.json();
const t = j.tweet ?? {};
console.log(r.status, JSON.stringify({ author: t.author?.name, handle: t.author?.screen_name, created: t.created_at, text: t.text, likes: t.likes, photos: t.media?.photos?.map(p => p.url) }, null, 1));
const u = t.media?.photos?.[0]?.url;
if (u) { const ir = await fetch(u + (u.includes("?") ? "" : "?name=orig")); const b = Buffer.from(await ir.arrayBuffer()); (await import("node:fs")).writeFileSync("SPCXX-orig.jpg", b); console.log("saved", ir.status, b.length); }
