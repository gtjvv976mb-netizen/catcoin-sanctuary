/* The "Catcoin Sanctuary" sign on the cottage roof: the site's wordmark cut out as a thick board
   (the lettering on the front, layers of dark plum behind it for its edge), on two little posts,
   turned towards the usual view. It rocks and bobs gently in the breeze. Two draw calls. */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
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
  const edgeGeo = mergeGeometries(layers);
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

/**
 * The "Hall of Fame" sign at the plaza's garden edge, in the wordmark's style: chunky rounded
 * lettering (Gluten), "Hall of" in cream and "Fame" in striped ginger, a thick plum outline and a
 * pink paw, drawn on a canvas and cut out as a board on two posts, facing the cottage.
 * @param {THREE.Scene} scene
 * @param {{ x: number, z: number, w: number, yaw: number }} at   layout.js HALL_OF_FAME.sign
 * @param {number} y0  the ground's height there
 */
export async function buildHallSign(scene, at, y0 = 0) {
  const W = 1024, H = 600;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  try { await document.fonts.load('900 200px "Gluten"'); } catch { /* the fallback face still reads */ }
  const font = (px) => `900 ${px}px "Gluten", "Figtree", system-ui, sans-serif`;
  const word = (text, px, cx, cy, fill) => {
    g.font = font(px); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = px * 0.36; g.strokeStyle = "#3d1030"; g.strokeText(text, cx, cy + px * 0.06);
    g.lineWidth = px * 0.26; g.strokeStyle = "#5a2346"; g.strokeText(text, cx, cy);
    g.fillStyle = fill; g.fillText(text, cx, cy);
  };
  word("Hall of", 175, W / 2 - 30, 165, "#fbeccb");
  // "Fame": ginger with darker tabby stripes, clipped to the letters.
  const grad = g.createLinearGradient(0, 330, 0, 540);
  grad.addColorStop(0, "#ffb640"); grad.addColorStop(1, "#f28a1c");
  word("Fame", 250, W / 2, 425, grad);
  g.save();
  g.globalCompositeOperation = "source-atop";
  g.strokeStyle = "rgba(214, 104, 20, .55)"; g.lineWidth = 16; g.lineCap = "round";
  for (let x = 150; x < 900; x += 58) { g.beginPath(); g.moveTo(x, 330); g.quadraticCurveTo(x + 30, 420, x - 8, 520); g.stroke(); }
  g.restore();
  // Re-draw the plum outline over the stripes' edges, then a pink paw at the top right.
  g.font = font(250); g.lineWidth = 10; g.strokeStyle = "#5a2346"; g.strokeText("Fame", W / 2, 425);
  const paw = (cx, cy, s) => {
    g.fillStyle = "#5a2346"; g.beginPath(); g.arc(cx, cy, s * 1.9, 0, 7); g.fill();
    g.fillStyle = "#f59bb3";
    g.beginPath(); g.ellipse(cx, cy + s * 0.35, s * 0.8, s * 0.65, 0, 0, 7); g.fill();
    for (const [dx, dy] of [[-0.95, -0.55], [-0.35, -1.05], [0.35, -1.05], [0.95, -0.55]]) { g.beginPath(); g.arc(cx + dx * s, cy + dy * s, s * 0.3, 0, 7); g.fill(); }
  };
  paw(950, 105, 30);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const w = at.w, h = (w * H) / W;
  const pivot = new THREE.Group();
  pivot.name = "hall of fame sign";
  pivot.position.set(at.x, y0, at.z);
  pivot.rotation.y = at.yaw;
  scene.add(pivot);
  const lift = 1.0;
  const plane = new THREE.PlaneGeometry(w, h).translate(0, h / 2 + lift, 0);
  const front = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, toneMapped: false }));
  front.position.z = 0.02;
  const layers = [];
  for (let k = 1; k <= 6; k++) layers.push(plane.clone().scale(1 + k * 0.003, 1 + k * 0.003, 1).translate(0, -k * 0.01, -k * 0.022));
  const edge = new THREE.Mesh(mergeGeometries(layers), new THREE.MeshLambertMaterial({ map: tex, color: 0x5a2346, emissive: 0x2a0a20, alphaTest: 0.5, side: THREE.DoubleSide }));
  edge.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  edge.castShadow = true;
  pivot.add(edge, front);
  const post = new THREE.MeshLambertMaterial({ color: 0x8d5d3a });
  for (const x of [-w * 0.3, w * 0.3]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, lift + 0.5, 0.16), post);
    m.position.set(x, (lift + 0.5) / 2, -0.1);
    m.castShadow = true;
    pivot.add(m);
  }
  return { group: pivot };
}
