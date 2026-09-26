/* Water: the three ponds, the stream and the fountain's basin. One shader for all of it: small
   waves and scattered rain-drop ripples bend the surface, the Fresnel term mixes a clear, tinted
   body (paler over the shallows, with a soft bright rim at the shore) with what it reflects, and
   the sun leaves a sparkling highlight (which the bloom picks up). What it reflects is the sky,
   worked out from the same gradient the sky dome draws, or, on the high tier, a real mirror image
   of the garden (three.js Reflector, at half resolution, only when a pond is in view), for the
   ponds, whose water all sits at one level. The stream flows: its ripples run downstream. */

import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import * as L from "./layout.js";
import { SKY } from "./sky.js";
import { AMBIENT } from "./ambient.js";

export const WATER_Y = -0.04;

const VERT = /* glsl */`
  attribute float aDepth;
  attribute vec2 aFlow;
  uniform mat4 textureMatrix;
  varying vec3 vWorldP;
  varying float vDepth;
  varying vec2 vFlow;
  varying vec4 vMirror;
  #include <fog_pars_vertex>
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldP = wp.xyz;
    vDepth = aDepth;
    vFlow = aFlow;
    vMirror = textureMatrix * wp;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const FRAG = /* glsl */`
  uniform float uTime, uMirror;
  uniform sampler2D tMirror;
  uniform vec3 uTop, uMid, uHorizon, uSunDir, uSunCol, uDeep, uShallow, uRim;
  varying vec3 vWorldP;
  varying float vDepth;
  varying vec2 vFlow;
  varying vec4 vMirror;
  #include <common>
  #include <fog_pars_fragment>
  vec3 skyAt(vec3 d) {
    float h = max(d.y, 0.0);
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.1, h));
    col = mix(col, uTop, smoothstep(0.08, 0.45, h));
    float s = max(dot(d, uSunDir), 0.0);
    col += uSunCol * pow(s, 40.0) * 0.4;
    return col;
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // The water's height field: crossing wavelets (drifting downstream on the stream) and raindrop rings.
  float waves(vec2 p) {
    vec2 f = vFlow * uTime * 0.9;
    float h = sin(dot(p - f, vec2(1.9, 1.2)) + uTime * 1.1) * 0.5
            + sin(dot(p - f, vec2(-1.3, 2.3)) * 1.4 + uTime * 1.5) * 0.3
            + sin(dot(p - f * 1.3, vec2(3.7, -2.9)) + uTime * 2.3) * 0.14
            + sin(dot(p - f, vec2(-5.1, -4.3)) + uTime * 2.9) * 0.08;
    vec2 cell = floor(p / 2.6);
    for (int i = 0; i < 4; i++) {
      vec2 c = cell + vec2(float(i - (i / 2) * 2), float(i / 2));
      float rnd = hash(c);
      float period = 3.0 + rnd * 4.0;
      float t = mod(uTime + rnd * 17.0, period);
      vec2 o = (c + vec2(hash(c + 3.1), hash(c + 7.7))) * 2.6;
      float d = length(p - o);
      float ring = sin(d * 16.0 - t * 9.0) * exp(-t * 1.3) * smoothstep(t * 1.1 + 0.05, t * 1.1 - 0.3, d) * step(0.55, rnd);
      h += ring * 0.35;
    }
    return h;
  }
  void main() {
    vec2 p = vWorldP.xz;
    float e = 0.05;
    float h0 = waves(p);
    vec3 N = normalize(vec3(-(waves(p + vec2(e, 0.0)) - h0) / e * 0.045, 1.0, -(waves(p + vec2(0.0, e)) - h0) / e * 0.045));
    vec3 V = normalize(cameraPosition - vWorldP);
    float fres = 0.06 + 0.94 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 R = reflect(-V, N);
    vec3 refl = skyAt(R);
    if (uMirror > 0.5) {
      vec2 uv = vMirror.xy / vMirror.w + N.xz * 0.035;
      vec3 m = texture2D(tMirror, uv).rgb;
      refl = mix(refl, m, 0.92);
    }
    vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 0.8, vDepth));
    // A little light scattered up through the water on the sun's side.
    body += uShallow * 0.12 * pow(max(dot(-V, uSunDir), 0.0), 3.0);
    vec3 col = mix(body, refl, fres);
    float spec = pow(max(dot(R, uSunDir), 0.0), 380.0);
    col += uSunCol * spec * 5.0;
    col += uSunCol * pow(max(dot(R, uSunDir), 0.0), 40.0) * 0.18;
    // A soft pale rim at the shore.
    float rim = 1.0 - smoothstep(0.0, 0.12, vDepth);
    col = mix(col, uRim, rim * 0.55 * (0.7 + 0.3 * sin(p.x * 3.0 + p.y * 2.0 + uTime)));
    gl_FragColor = vec4(col, mix(0.72, 0.96, smoothstep(0.0, 0.5, vDepth)));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

function waterMaterial(sunDir, { mirror = null, deep = 0x1f7fb4, shallow = 0x5cc3d4 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, fog: true, depthWrite: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: AMBIENT.uTime,
      uMirror: { value: mirror ? 1 : 0 },
      tMirror: { value: mirror ? mirror.getRenderTarget().texture : null },
      textureMatrix: { value: new THREE.Matrix4() },
      uTop: { value: new THREE.Color(SKY.top) }, uMid: { value: new THREE.Color(SKY.mid) }, uHorizon: { value: new THREE.Color(SKY.horizon) },
      uSunDir: { value: sunDir.clone().normalize() }, uSunCol: { value: new THREE.Color(0xfff1d0) },
      uDeep: { value: new THREE.Color(deep) }, uShallow: { value: new THREE.Color(shallow) }, uRim: { value: new THREE.Color(0xe8f7f4) },
    },
    vertexShader: VERT, fragmentShader: FRAG,
  });
}

/** A round pond's surface: a disc a little wider than the pond (its edge hides under the bank). */
function disc(P, y, segs = 64, rings = 8) {
  const R = P.r + 0.35;
  const pos = [0, y, 0], depth = [1], idx = [];
  for (let i = 1; i <= rings; i++) {
    const r = (i / rings) * R;
    for (let k = 0; k < segs; k++) {
      const a = (k / segs) * Math.PI * 2;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      depth.push(Math.max(0, 1 - r / P.r) ** 0.8);
    }
  }
  for (let k = 0; k < segs; k++) idx.push(0, 1 + ((k + 1) % segs), 1 + k);
  for (let i = 1; i < rings; i++) for (let k = 0; k < segs; k++) {
    const a = 1 + (i - 1) * segs + k, b = 1 + (i - 1) * segs + ((k + 1) % segs), c = a + segs, d = b + segs;
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aDepth", new THREE.Float32BufferAttribute(depth, 1));
  g.setAttribute("aFlow", new THREE.Float32BufferAttribute(new Float32Array(depth.length * 2), 2));
  g.setIndex(idx);
  g.translate(P.x, 0, P.z);
  g.computeBoundingSphere();
  return g;
}

/** The stream's surface: a ribbon down its centre line, level across, stepping down with the land. */
function ribbon() {
  const S = L.streamSamples();
  const half = L.STREAM.w * 0.5 + 1.5;
  const pos = [], depth = [], flow = [], idx = [];
  let prev = -1;
  for (let i = 0; i < S.length; i++) {
    const p = S[i], q = S[Math.min(S.length - 1, i + 1)], o = S[Math.max(0, i - 1)];
    const dry = Math.hypot(p.x, p.z) < 46 || Math.hypot(p.x - L.POND3.x, p.z - L.POND3.z) < L.POND3.r - 0.6;
    if (dry) { prev = -1; continue; }
    const tx = q.x - o.x, tz = q.z - o.z, tl = Math.hypot(tx, tz) || 1;
    const nx = -tz / tl, nz = tx / tl, y = L.streamWater(p);
    const base = pos.length / 3;
    for (const [u, d] of [[-1, 0], [-0.55, 0.7], [0, 1], [0.55, 0.7], [1, 0]]) {
      pos.push(p.x + nx * u * half, y, p.z + nz * u * half);
      depth.push(d * 0.7);
      flow.push(tx / tl * 0.8, tz / tl * 0.8);
    }
    if (prev >= 0) for (let k = 0; k < 4; k++) idx.push(prev + k, prev + k + 1, base + k, prev + k + 1, base + k + 1, base + k);
    prev = base;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aDepth", new THREE.Float32BufferAttribute(depth, 1));
  g.setAttribute("aFlow", new THREE.Float32BufferAttribute(flow, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/**
 * @param {THREE.Scene} scene
 * @param {object} o
 * @param {THREE.Vector3} o.sunDir
 * @param {object} o.q    the quality tier (q.mirror: planar reflections on the ponds)
 */
export function buildWater(scene, { sunDir, q }) {
  const group = new THREE.Group();
  group.name = "water";
  scene.add(group);
  let mirror = null;
  if (q.mirror) {
    mirror = new Reflector(new THREE.PlaneGeometry(1, 1), { textureWidth: 512, textureHeight: 512, clipBias: 0.002, multisample: 0 });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = WATER_Y;
    mirror.updateMatrixWorld();
    mirror.camera.layers.set(0);
  }
  const mirrorInv = mirror ? mirror.matrixWorld.clone().invert() : null;
  const ponds = [L.POND, L.POND2, L.POND3];
  const pondMat = waterMaterial(sunDir, { mirror });
  const pondMesh = new THREE.Mesh(
    (() => { const gs = ponds.map((P) => disc(P, WATER_Y)); const pos = [], dep = [], fl = [], idx = []; let off = 0; for (const g of gs) { pos.push(...g.attributes.position.array); dep.push(...g.attributes.aDepth.array); fl.push(...g.attributes.aFlow.array); idx.push(...Array.from(g.index.array, (i) => i + off)); off += g.attributes.position.count; } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("aDepth", new THREE.Float32BufferAttribute(dep, 1)); g.setAttribute("aFlow", new THREE.Float32BufferAttribute(fl, 2)); g.setIndex(idx); g.computeBoundingSphere(); return g; })(),
    pondMat,
  );
  pondMesh.name = "ponds";
  const streamMat = waterMaterial(sunDir, { deep: 0x2a8fbd, shallow: 0x6fcad2 });
  const stream = new THREE.Mesh(ribbon(), streamMat);
  stream.name = "stream";
  const H = L.HALL_OF_FAME.fountain;
  const fountain = new THREE.Mesh(disc({ x: H.x, z: H.z, r: H.r - 0.4 }, 0.45, 40, 4), waterMaterial(sunDir, { deep: 0x4fb0d8, shallow: 0x9ee0f0 }));
  fountain.name = "fountain water";
  for (const m of [pondMesh, stream, fountain]) { m.layers.set(1); m.renderOrder = 1; group.add(m); }

  // Which ponds the camera can see decides whether the mirror is drawn this frame.
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), spheres = ponds.map((P) => new THREE.Sphere(new THREE.Vector3(P.x, 0, P.z), P.r + 0.5));
  let mirrorOn = false;
  return {
    group,
    meshes: [pondMesh, stream, fountain],
    get mirrored() { return mirrorOn; },
    /** Draws the mirror image (high tier) when a pond is on screen. Call before the frame is drawn. */
    update(renderer, scene, camera) {
      if (!mirror) return;
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(pv);
      mirrorOn = spheres.some((s) => frustum.intersectsSphere(s) && s.center.distanceTo(camera.position) < 140);
      pondMat.uniforms.uMirror.value = mirrorOn ? 1 : 0;
      if (mirrorOn) {
        mirror.onBeforeRender(renderer, scene, camera);
        // The Reflector's matrix maps its own plane's local points; ours are world points.
        pondMat.uniforms.textureMatrix.value.copy(mirror.material.uniforms.textureMatrix.value).multiply(mirrorInv);
      }
    },
    /** The mirror's resolution follows the canvas (half of it). */
    setSize(w, h) { if (mirror) mirror.getRenderTarget().setSize(Math.max(64, Math.round(w / 2)), Math.max(64, Math.round(h / 2))); },
  };
}
