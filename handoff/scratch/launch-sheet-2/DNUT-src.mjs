const urls = ["https://tinybeans.com/krispy-kreme-halloween-21/", "https://foodsided.com/2021/10/11/krispy-kreme-adds-four-new-halloween-doughnuts/"];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" } });
    const h = await r.text();
    console.log("\n#####", u, "status", r.status, "len", h.length);
    const text = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&#8217;|&rsquo;/g, "'").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
    const re = /[^.]{0,400}(cat|Cat)[^.]{0,400}\./g; const m = text.match(re) || [];
    console.log("sentences with cat:", m.length); m.slice(0, 12).forEach(s => console.log(" -", s.trim()));
    const imgs = [...h.matchAll(/<img[^>]*>/gi)].map(x => x[0]).filter(x => /cat|abra|halloween|krispy/i.test(x)).slice(0, 10);
    console.log("imgs:"); imgs.forEach(i => console.log(" *", i.slice(0, 400)));
    const og = h.match(/<meta[^>]+property="og:image"[^>]*>/i); console.log("og:", og && og[0]);
  } catch (e) { console.log(u, "ERR", String(e)); }
}
