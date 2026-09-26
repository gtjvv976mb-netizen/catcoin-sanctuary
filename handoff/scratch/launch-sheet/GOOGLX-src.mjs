const urls = ["https://doodles.google/doodle/halloween-2020/","https://en.wikipedia.org/w/index.php?title=Magic_Cat_Academy&action=raw"];
for (const u of urls) {
  try {
    const r = await fetch(u, {headers:{"user-agent":"Mozilla/5.0"}});
    const t = await r.text();
    console.log("==", u, r.status, t.length);
    const txt = t.replace(/<script[\s\S]*?<\/script>/g,"").replace(/<style[\s\S]*?<\/style>/g,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ");
    for (const m of txt.matchAll(/[^.]{0,250}(Momo|black cat|real-life|Juliana)[^.]{0,250}/gi)) console.log("  >", m[0].trim());
  } catch(e){ console.log("ERR", u, e.message); }
}
