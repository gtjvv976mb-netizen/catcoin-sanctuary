/* The daytime sky: a gradient dome from warm blue overhead to soft peach at the horizon, a sun
   disc with a wide glow, low-poly puffy clouds drifting slowly across, and two ranges of distant
   mountains all round (pale blue with snowy tops, fading into the haze at their feet: aerial
   perspective baked into their colours). Everything here is drawn without fog; the ground's haze
   is tuned to the dome's horizon colour so the far hills melt into it. The same sky, with a green
   bounce from below, is rendered once into an environment map (PMREM) that lights every PBR
   material in the world (image-based lighting). */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { makeRandom } from "./rng.js";

export const SKY = {
  top: 0x4f9ee0,       // warm blue overhead
  mid: 0x8fc6ef,
  horizon: 0xffe2c4,   // soft peach haze
  sunDisc: 0xffe9a6,
  sunGlow: 0xffd9a0,
};

/**
 * @param {THREE.Scene} scene
 * @param {object} o
 * @param {THREE.Vector3} o.sunDir  where the sun disc sits (unit vector, world space)
 * @param {boolean} o.mobile
 */
export function buildSky(scene, { sunDir, mobile = false }) {
  const group = new THREE.Group();
  group.name = "sky";
  scene.add(group);

  /* ── The dome ── */
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(SKY.top) }, uMid: { value: new THREE.Color(SKY.mid) }, uHorizon: { value: new THREE.Color(SKY.horizon) },
        uSunDir: { value: sunDir.clone().normalize() }, uDisc: { value: new THREE.Color(SKY.sunDisc) }, uGlow: { value: new THREE.Color(SKY.sunGlow) },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww; // always at the far plane
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uTop, uMid, uHorizon, uSunDir, uDisc, uGlow;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.1, h));
          col = mix(col, uTop, smoothstep(0.08, 0.45, h));
          float s = max(dot(d, uSunDir), 0.0);
          // A warm wash on the sun's side of the sky, a glow, and the disc itself.
          col = mix(col, uGlow, pow(s, 6.0) * 0.35 * (1.0 - smoothstep(0.1, 0.6, h)));
          col += uGlow * (pow(s, 12.0) * 0.12 + pow(s, 40.0) * 0.4 + pow(s, 320.0) * 0.55 + pow(s, 2400.0) * 0.5); // a soft bloom round the sun
          col = mix(col, uDisc * 1.55, smoothstep(0.9993, 0.99946, s));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.name = "sky dome";
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  /* ── Clouds: three puffy shapes, instanced, each puff shaded bright on top and a touch warmer below ── */
  const rnd = makeRandom("clouds");
  const sun = sunDir.clone().normalize();
  const makeShape = (puffs) => {
    const parts = [];
    for (const [x, y, z, r] of puffs) {
      const g = new THREE.IcosahedronGeometry(r, 1);
      g.translate(x, y, z);
      // Flatten the bottom a little.
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) * 0.45);
      g.deleteAttribute("uv");
      g.computeVertexNormals();
      const n = g.attributes.normal, col = new Float32Array(p.count * 3), c = new THREE.Color();
      for (let i = 0; i < p.count; i += 3) {
        const ny = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3;
        const ns = new THREE.Vector3(n.getX(i) + n.getX(i + 1) + n.getX(i + 2), n.getY(i) + n.getY(i + 1) + n.getY(i + 2), n.getZ(i) + n.getZ(i + 1) + n.getZ(i + 2)).normalize().dot(sun);
        c.setHex(0xe9e4ef).lerp(new THREE.Color(0xffffff), 0.5 + ny * 0.5).lerp(new THREE.Color(0xfff1dc), Math.max(0, ns) * 0.35);
        if (ny < -0.3) c.lerp(new THREE.Color(0xf3dccb), 0.35);
        for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.deleteAttribute("normal");
      parts.push(g);
    }
    return mergeGeometries(parts);
  };
  const shapes = [
    makeShape([[0, 0, 0, 1.6], [1.5, -0.2, 0.2, 1.2], [-1.5, -0.25, -0.1, 1.15], [0.6, 0.7, -0.2, 1.0], [-0.6, 0.55, 0.3, 0.95], [2.6, -0.45, 0, 0.8], [-2.5, -0.5, 0.2, 0.75]]),
    makeShape([[0, 0, 0, 1.3], [1.2, 0.1, 0, 1.1], [2.3, -0.2, 0.2, 0.9], [-1.1, -0.1, 0.1, 1.0], [0.5, 0.75, 0, 0.8], [-2.1, -0.35, 0, 0.7], [3.2, -0.45, 0, 0.6]]),
    makeShape([[0, 0, 0, 1.1], [0.95, 0.15, 0.1, 0.9], [-0.9, -0.1, 0, 0.85], [0.1, 0.6, 0, 0.75], [1.8, -0.3, 0, 0.6]]),
  ];
  const count = mobile ? 18 : 30;
  const clouds = [];
  for (let i = 0; i < count; i++) {
    // Most clouds sit well away from the garden, lower the further out, so plenty show above the horizon.
    const a = rnd.range(0, Math.PI * 2), d = rnd.range(160, 900);
    const y = 70 + (1 - (d - 160) / 740) * 90 + rnd.range(-12, 12) + d * 0.08;
    clouds.push({ shape: i % 3, x: Math.cos(a) * d, y, z: Math.sin(a) * d, s: rnd.range(9, 17) * (0.8 + d / 500), ry: rnd.range(0, Math.PI * 2), v: rnd.range(0.6, 1.4) });
  }
  const meshes = shapes.map((g, k) => {
    const n = clouds.filter((c) => c.shape === k).length;
    const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), n);
    m.name = `clouds-${k}`;
    m.frustumCulled = false;
    group.add(m);
    return m;
  });
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
  const place = () => {
    const idx = [0, 0, 0];
    for (const c of clouds) {
      _m.compose(_p.set(c.x, c.y, c.z), _q.setFromAxisAngle(_y, c.ry), _s.set(c.s, c.s * 0.8, c.s * 0.9));
      meshes[c.shape].setMatrixAt(idx[c.shape]++, _m);
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  };
  place();

  /* ── Distant mountains: two ranges all round, lit from the sun's side, hazier the further ── */
  {
    const haze = new THREE.Color(SKY.horizon).lerp(new THREE.Color(0xcfe3ee), 0.35);
    const pos = [], col = [], idx = [];
    const ranges = [
      { r: 820, depth: 260, peak: 170, seed: 1.3, base: 0x8fa9c4, snow: 0xf4f6fa, haze: 0.42 },
      { r: 1120, depth: 280, peak: 240, seed: 4.1, base: 0xa7b9d2, snow: 0xf7f8fb, haze: 0.62 },
    ];
    const SEG = mobile ? 256 : 400, ROWS = 7;
    const sun = sunDir.clone().setY(0).normalize();
    for (const R of ranges.reverse()) {
      // Lower where the sun is, so it never sets behind them.
      const sunA = Math.atan2(sunDir.z, sunDir.x);
      const ridge = (a) => {
        const n = Math.sin(a * 3 + R.seed) * 0.35 + Math.sin(a * 7.3 + R.seed * 2) * 0.25 + Math.sin(a * 17.1 + R.seed * 3) * 0.14 + Math.sin(a * 41 + R.seed) * 0.05;
        const off = Math.atan2(Math.sin(a - sunA), Math.cos(a - sunA));
        return Math.max(0.12, 0.55 + n) * R.peak * (1 - 0.72 * Math.exp(-((off / 0.4) ** 2)));
      };
      const off = pos.length / 3;
      for (let k = 0; k <= SEG; k++) {
        const a = (k / SEG) * Math.PI * 2, top = ridge(a);
        for (let j = 0; j < ROWS; j++) {
          const t = j / (ROWS - 1); // 0 at the foot, 1 at the crest
          const rr = R.r + R.depth * (0.5 - t * 0.5) + Math.sin(a * 23 + j) * 6;
          const y = -12 + top * Math.pow(t, 0.8) * (1 + Math.sin(a * 61 + j * 1.7) * 0.03 * (1 - t));
          pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
          // Lit on the sun's side, a snowy top on the high peaks, and haze thickening towards the foot.
          const facing = 0.5 + 0.5 * (Math.cos(a) * -sun.x + Math.sin(a) * -sun.z) * -1;
          const slope = Math.sin(a * 17.1 + R.seed * 3 + 1.2);
          const c = new THREE.Color(R.base).multiplyScalar(0.86 + 0.24 * facing + slope * 0.05);
          if (y > R.peak * 0.62) c.lerp(new THREE.Color(R.snow), Math.min(1, (y - R.peak * 0.62) / (R.peak * 0.12)) * (0.75 + 0.25 * facing));
          c.lerp(haze, R.haze + (1 - t) * (1 - R.haze) * 0.85);
          col.push(c.r, c.g, c.b);
        }
      }
      for (let k = 0; k < SEG; k++) for (let j = 0; j < ROWS - 1; j++) {
        const a = off + k * ROWS + j, b = a + ROWS;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const mountains = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    mountains.name = "mountains";
    mountains.renderOrder = -5;
    mountains.frustumCulled = false;
    group.add(mountains);
  }

  return {
    group,
    dome,
    /** Keeps the dome round the camera and lets the clouds drift (not with reduced motion). */
    update(dt, camera, still) {
      dome.position.copy(camera.position);
      if (still) return;
      for (const c of clouds) {
        c.x += c.v * dt;
        if (c.x > 950) c.x -= 1900;
      }
      place();
    },
  };
}

/**
 * The sky as an environment map, for image-based lighting: the dome's gradient and sun above, a
 * soft grass-green bounce below. Rendered once.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Vector3} sunDir
 */
export function skyEnvironment(renderer, sunDir) {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(SKY.top) }, uMid: { value: new THREE.Color(SKY.mid) }, uHorizon: { value: new THREE.Color(SKY.horizon) },
      uGround: { value: new THREE.Color(0x7fae5a) }, uSunDir: { value: sunDir.clone().normalize() }, uGlow: { value: new THREE.Color(SKY.sunGlow) },
    },
    vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uMid, uHorizon, uGround, uSunDir, uGlow;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.1, h));
        col = mix(col, uTop, smoothstep(0.08, 0.45, h));
        col = mix(col, uGround * 0.9, smoothstep(0.0, -0.18, h));
        float s = max(dot(d, uSunDir), 0.0);
        col += uGlow * (pow(s, 8.0) * 0.5 + pow(s, 64.0) * 3.0 + pow(s, 900.0) * 20.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.02, 0.1, 100);
  pm.dispose();
  mat.dispose();
  return rt.texture;
}
