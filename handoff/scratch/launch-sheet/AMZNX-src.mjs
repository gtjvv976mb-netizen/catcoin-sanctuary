const urls = ["https://en.wikipedia.org/w/index.php?title=Leo_the_Lion_(MGM)&action=raw"];
for (const u of urls) {
  try {
    const r = await fetch(u, {headers:{"user-agent":"Mozilla/5.0 (research; cat-sanctuary)"}});
    const t = await r.text();
    console.log("==", u, r.status, t.length);
    for (const m of t.matchAll(/[^.\n]{0,300}(Amazon|coat|mane|tawny|golden|live lion|real lion)[^.\n]{0,300}/gi)) console.log("  >", m[0].trim().slice(0,600));
  } catch(e){ console.log("ERR", u, e.message); }
}
