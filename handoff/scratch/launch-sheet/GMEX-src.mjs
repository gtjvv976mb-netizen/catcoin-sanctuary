const r = await fetch("https://api.fxtwitter.com/TheRoaringKitty");
console.log(r.status);
const j = await r.json();
const u = j.user ?? j;
console.log(JSON.stringify({ name: u.name, screen_name: u.screen_name, description: u.description, followers: u.followers, joined: u.joined, avatar: u.avatar_url, banner: u.banner_url }, null, 1));
for (const [k, url] of [["avatar", u.avatar_url?.replace("_normal", "_400x400")], ["banner", u.banner_url]]) {
  if (!url) continue;
  const b = Buffer.from(await (await fetch(url)).arrayBuffer());
  const fs = await import("node:fs");
  const ext = url.includes(".png") ? "png" : "jpg";
  fs.writeFileSync(`GMEX-rk-${k}.${ext}`, b);
  console.log(k, url, b.length);
}
