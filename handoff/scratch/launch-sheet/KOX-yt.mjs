for (const id of ["okTokQgOo6I","B8--HRraGck","AYiuMVB14b0"]) {
  const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
  console.log(id, r.status, r.status === 200 ? JSON.stringify(await r.json()).slice(0, 400) : await r.text().then(t=>t.slice(0,200)));
}
const r = await fetch("https://i.ytimg.com/vi/okTokQgOo6I/hqdefault.jpg");
console.log("thumb", r.status);
if (r.ok) (await import("node:fs")).writeFileSync("KOX-yt-thumb.jpg", Buffer.from(await r.arrayBuffer()));
