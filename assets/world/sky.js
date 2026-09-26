/* The daytime sky: a gradient dome from warm blue overhead to soft peach at the horizon, a sun
   disc with a wide glow, and low-poly puffy clouds drifting slowly across. Everything here is
   drawn without fog; the ground's haze is tuned to the dome's horizon colour so the far hills
   melt into it. */

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
    new THREE.SphereGeometry(900, 48, 24),
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
  const count = mobile ? 14 : 20;
  const clouds = [];
  for (let i = 0; i < count; i++) {
    // Most clouds sit well away from the garden, lower the further out, so plenty show above the horizon.
    const a = rnd.range(0, Math.PI * 2), d = rnd.range(90, 330);
    const y = 26 + (1 - (d - 90) / 240) * 34 + rnd.range(-6, 6);
    clouds.push({ shape: i % 3, x: Math.cos(a) * d, y, z: Math.sin(a) * d, s: rnd.range(4.5, 9) * (0.8 + d / 330), ry: rnd.range(0, Math.PI * 2), v: rnd.range(0.35, 0.8) });
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

  return {
    group,
    dome,
    /** Keeps the dome round the camera and lets the clouds drift (not with reduced motion). */
    update(dt, camera, still) {
      dome.position.copy(camera.position);
      if (still) return;
      for (const c of clouds) {
        c.x += c.v * dt;
        if (c.x > 340) c.x -= 680;
      }
      place();
    },
  };
}
