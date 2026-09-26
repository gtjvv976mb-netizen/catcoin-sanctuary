const urls = ["https://currently.att.yahoo.com/att/brief-history-elon-musks-pets-145323914.html",
  "https://www.businessinsider.com/elon-musk-pets-dogs-cat-marvin-the-martian-floki-schrodinger-2024-11"];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
    const t = await r.text();
    const plain = t.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
    console.log("==", u, r.status, plain.length);
    for (const m of plain.matchAll(/[^.]{0,300}(Schr|cat\b|kitten|feline)[^.]{0,300}\./gi)) console.log("-", m[0].trim());
    for (const m of t.matchAll(/alt="([^"]*(?:cat|Schr)[^"]*)"/gi)) console.log("ALT:", m[1]);
  } catch (e) { console.log("ERR", u, String(e)); }
}
