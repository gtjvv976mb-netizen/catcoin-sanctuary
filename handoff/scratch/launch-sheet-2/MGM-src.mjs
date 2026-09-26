const urls = [
 "https://www.prnewswire.com/news-releases/mgm-resorts-celebrates-womens-history-month-with-lioness-logo-transformation-300809419.html",
];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (cat-sanctuary-research)" } });
    const h = await r.text();
    const t = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g,"&").replace(/&#39;|&rsquo;/g,"'").replace(/\s+/g, " ");
    console.log("URL", u, "status", r.status, "len", t.length);
    const i = t.indexOf("LAS VEGAS");
    console.log(t.slice(Math.max(0,i-200), i + 2600));
    for (const k of ["gold","golden","bronze","tawny","mane","lion","lioness","logo","color","colour"]) {
      const m = t.match(new RegExp(`[^.]{0,160}\\b${k}\\b[^.]{0,160}`, "gi")) || [];
      console.log(`\n## ${k}: ${m.length}`); m.slice(0, 4).forEach(s => console.log(" -", s.trim()));
    }
    const imgs = [...h.matchAll(/<img[^>]+(?:alt|src)="[^"]*"[^>]*>/gi)].map(m=>m[0]).filter(x=>/lion|leo|leona|mgm/i.test(x)).slice(0,6);
    console.log("\nIMGS", imgs.join("\n"));
  } catch (e) { console.log("ERR", u, String(e)); }
}
