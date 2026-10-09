/* The quadruped rig (assets/world/catrig.js) on a simple box cat: joints in order, skin weights
   that add up and never cross from one leg to another, and clips that keep paws on the ground:
   planted while walking (no sliding), and on the ground when sitting or lying. Every action in
   catmotion.js has a clip; posture changes start and end on the postures' own poses, with the paws
   that carry the cat planted on the way; a cat's style changes its clips without breaking any of it. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./helpers.mjs";

// catrig.js imports "three" as the page's import map names it; point that at the vendored copy.
const THREE_URL = pathToFileURL(path.join(ROOT, "assets/vendor/three/three.module.min.js")).href;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "catrig-"));
fs.writeFileSync(path.join(tmp, "catrig.mjs"), fs.readFileSync(path.join(ROOT, "assets/world/catrig.js"), "utf8").replace(/from "three"/, `from "${THREE_URL}"`));
// Its sibling module (the shared motion vocabulary), next to it in the temp dir.
fs.copyFileSync(path.join(ROOT, "assets/world/catmotion.js"), path.join(tmp, "catmotion.js"));
const THREE = await import(THREE_URL);
const R = await import(pathToFileURL(path.join(tmp, "catrig.mjs")).href);
const M = await import(pathToFileURL(path.join(tmp, "catmotion.js")).href);
fs.rmSync(tmp, { recursive: true, force: true }); // loaded: the copies are not read again

/** A box cat as a triangle mesh: body, head, four legs and a tail, 1 unit tall, facing +x. */
function boxCat() {
  const pos = [], idx = [];
  const box = (x0, x1, y0, y1, z0, z1, n = 8) => {
    const base = pos.length / 3, g = (i, j, k) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * j / n, z0 + (z1 - z0) * k / n];
    const id = new Map();
    const v = (i, j, k) => { const key = `${i},${j},${k}`; if (!id.has(key)) { id.set(key, pos.length / 3); pos.push(...g(i, j, k)); } return id.get(key); };
    const quad = (a, b, c, d) => idx.push(a, b, c, a, c, d);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      quad(v(a, b, 0), v(a + 1, b, 0), v(a + 1, b + 1, 0), v(a, b + 1, 0)); quad(v(a, b, n), v(a, b + 1, n), v(a + 1, b + 1, n), v(a + 1, b, n));
      quad(v(a, 0, b), v(a, 0, b + 1), v(a + 1, 0, b + 1), v(a + 1, 0, b)); quad(v(a, n, b), v(a + 1, n, b), v(a + 1, n, b + 1), v(a, n, b + 1));
      quad(v(0, a, b), v(0, a + 1, b), v(0, a + 1, b + 1), v(0, a, b + 1)); quad(v(n, a, b), v(n, a, b + 1), v(n, a + 1, b + 1), v(n, a + 1, b));
    }
    return base;
  };
  box(-0.4, 0.3, 0.35, 0.7, -0.15, 0.15);
  box(0.25, 0.5, 0.62, 1.0, -0.12, 0.12);
  for (const x of [-0.3, 0.2]) for (const z of [-0.1, 0.1]) box(x - 0.045, x + 0.045, 0, 0.42, z - 0.045, z + 0.045);
  box(-0.85, -0.38, 0.56, 0.63, -0.03, 0.03);
  return { pos: new Float32Array(pos), index: new Uint32Array(idx) };
}

const cat = boxCat();
const rig = R.findRig(cat.pos);
const sk = R.buildSkeleton(rig);

test("the rig finds four paws and puts each leg's joints in order down the leg", () => {
  for (const k of ["fL", "fR", "hL", "hR"]) {
    const g = rig.legs[k];
    assert.ok(g.top.y > g.knee.y && g.knee.y > g.low.y && g.low.y > 0, `${k}: joints top > knee > low > ground`);
    assert.ok(Math.abs(g.toe.y) < 1e-6, `${k}: toe on the ground`);
    assert.equal(g.toe.z > rig.zc, k[1] === "L", `${k}: on its own side`);
  }
  assert.ok(rig.legs.fL.toe.x > rig.legs.hL.toe.x, "front paws ahead of hind paws");
  assert.ok(rig.yb > 0.25 && rig.yb < 0.45 && rig.yt > 0.6, "belly and back lines");
});

test("skin weights add up to one, and no leg takes points from another leg", () => {
  const w = R.skinWeights(cat.pos, rig, sk, cat.index);
  const names = sk.skeleton.bones.map((b) => b.name);
  const n = cat.pos.length / 3;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      const wt = w.weight.array[i * 4 + k], nm = names[w.index.array[i * 4 + k]];
      sum += wt;
      if (wt > 0.01 && /\.(L|R)$/.test(nm) && cat.pos[i * 3 + 1] < 0.3) {
        const side = cat.pos[i * 3 + 2] > rig.zc ? "L" : "R", hind = cat.pos[i * 3] < 0;
        assert.equal(nm.slice(-1), side, `point ${i} on the ${side} leg weighted to ${nm}`);
        assert.equal(/^(thigh|shin|foot)/.test(nm), hind, `point ${i} weighted to the wrong end's ${nm}`);
      }
    }
    assert.ok(Math.abs(sum - 1) < 1e-4, `point ${i} weights sum to ${sum}`);
  }
});

// Where a leg's toe is in a pose: the end bone's transform applied to the toe's rest offset.
const toeAt = (k) => {
  const end = sk.bones[{ hL: "foot.L", hR: "foot.R", fL: "paw.L", fR: "paw.R" }[k]];
  return rig.legs[k].toe.clone().sub(end.userData.at).applyMatrix4(end.matrixWorld);
};
function pose(clips, name, u) {
  const mixer = new THREE.AnimationMixer(sk.root);
  const a = mixer.clipAction(clips[name]); a.play(); a.time = u * clips[name].duration; mixer.update(0);
  sk.root.updateMatrixWorld(true);
  return mixer;
}

test("walking paws stay planted while they carry weight (no sliding), then lift clear", () => {
  const clips = R.makeClips(rig), stride = R.walkStride(rig);
  for (const k of ["hL", "fR"]) {
    // Ground position of the toe = its place under the body + how far the body has come.
    const ground = [], lifted = [];
    for (let f = 0; f < 40; f++) {
      const u = f / 40;
      pose(clips, "walk", u);
      const t = toeAt(k);
      if (t.y < 0.004) ground.push(t.x + stride * u); else lifted.push(t.y);
    }
    assert.ok(ground.length > 15, `${k}: planted for most of the cycle`);
    // One planted stretch (it may wrap round the cycle's end): it drifts under 2% of a stride (the
    // pelvis sways a little side to side, which the side-view IK leaves out).
    const spread = Math.max(...ground.map((g) => ((g % stride) + stride) % stride)) - Math.min(...ground.map((g) => ((g % stride) + stride) % stride));
    assert.ok(Math.min(spread, stride - spread) < stride * 0.02, `${k}: planted paw slides ${spread.toFixed(4)} of a ${stride.toFixed(3)} stride`);
    assert.ok(Math.max(...lifted) > 0.03, `${k}: the paw lifts as it swings forward`);
  }
});

test("sitting and lying cats keep all four paws on the ground and the body out of it", () => {
  const clips = R.makeClips(rig);
  for (const name of ["stand", "sit", "loaf", "crouch"]) {
    pose(clips, name, 0.3);
    // (a paw folded under a lying or sitting cat rests on its skin: its toe up to a leg's thickness off the ground)
    for (const k of ["hL", "hR", "fL", "fR"]) assert.ok(toeAt(k).y > -0.01 && toeAt(k).y < 0.03 + 1.5 * rig.legs[k].r, `${name}: ${k} toe at ${toeAt(k).y.toFixed(3)}`);
    const pelvis = new THREE.Vector3().setFromMatrixPosition(sk.bones.pelvis.matrixWorld);
    assert.ok(pelvis.y > 0.05, `${name}: pelvis above the ground (${pelvis.y.toFixed(3)})`);
  }
  pose(clips, "loaf", 0.3);
  const lying = new THREE.Vector3().setFromMatrixPosition(sk.bones.spine.matrixWorld).y;
  pose(clips, "stand", 0.3);
  const standing = new THREE.Vector3().setFromMatrixPosition(sk.bones.spine.matrixWorld).y;
  assert.ok(lying < standing - 0.2, "lying lowers the body onto the ground");
});

test("the renderer steps each gait by distance walked", () => {
  for (const g of ["walk", "trot", "run", "stalk"]) assert.ok(R.GAIT_RATE[g] > 0, g);
  assert.ok(Math.abs(R.cyclesPerUnit(rig, 2) * R.walkStride(rig) * 2 - 1) < 1e-9, "one walk cycle per stride");
});

/* ── The whole clip set (catmotion.js ACTIONS) ── */

const clips = R.makeClips(rig);
const BASE = { stand: "stand", sit: "sit", lie: "loaf", sleep: "sleep" };
const PAWS = ["hL", "hR", "fL", "fR"];
// Bone rotations and root offset of a clip at u (0..1 of its length).
function frame(set, name, u) {
  pose(set, name, u);
  return { q: Object.fromEntries(sk.skeleton.bones.map((b) => [b.name, b.quaternion.clone()])), root: sk.bones.root.position.clone() };
}
const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));

test("every action in catmotion.js has a clip of its kind", () => {
  for (const [name, a] of Object.entries(M.ACTIONS)) {
    const c = clips[name];
    assert.ok(c, `a clip for ${name}`);
    assert.equal(c.userData.kind, a.kind, `${name} is a ${a.kind}`);
    assert.ok(c.userData.fade > 0 && c.userData.fade < 1, `${name}: a blend time`);
    if (a.kind === "trans" || a.kind === "once") {
      assert.equal(c.userData.loop, false, `${name} plays once`);
      assert.ok(c.userData.dur > 0, `${name}: its length`);
    } else assert.notEqual(c.userData.loop, false, `${name} loops`);
    if (a.kind === "trans") assert.ok(Math.abs(c.duration - M.transDur(name)) < 1e-9, `${name} lasts transDur`);
  }
});

test("no clip has a NaN anywhere, and loops end where they start (a mannerism's where its cycle starts)", () => {
  for (const [name, c] of Object.entries(clips)) {
    for (const t of c.tracks) {
      assert.ok(t.values.every(Number.isFinite), `${name}: ${t.name} is finite`);
      if (c.userData.loop !== false) {
        const n = t.getValueSize(), v = t.values, last = v.length - n, at = c.userData.enter ? t.createInterpolant().evaluate(c.userData.enter) : v.subarray(0, n);
        for (let i = 0; i < n; i++) assert.ok(Math.abs(at[i] - v[last + i]) < 1e-5, `${name}: ${t.name} loops seamlessly`);
      }
    }
  }
});

test("a mannerism begins on its posture's plain pose, and its ways out end there (or at the next one's cycle)", () => {
  const plain = { sit: "sit", stand: "stand", lie: "loaf" };
  const mann = Object.keys(M.ACTIONS).filter((k) => clips[k].userData.enter);
  for (const k of ["groom", "legLick", "earScratch", "beckon", "knead", "chatter", "dab", "flop", "roll", "hindStand", "scratch", "headBunt"]) assert.ok(mann.includes(k), `${k} has a way in`);
  for (const name of mann) {
    const base = frame(clips, plain[M.ACTIONS[name].posture], 0), c = clips[name];
    const got = frame(clips, name, 0);
    for (const b in got.q) assert.ok(angle(got.q[b], base.q[b]) < 0.02, `${name} starts as ${plain[M.ACTIONS[name].posture]}: ${b}`);
    for (const t of [0.1, c.userData.enter * 0.5, c.userData.enter + 0.3, c.duration * 0.8]) {
      const x = clips.exitFor(name, t);
      assert.ok(x && x.userData.loop === false && x.userData.exitOf === name && x.duration > 0.25, `${name}: a way out at ${t}`);
      const a = frame({ x }, "x", 0), want = frame(clips, name, Math.round(t * 30) / 30 / c.duration), end = frame({ x }, "x", 1);
      for (const b in a.q) {
        assert.ok(angle(a.q[b], want.q[b]) < 0.03, `${name} way out at ${t} starts where it is: ${b}`);
        assert.ok(angle(end.q[b], base.q[b]) < 0.03, `${name} way out at ${t} ends on the plain pose: ${b}`);
      }
    }
  }
  // Straight on from its side onto its back and back: the way ends where the next one's cycle begins.
  for (const [p, q] of [["flop", "roll"], ["roll", "flop"]]) {
    const x = clips.exitFor(p, clips[p].duration * 0.7, q), end = frame({ x }, "x", 1), want = frame(clips, q, x.userData.at / clips[q].duration);
    assert.equal(x.userData.into, q);
    for (const b in end.q) assert.ok(angle(end.q[b], want.q[b]) < 0.03, `${p} > ${q}: ${b}`);
  }
});

test("posture changes begin and end on the postures' own poses", () => {
  for (const [name, a] of Object.entries(M.ACTIONS)) {
    if (a.kind !== "trans") continue;
    for (const [u, posture] of [[0, a.from], [1, a.to]]) {
      const got = frame(clips, name, u), want = frame(clips, BASE[posture], 0);
      for (const b in got.q) assert.ok(angle(got.q[b], want.q[b]) < 0.01, `${name} at ${u}: ${b} off by ${angle(got.q[b], want.q[b]).toFixed(4)} rad from ${BASE[posture]}`);
      assert.ok(got.root.distanceTo(want.root) < 0.01, `${name} at ${u}: root off by ${got.root.distanceTo(want.root).toFixed(4)}`);
    }
  }
});

test("paws that carry the cat stay planted on the ground through sitting down, standing up, lying down and getting up", () => {
  // [clip, paw, from u, to u]: while the paw bears weight (the others step or fold, as the clip says).
  const planted = [["sitDown", "hL", 0, 1], ["sitDown", "hR", 0, 1], ["sitDown", "fL", 0, 0.58], ["sitDown", "fR", 0, 0.7],
    ["standUp", "hL", 0, 1], ["standUp", "hR", 0, 1], ["standUp", "fL", 0, 0.42], ["standUp", "fR", 0, 0.62],
    ["lieDown", "hL", 0, 1], ["lieDown", "hR", 0, 1], ["lieDown", "fL", 0, 0.08], ["lieDown", "fR", 0, 0.16],
    ["getUp", "hL", 0, 1], ["getUp", "hR", 0, 1],
    ["sitToLie", "hL", 0, 1], ["sitToLie", "hR", 0, 1], ["lieToSit", "hL", 0, 1], ["lieToSit", "hR", 0, 1]];
  for (const [name, k, u0, u1] of planted) {
    let first = null;
    for (let f = 0; f <= 30; f++) {
      const u = u0 + (u1 - u0) * f / 30;
      pose(clips, name, u);
      const t = toeAt(k);
      // (a hind paw folding down under a lying cat comes to rest on its skin: its toe up to a leg's thickness off the ground)
      assert.ok(t.y > -0.01 && t.y < 0.03 + 1.5 * rig.legs[k].r, `${name}: ${k} on the ground at ${u.toFixed(2)} (y ${t.y.toFixed(3)})`);
      if (!first) first = t.clone();
      const moved = Math.hypot(t.x - first.x, t.z - first.z);
      assert.ok(moved < 0.004, `${name}: ${k} slides ${moved.toFixed(4)} by ${u.toFixed(2)}`);
    }
  }
});

test("a cat's style changes its clips and keeps walking paws planted", () => {
  const style = { tempo: 1.25, stride: 0.85, lift: 0.75, bob: 1.5, sway: 1, crouch: 0.3, tail: 1, head: -0.3, sitTall: 1, loafTuck: 1 };
  const own = R.makeClips(rig, style), stride = R.walkStride(rig, style);
  assert.ok(Math.abs(stride - 0.85 * R.walkStride(rig)) < 1e-9, "a shorter stride");
  assert.ok(Math.abs(R.cyclesPerUnit(rig, 2, style) * stride * 2 - 1) < 1e-9, "one walk cycle per (styled) stride");
  assert.ok(Math.abs(own.sitDown.duration - M.transDur("sitDown", 1.25)) < 1e-9, "slower posture changes");
  assert.ok(own.sit.duration > clips.sit.duration, "slower idle loops");
  for (const k of ["hL", "fR"]) {
    const ground = [];
    for (let f = 0; f < 40; f++) { pose(own, "walk", f / 40); const t = toeAt(k); if (t.y < 0.004) ground.push(t.x + stride * f / 40); }
    assert.ok(ground.length > 15, `${k}: planted for most of the cycle`);
    const w = ground.map((g) => ((g % stride) + stride) % stride), spread = Math.max(...w) - Math.min(...w);
    assert.ok(Math.min(spread, stride - spread) < stride * 0.02, `${k}: planted paw slides ${spread.toFixed(4)} of a ${stride.toFixed(3)} stride`);
  }
  // Still every base posture on the ground, and still a clean start and end to every posture change.
  for (const name of ["stand", "sit", "loaf"]) { pose(own, name, 0.3); for (const k of PAWS) assert.ok(toeAt(k).y > -0.01 && toeAt(k).y < 0.03 + 1.5 * rig.legs[k].r, `${name}: ${k} on the ground`); }
  for (const [name, a] of Object.entries(M.ACTIONS)) {
    if (a.kind !== "trans") continue;
    const got = frame(own, name, 1), want = frame(own, BASE[a.to], 0);
    for (const b in got.q) assert.ok(angle(got.q[b], want.q[b]) < 0.01, `${name} ends on ${BASE[a.to]} (${b})`);
  }
  // The style shows: the tail is carried higher, the regal cat sits taller.
  pose(clips, "walk", 0); const tail0 = new THREE.Vector3().setFromMatrixPosition(sk.bones.tail4.matrixWorld).y;
  pose(own, "walk", 0); const tail1 = new THREE.Vector3().setFromMatrixPosition(sk.bones.tail4.matrixWorld).y;
  assert.ok(tail1 > tail0 + 0.05, "tail up");
  pose(clips, "sit", 0); const head0 = new THREE.Vector3().setFromMatrixPosition(sk.bones.head.matrixWorld).y;
  pose(R.makeClips(rig, { sitTall: 1 }), "sit", 0); const head1 = new THREE.Vector3().setFromMatrixPosition(sk.bones.head.matrixWorld).y;
  assert.ok(head1 > head0, "a regal cat sits taller");
});

test("once-through moves start and end on their posture's pose; hops and pounces leave the ground", () => {
  for (const [name, start, end] of [["shake", "stand", "stand"], ["stretch", "stand", "stand"], ["yawn", "sit", "sit"], ["hop", "stand", "stand"], ["pounce", "crouch", "stand"]]) {
    for (const [u, base] of [[0, start], [1, end]]) {
      const got = frame(clips, name, u), want = frame(clips, base, 0);
      for (const b in got.q) assert.ok(angle(got.q[b], want.q[b]) < 0.02, `${name} at ${u}: ${b} as in ${base}`);
    }
  }
  for (const name of ["hop", "pounce"]) {
    pose(clips, name, 0.5);
    assert.ok(PAWS.every((k) => toeAt(k).y > 0.02), `${name}: all four paws off the ground in the air`);
  }
});

test("lying on its side or back, and asleep, the cat keeps its paws and tail out of the ground", () => {
  const tailEnds = ["tail1", "tail2", "tail3", "tail4"];
  for (const name of ["flop", "roll", "sleep", "curlUp", "wake", "loaf", "sit"]) {
    for (const u of [0, 0.25, 0.5, 0.75]) {
      pose(clips, name, u);
      for (const k of PAWS) assert.ok(toeAt(k).y > -0.01, `${name} at ${u}: ${k} above the ground (${toeAt(k).y.toFixed(3)})`);
      for (const b of tailEnds) { const y = new THREE.Vector3().setFromMatrixPosition(sk.bones[b].matrixWorld).y; assert.ok(y > -0.005, `${name} at ${u}: ${b} above the ground (${y.toFixed(3)})`); }
    }
  }
});

test("posture changes and leaps move every joint smoothly: no paw flicks round, no tail whips, whatever the cat's style", () => {
  // Played at 60 fps, how much any joint's (or the tail tip's) velocity changes from one frame to the
  // next (model units). A paw tucked under or brought out, a tail carried high on landing, a tail
  // uncurling from round a sleeping cat: each once did it in two or three frames.
  const tip = () => rig.tail[4].clone().sub(sk.bones.tail4.userData.at).applyMatrix4(sk.bones.tail4.matrixWorld);
  const at = (c, name, t) => {
    const mixer = new THREE.AnimationMixer(sk.root), a = mixer.clipAction(c[name]);
    a.play(); a.time = t; mixer.update(0); sk.root.updateMatrixWorld(true);
    return [...sk.skeleton.bones.map((b) => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld)), tip()];
  };
  for (const style of [{}, { loafTuck: 0.9 }, { tail: 1 }, { tempo: 0.85, loafTuck: 0.7, tail: 0.7 }, { tempo: 1.25, sway: 0.8, loafTuck: 1 }]) {
    const c = R.makeClips(rig, style);
    for (const [name, A] of Object.entries(M.ACTIONS)) {
      if (A.kind !== "trans" && name !== "hop" && name !== "pounce") continue;
      const D = c[name].duration, N = Math.round(D * 60), limit = A.kind === "trans" ? 0.05 : 0.13;
      let p1 = null, p2 = null, worst = 0, where = "";
      for (let f = 0; f <= N; f++) {
        const p = at(c, name, Math.min(D - 1e-6, (f / N) * D));
        if (p2) p.forEach((q, i) => { const j = q.clone().sub(p1[i].clone().multiplyScalar(2)).add(p2[i]).length(); if (j > worst) { worst = j; where = `${i < p.length - 1 ? sk.skeleton.bones[i].name : "tail tip"} at u ${((f - 1) / N).toFixed(2)}`; } });
        p2 = p1; p1 = p;
      }
      assert.ok(worst <= limit, `${name} ${JSON.stringify(style)}: ${where} jerks ${worst.toFixed(3)} in one frame (at most ${limit})`);
    }
  }
});

test("turning on the spot, the paws step round: each stays put on the ground while the body turns over it", () => {
  const clips = R.makeClips(rig);
  assert.ok(clips.pivot && R.PIVOT_TURN > 0, "a pivot clip, stepped by the angle turned");
  for (const k of ["fL", "hR"]) {
    let start = null, worst = 0, lift = 0;
    for (let f = 0; f <= 120; f++) {
      const u = f / 120;
      pose(clips, "pivot", u);
      // The cat turned by u × PIVOT_TURN about its origin, as the renderer turns the model.
      const t = toeAt(k), w = t.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), u * R.PIVOT_TURN);
      if (t.y < 0.004) { if (!start) start = w; worst = Math.max(worst, w.distanceTo(start)); } else { start = null; lift = Math.max(lift, t.y); }
    }
    assert.ok(worst < 0.012, `${k}: a planted paw drifts ${worst.toFixed(3)} on the ground as the cat turns`);
    assert.ok(lift > 0.02, `${k}: and is lifted to step round`);
  }
});

test("pulling up out of any gait at any moment, every paw that moves is lifted to its place: none is dragged", () => {
  const clips = R.makeClips(rig), stand = R.makeClips(rig).stand;
  for (const g of ["walk", "trot", "run", "stalk"]) for (let k = 0; k < R.STOPS; k++) {
    const name = `stop:${g}:${k}`, c = clips[name];
    assert.ok(c && c.userData.loop === false, name);
    for (const leg of ["hL", "hR", "fL", "fR"]) {
      let prev = null;
      for (let f = 0; f <= 40; f++) {
        pose(clips, name, f / 40);
        const t = toeAt(leg);
        if (prev && t.y < 0.004 && prev.y < 0.004) assert.ok(Math.hypot(t.x - prev.x, t.z - prev.z) < 0.004, `${name} ${leg}: dragged along the ground at u ${(f / 40).toFixed(2)}`);
        prev = t;
      }
    }
    // It ends standing square, as the stand loop begins.
    pose(clips, name, 1);
    const end = ["hL", "hR", "fL", "fR"].map(toeAt);
    const mixer = new THREE.AnimationMixer(sk.root); mixer.clipAction(stand).play(); mixer.update(0); sk.root.updateMatrixWorld(true);
    ["hL", "hR", "fL", "fR"].forEach((leg, i) => assert.ok(toeAt(leg).distanceTo(end[i]) < 0.02, `${name} ${leg}: ends where it stands`));
  }
});

test("the wiggle before a pounce is in the hindquarters: the rump sways, the head holds still on the prey", () => {
  const clips = R.makeClips(rig);
  const zs = (bone) => { const v = []; for (let f = 0; f < 40; f++) { pose(clips, "wiggle", f / 40); v.push(new THREE.Vector3().setFromMatrixPosition(sk.bones[bone].matrixWorld).z); } return Math.max(...v) - Math.min(...v); };
  const head = zs("head"), rump = zs("tail1");
  assert.ok(head < 0.02, `head sways ${head.toFixed(3)} side to side`);
  assert.ok(rump > 3 * head && rump > 0.03, `rump sways ${rump.toFixed(3)}`);
});

// When each paw lands in a gait: the first sample of each planted stretch, as a share of the cycle.
function landings(name) {
  const N = 64, down = { hL: [], hR: [], fL: [], fR: [] }, at = {};
  for (let f = 0; f < N; f++) { pose(clips, name, f / N); for (const k in down) down[k].push(toeAt(k).y < 0.004); }
  for (const k in down) { const d = down[k]; at[k] = d.findIndex((v, f) => v && !d[(f + N - 1) % N]) / N; }
  return at;
}
const after = (a, b) => (((b - a) % 1) + 1) % 1; // how long after a comes b, in cycles

test("the gaits' footfalls: walk and stalk a lateral sequence, trot diagonal pairs, run a rotary gallop", () => {
  for (const name of ["walk", "stalk"]) {
    const w = landings(name);
    // Left hind, then left fore, right hind, right fore, about a quarter cycle apart.
    for (const [a, b] of [["hL", "fL"], ["fL", "hR"], ["hR", "fR"], ["fR", "hL"]]) assert.ok(Math.abs(after(w[a], w[b]) - 0.25) < 0.06, `${name}: ${a} to ${b} ${after(w[a], w[b]).toFixed(2)}`);
  }
  const t = landings("trot");
  assert.ok(after(t.hL, t.fR) < 0.06 || after(t.fR, t.hL) < 0.06, "trot: each hind lands with the opposite fore");
  const g = landings("run"), order = Object.keys(g).sort((a, b) => after(g.hR, g[a]) - after(g.hR, g[b]));
  // Rotary: the hinds one after the other, then the fores starting on the side the hinds ended on.
  assert.deepEqual(order, ["hR", "hL", "fL", "fR"], `run: footfalls ${order.join(" ")}`);
});
