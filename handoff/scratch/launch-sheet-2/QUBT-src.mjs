const urls = ["https://quantumcomputinginc.com/", "https://quantumcomputinginc.com/company"];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
    const h = await r.text();
    const t = h.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/\s+/g," ");
    console.log("URL", u, "status", r.status, "len", t.length);
    const m = h.match(/<meta[^>]+(name|property)="(description|og:description)"[^>]*>/gi); console.log("META", m);
    for (const kw of ["photonic","light","laser","lithium niobate","TFLN","entropy","random number","foundry","chip","optical"]) {
      const re = new RegExp(`.{0,140}${kw}.{0,140}`, "gi"); const hits = t.match(re) || [];
      console.log(`== ${kw}: ${hits.length}`); hits.slice(0,2).forEach(x=>console.log("  ", x.trim()));
    }
    const catre = /\b(cat|cats|kitten|kitty|feline|mascot|schr[oö]dinger)\b/gi; console.log("CAT HITS", (t.match(catre)||[]).length);
  } catch (e) { console.log("ERR", u, String(e)); }
}
