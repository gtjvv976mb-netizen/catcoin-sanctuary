/* The animation controller for cats with their own model (assets/world/catviews.js animateOwn), on
   the box cat of catrig.test.mjs with its real clips: clip weights always add up to one and move
   smoothly whatever the sim does (no pops, even when an action flickers); the gaits share one phase
   stepped by the distance walked, so a planted paw stays put through a change of gait; posture
   changes play at the sim's progress; the head turns to what the cat looks at, within the neck's
   reach, and holds its gaze while the body turns; the procedural layers never build up on the bones;
   a cat back in view is already doing what it does; far cats are posed less often; the full model
   and the own model come and go with some slack at their edges (no swapping back and forth). */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { ROOT } from "./helpers.mjs";

// catviews.js imports "three" and "three/addons/..." as the page's import map names them.
const THREE_URL = pathToFileURL(path.join(ROOT, "assets/vendor/three/three.module.min.js")).href;
const ADDONS = pathToFileURL(path.join(ROOT, "assets/vendor/three/addons/")).href;
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, next) {
  if (s === "three") return { url: ${JSON.stringify(THREE_URL)}, shortCircuit: true };
  if (s.startsWith("three/addons/")) return { url: ${JSON.stringify(ADDONS)} + s.slice(13), shortCircuit: true };
  return next(s, c);
}`));
const THREE = await import(THREE_URL);
const V = await import(pathToFileURL(path.join(ROOT, "assets/world/catviews.js")).href);
const R = await import(pathToFileURL(path.join(ROOT, "assets/world/catrig.js")).href);
const M = await import(pathToFileURL(path.join(ROOT, "assets/world/catmotion.js")).href);

/** The box cat of catrig.test.mjs: body, head, four legs and a tail, 1 unit tall, facing +x. */
function boxCat() {
  const pos = [];
  const box = (x0, x1, y0, y1, z0, z1, n = 8) => {
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) for (let k = 0; k <= n; k++) {
      if (i && j && k && i < n && j < n && k < n) continue;
      pos.push(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * j / n, z0 + (z1 - z0) * k / n);
    }
  };
  box(-0.4, 0.3, 0.35, 0.7, -0.15, 0.15);
  box(0.25, 0.5, 0.62, 1.0, -0.12, 0.12);
  for (const x of [-0.3, 0.2]) for (const z of [-0.1, 0.1]) box(x - 0.045, x + 0.045, 0, 0.42, z - 0.045, z + 0.045);
  box(-0.85, -0.38, 0.56, 0.63, -0.03, 0.03);
  return new Float32Array(pos);
}
const rig = R.findRig(boxCat());

/** A cat with its own model, as CatHerd.attachOwn makes it (without the meshes), and a sim cat. */
function ownCat(traits = {}, s = 0.6) {
  const sk = R.buildSkeleton(rig);
  const o = { rig, sk, s, mixer: new THREE.AnimationMixer(sk.root), clips: R.makeClips(rig), actions: {} };
  o.perUnit = R.cyclesPerUnit(rig, s);
  const cat = { id: "BOXCAT", x: 0, y: 0, z: 0, yaw: 0, traits: { ...M.NEUTRAL_TRAITS, ...traits }, motion: { action: "stand", posture: "stand", gait: null, u: null, odometer: 0, yawRate: 0, look: null, since: 0 } };
  o.anim = V.animState(o, cat);
  return { o, cat, sk };
}
const set = (cat, action, extra = {}) => Object.assign(cat.motion, { action, posture: M.ACTIONS[action].posture, gait: M.ACTIONS[action].kind === "gait" ? action : null, u: null, look: null }, extra);
/** Every scheduled action's weight, by clip name. */
const weights = (o) => Object.fromEntries(Object.entries(o.actions).filter(([, a]) => a.isScheduled()).map(([n, a]) => [n, a.weight]));
const toeAt = (sk, k) => {
  sk.root.updateMatrixWorld(true);
  const end = sk.bones[{ hL: "foot.L", hR: "foot.R", fL: "paw.L", fR: "paw.R" }[k]];
  return rig.legs[k].toe.clone().sub(end.userData.at).applyMatrix4(end.matrixWorld);
};

test("clip weights always add up to one and change smoothly, whatever the sim shows", () => {
  const { o, cat } = ownCat();
  const dt = 1 / 60, minFade = Math.min(...Object.values(o.clips).map((c) => c.userData.fade));
  let now = 0, prev = {};
  // [action, seconds, speed (units/s)]; the flicker (an action for one frame at a time) is a sim at its worst.
  const plan = [["stand", 0.6, 0], ["walk", 1.5, 0.7], ["trot", 1.2, 1.8], ["run", 0.8, 2.8], ["walk", 1, 0.7], ["stand", 0.6, 0], ["sitDown", 0.75, 0], ["sit", 1.3, 0],
    ["groom", 1.5, 0], ["sit", 1.3, 0], ["sitToLie", 0.75, 0], ["loaf", 1.6, 0], ["curlUp", 1.4, 0], ["sleep", 3, 0], ["wake", 1.2, 0], ["getUp", 0.75, 0], ["flicker", 0.5, 0.4], ["hop", 0.5, 1], ["stand", 0.5, 0]];
  let frames = 0;
  for (const [name, secs, speed] of plan) {
    const n = Math.round(secs / dt);
    for (let f = 0; f < n; f++) {
      const action = name === "flicker" ? (f % 2 ? "walk" : "stand") : name;
      const kind = M.ACTIONS[action].kind;
      set(cat, action, { u: kind === "trans" || kind === "once" ? (f + 1) / n : null });
      cat.x += speed * dt; cat.motion.odometer += speed * dt;
      now += dt;
      V.animateOwn(o, cat, now, 5);
      const w = weights(o), sum = Object.values(w).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-6, `${action} at frame ${f}: weights add up to ${sum}`);
      // (A blend eases in and out, so a weight moves at most 1.5 × dt / its blend time in a frame,
      // even while several blends overlap; a pop, a restart at full weight, is far more.)
      if (frames) for (const k of new Set([...Object.keys(w), ...Object.keys(prev)])) {
        const d = Math.abs((w[k] || 0) - (prev[k] || 0));
        assert.ok(d < (1.55 * dt) / minFade, `${action} at frame ${f}: ${k} jumps by ${d.toFixed(3)} in one frame`);
      }
      prev = w;
      for (const b of o.sk.skeleton.bones) assert.ok([b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w].every(Number.isFinite), `${b.name} finite`);
      frames++;
    }
  }
  assert.ok(frames > 1000);
});

test("a mannerism far from its posture's pose goes back to it its own way: off its side in 0.8 s, not in a blink", () => {
  // Flop (on its side) back to a loaf, and a paw wash into getting up (an older sim that does not
  // settle first): the mannerism hands over to its way out (catrig's exitFor, made for the moment it
  // is at, which starts on its pose and moves back to the plain pose over its own length); the two
  // together hold over half the weight for a good part of that, and the paw wash comes down before
  // the cat gets up.
  for (const [from, to, fromPost] of [["flop", "loaf", "lie"], ["groom", "standUp", "sit"]]) {
    const { o, cat } = ownCat();
    const dt = 1 / 60;
    let now = 0;
    set(cat, from); cat.motion.posture = fromPost;
    for (let f = 0; f < 150; f++) { now += dt; V.animateOwn(o, cat, now, 5); }
    const n = Math.round(M.ACTIONS[to].kind === "trans" ? M.transDur(to) / dt : 90);
    let half = null, out = 0, upAt = null;
    for (let f = 0; f < n + 60; f++) {
      set(cat, f < n ? to : M.ACTIONS[to].kind === "trans" ? { standUp: "stand" }[to] : to, { u: f < n && M.ACTIONS[to].kind === "trans" ? (f + 1) / n : null });
      now += dt; V.animateOwn(o, cat, now, 5);
      let w = o.actions[from]?.weight || 0;
      for (const a of Object.values(o.actions)) if (a.getClip().userData.exitOf === from) { w += a.weight; out = Math.max(out, a.getClip().userData.dur); }
      if (half === null && w < 0.5) half = (f + 1) * dt;
      if (upAt === null && to === "standUp" && o.actions.standUp?.weight > 0.5) upAt = (f + 1) * dt;
    }
    assert.ok(out > 0.3, `${from} > ${to}: a way out of ${from} (${out} s)`);
    assert.ok(half !== null && half > out * 0.6, `${from} > ${to}: ${from} and its way out are under half weight after ${half?.toFixed(2)} s (the way out takes ${out} s)`);
    if (to === "standUp") assert.ok(upAt !== null && upAt >= half, `groom > standUp: gets up (${upAt}) once the paw is down (${half})`);
  }
});

test("the gaits share one phase: a paw planted as the cat goes from a walk to a trot stays put", () => {
  const { o, cat, sk } = ownCat();
  const dt = 1 / 120;
  let now = 0;
  // Speed up from a walk into a trot and back, the sim switching the gait (the view blends it).
  const plan = [["walk", 1.2, 0.9], ["trot", 1.5, 1.6], ["walk", 1.2, 0.9]];
  let worst = 0, planted = 0;
  const hold = {};
  for (const [gait, secs, speed] of plan) {
    for (let f = 0; f < secs / dt; f++) {
      set(cat, gait);
      cat.x += speed * dt; cat.motion.odometer += speed * dt; now += dt;
      V.animateOwn(o, cat, now, 5);
      for (const k of ["hL", "hR", "fL", "fR"]) {
        const t = toeAt(sk, k), gx = cat.x + t.x * o.s; // where the toe is on the ground (the cat faces +x)
        if (t.y < 0.006) {
          if (hold[k] === undefined) hold[k] = gx;
          worst = Math.max(worst, Math.abs(gx - hold[k])); planted++;
        } else hold[k] = undefined;
      }
    }
  }
  const stride = R.walkStride(rig) * o.s;
  assert.ok(planted > 500, "paws spend most of the time planted");
  assert.ok(worst < stride * 0.12, `a planted paw slides ${worst.toFixed(4)} (stride ${stride.toFixed(3)})`);
});

test("posture changes and once-through moves play at the sim's progress", () => {
  const { o, cat } = ownCat();
  let now = 0;
  set(cat, "stand"); V.animateOwn(o, cat, (now += 1 / 60), 5);
  for (const u of [0.1, 0.4, 0.75, 1]) {
    set(cat, "sitDown", { u }); V.animateOwn(o, cat, (now += 1 / 60), 5);
    const a = o.actions.sitDown;
    assert.ok(Math.abs(a.time - u * a.getClip().duration) < 1e-9, `sitDown at u ${u}: time ${a.time}`);
  }
});

test("the head turns to what the cat looks at, as far as its neck goes, and holds its gaze while the body turns", () => {
  const { o, cat, sk } = ownCat({ curious: 0.2 });
  const dt = 1 / 60;
  let now = 0;
  const headYaw = () => {
    sk.root.updateMatrixWorld(true);
    const f = new THREE.Vector3(1, 0, 0).applyQuaternion(sk.bones.head.getWorldQuaternion(new THREE.Quaternion()));
    return cat.yaw + Math.atan2(-f.z, f.x);
  };
  set(cat, "sit");
  for (let f = 0; f < 60; f++) V.animateOwn(o, cat, (now += dt), 5);
  // A butterfly 35° to the cat's left (+yaw), 3 units off (the sit clip's own glances aside).
  const at = (yaw) => ({ x: Math.cos(yaw) * 3, y: 0.4, z: -Math.sin(yaw) * 3 });
  set(cat, "sit", { look: at(0.6) });
  for (let f = 0; f < 60; f++) V.animateOwn(o, cat, (now += dt), 5);
  assert.ok(Math.abs(headYaw() - 0.6) < 0.1, `looks at it: head at ${headYaw().toFixed(3)} rad, the butterfly at 0.6`);
  // The body turns 0.3 rad towards it over a second; the gaze stays on it.
  let off = 0;
  for (let f = 0; f < 60; f++) { cat.yaw += 0.3 / 60; set(cat, "sit", { look: at(0.6), yawRate: 0.3 }); V.animateOwn(o, cat, (now += dt), 5); off = Math.max(off, Math.abs(headYaw() - 0.6)); }
  assert.ok(off < 0.12, `the gaze drifts ${off.toFixed(3)} rad while the body turns`);
  // Something right behind it: the head goes no further round than the neck allows (the clip's
  // own glance aside comes on top).
  set(cat, "sit", { look: at(cat.yaw + 2.8) });
  for (let f = 0; f < 90; f++) V.animateOwn(o, cat, (now += dt), 5);
  const turned = Math.abs(headYaw() - cat.yaw);
  assert.ok(turned <= V.ANIM.lookYaw + 0.35 && turned > 0.8, `turned ${turned.toFixed(3)} rad, the neck's reach is ${V.ANIM.lookYaw}`);
});

test("the procedural layers never build up: with them off, the bones are the clip's own pose again", () => {
  const { o, cat, sk } = ownCat({ grumpy: 0.95, curious: 0.95, social: 0.95, hunter: 0.9 });
  const dt = 1 / 60;
  let now = 0;
  set(cat, "stand", { look: { x: 1, y: 0.5, z: -2 } });
  for (let f = 0; f < 400; f++) { cat.yaw += 0.004; set(cat, f % 200 < 100 ? "stand" : "stand", { look: { x: 1 + f * 0.01, y: 0.5, z: -2 }, yawRate: 0.24 }); V.animateOwn(o, cat, (now += dt), 5); }
  // Layers off (reduced motion): the stand clip's pose at the same time, exactly.
  V.animateOwn(o, cat, (now += dt), 5, true);
  const a = o.actions.stand, t = a.time;
  const ref = R.buildSkeleton(rig), mx = new THREE.AnimationMixer(ref.root), b = mx.clipAction(o.clips.stand);
  b.play(); b.time = t; mx.update(0);
  for (const bone of sk.skeleton.bones) {
    const q = ref.bones[bone.name].quaternion, p = bone.quaternion, sg = q.dot(p) < 0 ? -1 : 1;
    const d = Math.max(Math.abs(q.x - sg * p.x), Math.abs(q.y - sg * p.y), Math.abs(q.z - sg * p.z), Math.abs(q.w - sg * p.w));
    assert.ok(d < 1e-6, `${bone.name} is the clip's own (off by ${d})`);
    assert.ok(Math.abs(bone.scale.x - 1) + Math.abs(bone.scale.y - 1) + Math.abs(bone.scale.z - 1) < 1e-9, `${bone.name}: no breath left on it`);
  }
});

test("a cat back in view is already doing what it does; far cats are posed 20 times a second", () => {
  const { o, cat } = ownCat();
  let now = 0;
  set(cat, "walk");
  for (let f = 0; f < 30; f++) { cat.motion.odometer += 0.01; V.animateOwn(o, cat, (now += 1 / 60), 5); }
  set(cat, "loaf");
  now += 3; // out of sight meanwhile
  V.animateOwn(o, cat, now, 5);
  assert.deepEqual(weights(o), { loaf: 1 });
  // Far away: not every frame.
  let posed = 0;
  for (let f = 0; f < 60; f++) if (V.animateOwn(o, cat, (now += 1 / 60), 45)) posed++;
  assert.ok(posed >= 18 && posed <= 21, `posed ${posed} times in a second`);
  posed = 0;
  for (let f = 0; f < 60; f++) if (V.animateOwn(o, cat, (now += 1 / 60), 10)) posed++;
  assert.equal(posed, 60);
});

test("without cat.motion (an older sim) the clip still comes from the pose", () => {
  const { o, cat } = ownCat();
  delete cat.motion;
  Object.assign(cat, { pose: "loaf", speed: 0, stride: 0 });
  V.animateOwn(o, cat, 1, 5);
  assert.deepEqual(weights(o), { loaf: 1 });
  Object.assign(cat, { pose: "walk", speed: 0.8 });
  for (let f = 0; f < 60; f++) { cat.stride += 0.8 / 60 * 5.2; V.animateOwn(o, cat, 1 + (f + 1) / 60, 5); }
  assert.deepEqual(weights(o), { walk: 1 });
});

test("the full model goes to the nearest cats and stays until they are clearly past the edge; so does the own model", async () => {
  // A herd with no shared cats: every cat has its own (box) model, far copy only.
  const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(boxCat(), 3));
  geo.computeVertexNormals();
  const cats = Array.from({ length: 13 }, (_, i) => ({ id: `C${i}`, index: i, model: "cat", pose: "sit", x: 2 + i, y: 0, z: 0, yaw: 0, anim: {}, traits: { ...M.NEUTRAL_TRAITS },
    motion: { action: "sit", posture: "sit", gait: null, u: null, odometer: 0, yawRate: 0, look: null } }));
  const sim = { cats, byId: (id) => cats.find((c) => c.id === id) || null };
  // The shared models (for a cat drawn without its own): the box in every pose.
  const { POSES } = await import(pathToFileURL(path.join(ROOT, "assets/world/cats.js")).href);
  const md = (pose) => ({ geometry: geo, lite: geo, far: geo, material: new THREE.MeshLambertMaterial(), pose, ref: { lum: 0.6, color: new THREE.Color(1, 1, 1) }, eye: new THREE.Vector3(), head: new THREE.Vector3(0, -9, 0), height: 1, len: 1.2, width: 0.4, tailLen: 0.3, frame: null, ginger: false });
  const models = { cat: Object.fromEntries(POSES.map((p) => [p, md(p)])), ginger: {} };
  const herd = new V.CatHerd(new THREE.Scene(), models, sim, new Map(cats.map((c, i) => [c.id, V.coatFor({ id: c.id }, i)])));
  herd.camera = new THREE.PerspectiveCamera(50, 1.5, 0.1, 500);
  herd.camera.position.set(0, 3, 0); herd.camera.lookAt(10, 0, 0);
  for (const c of cats) {
    const root = new THREE.Group(); root.add(new THREE.Mesh(geo.clone(), new THREE.MeshStandardMaterial()));
    herd.attachOwn(c.id, { lo: root, dims: { len: 1.2, height: 1, width: 0.4 } });
    herd.readyOwn(herd.own.get(c.id));
  }
  const near = () => cats.filter((c) => herd.own.get(c.id).near).map((c) => c.id).join(" ");
  herd.update();
  assert.equal(near(), "C0 C1 C2 C3 C4 C5 C6 C7 C8 C9", "the ten nearest");
  // The 11th steps in front of the 10th: it takes a full model, and the 10th keeps its own.
  cats[10].x = 10.9; herd.update();
  assert.equal(near(), "C0 C1 C2 C3 C4 C5 C6 C7 C8 C9 C10");
  cats[10].x = 12; herd.update();
  assert.equal(near(), "C0 C1 C2 C3 C4 C5 C6 C7 C8 C9 C10", "no swap back at once");
  // The camera backs off: the nearest keeps its full model out to OWN.hiOut, not just OWN.hiDist.
  herd.camera.position.set(2 - 16, 3, 0); herd.update();
  assert.ok(herd.own.get("C0").near, "16 away: kept");
  herd.camera.position.set(2 - 19, 3, 0); herd.update();
  assert.ok(!herd.own.get("C0").near, "19 away: let go");
  // Own model or shared: in at OWN.drawDist, out past OWN.drawOut.
  herd.camera.position.set(2 - 58, 3, 0); herd.camera.lookAt(2, 0, 0); herd.update();
  assert.ok(herd.own.get("C0").drawOwn, "58 away, drawn from its own model since it was near");
  herd.camera.position.set(2 - 63, 3, 0); herd.update();
  assert.ok(!herd.own.get("C0").drawOwn, "63 away: the shared model");
  herd.camera.position.set(2 - 58, 3, 0); herd.update();
  assert.ok(!herd.own.get("C0").drawOwn, "back to 58: still the shared model");
  herd.camera.position.set(2 - 54, 3, 0); herd.update();
  assert.ok(herd.own.get("C0").drawOwn, "54: its own again");
});

test("pulling up out of a walk, the cat takes its last steps to stand square (a stop clip), then stands", () => {
  const { o, cat, sk } = ownCat();
  const dt = 1 / 60;
  let now = 0, sawStop = false;
  set(cat, "walk");
  for (let f = 0; f < 90; f++) { now += dt; cat.x += 0.7 * dt; cat.motion.odometer += 0.7 * dt; V.animateOwn(o, cat, now, 5); }
  set(cat, "stand");
  let prev = null, dragged = 0;
  for (let f = 0; f < 60; f++) {
    now += dt; V.animateOwn(o, cat, now, 5);
    if (Object.entries(weights(o)).some(([n, w]) => n.startsWith("stop:walk:") && w > 0.5)) sawStop = true;
    const toes = ["hL", "hR", "fL", "fR"].map((k) => toeAt(sk, k));
    if (prev && f > 6) toes.forEach((t, i) => { if (t.y < 0.004 && prev[i].y < 0.004) dragged = Math.max(dragged, Math.hypot(t.x - prev[i].x, t.z - prev[i].z)); });
    prev = toes;
  }
  assert.ok(sawStop, "a stop clip played between the walk and the stand");
  assert.ok(dragged < 0.006, `a paw on the ground moved ${dragged.toFixed(4)} in one frame`);
  assert.ok((weights(o).stand || 0) > 0.99, "and then it stands");
});

test("turning on the spot, the walk gives way to the pivot clip, stepped by the angle turned", () => {
  const { o, cat } = ownCat();
  const dt = 1 / 60;
  let now = 0;
  set(cat, "walk", { yawRate: 2.4 });
  cat.speed = 0;
  for (let f = 0; f < 60; f++) { now += dt; cat.yaw += 2.4 * dt; cat.motion.odometer += 2.4 * dt * 0.3; V.animateOwn(o, cat, now, 5); }
  const w = weights(o);
  assert.ok((w.pivot || 0) > 0.9 && (w.walk || 0) < 0.1, `pivot ${w.pivot?.toFixed(2)}, walk ${w.walk?.toFixed(2)}`);
  // Walking along again, the walk takes over.
  set(cat, "walk", { yawRate: 0 }); cat.speed = 0.8;
  for (let f = 0; f < 40; f++) { now += dt; cat.x += 0.8 * dt; cat.motion.odometer += 0.8 * dt; V.animateOwn(o, cat, now, 5); }
  assert.ok(!(weights(o).pivot > 0.01), "no pivot while walking straight");
});
