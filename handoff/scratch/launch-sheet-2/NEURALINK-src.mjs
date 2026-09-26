for (const id of ["1703330562356957232","1122676953071276033"]) {
  try {
    const r = await fetch(`https://api.fxtwitter.com/elonmusk/status/${id}`);
    const j = await r.json();
    const t = j.tweet ?? {};
    console.log(id, r.status, JSON.stringify({ text: t.text, created: t.created_at, media: t.media ?? null, replying_to: t.replying_to, quote: t.quote ? { text: t.quote.text, author: t.quote.author?.screen_name, media: t.quote.media ?? null } : null }, null, 1));
  } catch (e) { console.log(id, "ERR", String(e)); }
}
