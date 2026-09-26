const url = "https://www.crn.com/news/channel-programs/193004835/ibm-to-unleash-cheetah-the-next-informix-ids-release";
try {
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36", accept: "text/html" } });
  const t = await r.text();
  console.log("status", r.status, "len", t.length);
  const txt = t.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
  for (const m of txt.matchAll(/[^.]{0,250}(Cheetah|code-named|Krishna)[^.]{0,250}/gi)) console.log("-", m[0].trim());
} catch (e) { console.log("ERR", String(e), e.cause); }
