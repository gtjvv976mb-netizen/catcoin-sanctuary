import { open, shot, T } from "./lib.mjs";
const { b, p } = await T("open", () => open());
const W = () => p.evaluate(() => window.__world.pause());
const frames = async (n) => { for (let i = 0; i < n; i++) { const t = Date.now(); await p.evaluate(() => { window.__world.pause(); window.__world.advance(0); }); console.log("  f", Date.now() - t); } };
const key = (k, n = 1) => p.evaluate(([k, n]) => { const c = document.getElementById("world"); for (let i = 0; i < n; i++) c.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); }, [k, n]);
const S = (name) => T(name, () => shot(p, `cap/${name}.jpg`));
const only = process.argv[2] ? process.argv[2].split(",") : null;
const want = (n) => !only || only.includes(n);
const nearest = (x, y, skip = 0) => p.evaluate(([x, y, skip]) => {
  const cs = window.__world.catsOnScreen().filter((c) => c.z < 1).map((c) => ({ ...c, d: Math.hypot(c.x - x, c.y - y) })).sort((a, b) => a.d - b.d);
  return cs[skip];
}, [x, y, skip]);
const reset = async () => { await p.keyboard.press("Escape"); await p.evaluate(() => { document.querySelectorAll("dialog[open]").forEach((d) => d.close()); window.__world.choose(null); window.__world.home(); }); await W(); await frames(2); };
await frames(2);

if (want("research-hq")) {
  const c = await nearest(660, 520);
  console.log("hq cat", c);
  await p.evaluate((id) => window.__world.choose(id), c.id); await W(); await frames(5); await key("-", 2); await key("ArrowDown", 1); await frames(2);
  await S("research-hq");
  await reset();
}
if (want("cat-card")) {
  let got = 0;
  for (let k = 0; k < 12 && got < 2; k++) {
    const c = await nearest(800, 620, k);
    await p.mouse.click(c.x, c.y);
    await W(); await frames(1);
    const adopt = await p.evaluate(() => { const card = document.getElementById("card"); return card && !card.hidden && !!card.querySelector(".btn-adopt"); });
    console.log("try", k, c.id, adopt);
    if (!adopt) { await reset(); continue; }
    await frames(5);
    await S(got ? "cat-card-2" : "cat-card");
    if (!got) {
      await p.evaluate(() => document.querySelector("#card .btn-adopt").click());
      await frames(1); await p.waitForTimeout(1500);
      await S("adopt-panel");
      await p.evaluate(() => { const s = document.querySelector("#card .adopt-pad-name"); s?.scrollIntoView({ block: "center" }); });
      await p.waitForTimeout(800); await frames(1);
      await S("adopt-panel-2");
    }
    got++;
    await reset();
  }
}
if (want("adopt-pill")) {
  await p.click("#adopt-open"); await p.waitForTimeout(1500); await frames(1);
  await S("adopt-pill");
  await reset();
}
if (want("hall-of-fame")) {
  await p.click("#hall-open"); await p.waitForTimeout(1500); await frames(1);
  await S("hall-of-fame");
  await reset();
}
if (want("pond")) {
  const c = await nearest(370, 545);
  console.log("pond cat", c);
  await p.evaluate((id) => window.__world.choose(id), c.id); await W(); await frames(6);
  await S("pond");
  await reset();
}
await b.close();
