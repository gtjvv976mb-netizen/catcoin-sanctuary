const get = async (u) => (await fetch(u)).json();
const j = await get("https://api.fxtwitter.com/elonmusk/status/1122676953071276033");
console.log("parent:", j.tweet?.replying_to_status);
let id = j.tweet?.replying_to_status, hops = 0;
while (id && hops < 6) {
  const p = await get(`https://api.fxtwitter.com/i/status/${id}`);
  const t = p.tweet ?? {};
  console.log(JSON.stringify({ id, author: t.author?.screen_name, text: t.text, media: (t.media?.all ?? []).map(m => ({ type: m.type, url: m.url, alt: m.altText })) }));
  id = t.replying_to_status; hops++;
}
