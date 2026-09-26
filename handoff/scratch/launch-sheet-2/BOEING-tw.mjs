const r = await fetch("https://cdn.syndication.twimg.com/tweet-result?id=1617998377899249669&token=a", { headers: { "user-agent": "Mozilla/5.0" } });
const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch {}
console.log(JSON.stringify({ status: r.status, user: j.user?.screen_name, label: j.user?.highlighted_label?.description, created: j.created_at, text: j.text?.slice(0, 120), photos: (j.mediaDetails || []).map(m => m.media_url_https) }));
