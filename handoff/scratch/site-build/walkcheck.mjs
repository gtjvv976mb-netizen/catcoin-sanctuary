import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1000, height: 700 }, bypassCSP: true })).newPage();
await p.goto('http://localhost:8931/index.html?debug');
await p.waitForFunction(() => document.getElementById('stage').dataset.ready, null, { timeout: 120000 });
await p.addStyleTag({ content: '.intro,.status,.hint,.top{display:none!important} .stage{height:680px!important}' });
for (const id of ['example-2', 'example-1']) {
  const info = await p.evaluate((id) => {
    const g = window.__garden; g.controls.autoRotate = false; g.camera.clearViewOffset(); g.camera.fov = 30; g.camera.updateProjectionMatrix();
    g.controls.minDistance = 0.1; g.controls.minPolarAngle = 0; g.controls.maxPolarAngle = Math.PI;
    g.sim.force(id, 'wander');
    let c; for (let i = 0; i < 90; i++) { g.sim.update(1 / 30); c = g.sim.byId(id); if (c.pose === 'walk' && c.speed > 0.4) break; }
    const px = c.x, pz = c.z;
    g.sim.update(1 / 30);
    const dir = Math.atan2(-(c.z - pz), c.x - px);
    g.camera.position.set(c.x, 6, c.z + 0.01); g.controls.target.set(c.x, 0, c.z); g.controls.update(); g.stats();
    return { id, pose: c.pose, yaw: c.yaw.toFixed(2), moveDir: dir.toFixed(2), speed: c.speed.toFixed(2) };
  }, id);
  await p.screenshot({ path: `shots/walk-${id}.png`, clip: { x: 250, y: 150, width: 500, height: 400 } });
  console.log(JSON.stringify(info));
}
await b.close();
