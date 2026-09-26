const url = "https://r.jina.ai/https://www.instagram.com/p/DJecJDsv-1b/";
try {
  const r = await fetch(url, { headers: { "x-return-format": "markdown" } });
  const t = await r.text();
  console.log("status", r.status, "len", t.length);
  console.log(t.slice(0, 4000));
} catch (e) { console.log("ERR", String(e)); }
