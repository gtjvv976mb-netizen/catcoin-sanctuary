for (const u of ["https://robostrategy.co/", "https://learn.backpack.exchange/blog/tokenized-robostrategy-bot"]) {
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
    const t = await r.text();
    const txt = t.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    console.log("URL", u, r.status, t.length);
    console.log(txt.slice(0, 3000));
    const m = t.match(/<meta[^>]+(og:|name="description"|theme-color)[^>]*>/gi); console.log(m);
    console.log("colors:", [...new Set((t.match(/#[0-9a-fA-F]{6}\b/g) || []))].slice(0, 30));
  } catch (e) { console.log(u, String(e)); }
}
