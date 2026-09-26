import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const html = `<!doctype html><html><body style="margin:0;background:#888">
<canvas id=c width=1400 height=700></canvas>
<script type="importmap">{"imports":{"three":"/assets/vendor/three/three.module.min.js","three/addons/":"/assets/vendor/three/addons/"}}</script>
<script type=module>
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const r = new THREE.WebGLRenderer({canvas: document.getElementById('c'), antialias:true}); r.setSize(1400,700,false); r.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xaaaaaa);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.5));
const L = new GLTFLoader();
const g = (await L.loadAsync('/assets/models/sanctuary.glb')).scene;
const b = new THREE.Box3().setFromObject(g); window.info = {min: b.min.toArray(), max: b.max.toArray()};
scene.add(g); const ax = new THREE.AxesHelper(1.5); scene.add(ax);
// PCA of walk cats
window.pca = {};
for (const f of ['cat-walk','ginger-walk','cat-stretch','ginger-stretch','cat-loaf','ginger-loaf','cat-sit','ginger-sit']) {
  const m = (await L.loadAsync('/assets/models/'+f+'.glb')).scene; m.updateMatrixWorld(true);
  let pts = []; m.traverse(o => { if (o.isMesh) { const p = o.geometry.attributes.position; const v = new THREE.Vector3(); for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld); pts.push([v.x,v.y,v.z]); } } });
  let mx=0,mz=0; for (const p of pts){mx+=p[0];mz+=p[2];} mx/=pts.length; mz/=pts.length;
  let sxx=0,szz=0,sxz=0; for (const p of pts){const dx=p[0]-mx,dz=p[2]-mz; sxx+=dx*dx; szz+=dz*dz; sxz+=dx*dz;}
  const ang = 0.5*Math.atan2(2*sxz, sxx-szz); // principal axis angle in x-z plane (from +X toward +Z)
  // head: highest points centroid x,z
  const sorted = pts.slice().sort((a,b)=>b[1]-a[1]).slice(0, 60); let hx=0,hz=0; for(const p of sorted){hx+=p[0];hz+=p[2];} hx/=60; hz/=60;
  window.pca[f] = { axisDegFromXtowardZ: (ang*180/Math.PI).toFixed(1), mean:[mx.toFixed(3),mz.toFixed(3)], top:[hx.toFixed(3),hz.toFixed(3)] };
}
window.shot = (px,py,pz) => { const cam = new THREE.PerspectiveCamera(35, 2, 0.1, 100); cam.position.set(px,py,pz); cam.lookAt(0,0,0); r.render(scene, cam); };
window.done = true;
</script></body></html>`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 700 } });
p.on('pageerror', e => console.log('err:', e.message));
await p.route('http://localhost:8931/__viewer.html*', (route) => route.fulfill({ contentType: 'text/html', body: html }));
await p.goto('http://localhost:8931/__viewer.html'); await p.waitForFunction('window.done', null, { timeout: 90000 });
console.log(JSON.stringify(await p.evaluate('window.info'))); console.log(JSON.stringify(await p.evaluate('window.pca'), null, 1));
for (const [n, pos] of Object.entries({ pz: [0, 1.2, 4.5], px: [4.5, 1.2, 0], nz: [0, 1.2, -4.5], nx: [-4.5, 1.2, 0], top: [0.01, 5, 0] })) {
  await p.evaluate(`window.shot(${pos})`); await p.screenshot({ path: `${process.env.S}/house-${n}.png` });
}
await b.close();
