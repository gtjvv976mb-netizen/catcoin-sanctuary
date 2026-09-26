const id = "1813651794930925634";
const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
const u = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${token}`;
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
console.log(r.status);
const j = await r.json();
console.log(JSON.stringify({ user: j.user?.screen_name, created_at: j.created_at, text: j.text,
  photos: (j.photos||[]).map(p=>p.url), media: (j.mediaDetails||[]).map(m=>({type:m.type,url:m.media_url_https})), video: j.video?.poster }, null, 1));
