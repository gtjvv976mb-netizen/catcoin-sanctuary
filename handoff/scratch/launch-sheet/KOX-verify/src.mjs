import { writeFileSync } from "node:fs";
const u = "https://investors.coca-colacompany.com/news-events/press-releases/detail/703/taylor-swift-gets-a-taste-of-her-favorite-things-in-new-diet-coke-commercial";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (research; cat-sanctuary)" } });
const t = await r.text(); writeFileSync("press-release.html", t);
const text = t.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;|&rsquo;|&#8217;/g, "'").replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
console.log("status", r.status, "len", t.length);
for (const q of ["overflowing", "sea of kittens", "bubblier", "co-star", "multiply"]) { const i = text.indexOf(q); console.log(q, "=>", i >= 0 ? text.slice(Math.max(0,i-160), i+120) : "NOT FOUND"); }
for (const m of text.matchAll(/[^.]{0,80}\b(white|black|grey|gray|ginger|orange|tabby|calico|cream|tortoise|coat|fur)\b[^.]{0,80}/gi)) console.log("COLOUR>", m[0]);
