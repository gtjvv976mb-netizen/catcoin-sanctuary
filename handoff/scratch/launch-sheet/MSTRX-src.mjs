const out = {};
try {
  const r = await fetch("https://cdn.syndication.twimg.com/tweet-result?id=1506258161753366537&token=a");
  const j = await r.json();
  out.hank = { status: r.status, text: j.text, created_at: j.created_at, user: j.user?.screen_name, name: j.user?.name, photos: (j.photos||j.mediaDetails||[]).map(p => p.url || p.media_url_https) };
} catch (e) { out.hankErr = String(e); }
try {
  const r = await fetch("https://lite-api.jup.ag/tokens/v2/search?query=XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ");
  const j = await r.json();
  out.mint = (Array.isArray(j) ? j : []).map(t => ({ id: t.id, name: t.name, symbol: t.symbol, isVerified: t.isVerified, tags: t.tags }));
} catch (e) { out.mintErr = String(e); }
console.log(JSON.stringify(out, null, 1));
