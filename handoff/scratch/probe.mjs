process.env.PLAYWRIGHT_BROWSERS_PATH="/opt/pw-browsers";
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport:{width:1600,height:900}, bypassCSP:true });
p.on("console", m => console.log("console:", m.text().slice(0,200)));
const t0=Date.now();
await p.goto("http://127.0.0.1:8770/?q=high&debug&noadapt");
await p.waitForFunction(() => window.__world, null, { timeout: 300000 });
console.log("world", Date.now()-t0);
await p.evaluate(() => window.__world.choose("PEWTER"));
for (let i=0;i<20;i++){ await p.waitForTimeout(3000); console.log(Date.now()-t0, await p.evaluate(()=>JSON.stringify({hi:!!window.__world.herd.own.get("PEWTER")?.hi, s:window.__world.screenOf("PEWTER"), f:window.__world.frameMs}))); }
await p.screenshot({path:"/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/probe.jpg"});
await b.close();
