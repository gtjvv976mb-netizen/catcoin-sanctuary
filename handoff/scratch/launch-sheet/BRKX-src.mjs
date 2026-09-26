const urls = process.argv.slice(2);
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" } });
    const t = await r.text();
    console.log("==", u, r.status, t.length);
    const text = t.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    for (const m of text.matchAll(/.{0,300}\bCam\b.{0,300}/g)) console.log(" ..", m[0]);
  } catch (e) { console.log("ERR", u, e.message); }
}
