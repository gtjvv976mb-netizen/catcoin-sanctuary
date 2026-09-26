for (const id of ["2094550218918207643","2095531512506601729"]) {
  const u = `https://api.fxtwitter.com/RobinhoodApp/status/${id}`;
  try {
    const r = await fetch(u, {headers:{"user-agent":"Mozilla/5.0 (research; cat-sanctuary)"}});
    const j = await r.json();
    const t = j.tweet ?? {};
    console.log("==", u, r.status);
    console.log(JSON.stringify({ text: t.text, created_at: t.created_at, author: t.author?.screen_name, verified: t.author?.verification, likes: t.likes, views: t.views,
      media: (t.media?.all ?? []).map(m => ({ type: m.type, url: m.url, thumb: m.thumbnail_url })), quote: t.quote ? { text: t.quote.text, author: t.quote.author?.screen_name, media: (t.quote.media?.all ?? []).map(m => m.thumbnail_url || m.url) } : null }, null, 1));
  } catch (e) { console.log("ERR", u, e.message); }
}
