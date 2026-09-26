import { open, shot, T } from "./lib.mjs";
const { b, p } = await T("open", () => open());
await p.evaluate(() => { window.__world.pause(); window.__world.advance(0); });
await p.evaluate(() => document.getElementById("hall-open").click());
await p.waitForFunction(() => [...document.querySelectorAll("dialog[open] .find-item img")].slice(0, 6).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 180000 }).catch(() => console.log("thumbs not all loaded"));
await p.waitForTimeout(2000);
await T("hall", () => shot(p, "cap/hall-of-fame.jpg"));
await b.close();
