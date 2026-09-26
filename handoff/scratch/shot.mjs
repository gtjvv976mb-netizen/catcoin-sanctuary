import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const OUT = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/teaser";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
// Freeze: draw one frame, put it in an <img> over a hidden canvas so page screenshots don't wait on GL.
const freeze = (page) => page.evaluate(() => {
  const w = window.__world, c = document.getElementById("world");
  w.pause(); w.settle(); w.advance(1 / 30);
  const u = c.toDataURL("image/jpeg", 0.85);
  let img = document.getElementById("__frozen");
  if (!img) { img = document.createElement("img"); img.id = "__frozen"; document.body.prepend(img); }
  img.src = u; Object.assign(img.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", zIndex: "0" });
  c.style.visibility = "hidden";
});
const unfreeze = (page) => page.evaluate(() => { document.getElementById("world").style.visibility = ""; document.getElementById("__frozen")?.remove(); });
for (const [name, vp, mobile] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto("http://127.0.0.1:8771/?debug&noadapt", { waitUntil: "load" });
  await page.waitForFunction(() => document.body.classList.contains("ready"), null, { timeout: 240000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { document.querySelector("#newcat").hidden = true; });
  await page.evaluate(() => { const w = window.__world; w.pause(); w.controls.autoRotate = false; w.controls.target.set(3.85, 1.2, 2.35); w.camera.position.set(3.85 + Math.sin(0.42) * 6, 2.8, 2.35 + Math.cos(0.42) * 6); w.controls.update(); });
  await freeze(page);
  await page.screenshot({ path: `${OUT}/${name}-garden-sign.png`, timeout: 120000 });
  await unfreeze(page);
  const pt = await page.evaluate(async () => { const w = window.__world; const THREE = await import("three"); const v = new THREE.Vector3(3.85, 1.35, 2.45).project(w.camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }; });
  if (mobile) await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(1000);
  const opened = await page.evaluate(() => document.querySelector("#whos").open);
  console.log(name, "easel click opens the card:", opened);
  if (!opened) await page.evaluate(() => document.getElementById("nextcat-tab").click());
  await page.waitForTimeout(800);
  await freeze(page);
  await page.screenshot({ path: `${OUT}/${name}-card.png`, timeout: 120000 });
  await page.evaluate(() => document.querySelector("#whos").close());
  await unfreeze(page);
  await page.evaluate(() => { const w = window.__world; w.home(); });
  await freeze(page);
  await page.screenshot({ path: `${OUT}/${name}-home-tab.png`, timeout: 120000 });
  await ctx.close();
}
await browser.close();
