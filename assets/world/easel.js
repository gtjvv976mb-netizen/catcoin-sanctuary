/* "Who's that cat?" easel by the porch: the next cat's black silhouette on a sunburst board
   (data/next-cat.json, assets/ui/teaser.js). Two draw calls: the wooden frame, the board. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const W = 384, H = 480;

export function buildEasel(scene, { x, z, yaw, y = 0 }) {
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  let pic = null;
  const text = (s, px, cy) => {
    g.font = `900 ${px}px "Gluten", "Figtree", sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineJoin = "round"; g.lineWidth = px * 0.3; g.strokeStyle = "#3d1834"; g.strokeText(s, W / 2, cy);
    g.fillStyle = "#fff3dc"; g.fillText(s, W / 2, cy);
  };
  function draw() {
    const cx = W / 2, cy = H * 0.55, R = H;
    const cols = ["#ffc93c", "#ff9f43", "#ff6fa8"];
    for (let i = 0; i < 24; i++) {
      g.fillStyle = cols[i % 3]; g.beginPath(); g.moveTo(cx, cy);
      g.arc(cx, cy, R, (i / 24) * 2 * Math.PI, ((i + 1) / 24) * 2 * Math.PI); g.fill();
    }
    const glow = g.createRadialGradient(cx, cy, 10, cx, cy, W * 0.55);
    glow.addColorStop(0, "#fff7b0"); glow.addColorStop(1, "rgba(255,247,176,0)");
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    if (pic) g.drawImage(pic, cx - 170, cy - 170, 340, 340);
    else text("?", 220, cy);
    text("WHO'S THAT", 46, 44);
    text("CAT?", 54, 96);
    tex.needsUpdate = true;
  }
  document.fonts?.load('900 40px "Gluten"').then(draw, draw);
  draw();

  const wood = new THREE.MeshLambertMaterial({ color: 0x8d5d3a });
  const leg = (dx, dz, rx, rz) => new THREE.BoxGeometry(0.09, 2.3, 0.09).rotateX(rx).rotateZ(rz).translate(dx, 1.1, dz);
  const frame = new THREE.Mesh(mergeGeometries([
    leg(-0.5, 0, -0.08, -0.13), leg(0.5, 0, -0.08, 0.13), leg(0, -0.45, 0.3, 0),
    new THREE.BoxGeometry(1.36, 1.66, 0.05).translate(0, 1.33, 0.07), new THREE.BoxGeometry(1.4, 0.08, 0.22).translate(0, 0.46, 0.12),
  ]), wood);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5).translate(0, 1.33, 0.1), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const group = new THREE.Group();
  group.name = "next cat easel";
  group.position.set(x, y, z);
  group.rotation.y = yaw;
  frame.castShadow = true;
  group.add(frame, board);
  scene.add(group);
  const box = new THREE.Box3();

  return {
    group,
    hit(ray) { box.setFromObject(group); return !!ray.ray.intersectBox(box, new THREE.Vector3()); },
    set(src, done) {
      if (!src) { pic = null; draw(); return done?.(); }
      const img = new Image();
      img.onload = () => { pic = img; draw(); done?.(); };
      img.src = src;
    },
  };
}
