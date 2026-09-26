// Close-up views of each behaviour, forced via the debug hook.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1000, height: 700 }, bypassCSP: true })).newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('http://localhost:8931/index.html?debug');
await p.waitForFunction(() => document.getElementById('stage').dataset.ready, null, { timeout: 120000 });
await p.addStyleTag({ content: '.intro,.status,.hint,.top{display:none!important} .stage{height:680px!important}' });
const shots = JSON.parse(process.argv[2]);
for (const s of shots) {
  const info = await p.evaluate((s) => {
    const g = window.__garden; g.controls.autoRotate = false; g.camera.clearViewOffset(); g.camera.fov = 35; g.camera.updateProjectionMatrix();
    g.controls.minDistance = 0.1; g.controls.maxDistance = 200; g.controls.minPolarAngle = 0; g.controls.maxPolarAngle = Math.PI;
    const out = [];
    for (const [id, kind, skip] of s.force || []) out.push(g.sim.force(id, kind, { skipWalk: !!skip }));
    if (s.adv) g.advance(s.adv, 1 / 30);
    g.camera.position.set(...s.pos); g.controls.target.set(...s.tgt); g.controls.update();
    g.stats();
    return { forced: out, doing: g.doing().filter((c) => (s.force || []).some((f) => f[0] === c.id)) };
  }, s);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `shots/close-${s.name}.png`, clip: { x: 16, y: 0, width: 968, height: 680 } });
  console.log(s.name, JSON.stringify(info));
}
await b.close();
