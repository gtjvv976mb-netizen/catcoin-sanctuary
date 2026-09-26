// node shot.mjs [label] [query]  → screenshots desktop + phone, after 8 s and 28 s of simulation
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const S = process.env.S, label = process.argv[2] || 'v', q = process.argv[3] || '';
const only = process.env.ONLY || 'desktop,phone';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const views = { desktop: { width: 1280, height: 820 }, phone: { width: 400, height: 860, deviceScaleFactor: 1, isMobile: true, hasTouch: true } };
for (const [name, vp] of Object.entries(views)) {
  if (!only.split(',').includes(name)) continue;
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor || 1, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText)));
  p.on('request', (r) => { if (!r.url().startsWith('http://localhost:8931') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errs.push('EXTERNAL: ' + r.url()); });
  const t0 = Date.now();
  await p.goto(`http://localhost:8931/index.html?debug${q}`);
  await p.waitForFunction(() => document.getElementById('stage').dataset.ready, null, { timeout: 180000 });
  const ready = await p.evaluate(() => document.getElementById('stage').dataset.ready);
  console.log(name, 'ready', ready, 'in', Date.now() - t0, 'ms');
  if (ready === 'true') {
    await p.evaluate(() => window.__garden.advance(8));
    if (process.env.PICK) await p.evaluate((id) => window.__garden.choose(id), process.env.PICK);
    await p.waitForTimeout(400);
    console.log(name, 'stats', JSON.stringify(await p.evaluate(() => window.__garden.stats())));
    await p.screenshot({ path: `${S}/shots/${label}-${name}-08s.png` });
    if (process.env.FULL) await p.screenshot({ path: `${S}/shots/${label}-${name}-full.png`, fullPage: true });
    if (process.env.DOING) console.log(JSON.stringify(await p.evaluate(() => window.__garden.doing())));
    await p.evaluate(() => window.__garden.advance(20));
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${S}/shots/${label}-${name}-28s.png` });
  } else {
    await p.screenshot({ path: `${S}/shots/${label}-${name}-fallback.png`, fullPage: !!process.env.FULL });
  }
  if (errs.length) console.log(name, 'errors:\n  ' + errs.join('\n  '));
  await ctx.close();
}
await b.close();
