import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
export async function open(w = 1600, h = 900, extra = "") {
  const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on("pageerror", e => console.log("pageerror", e.message));
  await p.goto("http://127.0.0.1:8768/?v=3&q=high&debug&noadapt" + extra);
  await p.waitForFunction(() => document.body.classList.contains("ready"), null, { timeout: 240000 });
  await p.waitForTimeout(6000);
  await p.evaluate(() => { window.__world.pause(); window.__world.settle(); });
  // dismiss the "new cat" popup if shown
  await p.evaluate(() => { const n = document.getElementById("newcat"); if (n) n.hidden = true; });
  return { b, p };
}
export const step = (p, s = 1/30) => p.evaluate((s) => window.__world.advance(s, 1/30), s);
export async function shot(p, file, quality = 88) {
  const c = p.__cdp || (p.__cdp = await p.context().newCDPSession(p));
  const r = await c.send("Page.captureScreenshot", { format: "jpeg", quality });
  (await import("node:fs")).writeFileSync(file, Buffer.from(r.data, "base64"));
}
