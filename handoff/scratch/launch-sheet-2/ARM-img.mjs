const u = "https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/experience-with-animating-for-mobile-devices";
const h = await (await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (cat-sanctuary-research)" } })).text();
const t = h.replace(/<script[\s\S]*?<\/script>/gi, " ");
const i = t.search(/Fig\.?\s*8/); console.log("FIG8 ctx ::", t.slice(i - 1500, i + 300).replace(/\s+/g, " "));
const all = [...h.matchAll(/(?:src|href)="([^"]+\.(?:png|jpg|jpeg|gif|mp4|webm)[^"]*)"/gi)].map(m => m[1]);
console.log([...new Set(all)].join("\n"));
const vids = [...h.matchAll(/(youtube\.com\/[^"'\s<]+|youtu\.be\/[^"'\s<]+)/gi)].map(m => m[1]); console.log("VIDS", [...new Set(vids)].join("\n"));
