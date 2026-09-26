import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const S = process.argv[2];
const b = await chromium.launch({ args: ["--disable-gpu","--disable-webgl"] });
for (const [id, name] of [["popcat","hof-popcat"],["bigglesworth","adoptable-bigglesworth"]]) {
  const p = await b.newPage({ viewport: { width: 1000, height: 800 } });
  p.on("pageerror", e => console.log(name, "pageerror", e.message));
  await p.goto(`http://127.0.0.1:8773/#cat=${id}`, { waitUntil: "domcontentloaded" }); console.log(name,"loaded");
  await p.waitForTimeout(9000);
  const fig = await p.evaluate(() => [...document.querySelectorAll("img")].filter(i=>i.complete&&i.naturalWidth).map(i=>i.getAttribute("src")).filter(s=>/lore|portraits/.test(s)));
  console.log(name, fig);
  const cdp = await p.context().newCDPSession(p); const r = await cdp.send("Page.captureScreenshot",{format:"png"}); (await import("node:fs")).writeFileSync(`${S}/${name}.png`, Buffer.from(r.data,"base64"));
  await p.close();
}
await b.close();
