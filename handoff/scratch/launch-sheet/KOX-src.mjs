const u = "https://investors.coca-colacompany.com/news-events/press-releases/detail/703/taylor-swift-gets-a-taste-of-her-favorite-things-in-new-diet-coke-commercial";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (research; cat-sanctuary)" } });
const t = await r.text();
console.log("==", u, r.status, t.length);
const title = t.match(/<title>([^<]*)<\/title>/i); console.log("TITLE:", title && title[1].trim());
const text = t.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;|&rsquo;|&#8217;/g, "'").replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
const i = text.search(/Kittens/); console.log("BODY:", text.slice(Math.max(0, i - 600), i + 3500));
for (const m of t.matchAll(/<img[^>]+src="([^"]+)"/gi)) console.log("IMG:", m[1]);
for (const m of t.matchAll(/(youtube\.com[^"' ]+|youtu\.be[^"' ]+)/gi)) console.log("YT:", m[1]);
