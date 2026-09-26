const r = await fetch("https://gamma-api.polymarket.com/events?slug=first-cat-to-1b");
const j = await r.json();
const e = j[0];
console.log(JSON.stringify({ status: r.status, title: e?.title, slug: e?.slug, createdAt: e?.createdAt, endDate: e?.endDate, closed: e?.closed, volume: e?.volume, image: e?.image, icon: e?.icon,
  markets: (e?.markets ?? []).map(m => ({ q: m.question, outcomePrices: m.outcomePrices, groupItemTitle: m.groupItemTitle })) }, null, 1));
if (e?.image) {
  const ir = await fetch(e.image);
  const buf = Buffer.from(await ir.arrayBuffer());
  const fs = await import("node:fs");
  const ext = (ir.headers.get("content-type") || "").includes("png") ? "png" : "jpg";
  fs.writeFileSync(`POLYMARKET-src.${ext}`, buf);
  console.log("IMG", ir.status, ir.headers.get("content-type"), buf.length, `POLYMARKET-src.${ext}`);
}
