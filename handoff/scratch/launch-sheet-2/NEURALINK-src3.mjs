for (const u of ["https://neuralink.com/technology/", "https://neuralink.com/"]) {
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
    const h = await r.text();
    const txt = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
    console.log("==", u, r.status, h.length);
    const raw = h.replace(/\\u003c/g,"<").replace(/\\"/g,'"');
    const hits = new Set();
    for (const re of [/[^.]{0,160}\b(thread|threads|coin|sealed|titanium|electrode|hair|robot|wireless|invisible|charge|battery)\b[^.]{0,160}\./gi]) for (const m of (txt + " " + raw.replace(/<[^>]+>/g," ")).matchAll(re)) hits.add(m[0].trim().slice(0, 330));
    console.log([...hits].slice(0, 25).join("\n- "));
  } catch (e) { console.log(u, "ERR", String(e)); }
}
