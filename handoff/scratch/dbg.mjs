import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto("http://localhost:8765/?q=low"); await p.waitForTimeout(4000);
await p.evaluate(() => document.getElementById("find").click()); await p.waitForTimeout(1000);
console.log(await p.evaluate(() => { const f = document.getElementById("finder"); const cs = getComputedStyle(f); return [f.open, cs.display, cs.opacity, cs.transform, JSON.stringify(f.getBoundingClientRect()), document.body.className]; }));
await b.close();
