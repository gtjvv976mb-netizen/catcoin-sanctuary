import { open, step, shot, T } from "./lib.mjs";
const { b, p } = await T("open", () => open());
await T("adv", () => step(p, 1));
await T("cdpshot", () => shot(p, "cap/p3.jpg"));
await T("adv1", () => step(p));
await T("cdpshot2", () => shot(p, "cap/p3b.jpg"));
await T("canvas", () => p.evaluate(() => { window.__world.advance(1/30); return document.querySelector("#world").toDataURL("image/jpeg", 0.9).length; }));
await T("keys", async () => { await p.focus("#world"); await p.keyboard.press("ArrowLeft"); });
await b.close();
