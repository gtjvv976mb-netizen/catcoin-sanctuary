const urls = ["https://fireflyspace.com/blue-ghost/", "https://www.collectspace.com/news/news-030125a-firefly-aerospace-blue-ghost-mission-1-building-blocks-set.html"];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" } });
    const h = await r.text();
    const t = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&#8217;|&rsquo;/g, "'").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
    console.log("=== ", u, r.status, t.length);
    const kw = /(gold|foil|silver|white|black|grey|gray|color|colour|duck|lander|regolith|dust|blanket|paint)/i;
    const sents = t.split(/(?<=[.!?])\s+/).filter(s => kw.test(s) && s.length < 500);
    console.log(sents.slice(0, 40).join("\n"));
  } catch (e) { console.log("ERR", u, String(e)); }
}
