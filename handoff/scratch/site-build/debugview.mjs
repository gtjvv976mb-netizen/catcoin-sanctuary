// node debugview.mjs name "px,py,pz" "tx,ty,tz" [advance]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [name, pos, tgt, adv] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 820 }, bypassCSP: true })).newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('http://localhost:8931/index.html?debug' + (process.env.Q || ''));
await p.waitForFunction(() => document.getElementById('stage').dataset.ready, null, { timeout: 120000 });
await p.addStyleTag({ content: '.intro,.status,.hint{display:none!important} .stage{height:780px!important} .top{display:none}' });
await p.waitForTimeout(300);
const r = await p.evaluate(([pos, tgt, adv]) => {
  const g = window.__garden; g.controls.autoRotate = false; g.camera.clearViewOffset(); g.camera.fov = 40; g.camera.updateProjectionMatrix();
  if (adv) g.advance(+adv);
  const [x, y, z] = pos.split(',').map(Number), [a, bb, c] = tgt.split(',').map(Number);
  g.controls.minDistance = 0.1; g.controls.maxDistance = 200; g.controls.minPolarAngle = 0; g.controls.maxPolarAngle = Math.PI;
  g.camera.position.set(x, y, z); g.controls.target.set(a, bb, c); g.controls.update();
  return g.stats();
}, [pos, tgt, adv || '0']);
await p.waitForTimeout(200);
await p.screenshot({ path: `shots/dbg-${name}.png`, clip: { x: 0, y: 0, width: 1280, height: 800 } });
console.log(JSON.stringify(r));
await b.close();
