const u = "https://www.today.com/food/restaurants/mcdonalds-hello-kitty-godzilla-happy-meal-toys-rcna592162";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (research; cat-sanctuary)" } });
const t = await r.text();
console.log("==", u, r.status, t.length);
const title = t.match(/<title>([^<]*)<\/title>/i); console.log("TITLE:", title && title[1]);
const pub = t.match(/"datePublished"\s*:\s*"([^"]+)"/); console.log("PUB:", pub && pub[1]);
const text = t.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;|&rsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
for (const m of text.matchAll(/[^.]{0,250}(Hello Kitty|white|bow|cosplay|8\.18|Aug(ust)?\.? 18|participating)[^.]{0,250}\./gi)) console.log("  >", m[0].trim().slice(0, 500));
