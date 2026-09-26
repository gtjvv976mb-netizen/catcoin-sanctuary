const urls = [
 "https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/experience-with-animating-for-mobile-devices",
];
for (const u of urls) {
  const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (cat-sanctuary-research)" } });
  const h = await r.text();
  console.log("URL", u, "status", r.status, "len", h.length);
  const t = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g," ").replace(/\s+/g, " ");
  const re = /tiger/gi; let m;
  while ((m = re.exec(t))) console.log("TIGER ::", t.slice(Math.max(0, m.index - 250), m.index + 250));
  const imgs = [...h.matchAll(/<img[^>]+>/gi)].map(x => x[0]).filter(x => /tiger|ice|cave|fig|\.png|\.jpg|\.gif/i.test(x));
  console.log("IMGS", imgs.slice(0, 40).join("\n"));
  for (const k of ["stripe", "orange", "white", "fur", "colour", "color", "texture"]) {
    const re2 = new RegExp(k, "gi"); let mm, n = 0;
    while ((mm = re2.exec(t)) && n < 3) { console.log(k, "::", t.slice(Math.max(0, mm.index - 150), mm.index + 150)); n++; }
  }
}
