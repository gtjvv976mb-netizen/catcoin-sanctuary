import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const S = process.argv[2];
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 960, height: 620 } });
p.on("pageerror", (e) => console.log("ERR", e.message));
await p.goto("http://localhost:8765/?debug&q=low", { waitUntil: "load" });
await p.waitForFunction(() => window.__world?.research, null, { timeout: 120000 });
const views = { t: [-1.2, 2.2, 1.8], p: [3.5, 5.5, 12.5] };
for (const mode of ["active", "resting"]) {
  await p.evaluate(([mode, v]) => {
    const w = window.__world, now = Date.now();
    const fin = new Date(now - (mode === "active" ? 40 : 60 * 30) * 60000).toISOString();
    w.research.setData({ runs: [{ startedAt: fin, finishedAt: fin, searched: 38, found: 4, accepted: 3 }] },
      { candidates: [{ catName: "Hodge", owner: "Samuel Johnson", status: "pending", foundAt: fin }, { catName: "Larry", owner: "10 Downing Street", status: "approved", foundAt: fin }] }, now);
    w.pause?.(); w.controls.autoRotate = false;
    w.controls.target.set(...v.t); w.camera.position.set(...v.p); w.controls.update();
    w.advance(1.5);
  }, [mode, views]);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${S}/research-${mode}.png`, timeout: 180000 });
}
await p.evaluate(() => { window.__world.research.setData({ runs: [{ finishedAt: new Date(Date.now()-3600e3).toISOString(), found: 4, searched: 38, accepted: 3 }] }, { candidates: [{ catName: "Hodge", owner: "Samuel Johnson", status: "pending", foundAt: "2026-09-26T10:00:00Z" }, { catName: "Larry", owner: "10 Downing Street", status: "approved", foundAt: "2026-09-25T10:00:00Z" }] }); window.__world.research.open(); });
await p.waitForTimeout(400);
await p.screenshot({ path: `${S}/research-panel.png`, timeout: 180000 });
await b.close();
