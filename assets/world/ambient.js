/* The things that make the garden feel alive without costing the CPU anything: one shared clock
   drives the wind (grass, flowers, tree tops and bushes sway in the vertex shader, with gusts
   rolling across the lawn), the pond's shimmer, petals drifting down from the blossom trees,
   golden motes floating over the lawn, soft smoke from the chimney, and a gentle warm vignette.
   Every moving thing here is computed on the GPU from the time uniform, so each system is a
   single draw call and nothing is updated per instance per frame.

   With reduced motion the clock stops: the wind holds still, petals and motes hang in the air. */

import * as THREE from "three";
import { makeRandom } from "./rng.js";

/** The one clock every animated material reads. */
export const AMBIENT = { uTime: { value: 0 } };

/* The wind at a point on the ground: a steady breeze from the west-south-west, small flutters,
   and broad gusts that roll across the garden. Returns a sideways push (roughly 0..1.6). */
export const WIND_GLSL = /* glsl */`
  uniform float uTime;
  vec2 windAt(vec2 p) {
    float t = uTime;
    vec2 dir = vec2(0.94, 0.34);
    float flutter = sin(t * 1.35 + p.x * 0.35 + p.y * 0.27) * 0.32 + sin(t * 2.3 + p.x * 0.9 - p.y * 0.7) * 0.12;
    float g = sin(dot(p, dir) * 0.085 - t * 0.85) * 0.5 + 0.5;
    float gust = smoothstep(0.45, 1.0, g) * (0.85 + 0.25 * sin(t * 4.1 + p.y * 0.6));
    return dir * (0.3 + flutter + gust);
  }`;

/**
 * Makes a material sway in the wind.
 * mode "instance": the push grows with height above the instance's origin (grass, stems).
 * mode "head": like "instance", for flower heads that sit `aH` above the ground.
 * mode "attr": the per-vertex attribute `aWind` gives the push (merged tree tops, bushes).
 */
export function windify(material, mode, strength = 1) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = AMBIENT.uTime;
    const decl = mode === "attr" ? "attribute float aWind;" : mode === "head" ? "attribute float aH;" : "";
    const weight =
      mode === "attr" ? "aWind" :
      mode === "head" ? "pow(aH, 1.4)" :
      "pow(max(0.0, wp.y - base.y), 1.4)";
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${decl}\n${WIND_GLSL}`)
      .replace("#include <project_vertex>", /* glsl */`
        vec4 wp = vec4(transformed, 1.0);
        vec3 base = vec3(0.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          base = instanceMatrix[3].xyz;
        #endif
        wp = modelMatrix * wp;
        base = (modelMatrix * vec4(base, 1.0)).xyz;
        {
          vec2 w = windAt(${mode === "attr" ? "wp.xz" : "base.xz"}) * (${weight}) * ${strength.toFixed(3)};
          wp.xz += w;
          wp.y -= dot(w, w) * 0.35; // bending, not stretching
        }
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  material.customProgramCacheKey = () => `wind-${mode}-${strength}`;
  return material;
}

/** Ripples and sun glints on the pond and the water dishes. */
export function shimmer(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = AMBIENT.uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldP;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldP;\nuniform float uTime;")
      .replace("#include <color_fragment>", /* glsl */`#include <color_fragment>
        vec2 q = vWorldP.xz;
        float t = uTime;
        float w = sin(q.x * 3.1 + t * 1.3 + sin(q.y * 1.7 + t * 0.7)) * sin(q.y * 2.7 - t * 1.1 + sin(q.x * 1.3))
                + 0.5 * sin((q.x + q.y) * 6.3 - t * 2.2);
        diffuseColor.rgb *= 1.0 + w * 0.07;
        float glint = pow(max(0.0, w * 0.55), 6.0);`)
      .replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragColor.rgb += vec3(1.0, 0.97, 0.88) * glint * 0.9;");
  };
  material.customProgramCacheKey = () => "shimmer";
  return material;
}

/**
 * @param {THREE.Scene} scene
 * @param {object} o
 * @param {boolean} o.mobile
 * @param {Array<{x:number,y:number,z:number,r:number}>} o.blossoms  pink tree crowns petals fall from
 * @param {{x:number,y:number,z:number}} o.chimney
 */
export function buildAmbient(scene, { mobile, blossoms, chimney }) {
  const rnd = makeRandom("ambient");
  const group = new THREE.Group();
  group.name = "ambient";
  scene.add(group);

  /* ── Petals: each loops forever from a blossom crown down to the grass, tumbling and drifting ── */
  if (blossoms.length) {
    const n = mobile ? 90 : 220;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -0.06, 0.05, 0, 0, 0, 0, 0.06, 0, 0, -0.06, 0, 0, 0.06, -0.04, 0, 0], 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    const origin = new Float32Array(n * 4), seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const b = blossoms[i % blossoms.length];
      const a = rnd.range(0, Math.PI * 2), d = Math.sqrt(rnd.next()) * b.r;
      origin.set([b.x + Math.cos(a) * d, b.y + rnd.range(-0.4, 0.6), b.z + Math.sin(a) * d, b.ground], i * 4);
      seed.set([rnd.next(), rnd.range(0.06, 0.12), rnd.range(0, 6.28), rnd.range(0.7, 1.3)], i * 4);
    }
    const ig = new THREE.InstancedBufferGeometry().copy(g);
    ig.instanceCount = n;
    ig.setAttribute("aOrigin", new THREE.InstancedBufferAttribute(origin, 4));
    ig.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 4));
    const mat = new THREE.MeshLambertMaterial({ color: 0xffc2d6, emissive: 0x6a2a3c, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = AMBIENT.uTime;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\nattribute vec4 aOrigin;\nattribute vec4 aSeed;\n${WIND_GLSL}
          mat3 rotXYZ(vec3 a) {
            vec3 c = cos(a), s = sin(a);
            return mat3(c.y*c.z, c.y*s.z, -s.y, s.x*s.y*c.z - c.x*s.z, s.x*s.y*s.z + c.x*c.z, s.x*c.y, c.x*s.y*c.z + s.x*s.z, c.x*s.y*s.z - s.x*c.z, c.x*c.y);
          }`)
        .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
          float life = fract(uTime * aSeed.y + aSeed.x);
          mat3 spin = rotXYZ(vec3(uTime * 2.1 * aSeed.w + aSeed.z, uTime * 1.3 + aSeed.z * 2.0, uTime * 1.7 * aSeed.w));
          objectNormal = spin * objectNormal;`)
        .replace("#include <begin_vertex>", `
          float fall = aOrigin.y - aOrigin.w;
          vec3 transformed = spin * position * aSeed.w * smoothstep(0.0, 0.05, life) * (1.0 - smoothstep(0.9, 1.0, life));
          vec3 p = aOrigin.xyz;
          p.y = aOrigin.y - fall * life;
          vec2 w = windAt(p.xz);
          p.xz += w * life * 3.2 + vec2(sin(uTime * 1.9 * aSeed.w + aSeed.z), cos(uTime * 1.6 + aSeed.z)) * 0.35 * life;
          p.y = max(p.y, aOrigin.w + 0.03);
          transformed += p;`);
    };
    mat.customProgramCacheKey = () => "petals";
    const petals = new THREE.Mesh(ig, mat);
    petals.frustumCulled = false;
    petals.name = "petals";
    group.add(petals);
  }

  /* ── Motes: soft golden specks of pollen floating and twinkling over the lawn ── */
  {
    const n = mobile ? 70 : 160;
    const pos = new Float32Array(n * 3), sd = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const a = rnd.range(0, Math.PI * 2), d = Math.sqrt(rnd.next()) * 22;
      pos.set([Math.cos(a) * d, rnd.range(0.3, 3.2), Math.sin(a) * d], i * 3);
      sd.set([rnd.range(0, 6.28), rnd.range(0.25, 0.6), rnd.range(0.6, 1.4), rnd.next()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(sd, 4));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: AMBIENT.uTime, uScale: { value: 1 } },
      vertexShader: /* glsl */`
        uniform float uTime, uScale;
        attribute vec4 aSeed;
        varying float vA;
        void main() {
          float t = uTime * aSeed.y + aSeed.x;
          vec3 p = position + vec3(sin(t) * 1.2 + uTime * 0.12, sin(t * 1.7) * 0.35, cos(t * 0.8) * 1.2);
          p.x = mod(p.x + 24.0, 48.0) - 24.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          vA = (0.55 + 0.45 * sin(uTime * 2.3 * aSeed.z + aSeed.x * 5.0)) * smoothstep(40.0, 8.0, -mv.z) * (1.0 - smoothstep(20.0, 24.0, abs(p.x)));
          gl_PointSize = uScale * (5.0 + 4.0 * aSeed.w) * 10.0 / max(1.0, -mv.z);
        }`,
      fragmentShader: /* glsl */`
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vec3(1.0, 0.9, 0.55) * a * a * vA * 0.9, 1.0);
        }`,
    });
    const motes = new THREE.Points(g, mat);
    motes.frustumCulled = false;
    motes.name = "motes";
    motes.userData.mat = mat;
    group.add(motes);
    group.userData.motes = mat;
  }

  /* ── Chimney smoke: soft puffs rising, swelling and fading, bent by the breeze ── */
  if (chimney) {
    const n = 14;
    const pos = new Float32Array(n * 3), sd = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos.set([chimney.x, chimney.y, chimney.z], i * 3); sd[i] = i / n; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aLife", new THREE.BufferAttribute(sd, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true,
      uniforms: { uTime: AMBIENT.uTime, uScale: { value: 1 }, ...THREE.UniformsLib.fog },
      vertexShader: /* glsl */`
        uniform float uTime, uScale;
        attribute float aLife;
        varying float vA;
        #include <fog_pars_vertex>
        void main() {
          float life = fract(uTime * 0.09 + aLife);
          vec3 p = position + vec3(life * life * 2.6 + sin(uTime * 0.7 + aLife * 9.0) * 0.15 * life, life * 4.2, life * 0.9);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          vA = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.35, 1.0, life));
          gl_PointSize = uScale * (0.5 + life * 1.8) * 300.0 / max(1.0, -mvPosition.z);
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        varying float vA;
        #include <fog_pars_fragment>
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.1, d) * vA * 0.42;
          gl_FragColor = vec4(mix(vec3(0.98, 0.96, 0.95), vec3(0.85, 0.83, 0.86), c.y + 0.5), a);
          #include <fog_fragment>
        }`,
    });
    const smoke = new THREE.Points(g, mat);
    smoke.frustumCulled = false;
    smoke.name = "chimney smoke";
    group.add(smoke);
    group.userData.smoke = mat;
  }

  /* ── A soft warm vignette, drawn last straight in clip space ── */
  {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
      uniforms: { uAspect: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }",
      fragmentShader: /* glsl */`
        uniform float uAspect;
        varying vec2 vUv;
        void main() {
          vec2 c = (vUv - 0.5) * vec2(min(uAspect, 1.6), 1.0);
          float v = smoothstep(0.42, 1.05, length(c));
          // Warm, not grey: a rosy-amber edge, a touch of golden light from the top left (the sun's side).
          float glow = smoothstep(0.9, 0.0, length(vUv - vec2(0.18, 0.95))) * 0.1;
          float ea = v * 0.28;
          float a = ea + glow * (1.0 - ea);
          vec3 col = (vec3(0.45, 0.28, 0.24) * ea + vec3(1.0, 0.86, 0.6) * glow * (1.0 - ea)) / max(a, 1e-4);
          gl_FragColor = vec4(col, a);
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    quad.frustumCulled = false;
    quad.renderOrder = 999;
    quad.name = "vignette";
    group.add(quad);
    group.userData.vignette = mat;
  }

  return {
    group,
    /** `time` is the shared clock (frozen with reduced motion); pixel height for point sizes. */
    update(time, heightPx, aspect, pixelRatio) {
      AMBIENT.uTime.value = time;
      const k = (heightPx * pixelRatio) / 800;
      if (group.userData.motes) group.userData.motes.uniforms.uScale.value = k;
      if (group.userData.smoke) group.userData.smoke.uniforms.uScale.value = k;
      group.userData.vignette.uniforms.uAspect.value = aspect;
    },
  };
}
