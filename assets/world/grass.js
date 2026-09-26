/* Grass: real blades, lots of them. Each blade is a tapered, curved strip of five triangles, drawn
   instanced in 16-unit chunks round the camera: a chunk's blades are made (a couple of chunks a
   frame) when the camera first comes near, and dropped from drawing once it is far. The blades
   are shuffled, so a far chunk simply draws fewer of them (wider, to keep the cover) and the last
   stretch fades them down into the ground, where the ground's own texture carries on. They bend in
   the same wind as the flowers and trees (ambient.js), are short and lush on the mown lawn, longer
   and sunnier out in the meadows, and grow only where the ground is grass (terrain.js surfaceAt). */

import * as THREE from "three";
import * as L from "./layout.js";
import { makeRandom } from "./rng.js";
import { AMBIENT, WIND_GLSL } from "./ambient.js";
import { surfaceAt, tintAt, vnoise } from "./terrain.js";

const CHUNK = 16;
const _c = new THREE.Color();

/** One blade: 7 vertices up a unit-high strip (x across, y up); the shader bends and sizes it. */
function bladeGeometry() {
  const ys = [0, 0.3, 0.62, 1], ws = [1, 0.86, 0.55, 0];
  const pos = [], idx = [];
  ys.forEach((y, i) => { if (ws[i] > 0) pos.push(-ws[i] * 0.5, y, 0, ws[i] * 0.5, y, 0); else pos.push(0, y, 0); });
  for (let i = 0; i < 2; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  idx.push(4, 5, 6);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

/**
 * @param {THREE.Scene} scene
 * @param {object} o
 * @param {object} o.q        the quality tier: grass density (blades per square unit, lawn and meadow), fade distance
 * @param {(x: number, z: number) => boolean} o.blocked  true where something stands (the cottage, beds, bowls…)
 */
export function buildGrass(scene, { q, blocked }) {
  const group = new THREE.Group();
  group.name = "grass";
  scene.add(group);
  const blade = bladeGeometry();
  const uniforms = { uTime: AMBIENT.uTime, uFade: { value: q.grassFade }, uEye: { value: new THREE.Vector3() } };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.6 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
        attribute vec4 aBase;   // x, y, z, turn
        attribute vec4 aShape;  // height, width, lean, stiffness
        attribute vec3 aTint;
        uniform float uFade;
        uniform vec3 uEye;
        varying vec3 vTint;
        varying float vT;
        ${WIND_GLSL}`)
      .replace("#include <beginnormal_vertex>", `
        float ca = cos(aBase.w), sa = sin(aBase.w);
        // Mostly up, so both faces of a blade catch the sun like the lawn round it.
        vec3 objectNormal = normalize(vec3(sa * 0.45, 0.8, ca * 0.45));`)
      .replace("#include <begin_vertex>", `
        float dist = distance(aBase.xz, uEye.xz);
        float fade = 1.0 - smoothstep(uFade * 0.62, uFade, dist);
        float grow = aShape.x * fade;
        float t = position.y;
        // Wider far away (fewer blades are drawn there), and every blade curves as it rises.
        float wide = aShape.y * (1.0 + smoothstep(18.0, uFade, dist) * 1.6);
        vec3 transformed = vec3(position.x * wide, t * grow, 0.0);
        transformed.z += aShape.z * t * t * grow;
        transformed = vec3(ca * transformed.x + sa * transformed.z, transformed.y, -sa * transformed.x + ca * transformed.z);
        vec2 w = windAt(aBase.xz) * aShape.w;
        transformed.xz += w * t * t * grow * 0.55;
        transformed.y -= dot(w, w) * t * t * grow * 0.12;
        transformed += aBase.xyz;
        vTint = aTint;
        vT = t;`)
      .replace("#include <project_vertex>", `
        vec4 mvPosition = viewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;`)
      .replace("#include <worldpos_vertex>", `vec4 worldPosition = vec4(transformed, 1.0);`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n#undef DOUBLE_SIDED\nvarying vec3 vTint;\nvarying float vT;")
      .replace("#include <color_fragment>", `
        // Darker at the root (in the shade of the others), sunlit and a touch yellow at the tip.
        vec3 root = vTint * vec3(0.48, 0.6, 0.42);
        vec3 tip = mix(vTint * 1.18, vec3(0.93, 0.95, 0.62), 0.16);
        diffuseColor.rgb = mix(root, tip, smoothstep(0.0, 1.0, vT));`);
  };
  mat.customProgramCacheKey = () => "grass-v1";

  /* ── Chunks ── */
  const R = q.grassR;
  const chunks = [];
  for (let cx = -R; cx < R; cx += CHUNK) for (let cz = -R; cz < R; cz += CHUNK) {
    const mx = cx + CHUNK / 2, mz = cz + CHUNK / 2;
    if (Math.hypot(mx, mz) > R + CHUNK) continue;
    chunks.push({ x: mx, z: mz, mesh: null, built: false });
  }
  const bladesIn = (ch) => {
    const rnd = makeRandom(`grass-${ch.x},${ch.z}`);
    const inGarden = Math.hypot(ch.x, ch.z) < L.GARDEN.fenceR + CHUNK;
    const max = Math.round(CHUNK * CHUNK * (inGarden ? q.grassLawn : q.grassMeadow));
    const base = new Float32Array(max * 4), shape = new Float32Array(max * 4), tint = new Float32Array(max * 3);
    let n = 0;
    for (let t = 0; t < max; t++) {
      const x = ch.x + rnd.range(-CHUNK / 2, CHUNK / 2), z = ch.z + rnd.range(-CHUNK / 2, CHUNK / 2);
      const r = Math.hypot(x, z);
      if (r > R) continue;
      const lawn = r < L.GARDEN.fenceR + 0.3;
      // Blades are cheap to reject in bulk: sample the surface coarsely, then thin by it.
      const s = surfaceAt(x, z);
      if (rnd.next() > s.grass * 1.15 - 0.1) continue;
      if (Math.abs(r - L.GARDEN.fenceR) < 0.12) continue;
      if (L.inWater(x, z, 0.1) || L.inHall(x, z, 0.2) || L.onBridge(x, z)) continue;
      if (lawn && blocked(x, z)) continue;
      const y = L.groundHeight(x, z);
      const patch = vnoise(x * 0.13, z * 0.13);
      const field = L.FLOWER_FIELDS.some((f) => ((x - f.x) / f.rx) ** 2 + ((z - f.z) / f.rz) ** 2 < 1.2);
      const tall = lawn ? rnd.range(0.14, 0.26) * (0.8 + patch * 0.5) : rnd.range(0.3, 0.62) * (0.7 + patch * 0.6) * (field ? 1.15 : 1) * (1 - 0.5 * (1 - L.smooth(3, 10, Math.abs(r - L.MEADOW.ring1.path))) - 0.4 * (1 - L.smooth(3, 10, Math.abs(r - L.MEADOW.ring2.path))));
      base.set([x, y - 0.02, z, rnd.range(0, 6.283)], n * 4);
      shape.set([tall, lawn ? rnd.range(0.035, 0.055) : rnd.range(0.04, 0.07), rnd.range(0.05, 0.35) * tall, lawn ? 0.28 : 0.55], n * 4);
      tintAt(x, z, y, _c);
      const l = rnd.range(0.9, 1.12);
      tint.set([_c.r * l, _c.g * l, _c.b * l * rnd.range(0.92, 1.05)], n * 3);
      n++;
    }
    return { base: base.subarray(0, n * 4), shape: shape.subarray(0, n * 4), tint: tint.subarray(0, n * 3), n };
  };
  function build(ch) {
    ch.built = true;
    const d = bladesIn(ch);
    if (!d.n) return;
    const g = new THREE.InstancedBufferGeometry();
    g.index = blade.index;
    g.attributes.position = blade.attributes.position;
    g.attributes.normal = blade.attributes.normal;
    g.setAttribute("aBase", new THREE.InstancedBufferAttribute(d.base, 4));
    g.setAttribute("aShape", new THREE.InstancedBufferAttribute(d.shape, 4));
    g.setAttribute("aTint", new THREE.InstancedBufferAttribute(d.tint, 3));
    g.instanceCount = d.n;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(ch.x, L.groundHeight(ch.x, ch.z) + 0.4, ch.z), CHUNK * 0.75 + 2);
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = q.grassShadows;
    m.name = "grass chunk";
    m.userData.n = d.n;
    ch.mesh = m;
    group.add(m);
  }

  let blades = 0;
  return {
    group,
    /**
     * Makes the chunks near the camera (at most `budget` a call), shows what is within reach and
     * thins what is far. Returns how many chunks are still to make near the view.
     */
    update(camera, budget = 2) {
      const eye = camera.position;
      uniforms.uEye.value.copy(eye);
      const reach = q.grassFade + CHUNK * 0.75;
      const want = [];
      blades = 0;
      for (const ch of chunks) {
        const d = Math.hypot(ch.x - eye.x, ch.z - eye.z);
        if (d > reach) { if (ch.mesh) ch.mesh.visible = false; continue; }
        if (!ch.built) { want.push([d, ch]); continue; }
        if (!ch.mesh) continue;
        ch.mesh.visible = true;
        // Fewer blades further off.
        const k = d < 20 ? 1 : Math.max(0.22, 1 - (d - 20) / (q.grassFade * 1.1));
        ch.mesh.geometry.instanceCount = Math.max(1, Math.round(ch.mesh.userData.n * k));
        blades += ch.mesh.geometry.instanceCount;
      }
      want.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < Math.min(budget, want.length); i++) build(want[i][1]);
      return want.length - Math.min(budget, want.length);
    },
    get blades() { return blades; },
  };
}
