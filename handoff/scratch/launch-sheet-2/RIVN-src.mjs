const u = "https://rivian.com/stories/pet-day-rivian-2026";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (cat-sanctuary-research/1.0)" } });
const h = await r.text();
(await import("fs")).writeFileSync("RIVN-src.html", h);
console.log("status", r.status, "len", h.length);
const t = h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ");
const re = /(Pepper|cat\b|kitty|feline)/gi; let m, n = 0;
while ((m = re.exec(h)) && n < 40) { console.log("::", h.slice(Math.max(0, m.index - 300), m.index + 300).replace(/\s+/g, " ")); n++; }
const imgs = [...h.matchAll(/https?:\/\/[^"'\s)]+?\.(?:jpg|jpeg|png|webp|avif)[^"'\s)]*/gi)].map(x => x[0]);
console.log("IMGS", [...new Set(imgs)].slice(0, 40).join("\n"));
