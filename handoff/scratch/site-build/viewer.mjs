import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const html = `<!doctype html><html><body style="margin:0;background:#888">
<canvas id=c width=1400 height=700></canvas>
<script type="importmap">{"imports":{"three":"/assets/vendor/three/three.module.min.js","three/addons/":"/assets/vendor/three/addons/"}}</script>
<script type=module>
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const r = new THREE.WebGLRenderer({canvas: document.getElementById('c'), antialias:true}); r.setSize(1400,700,false);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xaaaaaa);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.5));
const cam = new THREE.PerspectiveCamera(30, 2, 0.1, 100);
const view = new URLSearchParams(location.search).get('view') || 'persp';
if (view==='top') { cam.position.set(4.5, 14, 0.01); } else if (view==='front') { cam.position.set(4.5, 1, 12); } else { cam.position.set(4.5+6, 7, 9); }
cam.lookAt(4.5, 0, 0);
const L = new GLTFLoader(); const files = ${JSON.stringify(process.argv[2] ? process.argv[2].split(',') : ['cat-sit','cat-walk','cat-loaf','cat-stretch','cat-sleep','ginger-sit','ginger-walk','ginger-loaf','ginger-stretch','ginger-sleep'])};
let i = 0;
for (const f of files) {
  const g = (await L.loadAsync('/assets/models/'+f+'.glb')).scene;
  const b = new THREE.Box3().setFromObject(g); const s = b.getSize(new THREE.Vector3());
  window.sizes = window.sizes || {}; window.sizes[f] = [s.x.toFixed(3), s.y.toFixed(3), s.z.toFixed(3), b.min.y.toFixed(3)];
  const col = i % 5, row = Math.floor(i/5);
  g.position.set(col*2.2, 0, row*2.2 - 1.1); scene.add(g);
  const ax = new THREE.AxesHelper(0.9); ax.position.copy(g.position); scene.add(ax);
  i++;
}
r.render(scene, cam); window.done = true;
</script></body></html>`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 700 } });
p.on('console', m => console.log('console:', m.text())); p.on('pageerror', e => console.log('err:', e.message));
await p.route('http://localhost:8931/__viewer.html*', (route) => route.fulfill({ contentType: 'text/html', body: html }));
for (const v of (process.argv[3]||'persp,top').split(',')) {
  await p.goto('http://localhost:8931/__viewer.html?view='+v); await p.waitForFunction('window.done', null, { timeout: 60000 });
  console.log(JSON.stringify(await p.evaluate('window.sizes')));
  await p.screenshot({ path: `${process.env.S}/view-${v}.png` });
}
await b.close();
