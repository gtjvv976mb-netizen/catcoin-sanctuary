process.env.PLAYWRIGHT_BROWSERS_PATH="/opt/pw-browsers";
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport:{width:1600,height:900}, bypassCSP:true });
const t0=Date.now(); const T=()=>((Date.now()-t0)/1000).toFixed(0);
await p.goto("http://127.0.0.1:8770/?q=high&debug&noadapt");
await p.waitForFunction(() => window.__world, null, { timeout: 300000 });
console.log("world", T());
await p.evaluate(() => window.__world.pause());
for (const id of ["WARMSPOT","MILKWEED"]) {
  await p.evaluate((id) => { const w = window.__world; w.setInset(0,0); w.choose(id, { ease: false }); w.pause(); }, id);
  console.log(id, "chosen", T());
  for (let i=0;i<30;i++){ const h=await p.evaluate((id)=>!!window.__world.herd.own.get(id)?.hi,id); if(h){console.log("hi",T());break;} await p.waitForTimeout(2000);}
  await p.evaluate(() => window.__world.advance(1/30)); console.log("adv", T(), await p.evaluate((id)=>JSON.stringify(window.__world.screenOf(id)),id));
  await p.evaluate(() => window.__world.settle()); console.log("settle", T());
}
await b.close();
