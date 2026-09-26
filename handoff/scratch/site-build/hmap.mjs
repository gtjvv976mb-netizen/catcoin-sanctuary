import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = `<!doctype html><html><body>
<script type="importmap">{"imports":{"three":"/assets/vendor/three/three.module.min.js","three/addons/":"/assets/vendor/three/addons/"}}</script>
<script type=module>
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const L = new GLTFLoader();
const house = (await L.loadAsync('/assets/models/sanctuary.glb')).scene;
const HOUSE_H = 5.2;
const b = new THREE.Box3().setFromObject(house); const s = HOUSE_H / (b.max.y - b.min.y);
house.scale.setScalar(s); const b2 = new THREE.Box3().setFromObject(house); const c = b2.getCenter(new THREE.Vector3());
house.position.set(-c.x, -b2.min.y, -c.z); house.updateMatrixWorld(true);
const bb = new THREE.Box3().setFromObject(house);
const ray = new THREE.Raycaster(); const out = []; const step = 0.1;
for (let z = -3.2; z <= 3.8001; z += step) { const row = []; for (let x = -3.2; x <= 3.2001; x += step) {
  ray.set(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0)); const h = ray.intersectObject(house, true);
  // also measure the lowest-hit near ground to find walls: first hit height
  row.push(h.length ? +h[0].point.y.toFixed(2) : -1); } out.push(row); }
window.result = { scale: s, box: [bb.min.toArray(), bb.max.toArray()], hm: out };
window.done = true;
</script></body></html>`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('err:', e.message));
await p.route('http://localhost:8931/__viewer.html*', (route) => route.fulfill({ contentType: 'text/html', body: html }));
await p.goto('http://localhost:8931/__viewer.html'); await p.waitForFunction('window.done', null, { timeout: 300000 });
const r = await p.evaluate('window.result'); fs.writeFileSync(process.env.S + '/hmap.json', JSON.stringify(r));
console.log('scale', r.scale, 'box', JSON.stringify(r.box));
await b.close();
