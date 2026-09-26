/* The "Catcoin Sanctuary" sign on the cottage roof: the site's wordmark cut out as a thick board
   (the lettering on the front, layers of dark plum behind it for its edge), on two little posts,
   turned towards the usual view. It rocks and bobs gently in the breeze. Two draw calls. */

import * as THREE from "three";
import { AMBIENT } from "./ambient.js";

const ASPECT = 1024 / 570; // assets/models/sign.webp

/**
 * @param {THREE.Scene} scene
 * @param {object} o
 * @param {number} o.roof   the roof ridge's height
 * @param {number} o.yaw    turn towards the home view
 */
export async function buildSign(scene, { roof, yaw = 0.3, width = 4.3 }) {
  const tex = await new THREE.TextureLoader().loadAsync("assets/models/sign.webp");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const w = width, h = width / ASPECT;

  const pivot = new THREE.Group(); // at the foot of the sign, so it rocks about its base
  pivot.name = "roof sign";
  pivot.position.set(-0.1, roof + 0.05, 0.35);
  pivot.rotation.y = yaw;
  scene.add(pivot);

  const plane = new THREE.PlaneGeometry(w, h).translate(0, h / 2 + 0.35, 0);
  const front = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, toneMapped: false, fog: false }));
  front.position.z = 0.02;
  // The board's thickness: the cut-out shape repeated a little behind, in plum, a touch bigger.
  const layers = [];
  for (let k = 1; k <= 7; k++) layers.push(plane.clone().scale(1 + k * 0.003, 1 + k * 0.003, 1).translate(0, -k * 0.012, -k * 0.024));
  const edgeGeo = mergePlanes(layers);
  const edge = new THREE.Mesh(edgeGeo, new THREE.MeshLambertMaterial({ map: tex, color: 0x5a2346, emissive: 0x2a0a20, alphaTest: 0.5, side: THREE.DoubleSide }));
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  edge.customDepthMaterial = depth;
  edge.castShadow = true;
  pivot.add(edge, front);

  // Two wooden posts from the ridge up to the board.
  const post = new THREE.MeshLambertMaterial({ color: 0x8d5d3a });
  for (const x of [-w * 0.28, w * 0.28]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), post);
    m.position.set(x, 0.15, -0.12);
    m.castShadow = true;
    pivot.add(m);
  }

  return {
    group: pivot,
    update(still) {
      const t = AMBIENT.uTime.value;
      pivot.rotation.z = still ? 0 : Math.sin(t * 0.9) * 0.012 + Math.sin(t * 2.3) * 0.004;
      pivot.rotation.x = still ? 0 : Math.sin(t * 0.7 + 1) * 0.01;
      front.position.y = edge.position.y = still ? 0 : Math.sin(t * 1.1) * 0.03;
    },
  };
}

function mergePlanes(list) {
  const pos = [], uv = [], nrm = [], idx = [];
  let base = 0;
  for (const g of list) {
    pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array); nrm.push(...g.attributes.normal.array);
    for (const i of g.index.array) idx.push(i + base);
    base += g.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}
