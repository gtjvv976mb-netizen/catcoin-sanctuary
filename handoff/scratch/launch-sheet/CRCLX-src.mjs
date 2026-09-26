const urls = process.argv.slice(2);
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "accept": "text/html" } });
    const t = await r.text();
    const text = t.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g," ").replace(/\s+/g, " ");
    console.log("==", u, r.status, t.length);
    const re = /(fat cat|bat rat|hat|cat)/gi;
    const idxs = []; let m;
    const low = text.toLowerCase();
    for (const kw of ["fat cat bat rat", "cat bat hat", "hat-wearing", "wearing a hat", "usdc cat", "advertisement", "commercial"]) {
      let i = -1; while ((i = low.indexOf(kw, i + 1)) !== -1) idxs.push(i);
    }
    const seen = new Set();
    for (const i of idxs.sort((a,b)=>a-b)) { const k = Math.floor(i/300); if (seen.has(k)) continue; seen.add(k); console.log("...", text.slice(Math.max(0,i-300), i+400)); }
    const imgs = [...t.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/gi)].map(x=>x[0]).slice(0,30);
    console.log("IMGS:", imgs.join("\n"));
  } catch (e) { console.log("ERR", u, String(e)); }
}
