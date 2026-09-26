import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import fs from "node:fs";
export async function open(w = 1600, h = 900, extra = "", ctxOpts = {}) {
  const b = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, ...ctxOpts });
  const p = await ctx.newPage();
  p.on("pageerror", e => console.log("pageerror", e.message));
  await p.goto("http://127.0.0.1:8768/?v=3&q=high&debug&noadapt" + extra);
  await p.waitForFunction(() => document.body.classList.contains("ready"), null, { timeout: 300000 });
  await p.evaluate(() => window.__world.pause());
  return { b, ctx, p };
}
export const step = (p, s = 1/30) => p.evaluate((s) => window.__world.advance(s, 1/30), s);
export async function shot(p, file, quality = 90) {
  const c = p.__cdp || (p.__cdp = await p.context().newCDPSession(p));
  const r = await c.send("Page.captureScreenshot", { format: "jpeg", quality });
  fs.writeFileSync(file, Buffer.from(r.data, "base64"));
}
export const T = async (label, f) => { const t = Date.now(); const r = await f(); console.log(label, Date.now() - t); return r; };
