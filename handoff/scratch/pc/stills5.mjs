import { open, shot, T } from "./lib.mjs";
const { b, p } = await T("open", () => open());
const frames = async (n) => { for (let i = 0; i < n; i++) await p.evaluate(() => { window.__world.pause(); window.__world.advance(0); }); };
const key = (k, n = 1) => p.evaluate(([k, n]) => { const c = document.getElementById("world"); for (let i = 0; i < n; i++) c.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); }, [k, n]);
await frames(1);
await p.evaluate(() => document.getElementById("hall-open").click());
await p.waitForTimeout(1000);
await p.evaluate(() => document.querySelectorAll("dialog[open] .find-item")[0].click());
await p.waitForTimeout(500);
await p.evaluate(() => { for (const id of ["card", "pin", "tag"]) { const e = document.getElementById(id); if (e) e.style.visibility = "hidden"; } document.querySelectorAll("dialog[open]").forEach((d) => d.close()); });
await frames(4); await key("-", 3); await frames(2);
await T("hall-plaza", () => shot(p, "cap/hall-plaza.jpg"));
await p.evaluate(() => { for (const id of ["card", "pin", "tag"]) { const e = document.getElementById(id); if (e) e.style.visibility = ""; } window.__world.choose(null); window.__world.home(); window.__world.pause(); });
await frames(2);
const pc = await p.evaluate(() => window.__world.catsOnScreen().find((c) => /pond|water/i.test(c.doing)) || null);
console.log("pond cat", pc);
if (pc) { await p.evaluate((id) => { window.__world.choose(id); window.__world.pause(); }, pc.id); await frames(5); await key("-", 1); await key("ArrowUp", 2); await frames(2); await T("pond", () => shot(p, "cap/pond-2.jpg")); }
await b.close();
