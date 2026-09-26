const u = "https://media.rivian.com/image/upload/w_1920,f_jpg,q_85/papyrus/stories/pet-day-rivian-2026-original-84092e55";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (cat-sanctuary-research/1.0)" } });
const b = Buffer.from(await r.arrayBuffer());
(await import("fs")).writeFileSync("RIVN-src.jpg", b);
console.log(r.status, r.headers.get("content-type"), b.length);
