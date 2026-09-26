/* Research HQ: the cottage is where the Research Team works. A "Research HQ" plaque by the door,
   a little dish antenna on the roof that slowly scans, and two cats at work by the porch (one in
   glasses at a tiny desk with a glowing laptop, one at a map board with pins). A speech bubble
   says what the team is up to, from data/research/log.json (written by /scout on the owner's
   laptop): a scan in the last ~6 hours means lights on and the antenna turning; otherwise the team
   is resting. A click on the house opens a small panel about the research. Cheap geometry: a
   handful of boxes, cylinders and spheres, and three canvas textures. */

import * as THREE from "three";
import { AMBIENT } from "./ambient.js";
import { researchStatus, candidatesOf } from "./research-status.js";

/** Where the pieces stand (the cottage faces +z; see layout.js). Kept clear of the paths. */
export const RESEARCH = {
  desk: { x: -3.35, z: 3.55, yaw: 0.35 },
  board: { x: -4.35, z: 2.55, yaw: 0.75 },
  plaque: { x: -1.2, y: 2.15, z: 2.02 },
  antenna: { x: 1.45, y: 3.6, z: 1.1 }, // y is found on the roof by a ray, when the cottage is given
  bubble: { x: -2.4, y: 4.0, z: 3.4 },
};

const lambert = (color, extra) => new THREE.MeshLambertMaterial({ color, ...extra });
const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function canvasTex(w, h, draw) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** A small low-poly cat, sitting: body, head, ears, tail. `glasses` adds round specs. */
function littleCat({ coat, belly, glasses = false }) {
  const g = new THREE.Group();
  const fur = lambert(coat), pale = lambert(belly);
  const body = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), fur));
  body.scale.set(1, 1.15, 0.9); body.position.y = 0.28;
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), pale);
  chest.position.set(0, 0.3, 0.14);
  const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), fur));
  head.position.set(0, 0.66, 0.05);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), pale);
  muzzle.position.set(0, 0.61, 0.2); muzzle.scale.set(1.2, 0.8, 0.8);
  g.add(body, chest, head, muzzle);
  for (const s of [-1, 1]) {
    const ear = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.15, 4), fur));
    ear.position.set(s * 0.1, 0.84, 0.03); ear.rotation.z = -s * 0.25;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), lambert(0x2a1a22));
    eye.position.set(s * 0.07, 0.69, 0.21);
    g.add(ear, eye);
  }
  const tail = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 6), fur));
  tail.position.set(0.22, 0.12, -0.12); tail.rotation.set(1.3, 0, 0.9);
  g.add(tail);
  if (glasses) {
    const rim = lambert(0x3d1834);
    for (const s of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 5, 12), rim);
      lens.position.set(s * 0.07, 0.69, 0.225);
      g.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.012), rim);
    bridge.position.set(0, 0.69, 0.23);
    g.add(bridge);
  }
  return { group: g, head, tail };
}

/**
 * @param {THREE.Scene} scene
 * @param {object} o
 * @param {THREE.Object3D} [o.house]  the cottage (its glow goes up when the team is at work)
 * @param {() => void} [o.requestRender]
 * @param {string} [o.base]  where data/ lives ("" for the site root)
 */
export function buildResearch(scene, { house = null, requestRender: rr = () => {}, base = "" } = {}) {
  const requestRender = () => { try { rr(); } catch { /* the render loop is not up yet */ } };
  const root = new THREE.Group();
  root.name = "research hq";
  scene.add(root);
  const wood = lambert(0x8d5d3a), darkWood = lambert(0x6b4128), cream = lambert(0xfbeccb);

  /* ── The plaque by the door ── */
  const plaqueTex = canvasTex(512, 160, (g, w, h) => {
    roundRect(g, 6, 6, w - 12, h - 12, 26); g.fillStyle = "#5a2346"; g.fill();
    roundRect(g, 18, 18, w - 36, h - 36, 18); g.fillStyle = "#fbeccb"; g.fill();
    g.font = '900 64px "Gluten", "Figtree", system-ui, sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#5a2346"; g.fillText("Research HQ", w / 2, h / 2 + 4);
  });
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.39, 0.05), [darkWood, darkWood, darkWood, darkWood, new THREE.MeshLambertMaterial({ map: plaqueTex }), darkWood]);
  plaque.position.set(RESEARCH.plaque.x, RESEARCH.plaque.y, RESEARCH.plaque.z);
  plaque.castShadow = true;
  root.add(plaque);

  /* ── The rooftop dish antenna: a mast, a dish that turns and nods ── */
  const ant = new THREE.Group();
  ant.position.set(RESEARCH.antenna.x, RESEARCH.antenna.y, RESEARCH.antenna.z);
  if (house) {
    house.updateMatrixWorld(true);
    const down = new THREE.Raycaster(new THREE.Vector3(RESEARCH.antenna.x, 20, RESEARCH.antenna.z), new THREE.Vector3(0, -1, 0));
    const h = down.intersectObject(house, true)[0];
    if (h) ant.position.y = h.point.y - 0.05;
  }
  const mast = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.0, 6), lambert(0x9aa3ad)));
  mast.position.y = 0.5;
  const turn = new THREE.Group(); turn.position.y = 1.0;
  const tilt = new THREE.Group(); turn.add(tilt);
  const dish = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, 0.9), new THREE.MeshLambertMaterial({ color: 0xf3efe6, side: THREE.DoubleSide })));
  dish.rotation.x = -Math.PI / 2 - 0.1; dish.position.z = 0.28;
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 4), lambert(0x6e4f63));
  feed.rotation.x = Math.PI / 2; feed.position.z = 0.22;
  const tipMat = new THREE.MeshBasicMaterial({ color: 0xff6b6b, toneMapped: false });
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), tipMat);
  tip.position.z = 0.46;
  tilt.add(dish, feed, tip);
  ant.add(mast, turn);
  root.add(ant);

  /* ── The desk, the laptop and the cat in glasses ── */
  const desk = new THREE.Group();
  desk.position.set(RESEARCH.desk.x, 0, RESEARCH.desk.z); desk.rotation.y = RESEARCH.desk.yaw;
  const top = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.55), wood));
  top.position.y = 0.55;
  desk.add(top);
  for (const [x, z] of [[-0.42, -0.22], [0.42, -0.22], [-0.42, 0.22], [0.42, 0.22]]) {
    const leg = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.06), darkWood));
    leg.position.set(x, 0.275, z); desk.add(leg);
  }
  const lapBase = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.28), lambert(0xc9ccd3)));
  lapBase.position.set(0, 0.595, 0.02);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, toneMapped: false });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.02), [lambert(0xc9ccd3), lambert(0xc9ccd3), lambert(0xc9ccd3), lambert(0xc9ccd3), lambert(0xc9ccd3), screenMat]);
  // The cat sits on the -z side facing the viewer; the lid stands at the +z edge, its screen (-z face) towards the cat.
  lid.position.set(0, 0.74, 0.14); lid.rotation.x = 0.2; // leans back, away from the cat
  const mug = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 8), lambert(0xf59bb3)));
  mug.position.set(0.34, 0.63, -0.1);
  const papers = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.26), cream);
  papers.position.set(-0.34, 0.59, 0); papers.rotation.y = 0.3;
  desk.add(lapBase, lid, mug, papers);
  const stool = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.34, 8), darkWood));
  stool.position.set(0, 0.17, -0.52);
  desk.add(stool);
  const scholar = littleCat({ coat: 0x9a8f86, belly: 0xf2ece4, glasses: true });
  scholar.group.position.set(0, 0.34, -0.55); // faces the laptop (+z) and the usual view
  desk.add(scholar.group);
  const screenGlow = new THREE.PointLight(0x9fe8ff, 0, 2.2, 2);
  screenGlow.position.set(0, 0.8, -0.3);
  desk.add(screenGlow);
  root.add(desk);

  /* ── The map board with pins, and a ginger cat studying it ── */
  const mapTex = canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = "#cfe6f2"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#b9d98f";
    for (const [x, y, rx, ry] of [[60, 60, 46, 30], [70, 130, 26, 40], [150, 55, 50, 28], [165, 120, 30, 30], [220, 145, 22, 16]]) { g.beginPath(); g.ellipse(x, y, rx, ry, 0.3, 0, 7); g.fill(); }
    g.strokeStyle = "rgba(90,35,70,.55)"; g.lineWidth = 2; g.setLineDash([5, 5]);
    g.beginPath(); g.moveTo(52, 58); g.lineTo(150, 50); g.lineTo(168, 118); g.lineTo(70, 128); g.stroke();
  });
  const board = new THREE.Group();
  board.position.set(RESEARCH.board.x, 0, RESEARCH.board.z); board.rotation.y = RESEARCH.board.yaw;
  const face = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.75, 0.04), [darkWood, darkWood, darkWood, darkWood, new THREE.MeshLambertMaterial({ map: mapTex }), darkWood]);
  face.position.y = 1.05; face.rotation.x = -0.12; face.castShadow = true;
  board.add(face);
  for (const s of [-1, 1]) {
    const leg = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.45, 0.05), wood));
    leg.position.set(s * 0.42, 0.72, -0.05); leg.rotation.x = -0.12; board.add(leg);
  }
  const pinColors = [0xff5d6c, 0xf5c542, 0x4aa3df, 0xff5d6c, 0x5cbf6a];
  [[-0.3, 0.18], [0.09, 0.2], [0.17, -0.07], [-0.24, -0.1], [0.36, -0.18]].forEach(([x, y], i) => {
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: pinColors[i] }));
    pin.position.set(x, 1.05 + y, 0.04 + y * 0.12); board.add(pin);
  });
  const studier = littleCat({ coat: 0xf0a14a, belly: 0xfbeccb });
  studier.group.position.set(0.05, 0, 0.75); studier.group.rotation.y = Math.PI; // faces the board
  board.add(studier.group);
  root.add(board);

  /* ── A warm porch light, on while the team works ── */
  const porchLight = new THREE.PointLight(0xffc27a, 0, 7, 1.6);
  porchLight.position.set(-1.8, 2.4, 3.2);
  root.add(porchLight);

  /* ── The speech bubble: a sprite with canvas text ── */
  const bubbleCv = document.createElement("canvas");
  bubbleCv.width = 1024; bubbleCv.height = 160;
  const bubbleTex = new THREE.CanvasTexture(bubbleCv);
  bubbleTex.colorSpace = THREE.SRGBColorSpace;
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
  bubble.position.set(RESEARCH.bubble.x, RESEARCH.bubble.y, RESEARCH.bubble.z);
  bubble.renderOrder = 5;
  root.add(bubble);
  function drawBubble(text, active) {
    const g = bubbleCv.getContext("2d"), W = bubbleCv.width, H = bubbleCv.height;
    g.clearRect(0, 0, W, H);
    g.font = '700 38px "Figtree", system-ui, sans-serif';
    const tw = Math.min(W - 60, g.measureText(text).width + 64);
    const x = (W - tw) / 2;
    roundRect(g, x, 12, tw, 96, 40); g.fillStyle = active ? "#fff9ee" : "rgba(255,249,238,.9)"; g.fill();
    g.lineWidth = 6; g.strokeStyle = "#5a2346"; g.stroke();
    g.beginPath(); g.moveTo(W / 2 - 18, 105); g.lineTo(W / 2, 145); g.lineTo(W / 2 + 18, 105); g.closePath(); g.fillStyle = active ? "#fff9ee" : "rgba(255,249,238,.9)"; g.fill();
    g.beginPath(); g.moveTo(W / 2 - 18, 108); g.lineTo(W / 2, 145); g.lineTo(W / 2 + 18, 108); g.stroke();
    g.fillStyle = "#3d1834"; g.textAlign = "center"; g.textBaseline = "middle";
    let t = text;
    while (g.measureText(t).width > tw - 50 && t.length > 4) t = `${t.slice(0, -2)}…`;
    g.fillText(t, W / 2, 61);
    bubbleTex.needsUpdate = true;
    const w = 5.4; bubble.scale.set(w, (w * H) / W, 1);
  }

  /* ── Status ── */
  let status = researchStatus(null, null);
  let log = null, inbox = null, pinned = false;
  const houseMats = [];
  house?.traverse((o) => { if (o.isMesh && o.material?.emissive) houseMats.push(o.material); });
  function apply() {
    const on = status.active;
    porchLight.intensity = on ? 6 : 0;
    screenGlow.intensity = on ? 1.4 : 0;
    screenMat.color.set(on ? 0x9fe8ff : 0x2b3440);
    tipMat.color.set(on ? 0xff6b6b : 0x7a4a4a);
    for (const m of houseMats) m.emissiveIntensity = on ? 0.2 : 0.1;
    drawBubble(status.line, on);
    requestRender();
  }
  async function refresh(now = Date.now()) {
    const get = async (p) => { try { const r = await fetch(`${base}${p}`, { cache: "no-store" }); return r.ok ? await r.json() : null; } catch { return null; } };
    const [l, i] = await Promise.all([get("data/research/log.json"), get("data/research/inbox.json")]);
    if (pinned) return status;
    log = l; inbox = i;
    status = researchStatus(log, inbox, now);
    apply();
    return status;
  }
  apply();
  refresh();
  const timer = setInterval(() => refresh(), 5 * 60 * 1000);

  /* ── The panel ── */
  let dialog = null;
  function open() {
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "finder panel research-panel";
      dialog.id = "research";
      dialog.setAttribute("aria-labelledby", "research-title");
      document.body.append(dialog);
      injectStyle();
      dialog.addEventListener("click", (e) => {
        if (e.target !== dialog) return;
        const r = dialog.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
      });
    }
    const s = researchStatus(log, inbox);
    const last = s.lastAt === null ? "No scan yet" : `${new Date(s.lastAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} (${s.ago})`;
    const latest = candidatesOf(inbox).slice(0, 5);
    const head = el("div", "panel-head");
    const title = el("h2", "panel-title", "Research HQ"); title.id = "research-title";
    const close = el("button", "finder-close"); close.type = "button"; close.setAttribute("aria-label", "Close Research HQ");
    close.append(closeIcon());
    close.addEventListener("click", () => dialog.close());
    head.append(title, close);
    const body = el("div", "panel-body");
    const state = el("p", `rq-state${s.active ? " on" : ""}`);
    state.append(el("span", "rq-dot"), document.createTextNode(s.active ? `At work: ${s.line}` : s.line));
    const stats = el("dl", "rq-stats");
    for (const [k, v] of [["Last scan", last], ["Cats found this week", String(s.weekFound)]]) { const d = el("div"); d.append(el("dt", "", k), el("dd", "", v)); stats.append(d); }
    body.append(state, stats, el("h3", "", "Latest leads"));
    if (latest.length) {
      const ul = el("ul", "rq-list");
      for (const c of latest) {
        const li = el("li");
        li.append(el("b", "", String(c.catName)));
        if (c.owner) li.append(document.createTextNode(" "), el("span", "", `· ${c.owner}`));
        li.append(document.createTextNode(" "), el("em", "", c.status === "approved" ? "added" : "waiting for review"));
        ul.append(li);
      }
      body.append(ul);
    } else body.append(el("p", "rq-muted", "No leads yet."));
    body.append(el("h3", "", "How we research"), el("p", "", "The team looks for cats with real, documented lore: company and celebrity cats, cats from TV and film, crypto projects' cats and viral internet cats."));
    const how = el("ul", "rq-how");
    for (const t of [
      "Every cat needs at least one real X post (author, date and text checked) and one reliable web source.",
      "Nothing is made up: if it can't be verified, it doesn't go in.",
      "Existing coins are checked first; a cat whose coin is already big is left alone.",
      "Leads go to an inbox. A person reviews each one before it appears in the sanctuary.",
      "The team runs on the owner's laptop when it's on, not around the clock.",
    ]) how.append(el("li", "", t));
    body.append(how);
    dialog.replaceChildren(head, body);
    if (!dialog.open) dialog.showModal?.();
  }

  /* ── Hit test: the cottage (a box) or any of the research pieces ── */
  const hitBox = new THREE.Box3(new THREE.Vector3(-2.8, 0, -2.6), new THREE.Vector3(2.8, 4.6, 2.6));
  const _p = new THREE.Vector3();
  function hit(ray) {
    const hb = ray.ray.intersectBox(hitBox, _p);
    const parts = ray.intersectObjects([desk, board, ant, plaque], true);
    const d1 = hb ? hb.distanceTo(ray.ray.origin) : Infinity;
    const d2 = parts.length ? parts[0].distance : Infinity;
    return Math.min(d1, d2);
  }

  return {
    group: root,
    get status() { return status; },
    refresh,
    /** For checks and screenshots: set the status from given log and inbox objects. */
    setData(l, i, now = Date.now()) { pinned = true; log = l; inbox = i; status = researchStatus(l, i, now); apply(); return status; },
    open,
    hit,
    update(still) {
      const t = AMBIENT.uTime.value;
      if (status.active && !still) {
        turn.rotation.y = t * 0.35;
        tilt.rotation.x = -0.35 + Math.sin(t * 0.6) * 0.12;
        tip.scale.setScalar(1 + (Math.sin(t * 5) > 0.6 ? 0.6 : 0));
        scholar.head.rotation.x = Math.sin(t * 2.2) * 0.05;
        studier.tail.rotation.z = 0.9 + Math.sin(t * 1.5) * 0.25;
        bubble.position.y = RESEARCH.bubble.y + Math.sin(t * 1.3) * 0.05;
      } else {
        tilt.rotation.x = 0.25; // the dish rests, looking down
        tip.scale.setScalar(1);
      }
    },
    dispose() { clearInterval(timer); },
    /** Whether something is animating (the antenna turns only while the team works). */
    get animating() { return status.active; },
  };
}

function closeIcon() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of [["viewBox", "0 0 24 24"], ["width", "20"], ["height", "20"], ["aria-hidden", "true"]]) svg.setAttribute(k, v);
  const path = document.createElementNS(NS, "path");
  for (const [k, v] of [["d", "M6 6l12 12M18 6L6 18"], ["stroke", "currentColor"], ["stroke-width", "2.4"], ["stroke-linecap", "round"]]) path.setAttribute(k, v);
  svg.append(path);
  return svg;
}

let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./research.css", import.meta.url).href;
  document.head.append(link);
}
