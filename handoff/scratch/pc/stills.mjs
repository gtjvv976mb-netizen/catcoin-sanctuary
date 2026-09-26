import { open, shot, T } from "./lib.mjs";
const { b, p } = await T("open", () => open());
const W = () => p.evaluate(() => { window.__world.pause(); });
const frames = async (n) => { for (let i = 0; i < n; i++) await p.evaluate(() => window.__world.advance(0)); };
const key = (k, n = 1) => p.evaluate(([k, n]) => { const c = document.getElementById("world"); for (let i = 0; i < n; i++) c.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); }, [k, n]);
const near = (x, z) => p.evaluate(([x, z]) => { const w = window.__world; const cs = w.catsOnScreen(); return cs; }, [x, z]);
const S = async (name) => { await T(name, () => shot(p, `cap/${name}.jpg`)); };
const only = process.argv[2] ? process.argv[2].split(",") : null;
const want = (n) => !only || only.includes(n);

await frames(3);
if (want("garden-overview")) await S("garden-overview");
// a second angle
if (want("garden-overview-2")) { await key("ArrowLeft", 5); await key("+", 1); await frames(3); await S("garden-overview-2"); await p.evaluate(() => window.__world.home()); await frames(2); }

// cats up close: pick on-screen cats that are near the camera centre and walking/playing
const pickCat = async (skip = 0, filter = "") => p.evaluate(([skip, filter]) => {
  const cs = window.__world.catsOnScreen().filter((c) => c.z < 1 && c.x > 300 && c.x < 1300 && c.y > 250 && c.y < 750 && (!filter || new RegExp(filter, "i").test(c.doing)));
  cs.sort((a, b) => a.z - b.z);
  return cs[skip] || null;
}, [skip, filter]);
if (want("cats-closeup")) {
  const c = await pickCat(0, "walk|stroll|off to|play|yarn|chas");
  console.log("closeup", c);
  await p.evaluate((id) => window.__world.choose(id), c.id); await W();
  await frames(8); await S("cats-closeup");
  await key("-", 2); await key("ArrowRight", 2); await frames(4); await S("cats-closeup-2");
  await p.evaluate(() => { window.__world.choose(null); window.__world.home(); }); await W(); await frames(3);
}
await b.close();
