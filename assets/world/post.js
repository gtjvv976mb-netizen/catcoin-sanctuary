/* The finishing pass (medium and high tiers; loaded after the first view is up): the scene is
   drawn into a floating-point buffer (multisampled on the high tier), then
     - ambient occlusion (GTAO, high tier only): soft darkening where things meet the ground and
       each other; the grass, the sky and the see-through things are left out of it;
     - a gentle bloom on what is brighter than white: the sun's glints on the water, the lamps;
     - a warm, bright colour grade: a touch more saturation, lifted shadows, a golden tint in the
       highlights, and a soft glow of sunlight from the sun's corner (the "god rays", gently);
     - ACES filmic tone mapping and sRGB output. */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const GRADE = {
  uniforms: {
    tDiffuse: { value: null },
    uSun: { value: new THREE.Vector3(0.2, 0.9, 1) }, // the sun on screen (uv) and how much it is in view
    uAspect: { value: 1 },
    uRays: { value: 1 },
  },
  vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec3 uSun;
    uniform float uAspect, uRays;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      // Soft shafts of sunlight: bright sky pixels smeared out from the sun.
      if (uRays > 0.0 && uSun.z > 0.0) {
        vec2 d = (vUv - uSun.xy) / 14.0;
        vec2 p = vUv;
        float acc = 0.0, w = 1.0;
        for (int i = 0; i < 14; i++) {
          p -= d;
          vec3 s = texture2D(tDiffuse, clamp(p, 0.001, 0.999)).rgb;
          acc += smoothstep(1.05, 1.9, dot(s, vec3(0.33))) * w;
          w *= 0.9;
        }
        float fall = 1.0 - smoothstep(0.0, 0.9, length((vUv - uSun.xy) * vec2(uAspect, 1.0)));
        col += vec3(1.0, 0.86, 0.6) * acc * 0.035 * fall * uSun.z * uRays;
      }
      // Warm, bright grade: a little more colour, lifted shadows, golden highlights.
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 1.22);
      col = col * vec3(1.03, 1.0, 0.95) + vec3(0.006, 0.005, 0.003);
      gl_FragColor = vec4(max(col, 0.0), c.a);
    }`,
};

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {object} o
 * @param {object} o.q            the quality tier
 * @param {THREE.Object3D[]} o.aoSkip   left out of the occlusion pass (grass, sky, water, glass)
 * @param {THREE.Vector3} o.sunDir
 */
export async function createPost(renderer, scene, camera, { q, aoSkip, sunDir }) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (q.ao) {
    const { GTAOPass } = await import("three/addons/postprocessing/GTAOPass.js");
    gtao = new GTAOPass(scene, camera, size.x, size.y);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.75;
    gtao.normalMaterial.flatShading = true; // the merged props carry no normals: take each face's own
    gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.6, thickness: 1.2, scale: 1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    // Things that shouldn't darken (or can't be drawn plainly) are hidden while it looks at the scene.
    const render = gtao.render.bind(gtao);
    gtao.render = (...a) => {
      const was = aoSkip.map((o) => o.visible);
      aoSkip.forEach((o) => { o.visible = false; });
      render(...a);
      aoSkip.forEach((o, i) => { o.visible = was[i]; });
    };
    composer.addPass(gtao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.28, 0.5, 1.3);
  composer.addPass(bloom);
  const grade = new ShaderPass(GRADE);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  const sunV = new THREE.Vector3();
  return {
    composer,
    gtao,
    render() {
      // Where the sun is on screen, for the soft rays.
      sunV.copy(sunDir).multiplyScalar(1000).add(camera.position).project(camera);
      const inView = sunV.z < 1 ? 1 - Math.min(1, Math.max(Math.abs(sunV.x), Math.abs(sunV.y)) - 0.6) : 0;
      grade.uniforms.uSun.value.set(sunV.x * 0.5 + 0.5, sunV.y * 0.5 + 0.5, Math.max(0, Math.min(1, inView)));
      grade.uniforms.uAspect.value = camera.aspect;
      grade.uniforms.uRays.value = q.rays ? 1 : 0;
      composer.render();
    },
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
    dispose() { composer.dispose(); },
  };
}
