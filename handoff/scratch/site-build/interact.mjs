import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const S = process.cwd();
const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args });
const which = (process.argv[2] || 'pick,card,keys,reduced,many,real').split(',');
const ready = (p) => p.waitForFunction(() => document.getElementById('stage').dataset.ready, null, { timeout: 180000 });
const errs = (p, tag) => { p.on('pageerror', (e) => console.log(tag, 'pageerror', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log(tag, 'console.error', m.text()); }); };

if (which.includes('pick')) {
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } }); errs(p, 'pick');
  await p.goto('http://localhost:8931/index.html?debug'); await ready(p);
  await p.evaluate(() => window.__garden.advance(3));
  // Find a cat's screen position and click it.
  const pt = await p.evaluate(() => {
    const g = window.__garden; g.controls.autoRotate = false; g.controls.update(); g.stats();
    const rc = document.getElementById('world').getBoundingClientRect();
    for (const c of g.sim.cats) {
      if (c.y > 0.3) continue;
      const v = { x: c.x, y: c.y + 0.5, z: c.z };
      const V = new (g.camera.position.constructor)(v.x, v.y, v.z).project(g.camera);
      const x = rc.left + (V.x * 0.5 + 0.5) * rc.width, y = rc.top + (-V.y * 0.5 + 0.5) * rc.height;
      if (x > rc.left + 560 && x < rc.right - 40 && y > rc.top + 60 && y < rc.bottom - 60) return { id: c.id, x, y };
    }
    return null;
  });
  console.log('pick target', JSON.stringify(pt));
  if (pt) {
    await p.mouse.click(pt.x, pt.y);
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => ({ chosen: window.__garden.chosen, tagHidden: document.getElementById('tag').hidden, tag: document.getElementById('tag').innerText, pressed: [...document.querySelectorAll('.pick[aria-pressed="true"]')].map((b) => b.closest('li').dataset.id), live: document.getElementById('announce').textContent }));
    console.log('after click', JSON.stringify(r));
    await p.screenshot({ path: `${S}/shots/v5-pick-desktop.png` });
    await p.evaluate(() => window.__garden.advance(6));
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${S}/shots/v5-pick-desktop-later.png` });
    console.log('tag later', JSON.stringify(await p.evaluate(() => document.getElementById('tag').innerText)));
  }
  await p.close();
}

if (which.includes('card')) {
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, isMobile: true, hasTouch: true }); errs(p, 'card');
  await p.goto('http://localhost:8931/index.html?debug'); await ready(p);
  await p.evaluate(() => window.__garden.advance(8));
  const btn = p.locator('.resident .pick').nth(3);
  await btn.scrollIntoViewIfNeeded(); await btn.click();
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => ({ chosen: window.__garden.chosen, tagHidden: document.getElementById('tag').hidden, tag: document.getElementById('tag').innerText, tagVis: document.getElementById('tag').style.visibility, stageTop: Math.round(document.getElementById('stage').getBoundingClientRect().top) }));
  console.log('card click (phone)', JSON.stringify(r));
  await p.screenshot({ path: `${S}/shots/v5-card-phone.png` });
  // Tap on empty sky lets go.
  const box = await p.locator('#world').boundingBox();
  await p.touchscreen.tap(box.x + 30, box.y + 40);
  await p.waitForTimeout(300);
  console.log('tap sky → tag hidden:', await p.evaluate(() => document.getElementById('tag').hidden));
  await p.close();
}

if (which.includes('keys')) {
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } }); errs(p, 'keys');
  await p.goto('http://localhost:8931/index.html?debug'); await ready(p);
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
  const focused = await p.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  const before = await p.evaluate(() => window.__garden.camera.position.toArray().map((v) => +v.toFixed(2)));
  await p.focus('#world');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('+');
  await p.waitForTimeout(400);
  const after = await p.evaluate(() => ({ pos: window.__garden.camera.position.toArray().map((v) => +v.toFixed(2)), auto: window.__garden.controls.autoRotate }));
  console.log('keys: third tab on', focused, 'camera', JSON.stringify(before), '→', JSON.stringify(after));
  await p.screenshot({ path: `${S}/shots/v5-keys-focus.png` });
  await p.close();
}

if (which.includes('reduced')) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 820 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); errs(p, 'reduced');
  await p.goto('http://localhost:8931/index.html?debug'); await ready(p);
  const a = await p.evaluate(() => window.__garden.doing());
  await p.waitForTimeout(3000);
  await p.evaluate(() => window.__garden.advance(10));
  const c = await p.evaluate(() => window.__garden.doing());
  console.log('reduced: same after 13 s:', JSON.stringify(a) === JSON.stringify(c), 'autoRotate', await p.evaluate(() => window.__garden.controls.autoRotate), JSON.stringify(a.map((x) => x.pose + ':' + x.doing)));
  await p.screenshot({ path: `${S}/shots/v5-reduced-desktop.png` });
  await ctx.close();
}

if (which.includes('many')) {
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } }); errs(p, 'many');
  await p.goto('http://localhost:8931/index.html?debug&cats=30'); await ready(p);
  await p.evaluate(() => window.__garden.advance(8));
  console.log('30 cats stats', JSON.stringify(await p.evaluate(() => window.__garden.stats())));
  // Real frame time of the simulation + matrix upload (not the software GPU): time 120 sim+herd steps.
  console.log('sim ms/frame (30 cats)', await p.evaluate(() => { const g = window.__garden; const t = performance.now(); for (let i = 0; i < 300; i++) g.sim.update(1 / 60); return ((performance.now() - t) / 300).toFixed(3); }));
  await p.screenshot({ path: `${S}/shots/v5-30cats-desktop-08s.png` });
  await p.evaluate(() => window.__garden.advance(20));
  await p.screenshot({ path: `${S}/shots/v5-30cats-desktop-28s.png` });
  await p.close();
}

if (which.includes('real')) {
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } }); errs(p, 'real');
  await p.route('**/assets/residents.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `export async function loadResidents(){ return [
    { id: 'So11111111111111111111111111111111111111112', name: 'Biscuit', ticker: 'BISC', pair: 'SPYx', arrived: '2026-10-01', mint: 'So11111111111111111111111111111111111111112', example: false, look: { model: 'ginger', tint: '#ffffff', swatch: '#e98a2e' }, links: { token: 'https://solscan.io/token/So11111111111111111111111111111111111111112', tx: 'https://solscan.io/tx/abc', stonkfun: 'https://www.stonkfun.xyz/token/So11111111111111111111111111111111111111112' } },
    { id: 'Tok2', name: 'Pudding', ticker: 'PUDD', pair: 'GLDx', arrived: '2026-10-02', mint: 'Tok2aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', example: false, look: { model: 'cat', tint: '#9c9aa8', swatch: '#8f8c99' } } ]; }` }));
  await p.goto('http://localhost:8931/index.html?debug'); await ready(p);
  await p.evaluate(() => window.__garden.choose('So11111111111111111111111111111111111111112'));
  await p.waitForTimeout(400);
  console.log('real: status', await p.textContent('#status'), '| note', await p.textContent('#residents-note'), '| tag', JSON.stringify(await p.evaluate(() => document.getElementById('tag').innerText)));
  await p.locator('#residents').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${S}/shots/v5-real-cards.png` });
  await p.close();
}
await b.close();

if (which.includes('nowebgl')) {
  const b2 = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--disable-3d-apis', '--disable-webgl', '--disable-gpu'] });
  for (const vp of [{ width: 1280, height: 820 }, { width: 400, height: 860 }]) {
    const p = await b2.newPage({ viewport: vp }); errs(p, 'nowebgl');
    await p.goto('http://localhost:8931/index.html'); await ready(p);
    console.log('no-webgl', vp.width, 'ready=', await p.evaluate(() => document.getElementById('stage').dataset.ready), '| msg:', await p.textContent('#loading'), '| cards:', await p.locator('.resident').count());
    await p.screenshot({ path: `${S}/shots/v5-nowebgl-${vp.width}.png` });
    await p.close();
  }
  await b2.close();
}
