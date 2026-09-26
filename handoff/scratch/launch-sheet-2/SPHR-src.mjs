const u = "https://shop.thesphere.com/products/msgslf0006-the-wizard-of-oz-at-sphere-character-crew-socks.json";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
console.log(r.status);
const j = await r.json();
const p = j.product;
console.log(p.title, "|", p.published_at);
console.log(p.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 800));
console.log(p.images.map(i => i.src).join("\n"));
