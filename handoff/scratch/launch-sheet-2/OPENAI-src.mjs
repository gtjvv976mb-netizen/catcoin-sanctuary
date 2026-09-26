const r = await fetch("https://api.fxtwitter.com/OpenAI/status/1754930271970005161");
const j = await r.json();
const t = j.tweet ?? j;
console.log(r.status, JSON.stringify({ text: t.text, created: t.created_at, author: t.author?.screen_name, media: (t.media?.all ?? t.media?.photos ?? []).map(m => ({ url: m.url, type: m.type, w: m.width, h: m.height })) }, null, 1));
const url = (t.media?.all ?? t.media?.photos ?? [])[0]?.url;
if (url) { const b = Buffer.from(await (await fetch(url)).arrayBuffer()); (await import("node:fs")).writeFileSync("OPENAI-src.jpg", b); console.log("saved", b.length); }
