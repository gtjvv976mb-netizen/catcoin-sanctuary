import { open, shot, T } from "./lib.mjs";
const { b, p } = await T("open", () => open());
const frames = async (n) => { for (let i = 0; i < n; i++) await p.evaluate(() => { window.__world.pause(); window.__world.advance(0); }); };
const S = (name) => T(name, () => shot(p, `cap/${name}.jpg`));
await frames(1);
// the Adopt a Cat list, with its thumbnails loaded
await p.evaluate(() => document.getElementById("adopt-open").click());
await p.waitForFunction(() => [...document.querySelectorAll("dialog[open] .find-item img")].slice(0, 6).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 120000 }).catch(() => console.log("thumbs not all loaded"));
await p.waitForTimeout(2000);
await S("adopt-pill");
await p.evaluate(() => { const it = document.querySelectorAll("dialog[open] .find-item"); it[3].click(); });
await p.waitForTimeout(500); await frames(4);
await S("cats-closeup");
await p.evaluate(() => document.querySelector("#card .btn-adopt").click()); await p.waitForTimeout(1500);
await p.evaluate(() => { const t = document.querySelector("#card .adopt-pad-name"); let e = t; while (e && !(e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY))) e = e.parentElement; if (e) e.scrollTop = e.scrollHeight; });
await p.waitForTimeout(1500);
await S("adopt-launch");
await b.close();
